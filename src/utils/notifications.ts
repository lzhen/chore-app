import { Chore, TeamMember } from '../types';

import { Capacitor } from '@capacitor/core';

export type NotificationState = 'default' | 'granted' | 'denied' | 'dismissed' | 'unsupported' | 'insecure' | 'native' | 'error';

export function getNotificationState(): NotificationState {
  // This wrapper has no native local-notification plugin.
  if (Capacitor.isNativePlatform()) return 'native';
  if (!window.isSecureContext) return 'insecure';
  if (!('Notification' in window) || typeof Notification.requestPermission !== 'function') return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationAccess(): Promise<NotificationState> {
  const state = getNotificationState();
  if (state !== 'default') return state;
  try {
    const permission = await Notification.requestPermission();
    return permission === 'default' ? 'dismissed' : permission;
  } catch {
    return 'error';
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  return (await requestNotificationAccess()) === 'granted';
}

export function areNotificationsEnabled(): boolean {
  return getNotificationState() === 'granted';
}

/**
 * Send a browser notification
 */
export function sendNotification(title: string, options?: NotificationOptions): boolean {
  if (!areNotificationsEnabled()) return false;

  try {
  const notification = new Notification(title, {
    icon: `${import.meta.env.BASE_URL}icons/nesmi-192-20261008.png`,
    badge: `${import.meta.env.BASE_URL}icons/nesmi-192-20261008.png`,
    ...options,
  });

  // Auto-close after 5 seconds
  setTimeout(() => notification.close(), 5000);
  return true;
  } catch {
    // Some mobile browsers expose permission but cannot construct notifications.
    return false;
  }
}

/**
 * Send a chore reminder notification
 */
export function sendChoreReminder(chore: Chore, assignee?: TeamMember): boolean {
  const assigneeText = assignee ? ` (${assignee.name})` : '';

  return sendNotification(`Chore Reminder: ${chore.title}`, {
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
): boolean {
  let delivered = true;
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
      if (sendChoreReminder(chore, assignee)) notified.add(chore.id);
      else delivered = false;
    }
  }

  // Save notified chores
  sessionStorage.setItem(notifiedKey, JSON.stringify([...notified]));
  return delivered;
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
