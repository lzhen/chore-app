import { act, render, screen, waitFor } from '@testing-library/react';
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
