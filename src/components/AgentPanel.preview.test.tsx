import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { AgentPanel } from './AgentPanel';
vi.mock('../context/AppContext', () => ({ useApp: () => ({ state: { chores: [], teamMembers: [] }, updateChore: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); delete (window as Window & { __NESMI_PREVIEW__?: boolean }).__NESMI_PREVIEW__; });
it('never loads Google scripts or requests browser permissions when the demo tools open and reopen', async () => {
  (window as Window & { __NESMI_PREVIEW__?: boolean }).__NESMI_PREVIEW__ = true;
  const requestPermission = vi.fn();
  const notify = vi.fn();
  Object.assign(notify, { permission: 'granted', requestPermission });
  vi.stubGlobal('Notification', notify);
  const append = vi.spyOn(document.body, 'appendChild');
  const user = userEvent.setup();
  render(<AgentPanel />);
  for (let i = 0; i < 2; i++) {
    await user.click(screen.getByRole('button', { name: 'Calendar Agent' }));
    expect(screen.getByText('Google Calendar connection is unavailable in this demo.')).toBeVisible();
    expect(screen.getByText('Browser reminders are unavailable in this demo.')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Connect Google|Allow browser|Copy to Google/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
  }
  expect(append.mock.calls.some(([node]) => node instanceof HTMLScriptElement)).toBe(false);
  expect(requestPermission).not.toHaveBeenCalled();
  expect(notify).not.toHaveBeenCalled();
});
