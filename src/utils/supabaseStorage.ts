import { shortTime } from './dates';
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
  end_time?: string | null;
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
  avatar_url: string | null;
  email: string | null;
  skills: string[] | null;
  working_hours_start: string | null;
  working_hours_end: string | null;
  working_days: number[] | null;
  points: number;
  badges: string[] | null;
  weekly_capacity_minutes: number | null;
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
    dueTime: shortTime(db.due_time),
    endTime: shortTime(db.end_time),
    assigneeId: db.assignee_id,
    recurrence: db.recurrence as Chore['recurrence'],
    priority: (db.priority || 'medium') as Priority,
    categoryId: db.category_id || undefined,
    estimatedMinutes: db.estimated_minutes ?? undefined,
  };
}

function dbToMember(db: DbTeamMember): TeamMember {
  return {
    id: db.id,
    name: db.name,
    color: db.color,
    avatarUrl: db.avatar_url ?? undefined,
    email: db.email ?? undefined,
    skills: db.skills ?? undefined,
    workingHours: db.working_hours_start != null && db.working_hours_end != null ? {
      start: db.working_hours_start,
      end: db.working_hours_end,
      days: db.working_days ?? [1, 2, 3, 4, 5],
    } : undefined,
    points: db.points ?? 0,
    badges: db.badges ?? [],
    weeklyCapacityMinutes: db.weekly_capacity_minutes ?? undefined,
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
    throw new Error('Could not load chores. Please try again.');
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
      end_time: chore.endTime || null,
      assignee_id: chore.assigneeId,
      recurrence: chore.recurrence,
      priority: chore.priority || 'medium',
      category_id: chore.categoryId || null,
      estimated_minutes: chore.estimatedMinutes ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error('Could not save chore. Please check your connection before trying again.');
  }
  // The INSERT can have reached the database even when its acknowledgement
  // is missing. Never add an ID-less chore locally or encourage a blind retry
  // that could create a duplicate household task.
  if (!data || typeof data.id !== 'string' || data.id.trim().length === 0) {
    throw new Error('Chore save could not be confirmed. Refresh to check before trying again.');
  }

  return dbToChore(data);
}

export async function updateChore(chore: Chore): Promise<Chore> {
  const { data, error } = await supabase
    .from('chores')
    .update({
      title: chore.title,
      description: chore.description || null,
      date: chore.date,
      due_time: chore.dueTime || null,
      end_time: chore.endTime || null,
      assignee_id: chore.assigneeId,
      recurrence: chore.recurrence,
      priority: chore.priority || 'medium',
      category_id: chore.categoryId || null,
      estimated_minutes: chore.estimatedMinutes ?? null,
    })
    .eq('id', chore.id)
    .select('*');

  // An ID-only receipt proves that a row was touched, not what was stored.
  // Render the complete database-returned chore rather than unverified form
  // values, and reject zero-row / wrong-row / multirow acknowledgements.
  if (error || !Array.isArray(data) || data.length !== 1 || data[0]?.id !== chore.id) {
    throw new Error('Could not confirm updated chore. Refresh to check before trying again.');
  }

  return dbToChore(data[0]);
}

export async function deleteChore(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('chores')
    .delete()
    .eq('id', id)
    .select('id');

  // Never hide a chore locally unless this exact row was deleted on server.
  if (error || !Array.isArray(data) || data.length !== 1 || data[0]?.id !== id) {
    throw new Error('Could not delete chore. Please try again.');
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
    throw new Error('Could not load team members. Please try again.');
  }

  return (data || []).map(dbToMember);
}

// Persist only columns already present in public.team_members.
// Avatar uploads are intentionally excluded: FileReader data URLs are not
// durable object-storage URLs and must not be silently written to avatar_url.
const memberWritePayload = (member: Omit<TeamMember, 'id'>): Record<string, unknown> => ({
  name: member.name,
  color: member.color,
  email: member.email ?? null,
  skills: member.skills ?? null,
  working_hours_start: member.workingHours?.start ?? null,
  working_hours_end: member.workingHours?.end ?? null,
  working_days: member.workingHours?.days ?? null,
  points: member.points ?? 0,
  badges: member.badges ?? [],
  weekly_capacity_minutes: member.weeklyCapacityMinutes ?? null,
});

export async function createTeamMember(member: Omit<TeamMember, 'id'>): Promise<TeamMember | null> {
  const { data, error } = await supabase
    .from('team_members')
    .insert(memberWritePayload(member))
    .select()
    .single();

  // A successful INSERT may have committed even if PostgREST could not
  // return the inserted row. Do not display an ID-less household member or
  // encourage an immediate retry that could create a duplicate member.
  if (error || !data || typeof data.id !== 'string' || data.id.trim().length === 0) {
    throw new Error('Team member save could not be confirmed. Refresh to check before trying again.');
  }
  return dbToMember(data);
}

export async function updateTeamMember(member: TeamMember): Promise<TeamMember> {
  const { data, error } = await supabase
    .from('team_members')
    .update(memberWritePayload(member))
    .eq('id', member.id)
    .select()
    .single();

  if (error || !data) {
    // Propagate failure to AppContext and the editor. Never merge unsaved
    // client-only values into the DB response and display them as saved.
    throw new Error('Could not update team member. Please try again.');
  }
  return dbToMember(data);
}

export async function deleteTeamMember(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', id)
    .select('id');

  // PostgREST can return no error while RLS filters out the target row.
  // Only remove the member from local state when the database confirms the
  // exact requested ID was deleted; otherwise surface an actionable failure.
  if (error || !Array.isArray(data) || data.length !== 1 || data[0]?.id !== id) {
    throw new Error('Could not delete team member. Please try again.');
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
    throw new Error('Could not load categories. Please try again.');
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

  // A category INSERT can commit even if its PostgREST receipt is absent.
  // Do not add an ID-less category or suggest an immediate duplicate retry.
  if (error || !data || typeof data.id !== 'string' || data.id.trim().length === 0) {
    throw new Error('Category save could not be confirmed. Refresh to check before trying again.');
  }

  return dbToCategory(data);
}

export async function updateCategory(category: Category): Promise<boolean> {
  const { data, error } = await supabase
    .from('categories')
    .update({
      name: category.name,
      color: category.color,
      icon: category.icon || null,
    })
    .eq('id', category.id)
    .select('id');

  // A zero-row response without a PostgREST error is possible when an RLS
  // policy hides the target or the row no longer exists. Never show the
  // optimistic category as saved unless the exact row was acknowledged.
  if (error || !Array.isArray(data) || data.length !== 1 || data[0]?.id !== category.id) {
    throw new Error('Could not update category. Please try again.');
  }

  return true;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .select('id');

  // Keep the category visible if the server did not explicitly confirm
  // removing this one row. An empty RLS-filtered DELETE is not success.
  if (error || !Array.isArray(data) || data.length !== 1 || data[0]?.id !== id) {
    throw new Error('Could not delete category. Please try again.');
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
    throw new Error('Could not load completions. Please try again.');
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
    throw new Error('Completion save could not be confirmed. Refresh to check before trying again.');
  }
  // An INSERT may have reached Postgres even without a readable receipt.
  // Do not announce completion or award points without a persisted row ID,
  // and discourage blind retries that could record the same chore twice.
  if (!data || typeof data.id !== 'string' || data.id.trim().length === 0) {
    throw new Error('Completion save could not be confirmed. Refresh to check before trying again.');
  }

  return dbToCompletion(data);
}

export async function deleteCompletion(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('chore_completions')
    .delete()
    .eq('id', id)
    .select('id');

  // A zero-row, wrong-ID, or multirow receipt must never be interpreted as
  // deleting the requested completion. This can happen without HTTP errors.
  if (error || !Array.isArray(data) || data.length !== 1 || data[0]?.id !== id) {
    throw new Error('Could not delete completion. Please try again.');
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
    throw new Error('Could not load chore completions. Please try again.');
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
    throw new Error('Could not load availability. Please try again.');
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

  // An INSERT may commit even when its PostgREST acknowledgement is absent.
  // Avoid displaying an ID-less absence interval or suggesting a blind retry
  // that could produce duplicate availability records.
  if (error || !data || typeof data.id !== 'string' || data.id.trim().length === 0) {
    throw new Error('Availability save could not be confirmed. Refresh to check before trying again.');
  }

  return dbToAvailability(data);
}

export async function updateAvailability(availability: MemberAvailability): Promise<boolean> {
  const { data, error } = await supabase
    .from('member_availability')
    .update({
      member_id: availability.memberId,
      start_date: availability.startDate,
      end_date: availability.endDate,
      reason: availability.reason || null,
    })
    .eq('id', availability.id)
    .select('id');

  // A successful HTTP response can affect zero rows (e.g. after deletion or
  // because of RLS). Never confirm a saved absence interval without an exact
  // database acknowledgement for the requested availability record.
  if (error || !Array.isArray(data) || data.length !== 1 || data[0]?.id !== availability.id) {
    throw new Error('Could not update availability. Please try again.');
  }

  return true;
}

export async function deleteAvailability(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('member_availability')
    .delete()
    .eq('id', id)
    .select('id');

  // Keep the absence interval visible unless this exact database row is
  // confirmed deleted. A zero-row or wrong-ID receipt is not success.
  if (error || !Array.isArray(data) || data.length !== 1 || data[0]?.id !== id) {
    throw new Error('Could not delete availability. Please try again.');
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
