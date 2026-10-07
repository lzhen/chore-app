import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeSelector } from './ThemeSelector';

interface AccountSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
}

export function AccountSettings({ isOpen, onClose, embedded = false }: AccountSettingsProps) {
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

  return <div className={embedded ? 'chore-account-page' : 'chore-account-backdrop'}>
    <section className="chore-account-content" role={embedded ? undefined : 'dialog'} aria-modal={embedded ? undefined : true} aria-labelledby="account-settings-title">
      <div className="chore-page-heading chore-account-heading">
        <div>
          <p className="chore-eyebrow">YOUR SPACE</p>
          <h1 id="account-settings-title" className="chore-page-title">Account</h1>
          <p className="chore-muted chore-account-email">{user?.email}</p>
        </div>
        <button hidden={embedded} type="button" onClick={onClose} className="touch-button" aria-label="Close account settings">✕</button>
      </div>

      <section className="chore-settings-section" aria-labelledby="appearance-title">
        <div className="chore-setting-copy">
          <h3 id="appearance-title">Appearance</h3>
          <p>Choose a light or dark space, or follow your device.</p>
        </div>
        <ThemeSelector />
      </section>

      <section className="chore-settings-section" aria-labelledby="privacy-title">
        <div className="chore-setting-copy">
          <h3 id="privacy-title">Privacy</h3>
          <p>How your household information is stored and used.</p>
        </div>
        <a className="chore-text-link" href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">Privacy Policy <span aria-hidden="true">↗</span></a>
      </section>

      <section className="chore-settings-section chore-account-session" aria-label="Session">
        <div className="chore-setting-copy"><h3>Signing out</h3><p>Your household will be here when you return.</p></div>
        <button type="button" onClick={signOut} className="chore-button secondary">Sign Out</button>
      </section>

      <section className="chore-settings-section chore-account-danger" aria-labelledby="delete-account-title">
        <div className="chore-setting-copy">
          <h3 id="delete-account-title">Delete account</h3>
          <p>Permanently deletes your sign-in and profile. This cannot be undone.</p>
        </div>
        {error && <p className="chore-error" role="alert">{error}</p>}
        {!confirming ? <button type="button" onClick={() => setConfirming(true)} className="chore-button danger">Delete my account</button> : <div className="chore-delete-confirmation">
          <p>Are you sure you want to permanently delete your account?</p>
          <div className="chore-account-confirm-actions">
            <button type="button" onClick={() => setConfirming(false)} disabled={deleting} className="chore-button secondary">Cancel</button>
            <button type="button" onClick={handleDelete} disabled={deleting} className="chore-button danger">{deleting ? 'Deleting…' : 'Delete permanently'}</button>
          </div>
        </div>}
      </section>
    </section>
  </div>;
}
