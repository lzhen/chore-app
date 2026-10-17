import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Chore, RecurrenceType, Priority } from '../types';
import { dateKey } from '../utils/dates';
import { Dialog } from './Dialog';
import { DatePicker, validDate } from './DatePicker';
import { ChoicePicker } from './ChoicePicker';
import { FieldError } from './FieldError';
import { TimePicker } from './TimePicker';
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
 const {state,addChore,updateChore,deleteChore,uncompleteChore}=useApp();
 const [title,setTitle]=useState(editChore?.title??defaultValues?.title??'');const [date,setDate]=useState(editChore?.date||defaultValues?.date||defaultDate||dateKey());
 const [member,setMember]=useState((editChore?editChore.assigneeId:defaultValues?.assigneeId)||'');const [start,setStart]=useState(editChore?.dueTime||defaultValues?.startTime||'');const [end,setEnd]=useState(editChore?.endTime||defaultValues?.endTime||'');
 const [description,setDescription]=useState(editChore?.description??defaultValues?.description??'');const [repeat,setRepeat]=useState<RecurrenceType>(editChore?.recurrence??defaultValues?.recurrence??'none');const [priority,setPriority]=useState<Priority>(editChore?.priority??defaultValues?.priority??'medium');
 const [category,setCategory]=useState(editChore?.categoryId??defaultValues?.categoryId??'');const [estimate,setEstimate]=useState((editChore?.estimatedMinutes??defaultValues?.estimatedMinutes)?.toString()||'');
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [confirmDelete,setConfirmDelete]=useState(false);const [confirmDiscard,setConfirmDiscard]=useState(false);
 const draft=JSON.stringify([title,date,member,start,end,description,repeat,priority,category,estimate]);
 const initialDraft=useRef(draft);
 const dirty=draft!==initialDraft.current;
 const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
 const formRef=useRef<HTMLFormElement>(null);
 const clearField=(id:string)=>setFieldErrors(previous=>{const next={...previous};delete next[id];return next;});
 const discardReturn=useRef<HTMLElement|null>(null);
 const errorRef=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if(error){errorRef.current?.focus({preventScroll:true});}},[error]);
 const hasDefaultDetails=!!defaultValues?.startTime||(!!defaultValues?.recurrence&&defaultValues.recurrence!=='none')||!!defaultValues?.estimatedMinutes;
 useEffect(()=>{const prevent=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',prevent);return ()=>window.removeEventListener('beforeunload',prevent);},[dirty]);
 function close(){if(busy)return;if(dirty){discardReturn.current=document.activeElement as HTMLElement;discardReturn.current?.blur();setConfirmDiscard(true);}else onClose();}
 async function save(event:React.FormEvent){event.preventDefault();if(busy)return;setError('');const next:Record<string,string>={};
 if(!title.trim())next['chore-title']='Enter a task name.';
 if(!validDate(date))next['chore-date']='Enter a valid date (YYYY-MM-DD).';
 if(end&&(!start||end<=start))next['chore-end']='Choose an end time after the start time.';
 if(formRef.current?.querySelector<HTMLInputElement>('#chore-estimate')?.validity.badInput||(estimate&&(!Number.isInteger(Number(estimate))||Number(estimate)<1)))next['chore-estimate']='Enter a positive whole number.';
 setFieldErrors(next);
 const first=Object.keys(next)[0];if(first){requestAnimationFrame(()=>{const field=document.getElementById(first==='chore-end'?'chore-end-hour':first);const details=field?.closest('details');if(details)details.open=true;field?.focus({preventScroll:true});});return;}

 setBusy(true);try{const values={title:title.trim(),date,assigneeId:member||null,dueTime:start||undefined,endTime:end||undefined,allDay:!start,description:description.trim()||undefined,recurrence:repeat,priority,categoryId:category||undefined,estimatedMinutes:estimate?Number(estimate):undefined};if(editChore)await updateChore({...editChore,...values});else await addChore(values);onClose();}catch(e){setError(e instanceof Error?e.message:'Could not save this chore. Please try again.');}finally{setBusy(false);}}
 async function remove(){if(!editChore||busy)return;setBusy(true);try{await deleteChore(editChore.id);onClose();}catch(e){setError(e instanceof Error?e.message:'Could not delete. Please try again.');}finally{setBusy(false);}}
 const completion=editChore?state.completions?.find(item=>item.choreId===editChore.id&&item.instanceDate===(instanceDate||editChore.date)):undefined;
 async function undoCompletion(){if(!completion||busy)return;setBusy(true);try{await uncompleteChore(completion.id);}catch(e){setError(e instanceof Error?e.message:'Could not undo completion.');}finally{setBusy(false);}}
 const input=(label:string,id:string,value:string,change:(s:string)=>void,type='text',required=false)=><label className="chore-label" htmlFor={id}>{label}<input className="chore-input" id={id} aria-label={label} autoComplete={id==='chore-title'?'off':undefined} value={value} type={type} required={required} aria-invalid={!!fieldErrors[id]} aria-describedby={fieldErrors[id]?id+'-error':undefined} onChange={e=>{change(e.target.value);clearField(id);}}/><FieldError id={id+'-error'} message={fieldErrors[id]}/></label>;
 return <><Dialog size="form" suspended={confirmDiscard} title={editChore?'Edit chore':'Add a chore'} onClose={close} busy={busy} footer={<><button type="button" className="chore-button secondary" disabled={busy} onClick={close}>Cancel</button><button className="chore-button primary" type="submit" form="chore-edit-form" disabled={busy}>{busy?'Saving…':editChore?'Save changes':'Add chore'}</button></>}>
 <form ref={formRef} noValidate autoComplete="off" id="chore-edit-form" onSubmit={save}>
 {editChore?.recurrence!=='none'&&editChore&&<p className="chore-notice">You are editing the repeating series, starting {editChore.date}. Changes apply to all occurrences{instanceDate&&instanceDate!==editChore.date?`, not just ${instanceDate}`:''}.</p>}
 {error&&<p className="chore-error" role="alert" tabIndex={-1} ref={errorRef}>{error} Your entries are still here.</p>}
 <label className="chore-label" htmlFor="chore-title">What needs doing?<textarea id="chore-title" aria-label="What needs doing?" className="chore-input nesmi-task-title" rows={1} autoComplete="off" required aria-invalid={!!fieldErrors['chore-title']} aria-describedby={fieldErrors['chore-title']?'chore-title-error':undefined} disabled={busy} value={title} onChange={e=>{setTitle(e.target.value.replace(/[\r\n]+/g,' '));clearField('chore-title');}} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit();}}}/><FieldError id="chore-title-error" message={fieldErrors['chore-title']}/></label>
 <label className="chore-label" htmlFor="chore-member">Who’s responsible?<ChoicePicker id="chore-member" className="chore-input" label="Who’s responsible?" value={member} disabled={busy} onChange={value=>{setMember(value);}} options={[{id:'',label:'Unassigned — decide later'},...state.teamMembers.map(m=>({id:m.id,label:m.name}))]}/></label>
 <DatePicker error={fieldErrors['chore-date']} value={date} disabled={busy} onChange={value=>{setDate(value);clearField('chore-date');}}/>
 <details className="chore-more" open={!!editChore||hasDefaultDetails||undefined}><summary>More options</summary>
 <div className="chore-time-row"><TimePicker id="chore-start" label="Start time" value={start} disabled={busy} onChange={v=>{setStart(v);clearField('chore-end');}}/><TimePicker error={fieldErrors['chore-end']} id="chore-end" label="End time" value={end} disabled={busy} onChange={v=>{setEnd(v);clearField('chore-end');}}/></div><p className="chore-muted">Leave times blank for an all-day chore. End times must be on the same day.</p>
 <label className="chore-label" htmlFor="chore-repeat">Repeat<ChoicePicker id="chore-repeat" className="chore-input" label="Repeat" value={repeat} disabled={busy} onChange={value=>{setRepeat(value as RecurrenceType);}} options={[{id:'none',label:'Does not repeat'},{id:'daily',label:'Every day'},{id:'weekly',label:'Every week'},{id:'monthly',label:'Every month'}]}/></label>
 <label className="chore-label" htmlFor="chore-priority">Priority<ChoicePicker id="chore-priority" className="chore-input" label="Priority" value={priority} disabled={busy} onChange={value=>{setPriority(value as Priority);}} options={[{id:'low',label:'Low'},{id:'medium',label:'Normal'},{id:'high',label:'High'}]}/></label>
 <label className="chore-label" htmlFor="chore-notes">Notes · optional<textarea id="chore-notes" className="chore-input" rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label>
 {state.categories.length>0&&<label className="chore-label" htmlFor="chore-category">Category<ChoicePicker id="chore-category" className="chore-input" label="Category" value={category} disabled={busy} onChange={value=>{setCategory(value);}} options={[{id:'',label:'No category'},...state.categories.map(c=>({id:c.id,label:c.name}))]}/></label>}
 {input('Estimated minutes · optional','chore-estimate',estimate,setEstimate,'number')}
 </details>
 
 {completion&&<button type="button" className="chore-button secondary" disabled={busy} onClick={undoCompletion}>Mark not done</button>}
 {editChore&&<div className="chore-delete">{confirmDelete?<><p>{editChore.recurrence==='none'?'Delete this chore?':'Delete the entire repeating series?'} This cannot be undone.</p><button type="button" disabled={busy} onClick={remove} className="chore-button danger">Delete permanently</button><button type="button" onClick={()=>setConfirmDelete(false)} className="chore-button secondary">Keep chore</button></>:<button type="button" className="chore-button danger" onClick={()=>setConfirmDelete(true)}>Delete {editChore.recurrence==='none'?'chore':'series'}</button>}</div>}
 </form></Dialog>
 {confirmDiscard&&<Dialog size="confirm" returnFocus={discardReturn.current} title="Discard changes?" onClose={()=>setConfirmDiscard(false)} footer={<><button type="button" className="chore-button secondary" data-dialog-autofocus onClick={()=>setConfirmDiscard(false)}>Keep editing</button><button type="button" className="chore-button secondary" onClick={onClose}>Discard</button></>}>{null}</Dialog>}
 </>;
}
