import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Chore, RecurrenceType } from '../types';

interface ChoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  editChore?: Chore | null;
  defaultDate?: string;
}

export function ChoreModal({ isOpen, onClose, editChore, defaultDate }: ChoreModalProps) {
  const { state, addChore, updateChore, deleteChore } = useApp();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');

  useEffect(() => {
    if (editChore) {
      setTitle(editChore.title);
      setDate(editChore.date);
      setAssigneeId(editChore.assigneeId || '');
      setRecurrence(editChore.recurrence);
    } else {
      setTitle('');
      setDate(defaultDate || new Date().toISOString().split('T')[0]);
      setAssigneeId('');
      setRecurrence('none');
    }
  }, [editChore, defaultDate, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;

    if (editChore) {
      updateChore({
        ...editChore,
        title: title.trim(),
        date,
        assigneeId: assigneeId || null,
        recurrence,
      });
    } else {
      addChore(title.trim(), date, assigneeId || null, recurrence);
    }
    onClose();
  };

  const handleDelete = () => {
    if (editChore && confirm('Are you sure you want to delete this chore?')) {
      deleteChore(editChore.id);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-overlay flex items-center justify-center z-50">
      <div className="glass-card w-full max-w-md mx-4 animate-slide-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-content-primary">
            {editChore ? 'Edit Chore' : 'Add New Chore'}
          </h3>
          <button
            onClick={onClose}
            className="text-content-secondary hover:text-content-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Clean kitchen"
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-surface-primary text-content-primary placeholder-content-secondary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-surface-primary text-content-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">
              Assign to
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-surface-primary text-content-primary"
            >
              <option value="">Unassigned</option>
              {state.teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-content-primary mb-1">
              Repeat
            </label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent bg-surface-primary text-content-primary"
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4">
            {editChore && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 text-red-500 hover:text-red-600 font-medium transition-colors"
              >
                Delete
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-content-secondary hover:text-content-primary font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-accent text-white rounded-md font-medium hover:bg-accent-hover transition-colors"
            >
              {editChore ? 'Save' : 'Add Chore'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
