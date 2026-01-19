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
    const newMember = await dbCreateTeamMember({ name, color });
    if (newMember) {
      dispatch({ type: 'ADD_MEMBER', payload: newMember });
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
