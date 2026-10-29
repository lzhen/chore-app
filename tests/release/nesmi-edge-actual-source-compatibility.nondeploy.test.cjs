'use strict';
// NON-DEPLOYED, NO-NETWORK execution of the actual draft Edge handler source.
// PR #35 only. This does NOT deploy an Edge function, invoke Supabase, or delete an account.
// B122 source reference: d0610712e1dfedbe970d6d8c4ae54213d9a2dddc
// B122 AuthContext.tsx blob 7f6bff1edafe72b569f6db99af0e2e490d9f3fbc sends POST with no body.
// EXPECTED-UNSAFE results are release HOLD evidence, not passing safety validation.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const edgePath = path.join(__dirname, '../../supabase/functions/delete-account-v2/index.ts');
const edgeSource = fs.readFileSync(edgePath, 'utf8');

// Compile only the three audited TS constructs found in this source.
// Fail closed if the handler changes rather than accidentally testing a synthetic rewrite.
function compileCurrentEdge() {
  assert.equal((edgeSource.match(/^import /gm) || []).length, 2);
  for (const marker of [
    'Deno.serve(async (request: Request) =>',
    'let payload: unknown',
    '(payload as { expectedUserId?: unknown })',
    'adminClient.auth.admin.deleteUser(user.id)',
    'userClient.auth.getUser(bearerToken)',
    "const finalize = async (state: 'confirmed' | 'uncertain') =>",
  ]) assert.ok(edgeSource.includes(marker), 'Source contract changed: ' + marker);
  assert.equal((edgeSource.match(/Deno\.env\.get\('[A-Z_]+'\)!/g) || []).length, 0);
  assert.match(edgeSource, /if \(!supabaseUrl \|\| !anonKey \|\| !serviceRoleKey\)/);
  return edgeSource
    .replace(/^import .*\r?\n/gm, '')
    .replace('Deno.serve(async (request: Request) =>', 'Deno.serve(async (request) =>')
    .replace('let payload: unknown', 'let payload')
    .replace('(payload as { expectedUserId?: unknown })', '(payload)')
    .replace("const finalize = async (state: 'confirmed' | 'uncertain') =>", 'const finalize = async state =>')
    .replace(/(Deno\.env\.get\('[A-Z_]+'\))!/g, '$1');
}

function offlineEdge({
  authenticatedUser = 'synthetic-A', authThrows = false, anonClientThrows = false,
  missingEnv = null, adminClientThrows = false, adminError = null,
  adminData = { user: { id: 'synthetic-A' } }, adminReject = false, adminThrow = false,
  adminDelay = null,
  claimError = null, claimData, claimReject = false,
  finalizeData = true, finalizeError = null, finalizeReject = false,
} = {}) {
  let handler = null;
  const calls = [];
  const claimed = new Set();
  const claimId = '00000000-0000-4000-8000-000000000003';
  const sandbox = {
    Response,
    console: { error: () => calls.push('error-log') },
    fetch: () => { throw Error('NETWORK_FORBIDDEN_IN_SOURCE_TEST'); },
    Deno: {
      env: { get: key => key === missingEnv ? null : ({
        SUPABASE_URL: 'https://synthetic.invalid',
        SUPABASE_ANON_KEY: 'synthetic-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service',
      })[key] ?? null },
      serve: cb => { handler = cb; },
    },
    createClient: (_url, key) => {
      if (key === 'synthetic-anon') {
        if (anonClientThrows) throw Error('synthetic user client construction failure');
        return {
          auth: { getUser: async (token) => {
            assert.equal(token, 'fake-token', 'server must verify the explicit caller JWT');
            calls.push('bearer-auth');
            if (authThrows) throw Error('synthetic identity transport failure');
            return { data: { user: authenticatedUser ? { id: authenticatedUser } : null }, error: null };
          } },
        };
      }
      if (key === 'synthetic-service' && adminClientThrows) {
        calls.push('service-client-constructor');
        throw Error('synthetic service SDK initialization failure before claim');
      }
      if (key === 'synthetic-service') return {
        rpc: async (name, args) => {
          if (name === 'nesmi_delete_claim_draft_acquire') {
            calls.push('claim:' + args.p_account_id);
            if (claimReject) throw Error('synthetic ambiguous claim RPC');
            if (claimError) return { error: claimError, data: null };
            if (claimData !== undefined) return { error: null, data: claimData };
            if (claimed.has(args.p_account_id)) return { error: null, data: [] };
            claimed.add(args.p_account_id);
            return { error: null, data: [{ claim_id: claimId }] };
          }
          assert.equal(name, 'nesmi_delete_claim_draft_finalize');
          assert.equal(args.p_claim_id, claimId);
          calls.push('finalize:' + args.p_state);
          if (finalizeReject) throw Error('synthetic ambiguous finalize RPC');
          return { error: finalizeError, data: finalizeData };
        },
        auth: { admin: { deleteUser: id => {
          calls.push('admin-delete:' + id);
          if (adminThrow) throw new Error('synthetic synchronous SDK exception after claim');
          if (adminReject) return Promise.reject(new Error('synthetic async transport exception'));
          // Keep the admin outcome pending to execute a true in-flight replay regression.
          return Promise.resolve(adminDelay).then(() => ({ data: adminData, error: adminError }));
        } } },
      };
      throw Error('Unexpected synthetic client key');
    },
  };
  vm.runInNewContext(compileCurrentEdge(), sandbox, {
    filename: 'delete-account/index.ts (offline only)',
    timeout: 2000,
  });
  assert.equal(typeof handler, 'function');
  return { handler, calls };
}

function makeRequest(body, { auth = 'Bearer fake-token', method = 'POST', rawBody } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = auth;
  return new Request('https://synthetic.invalid/functions/v1/delete-account', {
    method, headers,
    ...(rawBody !== undefined ? { body: rawBody } : body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

test('actual draft v2 rejects malformed bearer authorization before SDK or deletion', async () => {
  for (const auth of [null, '', 'Basic fake-token', 'Bearer', 'Bearer fake-token extra', 'fake-token']) {
    const h = offlineEdge();
    const response = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }, { auth }));
    assert.equal(response.status, 401);
    assert.deepEqual(h.calls, [], 'malformed authorization must not reach SDK, claim or delete');
  }
});

test('actual draft Edge rejects installed B122-style bodyless request before admin delete', async () => {
  const h = offlineEdge();
  const response = await h.handler(makeRequest(undefined));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Invalid deletion request' });
  assert.deepEqual(h.calls, []); // No bearer lookup or irreversible call.
});

test('actual draft Edge rejects missing/mismatched authenticated identity', async () => {
  const missing = offlineEdge();
  const noAuth = await missing.handler(makeRequest({ expectedUserId: 'synthetic-A' }, { auth: null }));
  assert.equal(noAuth.status, 401);
  assert.deepEqual(missing.calls, []);
  const mismatch = offlineEdge();
  const bad = await mismatch.handler(makeRequest({ expectedUserId: 'synthetic-B' }));
  assert.equal(bad.status, 409);
  assert.deepEqual(mismatch.calls, ['bearer-auth']);
});

test('actual draft Edge rejects invalid or empty JSON without admin call', async () => {
  for (const req of [makeRequest({}, {}), makeRequest(undefined, { rawBody: '{not json' })]) {
    const h = offlineEdge();
    const response = await h.handler(req);
    assert.equal(response.status, 400);
    assert.deepEqual(h.calls, []);
  }
});

test('actual draft v2 rejects missing runtime configuration before any SDK or destructive call', async () => {
  for (const missingEnv of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const h = offlineEdge({ missingEnv });
    const response = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /No deletion was attempted/);
    assert.deepEqual(h.calls, [], 'misconfigured runtime must not reach bearer or service-role SDK');
  }
});

test('actual draft v2 handles user SDK construction and getUser transport exceptions before claim', async () => {
  for (const options of [{ anonClientThrows: true }, { authThrows: true }]) {
    const h = offlineEdge(options);
    const response = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /No deletion was attempted/);
    assert.equal(h.calls.some(x => x.startsWith('claim:') || x.startsWith('admin-delete:')), false);
  }
});

test('actual draft v2 reports known no-op when privileged SDK initialization fails before claim', async () => {
  const h = offlineEdge({ adminClientThrows: true });
  const response = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /No deletion was attempted/);
  assert.deepEqual(h.calls, ['bearer-auth', 'service-client-constructor']);
  assert.equal(h.calls.some(x => x.startsWith('claim:') || x.startsWith('admin-delete:')), false);
});

test('actual draft Edge valid upgraded-client request reaches exactly one synthetic admin call', async () => {
  const h = offlineEdge();
  const response = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });
  assert.deepEqual(h.calls, ['bearer-auth', 'claim:synthetic-A', 'admin-delete:synthetic-A', 'finalize:confirmed']);
});

test('actual draft Edge synthetic admin error fails response but cannot prove deletion outcome', async () => {
  const h = offlineEdge({ adminError: { message: 'synthetic-error' } });
  const response = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Deletion outcome uncertain. Contact support before retrying.' });
  assert.deepEqual(h.calls, ['bearer-auth', 'claim:synthetic-A', 'admin-delete:synthetic-A', 'finalize:uncertain']);
});


test('actual draft Edge never sends deleted:true on missing/malformed admin receipt or transport exception', async () => {
  for (const options of [
    { adminData: null },
    { adminData: {} },
    { adminData: { user: null } },
    { adminData: { user: [] } },
    { adminData: { user: {} } }, // Ambiguous receipt: no account identity
    { adminData: { user: { id: '' } } },
    { adminReject: true },
  ]) {
    const h = offlineEdge(options);
    const response = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: 'Deletion outcome uncertain. Contact support before retrying.',
    });
    assert.deepEqual(h.calls, ['bearer-auth', 'claim:synthetic-A', 'admin-delete:synthetic-A', 'finalize:uncertain']);
  }
  // The RPC remains nondeployed and legacy B123 compatibility remains HOLD.
});

test('actual draft Edge handles a synchronous admin SDK throw without success or retry', async () => {
  const h = offlineEdge({ adminThrow: true });
  const response = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: 'Deletion outcome uncertain. Contact support before retrying.',
  });
  assert.deepEqual(h.calls, [
    'bearer-auth', 'claim:synthetic-A', 'admin-delete:synthetic-A', 'finalize:uncertain',
  ]);
  const replay = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
  assert.equal(replay.status, 409);
  assert.equal(h.calls.filter(c => c === 'admin-delete:synthetic-A').length, 1);
});

test('actual draft Edge never acknowledges a conflicting admin receipt identity', async () => {
  for (const receiptId of ['synthetic-B', null, 42]) {
    const h = offlineEdge({ adminData: { user: { id: receiptId } } });
    const response = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
    assert.equal(response.status, 503, 'conflicting or malformed receipt must be uncertain');
    assert.deepEqual(await response.json(), {
      error: 'Deletion outcome uncertain. Contact support before retrying.',
    });
    assert.deepEqual(h.calls, [
      'bearer-auth', 'claim:synthetic-A', 'admin-delete:synthetic-A', 'finalize:uncertain',
    ]);
    const replay = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
    assert.equal(replay.status, 409);
    assert.equal(h.calls.filter(x => x === 'admin-delete:synthetic-A').length, 1);
  }

  const matching = offlineEdge({ adminData: { user: { id: 'synthetic-A' } } });
  const response = await matching.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });
  // The default successful fixture carries the exact synthetic account ID.
  // The id-less receipt is now rejected above as uncertain (no false ACK).
});

test('actual draft Edge requires synthetic durable claim and blocks repeat admin call', async () => {
  const h = offlineEdge();
  const one = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
  const two = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
  assert.equal(one.status, 200);
  assert.equal(two.status, 409);
  assert.match((await two.json()).error, /do not retry/);
  assert.equal(h.calls.filter(x => x === 'admin-delete:synthetic-A').length, 1);
  // Synthetic RPC only; not evidence of a deployed SQL function or true concurrency.
});

test('actual draft Edge blocks a concurrent replay while first admin deletion is still in flight', async () => {
  // Deliberately pause the first admin receipt after claim acquisition. This is
  // source-executed offline QA only, not a live Supabase/Edge concurrency proof.
  let unblockAdmin;
  const pendingAdmin = new Promise(resolve => { unblockAdmin = resolve; });
  const h = offlineEdge({ adminDelay: pendingAdmin });
  const first = h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
  try {
    for (let i = 0; i < 30 && !h.calls.includes('admin-delete:synthetic-A'); i++) {
      await Promise.resolve();
    }
    assert.ok(h.calls.includes('admin-delete:synthetic-A'), 'first request must reach held admin call');
    assert.equal(h.calls.includes('finalize:confirmed'), false, 'first request is still in flight');
    const replay = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
    assert.equal(replay.status, 409, 'durable-claim stand-in must reject concurrent replay');
    assert.match((await replay.json()).error, /do not retry/);
    assert.equal(h.calls.filter(x => x === 'admin-delete:synthetic-A').length, 1);
  } finally {
    unblockAdmin();
  }
  const completed = await first;
  assert.equal(completed.status, 200);
  assert.deepEqual(await completed.json(), { deleted: true });
  assert.equal(h.calls.filter(x => x === 'finalize:confirmed').length, 1);
  assert.equal(h.calls.filter(x => x === 'admin-delete:synthetic-A').length, 1);
});

test('missing, ambiguous or malformed claim never starts the admin deletion', async () => {
  for (const options of [
    { claimError: { message: 'synthetic RPC error' } },
    { claimReject: true },
    { claimData: null },
    { claimData: [{ claim_id: 'not-a-uuid' }] },
    { claimData: [{ claim_id: '00000000-0000-4000-8000-000000000003' }, { claim_id: '00000000-0000-4000-8000-000000000004' }] },
  ]) {
    const h = offlineEdge(options);
    const response = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
    assert.equal(response.status, 503);
    assert.equal(h.calls.some(c => c.startsWith('admin-delete:')), false);
  }
});

test('missing durable finalize ACK never reports deleted true; claim stays locked', async () => {
  for (const options of [
    { finalizeData: false },
    { finalizeReject: true },
    { finalizeError: { message: 'synthetic finalize error' } },
  ]) {
    const h = offlineEdge(options);
    const response = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
    assert.equal(response.status, 503);
    assert.notEqual((await response.json()).deleted, true);
    const replay = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
    assert.equal(replay.status, 409);
    assert.equal(h.calls.filter(x => x === 'admin-delete:synthetic-A').length, 1);
  }
});

test('proposed nondeployed adapter deliberately differs from existing Edge legacy response', async () => {
  const { coordinateNonDeployedDeletion } = require('../../docs/release/prototypes/nesmi-delete-edge-orchestration.nondeploy.cjs');
  const proposed = await coordinateNonDeployedDeletion({ authorization: 'Bearer synthetic', body: undefined }, {});
  assert.equal(proposed.status, 426); // PROPOSAL ONLY; rollout status is not approved.
  assert.equal(proposed.body.code, 'CLIENT_UPGRADE_REQUIRED');
});
