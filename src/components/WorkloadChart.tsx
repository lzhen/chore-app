import '../styles/nesmi-secondary-surfaces.css';
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

  const getUtilizationColor = (percent: number) => {
    if (percent <= 70) return 'nesmi-workload-under';
    if (percent <= 90) return 'nesmi-workload-near';
    return 'nesmi-workload-over';
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  if (members.length === 0) {
    return (
      <div className="nesmi-secondary-surface nesmi-secondary-support text-center py-8">
        No team members yet. Add team members to see workload.
      </div>
    );
  }

  return (
    <div className="nesmi-workload nesmi-secondary-surface space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="fluent-surface p-3 rounded-fluent-md border border-border text-center">
          <div className="nesmi-workload-summary-value font-bold nesmi-secondary-success">
            {workloadData.filter(d => d.utilizationPercent <= 70).length}
          </div>
          <div className="nesmi-secondary-label">Under Capacity</div>
        </div>
        <div className="fluent-surface p-3 rounded-fluent-md border border-border text-center">
          <div className="nesmi-workload-summary-value font-bold nesmi-secondary-warning">
            {workloadData.filter(d => d.utilizationPercent > 70 && d.utilizationPercent <= 90).length}
          </div>
          <div className="nesmi-secondary-label">Near Capacity</div>
        </div>
        <div className="fluent-surface p-3 rounded-fluent-md border border-border text-center">
          <div className="nesmi-workload-summary-value font-bold nesmi-secondary-danger">
            {workloadData.filter(d => d.utilizationPercent > 90).length}
          </div>
          <div className="nesmi-secondary-label">Over Capacity</div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="space-y-3">
        {workloadData.map(({ member, assignedMinutes, capacityMinutes, utilizationPercent, choreCount }) => (
          <div key={member.id} className="fluent-surface p-3 rounded-fluent-md border border-border">
            <div className="nesmi-workload-row-heading flex items-center justify-between gap-3 mb-2">
              <div className="nesmi-workload-member flex items-center gap-2">
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt={member.name}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white nesmi-secondary-label font-bold"
                    style={memberAvatarStyle(member.color)}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="nesmi-secondary-body font-medium">{member.name}</span>
                <span className="nesmi-secondary-label">({choreCount} chores)</span>
              </div>
              <div className="text-right">
                <span className={`nesmi-secondary-body font-bold ${
                  utilizationPercent <= 70 ? 'nesmi-secondary-success' :
                  utilizationPercent <= 90 ? 'nesmi-secondary-warning' : 'nesmi-secondary-danger'
                }`}>
                  {utilizationPercent}%
                </span>
                <span className="nesmi-secondary-label ml-1">
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
                className={`nesmi-workload-assigned absolute h-full ${getUtilizationColor(utilizationPercent)}`}
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

      {/* Legend */}
      <div className="nesmi-workload-legend flex flex-wrap justify-center gap-6 pt-4 nesmi-secondary-label">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded nesmi-workload-under" />
          <span>Under 70%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded nesmi-workload-near" />
          <span>70-90%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded nesmi-workload-over" />
          <span>Over 90%</span>
        </div>
      </div>
    </div>
  );
}
