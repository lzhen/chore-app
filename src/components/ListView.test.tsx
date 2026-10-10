import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ListView } from './ListView';
import { dateKey, shiftDate } from '../utils/dates';
import type { Chore, ChoreCompletion, TeamMember } from '../types';

const app = vi.hoisted(() => ({
  state: {chores: [] as Chore[], teamMembers: [] as TeamMember[], categories: [{id: 'cleaning', name: 'Cleaning', color: '#556247'}], completions: [] as ChoreCompletion[]},
  completeChore: vi.fn(), uncompleteChore: vi.fn(),
}));
vi.mock('../context/AppContext', () => ({useApp: () => app}));

function chore(id: string, title: string, date: string, overrides: Partial<Chore> = {}): Chore {
  return {id, title, date, assigneeId: 'member-1', recurrence: 'none', priority: 'medium', ...overrides};
}

describe('ListView day scope and progress', () => {
  beforeEach(() => {
    const today = dateKey();
    app.state.teamMembers = [{id: 'member-1', name: 'Alex', color: '#556247', points: 0, badges: []}];
    app.state.chores = [
      chore('done', 'Wash dishes', today, {estimatedMinutes: 10}),
      chore('pending', 'Laundry', today, {estimatedMinutes: 15, categoryId: 'cleaning'}),
      chore('unestimated', 'Water plants', today, {assigneeId: null}),
      chore('overdue', 'Laundry backlog', shiftDate(today, -1), {estimatedMinutes: 50}),
      chore('future', 'Laundry next week', shiftDate(today, 7), {estimatedMinutes: 30}),
    ];
    app.state.completions = [{id: 'completion-1', choreId: 'done', instanceDate: today, completedBy: 'member-1', completedAt: new Date().toISOString()}];
    app.completeChore.mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it('keeps overdue out of the selected-day denominator and estimates only pending day chores', () => {
    render(<ListView todayView onAddClick={vi.fn()} onEventClick={vi.fn()}/>);

    const progress = screen.getByRole('progressbar', {name: '1 of 3 chores completed on Today'});
    expect(progress).toHaveAttribute('value', '1');
    expect(progress).toHaveAttribute('max', '3');
    expect(screen.getByText('~15 min')).toBeInTheDocument();
    expect(screen.getByText('Estimates set for 1 of 2 remaining chores.')).toBeInTheDocument();
    const overdueGroup = screen.getByRole('heading', {name: /^Overdue\s+1$/}).parentElement!;
    expect(within(overdueGroup).getByRole('button', {name: 'Edit Laundry backlog'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Edit Laundry'})).toHaveTextContent('Alex · Today');
    expect(screen.getByRole('button', {name: 'Edit Laundry'})).toHaveTextContent('Cleaning · 15 min');
    expect(screen.queryByRole('button', {name: 'Edit Laundry next week'})).not.toBeInTheDocument();
  });

  it('searches only the selected day and overdue without changing the progress denominator', () => {
    render(<ListView todayView searchQuery="Laundry" onAddClick={vi.fn()} onEventClick={vi.fn()}/>);

    expect(screen.getByRole('button', {name: 'Edit Laundry'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Edit Laundry backlog'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Edit Laundry next week'})).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar', {name: '1 of 3 chores completed on Today'})).toHaveAttribute('max', '3');
    expect(screen.getByText('2 chores · this day + overdue')).toBeInTheDocument();
  });

  it('updates progress for the selected day and excludes overdue when browsing another day', async () => {
    const user = userEvent.setup();
    render(<ListView todayView onAddClick={vi.fn()} onEventClick={vi.fn()}/>);
    await user.click(screen.getByRole('button', {name: 'Next week'}));

    expect(screen.getByRole('progressbar')).toHaveAttribute('max', '1');
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '0');
    expect(screen.getByText('~30 min')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Edit Laundry next week'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Edit Laundry backlog'})).not.toBeInTheDocument();
  });

  it('clears member and parent-owned search/visibility filters from an empty result', async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    const {rerender} = render(<ListView todayView searchQuery="not found" onAddClick={vi.fn()} onEventClick={vi.fn()} onClearFilters={onClearFilters}/>);
    await user.selectOptions(screen.getByRole('combobox', {name: 'Filter by family member'}), 'unassigned');
    await user.click(screen.getAllByRole('button', {name: 'Clear filters'})[1]);

    expect(screen.getByRole('combobox', {name: 'Filter by family member'})).toHaveValue('everyone');
    expect(onClearFilters).toHaveBeenCalledOnce();
    rerender(<ListView todayView onAddClick={vi.fn()} onEventClick={vi.fn()} onClearFilters={onClearFilters}/>);
    expect(screen.getByRole('button', {name: 'Edit Laundry'})).toBeInTheDocument();
  });

  it('labels all-date search in List view', () => {
    render(<ListView searchQuery="Laundry" onAddClick={vi.fn()} onEventClick={vi.fn()}/>);
    expect(screen.getByRole('heading', {name: /Search results · all dates/})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Edit Laundry next week'})).toBeInTheDocument();
  });

  it('retains today’s daily recurrence when an old one-off chore exists', () => {
    app.state.chores = [
      chore('old', 'Old one-off', '2000-01-01'),
      chore('daily', 'Daily routine', '2020-01-01', {recurrence: 'daily', estimatedMinutes: 5}),
    ];
    app.state.completions = [];
    render(<ListView todayView onAddClick={vi.fn()} onEventClick={vi.fn()}/>);

    expect(screen.getByRole('progressbar', {name: '0 of 1 chores completed on Today'})).toBeInTheDocument();
    const todayGroup = screen.getByRole('heading', {name: /Up for today/}).parentElement!;
    expect(within(todayGroup).getByRole('button', {name: 'Edit Daily routine'})).toHaveTextContent('Today');
    expect(screen.getByRole('button', {name: 'Edit Old one-off'})).toBeInTheDocument();
  });

  it('requires explicit credit before completing an unassigned chore', async () => {
    const user = userEvent.setup();
    render(<ListView todayView onAddClick={vi.fn()} onEventClick={vi.fn()}/>);
    await user.click(screen.getByRole('button', {name: 'Complete: Water plants'}));
    const dialog = screen.getByRole('dialog', {name: 'Complete chore'});
    expect(within(dialog).getByRole('button', {name: 'Mark done'})).toBeDisabled();
    expect(app.completeChore).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('combobox', {name: 'Who completed it?'}));
    await user.click(within(dialog).getByRole('option', {name: 'Alex'}));
    await user.click(within(dialog).getByRole('button', {name: 'Mark done'}));
    expect(app.completeChore).toHaveBeenCalledWith('unestimated', dateKey(), 'member-1');
  });
});
