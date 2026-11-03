import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { createMagicLinkFlow, magicRedirect, isMagicReturn, LINK_ERROR } from '../utils/magicLink';
import { supabase, emailLinkAuth } from '../utils/supabase';

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
  sendMagicLink: (email: string) => Promise<{ error: Error | null }>;
  magicLinkError: string | null;
  deleteAccount: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEmailVerification, setIsEmailVerification] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);

  const [magicLinkError, setMagicLinkError] = useState<string | null>(null);
  const magicFlow = useMemo(() => {
    try {
      return createMagicLinkFlow(emailLinkAuth, magicRedirect(Capacitor.isNativePlatform(), window.location.origin, import.meta.env.BASE_URL || '/'), localStorage);
    } catch { return null; }
  }, []);

  useEffect(() => {
    let disposed = false;
    const receive = async (url: string) => {
      if (!magicFlow || !isMagicReturn(url)) return;
      // Remove callback material from browser history before asynchronous exchange.
      if (!Capacitor.isNativePlatform()) window.history.replaceState(null, '', window.location.pathname);
      const result = await magicFlow.receive(url);
      if (!disposed && result.handled) setMagicLinkError(result.error?.message ?? null);
    };
    if (Capacitor.isNativePlatform()) {
      // Register before getLaunchUrl; flow state deduplicates overlapping cold/warm events.
      const listener = App.addListener('appUrlOpen', ({ url }) => { void receive(url); });
      void App.getLaunchUrl().then(result => { if (!disposed && result?.url) void receive(result.url); }).catch(() => {
        if (!disposed) setMagicLinkError(LINK_ERROR);
      });
      return () => { disposed = true; void listener.then(handle => handle.remove()).catch(() => {}); };
    }
    void receive(window.location.href);
    return () => { disposed = true; };
  }, [magicFlow]);

  const sendMagicLink = async (email: string) => {
    setMagicLinkError(null);
    return magicFlow ? magicFlow.send(email) : { error: new Error('Email link sign-in is unavailable at this address.') };
  };

  useEffect(() => {
    const hash = window.location.hash;
    if (!isMagicReturn(window.location.href) && hash.includes('type=recovery')) {
      setIsPasswordReset(true);
    } else if (!isMagicReturn(window.location.href) && (hash.includes('type=signup') || hash.includes('type=email') || hash.includes('access_token'))) {
      setIsEmailVerification(true);
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
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
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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
      return { error: error as Error };
    }

    if (data?.deleted !== true) {
      return { error: new Error('Account deletion was not confirmed. Please try again.') };
    }
    // Only remove caches owned by Nesmi. Other apps may share this origin.
    localStorage.removeItem('chore-app-chores');
    localStorage.removeItem('chore-app-members');
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
    <AuthContext.Provider value={{ user, session, loading, isEmailVerification, isPasswordReset, clearEmailVerification, clearPasswordReset, signUp, signIn, signOut, deleteAccount, resetPassword, sendMagicLink, magicLinkError }}>
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
