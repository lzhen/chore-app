import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { MemberStats } from '../types';

interface DashboardProps {
  onClose: () => void;
}

export function Dashboard({ onClose }: DashboardProps) {
  const { state } = useApp();

  // Calculate stats
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get completions
    const completedToday = state.completions.filter(c => c.instanceDate === today).length;
    const completedThisWeek = state.completions.filter(c => c.instanceDate >= weekAgo).length;
    const completedThisMonth = state.completions.filter(c => c.instanceDate >= monthAgo).length;

    // Get pending today
    const pendingToday = state.chores.filter(c => {
      if (c.date === today && !state.completions.some(comp => comp.choreId === c.id && comp.instanceDate === today)) {
        return true;
      }
      return false;
    }).length;

    // Get overdue (past due, not completed)
    const overdue = state.chores.filter(c => {
      if (c.date < today && c.recurrence === 'none') {
        return !state.completions.some(comp => comp.choreId === c.id && comp.instanceDate === c.date);
      }
      return false;
    }).length;

    return {
      totalChores: state.chores.length,
      completedToday,
      completedThisWeek,
      completedThisMonth,
      pendingToday,
      overdue,
    };
  }, [state.chores, state.completions]);

  // Calculate member stats
  const memberStats: MemberStats[] = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return state.teamMembers.map(member => {
      const memberCompletions = state.completions.filter(c => c.completedBy === member.id);
      const assignedChores = state.chores.filter(c => c.assigneeId === member.id);

      // Calculate streak (consecutive days with completions)
      const completionDates = [...new Set(memberCompletions.map(c => c.instanceDate))].sort().reverse();
      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;
      let prevDate: Date | null = null;

      for (const dateStr of completionDates) {
        const date = new Date(dateStr);
        if (prevDate === null) {
          tempStreak = 1;
        } else {
          const diff = (prevDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
          if (diff === 1) {
            tempStreak++;
          } else {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 1;
          }
        }
        prevDate = date;
      }
      longestStreak = Math.max(longestStreak, tempStreak);

      // Current streak (from today going back)
      const today = new Date();
      let checkDate = today;
      currentStreak = 0;
      for (let i = 0; i < 365; i++) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (completionDates.includes(dateStr)) {
          currentStreak++;
          checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
        } else {
          break;
        }
      }

      return {
        memberId: member.id,
        memberName: member.name,
        memberColor: member.color,
        totalCompleted: memberCompletions.length,
        completedThisWeek: memberCompletions.filter(c => c.instanceDate >= weekAgo).length,
        completedThisMonth: memberCompletions.filter(c => c.instanceDate >= monthAgo).length,
        currentStreak,
        longestStreak,
        completionRate: assignedChores.length > 0
          ? Math.round((memberCompletions.length / Math.max(assignedChores.length, 1)) * 100)
          : 0,
        totalAssigned: assignedChores.length,
      };
    }).sort((a, b) => b.totalCompleted - a.totalCompleted);
  }, [state.teamMembers, state.completions, state.chores]);

  return (
    <div className="fixed inset-0 bg-overlay flex items-center justify-center z-50 p-4">
      <div className="fluent-card w-full max-w-4xl max-h-[90vh] overflow-hidden animate-fluent-appear shadow-fluent-28">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="fluent-title text-xl font-semibold text-content-primary">Dashboard</h2>
          <button
            onClick={onClose}
            className="text-content-secondary hover:text-content-primary hover:bg-subtle-background-hover rounded-fluent-sm transition-all duration-fast p-1.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="fluent-surface p-4 rounded-fluent-md border border-border">
              <div className="text-2xl font-bold text-content-primary">{stats.completedToday}</div>
              <div className="text-sm text-content-secondary">Completed Today</div>
            </div>
            <div className="fluent-surface p-4 rounded-fluent-md border border-border">
              <div className="text-2xl font-bold text-content-primary">{stats.pendingToday}</div>
              <div className="text-sm text-content-secondary">Pending Today</div>
            </div>
            <div className="fluent-surface p-4 rounded-fluent-md border border-border">
              <div className="text-2xl font-bold text-yellow-500">{stats.overdue}</div>
              <div className="text-sm text-content-secondary">Overdue</div>
            </div>
            <div className="fluent-surface p-4 rounded-fluent-md border border-border">
              <div className="text-2xl font-bold text-content-primary">{stats.completedThisWeek}</div>
              <div className="text-sm text-content-secondary">This Week</div>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="mb-6">
            <h3 className="fluent-title text-lg font-semibold text-content-primary mb-4">Leaderboard</h3>
            <div className="space-y-2">
              {memberStats.map((member, index) => (
                <div
                  key={member.memberId}
                  className="fluent-surface flex items-center gap-4 p-4 rounded-fluent-md border border-border"
                >
                  {/* Rank */}
                  <div className={`w-8 h-8 rounded-fluent-circle flex items-center justify-center font-bold text-sm ${
                    index === 0 ? 'bg-yellow-500 text-white' :
                    index === 1 ? 'bg-gray-400 text-white' :
                    index === 2 ? 'bg-amber-700 text-white' :
                    'bg-surface-tertiary text-content-secondary'
                  }`}>
                    {index + 1}
                  </div>

                  {/* Member info */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div
                      className="w-4 h-4 rounded-fluent-circle flex-shrink-0"
                      style={{ backgroundColor: member.memberColor }}
                    />
                    <span className="font-medium text-content-primary truncate">{member.memberName}</span>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="font-bold text-content-primary">{member.totalCompleted}</div>
                      <div className="text-xs text-content-secondary">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-content-primary">{member.completedThisWeek}</div>
                      <div className="text-xs text-content-secondary">Week</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-orange-500">{member.currentStreak}</div>
                      <div className="text-xs text-content-secondary">Streak</div>
                    </div>
                  </div>
                </div>
              ))}

              {memberStats.length === 0 && (
                <p className="text-content-secondary text-center py-8">
                  No team members yet. Add team members to see stats.
                </p>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h3 className="fluent-title text-lg font-semibold text-content-primary mb-4">Recent Completions</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {state.completions.slice(0, 10).map((completion) => {
                const chore = state.chores.find(c => c.id === completion.choreId);
                const member = state.teamMembers.find(m => m.id === completion.completedBy);
                return (
                  <div
                    key={completion.id}
                    className="flex items-center gap-3 p-2 rounded-fluent-sm hover:bg-subtle-background-hover"
                  >
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-content-primary">{chore?.title || 'Unknown chore'}</span>
                      <span className="text-xs text-content-secondary ml-2">
                        by {member?.name || 'Unknown'}
                      </span>
                    </div>
                    <span className="text-xs text-content-secondary flex-shrink-0">
                      {new Date(completion.completedAt).toLocaleDateString()}
                    </span>
                  </div>
                );
              })}

              {state.completions.length === 0 && (
                <p className="text-content-secondary text-center py-8">
                  No completions yet. Complete some chores to see activity.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
