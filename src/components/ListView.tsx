import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { generateChoreInstances, getCalendarRange } from '../utils/recurrence';
import { Chore, ChoreInstance } from '../types';

interface ListViewProps {
  onAddClick: () => void;
  onEventClick: (chore: Chore, instanceDate: string) => void;
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

export function ListView({ onAddClick, onEventClick }: ListViewProps) {
  const { state, completeChore, uncompleteChore } = useApp();
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'assignee'>('date');

  const instances = useMemo(() => {
    const { start, end } = getCalendarRange();
    return generateChoreInstances(
      state.chores,
      state.teamMembers,
      state.completions,
      start,
      end
    );
  }, [state.chores, state.teamMembers, state.completions]);

  // Filter and sort instances
  const filteredInstances = useMemo(() => {
    let result = [...instances];

    // Apply filter
    if (filter === 'pending') {
      result = result.filter(i => !i.isCompleted);
    } else if (filter === 'completed') {
      result = result.filter(i => i.isCompleted);
    }

    // Apply sort
    result.sort((a, b) => {
      if (sortBy === 'date') {
        return a.date.localeCompare(b.date);
      } else if (sortBy === 'priority') {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      } else if (sortBy === 'assignee') {
        const aName = a.assigneeName || 'Unassigned';
        const bName = b.assigneeName || 'Unassigned';
        return aName.localeCompare(bName);
      }
      return 0;
    });

    return result;
  }, [instances, filter, sortBy]);

  const handleToggleComplete = async (instance: ChoreInstance) => {
    const chore = state.chores.find(c => c.id === instance.choreId);
    if (!chore) return;

    if (instance.isCompleted) {
      // Find completion and uncomplete
      const completion = state.completions.find(
        c => c.choreId === instance.choreId && c.instanceDate === instance.date
      );
      if (completion) {
        await uncompleteChore(completion.id);
      }
    } else {
      // Complete with first available member or self
      const completedBy = chore.assigneeId || state.teamMembers[0]?.id || 'unknown';
      await completeChore(instance.choreId, instance.date, completedBy);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dateStr === today.toISOString().split('T')[0]) {
      return 'Today';
    } else if (dateStr === tomorrow.toISOString().split('T')[0]) {
      return 'Tomorrow';
    }
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex-1 p-3 sm:p-6 overflow-hidden">
      <div className="fluent-card p-3 sm:p-4 h-full flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            {/* Filter buttons */}
            <div className="flex rounded-fluent-md border border-border overflow-hidden">
              {(['all', 'pending', 'completed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-sm capitalize transition-all duration-fast ${
                    filter === f
                      ? 'bg-accent text-white'
                      : 'bg-surface-secondary text-content-secondary hover:bg-subtle-background-hover'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sort dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'priority' | 'assignee')}
              className="fluent-input text-sm py-1.5"
            >
              <option value="date">Sort by Date</option>
              <option value="priority">Sort by Priority</option>
              <option value="assignee">Sort by Assignee</option>
            </select>

            <button
              onClick={onAddClick}
              className="fluent-button px-3 sm:px-4 py-2 flex items-center gap-2 text-sm sm:text-base"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Add Chore</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {filteredInstances.length === 0 ? (
            <div className="flex items-center justify-center h-full text-content-secondary">
              No chores found
            </div>
          ) : (
            <div className="space-y-2">
              {filteredInstances.map((instance) => {
                const chore = state.chores.find(c => c.id === instance.choreId);
                if (!chore) return null;

                return (
                  <div
                    key={instance.id}
                    className={`flex items-center gap-3 p-3 rounded-fluent-md border border-border transition-all duration-fast hover:bg-subtle-background-hover ${
                      instance.isCompleted ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleComplete(instance)}
                      className={`w-5 h-5 rounded-fluent-sm border-2 flex-shrink-0 flex items-center justify-center transition-all duration-fast ${
                        instance.isCompleted
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-border hover:border-accent'
                      }`}
                    >
                      {instance.isCompleted && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>

                    {/* Content */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => onEventClick(chore, instance.date)}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium text-content-primary ${instance.isCompleted ? 'line-through' : ''}`}>
                          {instance.title}
                        </span>
                        {instance.isRecurring && (
                          <svg className="w-4 h-4 text-content-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-content-secondary">
                        <span>{formatDate(instance.date)}</span>
                        {instance.dueTime && <span>{instance.dueTime}</span>}
                        {instance.assigneeName && (
                          <span className="flex items-center gap-1">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: instance.color }}
                            />
                            {instance.assigneeName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Priority badge */}
                    <div
                      className={`px-2 py-0.5 rounded-fluent-sm text-xs text-white flex-shrink-0 ${
                        priorityColors[instance.priority]
                      }`}
                    >
                      {priorityLabels[instance.priority]}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
