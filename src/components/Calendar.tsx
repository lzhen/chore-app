import { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import { EventClickArg } from '@fullcalendar/core';
import { useApp } from '../context/AppContext';
import { generateChoreInstances, getCalendarRange } from '../utils/recurrence';
import { Chore } from '../types';

interface CalendarProps {
  onAddClick: () => void;
  onEventClick: (chore: Chore) => void;
}

export function Calendar({ onAddClick, onEventClick }: CalendarProps) {
  const { state } = useApp();

  const events = useMemo(() => {
    const { start, end } = getCalendarRange();
    const instances = generateChoreInstances(state.chores, state.teamMembers, start, end);

    return instances.map((instance) => ({
      id: instance.id,
      title: instance.title,
      date: instance.date,
      backgroundColor: instance.color,
      borderColor: instance.color,
      extendedProps: {
        choreId: instance.choreId,
        isRecurring: instance.isRecurring,
      },
    }));
  }, [state.chores, state.teamMembers]);

  const handleEventClick = (arg: EventClickArg) => {
    const choreId = arg.event.extendedProps.choreId;
    const chore = state.chores.find((c) => c.id === choreId);
    if (chore) {
      onEventClick(chore);
    }
  };

  return (
    <div className="flex-1 p-3 sm:p-6 overflow-hidden">
      <div className="glass-card p-3 sm:p-4 h-full flex flex-col">
        <div className="flex justify-end mb-3 sm:mb-4">
          <button
            onClick={onAddClick}
            className="px-3 sm:px-4 py-2 bg-accent text-white rounded-md font-medium hover:bg-accent-hover transition-colors flex items-center gap-2 text-sm sm:text-base"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Add Chore</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
        <div className="flex-1 min-h-0 calendar-container">
          <FullCalendar
            plugins={[dayGridPlugin]}
            initialView="dayGridMonth"
            events={events}
            eventClick={handleEventClick}
            headerToolbar={{
              left: 'prev,next',
              center: 'title',
              right: 'today',
            }}
            height="100%"
            dayMaxEvents={2}
            eventDisplay="block"
            titleFormat={{ year: 'numeric', month: 'short' }}
            dayHeaderFormat={{ weekday: 'short' }}
          />
        </div>
      </div>
    </div>
  );
}
