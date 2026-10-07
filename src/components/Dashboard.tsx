import { dateKey, parseDate, shiftDate } from '../utils/dates';
import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { MemberStats } from '../types';
import { generateChoreInstances } from '../utils/recurrence';
import { BADGES, getBadgeById } from '../data/badges';
import { WorkloadChart } from './WorkloadChart';

// Format relative time (e.g., "2 hours ago", "3 days ago")
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface DashboardProps {
  onClose: () => void;
  embedded?: boolean;
}

export function Dashboard({ onClose, embedded=false }: DashboardProps) {
  const { state } = useApp();
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'workload' | 'achievements'>('overview');

  // Sort completions by completedAt (most recent first)
  const sortedCompletions = useMemo(() => {
    return [...state.completions].sort((a, b) =>
      new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
  }, [state.completions]);

  // Calculate stats
  const stats = useMemo(() => {
    const today = dateKey();
    const weekAgo = shiftDate(today, -6);
    const monthAgo = shiftDate(today, -29);
    const todayInstances = generateChoreInstances(state.chores, state.teamMembers, state.completions, parseDate(today), parseDate(today));
    const completedToday = todayInstances.filter(i => i.isCompleted).length;
    const pendingToday = todayInstances.filter(i => !i.isCompleted).length;
    const completedThisWeek = state.completions.filter(c => c.instanceDate >= weekAgo && c.instanceDate <= today).length;
    const completedThisMonth = state.completions.filter(c => c.instanceDate >= monthAgo && c.instanceDate <= today).length;
    const overdue = state.chores.filter(c => c.recurrence === 'none' && c.date < today && !state.completions.some(comp => comp.choreId === c.id && comp.instanceDate === c.date)).length;

    return {
      totalChores: state.chores.length,
      completedToday,
      completedThisWeek,
      completedThisMonth,
      pendingToday,
      overdue,
    };
  }, [state.chores, state.teamMembers, state.completions]);

  // Calculate member stats
  const memberStats: MemberStats[] = useMemo(() => {
    const todayKey = dateKey();
    const weekAgo = shiftDate(todayKey, -6);
    const monthAgo = shiftDate(todayKey, -29);
    const weekInstances = generateChoreInstances(state.chores, state.teamMembers, state.completions, parseDate(weekAgo), parseDate(todayKey));

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
        const date = parseDate(dateStr);
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
        const dateStr = dateKey(checkDate);
        if (completionDates.includes(dateStr)) {
          currentStreak++;
          checkDate = parseDate(shiftDate(dateStr, -1));
        } else {
          break;
        }
      }

      return {
        memberId: member.id,
        memberName: member.name,
        memberColor: member.color,
        memberAvatar: member.avatarUrl,
        totalCompleted: memberCompletions.length,
        completedThisWeek: memberCompletions.filter(c => c.instanceDate >= weekAgo && c.instanceDate <= todayKey).length,
        completedThisMonth: memberCompletions.filter(c => c.instanceDate >= monthAgo && c.instanceDate <= todayKey).length,
        currentStreak,
        longestStreak,
        completionRate: weekInstances.some(i => i.assigneeId === member.id)
          ? Math.round(100 * weekInstances.filter(i => i.assigneeId === member.id && i.isCompleted).length / weekInstances.filter(i => i.assigneeId === member.id).length)
          : 0,
        totalAssigned: assignedChores.length,
        points: member.points || 0,
        badges: member.badges || [],
        workloadMinutes: assignedChores.reduce((sum, c) => sum + (c.estimatedMinutes || 0), 0),
      };
    });
  }, [state.teamMembers, state.completions, state.chores]);

  return (
    <div className={embedded?"chore-insights-page":"fixed inset-0 bg-overlay flex items-center justify-center z-50 p-4"}>
      <div className={embedded ? "chore-insights-content" : "fluent-card w-full max-w-4xl max-h-[90vh] overflow-hidden"}>
        {/* Header */}
        <div className="chore-page-heading insights-heading">
          <p className="chore-eyebrow">Small steps, shared progress</p>
          <h1>Insights</h1>
          <p>See how your household is sharing the work.</p>
          <button
            hidden={embedded} onClick={onClose}
            className="text-content-secondary hover:text-content-primary hover:bg-subtle-background-hover rounded-fluent-sm transition-all duration-fast p-1.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="chore-insights-tabs flex border-b border-border">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'overview'
                ? 'text-brand-primary border-b-2 border-brand-primary'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'activity'
                ? 'text-brand-primary border-b-2 border-brand-primary'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            Activity
          </button>
          <button
            onClick={() => setActiveTab('workload')}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'workload'
                ? 'text-brand-primary border-b-2 border-brand-primary'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            Workload
          </button>
          <button
            onClick={() => setActiveTab('achievements')}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'achievements'
                ? 'text-brand-primary border-b-2 border-brand-primary'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            Achievements
          </button>
        </div>

        {/* Content */}
        <div className={embedded ? "chore-insights-body" : "p-6 overflow-y-auto max-h-[calc(90vh-140px)]"}>
          {activeTab === 'overview' ? (
            <>
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
                  <div className="text-2xl font-bold text-content-primary">{stats.overdue}</div>
                  <div className="text-sm text-content-secondary">Past-due one-off chores</div>
                </div>
                <div className="fluent-surface p-4 rounded-fluent-md border border-border">
                  <div className="text-2xl font-bold text-content-primary">{stats.completedThisWeek}</div>
                  <div className="text-sm text-content-secondary">Done in the last 7 days</div>
                </div>
              </div>

              {/* Leaderboard */}
              <div className="mb-6">
                <h3 className="fluent-title text-lg font-semibold text-content-primary mb-4">Household contributions</h3>
                <div className="space-y-2">
                  {memberStats.map((member) => (
                    <div
                      key={member.memberId}
                      className="chore-contribution"
                    >
                      {/* Member info */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {member.memberAvatar ? (
                          <img
                            src={member.memberAvatar}
                            alt={member.memberName}
                            className="w-8 h-8 rounded-fluent-circle object-cover flex-shrink-0"
                          />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-fluent-circle flex-shrink-0 flex items-center justify-center text-white text-sm font-bold"
                            style={{ backgroundColor: member.memberColor }}
                          >
                            {member.memberName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <span className="font-medium text-content-primary truncate block">{member.memberName}</span>
                          {/* Top badges */}
                          {member.badges.length > 0 && (
                            <div className="flex gap-1 mt-0.5">
                              {member.badges.slice(0, 3).map(badgeId => {
                                const badge = getBadgeById(badgeId);
                                return badge ? (
                                  <span key={badgeId} title={badge.name} className="text-xs">
                                    {badge.icon}
                                  </span>
                                ) : null;
                              })}
                              {member.badges.length > 3 && (
                                <span className="text-xs text-content-secondary">+{member.badges.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="chore-contribution-count"><strong>{member.completedThisWeek}</strong><span>in the last 7 days</span></div>
                    </div>
                  ))}

                  {memberStats.length === 0 && (
                    <p className="text-content-secondary text-center py-8">
                      Add family members to see how the work is shared.
                    </p>
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <h3 className="fluent-title text-lg font-semibold text-content-primary mb-4">Recent Completions</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {sortedCompletions.slice(0, 5).map((completion) => {
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
                          {formatRelativeTime(completion.completedAt)}
                        </span>
                      </div>
                    );
                  })}

                  {state.completions.length === 0 && (
                    <p className="text-content-secondary text-center py-8">
                      No completions yet. Complete some chores to see activity.
                    </p>
                  )}

                  {state.completions.length > 5 && (
                    <button
                      onClick={() => setActiveTab('activity')}
                      className="w-full text-center text-sm text-brand-primary hover:text-brand-primary/80 py-2"
                    >
                      View all activity →
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : activeTab === 'activity' ? (
            /* Activity Tab - Full Activity Feed */
            <div>
              <h3 className="fluent-title text-lg font-semibold text-content-primary mb-4">
                Activity Feed ({sortedCompletions.length} completions)
              </h3>
              <div className="space-y-3">
                {sortedCompletions.map((completion) => {
                  const chore = state.chores.find(c => c.id === completion.choreId);
                  const member = state.teamMembers.find(m => m.id === completion.completedBy);
                  const pointsEarned = completion.pointsEarned || 0;

                  return (
                    <div
                      key={completion.id}
                      className="fluent-surface flex items-center gap-4 p-4 rounded-fluent-md border border-border hover:shadow-fluent-4 transition-all"
                    >
                      {/* Member avatar */}
                      {member?.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="w-10 h-10 rounded-fluent-circle object-cover flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-fluent-circle flex-shrink-0 flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: member?.color || '#888' }}
                        >
                          {member?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )}

                      {/* Activity details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-content-primary">{member?.name || 'Unknown'}</span>
                          <span className="text-content-secondary">completed</span>
                          <span className="font-medium text-content-primary truncate">{chore?.title || 'Unknown chore'}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-content-secondary">
                          <span>{formatRelativeTime(completion.completedAt)}</span>
                          <span>•</span>
                          <span>{new Date(completion.instanceDate).toLocaleDateString()}</span>
                          {pointsEarned > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-brand-primary font-medium">+{pointsEarned} pts</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Completion check */}
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-fluent-circle bg-green-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {sortedCompletions.length === 0 && (
                  <div className="text-center py-12">
                    <svg className="w-12 h-12 mx-auto text-content-secondary opacity-50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <p className="text-content-secondary">No completions yet. Complete some chores to see activity.</p>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'achievements' ? (
            /* Achievements Tab */
            <div className="space-y-6">
              {/* Badge Categories */}
              {(['completion', 'streak', 'points', 'special'] as const).map(badgeType => {
                const typeBadges = BADGES.filter(b => b.type === badgeType);
                const earnedCount = typeBadges.filter(b =>
                  state.teamMembers.some(m => m.badges?.includes(b.id))
                ).length;

                return (
                  <div key={badgeType}>
                    <h3 className="fluent-title text-lg font-semibold text-content-primary mb-3 capitalize">
                      {badgeType} Badges ({earnedCount}/{typeBadges.length})
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {typeBadges.map(badge => {
                        const earnedBy = state.teamMembers.filter(m => m.badges?.includes(badge.id));
                        const isEarned = earnedBy.length > 0;

                        return (
                          <div
                            key={badge.id}
                            className={`fluent-surface p-4 rounded-fluent-md border border-border text-center transition-all ${
                              isEarned ? 'hover:shadow-fluent-8' : 'opacity-50'
                            }`}
                          >
                            <div className={`text-3xl mb-2 ${!isEarned ? 'grayscale' : ''}`}>
                              {badge.icon}
                            </div>
                            <div className={`text-sm font-medium ${isEarned ? 'text-content-primary' : 'text-content-secondary'}`}>
                              {badge.name}
                            </div>
                            <div className="text-xs text-content-secondary mt-1">
                              {badge.description}
                            </div>
                            {isEarned && (
                              <div className="mt-2 flex justify-center gap-1">
                                {earnedBy.slice(0, 3).map(m => (
                                  <div
                                    key={m.id}
                                    className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center"
                                    style={{ backgroundColor: m.color }}
                                    title={m.name}
                                  >
                                    {m.name.charAt(0)}
                                  </div>
                                ))}
                                {earnedBy.length > 3 && (
                                  <span className="text-xs text-content-secondary">+{earnedBy.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : activeTab === 'workload' ? (
            /* Workload Tab */
            <div>
              <h3 className="fluent-title text-lg font-semibold text-content-primary mb-4">Team Workload (This Week)</h3>
              <WorkloadChart
                members={state.teamMembers}
                chores={state.chores}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
