'use strict';
// No-network synthetic integration of the NON-DEPLOYED SDK bridge + existing
// coordinator. No real auth user, project key, Supabase client, or deletion.
// This is NOT the production Edge handler and does not lift release HOLD.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createNonDeployedSdkDeleteHandler } = require('../../docs/release/prototypes/nesmi-delete-edge-sdk-bridge.nondeploy.cjs');

const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const CLAIM = '00000000-0000-4000-8000-000000000003';
function makeSandbox({ subject = A, claimResult, deleteResult, finalizeResult, authError = null } = {}) {
  const calls = [];
  const claimed = new Set();
  const makeClient = (_url, key, options) => {
    calls.push('client:' + key);
    if (key === 'synthetic-anon') {
      assert.equal(options.global.headers.Authorization, 'Bearer synthetic');
      return { auth: { getUser: async () => {
        calls.push('auth');
        return { data: { user: subject ? { id: subject } : null }, error: authError };
      } } };
    }
    assert.equal(key, 'synthetic-service');
    assert.equal(options.auth.persistSession, false);
    return {
      rpc: async (fn, args) => {
        if (fn === 'nesmi_delete_claim_draft_acquire') {
          calls.push('claim:' + args.p_account_id);
          if (claimResult) return claimResult(args.p_account_id);
          if (claimed.has(args.p_account_id)) return { data: [], error: null };
          claimed.add(args.p_account_id);
          return { data: [{ claim_id: CLAIM }], error: null };
        }
        assert.equal(fn, 'nesmi_delete_claim_draft_finalize');
        calls.push('finalize:' + args.p_state);
        assert.equal(args.p_claim_id, CLAIM);
        if (finalizeResult) return finalizeResult(args.p_state);
        return { data: true, error: null };
      },
      auth: { admin: { deleteUser: async (id) => {
        calls.push('delete:' + id);
        return deleteResult ? deleteResult(id) : { data: { user: {} }, error: null };
      } } },
    };
  };
  const handler = createNonDeployedSdkDeleteHandler({
    createClient: makeClient, url: 'https://synthetic.invalid',
    anonKey: 'synthetic-anon', serviceRoleKey: 'synthetic-service',
  });
  const invoke = (body = { expectedUserId: A }, authorization = 'Bearer synthetic') =>
    handler({
      headers: { get: name => name === 'Authorization' ? authorization : null },
      json: async () => body,
    });
  return { calls, invoke, claimed, handler };
}

test('success uses bearer auth, one durable claim, SDK v2 empty user, confirmed finalize', async () => {
  const h = makeSandbox();
  const result = await h.invoke();
  assert.deepEqual(result, { status: 200, body: { deleted: true } });
  assert.deepEqual(h.calls, [
    'client:synthetic-anon', 'auth', 'client:synthetic-service',
    'claim:' + A, 'delete:' + A, 'finalize:confirmed',
  ]);
});

test('legacy B122 bodyless request fails before any SDK client or privileged call', async () => {
  const h = makeSandbox();
  const result = await h.handler({
    headers: { get: () => 'Bearer synthetic' },
    json: async () => { throw new SyntaxError('bodyless request'); },
  });
  assert.equal(result.status, 426); // proposed response; NOT current Edge's observed 400
  assert.equal(result.body.deleted, false);
  assert.deepEqual(h.calls, []);
});

test('missing bearer is refused before SDK access', async () => {
  const h = makeSandbox();
  const result = await h.invoke({ expectedUserId: A }, null);
  assert.equal(result.status, 401);
  assert.deepEqual(h.calls, []);
});

test('bearer subject mismatch rejects before service-role client is created', async () => {
  const h = makeSandbox({ subject: B });
  const result = await h.invoke();
  assert.equal(result.status, 409);
  assert.deepEqual(h.calls, ['client:synthetic-anon', 'auth']);
});

test('unverified auth never performs a privileged RPC', async () => {
  const h = makeSandbox({ authError: new Error('synthetic offline auth') });
  const result = await h.invoke();
  assert.equal(result.status, 401);
  assert.deepEqual(h.calls, ['client:synthetic-anon', 'auth']);
});

test('two independently constructed bridge workers share durable claim boundary', async () => {
  const h = makeSandbox();
  const first = await h.invoke();
  const second = await h.invoke();
  assert.equal(first.status, 200);
  assert.equal(second.body.code, 'EXISTING_CLAIM_DO_NOT_RETRY');
  assert.equal(h.calls.filter(x => x === 'delete:' + A).length, 1);
});

test('uncertain RPC acquisition (error or malformed shape) blocks admin deletion', async () => {
  for (const response of [
    { data: null, error: new Error('synthetic timeout') },
    { data: null, error: null },
    { data: [{ wrong: 'shape' }], error: null },
    { data: [{ claim_id: CLAIM }, { claim_id: CLAIM }], error: null },
  ]) {
    const h = makeSandbox({ claimResult: async () => response });
    const result = await h.invoke();
    assert.equal(result.status, 503);
    assert.equal(h.calls.filter(x => x.startsWith('delete:')).length, 0);
  }
});

test('SDK deletion error, absent data or unknown result cannot yield success', async () => {
  for (const response of [
    { data: { user: null }, error: new Error('synthetic failure') },
    { data: null, error: null },
    { error: null },
  ]) {
    const h = makeSandbox({ deleteResult: async () => response });
    const result = await h.invoke();
    assert.equal(result.body.code, 'OUTCOME_UNCERTAIN_DO_NOT_RETRY');
    assert.equal(h.calls.filter(x => x === 'finalize:uncertain').length, 1);
  }
});

test('admin timeout after a successful claim fails closed without retry', async () => {
  const h = makeSandbox({ deleteResult: async () => { throw Error('synthetic timeout'); } });
  const result = await h.invoke();
  assert.equal(result.status, 503);
  assert.equal(h.calls.filter(x => x.startsWith('delete:')).length, 1);
  assert.equal(h.calls.filter(x => x === 'finalize:uncertain').length, 1);
});

test('finalize false/error never reports deleted:true or re-acquires claim', async () => {
  for (const response of [
    { data: false, error: null },
    { data: null, error: new Error('synthetic RPC timeout') },
  ]) {
    const h = makeSandbox({ finalizeResult: async state =>
      state === 'confirmed' ? response : { data: true, error: null } });
    const result = await h.invoke();
    assert.equal(result.body.code, 'OUTCOME_UNCERTAIN_DO_NOT_RETRY');
    assert.equal(h.calls.filter(x => x.startsWith('claim:')).length, 1);
    assert.deepEqual(h.calls.filter(x => x.startsWith('finalize:')), [
      'finalize:confirmed', 'finalize:uncertain',
    ]);
  }
});

test('bridge has no real transport, embedded secret or Deno/Edge registration', () => {
  const source = require('node:fs').readFileSync(require.resolve(
    '../../docs/release/prototypes/nesmi-delete-edge-sdk-bridge.nondeploy.cjs'), 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(|\bDeno\.serve\s*\(/);
  assert.doesNotMatch(source, /require\(['"](?:@supabase|https?:)/);
});
