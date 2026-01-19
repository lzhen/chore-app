// Recurrence types
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';

// Priority levels
export type Priority = 'low' | 'medium' | 'high';

// Chore status
export type ChoreStatus = 'pending' | 'completed' | 'skipped';

// Team member interface
export interface TeamMember {
  id: string;
  name: string;
  color: string;
}

// Category for organizing chores
export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

// Main chore interface (extended)
export interface Chore {
  id: string;
  title: string;
  description?: string;           // Task notes/description
  date: string;                   // ISO date string (YYYY-MM-DD)
  dueTime?: string;               // Start time in HH:mm format
  endTime?: string;               // End time in HH:mm format (for duration)
  allDay?: boolean;               // All-day event flag
  assigneeId: string | null;
  recurrence: RecurrenceType;
  priority: Priority;             // Priority level
  categoryId?: string;            // Category reference
  estimatedMinutes?: number;      // Estimated time to complete
}

// Chore instance for calendar display (includes recurring instances)
export interface ChoreInstance {
  id: string;
  choreId: string;
  title: string;
  description?: string;
  date: string;
  dueTime?: string;
  endTime?: string;               // End time for duration
  allDay?: boolean;               // All-day event flag
  assigneeId: string | null;
  assigneeName?: string;          // Name of the assignee
  color: string;
  isRecurring: boolean;
  priority: Priority;
  categoryId?: string;
  isCompleted: boolean;           // Whether this instance is completed
}

// Record of a completed chore
export interface ChoreCompletion {
  id: string;
  choreId: string;
  instanceDate: string;           // The date of the instance that was completed
  completedBy: string;            // Team member ID who completed it
  completedAt: string;            // ISO timestamp of completion
  notes?: string;                 // Optional completion notes
}

// Member availability (vacation/away status)
export interface MemberAvailability {
  id: string;
  memberId: string;
  startDate: string;              // Start of unavailability
  endDate: string;                // End of unavailability
  reason?: string;                // Optional reason (vacation, sick, etc.)
}

// Swap request between team members
export interface SwapRequest {
  id: string;
  choreId: string;
  instanceDate: string;
  requesterId: string;            // Member requesting the swap
  targetId: string;               // Member being asked to swap
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  message?: string;
}

// Chore template for quick creation
export interface ChoreTemplate {
  id: string;
  name: string;
  chores: Omit<Chore, 'id' | 'date'>[];  // Template chores without id/date
}

// Member statistics for dashboard
export interface MemberStats {
  memberId: string;
  memberName: string;
  memberColor: string;
  totalCompleted: number;
  completedThisWeek: number;
  completedThisMonth: number;
  currentStreak: number;
  longestStreak: number;
  completionRate: number;         // Percentage 0-100
  totalAssigned: number;
}

// Dashboard summary data
export interface DashboardStats {
  totalChores: number;
  completedToday: number;
  pendingToday: number;
  upcomingThisWeek: number;
  overdue: number;
  completionRateThisWeek: number;
  memberStats: MemberStats[];
}

// Filter options for search/filter
export interface ChoreFilters {
  search?: string;
  assigneeIds?: string[];
  categoryIds?: string[];
  priorities?: Priority[];
  status?: ChoreStatus;
  dateFrom?: string;
  dateTo?: string;
}

// View mode for main content area
export type ViewMode = 'calendar' | 'list' | 'dashboard';

// Notification preferences
export interface NotificationPreferences {
  browserNotifications: boolean;
  emailNotifications: boolean;
  dailyDigest: boolean;
  reminderMinutesBefore: number;
}

// Integration settings
export interface IntegrationSettings {
  slackWebhookUrl?: string;
  slackEnabled: boolean;
  googleCalendarEnabled: boolean;
  googleCalendarId?: string;
}
