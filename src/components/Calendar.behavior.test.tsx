import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarOptions, DateSelectArg, EventDropArg, EventInput } from '@fullcalendar/core';
import { EventResizeDoneArg } from '@fullcalendar/interaction';
import { Calendar } from './Calendar';
import { Chore, ChoreCompletion, TeamMember } from '../types';

const app = vi.hoisted(() => ({
  state: { chores: [] as Chore[], teamMembers: [] as TeamMember[], completions: [] as ChoreCompletion[] },
  updateChore: vi.fn(),
}));
const calendar = vi.hoisted(() => ({ props: {} as CalendarOptions, api: { unselect: vi.fn() } }));
vi.mock('../context/AppContext', () => ({ useApp: () => app }));
vi.mock('@fullcalendar/react', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return { default: forwardRef((props: CalendarOptions, ref) => {
    calendar.props = props;
    useImperativeHandle(ref, () => ({ getApi: () => calendar.api }));
    return <div data-testid="fullcalendar" />;
  }) };
});
const chore: Chore = { id: 'one', title: 'Water the plants', date: '2026-10-10', dueTime: '09:30', endTime: '10:30', assigneeId: 'alex', recurrence: 'none', priority: 'medium' };

function mount() {
  const onAddClick = vi.fn(), onEventClick = vi.fn();
  return { ...render(<Calendar onAddClick={onAddClick} onEventClick={onEventClick} />), onAddClick, onEventClick };
}
function drop({ recurring = false, allDay = false, choreId = 'one' } = {}) {
  return { event: { start: new Date(2026, 9, 12, 14, 30), allDay, extendedProps: { choreId, isRecurring: recurring } }, revert: vi.fn() } as unknown as EventDropArg;
}
function resize() {
  return { event: { start: new Date(2026, 9, 10, 9, 30), end: new Date(2026, 9, 10, 11), extendedProps: { choreId: 'one' } }, revert: vi.fn() } as unknown as EventResizeDoneArg;
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 10, 12));
  app.state.chores = [{ ...chore }];
  app.state.teamMembers = [{ id: 'alex', name: 'Alex', color: '#3b82f6', points: 0, badges: [] }];
  app.state.completions = [];
  app.updateChore.mockReset().mockResolvedValue(undefined);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('calendar scheduling contracts remain unchanged', () => {
  it('preserves drag, resize, selection, three-event overflow and keyboard interaction settings', () => {
    mount();
    expect(calendar.props).toMatchObject({ editable: true, selectable: true, selectMirror: true, dayMaxEvents: 3, eventDisplay: 'block', eventInteractive: true, nowIndicator: true, height: 'auto', expandRows: false, fixedWeekCount: false, allDaySlot: true, slotMinTime: '06:00:00', slotMaxTime: '22:00:00', scrollTime: '08:00:00' });
    expect(calendar.props.eventDrop).toEqual(expect.any(Function));
    expect(calendar.props.eventResize).toEqual(expect.any(Function));
    expect(calendar.props.select).toEqual(expect.any(Function));
    expect(calendar.props.timeZone).toBeUndefined();
  });

  it('forwards selected dates and local wall-clock times to the existing add flow', () => {
    const { onAddClick } = mount();
    act(() => calendar.props.select!({ startStr: '2026-10-12T09:30:00-07:00', endStr: '2026-10-12T11:00:00-07:00', allDay: false } as DateSelectArg));
    expect(onAddClick).toHaveBeenLastCalledWith({ date: '2026-10-12', startTime: '09:30', endTime: '11:00', allDay: false });
    act(() => calendar.props.select!({ startStr: '2026-10-12', endStr: '2026-10-13', allDay: true } as DateSelectArg));
    expect(onAddClick).toHaveBeenLastCalledWith({ date: '2026-10-12', startTime: undefined, endTime: undefined, allDay: true });
    expect(calendar.api.unselect).toHaveBeenCalledTimes(2);
    expect(app.updateChore).not.toHaveBeenCalled();
  });

  it('updates a single dragged event with the same local date/time payload', async () => {
    mount();
    const info = drop();
    await act(async () => calendar.props.eventDrop!(info));
    expect(app.updateChore).toHaveBeenCalledExactlyOnceWith({ ...chore, date: '2026-10-12', dueTime: '14:30', endTime: undefined });
    expect(info.revert).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('keeps recurring-series confirmation and reverts a declined move before any update', async () => {
    app.state.chores = [{ ...chore, recurrence: 'weekly' }];
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    mount();
    const declined = drop({ recurring: true });
    await act(async () => calendar.props.eventDrop!(declined));
    expect(window.confirm).toHaveBeenCalledWith('Move the entire repeating series? This changes all occurrences.');
    expect(declined.revert).toHaveBeenCalledOnce();
    expect(app.updateChore).not.toHaveBeenCalled();
    const accepted = drop({ recurring: true, allDay: true });
    await act(async () => calendar.props.eventDrop!(accepted));
    expect(app.updateChore).toHaveBeenCalledExactlyOnceWith({ ...chore, recurrence: 'weekly', date: '2026-10-12', dueTime: undefined, endTime: undefined });
  });

  it('preserves resize confirmation and writes only the existing time fields', async () => {
    app.state.chores = [{ ...chore, recurrence: 'daily' }];
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    mount();
    const declined = resize();
    await act(async () => calendar.props.eventResize!(declined));
    expect(window.confirm).toHaveBeenCalledWith('Change the time for the entire repeating series?');
    expect(declined.revert).toHaveBeenCalledOnce();
    expect(app.updateChore).not.toHaveBeenCalled();
    const accepted = resize();
    await act(async () => calendar.props.eventResize!(accepted));
    expect(app.updateChore).toHaveBeenCalledExactlyOnceWith({ ...chore, recurrence: 'daily', dueTime: '09:30', endTime: '11:00' });
  });

  it('reverts failed drags and resizes, keeps the error dismissible, and allows a later retry', async () => {
    const user = userEvent.setup();
    mount();
    app.updateChore.mockRejectedValueOnce(new Error('Synthetic move failure'));
    const moved = drop();
    await act(async () => calendar.props.eventDrop!(moved));
    expect(moved.revert).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent('Synthetic move failure');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    app.updateChore.mockRejectedValueOnce(new Error('Synthetic resize failure'));
    const resized = resize();
    await act(async () => calendar.props.eventResize!(resized));
    expect(resized.revert).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent('Synthetic resize failure');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    const retry = resize();
    await act(async () => calendar.props.eventResize!(retry));
    expect(retry.revert).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reverts stale events or incomplete resize dates without changing data', async () => {
    mount();
    const stale = drop({ choreId: 'missing' });
    await act(async () => calendar.props.eventDrop!(stale));
    expect(stale.revert).toHaveBeenCalledOnce();
    const incomplete = resize();
    Object.assign(incomplete.event, { end: null });
    await act(async () => calendar.props.eventResize!(incomplete));
    expect(incomplete.revert).toHaveBeenCalledOnce();
    expect(app.updateChore).not.toHaveBeenCalled();
  });

  it('retains recurrence expansion, all-day boundaries, midnight rollover and completion metadata', () => {
    app.state.chores = [{ ...chore, dueTime: '23:30', endTime: undefined }, { ...chore, id: 'daily', recurrence: 'daily', dueTime: undefined, endTime: undefined }];
    app.state.completions = [{ id: 'done', choreId: 'daily', instanceDate: '2026-10-10', completedBy: 'alex', completedAt: '2026-10-10T10:00:00Z', pointsEarned: 1 }];
    mount();
    const events = calendar.props.events as EventInput[];
    expect(events.find(event => event.id === 'one')).toMatchObject({ start: '2026-10-10T23:30:00', end: '2026-10-11T00:30:00', allDay: false });
    expect(events.find(event => event.id === 'daily-2026-10-10')).toMatchObject({ start: '2026-10-10', end: '2026-10-11', allDay: true, extendedProps: { isRecurring: true, isCompleted: true, instanceDate: '2026-10-10', memberColor: '#3b82f6' } });
    expect(events.find(event => event.id === 'daily-2026-10-11')).toBeDefined();
    expect(app.updateChore).not.toHaveBeenCalled();
  });

  it('keeps search and hidden-member filters applied to the same generated events', () => {
    app.state.chores.push({ ...chore, id: 'two', title: 'Clean the kitchen', assigneeId: null });
    const { rerender } = render(<Calendar onAddClick={vi.fn()} onEventClick={vi.fn()} searchQuery="Alex" />);
    expect((calendar.props.events as EventInput[]).map(event => event.id)).toEqual(['one']);
    rerender(<Calendar onAddClick={vi.fn()} onEventClick={vi.fn()} hiddenMembers={new Set(['alex'])} />);
    expect((calendar.props.events as EventInput[]).map(event => event.id)).toEqual(['two']);
  });
});
