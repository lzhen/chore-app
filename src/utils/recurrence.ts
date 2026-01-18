import { Chore, ChoreInstance, TeamMember } from '../types';

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function generateChoreInstances(
  chores: Chore[],
  teamMembers: TeamMember[],
  rangeStart: Date,
  rangeEnd: Date
): ChoreInstance[] {
  const instances: ChoreInstance[] = [];
  const memberMap = new Map(teamMembers.map(m => [m.id, m]));

  for (const chore of chores) {
    const choreDate = parseDate(chore.date);
    const member = chore.assigneeId ? memberMap.get(chore.assigneeId) : null;
    const color = member?.color || '#9CA3AF'; // Gray for unassigned

    if (chore.recurrence === 'none') {
      // Single occurrence
      if (choreDate >= rangeStart && choreDate <= rangeEnd) {
        instances.push({
          id: chore.id,
          choreId: chore.id,
          title: chore.title,
          date: chore.date,
          assigneeId: chore.assigneeId,
          color,
          isRecurring: false,
        });
      }
    } else {
      // Generate recurring instances
      let currentDate = new Date(choreDate);
      let instanceCount = 0;
      const maxInstances = 100; // Safety limit

      while (currentDate <= rangeEnd && instanceCount < maxInstances) {
        if (currentDate >= rangeStart) {
          const dateStr = formatDate(currentDate);
          instances.push({
            id: `${chore.id}-${dateStr}`,
            choreId: chore.id,
            title: chore.title,
            date: dateStr,
            assigneeId: chore.assigneeId,
            color,
            isRecurring: true,
          });
        }

        // Move to next occurrence
        switch (chore.recurrence) {
          case 'daily':
            currentDate = addDays(currentDate, 1);
            break;
          case 'weekly':
            currentDate = addDays(currentDate, 7);
            break;
          case 'monthly':
            currentDate = addMonths(currentDate, 1);
            break;
        }
        instanceCount++;
      }
    }
  }

  return instances;
}

export function getCalendarRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 4, 0);
  return { start, end };
}
