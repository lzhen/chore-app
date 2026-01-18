import { supabase } from './supabase';
import { Chore, TeamMember } from '../types';

// Database types (snake_case for Supabase)
interface DbChore {
  id: string;
  title: string;
  date: string;
  assignee_id: string | null;
  recurrence: string;
}

interface DbTeamMember {
  id: string;
  name: string;
  color: string;
}

// Convert from DB format to app format
function dbToChore(db: DbChore): Chore {
  return {
    id: db.id,
    title: db.title,
    date: db.date,
    assigneeId: db.assignee_id,
    recurrence: db.recurrence as Chore['recurrence'],
  };
}

function dbToMember(db: DbTeamMember): TeamMember {
  return {
    id: db.id,
    name: db.name,
    color: db.color,
  };
}

// Chores CRUD
export async function fetchChores(): Promise<Chore[]> {
  const { data, error } = await supabase
    .from('chores')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching chores:', error);
    return [];
  }

  return (data || []).map(dbToChore);
}

export async function createChore(chore: Omit<Chore, 'id'>): Promise<Chore | null> {
  const { data, error } = await supabase
    .from('chores')
    .insert({
      title: chore.title,
      date: chore.date,
      assignee_id: chore.assigneeId,
      recurrence: chore.recurrence,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating chore:', error);
    return null;
  }

  return dbToChore(data);
}

export async function updateChore(chore: Chore): Promise<boolean> {
  const { error } = await supabase
    .from('chores')
    .update({
      title: chore.title,
      date: chore.date,
      assignee_id: chore.assigneeId,
      recurrence: chore.recurrence,
    })
    .eq('id', chore.id);

  if (error) {
    console.error('Error updating chore:', error);
    return false;
  }

  return true;
}

export async function deleteChore(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('chores')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting chore:', error);
    return false;
  }

  return true;
}

// Team Members CRUD
export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching team members:', error);
    return [];
  }

  return (data || []).map(dbToMember);
}

export async function createTeamMember(member: Omit<TeamMember, 'id'>): Promise<TeamMember | null> {
  const { data, error } = await supabase
    .from('team_members')
    .insert({
      name: member.name,
      color: member.color,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating team member:', error);
    return null;
  }

  return dbToMember(data);
}

export async function deleteTeamMember(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting team member:', error);
    return false;
  }

  return true;
}
