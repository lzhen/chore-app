import { useId, useState, type ReactNode } from 'react';
import type { Category, Chore, ChoreInstance } from '../types';
import type { InteractionMode } from '../hooks/useInteractionMode';
import { dateKey, formatDay } from '../utils/dates';
import { Dialog } from './Dialog';
import './ChoreTaskRow.css';

export function ChoreTaskDetails({ chore, instance, category }: { chore: Chore; instance: ChoreInstance; category?: Category }) {
  return <div className="nesmi-task-read-details">
    <dl><div><dt>Person</dt><dd>{instance.assigneeName || 'Unassigned'}</dd></div><div><dt>Date</dt><dd>{formatDay(instance.date)}{instance.dueTime ? ` · ${instance.dueTime}${instance.endTime ? '–' + instance.endTime : ''}` : ' · All day'}</dd></div><div><dt>Repeat</dt><dd>{{none:'Does not repeat',daily:'Every day',weekly:'Every week',monthly:'Every month'}[chore.recurrence]}</dd></div>{category && <div><dt>Category</dt><dd>{category.name}</dd></div>}{!!chore.estimatedMinutes && <div><dt>Estimate</dt><dd>{chore.estimatedMinutes} min</dd></div>}<div><dt>Priority</dt><dd>{chore.priority === 'medium' ? 'Normal' : chore.priority === 'high' ? 'High' : 'Low'}</dd></div></dl>
    {chore.description && <p className="nesmi-task-notes">{chore.description}</p>}
  </div>;
}

export function ChoreTaskRow({ chore, instance, category, mode, actionsOpen, onEdit, onDelete, onComplete, onActions, children }: {
  chore: Chore; instance: ChoreInstance; category?: Category; mode: InteractionMode; actionsOpen?: boolean;
  onEdit: () => void; onDelete: () => void; onComplete: () => void; onActions: () => void; children?: ReactNode;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = useId();
  const isOverdue = !instance.isCompleted && instance.date < dateKey();
  return <article className={'chore-task nesmi-task-row' + (instance.isCompleted ? ' is-done' : '') + (isOverdue ? ' is-overdue' : '') + (children ? ' is-editing' : '')} data-experience={mode}>
    <div className="nesmi-task-row-main">
      <button className="chore-check" aria-label={`${instance.isCompleted ? 'Undo completion' : 'Complete'}: ${instance.title}`} aria-pressed={instance.isCompleted} onClick={onComplete}><span aria-hidden="true">{instance.isCompleted ? '✓' : ''}</span></button>
      <button className="chore-task-body" onClick={mode === 'web' ? () => setDetailsOpen(!detailsOpen) : onActions} aria-label={`${mode === 'web' ? 'View details' : 'Actions'}: ${instance.title}`} aria-expanded={mode === 'web' ? detailsOpen : actionsOpen} aria-controls={mode === 'web' && detailsOpen ? detailsId : undefined} aria-haspopup={mode === 'app' ? 'dialog' : undefined}>
        <strong className="chore-task-title">{instance.title}</strong>
        <span className="chore-task-meta"><span className="member-dot" style={{backgroundColor: instance.color}}/>{instance.assigneeName || 'Unassigned'}<span aria-hidden="true"> · </span><span className="chore-task-date">{formatDay(instance.date)}{instance.dueTime && ` · ${instance.dueTime}${instance.endTime ? '–' + instance.endTime : ''}`}</span>{instance.isRecurring && <span> · Repeats</span>}</span>
        {(category || chore.estimatedMinutes) && <span className="chore-task-details">{category?.name}{category && chore.estimatedMinutes ? ' · ' : ''}{chore.estimatedMinutes ? `${chore.estimatedMinutes} min` : ''}</span>}
      </button>
      {instance.priority === 'high' && !instance.isCompleted && <span className="priority-label">High</span>}
      {mode === 'web' ? <div className="nesmi-task-row-actions" aria-label={`Actions for ${instance.title}`}>
        <button type="button" onClick={onEdit} aria-label={`Edit ${instance.title}`} aria-expanded={!!children}>Edit</button><button type="button" className="nesmi-task-delete" onClick={onDelete} aria-label={`Delete ${instance.title}`}>Delete</button>
      </div> : <button className="nesmi-task-more" type="button" aria-label={`More actions for ${instance.title}`} aria-haspopup="dialog" aria-expanded={actionsOpen} onClick={onActions}><span aria-hidden="true">⋯</span></button>}
    </div>
    {mode === 'web' && detailsOpen && <div id={detailsId} className="nesmi-task-disclosure"><ChoreTaskDetails chore={chore} instance={instance} category={category}/></div>}
    {children}
  </article>;
}

export function ChoreActionsSheet({ chore, instance, category, onClose, onEdit, onDelete }: {
  chore: Chore; instance: ChoreInstance; category?: Category; onClose: () => void; onEdit: () => void; onDelete: () => void;
}) {
  return <Dialog title={chore.title} onClose={onClose} footer={<div className="nesmi-task-sheet-actions">
    <button type="button" className="chore-button secondary" onClick={onEdit} aria-label={`Edit ${chore.title}`}>Edit chore</button>
    <button type="button" className="chore-button danger" onClick={onDelete} aria-label={`Delete ${chore.title}`}>Delete {chore.recurrence === 'none' ? 'chore' : 'series'}</button>
  </div>}>
    <div className="nesmi-task-actions-sheet"><ChoreTaskDetails chore={chore} instance={instance} category={category}/></div>
  </Dialog>;
}
