/**
 * Nesmi completion deletion receipt gate. Offline PostgREST fixtures only:
 * no real user records or production database requests are made.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from './supabase';
import { deleteCompletion } from './supabaseStorage';

const completionId = 'synthetic-completion';
type Receipt = { data: { id: string }[] | null; error: { message: string } | null };

function fixture(response: Receipt) {
  const select = vi.fn().mockResolvedValue(response);
  const eq = vi.fn().mockReturnValue({ select });
  const deleteRow = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ delete: deleteRow });
  Object.assign(supabase, { from });
  return { from, deleteRow, eq, select };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('chore completion deletion receipt', () => {
  it('acknowledges only the exact completion ID before the UI may remove it', async () => {
    const db = fixture({ data: [{ id: completionId }], error: null });
    await expect(deleteCompletion(completionId)).resolves.toBe(true);
    expect(db.from).toHaveBeenCalledWith('chore_completions');
    expect(db.deleteRow).toHaveBeenCalledOnce();
    expect(db.eq).toHaveBeenCalledWith('id', completionId);
    expect(db.select).toHaveBeenCalledWith('id');
  });

  it.each([
    ['RLS-hidden zero rows', { data: [], error: null }],
    ['null response', { data: null, error: null }],
    ['wrong completion ID', { data: [{ id: 'other-completion' }], error: null }],
    ['multiple completion IDs', { data: [{ id: completionId }, { id: 'other-completion' }], error: null }],
    ['server rejected deletion', { data: null, error: { message: 'synthetic denied' } }],
  ] satisfies Array<[string, Receipt]>)('rejects completion deletion with %s', async (_name, response) => {
    fixture(response);
    await expect(deleteCompletion(completionId)).rejects.toThrow('Could not delete completion');
  });
});
