import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProvider, useApp } from './AppContext';
import * as storage from '../utils/supabaseStorage';
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' }, loading: false }) }));
vi.mock('../utils/supabaseStorage');
const members = [{ id: 'alex', name: 'Alex', color: '#123456', points: 0, badges: [] }, { id: 'eric', name: 'Eric', color: '#654321', points: 0, badges: [] }];
const chores = [{ id: 'one', title: 'Dishes', date: '2026-10-10', assigneeId: 'alex', priority: 'low' as const, recurrence: 'none' as const }, { id: 'two', title: 'Laundry', date: '2026-10-10', assigneeId: 'eric', priority: 'low' as const, recurrence: 'none' as const }];
const completions = [{ id: 'completed-one', choreId: 'one', instanceDate: '2026-10-10', completedBy: 'alex', completedAt: '2026-10-10' }, { id: 'completed-two', choreId: 'two', instanceDate: '2026-10-10', completedBy: 'eric', completedAt: '2026-10-10' }];
const availability = [{ id: 'away-one', memberId: 'alex', startDate: '2026-10-10', endDate: '2026-10-11' }, { id: 'away-two', memberId: 'eric', startDate: '2026-10-10', endDate: '2026-10-11' }];
beforeEach(() => {
 vi.mocked(storage.fetchTeamMembers).mockResolvedValue(members);
 vi.mocked(storage.fetchChores).mockResolvedValue(chores);
 vi.mocked(storage.fetchCategories).mockResolvedValue([]);
 vi.mocked(storage.fetchCompletions).mockResolvedValue(completions);
 vi.mocked(storage.fetchAvailability).mockResolvedValue(availability);
});
afterEach(cleanup);
describe('member removal state matches database cascades', () => {
 it('unassigns their chores and removes only their availability and completion history', async () => {
  vi.mocked(storage.deleteTeamMember).mockResolvedValue(true);
  const { result } = renderHook(useApp, { wrapper: AppProvider });
  await waitFor(() => expect(result.current.state.loading).toBe(false));
  await act(async () => result.current.removeMember('alex'));
  expect(storage.deleteTeamMember).toHaveBeenCalledWith('alex');
  expect(result.current.state.teamMembers).toEqual([members[1]]);
  expect(result.current.state.chores).toEqual([{ ...chores[0], assigneeId: null }, chores[1]]);
  expect(result.current.state.completions).toEqual([completions[1]]);
  expect(result.current.state.availability).toEqual([availability[1]]);
 });
 it.each(['throw', 'false'])('preserves every record if storage reports %s', async mode => {
  if(mode === 'throw') vi.mocked(storage.deleteTeamMember).mockRejectedValueOnce(new Error('Offline'));
  else vi.mocked(storage.deleteTeamMember).mockResolvedValueOnce(false);
  const { result } = renderHook(useApp, { wrapper: AppProvider });
  await waitFor(() => expect(result.current.state.loading).toBe(false));
  await act(async () => { await expect(result.current.removeMember('alex')).rejects.toThrow(); });
  expect(result.current.state.teamMembers).toEqual(members);
  expect(result.current.state.chores).toEqual(chores);
  expect(result.current.state.completions).toEqual(completions);
  expect(result.current.state.availability).toEqual(availability);
 });
});


describe('chore deletion state matches database cascades', () => {
 it('removes only the selected chore and its completion history', async () => {
  vi.mocked(storage.deleteChore).mockResolvedValue(true);
  const {result}=renderHook(useApp,{wrapper:AppProvider});await waitFor(()=>expect(result.current.state.loading).toBe(false));
  await act(async()=>result.current.deleteChore('one'));
  expect(storage.deleteChore).toHaveBeenCalledWith('one');expect(result.current.state.chores).toEqual([chores[1]]);expect(result.current.state.completions).toEqual([completions[1]]);expect(result.current.state.teamMembers).toEqual(members);
 });
 it.each(['throw','false'])('preserves the chore and history when delete reports %s',async mode=>{
  if(mode==='throw')vi.mocked(storage.deleteChore).mockRejectedValueOnce(new Error('Offline'));else vi.mocked(storage.deleteChore).mockResolvedValueOnce(false);
  const {result}=renderHook(useApp,{wrapper:AppProvider});await waitFor(()=>expect(result.current.state.loading).toBe(false));
  await act(async()=>{await expect(result.current.deleteChore('one')).rejects.toThrow();});expect(result.current.state.chores).toEqual(chores);expect(result.current.state.completions).toEqual(completions);
 });
});
