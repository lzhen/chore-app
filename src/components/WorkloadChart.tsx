import { memberAvatarStyle } from '../utils/colors';
import { useMemo } from 'react';
import { TeamMember, Chore } from '../types';

interface WorkloadChartProps {
  members: TeamMember[];
  chores: Chore[];
  dateRange?: { start: string; end: string };
}

export function WorkloadChart({ members, chores, dateRange }: WorkloadChartProps) {
  const workloadData = useMemo(() => {
    const today = new Date();
    const start = dateRange?.start || today.toISOString().split('T')[0];
    const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const end = dateRange?.end || weekEnd.toISOString().split('T')[0];

    return members.map(member => {
      // Get chores assigned to this member in the date range
      const assignedChores = chores.filter(c => {
        if (c.assigneeId !== member.id) return false;
        // Check if chore falls in date range
        if (c.recurrence === 'none') {
          return c.date >= start && c.date <= end;
        }
        // For recurring chores, count them if they started before the end date
        return c.date <= end;
      });

      // Calculate total minutes
      let assignedMinutes = 0;
      assignedChores.forEach(chore => {
        const minutes = chore.estimatedMinutes || 30; // Default 30 min if not set
        if (chore.recurrence === 'none') {
          assignedMinutes += minutes;
        } else if (chore.recurrence === 'daily') {
          // Count days in range
          const choreStart = new Date(Math.max(new Date(chore.date).getTime(), new Date(start).getTime()));
          const rangeEnd = new Date(end);
          const days = Math.ceil((rangeEnd.getTime() - choreStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          assignedMinutes += minutes * Math.max(0, days);
        } else if (chore.recurrence === 'weekly') {
          // Count weeks in range
          const choreStart = new Date(Math.max(new Date(chore.date).getTime(), new Date(start).getTime()));
          const rangeEnd = new Date(end);
          const weeks = Math.ceil((rangeEnd.getTime() - choreStart.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1;
          assignedMinutes += minutes * Math.max(0, weeks);
        } else if (chore.recurrence === 'monthly') {
          assignedMinutes += minutes; // Just count once for monthly in a week view
        }
      });

      const capacityMinutes = member.weeklyCapacityMinutes || 480; // Default 8 hours
      const utilizationPercent = capacityMinutes > 0 ? Math.round((assignedMinutes / capacityMinutes) * 100) : 0;

      return {
        member,
        assignedMinutes,
        capacityMinutes,
        utilizationPercent,
        choreCount: assignedChores.length,
      };
    }).sort((a, b) => b.utilizationPercent - a.utilizationPercent);
  }, [members, chores, dateRange]);

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
                <span className="text-xs text-content-secondary">({choreCount} chores)</span>
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
