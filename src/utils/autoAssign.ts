import { Chore, TeamMember, ChoreCompletion, MemberAvailability, AutoAssignOptions } from '../types';

interface AssignmentContext {
  chore: Chore;
  members: TeamMember[];
  completions: ChoreCompletion[];
  availability: MemberAvailability[];
  chores: Chore[]; // All chores for workload calculation
  options: AutoAssignOptions;
}

// Get the next assignee for a chore based on the configured options
export function getNextAssignee(context: AssignmentContext): string | null {
  const { chore, members, completions, availability, chores, options } = context;

  if (!options.enabled || members.length === 0) {
    return null;
  }

  const today = new Date().toISOString().split('T')[0];
  let eligibleMembers = [...members];

  // Filter by availability if enabled
  if (options.respectAvailability) {
    const unavailableMemberIds = new Set(
      availability
        .filter(a => a.startDate <= today && a.endDate >= today)
        .map(a => a.memberId)
    );
    eligibleMembers = eligibleMembers.filter(m => !unavailableMemberIds.has(m.id));
  }

  // Filter by working hours if enabled and chore has a time
  if (options.respectWorkingHours && chore.dueTime) {
    const choreTime = chore.dueTime;
    eligibleMembers = eligibleMembers.filter(m => {
      if (!m.workingHours) return true; // No working hours set, assume available
      const { start, end, days } = m.workingHours;
      const choreDate = new Date(chore.date);
      const dayOfWeek = choreDate.getDay();

      // Check if the day is a working day
      if (!days.includes(dayOfWeek)) return false;

      // Check if the time is within working hours
      return choreTime >= start && choreTime <= end;
    });
  }

  // Filter by skills if enabled (match chore category to member skills)
  if (options.respectSkills && chore.categoryId) {
    const membersWithMatchingSkills = eligibleMembers.filter(m => {
      if (!m.skills || m.skills.length === 0) return false;
      // This is a simple check - in a real app, you'd have category-skill mappings
      return true; // For now, just pass through - skills are informational
    });
    // Only filter if there are members with matching skills
    if (membersWithMatchingSkills.length > 0) {
      eligibleMembers = membersWithMatchingSkills;
    }
  }

  if (eligibleMembers.length === 0) {
    return null;
  }

  // Apply rotation type
  switch (options.rotationType) {
    case 'round-robin':
      return getRoundRobinAssignee(chore, eligibleMembers, completions);

    case 'least-loaded':
      return getLeastLoadedAssignee(eligibleMembers, chores, options.balanceWorkload);

    case 'random':
      return getRandomAssignee(eligibleMembers);

    default:
      return getRoundRobinAssignee(chore, eligibleMembers, completions);
  }
}

// Round-robin: rotate through members based on who completed this chore last
function getRoundRobinAssignee(
  chore: Chore,
  members: TeamMember[],
  completions: ChoreCompletion[]
): string {
  // Get completions for this chore, sorted by date (most recent first)
  const choreCompletions = completions
    .filter(c => c.choreId === chore.id)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  if (choreCompletions.length === 0) {
    // No completions yet, assign to first member
    return members[0].id;
  }

  // Find the last person who completed this chore
  const lastCompleterId = choreCompletions[0].completedBy;
  const lastCompleterIndex = members.findIndex(m => m.id === lastCompleterId);

  if (lastCompleterIndex === -1) {
    // Last completer not in eligible members, start from beginning
    return members[0].id;
  }

  // Assign to next member in rotation
  const nextIndex = (lastCompleterIndex + 1) % members.length;
  return members[nextIndex].id;
}

// Least-loaded: assign to member with lowest current workload
function getLeastLoadedAssignee(
  members: TeamMember[],
  allChores: Chore[],
  balanceWorkload: boolean
): string {
  const workloadMap = new Map<string, number>();

  // Initialize all members with 0 workload
  members.forEach(m => workloadMap.set(m.id, 0));

  // Calculate current week's workload for each member
  const today = new Date();
  const weekStart = new Date(today.getTime() - today.getDay() * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  allChores.forEach(chore => {
    if (!chore.assigneeId || !workloadMap.has(chore.assigneeId)) return;

    // Check if chore is in current week
    if (chore.recurrence === 'none') {
      if (chore.date >= weekStartStr && chore.date <= weekEndStr) {
        const current = workloadMap.get(chore.assigneeId) || 0;
        workloadMap.set(chore.assigneeId, current + (chore.estimatedMinutes || 30));
      }
    } else {
      // For recurring chores, estimate weekly load
      const minutes = chore.estimatedMinutes || 30;
      let weeklyMinutes = 0;

      switch (chore.recurrence) {
        case 'daily':
          weeklyMinutes = minutes * 7;
          break;
        case 'weekly':
          weeklyMinutes = minutes;
          break;
        case 'monthly':
          weeklyMinutes = minutes / 4; // Approximate
          break;
      }

      const current = workloadMap.get(chore.assigneeId) || 0;
      workloadMap.set(chore.assigneeId, current + weeklyMinutes);
    }
  });

  if (balanceWorkload) {
    // Also consider member capacity
    let lowestRatio = Infinity;
    let lowestMemberId = members[0].id;

    members.forEach(m => {
      const workload = workloadMap.get(m.id) || 0;
      const capacity = m.weeklyCapacityMinutes || 480; // Default 8 hours
      const ratio = workload / capacity;

      if (ratio < lowestRatio) {
        lowestRatio = ratio;
        lowestMemberId = m.id;
      }
    });

    return lowestMemberId;
  } else {
    // Just find lowest absolute workload
    let lowestWorkload = Infinity;
    let lowestMemberId = members[0].id;

    members.forEach(m => {
      const workload = workloadMap.get(m.id) || 0;
      if (workload < lowestWorkload) {
        lowestWorkload = workload;
        lowestMemberId = m.id;
      }
    });

    return lowestMemberId;
  }
}

// Random: randomly select from eligible members
function getRandomAssignee(members: TeamMember[]): string {
  const randomIndex = Math.floor(Math.random() * members.length);
  return members[randomIndex].id;
}

// Default auto-assign options
export const defaultAutoAssignOptions: AutoAssignOptions = {
  enabled: false,
  rotationType: 'round-robin',
  respectSkills: false,
  respectAvailability: true,
  respectWorkingHours: false,
  balanceWorkload: true,
};

// Helper to get a preview of who would be assigned
export function getAssignmentPreview(
  context: Omit<AssignmentContext, 'options'> & { options?: Partial<AutoAssignOptions> }
): { assigneeId: string | null; assigneeName: string | null; reason: string } {
  const options: AutoAssignOptions = {
    ...defaultAutoAssignOptions,
    enabled: true,
    ...context.options,
  };

  const assigneeId = getNextAssignee({ ...context, options });

  if (!assigneeId) {
    return {
      assigneeId: null,
      assigneeName: null,
      reason: 'No eligible members available',
    };
  }

  const assignee = context.members.find(m => m.id === assigneeId);

  let reason = '';
  switch (options.rotationType) {
    case 'round-robin':
      reason = 'Next in rotation';
      break;
    case 'least-loaded':
      reason = 'Lowest workload';
      break;
    case 'random':
      reason = 'Randomly selected';
      break;
  }

  return {
    assigneeId,
    assigneeName: assignee?.name || null,
    reason,
  };
}
