import { ChoicePicker } from './ChoicePicker';
import './TimePicker.css';
import {FieldError} from './FieldError';

const options=(count:number)=>Array.from({length:count},(_,i)=>({id:String(i).padStart(2,'0'),label:String(i).padStart(2,'0')}));
const hours=options(24), minutes=options(60);
/** Exact, optional 24-hour time; uses the same menus as the other form fields. */
export function TimePicker({id,label,value,onChange,disabled=false,error}:{id:string;label:string;value:string;onChange:(value:string)=>void;disabled?:boolean;error?:string}) {
 const [hour='',minute='']=value.split(':');
 return <fieldset className="nesmi-time-field" disabled={disabled}>
  <legend>{label} · optional</legend>
  <div className="nesmi-time-entry">
   <ChoicePicker invalid={!!error} describedBy={error?id+'-error':undefined} id={id+'-hour'} label={label+' hour'} value={hour} placeholder="Hour" disabled={disabled} className="chore-input" options={hours} onChange={next=>onChange(next+':'+(minute||'00'))}/>
   <span aria-hidden="true">:</span>
   <ChoicePicker invalid={!!error} describedBy={error?id+'-error':undefined} id={id+'-minute'} label={label+' minute'} value={minute} placeholder="Min" disabled={disabled} className="chore-input" options={minutes} onChange={next=>onChange((hour||'00')+':'+next)}/>
  </div>
  <FieldError id={id+'-error'} message={error}/>
  {value&&<button type="button" className="nesmi-time-clear" disabled={disabled} onClick={()=>onChange('')} aria-label={'Clear '+label.toLowerCase()}>Clear</button>}
 </fieldset>;
}
