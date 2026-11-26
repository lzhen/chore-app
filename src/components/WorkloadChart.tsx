import { memberAvatarStyle } from '../utils/colors';
import { useMemo } from 'react';
import { TeamMember, Chore } from '../types';
import { parseDate } from '../utils/dates';
import { generateChoreInstances } from '../utils/recurrence';

interface WorkloadChartProps {
  members: TeamMember[];
  chores: Chore[];
  dateRange: { start: string; end: string };
}

export function WorkloadChart({ members, chores, dateRange: { start, end } }: WorkloadChartProps) {
  const workloadData = useMemo(() => {
    // Assigned workload includes completed occurrences.
    const occurrences = generateChoreInstances(chores, members, [], parseDate(start), parseDate(end));
    const estimates = new Map(chores.map(chore => [chore.id, chore.estimatedMinutes]));
    const assignedByMember = new Map<string, { minutes: number; count: number }>();
    for (const { choreId, assigneeId } of occurrences) {
      if (!assigneeId) continue;
      const assigned = assignedByMember.get(assigneeId) ?? { minutes: 0, count: 0 };
      assigned.minutes += estimates.get(choreId) || 30; // Default 30 min if not set
      assigned.count++;
      assignedByMember.set(assigneeId, assigned);
    }

    return members.map(member => {
      const assigned = assignedByMember.get(member.id);
      const assignedMinutes = assigned?.minutes ?? 0;
      const capacityMinutes = member.weeklyCapacityMinutes || 480; // Default 8 hours
      const utilizationPercent = capacityMinutes > 0 ? Math.round((assignedMinutes / capacityMinutes) * 100) : 0;

      return {
        member,
        assignedMinutes,
        capacityMinutes,
        utilizationPercent,
        choreCount: assigned?.count ?? 0,
      };
    }).sort((a, b) => b.utilizationPercent - a.utilizationPercent);
  }, [members, chores, start, end]);

  const maxMinutes = Math.max(...workloadData.map(d => Math.max(d.assignedMinutes, d.capacityMinutes)), 1);

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  if (members.length === 0) {
    return (
      <div className="text-center py-8 text-content-secondary">
        No team members yet. Add team members to see workload.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="fluent-surface p-3 rounded-fluent-md border border-border text-center">
          <div className="text-lg font-bold text-content-primary">
            {workloadData.filter(d => d.utilizationPercent <= 70).length}
          </div>
          <div className="text-xs text-content-secondary">Under Capacity</div>
        </div>
        <div className="fluent-surface p-3 rounded-fluent-md border border-border text-center">
          <div className="text-lg font-bold text-content-primary">
            {workloadData.filter(d => d.utilizationPercent > 70 && d.utilizationPercent <= 90).length}
          </div>
          <div className="text-xs text-content-secondary">Near Capacity</div>
        </div>
        <div className="fluent-surface p-3 rounded-fluent-md border border-border text-center">
          <div className="text-lg font-bold text-content-primary">
            {workloadData.filter(d => d.utilizationPercent > 90).length}
          </div>
          <div className="text-xs text-content-secondary">Over Capacity</div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="space-y-3">
        {workloadData.map(({ member, assignedMinutes, capacityMinutes, utilizationPercent, choreCount }) => (
          <div key={member.id} className="fluent-surface p-3 rounded-fluent-md border border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt={member.name}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={memberAvatarStyle(member.color)}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium text-content-primary">{member.name}</span>
                <span className="text-xs text-content-secondary">({choreCount} {choreCount === 1 ? 'chore' : 'chores'})</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-content-primary">
                  {utilizationPercent}%
                </span>
                <span className="text-xs text-content-secondary ml-1">
                  ({formatMinutes(assignedMinutes)} / {formatMinutes(capacityMinutes)})
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="relative h-4 bg-surface-tertiary rounded-full overflow-hidden">
              {/* Capacity indicator */}
              <div
                className="absolute h-full bg-surface-secondary"
                style={{ width: `${(capacityMinutes / maxMinutes) * 100}%` }}
              />
              {/* Assigned bar */}
              <div
                className="absolute h-full bg-content-primary transition-all duration-300"
                style={{ width: `${(assignedMinutes / maxMinutes) * 100}%` }}
              />
              {/* Capacity line */}
              <div
                className="absolute h-full w-0.5 bg-content-secondary"
                style={{ left: `${(capacityMinutes / maxMinutes) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
