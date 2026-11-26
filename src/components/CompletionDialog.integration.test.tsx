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

async function openFirstMemberDialog(firstSaveOutcome: 'denied' | 'response-lost') {
  const today = dateKey();
  const memberRows: { id: string; name: string; color: string }[] = [];
  const chores = [{ id: 'dishes', title: 'Wash dishes', date: today, assignee_id: null, recurrence: 'none' }];
  let finishFirstSave!: () => void;
  const firstSave = new Promise<void>(resolve => { finishFirstSave = resolve; });

  const insertMember = vi.fn((member: (typeof memberRows)[number]) => ({
    select: () => ({
      single: async () => {
        if (insertMember.mock.calls.length === 1) {
          await firstSave;
          if (firstSaveOutcome === 'denied') {
            return { data: null, error: { code: '42501' }, status: 403 };
          }
          memberRows.push(member);
          return { data: null, error: { message: 'Failed to fetch' }, status: 0 };
        }
        if (memberRows.some(row => row.id === member.id)) {
          return { data: null, error: { code: '23505' }, status: 409 };
        }
        memberRows.push(member);
        return { data: member, error: null, status: 201 };
      },
    }),
  }));
  const lookupMember = vi.fn((_column: string, id: string) => ({
    maybeSingle: async () => insertMember.mock.calls.length === 1
      ? { data: null, error: { message: 'Failed to fetch' } }
      : { data: memberRows.find(row => row.id === id) ?? null, error: null },
  }));
  const insertCompletion = vi.fn((completion: Record<string, unknown>) => ({
    select: () => ({
      single: async () => ({ data: { id: 'completion', ...completion }, error: null }),
    }),
  }));
  from.mockImplementation((table: string) => ({
    select: () => ({
      order: async () => ({ data: table === 'chores' ? chores : table === 'team_members' ? memberRows : [], error: null }),
      eq: table === 'team_members' ? lookupMember : undefined,
    }),
    insert: table === 'team_members' ? insertMember : insertCompletion,
  }));

  const user = userEvent.setup();
  render(
    <AppProvider>
      <ListView onAddClick={vi.fn()} onEventClick={vi.fn()} />
    </AppProvider>,
  );
  await user.click(await screen.findByRole('button', { name: 'Complete: Wash dishes' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Complete chore' }));
  return { user, dialog, finishFirstSave, memberRows, insertMember, lookupMember, insertCompletion };
}

it.each(['denied', 'response-lost'] as const)(
  'retries first-member setup after a %s save and requires explicit completion credit',
  async outcome => {
    const { user, dialog, finishFirstSave, memberRows, insertMember, lookupMember, insertCompletion } =
      await openFirstMemberDialog(outcome);
    const name = dialog.getByRole('textbox', { name: 'Family member name' });
    const add = dialog.getByRole('button', { name: 'Add member' });
    const markDone = dialog.getByRole('button', { name: 'Mark done' });
    expect(add).toBeDisabled();
    expect(markDone).toBeDisabled();
    await user.type(name, '  Alex  ');
    await user.click(add);

    expect(dialog.getByRole('button', { name: 'Adding…' })).toBeDisabled();
    expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeDisabled();
    expect(name).toBeDisabled();
    await user.keyboard('{Escape}{Enter}');
    expect(insertMember).toHaveBeenCalledTimes(1);
    expect(insertCompletion).not.toHaveBeenCalled();
    finishFirstSave();

    expect(await dialog.findByRole('alert')).toHaveTextContent('Please try again.');
    expect(name).toHaveValue('  Alex  ');
    expect(name).toHaveFocus();
    expect(add).toBeEnabled();
    expect(markDone).toBeDisabled();
    expect(memberRows).toHaveLength(outcome === 'response-lost' ? 1 : 0);
    const [{ id }] = insertMember.mock.calls[0];
    expect(lookupMember.mock.calls).toEqual(outcome === 'response-lost' ? [['id', id]] : []);

    await user.keyboard('{Enter}');
    const picker = await dialog.findByRole('combobox', { name: 'Who completed it?' });
    expect(picker).toHaveFocus();
    expect(picker).toHaveTextContent('Choose a family member');
    expect(dialog.queryByRole('alert')).not.toBeInTheDocument();
    expect(markDone).toBeDisabled();
    expect(insertCompletion).not.toHaveBeenCalled();
    expect(insertMember.mock.calls.map(([member]) => [member.id, member.name])).toEqual([[id, 'Alex'], [id, 'Alex']]);
    expect(memberRows).toHaveLength(1);
    expect(lookupMember.mock.calls).toEqual(outcome === 'response-lost' ? [['id', id], ['id', id]] : []);

    await user.keyboard('{Enter}');
    expect(dialog.getAllByRole('option')).toHaveLength(1);
    expect(dialog.getByRole('option', { name: 'Alex' })).toHaveAttribute('aria-selected', 'false');
    await user.keyboard('{Enter}');
    expect(markDone).toBeEnabled();
    expect(insertCompletion).not.toHaveBeenCalled();
    await user.click(markDone);
    expect(await screen.findByRole('button', { name: 'Undo completion: Wash dishes' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Complete chore' })).not.toBeInTheDocument();
    expect(insertCompletion.mock.calls).toEqual([[expect.objectContaining({ chore_id: 'dishes', completed_by: id })]]);
  },
);

it('recovers a first member after canceling and reopening the completion dialog', async () => {
  const { user, dialog, finishFirstSave, memberRows, insertMember, lookupMember, insertCompletion } =
    await openFirstMemberDialog('response-lost');
  await user.type(dialog.getByRole('textbox', { name: 'Family member name' }), 'Alex');
  await user.click(dialog.getByRole('button', { name: 'Add member' }));
  finishFirstSave();
  expect(await dialog.findByRole('alert')).toHaveTextContent('Please try again.');
  const [{ id }] = insertMember.mock.calls[0];
  expect(memberRows).toHaveLength(1);

  await user.click(dialog.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog', { name: 'Complete chore' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Complete: Wash dishes' }));
  const reopened = within(screen.getByRole('dialog', { name: 'Complete chore' }));
  await user.type(reopened.getByRole('textbox', { name: 'Family member name' }), 'Alex');
  await user.click(reopened.getByRole('button', { name: 'Add member' }));

  const picker = await reopened.findByRole('combobox', { name: 'Who completed it?' });
  expect(picker).toHaveTextContent('Choose a family member');
  expect(reopened.getByRole('button', { name: 'Mark done' })).toBeDisabled();
  expect(insertCompletion).not.toHaveBeenCalled();
  expect(insertMember.mock.calls.map(([member]) => member.id)).toEqual([id, id]);
  expect(lookupMember.mock.calls).toEqual([['id', id], ['id', id]]);
  expect(memberRows).toEqual([expect.objectContaining({ id, name: 'Alex' })]);
});

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
