import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import {
  Chore,
  TeamMember,
  Category,
  ChoreCompletion,
  MemberAvailability,
} from '../types';
import {
  fetchChores,
  fetchTeamMembers,
  fetchCategories,
  fetchCompletions,
  fetchAvailability,
  createChore as dbCreateChore,
  updateChore as dbUpdateChore,
  deleteChore as dbDeleteChore,
  createTeamMember as dbCreateTeamMember,
  updateTeamMember as dbUpdateTeamMember,
  deleteTeamMember as dbDeleteTeamMember,
  createCategory as dbCreateCategory,
  updateCategory as dbUpdateCategory,
  deleteCategory as dbDeleteCategory,
  createCompletion as dbCreateCompletion,
  deleteCompletion as dbDeleteCompletion,
  createAvailability as dbCreateAvailability,
  updateAvailability as dbUpdateAvailability,
  deleteAvailability as dbDeleteAvailability,
} from '../utils/supabaseStorage';
import { getNextColor } from '../utils/colors';
import { PRIORITY_POINTS, BONUS_POINTS, checkEarnedBadges } from '../data/badges';

interface AppState {
  chores: Chore[];
  teamMembers: TeamMember[];
  categories: Category[];
  completions: ChoreCompletion[];
  availability: MemberAvailability[];
  loading: boolean;
}

type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CHORES'; payload: Chore[] }
  | { type: 'ADD_CHORE'; payload: Chore }
  | { type: 'UPDATE_CHORE'; payload: Chore }
  | { type: 'DELETE_CHORE'; payload: string }
  | { type: 'SET_MEMBERS'; payload: TeamMember[] }
  | { type: 'ADD_MEMBER'; payload: TeamMember }
  | { type: 'UPDATE_MEMBER'; payload: TeamMember }
  | { type: 'REMOVE_MEMBER'; payload: string }
  | { type: 'SET_CATEGORIES'; payload: Category[] }
  | { type: 'ADD_CATEGORY'; payload: Category }
  | { type: 'UPDATE_CATEGORY'; payload: Category }
  | { type: 'DELETE_CATEGORY'; payload: string }
  | { type: 'SET_COMPLETIONS'; payload: ChoreCompletion[] }
  | { type: 'ADD_COMPLETION'; payload: ChoreCompletion }
  | { type: 'DELETE_COMPLETION'; payload: string }
  | { type: 'SET_AVAILABILITY'; payload: MemberAvailability[] }
  | { type: 'ADD_AVAILABILITY'; payload: MemberAvailability }
  | { type: 'UPDATE_AVAILABILITY'; payload: MemberAvailability }
  | { type: 'DELETE_AVAILABILITY'; payload: string };

interface AppContextType {
  state: AppState;
  // Chore operations
  addChore: (chore: Omit<Chore, 'id'>) => Promise<void>;
  updateChore: (chore: Chore) => Promise<void>;
  deleteChore: (id: string) => Promise<void>;
  // Team member operations
  addMember: (name: string) => Promise<void>;
  updateMember: (member: TeamMember) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  // Category operations
  addCategory: (name: string, color: string, icon?: string) => Promise<void>;
  updateCategory: (category: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  // Completion operations
  completeChore: (choreId: string, instanceDate: string, completedBy: string, notes?: string) => Promise<void>;
  uncompleteChore: (completionId: string) => Promise<void>;
  isChoreCompleted: (choreId: string, instanceDate: string) => boolean;
  // Availability operations
  addAvailability: (memberId: string, startDate: string, endDate: string, reason?: string) => Promise<void>;
  updateAvailability: (availability: MemberAvailability) => Promise<void>;
  deleteAvailability: (id: string) => Promise<void>;
  isMemberAvailable: (memberId: string, date: string) => boolean;
  getAvailableMembers: (date: string) => TeamMember[];
  // Gamification helpers
  getMemberStats: (memberId: string) => { totalCompleted: number; currentStreak: number; longestStreak: number };
}

const AppContext = createContext<AppContextType | null>(null);

const initialState: AppState = {
  chores: [],
  teamMembers: [],
  categories: [],
  completions: [],
  availability: [],
  loading: true,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_CHORES':
      return { ...state, chores: action.payload };
    case 'ADD_CHORE':
      return { ...state, chores: [...state.chores, action.payload] };
    case 'UPDATE_CHORE':
      return {
        ...state,
        chores: state.chores.map(c => (c.id === action.payload.id ? action.payload : c)),
      };
    case 'DELETE_CHORE':
      return {
        ...state,
        chores: state.chores.filter(c => c.id !== action.payload),
      };
    case 'SET_MEMBERS':
      return { ...state, teamMembers: action.payload };
    case 'ADD_MEMBER':
      return { ...state, teamMembers: [...state.teamMembers, action.payload] };
    case 'UPDATE_MEMBER':
      return {
        ...state,
        teamMembers: state.teamMembers.map(m => (m.id === action.payload.id ? action.payload : m)),
      };
    case 'REMOVE_MEMBER':
      return {
        ...state,
        teamMembers: state.teamMembers.filter(m => m.id !== action.payload),
      };
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload };
    case 'ADD_CATEGORY':
      return { ...state, categories: [...state.categories, action.payload] };
    case 'UPDATE_CATEGORY':
      return {
        ...state,
        categories: state.categories.map(c => (c.id === action.payload.id ? action.payload : c)),
      };
    case 'DELETE_CATEGORY':
      return {
        ...state,
        categories: state.categories.filter(c => c.id !== action.payload),
      };
    case 'SET_COMPLETIONS':
      return { ...state, completions: action.payload };
    case 'ADD_COMPLETION':
      return { ...state, completions: [...state.completions, action.payload] };
    case 'DELETE_COMPLETION':
      return {
        ...state,
        completions: state.completions.filter(c => c.id !== action.payload),
      };
    case 'SET_AVAILABILITY':
      return { ...state, availability: action.payload };
    case 'ADD_AVAILABILITY':
      return { ...state, availability: [...state.availability, action.payload] };
    case 'UPDATE_AVAILABILITY':
      return {
        ...state,
        availability: state.availability.map(a => (a.id === action.payload.id ? action.payload : a)),
      };
    case 'DELETE_AVAILABILITY':
      return {
        ...state,
        availability: state.availability.filter(a => a.id !== action.payload),
      };
    default:
      return state;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load data from Supabase on mount
  useEffect(() => {
    async function loadData() {
      dispatch({ type: 'SET_LOADING', payload: true });
      const [chores, members, categories, completions, availability] = await Promise.all([
        fetchChores(),
        fetchTeamMembers(),
        fetchCategories(),
        fetchCompletions(),
        fetchAvailability(),
      ]);
      dispatch({ type: 'SET_CHORES', payload: chores });
      dispatch({ type: 'SET_MEMBERS', payload: members });
      dispatch({ type: 'SET_CATEGORIES', payload: categories });
      dispatch({ type: 'SET_COMPLETIONS', payload: completions });
      dispatch({ type: 'SET_AVAILABILITY', payload: availability });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
    loadData();
  }, []);

  // ============================================
  // Chore operations
  // ============================================

  const addChore = async (choreData: Omit<Chore, 'id'>) => {
    const newChore = await dbCreateChore(choreData);
    if (newChore) {
      dispatch({ type: 'ADD_CHORE', payload: newChore });
    }
  };

  const updateChore = async (chore: Chore) => {
    const success = await dbUpdateChore(chore);
    if (success) {
      dispatch({ type: 'UPDATE_CHORE', payload: chore });
    }
  };

  const deleteChore = async (id: string) => {
    const success = await dbDeleteChore(id);
    if (success) {
      dispatch({ type: 'DELETE_CHORE', payload: id });
    }
  };

  // ============================================
  // Team member operations
  // ============================================

  const addMember = async (name: string) => {
    const usedColors = state.teamMembers.map(m => m.color);
    const color = getNextColor(usedColors);
    const newMember = await dbCreateTeamMember({ name, color, points: 0, badges: [] });
    if (newMember) {
      dispatch({ type: 'ADD_MEMBER', payload: newMember });
    }
  };

  const updateMember = async (member: TeamMember) => {
    const updated = await dbUpdateTeamMember(member);
    if (updated) {
      dispatch({ type: 'UPDATE_MEMBER', payload: updated });
    }
  };

  const removeMember = async (id: string) => {
    const success = await dbDeleteTeamMember(id);
    if (success) {
      dispatch({ type: 'REMOVE_MEMBER', payload: id });
    }
  };

  // ============================================
  // Category operations
  // ============================================

  const addCategory = async (name: string, color: string, icon?: string) => {
    const newCategory = await dbCreateCategory({ name, color, icon });
    if (newCategory) {
      dispatch({ type: 'ADD_CATEGORY', payload: newCategory });
    }
  };

  const updateCategoryFn = async (category: Category) => {
    const success = await dbUpdateCategory(category);
    if (success) {
      dispatch({ type: 'UPDATE_CATEGORY', payload: category });
    }
  };

  const deleteCategoryFn = async (id: string) => {
    const success = await dbDeleteCategory(id);
    if (success) {
      dispatch({ type: 'DELETE_CATEGORY', payload: id });
    }
  };

  // ============================================
  // Completion operations
  // ============================================

  const completeChore = async (choreId: string, instanceDate: string, completedBy: string, notes?: string) => {
    const completion = await dbCreateCompletion({
      choreId,
      instanceDate,
      completedBy,
      completedAt: new Date().toISOString(),
      notes,
    });
    if (completion) {
      dispatch({ type: 'ADD_COMPLETION', payload: completion });

      // Award points and check badges
      const chore = state.chores.find(c => c.id === choreId);
      const member = state.teamMembers.find(m => m.id === completedBy);

      if (chore && member) {
        // Calculate base points based on priority
        let pointsEarned = PRIORITY_POINTS[chore.priority] || PRIORITY_POINTS.medium;

        // Get member stats for streak bonus and badge checking
        const stats = getMemberStats(completedBy);

        // Add streak bonus (capped at maxStreakBonus)
        const streakBonus = Math.min(stats.currentStreak, BONUS_POINTS.maxStreakBonus) * BONUS_POINTS.streakBonus;
        pointsEarned += streakBonus;

        // Check for special conditions
        const completedAtTime = new Date();
        const hour = completedAtTime.getHours();
        const dayOfWeek = completedAtTime.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const specialConditions = {
          earlyBird: hour < 8,
          nightOwl: hour >= 22,
          teamPlayer: chore.assigneeId === null,
          weekendWarrior: isWeekend ? (state.completions.filter(
            c => c.completedBy === completedBy &&
            new Date(c.instanceDate).getDay() % 6 === 0 &&
            c.instanceDate === instanceDate
          ).length + 1) : 0,
        };

        // Check for newly earned badges
        const newBadges = checkEarnedBadges(
          stats.totalCompleted + 1, // Include this completion
          stats.currentStreak + 1,  // Include this day
          Math.max(stats.longestStreak, stats.currentStreak + 1),
          member.points + pointsEarned,
          member.badges,
          specialConditions
        );

        // Update member with new points and badges
        if (pointsEarned > 0 || newBadges.length > 0) {
          const updatedMember = {
            ...member,
            points: member.points + pointsEarned,
            badges: [...member.badges, ...newBadges],
          };
          const updated = await dbUpdateTeamMember(updatedMember);
          if (updated) {
            dispatch({ type: 'UPDATE_MEMBER', payload: updated });
          }
        }
      }
    }
  };

  const uncompleteChore = async (completionId: string) => {
    const success = await dbDeleteCompletion(completionId);
    if (success) {
      dispatch({ type: 'DELETE_COMPLETION', payload: completionId });
    }
  };

  const isChoreCompleted = (choreId: string, instanceDate: string): boolean => {
    return state.completions.some(
      c => c.choreId === choreId && c.instanceDate === instanceDate
    );
  };

  // ============================================
  // Gamification helpers
  // ============================================

  const getMemberStats = (memberId: string): { totalCompleted: number; currentStreak: number; longestStreak: number } => {
    // Get all completions for this member, sorted by date
    const memberCompletions = state.completions
      .filter(c => c.completedBy === memberId)
      .sort((a, b) => new Date(a.instanceDate).getTime() - new Date(b.instanceDate).getTime());

    const totalCompleted = memberCompletions.length;

    if (totalCompleted === 0) {
      return { totalCompleted: 0, currentStreak: 0, longestStreak: 0 };
    }

    // Calculate streaks by looking at unique dates
    const uniqueDates = [...new Set(memberCompletions.map(c => c.instanceDate))].sort();

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 1;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if there's a completion today or yesterday for current streak
    const lastCompletionDate = uniqueDates[uniqueDates.length - 1];
    const lastDate = new Date(lastCompletionDate);
    lastDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    // Calculate longest streak
    for (let i = 1; i < uniqueDates.length; i++) {
      const prevDate = new Date(uniqueDates[i - 1]);
      const currDate = new Date(uniqueDates[i]);
      const dayDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

      if (dayDiff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    // Current streak is only valid if last completion was today or yesterday
    if (diffDays <= 1) {
      // Count backwards from the last date
      currentStreak = 1;
      for (let i = uniqueDates.length - 2; i >= 0; i--) {
        const currDate = new Date(uniqueDates[i + 1]);
        const prevDate = new Date(uniqueDates[i]);
        const dayDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (dayDiff === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    return { totalCompleted, currentStreak, longestStreak };
  };

  // ============================================
  // Availability operations
  // ============================================

  const addAvailabilityFn = async (memberId: string, startDate: string, endDate: string, reason?: string) => {
    const newAvailability = await dbCreateAvailability({ memberId, startDate, endDate, reason });
    if (newAvailability) {
      dispatch({ type: 'ADD_AVAILABILITY', payload: newAvailability });
    }
  };

  const updateAvailabilityFn = async (availability: MemberAvailability) => {
    const success = await dbUpdateAvailability(availability);
    if (success) {
      dispatch({ type: 'UPDATE_AVAILABILITY', payload: availability });
    }
  };

  const deleteAvailabilityFn = async (id: string) => {
    const success = await dbDeleteAvailability(id);
    if (success) {
      dispatch({ type: 'DELETE_AVAILABILITY', payload: id });
    }
  };

  const isMemberAvailableFn = (memberId: string, date: string): boolean => {
    return !state.availability.some(
      a => a.memberId === memberId && a.startDate <= date && a.endDate >= date
    );
  };

  const getAvailableMembersFn = (date: string): TeamMember[] => {
    const unavailableMemberIds = new Set(
      state.availability
        .filter(a => a.startDate <= date && a.endDate >= date)
        .map(a => a.memberId)
    );
    return state.teamMembers.filter(m => !unavailableMemberIds.has(m.id));
  };

  return (
    <AppContext.Provider
      value={{
        state,
        addChore,
        updateChore,
        deleteChore,
        addMember,
        updateMember,
        removeMember,
        addCategory,
        updateCategory: updateCategoryFn,
        deleteCategory: deleteCategoryFn,
        completeChore,
        uncompleteChore,
        isChoreCompleted,
        addAvailability: addAvailabilityFn,
        updateAvailability: updateAvailabilityFn,
        deleteAvailability: deleteAvailabilityFn,
        isMemberAvailable: isMemberAvailableFn,
        getAvailableMembers: getAvailableMembersFn,
        getMemberStats,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
