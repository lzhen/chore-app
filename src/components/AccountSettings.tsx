import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { reserveAccountDeletionAttempt, wasAccountDeletionAttempted } from '../utils/accountDeletionAttempt';
import { ThemeSelector } from './ThemeSelector';

import { AccountTools } from './AccountTools';

interface AccountSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
  onInsights?: () => void;
  onDeletionAttempt?: () => void;
  deletionLocked?: boolean;
}

export function AccountSettings({ isOpen, onClose, onInsights, onDeletionAttempt, deletionLocked=false, embedded=false }: AccountSettingsProps) {
  const { user, signOut, deleteAccount } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutCompleted, setSignOutCompleted] = useState(false);
  // A pending OR successful sign-out must not race an irreversible delete.
  // Retain the lock after SDK success until auth navigation unmounts this view.
  const signOutPendingOrCompletedRef = useRef(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const deleteInFlight = useRef(false);
  // Never silently switch the account targeted by a two-step confirmation.
  const confirmedAccountIdRef = useRef<string | null>(null);
  const [identityChanged, setIdentityChanged] = useState(false);
  const [deletionAttempted, setDeletionAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Inherited App lock survives leaving and returning to the Account tab.
  const attemptLocked = deletionAttempted || deletionLocked || wasAccountDeletionAttempted(user?.id);

  if (!isOpen) return null;

  const handleSignOut = async () => {
    if (deleteInFlight.current || attemptLocked || signOutPendingOrCompletedRef.current) return;
    signOutPendingOrCompletedRef.current = true;
    setSignOutError(null);
    setSigningOut(true);
    try {
      await signOut();
      setSignOutCompleted(true);
    } catch {
      // A confirmed SDK failure permits retry and a fresh deletion decision.
      signOutPendingOrCompletedRef.current = false;
      // SDK errors and network rejections must not look like successful logout.
      setSignOutError('Could not sign out. Check your connection and try again.');
    } finally {
      setSigningOut(false);
    }
  };

  // A missing acknowledgement can mean deletion already happened. Never
  // offer a second irreversible attempt without server-side reconciliation.
  const handleDelete = async () => {
    if (deleteInFlight.current || attemptLocked || signOutPendingOrCompletedRef.current) return;
    const confirmedAccountId = confirmedAccountIdRef.current;
    if (!confirmedAccountId || confirmedAccountId !== user?.id) {
      // Safe abort: no irreversible request, so a fresh confirmation is allowed.
      confirmedAccountIdRef.current = null;
      setConfirming(false);
      setIdentityChanged(true);
      setError('The signed-in account changed before deletion. No deletion request was sent. Review the account and confirm again.');
      return;
    }
    // Reserve this exact identity before ANY irreversible network request.
    // Existing or inaccessible storage means uncertain prior state: fail closed.
    if (!reserveAccountDeletionAttempt(confirmedAccountId)) {
      setDeletionAttempted(true);
      onDeletionAttempt?.();
      setConfirming(false);
      setError('Account deletion is paused: another attempt may already exist, or this device cannot safely save the attempt. Contact support before trying again.');
      return;
    }
    setIdentityChanged(false);
    deleteInFlight.current = true;
    setDeletionAttempted(true);
    onDeletionAttempt?.();
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteAccount(confirmedAccountId);
      // The server acknowledgement is the only positive deletion outcome.
      // Even if a future adapter returns error:null with deletionConfirmed:false,
      // treat the result as uncertain and never suggest a safe retry.
      if (result.deletionConfirmed !== true) {
        setError('Deletion could not be confirmed. Please contact support before trying again.');
      } else if (result.error) {
        setError('Account deleted, but this device could not fully clear its local sign-in data. Closing or restarting Nesmi may restore an old session. Contact support before using Nesmi on this device again.');
      }
    } catch {
      
      setError('Deletion could not be confirmed. Please contact support before trying again.');
    } finally {
      deleteInFlight.current = false;
      setDeleting(false);
    }
  };

  return (
    <div className={embedded?"chore-account-page":"fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"}>
      <section
        className={embedded ? "nesmi-page-content nesmi-account" : "fluent-card nesmi-account w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-fluent-xl sm:rounded-fluent-lg p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"}
        role={embedded?undefined:"dialog"}
        aria-modal={embedded?undefined:true}
        aria-labelledby="account-settings-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="account-settings-title" className="nesmi-page-title">Account</h2>
            <p className="mt-1 text-sm text-content-secondary">{user?.email}</p>
          </div>
          <button hidden={embedded} onClick={() => { if (!deleteInFlight.current && !attemptLocked) onClose(); }} disabled={deleting || attemptLocked} className="p-2 text-content-secondary hover:text-content-primary" aria-label="Close account settings">✕</button>
        </div>

        {/* Native fieldset semantics prevent nested settings controls from making
            side-effecting calls during an irreversible/uncertain deletion.
            Keep the privacy link and support guidance outside this fieldset. */}
        <fieldset disabled={deleting || attemptLocked} className="min-w-0 border-0 p-0">
          <div className="nesmi-account-appearance nesmi-settings-section"><h3>Appearance</h3><p>Choose light or dark.</p><ThemeSelector/></div>
          <AccountTools/>
          {onInsights && <section className="nesmi-settings-section" aria-labelledby="account-insights-title">
            <div className="nesmi-settings-row">
              <div><h3 id="account-insights-title">Activity &amp; insights</h3><p>Review household activity.</p></div>
              <button type="button" className="chore-button secondary" onClick={() => { if (!deleteInFlight.current && !attemptLocked) onInsights(); }} disabled={deleting || attemptLocked}>View activity</button>
            </div>
          </section>}
        </fieldset>

        <div className="mt-6 border-t border-border pt-5">
          <h3 className="font-medium text-content-primary">Privacy</h3>
          <p className="mt-1 text-sm text-content-secondary">See how your data is used.</p>
          <a className="mt-2 inline-block text-sm text-brand hover:underline" href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">View Privacy Policy</a>
        </div>

        <button
          type="button"
          onClick={() => { void handleSignOut(); }}
          disabled={deleting || attemptLocked || signingOut || signOutCompleted}
          className="chore-button secondary mt-6"
        >
          {signOutCompleted ? 'Signed out' : signingOut ? 'Signing out…' : 'Sign Out'}
        </button>
        {signOutError && <p className="mt-2 text-sm text-red-500" role="alert">{signOutError}</p>}

        <div className="mt-6 border-t border-border pt-5">
          <h3 className="font-medium text-red-500">Delete account</h3>
          <p className="mt-1 text-sm text-content-secondary">Deleting your account also removes your Nesmi household records, including members, chores, completion history, categories, and availability. This cannot be undone.</p>
          {attemptLocked && !deletionAttempted && !error && (
            <div className="mt-3 text-sm text-red-500" role="alert">
              <p>Account deletion may already have been attempted for this account. Account changes remain paused.</p>
              <p className="mt-2">Do not repeat account deletion from another tab or device until support verifies the result.</p>
              <a className="mt-2 inline-block text-sm text-brand underline underline-offset-2" href="mailto:care@empathie.ai">Email support</a>
            </div>
          )}
          {error && (
            <div className="mt-3 text-sm text-red-500" role="alert">
              <p>{error}</p>
              {!identityChanged && <p className="mt-2">Do not repeat account deletion from another tab or device until support verifies the result.</p>}
              {!identityChanged && <a className="mt-2 inline-block text-sm text-brand underline underline-offset-2" href="mailto:care@empathie.ai">Email support</a>}
            </div>
          )}
          {!confirming ? (
            <button onClick={() => { if (!deleteInFlight.current && !attemptLocked && !signOutPendingOrCompletedRef.current) { confirmedAccountIdRef.current = user?.id ?? null; setIdentityChanged(false); setError(null); setConfirming(true); } }} disabled={deleting || attemptLocked || signingOut || signOutCompleted} className="mt-4 rounded-fluent-sm border border-red-500 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10">Delete my account</button>
          ) : (
            <div className="mt-4 rounded-fluent-sm border border-red-500/40 bg-red-500/10 p-4">
              <p className="text-sm text-content-primary">Are you sure you want to permanently delete your account and its household records?</p>
              <div className="mt-3 flex gap-3">
                <button onClick={handleDelete} disabled={deleting || attemptLocked || signingOut || signOutCompleted} className="rounded-fluent-sm bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-60">{deleting ? 'Deleting…' : attemptLocked ? 'Deletion attempted' : 'Delete permanently'}</button>
                <button onClick={() => { if (!deleteInFlight.current && !attemptLocked) { confirmedAccountIdRef.current = null; setConfirming(false); } }} disabled={deleting || attemptLocked} className="rounded-fluent-sm border border-border px-4 py-2 text-sm text-content-primary">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}