import { useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import { EventClickArg, DateClickArg } from '@fullcalendar/core';
import { useApp } from '../context/AppContext';
import { generateChoreInstances, getCalendarRange } from '../utils/recurrence';
import { Chore } from '../types';

interface CalendarProps {
  onDateClick: (date: string) => void;
  onEventClick: (chore: Chore) => void;
}

export function Calendar({ onDateClick, onEventClick }: CalendarProps) {
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

  const handleDateClick = (arg: DateClickArg) => {
    onDateClick(arg.dateStr);
  };

  const handleEventClick = (arg: EventClickArg) => {
    const choreId = arg.event.extendedProps.choreId;
    const chore = state.chores.find((c) => c.id === choreId);
    if (chore) {
      onEventClick(chore);
    }
  };

  return (
    <div className="flex-1 p-6 bg-gray-50">
      <div className="bg-white rounded-lg shadow-sm p-4 h-full">
        <FullCalendar
          plugins={[dayGridPlugin]}
          initialView="dayGridMonth"
          events={events}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: '',
          }}
          height="100%"
          dayMaxEvents={3}
          eventDisplay="block"
          eventTimeFormat={{
            hour: undefined,
            minute: undefined,
          }}
        />
      </div>
    </div>
  );
}
