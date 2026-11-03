import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { AuthForm } from './AuthForm';
import { supabase } from '../utils/supabase';

beforeEach(() => { localStorage.clear(); vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({ data: { user: null, session: null }, error: null }); });
it('offers email link without requiring a password and preserves password login', async () => {
  render(<AuthProvider><AuthForm /></AuthProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with an email link' }));
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Email me a sign-in link' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('existing account'));
  expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ shouldCreateUser: false }) }));
  fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
  expect(screen.getByLabelText('Password')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Sign In$/ })).toBeEnabled();
});
