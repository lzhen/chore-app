'use strict';
// Synthetic no-network contract for the NON-DEPLOYED Edge orchestration draft.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { coordinateNonDeployedDeletion: run } = require('../../docs/release/prototypes/nesmi-delete-edge-orchestration.nondeploy.cjs');
const req = { authorization: 'Bearer synthetic-not-a-real-token', body: { expectedUserId: 'synthetic-subject-A' } };
function harness(overrides = {}) {
  const calls = [];
  const claimed = new Set();
  const defaultAdapter = {
    async authenticateBearer() { calls.push('auth'); return { id: 'synthetic-subject-A' }; },
    async acquireClaim(id) {
      calls.push('acquire');
      if (claimed.has(id)) return null;
      claimed.add(id);
      return { claim_id: 'synthetic-claim-1' };
    },
    async adminDeleteUser() { calls.push('delete'); return true; },
    async finalizeClaim(_account, _claim, state) { calls.push(`finalize:${state}`); return true; },
  };
  return { calls, adapter: { ...defaultAdapter, ...overrides } };
}

for (const [name, request] of [
  ['missing bearer', { body: req.body }],
  ['legacy B122 bodyless request', { authorization: req.authorization }],
  ['malformed body', { authorization: req.authorization, body: [] }],
  ['blank expected subject', { authorization: req.authorization, body: { expectedUserId: ' ' } }],
]) {
  test(`${name} is rejected before auth, claim, or admin deletion`, async () => {
    const h = harness();
    const result = await run(request, h.adapter);
    assert.equal(result.body.deleted, false);
    assert.deepEqual(h.calls, []);
  });
}

test('auth mismatch rejects before claim and irreversible operation', async () => {
  const h = harness({ authenticateBearer: async () => { h.calls.push('auth'); return { id: 'synthetic-subject-B' }; } });
  const result = await run(req, h.adapter);
  assert.equal(result.status, 409);
  assert.deepEqual(h.calls, ['auth']);
});

test('auth error never acquires a deletion claim', async () => {
  const h = harness({ authenticateBearer: async () => { h.calls.push('auth'); throw Error('synthetic auth failure'); } });
  const result = await run(req, h.adapter);
  assert.equal(result.status, 401);
  assert.deepEqual(h.calls, ['auth']);
});

test('existing durable claim blocks a second deletion', async () => {
  const h = harness();
  const first = await run(req, h.adapter);
  const second = await run(req, h.adapter);
  assert.equal(first.body.deleted, true);
  assert.equal(second.body.deleted, false);
  assert.equal(second.body.code, 'EXISTING_CLAIM_DO_NOT_RETRY');
  assert.equal(h.calls.filter(x => x === 'delete').length, 1);
});

test('claim RPC timeout/uncertain ACK never invokes delete', async () => {
  const h = harness({ acquireClaim: async () => { h.calls.push('acquire'); throw Error('synthetic rpc timeout after possible reservation'); } });
  const result = await run(req, h.adapter);
  assert.equal(result.body.code, 'CLAIM_OUTCOME_UNCERTAIN_DO_NOT_RETRY');
  assert.deepEqual(h.calls, ['auth', 'acquire']);
});

test('malformed acquired claim never grants deletion permission', async () => {
  const h = harness({ acquireClaim: async () => { h.calls.push('acquire'); return { unexpected: true }; } });
  const result = await run(req, h.adapter);
  assert.equal(result.body.deleted, false);
  assert.deepEqual(h.calls, ['auth', 'acquire']);
});

test('confirmed admin result and durable finalize ACK alone permits deleted:true', async () => {
  const h = harness();
  const result = await run(req, h.adapter);
  assert.deepEqual(result, { status: 200, body: { deleted: true } });
  assert.deepEqual(h.calls, ['auth', 'acquire', 'delete', 'finalize:confirmed']);
});

for (const [name, behavior] of [
  ['throws after possible admin deletion', async () => { throw Error('ambiguous network'); }],
  ['returns false rather than strict success', async () => false],
  ['returns truthy non-boolean result', async () => ({ data: true })],
]) {
  test(`admin ${name} finalizes uncertain and cannot claim success`, async () => {
    const h = harness({ adminDeleteUser: async () => { h.calls.push('delete'); return behavior(); } });
    const result = await run(req, h.adapter);
    assert.equal(result.body.code, 'OUTCOME_UNCERTAIN_DO_NOT_RETRY');
    assert.deepEqual(h.calls, ['auth', 'acquire', 'delete', 'finalize:uncertain']);
  });
}

test('failed uncertainty finalization does not manufacture an ACK', async () => {
  const h = harness({
    adminDeleteUser: async () => { h.calls.push('delete'); throw Error('unknown transport'); },
    finalizeClaim: async (_id,_claim,state) => { h.calls.push(`finalize:${state}`); throw Error('RPC unavailable'); },
  });
  const result = await run(req, h.adapter);
  assert.equal(result.body.code, 'OUTCOME_UNCERTAIN_DO_NOT_RETRY');
  assert.deepEqual(h.calls, ['auth', 'acquire', 'delete', 'finalize:uncertain']);
});

for (const mode of ['false', 'throw']) {
  test(`confirmed finalize ${mode} cannot return deleted:true`, async () => {
    const h = harness({
      finalizeClaim: async (_id,_claim,state) => {
        h.calls.push(`finalize:${state}`);
        if (state === 'confirmed') {
          if (mode === 'throw') throw Error('synthetic finalize ack lost');
          return false;
        }
        return true;
      },
    });
    const result = await run(req, h.adapter);
    assert.equal(result.body.code, 'OUTCOME_UNCERTAIN_DO_NOT_RETRY');
    assert.deepEqual(h.calls, ['auth','acquire','delete','finalize:confirmed','finalize:uncertain']);
  });
}

test('no real Supabase/network/production dependency can be reached by the adapter', () => {
  const source = require('node:fs').readFileSync(require.resolve('../../docs/release/prototypes/nesmi-delete-edge-orchestration.nondeploy.cjs'), 'utf8');
  assert.doesNotMatch(source, /require\(['"](?:https?|@supabase|node:https|node:http)/);
  assert.doesNotMatch(source, /fetch\s*\(|Deno\.serve\s*\(/);
});
