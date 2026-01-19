import { useMemo, useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { EventClickArg, DateSelectArg, EventDropArg } from '@fullcalendar/core';
import { EventResizeDoneArg } from '@fullcalendar/interaction';
import { useApp } from '../context/AppContext';
import { generateChoreInstances, getCalendarRange } from '../utils/recurrence';
import { Chore, ChoreInstance } from '../types';
import { EventPopover } from './EventPopover';

interface CalendarProps {
  onAddClick: (defaultValues?: { date?: string; startTime?: string; endTime?: string; allDay?: boolean }) => void;
  onEventClick: (chore: Chore, instanceDate: string) => void;
  searchQuery?: string;
  hiddenMembers?: Set<string>;
}

export interface CalendarRef {
  gotoDate: (date: Date) => void;
  today: () => void;
  changeView: (view: string) => void;
  next: () => void;
  prev: () => void;
}

const priorityIndicators = {
  low: '🔵',
  medium: '🟡',
  high: '🔴',
};

export const Calendar = forwardRef<CalendarRef, CalendarProps>(
  ({ onAddClick, onEventClick, searchQuery, hiddenMembers = new Set() }, ref) => {
    const { state, updateChore, completeChore, uncompleteChore } = useApp();
    const calendarRef = useRef<FullCalendar>(null);

    // Popover state
    const [popover, setPopover] = useState<{
      visible: boolean;
      position: { x: number; y: number };
      instance: ChoreInstance | null;
      chore: Chore | null;
    }>({ visible: false, position: { x: 0, y: 0 }, instance: null, chore: null });

    // Expose calendar API to parent
    useImperativeHandle(ref, () => ({
      gotoDate: (date: Date) => calendarRef.current?.getApi().gotoDate(date),
      today: () => calendarRef.current?.getApi().today(),
      changeView: (view: string) => calendarRef.current?.getApi().changeView(view),
      next: () => calendarRef.current?.getApi().next(),
      prev: () => calendarRef.current?.getApi().prev(),
    }));

    // Close popover when clicking outside
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (popover.visible && !target.closest('.event-popover')) {
          setPopover(prev => ({ ...prev, visible: false }));
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [popover.visible]);

    // Generate calendar events
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

    // Apply search filter and visibility filter
    const filteredInstances = useMemo(() => {
      let filtered = instances;

      // Filter by hidden members
      if (hiddenMembers.size > 0) {
        filtered = filtered.filter(instance =>
          !instance.assigneeId || !hiddenMembers.has(instance.assigneeId)
        );
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(instance =>
          instance.title.toLowerCase().includes(query) ||
          instance.assigneeName?.toLowerCase().includes(query) ||
          instance.description?.toLowerCase().includes(query)
        );
      }

      return filtered;
    }, [instances, searchQuery, hiddenMembers]);

    // Convert instances to FullCalendar events
    const events = useMemo(() => {
      return filteredInstances.map((instance) => {
        // Build start/end times for time grid views
        let start = instance.date;
        let end = instance.date;
        const allDay = instance.allDay !== false && !instance.dueTime;

        if (instance.dueTime) {
          start = `${instance.date}T${instance.dueTime}:00`;
          if (instance.endTime) {
            end = `${instance.date}T${instance.endTime}:00`;
          } else {
            // Default 1 hour duration
            const [hours, mins] = instance.dueTime.split(':').map(Number);
            const endHour = (hours + 1) % 24;
            end = `${instance.date}T${String(endHour).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
          }
        }

        return {
          id: instance.id,
          title: instance.title,
          start,
          end,
          allDay,
          backgroundColor: instance.isCompleted ? '#10B981' : instance.color,
          borderColor: instance.isCompleted ? '#10B981' : instance.color,
          classNames: [
            instance.isCompleted ? 'event-completed' : '',
            `priority-${instance.priority}`,
          ].filter(Boolean),
          extendedProps: {
            choreId: instance.choreId,
            isRecurring: instance.isRecurring,
            isCompleted: instance.isCompleted,
            priority: instance.priority,
            instanceDate: instance.date,
            assigneeName: instance.assigneeName,
            description: instance.description,
            dueTime: instance.dueTime,
            endTime: instance.endTime,
          },
        };
      });
    }, [filteredInstances]);

    // Handle event click - show popover
    const handleEventClick = (arg: EventClickArg) => {
      const choreId = arg.event.extendedProps.choreId;
      const instanceDate = arg.event.extendedProps.instanceDate;
      const chore = state.chores.find((c) => c.id === choreId);
      const instance = filteredInstances.find(i => i.choreId === choreId && i.date === instanceDate);

      if (chore && instance) {
        const rect = arg.el.getBoundingClientRect();
        setPopover({
          visible: true,
          position: { x: rect.left, y: rect.bottom + 8 },
          instance,
          chore,
        });
      }
    };

    // Handle date/time selection - create new event
    const handleDateSelect = (info: DateSelectArg) => {
      const date = info.startStr.split('T')[0];
      const startTime = info.allDay ? undefined : info.startStr.slice(11, 16);
      const endTime = info.allDay ? undefined : info.endStr.slice(11, 16);

      onAddClick({ date, startTime, endTime, allDay: info.allDay });
      calendarRef.current?.getApi().unselect();
    };

    // Handle event drag/drop
    const handleEventDrop = async (info: EventDropArg) => {
      const choreId = info.event.extendedProps.choreId;
      const isRecurring = info.event.extendedProps.isRecurring;
      const chore = state.chores.find(c => c.id === choreId);

      if (!chore) {
        info.revert();
        return;
      }

      // For recurring events, we would need to ask user if they want to update all or just this instance
      // For now, we update all occurrences
      if (isRecurring) {
        const newDate = info.event.start;
        if (newDate) {
          const newDateStr = newDate.toISOString().split('T')[0];
          const newTime = info.event.allDay ? undefined : newDate.toTimeString().slice(0, 5);

          await updateChore({
            ...chore,
            date: newDateStr,
            dueTime: newTime || chore.dueTime,
          });
        }
      } else {
        // Single event - update directly
        const newDate = info.event.start;
        if (newDate) {
          const newDateStr = newDate.toISOString().split('T')[0];
          const newTime = info.event.allDay ? undefined : newDate.toTimeString().slice(0, 5);

          await updateChore({
            ...chore,
            date: newDateStr,
            dueTime: newTime || chore.dueTime,
          });
        }
      }
    };

    // Handle event resize
    const handleEventResize = async (info: EventResizeDoneArg) => {
      const choreId = info.event.extendedProps.choreId;
      const chore = state.chores.find(c => c.id === choreId);

      if (!chore || !info.event.start || !info.event.end) {
        info.revert();
        return;
      }

      const startTime = info.event.start.toTimeString().slice(0, 5);
      const endTime = info.event.end.toTimeString().slice(0, 5);

      await updateChore({
        ...chore,
        dueTime: startTime,
        endTime: endTime,
      });
    };

    // Popover actions
    const handlePopoverEdit = () => {
      if (popover.chore && popover.instance) {
        onEventClick(popover.chore, popover.instance.date);
        setPopover(prev => ({ ...prev, visible: false }));
      }
    };

    const handlePopoverComplete = async () => {
      if (popover.instance && popover.chore) {
        if (popover.instance.isCompleted) {
          // Find the completion and remove it
          const completion = state.completions.find(
            c => c.choreId === popover.instance!.choreId && c.instanceDate === popover.instance!.date
          );
          if (completion) {
            await uncompleteChore(completion.id);
          }
        } else {
          // Complete the chore
          const completedBy = popover.chore.assigneeId || state.teamMembers[0]?.id || 'unknown';
          await completeChore(popover.instance.choreId, popover.instance.date, completedBy);
        }
        setPopover(prev => ({ ...prev, visible: false }));
      }
    };

    const handlePopoverClose = () => {
      setPopover(prev => ({ ...prev, visible: false }));
    };

    return (
      <div className="flex-1 p-3 sm:p-6 overflow-hidden">
        <div className="fluent-card p-3 sm:p-4 h-full flex flex-col">
          <div className="flex-1 min-h-0 calendar-container">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              events={events}
              eventClick={handleEventClick}
              select={handleDateSelect}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
              }}
              buttonText={{
                today: 'Today',
                month: 'Month',
                week: 'Week',
                day: 'Day',
                list: 'Agenda',
              }}
              height="100%"
              // Interaction settings
              editable={true}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={3}
              eventDisplay="block"
              nowIndicator={true}
              // Time grid settings
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              slotDuration="00:30:00"
              scrollTime="08:00:00"
              allDaySlot={true}
              allDayText="All day"
              // Formatting
              titleFormat={{ year: 'numeric', month: 'short' }}
              dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
              slotLabelFormat={{ hour: 'numeric', minute: '2-digit', hour12: true }}
              eventTimeFormat={{ hour: 'numeric', minute: '2-digit', hour12: true }}
              // Custom event content
              eventContent={(arg) => {
                const isCompleted = arg.event.extendedProps.isCompleted;
                const priority = arg.event.extendedProps.priority;
                const view = arg.view.type;

                // Compact rendering for month view
                if (view === 'dayGridMonth') {
                  return (
                    <div className={`flex items-center gap-1 px-1 py-0.5 overflow-hidden ${isCompleted ? 'line-through opacity-70' : ''}`}>
                      {!isCompleted && priority && (
                        <span className="text-[10px] flex-shrink-0">
                          {priorityIndicators[priority as keyof typeof priorityIndicators]}
                        </span>
                      )}
                      {isCompleted && (
                        <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className="truncate text-xs">{arg.event.title}</span>
                    </div>
                  );
                }

                // Richer rendering for week/day views
                return (
                  <div className={`flex flex-col h-full px-1 py-0.5 overflow-hidden ${isCompleted ? 'line-through opacity-70' : ''}`}>
                    <div className="flex items-center gap-1">
                      {!isCompleted && priority && (
                        <span className="text-[10px] flex-shrink-0">
                          {priorityIndicators[priority as keyof typeof priorityIndicators]}
                        </span>
                      )}
                      {isCompleted && (
                        <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      <span className="truncate text-xs font-medium">{arg.event.title}</span>
                    </div>
                    {arg.event.extendedProps.assigneeName && (
                      <span className="text-[10px] opacity-80 truncate">
                        {arg.event.extendedProps.assigneeName}
                      </span>
                    )}
                  </div>
                );
              }}
            />
          </div>
        </div>

        {/* Event Popover */}
        {popover.visible && popover.instance && popover.chore && (
          <EventPopover
            instance={popover.instance}
            chore={popover.chore}
            position={popover.position}
            onEdit={handlePopoverEdit}
            onComplete={handlePopoverComplete}
            onClose={handlePopoverClose}
          />
        )}
      </div>
    );
  }
);

Calendar.displayName = 'Calendar';
