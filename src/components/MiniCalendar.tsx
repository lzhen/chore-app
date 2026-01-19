import { useState, useMemo } from 'react';

interface MiniCalendarProps {
  onDateSelect: (date: Date) => void;
  eventDates?: Set<string>; // Set of date strings (YYYY-MM-DD) that have events
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function MiniCalendar({ onDateSelect, eventDates = new Set() }: MiniCalendarProps) {
  const [viewDate, setViewDate] = useState(new Date());

  // Get the days to display for the current month view
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Start from the Sunday before or on the first day
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // End on the Saturday after or on the last day
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    const days: { date: Date; isCurrentMonth: boolean; isToday: boolean; hasEvents: boolean }[] = [];
    const current = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      days.push({
        date: new Date(current),
        isCurrentMonth: current.getMonth() === month,
        isToday: current.getTime() === today.getTime(),
        hasEvents: eventDates.has(dateStr),
      });
      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [viewDate, eventDates]);

  const navigateMonth = (delta: number) => {
    setViewDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + delta);
      return newDate;
    });
  };

  const goToToday = () => {
    const today = new Date();
    setViewDate(today);
    onDateSelect(today);
  };

  const formatMonthYear = () => {
    return viewDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  };

  return (
    <div className="mini-calendar p-3 bg-surface-secondary rounded-fluent-md border border-border">
      {/* Header with navigation */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => navigateMonth(-1)}
          className="p-1 text-content-secondary hover:text-content-primary hover:bg-subtle-background-hover rounded-fluent-sm transition-all"
          aria-label="Previous month"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={goToToday}
          className="text-xs font-medium text-content-primary hover:text-accent transition-colors"
        >
          {formatMonthYear()}
        </button>

        <button
          onClick={() => navigateMonth(1)}
          className="p-1 text-content-secondary hover:text-content-primary hover:bg-subtle-background-hover rounded-fluent-sm transition-all"
          aria-label="Next month"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAYS.map(day => (
          <div
            key={day}
            className="text-center text-[10px] font-medium text-content-secondary py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((day, index) => (
          <button
            key={index}
            onClick={() => onDateSelect(day.date)}
            className={`
              relative aspect-square flex items-center justify-center text-[11px] rounded-fluent-sm
              transition-all duration-fast
              ${day.isCurrentMonth ? 'text-content-primary' : 'text-content-secondary opacity-40'}
              ${day.isToday
                ? 'bg-accent text-white font-bold'
                : 'hover:bg-subtle-background-hover'
              }
            `}
          >
            {day.date.getDate()}
            {/* Event indicator dot */}
            {day.hasEvents && !day.isToday && (
              <span className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
            )}
          </button>
        ))}
      </div>

      {/* Today button */}
      <button
        onClick={goToToday}
        className="w-full mt-2 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 rounded-fluent-sm transition-all"
      >
        Today
      </button>
    </div>
  );
}
