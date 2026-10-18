import type { Chore } from '../types';
import { dateKey, shiftDate } from './dates';
import { generateChoreInstances } from './recurrence';

const sameDayMessage = 'Keep the start and end on the same day. This move was not saved.';
const minutes = (time: string) => {const [hour, minute] = time.split(':').map(Number);return hour * 60 + minute;};
const timeKey = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
const calendarDay = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;

/** Shift a series origin by calendar days (not elapsed hours, which vary across DST). */
export function moveChoreSchedule(chore: Chore, oldStart: Date, start: Date, allDay: boolean): Chore {
  const date = chore.recurrence === 'none' ? dateKey(start) : shiftDate(chore.date, calendarDay(start) - calendarDay(oldStart));
  // Month-end clamping means shifting the origin by N days may not move this
  // occurrence by N days. Verify with the same generator used to render events.
  if (chore.recurrence !== 'none' && !generateChoreInstances([{...chore, date}], [], [], start, start).some(instance => instance.date === dateKey(start))) {
    throw new Error('This move does not fit the monthly schedule. The series was not changed.');
  }
  if (allDay) return {...chore, date, dueTime: undefined, endTime: undefined, allDay: true};
  const dueTime = timeKey(start);
  let endTime: string | undefined;
  if (chore.dueTime && chore.endTime) {
    const duration = minutes(chore.endTime) - minutes(chore.dueTime);
    const end = minutes(dueTime) + duration;
    // The persisted model has no end date. Never wrap an explicit time silently.
    if (duration <= 0 || end >= 1440) throw new Error(sameDayMessage);
    endTime = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
  }
  return {...chore, date, dueTime, endTime, allDay: false};
}

export function resizeChoreSchedule(chore: Chore, start: Date, end: Date, allDay: boolean): Chore {
  if (allDay || dateKey(start) !== dateKey(end) || end <= start) throw new Error(sameDayMessage);
  return {...chore, dueTime: timeKey(start), endTime: timeKey(end), allDay: false};
}
