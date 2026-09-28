import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthForm } from './AuthForm';
import authStyles from './AuthForm.css?raw';

// Presentation regression only: no real account or backend request is used.
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    signIn: vi.fn(async () => ({ error: null })),
    signUp: vi.fn(async () => ({ error: null })),
    resetPassword: vi.fn(async () => ({ error: null })),
  }),
}));
vi.mock('./ThemeSelector', () => ({ ThemeSelector: () => null }));
vi.mock('./Logo', () => ({ Logo: () => <span>Chorely</span> }));

afterEach(cleanup);

describe('AUTH-01 presentation regression', () => {
  it.each([
    { switchLabel: null, submitLabel: 'Sign In' },
    { switchLabel: "Don't have an account? Sign up", submitLabel: 'Sign Up' },
    { switchLabel: 'Forgot your password?', submitLabel: 'Send Reset Link' },
  ])('uses the primary action in $submitLabel mode', async ({ switchLabel, submitLabel }) => {
    const user = userEvent.setup();
    render(<AuthForm />);
    if (switchLabel) {
      await user.click(screen.getByRole('button', { name: switchLabel, exact: true }));
    }
    const submit = screen.getByRole('button', { name: submitLabel, exact: true });
    expect(submit).toHaveClass('chore-button', 'primary', 'w-full');
    expect(submit.closest('.chore-auth')).not.toBeNull();
    expect(screen.getByLabelText('Email').closest('.chore-auth')).not.toBeNull();
  });

  it('scopes the 16px minimum to authentication inputs and allows larger text', () => {
    expect(authStyles).toContain('.chore-auth .fluent-input');
    expect(authStyles).toMatch(/font-size:\s*max\(16px,\s*1rem\)/);
    expect(authStyles).toMatch(/min-height:\s*48px/);
  });

  it('does not use zoom suppression as a workaround', () => {
    expect(authStyles).not.toMatch(/user-scalable\s*=\s*no|maximum-scale|zoom\s*:|touch-action\s*:\s*none/);
  });
});
