import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberProfileModal } from './MemberProfileModal';
import type { TeamMember } from '../types';

const app = vi.hoisted(() => ({ updateMember: vi.fn(), getMemberStats: vi.fn() }));
vi.mock('../context/AppContext', () => ({ useApp: () => app }));
const member: TeamMember = { id: 'alex', name: 'Alex', email: 'alex@example.test', color: '#556247', skills: ['Cooking'], workingHours: { start: '09:00', end: '17:00', days: [1, 2, 3, 4, 5] }, weeklyCapacityMinutes: 480, points: 15, badges: [] };
function Host() {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)}>Open Alex profile</button>{open && <MemberProfileModal member={member} onClose={() => setOpen(false)} />}</>;
}
async function openProfile() {
  const user = userEvent.setup();
  render(<Host />);
  await user.click(screen.getByRole('button', { name: 'Open Alex profile' }));
  return user;
}
beforeEach(() => {
  app.updateMember.mockResolvedValue(undefined);
  app.getMemberStats.mockReturnValue({ totalCompleted: 4, currentStreak: 2, longestStreak: 3 });
});
afterEach(cleanup);

describe('Member profile shared surface', () => {
  it('uses a named shared dialog, labels its fields, and closes a pristine profile with restored focus', async () => {
    await openProfile();
    expect(screen.getByRole('dialog', { name: 'Member Profile' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('Name')).toHaveValue('Alex');
    expect(screen.getByLabelText('Email')).toHaveValue('alex@example.test');
    expect(screen.getByLabelText('Skills')).toHaveClass('nesmi-secondary-field');
    expect(screen.getByLabelText('Working hours start')).toHaveValue('09:00');
    expect(screen.getByRole('button', { name: 'Mon' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open Alex profile' })).toHaveFocus());
    expect(app.updateMember).not.toHaveBeenCalled();
  });

  it('protects dirty edits on Escape and only the topmost decision closes, preserving values and focus', async () => {
    const user = await openProfile();
    const input = screen.getByLabelText('Name');
    await user.clear(input);
    await user.type(input, 'Alexandra');
    fireEvent.keyDown(document, { key: 'Escape' });
    const decision = screen.getByRole('dialog', { name: 'Discard profile changes?' });
    expect(decision).toHaveTextContent('Changed: Name.');
    expect(within(decision).getByRole('button', { name: 'Keep editing' })).toHaveFocus();
    expect(screen.getByRole('dialog', { name: 'Member Profile', hidden: true })).toHaveAttribute('aria-modal', 'false');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Discard profile changes?' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Alexandra');
    expect(screen.getByLabelText('Name')).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(app.updateMember).not.toHaveBeenCalled();
  });

  it('closes restored-original values without a discard decision and retains edits across tabs', async () => {
    const user = await openProfile();
    await user.type(screen.getByLabelText('Name'), ' changed');
    await user.click(screen.getByRole('button', { name: 'Badges & Stats' }));
    expect(screen.getByText('Current Streak').previousElementSibling).toHaveTextContent('2');
    await user.click(screen.getByRole('button', { name: 'Profile' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Alex changed');
    await user.clear(screen.getByLabelText('Name'));
    await user.type(screen.getByLabelText('Name'), 'Alex');
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(app.updateMember).not.toHaveBeenCalled();
  });

  it('keeps failed saves recoverable and retries the same complete profile only on explicit Save', async () => {
    app.updateMember.mockRejectedValueOnce(new Error('Synthetic save failure'));
    const user = await openProfile();
    await user.type(screen.getByLabelText('Name'), ' changed');
    await user.click(screen.getByRole('button', { name: 'Sun' }));
    fireEvent.change(screen.getByRole('slider'), { target: { value: '600' } });
    await user.click(screen.getByRole('button', { name: 'Save Profile' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Synthetic save failure');
    expect(screen.getByRole('alert')).toHaveFocus();
    expect(screen.getByLabelText('Name')).toHaveValue('Alex changed');
    expect(screen.getByRole('slider')).toHaveValue('600');
    expect(screen.getByRole('button', { name: 'Save Profile' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Save Profile' }));
    expect(app.updateMember).toHaveBeenCalledTimes(2);
    expect(app.updateMember).toHaveBeenLastCalledWith({ ...member, name: 'Alex changed', weeklyCapacityMinutes: 600, workingHours: { ...member.workingHours, days: [0, 1, 2, 3, 4, 5] } });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('blocks repeated submissions, edits, and dismissal while a save is pending', async () => {
    let resolve!: () => void;
    app.updateMember.mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
    const user = await openProfile();
    const form = screen.getByLabelText('Name').closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(app.updateMember).toHaveBeenCalledOnce();
    expect(screen.getByLabelText('Name')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    resolve();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('preserves local avatar upload without submitting or overwriting current text fields', async () => {
    const user = await openProfile();
    await user.type(screen.getByLabelText('Name'), ' changed');
    const file = new File(['image'], 'avatar.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Upload member photo'), file);
    await waitFor(() => expect((screen.getByLabelText('Photo URL') as HTMLInputElement).value).toContain('data:image/png;base64,'));
    expect(screen.getByLabelText('Name')).toHaveValue('Alex changed');
    expect(app.updateMember).not.toHaveBeenCalled();
  });
});
it('dismisses the innermost skill suggestions before the profile when using Escape', async () => {
  const user = await openProfile();
  await user.click(screen.getByLabelText('Skills'));
  expect(screen.getByRole('button', { name: 'Cleaning' })).toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('button', { name: 'Cleaning' })).not.toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Member Profile' })).toBeInTheDocument();
  expect(screen.getByLabelText('Skills')).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
