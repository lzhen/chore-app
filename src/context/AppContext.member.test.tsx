/**
 * B123 member persistence: offline AppProvider state/rejection boundary.
 * Synthetic identity and mocked storage only; no live account or Supabase calls.
 */
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chore, ChoreCompletion, TeamMember, MemberAvailability, Category } from '../types';
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
  updateChore as persistChore,
  updateAvailability as persistAvailability,
  updateCategory as persistCategory,
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
  updateChore: vi.fn(),
  updateAvailability: vi.fn(),
  updateCategory: vi.fn(),
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

function ChoreUpdateProbe() {
  const { state, updateChore } = useApp();
  const [feedback, setFeedback] = useState('idle');
  return (
    <>
      <pre data-testid="chore-update-state">{JSON.stringify(state.chores[0] ?? null)}</pre>
      <button type="button" onClick={() => {
        void updateChore({ ...syntheticChore, title: 'Unsaved browser title' })
          .then(() => setFeedback('saved'))
          .catch((error: unknown) => setFeedback(error instanceof Error ? error.message : 'save rejected'));
      }}>Save synthetic chore edit</button>
      <output aria-label="chore edit result">{feedback}</output>
    </>
  );
}

describe('AppContext chore updates display only persisted server state', () => {
  async function mountChore() {
    vi.mocked(fetchChores).mockResolvedValue([syntheticChore]);
    render(<AppProvider><ChoreUpdateProbe /></AppProvider>);
    await waitFor(() =>
      expect(screen.getByTestId('chore-update-state').textContent).toContain(syntheticChore.title),
    );
  }

  it('renders the canonical database-returned fields, not the user-submitted title', async () => {
    vi.mocked(persistChore).mockResolvedValue({
      ...syntheticChore,
      title: 'Persisted database title',
      estimatedMinutes: 20,
    });
    await mountChore();
    fireEvent.click(screen.getByRole('button', { name: /save synthetic chore edit/i }));
    await waitFor(() => expect(screen.getByLabelText('chore edit result')).toHaveTextContent('saved'));
    expect(persistChore).toHaveBeenCalledExactlyOnceWith({
      ...syntheticChore,
      title: 'Unsaved browser title',
    });
    expect(screen.getByTestId('chore-update-state')).toHaveTextContent('Persisted database title');
    expect(screen.getByTestId('chore-update-state')).toHaveTextContent('"estimatedMinutes":20');
    expect(screen.getByTestId('chore-update-state')).not.toHaveTextContent('Unsaved browser title');
  });

  it('keeps the last confirmed chore when the database update is rejected', async () => {
    vi.mocked(persistChore).mockRejectedValue(new Error('Synthetic update denied'));
    await mountChore();
    fireEvent.click(screen.getByRole('button', { name: /save synthetic chore edit/i }));
    await waitFor(() => expect(screen.getByLabelText('chore edit result')).toHaveTextContent('Synthetic update denied'));
    expect(screen.getByTestId('chore-update-state')).toHaveTextContent(syntheticChore.title);
    expect(screen.getByTestId('chore-update-state')).not.toHaveTextContent('Unsaved browser title');
  });
});
 
const storedAvailability: MemberAvailability = {
  id: 'synthetic-availability',
  memberId: original.id,
  startDate: '2026-11-02',
  endDate: '2026-11-04',
  reason: 'Previously saved',
};

function AvailabilityProbe() {
  const { state, updateAvailability } = useApp();
  const [feedback, setFeedback] = useState('idle');
  return (
    <>
      <pre data-testid="availability-state">{JSON.stringify(state.availability[0] ?? null)}</pre>
      <button type="button" onClick={() => {
        void updateAvailability({ ...storedAvailability, reason: 'Unverified form input' })
          .then(() => setFeedback('saved'))
          .catch((error: unknown) => setFeedback(error instanceof Error ? error.message : 'rejected'));
      }}>Save synthetic absence</button>
      <output aria-label="availability result">{feedback}</output>
    </>
  );
}

describe('AppContext availability updates use server truth', () => {
  async function mountAvailability() {
    vi.mocked(fetchAvailability).mockResolvedValue([storedAvailability]);
    render(<AppProvider><AvailabilityProbe /></AppProvider>);
    await waitFor(() => expect(screen.getByTestId('availability-state')).toHaveTextContent('Previously saved'));
  }

  it('renders database-returned dates/reason, not the submitted form', async () => {
    vi.mocked(persistAvailability).mockResolvedValue({
      ...storedAvailability, startDate: '2026-11-03', reason: 'Persisted reason',
    });
    await mountAvailability();
    fireEvent.click(screen.getByRole('button', { name: /save synthetic absence/i }));
    await waitFor(() => expect(screen.getByLabelText('availability result')).toHaveTextContent('saved'));
    expect(persistAvailability).toHaveBeenCalledExactlyOnceWith({
      ...storedAvailability, reason: 'Unverified form input',
    });
    expect(screen.getByTestId('availability-state')).toHaveTextContent('Persisted reason');
    expect(screen.getByTestId('availability-state')).toHaveTextContent('2026-11-03');
    expect(screen.getByTestId('availability-state')).not.toHaveTextContent('Unverified form input');
  });

  it('keeps the prior saved interval when storage rejects the update', async () => {
    vi.mocked(persistAvailability).mockRejectedValue(new Error('Synthetic write denied'));
    await mountAvailability();
    fireEvent.click(screen.getByRole('button', { name: /save synthetic absence/i }));
    await waitFor(() => expect(screen.getByLabelText('availability result')).toHaveTextContent('Synthetic write denied'));
    expect(screen.getByTestId('availability-state')).toHaveTextContent('Previously saved');
    expect(screen.getByTestId('availability-state')).not.toHaveTextContent('Unverified form input');
  });
});

const storedCategory: Category = {
  id: 'synthetic-category', name: 'Previously saved category', color: '#445566', icon: 'home',
};

function CategoryEditProbe() {
  const { state, updateCategory } = useApp();
  const [feedback, setFeedback] = useState('idle');
  return (
    <>
      <pre data-testid="category-state">{JSON.stringify(state.categories[0] ?? null)}</pre>
      <button type="button" onClick={() => {
        void updateCategory({ ...storedCategory, name: 'Unverified client title' })
          .then(() => setFeedback('saved'))
          .catch((error: unknown) =>
            setFeedback(error instanceof Error ? error.message : 'save rejected'));
      }}>Save synthetic category edit</button>
      <output aria-label="category edit result">{feedback}</output>
    </>
  );
}

describe('AppContext category edit uses server-confirmed values', () => {
  async function mountCategory() {
    vi.mocked(fetchCategories).mockResolvedValue([storedCategory]);
    render(<AppProvider><CategoryEditProbe /></AppProvider>);
    await waitFor(() =>
      expect(screen.getByTestId('category-state')).toHaveTextContent('Previously saved category'),
    );
  }

  it('shows only normalized persisted name/color/icon, not unconfirmed client input', async () => {
    vi.mocked(persistCategory).mockResolvedValue({
      ...storedCategory, name: 'Database category', color: '#334455', icon: 'check',
    });
    await mountCategory();
    fireEvent.click(screen.getByRole('button', { name: /save synthetic category edit/i }));
    await waitFor(() =>
      expect(screen.getByLabelText('category edit result')).toHaveTextContent('saved'),
    );
    expect(persistCategory).toHaveBeenCalledExactlyOnceWith({
      ...storedCategory, name: 'Unverified client title',
    });
    expect(screen.getByTestId('category-state')).toHaveTextContent('Database category');
    expect(screen.getByTestId('category-state')).toHaveTextContent('#334455');
    expect(screen.getByTestId('category-state')).toHaveTextContent('"icon":"check"');
    expect(screen.getByTestId('category-state')).not.toHaveTextContent('Unverified client title');
  });

  it('retains last persisted category when PostgREST rejects an update', async () => {
    vi.mocked(persistCategory).mockRejectedValue(new Error('Synthetic update denied'));
    await mountCategory();
    fireEvent.click(screen.getByRole('button', { name: /save synthetic category edit/i }));
    await waitFor(() =>
      expect(screen.getByLabelText('category edit result')).toHaveTextContent('Synthetic update denied'),
    );
    expect(screen.getByTestId('category-state')).toHaveTextContent('Previously saved category');
    expect(screen.getByTestId('category-state')).not.toHaveTextContent('Unverified client title');
  });
});
