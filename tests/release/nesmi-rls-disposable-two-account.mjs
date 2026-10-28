/**
 * Nesmi draft release-gate: explicitly opted-in two-disposable-account RLS smoke.
 * NEVER pointed at production or run from CI with credentials. No account provisioning.
 * Uses only a publishable/anon key and two separate test-user password sessions.
 * Writes only synthetic team_members + linked chores with preassigned UUIDs,
 * so ambiguous INSERT receipts can still be looked up and cleaned by test account A.
 * Run `node tests/release/nesmi-rls-disposable-two-account.mjs --self-test`
 * for credential-free, network-free guard verification.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// These are active company projects (observed read-only 2026-10-27), NOT disposable.
// Add any newly discovered real project refs before running this opt-in harness.
const KNOWN_NONDISPOSABLE_PROJECT_REFS = new Set([
  'rosofbnimiothwxsabyr', // Nesmi/Empathie active project
  'vxlwnvwijnzimjvgpeug', // DLS Magician active project
]);
const OPT_IN = 'I_CONFIRM_NONPRODUCTION_DISPOSABLE_USERS_AND_DATA';
const REF = /^[a-z0-9]{12,30}$/;

function configFrom(env) {
  const ref = env.NESMI_TEST_PROJECT_REF;
  if (!ref || !REF.test(ref) || KNOWN_NONDISPOSABLE_PROJECT_REFS.has(ref)) {
    throw new Error('Refusing: missing/invalid project ref or known company project (not disposable)');
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
    ...[...KNOWN_NONDISPOSABLE_PROJECT_REFS].map(ref => ({
      NESMI_TEST_PROJECT_REF: ref,
      NESMI_TEST_SUPABASE_URL: `https://${ref}.supabase.co`,
    })),
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
  console.log('PASS: 10/10 non-production preflight cases (no network, no credentials)');
  // UPDATE ... RETURNING can be empty under SELECT RLS even if an UPDATE ran.
  // Verify the owner-side assertion catches that dangerous false green.
  assert.doesNotThrow(() => assertUnaffectedOwnerRow([], [{ name: 'owner-marker' }], 'owner-marker'));
  assert.throws(() => assertUnaffectedOwnerRow([], [{ name: 'unauthorized-write' }], 'owner-marker'), /cross-account mutation changed/);
  console.log('PASS: 2/2 owner-side RLS update assertions (no network, no credentials)');
  // A filtered DELETE can also return zero rows even when a permissive policy
  // deleted the owner record. Only a fresh owner-side read proves retention.
  assert.doesNotThrow(() => assertUnaffectedOwnerRow([], [{ name: 'owner-marker' }], 'owner-marker'));
  assert.throws(() => assertUnaffectedOwnerRow([], [], 'owner-marker'), /A must still be able to read/);
  console.log('PASS: 2/2 owner-side RLS delete assertions (no network, no credentials)');
  assert.doesNotThrow(() => assertUnaffectedOwnerChore([], [{ id: 'synthetic-chore', title: 'original' }], 'synthetic-chore', 'original'));
  assert.throws(() => assertUnaffectedOwnerChore([], [{ id: 'synthetic-chore', title: 'unauthorized-write' }], 'synthetic-chore', 'original'), /cross-account chore mutation/);
  assert.throws(() => assertUnaffectedOwnerChore([], [{ id: 'other-chore', title: 'original' }], 'synthetic-chore', 'original'), /expected chore/);
  console.log('PASS: 3/3 chore owner-side isolation assertions (no network, no credentials)');
  assert.doesNotThrow(() => assertCreatedMember({ id: 'fixture-id', name: 'fixture' }, 'fixture-id', 'fixture'));
  assert.throws(() => assertCreatedMember({ id: 'other-id', name: 'fixture' }, 'fixture-id', 'fixture'), /synthetic member ID/);
  assert.throws(() => assertCreatedMember(null, 'fixture-id', 'fixture'), /synthetic member ID/);
  console.log('PASS: 3/3 deterministic member insert-receipt checks (no network, no credentials)');
  assert.equal(choreExistsForCleanup([], 'synthetic-chore'), false);
  assert.equal(choreExistsForCleanup([{ id: 'synthetic-chore' }], 'synthetic-chore'), true);
  assert.throws(() => choreExistsForCleanup([{ id: 'other-chore' }], 'synthetic-chore'), /wrong chore/);
  assert.throws(() => choreExistsForCleanup([{ id: 'synthetic-chore' }, { id: 'second' }], 'synthetic-chore'), /Ambiguous chore/);
  console.log('PASS: 4/4 synthetic chore cleanup lookup cases (no network, no credentials)');
}

function assertCreatedMember(receipt, expectedId, expectedName) {
  assert.equal(receipt?.id, expectedId, 'Unexpected or missing synthetic member ID after insert');
  assert.equal(receipt?.name, expectedName, 'Unexpected synthetic member name after insert');
}

function assertUnaffectedOwnerRow(rowsVisibleToB, rowsVisibleToA, expectedName) {
  assert.equal(rowsVisibleToB?.length ?? 0, 0, 'B must not see updated A rows');
  assert.equal(rowsVisibleToA?.length, 1, 'A must still be able to read its row after B tries to mutate it');
  assert.equal(rowsVisibleToA[0]?.name, expectedName,
    'RLS violation: cross-account mutation changed persisted A data despite empty UPDATE RETURNING');
}

function assertUnaffectedOwnerChore(rowsVisibleToB, rowsVisibleToA, choreId, expectedTitle) {
  assert.equal(rowsVisibleToB?.length ?? 0, 0, 'B must not see A chore rows');
  assert.equal(rowsVisibleToA?.length, 1, 'A must still be able to read its chore after B tries to mutate it');
  assert.equal(rowsVisibleToA[0]?.id, choreId, 'A must still see the expected chore');
  assert.equal(rowsVisibleToA[0]?.title, expectedTitle,
    'RLS violation: cross-account chore mutation changed persisted A data despite empty UPDATE RETURNING');
}

// A missing INSERT receipt might mean that the disposable write failed before
// commit, OR that a committed row lost its acknowledgement. Query by the
// preassigned test UUID; only remove the row when it really exists.
function choreExistsForCleanup(rows, expectedId) {
  assert.ok(Array.isArray(rows) && rows.length <= 1, 'Ambiguous chore cleanup lookup');
  if (rows.length === 0) return false;
  assert.equal(rows[0]?.id, expectedId, 'Cleanup lookup returned the wrong chore');
  return true;
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
  // Choose member ID BEFORE sending INSERT: even a successful write with a
  // missing PostgREST receipt can then be found and cleaned on test account A.
  const rowId = randomUUID();
  let memberInsertAttempted = false;
  let choreId;
  let choreInsertAttempted = false;
  let testError;
  try {
    memberInsertAttempted = true;
    const created = safeError('create A synthetic row', await a.from('team_members')
      .insert({ id: rowId, name: marker, color: '#335577' }).select('id, name').single());
    assertCreatedMember(created, rowId, marker);

    const aRead = safeError('A read own row', await a.from('team_members').select('id, name').eq('id', rowId));
    assert.equal(aRead.length, 1, 'A must see own newly persisted row');

    const bRead = safeError('B cross-account read', await b.from('team_members').select('id').eq('id', rowId));
    assert.deepEqual(bRead, [], 'B must not read A owned row');

    const bMutation = await b.from('team_members').update({ name: 'unauthorized-write' }).eq('id', rowId).select('id');
    if (bMutation.error && !['42501', '403'].includes(String(bMutation.error.code))) {
      safeError('B negative update', bMutation);
    }
    // A zero-row UPDATE RETURNING alone is NOT proof of isolation: SELECT
    // visibility could hide an unauthorized write. Re-read with owner A.
    const ownerAfterB = safeError('A confirm B could not mutate row',
      await a.from('team_members').select('id, name').eq('id', rowId));
    assertUnaffectedOwnerRow(bMutation.data, ownerAfterB, marker);

    // A zero-row DELETE RETURNING is not sufficient to establish that B did
    // not delete a row hidden by B's SELECT policy. Require owner A to still
    // observe the exact synthetic record before A's authorized update.
    const bDelete = await b.from('team_members').delete().eq('id', rowId).select('id');
    if (bDelete.error && !['42501', '403'].includes(String(bDelete.error.code))) {
      safeError('B negative delete', bDelete);
    }
    const ownerAfterBDelete = safeError('A confirm B could not delete row',
      await a.from('team_members').select('id, name').eq('id', rowId));
    assertUnaffectedOwnerRow(bDelete.data, ownerAfterBDelete, marker);

    safeError('A update own row', await a.from('team_members').update({ name: updated }).eq('id', rowId).select('id').single());
    const freshA = client();
    safeError('fresh A login', await freshA.auth.signInWithPassword({ email: config.aEmail, password: config.aPassword }));
    const reloaded = safeError('fresh A reload', await freshA.from('team_members').select('name').eq('id', rowId).single());
    assert.equal(reloaded.name, updated, 'A persistence must survive fresh session');
    // Main task flow is a separate tenant boundary from team_members. Exercise
    // the real chores table with owner A's linked member. Only on disposable DB.
    const choreTitle = `${marker}-chore`;
    const updatedChoreTitle = `${choreTitle}-saved`;
    choreId = randomUUID();
    choreInsertAttempted = true;
    const choreCreated = safeError('A create synthetic chore', await a.from('chores')
      .insert({ id: choreId, title: choreTitle, date: '2026-10-28', assignee_id: rowId,
        recurrence: 'none', priority: 'medium' }).select('id, title').single());
    assert.equal(choreCreated?.id, choreId, 'A must receive the expected synthetic chore ID');
    assert.equal(choreCreated?.title, choreTitle);

    const bChoreRead = safeError('B cross-account chore read',
      await b.from('chores').select('id').eq('id', choreId));
    assert.deepEqual(bChoreRead, [], 'B must not read A chore');

    const bChoreUpdate = await b.from('chores').update({ title: 'unauthorized-write' })
      .eq('id', choreId).select('id');
    if (bChoreUpdate.error && !['42501', '403'].includes(String(bChoreUpdate.error.code))) {
      safeError('B negative chore update', bChoreUpdate);
    }
    const ownerChoreAfterB = safeError('A confirm B could not change chore',
      await a.from('chores').select('id, title').eq('id', choreId));
    assertUnaffectedOwnerChore(bChoreUpdate.data, ownerChoreAfterB, choreId, choreTitle);

    const bChoreDelete = await b.from('chores').delete().eq('id', choreId).select('id');
    if (bChoreDelete.error && !['42501', '403'].includes(String(bChoreDelete.error.code))) {
      safeError('B negative chore delete', bChoreDelete);
    }
    const ownerChoreAfterBDelete = safeError('A confirm B could not delete chore',
      await a.from('chores').select('id, title').eq('id', choreId));
    assertUnaffectedOwnerChore(bChoreDelete.data, ownerChoreAfterBDelete, choreId, choreTitle);

    const choreUpdated = safeError('A update synthetic chore', await a.from('chores')
      .update({ title: updatedChoreTitle }).eq('id', choreId).select('id, title').single());
    assert.equal(choreUpdated?.id, choreId);
    const freshChore = safeError('fresh A chore reload',
      await freshA.from('chores').select('id, title').eq('id', choreId).single());
    assert.equal(freshChore.id, choreId);
    assert.equal(freshChore.title, updatedChoreTitle, 'Chore update must survive fresh A session');
    console.log('PASS: disposable A/B team_members and chores RLS isolation + fresh-session persistence');
  } catch (e) {
    testError = e;
  } finally {
    // Remove dependent synthetic chore first. Never touch an unrelated row;
    // use the generated UUID and owner A's authenticated test session only.
    if (choreInsertAttempted) {
      try {
        // The INSERT can fail before commit or commit with a lost receipt.
        // Resolve that ambiguity using only our preassigned disposable UUID.
        const foundChore = safeError('synthetic chore cleanup lookup', await a.from('chores')
          .select('id').eq('id', choreId));
        if (choreExistsForCleanup(foundChore, choreId)) {
          const removedChore = safeError('synthetic chore cleanup', await a.from('chores')
            .delete().eq('id', choreId).select('id'));
          assert.equal(removedChore.length, 1, 'Cleanup must delete exactly one test-owned chore');
          assert.equal(removedChore[0]?.id, choreId, 'Cleanup must confirm the exact chore ID');
        }
        const afterChoreCleanup = safeError('verify synthetic chore cleanup', await a.from('chores')
          .select('id').eq('id', choreId));
        assert.deepEqual(afterChoreCleanup, [], 'Synthetic chore must be absent after cleanup');
      } catch {
        const cleanupError = new Error('Synthetic chore cleanup could not be verified in disposable project');
        testError = testError
          ? new AggregateError([testError, cleanupError], 'Test failed and chore cleanup was not verified')
          : cleanupError;
      }
    }
    if (memberInsertAttempted) {
      try {
        // A failed/missing INSERT receipt does not prove the DB rolled back.
        // Query the preassigned UUID, and delete it if it was written.
        const found = safeError('synthetic member cleanup lookup', await a.from('team_members')
          .select('id').eq('id', rowId));
        assert.ok(Array.isArray(found) && found.length <= 1, 'Ambiguous member cleanup lookup');
        if (found.length === 1) {
          assert.equal(found[0]?.id, rowId, 'Cleanup lookup returned the wrong member');
          const removed = safeError('synthetic member cleanup', await a.from('team_members')
            .delete().eq('id', rowId).select('id'));
          assert.equal(removed.length, 1, 'Cleanup must delete exactly one synthetic member');
          assert.equal(removed[0]?.id, rowId, 'Cleanup deleted the wrong member');
        }
        const after = safeError('verify synthetic member cleanup', await a.from('team_members')
          .select('id').eq('id', rowId));
        assert.deepEqual(after, [], 'Synthetic member must be absent after cleanup');
      } catch {
        const cleanupError = new Error('Synthetic member cleanup could not be verified in disposable project');
        testError = testError
          ? new AggregateError([testError, cleanupError], 'Test failed and member cleanup was not verified')
          : cleanupError;
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
