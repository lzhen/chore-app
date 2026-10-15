import {useLayoutEffect,useRef,useState} from 'react';
import {dateKey} from '../utils/dates';
import './DatePicker.css';
export function validDate(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T12:00:00');
 return !Number.isNaN(date.getTime())&&dateKey(date)===value;
}
export function DatePicker({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}){
 const [open,setOpen]=useState(false);
 const [active,setActive]=useState(value);
 const field=useRef<HTMLDivElement>(null);
 const trigger=useRef<HTMLButtonElement>(null),calendar=useRef<HTMLDivElement>(null);
 const selected=validDate(active)?new Date(active+'T12:00:00'):new Date();
 const year=selected.getFullYear(),month=selected.getMonth();
 const first=new Date(year,month,1).getDay(),count=new Date(year,month+1,0).getDate();
 const close=()=>{setOpen(false);trigger.current?.focus();};
 const move=(days:number)=>{const d=new Date(selected);d.setDate(d.getDate()+days);setActive(dateKey(d));};
 const moveMonth=(offset:number)=>{const d=new Date(year,month+offset,1);d.setDate(Math.min(selected.getDate(),new Date(year,month+offset+1,0).getDate()));setActive(dateKey(d));};
 useLayoutEffect(()=>{if(open)calendar.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus();},[open,active]);
 useLayoutEffect(()=>{
  if(!open)return;
  const outside=(event:Event)=>{if(!field.current?.contains(event.target as Node))setOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}};
  document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);document.addEventListener('keydown',escape);
  return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);document.removeEventListener('keydown',escape);};
 },[open]);
 return <div ref={field} className="nesmi-date-field">
  <label className="chore-label" htmlFor="chore-date">When?</label>
  <div className="nesmi-date-entry"><input id="chore-date" className="chore-input" type="text" autoComplete="off" placeholder="YYYY-MM-DD" aria-describedby="chore-date-format" value={value} disabled={disabled} required onChange={e=>onChange(e.target.value)}/><button ref={trigger} type="button" className="touch-button" aria-label="Choose date" aria-expanded={open} aria-controls="chore-calendar" disabled={disabled} onClick={()=>{if(open)close();else{setActive(validDate(value)?value:dateKey());setOpen(true);}}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/></svg></button></div>
  <small id="chore-date-format" className="chore-muted">YYYY-MM-DD</small>
  {open&&!disabled&&<div id="chore-calendar" className="nesmi-date-calendar" data-open-picker onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}}}>
   <header><button type="button" className="touch-button" aria-label="Previous month" onClick={()=>moveMonth(-1)}>‹</button><strong aria-live="polite">{selected.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</strong><button type="button" className="touch-button" aria-label="Next month" onClick={()=>moveMonth(1)}>›</button></header>
   <div className="nesmi-date-week" aria-hidden="true">{['Su','Mo','Tu','We','Th','Fr','Sa'].map(day=><span key={day}>{day}</span>)}</div>
   <div ref={calendar} className="nesmi-date-grid" role="group" aria-label="Calendar dates" onKeyDown={e=>{const offset:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};if(e.key in offset){e.preventDefault();move(offset[e.key]);}else if(e.key==='Home'||e.key==='End'){e.preventDefault();move(e.key==='Home'?-selected.getDay():6-selected.getDay());}else if(e.key==='PageUp'||e.key==='PageDown'){e.preventDefault();moveMonth(e.key==='PageUp'?-1:1);}}}>
   {Array.from({length:first},(_,i)=><span key={'blank'+i}/>)}
   {Array.from({length:count},(_,i)=>{const d=new Date(year,month,i+1),key=dateKey(d);return <button key={key} type="button" tabIndex={key===dateKey(selected)?0:-1} aria-label={d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})} aria-pressed={key===value} aria-current={key===dateKey()?'date':undefined} onClick={()=>{onChange(key);close();}}>{i+1}</button>;})}
   </div>
   <footer><button type="button" className="chore-button secondary" onClick={()=>{onChange(dateKey());close();}}>Today</button><button type="button" className="chore-button secondary" onClick={close}>Close calendar</button></footer>
  </div>}
 </div>;
}
