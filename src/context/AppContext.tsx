import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Chore, TeamMember, RecurrenceType } from '../types';
import { loadChores, saveChores, loadTeamMembers, saveTeamMembers } from '../utils/storage';
import { getNextColor } from '../utils/colors';

interface AppState {
  chores: Chore[];
  teamMembers: TeamMember[];
}

type Action =
  | { type: 'ADD_CHORE'; payload: { title: string; date: string; assigneeId: string | null; recurrence: RecurrenceType } }
  | { type: 'UPDATE_CHORE'; payload: Chore }
  | { type: 'DELETE_CHORE'; payload: string }
  | { type: 'ADD_MEMBER'; payload: string }
  | { type: 'REMOVE_MEMBER'; payload: string }
  | { type: 'LOAD_STATE'; payload: AppState };

interface AppContextType {
  state: AppState;
  addChore: (title: string, date: string, assigneeId: string | null, recurrence: RecurrenceType) => void;
  updateChore: (chore: Chore) => void;
  deleteChore: (id: string) => void;
  addMember: (name: string) => void;
  removeMember: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_CHORE':
      return {
        ...state,
        chores: [...state.chores, { id: uuidv4(), ...action.payload }],
      };
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
    case 'ADD_MEMBER': {
      const usedColors = state.teamMembers.map(m => m.color);
      return {
        ...state,
        teamMembers: [
          ...state.teamMembers,
          { id: uuidv4(), name: action.payload, color: getNextColor(usedColors) },
        ],
      };
    }
    case 'REMOVE_MEMBER':
      return {
        ...state,
        teamMembers: state.teamMembers.filter(m => m.id !== action.payload),
        // Also unassign chores from removed member
        chores: state.chores.map(c =>
          c.assigneeId === action.payload ? { ...c, assigneeId: null } : c
        ),
      };
    case 'LOAD_STATE':
      return action.payload;
    default:
      return state;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { chores: [], teamMembers: [] });

  // Load from localStorage on mount
  useEffect(() => {
    const chores = loadChores();
    const teamMembers = loadTeamMembers();
    dispatch({ type: 'LOAD_STATE', payload: { chores, teamMembers } });
  }, []);

  // Save to localStorage on changes
  useEffect(() => {
    saveChores(state.chores);
  }, [state.chores]);

  useEffect(() => {
    saveTeamMembers(state.teamMembers);
  }, [state.teamMembers]);

  const addChore = (title: string, date: string, assigneeId: string | null, recurrence: RecurrenceType) => {
    dispatch({ type: 'ADD_CHORE', payload: { title, date, assigneeId, recurrence } });
  };

  const updateChore = (chore: Chore) => {
    dispatch({ type: 'UPDATE_CHORE', payload: chore });
  };

  const deleteChore = (id: string) => {
    dispatch({ type: 'DELETE_CHORE', payload: id });
  };

  const addMember = (name: string) => {
    dispatch({ type: 'ADD_MEMBER', payload: name });
  };

  const removeMember = (id: string) => {
    dispatch({ type: 'REMOVE_MEMBER', payload: id });
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
