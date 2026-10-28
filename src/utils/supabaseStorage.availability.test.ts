/**
 * Nesmi member-availability save/delete acknowledgement gates.
 * Offline PostgREST fixtures only: no company/real user data or live DB calls.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from './supabase';
import { deleteAvailability, updateAvailability } from './supabaseStorage';
import type { MemberAvailability } from '../types';

const record: MemberAvailability = {
  id: 'synthetic-availability-A',
  memberId: 'synthetic-member-A',
  startDate: '2026-11-02',
  endDate: '2026-11-04',
  reason: 'unavailable',
};
type Receipt = { data: { id: string }[] | null; error: { message: string } | null };

function updateFixture(response: Receipt) {
  const select = vi.fn().mockResolvedValue(response);
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  Object.assign(supabase, { from });
  return { from, update, eq, select };
}
function deleteFixture(response: Receipt) {
  const select = vi.fn().mockResolvedValue(response);
  const eq = vi.fn().mockReturnValue({ select });
  const deleteRow = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ delete: deleteRow });
  Object.assign(supabase, { from });
  return { from, deleteRow, eq, select };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('availability update receipt', () => {
  it('requires the one exact persisted availability ID', async () => {
    const db = updateFixture({ data: [{ id: record.id }], error: null });
    await expect(updateAvailability(record)).resolves.toBe(true);
    expect(db.from).toHaveBeenCalledWith('member_availability');
    expect(db.update).toHaveBeenCalledWith({
      member_id: record.memberId,
      start_date: record.startDate,
      end_date: record.endDate,
      reason: record.reason,
    });
    expect(db.eq).toHaveBeenCalledWith('id', record.id);
    expect(db.select).toHaveBeenCalledWith('id');
  });

  it.each([
    ['RLS-filtered zero rows', { data: [], error: null }],
    ['null database receipt', { data: null, error: null }],
    ['wrong availability ID', { data: [{ id: 'synthetic-availability-B' }], error: null }],
    ['multiple IDs', { data: [{ id: record.id }, { id: 'synthetic-availability-B' }], error: null }],
    ['database failure', { data: null, error: { message: 'synthetic permission error' } }],
  ] satisfies Array<[string, Receipt]>)('rejects a false save with %s', async (_name, receipt) => {
    updateFixture(receipt);
    await expect(updateAvailability(record)).rejects.toThrow('Could not update availability');
  });
});

describe('availability deletion receipt', () => {
  it('requires the one exact deleted availability ID', async () => {
    const db = deleteFixture({ data: [{ id: record.id }], error: null });
    await expect(deleteAvailability(record.id)).resolves.toBe(true);
    expect(db.from).toHaveBeenCalledWith('member_availability');
    expect(db.deleteRow).toHaveBeenCalledOnce();
    expect(db.eq).toHaveBeenCalledWith('id', record.id);
    expect(db.select).toHaveBeenCalledWith('id');
  });

  it.each([
    ['RLS-filtered zero rows', { data: [], error: null }],
    ['null database receipt', { data: null, error: null }],
    ['wrong availability ID', { data: [{ id: 'synthetic-availability-B' }], error: null }],
    ['multiple IDs', { data: [{ id: record.id }, { id: 'synthetic-availability-B' }], error: null }],
    ['database failure', { data: null, error: { message: 'synthetic permission error' } }],
  ] satisfies Array<[string, Receipt]>)('rejects a false deletion with %s', async (_name, receipt) => {
    deleteFixture(receipt);
    await expect(deleteAvailability(record.id)).rejects.toThrow('Could not delete availability');
  });
});
