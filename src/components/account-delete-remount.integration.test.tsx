/**
 * Nesmi release gate: real React DOM + portal acceptance for the draft deletion UI.
 * This is a host-level integration test of the actual AccountSettings and AgentPanel
 * components; the small host intentionally mirrors App's deletion latch / tab switch.
 * It makes no Supabase, network, or deletion requests (the auth hook is mocked).
 */
import { useState } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountSettings } from './AccountSettings';
import { AgentPanel } from './AgentPanel';

const auth = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'release-fixture@example.invalid' },
    deleteAccount: auth.deleteAccount,
    signOut: auth.signOut,
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
  const [deletionAttempted, setDeletionAttempted] = useState(false);
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
        onDeletionAttempt={() => setDeletionAttempted(true)}
      />}
      {tab === 'today' && <p>Today content</p>}
      <div className="nesmi-task-tools" ref={setAssistantTarget} />
      <AgentPanel triggerTarget={assistantTarget} suspended={deletionAttempted} />
    </>
  );
}

beforeEach(() => {
  auth.deleteAccount.mockReset();
  auth.signOut.mockReset();
});
afterEach(cleanup);

describe('account deletion remount + Assistant portal release gate', () => {
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
    expect(screen.getByRole('alert')).toHaveTextContent('already attempted in this session');
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
    expect(auth.deleteAccount).toHaveBeenCalledTimes(1);
  });

});
