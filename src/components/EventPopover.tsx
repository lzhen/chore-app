import { parseDate } from '../utils/dates';
import { Chore, ChoreInstance } from '../types';
import { Dialog } from './Dialog';
interface EventPopoverProps {
  instance: ChoreInstance;
  chore: Chore;
  position: { x: number; y: number };
  onEdit: () => void;
  onComplete: () => void;
  onClose: () => void;
}
export function EventPopover({ instance, onEdit, onComplete, onClose }: EventPopoverProps) {
  const date = parseDate(instance.date).toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  const time = instance.dueTime ? `${instance.dueTime}${instance.endTime ? ` – ${instance.endTime}` : ''}` : 'All day';
  return <Dialog title={instance.title} variant="centered" onClose={onClose} footer={<>
    <button type="button" onClick={onComplete} className="chore-button secondary">{instance.isCompleted ? 'Mark incomplete' : 'Mark complete'}</button>
    <button type="button" onClick={onEdit} className="chore-button primary">Edit</button>
  </>}>
    <div className="nesmi-task-details">
      <p>{date}<span aria-hidden="true"> · </span>{time}</p>
      <p>{instance.assigneeName || 'Unassigned'}</p>
      {instance.priority !== 'medium' && <p>{instance.priority === 'high' ? 'High priority' : 'Low priority'}</p>}
      {instance.description && <p className="nesmi-task-note">{instance.description}</p>}
      {instance.isRecurring && <p>Repeats</p>}
      {instance.isCompleted && <p className="nesmi-task-status">✓ Completed</p>}
    </div>
  </Dialog>;
}
