import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChoreModal } from './ChoreModal';
import { dateKey } from '../utils/dates';

const app = vi.hoisted(() => ({
  state: {teamMembers: [{id: 'alex', name: 'Alex'}], categories: [{id: 'cleaning', name: 'Cleaning'}], completions: [] as {id:string;choreId:string;instanceDate:string}[]},
  addChore: vi.fn(), updateChore: vi.fn(), deleteChore: vi.fn(), uncompleteChore: vi.fn(),
}));
vi.mock('../context/AppContext', () => ({useApp: () => app}));

describe('ChoreModal starter drafts', () => {
  beforeEach(() => {app.state.completions=[];app.addChore.mockResolvedValue(undefined);});
  afterEach(cleanup);

  it('opens an editable suggestion without creating a chore, then saves the chosen owner and details', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ChoreModal isOpen onClose={onClose} defaultValues={{title: 'Wash dishes', recurrence: 'daily', estimatedMinutes: 15}}/>);

    expect(screen.getByRole('textbox', {name: 'What needs doing?'})).toHaveValue('Wash dishes');
    expect(screen.getByRole('combobox', {name: 'Who’s responsible?'})).toHaveTextContent('Unassigned — decide later');
    expect(screen.getByRole('combobox', {name: 'Repeat'})).toHaveTextContent('Every day');
    expect(screen.getByRole('spinbutton', {name: 'Estimated minutes · optional'})).toHaveValue(15);
    expect(app.addChore).not.toHaveBeenCalled();
    await user.clear(screen.getByRole('textbox', {name: 'What needs doing?'}));
    await user.type(screen.getByRole('textbox', {name: 'What needs doing?'}), 'Clean the kitchen');
    await user.click(screen.getByRole('combobox', {name: 'Who’s responsible?'})); await user.click(screen.getByRole('option', {name: 'Alex'}));
    await user.click(screen.getByRole('combobox', {name: 'Repeat'})); await user.click(screen.getByRole('option', {name: 'Every week'}));
    await user.click(screen.getByRole('combobox', {name: 'Category'})); await user.click(screen.getByRole('option', {name: 'Cleaning'}));
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
  it('keeps untouched defaults and same-date selection clean', async () => {
    const user=userEvent.setup(); const onClose=vi.fn();
    render(<ChoreModal isOpen onClose={onClose} defaultDate="2026-10-16"/>);
    await user.click(screen.getByRole('button',{name:'Choose date'}));
    await user.click(screen.getByRole('button',{name:'Close calendar'}));
    await user.click(screen.getByRole('button',{name:'Choose date'}));
    await user.click(screen.getByRole('button',{name:'Friday, October 16, 2026'}));
    await user.click(screen.getByRole('button',{name:'Cancel'}));
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog',{name:'Discard changes?'})).not.toBeInTheDocument();
  });
  it('preserves a changed draft through Keep editing and becomes clean after reverting', async () => {
    const user=userEvent.setup(); const onClose=vi.fn();
    render(<ChoreModal isOpen onClose={onClose} defaultDate="2026-10-16"/>);
    const title=screen.getByRole('textbox',{name:'What needs doing?'});
    await user.type(title,'Clean kitchen floor');
    await user.click(screen.getByRole('button',{name:'Cancel'}));
    expect(screen.getByRole('dialog',{name:'Discard changes?'})).toBeInTheDocument();
    await user.click(screen.getByRole('button',{name:'Keep editing'}));
    expect(title).toHaveValue('Clean kitchen floor');
    await user.clear(title);
    await user.click(screen.getByRole('button',{name:'Cancel'}));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('protects real date changes and discards only on request', async () => {
    const user=userEvent.setup();const onClose=vi.fn();
    render(<ChoreModal isOpen onClose={onClose} defaultDate="2026-10-16"/>);
    await user.click(screen.getByRole('button',{name:'Choose date'}));
    await user.click(screen.getByRole('button',{name:'Saturday, October 17, 2026'}));
    await user.click(screen.getByRole('button',{name:'Cancel'}));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog',{name:'Discard changes?'})).toBeInTheDocument();
    expect(screen.queryByText('Your changes have not been saved.')).toBeNull();
    await user.click(screen.getByRole('button',{name:/^Discard$/}));
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('retains undo in task details without saving unrelated draft edits', async () => {
    app.state.completions=[{id:'completion-demo',choreId:'done',instanceDate:'2026-10-16'}];
    const user=userEvent.setup();
    render(<ChoreModal isOpen onClose={vi.fn()} editChore={{id:'done',title:'Clean kitchen floor',date:'2026-10-16',recurrence:'none',priority:'medium',assigneeId:null}}/>);
    await user.click(screen.getByRole('button',{name:'Mark not done'}));
    expect(app.uncompleteChore).toHaveBeenCalledWith('completion-demo');
    expect(app.updateChore).not.toHaveBeenCalled();
  });

});
