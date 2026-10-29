import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  deletionCleanupWarning: string | null;
  isEmailVerification: boolean;
  isPasswordReset: boolean;
  clearEmailVerification: () => void;
  clearPasswordReset: () => void;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  // Provider-owned so leaving and returning to Account cannot reset a pending logout.
  signOutStatus: 'idle' | 'pending' | 'succeeded';
  deleteAccount: (confirmedAccountId?: string) => Promise<{ error: Error | null; deletionConfirmed: boolean }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Namespaced, non-sensitive receipt: block restoration of an SDK-persisted
// session after the server confirms the old account was deleted. Kept until
// another explicit successful login. Do not delete shared-origin app keys.
const DELETION_RECEIPT_KEY = 'nesmi:account-deletion-confirmed';
type DeletionReceiptState = 'confirmed' | 'absent' | 'unavailable';
const readDeletionReceipt = (): DeletionReceiptState => {
  try {
    const stored = localStorage.getItem(DELETION_RECEIPT_KEY);
    // Only a genuinely missing marker permits automatic session restoration.
    // A present but unrecognized value is uncertain, never proof of absence.
    return stored === null ? 'absent' : stored === 'true' ? 'confirmed' : 'unavailable';
  }
  catch {
    // A storage permission failure can hide an earlier deletion receipt.
    // Never auto-restore an SDK session when that safeguard cannot be read.
    return 'unavailable';
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Survives the Account view unmounting after a confirmed deletion.
  const [initialDeletionReceiptState] = useState(readDeletionReceipt);
  const initialDeletionReceipt = initialDeletionReceiptState !== 'absent';
  const [deletionCleanupWarning, setDeletionCleanupWarning] = useState<string | null>(
    initialDeletionReceiptState === 'confirmed'
      ? 'A previous account was deleted on this device. Old sign-in data will not be restored. Sign in with another account or contact support.'
      : initialDeletionReceiptState === 'unavailable'
        ? 'Account protection could not be verified on this device. Automatic sign-in is paused to avoid restoring a possibly deleted account. Check browser storage permissions and sign in again.'
        : null
  );
  // Guard both the current provider and a newly mounted provider after reload.
  // A new explicitly successful sign-in can re-arm authentication.
  const deletionConfirmedRef = useRef(initialDeletionReceipt);
  const authRevisionRef = useRef(0);
  const [signOutStatus, setSignOutStatus] = useState<'idle' | 'pending' | 'succeeded'>('idle');
  const signOutStatusRef = useRef<'idle' | 'pending' | 'succeeded'>('idle');
  // Serialize destructive deletion with explicit logout, including callers outside AccountSettings.
  const deletionInFlightRef = useRef(false);
  // A live SDK auth event is newer than an in-flight startup getSession snapshot.
  // Keep delayed initial reads from replacing a freshly signed-in/out identity.
  const startupAuthEventRef = useRef(false);
  // An explicit login after verified deletion must not be overwritten by
  // late events from the deleted identity. Pre-deletion events stay normal.
  const postDeletionExplicitUserIdRef = useRef<string | null>(null);
  const [isEmailVerification, setIsEmailVerification] = useState(false);
  const [isPasswordReset, setIsPasswordReset] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsPasswordReset(true);
    } else if (hash.includes('type=signup') || hash.includes('type=email') || hash.includes('access_token')) {
      setIsEmailVerification(true);
    }

    // Never restore an SDK-persisted old identity after an acknowledged delete,
    // even when a previous local SDK sign-out failed and this is a new provider.
    if (deletionConfirmedRef.current) {
      setLoading(false);
    } else {
      const initialRevision = authRevisionRef.current;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!deletionConfirmedRef.current && !startupAuthEventRef.current && authRevisionRef.current === initialRevision) {
          setSession(session);
          setUser(session?.user ?? null);
        }
        setLoading(false);
      }).catch(() => {
        // A storage/SDK failure must not leave the login screen loading forever.
        setLoading(false);
      });
    }

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (deletionConfirmedRef.current) return;
        // A completed explicit sign-out takes precedence over delayed SDK
        // SIGNED_IN / TOKEN_REFRESHED callbacks from its old session.
        // A later explicit successful sign-in clears this lock itself.
        if (signOutStatusRef.current === 'succeeded' && session?.user) return;
        // Ignore delayed old-account auth events after a new explicit login.
        if (postDeletionExplicitUserIdRef.current && session?.user?.id &&
            session.user.id !== postDeletionExplicitUserIdRef.current) return;
        startupAuthEventRef.current = true;
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    // Web and PWA can have two open same-origin tabs. A confirmed deletion in
    // one tab must invalidate a still-mounted provider in every other tab;
    // otherwise a deleted user can remain visibly signed in until refresh.
    // This event is fired by OTHER tabs, not by the tab writing the receipt.
    const onDeletionReceiptFromAnotherTab = (event: StorageEvent) => {
      // A malformed but present receipt is also unsafe to ignore: another
      // tab may have recorded an uncertain deletion outcome.
      if (event.key !== DELETION_RECEIPT_KEY || event.newValue === null) return;
      try {
        if (event.storageArea !== window.localStorage) return;
      } catch {
        return; // Storage disabled; never assume this is a verified receipt.
      }
      deletionConfirmedRef.current = true;
      postDeletionExplicitUserIdRef.current = null;
      authRevisionRef.current += 1;
      setSession(null);
      setUser(null);
      setLoading(false);
      setDeletionCleanupWarning(event.newValue === 'true'
        ? 'A previous account was deleted on this device. Old sign-in data will not be restored. Sign in with another account or contact support.'
        : 'Account protection could not be verified on this device. Automatic sign-in is paused to avoid restoring a possibly deleted account. Check browser storage permissions and sign in again.'
      );
    };
    window.addEventListener('storage', onDeletionReceiptFromAnotherTab);
    return () => {
      window.removeEventListener('storage', onDeletionReceiptFromAnotherTab);
      subscription.unsubscribe();
    };
  }, []);

  const clearEmailVerification = () => {
    setIsEmailVerification(false);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const clearPasswordReset = () => {
    setIsPasswordReset(false);
    window.history.replaceState(null, '', window.location.pathname);
  };

  // A new SDK session does not erase the previous deletion safeguard on its
  // own. If local storage rejects removal, keep React auth fail-closed rather
  // than reporting login success followed by a blocked account on reload.
  const clearDeletionReceiptForNewSession = (): Error | null => {
    if (!deletionConfirmedRef.current) return null;
    try {
      localStorage.removeItem(DELETION_RECEIPT_KEY);
      // A successful removeItem call does not prove storage is readable.
      // Do not re-arm React auth when the safeguard cannot be verified.
      if (localStorage.getItem(DELETION_RECEIPT_KEY) !== null) {
        return new Error('Sign-in could not verify removal of the previous account deletion safeguard. Check browser storage permissions and try again.');
      }
      return null;
    } catch {
      return new Error('Sign-in could not finish because this device could not clear the previous account deletion safeguard. Check browser storage permissions and try again.');
    }
  };

  const signUp = async (email: string, password: string) => {
    const requestRevision = authRevisionRef.current;
    const { data, error } = await supabase.auth.signUp({ email, password });
    // A deletion receipt from another tab (or a newer explicit login) may
    // arrive while the SDK request is in flight. Never let the old response
    // clear that receipt and resurrect/swap the now-revoked identity.
    if (authRevisionRef.current !== requestRevision) {
      return { error: new Error('Account state changed during sign-up. Check your email or sign in again.') };
    }
    if (!error && data?.session) {
      const receiptError = clearDeletionReceiptForNewSession();
      if (receiptError) return { error: receiptError };
      if (deletionConfirmedRef.current || postDeletionExplicitUserIdRef.current) {
        postDeletionExplicitUserIdRef.current = data.session.user.id;
      }
      authRevisionRef.current += 1;
      signOutStatusRef.current = 'idle';
      setSignOutStatus('idle');
      deletionConfirmedRef.current = false;
      // The previous deletion marker was cleared before React auth re-armed.
      setSession(data.session);
      setUser(data.session.user);
      setDeletionCleanupWarning(null);
    }
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const requestRevision = authRevisionRef.current;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (authRevisionRef.current !== requestRevision) {
      return { error: new Error('Account state changed during sign-in. Please sign in again.') };
    }
    if (!error && data?.session) {
      const receiptError = clearDeletionReceiptForNewSession();
      if (receiptError) return { error: receiptError };
      if (deletionConfirmedRef.current || postDeletionExplicitUserIdRef.current) {
        postDeletionExplicitUserIdRef.current = data.session.user.id;
      }
      authRevisionRef.current += 1;
      signOutStatusRef.current = 'idle';
      setSignOutStatus('idle');
      deletionConfirmedRef.current = false;
      // The previous deletion marker was cleared before React auth re-armed.
      setSession(data.session);
      setUser(data.session.user);
      setDeletionCleanupWarning(null);
    }
    return { error: error as Error | null };
  };

  const signOut = async () => {
    // An in-flight delete may already have reached the server. Never change the
    // SDK identity until its response and local cleanup have been reconciled.
    if (deletionInFlightRef.current) {
      throw new Error('Account deletion is in progress. Sign-out is temporarily unavailable.');
    }
    // A provider-owned synchronous lock survives Account tab unmount/remount.
    // Never start a second auth side effect while the original logout is pending.
    if (signOutStatusRef.current !== 'idle') {
      throw new Error('Sign-out is already pending or completed.');
    }
    signOutStatusRef.current = 'pending';
    setSignOutStatus('pending');
    // Any login/signup started before this logout must not re-authorize the UI
    // when its slower promise resolves after the logout request.
    authRevisionRef.current += 1;
    try {
      // Supabase may resolve with { error } instead of rejecting.
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error('Could not sign out. Please try again.');
      signOutStatusRef.current = 'succeeded';
      setSignOutStatus('succeeded');
      // Invalidate requests started while logout was pending, too. Do not
      // depend on an SDK event firing in order to clear a signed-out UI.
      authRevisionRef.current += 1;
      setSession(null);
      setUser(null);
    } catch (error) {
      // A confirmed failure releases the lock so the user may retry.
      signOutStatusRef.current = 'idle';
      setSignOutStatus('idle');
      throw error;
    }
  };

  const deleteAccount = async (confirmedAccountId?: string) => {
    // AccountSettings disables this action during logout, but the provider
    // must enforce the same invariant for other callers and stale views.
    // Do not start an irreversible network request while SDK identity is
    // changing, or after an explicit sign-out has succeeded.
    if (signOutStatusRef.current !== 'idle') {
      return {
        error: new Error('Account deletion is unavailable while sign-out is pending or completed. Sign in again to manage this account.'),
        deletionConfirmed: false,
      };
    }
    // A second caller must not issue another irreversible POST while the first
    // result is still unknown. A synchronous ref closes the same-tick gap.
    if (deletionInFlightRef.current) {
      return {
        error: new Error('Account deletion is already in progress. Do not retry while its result is unknown.'),
        deletionConfirmed: false,
      };
    }
    deletionInFlightRef.current = true;
    try {
      // The Account view sends the ID captured at the start of confirmation.
      // Edge rejects any mismatch against the current authenticated bearer.
      const expectedUserId = confirmedAccountId ?? user?.id ?? '';
      const { data, error } = await supabase.functions.invoke('delete-account-v2', {
        method: 'POST',
        body: { expectedUserId },
      });

      if (error) {
        return { error: error as Error, deletionConfirmed: false };
      }

      if (data?.deleted !== true) {
        return {
          error: new Error('Account deletion could not be confirmed. Do not retry until support verifies whether the account was deleted.'),
          deletionConfirmed: false,
        };
      }

      // Confirmed deletion invalidates any pending getSession/old auth events.
      // The old user must not be resurrected in this React provider.
      deletionConfirmedRef.current = true;
      postDeletionExplicitUserIdRef.current = null;
      authRevisionRef.current += 1;
      // The server explicitly acknowledged deletion. Subsequent local cleanup
      // failures must not be presented as an unknown server deletion outcome.
      let cleanupError: Error | null = null;
      try {
        localStorage.setItem(DELETION_RECEIPT_KEY, 'true');
      } catch {
        cleanupError = new Error('Account was deleted, but local session protection could not be saved.');
      }
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
      // AccountSettings immediately unmounts when App switches to AuthForm;
      // its local alert cannot be relied on to display this cleanup failure.
      setDeletionCleanupWarning(cleanupError
        ? 'Account deleted, but this device could not fully clear its local sign-in data. Closing or restarting Nesmi may restore an old session. Contact support before using Nesmi on this device again.'
        : null);
      return { error: cleanupError, deletionConfirmed: true };
    } finally {
      deletionInFlightRef.current = false;
    }
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
    <AuthContext.Provider value={{ user, session, loading, signOutStatus, deletionCleanupWarning, isEmailVerification, isPasswordReset, clearEmailVerification, clearPasswordReset, signUp, signIn, signOut, deleteAccount, resetPassword }}>
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
