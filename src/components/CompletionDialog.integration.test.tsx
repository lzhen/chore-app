import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { AppProvider } from '../context/AppContext';
import { dateKey } from '../utils/dates';
import { ListView } from './ListView';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user' }, loading: false }),
}));
vi.mock('../utils/supabase', () => ({ supabase: { from } }));

afterEach(cleanup);

async function openUndoDialog(deleteOutcome: 'response-lost' | 'permission-denied') {
  const today = dateKey();
  const chores = [
    { id: 'dishes', title: 'Wash dishes' },
    { id: 'plants', title: 'Water plants' },
  ].map(chore => ({
    ...chore,
    date: today,
    assignee_id: 'member',
    recurrence: 'none',
  }));
  const completions = chores.map(chore => ({
    id: `${chore.id}-completion`,
    chore_id: chore.id,
    completed_by: 'member',
    instance_date: today,
    completed_at: `${today}T12:00:00Z`,
  }));

  const undoCompletion = vi.fn((_column: string, id: string) => ({
    select: async () => {
      if (deleteOutcome === 'permission-denied') {
        return { data: null, error: { message: 'Permission denied' } };
      }
      const index = completions.findIndex(completion => completion.id === id);
      if (index === -1) return { data: [], error: null };
      completions.splice(index, 1);
      return { data: null, error: { message: 'Failed to fetch' } };
    },
  }));
  from.mockImplementation((table: string) => {
    const rows = {
      chores,
      chore_completions: completions,
      team_members: [{ id: 'member', name: 'Alex', color: '#556247' }],
    };
    return {
      select: () => ({
        order: async () => ({ data: rows[table as keyof typeof rows] ?? [], error: null }),
      }),
      delete: table === 'chore_completions' ? () => ({ eq: undoCompletion }) : undefined,
    };
  });

  const user = userEvent.setup();
  render(
    <AppProvider>
      <ListView onAddClick={vi.fn()} onEventClick={vi.fn()} />
    </AppProvider>,
  );

  await user.click(await screen.findByRole('button', { name: 'Undo completion: Wash dishes' }));
  const dialog = screen.getByRole('dialog', { name: 'Undo completion' });
  const undo = within(dialog).getByRole('button', { name: 'Mark not done' });
  return { user, dialog, undo, undoCompletion, completions };
}

it('lets the user retry an undo when the saved deletion response is lost', async () => {
  const { user, dialog, undo, undoCompletion, completions } = await openUndoDialog('response-lost');
  await user.click(undo);

  expect(within(dialog).getByRole('alert')).toHaveTextContent('Please try again.');
  expect(undo).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Undo completion: Wash dishes' })).toBeInTheDocument();
  expect(completions.map(completion => completion.id)).toEqual(['plants-completion']);

  await user.click(undo);

  expect(screen.queryByRole('dialog', { name: 'Undo completion' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Complete: Wash dishes' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Undo completion: Water plants' })).toBeInTheDocument();
  expect(undoCompletion.mock.calls).toEqual([
    ['id', 'dishes-completion'],
    ['id', 'dishes-completion'],
  ]);
});

it('keeps the undo dialog open and the completion intact when deletion is denied', async () => {
  const { user, dialog, undo, undoCompletion, completions } = await openUndoDialog('permission-denied');
  await user.click(undo);

  expect(within(dialog).getByRole('alert')).toHaveTextContent('Please try again.');
  expect(undo).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Undo completion: Wash dishes' })).toBeInTheDocument();
  expect(completions.map(completion => completion.id)).toEqual(['dishes-completion', 'plants-completion']);
  expect(undoCompletion.mock.calls).toEqual([['id', 'dishes-completion']]);
});
