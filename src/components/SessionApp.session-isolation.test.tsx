/**
 * Nesmi B123 auth-boundary regression (offline only).
 *
 * Synthetic accounts and storage promises ensure one signed-in household
 * never appears in the next account, including while a fetch is pending.
 * This is not real Supabase or physical-device verification.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chore } from '../types';
import { SessionApp } from './SessionApp';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import {
  fetchChores,
  fetchTeamMembers,
  fetchCategories,
  fetchCompletions,
  fetchAvailability,
} from '../utils/supabaseStorage';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../utils/supabaseStorage', () => ({
  fetchChores: vi.fn(),
  fetchTeamMembers: vi.fn(),
  fetchCategories: vi.fn(),
  fetchCompletions: vi.fn(),
  fetchAvailability: vi.fn(),
}));

// Probe exactly the AppProvider state consumed by the real App, without
// rendering unrelated UI. The real SessionApp and AppProvider are exercised.
vi.mock('./App', () => ({
  App: () => {
    const { state } = useApp();
    return (
      <>
        <output data-testid="household-chores">
          {JSON.stringify(state.chores.map((chore: Chore) => chore.id))}
        </output>
        <output data-testid="household-loading">{String(state.loading)}</output>
        <output data-testid="household-private-ids">{JSON.stringify({
          chores: state.chores.map(row => row.id),
          members: state.teamMembers.map(row => row.id),
          categories: state.categories.map(row => row.id),
          completions: state.completions.map(row => row.id),
          availability: state.availability.map(row => row.id),
        })}</output>
      </>
    );
  },
}));

const choreA: Chore = {
  id: 'only-account-a', title: 'Synthetic A-only task',
  date: '2026-10-28', assigneeId: null, recurrence: 'none', priority: 'medium',
};
const choreB: Chore = {
  id: 'only-account-b', title: 'Synthetic B-only task',
  date: '2026-10-28', assigneeId: null, recurrence: 'none', priority: 'medium',
};

let activeUserId: string | null = 'account-a';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  activeUserId = 'account-a';
  vi.mocked(useAuth).mockImplementation(() => ({
    user: activeUserId ? { id: activeUserId } : null,
    loading: false,
  } as ReturnType<typeof useAuth>));
  vi.mocked(fetchChores).mockResolvedValue([]);
  vi.mocked(fetchTeamMembers).mockResolvedValue([]);
  vi.mocked(fetchCategories).mockResolvedValue([]);
  vi.mocked(fetchCompletions).mockResolvedValue([]);
  vi.mocked(fetchAvailability).mockResolvedValue([]);
});

describe('Nesmi session household isolation', () => {
  it('clears the former household immediately on account switch and sign-out', async () => {
    vi.mocked(fetchChores).mockResolvedValueOnce([choreA]);
    const view = render(<SessionApp />);
    await waitFor(() => expect(screen.getByTestId('household-chores')).toHaveTextContent('only-account-a'));

    const pendingB = deferred<Chore[]>();
    vi.mocked(fetchChores).mockReturnValueOnce(pendingB.promise);
    activeUserId = 'account-b';
    view.rerender(<SessionApp />);

    // The new user must never see old account A's cached state while loading.
    expect(screen.getByTestId('household-chores')).toHaveTextContent('[]');
    expect(screen.getByTestId('household-chores')).not.toHaveTextContent('only-account-a');
    expect(screen.getByTestId('household-loading')).toHaveTextContent('true');

    await act(async () => { pendingB.resolve([choreB]); await pendingB.promise; });
    await waitFor(() => expect(screen.getByTestId('household-chores')).toHaveTextContent('only-account-b'));

    activeUserId = null;
    view.rerender(<SessionApp />);
    expect(screen.getByTestId('household-chores')).toHaveTextContent('[]');
    expect(screen.getByTestId('household-chores')).not.toHaveTextContent('only-account-b');
  });

  it('ignores old account A response that arrives after account B has loaded', async () => {
    const pendingA = deferred<Chore[]>();
    vi.mocked(fetchChores).mockReturnValueOnce(pendingA.promise).mockResolvedValueOnce([choreB]);
    const view = render(<SessionApp />);
    expect(screen.getByTestId('household-loading')).toHaveTextContent('true');

    activeUserId = 'account-b';
    view.rerender(<SessionApp />);
    await waitFor(() => expect(screen.getByTestId('household-chores')).toHaveTextContent('only-account-b'));

    // Late result from the unmounted A provider cannot overwrite B.
    await act(async () => { pendingA.resolve([choreA]); await pendingA.promise; });
    expect(screen.getByTestId('household-chores')).toHaveTextContent('only-account-b');
    expect(screen.getByTestId('household-chores')).not.toHaveTextContent('only-account-a');
  });
  it('clears all five private household collections before loading the next account', async () => {
    const memberA = { id: 'member-a', name: 'Synthetic A', color: '#ff0000', points: 0, badges: [] };
    const memberB = { id: 'member-b', name: 'Synthetic B', color: '#00ff00', points: 0, badges: [] };
    const categoryA = { id: 'category-a', name: 'A only', color: '#ff0000' };
    const categoryB = { id: 'category-b', name: 'B only', color: '#00ff00' };
    const completionA = {
      id: 'completion-a', choreId: choreA.id, instanceDate: '2026-10-28',
      completedBy: memberA.id, completedAt: '2026-10-28T00:00:00.000Z',
    };
    const completionB = {
      id: 'completion-b', choreId: choreB.id, instanceDate: '2026-10-28',
      completedBy: memberB.id, completedAt: '2026-10-28T00:00:00.000Z',
    };
    const availabilityA = {
      id: 'availability-a', memberId: memberA.id, startDate: '2026-10-28', endDate: '2026-10-29',
    };
    const availabilityB = {
      id: 'availability-b', memberId: memberB.id, startDate: '2026-10-28', endDate: '2026-10-29',
    };

    vi.mocked(fetchChores).mockResolvedValueOnce([choreA]).mockResolvedValueOnce([choreB]);
    vi.mocked(fetchTeamMembers).mockResolvedValueOnce([memberA]).mockResolvedValueOnce([memberB]);
    vi.mocked(fetchCategories).mockResolvedValueOnce([categoryA]).mockResolvedValueOnce([categoryB]);
    vi.mocked(fetchCompletions).mockResolvedValueOnce([completionA]).mockResolvedValueOnce([completionB]);
    const pendingB = deferred<typeof availabilityB[]>();
    vi.mocked(fetchAvailability).mockResolvedValueOnce([availabilityA]).mockReturnValueOnce(pendingB.promise);

    const view = render(<SessionApp />);
    const household = () => screen.getByTestId('household-private-ids');
    await waitFor(() => expect(household()).toHaveTextContent('availability-a'));
    for (const id of ['only-account-a', 'member-a', 'category-a', 'completion-a', 'availability-a']) {
      expect(household()).toHaveTextContent(id);
    }

    activeUserId = 'account-b';
    view.rerender(<SessionApp />);
    // The next session cannot see ANY prior-account collection, even while its
    // final Supabase fetch is still pending.
    expect(household()).toHaveTextContent(
      '{"chores":[],"members":[],"categories":[],"completions":[],"availability":[]}',
    );
    expect(screen.getByTestId('household-loading')).toHaveTextContent('true');

    await act(async () => {
      pendingB.resolve([availabilityB]);
      await pendingB.promise;
    });
    await waitFor(() => expect(household()).toHaveTextContent('availability-b'));
    for (const id of ['only-account-b', 'member-b', 'category-b', 'completion-b', 'availability-b']) {
      expect(household()).toHaveTextContent(id);
    }
    for (const id of ['only-account-a', 'member-a', 'category-a', 'completion-a', 'availability-a']) {
      expect(household()).not.toHaveTextContent(id);
    }

    activeUserId = null;
    view.rerender(<SessionApp />);
    expect(household()).toHaveTextContent(
      '{"chores":[],"members":[],"categories":[],"completions":[],"availability":[]}',
    );
  });

});
