import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompletionDialog } from './CompletionDialog';
import type { ChoreInstance } from '../types';

const app = vi.hoisted(() => ({
  state: { teamMembers: [{ id: 'alex', name: 'Alex' }, { id: 'jamie', name: 'Jamie' }], completions: [] },
  completeChore: vi.fn(), uncompleteChore: vi.fn(),
}));
vi.mock('../context/AppContext', () => ({ useApp: () => app }));
const occurrence: ChoreInstance = {
  id: 'task:2026-10-12', choreId: 'task', title: 'Water plants', date: '2026-10-12',
  assigneeId: null, color: '#556247', isRecurring: true, priority: 'medium', isCompleted: false,
};
beforeEach(() => { app.completeChore.mockReset(); app.uncompleteChore.mockReset(); });
afterEach(cleanup);

describe('merged completion dialog and picker', () => {
  it('dismisses only the picker on Escape, then credits the explicitly selected member once', async () => {
    const user = userEvent.setup(), onClose = vi.fn();
    let finish!: () => void;
    app.completeChore.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    render(<><button>Jamie</button><CompletionDialog instance={occurrence} onClose={onClose} /></>);
    const dialog = screen.getByRole('dialog', { name: 'Complete chore' });
    const picker = within(dialog).getByRole('combobox', { name: 'Who completed it?' });
    expect(within(dialog).getByRole('button', { name: 'Mark done' })).toBeDisabled();
    await user.click(picker);
    expect(dialog).toContainElement(screen.getByRole('listbox'));
    await user.keyboard('{End}{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(picker).toHaveFocus();
    expect(app.completeChore).not.toHaveBeenCalled();
    await user.click(picker);
    await user.click(within(dialog).getByRole('option', { name: 'Jamie' }));
    const save = within(dialog).getByRole('button', { name: 'Mark done' });
    await user.click(save);
    fireEvent.click(save);
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(save).toBeDisabled();
    expect(app.completeChore).toHaveBeenCalledExactlyOnceWith('task', '2026-10-12', 'jamie');
    await act(async () => finish());
    expect(onClose).toHaveBeenCalledOnce();
    expect(app.uncompleteChore).not.toHaveBeenCalled();
  });

  it('keeps the selected member and date reviewable when saving fails, without reporting success', async () => {
    const user = userEvent.setup(), onClose = vi.fn();
    app.completeChore.mockRejectedValue(new Error('Offline. Try again.'));
    render(<CompletionDialog instance={occurrence} onClose={onClose} />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Jamie' }));
    await user.click(screen.getByRole('button', { name: 'Mark done' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Offline. Try again.');
    expect(screen.getByRole('combobox')).toHaveTextContent('Jamie');
    expect(onClose).not.toHaveBeenCalled();
    expect(app.completeChore).toHaveBeenCalledExactlyOnceWith('task', '2026-10-12', 'jamie');
    expect(screen.getByRole('button', { name: 'Mark done' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
