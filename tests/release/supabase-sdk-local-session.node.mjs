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

function makeFixture() {
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
    removeItem: key => { map.delete(key); },
    clear: () => { throw new Error('Whole-origin storage clear is forbidden'); },
  };
  const fetch = async input => {
    const url = typeof input === 'string' ? input : input.url;
    calls.push(url);
    assert.ok(url.startsWith('https://nesmi-release-fixture.invalid/auth/v1/logout'),
      `Unexpected SDK network request in offline fixture: ${url}`);
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
