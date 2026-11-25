import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PasswordReset } from './PasswordReset';
import { supabase } from '../utils/supabase';

vi.mock('./Logo', () => ({
  Logo: () => <div data-testid="logo">Logo</div>,
}));

vi.mock('./ThemeSelector', () => ({
  ThemeSelector: () => <div data-testid="theme-selector">ThemeSelector</div>,
}));

describe('PasswordReset', () => {
  const mockOnComplete = vi.fn();
  const updatedUser = {
    id: 'synthetic-user',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders password reset form', () => {
    render(<PasswordReset onComplete={mockOnComplete} />);

    expect(screen.getByText('Reset Your Password')).toBeInTheDocument();
    expect(screen.getByText('Enter your new password below.')).toBeInTheDocument();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup();
    render(<PasswordReset onComplete={mockOnComplete} />);

    await user.type(screen.getByLabelText(/new password/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'differentpassword');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it('shows error when password is too short', async () => {
    const user = userEvent.setup();
    render(<PasswordReset onComplete={mockOnComplete} />);

    await user.type(screen.getByLabelText(/new password/i), '12345');
    await user.type(screen.getByLabelText(/confirm password/i), '12345');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it('calls updateUser when passwords match and are valid', async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: null,
    } as any);

    const user = userEvent.setup();
    render(<PasswordReset onComplete={mockOnComplete} />);

    await user.type(screen.getByLabelText(/new password/i), 'newpassword123');
    await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'newpassword123',
      });
    });
  });

  it('shows success message after password update', async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: null,
    } as any);

    const user = userEvent.setup();
    render(<PasswordReset onComplete={mockOnComplete} />);

    await user.type(screen.getByLabelText(/new password/i), 'newpassword123');
    await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText('Password Updated!')).toBeInTheDocument();
    });

    expect(screen.getByText(/your password has been successfully reset/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue to sign in/i })).toBeInTheDocument();
  });

  it('shows error message on update failure', async () => {
    const mockError = new Error('Token expired');
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: mockError as any,
    });

    const user = userEvent.setup();
    render(<PasswordReset onComplete={mockOnComplete} />);

    await user.type(screen.getByLabelText(/new password/i), 'newpassword123');
    await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText('Token expired')).toBeInTheDocument();
    });
  });

  it('keeps both password fields editable and allows retry after a rejected update request', async () => {
    vi.mocked(supabase.auth.updateUser)
      .mockRejectedValueOnce(new Error('Synthetic client exception'))
      .mockResolvedValueOnce({ data: { user: updatedUser }, error: null });

    const user = userEvent.setup();
    render(<PasswordReset onComplete={mockOnComplete} />);
    const password = screen.getByLabelText(/new password/i);
    const confirmation = screen.getByLabelText(/confirm password/i);
    const reset = screen.getByRole('button', { name: 'Reset Password' });
    const cancel = screen.getByRole('button', { name: 'Cancel and return to sign in' });
    await user.type(password, 'synthetic-password');
    await user.type(confirmation, 'synthetic-password');
    await user.click(reset);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm the password update. Please try again.');
    expect(password).toHaveValue('synthetic-password');
    expect(confirmation).toHaveValue('synthetic-password');
    expect(password).toBeEnabled();
    expect(confirmation).toBeEnabled();
    expect(reset).toBeEnabled();
    expect(cancel).toBeEnabled();
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    expect(mockOnComplete).not.toHaveBeenCalled();

    await user.click(reset);
    expect(await screen.findByRole('heading', { name: 'Password Updated!' })).toBeVisible();
    expect(supabase.auth.updateUser).toHaveBeenCalledTimes(2);
    expect(supabase.auth.updateUser).toHaveBeenLastCalledWith({ password: 'synthetic-password' });
  });

  it('accepts only the first recovery action while a password update is pending', async () => {
    let finishUpdate!: () => void;
    vi.mocked(supabase.auth.updateUser)
      .mockImplementation(() => new Promise(resolve => {
        finishUpdate = () => resolve({ data: { user: updatedUser }, error: null });
      }));

    const user = userEvent.setup();
    render(<PasswordReset onComplete={mockOnComplete} />);
    await user.type(screen.getByLabelText(/new password/i), 'synthetic-password');
    await user.type(screen.getByLabelText(/confirm password/i), 'synthetic-password');
    const form = screen.getByRole('button', { name: 'Reset Password' }).closest('form')!;
    const cancel = screen.getByRole('button', { name: 'Cancel and return to sign in' });
    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
      fireEvent.click(cancel);
    });

    expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    expect(cancel).toBeDisabled();

    await act(async () => { finishUpdate(); });
    expect(screen.getByRole('heading', { name: 'Password Updated!' })).toBeVisible();
  });

  it('signs out and calls onComplete when clicking continue after success', async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: null,
    } as any);
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

    const user = userEvent.setup();
    render(<PasswordReset onComplete={mockOnComplete} />);

    await user.type(screen.getByLabelText(/new password/i), 'newpassword123');
    await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(screen.getByText('Password Updated!')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /continue to sign in/i }));

    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalled();
    });
    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });

  it('calls onComplete when clicking cancel link', async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

    const user = userEvent.setup();
    render(<PasswordReset onComplete={mockOnComplete} />);

    await user.click(screen.getByText(/cancel and return to sign in/i));

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps the recovery form and URL when cancelling fails, then exits after a retry', async () => {
    vi.mocked(supabase.auth.signOut)
      .mockResolvedValueOnce({ error: new Error('Synthetic transport failure') as any })
      .mockResolvedValueOnce({ error: null });
    window.location.hash = '#type=recovery';

    const user = userEvent.setup();
    render(<PasswordReset onComplete={mockOnComplete} />);
    await user.type(screen.getByLabelText(/new password/i), 'unfinished-entry');
    const cancel = screen.getByRole('button', { name: 'Cancel and return to sign in' });
    await user.click(cancel);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out. Please try again.');
    expect(screen.getByLabelText(/new password/i)).toHaveValue('unfinished-entry');
    expect(window.location.hash).toBe('#type=recovery');
    expect(window.history.replaceState).not.toHaveBeenCalled();
    expect(mockOnComplete).not.toHaveBeenCalled();

    await user.click(cancel);
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/chore-app/');
    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });

  it('keeps the password-updated confirmation when signing out fails, then retries just sign-out', async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: null,
    } as any);
    vi.mocked(supabase.auth.signOut)
      .mockResolvedValueOnce({ error: new Error('Synthetic transport failure') as any })
      .mockResolvedValueOnce({ error: null });
    window.location.hash = '#type=recovery';

    const user = userEvent.setup();
    render(<PasswordReset onComplete={mockOnComplete} />);
    await user.type(screen.getByLabelText(/new password/i), 'new-password');
    await user.type(screen.getByLabelText(/confirm password/i), 'new-password');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));
    const continueButton = await screen.findByRole('button', { name: 'Continue to Sign In' });
    await user.click(continueButton);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out. Please try again.');
    expect(screen.getByRole('heading', { name: 'Password Updated!' })).toBeVisible();
    expect(window.history.replaceState).not.toHaveBeenCalled();
    expect(mockOnComplete).not.toHaveBeenCalled();

    await user.click(continueButton);
    expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1);
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(2);
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', '/chore-app/');
    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });

  it('blocks duplicate exits while signing out and recovers from a rejected request', async () => {
    let rejectSignOut!: (error: Error) => void;
    vi.mocked(supabase.auth.signOut)
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectSignOut = reject; }))
      .mockResolvedValueOnce({ error: null });

    const user = userEvent.setup();
    render(<PasswordReset onComplete={mockOnComplete} />);
    const cancel = screen.getByRole('button', { name: 'Cancel and return to sign in' });
    await user.dblClick(cancel);

    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Signing out…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset Password' })).toBeDisabled();

    await act(async () => {
      rejectSignOut(new Error('Synthetic rejected request'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not sign out. Please try again.');
    expect(window.history.replaceState).not.toHaveBeenCalled();
    expect(mockOnComplete).not.toHaveBeenCalled();

    await user.click(cancel);
    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });

  it('disables form inputs while loading', async () => {
    vi.mocked(supabase.auth.updateUser).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: { user: null }, error: null } as any), 1000))
    );

    const user = userEvent.setup();
    render(<PasswordReset onComplete={mockOnComplete} />);

    await user.type(screen.getByLabelText(/new password/i), 'newpassword123');
    await user.type(screen.getByLabelText(/confirm password/i), 'newpassword123');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(screen.getByRole('button', { name: /updating/i })).toBeDisabled();
    expect(screen.getByLabelText(/new password/i)).toBeDisabled();
    expect(screen.getByLabelText(/confirm password/i)).toBeDisabled();
  });

  it('renders logo and theme selector', () => {
    render(<PasswordReset onComplete={mockOnComplete} />);

    expect(screen.getByTestId('logo')).toBeInTheDocument();
    expect(screen.getByTestId('theme-selector')).toBeInTheDocument();
  });
});
