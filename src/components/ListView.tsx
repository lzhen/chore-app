import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { generateChoreInstances, getCalendarRange } from '../utils/recurrence';
import { dateKey, parseDate, shiftDate, formatDay } from '../utils/dates';
import { Chore, ChoreInstance } from '../types';
import { CompletionDialog } from './CompletionDialog';
interface Props {onAddClick:()=>void;onEventClick:(chore:Chore,date:string)=>void;searchQuery?:string;hiddenMembers?:Set<string>;todayView?:boolean;}
export function ListView({onAddClick,onEventClick,searchQuery='',hiddenMembers=new Set(),todayView=false}:Props){
 const {state}=useApp();const today=dateKey();const [selected,setSelected]=useState(today);const [who,setWho]=useState('everyone');const [filter,setFilter]=useState('all');const [completing,setCompleting]=useState<ChoreInstance|null>(null);
 const instances=useMemo(()=>{
  const {start,end}=getCalendarRange();
  const selectedDate=parseDate(selected);if(selectedDate<start)start.setTime(selectedDate.getTime());if(selectedDate>end)end.setTime(selectedDate.getTime());
  // Retain older single tasks so overdue chores do not disappear after a month.
  state.chores.filter(c=>c.recurrence==='none').forEach(c=>{const d=parseDate(c.date);if(d<start)start.setTime(d.getTime());if(d>end)end.setTime(d.getTime());});
  return generateChoreInstances(state.chores,state.teamMembers,state.completions,start,end);
 },[state.chores,state.teamMembers,state.completions,selected]);
 const matches=instances.filter(i=>!hiddenMembers.has(i.assigneeId||'')&&(who==='everyone'||(who==='unassigned'?!i.assigneeId:i.assigneeId===who))&&(!searchQuery||[i.title,i.description,i.assigneeName].some(s=>s?.toLowerCase().includes(searchQuery.trim().toLowerCase())))&&(filter==='all'||(filter==='completed'?i.isCompleted:!i.isCompleted))).sort((a,b)=>a.date.localeCompare(b.date)||(a.dueTime||'').localeCompare(b.dueTime||''));
 const selectedDate=parseDate(selected);const monday=shiftDate(selected,-((selectedDate.getDay()+6)%7));const week=Array.from({length:7},(_,i)=>shiftDate(monday,i));
 const display=todayView&&!searchQuery?matches.filter(i=>i.date===selected||(!i.isCompleted&&i.date<today&&selected===today)):matches;
 const groups=todayView&&!searchQuery?[
  {name:'Needs a little attention',items:display.filter(i=>!i.isCompleted&&i.date<today&&selected===today)},
  {name:selected===today?'Up for today':formatDay(selected),items:display.filter(i=>!i.isCompleted&&i.date===selected)},
  {name:'Done',items:display.filter(i=>i.isCompleted&&i.date===selected)},
 ]:[{name:searchQuery?'Search results':'Your chores',items:display}];
 const row=(i:ChoreInstance)=><article key={i.id} className={'chore-task'+(i.isCompleted?' is-done':'')}>
  <button className="chore-check" aria-label={`${i.isCompleted?'Undo completion':'Complete'}: ${i.title}`} aria-pressed={i.isCompleted} onClick={()=>setCompleting(i)}><span aria-hidden="true">{i.isCompleted?'✓':''}</span></button>
  <button className="chore-task-body" onClick={()=>{const c=state.chores.find(c=>c.id===i.choreId);if(c)onEventClick(c,i.date);}} aria-label={`Edit ${i.title}`}><strong>{i.title}</strong><span className="chore-task-meta"><span className="member-dot" style={{backgroundColor:i.color}}/>{i.assigneeName||'Unassigned'} · {formatDay(i.date)}{i.dueTime&&` · ${i.dueTime}${i.endTime?'–'+i.endTime:''}`}{i.isRecurring&&' · Repeats'}</span></button>
  {i.priority==='high'&&!i.isCompleted&&<span className="priority-label">High</span>}
 </article>;
 return <section className="chore-list-page">
 {todayView&&<><div className="today-intro"><p>A LITTLE LESS TO REMEMBER</p><h2>A good day, together.</h2><span>See what needs doing, and who’s taking care of it.</span></div>
 <div className="chore-week"><div className="week-heading"><button className="touch-button" aria-label="Previous week" onClick={()=>setSelected(shiftDate(selected,-7))}>‹</button><strong>{selectedDate.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</strong><button className="week-today" onClick={()=>setSelected(today)}>Today</button><button className="touch-button" aria-label="Next week" onClick={()=>setSelected(shiftDate(selected,7))}>›</button></div><div className="week-days">{week.map(d=><button key={d} className={d===selected?'selected':''} onClick={()=>setSelected(d)} aria-label={parseDate(d).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})} aria-pressed={d===selected}><small>{parseDate(d).toLocaleDateString('en-US',{weekday:'narrow'})}</small><b>{parseDate(d).getDate()}</b><span className={instances.some(i=>i.date===d)?'has-chores':''}/></button>)}</div></div></>}
 <div className="chore-list-filters"><label><span className="sr-only">Filter by family member</span><select className="chore-input" value={who} onChange={e=>setWho(e.target.value)}><option value="everyone">Everyone</option><option value="unassigned">Unassigned</option>{state.teamMembers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>{!todayView&&<label><span className="sr-only">Completion status</span><select className="chore-input" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All statuses</option><option value="pending">Not done</option><option value="completed">Completed</option></select></label>}<span className="chore-muted">{display.length} {display.length===1?'chore':'chores'}</span></div>
 {display.length===0?<div className="chore-empty"><h3>{searchQuery?'No matching chores':state.chores.length?'A little breathing room.':'Start with one small chore.'}</h3><p>{searchQuery?'Try another search or change your filters.':state.chores.length?'Nothing to do in this view.':'Add what needs doing. Assign it now, or decide later.'}</p>{!searchQuery&&<button className="chore-button primary" onClick={onAddClick}>Add a chore</button>}</div>:groups.filter(g=>g.items.length).map(g=>g.name==='Done'?<details className="chore-task-group" key={g.name}><summary>Done <span>{g.items.length}</span></summary>{g.items.map(row)}</details>:<div className="chore-task-group" key={g.name}><h3>{g.name} <span>{g.items.length}</span></h3>{g.name==='Needs a little attention'&&<p className="chore-muted">Overdue · open a chore to reschedule it.</p>}{g.items.map(row)}</div>)}
 {completing&&<CompletionDialog instance={completing} onClose={()=>setCompleting(null)}/>}
 </section>;
}
