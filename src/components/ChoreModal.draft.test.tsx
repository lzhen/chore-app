import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChoreModal } from './ChoreModal';
import { dateKey } from '../utils/dates';

const app = vi.hoisted(() => ({
  state: {teamMembers: [{id: 'alex', name: 'Alex'}], categories: [{id: 'cleaning', name: 'Cleaning'}]},
  addChore: vi.fn(), updateChore: vi.fn(), deleteChore: vi.fn(),
}));
vi.mock('../context/AppContext', () => ({useApp: () => app}));

describe('ChoreModal starter drafts', () => {
  beforeEach(() => {app.addChore.mockResolvedValue(undefined);});
  afterEach(cleanup);

  it('opens an editable suggestion without creating a chore, then saves the chosen owner and details', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ChoreModal isOpen onClose={onClose} defaultValues={{title: 'Wash dishes', recurrence: 'daily', estimatedMinutes: 15}}/>);

    expect(screen.getByRole('textbox', {name: 'What needs doing?'})).toHaveValue('Wash dishes');
    expect(screen.getByRole('combobox', {name: 'Who’s responsible?'})).toHaveValue('');
    expect(screen.getByRole('combobox', {name: 'Repeat'})).toHaveValue('daily');
    expect(screen.getByRole('spinbutton', {name: 'Estimated minutes · optional'})).toHaveValue(15);
    expect(app.addChore).not.toHaveBeenCalled();
    await user.clear(screen.getByRole('textbox', {name: 'What needs doing?'}));
    await user.type(screen.getByRole('textbox', {name: 'What needs doing?'}), 'Clean the kitchen');
    await user.selectOptions(screen.getByRole('combobox', {name: 'Who’s responsible?'}), 'alex');
    await user.selectOptions(screen.getByRole('combobox', {name: 'Repeat'}), 'weekly');
    await user.selectOptions(screen.getByRole('combobox', {name: 'Category'}), 'cleaning');
    await user.clear(screen.getByRole('spinbutton', {name: 'Estimated minutes · optional'}));
    await user.type(screen.getByRole('spinbutton', {name: 'Estimated minutes · optional'}), '20');
    await user.click(screen.getByRole('button', {name: 'Add chore'}));

    expect(app.addChore).toHaveBeenCalledOnce();
    expect(app.addChore).toHaveBeenCalledWith(expect.objectContaining({title: 'Clean the kitchen', date: dateKey(), assigneeId: 'alex', recurrence: 'weekly', estimatedMinutes: 20, categoryId: 'cleaning'}));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cancels an unchanged suggestion without saving', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ChoreModal isOpen onClose={onClose} defaultValues={{title: 'Do laundry', recurrence: 'weekly', estimatedMinutes: 45}}/>);
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(app.addChore).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('retains the edited draft when saving fails', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    app.addChore.mockRejectedValueOnce(new Error('Connection lost.'));
    render(<ChoreModal isOpen onClose={onClose} defaultValues={{title: 'Take out trash', recurrence: 'weekly', estimatedMinutes: 5}}/>);
    await user.click(screen.getByRole('button', {name: 'Add chore'}));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Connection lost. Your entries are still here.'));
    expect(screen.getByRole('textbox', {name: 'What needs doing?'})).toHaveValue('Take out trash');
    expect(screen.getByRole('spinbutton', {name: 'Estimated minutes · optional'})).toHaveValue(5);
    expect(onClose).not.toHaveBeenCalled();
  });
});
