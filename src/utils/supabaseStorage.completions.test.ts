/**
 * Nesmi completion deletion receipt gate. Offline PostgREST fixtures only:
 * no real user records or production database requests are made.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from './supabase';
import { createCompletion, deleteCompletion } from './supabaseStorage';

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


describe('chore completion create receipt', () => {
  const payload = {
    choreId: 'synthetic-chore',
    instanceDate: '2026-10-27',
    completedBy: 'synthetic-member',
    completedAt: '2026-10-27T19:00:00.000Z',
    notes: 'Finished',
  };
  const saved = {
    id: completionId,
    chore_id: payload.choreId,
    instance_date: payload.instanceDate,
    completed_by: payload.completedBy,
    completed_at: payload.completedAt,
    notes: payload.notes,
  };

  function createFixture(response: { data: unknown; error: { message: string } | null }) {
    const single = vi.fn().mockResolvedValue(response);
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    Object.assign(supabase, { from });
    return { from, insert, select, single };
  }

  it('confirms only a server-created completion with a persisted ID', async () => {
    const db = createFixture({ data: saved, error: null });
    await expect(createCompletion(payload)).resolves.toMatchObject({
      id: completionId,
      choreId: payload.choreId,
      instanceDate: payload.instanceDate,
      completedBy: payload.completedBy,
    });
    expect(db.from).toHaveBeenCalledWith('chore_completions');
    expect(db.insert).toHaveBeenCalledWith({
      chore_id: payload.choreId,
      instance_date: payload.instanceDate,
      completed_by: payload.completedBy,
      completed_at: payload.completedAt,
      notes: payload.notes,
    });
    expect(db.select).toHaveBeenCalledOnce();
    expect(db.single).toHaveBeenCalledOnce();
  });

  it.each([
    ['null receipt', null],
    ['missing ID', { ...saved, id: undefined }],
    ['empty ID', { ...saved, id: '' }],
    ['whitespace-only ID', { ...saved, id: '  ' }],
  ])('rejects %s without confirming completion or encouraging duplicate retries', async (_name, data) => {
    createFixture({ data, error: null });
    await expect(createCompletion(payload)).rejects.toThrow(
      'Completion save could not be confirmed. Refresh to check before trying again.',
    );
  });

  it('rejects a PostgREST error even if data is present', async () => {
    createFixture({ data: saved, error: { message: 'synthetic denied' } });
    await expect(createCompletion(payload)).rejects.toThrow(
      'Could not save completion. Please check your connection before trying again.',
    );
  });
});
