import { expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createEmailLinkAuth, verifierOnlyStorage } from './emailLinkAuth';

it('persists only the isolated verifier and never the temporary session', async () => {
  localStorage.clear();
  const storage = verifierOnlyStorage(localStorage);
  await storage.setItem('nesmi-magic-pkce-code-verifier', 'synthetic-verifier');
  await storage.setItem('nesmi-magic-pkce', 'synthetic-session');
  expect(localStorage.getItem('nesmi-magic-pkce')).toBeNull();
  const restarted = verifierOnlyStorage(localStorage);
  expect(await restarted.getItem('nesmi-magic-pkce-code-verifier')).toBe('synthetic-verifier');
  expect(await restarted.getItem('nesmi-magic-pkce')).toBeNull();
  await storage.removeItem('nesmi-magic-pkce-code-verifier');
  expect(await restarted.getItem('nesmi-magic-pkce-code-verifier')).toBeNull();
});
it('hands a verified exchange to the original persistent client without creating a user', async () => {
  const session = { access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', user: { id: 'existing' } };
  const primary = { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }), setSession: vi.fn().mockResolvedValue({ data: { session }, error: null }) };
  const pkce = { signInWithOtp: vi.fn(), exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session }, error: null }) };
  const flow = createEmailLinkAuth(primary as unknown as SupabaseClient['auth'], pkce as unknown as SupabaseClient['auth']);
  expect((await flow.exchangeCodeForSession('synthetic-code')).data.session?.user.id).toBe('existing');
  expect(primary.setSession).toHaveBeenCalledExactlyOnceWith({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh' });
});
it('preserves a session established during the pending exchange', async () => {
  const primary = { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'current' } } }, error: null }), setSession: vi.fn() };
  const pkce = { signInWithOtp: vi.fn(), exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'synthetic', refresh_token: 'synthetic' } }, error: null }) };
  const flow = createEmailLinkAuth(primary as unknown as SupabaseClient['auth'], pkce as unknown as SupabaseClient['auth']);
  expect((await flow.exchangeCodeForSession('synthetic-code')).error).not.toBeNull();
  expect(primary.setSession).not.toHaveBeenCalled();
});
