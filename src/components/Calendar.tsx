import { dateKey, shiftDate } from '../utils/dates';
import { CompletionDialog } from './CompletionDialog';
import { useCallback, useId, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { EventClickArg, DateSelectArg, EventDropArg, DatesSetArg } from '@fullcalendar/core';
import { EventResizeDoneArg } from '@fullcalendar/interaction';
import { useApp } from '../context/AppContext';
import { generateChoreInstances, getCalendarRange } from '../utils/recurrence';
import { Chore, ChoreInstance } from '../types';
import { EventPopover } from './EventPopover';
import './Calendar.css';

const calendarViews = [
  { id: 'dayGridMonth', label: 'Month', period: 'month' },
  { id: 'timeGridWeek', label: 'Week', period: 'week' },
  { id: 'timeGridDay', label: 'Day', period: 'day' },
  { id: 'listWeek', label: 'Agenda', period: 'week' },
];

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

export const Calendar = forwardRef<CalendarRef, CalendarProps>(
  ({ onAddClick, onEventClick, searchQuery, hiddenMembers = new Set() }, ref) => {
    const { state, updateChore } = useApp();
    const [completionInstance,setCompletionInstance] = useState<ChoreInstance|null>(null);
    const [operationError,setOperationError] = useState('');
    const calendarRef = useRef<FullCalendar>(null);
    // Pick a readable first view once. Resizing never changes the user's view or date.
    const [initialView] = useState(() =>
      typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
        ? 'listWeek'
        : 'dayGridMonth'
    );
    const [display, setDisplay] = useState({ view: initialView, title: '' });
    const titleId = useId();
    const period = calendarViews.find(view => view.id === display.view)?.period || 'period';
    const handleDatesSet = useCallback(({ view }: DatesSetArg) => {
      setDisplay(previous => previous.view === view.type && previous.title === view.title
        ? previous
        : { view: view.type, title: view.title });
    }, []);

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
        let end = shiftDate(instance.date,1);
        const allDay = instance.allDay !== false && !instance.dueTime;

        if (instance.dueTime) {
          start = `${instance.date}T${instance.dueTime}:00`;
          if (instance.endTime) {
            end = `${instance.date}T${instance.endTime}:00`;
          } else {
            // Default 1 hour duration
            const [hours, mins] = instance.dueTime.split(':').map(Number);
            const endHour = (hours + 1) % 24;
            end = `${endHour===0?shiftDate(instance.date,1):instance.date}T${String(endHour).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
          }
        }

        return {
          id: instance.id,
          title: instance.title,
          start,
          end,
          allDay,
          backgroundColor: 'var(--surface-tertiary)',
          borderColor: 'var(--border-subtle)',
          textColor: 'var(--text-primary)',
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
            memberColor: instance.color,
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
      if (isRecurring && !confirm('Move the entire repeating series? This changes all occurrences.')) {info.revert();return;}
      try {
      if (isRecurring) {
        const newDate = info.event.start;
        if (newDate) {
          const newDateStr = dateKey(newDate);
          const newTime = info.event.allDay ? undefined : newDate.toTimeString().slice(0, 5);

          await updateChore({
            ...chore,
            date: newDateStr,
            dueTime: newTime,
            endTime: undefined,
          });
        }
      } else {
        // Single event - update directly
        const newDate = info.event.start;
        if (newDate) {
          const newDateStr = dateKey(newDate);
          const newTime = info.event.allDay ? undefined : newDate.toTimeString().slice(0, 5);

          await updateChore({
            ...chore,
            date: newDateStr,
            dueTime: newTime,
            endTime: undefined,
          });
        }
      }
      } catch(e) {info.revert();setOperationError(e instanceof Error?e.message:'Could not move chore.');}
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

      if (chore.recurrence!=='none'&&!confirm('Change the time for the entire repeating series?')) {info.revert();return;}
      try {await updateChore({...chore,dueTime:startTime,endTime});}
      catch(e){info.revert();setOperationError(e instanceof Error?e.message:'Could not save time.');}
    };

    // Popover actions
    const handlePopoverEdit = () => {
      if (popover.chore && popover.instance) {
        onEventClick(popover.chore, popover.instance.date);
        setPopover(prev => ({ ...prev, visible: false }));
      }
    };

    const handlePopoverComplete = () => {
      if(popover.instance) setCompletionInstance(popover.instance);
      setPopover(prev=>({...prev,visible:false}));
    };

    const handlePopoverClose = () => {
      setPopover(prev => ({ ...prev, visible: false }));
    };

    return (
      <div className="chore-calendar-page nesmi-calendar">{operationError&&<p className="chore-error" role="alert">{operationError}<button onClick={()=>setOperationError('')}>Dismiss</button></p>}{completionInstance&&<CompletionDialog instance={completionInstance} onClose={()=>setCompletionInstance(null)}/>}
        <section className="mobile-calendar-shell" aria-labelledby={titleId}>
          <div className="nesmi-calendar-toolbar">
            <div className="nesmi-calendar-period">
              <h3 id={titleId} className="nesmi-calendar-title" aria-live="polite" aria-atomic="true">{display.title}</h3>
              <div className="nesmi-calendar-date-controls" role="group" aria-label="Calendar dates">
                <button type="button" className="nesmi-calendar-control nesmi-calendar-arrow" aria-label={`Previous ${period}`} onClick={() => calendarRef.current?.getApi().prev()}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
                </button>
                <button type="button" className="nesmi-calendar-control nesmi-calendar-arrow" aria-label={`Next ${period}`} onClick={() => calendarRef.current?.getApi().next()}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg>
                </button>
                <button type="button" className="nesmi-calendar-control" onClick={() => calendarRef.current?.getApi().today()}>Today</button>
              </div>
            </div>
            <div className="nesmi-calendar-view-controls" role="group" aria-label="Calendar view">
              {calendarViews.map(view => (
                <button key={view.id} type="button" className="nesmi-calendar-control" aria-pressed={display.view === view.id} onClick={() => calendarRef.current?.getApi().changeView(view.id)}>{view.label}</button>
              ))}
            </div>
          </div>
          <div className="calendar-container">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialView={initialView}
              datesSet={handleDatesSet}
              events={events}
              eventClick={handleEventClick}
              select={handleDateSelect}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              headerToolbar={false}
              height={display.view.startsWith('timeGrid') ? 640 : 'auto'}
              expandRows={false}
              fixedWeekCount={false}
              views={{
                dayGridMonth: { titleFormat: { year: 'numeric', month: 'long' } },
                timeGridWeek: { titleFormat: { year: 'numeric', month: 'short', day: 'numeric' }, dayHeaderFormat: { weekday: 'short', day: 'numeric' } },
                timeGridDay: { titleFormat: { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' }, dayHeaderFormat: { weekday: 'long', day: 'numeric' } },
                listWeek: { titleFormat: { year: 'numeric', month: 'short', day: 'numeric' } },
              }}
              // Interaction settings
              editable={true}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={3}
              eventDisplay="block"
              eventInteractive={true}
              nowIndicator={true}
              // Time grid settings
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              slotDuration="00:30:00"
              scrollTime="08:00:00"
              allDaySlot={true}
              allDayText="All day"
              // Formatting
              dayHeaderFormat={{ weekday: 'short' }}
              slotLabelFormat={{ hour: 'numeric', minute: '2-digit', hour12: true }}
              eventTimeFormat={{ hour: 'numeric', minute: '2-digit', hour12: true }}
              // Custom event content
              eventContent={(arg) => {
                const { isCompleted, priority, memberColor, assigneeName } = arg.event.extendedProps;
                const isMonth = arg.view.type === 'dayGridMonth';
                const isAgenda = arg.view.type === 'listWeek';

                return (
                  <div className={`nesmi-calendar-event ${isMonth ? 'is-month' : ''} ${isAgenda ? 'is-agenda' : ''} ${isCompleted ? 'is-completed' : ''}`}>
                    {/* Agenda already has FullCalendar's localized time column. */}
                    {!isAgenda && !arg.event.allDay && arg.timeText && (
                      <time className="nesmi-calendar-event-time" dateTime={arg.event.startStr}>{arg.timeText}</time>
                    )}
                    <div className="nesmi-calendar-event-line">
                      {isCompleted ? (
                        <svg className="nesmi-calendar-event-check" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 16 16" aria-label="Completed"><path d="m3 8 3 3 7-7" /></svg>
                      ) : (
                        <span className="nesmi-calendar-dot" style={{ backgroundColor: memberColor }} aria-hidden="true" />
                      )}
                      <span className="nesmi-calendar-event-title" title={arg.event.title}>{arg.event.title}</span>
                      {priority === 'high' && <span className="nesmi-calendar-priority" title="High priority" aria-label="High priority">!</span>}
                    </div>
                    {!isMonth && assigneeName && <span className="nesmi-calendar-event-assignee">{assigneeName}</span>}
                  </div>
                );
              }}
            />
          </div>
        </section>

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
