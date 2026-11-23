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

async function drop(date: string, destination: Pick<EventInput, 'start' | 'end' | 'allDay'>) {
  const original = await findOccurrence(date);
  const el = document.createElement('div');
  const calendar = new FullCalendarCore(el, {
    plugins: [dayGridPlugin],
    initialView: 'dayGridMonth',
  });
  const oldEvent = calendar.addEvent(original);
  const event = calendar.addEvent({ ...original, ...destination });
  if (!event || !oldEvent) throw new Error('Could not create the calendar drop fixture.');
  const revert = vi.fn();

  await act(async () => {
    await options.eventDrop!({
      event, oldEvent, revert, el, view: calendar.view, relatedEvents: [],
      jsEvent: new MouseEvent('mouseup'),
      delta: { years: 0, months: 0, days: 0, milliseconds: 0 },
    });
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
