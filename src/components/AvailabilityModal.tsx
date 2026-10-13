import { useId, useRef, useState } from 'react';
import { parseDate } from '../utils/dates';
import { useApp } from '../context/AppContext';
import { TeamMember } from '../types';
import { Dialog } from './Dialog';
import './AvailabilityModal.css';

interface AvailabilityModalProps {
  member: TeamMember;
  onClose: () => void;
}

export function AvailabilityModal({ member, onClose }: AvailabilityModalProps) {
  const { state, addAvailability, deleteAvailability } = useApp();
  const id = useId();
  const pendingRef = useRef(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null);
  const memberAvailability = state.availability.filter(a => a.memberId === member.id);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pendingRef.current) return;
    if (!startDate || !endDate) {
      setFormError('Choose a start and end date.');
      return;
    }
    if (endDate < startDate) {
      setFormError('End date must be on or after the start date.');
      return;
    }
    pendingRef.current = true;
    setPending('add');
    setFormError('');
    try {
      await addAvailability(member.id, startDate, endDate, reason || undefined);
      setStartDate('');
      setEndDate('');
      setReason('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save availability. Please try again.');
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  };

  const handleDelete = async (periodId: string) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(periodId);
    setDeleteError(null);
    try {
      await deleteAvailability(periodId);
    } catch (error) {
      setDeleteError({ id: periodId, message: error instanceof Error ? error.message : 'Could not remove these dates. Please try again.' });
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  };

  const formatDate = (dateStr: string) => parseDate(dateStr).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <Dialog title={`${member.name}’s availability`} onClose={onClose} busy={pending !== null} variant="centered">
      <div className="nesmi-availability">
        <form onSubmit={handleSubmit} noValidate aria-labelledby={`${id}-add-title`} className="nesmi-availability-form" aria-busy={pending === 'add'}>
          <h3 id={`${id}-add-title`}>Add unavailable dates</h3>
          <div className="nesmi-availability-dates">
            <div className="nesmi-availability-field">
              <label htmlFor={`${id}-start`}>Start date</label>
              <input
                id={`${id}-start`}
                type="date"
                value={startDate}
                onChange={event => { setStartDate(event.target.value); setFormError(''); }}
                className="chore-input"
                required
                disabled={pending !== null}
                aria-describedby={formError ? `${id}-form-error` : undefined}
              />
            </div>
            <div className="nesmi-availability-field">
              <label htmlFor={`${id}-end`}>End date</label>
              <input
                id={`${id}-end`}
                type="date"
                value={endDate}
                onChange={event => { setEndDate(event.target.value); setFormError(''); }}
                min={startDate || undefined}
                className="chore-input"
                required
                disabled={pending !== null}
                aria-invalid={!!endDate && !!startDate && endDate < startDate}
                aria-describedby={formError ? `${id}-form-error` : undefined}
              />
            </div>
          </div>
          <div className="nesmi-availability-field">
            <label htmlFor={`${id}-reason`}>Reason <span>(optional)</span></label>
            <input
              id={`${id}-reason`}
              type="text"
              value={reason}
              onChange={event => setReason(event.target.value)}
              placeholder="Optional note"
              className="chore-input"
              disabled={pending !== null}
            />
          </div>
          {formError && <p id={`${id}-form-error`} className="chore-error" role="alert">{formError}</p>}
          <button type="submit" className="chore-button secondary nesmi-availability-submit" disabled={pending !== null}>
            {pending === 'add' ? 'Adding…' : 'Add dates'}
          </button>
        </form>

        <section className="nesmi-availability-existing" aria-labelledby={`${id}-existing-title`}>
          <h3 id={`${id}-existing-title`}>Unavailable dates</h3>
          {memberAvailability.length === 0 ? (
            <p className="nesmi-availability-empty">No unavailable dates yet.</p>
          ) : (
            <ul className="nesmi-availability-list">
              {memberAvailability.map(period => {
                const dateLabel = period.startDate === period.endDate
                  ? formatDate(period.startDate)
                  : `${formatDate(period.startDate)} – ${formatDate(period.endDate)}`;
                return (
                  <li key={period.id} className="nesmi-availability-period" aria-busy={pending === period.id}>
                    <div className="nesmi-availability-period-row">
                      <div className="nesmi-availability-period-details">
                        <p className="nesmi-availability-range">{dateLabel}</p>
                        {period.reason && <p className="nesmi-availability-reason">{period.reason}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDelete(period.id)}
                        className="touch-button nesmi-availability-remove"
                        disabled={pending !== null}
                        aria-label={`Remove dates ${dateLabel}`}
                        title="Remove dates"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    {deleteError?.id === period.id && <p className="chore-error" role="alert">{deleteError.message}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Dialog>
  );
}
