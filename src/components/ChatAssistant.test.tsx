import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatAssistant } from './ChatAssistant';
import { dateKey, shiftDate } from '../utils/dates';
import type { Chore, ChoreCompletion, TeamMember } from '../types';

const app = vi.hoisted(() => ({
  state: { chores: [] as Chore[], teamMembers: [] as TeamMember[], completions: [] as ChoreCompletion[], categories: [] },
  addChore: vi.fn(), updateChore: vi.fn(), deleteChore: vi.fn(), completeChore: vi.fn(), uncompleteChore: vi.fn(),
}));
vi.mock('../context/AppContext', () => ({ useApp: () => app }));
const chore = (id: string, title: string, date: string, overrides: Partial<Chore> = {}): Chore => ({ id, title, date, assigneeId: null, recurrence: 'none', priority: 'medium', ...overrides });
async function command(text: string) {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: 'Chore command' }), text);
  await user.click(screen.getByRole('button', { name: 'Send command' }));
}

describe('Chore Assistant reviewed commands', () => {
  beforeEach(() => {
    Object.defineProperty(window,'innerWidth',{value:390,configurable:true});
    app.state.chores = [chore('dishes', 'Dishes', dateKey())];
    app.state.teamMembers = [{ id: 'alex', name: 'Alex', color: '#556247', points: 0, badges: [] }];
    app.state.completions = [];
    app.addChore.mockResolvedValue(undefined);
    app.updateChore.mockResolvedValue(undefined);
    app.completeChore.mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it('uses the labelled mobile assistant sheet with Escape dismissal', () => {
    const onClose = vi.fn();
    render(<ChatAssistant onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: 'Chore assistant' });
    expect(dialog).toHaveAttribute('aria-modal','true');
    expect(dialog.parentElement).not.toHaveClass('is-centered');
    expect(screen.getByText('Simple commands')).toBeInTheDocument();
    expect(screen.queryByText('AI')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send command' })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('restores the original launcher after a form swap and dismissal', async () => {
    const user = userEvent.setup();
    function Host() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>Open chat assistant</button>{open && <ChatAssistant onClose={() => setOpen(false)} />}</>;
    }
    render(<Host />);
    const launcher = screen.getByRole('button', { name: 'Open chat assistant' });
    await user.click(launcher);
    await command('Add a chore called Laundry');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Close chore assistant' }));
    await waitFor(() => expect(launcher).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the conversation and unsent command across close and reopen without opening the keyboard', async () => {
    const user=userEvent.setup();
    function Host(){const [open,setOpen]=useState(false);return <><button onClick={()=>setOpen(true)}>Open assistant</button><ChatAssistant open={open} onClose={()=>setOpen(false)}/></>;}
    render(<Host/>);
    const launcher=screen.getByRole('button',{name:'Open assistant'});
    await user.click(launcher);
    await waitFor(()=>expect(screen.getByRole('textbox',{name:'Chore command'})).not.toHaveFocus());
    await user.click(screen.getByRole('button',{name:'Show chores'}));
    expect(screen.getByRole('log')).toHaveTextContent('Dishes - today');
    await user.type(screen.getByRole('textbox',{name:'Chore command'}),'an unsent draft');
    await user.click(screen.getByRole('button',{name:'Close chore assistant'}));
    await waitFor(()=>expect(launcher).toHaveFocus());
    await user.click(launcher);
    expect(screen.getByRole('textbox',{name:'Chore command'})).toHaveValue('an unsent draft');
    expect(screen.getByRole('log')).toHaveTextContent('Dishes - today');
    expect(app.addChore).not.toHaveBeenCalled();
  });

  it('lists and explains supported commands, while unsupported text never creates a task', async () => {
    const user = userEvent.setup();
    render(<ChatAssistant onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Show chores' }));
    expect(screen.getByRole('log')).toHaveTextContent('Dishes - today');
    await user.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.getByRole('log')).toHaveTextContent('Simple commands:');
    await command('How does this work?');
    expect(screen.getByRole('log')).toHaveTextContent("I'm not sure what you mean");
    expect(app.addChore).not.toHaveBeenCalled();
    expect(app.updateChore).not.toHaveBeenCalled();
    expect(app.completeChore).not.toHaveBeenCalled();
  });

  it('requires review before adding, saves through the existing form, and restores the chat', async () => {
    const user = userEvent.setup();
    render(<ChatAssistant onClose={vi.fn()} />);
    await command('Add a chore called Water plants for tomorrow at 8pm daily');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    const form = screen.getByRole('dialog', { name: 'Add a chore' });
    expect(within(form).getByLabelText('Chore')).toHaveValue('Water plants');
    expect(within(form).getByLabelText('Date')).toHaveValue(shiftDate(dateKey(), 1));
    expect(within(form).getByRole('combobox', { name: 'Repeat' })).toHaveTextContent('Every day');
    expect(app.addChore).not.toHaveBeenCalled();
    await user.click(within(form).getByRole('button', { name: 'Add chore' }));
    expect(app.addChore).toHaveBeenCalledOnce();
    expect(app.addChore).toHaveBeenCalledWith(expect.objectContaining({ title: 'Water plants', date: shiftDate(dateKey(), 1), dueTime: '20:00', recurrence: 'daily', assigneeId: null }));
    expect(screen.getByRole('dialog', { name: 'Chore assistant' })).toBeInTheDocument();
    expect(screen.getByRole('log')).toHaveTextContent('Add a chore called Water plants');
  });

  it('keeps failed adds in the form and cancels without saving or closing chat', async () => {
    const user = userEvent.setup();
    app.addChore.mockRejectedValue(new Error('Could not save this chore.'));
    render(<ChatAssistant onClose={vi.fn()} />);
    await command('Add a chore called Laundry for tomorrow');
    await user.click(screen.getByRole('button', { name: 'Add chore' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save this chore.');
    expect(screen.getByLabelText('Chore')).toHaveValue('Laundry');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog', { name: 'Chore assistant' })).toBeInTheDocument();
    expect(app.addChore).toHaveBeenCalledOnce();
    expect(screen.getByRole('log')).not.toHaveTextContent('has been added');
  });

  it('cancels an untouched add draft without any mutation', async () => {
    const user = userEvent.setup();
    render(<ChatAssistant onClose={vi.fn()} />);
    await command('Add a chore called Laundry');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(app.addChore).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Chore assistant' })).toBeInTheDocument();
  });

  it('requires explicit completion credit and preserves the actual overdue date', async () => {
    const user = userEvent.setup();
    const yesterday = shiftDate(dateKey(), -1);
    app.state.chores = [chore('dishes', 'Dishes', yesterday)];
    render(<ChatAssistant onClose={vi.fn()} />);
    await command('Complete dishes');
    const dialog = screen.getByRole('dialog', { name: 'Complete chore' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(within(dialog).getByRole('button', { name: 'Mark done' })).toBeDisabled();
    expect(app.completeChore).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('combobox', { name: 'Who completed it?' }));
    await user.click(within(dialog).getByRole('option', { name: 'Alex' }));
    await user.click(within(dialog).getByRole('button', { name: 'Mark done' }));
    expect(app.completeChore).toHaveBeenCalledWith('dishes', yesterday, 'alex');
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Chore assistant' })).toBeInTheDocument());
  });

  it('uses today’s recurring occurrence and never undoes an already completed occurrence', async () => {
    const user = userEvent.setup();
    app.state.chores = [chore('dishes', 'Dishes', '2020-01-01', { recurrence: 'daily', assigneeId: 'alex' })];
    render(<ChatAssistant onClose={vi.fn()} />);
    await command('Complete dishes');
    await user.click(screen.getByRole('button', { name: 'Mark done' }));
    expect(app.completeChore).toHaveBeenCalledWith('dishes', dateKey(), 'alex');
    app.state.completions = [{ id: 'done', choreId: 'dishes', instanceDate: dateKey(), completedBy: 'alex', completedAt: new Date().toISOString() }];
    await command('Complete dishes');
    expect(screen.getByRole('log')).toHaveTextContent('already complete');
    expect(app.completeChore).toHaveBeenCalledOnce();
    expect(app.uncompleteChore).not.toHaveBeenCalled();
  });

  it('keeps completion failures reviewable and does not claim success', async () => {
    const user = userEvent.setup();
    app.state.chores[0].assigneeId = 'alex';
    app.completeChore.mockRejectedValue(new Error('Completion unavailable.'));
    render(<ChatAssistant onClose={vi.fn()} />);
    await command('Complete dishes');
    await user.click(screen.getByRole('button', { name: 'Mark done' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Completion unavailable.');
    expect(screen.getByRole('dialog', { name: 'Complete chore' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('log')).not.toHaveTextContent('marked as complete');
  });

  it('routes an ambiguous or future completion to a safe read-only response', async () => {
    app.state.chores = [chore('one', 'Clean kitchen', dateKey()), chore('two', 'Clean bathroom', dateKey()), chore('future', 'Laundry', shiftDate(dateKey(), 1))];
    render(<ChatAssistant onClose={vi.fn()} />);
    await command('Complete clean');
    expect(screen.getByRole('log')).toHaveTextContent('one unique chore');
    await command('Complete laundry');
    expect(screen.getByRole('log')).toHaveTextContent('choose the occurrence');
    expect(app.completeChore).not.toHaveBeenCalled();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
});
