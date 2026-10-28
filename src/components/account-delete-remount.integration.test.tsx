/**
 * Nesmi release gate: real React DOM + portal acceptance for the draft deletion UI.
 * This is a host-level integration test of the actual AccountSettings and AgentPanel
 * components; the small host intentionally mirrors App's deletion latch / tab switch.
 * It makes no Supabase, network, or deletion requests (the auth hook is mocked).
 */
import { useEffect, useState } from 'react';
import { accountDeletionAttemptKey, wasAccountDeletionAttempted } from '../utils/accountDeletionAttempt';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountSettings } from './AccountSettings';
import { AgentPanel } from './AgentPanel';

const auth = vi.hoisted(() => ({
  user: { id: 'synthetic-account-A', email: 'release-fixture@example.invalid' },
  deleteAccount: vi.fn(),
  signOut: vi.fn(),
  signOutStatus: 'idle' as 'idle' | 'pending' | 'succeeded',
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: auth.user,
    deleteAccount: auth.deleteAccount,
    signOut: auth.signOut,
    signOutStatus: auth.signOutStatus,
  }),
}));
vi.mock('./ThemeSelector', () => ({ ThemeSelector: () => null }));
vi.mock('./AccountTools', () => ({ AccountTools: () => null }));
vi.mock('./ChatAssistant', () => ({ ChatAssistant: () => null }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

/** React host using the same callback/prop contract as App.tsx in PR #35. */
function DeletionTabHost() {
  const [tab, setTab] = useState<'account' | 'today'>('account');
  const [attemptedId, setAttemptedId] = useState<string | null>(null);
  const deletionAttempted = Boolean(auth.user?.id && (
    attemptedId === auth.user.id || wasAccountDeletionAttempted(auth.user.id)
  ));
  useEffect(() => {
    const accountId = auth.user?.id;
    if (!accountId) return;
    const onSiblingAttempt = (event: StorageEvent) => {
      if (event.key === accountDeletionAttemptKey(accountId) &&
          event.newValue !== null && event.storageArea === localStorage) {
        setAttemptedId(accountId);
      }
    };
    window.addEventListener('storage', onSiblingAttempt);
    return () => window.removeEventListener('storage', onSiblingAttempt);
  }, [auth.user?.id]);
  const [assistantTarget, setAssistantTarget] = useState<HTMLDivElement | null>(null);
  return (
    <>
      <div id="root" />
      <nav aria-label="Test navigation">
        <button type="button" onClick={() => setTab('today')}>Today tab</button>
        <button type="button" onClick={() => setTab('account')}>Account tab</button>
      </nav>
      {tab === 'account' && <AccountSettings
        isOpen embedded
        onClose={() => setTab('today')}
        deletionLocked={deletionAttempted}
        onDeletionAttempt={() => { if (auth.user?.id) setAttemptedId(auth.user.id); }}
      />}
      {tab === 'today' && <p>Today content</p>}
      <div className="nesmi-task-tools" ref={setAssistantTarget} />
      <AgentPanel triggerTarget={assistantTarget} suspended={deletionAttempted} />
    </>
  );
}

beforeEach(() => {
  auth.user = { id: 'synthetic-account-A', email: 'release-fixture@example.invalid' };
  auth.deleteAccount.mockReset();
  auth.signOut.mockReset();
  auth.signOutStatus = 'idle';
  localStorage.clear(); // synthetic jsdom isolation; never a real browser
});
afterEach(cleanup);

describe('Nesmi Account sign-out recovery', () => {
  it('shows a retryable error when the sign-out promise rejects, without touching account deletion', async () => {
    const user = userEvent.setup();
    auth.signOut.mockRejectedValueOnce(new Error('synthetic lost connection'));
    render(<DeletionTabHost />);
    await user.click(screen.getByRole('button', { name: 'Sign Out' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out');
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeEnabled();
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.deleteAccount).not.toHaveBeenCalled();
  });

  it('blocks repeated sign-out clicks until the first request settles', async () => {
    const user = userEvent.setup();
    const pending = deferred<void>();
    auth.signOut.mockReturnValueOnce(pending.promise);
    render(<DeletionTabHost />);
    await user.click(screen.getByRole('button', { name: 'Sign Out' }));
    expect(screen.getByRole('button', { name: 'Signing out…' })).toBeDisabled();
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve(); await pending.promise; });
    // Success is sticky until a real SIGNED_OUT event removes this view.
    expect(screen.getByRole('button', { name: 'Signed out' })).toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('retains pending logout protection across Account tab remount and releases it after failure', async () => {
    const user = userEvent.setup();
    const pending = deferred<void>();
    auth.signOut.mockImplementationOnce(() => {
      // The real AuthProvider persists this status independently of Account.
      auth.signOutStatus = 'pending';
      return pending.promise;
    });
    render(<DeletionTabHost />);
    await user.click(screen.getByRole('button', { name: 'Sign Out' }));
    await user.click(screen.getByRole('button', { name: 'Today tab' }));
    await user.click(screen.getByRole('button', { name: 'Account tab' }));
    expect(screen.getByRole('button', { name: 'Signing out…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeDisabled();
    expect(auth.deleteAccount).not.toHaveBeenCalled();
    expect(localStorage.getItem(accountDeletionAttemptKey('synthetic-account-A'))).toBeNull();

    auth.signOutStatus = 'idle'; // SDK failure releases the provider lock.
    await act(async () => {
      pending.reject(new Error('synthetic logout failure'));
      await pending.promise.catch(() => {});
    });
    await user.click(screen.getByRole('button', { name: 'Today tab' }));
    await user.click(screen.getByRole('button', { name: 'Account tab' }));
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeEnabled();
    expect(auth.deleteAccount).not.toHaveBeenCalled();
  });

  it('does not re-enable account deletion on remount after logout succeeds', async () => {
    const user = userEvent.setup();
    const pending = deferred<void>();
    auth.signOut.mockImplementationOnce(() => {
      auth.signOutStatus = 'pending';
      return pending.promise;
    });
    render(<DeletionTabHost />);
    await user.click(screen.getByRole('button', { name: 'Sign Out' }));
    await user.click(screen.getByRole('button', { name: 'Today tab' }));
    auth.signOutStatus = 'succeeded';
    await act(async () => { pending.resolve(); await pending.promise; });
    await user.click(screen.getByRole('button', { name: 'Account tab' }));
    expect(screen.getByRole('button', { name: 'Signed out' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeDisabled();
    expect(auth.deleteAccount).not.toHaveBeenCalled();
    expect(localStorage.getItem(accountDeletionAttemptKey('synthetic-account-A'))).toBeNull();
  });

  it('never starts irreversible deletion while sign-out is pending and recovers on sign-out failure', async () => {
    const user = userEvent.setup();
    const pending = deferred<void>();
    auth.signOut.mockReturnValueOnce(pending.promise);
    render(<DeletionTabHost />);

    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Sign Out' }));
    expect(screen.getByRole('button', { name: 'Signing out…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(auth.deleteAccount).not.toHaveBeenCalled();
    expect(localStorage.getItem(accountDeletionAttemptKey('synthetic-account-A'))).toBeNull();

    await act(async () => {
      pending.reject(new Error('synthetic sign-out failure'));
      await pending.promise.catch(() => {});
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out');
    expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeEnabled();
    expect(auth.deleteAccount).not.toHaveBeenCalled();
  });

  it('keeps deletion unavailable after sign-out succeeds but before auth navigation unmounts Account', async () => {
    const user = userEvent.setup();
    auth.signOut.mockResolvedValueOnce(undefined);
    render(<DeletionTabHost />);

    await user.click(screen.getByRole('button', { name: 'Sign Out' }));
    expect(await screen.findByRole('button', { name: 'Signed out' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(screen.queryByRole('button', { name: 'Delete permanently' })).not.toBeInTheDocument();
    expect(localStorage.getItem(accountDeletionAttemptKey('synthetic-account-A'))).toBeNull();
    expect(auth.deleteAccount).not.toHaveBeenCalled();
  });

});

describe('account deletion remount + Assistant portal release gate', () => {
  it('discloses linked household record loss in both deletion steps before any request', async () => {
    const user = userEvent.setup();
    render(<DeletionTabHost />);
    expect(screen.getByText(/Deleting your account also removes your Nesmi household records/))
      .toHaveTextContent('members, chores, completion history, categories, and availability');
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    expect(screen.getByText('Are you sure you want to permanently delete your account and its household records?'))
      .toBeInTheDocument();
    expect(auth.deleteAccount).not.toHaveBeenCalled();
  });

  it('requires fresh confirmation if signed-in account changes mid-dialog', async () => {
    const user = userEvent.setup();
    const view = render(<DeletionTabHost />);
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    auth.user = { id: 'synthetic-account-B', email: 'switched@example.invalid' };
    view.rerender(<DeletionTabHost />);
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(auth.deleteAccount).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('No deletion request was sent');
    // Safe identity-switch abort should not route a normal re-confirmation to support.
    expect(screen.queryByRole('link', { name: 'Email support' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeEnabled();
    auth.deleteAccount.mockResolvedValue({ error: null, deletionConfirmed: true });
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(auth.deleteAccount).toHaveBeenCalledTimes(1);
    expect(auth.deleteAccount).toHaveBeenCalledWith('synthetic-account-B');
  });

  it('suspends an open Assistant portal immediately and blocks a repeated deletion across an Account tab remount', async () => {
    const user = userEvent.setup();
    const pending = deferred<{ error: Error | null }>();
    auth.deleteAccount.mockReturnValue(pending.promise);
    render(<DeletionTabHost />);

    await user.click(await screen.findByRole('button', { name: 'Assistant' }));
    expect(screen.getByRole('dialog', { name: 'Assistant' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(auth.deleteAccount).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Assistant' })).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: 'Assistant' })).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Today tab' }));
    expect(screen.getByText('Today content')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Account tab' }));
    expect(screen.getByRole('alert')).toHaveTextContent('may already have been attempted');
    expect(screen.getByRole('link', { name: 'Email support' })).toHaveAttribute('href', 'mailto:care@empathie.ai');
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'View Privacy Policy' })).toBeInTheDocument();
    expect(auth.deleteAccount).toHaveBeenCalledTimes(1);

    await act(async () => { pending.resolve({ error: new Error('ambiguous acknowledgment') }); });
    expect(auth.deleteAccount).toHaveBeenCalledTimes(1);
  });

  it('leaves both Account and Assistant usable if the user cancels before deletion', async () => {
    const user = userEvent.setup();
    render(<DeletionTabHost />);
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Today tab' }));
    await user.click(screen.getByRole('button', { name: 'Account tab' }));
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(auth.deleteAccount).not.toHaveBeenCalled();
    await user.click(await screen.findByRole('button', { name: 'Assistant' }));
    expect(screen.getByRole('dialog', { name: 'Assistant' })).toBeVisible();
  });
  it('shows post-confirmation cleanup failure as a deleted account, not an unknown deletion', async () => {
    const user = userEvent.setup();
    auth.deleteAccount.mockResolvedValue({
      error: new Error('synthetic local sign-out failure'),
      deletionConfirmed: true,
    });
    render(<DeletionTabHost />);
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Account deleted, but this device could not fully clear');
    expect(alert).not.toHaveTextContent('Deletion could not be confirmed');
    expect(screen.getByRole('link', { name: 'Email support' })).toHaveAttribute('href', 'mailto:care@empathie.ai');
    expect(screen.getByRole('button', { name: 'Deletion attempted' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeDisabled();
    expect(auth.deleteAccount).toHaveBeenCalledTimes(1);
  });

  it('continues to show uncertainty when the deletion response is not confirmed', async () => {
    const user = userEvent.setup();
    auth.deleteAccount.mockResolvedValue({
      error: new Error('synthetic ambiguous server response'),
      deletionConfirmed: false,
    });
    render(<DeletionTabHost />);
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Deletion could not be confirmed');
    expect(alert).not.toHaveTextContent('Account deleted, but this device');
    expect(screen.getByRole('link', { name: 'Email support' })).toHaveAttribute('href', 'mailto:care@empathie.ai');
    expect(auth.deleteAccount).toHaveBeenCalledTimes(1);
  });

});

describe('durable attempted-deletion lock (synthetic jsdom only)', () => {
  it('keeps uncertain deletion locked after a full App host remount, scoped to the original identity', async () => {
    const user = userEvent.setup();
    auth.deleteAccount.mockResolvedValue({
      error: new Error('synthetic unresolved ACK'), deletionConfirmed: false,
    });
    const first = render(<DeletionTabHost />);
    await user.click(screen.getByRole('button', { name: 'Delete my account' }));
    await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(auth.deleteAccount).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(accountDeletionAttemptKey('synthetic-account-A'))).toBe('true');
    first.unmount();
    const reloaded = render(<DeletionTabHost />);
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('may already have been attempted');
    expect(screen.queryByRole('button', { name: 'Assistant' })).not.toBeInTheDocument();
    reloaded.unmount();

    auth.user = { id: 'synthetic-account-B', email: 'other@example.invalid' };
    render(<DeletionTabHost />);
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeEnabled();
    expect(localStorage.getItem(accountDeletionAttemptKey('synthetic-account-A'))).toBe('true');
  });

  it('locks another mounted tab when a matching localStorage attempt event arrives', async () => {
    render(<DeletionTabHost />);
    const key = accountDeletionAttemptKey('synthetic-account-A');
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeEnabled();
    localStorage.setItem('movelight:synthetic', 'untouched');
    localStorage.setItem(key, 'true');
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', {
        key, newValue: 'true', storageArea: localStorage,
      }));
    });
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Assistant' })).not.toBeInTheDocument();
    expect(localStorage.getItem('movelight:synthetic')).toBe('untouched');
    expect(auth.deleteAccount).not.toHaveBeenCalled();
  });

  it('does not send a deletion request when persisted locking fails', async () => {
    const original = Storage.prototype.setItem;
    const rejectAttempts = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key.startsWith('nesmi:account-deletion-attempt:')) throw new Error('synthetic quota failure');
      return original.call(this, key, value);
    });
    try {
      const user = userEvent.setup();
      render(<DeletionTabHost />);
      await user.click(screen.getByRole('button', { name: 'Delete my account' }));
      await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
      expect(auth.deleteAccount).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('cannot safely save the attempt');
      expect(screen.getByRole('link', { name: 'Email support' })).toHaveAttribute('href', 'mailto:care@empathie.ai');
      expect(screen.getByRole('button', { name: 'Delete my account' })).toBeDisabled();
    } finally {
      rejectAttempts.mockRestore();
    }
  });
});
