import {forwardRef,useImperativeHandle,useMemo,useState} from 'react';
import type {CalendarRef} from './Calendar';
import type {Chore,ChoreInstance} from '../types';
import {useApp} from '../context/AppContext';
import {dateKey,parseDate,shiftDate} from '../utils/dates';
import {generateChoreInstances} from '../utils/recurrence';
import {CompletionDialog} from './CompletionDialog';
interface Props {onAddClick:(values?:{date?:string})=>void;onEventClick:(chore:Chore,date:string)=>void;searchQuery?:string;hiddenMembers?:Set<string>}
export const MobileCalendar=forwardRef<CalendarRef,Props>(({onAddClick,onEventClick,searchQuery='',hiddenMembers=new Set()},ref)=>{
 const {state}=useApp();const [selected,setSelected]=useState(dateKey());const [month,setMonth]=useState(dateKey());const [completing,setCompleting]=useState<ChoreInstance|null>(null);
 const anchor=parseDate(month);const year=anchor.getFullYear(),monthIndex=anchor.getMonth();
 const select=(date:Date)=>{setSelected(dateKey(date));setMonth(dateKey(date));};
 const navigate=(delta:number)=>select(new Date(year,monthIndex+delta,1,12));
 useImperativeHandle(ref,()=>({gotoDate:select,today:()=>select(new Date()),next:()=>navigate(1),prev:()=>navigate(-1),changeView:()=>{}}));
 const first=new Date(year,monthIndex,1,12),last=new Date(year,monthIndex+1,0,12);
 const start=shiftDate(dateKey(first),-first.getDay()),end=shiftDate(dateKey(last),6-last.getDay());
 const instances=useMemo(()=>generateChoreInstances(state.chores,state.teamMembers,state.completions,parseDate(start),parseDate(end)),[state.chores,state.teamMembers,state.completions,start,end]);
 const visible=instances.filter(i=>(!i.assigneeId||!hiddenMembers.has(i.assigneeId))&&(!searchQuery||[i.title,i.description,i.assigneeName].some(t=>t?.toLowerCase().includes(searchQuery.toLowerCase()))));
 const eventDates=new Set(visible.map(i=>i.date));const days:string[]=[];for(let d=start;d<=end;d=shiftDate(d,1))days.push(d);
 const tasks=visible.filter(i=>i.date===selected).sort((a,b)=>Number(a.isCompleted)-Number(b.isCompleted)||(a.dueTime||'').localeCompare(b.dueTime||''));
 return <section className="nesmi-mobile-calendar" aria-label="Calendar">
  <div className="nesmi-month-toolbar"><h2 aria-live="polite">{first.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</h2><button className="touch-button" onClick={()=>select(new Date())}>Today</button><button className="touch-button" aria-label="Previous month" onClick={()=>navigate(-1)}>‹</button><button className="touch-button" aria-label="Next month" onClick={()=>navigate(1)}>›</button></div>
  <div className="nesmi-month-weekdays" aria-hidden="true">{['S','M','T','W','T','F','S'].map((d,i)=><span key={i}>{d}</span>)}</div>
  <div className="nesmi-month-grid" aria-label="Choose a date">{days.map(d=><button key={d} aria-label={parseDate(d).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})} aria-pressed={d===selected} aria-current={d===dateKey()?'date':undefined} className={`${d.slice(0,7)!==dateKey(first).slice(0,7)?'outside-month ':''}${d===dateKey()?'is-today ':''}`} onClick={()=>select(parseDate(d))}><span>{parseDate(d).getDate()}</span>{eventDates.has(d)&&<i aria-hidden="true"/>}</button>)}</div>
  <div className="nesmi-day-tasks"><h3>{parseDate(selected).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}</h3>
  {tasks.length===0?<div className="nesmi-day-empty"><p>{searchQuery?'No matching chores on this date.':'No chores on this date.'}</p><button className="chore-button secondary" onClick={()=>onAddClick({date:selected})}>Add chore</button></div>:tasks.map(i=><article className={`chore-task${i.isCompleted?' is-done':''}`} key={i.id}>
   {!i.isCompleted&&<button className="chore-check" aria-label={`Complete: ${i.title}`} onClick={()=>setCompleting(i)}><span aria-hidden="true"/></button>}
   <button className="chore-task-body" aria-label={`Edit ${i.title}`} onClick={()=>{const chore=state.chores.find(c=>c.id===i.choreId);if(chore)onEventClick(chore,i.date);}}><strong className="chore-task-title">{i.title}</strong><span className="chore-task-meta">{i.dueTime?`${i.dueTime}${i.endTime?'–'+i.endTime:''}`:'All day'} · {i.assigneeName||'Unassigned'}</span></button>
  </article>)}
  </div>{completing&&<CompletionDialog instance={completing} onClose={()=>setCompleting(null)}/>}
 </section>;
});
MobileCalendar.displayName='MobileCalendar';
