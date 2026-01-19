import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { TeamMember } from '../types';

interface AvailabilityModalProps {
  member: TeamMember;
  onClose: () => void;
}

export function AvailabilityModal({ member, onClose }: AvailabilityModalProps) {
  const { state, addAvailability, deleteAvailability } = useApp();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  // Get this member's availability records
  const memberAvailability = state.availability.filter(a => a.memberId === member.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (startDate && endDate) {
      await addAvailability(member.id, startDate, endDate, reason || undefined);
      setStartDate('');
      setEndDate('');
      setReason('');
    }
  };

  const handleDelete = async (id: string) => {
    await deleteAvailability(id);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-overlay flex items-center justify-center z-50 p-4">
      <div className="fluent-card w-full max-w-md max-h-[90vh] overflow-hidden animate-fluent-appear shadow-fluent-28">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-fluent-circle"
              style={{ backgroundColor: member.color }}
            />
            <h2 className="fluent-title text-lg font-semibold text-content-primary">
              {member.name}'s Availability
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-content-secondary hover:text-content-primary hover:bg-subtle-background-hover rounded-fluent-sm transition-all duration-fast p-1.5"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Add new unavailability */}
          <form onSubmit={handleSubmit} className="mb-6">
            <h3 className="text-sm font-medium text-content-primary mb-3">Set Unavailable Period</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-content-secondary mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="fluent-input text-sm w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-content-secondary mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className="fluent-input text-sm w-full"
                  required
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs text-content-secondary mb-1">Reason (optional)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Vacation, Sick leave..."
                className="fluent-input text-sm w-full"
              />
            </div>
            <button type="submit" className="fluent-button w-full py-2 text-sm">
              Add Unavailable Period
            </button>
          </form>

          {/* Existing unavailability periods */}
          <div>
            <h3 className="text-sm font-medium text-content-primary mb-3">Unavailable Periods</h3>
            {memberAvailability.length === 0 ? (
              <p className="text-sm text-content-secondary italic text-center py-4">
                No unavailable periods set
              </p>
            ) : (
              <ul className="space-y-2">
                {memberAvailability.map((period) => (
                  <li
                    key={period.id}
                    className="flex items-center justify-between p-3 rounded-fluent-sm bg-surface-tertiary border border-border"
                  >
                    <div>
                      <div className="text-sm text-content-primary">
                        {formatDate(period.startDate)} - {formatDate(period.endDate)}
                      </div>
                      {period.reason && (
                        <div className="text-xs text-content-secondary mt-0.5">
                          {period.reason}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(period.id)}
                      className="text-content-secondary hover:text-red-500 hover:bg-red-500/10 rounded-fluent-sm p-1.5 transition-all duration-fast"
                      title="Remove period"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
