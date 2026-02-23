import { useState } from 'react';
import { Logo } from './Logo';
import { ThemeSelector } from './ThemeSelector';
import { supabase } from '../utils/supabase';

type ResetStatus = 'input' | 'loading' | 'success' | 'error';

interface PasswordResetProps {
  onComplete: () => void;
}

export function PasswordReset({ onComplete }: PasswordResetProps) {
  const [status, setStatus] = useState<ResetStatus>('input');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }

    setStatus('loading');

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMessage(error.message);
      setStatus('error');
    } else {
      setStatus('success');
    }
  };

  const handleContinue = async () => {
    await supabase.auth.signOut();
    window.history.replaceState(null, '', window.location.pathname);
    onComplete();
  };

  return (
    <>
      <div className="theme-background" />
      <div className="min-h-screen flex items-center justify-center relative px-4 py-8">
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
          <ThemeSelector />
        </div>
        <div className="fluent-card p-6 sm:p-8 w-full max-w-md animate-fluent-appear">
          <div className="flex justify-center mb-6">
            <Logo size="lg" showText={true} />
          </div>

          {status === 'success' ? (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
              <h2 className="text-xl font-semibold text-content-primary mb-2">
                Password Updated!
              </h2>
              <p className="text-content-secondary text-sm mb-6">
                Your password has been successfully reset. You can now sign in with your new password.
              </p>
              <button
                onClick={handleContinue}
                className="fluent-button w-full py-2.5"
              >
                Continue to Sign In
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-content-primary text-center mb-2">
                Reset Your Password
              </h2>
              <p className="text-content-secondary text-sm text-center mb-6">
                Enter your new password below.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="fluent-label block text-sm font-medium text-content-primary mb-1">
                    New Password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="fluent-input w-full"
                    required
                    minLength={6}
                    placeholder="Enter new password"
                    disabled={status === 'loading'}
                  />
                </div>

                <div>
                  <label htmlFor="confirm-password" className="fluent-label block text-sm font-medium text-content-primary mb-1">
                    Confirm Password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="fluent-input w-full"
                    required
                    minLength={6}
                    placeholder="Confirm new password"
                    disabled={status === 'loading'}
                  />
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-fluent-sm text-red-500 text-sm">
                    {errorMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="fluent-button w-full py-2.5"
                >
                  {status === 'loading' ? 'Updating...' : 'Reset Password'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button
                  onClick={handleContinue}
                  className="text-content-secondary hover:text-brand text-sm transition-colors duration-fast"
                  disabled={status === 'loading'}
                >
                  Cancel and return to sign in
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
