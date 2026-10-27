/**
 * B123 member persistence: offline AppProvider state/rejection boundary.
 * Synthetic identity and mocked storage only; no live account or Supabase calls.
 */
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chore, ChoreCompletion, TeamMember } from '../types';
import { AppProvider, useApp } from './AppContext';
import { useAuth } from './AuthContext';
import {
  fetchChores,
  fetchTeamMembers,
  fetchCategories,
  fetchCompletions,
  fetchAvailability,
  updateTeamMember,
  createCompletion,
} from '../utils/supabaseStorage';

vi.mock('./AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../utils/supabaseStorage', () => ({
  fetchChores: vi.fn(),
  fetchTeamMembers: vi.fn(),
  fetchCategories: vi.fn(),
  fetchCompletions: vi.fn(),
  fetchAvailability: vi.fn(),
  updateTeamMember: vi.fn(),
  createCompletion: vi.fn(),
}));

const original: TeamMember = {
  id: 'synthetic-member',
  name: 'Original in DB',
  color: '#6699ee',
  points: 0,
  badges: [],
};

const requested: TeamMember = {
  ...original,
  name: 'Unsaved browser edit',
  points: 7,
};

const syntheticChore: Chore = {
  id: 'synthetic-chore',
  title: 'Synthetic household task',
  date: '2026-10-26',
  assigneeId: original.id,
  recurrence: 'none',
  priority: 'medium',
};

const syntheticCompletion: ChoreCompletion = {
  id: 'synthetic-completion',
  choreId: syntheticChore.id,
  instanceDate: '2026-10-26',
  completedBy: original.id,
  completedAt: '2026-10-26T12:00:00.000Z',
};

function MemberStateProbe() {
  const { state, updateMember } = useApp();
  const [feedback, setFeedback] = useState('idle');
  return (
    <>
      <pre data-testid="member-state">{JSON.stringify(state.teamMembers[0] ?? null)}</pre>
      <button
        type="button"
        onClick={() => {
          void updateMember(requested)
            .then(() => setFeedback('saved'))
            .catch((error: unknown) => {
              setFeedback(error instanceof Error ? error.message : 'save rejected');
            });
        }}
      >
        Save synthetic member
      </button>
      <output aria-label="save result">{feedback}</output>
    </>
  );
}

function CompletionStateProbe() {
  const { state, completeChore } = useApp();
  const [feedback, setFeedback] = useState('idle');
  return (
    <>
      <pre data-testid="member-state">{JSON.stringify(state.teamMembers[0] ?? null)}</pre>
      <pre data-testid="completion-state">{JSON.stringify(state.completions)}</pre>
      <button
        type="button"
        onClick={() => {
          void completeChore(syntheticChore.id, syntheticCompletion.instanceDate, original.id)
            .then(() => setFeedback('completed'))
            .catch((error: unknown) => {
              setFeedback(error instanceof Error ? error.message : 'completion rejected');
            });
        }}
      >
        Complete synthetic chore
      </button>
      <output aria-label="completion result">{feedback}</output>
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'synthetic-auth-user' },
    loading: false,
  } as ReturnType<typeof useAuth>);
  vi.mocked(fetchChores).mockResolvedValue([]);
  vi.mocked(fetchTeamMembers).mockResolvedValue([original]);
  vi.mocked(fetchCategories).mockResolvedValue([]);
  vi.mocked(fetchCompletions).mockResolvedValue([]);
  vi.mocked(fetchAvailability).mockResolvedValue([]);
});

async function mountLoadedProvider() {
  render(<AppProvider><MemberStateProbe /></AppProvider>);
  await waitFor(() =>
    expect(screen.getByTestId('member-state').textContent).toContain('Original in DB'),
  );
}

describe('AppContext member update dispatch boundary', () => {
  it('dispatches the authoritative returned DB member, never the submitted optimistic object', async () => {
    const persisted: TeamMember = {
      ...original,
      name: 'Canonical database value',
      points: 3,
      weeklyCapacityMinutes: 0,
    };
    vi.mocked(updateTeamMember).mockResolvedValue(persisted);
    await mountLoadedProvider();

    fireEvent.click(screen.getByRole('button', { name: /save synthetic member/i }));
    await waitFor(() => expect(screen.getByLabelText('save result')).toHaveTextContent('saved'));

    expect(updateTeamMember).toHaveBeenCalledExactlyOnceWith(requested);
    expect(screen.getByTestId('member-state').textContent).toContain('Canonical database value');
    expect(screen.getByTestId('member-state').textContent).toContain('"points":3');
    expect(screen.getByTestId('member-state').textContent).toContain('"weeklyCapacityMinutes":0');
    expect(screen.getByTestId('member-state').textContent).not.toContain('Unsaved browser edit');
  });

  it('propagates a database rejection without changing the last persisted member state', async () => {
    vi.mocked(updateTeamMember).mockRejectedValue(new Error('Synthetic DB write rejected'));
    await mountLoadedProvider();

    fireEvent.click(screen.getByRole('button', { name: /save synthetic member/i }));
    await waitFor(() =>
      expect(screen.getByLabelText('save result')).toHaveTextContent('Synthetic DB write rejected'),
    );

    expect(updateTeamMember).toHaveBeenCalledExactlyOnceWith(requested);
    expect(screen.getByTestId('member-state').textContent).toContain('Original in DB');
    expect(screen.getByTestId('member-state').textContent).toContain('"points":0');
    expect(screen.getByTestId('member-state').textContent).not.toContain('Unsaved browser edit');
  });
});

async function mountCompletionProvider() {
  vi.mocked(fetchChores).mockResolvedValue([syntheticChore]);
  vi.mocked(createCompletion).mockResolvedValue(syntheticCompletion);
  render(<AppProvider><CompletionStateProbe /></AppProvider>);
  await waitFor(() =>
    expect(screen.getByTestId('member-state').textContent).toContain('Original in DB'),
  );
}

describe('chore completion keeps points/badges persistence best-effort', () => {
  it('keeps the DB-confirmed completion when the separate member points write rejects', async () => {
    vi.mocked(updateTeamMember).mockRejectedValue(new Error('Synthetic points update rejected'));
    await mountCompletionProvider();

    fireEvent.click(screen.getByRole('button', { name: /complete synthetic chore/i }));
    await waitFor(() => expect(screen.getByLabelText('completion result')).toHaveTextContent('completed'));

    expect(createCompletion).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      choreId: syntheticChore.id,
      instanceDate: syntheticCompletion.instanceDate,
      completedBy: original.id,
    }));
    expect(updateTeamMember).toHaveBeenCalledTimes(1);
    expect(vi.mocked(updateTeamMember).mock.calls[0][0].points).toBeGreaterThan(0);
    expect(screen.getByTestId('completion-state').textContent).toContain(syntheticCompletion.id);
    expect(screen.getByTestId('member-state').textContent).toContain('"points":0');
    expect(screen.getByTestId('member-state').textContent).toContain('"badges":[]');
  });

  it('shows only the persisted member response after a successful completion reward update', async () => {
    vi.mocked(updateTeamMember).mockResolvedValue({
      ...original,
      name: 'Canonical reward response',
      points: 3,
      badges: ['server-confirmed-badge'],
    });
    await mountCompletionProvider();

    fireEvent.click(screen.getByRole('button', { name: /complete synthetic chore/i }));
    await waitFor(() => expect(screen.getByLabelText('completion result')).toHaveTextContent('completed'));

    expect(createCompletion).toHaveBeenCalledTimes(1);
    expect(updateTeamMember).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('completion-state').textContent).toContain(syntheticCompletion.id);
    expect(screen.getByTestId('member-state').textContent).toContain('Canonical reward response');
    expect(screen.getByTestId('member-state').textContent).toContain('"points":3');
    expect(screen.getByTestId('member-state').textContent).toContain('server-confirmed-badge');
  });
});
