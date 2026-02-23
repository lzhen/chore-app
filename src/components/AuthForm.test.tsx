import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
});
