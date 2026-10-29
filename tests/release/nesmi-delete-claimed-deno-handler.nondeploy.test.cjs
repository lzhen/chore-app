'use strict';
// NONDEPLOYED Deno.serve source executed in a synthetic Node VM: no Supabase,
// network, actual PostgreSQL claim table, production secrets or real deletion.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const candidatePath = path.resolve(__dirname, '../../docs/release/prototypes/nesmi-delete-claimed-deno-handler.nondeploy.ts');
const source = fs.readFileSync(candidatePath, 'utf8');
const imports = source.match(/^import .*$/gm) || [];
assert.equal(imports.length, 2, 'unexpected Deno imports must fail the VM smoke test');
assert.ok(source.includes("import { createClient } from 'npm:@supabase/supabase-js@2'"));
assert.match(source, /Deno\.serve\(async \(request\) =>/);
const compiled = source.replace(/^import .*\r?\n/gm, '');
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const CLAIM = '00000000-0000-4000-8000-000000000003';
const makeReq = (body = { expectedUserId: A }, { method = 'POST', authorization = 'Bearer synthetic', bodyless = false } = {}) =>
  new Request('https://synthetic.invalid/functions/v1/delete-account', {
    method,
    headers: { ...(authorization ? { Authorization: authorization } : {}), 'Content-Type': 'application/json' },
    ...(['GET', 'OPTIONS'].includes(method) || bodyless ? {} : { body: JSON.stringify(body) }),
  });

function setup(options = {}) {
  const calls = [];
  const claims = new Set(); // synthetic stand-in for durable DB constraint ONLY
  const handlers = [];
  const createClient = (url, key, config) => {
    assert.equal(url, 'https://synthetic.invalid');
    if (key === 'synthetic-anon') {
      calls.push('anon-client');
      assert.equal(config.auth.persistSession, false);
      return { auth: { getUser: async () => {
        calls.push('auth');
        if (options.authThrows) throw Error('synthetic auth failure');
        return { error: null, data: { user: { id: options.authenticatedId || A } } };
      } } };
    }
    if (key !== 'synthetic-service') throw Error('UNEXPECTED_KEY');
    calls.push('service-client');
    if (options.serviceClientThrows) throw Error('synthetic privileged client initialization failure');
    assert.equal(config.auth.autoRefreshToken, false);
    return {
      rpc: async (name, args) => {
        if (name === 'nesmi_delete_claim_draft_acquire') {
          calls.push('claim');
          assert.equal(args.p_account_id, A);
          if (options.claimThrows) throw Error('ambiguous RPC');
          if (options.claimResult !== undefined) return options.claimResult;
          if (claims.has(args.p_account_id)) return { error: null, data: [] };
          claims.add(args.p_account_id);
          return { error: null, data: [{ claim_id: CLAIM }] };
        }
        assert.equal(name, 'nesmi_delete_claim_draft_finalize');
        assert.equal(args.p_claim_id, CLAIM);
        calls.push('finalize:' + args.p_state);
        return options.finalizeResult === undefined ? { error: null, data: true } : options.finalizeResult;
      },
      auth: { admin: { deleteUser: async id => {
        assert.equal(id, A);
        calls.push('delete');
        if (options.deleteThrows) throw Error('ambiguous admin timeout');
        return options.deleteResult === undefined ? { error: null, data: { user: {} } } : options.deleteResult;
      } } },
    };
  };
  const spawn = () => {
    let handler;
    vm.runInNewContext(compiled, {
      Response,
      Deno: {
        serve: h => { handler = h; },
        env: { get: k => options.missingEnv === k ? undefined : ({
          SUPABASE_URL: 'https://synthetic.invalid',
          SUPABASE_ANON_KEY: 'synthetic-anon',
          SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service',
        })[k] },
      },
      createClient,
      fetch: () => { throw Error('NETWORK_FORBIDDEN'); },
    }, { filename: candidatePath, timeout: 1000 });
    assert.equal(typeof handler, 'function');
    handlers.push(handler);
    return handler;
  };
  return { handler: spawn(), spawn, calls, claims, handlers };
}

test('OPTIONS and invalid method never create SDK clients', async () => {
  const h = setup();
  const preflight = await h.handler(makeReq(undefined, { method: 'OPTIONS' }));
  assert.equal(preflight.status, 200);
  assert.equal(preflight.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  const invalid = await h.handler(makeReq(undefined, { method: 'GET' }));
  assert.equal(invalid.status, 405);
  assert.deepEqual(h.calls, []);
});

test('legacy B123 bodyless request stays fail-closed, compatibility policy remains undecided', async () => {
  const h = setup();
  const result = await h.handler(makeReq(undefined, { bodyless: true }));
  assert.equal(result.status, 400);
  assert.deepEqual(await result.json(), { deleted: false, code: 'EXPECTED_ACCOUNT_REQUIRED' });
  assert.deepEqual(h.calls, []);
});

test('malformed, scalar, array, and non-UUID bodies fail before any SDK or privileged operation', async () => {
  const invalidBodies = [
    null, [], [{ expectedUserId: A }], 0, true, 'invalid', {},
    { expectedUserId: null }, { expectedUserId: '' },
    { expectedUserId: 'not-an-account-id' },
    { expectedUserId: A.slice(0, -1) },
    JSON.parse('{"__proto__":{"expectedUserId":"00000000-0000-4000-8000-000000000001"}}'),
  ];
  for (const body of invalidBodies) {
    const h = setup();
    const response = await h.handler(makeReq(body));
    assert.equal(response.status, 400, 'invalid body must be rejected');
    assert.deepEqual(await response.json(), { deleted: false, code: 'EXPECTED_ACCOUNT_REQUIRED' });
    assert.deepEqual(h.calls, [], 'invalid body must not create any SDK client');
  }
  const h = setup();
  const malformedJsonRequest = new Request('https://synthetic.invalid/functions/v1/delete-account', {
    method: 'POST',
    headers: { Authorization: 'Bearer synthetic', 'Content-Type': 'application/json' },
    body: '{"expectedUserId":',
  });
  const response = await h.handler(malformedJsonRequest);
  assert.equal(response.status, 400);
  assert.deepEqual(h.calls, []);
});

test('missing configuration fails closed before any SDK client, claim, or deletion', async () => {
  for (const missingEnv of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    const h = setup({ missingEnv });
    const response = await h.handler(makeReq());
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { deleted: false, code: 'OUTCOME_UNCERTAIN_DO_NOT_RETRY' });
    assert.deepEqual(h.calls, []);
  }
});

test('privileged SDK construction failure never claims or invokes admin deletion', async () => {
  const h = setup({ serviceClientThrows: true });
  const response = await h.handler(makeReq());
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { deleted: false, code: 'OUTCOME_UNCERTAIN_DO_NOT_RETRY' });
  assert.deepEqual(h.calls, ['anon-client', 'auth', 'service-client']);
});

test('missing bearer and account switch cannot reach privileged client', async () => {
  const noAuth = setup();
  assert.equal((await noAuth.handler(makeReq(undefined, { authorization: null }))).status, 401);
  assert.deepEqual(noAuth.calls, []);
  const wrong = setup({ authenticatedId: B });
  assert.equal((await wrong.handler(makeReq())).status, 409);
  assert.deepEqual(wrong.calls, ['anon-client', 'auth']);
});

test('a matched account claims before admin deletion and confirms only after durable finalize ACK', async () => {
  const h = setup();
  const result = await h.handler(makeReq());
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { deleted: true });
  assert.deepEqual(h.calls, ['anon-client', 'auth', 'service-client', 'claim', 'delete', 'finalize:confirmed']);
});

test('shared synthetic claim blocks sequential replay across two separately registered Deno handlers', async () => {
  const h = setup();
  assert.equal((await h.handler(makeReq())).status, 200);
  const replay = await h.spawn()(makeReq());
  assert.equal(replay.status, 409);
  assert.deepEqual(await replay.json(), { deleted: false, code: 'EXISTING_CLAIM_DO_NOT_RETRY' });
  assert.equal(h.calls.filter(x => x === 'delete').length, 1);
});

test('parallel synthetic requests cannot issue admin deletion twice', async () => {
  const h = setup();
  const [a, b] = await Promise.all([h.handler(makeReq()), h.spawn()(makeReq())]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal(h.calls.filter(x => x === 'delete').length, 1);
});

test('ambiguous or malformed claim never reaches admin deletion', async () => {
  for (const opts of [{ claimThrows: true }, { claimResult: { data: [{ bad: CLAIM }], error: null } }, { claimResult: { data: null, error: null } }]) {
    const h = setup(opts);
    assert.equal((await h.handler(makeReq())).status, 503);
    assert.equal(h.calls.includes('delete'), false);
  }
});

test('admin exception or non-confirmation returns 503 and leaves a no-retry claim', async () => {
  for (const opts of [{ deleteThrows: true }, { deleteResult: { data: null, error: { message: 'synthetic' } } }]) {
    const h = setup(opts);
    assert.equal((await h.handler(makeReq())).status, 503);
    assert.ok(h.calls.includes('finalize:uncertain'));
    assert.equal((await h.spawn()(makeReq())).status, 409);
    assert.equal(h.calls.filter(x => x === 'delete').length, 1);
  }
});

test('missing finalize ACK cannot report success and cannot replay admin deletion', async () => {
  const h = setup({ finalizeResult: { data: false, error: null } });
  const result = await h.handler(makeReq());
  assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { deleted: false, code: 'OUTCOME_UNCERTAIN_DO_NOT_RETRY' });
  assert.equal((await h.spawn()(makeReq())).status, 409);
  assert.equal(h.calls.filter(x => x === 'delete').length, 1);
});

test('isolated prototype location cannot deploy by itself', () => {
  assert.ok(candidatePath.includes('/docs/release/prototypes/'));
  assert.match(source, /INTERNAL REVIEW-ONLY Deno Edge candidate/);
  assert.doesNotMatch(source, /\blocalStorage\b|\bprocess\.env\b|https:\/\/[^\s]*\.supabase\.co/);
});