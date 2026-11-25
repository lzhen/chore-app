import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { dateKey } from '../utils/dates';
import type { Chore } from '../types';

const app = vi.hoisted(() => ({
  state: {chores: [] as Chore[], teamMembers: [], categories: [], completions: [], loading: false, error: null},
  reload: vi.fn(), addChore: vi.fn(), updateChore: vi.fn(), deleteChore: vi.fn(),
}));
vi.mock('../context/AppContext', () => ({useApp: () => app}));
vi.mock('../context/AuthContext', () => ({useAuth: () => ({user: {id: 'test-user'}, loading: false})}));
vi.mock('./Header', () => ({
  Header: ({ viewMode, onMenuClick }: { viewMode: string; onMenuClick: () => void }) => (
    <>
      <div data-testid="active-view">{viewMode}</div>
      <button onClick={onMenuClick}>Open family menu</button>
    </>
  ),
}));

describe('App first chore and Today entry', () => {
  beforeEach(() => {app.state.chores = []; app.addChore.mockResolvedValue(undefined);});
  afterEach(cleanup);

  it.each([390, 1440])('opens Today at a viewport width of %i', width => {
    Object.defineProperty(window, 'innerWidth', {value: width, configurable: true});
    app.state.chores = [{id: 'task-1', title: 'Water plants', date: dateKey(), assigneeId: null, recurrence: 'none', priority: 'medium'}];
    const { container } = render(<App/>);
    expect(screen.getByTestId('active-view')).toHaveTextContent('today');
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(container.querySelector('.calendar-container')).not.toBeInTheDocument();
  });

  it('opens Calendar on the date selected in the Family menu from Today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 25, 12));
    try {
      const user = userEvent.setup();
      app.state.chores = [{
        id: 'later-chore', title: 'Change the air filter', date: '2026-10-12',
        assigneeId: null, recurrence: 'none', priority: 'medium',
      }];
      const { container } = render(<App/>);
      expect(screen.getByTestId('active-view')).toHaveTextContent('today');
      await user.click(screen.getByRole('button', { name: 'Open family menu' }));
      const family = within(screen.getByRole('complementary', { name: 'Family' }));
      await user.click(family.getByRole('button', { name: 'Next month' }));
      await user.click(family.getByRole('button', { name: /^12$/ }));

      expect(screen.getByTestId('active-view')).toHaveTextContent('calendar');
      expect(screen.queryByRole('complementary', { name: 'Family' })).not.toBeInTheDocument();
      expect(container.querySelector('.fc-toolbar-title')).toHaveTextContent('Oct 2026');
      const selectedDay = container.querySelector('.fc [data-date="2026-10-12"]');
      expect(selectedDay).toHaveTextContent('Change the air filter');
      await user.click(screen.getByRole('button', { name: /^Day$/ }));
      expect(screen.getByText('Change the air filter')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens a familiar chore as a draft and waits for an explicit save', async () => {
    const user = userEvent.setup();
    render(<App/>);
    await user.click(screen.getByRole('button', {name: 'Start with Wash dishes'}));

    expect(screen.getByRole('dialog', {name: 'Add a chore'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'What needs doing?'})).toHaveValue('Wash dishes');
    expect(screen.getByRole('combobox', {name: 'Repeat'})).toHaveTextContent('Every day');
    expect(screen.getByRole('spinbutton', {name: 'Estimated minutes · optional'})).toHaveValue(15);
    expect(app.addChore).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(app.addChore).not.toHaveBeenCalled();
  });
});
