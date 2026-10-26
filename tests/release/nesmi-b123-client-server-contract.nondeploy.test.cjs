'use strict';
// Release-compatibility QA only. No Supabase calls, user data or account deletion.
// This test intentionally proves a remaining incompatibility rather than
// certifying a releasable client/server pair. NEVER use a green result to ship.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repo = path.resolve(__dirname, '../..');
const B123_SHA = '6eab3d3b20a32d07376c1bd938979219a3565a74';
const releaseSource = execFileSync(
  'git', ['show', B123_SHA + ':src/context/AuthContext.tsx'],
  { cwd: repo, encoding: 'utf8', timeout: 10000, maxBuffer: 2 * 1024 * 1024 }
);
const proposedClient = fs.readFileSync(path.join(repo, 'src/context/AuthContext.tsx'), 'utf8');
const proposedUI = fs.readFileSync(path.join(repo, 'src/components/AccountSettings.tsx'), 'utf8');
const proposedEdge = fs.readFileSync(
  path.join(repo, 'docs/release/prototypes/nesmi-delete-claimed-deno-handler.nondeploy.ts'),
  'utf8'
);
const deletionBlock = source => {
  const start = source.indexOf('const deleteAccount = async ');
  const end = source.indexOf('const resetPassword = async ', start);
  assert.ok(start >= 0 && end > start, 'Cannot isolate the actual deleteAccount implementation');
  return source.slice(start, end);
};
const invocationOptions = source => {
  const match = deletionBlock(source).match(
    /supabase\.functions\.invoke\('delete-account',\s*\{([\s\S]*?)\}\s*\)/
  );
  assert.ok(match, 'Missing deletion Edge invocation');
  return match[1];
};

test('immutable Nesmi B123 client sends bodyless POST (source evidence, not an Edge test)', () => {
  const options = invocationOptions(releaseSource);
  assert.match(options, /method:\s*'POST'/);
  assert.doesNotMatch(options, /\bbody\s*:/);
  assert.doesNotMatch(options, /expectedUserId/);
});

test('unmerged draft client binds exact confirmed ID and uses a scoped local cleanup', () => {
  const options = invocationOptions(proposedClient);
  assert.match(options, /method:\s*'POST'/);
  assert.match(options, /body:\s*\{\s*expectedUserId\s*\}/);
  assert.match(proposedUI, /confirmedAccountIdRef\.current/);
  assert.match(proposedUI, /deleteAccount\(confirmedAccountId\)/);
  assert.doesNotMatch(deletionBlock(proposedClient), /localStorage\.clear\s*\(/);
});

test('nondeployed Edge requires the ID; B123 is therefore NOT compatible with that candidate', () => {
  assert.match(proposedEdge, /INTERNAL REVIEW-ONLY Deno Edge candidate/);
  assert.match(proposedEdge, /await request\.json\(\)/);
  assert.match(proposedEdge, /payload\.expectedUserId/);
  assert.match(proposedEdge, /reply\(400, 'EXPECTED_ACCOUNT_REQUIRED'\)/);
  assert.doesNotMatch(invocationOptions(releaseSource), /\bbody\s*:/);
  // This assertion documents an outstanding HOLD, not permission to deploy.
});

test('current B123 transition worksheet retains strict bodyless-client release HOLD', () => {
  const gatePath = path.join(repo, 'docs/release/nesmi-b122-to-claimed-edge-transition-gate-20261025.md');
  const gate = fs.readFileSync(gatePath, 'utf8');
  assert.ok(gate.includes(B123_SHA), 'transition worksheet must cite the immutable B123 source SHA');
  const begin = gate.indexOf('### Current transition matrix (B123 is the installed-source anchor)');
  const end = gate.indexOf('### Decision-free next verification and hard stop rules', begin);
  assert.ok(begin !== -1 && end > begin, 'current B123 matrix must be present before historical B122 notes');
  const rows = gate.slice(begin, end).split('\n').filter(line => line.startsWith('|'));
  const findRow = fragment => rows.find(line => line.includes(fragment));
  const unknown = findRow('unknown live deployed Edge');
  const strict = findRow('existing PR #35 strict Edge');
  const candidate = findRow('nondeployed claimed Deno candidate');
  const legacy = findRow('Legacy B122');
  assert.ok(unknown && strict && candidate && legacy, 'matrix must retain live, strict, candidate, and legacy cases');
  assert.match(unknown, /\*\*STOP\*\*/);
  assert.match(strict, /400/);
  assert.match(strict, /\*\*HOLD/);
  assert.match(candidate, /400/);
  assert.match(candidate, /\*\*HOLD/);
  assert.match(legacy, /\*\*HOLD/);
  assert.match(strict, /do not deploy one-sided/, 'strict Edge must remain blocked for bodyless B123');
  // This safeguards release-document integrity, not production behavior or approval.
});

/*
 * Task135 (2026-10-25): immutable, read-only snapshot of the deployed Supabase
 * Edge v1 source, retrieved via the connected Supabase read API. This source
 * contains code only, no env values or user data; test runs OFFLINE in vm.
 * Snapshot metadata: project rosofbnimiothwxsabyr; function delete-account;
 * version 1; verify_jwt=true; ezbr_sha256=589f4d5f888678251c976ee287c4b450623eaa088a56c22d9136249daf6d5e5e.
 * Source-executed synthetic QA, NOT evidence of live HTTP or real deletion.
 * The installed B123 client remains bodyless; this legacy handler is not
 * hardened and MUST NOT be mistaken for a safe release contract.
 */
const vm = require('node:vm');
const OBSERVED_V1_EDGE_SOURCE = "import 'jsr:@supabase/functions-js/edge-runtime.d.ts'\nimport { createClient } from 'npm:@supabase/supabase-js@2'\n\nconst corsHeaders = {\n  'Access-Control-Allow-Origin': '*',\n  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',\n  'Access-Control-Allow-Methods': 'POST, OPTIONS',\n}\n\nDeno.serve(async (request: Request) => {\n  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })\n  if (request.method !== 'POST') {\n    return new Response(JSON.stringify({ error: 'Method not allowed' }), {\n      status: 405,\n      headers: { ...corsHeaders, 'Content-Type': 'application/json' },\n    })\n  }\n\n  const authorization = request.headers.get('Authorization')\n  if (!authorization) {\n    return new Response(JSON.stringify({ error: 'Unauthorized' }), {\n      status: 401,\n      headers: { ...corsHeaders, 'Content-Type': 'application/json' },\n    })\n  }\n\n  const supabaseUrl = Deno.env.get('SUPABASE_URL')!\n  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!\n  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!\n  const userClient = createClient(supabaseUrl, anonKey, {\n    global: { headers: { Authorization: authorization } },\n    auth: { persistSession: false },\n  })\n\n  const { data: { user }, error: userError } = await userClient.auth.getUser()\n  if (userError || !user) {\n    return new Response(JSON.stringify({ error: 'Unauthorized' }), {\n      status: 401,\n      headers: { ...corsHeaders, 'Content-Type': 'application/json' },\n    })\n  }\n\n  const adminClient = createClient(supabaseUrl, serviceRoleKey, {\n    auth: { persistSession: false, autoRefreshToken: false },\n  })\n  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)\n  if (deleteError) {\n    console.error('Account deletion failed', deleteError)\n    return new Response(JSON.stringify({ error: 'Account deletion failed' }), {\n      status: 500,\n      headers: { ...corsHeaders, 'Content-Type': 'application/json' },\n    })\n  }\n\n  return new Response(JSON.stringify({ deleted: true }), {\n    status: 200,\n    headers: { ...corsHeaders, 'Content-Type': 'application/json' },\n  })\n})\n";
function observedV1Harness(authUserId = 'synthetic-bearer-B', deletionError = null, authError = null) {
  // Only remove Deno type declarations/imports and TS non-null assertions.
  // The actual handler branches, auth logic and admin call execute as observed.
  const runnable = OBSERVED_V1_EDGE_SOURCE
    .replace(/^import .*$/gm, '')
    .replace(/request: Request/g, 'request')
    .replaceAll("Deno.env.get('SUPABASE_URL')!", "Deno.env.get('SUPABASE_URL')")
    .replaceAll("Deno.env.get('SUPABASE_ANON_KEY')!", "Deno.env.get('SUPABASE_ANON_KEY')")
    .replaceAll("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!", "Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
  const deletedIds = [];
  let handler = null;
  const fakeDeno = {
    serve: fn => { handler = fn; },
    env: { get: key => 'synthetic-' + key },
  };
  const createClient = (_url, _key, opts = {}) => (
    opts.global?.headers?.Authorization
      ? { auth: { getUser: async () => ({
          data: { user: authUserId == null ? null : { id: authUserId } }, error: authError,
        }) } }
      : { auth: { admin: { deleteUser: async id => {
          deletedIds.push(id);
          return { error: deletionError };
        } } } }
  );
  vm.runInNewContext(runnable, {
    Deno: fakeDeno, createClient, Request, Response,
    console: { error() {} },
  }, { timeout: 1000, filename: 'deployed-edge-v1-snapshot.nondeploy.ts' });
  assert.equal(typeof handler, 'function');
  return { handler, deletedIds };
}

test('observed deployed v1 source: installed B123 bodyless POST gets legacy ACK on synthetic success', async () => {
  assert.equal(invocationOptions(releaseSource).includes('body:'), false);
  const { handler, deletedIds } = observedV1Harness();
  const response = await handler(new Request('https://synthetic.invalid/delete-account', {
    method: 'POST', headers: { Authorization: 'Bearer synthetic' },
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });
  assert.deepEqual(deletedIds, ['synthetic-bearer-B']);
  // The response is only a mocked legacy ACK, not evidence of safe deletion.
});

test('observed deployed v1 source: bearer switch is not bound to UI-confirmed identity (release HOLD)', async () => {
  const userOriginallyConfirmedInUI = 'synthetic-confirmed-A';
  const { handler, deletedIds } = observedV1Harness('synthetic-bearer-B');
  const response = await handler(new Request('https://synthetic.invalid/delete-account', {
    method: 'POST', headers: { Authorization: 'Bearer switched-session' },
    body: JSON.stringify({ expectedUserId: userOriginallyConfirmedInUI }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(deletedIds, ['synthetic-bearer-B']);
  assert.notEqual(deletedIds[0], userOriginallyConfirmedInUI);
  // Even an ID-bearing future client is not protected by v1 source.
});

test('observed deployed v1 source: missing bearer, wrong method, admin failure fail without success ACK', async () => {
  const a = observedV1Harness();
  const withoutBearer = await a.handler(new Request('https://synthetic.invalid/delete-account', { method: 'POST' }));
  assert.equal(withoutBearer.status, 401);
  const wrongMethod = await a.handler(new Request('https://synthetic.invalid/delete-account', {
    method: 'GET', headers: { Authorization: 'Bearer synthetic' },
  }));
  assert.equal(wrongMethod.status, 405);
  assert.equal(a.deletedIds.length, 0);
  const b = observedV1Harness('synthetic-bearer-B', { message: 'synthetic admin error' });
  const failure = await b.handler(new Request('https://synthetic.invalid/delete-account', {
    method: 'POST', headers: { Authorization: 'Bearer synthetic' },
  }));
  assert.equal(failure.status, 500);
  assert.notEqual((await failure.json()).deleted, true);
  assert.equal(b.deletedIds.length, 1); // admin was attempted; outcome not safely reconciled.
});

// Task136: source-executed guard for an expired bearer and preflight, with
// intentionally synthetic users and no connection to a deployed service.
test('observed deployed v1 source: expired bearer, absent auth user and CORS preflight never invoke admin delete', async () => {
  const endpoint = 'https://synthetic.invalid/delete-account';
  const expired = observedV1Harness('synthetic-bearer-B', null, { message: 'synthetic expired JWT' });
  const expiredResponse = await expired.handler(new Request(endpoint, {
    method: 'POST', headers: { Authorization: 'Bearer expired-synthetic' },
  }));
  assert.equal(expiredResponse.status, 401);
  assert.equal((await expiredResponse.json()).error, 'Unauthorized');
  assert.deepEqual(expired.deletedIds, []);

  const missingUser = observedV1Harness(null);
  const missingUserResponse = await missingUser.handler(new Request(endpoint, {
    method: 'POST', headers: { Authorization: 'Bearer synthetic-no-user' },
  }));
  assert.equal(missingUserResponse.status, 401);
  assert.deepEqual(missingUser.deletedIds, []);

  const preflight = observedV1Harness();
  const optionsResponse = await preflight.handler(new Request(endpoint, { method: 'OPTIONS' }));
  assert.equal(optionsResponse.status, 200);
  assert.equal(await optionsResponse.text(), 'ok');
  assert.equal(optionsResponse.headers.get('Access-Control-Allow-Methods'), 'POST, OPTIONS');
  assert.deepEqual(preflight.deletedIds, []);
  // Tests only current v1 source branches. They cannot certify production auth or deletion safety.
});


/*
 * Task138 — Execute the actual immutable TestFlight B123 AuthContext deletion
 * function with synthetic SDK and storage. Existing draft-provider RTL covers
 * proposed code, but that is not the shipped B123 source. There is no network,
 * real token, browser profile or account deletion in this test.
 */
function offlineB123DeleteClient({ data = { deleted: true }, error = null, signOutReject = false } = {}) {
  const src = deletionBlock(releaseSource);
  assert.match(src, /^const deleteAccount = async \(\) => \{/);
  assert.equal((src.match(/\bas Error\b/g) || []).length, 1, 'B123 transform must be explicitly reviewed if source changes');
  const executable = src
    .replace(/^const deleteAccount = async \(\) => \{/, 'globalThis.__deleteAccount = async () => {')
    .replace('error as Error', 'error');
  const cache = new Map([
    ['chore-app-chores', 'synthetic-nesmi-chores'],
    ['chore-app-members', 'synthetic-nesmi-members'],
    ['qingbu.state.v1', 'synthetic-movelight-records'],
    ['movelight.redesign.v1.state', 'synthetic-movelight-other'],
    ['unrelated:keep', 'synthetic-other-app'],
  ]);
  const invokes = [], removed = [], signouts = [], sessions = [], users = [];
  const sandbox = {
    Error,
    supabase: {
      functions: { invoke: async (name, options) => {
        invokes.push({ name, method: options.method, hasBody: 'body' in options });
        return { data, error };
      } },
      auth: { signOut: async options => {
        signouts.push(options.scope);
        if (signOutReject) throw new Error('synthetic local signout failed');
        return { error: null };
      } },
    },
    localStorage: { removeItem: key => { removed.push(key); cache.delete(key); } },
    setSession: value => sessions.push(value),
    setUser: value => users.push(value),
  };
  vm.runInNewContext(executable, sandbox, {
    filename: 'immutable-b123-deleteAccount.nondeploy.tsx', timeout: 1000,
  });
  assert.equal(typeof sandbox.__deleteAccount, 'function');
  return { execute: () => sandbox.__deleteAccount(), cache, invokes, removed, signouts, sessions, users };
}

test('immutable B123 executed client cleanup: sibling-app keys survive server ACK', async () => {
  const h = offlineB123DeleteClient();
  const result = await h.execute();
  assert.equal(result.error, null);
  assert.deepEqual(h.invokes, [{ name: 'delete-account', method: 'POST', hasBody: false }]);
  assert.deepEqual(h.removed, ['chore-app-chores', 'chore-app-members']);
  assert.equal(h.cache.has('chore-app-chores'), false);
  assert.equal(h.cache.has('chore-app-members'), false);
  assert.equal(h.cache.get('qingbu.state.v1'), 'synthetic-movelight-records');
  assert.equal(h.cache.get('movelight.redesign.v1.state'), 'synthetic-movelight-other');
  assert.equal(h.cache.get('unrelated:keep'), 'synthetic-other-app');
  assert.deepEqual(h.signouts, ['local']);
  assert.deepEqual(h.sessions, [null]);
  assert.deepEqual(h.users, [null]);
});

test('immutable B123 missing ACK or SDK error preserves all synthetic local state', async () => {
  for (const outcome of [
    { data: { deleted: false }, error: null },
    { data: null, error: new Error('synthetic ambiguous invocation error') },
  ]) {
    const h = offlineB123DeleteClient(outcome);
    const result = await h.execute();
    assert.ok(result.error);
    assert.deepEqual(h.removed, []);
    assert.deepEqual(h.signouts, []);
    assert.deepEqual(h.sessions, []);
    assert.deepEqual(h.users, []);
    assert.equal(h.cache.get('chore-app-chores'), 'synthetic-nesmi-chores');
    assert.equal(h.cache.get('qingbu.state.v1'), 'synthetic-movelight-records');
  }
});

test('immutable B123 post-ACK local signout rejection leaves React identity uncleared (HOLD)', async () => {
  const h = offlineB123DeleteClient({ signOutReject: true });
  await assert.rejects(h.execute(), /synthetic local signout failed/);
  assert.deepEqual(h.removed, ['chore-app-chores', 'chore-app-members']);
  assert.deepEqual(h.signouts, ['local']);
  assert.deepEqual(h.sessions, []);
  assert.deepEqual(h.users, []);
  assert.equal(h.cache.get('qingbu.state.v1'), 'synthetic-movelight-records');
  // This is an immutable B123 failure reproducer, not a production incident.
  // Draft PR #35 has a separate post-ACK cleanup warning path; RELEASE HOLD.
});
