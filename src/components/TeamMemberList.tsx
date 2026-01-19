import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { TeamMember } from '../types';
import { MiniCalendar } from './MiniCalendar';

interface TeamMemberListProps {
  onClose?: () => void;
  onDateSelect?: (date: Date) => void;
  eventDates?: Set<string>;
  hiddenMembers?: Set<string>;
  onToggleMemberVisibility?: (memberId: string) => void;
  onProfileOpen?: (member: TeamMember) => void;
  onAvailabilityOpen?: (member: TeamMember) => void;
}

export function TeamMemberList({ onClose, onDateSelect, eventDates, hiddenMembers = new Set(), onToggleMemberVisibility, onProfileOpen, onAvailabilityOpen }: TeamMemberListProps) {
  const { state, addMember, removeMember, isMemberAvailable } = useApp();
  const [newName, setNewName] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      addMember(newName.trim());
      setNewName('');
    }
  };

  const getMemberAvailabilityInfo = (memberId: string) => {
    const isAvailable = isMemberAvailable(memberId, today);
    const futureUnavailable = state.availability.find(
      a => a.memberId === memberId && a.startDate > today
    );
    return { isAvailable, futureUnavailable };
  };

  return (
    <div className="fluent-panel w-72 lg:w-64 p-4 flex flex-col h-full">
        {/* Header with close button for mobile */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="fluent-title text-lg font-semibold text-content-primary">Team Members</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 text-content-secondary hover:text-content-primary hover:bg-subtle-background-hover rounded-fluent-sm transition-all duration-fast"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Mini Calendar for navigation */}
        {onDateSelect && (
          <div className="mb-4">
            <MiniCalendar
              onDateSelect={onDateSelect}
              eventDates={eventDates}
            />
          </div>
        )}

        <form onSubmit={handleAdd} className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Add member..."
              className="fluent-input flex-1 text-sm"
            />
            <button
              type="submit"
              className="fluent-button px-3 py-2 text-sm"
            >
              Add
            </button>
          </div>
        </form>

        <div className="flex-1 overflow-y-auto">
          {state.teamMembers.length === 0 ? (
            <p className="text-sm text-content-secondary italic">No team members yet</p>
          ) : (
            <ul className="space-y-1">
              {state.teamMembers.map((member) => {
                const { isAvailable, futureUnavailable } = getMemberAvailabilityInfo(member.id);
                const isVisible = !hiddenMembers.has(member.id);
                return (
                  <li
                    key={member.id}
                    className="flex items-center justify-between p-2 rounded-fluent-sm hover:bg-subtle-background-hover group transition-all duration-fast"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* Visibility checkbox */}
                      {onToggleMemberVisibility && (
                        <button
                          onClick={() => onToggleMemberVisibility(member.id)}
                          className={`w-4 h-4 flex-shrink-0 rounded border transition-all ${
                            isVisible
                              ? 'border-accent bg-accent'
                              : 'border-border bg-surface-tertiary'
                          }`}
                          title={isVisible ? 'Hide events' : 'Show events'}
                        >
                          {isVisible && (
                            <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      )}
                      {/* Avatar or color dot */}
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className={`w-6 h-6 rounded-fluent-circle object-cover flex-shrink-0 transition-opacity cursor-pointer ${!isVisible ? 'opacity-40' : ''}`}
                          onClick={() => onProfileOpen?.(member)}
                        />
                      ) : (
                        <button
                          onClick={() => onProfileOpen?.(member)}
                          className={`w-6 h-6 rounded-fluent-circle flex-shrink-0 transition-opacity flex items-center justify-center text-white text-xs font-bold ${!isVisible ? 'opacity-40' : ''}`}
                          style={{ backgroundColor: member.color }}
                        >
                          {member.name.charAt(0).toUpperCase()}
                        </button>
                      )}
                      <span
                        className={`text-sm text-content-primary truncate transition-opacity cursor-pointer hover:underline ${!isVisible ? 'opacity-40' : ''}`}
                        onClick={() => onProfileOpen?.(member)}
                      >
                        {member.name}
                      </span>
                      {/* Points badge */}
                      {member.points > 0 && (
                        <span className="text-xs bg-brand-primary/20 text-brand-primary px-1.5 py-0.5 rounded-fluent-sm flex-shrink-0">
                          {member.points}pts
                        </span>
                      )}
                      {/* Availability badge */}
                      {!isAvailable && (
                        <span className="text-xs bg-orange-500/20 text-orange-600 px-1.5 py-0.5 rounded-fluent-sm flex-shrink-0">
                          Away
                        </span>
                      )}
                      {isAvailable && futureUnavailable && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-600 px-1.5 py-0.5 rounded-fluent-sm flex-shrink-0" title={`Unavailable from ${futureUnavailable.startDate}`}>
                          Soon
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      {/* Profile button */}
                      <button
                        onClick={() => onProfileOpen?.(member)}
                        className="text-content-secondary hover:text-brand-primary hover:bg-brand-primary/10 rounded-fluent-sm p-0.5 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all duration-fast"
                        title="Edit profile"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </button>
                      {/* Availability button */}
                      <button
                        onClick={() => onAvailabilityOpen?.(member)}
                        className="text-content-secondary hover:text-accent hover:bg-accent/10 rounded-fluent-sm p-0.5 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all duration-fast"
                        title="Set availability"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                      {/* Remove button */}
                      <button
                        onClick={() => removeMember(member.id)}
                        className="text-content-secondary hover:text-red-500 hover:bg-red-500/10 rounded-fluent-sm p-0.5 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all duration-fast"
                        title="Remove member"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
    </div>
  );
}
