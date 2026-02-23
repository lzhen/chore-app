import { ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { AuthProvider } from '../context/AuthContext';
import { vi } from 'vitest';
import { supabase } from '../utils/supabase';
import type { User } from '@supabase/supabase-js';

interface TestUser {
  id: string;
  email: string;
  email_confirmed_at?: string;
  created_at: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  aud: string;
}

interface TestSession {
  access_token: string;
  refresh_token: string;
  user: TestUser;
}

export const createMockUser = (overrides: Partial<TestUser> = {}): TestUser => ({
  id: 'test-user-id-123',
  email: 'test@example.com',
  email_confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  ...overrides,
});

export const createMockSession = (user?: TestUser): TestSession => ({
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  user: user || createMockUser(),
});

export const mockSupabaseAuth = {
  signUpSuccess: (user?: TestUser) => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: (user || createMockUser()) as User, session: null },
      error: null,
    });
  },

  signUpError: (message: string) => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: { message, name: 'AuthError' } as any,
    });
  },

  signInSuccess: (user?: TestUser) => {
    const mockUser = user || createMockUser();
    const mockSession = createMockSession(mockUser);
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: mockUser as User, session: mockSession as any },
      error: null,
    });
  },

  signInError: (message: string) => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message, name: 'AuthError' } as any,
    });
  },

  signOutSuccess: () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });
  },

  resetPasswordSuccess: () => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: {},
      error: null,
    });
  },

  resetPasswordError: (message: string) => {
    vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
      data: {},
      error: { message, name: 'AuthError' } as any,
    });
  },

  updateUserSuccess: () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: createMockUser() as User },
      error: null,
    });
  },

  updateUserError: (message: string) => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: { message, name: 'AuthError' } as any,
    });
  },
};

export const setUrlHash = (hash: string) => {
  window.location.hash = hash;
};

export const clearUrlHash = () => {
  window.location.hash = '';
};

interface WrapperProps {
  children: ReactNode;
}

const AllProviders = ({ children }: WrapperProps) => {
  return <AuthProvider>{children}</AuthProvider>;
};

export const renderWithProviders = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, { wrapper: AllProviders, ...options });
};
