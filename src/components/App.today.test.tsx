import { cleanup, render, screen } from '@testing-library/react';
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
vi.mock('./Header', () => ({Header: ({viewMode}: {viewMode: string}) => <div data-testid="active-view">{viewMode}</div>}));
vi.mock('./Calendar', () => ({Calendar: () => <div>Calendar view</div>}));

describe('App first chore and Today entry', () => {
  beforeEach(() => {app.state.chores = []; app.addChore.mockResolvedValue(undefined);});
  afterEach(cleanup);

  it.each([390, 1440])('opens Today at a viewport width of %i', width => {
    Object.defineProperty(window, 'innerWidth', {value: width, configurable: true});
    app.state.chores = [{id: 'task-1', title: 'Water plants', date: dateKey(), assigneeId: null, recurrence: 'none', priority: 'medium'}];
    render(<App/>);
    expect(screen.getByTestId('active-view')).toHaveTextContent('today');
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('Calendar view')).not.toBeInTheDocument();
  });

  it('opens a familiar chore as a draft and waits for an explicit save', async () => {
    const user = userEvent.setup();
    render(<App/>);
    await user.click(screen.getByRole('button', {name: 'Start with Wash dishes'}));

    expect(screen.getByRole('dialog', {name: 'Add a chore'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'What needs doing?'})).toHaveValue('Wash dishes');
    expect(screen.getByRole('combobox', {name: 'Repeat'})).toHaveValue('daily');
    expect(screen.getByRole('spinbutton', {name: 'Estimated minutes · optional'})).toHaveValue(15);
    expect(app.addChore).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(app.addChore).not.toHaveBeenCalled();
  });
});
