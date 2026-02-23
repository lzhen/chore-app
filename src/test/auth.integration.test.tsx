import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthForm } from '../components/AuthForm';
import { EmailVerification } from '../components/EmailVerification';
import { PasswordReset } from '../components/PasswordReset';
import { AuthProvider } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import {
  mockSupabaseAuth,
  createMockUser,
  setUrlHash,
  clearUrlHash,
} from './testUtils';

vi.mock('../components/ThemeSelector', () => ({
  ThemeSelector: () => <div data-testid="theme-selector">ThemeSelector</div>,
}));

vi.mock('../components/Logo', () => ({
  Logo: () => <div data-testid="logo">Logo</div>,
}));

const renderAuthForm = () => {
  return render(
    <AuthProvider>
      <AuthForm />
    </AuthProvider>
  );
};

describe('Integration Tests: Full Auth Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearUrlHash();
  });

  describe('Registration Flow', () => {
    it('completes full registration flow: navigate to signup → enter credentials → submit → see confirmation', async () => {
      const user = userEvent.setup();
      mockSupabaseAuth.signUpSuccess();

      renderAuthForm();

      // Step 1: Start on sign in page
      await waitFor(() => {
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      });

      // Step 2: Navigate to sign up
      await user.click(screen.getByText(/don't have an account\? sign up/i));
      expect(screen.getByText('Create an account')).toBeInTheDocument();

      // Step 3: Fill in registration form
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      await user.type(emailInput, 'newuser@example.com');
      await user.type(passwordInput, 'SecurePassword123');

      // Step 4: Submit registration
      await user.click(screen.getByRole('button', { name: /sign up/i }));

      // Step 5: Verify API was called correctly
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'SecurePassword123',
      });

      // Step 6: See confirmation message
      await waitFor(() => {
        expect(screen.getByText(/check your email for a confirmation link/i)).toBeInTheDocument();
      });
    });

    it('handles registration errors gracefully', async () => {
      const user = userEvent.setup();
      mockSupabaseAuth.signUpError('User already registered');

      renderAuthForm();

      await waitFor(() => {
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      });

      await user.click(screen.getByText(/don't have an account\? sign up/i));
      await user.type(screen.getByLabelText(/email/i), 'existing@example.com');
      await user.type(screen.getByLabelText(/password/i), 'Password123');
      await user.click(screen.getByRole('button', { name: /sign up/i }));

      await waitFor(() => {
        expect(screen.getByText('User already registered')).toBeInTheDocument();
      });

      // User can still interact with the form
      expect(screen.getByLabelText(/email/i)).not.toBeDisabled();
    });

    it('allows switching between signup and signin modes', async () => {
      const user = userEvent.setup();

      renderAuthForm();

      await waitFor(() => {
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      });

      // Switch to sign up
      await user.click(screen.getByText(/don't have an account\? sign up/i));
      expect(screen.getByText('Create an account')).toBeInTheDocument();

      // Switch back to sign in
      await user.click(screen.getByText(/already have an account\? sign in/i));
      expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    });
  });

  describe('Login Flow', () => {
    it('completes full login flow: enter credentials → submit → authenticated', async () => {
      const user = userEvent.setup();
      const mockUser = createMockUser({ email: 'user@example.com' });
      mockSupabaseAuth.signInSuccess(mockUser);

      renderAuthForm();

      await waitFor(() => {
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      });

      // Fill in login form
      await user.type(screen.getByLabelText(/email/i), 'user@example.com');
      await user.type(screen.getByLabelText(/password/i), 'MyPassword123');

      // Submit login
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      // Verify API was called
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'MyPassword123',
      });
    });

    it('handles invalid credentials error', async () => {
      const user = userEvent.setup();
      mockSupabaseAuth.signInError('Invalid login credentials');

      renderAuthForm();

      await waitFor(() => {
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/email/i), 'user@example.com');
      await user.type(screen.getByLabelText(/password/i), 'WrongPassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid login credentials')).toBeInTheDocument();
      });
    });

    it('handles account not found error', async () => {
      const user = userEvent.setup();
      mockSupabaseAuth.signInError('No account found with this email');

      renderAuthForm();

      await waitFor(() => {
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/email/i), 'nonexistent@example.com');
      await user.type(screen.getByLabelText(/password/i), 'SomePassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText('No account found with this email')).toBeInTheDocument();
      });
    });
  });

  describe('Password Reset Request Flow', () => {
    it('completes full password reset request: navigate to forgot password → enter email → submit → see confirmation', async () => {
      const user = userEvent.setup();
      mockSupabaseAuth.resetPasswordSuccess();

      renderAuthForm();

      await waitFor(() => {
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      });

      // Step 1: Navigate to forgot password
      await user.click(screen.getByText(/forgot your password\?/i));
      expect(screen.getByText('Reset your password')).toBeInTheDocument();

      // Step 2: Password field should be hidden
      expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();

      // Step 3: Enter email
      await user.type(screen.getByLabelText(/email/i), 'forgot@example.com');

      // Step 4: Submit
      await user.click(screen.getByRole('button', { name: /send reset link/i }));

      // Step 5: Verify API was called
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'forgot@example.com',
        expect.any(Object)
      );

      // Step 6: See confirmation
      await waitFor(() => {
        expect(screen.getByText(/check your email for a password reset link/i)).toBeInTheDocument();
      });
    });

    it('handles password reset errors', async () => {
      const user = userEvent.setup();
      mockSupabaseAuth.resetPasswordError('Too many requests. Please try again later.');

      renderAuthForm();

      await waitFor(() => {
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      });

      await user.click(screen.getByText(/forgot your password\?/i));
      await user.type(screen.getByLabelText(/email/i), 'user@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText('Too many requests. Please try again later.')).toBeInTheDocument();
      });
    });

    it('allows returning to sign in from forgot password', async () => {
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
  });

  describe('Email Verification Flow', () => {
    const mockOnContinue = vi.fn();

    beforeEach(() => {
      mockOnContinue.mockClear();
    });

    it('completes successful email verification flow', async () => {
      const user = userEvent.setup();
      setUrlHash('#access_token=valid-token&type=signup');

      render(<EmailVerification onContinue={mockOnContinue} />);

      // Initially shows verifying state
      expect(screen.getByText('Verifying your email...')).toBeInTheDocument();

      // Then shows success
      await waitFor(() => {
        expect(screen.getByText('Email Verified!')).toBeInTheDocument();
      }, { timeout: 1000 });

      expect(screen.getByText(/your email has been successfully verified/i)).toBeInTheDocument();

      // Click continue
      await user.click(screen.getByRole('button', { name: /continue to sign in/i }));
      expect(mockOnContinue).toHaveBeenCalledTimes(1);
    });

    it('handles expired verification link', async () => {
      const user = userEvent.setup();
      setUrlHash('#error=access_denied&error_description=Email+link+has+expired');

      render(<EmailVerification onContinue={mockOnContinue} />);

      await waitFor(() => {
        expect(screen.getByText('Verification Failed')).toBeInTheDocument();
      }, { timeout: 1000 });

      expect(screen.getByText('Email link has expired')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /back to sign in/i }));
      expect(mockOnContinue).toHaveBeenCalledTimes(1);
    });

    it('handles invalid verification token', async () => {
      setUrlHash('#error=invalid_token&error_description=Invalid+or+expired+token');

      render(<EmailVerification onContinue={mockOnContinue} />);

      await waitFor(() => {
        expect(screen.getByText('Verification Failed')).toBeInTheDocument();
      }, { timeout: 1000 });

      expect(screen.getByText('Invalid or expired token')).toBeInTheDocument();
    });
  });

  describe('Password Reset Completion Flow', () => {
    const mockOnComplete = vi.fn();

    beforeEach(() => {
      mockOnComplete.mockClear();
    });

    it('completes full password reset: enter new password → confirm → submit → success', async () => {
      const user = userEvent.setup();
      mockSupabaseAuth.updateUserSuccess();
      mockSupabaseAuth.signOutSuccess();

      render(<PasswordReset onComplete={mockOnComplete} />);

      // Step 1: See password reset form
      expect(screen.getByText('Reset Your Password')).toBeInTheDocument();

      // Step 2: Enter new password
      await user.type(screen.getByLabelText(/new password/i), 'NewSecurePass123');
      await user.type(screen.getByLabelText(/confirm password/i), 'NewSecurePass123');

      // Step 3: Submit
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      // Step 4: Verify API was called
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'NewSecurePass123',
      });

      // Step 5: See success message
      await waitFor(() => {
        expect(screen.getByText('Password Updated!')).toBeInTheDocument();
      });

      // Step 6: Continue to sign in
      await user.click(screen.getByRole('button', { name: /continue to sign in/i }));

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });

    it('validates password confirmation matches', async () => {
      const user = userEvent.setup();

      render(<PasswordReset onComplete={mockOnComplete} />);

      await user.type(screen.getByLabelText(/new password/i), 'Password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'DifferentPass');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    });

    it('validates minimum password length', async () => {
      const user = userEvent.setup();

      render(<PasswordReset onComplete={mockOnComplete} />);

      await user.type(screen.getByLabelText(/new password/i), '12345');
      await user.type(screen.getByLabelText(/confirm password/i), '12345');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
      expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    });

    it('handles expired reset token', async () => {
      const user = userEvent.setup();
      mockSupabaseAuth.updateUserError('Token has expired or is invalid');

      render(<PasswordReset onComplete={mockOnComplete} />);

      await user.type(screen.getByLabelText(/new password/i), 'NewPassword123');
      await user.type(screen.getByLabelText(/confirm password/i), 'NewPassword123');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText('Token has expired or is invalid')).toBeInTheDocument();
      });
    });

    it('allows canceling password reset', async () => {
      const user = userEvent.setup();
      mockSupabaseAuth.signOutSuccess();

      render(<PasswordReset onComplete={mockOnComplete} />);

      await user.click(screen.getByText(/cancel and return to sign in/i));

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Full User Journey: Registration to Login', () => {
    it('simulates complete journey: register → verify email → login', async () => {
      const user = userEvent.setup();
      const mockUser = createMockUser({ email: 'newuser@example.com' });

      // Phase 1: Registration
      mockSupabaseAuth.signUpSuccess(mockUser);

      const { unmount } = renderAuthForm();

      await waitFor(() => {
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      });

      await user.click(screen.getByText(/don't have an account\? sign up/i));
      await user.type(screen.getByLabelText(/email/i), 'newuser@example.com');
      await user.type(screen.getByLabelText(/password/i), 'SecurePass123');
      await user.click(screen.getByRole('button', { name: /sign up/i }));

      await waitFor(() => {
        expect(screen.getByText(/check your email for a confirmation link/i)).toBeInTheDocument();
      });

      unmount();

      // Phase 2: Email Verification (simulating clicking link in email)
      const mockOnVerificationContinue = vi.fn();
      setUrlHash('#access_token=verification-token&type=signup');

      const { unmount: unmountVerification } = render(
        <EmailVerification onContinue={mockOnVerificationContinue} />
      );

      await waitFor(() => {
        expect(screen.getByText('Email Verified!')).toBeInTheDocument();
      }, { timeout: 1000 });

      await user.click(screen.getByRole('button', { name: /continue to sign in/i }));
      expect(mockOnVerificationContinue).toHaveBeenCalled();

      unmountVerification();
      clearUrlHash();

      // Phase 3: Login with verified account
      mockSupabaseAuth.signInSuccess(mockUser);

      renderAuthForm();

      await waitFor(() => {
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/email/i), 'newuser@example.com');
      await user.type(screen.getByLabelText(/password/i), 'SecurePass123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'SecurePass123',
      });
    });
  });

  describe('Full User Journey: Password Reset', () => {
    it('simulates complete journey: forgot password → reset → login with new password', async () => {
      const user = userEvent.setup();
      const mockUser = createMockUser({ email: 'user@example.com' });

      // Phase 1: Request password reset
      mockSupabaseAuth.resetPasswordSuccess();

      const { unmount } = renderAuthForm();

      await waitFor(() => {
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      });

      await user.click(screen.getByText(/forgot your password\?/i));
      await user.type(screen.getByLabelText(/email/i), 'user@example.com');
      await user.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText(/check your email for a password reset link/i)).toBeInTheDocument();
      });

      unmount();

      // Phase 2: Reset password (simulating clicking link in email)
      const mockOnResetComplete = vi.fn();
      mockSupabaseAuth.updateUserSuccess();
      mockSupabaseAuth.signOutSuccess();

      const { unmount: unmountReset } = render(
        <PasswordReset onComplete={mockOnResetComplete} />
      );

      await user.type(screen.getByLabelText(/new password/i), 'NewSecurePass456');
      await user.type(screen.getByLabelText(/confirm password/i), 'NewSecurePass456');
      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText('Password Updated!')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /continue to sign in/i }));
      expect(mockOnResetComplete).toHaveBeenCalled();

      unmountReset();

      // Phase 3: Login with new password
      mockSupabaseAuth.signInSuccess(mockUser);

      renderAuthForm();

      await waitFor(() => {
        expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/email/i), 'user@example.com');
      await user.type(screen.getByLabelText(/password/i), 'NewSecurePass456');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'NewSecurePass456',
      });
    });
  });
});
