import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  sessionLoadFailed: boolean;
  retrySession: () => void;
  isEmailVerification: boolean;
  isPasswordReset: boolean;
  clearEmailVerification: () => void;
  clearPasswordReset: () => void;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  deleteAccount: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [committedUserId, setCommittedUserId] = useState<string>();
  const userId = user?.id;
  const loading = checkingSession || committedUserId !== userId;
  const [sessionLoadFailed, setSessionLoadFailed] = useState(false);
  const restoreSession = useRef<(() => void) | null>(null);
  const [isEmailVerification, setIsEmailVerification] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);

  // Let the keyed household provider mount for the new identity before it starts loading data.
  useEffect(() => {
    setCommittedUserId(userId);
  }, [userId]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsPasswordReset(true);
    } else if (hash.includes('type=signup') || hash.includes('type=email') || hash.includes('access_token')) {
      setIsEmailVerification(true);
    }

    let active = true;
    let sessionVersion = 0;
    let readingSession = false;

    const applySession = (session: Session | null) => {
      setSession(session);
      setUser(session?.user ?? null);
      setSessionLoadFailed(false);
      setCheckingSession(false);
    };

    const readSession = async () => {
      if (readingSession) return;
      readingSession = true;
      const version = sessionVersion;
      setSessionLoadFailed(false);
      setCheckingSession(true);
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (active && version === sessionVersion) applySession(data.session);
      } catch {
        if (active && version === sessionVersion) {
          setSessionLoadFailed(true);
          setCheckingSession(false);
        }
      } finally {
        readingSession = false;
      }
    };
    restoreSession.current = readSession;
    void readSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // The SDK emits INITIAL_SESSION with a null session after a refresh
        // error too. Read initial state through getSession to get the error.
        if (!active || event === 'INITIAL_SESSION') return;
        sessionVersion += 1;
        applySession(session);
      }
    );

    return () => {
      active = false;
      restoreSession.current = null;
      subscription.unsubscribe();
    };
  }, []);

  const retrySession = () => {
    restoreSession.current?.();
  };

  const clearEmailVerification = () => {
    setIsEmailVerification(false);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const clearPasswordReset = () => {
    setIsPasswordReset(false);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = () => supabase.auth.signOut();

  const deleteAccount = async () => {
    const { error } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
    });

    if (error) {
      return { error: error as Error };
    }

    localStorage.clear();
    await supabase.auth.signOut({ scope: 'local' });
    setSession(null);
    setUser(null);
    return { error: null };
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
    <AuthContext.Provider value={{ user, session, loading, sessionLoadFailed, retrySession, isEmailVerification, isPasswordReset, clearEmailVerification, clearPasswordReset, signUp, signIn, signOut, deleteAccount, resetPassword }}>
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
