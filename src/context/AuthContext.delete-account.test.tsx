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

describe('Nesmi explicit sign-out outcome', () => {
  it('does not silently accept a resolved Supabase SDK error', async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({
      error: new Error('synthetic session revocation error'),
    } as any);
    const hook = await mountAuth();
    try {
      await expect(hook.result.current.signOut()).rejects.toThrow('Could not sign out');
      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
      // A failed sign-out is not proof of an invalidated authenticated session.
      expect(localStorage.getItem(NESMI_CHORES)).toBe('nesmi-chores-fixture');
      expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
    } finally {
      hook.unmount();
    }
  });
  it('keeps a provider-level pending lock while the Account view could remount, then stays locked on success', async () => {
    let release!: (value: any) => void;
    const pending = new Promise<any>(resolve => { release = resolve; });
    vi.mocked(supabase.auth.signOut).mockReturnValueOnce(pending as any);
    const hook = await mountAuth();
    try {
      let first!: Promise<void>;
      act(() => { first = hook.result.current.signOut(); });
      expect(hook.result.current.signOutStatus).toBe('pending');
      await act(async () => {
        await expect(hook.result.current.signOut()).rejects.toThrow('already pending or completed');
      });
      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
      await act(async () => { release({ error: null }); await first; });
      expect(hook.result.current.signOutStatus).toBe('succeeded');
      await act(async () => {
        await expect(hook.result.current.signOut()).rejects.toThrow('already pending or completed');
      });
      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    } finally {
      hook.unmount();
    }
  });

  it('releases the provider lock on a confirmed SDK error so sign-out can be retried', async () => {
    vi.mocked(supabase.auth.signOut)
      .mockResolvedValueOnce({ error: new Error('synthetic SDK failure') } as any)
      .mockResolvedValueOnce({ error: null } as any);
    const hook = await mountAuth();
    try {
      await act(async () => {
        await expect(hook.result.current.signOut()).rejects.toThrow('Could not sign out');
      });
      expect(hook.result.current.signOutStatus).toBe('idle');
      await act(async () => { await hook.result.current.signOut(); });
      expect(hook.result.current.signOutStatus).toBe('succeeded');
      expect(supabase.auth.signOut).toHaveBeenCalledTimes(2);
    } finally {
      hook.unmount();
    }
  });
});

describe('Nesmi deletion and sign-out ordering (provider release gate)', () => {
  it('does not send account deletion while sign-out is pending or already succeeded', async () => {
    const currentSession = { user: { id: 'synthetic-account-being-signed-out' } };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: currentSession }, error: null,
    } as any);
    let finishLogout!: (value: any) => void;
    const pendingLogout = new Promise<any>(resolve => { finishLogout = resolve; });
    vi.mocked(supabase.auth.signOut).mockReturnValueOnce(pendingLogout as any);
    const hook = await mountAuth();
    try {
      let logout!: Promise<void>;
      act(() => { logout = hook.result.current.signOut(); });
      expect(hook.result.current.signOutStatus).toBe('pending');

      await act(async () => {
        const result = await hook.result.current.deleteAccount(currentSession.user.id);
        expect(result.deletionConfirmed).toBe(false);
        expect(result.error?.message).toMatch(/sign-out is pending or completed/i);
      });
      expect(supabase.functions.invoke).not.toHaveBeenCalled();

      await act(async () => { finishLogout({ error: null }); await logout; });
      expect(hook.result.current.signOutStatus).toBe('succeeded');
      await act(async () => {
        const result = await hook.result.current.deleteAccount(currentSession.user.id);
        expect(result.deletionConfirmed).toBe(false);
        expect(result.error?.message).toMatch(/sign-out is pending or completed/i);
      });
      expect(supabase.functions.invoke).not.toHaveBeenCalled();
      expect(hook.result.current.user).toBeNull();
      expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
    } finally {
      hook.unmount();
    }
  });

  it('permits deletion request after confirmed sign-out failure releases provider lock', async () => {
    const currentSession = { user: { id: 'synthetic-retry-account' } };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: currentSession }, error: null,
    } as any);
    vi.mocked(supabase.auth.signOut).mockResolvedValueOnce({
      error: new Error('synthetic SDK sign-out failure'),
    } as any);
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null, error: new Error('synthetic server refusal'),
    } as any);
    const hook = await mountAuth();
    try {
      await act(async () => {
        await expect(hook.result.current.signOut()).rejects.toThrow('Could not sign out');
      });
      expect(hook.result.current.signOutStatus).toBe('idle');
      await act(async () => {
        const result = await hook.result.current.deleteAccount(currentSession.user.id);
        expect(result.deletionConfirmed).toBe(false);
        expect(result.error?.message).toMatch(/synthetic server refusal/i);
      });
      expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('delete-account-v2', {
        method: 'POST', body: { expectedUserId: currentSession.user.id },
      });
    } finally {
      hook.unmount();
    }
  });

  it('prevents a second deletion POST and explicit logout until first deletion is reconciled', async () => {
    // One synthetic account, deferred SDK invoke; no real Edge or user is touched.
    const accountId = 'synthetic-delete-first-account';
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: accountId } } }, error: null,
    } as any);
    let finishDelete!: (value: any) => void;
    const pendingDelete = new Promise<any>(resolve => { finishDelete = resolve; });
    vi.mocked(supabase.functions.invoke).mockReturnValueOnce(pendingDelete as any);
    const hook = await mountAuth();
    try {
      let first!: ReturnType<typeof hook.result.current.deleteAccount>;
      act(() => { first = hook.result.current.deleteAccount(accountId); });
      await act(async () => {
        const duplicate = await hook.result.current.deleteAccount(accountId);
        expect(duplicate.deletionConfirmed).toBe(false);
        expect(duplicate.error?.message).toMatch(/deletion is already in progress/i);
        await expect(hook.result.current.signOut()).rejects.toThrow(/deletion is in progress/i);
      });
      expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
      expect(supabase.auth.signOut).not.toHaveBeenCalled();

      await act(async () => {
        finishDelete({ data: { deleted: true }, error: null });
        const result = await first;
        expect(result.deletionConfirmed).toBe(true);
      });
      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(hook.result.current.user).toBeNull();
      expect(localStorage.getItem(NESMI_CHORES)).toBeNull();
      expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
    } finally {
      hook.unmount();
    }
  });

  it('releases deletion/logout mutex after an explicit server refusal, without repeating deletion', async () => {
    const accountId = 'synthetic-deletion-refused-account';
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: accountId } } }, error: null,
    } as any);
    let finishDelete!: (value: any) => void;
    const pendingDelete = new Promise<any>(resolve => { finishDelete = resolve; });
    vi.mocked(supabase.functions.invoke).mockReturnValueOnce(pendingDelete as any);
    const hook = await mountAuth();
    try {
      let first!: ReturnType<typeof hook.result.current.deleteAccount>;
      act(() => { first = hook.result.current.deleteAccount(accountId); });
      await act(async () => {
        await expect(hook.result.current.signOut()).rejects.toThrow(/deletion is in progress/i);
      });
      await act(async () => {
        finishDelete({ data: null, error: new Error('synthetic server refusal') });
        const result = await first;
        expect(result.deletionConfirmed).toBe(false);
        expect(result.error?.message).toMatch(/synthetic server refusal/i);
      });
      // The release is only of the in-flight lock; no second delete is retried.
      await act(async () => { await hook.result.current.signOut(); });
      expect(hook.result.current.signOutStatus).toBe('succeeded');
      expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
      expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(NESMI_CHORES)).toBe('nesmi-chores-fixture');
      expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
    } finally {
      hook.unmount();
    }
  });

});

describe('Nesmi SDK identity mutation exclusions during destructive operations', () => {
  it('does not call login or signup SDK while deletion is unresolved; permits new login after explicit refusal', async () => {
    const accountId = 'synthetic-pending-delete-owner';
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: accountId } } }, error: null,
    } as any);
    let finishDelete!: (value: any) => void;
    const pendingDelete = new Promise<any>(resolve => { finishDelete = resolve; });
    vi.mocked(supabase.functions.invoke).mockReturnValueOnce(pendingDelete as any);
    const hook = await mountAuth();
    try {
      let deletion!: ReturnType<typeof hook.result.current.deleteAccount>;
      act(() => { deletion = hook.result.current.deleteAccount(accountId); });
      await act(async () => {
        const login = await hook.result.current.signIn('other@example.invalid', 'synthetic-only');
        const signup = await hook.result.current.signUp('new@example.invalid', 'synthetic-only');
        expect(login.error?.message).toMatch(/account change is in progress/i);
        expect(signup.error?.message).toMatch(/account change is in progress/i);
      });
      expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
      expect(supabase.auth.signUp).not.toHaveBeenCalled();
      expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);

      await act(async () => {
        finishDelete({ data: null, error: new Error('synthetic refusal') });
        const response = await deletion;
        expect(response.deletionConfirmed).toBe(false);
      });
      const newSession = { user: { id: 'synthetic-later-account' } };
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
        data: { user: newSession.user, session: newSession }, error: null,
      } as any);
      await act(async () => {
        expect((await hook.result.current.signIn('other@example.invalid', 'synthetic-only')).error).toBeNull();
      });
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledTimes(1);
      expect(hook.result.current.user?.id).toBe('synthetic-later-account');
    } finally {
      hook.unmount();
    }
  });

  it('blocks SDK login and signup during pending logout but permits deliberate login after success', async () => {
    let finishLogout!: (value: any) => void;
    const pendingLogout = new Promise<any>(resolve => { finishLogout = resolve; });
    vi.mocked(supabase.auth.signOut).mockReturnValueOnce(pendingLogout as any);
    const hook = await mountAuth();
    try {
      let logout!: Promise<void>;
      act(() => { logout = hook.result.current.signOut(); });
      await act(async () => {
        expect((await hook.result.current.signIn('other@example.invalid', 'synthetic-only')).error?.message)
          .toMatch(/account change is in progress/i);
        expect((await hook.result.current.signUp('other@example.invalid', 'synthetic-only')).error?.message)
          .toMatch(/account change is in progress/i);
      });
      expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
      expect(supabase.auth.signUp).not.toHaveBeenCalled();
      await act(async () => { finishLogout({ error: null }); await logout; });
      const session = { user: { id: 'synthetic-post-logout' } };
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
        data: { user: session.user, session }, error: null,
      } as any);
      await act(async () => {
        expect((await hook.result.current.signIn('other@example.invalid', 'synthetic-only')).error).toBeNull();
      });
      expect(hook.result.current.user?.id).toBe('synthetic-post-logout');
      expect(hook.result.current.signOutStatus).toBe('idle');
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledTimes(1);
    } finally {
      hook.unmount();
    }
  });
});

describe('Nesmi sign-out identity serialization', () => {
  it('rejects an older sign-in result that resolves after successful logout', async () => {
    const originalSession = { user: { id: 'synthetic-account-before-logout' } };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: originalSession }, error: null,
    } as any);
    let finishLogin!: (value: any) => void;
    const deferredLogin = new Promise<any>(resolve => { finishLogin = resolve; });
    vi.mocked(supabase.auth.signInWithPassword).mockReturnValueOnce(deferredLogin as any);
    const hook = await mountAuth();
    try {
      expect(hook.result.current.user?.id).toBe('synthetic-account-before-logout');
      let lateLogin!: Promise<{ error: Error | null }>;
      act(() => {
        lateLogin = hook.result.current.signIn('new@example.invalid', 'fixture-only');
      });
      await act(async () => { await hook.result.current.signOut(); });
      expect(hook.result.current.signOutStatus).toBe('succeeded');
      expect(hook.result.current.user).toBeNull();
      expect(hook.result.current.session).toBeNull();

      let result!: { error: Error | null };
      await act(async () => {
        finishLogin({
          data: { user: { id: 'synthetic-late-login' },
            session: { user: { id: 'synthetic-late-login' } } }, error: null,
        });
        result = await lateLogin;
      });
      expect(result.error?.message).toMatch(/account state changed/i);
      expect(hook.result.current.user).toBeNull();
      expect(hook.result.current.session).toBeNull();
      expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
    } finally {
      hook.unmount();
    }
  });

  it('ignores a stale SDK SIGNED_IN event after logout but permits deliberate new login', async () => {
    const oldSession = { user: { id: 'synthetic-old-account' } };
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
      await act(async () => { await hook.result.current.signOut(); });
      expect(hook.result.current.user).toBeNull();
      await act(async () => { emitAuth('SIGNED_IN', oldSession); });
      expect(hook.result.current.user).toBeNull();
      expect(hook.result.current.session).toBeNull();

      const deliberateSession = { user: { id: 'synthetic-deliberate-new-account' } };
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
        data: { user: deliberateSession.user, session: deliberateSession }, error: null,
      } as any);
      await act(async () => {
        const result = await hook.result.current.signIn('new@example.invalid', 'fixture-only');
        expect(result.error).toBeNull();
      });
      expect(hook.result.current.signOutStatus).toBe('idle');
      expect(hook.result.current.user?.id).toBe('synthetic-deliberate-new-account');
    } finally {
      hook.unmount();
    }
  });
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

  it('blocks a mounted tab on a malformed cross-tab receipt, then permits deliberate new login', async () => {
    const staleSession = { user: { id: 'synthetic-previous-user' } };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: staleSession }, error: null,
    } as any);
    let emitAuth!: (event: string, session: any) => void;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(((listener: any) => {
      emitAuth = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }) as any);
    const hook = await mountAuth();
    try {
      expect(hook.result.current.user?.id).toBe('synthetic-previous-user');
      localStorage.setItem('nesmi:account-deletion-confirmed', 'malformed-receipt');
      await act(async () => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'nesmi:account-deletion-confirmed',
          newValue: 'malformed-receipt',
          storageArea: localStorage,
        }));
      });
      expect(hook.result.current.user).toBeNull();
      expect(hook.result.current.session).toBeNull();
      expect(hook.result.current.deletionCleanupWarning).toMatch(/could not be verified/i);
      await act(async () => { emitAuth('SIGNED_IN', staleSession); });
      expect(hook.result.current.user).toBeNull();
      expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');

      const freshSession = { user: { id: 'synthetic-new-explicit-user' } };
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: freshSession.user, session: freshSession }, error: null,
      } as any);
      await act(async () => {
        const result = await hook.result.current.signIn('fresh@example.invalid', 'synthetic-only');
        expect(result.error).toBeNull();
      });
      expect(hook.result.current.user?.id).toBe('synthetic-new-explicit-user');
      expect(localStorage.getItem('nesmi:account-deletion-confirmed')).toBeNull();
      expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
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

  it('keeps live SDK auth transitions ahead of a delayed initial session snapshot', async () => {
    // This exercises the actual AuthProvider/React lifecycle with synthetic SDK
    // events. It never logs into an account or reads actual browser sessions.
    for (const transition of [
      { event: 'SIGNED_IN', session: { user: { id: 'synthetic-new-user' } }, expectedId: 'synthetic-new-user' },
      { event: 'SIGNED_OUT', session: null, expectedId: null },
    ]) {
      let resolveInitial!: (value: any) => void;
      const pendingInitial = new Promise<any>(resolve => { resolveInitial = resolve; });
      vi.mocked(supabase.auth.getSession).mockReturnValue(pendingInitial as any);
      let emitAuth!: (event: string, session: any) => void;
      vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(((listener: any) => {
        emitAuth = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }) as any);

      const hook = renderHook(() => useAuth(), { wrapper: AuthProvider });
      try {
        await act(async () => { emitAuth(transition.event, transition.session); });
        // The initial read was started before the event but finishes afterward.
        await act(async () => {
          resolveInitial({ data: { session: { user: { id: 'synthetic-stale-user' } } }, error: null });
          await pendingInitial;
        });
        expect(hook.result.current.loading).toBe(false);
        expect(hook.result.current.user?.id ?? null).toBe(transition.expectedId);
        expect(hook.result.current.session?.user?.id ?? null).toBe(transition.expectedId);
        expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
      } finally {
        hook.unmount();
      }
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

  it('preserves explicitly confirmed ID across a changed React auth identity', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'synthetic-account-B' } } }, error: null,
    } as any);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null, error: new Error('synthetic 409 account mismatch'),
    } as any);
    const hook = await mountAuth();
    try {
      await act(async () => {
        const response = await hook.result.current.deleteAccount('synthetic-account-A');
        expect(response.deletionConfirmed).toBe(false);
        expect(response.error).toBeInstanceOf(Error);
      });
      expect(supabase.functions.invoke).toHaveBeenCalledWith('delete-account-v2', {
        method: 'POST', body: { expectedUserId: 'synthetic-account-A' },
      });
      expect(supabase.auth.signOut).not.toHaveBeenCalled();
      expect(localStorage.getItem(NESMI_CHORES)).toBe('nesmi-chores-fixture');
    } finally {
      hook.unmount();
    }
  });

  it('preserves source-backed MoveLight saved-state and preference keys after confirmed deletion', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { deleted: true }, error: null,
    } as any);
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'synthetic-intended-account' } } }, error: null,
    } as any);
    const hook = await mountAuth();
    const broadClear = vi.spyOn(Storage.prototype, 'clear');
    let response: { error: Error | null } | undefined;
    try {
      await act(async () => { response = await hook.result.current.deleteAccount(); });
      expect(response?.error).toBeNull();
      expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('delete-account-v2', {
        method: 'POST', body: { expectedUserId: 'synthetic-intended-account' },
      });
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
    expect(response?.error?.message).toMatch(/do not retry until support verifies/i);
    expect(response?.error?.message).not.toMatch(/please try again/i);
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
      expect(warning).toHaveTextContent('Closing or restarting Nesmi may restore an old session.');
      expect(warning).toHaveTextContent('Contact support before using Nesmi on this device again.');
      expect(screen.getByRole('link', { name: 'Email support' })).toHaveAttribute('href', 'mailto:care@empathie.ai');
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
      expect(hook.result.current.deletionCleanupWarning).toMatch(/restarting Nesmi may restore an old session/i);
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



  it('blocks a malformed deletion receipt until a new explicit verified sign-in', async () => {
    // An unknown stored value is not evidence that no deletion occurred.
    // Synthetic identities and jsdom storage only, no external SDK/network.
    const marker = 'nesmi:account-deletion-confirmed';
    localStorage.setItem(marker, 'unexpected-marker-value');
    const staleSession = { user: { id: 'possibly-deleted-synthetic-user' } };
    const freshSession = { user: { id: 'explicitly-signed-in-synthetic-user' } };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: staleSession }, error: null,
    } as any);
    let emitAuth!: (event: string, session: any) => void;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(((listener: any) => {
      emitAuth = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }) as any);
    const hook = await mountAuth();
    try {
      expect(hook.result.current.user).toBeNull();
      expect(hook.result.current.session).toBeNull();
      expect(hook.result.current.deletionCleanupWarning).toMatch(/account protection could not be verified/i);
      expect(supabase.auth.getSession).not.toHaveBeenCalled();
      act(() => { emitAuth('SIGNED_IN', staleSession); });
      expect(hook.result.current.user).toBeNull();

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: freshSession.user, session: freshSession }, error: null,
      } as any);
      await act(async () => {
        const result = await hook.result.current.signIn('fresh@example.invalid', 'synthetic-only');
        expect(result.error).toBeNull();
      });
      expect(hook.result.current.user?.id).toBe(freshSession.user.id);
      expect(hook.result.current.deletionCleanupWarning).toBeNull();
      expect(localStorage.getItem(marker)).toBeNull();
      expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
    } finally {
      hook.unmount();
    }
  });

  it('fails closed when storage cannot read a deletion receipt at startup, even with a stale SDK session', async () => {
    // A storage permission failure may conceal a previously confirmed delete.
    // Synthetic storage and SDK only: never touches a real account or browser.
    const marker = 'nesmi:account-deletion-confirmed';
    localStorage.setItem(marker, 'true');
    const staleSession = { user: { id: 'deleted-old-identity' } };
    const freshSession = { user: { id: 'fresh-after-storage-recovery' } };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: staleSession }, error: null,
    } as any);
    let emitAuth!: (event: string, session: any) => void;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(((listener: any) => {
      emitAuth = listener;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }) as any);
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: freshSession.user, session: freshSession }, error: null,
    } as any);

    const originalGet = Storage.prototype.getItem;
    const blocked = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
      function (this: Storage, key: string) {
        if (key === marker) throw new Error('synthetic storage read permission denied');
        return originalGet.call(this, key);
      }
    );
    let hook: Awaited<ReturnType<typeof mountAuth>> | undefined;
    try {
      hook = await mountAuth();
      expect(hook.result.current.user).toBeNull();
      expect(hook.result.current.session).toBeNull();
      expect(hook.result.current.deletionCleanupWarning).toMatch(/account protection could not be verified/i);
      expect(supabase.auth.getSession).not.toHaveBeenCalled();
      act(() => { emitAuth('SIGNED_IN', staleSession); });
      expect(hook.result.current.user).toBeNull();

      // Even a newly authenticated SDK response is not reported as signed in
      // until receipt storage can be read back after removal.
      await act(async () => {
        const result = await hook!.result.current.signIn('fresh@example.invalid', 'synthetic-only');
        expect(result.error?.message).toMatch(/deletion safeguard/i);
      });
      expect(hook.result.current.user).toBeNull();
      expect(hook.result.current.session).toBeNull();
      expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
    } finally {
      blocked.mockRestore();
    }
    try {
      // After permission recovery, only a NEW explicit login re-arms React auth.
      await act(async () => {
        const result = await hook!.result.current.signIn('fresh@example.invalid', 'synthetic-only');
        expect(result.error).toBeNull();
      });
      expect(hook!.result.current.user?.id).toBe('fresh-after-storage-recovery');
      expect(hook!.result.current.deletionCleanupWarning).toBeNull();
      expect(localStorage.getItem(marker)).toBeNull();
      expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
    } finally {
      hook?.unmount();
    }
  });

  it('fails closed if a fresh verified session cannot clear the prior deletion receipt (no SDK or browser access)', async () => {
    // The SDK may have authenticated, but a stale device-level receipt must
    // never coexist with a user-facing successful login that fails on reload.
    // Both paths use synthetic sessions, mocked SDK and jsdom localStorage.
    const marker = 'nesmi:account-deletion-confirmed';
    const originalRemove = Storage.prototype.removeItem;
    for (const mode of ['signIn', 'signUp'] as const) {
      localStorage.setItem(marker, 'true');
      const attemptedSession = { user: { id: 'new-' + mode + '-synthetic-user' } };
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: attemptedSession.user, session: attemptedSession }, error: null,
      } as any);
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: attemptedSession.user, session: attemptedSession }, error: null,
      } as any);

      const hook = await mountAuth();
      const blocked = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(
        function (this: Storage, key: string) {
          if (key === marker) throw new Error('synthetic read-only storage');
          return originalRemove.call(this, key);
        }
      );
      try {
        expect(hook.result.current.user).toBeNull();
        let result: { error: Error | null } | undefined;
        await act(async () => {
          result = mode === 'signIn'
            ? await hook.result.current.signIn('fresh@example.invalid', 'synthetic-only')
            : await hook.result.current.signUp('fresh@example.invalid', 'synthetic-only');
        });
        expect(result?.error?.message).toMatch(/deletion safeguard/i);
        expect(hook.result.current.user).toBeNull();
        expect(hook.result.current.session).toBeNull();
        expect(localStorage.getItem(marker)).toBe('true');
        expect(localStorage.getItem(OTHER_APP_FIXTURE)).toBe('sibling-app-data-fixture');
      } finally {
        blocked.mockRestore();
      }
      // Storage permission can recover: a new explicit sign-in should then
      // clear the marker and re-arm a new session without broad storage wipe.
      try {
        await act(async () => {
          const result = await hook.result.current.signIn('fresh@example.invalid', 'synthetic-only');
          expect(result.error).toBeNull();
        });
        expect(hook.result.current.user?.id).toBe(attemptedSession.user.id);
        expect(localStorage.getItem(marker)).toBeNull();
      } finally {
        hook.unmount();
      }
    }
  });

});
