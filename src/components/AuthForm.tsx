import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeSelector } from './ThemeSelector';
import { Logo } from './Logo';

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

export function AuthForm() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (mode === 'forgotPassword') {
      const { error } = await resetPassword(email);
      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email for a password reset link!');
      }
    } else if (mode === 'signUp') {
      const { error } = await signUp(email, password);
      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email for a confirmation link!');
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      }
    }

    setLoading(false);
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setMessage(null);
  };

  const getTitle = () => {
    switch (mode) {
      case 'signUp':
        return 'Create an account';
      case 'forgotPassword':
        return 'Reset your password';
      default:
        return 'Sign in to your account';
    }
  };

  const getButtonText = () => {
    if (loading) return 'Loading...';
    switch (mode) {
      case 'signUp':
        return 'Sign Up';
      case 'forgotPassword':
        return 'Send Reset Link';
      default:
        return 'Sign In';
    }
  };

  return (
    <>
      <div className="theme-background" />
      <div className="min-h-screen flex items-center justify-center relative px-4 py-8">
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
          <ThemeSelector />
        </div>
        <div className="fluent-card p-6 sm:p-8 w-full max-w-md animate-fluent-appear">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Logo size="lg" showText={true} />
          </div>

          <p className="text-center text-content-secondary mb-4 sm:mb-6 text-sm sm:text-base">
            {getTitle()}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="fluent-label block text-sm font-medium text-content-primary mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="fluent-input w-full"
                required
              />
            </div>

            {mode !== 'forgotPassword' && (
              <div>
                <label htmlFor="password" className="fluent-label block text-sm font-medium text-content-primary mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="fluent-input w-full"
                  required
                  minLength={6}
                />
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-fluent-sm text-red-500 text-sm">
                {error}
              </div>
            )}

            {message && (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-fluent-sm text-green-500 text-sm">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="fluent-button w-full py-2.5"
            >
              {getButtonText()}
            </button>
          </form>

          {mode === 'signIn' && (
            <div className="mt-3 text-center">
              <button
                onClick={() => switchMode('forgotPassword')}
                className="text-content-secondary hover:text-brand text-sm transition-colors duration-fast"
              >
                Forgot your password?
              </button>
            </div>
          )}

          <div className="mt-4 text-center">
            {mode === 'forgotPassword' ? (
              <button
                onClick={() => switchMode('signIn')}
                className="text-brand hover:underline text-sm transition-colors duration-fast"
              >
                Back to sign in
              </button>
            ) : (
              <button
                onClick={() => switchMode(mode === 'signUp' ? 'signIn' : 'signUp')}
                className="text-brand hover:underline text-sm transition-colors duration-fast"
              >
                {mode === 'signUp'
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
