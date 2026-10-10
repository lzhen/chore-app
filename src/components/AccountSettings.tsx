import '../styles/nesmi-secondary-surfaces.css';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeSelector } from './ThemeSelector';

interface AccountSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
}

export function AccountSettings({ isOpen, onClose, embedded=false }: AccountSettingsProps) {
  const { user, signOut, deleteAccount } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    const result = await deleteAccount();
    if (result.error) {
      setError('We could not delete your account. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <div className={embedded?"chore-account-page":"fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"}>
      <section
        className={embedded ? "nesmi-page-content nesmi-account nesmi-secondary-surface" : "fluent-card nesmi-account nesmi-secondary-surface w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-fluent-xl sm:rounded-fluent-lg p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"}
        role={embedded?undefined:"dialog"}
        aria-modal={embedded?undefined:true}
        aria-labelledby="account-settings-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="account-settings-title" className="nesmi-page-title">Account</h2>
            <p className="nesmi-secondary-support mt-1">{user?.email}</p>
          </div>
          <button hidden={embedded} onClick={onClose} className="touch-button nesmi-secondary-close" aria-label="Close account settings">✕</button>
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <h3 className="nesmi-secondary-title">Appearance</h3>
          <p className="nesmi-secondary-support mt-1">Choose how Nesmi looks on this device.</p>
          <div className="mt-3 inline-flex rounded-fluent-md border border-border">
            <ThemeSelector />
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <h3 className="nesmi-secondary-title">Privacy</h3>
          <p className="nesmi-secondary-support mt-1">Learn what information Nesmi stores and how it is used.</p>
          <a className="nesmi-account-policy nesmi-secondary-support mt-2 inline-block" href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">View Privacy Policy</a>
        </div>

        <button
          onClick={signOut}
          className="chore-button secondary mt-6"
        >
          Sign Out
        </button>

        <div className="mt-6 border-t border-border pt-5">
          <h3 className="nesmi-secondary-title nesmi-secondary-danger">Delete account</h3>
          <p className="nesmi-secondary-support mt-1">Permanently deletes your sign-in and profile. This cannot be undone.</p>
          {error && <p className="chore-error nesmi-secondary-support mt-3" role="alert">{error}</p>}
          {!confirming ? (
            <button onClick={() => setConfirming(true)} className="chore-button danger mt-4">Delete my account</button>
          ) : (
            <div className="nesmi-account-delete-confirmation mt-4">
              <p className="nesmi-secondary-body">Are you sure you want to permanently delete your account?</p>
              <div className="nesmi-secondary-actions mt-3">
                <button onClick={handleDelete} disabled={deleting} className="chore-button danger">{deleting ? 'Deleting…' : 'Delete permanently'}</button>
                <button onClick={() => setConfirming(false)} disabled={deleting} className="chore-button secondary">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
