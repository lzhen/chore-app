import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface AccountSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountSettings({ isOpen, onClose }: AccountSettingsProps) {
  const { user, deleteAccount } = useAuth();
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4" role="presentation">
      <section
        className="fluent-card w-full max-w-md p-6"
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
          <h3 className="font-medium text-content-primary">Privacy</h3>
          <p className="mt-1 text-sm text-content-secondary">Learn what information Chorely stores and how it is used.</p>
          <a className="mt-2 inline-block text-sm text-brand hover:underline" href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">View Privacy Policy</a>
        </div>

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
