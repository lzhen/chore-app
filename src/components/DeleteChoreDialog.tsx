import { useId, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import type { Chore } from '../types';
import { Dialog } from './Dialog';
import './DeleteChoreDialog.css';

/** One named, deliberate destructive decision for row actions and the shared editor. */
export function DeleteChoreDialog({ chore, onClose, onDeleted }: { chore: Chore; onClose: () => void; onDeleted: () => void }) {
  const { deleteChore } = useApp();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const descriptionId = useId();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState('');
  const series = chore.recurrence !== 'none';
  async function remove() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await deleteChore(chore.id); onDeleted(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete this chore. Please try again.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <Dialog title={series ? 'Delete repeating series?' : 'Delete chore?'} role="alertdialog" variant="centered" descriptionId={descriptionId} initialFocusRef={cancelRef} busy={busy} onClose={onClose} footer={<>
    <button ref={cancelRef} type="button" className="chore-button secondary" disabled={busy} onClick={onClose}>Cancel</button>
    <button type="button" className="chore-button danger" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : series ? 'Delete entire series' : 'Delete chore'}</button>
  </>}>
    <div className="nesmi-delete-confirmation" id={descriptionId}><p><strong>{chore.title}</strong></p><p>{series ? 'This deletes every occurrence in this repeating series, not just the selected date.' : 'This removes this chore.'} Its completion history will also be deleted. This cannot be undone.</p></div>
    {error && <p role="alert" className="chore-error">{error} The chore has not been deleted.</p>}
  </Dialog>;
}
