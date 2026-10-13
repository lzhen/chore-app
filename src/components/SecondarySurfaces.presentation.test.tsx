import { readFileSync } from 'node:fs';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AccountSettings } from './AccountSettings';
import { Dashboard } from './Dashboard';
import { WorkloadChart } from './WorkloadChart';
import { dateKey, shiftDate } from '../utils/dates';
import type { Chore, ChoreCompletion, TeamMember } from '../types';
const auth = vi.hoisted(() => ({ user: { email: 'person@example.test' }, signOut: vi.fn(), deleteAccount: vi.fn() }));
const app = vi.hoisted(() => ({ state: { chores: [] as Chore[], teamMembers: [] as TeamMember[], completions: [] as ChoreCompletion[] } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../context/AppContext', () => ({ useApp: () => app }));
vi.mock('./ThemeSelector', () => ({ ThemeSelector: () => <button>Switch to dark mode</button> }));
afterEach(cleanup);
beforeEach(() => {
  app.state.chores = [];
  app.state.teamMembers = [];
  app.state.completions = [];
});
it('adopts named semantic classes in all secondary surfaces without gradient actions or blanket utility overrides', () => {
  const styles = readFileSync('src/styles/nesmi-secondary-surfaces.css', 'utf8');
  expect(styles).toContain('font-size: var(--nesmi-type-body, 1rem)');
  expect(styles).toContain('font-size: var(--nesmi-type-support, .875rem)');
  expect(styles).toContain('font-size: var(--nesmi-type-label, .8125rem)');
  expect(styles).toContain('font-size: var(--nesmi-type-section, 1.25rem)');
  expect(styles).not.toMatch(/\.(?:text-sm|text-xs|text-lg|transition-all)\b/);
  expect(styles).toContain("[type='time']::-webkit-datetime-edit");
  for (const component of ['AccountSettings', 'Dashboard', 'WorkloadChart', 'AgentPanel', 'ChatAssistant', 'MemberProfileModal', 'SkillTagInput']) {
    const source = readFileSync(`src/components/${component}.tsx`, 'utf8');
    expect(source).toContain("import '../styles/nesmi-secondary-surfaces.css'");
    expect(source).not.toMatch(/(?:from|to)-(?:purple|blue)-\d/);
  }
  expect(readFileSync('src/components/AgentPanel.tsx', 'utf8')).toContain('className="chore-button primary w-full"');
  expect(readFileSync('src/components/SectionHeading.css', 'utf8')).toContain('var(--nesmi-type-label');
});
it('preserves the Account theme, privacy, sign-out, and recoverable account-deletion actions', async () => {
  auth.deleteAccount.mockResolvedValue({ error: new Error('Synthetic rejection') });
  const user = userEvent.setup();
  render(<AccountSettings isOpen embedded onClose={vi.fn()} />);
  expect(screen.getByRole('heading', { name: 'Appearance' })).toHaveClass('nesmi-secondary-title');
  expect(screen.getByText('person@example.test')).toHaveClass('nesmi-secondary-support');
  expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'View Privacy Policy' })).toHaveAttribute('href', expect.stringContaining('privacy.html'));
  await user.click(screen.getByRole('button', { name: 'Sign Out' }));
  expect(auth.signOut).toHaveBeenCalledOnce();
  await user.click(screen.getByRole('button', { name: 'Delete my account' }));
  expect(auth.deleteAccount).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await user.click(screen.getByRole('button', { name: 'Delete my account' }));
  await user.click(screen.getByRole('button', { name: 'Delete permanently' }));
  expect(auth.deleteAccount).toHaveBeenCalledOnce();
  expect(screen.getByRole('alert')).toHaveTextContent('We could not delete your account. Please try again.');
  expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeEnabled();
});
it('preserves Insights counts, tabs, and the compact workload title/period contract', async () => {
  const today = dateKey();
  app.state.chores = [
    { id: 'done', title: 'Dishes', date: today, recurrence: 'none', assigneeId: 'alex', priority: 'medium' },
    { id: 'pending', title: 'Laundry', date: today, recurrence: 'none', assigneeId: 'alex', priority: 'medium' },
    { id: 'overdue', title: 'Plants', date: shiftDate(today, -1), recurrence: 'none', assigneeId: null, priority: 'medium' },
  ];
  app.state.teamMembers = [{ id: 'alex', name: 'Alex with a long full family name', color: '#556247', points: 9, badges: [] }];
  app.state.completions = [{ id: 'completion', choreId: 'done', instanceDate: today, completedBy: 'alex', completedAt: new Date().toISOString() }];
  const user = userEvent.setup();
  render(<Dashboard embedded onClose={vi.fn()} />);
  for (const label of ['Completed Today', 'Pending Today', 'Overdue', 'This Week']) expect(screen.getByText(label).previousElementSibling).toHaveTextContent('1');
  expect(screen.getByRole('heading', { name: 'Leaderboard' })).toHaveClass('nesmi-secondary-title');
  await user.click(screen.getByRole('button', { name: 'Activity' }));
  expect(screen.getByRole('heading', { name: 'Activity Feed (1 completions)' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Achievements' }));
  expect(screen.getByRole('heading', { name: /completion Badges/ })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Workload' }));
  const title = screen.getByRole('heading', { name: 'Team Workload This Week' });
  expect(title.closest('.nesmi-section-heading')).toHaveTextContent('This Week');
  expect(title).not.toHaveClass('nesmi-secondary-title');
  expect(screen.getByRole('button', { name: 'Workload' })).toHaveAttribute('aria-pressed', 'true');
});
it('preserves workload recurrence math, inclusive range, capacity thresholds, and empty state', () => {
  const members = [
    { id: 'alex', name: 'Alex', color: '#556247', weeklyCapacityMinutes: 60, points: 0, badges: [] },
    { id: 'jamie', name: 'Jamie', color: '#556247', weeklyCapacityMinutes: 120, points: 0, badges: [] },
  ];
  const chores: Chore[] = [
    { id: 'daily', title: 'Daily', date: '2026-10-10', recurrence: 'daily', assigneeId: 'alex', priority: 'medium', estimatedMinutes: 30 },
    { id: 'once', title: 'Once', date: '2026-10-12', recurrence: 'none', assigneeId: 'jamie', priority: 'medium', estimatedMinutes: 90 },
    { id: 'outside', title: 'Outside', date: '2026-10-13', recurrence: 'none', assigneeId: 'jamie', priority: 'medium', estimatedMinutes: 90 },
  ];
  const { rerender } = render(<WorkloadChart members={members} chores={chores} dateRange={{ start: '2026-10-10', end: '2026-10-12' }} />);
  expect(screen.getByText('150%')).toBeInTheDocument();
  expect(screen.getByText('75%')).toBeInTheDocument();
  expect(screen.getByText('(1h 30m / 1h)')).toBeInTheDocument();
  expect(screen.getByText('Over Capacity').previousElementSibling).toHaveTextContent('1');
  expect(screen.getByText('Near Capacity').previousElementSibling).toHaveTextContent('1');
  expect(screen.getByText('Under Capacity').previousElementSibling).toHaveTextContent('0');
  const chart = screen.getByText('Alex').closest('.fluent-surface')! as HTMLElement;
  expect(within(chart).getByText('(1 chores)')).toBeInTheDocument();
  rerender(<WorkloadChart members={[]} chores={[]} />);
  expect(screen.getByText('No team members yet. Add team members to see workload.')).toBeInTheDocument();
});
