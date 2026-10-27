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

const edgePath = path.join(__dirname, '../../supabase/functions/delete-account/index.ts');
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
  ]) assert.ok(edgeSource.includes(marker), 'Source contract changed: ' + marker);
  assert.equal((edgeSource.match(/Deno\.env\.get\('[A-Z_]+'\)!/g) || []).length, 3);
  return edgeSource
    .replace(/^import .*\r?\n/gm, '')
    .replace('Deno.serve(async (request: Request) =>', 'Deno.serve(async (request) =>')
    .replace('let payload: unknown', 'let payload')
    .replace('(payload as { expectedUserId?: unknown })', '(payload)')
    .replace(/(Deno\.env\.get\('[A-Z_]+'\))!/g, '$1');
}

function offlineEdge({ authenticatedUser = 'synthetic-A', adminError = null, adminData = { user: {} }, adminReject = false } = {}) {
  let handler = null;
  const calls = [];
  const sandbox = {
    Response,
    console: { error: () => calls.push('error-log') },
    fetch: () => { throw Error('NETWORK_FORBIDDEN_IN_SOURCE_TEST'); },
    Deno: {
      env: { get: key => ({
        SUPABASE_URL: 'https://synthetic.invalid',
        SUPABASE_ANON_KEY: 'synthetic-anon',
        SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service',
      })[key] ?? null },
      serve: cb => { handler = cb; },
    },
    createClient: (_url, key) => {
      if (key === 'synthetic-anon') return {
        auth: { getUser: async () => {
          calls.push('bearer-auth');
          return { data: { user: authenticatedUser ? { id: authenticatedUser } : null }, error: null };
        } },
      };
      if (key === 'synthetic-service') return {
        auth: { admin: { deleteUser: async id => {
          calls.push('admin-delete:' + id);
          if (adminReject) throw new Error('synthetic transport exception after admin attempt');
          return { data: adminData, error: adminError };
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

test('actual draft Edge valid upgraded-client request reaches exactly one synthetic admin call', async () => {
  const h = offlineEdge();
  const response = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });
  assert.deepEqual(h.calls, ['bearer-auth', 'admin-delete:synthetic-A']);
});

test('actual draft Edge synthetic admin error fails response but cannot prove deletion outcome', async () => {
  const h = offlineEdge({ adminError: { message: 'synthetic-error' } });
  const response = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'Deletion outcome uncertain. Contact support before retrying.' });
  assert.deepEqual(h.calls, ['bearer-auth', 'admin-delete:synthetic-A', 'error-log']);
});



test('actual draft Edge never sends deleted:true on missing/malformed admin receipt or transport exception', async () => {
  for (const options of [
    { adminData: null },
    { adminData: {} },
    { adminData: { user: null } },
    { adminData: { user: [] } },
    { adminReject: true },
  ]) {
    const h = offlineEdge(options);
    const response = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: 'Deletion outcome uncertain. Contact support before retrying.',
    });
    assert.deepEqual(h.calls, ['bearer-auth', 'admin-delete:synthetic-A']);
  }
  // This does not solve the still-unimplemented durable claim or legacy client gate.
});

test('EXPECTED UNSAFE: actual draft Edge has no durable claim, so repeated synthetic requests reach admin twice', async () => {
  const h = offlineEdge();
  const one = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
  const two = await h.handler(makeRequest({ expectedUserId: 'synthetic-A' }));
  assert.equal(one.status, 200);
  assert.equal(two.status, 200);
  assert.equal(h.calls.filter(x => x === 'admin-delete:synthetic-A').length, 2);
  // This is a negative regression reproducer, NOT proof that production can delete twice.
});

test('proposed nondeployed adapter deliberately differs from existing Edge legacy response', async () => {
  const { coordinateNonDeployedDeletion } = require('../../docs/release/prototypes/nesmi-delete-edge-orchestration.nondeploy.cjs');
  const proposed = await coordinateNonDeployedDeletion({ authorization: 'Bearer synthetic', body: undefined }, {});
  assert.equal(proposed.status, 426); // PROPOSAL ONLY; rollout status is not approved.
  assert.equal(proposed.body.code, 'CLIENT_UPGRADE_REQUIRED');
});
