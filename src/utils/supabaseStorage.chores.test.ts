/**
 * Offline Nesmi core chore mutation receipt gate. Synthetic PostgREST adapter
 * only: never calls a real database, touches users, or deletes actual chores.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from './supabase';
import { createChore, updateChore, deleteChore } from './supabaseStorage';
import type { Chore } from '../types';

const chore: Chore = {
  id: 'synthetic-chore',
  title: 'Clean the desk',
  date: '2026-10-27',
  assigneeId: null,
  recurrence: 'none',
  priority: 'medium',
  estimatedMinutes: 15,
};
type Receipt = { data: { id: string }[] | null; error: { message: string } | null };

function fixture(response: Receipt) {
  const select = vi.fn().mockResolvedValue(response);
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
  const deleteRow = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update, delete: deleteRow });
  Object.assign(supabase, { from });
  return { from, update, deleteRow, eq, select };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('core chore mutation acknowledgement', () => {
  it('returns the exact updated database row instead of optimistic browser fields', async () => {
    const persisted = {
      id: chore.id,
      title: 'Server-normalized title',
      description: null,
      date: chore.date,
      due_time: null,
      end_time: null,
      assignee_id: null,
      recurrence: 'none',
      priority: 'medium',
      category_id: null,
      estimated_minutes: 10,
    };
    const db = fixture({ data: [persisted], error: null });
    await expect(updateChore(chore)).resolves.toMatchObject({
      id: chore.id,
      title: 'Server-normalized title',
      estimatedMinutes: 10,
    });
    expect(db.from).toHaveBeenCalledWith('chores');
    expect(db.update).toHaveBeenCalledWith({
      title: 'Clean the desk',
      description: null,
      date: '2026-10-27',
      due_time: null,
      end_time: null,
      assignee_id: null,
      recurrence: 'none',
      priority: 'medium',
      category_id: null,
      estimated_minutes: 15,
    });
    expect(db.eq).toHaveBeenCalledWith('id', chore.id);
    expect(db.select).toHaveBeenCalledWith('*');
  });

  it.each([
    ['RLS-hidden zero rows', { data: [], error: null }],
    ['null server response', { data: null, error: null }],
    ['wrong acknowledged chore', { data: [{ id: 'other-chore' }], error: null }],
    ['multiple acknowledged rows', { data: [{ id: chore.id }, { id: 'other-chore' }], error: null }],
    ['explicit PostgREST error', { data: null, error: { message: 'synthetic denied' } }],
  ] satisfies Array<[string, Receipt]>)('rejects chore update with %s', async (_reason, response) => {
    fixture(response);
    await expect(updateChore(chore)).rejects.toThrow('Could not confirm updated chore');
  });

  it('accepts only the exact chore deletion', async () => {
    const db = fixture({ data: [{ id: chore.id }], error: null });
    await expect(deleteChore(chore.id)).resolves.toBe(true);
    expect(db.from).toHaveBeenCalledWith('chores');
    expect(db.deleteRow).toHaveBeenCalledOnce();
    expect(db.eq).toHaveBeenCalledWith('id', chore.id);
    expect(db.select).toHaveBeenCalledWith('id');
  });

  it.each([
    ['RLS-hidden zero rows', { data: [], error: null }],
    ['null server response', { data: null, error: null }],
    ['wrong acknowledged chore', { data: [{ id: 'other-chore' }], error: null }],
    ['multiple acknowledged rows', { data: [{ id: chore.id }, { id: 'other-chore' }], error: null }],
    ['explicit PostgREST error', { data: null, error: { message: 'synthetic denied' } }],
  ] satisfies Array<[string, Receipt]>)('rejects chore deletion with %s', async (_reason, response) => {
    fixture(response);
    await expect(deleteChore(chore.id)).rejects.toThrow('Could not delete chore');
  });
});


// A null/ID-less INSERT acknowledgement is not proof that the server did
// nothing. The user must refresh before retrying to avoid duplicate chores.
describe('core chore create acknowledgement', () => {
  const payload: Omit<Chore, 'id'> = {
    title: chore.title,
    date: chore.date,
    assigneeId: chore.assigneeId,
    recurrence: chore.recurrence,
    priority: chore.priority,
    estimatedMinutes: chore.estimatedMinutes,
  };
  const saved = {
    id: chore.id,
    title: chore.title,
    description: null,
    date: chore.date,
    due_time: null,
    end_time: null,
    assignee_id: null,
    recurrence: 'none',
    priority: 'medium',
    category_id: null,
    estimated_minutes: 15,
  };

  function createFixture(response: { data: unknown; error: { message: string } | null }) {
    const single = vi.fn().mockResolvedValue(response);
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    Object.assign(supabase, { from });
    return { from, insert, select, single };
  }

  it('requires a persisted chore with a nonempty database ID', async () => {
    const db = createFixture({ data: saved, error: null });
    await expect(createChore(payload)).resolves.toMatchObject({
      id: chore.id,
      title: chore.title,
      date: chore.date,
    });
    expect(db.from).toHaveBeenCalledWith('chores');
    expect(db.insert).toHaveBeenCalledWith({
      title: chore.title,
      description: null,
      date: chore.date,
      due_time: null,
      end_time: null,
      assignee_id: null,
      recurrence: 'none',
      priority: 'medium',
      category_id: null,
      estimated_minutes: 15,
    });
    expect(db.select).toHaveBeenCalledOnce();
    expect(db.single).toHaveBeenCalledOnce();
  });

  it.each([
    ['null acknowledgement', null],
    ['missing ID', { ...saved, id: undefined }],
    ['blank ID', { ...saved, id: '' }],
    ['whitespace-only ID', { ...saved, id: '   ' }],
  ])('holds the form and warns against blind retries on %s', async (_name, data) => {
    createFixture({ data, error: null });
    await expect(createChore(payload)).rejects.toThrow(
      'Chore save could not be confirmed. Refresh to check before trying again.',
    );
  });

  it('rejects an explicit database error without returning a local chore', async () => {
    createFixture({ data: saved, error: { message: 'synthetic constraint rejection' } });
    await expect(createChore(payload)).rejects.toThrow(
      'Could not save chore. Please check your connection before trying again.',
    );
  });
});
