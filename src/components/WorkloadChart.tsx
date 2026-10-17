import { TeamMember, Chore } from '../types';
import { summarizeWorkload, workloadRange } from '../utils/workload';

interface WorkloadChartProps {
  members: TeamMember[];
  chores: Chore[];
  dateRange?: { start: string; end: string };
}

export function WorkloadChart({ members, chores, dateRange }: WorkloadChartProps) {
  const range = dateRange || workloadRange();
  const data = summarizeWorkload(members, chores, range);
  if (!members.length) return <p>No members yet.</p>;
  return <div className="space-y-4">
    <p className="text-sm text-content-secondary">{range.start} – {range.end} · Scheduled estimates</p>
    {data.map(({member, count, estimatedMinutes, missingEstimates, capacityMinutes, utilization}) =>
      <section key={member.id} aria-label={`${member.name} workload`} className="fluent-surface p-4 rounded-fluent-md border border-border">
        <h4 className="font-medium">{member.name}</h4>
        <p className="text-sm text-content-secondary">{count} scheduled {count === 1 ? 'occurrence' : 'occurrences'}</p>
        <dl className="text-sm mt-3 space-y-2">
          <div><dt className="text-content-secondary">Estimated time</dt><dd>{missingEstimates === count && count > 0 ? 'Not set' : `${estimatedMinutes} min${missingEstimates ? ' known' : ''}`}</dd></div>
          {missingEstimates > 0 && <div><dt className="text-content-secondary">Missing estimates</dt><dd>{missingEstimates}</dd></div>}
          <div><dt className="text-content-secondary">Weekly capacity</dt><dd>{capacityMinutes == null ? 'Not set' : `${capacityMinutes} min`}</dd></div>
          {utilization != null && <div><dt className="text-content-secondary">Estimated capacity used</dt><dd>{utilization}%</dd></div>}
        </dl>
      </section>)}
  </div>;
}
