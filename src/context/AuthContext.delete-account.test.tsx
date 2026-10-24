/**
 * Release gate for the installed-client account-deletion response contract.
 * Mocked Supabase and jsdom Storage ONLY; no real users, credentials, or Edge calls.
 * This does not validate server-side idempotency or physical-device behavior.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
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
});
