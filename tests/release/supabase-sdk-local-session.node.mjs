/**
 * Offline SDK storage boundary: real @supabase/supabase-js, synthetic identity,
 * custom in-memory adapter, and intercepted .invalid URL. Never contacts
 * production, invokes Edge deletion, handles live credentials or tests iOS.
 * This is NOT real server deletion, browser tabs, or physical-device acceptance.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';

const AUTH_KEY = 'nesmi-release-fixture.auth';
const SIBLING_KEYS = [
  'qingbu.state.v1',
  'movelight.redesign.v1.state',
  'movelight.review.focus1.state',
  'movelight_redesign_v1_theme',
  'movelight_redesign_v1_language',
];

function makeFixture({ failAuthRemoval = false, failLogoutTransport = false } = {}) {
  const map = new Map();
  for (const key of SIBLING_KEYS) map.set(key, 'sibling-fixture');
  map.set('unrelated:keep', 'other-fixture');
  map.set('chore-app-chores', 'nesmi-fixture');
  map.set('chore-app-members', 'nesmi-fixture');
  const now = Math.floor(Date.now() / 1000);
  const jwt = [
    Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
    Buffer.from(JSON.stringify({ sub: 'fixture-user', role: 'authenticated', exp: now + 3600 })).toString('base64url'),
    'unsigned-fixture-only',
  ].join('.');
  map.set(AUTH_KEY, JSON.stringify({
    access_token: jwt, refresh_token: 'synthetic-only', token_type: 'bearer',
    expires_in: 3600, expires_at: now + 3600,
    user: { id: 'fixture-user', aud: 'authenticated', role: 'authenticated',
      email: 'sdk-fixture@example.invalid', app_metadata: {}, user_metadata: {},
      created_at: '2026-01-01T00:00:00Z' },
  }));
  const calls = [];
  const storage = {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); },
    removeItem: key => {
      if (failAuthRemoval && key === AUTH_KEY) {
        throw new Error('Synthetic auth-key removal failure');
      }
      map.delete(key);
    },
    clear: () => { throw new Error('Whole-origin storage clear is forbidden'); },
  };
  const fetch = async input => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push(url);
    assert.ok(url.startsWith('https://nesmi-release-fixture.invalid/auth/v1/logout'),
      `Unexpected SDK network request in offline fixture: ${url}`);
    if (failLogoutTransport) {
      return new Response(JSON.stringify({ message: 'Synthetic intercepted logout failure' }), {
        status: 503, headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(null, { status: 204 });
  };
  const client = () => createClient('https://nesmi-release-fixture.invalid', 'fixture-public-key', {
    auth: { storage, storageKey: AUTH_KEY, persistSession: true,
      detectSessionInUrl: false, autoRefreshToken: false },
    global: { fetch },
  });
  return { map, calls, client };
}

test('real SDK removes only persisted auth state on local sign-out; fresh client cannot restore it', async () => {
  const { map, calls, client } = makeFixture();
  const first = client();
  const before = await first.auth.getSession();
  assert.equal(before.error, null);
  assert.equal(before.data.session?.user?.id, 'fixture-user');
  assert.ok(map.has(AUTH_KEY));

  const signOut = await first.auth.signOut({ scope: 'local' });
  assert.equal(signOut.error, null);
  assert.equal(map.has(AUTH_KEY), false);
  assert.ok(calls.every(url => url.includes('/auth/v1/logout')));
  for (const key of SIBLING_KEYS) assert.equal(map.get(key), 'sibling-fixture');
  assert.equal(map.get('unrelated:keep'), 'other-fixture');
  assert.equal(map.get('chore-app-chores'), 'nesmi-fixture');
  assert.equal(map.get('chore-app-members'), 'nesmi-fixture');

  const second = client();
  const after = await second.auth.getSession();
  assert.equal(after.error, null);
  assert.equal(after.data.session, null);
});


test('real SDK storage-removal fault is observable and stale auth remains recoverable by a fresh client', async () => {
  // PD-06 negative-path characterization, not a safety-pass or backend test.
  // After a server ACK, the React layer must warn/guard against stale SDK data
  // if local sign-out fails; resetting React state alone does not erase storage.
  const { map, calls, client } = makeFixture({ failAuthRemoval: true });
  const first = client();
  assert.equal((await first.auth.getSession()).data.session?.user?.id, 'fixture-user');

  let cleanupError = null;
  try {
    const result = await first.auth.signOut({ scope: 'local' });
    cleanupError = result.error;
  } catch (error) {
    cleanupError = error;
  }
  assert.ok(cleanupError, 'Injected storage removal failure must not look like successful sign-out');
  assert.ok(map.has(AUTH_KEY), 'Persisted SDK state survives the failed removal');
  // The installed SDK emitted one intercepted logout fetch in this scenario;
  // local scope is not a reason to assume no outgoing request. The .invalid
  // fixture intercept guarantees the test itself sends no production traffic.
  assert.equal(calls.length, 1, 'Observe exactly one intercepted SDK logout request');

  const reopened = client();
  const restored = await reopened.auth.getSession();
  assert.equal(restored.data.session?.user?.id, 'fixture-user',
    'A fresh SDK client can restore the synthetic stale identity after failed cleanup');
  for (const key of SIBLING_KEYS) assert.equal(map.get(key), 'sibling-fixture');
  assert.equal(map.get('unrelated:keep'), 'other-fixture');
});


test('real SDK logout transport failure does not silently prove persistent local session cleanup', async () => {
  // PD-06 offline negative-path: deliberately reject only the intercepted
  // fake logout endpoint. There is no production network, account, or token.
  // Distinguishes service logout failure from the storage-removal failure above.
  const { map, calls, client } = makeFixture({ failLogoutTransport: true });
  const first = client();
  assert.equal((await first.auth.getSession()).data.session?.user?.id, 'fixture-user');

  let signOutError = null;
  try {
    const result = await first.auth.signOut({ scope: 'local' });
    signOutError = result.error;
  } catch (error) {
    signOutError = error;
  }
  assert.ok(signOutError, 'Synthetic logout transport failure must be surfaced to the caller');
  assert.equal(calls.length, 1, 'Exactly one logout request is intercepted; no live network');
  assert.ok(map.has(AUTH_KEY), 'Storage still contains a session after failed logout');

  const reopened = client();
  const restored = await reopened.auth.getSession();
  assert.equal(restored.data.session?.user?.id, 'fixture-user',
    'A new SDK client may recover stale synthetic auth if logout transport failed');
  for (const key of SIBLING_KEYS) assert.equal(map.get(key), 'sibling-fixture');
  assert.equal(map.get('unrelated:keep'), 'other-fixture');
});
