export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

export interface TeamMember {
  id: string;
  name: string;
  color: string;
}

export interface Chore {
  id: string;
  title: string;
  date: string; // ISO date string (YYYY-MM-DD)
  assigneeId: string | null;
  recurrence: RecurrenceType;
}

export interface ChoreInstance {
  id: string;
  choreId: string;
  title: string;
  date: string;
  assigneeId: string | null;
  color: string;
  isRecurring: boolean;
}
