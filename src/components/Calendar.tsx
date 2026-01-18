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
    <div className="flex-1 p-6 bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 h-full flex flex-col">
        <div className="flex justify-end mb-4">
          <button
            onClick={onAddClick}
            className="px-4 py-2 bg-blue-500 text-white rounded-md font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Chore
          </button>
        </div>
        <div className="flex-1 calendar-dark">
          <FullCalendar
            plugins={[dayGridPlugin]}
            initialView="dayGridMonth"
            events={events}
            eventClick={handleEventClick}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: '',
            }}
            height="100%"
            dayMaxEvents={3}
            eventDisplay="block"
          />
        </div>
      </div>
    </div>
  );
}
