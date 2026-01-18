/**
 * Google Calendar Integration
 *
 * This module provides integration with Google Calendar API.
 * Users can sync their chores to Google Calendar.
 *
 * To enable this feature, you need to:
 * 1. Create a Google Cloud project at https://console.cloud.google.com
 * 2. Enable the Google Calendar API
 * 3. Create OAuth 2.0 credentials (Web application type)
 * 4. Add your domain to authorized JavaScript origins
 * 5. Set the VITE_GOOGLE_CLIENT_ID environment variable
 */

import { Chore, TeamMember } from '../types';

// Google API configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '210936263317-2hrvenu5509i73usg6nvajcemnrkh33s.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

let gapiInited = false;
let gisInited = false;
let tokenClient: google.accounts.oauth2.TokenClient | null = null;

declare global {
  interface Window {
    gapi: typeof gapi;
    google: typeof google;
  }
}

/**
 * Check if Google Calendar integration is configured
 */
export function isGoogleCalendarConfigured(): boolean {
  return !!GOOGLE_CLIENT_ID;
}

/**
 * Load and initialize Google API client
 */
export async function initGoogleApi(): Promise<boolean> {
  if (!isGoogleCalendarConfigured()) {
    console.log('Google Calendar not configured - missing VITE_GOOGLE_CLIENT_ID');
    return false;
  }

  return new Promise((resolve) => {
    // Load GAPI script
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = () => {
      window.gapi.load('client', async () => {
        await window.gapi.client.init({
          discoveryDocs: [DISCOVERY_DOC],
        });
        gapiInited = true;
        maybeEnableButtons(resolve);
      });
    };
    document.body.appendChild(gapiScript);

    // Load GIS script
    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = () => {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: () => {}, // Will be set when requesting access
      });
      gisInited = true;
      maybeEnableButtons(resolve);
    };
    document.body.appendChild(gisScript);
  });
}

function maybeEnableButtons(resolve: (value: boolean) => void) {
  if (gapiInited && gisInited) {
    resolve(true);
  }
}

/**
 * Check if user is signed in to Google
 */
export function isGoogleSignedIn(): boolean {
  return !!window.gapi?.client?.getToken();
}

/**
 * Request access to Google Calendar
 */
export function signInToGoogle(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!tokenClient) {
      resolve(false);
      return;
    }

    tokenClient.callback = (response) => {
      if (response.error) {
        console.error('Google sign-in error:', response.error);
        resolve(false);
        return;
      }
      resolve(true);
    };

    if (window.gapi?.client?.getToken() === null) {
      // Prompt the user to select a Google Account
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      // Skip display of account chooser for existing session
      tokenClient.requestAccessToken({ prompt: '' });
    }
  });
}

/**
 * Sign out from Google
 */
export function signOutFromGoogle(): void {
  const token = window.gapi?.client?.getToken();
  if (token) {
    window.google.accounts.oauth2.revoke(token.access_token, () => {
      window.gapi.client.setToken(null);
    });
  }
}

/**
 * Create a Google Calendar event from a chore
 */
export async function createCalendarEvent(
  chore: Chore,
  assignee?: TeamMember
): Promise<string | null> {
  if (!isGoogleSignedIn()) {
    console.error('Not signed in to Google');
    return null;
  }

  try {
    const event = {
      summary: chore.title,
      description: assignee ? `Assigned to: ${assignee.name}` : 'Chore from Office Chore App',
      start: {
        date: chore.date,
      },
      end: {
        date: chore.date,
      },
      colorId: assignee ? getGoogleCalendarColor(assignee.color) : undefined,
    };

    const response = await window.gapi.client.calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    return response.result.id || null;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return null;
  }
}

/**
 * Sync multiple chores to Google Calendar
 */
export async function syncChoresToGoogleCalendar(
  chores: Chore[],
  teamMembers: TeamMember[]
): Promise<{ success: number; failed: number }> {
  const memberMap = new Map(teamMembers.map((m) => [m.id, m]));
  let success = 0;
  let failed = 0;

  for (const chore of chores) {
    const assignee = chore.assigneeId ? memberMap.get(chore.assigneeId) : undefined;
    const eventId = await createCalendarEvent(chore, assignee);
    if (eventId) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Map app colors to Google Calendar color IDs
 * Google Calendar has 11 predefined colors (1-11)
 */
function getGoogleCalendarColor(hexColor: string): string {
  // Simple mapping based on color hue
  const colorMap: Record<string, string> = {
    '#ef4444': '11', // Red
    '#f97316': '6', // Orange
    '#f59e0b': '5', // Amber
    '#84cc16': '10', // Lime
    '#22c55e': '10', // Green
    '#14b8a6': '7', // Teal
    '#3b82f6': '9', // Blue
    '#8b5cf6': '1', // Purple
    '#ec4899': '4', // Pink
    '#6b7280': '8', // Gray
  };

  return colorMap[hexColor] || '9'; // Default to blue
}

/**
 * Delete a Google Calendar event
 */
export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  if (!isGoogleSignedIn()) {
    return false;
  }

  try {
    await window.gapi.client.calendar.events.remove({
      calendarId: 'primary',
      eventId: eventId,
    });
    return true;
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return false;
  }
}
