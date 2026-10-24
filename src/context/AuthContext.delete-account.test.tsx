/**
 * Release gate for the installed-client account-deletion response contract.
 * Mocked Supabase and jsdom Storage ONLY; no real users, credentials, or Edge calls.
 * This does not validate server-side idempotency or physical-device behavior.
 */
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import { AuthForm } from '../components/AuthForm';
import { supabase } from '../utils/supabase';

const NESMI_CHORES = 'chore-app-chores';
const NESMI_MEMBERS = 'chore-app-members';
const OTHER_APP_FIXTURE = 'movelight-fixture-keep';

async function mountAuth() {
  const hook = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

beforeEach(() => {
  vi.clearAllMocks();
  // In-memory jsdom fixture only. Never accesses a real browser or user account.
  localStorage.clear();
  localStorage.setItem(NESMI_CHORES, 'nesmi-chores-fixture');
  localStorage.setItem(NESMI_MEMBERS, 'nesmi-members-fixture');
  localStorage.setItem(OTHER_APP_FIXTURE, 'sibling-app-data-fixture');
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: null }, error: null,
  } as any);
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  } as any);
  vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null } as any);
});

describe('Nesmi account deletion confirmation and same-origin data isolation', () => {
  it('unblocks login after a failed initial session read without inventing authentication', async () => {
    vi.mocked(supabase.auth.getSession).mockRejectedValue(
      new Error('synthetic session storage read failure')
    );
    const hook = await mountAuth();
    try {
      expect(hook.result.current.loading).toBe(false);
      expect(hook.result.current.session).toBeNull();
      expect(hook.result.current.user).toBeNull();

      const freshSession = { user: { id: 'fresh-login-after-storage-failure' } };
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: freshSession.user, session: freshSession }, error: null,
      } as any);
      await act(async () => {
        const result = await hook.result.current.signIn('fresh@example.invalid', 'synthetic-only');
        expect(result.error).toBeNull();
      });
      expect(hook.result.current.user?.id).toBe('fresh-login-after-storage-failure');
    } finally {
      hook.unmount();
    }
  });

  it('removes only Nesmi cache keys after explicit deleted:true and signs out locally', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { deleted: true }, error: null,
    } as any);
    const hook = await mountAuth();
    const broadClear = vi.spyOn(Storage.prototype, 'clear');
    let response: { error: Error | null } | undefined;
    try {
      await act(async () => { response = await hook.result.current.deleteAccount(); });
      expect(response?.error).toBeNull();
      expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('delete-account', { method: 'POST' });
      expect(localStorage.getItem(NESMI_CHORES)).toBeNull();
      expect(localStorage.getItem(NESMI_MEMBERS)).toBeNull();
      expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
      expect(broadClear).not.toHaveBeenCalled();
      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    } finally {
      broadClear.mockRestore();
      hook.unmount();
    }
  });

  it('does not erase any keys or sign out when the success receipt is missing', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { deleted: false }, error: null,
    } as any);
    const hook = await mountAuth();
    let response: { error: Error | null } | undefined;
    await act(async () => { response = await hook.result.current.deleteAccount(); });
    expect(response?.error).toBeInstanceOf(Error);
    expect(localStorage.getItem(NESMI_CHORES)).toBe('nesmi-chores-fixture');
    expect(localStorage.getItem(NESMI_MEMBERS)).toBe('nesmi-members-fixture');
    expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    hook.unmount();
  });

  it('keeps caches and session untouched when the Edge transport reports an error', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null, error: new Error('synthetic uncertain acknowledgement'),
    } as any);
    const hook = await mountAuth();
    let response: { error: Error | null } | undefined;
    await act(async () => { response = await hook.result.current.deleteAccount(); });
    expect(response?.error).toBeInstanceOf(Error);
    expect(localStorage.getItem(NESMI_CHORES)).toBe('nesmi-chores-fixture');
    expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    hook.unmount();
  });

  it('propagates a rejected Edge promise without cleaning up an unconfirmed delete', async () => {
    vi.mocked(supabase.functions.invoke).mockRejectedValue(
      new Error('synthetic lost response')
    );
    const hook = await mountAuth();
    await act(async () => {
      await expect(hook.result.current.deleteAccount()).rejects.toThrow('synthetic lost response');
    });
    expect(localStorage.getItem(NESMI_CHORES)).toBe('nesmi-chores-fixture');
    expect(localStorage.getItem(NESMI_MEMBERS)).toBe('nesmi-members-fixture');
    expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    hook.unmount();
  });

  it('preserves deletion-confirmed outcome when local sign-out returns an SDK error', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { deleted: true }, error: null,
    } as any);
    vi.mocked(supabase.auth.signOut).mockResolvedValue({
      error: new Error('synthetic local SDK failure'),
    } as any);
    const hook = await mountAuth();
    let response: Awaited<ReturnType<typeof hook.result.current.deleteAccount>> | undefined;
    await act(async () => { response = await hook.result.current.deleteAccount(); });
    expect(response?.deletionConfirmed).toBe(true);
    expect(response?.error?.message).toContain('Account was deleted');
    expect(localStorage.getItem(NESMI_CHORES)).toBeNull();
    expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
    expect(hook.result.current.user).toBeNull();
    expect(hook.result.current.session).toBeNull();
    hook.unmount();
  });

  it('clears React auth state if local sign-out rejects after the server confirmed deletion', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'synthetic-user' } } }, error: null,
    } as any);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { deleted: true }, error: null,
    } as any);
    vi.mocked(supabase.auth.signOut).mockRejectedValue(new Error('synthetic sign-out reject'));
    const hook = await mountAuth();
    expect(hook.result.current.user?.id).toBe('synthetic-user');
    let response: Awaited<ReturnType<typeof hook.result.current.deleteAccount>> | undefined;
    await act(async () => { response = await hook.result.current.deleteAccount(); });
    expect(response?.deletionConfirmed).toBe(true);
    expect(response?.error?.message).toContain('Account was deleted');
    expect(hook.result.current.user).toBeNull();
    expect(hook.result.current.session).toBeNull();
    expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
    hook.unmount();
  });

  it('attempts the remaining cache key and SDK sign-out if a Nesmi storage removal throws', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { deleted: true }, error: null,
    } as any);
    const originalRemoveItem = Storage.prototype.removeItem;
    const failingRemove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, key: string) {
      if (key === NESMI_CHORES) throw new Error('synthetic Storage SecurityError');
      return originalRemoveItem.call(this, key);
    });
    const hook = await mountAuth();
    try {
      let response: Awaited<ReturnType<typeof hook.result.current.deleteAccount>> | undefined;
      await act(async () => { response = await hook.result.current.deleteAccount(); });
      expect(response?.deletionConfirmed).toBe(true);
      expect(response?.error?.message).toContain('Account was deleted');
      expect(localStorage.getItem(NESMI_MEMBERS)).toBeNull();
      expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(hook.result.current.session).toBeNull();
      expect(hook.result.current.user).toBeNull();
    } finally {
      failingRemove.mockRestore();
      hook.unmount();
    }
  });
  it('does not resurrect a deleted user from late getSession or auth events; accepts a new explicit login', async () => {
    let resolveInitial!: (value: any) => void;
    const pendingInitial = new Promise<any>((resolve) => { resolveInitial = resolve; });
    vi.mocked(supabase.auth.getSession).mockReturnValue(pendingInitial);
    let emitAuth!: (event: string, session: any) => void;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(((listener: any) => {
      emitAuth = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }) as any);
    const staleSession = { user: { id: 'deleted-fixture-user' } };
    const newSession = { user: { id: 'new-fixture-user' } };
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { deleted: true }, error: null,
    } as any);
    const hook = renderHook(() => useAuth(), { wrapper: AuthProvider });
    try {
      let deletion: Awaited<ReturnType<typeof hook.result.current.deleteAccount>> | undefined;
      await act(async () => { deletion = await hook.result.current.deleteAccount(); });
      expect(deletion?.deletionConfirmed).toBe(true);
      await act(async () => {
        resolveInitial({ data: { session: staleSession }, error: null });
        await pendingInitial;
      });
      expect(hook.result.current.loading).toBe(false);
      expect(hook.result.current.user).toBeNull();
      expect(hook.result.current.session).toBeNull();

      act(() => { emitAuth('SIGNED_IN', staleSession); });
      expect(hook.result.current.user).toBeNull();
      expect(hook.result.current.session).toBeNull();

      // A later, deliberate successful sign-in can start a new session.
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: newSession.user, session: newSession }, error: null,
      } as any);
      await act(async () => {
        const result = await hook.result.current.signIn('new-fixture@example.invalid', 'synthetic-only');
        expect(result.error).toBeNull();
      });
      expect(hook.result.current.user?.id).toBe('new-fixture-user');
    } finally {
      hook.unmount();
    }
  });


  it('ignores old-user SDK events after new explicit login, but accepts fresh-user refresh and logout', async () => {
    const stale = { user: { id: 'deleted-fixture' }, access_token: 'synthetic-old' };
    const fresh = { user: { id: 'fresh-fixture' }, access_token: 'synthetic-new' };
    const refresh = { user: { id: 'fresh-fixture' }, access_token: 'synthetic-refreshed' };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: stale }, error: null,
    } as any);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { deleted: true }, error: null,
    } as any);
    let emitAuth!: (event: string, session: any) => void;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(((listener: any) => {
      emitAuth = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }) as any);
    const hook = await mountAuth();
    try {
      expect(hook.result.current.user?.id).toBe('deleted-fixture');
      await act(async () => {
        const result = await hook.result.current.deleteAccount();
        expect(result.deletionConfirmed).toBe(true);
      });
      expect(hook.result.current.user).toBeNull();

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: fresh.user, session: fresh }, error: null,
      } as any);
      await act(async () => {
        const result = await hook.result.current.signIn('fresh@example.invalid', 'synthetic-only');
        expect(result.error).toBeNull();
      });
      expect(hook.result.current.user?.id).toBe('fresh-fixture');

      act(() => { emitAuth('SIGNED_IN', stale); });
      expect(hook.result.current.user?.id).toBe('fresh-fixture');
      expect(hook.result.current.session).toBe(fresh);
      act(() => { emitAuth('TOKEN_REFRESHED', stale); });
      expect(hook.result.current.session).toBe(fresh);
      act(() => { emitAuth('TOKEN_REFRESHED', refresh); });
      expect(hook.result.current.user?.id).toBe('fresh-fixture');
      expect(hook.result.current.session).toBe(refresh);

      act(() => { emitAuth('SIGNED_OUT', null); });
      expect(hook.result.current.session).toBeNull();
      expect(hook.result.current.user).toBeNull();
    } finally {
      hook.unmount();
    }
  });

  it('preserves ordinary SDK cross-tab account changes before any deletion', async () => {
    let emitAuth!: (event: string, session: any) => void;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(((listener: any) => {
      emitAuth = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }) as any);
    const hook = await mountAuth();
    try {
      act(() => { emitAuth('SIGNED_IN', { user: { id: 'ordinary-a' } }); });
      expect(hook.result.current.user?.id).toBe('ordinary-a');
      act(() => { emitAuth('SIGNED_IN', { user: { id: 'ordinary-b' } }); });
      expect(hook.result.current.user?.id).toBe('ordinary-b');
    } finally {
      hook.unmount();
    }
  });

  it('shows confirmed-deletion cleanup failure on AuthForm after App removes AccountSettings', async () => {
    // This simulates App's actual user ? Account : AuthForm branch. The Account
    // component's own local error message is unmounted when auth becomes null.
    const stale = { user: { id: 'to-delete-fixture' } };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: stale }, error: null,
    } as any);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { deleted: true }, error: null,
    } as any);
    vi.mocked(supabase.auth.signOut).mockResolvedValue({
      error: new Error('synthetic storage sign-out failure'),
    } as any);

    function AppLikeGate() {
      const auth = useAuth();
      if (auth.loading) return <span>Loading fixture session</span>;
      return auth.user
        ? <button type="button" onClick={() => { void auth.deleteAccount(); }}>Delete fixture account</button>
        : <AuthForm />;
    }

    const view = render(<AuthProvider><AppLikeGate /></AuthProvider>);
    try {
      fireEvent.click(await screen.findByRole('button', { name: 'Delete fixture account' }));
      const warning = await screen.findByRole('alert');
      expect(warning).toHaveTextContent('Account deleted, but this device could not fully clear its local sign-in data.');
      expect(warning).toHaveTextContent('Close and restart Nesmi');
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    } finally {
      view.unmount();
    }
  });

});
