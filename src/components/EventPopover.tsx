import { Chore, ChoreInstance } from '../types';

interface EventPopoverProps {
  instance: ChoreInstance;
  chore: Chore;
  position: { x: number; y: number };
  onEdit: () => void;
  onComplete: () => void;
  onClose: () => void;
}

const priorityLabels = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const priorityColors = {
  low: 'bg-blue-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
};

export function EventPopover({
  instance,
  chore: _chore,
  position,
  onEdit,
  onComplete,
  onClose,
}: EventPopoverProps) {
  // Note: _chore is available for future enhancements (e.g., showing recurrence rule details)
  // Adjust position to stay within viewport
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 320),
    y: Math.min(position.y, window.innerHeight - 300),
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Format time range
  const formatTimeRange = () => {
    if (!instance.dueTime) return 'All day';
    if (instance.endTime) {
      return `${instance.dueTime} - ${instance.endTime}`;
    }
    return instance.dueTime;
  };

  return (
    <div
      className="event-popover fixed z-[200] bg-surface-primary border border-border rounded-fluent-lg shadow-fluent-28 w-80 animate-fluent-appear"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {/* Header with color stripe */}
      <div
        className="h-2 rounded-t-fluent-lg"
        style={{ backgroundColor: instance.color }}
      />

      <div className="p-4">
        {/* Title */}
        <div className="flex items-start justify-between mb-3">
          <h3 className={`text-lg font-semibold text-content-primary pr-2 ${instance.isCompleted ? 'line-through opacity-70' : ''}`}>
            {instance.title}
          </h3>
          <button
            onClick={onClose}
            className="text-content-secondary hover:text-content-primary p-1 hover:bg-subtle-background-hover rounded-fluent-sm transition-all flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Date and time */}
        <div className="flex items-center gap-2 text-sm text-content-secondary mb-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div>
            <div>{formatDate(instance.date)}</div>
            <div className="text-xs">{formatTimeRange()}</div>
          </div>
        </div>

        {/* Assignee */}
        {instance.assigneeName && (
          <div className="flex items-center gap-2 text-sm text-content-secondary mb-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <div className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: instance.color }}
              />
              <span>{instance.assigneeName}</span>
            </div>
          </div>
        )}

        {/* Priority */}
        <div className="flex items-center gap-2 text-sm text-content-secondary mb-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
          </svg>
          <span className={`px-2 py-0.5 text-xs text-white rounded-fluent-sm ${priorityColors[instance.priority]}`}>
            {priorityLabels[instance.priority]}
          </span>
        </div>

        {/* Description preview */}
        {instance.description && (
          <div className="text-sm text-content-secondary mb-3 line-clamp-2">
            {instance.description}
          </div>
        )}

        {/* Recurring indicator */}
        {instance.isRecurring && (
          <div className="flex items-center gap-2 text-xs text-content-secondary mb-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Recurring event</span>
          </div>
        )}

        {/* Completion status */}
        {instance.isCompleted && (
          <div className="flex items-center gap-2 text-sm text-green-600 mb-3">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Completed</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
          <button
            onClick={onComplete}
            className={`flex-1 py-2 px-3 rounded-fluent-sm text-sm font-medium transition-all ${
              instance.isCompleted
                ? 'bg-surface-tertiary text-content-secondary hover:bg-subtle-background-hover'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            {instance.isCompleted ? 'Mark Incomplete' : 'Mark Complete'}
          </button>
          <button
            onClick={onEdit}
            className="flex-1 py-2 px-3 rounded-fluent-sm text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-all"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}
