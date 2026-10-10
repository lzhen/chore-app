import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findChore, generateResponse, parseUserInput } from './chatAgent';
import { dateKey, shiftDate } from './dates';
import type { Chore, ChoreCompletion } from '../types';

const chore = (id: string, title: string, date: string, overrides: Partial<Chore> = {}): Chore => ({ id, title, date, recurrence: 'none', assigneeId: null, priority: 'medium', ...overrides });
const completion = (choreId: string, instanceDate: string): ChoreCompletion => ({ id: `done-${choreId}`, choreId, instanceDate, completedBy: 'alex', completedAt: new Date().toISOString() });

describe('bounded local chore commands', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 10, 23, 30)); });
  afterEach(() => vi.useRealTimers());

  it.each(['How does this work?', 'What is the weather?', 'Clean the house', 'Can you add a chore called dishes?'])('leaves unsupported conversation read-only: %s', input => {
    expect(parseUserInput(input, [])).toEqual({ type: 'unknown' });
  });

  it('documents supported commands without claiming general AI or deletion', () => {
    const response = generateResponse(parseUserInput('help', []), { chores: [], teamMembers: [], completions: [] });
    expect(response.text).toContain('Simple commands');
    expect(response.text).toContain('review before saving');
    expect(response.text).toContain('Delete chores from their form');
    expect(response.text).not.toContain("Just type naturally");
  });

  it('prepares explicit adds with local calendar dates, time, and recurrence', () => {
    expect(parseUserInput('Add a chore called Water plants for tomorrow at 8pm daily', [])).toEqual({
      type: 'add_chore', data: { title: 'Water plants', date: shiftDate(dateKey(), 1), time: '20:00', recurrence: 'daily', priority: 'medium', assigneeName: undefined },
    });
    expect(parseUserInput('Add a chore called Dishes', []).data?.date).toBe(dateKey());
    expect(parseUserInput('Add a chore called Clean kitchen tomorrow', []).data).toMatchObject({ title: 'Clean kitchen', date: shiftDate(dateKey(), 1) });
  });

  it('validates explicit ISO dates and does not silently use today for an invalid stated date', () => {
    expect(parseUserInput('Add a chore called Dishes for 2026-11-15', []).data?.date).toBe('2026-11-15');
    expect(parseUserInput('Add a chore called Dishes for 2026-02-30', []).type).toBe('unknown');
    expect(parseUserInput('Add a chore called Dishes for someday', []).type).toBe('unknown');
  });

  it('lists recurrence-aware pending occurrences and excludes only completed dates', () => {
    const today = dateKey();
    const tomorrow = shiftDate(today, 1);
    const response = generateResponse({ type: 'list_chores' }, {
      chores: [chore('daily', 'Water plants', '2020-01-01', { recurrence: 'daily' }), chore('done', 'Already finished', today), chore('future', 'Far future', shiftDate(today, 35))],
      teamMembers: [], completions: [completion('daily', today), completion('done', today)],
    });
    expect(response.text).toContain('next 30 days');
    expect(response.text).toContain('Water plants - tomorrow');
    expect(response.text).not.toContain('Water plants - today');
    expect(response.text).not.toContain('Already finished');
    expect(response.text).not.toContain('Far future');
    expect(tomorrow).toBe('2026-10-11');
  });

  it('shows overdue recurring occurrences, retains old one-offs, and states the range', () => {
    const today = dateKey();
    const yesterday = shiftDate(today, -1);
    const response = generateResponse({ type: 'show_overdue' }, {
      chores: [chore('daily', 'Daily routine', yesterday, { recurrence: 'daily' }), chore('old', 'Old bill', '2000-01-01'), chore('done', 'Finished overdue', yesterday)],
      teamMembers: [], completions: [completion('done', yesterday)],
    });
    expect(response.text).toContain('Overdue occurrences (2)');
    expect(response.text).toContain('last 30 days');
    expect(response.text).toContain('Daily routine');
    expect(response.text).toContain('Old bill');
    expect(response.text).not.toContain('Finished overdue');
  });

  it('never chooses an arbitrary chore for an ambiguous completion or assignment', () => {
    const chores = [chore('one', 'Clean kitchen', dateKey()), chore('two', 'Clean bathroom', dateKey())];
    expect(findChore('Clean', chores)).toBeNull();
    expect(findChore('', chores)).toBeNull();
    expect(findChore('Clean kitchen', chores)?.id).toBe('one');
    expect(findChore('Clean kitchen', [...chores, chore('duplicate', 'Clean kitchen', dateKey())])).toBeNull();
  });

  it('parses full assignment titles and multi-word names instead of matching a single letter', () => {
    const members = [{ id: 'alex', name: 'Alex Jones', color: '#000', points: 0, badges: [] }];
    expect(parseUserInput('Alex Jones should do Clean kitchen', members)).toEqual({ type: 'assign_chore', data: { title: 'Clean kitchen', assigneeName: 'Alex Jones' } });
    expect(parseUserInput('Assign Clean kitchen to Alex Jones', members).data?.assigneeName).toBe('Alex Jones');
    expect(parseUserInput('Assign Clean kitchen to Alex Jones or someone else', members).data?.assigneeName).toBeUndefined();
  });

  it('counts completion instants within the last seven local days, not future scheduled dates', () => {
    const today = dateKey();
    const recent = completion('future-chore', shiftDate(today, 7));
    const future = { ...completion('other', today), completedAt: new Date(2026, 9, 11, 12).toISOString() };
    const response = generateResponse({ type: 'show_stats' }, { chores: [], teamMembers: [], completions: [recent, future] });
    expect(response.text).toContain('Done in the last 7 days (including today): 1');
  });
});
