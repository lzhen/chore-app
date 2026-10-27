/**
 * Offline Nesmi core chore mutation receipt gate. Synthetic PostgREST adapter
 * only: never calls a real database, touches users, or deletes actual chores.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from './supabase';
import { updateChore, deleteChore } from './supabaseStorage';
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
  it('accepts only the exact chore update and preserves the requested fields', async () => {
    const db = fixture({ data: [{ id: chore.id }], error: null });
    await expect(updateChore(chore)).resolves.toBe(true);
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
    expect(db.select).toHaveBeenCalledWith('id');
  });

  it.each([
    ['RLS-hidden zero rows', { data: [], error: null }],
    ['null server response', { data: null, error: null }],
    ['wrong acknowledged chore', { data: [{ id: 'other-chore' }], error: null }],
    ['multiple acknowledged rows', { data: [{ id: chore.id }, { id: 'other-chore' }], error: null }],
    ['explicit PostgREST error', { data: null, error: { message: 'synthetic denied' } }],
  ] satisfies Array<[string, Receipt]>)('rejects chore update with %s', async (_reason, response) => {
    fixture(response);
    await expect(updateChore(chore)).rejects.toThrow('Could not update chore');
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
