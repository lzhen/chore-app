import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { generateChoreInstances, getCalendarRange } from '../utils/recurrence';
import { dateKey, parseDate, shiftDate, formatDay } from '../utils/dates';
import { Chore, ChoreInstance } from '../types';
import { CompletionDialog } from './CompletionDialog';

interface Props {
  onAddClick: () => void;
  onEventClick: (chore: Chore, date: string) => void;
  onCalendarClick: () => void;
  onFamilyClick: () => void;
  searchQuery?: string;
  hiddenMembers?: Set<string>;
  todayView?: boolean;
}

export function ListView({ onAddClick, onEventClick, onCalendarClick, onFamilyClick, searchQuery = '', hiddenMembers = new Set(), todayView = false }: Props) {
  const { state } = useApp();
  const today = dateKey();
  const [selected, setSelected] = useState(today);
  const [who, setWho] = useState('everyone');
  const [history, setHistory] = useState(false);
  const [completing, setCompleting] = useState<ChoreInstance | null>(null);
  const instances = useMemo(() => {
    const { start, end } = getCalendarRange();
    const selectedDate = parseDate(selected);
    if (selectedDate < start) start.setTime(selectedDate.getTime());
    if (selectedDate > end) end.setTime(selectedDate.getTime());
    // Expand each chore separately so an old one-off never widens every routine's range.
    return state.chores.flatMap(c => {
      const day = parseDate(c.date);
      const choreStart = c.recurrence === 'none' ? day : start;
      const choreEnd = c.recurrence === 'none' || day > end ? day : end;
      return generateChoreInstances([c], state.teamMembers, state.completions, choreStart, choreEnd);
    });
  }, [state.chores, state.teamMembers, state.completions, selected]);
  const query = searchQuery.trim().toLowerCase();
  const matches = (i: ChoreInstance) => !hiddenMembers.has(i.assigneeId || '') &&
    (who === 'everyone' || (who === 'unassigned' ? !i.assigneeId : i.assigneeId === who)) &&
    (!query || [i.title, i.description, i.assigneeName].some(s => s?.toLowerCase().includes(query)));
  const filtered = instances.filter(matches).sort((a, b) => a.date.localeCompare(b.date) || (a.dueTime || '').localeCompare(b.dueTime || ''));
  const selectedItems = filtered.filter(i => i.date === selected);
  const done = selectedItems.filter(i => i.isCompleted).length;
  const overdue = selected === today ? filtered.filter(i => !i.isCompleted && !i.isRecurring && i.date < today) : [];

  // The management view represents each stored chore once, using its next unfinished date.
  const active = state.chores.flatMap(c => {
    const dates = filtered.filter(i => i.choreId === c.id && !i.isCompleted && (c.recurrence === 'none' || i.date >= today));
    return dates.length ? [dates[0]] : [];
  }).sort((a, b) => a.date.localeCompare(b.date));
  // History is driven by saved completion records, not thousands of generated future dates.
  const completedHistory = [...state.completions].sort((a, b) => b.instanceDate.localeCompare(a.instanceDate) || b.completedAt.localeCompare(a.completedAt)).flatMap(completion => {
    const c = state.chores.find(c => c.id === completion.choreId);
    if (!c) return [];
    const member = state.teamMembers.find(m => m.id === completion.completedBy);
    const i: ChoreInstance = { ...c, id: completion.id, choreId: c.id, date: completion.instanceDate, assigneeId: completion.completedBy, isRecurring: c.recurrence !== 'none', isCompleted: true, assigneeName: member?.name, color: member?.color || '#777' };
    return matches(i) ? [i] : [];
  });
  const groups = todayView ? [
    { name: selected === today ? 'Today' : formatDay(selected), items: selectedItems.filter(i => !i.isCompleted) },
    { name: 'Needs attention', items: overdue },
    { name: 'Done', items: selectedItems.filter(i => i.isCompleted) },
  ] : history ? [{ name: 'Completion history', items: completedHistory }] : [
    { name: 'Needs attention', items: active.filter(i => i.date < today) },
    { name: 'Today', items: active.filter(i => i.date === today) },
    { name: 'Upcoming', items: active.filter(i => i.date > today) },
  ];
  const displayCount = groups.reduce((sum, g) => sum + g.items.length, 0);
  const selectedDate = parseDate(selected);
  const monday = shiftDate(selected, -((selectedDate.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
  const repeatLabel = (id: string) => ({ daily: 'Every day', weekly: 'Every week', monthly: 'Every month', none: '' })[state.chores.find(c => c.id === id)?.recurrence || 'none'];
  const row = (i: ChoreInstance) => <article key={i.id} className={`chore-task${i.isCompleted ? ' is-done' : ''}`}>
    <button className="chore-check" aria-label={`${i.isCompleted ? 'Undo completion' : 'Complete'}: ${i.title}`} aria-pressed={i.isCompleted} onClick={() => setCompleting(i)}><span aria-hidden="true">{i.isCompleted ? '✓' : ''}</span></button>
    <button className="chore-task-body" onClick={() => { const c = state.chores.find(c => c.id === i.choreId); if (c) onEventClick(c, i.date); }} aria-label={`Edit ${i.title}`}>
      <strong>{i.title}</strong><span className="chore-task-meta"><span className="member-dot" style={{ backgroundColor: i.color }} />{history && !todayView ? `Completed by ${i.assigneeName || 'former member'}` : i.assigneeName || 'Unassigned'} · {formatDay(i.date)}{i.dueTime && ` · ${i.dueTime}${i.endTime ? '–' + i.endTime : ''}`}{i.isRecurring && ` · ${repeatLabel(i.choreId)}`}</span>
    </button>
    {i.priority === 'high' && !i.isCompleted && <span className="priority-label">High</span>}
  </article>;

  return <section className="chore-list-page">
    <header className="chore-page-heading">
      <p className="chore-eyebrow">{todayView ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'A place for every responsibility'}</p>
      <h1>{todayView ? 'Today' : 'Chores'}</h1>
      <p>{todayView ? 'A lighter day, together.' : 'Your chores and routines, without the repetition.'}</p>
    </header>
    {todayView ? <>
      <div className="chore-week">
        <div className="week-heading"><button className="touch-button" aria-label="Previous week" onClick={() => setSelected(shiftDate(selected, -7))}>‹</button><strong>{selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong><button className="week-today" onClick={() => setSelected(today)}>Today</button><button className="touch-button" aria-label="Next week" onClick={() => setSelected(shiftDate(selected, 7))}>›</button></div>
        <div className="week-days">{week.map(d => <button key={d} className={d === selected ? 'selected' : ''} onClick={() => setSelected(d)} aria-label={parseDate(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} aria-pressed={d === selected}><small>{parseDate(d).toLocaleDateString('en-US', { weekday: 'short' })}</small><b>{parseDate(d).getDate()}</b><span className={instances.some(i => i.date === d) ? 'has-chores' : ''} /></button>)}</div>
      </div>
      <div className="chore-progress"><span aria-label="Daily progress">{done} of {selectedItems.length} done</span><span>{selectedItems.length - done} remaining</span><progress value={done} max={selectedItems.length || 1} aria-label="Chores completed on selected day" /></div>
    </> : <div className="chore-segment" aria-label="Chore records"><button aria-pressed={!history} onClick={() => setHistory(false)}>Active chores</button><button aria-pressed={history} onClick={() => setHistory(true)}>Completion history</button></div>}
    <div className="chore-list-filters"><label><span className="sr-only">Filter by family member</span><select className="chore-input" value={who} onChange={e => setWho(e.target.value)}><option value="everyone">Everyone</option><option value="unassigned">Unassigned</option>{state.teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><span className="chore-muted">{displayCount} {history ? 'records' : displayCount === 1 ? 'chore' : 'chores'}</span></div>
    {!todayView && !history && <p className="chore-management-note chore-muted">One row per chore or routine. <button onClick={onCalendarClick}>View individual dates in Calendar →</button></p>}
    {displayCount === 0 ? <div className="chore-empty"><h2>{query ? 'No matching chores' : history ? 'Your progress starts here.' : state.chores.length ? 'A little breathing room.' : 'Start with one small chore.'}</h2><p>{query ? 'Try another search or change your filters.' : history ? 'Completed chores will appear here, with their original dates.' : state.chores.length ? 'Nothing to do in this view.' : 'Add what needs doing. Assign it now, or decide later.'}</p>{!query && !history && <button className="chore-button primary" onClick={onAddClick}>Add a chore</button>}{!state.teamMembers.length && !query && !history && <button className="chore-button secondary" onClick={onFamilyClick}>Add family members</button>}</div> : groups.filter(g => g.items.length).map(g => g.name === 'Done' ? <details className="chore-task-group" key={g.name}><summary>Done <span>{g.items.length}</span></summary>{g.items.map(row)}</details> : <div className="chore-task-group" key={g.name}><h2>{g.name} <span>{g.items.length}</span></h2>{g.name === 'Needs attention' && <p className="chore-muted">Past due · open a chore to reschedule it.</p>}{g.items.map(row)}</div>)}
    {todayView && selected === today && state.chores.some(c => c.recurrence !== 'none' && c.date < today) && <details className="chore-past-routines"><summary>Earlier routine dates</summary><p className="chore-muted">Past repeating dates are kept in Calendar. Completing today leaves earlier dates unchanged.</p><button className="chore-button secondary" onClick={onCalendarClick}>Open Calendar</button></details>}
    {completing && <CompletionDialog instance={completing} onClose={() => setCompleting(null)} />}
  </section>;
}
