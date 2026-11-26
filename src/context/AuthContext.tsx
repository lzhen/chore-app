import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, takeStartupEmailVerification } from '../utils/supabase';
import { emailVerificationFailure, type EmailVerificationCallback, type EmailVerificationStatus } from '../utils/emailVerification';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  sessionLoadFailed: boolean;
  retrySession: () => void;
  emailVerification: EmailVerificationStatus | null;
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
  const [emailVerification, setEmailVerification] = useState<EmailVerificationStatus | null>(null);
  const emailCallback = useRef<EmailVerificationCallback | null>();
  const [isPasswordReset, setIsPasswordReset] = useState(false);

  // Let the keyed household provider mount for the new identity before it starts loading data.
  useEffect(() => {
    setCommittedUserId(userId);
  }, [userId]);

  useEffect(() => {
    if (new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery') {
      setIsPasswordReset(true);
    }

    if (emailCallback.current === undefined) {
      const callback = takeStartupEmailVerification();
      if (callback && 'errorMessage' in callback) {
        setEmailVerification({ status: 'error', message: callback.errorMessage });
        emailCallback.current = null;
      } else {
        emailCallback.current = callback;
        if (callback) setEmailVerification({ status: 'verifying' });
      }
    }

    let active = true;
    let sessionVersion = 0;
    let readingSession = false;
    let callbackInitializationAccepted = false;
    let signedInWithCallback = false;

    const matchesCallback = (session: Session | null): boolean => {
      const callback = emailCallback.current;
      return !!callback && 'accessToken' in callback && !!session?.user &&
        session.access_token === callback.accessToken && session.refresh_token === callback.refreshToken;
    };

    const finishEmailVerification = (verified: boolean) => {
      emailCallback.current = null;
      if (verified) {
        window.history.replaceState(null, '', window.location.pathname);
        setEmailVerification({ status: 'success' });
      } else {
        setEmailVerification({ status: 'error', message: emailVerificationFailure });
      }
    };

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
        if (emailCallback.current) {
          // The SDK may retain an existing session when URL initialization fails.
          const { error } = await supabase.auth.initialize();
          if (!active) return;
          callbackInitializationAccepted = !error;
          if (emailCallback.current && (error || signedInWithCallback)) {
            finishEmailVerification(callbackInitializationAccepted);
          }
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;
        if (emailCallback.current) {
          // The SDK clears the fragment after accepting the implicit callback.
          // Its session read can refresh and rotate both tokens before returning.
          const acceptedAndCleared = callbackInitializationAccepted && !!data.session?.user && !window.location.hash;
          finishEmailVerification(matchesCallback(data.session) || acceptedAndCleared);
        }
        if (version === sessionVersion) applySession(data.session);
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
        if (event === 'SIGNED_IN' && matchesCallback(session)) {
          signedInWithCallback = true;
          if (callbackInitializationAccepted) finishEmailVerification(true);
        }
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
    emailCallback.current = null;
    setEmailVerification(null);
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
    <AuthContext.Provider value={{ user, session, loading, sessionLoadFailed, retrySession, emailVerification, isPasswordReset, clearEmailVerification, clearPasswordReset, signUp, signIn, signOut, deleteAccount, resetPassword }}>
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
