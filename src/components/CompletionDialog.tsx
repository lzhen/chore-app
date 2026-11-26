import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useApp } from '../context/AppContext';
import type { ChoreInstance } from '../types';
import { formatDay } from '../utils/dates';
import { ChoicePicker } from './ChoicePicker';
import { Dialog } from './Dialog';

export function CompletionDialog({ instance, onClose }: { instance: ChoreInstance; onClose: () => void }) {
  const { state, addFirstMember, completeChore, uncompleteChore } = useApp();
  const [member, setMember] = useState(() =>
    state.teamMembers.find(option => option.id === instance.assigneeId)?.id ?? '',
  );
  const [name, setName] = useState('');
  const [pending, setPending] = useState<'member' | 'completion' | null>(null);
  const [error, setError] = useState('');
  const triedAddingMember = useRef(false);
  const memberSaveInFlight = useRef(false);
  const memberPickerId = useId();
  const memberNameId = useId();
  const errorId = useId();
  const hasMembers = state.teamMembers.length > 0;
  const selectedMember = state.teamMembers.some(option => option.id === member) ? member : '';
  const busy = pending !== null;

  useEffect(() => {
    if (busy || !triedAddingMember.current) return;
    if (hasMembers) {
      document.getElementById(memberPickerId)?.focus();
      triedAddingMember.current = false;
    } else if (error) {
      document.getElementById(memberNameId)?.focus();
    }
  }, [busy, error, hasMembers, memberNameId, memberPickerId]);

  async function createMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (busy || memberSaveInFlight.current || hasMembers || !trimmedName) return;
    memberSaveInFlight.current = true;
    triedAddingMember.current = true;
    setPending('member');
    setError('');
    try {
      await addFirstMember(trimmedName);
      setName('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save family member. Please try again.');
    } finally {
      memberSaveInFlight.current = false;
      setPending(null);
    }
  }

  async function submit() {
    if (busy) return;
    if (!instance.isCompleted && !selectedMember) {
      setError('Choose who completed this chore.');
      return;
    }
    setPending('completion');
    setError('');
    try {
      if (instance.isCompleted) {
        const completion = state.completions.find(c => c.choreId === instance.choreId && c.instanceDate === instance.date);
        if (!completion) throw new Error('This completion is no longer available. Refresh and try again.');
        await uncompleteChore(completion.id);
      } else {
        await completeChore(instance.choreId, instance.date, selectedMember);
      }
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save. Please try again.');
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog
      title={instance.isCompleted ? 'Undo completion' : 'Complete chore'}
      onClose={onClose}
      busy={busy}
      footer={<>
        <button type="button" className="chore-button secondary" onClick={onClose} disabled={busy}>Cancel</button>
        <button
          type="button"
          className="chore-button primary"
          onClick={submit}
          disabled={busy || (!instance.isCompleted && !selectedMember)}
        >
          {pending === 'completion' ? 'Saving…' : instance.isCompleted ? 'Mark not done' : 'Mark done'}
        </button>
      </>}
    >
      <h3 className="completion-title">{instance.title}</h3>
      <p className="chore-muted">{formatDay(instance.date)}</p>
      {instance.isCompleted ? (
        <p>This occurrence will return to your to-do list.</p>
      ) : hasMembers ? (
        <>
          <label className="chore-label" htmlFor={memberPickerId}>Who completed it?</label>
          <ChoicePicker
            id={memberPickerId}
            className="chore-input nesmi-member-picker"
            label="Who completed it?"
            value={selectedMember}
            onChange={setMember}
            placeholder="Choose a family member"
            options={state.teamMembers.map(option => ({ id: option.id, label: option.name }))}
            disabled={busy}
          />
        </>
      ) : (
        <form onSubmit={createMember} className="mt-4">
          <p className="chore-muted">Add your first family member, then choose who completed this chore.</p>
          <label className="chore-label" htmlFor={memberNameId}>
            Family member name
            <input
              id={memberNameId}
              className="chore-input"
              aria-describedby={error ? errorId : undefined}
              value={name}
              onChange={event => setName(event.target.value)}
              disabled={busy}
              required
            />
          </label>
          <button type="submit" className="chore-button secondary" disabled={busy || !name.trim()}>
            {pending === 'member' ? 'Adding…' : 'Add member'}
          </button>
        </form>
      )}
      {error && <p id={errorId} className="chore-error" role="alert">{error}</p>}
    </Dialog>
  );
}
