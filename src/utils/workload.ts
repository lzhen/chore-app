import { Chore, TeamMember } from '../types';
import { dateKey, parseDate, shiftDate } from './dates';
import { generateChoreInstances } from './recurrence';

export function workloadRange(today = dateKey()) {
  return { start: today, end: shiftDate(today, 6) };
}
export function summarizeWorkload(members: TeamMember[], chores: Chore[], range = workloadRange()) {
  // Use exactly the same daily / weekly / month-end semantics as Calendar.
  const instances = generateChoreInstances(chores, members, [], parseDate(range.start), parseDate(range.end));
  const byId = new Map(chores.map(c => [c.id, c]));
  return members.map(member => {
    const assigned = instances.filter(i => i.assigneeId === member.id);
    let estimatedMinutes = 0, missingEstimates = 0;
    for (const instance of assigned) {
      const minutes = byId.get(instance.choreId)?.estimatedMinutes;
      if (minutes == null || !Number.isFinite(minutes) || minutes < 0) missingEstimates++;
      else estimatedMinutes += minutes;
    }
    const capacity = member.weeklyCapacityMinutes;
    const capacityMinutes = capacity != null && Number.isFinite(capacity) && capacity >= 0 ? capacity : null;
    const sevenDays = shiftDate(range.start, 6) === range.end;
    const utilization = sevenDays && missingEstimates === 0 && capacityMinutes != null && capacityMinutes > 0
      ? Math.round(estimatedMinutes / capacityMinutes * 100) : null;
    return { member, count: assigned.length, estimatedMinutes, missingEstimates, capacityMinutes, utilization };
  });
}
