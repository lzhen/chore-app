import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Chore, RecurrenceType, Priority } from '../types';
import { dateKey } from '../utils/dates';
import { Dialog } from './Dialog';
import { DatePicker, validDate } from './DatePicker';
import { ChoicePicker } from './ChoicePicker';
export interface ChoreDefaultValues {
 title?:string;
 date?:string;
 startTime?:string;
 endTime?:string;
 allDay?:boolean;
 assigneeId?:string|null;
 description?:string;
 recurrence?:RecurrenceType;
 priority?:Priority;
 categoryId?:string;
 estimatedMinutes?:number;
}
interface Props {isOpen:boolean;onClose:()=>void;editChore?:Chore|null;defaultDate?:string;instanceDate?:string;defaultValues?:ChoreDefaultValues;}
export function ChoreModal(props:Props){return props.isOpen?<ChoreEditor {...props}/>:null;}
function ChoreEditor({onClose,editChore,defaultDate,defaultValues,instanceDate}:Props){
 const {state,addChore,updateChore,deleteChore}=useApp();
 const [title,setTitle]=useState(editChore?.title??defaultValues?.title??'');const [date,setDate]=useState(editChore?.date||defaultValues?.date||defaultDate||dateKey());
 const [member,setMember]=useState((editChore?editChore.assigneeId:defaultValues?.assigneeId)||'');const [start,setStart]=useState(editChore?.dueTime||defaultValues?.startTime||'');const [end,setEnd]=useState(editChore?.endTime||defaultValues?.endTime||'');
 const [description,setDescription]=useState(editChore?.description??defaultValues?.description??'');const [repeat,setRepeat]=useState<RecurrenceType>(editChore?.recurrence??defaultValues?.recurrence??'none');const [priority,setPriority]=useState<Priority>(editChore?.priority??defaultValues?.priority??'medium');
 const [category,setCategory]=useState(editChore?.categoryId??defaultValues?.categoryId??'');const [estimate,setEstimate]=useState((editChore?.estimatedMinutes??defaultValues?.estimatedMinutes)?.toString()||'');
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [dirty,setDirty]=useState(false);const [confirmDelete,setConfirmDelete]=useState(false);const [confirmDiscard,setConfirmDiscard]=useState(false);
 const errorRef=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if(error){errorRef.current?.focus();errorRef.current?.scrollIntoView?.({block:'nearest'});}},[error]);
 const hasDefaultDetails=!!defaultValues?.startTime||(!!defaultValues?.recurrence&&defaultValues.recurrence!=='none')||!!defaultValues?.estimatedMinutes;
 useEffect(()=>{const prevent=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',prevent);return ()=>window.removeEventListener('beforeunload',prevent);},[dirty]);
 function close(){if(busy)return;if(dirty)setConfirmDiscard(true);else onClose();}
 async function save(event:React.FormEvent){event.preventDefault();if(busy)return;setError('');if(!title.trim()||!validDate(date)){setError('Enter a task name and a valid date (YYYY-MM-DD).');return;}if(end&&(!start||end<=start)){setError('Choose an end time after the start time, on the same day.');return;}if(estimate&&(!Number.isInteger(Number(estimate))||Number(estimate)<1)){setError('Estimated minutes must be a positive whole number.');return;}
 setBusy(true);try{const values={title:title.trim(),date,assigneeId:member||null,dueTime:start||undefined,endTime:end||undefined,allDay:!start,description:description.trim()||undefined,recurrence:repeat,priority,categoryId:category||undefined,estimatedMinutes:estimate?Number(estimate):undefined};if(editChore)await updateChore({...editChore,...values});else await addChore(values);onClose();}catch(e){setError(e instanceof Error?e.message:'Could not save this chore. Please try again.');}finally{setBusy(false);}}
 async function remove(){if(!editChore||busy)return;setBusy(true);try{await deleteChore(editChore.id);onClose();}catch(e){setError(e instanceof Error?e.message:'Could not delete. Please try again.');}finally{setBusy(false);}}
 const input=(label:string,id:string,value:string,change:(s:string)=>void,type='text',required=false)=><label className="chore-label" htmlFor={id}>{label}<input className="chore-input" id={id} autoComplete={id==='chore-title'?'off':undefined} value={value} type={type} required={required} onChange={e=>change(e.target.value)}/></label>;
 return <Dialog title={editChore?'Edit chore':'Add a chore'} onClose={close} busy={busy} footer={<><button type="button" className="chore-button secondary" disabled={busy} onClick={close}>Cancel</button><button className="chore-button primary" type="submit" form="chore-edit-form" disabled={busy}>{busy?'Saving…':editChore?'Save changes':'Add chore'}</button></>}>
 <form autoComplete="off" id="chore-edit-form" onSubmit={save} onChange={()=>setDirty(true)}>
 {editChore?.recurrence!=='none'&&editChore&&<p className="chore-notice">You are editing the repeating series, starting {editChore.date}. Changes apply to all occurrences{instanceDate&&instanceDate!==editChore.date?`, not just ${instanceDate}`:''}.</p>}
 {error&&<p className="chore-error" role="alert" tabIndex={-1} ref={errorRef}>{error} Your entries are still here.</p>}
 <label className="chore-label" htmlFor="chore-title">What needs doing?<textarea id="chore-title" className="chore-input nesmi-task-title" rows={1} autoComplete="off" required disabled={busy} value={title} onChange={e=>setTitle(e.target.value.replace(/[\r\n]+/g,' '))} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit();}}}/></label>
 <label className="chore-label" htmlFor="chore-member">Who’s responsible?<ChoicePicker id="chore-member" className="chore-input" label="Who’s responsible?" value={member} disabled={busy} onChange={value=>{setMember(value);setDirty(true);}} options={[{id:'',label:'Unassigned — decide later'},...state.teamMembers.map(m=>({id:m.id,label:m.name}))]}/></label>
 <DatePicker value={date} disabled={busy} onChange={value=>{setDate(value);setDirty(true);}}/>
 <details className="chore-more" open={!!editChore||hasDefaultDetails||undefined}><summary>More options <small>Repeat, time estimate, notes</small></summary>
 <div className="chore-time-row">{input('Start time · optional','chore-start',start,setStart,'time')}{input('End time · optional','chore-end',end,setEnd,'time')}</div><p className="chore-muted">Leave times blank for an all-day chore. End times must be on the same day.</p>
 <label className="chore-label" htmlFor="chore-repeat">Repeat<ChoicePicker id="chore-repeat" className="chore-input" label="Repeat" value={repeat} disabled={busy} onChange={value=>{setRepeat(value as RecurrenceType);setDirty(true);}} options={[{id:'none',label:'Does not repeat'},{id:'daily',label:'Every day'},{id:'weekly',label:'Every week'},{id:'monthly',label:'Every month'}]}/></label>
 <label className="chore-label" htmlFor="chore-priority">Priority<ChoicePicker id="chore-priority" className="chore-input" label="Priority" value={priority} disabled={busy} onChange={value=>{setPriority(value as Priority);setDirty(true);}} options={[{id:'low',label:'Low'},{id:'medium',label:'Normal'},{id:'high',label:'High'}]}/></label>
 <label className="chore-label" htmlFor="chore-notes">Notes · optional<textarea id="chore-notes" className="chore-input" rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label>
 {state.categories.length>0&&<label className="chore-label" htmlFor="chore-category">Category<ChoicePicker id="chore-category" className="chore-input" label="Category" value={category} disabled={busy} onChange={value=>{setCategory(value);setDirty(true);}} options={[{id:'',label:'No category'},...state.categories.map(c=>({id:c.id,label:c.name}))]}/></label>}
 {input('Estimated minutes · optional','chore-estimate',estimate,setEstimate,'number')}
 </details>
 {confirmDiscard&&<div className="chore-notice" role="alert"><p>Discard your unsaved changes?</p><button type="button" className="chore-button secondary" onClick={()=>setConfirmDiscard(false)}>Keep editing</button> <button type="button" className="chore-button danger" onClick={onClose}>Discard changes</button></div>}
 {editChore&&<div className="chore-delete">{confirmDelete?<><p>{editChore.recurrence==='none'?'Delete this chore?':'Delete the entire repeating series?'} This cannot be undone.</p><button type="button" disabled={busy} onClick={remove} className="chore-button danger">Delete permanently</button><button type="button" onClick={()=>setConfirmDelete(false)} className="chore-button secondary">Keep chore</button></>:<button type="button" className="chore-button danger" onClick={()=>setConfirmDelete(true)}>Delete {editChore.recurrence==='none'?'chore':'series'}</button>}</div>}
 </form></Dialog>;
}
