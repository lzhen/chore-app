import { beforeEach, expect, it, vi } from 'vitest';
import { isGoogleCalendarConfigured, initGoogleApi, isGoogleSignedIn, signInToGoogle, signOutFromGoogle, createCalendarEvent, deleteCalendarEvent } from './googleCalendar';
import type { Chore } from '../types';

const platform = vi.hoisted(() => ({ native: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: platform.native } }));
beforeEach(() => { platform.native.mockReturnValue(true); });

it('blocks native OAuth initialization, token use, revocation and Calendar mutations', async () => {
  const append = vi.spyOn(document.body, 'appendChild');
  const getToken = vi.fn(() => ({ access_token: 'synthetic-only' }));
  const insert = vi.fn();
  const remove = vi.fn();
  const revoke = vi.fn();
  vi.stubGlobal('gapi', { client: { getToken, calendar: { events: { insert, remove } } } });
  vi.stubGlobal('google', { accounts: { oauth2: { revoke } } });
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect(isGoogleCalendarConfigured()).toBe(false);
    expect(await initGoogleApi()).toBe(false);
    expect(await signInToGoogle()).toBe(false);
    expect(isGoogleSignedIn()).toBe(false);
    signOutFromGoogle();
    expect(await createCalendarEvent({ title: 'Synthetic chore' } as Chore)).toBeNull();
    expect(await deleteCalendarEvent('synthetic-event')).toBe(false);
    for (const fn of [append, getToken, insert, remove, revoke]) expect(fn).not.toHaveBeenCalled();
  } finally {
    append.mockRestore(); log.mockRestore(); vi.unstubAllGlobals();
  }
});

it('retains the configured browser integration', () => {
  platform.native.mockReturnValue(false);
  expect(isGoogleCalendarConfigured()).toBe(true);
});
