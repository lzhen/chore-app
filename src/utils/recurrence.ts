import { Chore, ChoreInstance, TeamMember, ChoreCompletion } from '../types';

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
  completions: ChoreCompletion[],
  rangeStart: Date,
  rangeEnd: Date
): ChoreInstance[] {
  const instances: ChoreInstance[] = [];
  const memberMap = new Map(teamMembers.map(m => [m.id, m]));

  // Create a set of completed instance keys for quick lookup
  const completedKeys = new Set(
    completions.map(c => `${c.choreId}-${c.instanceDate}`)
  );

  for (const chore of chores) {
    const choreDate = parseDate(chore.date);
    const member = chore.assigneeId ? memberMap.get(chore.assigneeId) : null;
    const color = member?.color || '#9CA3AF'; // Gray for unassigned

    if (chore.recurrence === 'none') {
      // Single occurrence
      if (choreDate >= rangeStart && choreDate <= rangeEnd) {
        const instanceKey = `${chore.id}-${chore.date}`;
        instances.push({
          id: chore.id,
          choreId: chore.id,
          title: chore.title,
          description: chore.description,
          date: chore.date,
          dueTime: chore.dueTime,
          endTime: chore.endTime,
          allDay: chore.allDay,
          assigneeId: chore.assigneeId,
          assigneeName: member?.name,
          color,
          isRecurring: false,
          priority: chore.priority,
          categoryId: chore.categoryId,
          isCompleted: completedKeys.has(instanceKey),
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
          const instanceKey = `${chore.id}-${dateStr}`;
          instances.push({
            id: `${chore.id}-${dateStr}`,
            choreId: chore.id,
            title: chore.title,
            description: chore.description,
            date: dateStr,
            dueTime: chore.dueTime,
            endTime: chore.endTime,
            allDay: chore.allDay,
            assigneeId: chore.assigneeId,
            assigneeName: member?.name,
            color,
            isRecurring: true,
            priority: chore.priority,
            categoryId: chore.categoryId,
            isCompleted: completedKeys.has(instanceKey),
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
