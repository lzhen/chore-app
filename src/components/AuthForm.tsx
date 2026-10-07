import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeSelector } from './ThemeSelector';
import { Logo } from './Logo';
import './AuthForm.css';

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

export function AuthForm() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (mode === 'forgotPassword') {
      const { error } = await resetPassword(email.trim().toLowerCase());
      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email for a password reset link!');
      }
    } else if (mode === 'signUp') {
      const { error } = await signUp(email.trim().toLowerCase(), password);
      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email for a confirmation link!');
      }
    } else {
      const { error } = await signIn(email.trim().toLowerCase(), password);
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
      <div className="theme-background" aria-hidden="true" />
      <main className="chore-auth">
        <div className="chore-auth-tools">
          <ThemeSelector compact />
        </div>
        <div className="chore-auth-content">
          <div className="chore-auth-brand">
            <span aria-hidden="true"><Logo size="md" showText={false} /></span>
            <span className="chore-wordmark">Chorely</span>
          </div>

          <div className="chore-auth-intro">
            <p className="chore-eyebrow">EVERYDAY LIFE, SHARED</p>
            <h1>A lighter day,<br />together.</h1>
            <p>See what needs doing. Share the responsibility.</p>
          </div>
          <h2 className="chore-auth-mode">{getTitle()}</h2>

          <form onSubmit={handleSubmit} className="chore-auth-form">
            <div>
              <label htmlFor="email" className="chore-auth-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="email"
                className="fluent-input w-full"
                required
              />
            </div>

            {mode !== 'forgotPassword' && (
              <div>
                <label htmlFor="password" className="chore-auth-label">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                    className="fluent-input w-full pr-16"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute inset-y-0 right-0 px-3 text-xs text-content-secondary hover:text-brand"
                    aria-label={showPassword ? 'Conceal' : 'Reveal'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="chore-auth-feedback is-error" role="alert">
                {error}
              </div>
            )}

            {message && (
              <div className="chore-auth-feedback is-success" role="status">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="chore-button primary w-full"
            >
              {getButtonText()}
            </button>
          </form>

          {mode === 'signIn' && (
            <div className="chore-auth-recovery">
              <button
                onClick={() => switchMode('forgotPassword')}
                className="chore-auth-link"
              >
                Forgot your password?
              </button>
            </div>
          )}

          <div className="chore-auth-switch">
            {mode === 'forgotPassword' ? (
              <button
                onClick={() => switchMode('signIn')}
                className="chore-auth-link"
              >
                Back to sign in
              </button>
            ) : (
              <button
                onClick={() => switchMode(mode === 'signUp' ? 'signIn' : 'signUp')}
                className="chore-auth-link"
              >
                {mode === 'signUp'
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
              </button>
            )}
          </div>
          <p className="chore-auth-policy">
            Your household data stays tied to your account. By continuing, you agree to Chorely's policies.{' '}
            <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer" className="chore-auth-link">Privacy Policy</a>
          </p>
        </div>
      </main>
    </>
  );
}
