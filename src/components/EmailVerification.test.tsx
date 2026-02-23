import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailVerification } from './EmailVerification';

vi.mock('./Logo', () => ({
  Logo: () => <div data-testid="logo">Logo</div>,
}));

vi.mock('./ThemeSelector', () => ({
  ThemeSelector: () => <div data-testid="theme-selector">ThemeSelector</div>,
}));

describe('EmailVerification', () => {
  const mockOnContinue = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
  });

  it('shows verifying state initially', () => {
    render(<EmailVerification onContinue={mockOnContinue} />);

    expect(screen.getByText('Verifying your email...')).toBeInTheDocument();
    expect(screen.getByText('Please wait while we confirm your email address.')).toBeInTheDocument();
  });

  it('shows success state when access_token is in hash', async () => {
    window.location.hash = '#access_token=abc123&type=signup';

    render(<EmailVerification onContinue={mockOnContinue} />);

    await waitFor(() => {
      expect(screen.getByText('Email Verified!')).toBeInTheDocument();
    }, { timeout: 1000 });

    expect(screen.getByText(/your email has been successfully verified/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue to sign in/i })).toBeInTheDocument();
  });

  it('shows success state when no error in hash', async () => {
    window.location.hash = '';

    render(<EmailVerification onContinue={mockOnContinue} />);

    await waitFor(() => {
      expect(screen.getByText('Email Verified!')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('shows error state when error is in hash', async () => {
    window.location.hash = '#error=access_denied&error_description=Email+link+has+expired';

    render(<EmailVerification onContinue={mockOnContinue} />);

    await waitFor(() => {
      expect(screen.getByText('Verification Failed')).toBeInTheDocument();
    }, { timeout: 1000 });

    expect(screen.getByText(/we couldn't verify your email address/i)).toBeInTheDocument();
    expect(screen.getByText('Email link has expired')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to sign in/i })).toBeInTheDocument();
  });

  it('calls onContinue when clicking continue button on success', async () => {
    const user = userEvent.setup();
    window.location.hash = '#access_token=abc123';

    render(<EmailVerification onContinue={mockOnContinue} />);

    await waitFor(() => {
      expect(screen.getByText('Email Verified!')).toBeInTheDocument();
    }, { timeout: 1000 });

    await user.click(screen.getByRole('button', { name: /continue to sign in/i }));

    expect(mockOnContinue).toHaveBeenCalledTimes(1);
  });

  it('calls onContinue when clicking back button on error', async () => {
    const user = userEvent.setup();
    window.location.hash = '#error=access_denied';

    render(<EmailVerification onContinue={mockOnContinue} />);

    await waitFor(() => {
      expect(screen.getByText('Verification Failed')).toBeInTheDocument();
    }, { timeout: 1000 });

    await user.click(screen.getByRole('button', { name: /back to sign in/i }));

    expect(mockOnContinue).toHaveBeenCalledTimes(1);
  });

  it('clears URL hash on success', async () => {
    window.location.hash = '#access_token=abc123';

    render(<EmailVerification onContinue={mockOnContinue} />);

    await waitFor(() => {
      expect(screen.getByText('Email Verified!')).toBeInTheDocument();
    }, { timeout: 1000 });

    expect(window.history.replaceState).toHaveBeenCalled();
  });

  it('renders logo and theme selector', () => {
    render(<EmailVerification onContinue={mockOnContinue} />);

    expect(screen.getByTestId('logo')).toBeInTheDocument();
    expect(screen.getByTestId('theme-selector')).toBeInTheDocument();
  });
});
