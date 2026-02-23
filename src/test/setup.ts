import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.location
const mockLocation = {
  hash: '',
  pathname: '/chore-app/',
  origin: 'http://localhost:5173',
  href: 'http://localhost:5173/chore-app/',
};

Object.defineProperty(window, 'location', {
  writable: true,
  value: mockLocation,
});

// Mock window.history
Object.defineProperty(window, 'history', {
  writable: true,
  value: {
    replaceState: vi.fn(),
    pushState: vi.fn(),
  },
});

// Mock Supabase client
vi.mock('../utils/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
  window.location.hash = '';
});
