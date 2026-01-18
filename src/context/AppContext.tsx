import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { Chore, TeamMember, RecurrenceType } from '../types';
import {
  fetchChores,
  fetchTeamMembers,
  createChore as dbCreateChore,
  updateChore as dbUpdateChore,
  deleteChore as dbDeleteChore,
  createTeamMember as dbCreateTeamMember,
  deleteTeamMember as dbDeleteTeamMember,
} from '../utils/supabaseStorage';
import { getNextColor } from '../utils/colors';

interface AppState {
  chores: Chore[];
  teamMembers: TeamMember[];
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
  | { type: 'REMOVE_MEMBER'; payload: string };

interface AppContextType {
  state: AppState;
  addChore: (title: string, date: string, assigneeId: string | null, recurrence: RecurrenceType) => Promise<void>;
  updateChore: (chore: Chore) => Promise<void>;
  deleteChore: (id: string) => Promise<void>;
  addMember: (name: string) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

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
    default:
      return state;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    chores: [],
    teamMembers: [],
    loading: true,
  });

  // Load data from Supabase on mount
  useEffect(() => {
    async function loadData() {
      dispatch({ type: 'SET_LOADING', payload: true });
      const [chores, members] = await Promise.all([
        fetchChores(),
        fetchTeamMembers(),
      ]);
      dispatch({ type: 'SET_CHORES', payload: chores });
      dispatch({ type: 'SET_MEMBERS', payload: members });
      dispatch({ type: 'SET_LOADING', payload: false });
    }
    loadData();
  }, []);

  const addChore = async (title: string, date: string, assigneeId: string | null, recurrence: RecurrenceType) => {
    const newChore = await dbCreateChore({ title, date, assigneeId, recurrence });
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

  return (
    <AppContext.Provider value={{ state, addChore, updateChore, deleteChore, addMember, removeMember }}>
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
