import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
  });

  it('provides initial auth state', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });


  it('exits loading safely when initial session hydration fails', async () => {
    vi.mocked(supabase.auth.getSession).mockRejectedValueOnce(new Error('synthetic initial session failure'));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });


  it('ignores a late initial session result after an auth sign-out event', async () => {
    let finish!: (value: any) => void;
    vi.mocked(supabase.auth.getSession).mockImplementationOnce(() =>
      new Promise(resolve => { finish = resolve; }) as ReturnType<typeof supabase.auth.getSession>);
    let emit: any;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementationOnce(callback => {
      emit = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } } as any;
    });
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    act(() => { emit('SIGNED_OUT', null); });
    await act(async () => { finish({ data: { session: { user: { id: 'old-synthetic' } } }, error: null }); });
    expect(result.current.loading).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('throws error when used outside AuthProvider', () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');
  });

  it('calls signUp with email and password', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signUp('test@example.com', 'password123');
    });

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('returns error on signUp failure', async () => {
    const mockError = new Error('User already exists');
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: mockError as any,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let response: { error: Error | null } | undefined;
    await act(async () => {
      response = await result.current.signUp('test@example.com', 'password123');
    });

    expect(response?.error).toBe(mockError);
  });

  it('calls signIn with email and password', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    } as any);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signIn('test@example.com', 'password123');
    });

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('calls signOut', async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.signOut();
    });

    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it('calls resetPassword with email', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: {},
      error: null,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.resetPassword('test@example.com');
    });

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'test@example.com',
      expect.objectContaining({
        redirectTo: expect.any(String),
      })
    );
  });

  it('detects email verification from URL hash', async () => {
    window.location.hash = '#access_token=abc&type=signup';

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isEmailVerification).toBe(true);
  });

  it('detects password reset from URL hash', async () => {
    window.location.hash = '#access_token=abc&type=recovery';

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isPasswordReset).toBe(true);
  });

  it('clears email verification state', async () => {
    window.location.hash = '#access_token=abc&type=signup';

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isEmailVerification).toBe(true);

    act(() => {
      result.current.clearEmailVerification();
    });

    expect(result.current.isEmailVerification).toBe(false);
    expect(window.history.replaceState).toHaveBeenCalled();
  });

  it('clears password reset state', async () => {
    window.location.hash = '#access_token=abc&type=recovery';

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isPasswordReset).toBe(true);

    act(() => {
      result.current.clearPasswordReset();
    });

    expect(result.current.isPasswordReset).toBe(false);
    expect(window.history.replaceState).toHaveBeenCalled();
  });
});
