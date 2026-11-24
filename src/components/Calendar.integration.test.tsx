import { Calendar as FullCalendarCore, type CalendarOptions, type EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { forwardRef } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { AppProvider } from '../context/AppContext';
import type { RecurrenceType } from '../types';
import { dateKey, shiftDate } from '../utils/dates';
import { Calendar } from './Calendar';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
let options: CalendarOptions;

vi.mock('@fullcalendar/react', () => ({
  default: forwardRef<unknown, CalendarOptions>((props, _ref) => {
    options = props;
    return null;
  }),
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'test-user' }, loading: false }),
}));
vi.mock('../utils/supabase', () => ({ supabase: { from } }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type ChoreSchedule = {
  date: string;
  due_time: string | null;
  end_time: string | null;
  recurrence: RecurrenceType;
};

function fixture(schedule: Partial<ChoreSchedule> = {}) {
  const row = {
    id: 'laundry',
    title: 'Do the laundry',
    assignee_id: null,
    date: dateKey(),
    due_time: '08:17:00',
    end_time: '09:54:00',
    recurrence: 'none',
    ...schedule,
  };
  const update = vi.fn((values: Partial<ChoreSchedule>) => ({
    eq: (_column: string, id: string) => ({
      select: async () => {
        expect(id).toBe(row.id);
        Object.assign(row, values);
        return { data: [{ id }], error: null };
      },
    }),
  }));
  from.mockImplementation((table: string) => ({
    select: () => ({
      order: async () => ({ data: table === 'chores' ? [row] : [], error: null }),
    }),
    update,
  }));
  const mount = () => render(
    <AppProvider>
      <Calendar onAddClick={vi.fn()} onEventClick={vi.fn()} />
    </AppProvider>,
  );
  return { date: row.date, update, mount };
}

async function findOccurrence(date: string) {
  return waitFor(() => {
    const event = (options.events as EventInput[]).find(item =>
      String(item.start).split('T')[0] === date,
    );
    expect(event).toBeDefined();
    return event!;
  });
}

async function gesture(date: string, destination: Pick<EventInput, 'start' | 'end' | 'allDay'>) {
  const original = await findOccurrence(date);
  const el = document.createElement('div');
  const calendar = new FullCalendarCore(el, {
    plugins: [dayGridPlugin],
    initialView: 'dayGridMonth',
  });
  const oldEvent = calendar.addEvent(original);
  const event = calendar.addEvent({ ...original, ...destination });
  if (!event || !oldEvent) throw new Error('Could not create the calendar event fixture.');
  const revert = vi.fn();
  const details = {
    event, oldEvent, revert, el, view: calendar.view, relatedEvents: [],
    jsEvent: new MouseEvent('mouseup'),
  };
  const zeroDelta = { years: 0, months: 0, days: 0, milliseconds: 0 };
  return { details, zeroDelta, revert };
}

async function drop(date: string, destination: Pick<EventInput, 'start' | 'end' | 'allDay'>) {
  const { details, zeroDelta, revert } = await gesture(date, destination);
  await act(async () => {
    await options.eventDrop!({ ...details, delta: zeroDelta });
  });
  return revert;
}

async function resize(date: string, destination: Pick<EventInput, 'start' | 'end' | 'allDay'>) {
  const { details, zeroDelta, revert } = await gesture(date, destination);
  await act(async () => {
    await options.eventResize!({ ...details, startDelta: zeroDelta, endDelta: zeroDelta });
  });
  return revert;
}

it.each(['none', 'weekly'] as const)(
  'persists the exact shifted end time on a timed drop (%s recurrence)',
  async recurrence => {
    const { date, update, mount } = fixture({ recurrence });
    const occurrence = shiftDate(date, recurrence === 'weekly' ? 7 : 0);
    const moved = shiftDate(occurrence, 2);
    const confirmMove = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const original = mount();

    const revert = await drop(occurrence, {
      start: `${moved}T12:35:00`, end: `${moved}T14:12:00`, allDay: false,
    });

    expect(confirmMove).toHaveBeenCalledTimes(recurrence === 'weekly' ? 1 : 0);
    expect(revert).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      date: moved, due_time: '12:35', end_time: '14:12', recurrence,
    }));

    original.unmount();
    mount();
    expect(await findOccurrence(moved)).toMatchObject({
      start: `${moved}T12:35:00`, end: `${moved}T14:12:00`,
    });
  },
);

it('leaves the saved end blank when the timed event only has a display end', async () => {
  const { date, update, mount } = fixture({ end_time: null });
  const moved = shiftDate(date, 1);
  mount();

  const revert = await drop(date, {
    start: `${moved}T12:35:00`, end: `${moved}T13:35:00`, allDay: false,
  });

  expect(revert).not.toHaveBeenCalled();
  expect(update).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    date: moved, due_time: '12:35', end_time: null,
  }));
});

it('clears saved times when a timed chore is dropped into the all-day row', async () => {
  const { date, update, mount } = fixture();
  const moved = shiftDate(date, 1);
  mount();

  const revert = await drop(date, { start: moved, end: undefined, allDay: true });

  expect(revert).not.toHaveBeenCalled();
  expect(update).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    date: moved, due_time: null, end_time: null,
  }));
});

it.each([
  ['at midnight', '22:23', '00:00'],
  ['after midnight', '22:30', '00:07'],
])('rejects an explicit shifted end %s', async (_label, start, end) => {
  const { date, update, mount } = fixture();
  const moved = shiftDate(date, 1);
  mount();

  const revert = await drop(date, {
    start: `${moved}T${start}:00`, end: `${shiftDate(moved, 1)}T${end}:00`, allDay: false,
  });

  expect(revert).toHaveBeenCalledOnce();
  expect(update).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('End times must be on the same day.');
});

it('reverts a timed drop with a saved end before its start', async () => {
  const { date, update, mount } = fixture({ end_time: '08:00:00' });
  const moved = shiftDate(date, 1);
  mount();

  const revert = await drop(date, { start: `${moved}T12:35:00`, end: undefined, allDay: false });

  expect(revert).toHaveBeenCalledOnce();
  expect(update).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Set a valid start and end time before moving this chore.');
});

it('keeps an all-day chore movable without offering a duration handle', async () => {
  const { date, update, mount } = fixture({ due_time: null, end_time: null });
  mount();

  const original = await findOccurrence(date);
  expect(original).toMatchObject({ allDay: true, durationEditable: false });
  expect(options.editable).toBe(true);

  const moved = shiftDate(date, 1);
  const revert = await drop(date, { start: moved, end: shiftDate(moved, 1), allDay: true });
  expect(revert).not.toHaveBeenCalled();
  expect(update).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    date: moved, due_time: null, end_time: null,
  }));
});

it('reverts a stale all-day resize without writing midnight times or prompting', async () => {
  const { date, update, mount } = fixture({ recurrence: 'weekly', due_time: null, end_time: null });
  const confirmResize = vi.spyOn(window, 'confirm').mockReturnValue(true);
  mount();

  const revert = await resize(date, { start: date, end: shiftDate(date, 2), allDay: true });

  expect(revert).toHaveBeenCalledOnce();
  expect(confirmResize).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
  expect(await findOccurrence(date)).toMatchObject({ start: date, end: shiftDate(date, 1), allDay: true });
});

it.each([
  { label: 'extends beyond midnight', nextDay: true, start: '22:00:00', end: '23:00:00', message: 'End times must be on the same day.' },
  { label: 'would save equal minutes', nextDay: false, start: '09:30:15', end: '09:30:45', message: 'Choose an end time after the start time.' },
])('reverts a resize that $label without saving', async ({ nextDay, start, end, message }) => {
  const { date, update, mount } = fixture();
  mount();

  const endDate = nextDay ? shiftDate(date, 1) : date;
  const revert = await resize(date, { start: `${date}T${start}`, end: `${endDate}T${end}`, allDay: false });

  expect(revert).toHaveBeenCalledOnce();
  expect(update).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent(message);
});

it('keeps recurring resize confirmation and persists valid same-day times', async () => {
  const { date, update, mount } = fixture({ recurrence: 'weekly' });
  const occurrence = shiftDate(date, 7);
  const destination = { start: `${occurrence}T08:17:00`, end: `${occurrence}T10:30:00`, allDay: false };
  const confirmResize = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  const original = mount();
  expect(await findOccurrence(occurrence)).toMatchObject({ allDay: false, durationEditable: true });

  expect(await resize(occurrence, destination)).toHaveBeenCalledOnce();
  expect(update).not.toHaveBeenCalled();
  expect(await resize(occurrence, destination)).not.toHaveBeenCalled();
  expect(confirmResize).toHaveBeenCalledTimes(2);
  expect(update).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    date, due_time: '08:17', end_time: '10:30', recurrence: 'weekly',
  }));

  original.unmount();
  mount();
  expect(await findOccurrence(occurrence)).toMatchObject(destination);
});
