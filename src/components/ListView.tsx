import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { generateChoreInstances, getCalendarRange } from '../utils/recurrence';
import { dateKey, parseDate, shiftDate, formatDay } from '../utils/dates';
import { Chore, ChoreInstance } from '../types';
import { CompletionDialog } from './CompletionDialog';

interface Props {
  onAddClick: () => void;
  onEventClick: (chore: Chore, date: string) => void;
  searchQuery?: string;
  hiddenMembers?: Set<string>;
  todayView?: boolean;
  onClearFilters?: () => void;
}
const noHiddenMembers = new Set<string>();

export function ListView({onAddClick, onEventClick, searchQuery='', hiddenMembers=noHiddenMembers, todayView=false, onClearFilters}: Props) {
  const {state} = useApp();
  const today = dateKey();
  const [selected, setSelected] = useState(today);
  const [who, setWho] = useState('everyone');
  const [filter, setFilter] = useState('all');
  const [completing, setCompleting] = useState<ChoreInstance | null>(null);
  const choresById = useMemo(() => new Map(state.chores.map(chore => [chore.id, chore])), [state.chores]);
  const categoriesById = useMemo(() => new Map(state.categories.map(category => [category.id, category])), [state.categories]);

  const instances = useMemo(() => {
    const {start, end} = getCalendarRange();
    const selectedDate = parseDate(selected);
    if (selectedDate < start || selectedDate > end) {
      start.setTime(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1).getTime());
      end.setTime(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 4, 0).getTime());
    }
    // Keep old one-off chores without spending the recurrence limit on past years.
    const singleChores = state.chores.filter(chore => chore.recurrence === 'none');
    const singleStart = new Date(start);
    const singleEnd = new Date(end);
    singleChores.forEach(chore => {
      const date = parseDate(chore.date);
      if (date < singleStart) singleStart.setTime(date.getTime());
      if (date > singleEnd) singleEnd.setTime(date.getTime());
    });
    return [
      ...generateChoreInstances(state.chores.filter(chore => chore.recurrence !== 'none'), state.teamMembers, state.completions, start, end),
      ...generateChoreInstances(singleChores, state.teamMembers, state.completions, singleStart, singleEnd),
    ];
  }, [state.chores, state.teamMembers, state.completions, selected]);

  const memberInstances = instances.filter(instance =>
    !hiddenMembers.has(instance.assigneeId || '') &&
    (who === 'everyone' || (who === 'unassigned' ? !instance.assigneeId : instance.assigneeId === who))
  );
  const dayInstances = memberInstances.filter(instance => instance.date === selected);
  const doneCount = dayInstances.filter(instance => instance.isCompleted).length;
  const pendingDay = dayInstances.filter(instance => !instance.isCompleted);
  const overdue = selected === today ? memberInstances.filter(instance => !instance.isCompleted && instance.date < today) : [];
  const estimatedPending = pendingDay.filter(instance => (choresById.get(instance.choreId)?.estimatedMinutes || 0) > 0);
  const pendingMinutes = estimatedPending.reduce((minutes, instance) => minutes + (choresById.get(instance.choreId)?.estimatedMinutes || 0), 0);
  const scopedInstances = todayView ? [...dayInstances, ...overdue] : memberInstances;
  const query = searchQuery.trim().toLowerCase();
  const display = scopedInstances.filter(instance =>
    (!query || [instance.title, instance.description, instance.assigneeName, instance.categoryId ? categoriesById.get(instance.categoryId)?.name : ''].some(value => value?.toLowerCase().includes(query))) &&
    (filter === 'all' || (filter === 'completed' ? instance.isCompleted : !instance.isCompleted))
  ).sort((a, b) => a.date.localeCompare(b.date) || (a.dueTime || '').localeCompare(b.dueTime || ''));
  const hasFilters = !!query || who !== 'everyone' || hiddenMembers.size > 0 || filter !== 'all';
  const clearFilters = () => {setWho('everyone'); setFilter('all'); onClearFilters?.();};
  const selectedDate = parseDate(selected);
  const monday = shiftDate(selected, -((selectedDate.getDay() + 6) % 7));
  const week = Array.from({length: 7}, (_, index) => shiftDate(monday, index));
  const groups = todayView ? [
    {name: selected === today ? 'Up for today' : formatDay(selected), items: display.filter(instance => !instance.isCompleted && instance.date === selected)},
    {name: 'Overdue', items: display.filter(instance => instance.date < today && selected === today)},
    {name: 'Done', items: display.filter(instance => instance.isCompleted && instance.date === selected)},
  ] : [{name: query ? 'Search results · all dates' : 'Your chores', items: display}];

  const row = (instance: ChoreInstance) => {
    const chore = choresById.get(instance.choreId);
    const category = instance.categoryId ? categoriesById.get(instance.categoryId) : undefined;
    const isOverdue = !instance.isCompleted && instance.date < today;
    return <article key={instance.id} className={'chore-task' + (instance.isCompleted ? ' is-done' : '') + (isOverdue ? ' is-overdue' : '')}>
      <button className="chore-check" aria-label={`${instance.isCompleted ? 'Undo completion' : 'Complete'}: ${instance.title}`} aria-pressed={instance.isCompleted} onClick={() => setCompleting(instance)}><span aria-hidden="true">{instance.isCompleted ? '✓' : ''}</span></button>
      <button className="chore-task-body" onClick={() => {if (chore) onEventClick(chore, instance.date);}} aria-label={`Edit ${instance.title}`}>
        <strong className="chore-task-title">{instance.title}</strong>
        <span className="chore-task-meta"><span className="member-dot" style={{backgroundColor: instance.color}}/>{instance.assigneeName || 'Unassigned'}<span aria-hidden="true"> · </span><span className="chore-task-date">{formatDay(instance.date)}{instance.dueTime && ` · ${instance.dueTime}${instance.endTime ? '–' + instance.endTime : ''}`}</span>{instance.isRecurring && <span> · Repeats</span>}</span>
        {(category || chore?.estimatedMinutes) && <span className="chore-task-details">{category?.name}{category && chore?.estimatedMinutes ? ' · ' : ''}{chore?.estimatedMinutes ? `${chore.estimatedMinutes} min` : ''}</span>}
      </button>
      {instance.priority === 'high' && !instance.isCompleted && <span className="priority-label">High</span>}
    </article>;
  };

  return <section className="chore-list-page">
    {todayView && <>
      <div className="today-intro"><div><p>{selectedDate.toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric'})}</p><h2>{selected === today ? 'Today' : formatDay(selected)}</h2></div><button className="today-add chore-button primary" aria-label="Add new chore" onClick={onAddClick}><span aria-hidden="true">+</span><span className="today-add-label">Add chore</span></button></div>
      <div className="chore-day-tools"><div className="chore-day-summary" aria-label="Selected day progress">
        <div className="chore-summary-line"><p><strong>{doneCount}</strong> of {dayInstances.length} done{who !== 'everyone' || hiddenMembers.size > 0 ? ' · selected members' : ''}</p>{pendingMinutes > 0 && <p className="chore-summary-estimate"><strong>~{pendingMinutes} min</strong><span> remaining</span></p>}</div>
        <progress className="chore-progress" value={doneCount} max={dayInstances.length || 1} aria-label={`${doneCount} of ${dayInstances.length} chores completed on ${formatDay(selected)}`}/>
        {pendingMinutes > 0 && <p className="chore-summary-minute-note">{estimatedPending.length === pendingDay.length ? 'Based on your chore estimates.' : `Estimates set for ${estimatedPending.length} of ${pendingDay.length} remaining chores.`}</p>}
      </div>
      <div className="chore-week"><div className="week-heading"><button className="touch-button" aria-label="Previous week" onClick={() => setSelected(shiftDate(selected, -7))}>‹</button><strong>{selectedDate.toLocaleDateString('en-US', {month: 'long', year: 'numeric'})}</strong><button className="week-today" onClick={() => setSelected(today)}>Today</button><button className="touch-button" aria-label="Next week" onClick={() => setSelected(shiftDate(selected, 7))}>›</button></div><div className="week-days">{week.map(date => <button key={date} className={date === selected ? 'selected' : ''} onClick={() => setSelected(date)} aria-label={parseDate(date).toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric'})} aria-pressed={date === selected}><small>{parseDate(date).toLocaleDateString('en-US', {weekday: 'narrow'})}</small><b>{parseDate(date).getDate()}</b><span className={instances.some(instance => instance.date === date) ? 'has-chores' : ''}/></button>)}</div></div>
    </div></>}
    <div className="chore-list-filters"><label><span className="sr-only">Filter by family member</span><select className="chore-input" value={who} onChange={event => setWho(event.target.value)}><option value="everyone">Everyone</option><option value="unassigned">Unassigned</option>{state.teamMembers.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>{!todayView && <label><span className="sr-only">Completion status</span><select className="chore-input" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All statuses</option><option value="pending">Not done</option><option value="completed">Completed</option></select></label>}<span className="chore-muted">{display.length} {display.length === 1 ? 'chore' : 'chores'}{query && todayView ? ' · this day + overdue' : ''}</span>{hasFilters && <button className="chore-filter-reset" onClick={clearFilters}>Clear filters</button>}</div>
    {display.length === 0 ? <div className="chore-empty"><h3>{query ? 'No matching chores' : hasFilters ? 'No chores match these filters.' : state.chores.length ? 'A little breathing room.' : 'Start with one small chore.'}</h3><p>{hasFilters ? 'Clear your filters to see the chores in this view.' : state.chores.length ? 'Nothing to do in this view.' : 'Add what needs doing. Assign it now, or decide later.'}</p>{hasFilters ? <button className="chore-button secondary" onClick={clearFilters}>Clear filters</button> : <button className="chore-button primary" onClick={onAddClick}>Add a chore</button>}</div> : groups.filter(group => group.items.length).map(group => group.name === 'Done' ? <details className="chore-task-group" key={group.name}><summary>Done <span>{group.items.length}</span></summary>{group.items.map(row)}</details> : <div className="chore-task-group" key={group.name}><h3>{group.name} <span>{group.items.length}</span></h3>{group.items.map(row)}</div>)}
    {completing && <CompletionDialog instance={completing} onClose={() => setCompleting(null)}/>}
  </section>;
}
