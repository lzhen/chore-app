import type { SupabaseClient, SupportedStorage } from '@supabase/supabase-js';

// Only the PKCE verifier crosses restarts. Temporary exchange sessions stay in memory;
// the established application's Auth client remains the sole persistent user session.
export function verifierOnlyStorage(storage: Storage): SupportedStorage {
  const memory = new Map<string, string>();
  return {
    getItem: key => key.endsWith('-code-verifier') ? storage.getItem(key) : memory.get(key) ?? null,
    setItem: (key, value) => {
      if (key.endsWith('-code-verifier')) storage.setItem(key, value);
      else memory.set(key, value);
    },
    removeItem: key => {
      if (key.endsWith('-code-verifier')) storage.removeItem(key);
      else memory.delete(key);
    },
  };
}

export function createEmailLinkAuth(primary: SupabaseClient['auth'], pkce: SupabaseClient['auth']) {
  return {
    getSession: () => primary.getSession(),
    signInWithOtp: (options: Parameters<typeof pkce.signInWithOtp>[0]) => pkce.signInWithOtp(options),
    async exchangeCodeForSession(code: string) {
      const result = await pkce.exchangeCodeForSession(code);
      if (result.error || !result.data.session) return result;
      // A different login may finish while the request is in flight. Do not replace it.
      const current = await primary.getSession();
      if (current.error || current.data.session) {
        return { data: { session: null }, error: new Error('An existing session was preserved.') };
      }
      const session = result.data.session;
      return primary.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
    },
  };
}
