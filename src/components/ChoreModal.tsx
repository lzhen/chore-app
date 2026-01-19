import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Chore, RecurrenceType, Priority } from '../types';

interface ChoreDefaultValues {
  date?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
}

interface ChoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  editChore?: Chore | null;
  defaultDate?: string;
  instanceDate?: string; // For completing a specific instance
  defaultValues?: ChoreDefaultValues; // For click-to-create with pre-filled values
}

const priorityColors = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
};

export function ChoreModal({ isOpen, onClose, editChore, defaultDate, instanceDate, defaultValues }: ChoreModalProps) {
  const { state, addChore, updateChore, deleteChore, completeChore, uncompleteChore, isChoreCompleted } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [priority, setPriority] = useState<Priority>('medium');
  const [categoryId, setCategoryId] = useState<string>('');
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>('');

  // Check if this instance is completed
  const effectiveDate = instanceDate || (editChore?.date ?? '');
  const isCompleted = editChore ? isChoreCompleted(editChore.id, effectiveDate) : false;
  const completion = editChore
    ? state.completions.find(c => c.choreId === editChore.id && c.instanceDate === effectiveDate)
    : null;

  useEffect(() => {
    if (editChore) {
      setTitle(editChore.title);
      setDescription(editChore.description || '');
      setDate(editChore.date);
      setDueTime(editChore.dueTime || '');
      setEndTime(editChore.endTime || '');
      setAssigneeId(editChore.assigneeId || '');
      setRecurrence(editChore.recurrence);
      setPriority(editChore.priority || 'medium');
      setCategoryId(editChore.categoryId || '');
      setEstimatedMinutes(editChore.estimatedMinutes?.toString() || '');
    } else {
      setTitle('');
      setDescription('');
      setDate(defaultValues?.date || defaultDate || new Date().toISOString().split('T')[0]);
      setDueTime(defaultValues?.startTime || '');
      setEndTime(defaultValues?.endTime || '');
      setAssigneeId('');
      setRecurrence('none');
      setPriority('medium');
      setCategoryId('');
      setEstimatedMinutes('');
    }
  }, [editChore, defaultDate, defaultValues, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;

    const choreData = {
      title: title.trim(),
      description: description.trim() || undefined,
      date,
      dueTime: dueTime || undefined,
      endTime: endTime || undefined,
      assigneeId: assigneeId || null,
      recurrence,
      priority,
      categoryId: categoryId || undefined,
      estimatedMinutes: estimatedMinutes ? parseInt(estimatedMinutes) : undefined,
    };

    if (editChore) {
      updateChore({
        ...editChore,
        ...choreData,
      });
    } else {
      addChore(choreData);
    }
    onClose();
  };

  const handleDelete = () => {
    if (editChore && confirm('Are you sure you want to delete this chore?')) {
      deleteChore(editChore.id);
      onClose();
    }
  };

  const handleToggleComplete = () => {
    if (!editChore) return;

    if (isCompleted && completion) {
      uncompleteChore(completion.id);
    } else if (assigneeId) {
      completeChore(editChore.id, effectiveDate, assigneeId);
    } else {
      alert('Please assign someone to complete this chore');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-overlay flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="fluent-card w-full sm:max-w-lg sm:mx-4 animate-fluent-appear rounded-t-fluent-xl sm:rounded-fluent-lg max-h-[90vh] overflow-y-auto shadow-fluent-28">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border sticky top-0 fluent-surface">
          <h3 className="fluent-title text-lg font-semibold text-content-primary">
            {editChore ? 'Edit Chore' : 'Add New Chore'}
          </h3>
          <button
            onClick={onClose}
            className="text-content-secondary hover:text-content-primary hover:bg-subtle-background-hover rounded-fluent-sm transition-all duration-fast p-1.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="fluent-label block text-sm font-medium text-content-primary mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Clean kitchen"
              className="fluent-input w-full"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="fluent-label block text-sm font-medium text-content-primary mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes or instructions..."
              className="fluent-input w-full min-h-[80px] resize-y"
              rows={3}
            />
          </div>

          {/* Date and Time row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="fluent-label block text-sm font-medium text-content-primary mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="fluent-input w-full"
                required
              />
            </div>
            <div>
              <label className="fluent-label block text-sm font-medium text-content-primary mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="fluent-input w-full"
              />
            </div>
            <div>
              <label className="fluent-label block text-sm font-medium text-content-primary mb-1">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="fluent-input w-full"
                min={dueTime}
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="fluent-label block text-sm font-medium text-content-primary mb-2">
              Priority
            </label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 px-3 py-2 rounded-fluent-sm font-medium text-sm transition-all duration-fast capitalize ${
                    priority === p
                      ? `${priorityColors[p]} text-white`
                      : 'bg-surface-tertiary text-content-secondary hover:bg-subtle-background-hover'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Assign to */}
          <div>
            <label className="fluent-label block text-sm font-medium text-content-primary mb-1">
              Assign to
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="fluent-select w-full"
            >
              <option value="">Unassigned</option>
              {state.teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          {state.categories.length > 0 && (
            <div>
              <label className="fluent-label block text-sm font-medium text-content-primary mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="fluent-select w-full"
              >
                <option value="">No category</option>
                {state.categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Recurrence and Estimated Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="fluent-label block text-sm font-medium text-content-primary mb-1">
                Repeat
              </label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                className="fluent-select w-full"
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="fluent-label block text-sm font-medium text-content-primary mb-1">
                Est. time (min)
              </label>
              <input
                type="number"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                placeholder="e.g., 30"
                min="0"
                className="fluent-input w-full"
              />
            </div>
          </div>

          {/* Completion toggle (only for existing chores) */}
          {editChore && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleToggleComplete}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-fluent-md font-medium transition-all duration-fast ${
                  isCompleted
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-surface-tertiary text-content-secondary hover:bg-subtle-background-hover border border-border'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={isCompleted ? "M5 13l4 4L19 7" : "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"}
                  />
                </svg>
                {isCompleted ? 'Completed' : 'Mark as Complete'}
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-4 border-t border-border">
            {editChore && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-fluent-sm font-medium transition-all duration-fast"
              >
                Delete
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="fluent-button-subtle px-4 py-2 text-content-secondary hover:text-content-primary font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="fluent-button px-4 py-2"
            >
              {editChore ? 'Save' : 'Add Chore'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
