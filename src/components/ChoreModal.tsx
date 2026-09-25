import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Chore, RecurrenceType, Priority } from '../types';
import { dateKey } from '../utils/dates';
import { Dialog } from './Dialog';
interface Defaults {date?:string;startTime?:string;endTime?:string;allDay?:boolean;}
interface Props {isOpen:boolean;onClose:()=>void;editChore?:Chore|null;defaultDate?:string;instanceDate?:string;defaultValues?:Defaults;}
export function ChoreModal(props:Props){return props.isOpen?<ChoreEditor {...props}/>:null;}
function ChoreEditor({onClose,editChore,defaultDate,defaultValues,instanceDate}:Props){
 const {state,addChore,updateChore,deleteChore}=useApp();
 const [title,setTitle]=useState(editChore?.title||'');const [date,setDate]=useState(editChore?.date||defaultValues?.date||defaultDate||dateKey());
 const [member,setMember]=useState(editChore?.assigneeId||'');const [start,setStart]=useState(editChore?.dueTime||defaultValues?.startTime||'');const [end,setEnd]=useState(editChore?.endTime||defaultValues?.endTime||'');
 const [description,setDescription]=useState(editChore?.description||'');const [repeat,setRepeat]=useState<RecurrenceType>(editChore?.recurrence||'none');const [priority,setPriority]=useState<Priority>(editChore?.priority||'medium');
 const [category,setCategory]=useState(editChore?.categoryId||'');const [estimate,setEstimate]=useState(editChore?.estimatedMinutes?.toString()||'');
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [dirty,setDirty]=useState(false);const [confirmDelete,setConfirmDelete]=useState(false);const [confirmDiscard,setConfirmDiscard]=useState(false);
 useEffect(()=>{const prevent=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',prevent);return ()=>window.removeEventListener('beforeunload',prevent);},[dirty]);
 function close(){if(busy)return;if(dirty)setConfirmDiscard(true);else onClose();}
 async function save(event:React.FormEvent){event.preventDefault();if(busy)return;setError('');if(!title.trim()||!date){setError('Enter a task name and date.');return;}if(end&&(!start||end<=start)){setError('Choose an end time after the start time, on the same day.');return;}if(estimate&&(!Number.isInteger(Number(estimate))||Number(estimate)<1)){setError('Estimated minutes must be a positive whole number.');return;}
 setBusy(true);try{const values={title:title.trim(),date,assigneeId:member||null,dueTime:start||undefined,endTime:end||undefined,allDay:!start,description:description.trim()||undefined,recurrence:repeat,priority,categoryId:category||undefined,estimatedMinutes:estimate?Number(estimate):undefined};if(editChore)await updateChore({...editChore,...values});else await addChore(values);onClose();}catch(e){setError(e instanceof Error?e.message:'Could not save this chore. Please try again.');}finally{setBusy(false);}}
 async function remove(){if(!editChore||busy)return;setBusy(true);try{await deleteChore(editChore.id);onClose();}catch(e){setError(e instanceof Error?e.message:'Could not delete. Please try again.');}finally{setBusy(false);}}
 const input=(label:string,id:string,value:string,change:(s:string)=>void,type='text',required=false)=><label className="chore-label" htmlFor={id}>{label}<input className="chore-input" id={id} value={value} type={type} required={required} onChange={e=>change(e.target.value)}/></label>;
 return <Dialog title={editChore?'Edit chore':'Add a chore'} onClose={close} busy={busy} footer={<><button type="button" className="chore-button secondary" disabled={busy} onClick={close}>Cancel</button><button className="chore-button primary" type="submit" form="chore-edit-form" disabled={busy}>{busy?'Saving…':editChore?'Save changes':'Add chore'}</button></>}>
 <form id="chore-edit-form" onSubmit={save} onChange={()=>setDirty(true)}>
 {editChore?.recurrence!=='none'&&editChore&&<p className="chore-notice">You are editing the repeating series, starting {editChore.date}. Changes apply to all occurrences{instanceDate&&instanceDate!==editChore.date?`, not just ${instanceDate}`:''}.</p>}
 {input('What needs doing?','chore-title',title,setTitle,'text',true)}
 <label className="chore-label" htmlFor="chore-member">Who’s responsible?<select id="chore-member" className="chore-input" value={member} onChange={e=>setMember(e.target.value)}><option value="">Unassigned — decide later</option>{state.teamMembers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
 {input('When?','chore-date',date,setDate,'date',true)}
 <details className="chore-more" open={!!editChore||!!defaultValues?.startTime||undefined}><summary>More options <small>Time, repeat, notes</small></summary>
 <div className="chore-time-row">{input('Start time · optional','chore-start',start,setStart,'time')}{input('End time · optional','chore-end',end,setEnd,'time')}</div><p className="chore-muted">Leave times blank for an all-day chore. End times must be on the same day.</p>
 <label className="chore-label" htmlFor="chore-repeat">Repeat<select id="chore-repeat" className="chore-input" value={repeat} onChange={e=>setRepeat(e.target.value as RecurrenceType)}><option value="none">Does not repeat</option><option value="daily">Every day</option><option value="weekly">Every week</option><option value="monthly">Every month</option></select></label>
 <label className="chore-label" htmlFor="chore-priority">Priority<select id="chore-priority" className="chore-input" value={priority} onChange={e=>setPriority(e.target.value as Priority)}><option value="low">Low</option><option value="medium">Normal</option><option value="high">High</option></select></label>
 <label className="chore-label" htmlFor="chore-notes">Notes · optional<textarea id="chore-notes" className="chore-input" rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label>
 {state.categories.length>0&&<label className="chore-label" htmlFor="chore-category">Category<select id="chore-category" className="chore-input" value={category} onChange={e=>setCategory(e.target.value)}><option value="">No category</option>{state.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
 {input('Estimated minutes · optional','chore-estimate',estimate,setEstimate,'number')}
 </details>
 {error&&<p className="chore-error" role="alert">{error} Your entries are still here.</p>}
 {confirmDiscard&&<div className="chore-notice" role="alert"><p>Discard your unsaved changes?</p><button type="button" className="chore-button secondary" onClick={()=>setConfirmDiscard(false)}>Keep editing</button> <button type="button" className="chore-button danger" onClick={onClose}>Discard changes</button></div>}
 {editChore&&<div className="chore-delete">{confirmDelete?<><p>{editChore.recurrence==='none'?'Delete this chore?':'Delete the entire repeating series?'} This cannot be undone.</p><button type="button" disabled={busy} onClick={remove} className="chore-button danger">Delete permanently</button><button type="button" onClick={()=>setConfirmDelete(false)} className="chore-button secondary">Keep chore</button></>:<button type="button" className="chore-button danger" onClick={()=>setConfirmDelete(true)}>Delete {editChore.recurrence==='none'?'chore':'series'}</button>}</div>}
 </form></Dialog>;
}
