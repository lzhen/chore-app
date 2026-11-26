import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthApiError } from '@supabase/supabase-js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthForm } from './AuthForm';
import { AuthProvider } from '../context/AuthContext';
import { supabase } from '../utils/supabase';

vi.mock('./ThemeSelector', () => ({
  ThemeSelector: () => <div data-testid="theme-selector">ThemeSelector</div>,
}));

vi.mock('./Logo', () => ({
  Logo: () => <div data-testid="logo">Logo</div>,
}));

const renderAuthForm = () => {
  return render(
    <AuthProvider>
      <AuthForm />
    </AuthProvider>
  );
};

describe('AuthForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sign in form by default', async () => {
    renderAuthForm();

    await waitFor(() => {
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('switches to sign up mode when clicking sign up link', async () => {
    const user = userEvent.setup();
    renderAuthForm();

    await waitFor(() => {
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/don't have an account\? sign up/i));

    expect(screen.getByText('Create an account')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });

  it('switches to forgot password mode when clicking forgot password link', async () => {
    const user = userEvent.setup();
    renderAuthForm();

    await waitFor(() => {
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/forgot your password\?/i));

    expect(screen.getByText('Reset your password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it('returns to sign in mode from forgot password mode', async () => {
    const user = userEvent.setup();
    renderAuthForm();

    await waitFor(() => {
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/forgot your password\?/i));
    expect(screen.getByText('Reset your password')).toBeInTheDocument();

    await user.click(screen.getByText(/back to sign in/i));
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
  });

  it('calls signIn on form submission in sign in mode', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    } as any);

    const user = userEvent.setup();
    renderAuthForm();

    await waitFor(() => {
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('calls signUp on form submission in sign up mode', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    const user = userEvent.setup();
    renderAuthForm();

    await waitFor(() => {
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/don't have an account\? sign up/i));
    await user.type(screen.getByLabelText(/email/i), 'newuser@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'password123',
      });
    });
  });

  it('shows success message on successful sign up', async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    const user = userEvent.setup();
    renderAuthForm();

    await waitFor(() => {
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/don't have an account\? sign up/i));
    await user.type(screen.getByLabelText(/email/i), 'newuser@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email for a confirmation link/i)).toBeInTheDocument();
    });
  });

  it('calls resetPassword on form submission in forgot password mode', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: {},
      error: null,
    });

    const user = userEvent.setup();
    renderAuthForm();

    await waitFor(() => {
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/forgot your password\?/i));
    await user.type(screen.getByLabelText(/email/i), 'forgot@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'forgot@example.com',
        expect.any(Object)
      );
    });
  });

  it('shows success message on successful password reset request', async () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: {},
      error: null,
    });

    const user = userEvent.setup();
    renderAuthForm();

    await waitFor(() => {
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/forgot your password\?/i));
    await user.type(screen.getByLabelText(/email/i), 'forgot@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email for a password reset link/i)).toBeInTheDocument();
    });
  });

  it('displays error message on sign in failure', async () => {
    const mockError = new Error('Invalid credentials');
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: mockError as any,
    });

    const user = userEvent.setup();
    renderAuthForm();

    await waitFor(() => {
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('clears errors when switching modes', async () => {
    const mockError = new Error('Invalid credentials');
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: mockError as any,
    });

    const user = userEvent.setup();
    renderAuthForm();

    await waitFor(() => {
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });

    await user.click(screen.getByText(/don't have an account\? sign up/i));

    expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument();
  });

  it.each([
    { mode: 'sign in', submit: 'Sign In', request: 'signInWithPassword' },
    { mode: 'sign up', submit: 'Sign Up', request: 'signUp', switchTo: /don't have an account/i, success: /confirmation link/i },
    { mode: 'reset link', submit: 'Send Reset Link', request: 'resetPasswordForEmail', switchTo: /forgot your password/i, success: /password reset link/i },
  ] as const)('keeps a $mode draft retryable after a rejected request', async ({ mode, submit, request, ...details }) => {
    const authRequest = vi.mocked(supabase.auth[request]);
    authRequest
      .mockRejectedValueOnce(new Error('Synthetic storage lock error'))
      .mockResolvedValueOnce({ data: { user: null, session: null }, error: null });

    const user = userEvent.setup();
    renderAuthForm();
    if (details.switchTo) {
      await user.click(screen.getByRole('button', { name: details.switchTo }));
    }
    await user.type(screen.getByLabelText('Email'), 'Test@Example.com');
    if (mode !== 'reset link') {
      await user.type(screen.getByLabelText('Password'), 'synthetic-password');
    }

    await user.click(screen.getByRole('button', { name: submit }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm the request. Please try again.');
    expect(screen.getByLabelText('Email')).toHaveValue('Test@Example.com');
    if (mode !== 'reset link') {
      expect(screen.getByLabelText('Password')).toHaveValue('synthetic-password');
    }
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: submit })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: submit }));
    await waitFor(() => expect(screen.getByRole('button', { name: submit })).toBeEnabled());
    expect(authRequest).toHaveBeenCalledTimes(2);
    expect(authRequest.mock.calls[1]).toEqual(authRequest.mock.calls[0]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    if (details.success) {
      expect(screen.getByRole('status')).toHaveTextContent(details.success);
    }
  });

  it('keeps one request in flight and the submitting mode active until it settles', async () => {
    const signIn = vi.mocked(supabase.auth.signInWithPassword);
    let finish!: () => void;
    const pending = new Promise<Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>>(resolve => {
      finish = () => resolve({
        data: { user: null, session: null },
        error: new AuthApiError('Try again shortly', 503, 'unexpected_failure'),
      });
    });
    signIn.mockReturnValue(pending);

    const user = userEvent.setup();
    renderAuthForm();
    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'synthetic-password');
    const form = screen.getByRole('button', { name: 'Sign In' }).closest('form')!;
    const forgot = screen.getByRole('button', { name: 'Forgot your password?' });
    const signUp = screen.getByRole('button', { name: /don't have an account/i });

    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
      fireEvent.click(forgot);
    });

    expect(signIn).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
    expect(forgot).toBeDisabled();
    expect(signUp).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled();

    await act(async () => { finish(); });
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Try again shortly');
    await user.click(forgot);
    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
