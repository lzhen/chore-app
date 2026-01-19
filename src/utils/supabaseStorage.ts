import { supabase } from './supabase';
import {
  Chore,
  TeamMember,
  Category,
  ChoreCompletion,
  MemberAvailability,
  Priority
} from '../types';

// Database types (snake_case for Supabase)
interface DbChore {
  id: string;
  title: string;
  description: string | null;
  date: string;
  due_time: string | null;
  assignee_id: string | null;
  recurrence: string;
  priority: string;
  category_id: string | null;
  estimated_minutes: number | null;
}

interface DbTeamMember {
  id: string;
  name: string;
  color: string;
}

interface DbCategory {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

interface DbChoreCompletion {
  id: string;
  chore_id: string;
  instance_date: string;
  completed_by: string;
  completed_at: string;
  notes: string | null;
}

interface DbMemberAvailability {
  id: string;
  member_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
}

// Convert from DB format to app format
function dbToChore(db: DbChore): Chore {
  return {
    id: db.id,
    title: db.title,
    description: db.description || undefined,
    date: db.date,
    dueTime: db.due_time || undefined,
    assigneeId: db.assignee_id,
    recurrence: db.recurrence as Chore['recurrence'],
    priority: (db.priority || 'medium') as Priority,
    categoryId: db.category_id || undefined,
    estimatedMinutes: db.estimated_minutes || undefined,
  };
}

function dbToMember(db: DbTeamMember): TeamMember {
  return {
    id: db.id,
    name: db.name,
    color: db.color,
  };
}

function dbToCategory(db: DbCategory): Category {
  return {
    id: db.id,
    name: db.name,
    color: db.color,
    icon: db.icon || undefined,
  };
}

function dbToCompletion(db: DbChoreCompletion): ChoreCompletion {
  return {
    id: db.id,
    choreId: db.chore_id,
    instanceDate: db.instance_date,
    completedBy: db.completed_by,
    completedAt: db.completed_at,
    notes: db.notes || undefined,
  };
}

function dbToAvailability(db: DbMemberAvailability): MemberAvailability {
  return {
    id: db.id,
    memberId: db.member_id,
    startDate: db.start_date,
    endDate: db.end_date,
    reason: db.reason || undefined,
  };
}

// ============================================
// Chores CRUD
// ============================================

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
      description: chore.description || null,
      date: chore.date,
      due_time: chore.dueTime || null,
      assignee_id: chore.assigneeId,
      recurrence: chore.recurrence,
      priority: chore.priority || 'medium',
      category_id: chore.categoryId || null,
      estimated_minutes: chore.estimatedMinutes || null,
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
      description: chore.description || null,
      date: chore.date,
      due_time: chore.dueTime || null,
      assignee_id: chore.assigneeId,
      recurrence: chore.recurrence,
      priority: chore.priority || 'medium',
      category_id: chore.categoryId || null,
      estimated_minutes: chore.estimatedMinutes || null,
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

// ============================================
// Team Members CRUD
// ============================================

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

// ============================================
// Categories CRUD
// ============================================

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  return (data || []).map(dbToCategory);
}

export async function createCategory(category: Omit<Category, 'id'>): Promise<Category | null> {
  const { data, error } = await supabase
    .from('categories')
    .insert({
      name: category.name,
      color: category.color,
      icon: category.icon || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating category:', error);
    return null;
  }

  return dbToCategory(data);
}

export async function updateCategory(category: Category): Promise<boolean> {
  const { error } = await supabase
    .from('categories')
    .update({
      name: category.name,
      color: category.color,
      icon: category.icon || null,
    })
    .eq('id', category.id);

  if (error) {
    console.error('Error updating category:', error);
    return false;
  }

  return true;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting category:', error);
    return false;
  }

  return true;
}

// ============================================
// Chore Completions CRUD
// ============================================

export async function fetchCompletions(): Promise<ChoreCompletion[]> {
  const { data, error } = await supabase
    .from('chore_completions')
    .select('*')
    .order('completed_at', { ascending: false });

  if (error) {
    console.error('Error fetching completions:', error);
    return [];
  }

  return (data || []).map(dbToCompletion);
}

export async function createCompletion(completion: Omit<ChoreCompletion, 'id'>): Promise<ChoreCompletion | null> {
  const { data, error } = await supabase
    .from('chore_completions')
    .insert({
      chore_id: completion.choreId,
      instance_date: completion.instanceDate,
      completed_by: completion.completedBy,
      completed_at: completion.completedAt,
      notes: completion.notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating completion:', error);
    return null;
  }

  return dbToCompletion(data);
}

export async function deleteCompletion(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('chore_completions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting completion:', error);
    return false;
  }

  return true;
}

// Check if a specific chore instance is completed
export async function isInstanceCompleted(choreId: string, instanceDate: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('chore_completions')
    .select('id')
    .eq('chore_id', choreId)
    .eq('instance_date', instanceDate)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error checking completion:', error);
  }

  return !!data;
}

// Get completions for a specific chore
export async function getChoreCompletions(choreId: string): Promise<ChoreCompletion[]> {
  const { data, error } = await supabase
    .from('chore_completions')
    .select('*')
    .eq('chore_id', choreId)
    .order('completed_at', { ascending: false });

  if (error) {
    console.error('Error fetching chore completions:', error);
    return [];
  }

  return (data || []).map(dbToCompletion);
}

// ============================================
// Member Availability CRUD
// ============================================

export async function fetchAvailability(): Promise<MemberAvailability[]> {
  const { data, error } = await supabase
    .from('member_availability')
    .select('*')
    .order('start_date', { ascending: true });

  if (error) {
    console.error('Error fetching availability:', error);
    return [];
  }

  return (data || []).map(dbToAvailability);
}

export async function createAvailability(availability: Omit<MemberAvailability, 'id'>): Promise<MemberAvailability | null> {
  const { data, error } = await supabase
    .from('member_availability')
    .insert({
      member_id: availability.memberId,
      start_date: availability.startDate,
      end_date: availability.endDate,
      reason: availability.reason || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating availability:', error);
    return null;
  }

  return dbToAvailability(data);
}

export async function updateAvailability(availability: MemberAvailability): Promise<boolean> {
  const { error } = await supabase
    .from('member_availability')
    .update({
      member_id: availability.memberId,
      start_date: availability.startDate,
      end_date: availability.endDate,
      reason: availability.reason || null,
    })
    .eq('id', availability.id);

  if (error) {
    console.error('Error updating availability:', error);
    return false;
  }

  return true;
}

export async function deleteAvailability(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('member_availability')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting availability:', error);
    return false;
  }

  return true;
}

// Check if a member is available on a specific date
export async function isMemberAvailable(memberId: string, date: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('member_availability')
    .select('id')
    .eq('member_id', memberId)
    .lte('start_date', date)
    .gte('end_date', date);

  if (error) {
    console.error('Error checking member availability:', error);
    return true; // Assume available if error
  }

  // If there's any availability record covering this date, member is NOT available
  return !data || data.length === 0;
}

// Get all members who are available on a specific date
export async function getAvailableMembers(date: string, allMembers: TeamMember[]): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('member_availability')
    .select('member_id')
    .lte('start_date', date)
    .gte('end_date', date);

  if (error) {
    console.error('Error fetching unavailable members:', error);
    return allMembers;
  }

  const unavailableMemberIds = new Set((data || []).map(d => d.member_id));
  return allMembers.filter(m => !unavailableMemberIds.has(m.id));
}
