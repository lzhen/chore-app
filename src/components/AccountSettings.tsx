import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeSelector } from './ThemeSelector';

interface AccountSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountSettings({ isOpen, onClose }: AccountSettingsProps) {
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
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" role="presentation">
      <section
        className="fluent-card w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-fluent-xl sm:rounded-fluent-lg p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-settings-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="account-settings-title" className="text-xl font-semibold text-content-primary">Account</h2>
            <p className="mt-1 text-sm text-content-secondary">{user?.email}</p>
          </div>
          <button onClick={onClose} className="p-2 text-content-secondary hover:text-content-primary" aria-label="Close account settings">✕</button>
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <h3 className="font-medium text-content-primary">Appearance</h3>
          <p className="mt-1 text-sm text-content-secondary">Choose how Chorely looks on this device.</p>
          <div className="mt-3 inline-flex rounded-fluent-md border border-border">
            <ThemeSelector />
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <h3 className="font-medium text-content-primary">Privacy</h3>
          <p className="mt-1 text-sm text-content-secondary">Learn what information Chorely stores and how it is used.</p>
          <a className="mt-2 inline-block text-sm text-brand hover:underline" href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">View Privacy Policy</a>
        </div>

        <button
          onClick={signOut}
          className="mt-6 w-full rounded-fluent-sm border border-border px-4 py-2.5 text-sm font-medium text-content-primary hover:bg-subtle-background-hover"
        >
          Sign Out
        </button>

        <div className="mt-6 border-t border-border pt-5">
          <h3 className="font-medium text-red-500">Delete account</h3>
          <p className="mt-1 text-sm text-content-secondary">Permanently deletes your sign-in and profile. This cannot be undone.</p>
          {error && <p className="mt-3 text-sm text-red-500" role="alert">{error}</p>}
          {!confirming ? (
            <button onClick={() => setConfirming(true)} className="mt-4 rounded-fluent-sm border border-red-500 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10">Delete my account</button>
          ) : (
            <div className="mt-4 rounded-fluent-sm border border-red-500/40 bg-red-500/10 p-4">
              <p className="text-sm text-content-primary">Are you sure you want to permanently delete your account?</p>
              <div className="mt-3 flex gap-3">
                <button onClick={handleDelete} disabled={deleting} className="rounded-fluent-sm bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-60">{deleting ? 'Deleting…' : 'Delete permanently'}</button>
                <button onClick={() => setConfirming(false)} disabled={deleting} className="rounded-fluent-sm border border-border px-4 py-2 text-sm text-content-primary">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
