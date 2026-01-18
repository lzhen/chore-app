import { Chore, TeamMember } from '../types';

interface AssignmentStats {
  memberId: string;
  memberName: string;
  totalAssignments: number;
  recentAssignments: number; // Last 7 days
}

/**
 * Calculate assignment statistics for each team member
 */
export function getAssignmentStats(
  chores: Chore[],
  teamMembers: TeamMember[]
): AssignmentStats[] {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return teamMembers.map((member) => {
    const memberChores = chores.filter((c) => c.assigneeId === member.id);
    const recentChores = memberChores.filter((c) => new Date(c.date) >= sevenDaysAgo);

    return {
      memberId: member.id,
      memberName: member.name,
      totalAssignments: memberChores.length,
      recentAssignments: recentChores.length,
    };
  });
}

/**
 * Suggest the best team member to assign a chore to
 * Uses a fair distribution algorithm based on recent workload
 */
export function suggestAssignee(
  chores: Chore[],
  teamMembers: TeamMember[]
): TeamMember | null {
  if (teamMembers.length === 0) return null;

  const stats = getAssignmentStats(chores, teamMembers);

  // Sort by recent assignments (ascending) to find least busy member
  stats.sort((a, b) => {
    // Primary: fewer recent assignments
    if (a.recentAssignments !== b.recentAssignments) {
      return a.recentAssignments - b.recentAssignments;
    }
    // Secondary: fewer total assignments
    return a.totalAssignments - b.totalAssignments;
  });

  const leastBusy = stats[0];
  return teamMembers.find((m) => m.id === leastBusy.memberId) || null;
}

/**
 * Auto-assign multiple unassigned chores fairly
 */
export function autoAssignChores(
  chores: Chore[],
  teamMembers: TeamMember[]
): Map<string, string> {
  const assignments = new Map<string, string>(); // choreId -> memberId

  if (teamMembers.length === 0) return assignments;

  // Get unassigned chores
  const unassignedChores = chores.filter((c) => !c.assigneeId);

  // Create a working copy of stats
  const stats = getAssignmentStats(chores, teamMembers);

  // Assign each unassigned chore
  for (const chore of unassignedChores) {
    // Find member with least assignments
    stats.sort((a, b) => a.recentAssignments - b.recentAssignments);
    const leastBusy = stats[0];

    assignments.set(chore.id, leastBusy.memberId);

    // Update stats for next iteration
    leastBusy.recentAssignments++;
    leastBusy.totalAssignments++;
  }

  return assignments;
}

/**
 * Get chores due today or tomorrow that need attention
 */
export function getUpcomingChores(chores: Chore[]): Chore[] {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  return chores.filter((c) => c.date === today || c.date === tomorrow);
}

/**
 * Analyze workload balance across team
 */
export function analyzeWorkloadBalance(
  chores: Chore[],
  teamMembers: TeamMember[]
): {
  isBalanced: boolean;
  suggestions: string[];
  stats: AssignmentStats[];
} {
  const stats = getAssignmentStats(chores, teamMembers);
  const suggestions: string[] = [];

  if (stats.length === 0) {
    return { isBalanced: true, suggestions: [], stats };
  }

  const recentCounts = stats.map((s) => s.recentAssignments);
  const maxRecent = Math.max(...recentCounts);
  const minRecent = Math.min(...recentCounts);
  const avgRecent = recentCounts.reduce((a, b) => a + b, 0) / recentCounts.length;

  // Check if workload is balanced (difference of more than 2 is unbalanced)
  const isBalanced = maxRecent - minRecent <= 2;

  if (!isBalanced) {
    const overworked = stats.filter((s) => s.recentAssignments > avgRecent + 1);
    const underworked = stats.filter((s) => s.recentAssignments < avgRecent - 1);

    if (overworked.length > 0) {
      suggestions.push(
        `${overworked.map((s) => s.memberName).join(', ')} ${
          overworked.length === 1 ? 'has' : 'have'
        } more chores than average`
      );
    }

    if (underworked.length > 0) {
      suggestions.push(
        `Consider assigning more to ${underworked.map((s) => s.memberName).join(', ')}`
      );
    }
  }

  // Check for unassigned chores
  const unassignedCount = chores.filter((c) => !c.assigneeId).length;
  if (unassignedCount > 0) {
    suggestions.push(`${unassignedCount} chore${unassignedCount === 1 ? '' : 's'} unassigned`);
  }

  return { isBalanced, suggestions, stats };
}
