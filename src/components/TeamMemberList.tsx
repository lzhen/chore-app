import { useEffect, useId, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { TeamMember } from '../types';
import { memberAvatarStyle } from '../utils/colors';
import { ChoicePicker } from './ChoicePicker';
import { Dialog } from './Dialog';
import './TeamMemberList.css';
import { useInteractionMode } from '../hooks/useInteractionMode';
interface TeamMemberListProps {
  hiddenMembers?: Set<string>;
  onToggleMemberVisibility?: (memberId: string) => void;
  onProfileOpen?: (member: TeamMember) => void;
  onAvailabilityOpen?: (member: TeamMember) => void;
}
export function TeamMemberList({ hiddenMembers = new Set(), onToggleMemberVisibility, onProfileOpen, onAvailabilityOpen }: TeamMemberListProps) {
  const { state, addMember, removeMember } = useApp();
  const interactionMode = useInteractionMode();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [removingMember, setRemovingMember] = useState<TeamMember | null>(null);
  const [removeError, setRemoveError] = useState('');
  const [removing, setRemoving] = useState(false);
  const removalPending = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const descriptionId = useId();
  const focusReturnFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(focusReturnFrame.current), []);
  function dismissRemoval() {
    if (removalPending.current) return;
    setRemovingMember(null);
    setRemoveError('');
    cancelAnimationFrame(focusReturnFrame.current);
    focusReturnFrame.current = requestAnimationFrame(() => {
      if (content.current?.closest('[aria-hidden="true"]')) return;
      const target = returnFocus.current?.isConnected ? returnFocus.current : content.current?.querySelector<HTMLElement>('.nesmi-member-actions, .nesmi-family-title');
      target?.focus({ preventScroll: true });
    });
  }
  async function confirmRemoval() {
    if (!removingMember || removalPending.current) return;
    removalPending.current = true;
    setRemoving(true);
    setRemoveError('');
    try {
      await removeMember(removingMember.id);
      removalPending.current = false;
      dismissRemoval();
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : 'Could not remove member. Please try again.');
    } finally {
      removalPending.current = false;
      setRemoving(false);
    }
  }
  async function handleAdd(event: React.FormEvent) {
    event.preventDefault(); if (!newName.trim() || busy) return;
    setBusy(true); setError('');
    try { await addMember(newName.trim()); setNewName(''); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not add member.'); }
    finally { setBusy(false); }
  }
  function act(action: string, member: TeamMember) {
    if (action === 'profile') onProfileOpen?.(member);
    else if (action === 'availability') onAvailabilityOpen?.(member);
    else if (action === 'remove') {
      if (removalPending.current) return;
      cancelAnimationFrame(focusReturnFrame.current);
      returnFocus.current = document.activeElement as HTMLElement | null;
      setRemoveError('');
      setRemovingMember(member);
    }
  }
  return <><div className="nesmi-family-content" data-interaction-mode={interactionMode} ref={content}>
    <h3 className="nesmi-family-title" tabIndex={-1}>Family members</h3>
    <p className="chore-muted nesmi-family-hint">Choose whose chores to show.</p>
    {error && <p className="chore-error" role="alert">{error}</p>}
    {!state.teamMembers.length ? <p className="chore-muted">Add someone to get started.</p> :
      <ul className="nesmi-family-list">{state.teamMembers.map(member => {
        const visible = !hiddenMembers.has(member.id);
        return <li key={member.id} className={`nesmi-family-row${onToggleMemberVisibility ? ' has-visibility' : ''}`}>
          {onToggleMemberVisibility && <button type="button" className="nesmi-member-visibility" role="checkbox" aria-checked={visible} aria-label={`Show ${member.name}’s chores`} onClick={() => onToggleMemberVisibility(member.id)}>
            <span aria-hidden="true" className="nesmi-member-check">{visible && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4 10-10"/></svg>}</span>
          </button>}
          <button type="button" className="nesmi-member-profile" aria-label={`Open ${member.name}’s profile`} onClick={() => onProfileOpen?.(member)}>
            {member.avatarUrl ? <img className="nesmi-member-avatar" src={member.avatarUrl} alt=""/> : <span aria-hidden="true" className="nesmi-member-avatar" style={memberAvatarStyle(member.color)}>{member.name.charAt(0).toUpperCase()}</span>}
            <span className="nesmi-member-name">{member.name}</span>
          </button>
          {interactionMode === 'web' ? <div className="nesmi-member-inline-actions" role="group" aria-label={`Actions for ${member.name}`}>
            <button type="button" className="nesmi-member-inline-action" aria-label={`Manage ${member.name}’s availability`} onClick={() => act('availability', member)}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 11h16m-9 4h5"/></svg>
              <span className="nesmi-member-action-tooltip" aria-hidden="true">Availability</span>
            </button>
            <button type="button" className="nesmi-member-inline-action is-remove" aria-label={`Remove ${member.name} from family`} onClick={() => act('remove', member)}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5m4-5v5"/></svg>
              <span className="nesmi-member-action-tooltip" aria-hidden="true">Remove member</span>
            </button>
          </div> : <ChoicePicker label={`Actions for ${member.name}`} value="" className="nesmi-member-actions" align="end" onChange={action => act(action, member)} options={[{id:'profile',label:'Profile'},{id:'availability',label:'Availability'},{id:'remove',label:'Remove member'}]}><span aria-hidden="true">⋯</span></ChoicePicker>}
        </li>;
      })}</ul>}
    <form className="nesmi-family-add" onSubmit={handleAdd}>
      <label className="chore-label" htmlFor="new-family-name">Add a person</label>
      <div><input id="new-family-name" type="text" value={newName} onChange={event=>setNewName(event.target.value)} placeholder="Name" className="chore-input"/><button type="submit" className="chore-button secondary" disabled={busy || !newName.trim()}>{busy?'Adding…':'Add'}</button></div>
    </form>
  </div>
    {removingMember && <Dialog
      title={`Remove ${removingMember.name}?`}
      onClose={dismissRemoval}
      variant="centered"
      role="alertdialog"
      descriptionId={descriptionId}
      initialFocusRef={cancelButton}
      busy={removing}
      footer={<>
        <button ref={cancelButton} type="button" className="chore-button secondary" onClick={dismissRemoval} disabled={removing}>Cancel</button>
        <button type="button" className="chore-button nesmi-member-remove-confirm" onClick={() => void confirmRemoval()} disabled={removing}>{removing ? 'Removing…' : `Remove ${removingMember.name}`}</button>
      </>}
    >
      <div className="nesmi-member-removal">
        <p id={descriptionId}>Their chores will become unassigned. Their availability and completion history will also be removed. This can’t be undone.</p>
        {removeError && <p className="chore-error" role="alert">{removeError}</p>}
      </div>
    </Dialog>}
  </>;
}
