import { Badge } from '../types';

export const BADGES: Badge[] = [
  // Completion badges
  {
    id: 'first-chore',
    name: 'First Steps',
    description: 'Complete your first chore',
    icon: '🎯',
    threshold: 1,
    type: 'completion',
  },
  {
    id: 'ten-chores',
    name: 'Getting Started',
    description: 'Complete 10 chores',
    icon: '⭐',
    threshold: 10,
    type: 'completion',
  },
  {
    id: 'twenty-five-chores',
    name: 'Quarter Century',
    description: 'Complete 25 chores',
    icon: '✨',
    threshold: 25,
    type: 'completion',
  },
  {
    id: 'fifty-chores',
    name: 'Reliable',
    description: 'Complete 50 chores',
    icon: '🌟',
    threshold: 50,
    type: 'completion',
  },
  {
    id: 'hundred-chores',
    name: 'Superstar',
    description: 'Complete 100 chores',
    icon: '💫',
    threshold: 100,
    type: 'completion',
  },
  {
    id: 'two-fifty-chores',
    name: 'Chore Master',
    description: 'Complete 250 chores',
    icon: '🏅',
    threshold: 250,
    type: 'completion',
  },

  // Streak badges
  {
    id: 'streak-3',
    name: 'On a Roll',
    description: 'Maintain a 3-day streak',
    icon: '🔥',
    threshold: 3,
    type: 'streak',
  },
  {
    id: 'streak-7',
    name: 'Week Warrior',
    description: 'Maintain a 7-day streak',
    icon: '🔥',
    threshold: 7,
    type: 'streak',
  },
  {
    id: 'streak-14',
    name: 'Fortnight Force',
    description: 'Maintain a 14-day streak',
    icon: '💪',
    threshold: 14,
    type: 'streak',
  },
  {
    id: 'streak-30',
    name: 'Unstoppable',
    description: 'Maintain a 30-day streak',
    icon: '🏆',
    threshold: 30,
    type: 'streak',
  },

  // Points badges
  {
    id: 'points-50',
    name: 'Half Century',
    description: 'Earn 50 points',
    icon: '🎖️',
    threshold: 50,
    type: 'points',
  },
  {
    id: 'points-100',
    name: 'Century Club',
    description: 'Earn 100 points',
    icon: '💯',
    threshold: 100,
    type: 'points',
  },
  {
    id: 'points-250',
    name: 'High Achiever',
    description: 'Earn 250 points',
    icon: '🎗️',
    threshold: 250,
    type: 'points',
  },
  {
    id: 'points-500',
    name: 'High Scorer',
    description: 'Earn 500 points',
    icon: '🥇',
    threshold: 500,
    type: 'points',
  },
  {
    id: 'points-1000',
    name: 'Legend',
    description: 'Earn 1000 points',
    icon: '👑',
    threshold: 1000,
    type: 'points',
  },

  // Special badges
  {
    id: 'early-bird',
    name: 'Early Bird',
    description: 'Complete a chore before 8 AM',
    icon: '🐦',
    threshold: 1,
    type: 'special',
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    description: 'Complete a chore after 10 PM',
    icon: '🦉',
    threshold: 1,
    type: 'special',
  },
  {
    id: 'team-player',
    name: 'Team Player',
    description: 'Complete an unassigned chore',
    icon: '🤝',
    threshold: 1,
    type: 'special',
  },
  {
    id: 'weekend-warrior',
    name: 'Weekend Warrior',
    description: 'Complete 5 chores on a weekend',
    icon: '🎉',
    threshold: 5,
    type: 'special',
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Complete all assigned chores in a week',
    icon: '✅',
    threshold: 1,
    type: 'special',
  },
];

// Points awarded per priority level
export const PRIORITY_POINTS: Record<string, number> = {
  low: 5,
  medium: 10,
  high: 20,
};

// Bonus points
export const BONUS_POINTS = {
  earlyCompletion: 5,  // Completed before due date
  streakBonus: 1,      // Per day of current streak (max 10)
  maxStreakBonus: 10,
};

// Helper function to get badge by ID
export function getBadgeById(id: string): Badge | undefined {
  return BADGES.find(b => b.id === id);
}

// Get badges of a specific type
export function getBadgesByType(type: Badge['type']): Badge[] {
  return BADGES.filter(b => b.type === type);
}

// Check which badges a member has earned based on their stats
export function checkEarnedBadges(
  totalCompleted: number,
  currentStreak: number,
  longestStreak: number,
  points: number,
  currentBadges: string[],
  specialConditions?: {
    earlyBird?: boolean;
    nightOwl?: boolean;
    teamPlayer?: boolean;
    weekendWarrior?: number;
    perfectWeek?: boolean;
  }
): string[] {
  const newBadges: string[] = [];

  for (const badge of BADGES) {
    // Skip if already earned
    if (currentBadges.includes(badge.id)) continue;

    let earned = false;

    switch (badge.type) {
      case 'completion':
        earned = totalCompleted >= badge.threshold;
        break;
      case 'streak':
        earned = longestStreak >= badge.threshold || currentStreak >= badge.threshold;
        break;
      case 'points':
        earned = points >= badge.threshold;
        break;
      case 'special':
        if (specialConditions) {
          switch (badge.id) {
            case 'early-bird':
              earned = specialConditions.earlyBird === true;
              break;
            case 'night-owl':
              earned = specialConditions.nightOwl === true;
              break;
            case 'team-player':
              earned = specialConditions.teamPlayer === true;
              break;
            case 'weekend-warrior':
              earned = (specialConditions.weekendWarrior || 0) >= badge.threshold;
              break;
            case 'perfectionist':
              earned = specialConditions.perfectWeek === true;
              break;
          }
        }
        break;
    }

    if (earned) {
      newBadges.push(badge.id);
    }
  }

  return newBadges;
}
