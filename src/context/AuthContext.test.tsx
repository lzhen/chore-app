import { StrictMode, useEffect } from 'react';
import { render, renderHook, act, waitFor } from '@testing-library/react';
import { AuthError, type Session } from '@supabase/supabase-js';
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

  it.each(['returned', 'rejected'])('retries a %s session restore error without signing out', async (failure) => {
    const error = new AuthError('Synthetic session restore failure', 503);
    const read = vi.mocked(supabase.auth.getSession);
    if (failure === 'returned') read.mockResolvedValueOnce({ data: { session: null }, error });
    else read.mockRejectedValueOnce(error);

    const session = { user: { id: 'existing-user' } } as Session;
    read.mockResolvedValueOnce({ data: { session }, error: null });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.sessionLoadFailed).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();

    const listener = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0];
    act(() => { void listener('INITIAL_SESSION', null); });
    expect(result.current.sessionLoadFailed).toBe(true);

    act(() => result.current.retrySession());
    await waitFor(() => expect(result.current.session).toBe(session));
    expect(result.current.user?.id).toBe('existing-user');
    expect(result.current.loading).toBe(false);
    expect(result.current.sessionLoadFailed).toBe(false);
    expect(read).toHaveBeenCalledTimes(2);
    expect(supabase.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('does not apply a stale read after the authentication state changes', async () => {
    const session = { user: { id: 'already-signed-out' } } as Session;
    let finishRead!: (result: { data: { session: Session }; error: null }) => void;
    vi.mocked(supabase.auth.getSession).mockReturnValueOnce(new Promise(resolve => {
      finishRead = resolve;
    }));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    const listener = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0];
    act(() => { void listener('SIGNED_OUT', null); });
    expect(result.current.loading).toBe(false);

    await act(async () => {
      finishRead({ data: { session }, error: null });
      await listener('INITIAL_SESSION', session);
    });
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.sessionLoadFailed).toBe(false);
  });

  it('starts household loading once when a restored identity mounts under StrictMode', () => {
    const session = { user: { id: 'returning-user' } } as Session;
    const pendingRead = new Promise<never>(() => {});
    vi.mocked(supabase.auth.getSession).mockReturnValueOnce(pendingRead).mockReturnValueOnce(pendingRead);
    const loadHousehold = vi.fn();

    function Household() {
      const { user, loading } = useAuth();
      useEffect(() => {
        if (user && !loading) loadHousehold();
      }, [user, loading]);
      return null;
    }

    function SessionHousehold() {
      const { user } = useAuth();
      return <Household key={user?.id ?? 'signed-out'} />;
    }

    render(<StrictMode><AuthProvider><SessionHousehold /></AuthProvider></StrictMode>);
    const listener = vi.mocked(supabase.auth.onAuthStateChange).mock.lastCall![0];
    act(() => { void listener('SIGNED_IN', session); });
    expect(loadHousehold).toHaveBeenCalledTimes(1);
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

  it('returns the sign-out error from the authentication service', async () => {
    const error = new AuthError('Synthetic sign-out failure', 503);
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.signOut()).resolves.toEqual({ error });
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

  it.each(['#type=signup', '#type=email', '#access_token=abc&type=signup'])(
    'shows recovery for an incomplete verification callback (%s)', async (hash) => {
      window.location.hash = hash;

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.emailVerification?.status).toBe('error');
      expect(supabase.auth.initialize).not.toHaveBeenCalled();
    });

  const callbackHash = '#type=signup&access_token=callback-access&refresh_token=callback-refresh&expires_in=3600&token_type=bearer';
  const verifiedSession = {
    access_token: 'callback-access',
    refresh_token: 'callback-refresh',
    user: { id: 'verified-user' },
  } as Session;

  it('confirms the matching session after the SDK removes the callback hash', async () => {
    window.location.hash = callbackHash;
    vi.mocked(supabase.auth.initialize).mockImplementationOnce(async () => {
      window.location.hash = '';
      return { error: null };
    });
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: verifiedSession }, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(result.current.emailVerification?.status).toBe('verifying');
    await waitFor(() => expect(result.current.emailVerification?.status).toBe('success'));
    expect(result.current.session).toBe(verifiedSession);
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', window.location.pathname);
  });

  it('requires a session that matches the callback instead of accepting an existing session', async () => {
    window.location.hash = callbackHash;
    const cachedSession = { ...verifiedSession, access_token: 'cached-access' };
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: cachedSession }, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.emailVerification?.status).toBe('error'));
    expect(result.current.session).toBe(cachedSession);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('shows recovery when callback initialization failed even if the cached tokens match', async () => {
    window.location.hash = callbackHash;
    vi.mocked(supabase.auth.initialize).mockResolvedValueOnce({ error: new AuthError('Callback was rejected', 401) });
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: verifiedSession }, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.emailVerification?.status).toBe('error');
    expect(result.current.session).toBe(verifiedSession);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('keeps the callback pending if the session read fails and confirms it on retry', async () => {
    window.location.hash = callbackHash;
    vi.mocked(supabase.auth.getSession)
      .mockRejectedValueOnce(new TypeError('Synthetic session read failure'))
      .mockResolvedValueOnce({ data: { session: verifiedSession }, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.sessionLoadFailed).toBe(true));
    expect(result.current.emailVerification?.status).toBe('verifying');

    act(() => result.current.retrySession());
    await waitFor(() => expect(result.current.emailVerification?.status).toBe('success'));
    expect(result.current.sessionLoadFailed).toBe(false);
  });

  it.each(['fragment', 'query'])('rejects a conflicting callback type in the %s', async (source) => {
    window.location.hash = callbackHash;
    if (source === 'fragment') window.location.hash += '&type=recovery';
    else window.location.search = '?type=recovery';
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: verifiedSession }, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.emailVerification?.status).toBe('error');
    expect(supabase.auth.initialize).not.toHaveBeenCalled();
  });

  it('does not show email verification for an ordinary signed-in callback', async () => {
    window.location.hash = callbackHash.replace('type=signup', 'type=magiclink');
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: verifiedSession }, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.emailVerification).toBeNull();
    expect(result.current.session).toBe(verifiedSession);
  });

  it('confirms an accepted matching sign-in event even if reading the session then fails', async () => {
    window.location.hash = callbackHash;
    let rejectRead!: (error: Error) => void;
    const read = vi.mocked(supabase.auth.getSession);
    read.mockReturnValueOnce(new Promise((_, reject) => { rejectRead = reject; }));

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(read).toHaveBeenCalled());
    const listener = vi.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0];
    await act(async () => {
      await listener('SIGNED_IN', verifiedSession);
      rejectRead(new TypeError('Synthetic session read failure'));
    });
    expect(result.current.emailVerification?.status).toBe('success');
    expect(result.current.sessionLoadFailed).toBe(false);
    expect(result.current.session).toBe(verifiedSession);
  });

  it('confirms an accepted callback when Supabase refreshes the startup session before the sign-in event', async () => {
    window.location.hash = callbackHash;
    const rotatedSession = { ...verifiedSession, access_token: 'new-access', refresh_token: 'new-refresh' };
    vi.mocked(supabase.auth.initialize).mockImplementationOnce(async () => {
      window.location.hash = '';
      return { error: null };
    });
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: rotatedSession }, error: null });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.emailVerification?.status).toBe('success'));
    expect(result.current.session).toBe(rotatedSession);
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

  it.each([
    ['#error=access_denied&error_code=otp_expired', true, false],
    ['#type=recovery&error_code=otp_expired', false, true],
    ['#message=type=signup%26access_token=fake', false, false],
  ])('recognizes only the expected callback parameters in %s', async (hash, email, recovery) => {
    window.location.hash = hash;
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.emailVerification !== null).toBe(email);
    expect(result.current.isPasswordReset).toBe(recovery);
    expect(result.current.session).toBeNull();
  });

  it('clears email verification state', async () => {
    window.location.hash = '#access_token=abc&type=signup';

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.emailVerification?.status).toBe('error');

    act(() => {
      result.current.clearEmailVerification();
    });

    expect(result.current.emailVerification).toBeNull();
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
