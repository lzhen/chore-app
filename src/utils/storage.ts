import { Chore, TeamMember } from '../types';

const CHORES_KEY = 'chore-app-chores';
const MEMBERS_KEY = 'chore-app-members';

export function loadChores(): Chore[] {
  try {
    const data = localStorage.getItem(CHORES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveChores(chores: Chore[]): void {
  localStorage.setItem(CHORES_KEY, JSON.stringify(chores));
}

export function loadTeamMembers(): TeamMember[] {
  try {
    const data = localStorage.getItem(MEMBERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveTeamMembers(members: TeamMember[]): void {
  localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
}
