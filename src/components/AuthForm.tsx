import { useState, useRef, useLayoutEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';
import './AuthForm.css';

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

export function AuthForm() {
  const isPreview = (window as Window & {__NESMI_PREVIEW__?: boolean}).__NESMI_PREVIEW__ === true;
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordSelection = useRef<[number|null,number|null]|null>(null);
  useLayoutEffect(()=>{const selection=passwordSelection.current;if(selection&&passwordRef.current){passwordRef.current.setSelectionRange(selection[0],selection[1]);passwordSelection.current=null;}},[showPassword]);
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
      <div className="theme-background" />
      <div className="chore-auth">
        <header className="nesmi-auth-header">
          <div><Logo size="md" /></div>
        </header>
        <main className="nesmi-auth-layout">
          <section className="nesmi-auth-story" aria-labelledby="nesmi-welcome-title">
            <p className="nesmi-eyebrow">A LITTLE LESS TO REMEMBER</p>
            <h1 id="nesmi-welcome-title">Less reminding.<br /><span>More living.</span></h1>
            <p className="nesmi-auth-description">A simple place for chores, routines, and the people who share them.</p>
            <div className="nesmi-example" aria-label="Example household chore list">
              <div className="nesmi-example-heading"><span>One day at a time</span><small>EXAMPLE</small></div>
              <div className="nesmi-example-row"><span className="nesmi-example-check done" aria-hidden="true">✓</span><div><strong>Water the plants</strong><span>Alex · 5 min</span></div><span className="nesmi-example-status">Done</span></div>
              <div className="nesmi-example-row"><span className="nesmi-example-check" aria-hidden="true" /><div><strong>Put away the dishes</strong><span>Jamie · 10 min</span></div><span className="nesmi-example-status">Up next</span></div>
              <p>Clear responsibilities. Small wins. A shared home.</p>
            </div>
          </section>
          <section className="nesmi-auth-form">
          <p className="nesmi-eyebrow">{mode === 'signUp' ? 'MAKE YOURSELF AT HOME' : mode === 'forgotPassword' ? 'LET’S GET YOU BACK IN' : 'WELCOME HOME'}</p>
          <h2 id="nesmi-auth-title">{getTitle()}</h2>
          <p className="nesmi-auth-form-description">{isPreview ? (mode === 'signUp' ? 'Account creation is unavailable in this preview.' : mode === 'forgotPassword' ? 'Password resets are unavailable in this preview.' : 'Return to the sample household.') : mode === 'signUp' ? 'Start with one chore. Build a routine that works for you.' : mode === 'forgotPassword' ? 'We’ll email you a link to reset your password.' : 'Your household, all in one place.'}</p>

          {isPreview&&<p className="chore-notice" role="note">Preview only. Use preview@example.test and a sample password (6+ characters), not your real password. No real accounts or emails.</p>}
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
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete={isPreview?'off':'email'}
                className="fluent-input w-full"
                placeholder="you@example.com"
                required
              />
            </div>

            {mode !== 'forgotPassword' && (
              <div>
                <label htmlFor="password" className="fluent-label block text-sm font-medium text-content-primary mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete={isPreview || mode === 'signUp' ? 'new-password' : 'current-password'}
                    className="fluent-input w-full pr-16"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onPointerDown={event=>event.preventDefault()}
                    onClick={() => {passwordSelection.current=[passwordRef.current?.selectionStart??null,passwordRef.current?.selectionEnd??null];setShowPassword((visible) => !visible);}}
                    className="absolute inset-y-0 right-0 w-11 min-h-11 flex items-center justify-center text-content-secondary hover:text-brand"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-controls="password"
                  >
                    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{showPassword&&<path d="m3 3 18 18"/>}</svg>
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="chore-error nesmi-auth-message">
                <span role="alert">{error}</span>
              </div>
            )}

            {message && (
              <div className="nesmi-auth-message is-success">
                <span role="status">{message}</span>
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
            <div className="mt-3 text-center">
              <button
                onClick={() => switchMode('forgotPassword')}
                className="nesmi-auth-text-action"
              >
                Forgot your password?
              </button>
            </div>
          )}

          <div className="mt-4 text-center">
            {mode === 'forgotPassword' ? (
              <button
                onClick={() => switchMode('signIn')}
                className="nesmi-auth-text-action"
              >
                Back to sign in
              </button>
            ) : (
              <button
                onClick={() => switchMode(mode === 'signUp' ? 'signIn' : 'signUp')}
                className="nesmi-auth-text-action"
              >
                {mode === 'signUp'
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
              </button>
            )}
          </div>
          <p className="nesmi-auth-privacy">
            Your household data stays tied to your account.{' '}
            <a href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer" className="text-brand hover:underline">Privacy Policy</a>
          </p>
          </section>
        </main>
        <footer className="nesmi-auth-footer"><span>Nesmi · A little more together.</span><span>Made by Empathie</span></footer>
      </div>
    </>
  );
}

