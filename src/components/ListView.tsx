import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useApp } from '../context/AppContext';
import { generateChoreInstances, getCalendarRange } from '../utils/recurrence';
import { dateKey, parseDate, shiftDate, formatDay } from '../utils/dates';
import { Chore, ChoreInstance } from '../types';
import { CompletionDialog } from './CompletionDialog';
import { ChoicePicker } from './ChoicePicker';
import { ChoreEditor, type ChoreEditorHandle } from './ChoreModal';
import { ChoreTaskRow, ChoreActionsSheet } from './ChoreTaskRow';
import { DeleteChoreDialog } from './DeleteChoreDialog';
import { useInteractionMode } from '../hooks/useInteractionMode';

interface Props {
  onAddClick: () => void;
  onEventClick: (chore: Chore, date: string) => void;
  searchQuery?: string;
  hiddenMembers?: Set<string>;
  todayView?: boolean;
  homeView?: boolean;
  onChatClick?: () => void;
  onManageFamily?: () => void;
  onClearFilters?: () => void;
  editorRef?: RefObject<ChoreEditorHandle>;
}
const noHiddenMembers = new Set<string>();

export function ListView({onAddClick, searchQuery='', hiddenMembers=noHiddenMembers, todayView=false, homeView=false, onChatClick, onManageFamily, onClearFilters, editorRef: externalEditorRef}: Props) {
  const {state} = useApp();
  const requestedMode = useInteractionMode();
  const [mode, setMode] = useState(requestedMode);
  const localEditorRef = useRef<ChoreEditorHandle>(null);
  const editorRef = externalEditorRef || localEditorRef;
  const [editing, setEditing] = useState<ChoreInstance | null>(null);
  const [actions, setActions] = useState<ChoreInstance | null>(null);
  const [deleting, setDeleting] = useState<ChoreInstance | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const pageRef = useRef<HTMLElement>(null);
  const restoreFocusAfterRender = useRef(false);
  const transition = (action: () => void) => editorRef.current ? editorRef.current.requestTransition(action) : action();
  const closeEditor = () => {restoreFocusAfterRender.current=true;setEditing(null);};
  useLayoutEffect(() => {
    if(!restoreFocusAfterRender.current || editing || actions || deleting)return;
    restoreFocusAfterRender.current=false;
    // A resumed navigation/global-create action owns its own focus.
    if(document.querySelector('[aria-modal="true"]'))return;
    const trigger=returnFocus.current;
    const target=trigger?.isConnected && !trigger.closest('[hidden],details:not([open])') ? trigger : pageRef.current?.querySelector<HTMLElement>('h2,.chore-task-body');
    if(target){if(!target.matches('button,input'))target.tabIndex=-1;target.focus({preventScroll:true});}
  });
  useEffect(() => {
    if (requestedMode !== mode) transition(() => {setActions(null);setMode(requestedMode);});
    // Retry only for a newly requested mode; Keep editing deliberately retains the current experience.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedMode]);
  useEffect(()=>{if(!editing&&requestedMode!==mode)setMode(requestedMode);},[editing,requestedMode,mode]);
  function edit(instance: ChoreInstance) {
    if(editing?.id === instance.id) {document.getElementById('chore-title')?.focus();return;}
    const trigger=document.activeElement as HTMLElement;
    transition(() => {if(!actions)returnFocus.current=trigger;setActions(null);setEditing(instance);});
  }
  function showActions(instance: ChoreInstance) {
    const trigger=document.activeElement as HTMLElement;
    transition(() => {returnFocus.current=trigger;setActions(instance);});
  }
  function requestDelete(instance: ChoreInstance) {const trigger=document.activeElement as HTMLElement;transition(() => {if(!actions)returnFocus.current=trigger;setDeleting(instance);});}

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
  const clearFilters = () => transition(() => {setWho('everyone'); setFilter('all'); onClearFilters?.();});
  const selectedDate = parseDate(selected);
  const monday = shiftDate(selected, -((selectedDate.getDay() + 6) % 7));
  const week = Array.from({length: 7}, (_, index) => shiftDate(monday, index));
  const groups = todayView ? [
    {name: 'Overdue', items: display.filter(instance => !instance.isCompleted && instance.date < today && selected === today)},
    {name: selected === today ? 'Up for today' : formatDay(selected), items: display.filter(instance => !instance.isCompleted && instance.date === selected)},
    {name: 'Done', items: display.filter(instance => instance.isCompleted && instance.date === selected)},
  ] : [{name: query ? 'Search results · all dates' : 'Your chores', items: display}];

  const row = (instance: ChoreInstance) => {
    const chore = choresById.get(instance.choreId);
    if(!chore)return null;
    const category = instance.categoryId ? categoriesById.get(instance.categoryId) : undefined;
    return <ChoreTaskRow key={instance.id} chore={chore} instance={instance} category={category} mode={mode} actionsOpen={actions?.id===instance.id}
      onEdit={()=>edit(instance)} onDelete={()=>requestDelete(instance)} onActions={()=>showActions(instance)} onComplete={()=>transition(()=>setCompleting(instance))}>
      {editing?.id === instance.id && <ChoreEditor key={instance.id} ref={editorRef} presentation={mode === 'web' ? 'inline' : 'sheet'} editChore={chore} instanceDate={instance.date} onClose={closeEditor}/>}
    </ChoreTaskRow>;
  };
  const actionsChore = actions ? choresById.get(actions.choreId) : null;
  const deletingChore = deleting ? choresById.get(deleting.choreId) : null;

  return <section ref={pageRef} className={'chore-list-page'+(homeView?' nesmi-home':'')}>
    {!todayView&&<h2>Chores</h2>}{todayView && <>
      <div className="today-intro"><div><p>{selectedDate.toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric'})}</p><h2>{selected === today ? 'Today' : formatDay(selected)}</h2></div>{!homeView&&<button className="today-add chore-button primary" aria-label="Add new chore" onClick={onAddClick}><span aria-hidden="true">+</span><span className="today-add-label">Add chore</span></button>}</div>
      <div className="chore-day-tools"><div className="chore-day-summary" aria-label="Selected day progress">
        <div className="chore-summary-line"><p><strong>{doneCount}</strong> of {dayInstances.length} done{who !== 'everyone' || hiddenMembers.size > 0 ? ' · selected members' : ''}</p>{!homeView && pendingMinutes > 0 && <p className="chore-summary-estimate"><strong>~{pendingMinutes} min</strong><span> remaining</span></p>}</div>
        <progress className="chore-progress" value={doneCount} max={dayInstances.length || 1} aria-label={`${doneCount} of ${dayInstances.length} chores completed on ${formatDay(selected)}`}/>
        {homeView&&<div className="nesmi-home-cues" role="group" aria-label="Chore status"><span><strong>{pendingDay.length}</strong> pending today</span><span><strong>{overdue.length}</strong> overdue</span></div>}
        {!homeView && pendingMinutes > 0 && <p className="chore-summary-minute-note">{estimatedPending.length === pendingDay.length ? 'Based on your chore estimates.' : `Estimates set for ${estimatedPending.length} of ${pendingDay.length} remaining chores.`}</p>}
      </div>
      {!homeView&&<div className="chore-week"><div className="week-heading"><button className="touch-button" aria-label="Previous week" onClick={() => transition(() => setSelected(shiftDate(selected, -7)))}>‹</button><strong>{selectedDate.toLocaleDateString('en-US', {month: 'long', year: 'numeric'})}</strong><button className="week-today" onClick={() => transition(() => setSelected(today))}>Today</button><button className="touch-button" aria-label="Next week" onClick={() => transition(() => setSelected(shiftDate(selected, 7)))}>›</button></div><div className="week-days">{week.map(date => <button key={date} className={date === selected ? 'selected' : ''} onClick={() => transition(() => setSelected(date))} aria-label={parseDate(date).toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric'})} aria-pressed={date === selected}><small>{parseDate(date).toLocaleDateString('en-US', {weekday: 'narrow'})}</small><b>{parseDate(date).getDate()}</b><span className={instances.some(instance => instance.date === date) ? 'has-chores' : ''}/></button>)}</div></div>}
    </div></>}
    {homeView&&<>
      <button className="nesmi-home-agent" onClick={onChatClick}><span><strong>Chore assistant</strong><small>Simple commands for your chores</small></span><span aria-hidden="true">↗</span></button>
    </>}
    {homeView&&hasFilters&&<div className="nesmi-active-filters"><span>Showing filtered chores</span><button className="chore-filter-reset" onClick={clearFilters}>Clear filters</button></div>}
    {homeView&&!state.teamMembers.length&&onManageFamily&&<button className="nesmi-family-setup chore-button secondary" onClick={onManageFamily}>Set up family</button>}
    <details className="nesmi-view-options" open={homeView?undefined:true}><summary>{homeView?'Filter chores':'Filters'}</summary><div className="chore-list-filters">{homeView&&pendingMinutes>0&&<p className="chore-muted">~{pendingMinutes} min remaining · estimates for {estimatedPending.length} of {pendingDay.length} pending chores.</p>}<ChoicePicker className="chore-input" label="Filter by family member" value={who} onChange={value=>transition(()=>setWho(value))} options={[{id: 'everyone', label: 'Everyone'}, {id: 'unassigned', label: 'Unassigned'}, ...state.teamMembers.map(member => ({id: member.id, label: member.name}))]}/>{!todayView && <ChoicePicker className="chore-input" label="Completion status" value={filter} onChange={value=>transition(()=>setFilter(value))} options={[{id: 'all', label: 'All statuses'}, {id: 'pending', label: 'Not done'}, {id: 'completed', label: 'Completed'}]}/>}<span className="chore-muted">{display.length} {display.length === 1 ? 'chore' : 'chores'}{query && todayView ? ' · this day + overdue' : ''}</span>{hasFilters && <button className="chore-filter-reset" onClick={clearFilters}>Clear filters</button>}</div></details>
    {display.length === 0 ? <div className="chore-empty"><h3>{query ? 'No matching chores' : hasFilters ? 'No chores match these filters.' : state.chores.length ? 'A little breathing room.' : 'Start with one small chore.'}</h3><p>{hasFilters ? 'Clear your filters to see the chores in this view.' : state.chores.length ? 'Nothing to do in this view.' : 'Add what needs doing. Assign it now, or decide later.'}</p>{hasFilters ? <button className="chore-button secondary" onClick={clearFilters}>Clear filters</button> : <p className="chore-muted">Use the + below to add a chore.</p>}</div> : groups.filter(group => group.items.length).map(group => group.name === 'Done' ? <details className="chore-task-group" key={group.name}><summary>Done <span>{group.items.length}</span></summary>{group.items.map(row)}</details> : <div className="chore-task-group" key={group.name}><h3>{group.name} <span>{group.items.length}</span></h3>{group.items.map(row)}</div>)}
    {actions && actionsChore && <ChoreActionsSheet chore={actionsChore} instance={actions} category={actions.categoryId ? categoriesById.get(actions.categoryId) : undefined} onClose={()=>setActions(null)} onEdit={()=>edit(actions)} onDelete={()=>requestDelete(actions)}/>}
    {deleting && deletingChore && <DeleteChoreDialog chore={deletingChore} onClose={()=>setDeleting(null)} onDeleted={()=>{restoreFocusAfterRender.current=true;setDeleting(null);setActions(null);}}/>}
    {completing && <CompletionDialog instance={completing} onClose={() => setCompleting(null)}/>}
  </section>;
}
