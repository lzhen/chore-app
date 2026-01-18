import { Chore, TeamMember } from '../types';

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

/**
 * Check if notifications are enabled
 */
export function areNotificationsEnabled(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Send a browser notification
 */
export function sendNotification(title: string, options?: NotificationOptions): void {
  if (!areNotificationsEnabled()) return;

  const notification = new Notification(title, {
    icon: '/chore-app/favicon.ico',
    badge: '/chore-app/favicon.ico',
    ...options,
  });

  // Auto-close after 5 seconds
  setTimeout(() => notification.close(), 5000);
}

/**
 * Send a chore reminder notification
 */
export function sendChoreReminder(chore: Chore, assignee?: TeamMember): void {
  const assigneeText = assignee ? ` (${assignee.name})` : '';

  sendNotification(`Chore Reminder: ${chore.title}`, {
    body: `Due: ${formatDate(chore.date)}${assigneeText}`,
    tag: `chore-${chore.id}`,
  });
}

/**
 * Check and send notifications for upcoming chores
 */
export function checkAndNotifyUpcomingChores(
  chores: Chore[],
  teamMembers: TeamMember[]
): void {
  const today = new Date().toISOString().split('T')[0];
  const memberMap = new Map(teamMembers.map((m) => [m.id, m]));

  // Find chores due today
  const todayChores = chores.filter((c) => c.date === today);

  // Get already notified chores from session storage
  const notifiedKey = `notified-chores-${today}`;
  const notified = new Set(JSON.parse(sessionStorage.getItem(notifiedKey) || '[]'));

  // Send notifications for new chores
  for (const chore of todayChores) {
    if (!notified.has(chore.id)) {
      const assignee = chore.assigneeId ? memberMap.get(chore.assigneeId) : undefined;
      sendChoreReminder(chore, assignee);
      notified.add(chore.id);
    }
  }

  // Save notified chores
  sessionStorage.setItem(notifiedKey, JSON.stringify([...notified]));
}

/**
 * Format a date string for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Schedule a notification for a specific time
 */
export function scheduleNotification(
  chore: Chore,
  assignee: TeamMember | undefined,
  scheduledTime: Date
): number {
  const now = new Date();
  const delay = scheduledTime.getTime() - now.getTime();

  if (delay <= 0) return -1;

  return window.setTimeout(() => {
    sendChoreReminder(chore, assignee);
  }, delay);
}
