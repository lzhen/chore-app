import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isEmailVerification: boolean;
  isPasswordReset: boolean;
  clearEmailVerification: () => void;
  clearPasswordReset: () => void;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<{ error: Error | null; deletionConfirmed: boolean }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Ignore stale SDK callbacks after the server confirms irreversible deletion.
  // A newly successful sign-in may explicitly re-arm this provider.
  const deletionConfirmedRef = useRef(false);
  const authRevisionRef = useRef(0);
  const [isEmailVerification, setIsEmailVerification] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsPasswordReset(true);
    } else if (hash.includes('type=signup') || hash.includes('type=email') || hash.includes('access_token')) {
      setIsEmailVerification(true);
    }

    // An initial getSession can resolve after a confirmed account deletion.
    const initialRevision = authRevisionRef.current;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!deletionConfirmedRef.current && authRevisionRef.current === initialRevision) {
        setSession(session);
        setUser(session?.user ?? null);
      }
      setLoading(false);
    }).catch(() => {
      // A storage/SDK failure must not leave the login screen loading forever.
      // Do not infer an authenticated session when the initial read fails.
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (deletionConfirmedRef.current) return;
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const clearEmailVerification = () => {
    setIsEmailVerification(false);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const clearPasswordReset = () => {
    setIsPasswordReset(false);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (!error && data?.session) {
      authRevisionRef.current += 1;
      deletionConfirmedRef.current = false;
      setSession(data.session);
      setUser(data.session.user);
    }
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data?.session) {
      authRevisionRef.current += 1;
      deletionConfirmedRef.current = false;
      setSession(data.session);
      setUser(data.session.user);
    }
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const deleteAccount = async () => {
    const { data, error } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
    });

    if (error) {
      return { error: error as Error, deletionConfirmed: false };
    }

    if (data?.deleted !== true) {
      return {
        error: new Error('Account deletion was not confirmed. Please try again.'),
        deletionConfirmed: false,
      };
    }

    // Confirmed deletion invalidates any pending getSession/old auth events.
    // The old user must not be resurrected in this React provider.
    deletionConfirmedRef.current = true;
    authRevisionRef.current += 1;
    // The server explicitly acknowledged deletion. Subsequent local cleanup
    // failures must not be presented as an unknown server deletion outcome.
    let cleanupError: Error | null = null;
    // Only remove caches owned by Nesmi; do not clear the shared origin.
    for (const key of ['chore-app-chores', 'chore-app-members']) {
      try {
        localStorage.removeItem(key);
      } catch {
        cleanupError ??= new Error('Account was deleted, but local cache cleanup did not finish.');
      }
    }
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) {
        cleanupError ??= new Error('Account was deleted, but local sign-out did not finish.');
      }
    } catch {
      cleanupError ??= new Error('Account was deleted, but local sign-out did not finish.');
    }
    // Clearing React state does not prove the SDK persisted session was removed.
    // The UI must warn the user about any sign-out or storage cleanup failure.
    setSession(null);
    setUser(null);
    return { error: cleanupError, deletionConfirmed: true };
  };

  const resetPassword = async (email: string) => {
    const baseUrl = window.location.origin;
    const basePath = import.meta.env.BASE_URL || '/';
    const redirectUrl = `${baseUrl}${basePath}`.replace(/\/$/, '');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isEmailVerification, isPasswordReset, clearEmailVerification, clearPasswordReset, signUp, signIn, signOut, deleteAccount, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
