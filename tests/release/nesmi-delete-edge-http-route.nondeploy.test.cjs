'use strict';
// Source-backed, NO-NETWORK tests for the non-deployed HTTP boundary over
// the SDK-shaped claim/delete/finalize bridge. NOT a live Deno/Edge test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createNonDeployedEdgeHttpRoute } = require('../../docs/release/prototypes/nesmi-delete-edge-http-route.nondeploy.cjs');

const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const CLAIM = '00000000-0000-4000-8000-000000000003';

function sandbox(options = {}) {
  const calls = [];
  const claimed = new Set();
  const clients = (url, key, config) => {
    assert.equal(url, 'https://synthetic.invalid');
    if (key === 'synthetic-anon') {
      assert.equal(config.auth.persistSession, false);
      return { auth: { getUser: async () => {
        calls.push('auth');
        return { data: { user: { id: options.subject || A } }, error: null };
      } } };
    }
    assert.equal(key, 'synthetic-service');
    assert.equal(config.auth.persistSession, false);
    return {
      rpc: async (fn, args) => {
        if (fn === 'nesmi_delete_claim_draft_acquire') {
          calls.push('claim');
          if (options.claimResult) return options.claimResult;
          if (claimed.has(args.p_account_id)) return { data: [], error: null };
          claimed.add(args.p_account_id);
          return { data: [{ claim_id: CLAIM }], error: null };
        }
        assert.equal(fn, 'nesmi_delete_claim_draft_finalize');
        assert.equal(args.p_claim_id, CLAIM);
        calls.push('finalize:' + args.p_state);
        return { data: true, error: null };
      },
      auth: { admin: { deleteUser: async id => {
        assert.equal(id, A);
        calls.push('delete');
        return options.deleteResult || { data: { user: {} }, error: null };
      } } },
    };
  };
  const sdk = {
    createClient: clients,
    url: 'https://synthetic.invalid',
    anonKey: 'synthetic-anon',
    serviceRoleKey: 'synthetic-service',
  };
  return { calls, route: createNonDeployedEdgeHttpRoute(sdk),
    spawn: () => createNonDeployedEdgeHttpRoute(sdk) };
}

function request(body = { expectedUserId: A }, { method = 'POST', bearer = 'Bearer synthetic', bodyless = false } = {}) {
  return new Request('https://synthetic.invalid/functions/v1/delete-account', {
    method,
    headers: bearer ? { Authorization: bearer } : {},
    ...((method === 'GET' || method === 'OPTIONS' || bodyless)
      ? {} : { body: JSON.stringify(body), headers: { Authorization: bearer || '' } }),
  });
}

test('preflight and invalid method are handled before SDK/auth/admin access', async () => {
  const h = sandbox();
  const options = await h.route(request(undefined, { method: 'OPTIONS' }));
  assert.equal(options.status, 200);
  assert.equal(options.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  const get = await h.route(request(undefined, { method: 'GET' }));
  assert.equal(get.status, 405);
  assert.deepEqual(await get.json(), { deleted: false, code: 'METHOD_NOT_ALLOWED' });
  assert.deepEqual(h.calls, []);
});

test('strict upgraded-client request authenticates, claims, deletes, finalizes and ACKs', async () => {
  const h = sandbox();
  const result = await h.route(request());
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { deleted: true });
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), '*');
  assert.deepEqual(h.calls, ['auth', 'claim', 'delete', 'finalize:confirmed']);
});

test('shared synthetic claim rejects replay from separately constructed HTTP route', async () => {
  const h = sandbox();
  const first = await h.route(request());
  const second = await h.spawn()(request());
  assert.equal(first.status, 200);
  assert.equal(second.status, 409);
  assert.equal((await second.json()).code, 'EXISTING_CLAIM_DO_NOT_RETRY');
  assert.equal(h.calls.filter(x => x === 'delete').length, 1);
});

test('B122 bodyless request fails without creating a privileged client; 426 is not a live policy', async () => {
  const h = sandbox();
  const result = await h.route(request(undefined, { bodyless: true }));
  assert.equal(result.status, 426);
  assert.equal((await result.json()).deleted, false);
  assert.deepEqual(h.calls, []);
});

test('missing bearer and mismatched expected identity refuse all privileged work', async () => {
  const missing = sandbox();
  const noAuth = await missing.route(request({ expectedUserId: A }, { bearer: null }));
  assert.equal(noAuth.status, 401);
  assert.deepEqual(missing.calls, []);
  const mismatch = sandbox({ subject: B });
  const response = await mismatch.route(request());
  assert.equal(response.status, 409);
  assert.deepEqual(mismatch.calls, ['auth']);
});

test('malformed claim result cannot invoke admin deletion', async () => {
  const h = sandbox({ claimResult: { data: [{ fake: CLAIM }], error: null } });
  const response = await h.route(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).deleted, false);
  assert.deepEqual(h.calls, ['auth', 'claim']);
});

test('admin SDK failure never produces deleted:true, but records uncertain finalize', async () => {
  const h = sandbox({ deleteResult: { data: null, error: { message: 'synthetic transport failure' } } });
  const response = await h.route(request());
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'OUTCOME_UNCERTAIN_DO_NOT_RETRY');
  assert.deepEqual(h.calls, ['auth', 'claim', 'delete', 'finalize:uncertain']);
});

test('non-deployed route has no Deno registration, real SDK import or transport', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(require.resolve(
    '../../docs/release/prototypes/nesmi-delete-edge-http-route.nondeploy.cjs'), 'utf8');
  assert.doesNotMatch(source, /\bDeno\.serve\s*\(|\bfetch\s*\(|require\(['"](?:https?:|@supabase)/);
});
