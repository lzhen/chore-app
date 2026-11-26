import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { EmailVerification } from './EmailVerification';

vi.mock('./Logo', () => ({
  Logo: () => <div data-testid="logo">Logo</div>,
}));

vi.mock('./ThemeSelector', () => ({
  ThemeSelector: () => <div data-testid="theme-selector">ThemeSelector</div>,
}));

describe('EmailVerification', () => {
  it('shows verifying state while verification is pending', () => {
    render(<EmailVerification verification={{ status: 'verifying' }} onContinue={vi.fn()} />);

    expect(screen.getByText('Verifying your email...')).toBeInTheDocument();
    expect(screen.getByText('Please wait while we confirm your email address.')).toBeInTheDocument();
    expect(screen.getByTestId('logo')).toBeInTheDocument();
    expect(screen.getByTestId('theme-selector')).toBeInTheDocument();
  });

  it('shows confirmed verification and lets the user continue', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<EmailVerification verification={{ status: 'success' }} onContinue={onContinue} />);

    expect(screen.getByText('Email Verified!')).toBeInTheDocument();
    expect(screen.getByText(/your email has been successfully verified/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('shows the callback error and lets the user leave the verification screen', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<EmailVerification verification={{ status: 'error', message: 'Email link has expired' }} onContinue={onContinue} />);

    expect(screen.getByText('Verification Failed')).toBeInTheDocument();
    expect(screen.getByText(/we couldn't use this email link/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Email link has expired');
    await user.click(screen.getByRole('button', { name: /back to sign in/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
