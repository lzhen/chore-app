/**
 * Nesmi draft release-gate: explicitly opted-in two-disposable-account RLS smoke.
 * NEVER pointed at production or run from CI with credentials. No account provisioning.
 * Uses only a publishable/anon key and two separate test-user password sessions.
 * The sole write is a synthetic team_members row created/cleaned by test account A.
 * Run `node tests/release/nesmi-rls-disposable-two-account.mjs --self-test`
 * for credential-free, network-free guard verification.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const PRODUCTION_PROJECT_REF = 'rosofbnimiothwxsabyr';
const OPT_IN = 'I_CONFIRM_NONPRODUCTION_DISPOSABLE_USERS_AND_DATA';
const REF = /^[a-z0-9]{12,30}$/;

function configFrom(env) {
  const ref = env.NESMI_TEST_PROJECT_REF;
  if (!ref || !REF.test(ref) || ref === PRODUCTION_PROJECT_REF) {
    throw new Error('Refusing: missing/invalid project ref or known production project');
  }
  const projectUrl = `https://${ref}.supabase.co`;
  if (env.NESMI_TEST_SUPABASE_URL !== projectUrl) {
    throw new Error('Refusing: test URL must exactly match the separate project ref');
  }
  if (env.NESMI_TEST_EXPLICIT_OPT_IN !== OPT_IN) {
    throw new Error('Refusing: explicit non-production test-data authorization missing');
  }
  const key = env.NESMI_TEST_ANON_KEY;
  if (!key || key.startsWith('sb_secret_') || key.includes('service_role')) {
    throw new Error('Refusing: never supply secret/service-role credentials');
  }
  if (!key.startsWith('sb_publishable_')) {
    const parts = key.split('.');
    let role;
    try {
      role = parts.length === 3
        ? JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role
        : undefined;
    } catch { /* fail closed */ }
    if (role !== 'anon') throw new Error('Refusing: key must be an anon/publishable key');
  }
  const aEmail = env.NESMI_TEST_A_EMAIL;
  const bEmail = env.NESMI_TEST_B_EMAIL;
  const aPassword = env.NESMI_TEST_A_PASSWORD;
  const bPassword = env.NESMI_TEST_B_PASSWORD;
  if (!aEmail || !bEmail || !aPassword || !bPassword ||
      aEmail.trim().toLowerCase() === bEmail.trim().toLowerCase()) {
    throw new Error('Refusing: two distinct, existing disposable test-user logins required');
  }
  return { projectUrl, key, aEmail, bEmail, aPassword, bPassword };
}

function selfTest() {
  const base = {
    NESMI_TEST_PROJECT_REF: 'disposableonly123',
    NESMI_TEST_SUPABASE_URL: 'https://disposableonly123.supabase.co',
    NESMI_TEST_EXPLICIT_OPT_IN: OPT_IN,
    NESMI_TEST_ANON_KEY: 'sb_publishable_synthetic_nonsecret',
    NESMI_TEST_A_EMAIL: 'synthetic-a@example.invalid',
    NESMI_TEST_B_EMAIL: 'synthetic-b@example.invalid',
    NESMI_TEST_A_PASSWORD: 'fake-test-password-A',
    NESMI_TEST_B_PASSWORD: 'fake-test-password-B',
  };
  assert.equal(configFrom(base).projectUrl, base.NESMI_TEST_SUPABASE_URL);
  for (const patch of [
    { NESMI_TEST_PROJECT_REF: PRODUCTION_PROJECT_REF, NESMI_TEST_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co` },
    { NESMI_TEST_EXPLICIT_OPT_IN: '' },
    { NESMI_TEST_SUPABASE_URL: 'https://evil.example.com' },
    { NESMI_TEST_ANON_KEY: 'sb_secret_not_allowed' },
    { NESMI_TEST_ANON_KEY: 'service_role' },
    { NESMI_TEST_A_PASSWORD: '' },
    { NESMI_TEST_B_EMAIL: base.NESMI_TEST_A_EMAIL },
    { NESMI_TEST_PROJECT_REF: 'abc!bad' },
  ]) {
    assert.throws(() => configFrom({ ...base, ...patch }), /Refusing/);
  }
  console.log('PASS: 9/9 non-production preflight cases (no network, no credentials)');
}

function safeError(stage, result) {
  if (result.error) throw new Error(`${stage}: backend rejected operation (code ${result.error.code || 'unknown'})`);
  return result.data;
}

async function runDisposableSmoke(config) {
  const { createClient } = await import('@supabase/supabase-js');
  const client = () => createClient(config.projectUrl, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const a = client();
  const b = client();
  const aSession = safeError('login A', await a.auth.signInWithPassword({ email: config.aEmail, password: config.aPassword }));
  const bSession = safeError('login B', await b.auth.signInWithPassword({ email: config.bEmail, password: config.bPassword }));
  const aId = aSession.user?.id;
  const bId = bSession.user?.id;
  assert.ok(aId && bId && aId !== bId, 'Accounts must be distinct authenticated test identities');

  const marker = `NESMI-RLS-DISPOSABLE-${randomUUID()}`;
  const updated = `${marker}-saved`;
  let rowId;
  let testError;
  try {
    const created = safeError('create A synthetic row', await a.from('team_members')
      .insert({ name: marker, color: '#335577' }).select('id, name').single());
    assert.equal(created?.name, marker);
    assert.ok(created?.id);
    rowId = created.id;

    const aRead = safeError('A read own row', await a.from('team_members').select('id, name').eq('id', rowId));
    assert.equal(aRead.length, 1, 'A must see own newly persisted row');

    const bRead = safeError('B cross-account read', await b.from('team_members').select('id').eq('id', rowId));
    assert.deepEqual(bRead, [], 'B must not read A owned row');

    const bMutation = await b.from('team_members').update({ name: 'unauthorized-write' }).eq('id', rowId).select('id');
    if (bMutation.error && !['42501', '403'].includes(String(bMutation.error.code))) {
      safeError('B negative update', bMutation);
    }
    assert.equal(bMutation.data?.length ?? 0, 0, 'B must not update A row');

    safeError('A update own row', await a.from('team_members').update({ name: updated }).eq('id', rowId).select('id').single());
    const freshA = client();
    safeError('fresh A login', await freshA.auth.signInWithPassword({ email: config.aEmail, password: config.aPassword }));
    const reloaded = safeError('fresh A reload', await freshA.from('team_members').select('name').eq('id', rowId).single());
    assert.equal(reloaded.name, updated, 'A persistence must survive fresh session');
    console.log('PASS: disposable A/B RLS read/write isolation and fresh-session persistence');
  } catch (e) {
    testError = e;
  } finally {
    if (rowId) {
      try {
        const removed = safeError('synthetic cleanup', await a.from('team_members')
          .delete().eq('id', rowId).select('id'));
        assert.equal(removed.length, 1, 'Cleanup must delete exactly the test-owned synthetic row');
      } catch {
        testError = testError || new Error('Synthetic cleanup could not be verified in disposable project');
      }
    }
    await Promise.allSettled([a.auth.signOut({ scope: 'local' }), b.auth.signOut({ scope: 'local' })]);
  }
  if (testError) throw testError;
}

if (process.argv.includes('--self-test')) {
  selfTest();
} else if (process.argv.includes('--help')) {
  console.log('Disposable non-production only. Requires NESMI_TEST_PROJECT_REF, NESMI_TEST_SUPABASE_URL, NESMI_TEST_ANON_KEY, NESMI_TEST_A_EMAIL/PASSWORD, NESMI_TEST_B_EMAIL/PASSWORD, and NESMI_TEST_EXPLICIT_OPT_IN. Never use real accounts or production.');
} else {
  try {
    await runDisposableSmoke(configFrom(process.env));
  } catch (error) {
    console.error(`FAIL: ${error instanceof Error ? error.message : 'Unexpected smoke-test failure'}`);
    process.exitCode = 1;
  }
}
