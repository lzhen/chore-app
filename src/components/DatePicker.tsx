import {useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {dateKey} from '../utils/dates';
import './DatePicker.css';
import {FieldError} from './FieldError';
export function validDate(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T12:00:00');
 return !Number.isNaN(date.getTime())&&dateKey(date)===value;
}
export function DatePicker({value,onChange,disabled=false,error}:{value:string;onChange:(value:string)=>void;disabled?:boolean;error?:string}){
 const [open,setOpen]=useState(false);
 const [active,setActive]=useState(value);
 const field=useRef<HTMLDivElement>(null),popup=useRef<HTMLDivElement>(null);
 const [host,setHost]=useState<HTMLElement|null>(null);
 const [position,setPosition]=useState({left:12,top:12,width:336,maxHeight:500});
 const trigger=useRef<HTMLButtonElement>(null),calendar=useRef<HTMLDivElement>(null);
 const selected=validDate(active)?new Date(active+'T12:00:00'):new Date();
 const year=selected.getFullYear(),month=selected.getMonth();
 const first=new Date(year,month,1).getDay(),count=new Date(year,month+1,0).getDate();
 const close=()=>{setOpen(false);trigger.current?.focus({preventScroll:true});};
 const move=(days:number)=>{const d=new Date(selected);d.setDate(d.getDate()+days);setActive(dateKey(d));};
 const moveMonth=(offset:number)=>{const d=new Date(year,month+offset,1);d.setDate(Math.min(selected.getDate(),new Date(year,month+offset+1,0).getDate()));setActive(dateKey(d));};
 useLayoutEffect(()=>{if(open)calendar.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus({preventScroll:true});},[open,active]);
 useLayoutEffect(()=>{
  if(!open)return;
  const outside=(event:Event)=>{if(!field.current?.contains(event.target as Node)&&!popup.current?.contains(event.target as Node))setOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}};
  document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);document.addEventListener('keydown',escape);
  return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);document.removeEventListener('keydown',escape);};
 },[open]);
 useLayoutEffect(()=>{
  if(!open)return;
  const update=()=>{
   const anchor=field.current?.querySelector('.nesmi-date-entry')?.getBoundingClientRect();
   if(!anchor||!popup.current)return;
   const view=window.visualViewport, x=view?.offsetLeft||0,y=view?.offsetTop||0;
   const width=view?.width||window.innerWidth,height=view?.height||window.innerHeight;
   const style=getComputedStyle(popup.current);
   const inset=(edge:string)=>12+(parseFloat(style.getPropertyValue('--calendar-safe-'+edge))||0);
   const left=x+inset('left'),right=x+width-inset('right'),top=y+inset('top'),bottom=y+height-inset('bottom');
   const menuWidth=Math.max(0,Math.min(360,right-left));
   const desired=popup.current.scrollHeight+2;
   const actual=Math.min(desired,bottom-top);
   const below=bottom-anchor.bottom-8,above=anchor.top-top-8;
   // Prefer a full calendar below or above. On short screens, overlap the anchor
   // and scroll the calendar itself rather than resizing or scrolling the dialog.
   const menuTop=below>=actual?anchor.bottom+8:above>=actual?anchor.top-actual-8:Math.max(top,Math.min(anchor.bottom+8,bottom-actual));
   const next={left:Math.max(left,Math.min(anchor.left,right-menuWidth)),top:menuTop,width:menuWidth,maxHeight:Math.max(0,bottom-top)};
   setPosition(old=>Object.keys(next).every(key=>old[key as keyof typeof old]===next[key as keyof typeof next])?old:next);
  };
  update();const observer=new ResizeObserver(update);if(popup.current)observer.observe(popup.current);if(field.current)observer.observe(field.current);
  window.addEventListener('resize',update);window.addEventListener('scroll',update,true);
  window.visualViewport?.addEventListener('resize',update);window.visualViewport?.addEventListener('scroll',update);
  return()=>{observer.disconnect();window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);window.visualViewport?.removeEventListener('resize',update);window.visualViewport?.removeEventListener('scroll',update);};
 },[open,active]);
 return <div ref={field} className="nesmi-date-field">
  <label className="chore-label" htmlFor="chore-date">When?</label>
  <div className="nesmi-date-entry"><input id="chore-date" className="chore-input" type="text" autoComplete="off" placeholder="YYYY-MM-DD" aria-invalid={!!error} aria-describedby={error?'chore-date-error':'chore-date-format'} value={value} disabled={disabled} required onChange={e=>onChange(e.target.value)}/><button ref={trigger} type="button" className="touch-button" aria-label="Choose date" aria-expanded={open} aria-controls="chore-calendar" disabled={disabled} onClick={()=>{if(open)close();else{setHost(trigger.current?.closest<HTMLElement>('[role="dialog"]')||document.body);setActive(validDate(value)?value:dateKey());setOpen(true);}}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/></svg></button></div>
  <FieldError id="chore-date-error" message={error}/>
  <small hidden={!!error} id="chore-date-format" className="nesmi-date-format">YYYY-MM-DD</small>
  {open&&!disabled&&host&&createPortal(<div ref={popup} id="chore-calendar" className="nesmi-date-calendar" style={position} data-open-picker onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}}}>
   <header><button type="button" className="touch-button" aria-label="Previous month" onClick={()=>moveMonth(-1)}>‹</button><strong aria-live="polite">{selected.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</strong><button type="button" className="touch-button" aria-label="Next month" onClick={()=>moveMonth(1)}>›</button></header>
   <div className="nesmi-date-week" aria-hidden="true">{['Su','Mo','Tu','We','Th','Fr','Sa'].map(day=><span key={day}>{day}</span>)}</div>
   <div ref={calendar} className="nesmi-date-grid" role="group" aria-label="Calendar dates" onKeyDown={e=>{const offset:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};if(e.key in offset){e.preventDefault();move(offset[e.key]);}else if(e.key==='Home'||e.key==='End'){e.preventDefault();move(e.key==='Home'?-selected.getDay():6-selected.getDay());}else if(e.key==='PageUp'||e.key==='PageDown'){e.preventDefault();moveMonth(e.key==='PageUp'?-1:1);}}}>
   {Array.from({length:first},(_,i)=><span key={'blank'+i}/>)}
   {Array.from({length:count},(_,i)=>{const d=new Date(year,month,i+1),key=dateKey(d);return <button key={key} type="button" tabIndex={key===dateKey(selected)?0:-1} aria-label={d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})} aria-pressed={key===value} aria-current={key===dateKey()?'date':undefined} onClick={()=>{onChange(key);close();}}>{i+1}</button>;})}
   </div>
   <footer><button type="button" className="chore-button secondary" onClick={()=>{onChange(dateKey());close();}}>Today</button><button type="button" className="chore-button secondary" onClick={close}>Close calendar</button></footer>
  </div>,host)}
 </div>;
}
