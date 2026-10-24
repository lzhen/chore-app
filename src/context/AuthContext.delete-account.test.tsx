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
// Actual same-origin MoveLight keys confirmed in empathie-website/movelight/web/index.html.
// Use synthetic values only; do not read a deployed browser or household records.
const MOVELIGHT_SAVED_KEYS = [
  'qingbu.state.v1',
  'movelight.redesign.v1.state',
  'movelight.review.focus1.state',
  'movelight_redesign_v1_theme',
  'movelight_redesign_v1_language',
] as const;
const OTHER_APP_FIXTURE = MOVELIGHT_SAVED_KEYS[0];
const UNRELATED_APP_FIXTURE = 'unrelated:keep';

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
  for (const key of MOVELIGHT_SAVED_KEYS) {
    localStorage.setItem(key, 'sibling-app-data-fixture');
  }
  localStorage.setItem(UNRELATED_APP_FIXTURE, 'unrelated-app-data-fixture');
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: null }, error: null,
  } as any);
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  } as any);
  vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null } as any);
});

describe('Nesmi account deletion confirmation and same-origin data isolation', () => {
  it('revokes an already-mounted tab when a cross-tab deletion receipt arrives, preserving sibling data', async () => {
    const oldSession = { user: { id: 'synthetic-deleted-user' } };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: oldSession }, error: null,
    } as any);
    let emitAuth!: (event: string, session: any) => void;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(((listener: any) => {
      emitAuth = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }) as any);
    const hook = await mountAuth();
    try {
      expect(hook.result.current.user?.id).toBe('synthetic-deleted-user');
      // An unrelated sibling-app key cannot revoke the Nesmi session.
      await act(async () => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: OTHER_APP_FIXTURE, newValue: 'changed', storageArea: localStorage,
        }));
      });
      expect(hook.result.current.user?.id).toBe('synthetic-deleted-user');

      // Model the native storage event delivered to a DIFFERENT same-origin tab.
      // jsdom does not automatically emit it for writes made in this window.
      localStorage.setItem('nesmi:account-deletion-confirmed', 'true');
      await act(async () => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'nesmi:account-deletion-confirmed', newValue: 'true', storageArea: localStorage,
        }));
      });
      expect(hook.result.current.user).toBeNull();
      expect(hook.result.current.session).toBeNull();
      expect(hook.result.current.deletionCleanupWarning).toMatch(/previous account was deleted/i);
      expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');

      // A delayed Supabase event for that deleted identity cannot re-open UI.
      await act(async () => { emitAuth('SIGNED_IN', oldSession); });
      expect(hook.result.current.user).toBeNull();
    } finally {
      hook.unmount();
    }
  });

  it('rejects a pending startup session read after a different tab confirms deletion', async () => {
    // Real network/persistence is NOT exercised here. This isolates the React
    // startup getSession race with a synthetic same-origin storage event.
    const staleSession = { user: { id: 'deleted-during-startup' } };
    let finishSessionRead!: (value: any) => void;
    const pendingSessionRead = new Promise<any>((resolve) => { finishSessionRead = resolve; });
    vi.mocked(supabase.auth.getSession).mockReturnValue(pendingSessionRead as any);

    const hook = renderHook(() => useAuth(), { wrapper: AuthProvider });
    try {
      expect(hook.result.current.loading).toBe(true);
      localStorage.setItem('nesmi:account-deletion-confirmed', 'true');
      await act(async () => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'nesmi:account-deletion-confirmed',
          newValue: 'true',
          storageArea: localStorage,
        }));
      });
      expect(hook.result.current.loading).toBe(false);
      expect(hook.result.current.user).toBeNull();

      // An in-flight SDK getSession response from BEFORE the deletion event
      // must never re-authorize the deleted identity in this tab.
      await act(async () => {
        finishSessionRead({ data: { session: staleSession }, error: null });
      });
      expect(hook.result.current.user).toBeNull();
      expect(hook.result.current.session).toBeNull();
      expect(hook.result.current.deletionCleanupWarning).toMatch(/previous account was deleted/i);
      expect(localStorage.getItem('nesmi:account-deletion-confirmed')).toBe('true');
      expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
    } finally {
      hook.unmount();
    }
  });

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

  it('preserves source-backed MoveLight saved-state and preference keys after confirmed deletion', async () => {
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
      for (const key of MOVELIGHT_SAVED_KEYS) {
        expect(localStorage.getItem(key)).toBe('sibling-app-data-fixture');
      }
      expect(localStorage.getItem(UNRELATED_APP_FIXTURE)).toBe('unrelated-app-data-fixture');
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

  it('lets a signed-out user retry after a rejected sign-in request', async () => {
    // Exercise the real AuthForm within the existing release-gate workflow.
    // This previously left Loading... disabled forever when SDK rejected.
    vi.mocked(supabase.auth.signInWithPassword)
      .mockRejectedValueOnce(new Error('synthetic intermittent SDK failure'))
      .mockResolvedValueOnce({ data: { user: null, session: null }, error: null } as any);
    const view = render(<AuthProvider><AuthForm /></AuthProvider>);
    try {
      fireEvent.change(screen.getByLabelText('Email'), {
        target: { value: 'retry@example.invalid' },
      });
      fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'synthetic-only' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Could not complete the request. Please try again.'
      );
      const button = screen.getByRole('button', { name: 'Sign In' });
      expect(button).toBeEnabled();
      fireEvent.click(button);
      await waitFor(() => expect(supabase.auth.signInWithPassword).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    } finally {
      view.unmount();
    }
  });


  it('blocks a stale deleted identity on a fresh provider after failed SDK sign-out, until explicit new login', async () => {
    // Synthetic SDK/localStorage replay, not a real physical-device or Edge test.
    const staleSession = { user: { id: 'deleted-fixture-identity' } };
    const freshSession = { user: { id: 'new-fixture-identity' } };
    const listeners: Array<(event: string, session: any) => void> = [];
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(((listener: any) => {
      listeners.push(listener);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }) as any);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: staleSession }, error: null,
    } as any);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { deleted: true }, error: null,
    } as any);
    vi.mocked(supabase.auth.signOut).mockRejectedValue(
      new Error('synthetic persisted SDK sign-out failure')
    );

    const first = await mountAuth();
    try {
      expect(first.result.current.user?.id).toBe('deleted-fixture-identity');
      await act(async () => {
        const result = await first.result.current.deleteAccount();
        expect(result.deletionConfirmed).toBe(true);
        expect(result.error).toBeInstanceOf(Error);
      });
      expect(localStorage.getItem('nesmi:account-deletion-confirmed')).toBe('true');
      expect(first.result.current.user).toBeNull();
      expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
    } finally {
      first.unmount();
    }

    // A fresh provider simulates a complete React remount. A still-persisted
    // old SDK session must not be trusted, even if an old auth event arrives.
    const reopened = await mountAuth();
    try {
      expect(reopened.result.current.user).toBeNull();
      expect(reopened.result.current.session).toBeNull();
      expect(reopened.result.current.deletionCleanupWarning).toMatch(/previous account was deleted/i);
      expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
      act(() => { listeners[listeners.length - 1]?.('SIGNED_IN', staleSession); });
      expect(reopened.result.current.user).toBeNull();

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: freshSession.user, session: freshSession }, error: null,
      } as any);
      await act(async () => {
        const result = await reopened.result.current.signIn('new-fixture@example.invalid', 'synthetic-only');
        expect(result.error).toBeNull();
      });
      expect(reopened.result.current.user?.id).toBe('new-fixture-identity');
      expect(localStorage.getItem('nesmi:account-deletion-confirmed')).toBeNull();
    } finally {
      reopened.unmount();
    }

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: freshSession }, error: null,
    } as any);
    const third = await mountAuth();
    try {
      expect(third.result.current.user?.id).toBe('new-fixture-identity');
      expect(third.result.current.deletionCleanupWarning).toBeNull();
    } finally {
      third.unmount();
    }
  });

  it('warns if storing a deletion receipt fails, without erasing another app cache', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { deleted: true }, error: null,
    } as any);
    const originalSet = Storage.prototype.setItem;
    const blocked = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === 'nesmi:account-deletion-confirmed') throw new Error('synthetic quota or security error');
      return originalSet.call(this, key, value);
    });
    const hook = await mountAuth();
    try {
      let response: Awaited<ReturnType<typeof hook.result.current.deleteAccount>> | undefined;
      await act(async () => { response = await hook.result.current.deleteAccount(); });
      expect(response?.deletionConfirmed).toBe(true);
      expect(response?.error?.message).toContain('local session protection could not be saved');
      expect(hook.result.current.deletionCleanupWarning).toMatch(/could not fully clear/i);
      expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    } finally {
      blocked.mockRestore();
      hook.unmount();
    }
  });

  it('keeps the deleted-account receipt during unverified signup, then clears it after a real new login', async () => {
    // Supabase email-confirmation signUp typically has a user but no session.
    // That is not authentication and must not re-arm an old SDK session.
    localStorage.setItem('nesmi:account-deletion-confirmed', 'true');
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'deleted-old-account' } } }, error: null,
    } as any);
    const hook = await mountAuth();
    try {
      expect(hook.result.current.user).toBeNull();
      expect(supabase.auth.getSession).not.toHaveBeenCalled();

      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: { id: 'pending-email-verification' }, session: null },
        error: null,
      } as any);
      await act(async () => {
        const result = await hook.result.current.signUp('pending@example.invalid', 'synthetic-only');
        expect(result.error).toBeNull();
      });
      expect(hook.result.current.user).toBeNull();
      expect(hook.result.current.session).toBeNull();
      expect(localStorage.getItem('nesmi:account-deletion-confirmed')).toBe('true');
      expect(hook.result.current.deletionCleanupWarning).toMatch(/previous account was deleted/i);
      expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');

      // Only a verified explicit sign-in can replace the deleted identity.
      const freshSession = { user: { id: 'verified-new-account' } };
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: freshSession.user, session: freshSession }, error: null,
      } as any);
      await act(async () => {
        const result = await hook.result.current.signIn('verified@example.invalid', 'synthetic-only');
        expect(result.error).toBeNull();
      });
      expect(hook.result.current.user?.id).toBe('verified-new-account');
      expect(localStorage.getItem('nesmi:account-deletion-confirmed')).toBeNull();
      expect(hook.result.current.deletionCleanupWarning).toBeNull();
      expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
    } finally {
      hook.unmount();
    }
  });


  it('ignores a late sign-in response after another tab confirms deletion', async () => {
    // Synthetic in-flight Supabase operation; no actual SDK, user, or account deletion.
    const oldSession = { user: { id: 'deleted-old-tab-user' } };
    const delayedSession = { user: { id: 'stale-late-login' } };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: oldSession }, error: null,
    } as any);
    const hook = await mountAuth();
    let finish!: (value: any) => void;
    const inFlight = new Promise<any>((resolve) => { finish = resolve; });
    vi.mocked(supabase.auth.signInWithPassword).mockReturnValue(inFlight);
    try {
      expect(hook.result.current.user?.id).toBe('deleted-old-tab-user');
      let request!: ReturnType<typeof hook.result.current.signIn>;
      act(() => {
        request = hook.result.current.signIn('old@example.invalid', 'synthetic-only');
      });

      localStorage.setItem('nesmi:account-deletion-confirmed', 'true');
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'nesmi:account-deletion-confirmed', newValue: 'true', storageArea: localStorage,
        }));
      });
      expect(hook.result.current.user).toBeNull();

      let outcome!: Awaited<typeof request>;
      await act(async () => {
        finish({ data: { user: delayedSession.user, session: delayedSession }, error: null });
        outcome = await request;
      });
      expect(outcome.error?.message).toMatch(/account state changed during sign-in/i);
      expect(hook.result.current.user).toBeNull();
      expect(hook.result.current.session).toBeNull();
      expect(localStorage.getItem('nesmi:account-deletion-confirmed')).toBe('true');
      expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');

      // A new deliberate sign-in AFTER receiving the receipt is still allowed.
      const newSession = { user: { id: 'new-explicit-login-user' } };
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: newSession.user, session: newSession }, error: null,
      } as any);
      await act(async () => {
        const result = await hook.result.current.signIn('new@example.invalid', 'synthetic-only');
        expect(result.error).toBeNull();
      });
      expect(hook.result.current.user?.id).toBe('new-explicit-login-user');
      expect(localStorage.getItem('nesmi:account-deletion-confirmed')).toBeNull();
    } finally {
      hook.unmount();
    }
  });

  it('preserves the deletion receipt if a prior sign-up resolves with an SDK session late', async () => {
    const hook = await mountAuth();
    let finish!: (value: any) => void;
    const inFlight = new Promise<any>((resolve) => { finish = resolve; });
    vi.mocked(supabase.auth.signUp).mockReturnValue(inFlight);
    try {
      let request!: ReturnType<typeof hook.result.current.signUp>;
      act(() => {
        request = hook.result.current.signUp('pending@example.invalid', 'synthetic-only');
      });

      localStorage.setItem('nesmi:account-deletion-confirmed', 'true');
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'nesmi:account-deletion-confirmed', newValue: 'true', storageArea: localStorage,
        }));
      });

      let outcome!: Awaited<typeof request>;
      await act(async () => {
        finish({
          data: {
            user: { id: 'late-signup-user' },
            session: { user: { id: 'late-signup-user' } },
          }, error: null,
        });
        outcome = await request;
      });
      expect(outcome.error?.message).toMatch(/account state changed during sign-up/i);
      expect(hook.result.current.user).toBeNull();
      expect(hook.result.current.session).toBeNull();
      expect(localStorage.getItem('nesmi:account-deletion-confirmed')).toBe('true');
      expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
    } finally {
      hook.unmount();
    }
  });

});
