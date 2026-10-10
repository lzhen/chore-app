import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthForm } from './AuthForm';

const authStyles = readFileSync('src/components/AuthForm.css', 'utf8');

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    signIn: vi.fn(async () => ({ error: null })),
    signUp: vi.fn(async () => ({ error: null })),
    resetPassword: vi.fn(async () => ({ error: null })),
  }),
}));
vi.mock('./ThemeSelector', () => ({ ThemeSelector: () => null }));
vi.mock('./Logo', () => ({ Logo: () => <span>Nesmi</span> }));

afterEach(()=>{cleanup();delete (window as Window & {__NESMI_PREVIEW__?:boolean}).__NESMI_PREVIEW__;});

describe('AUTH-01 presentation regression', () => {
  it.each([
    { switchLabel: null, submitLabel: 'Sign In' },
    { switchLabel: "Don't have an account? Sign up", submitLabel: 'Sign Up' },
    { switchLabel: 'Forgot your password?', submitLabel: 'Send Reset Link' },
  ])('uses the primary action in $submitLabel mode', async ({ switchLabel, submitLabel }) => {
    const user = userEvent.setup();
    render(<AuthForm />);
    if (switchLabel) await user.click(screen.getByRole('button', { name: switchLabel }));
    const submit = screen.getByRole('button', { name: submitLabel });
    expect(submit).toHaveClass('chore-button', 'primary', 'w-full');
    expect(submit.closest('.chore-auth')).not.toBeNull();
    expect(screen.getByLabelText('Email').closest('.chore-auth')).not.toBeNull();
  });

  it('uses accessible eye icons and preserves password value, focus and cursor',async()=>{
    const user=userEvent.setup();render(<AuthForm/>);
    const input=screen.getByLabelText('Password') as HTMLInputElement;
    await user.type(input,'sample-password');input.setSelectionRange(3,7);
    const show=screen.getByRole('button',{name:'Show password'});
    expect(show.querySelector('svg')).toHaveAttribute('aria-hidden','true');expect(show).not.toHaveTextContent('Show');
    await user.click(show);expect(input).toHaveAttribute('type','text');expect(input).toHaveValue('sample-password');expect(input).toHaveFocus();expect(input.selectionStart).toBe(3);expect(input.selectionEnd).toBe(7);
    await user.click(screen.getByRole('button',{name:'Hide password'}));expect(input).toHaveAttribute('type','password');expect(input).toHaveValue('sample-password');
  });
  it('has no appearance control on sign-in, reset or verification screens',()=>{
    for(const name of ['AuthForm','PasswordReset','EmailVerification'])expect(readFileSync(`src/components/${name}.tsx`,'utf8')).not.toContain('ThemeSelector');
    expect(readFileSync('src/components/AccountSettings.tsx','utf8')).toContain('<ThemeSelector />');
  });

  it('labels fixture sign-in clearly and makes no real-account or email promise',async()=>{
    (window as Window & {__NESMI_PREVIEW__?:boolean}).__NESMI_PREVIEW__=true;
    const user=userEvent.setup();render(<AuthForm/>);
    expect(screen.getByRole('note')).toHaveTextContent('not your real password');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete','new-password');
    await user.click(screen.getByRole('button',{name:'Forgot your password?'}));
    expect(screen.getByText('Password resets are unavailable in this preview.')).toBeVisible();
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
