/**
 * Offline React/jsdom persistence UX gate; synthetic member data only.
 * A successful render is not an actual Supabase or iPhone acceptance test.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamMember } from '../types';
import { useApp } from '../context/AppContext';
import { MemberProfileModal } from './MemberProfileModal';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));

const member: TeamMember = {
  id: 'synthetic-member', name: 'Fixture', color: '#6699ee',
  points: 0, badges: [],
};
const updateMember = vi.fn();
const getMemberStats = vi.fn().mockReturnValue({
  totalCompleted: 0, currentStreak: 0, longestStreak: 0,
});

beforeEach(() => {
  vi.clearAllMocks();
  updateMember.mockResolvedValue(undefined);
  vi.mocked(useApp).mockReturnValue({
    updateMember,
    getMemberStats,
  } as unknown as ReturnType<typeof useApp>);
});

function renderEditor(current: TeamMember = member) {
  const onClose = vi.fn();
  const result = render(<MemberProfileModal member={current} onClose={onClose} />);
  const form = result.container.querySelector('form');
  if (!form) throw new Error('Missing synthetic profile editor form');
  return { ...result, form, onClose };
}

describe('member profile save feedback', () => {
  it('keeps displayed schedule defaults unset until actually touched, even when saving name', async () => {
    const { form, onClose } = renderEditor();
    fireEvent.change(screen.getByRole('textbox', { name: /name/i }), { target: { value: 'Updated' } });
    fireEvent.submit(form);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(updateMember).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Updated', workingHours: undefined, weeklyCapacityMinutes: undefined,
    }));
    expect(screen.getByText(/avatar editing is temporarily unavailable/i)).toBeInTheDocument();
  });

  it('preserves an explicit zero capacity and touched working days', async () => {
    const { form, onClose } = renderEditor();
    fireEvent.change(screen.getByLabelText(/weekly capacity/i), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mon' }));
    fireEvent.submit(form);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    const saved: TeamMember = updateMember.mock.calls[0][0];
    expect(saved.weeklyCapacityMinutes).toBe(0);
    expect(saved.workingHours?.days).not.toContain(1);
  });

  it('keeps edited inputs visible and shows a role=alert error when persistence rejects', async () => {
    updateMember.mockRejectedValue(new Error('Synthetic database rejection'));
    const { form, onClose } = renderEditor();
    const input = screen.getByRole('textbox', { name: /name/i });
    fireEvent.change(input, { target: { value: 'Unsaved name' } });
    fireEvent.submit(form);
    expect(await screen.findByRole('alert')).toHaveTextContent('Synthetic database rejection');
    expect(onClose).not.toHaveBeenCalled();
    expect(input).toHaveValue('Unsaved name');
  });

  it('does not allow an in-flight save to be dismissed before an error can be shown', async () => {
    let rejectSave!: (error: Error) => void;
    updateMember.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => {
      rejectSave = reject;
    }));

    const { form, onClose } = renderEditor();
    const nameInput = screen.getByRole('textbox', { name: /name/i });
    fireEvent.change(nameInput, { target: { value: 'Pending unsaved name' } });
    fireEvent.submit(form);

    const closeButton = screen.getByRole('button', { name: 'Close member profile' });
    expect(updateMember).toHaveBeenCalledTimes(1);
    expect(closeButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    fireEvent.click(closeButton);
    expect(onClose).not.toHaveBeenCalled();

    rejectSave(new Error('Synthetic delayed database rejection'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Synthetic delayed database rejection');
    expect(nameInput).toHaveValue('Pending unsaved name');
    expect(closeButton).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the previous persisted avatar read-only while writing other supported fields', async () => {
    const { form, onClose } = renderEditor({ ...member, avatarUrl: 'https://assets.invalid/old.png' });
    expect(screen.queryByRole('button', { name: /upload photo/i })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('https://example.com/avatar.jpg')).not.toBeInTheDocument();
    fireEvent.submit(form);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(updateMember.mock.calls[0][0].avatarUrl).toBe('https://assets.invalid/old.png');
  });
});
