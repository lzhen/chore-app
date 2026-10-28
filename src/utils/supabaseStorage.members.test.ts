/**
 * Offline Nesmi member persistence contract. In-memory fixtures only:
 * no Supabase network calls, accounts or production writes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from './supabase';
import { createTeamMember, updateTeamMember, deleteTeamMember } from './supabaseStorage';
import type { TeamMember } from '../types';

const row = {
  id: 'synthetic-member',
  name: 'Synthetic User',
  color: '#99ccff',
  avatar_url: 'https://assets.invalid/existing.png',
  email: 'synthetic@example.invalid',
  skills: ['planning'],
  working_hours_start: '07:00',
  working_hours_end: '16:00',
  working_days: [] as number[],
  points: 0,
  badges: [] as string[],
  weekly_capacity_minutes: 0,
};
const member: TeamMember = {
  id: row.id,
  name: row.name,
  color: row.color,
  avatarUrl: 'data:image/png;base64,synthetic',
  email: row.email,
  skills: row.skills,
  workingHours: { start: '07:00', end: '16:00', days: [] },
  points: 0,
  badges: [],
  weeklyCapacityMinutes: 0,
};

function fixture(result: { data: typeof row | null; error: { message: string } | null } = { data: row, error: null }) {
  let payload: Record<string, unknown> | undefined;
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockImplementation((value: Record<string, unknown>) => {
    payload = value;
    return { eq };
  });
  const insert = vi.fn().mockImplementation((value: Record<string, unknown>) => {
    payload = value;
    return { select };
  });
  const from = vi.fn().mockReturnValue({ update, insert });
  // The common test setup mocks Supabase auth only; add an in-memory
  // table adapter for this isolated suite.
  Object.assign(supabase, { from });
  return { getPayload: () => payload, from, eq, update, insert };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('member profile database persistence', () => {
  it('updates every supported column and reads the authoritative DB row; never writes an avatar data URL', async () => {
    const db = fixture();
    const saved = await updateTeamMember(member);
    expect(db.from).toHaveBeenCalledWith('team_members');
    expect(db.eq).toHaveBeenCalledWith('id', member.id);
    expect(db.getPayload()).toEqual({
      name: member.name, color: member.color,
      email: member.email, skills: ['planning'],
      working_hours_start: '07:00', working_hours_end: '16:00',
      working_days: [], points: 0, badges: [], weekly_capacity_minutes: 0,
    });
    expect(db.getPayload()).not.toHaveProperty('avatar_url');
    expect(saved).toEqual({
      ...member,
      avatarUrl: row.avatar_url,
    });
    expect(saved.workingHours?.days).toEqual([]);
    expect(saved.weeklyCapacityMinutes).toBe(0);
  });

  it('sends null for unset optional profile fields without manufacturing default working hours', async () => {
    const db = fixture({
      data: { ...row, email: null as unknown as string, skills: null as unknown as string[], working_hours_start: null as unknown as string,
        working_hours_end: null as unknown as string, working_days: null as unknown as number[], weekly_capacity_minutes: null as unknown as number },
      error: null,
    });
    const saved = await updateTeamMember({
      id: row.id, name: row.name, color: row.color, points: 0, badges: [],
    });
    expect(db.getPayload()).toEqual({
      name: row.name, color: row.color, email: null, skills: null,
      working_hours_start: null, working_hours_end: null, working_days: null,
      points: 0, badges: [], weekly_capacity_minutes: null,
    });
    expect(saved.workingHours).toBeUndefined();
    expect(saved.weeklyCapacityMinutes).toBeUndefined();
  });

  it('throws on a rejected or empty database update rather than returning a false-success member', async () => {
    fixture({ data: null, error: { message: 'synthetic permission rejection' } });
    await expect(updateTeamMember(member)).rejects.toThrow('Could not update team member');
    fixture({ data: null, error: null });
    await expect(updateTeamMember(member)).rejects.toThrow('Could not update team member');
  });

  it('creates with the same supported persisted fields and never submits avatar data', async () => {
    const db = fixture();
    const { id: _id, ...withoutId } = member;
    const created = await createTeamMember(withoutId);
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.getPayload()).toMatchObject({
      email: row.email, points: 0, badges: [], weekly_capacity_minutes: 0,
      working_days: [],
    });
    expect(db.getPayload()).not.toHaveProperty('avatar_url');
    expect(created?.id).toBe(row.id);
  });

  it.each([
    ['null receipt', null],
    ['missing ID', { ...row, id: undefined }],
    ['empty ID', { ...row, id: '' }],
    ['whitespace-only ID', { ...row, id: '   ' }],
  ])('holds local member creation for %s to prevent duplicate retries', async (_reason, data) => {
    fixture({ data: data as typeof row | null, error: null });
    const { id: _id, ...withoutId } = member;
    await expect(createTeamMember(withoutId)).rejects.toThrow(
      'Team member save could not be confirmed. Refresh to check before trying again.',
    );
  });

  it('rejects a PostgREST error even if the response contains a member row', async () => {
    fixture({ data: row, error: { message: 'synthetic permission rejection' } });
    const { id: _id, ...withoutId } = member;
    await expect(createTeamMember(withoutId)).rejects.toThrow(
      'Team member save could not be confirmed. Refresh to check before trying again.',
    );
  });
});


function deletionFixture(result: { data: { id: string }[] | null; error: { message: string } | null }) {
  const select = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ select });
  const deleteRow = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ delete: deleteRow });
  Object.assign(supabase, { from });
  return { from, deleteRow, eq, select };
}

describe('team member removal acknowledgement', () => {
  it('confirms the exact deleted row before reporting success', async () => {
    const db = deletionFixture({ data: [{ id: member.id }], error: null });
    await expect(deleteTeamMember(member.id)).resolves.toBe(true);
    expect(db.from).toHaveBeenCalledWith('team_members');
    expect(db.deleteRow).toHaveBeenCalledOnce();
    expect(db.eq).toHaveBeenCalledWith('id', member.id);
    expect(db.select).toHaveBeenCalledWith('id');
  });

  it.each([
    ['RLS-hidden zero-row delete', { data: [], error: null }],
    ['null database response', { data: null, error: null }],
    ['unexpected deleted identity', { data: [{ id: 'other-member' }], error: null }],
    ['multiple deleted identities', { data: [{ id: member.id }, { id: 'other-member' }], error: null }],
    ['database error', { data: null, error: { message: 'synthetic rejection' } }],
  ])('rejects %s rather than falsely removing a member locally', async (_case, response) => {
    deletionFixture(response);
    await expect(deleteTeamMember(member.id)).rejects.toThrow('Could not delete team member');
  });
});
