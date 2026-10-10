import { forwardRef, useState, useEffect, useLayoutEffect, useImperativeHandle, useRef, type Ref } from 'react';
import { useApp } from '../context/AppContext';
import { Chore, RecurrenceType, Priority } from '../types';
import { dateKey } from '../utils/dates';
import { Dialog } from './Dialog';
import { ChoicePicker } from './ChoicePicker';
import { DeleteChoreDialog } from './DeleteChoreDialog';
import { useInteractionMode } from '../hooks/useInteractionMode';
import './ChoreModal.css';
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
export interface ChoreEditorHandle { requestTransition: (action: () => void) => void; }
interface Props {isOpen?:boolean;onClose:()=>void;editChore?:Chore|null;defaultDate?:string;instanceDate?:string;defaultValues?:ChoreDefaultValues;presentation?:'dialog'|'inline'|'sheet';editorRef?:Ref<ChoreEditorHandle>;}
export function ChoreModal(props:Props){const mode=useInteractionMode();return props.isOpen?<ChoreEditor {...props} presentation={props.presentation || (mode==='app'?'sheet':'dialog')} ref={props.editorRef}/>:null;}
export const ChoreEditor = forwardRef<ChoreEditorHandle, Props>(function ChoreEditor({onClose,editChore,defaultDate,defaultValues,instanceDate,presentation='dialog'},ref){
 const {state,addChore,updateChore}=useApp();
 const [title,setTitle]=useState(editChore?.title??defaultValues?.title??'');const [date,setDate]=useState(editChore?.date||defaultValues?.date||defaultDate||dateKey());
 const [member,setMember]=useState((editChore?editChore.assigneeId:defaultValues?.assigneeId)||'');const [start,setStart]=useState(editChore?.dueTime||defaultValues?.startTime||'');const [end,setEnd]=useState(editChore?.endTime||defaultValues?.endTime||'');
 const [description,setDescription]=useState(editChore?.description??defaultValues?.description??'');const [repeat,setRepeat]=useState<RecurrenceType>(editChore?.recurrence??defaultValues?.recurrence??'none');const [priority,setPriority]=useState<Priority>(editChore?.priority??defaultValues?.priority??'medium');
 const [category,setCategory]=useState(editChore?.categoryId??defaultValues?.categoryId??'');const [estimate,setEstimate]=useState((editChore?.estimatedMinutes??defaultValues?.estimatedMinutes)?.toString()||'');
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [confirmDelete,setConfirmDelete]=useState(false);const [confirmDiscard,setConfirmDiscard]=useState(false);
 const currentDraft = {title:title.trim(),date,member,start,end,description:description.trim(),repeat,priority,category,estimate:estimate ? String(Number(estimate)) : ''};
 const originalDraft = useRef(currentDraft);
 const changedFields = (Object.keys(currentDraft) as (keyof typeof currentDraft)[]).filter(key=>currentDraft[key]!==originalDraft.current[key]);
 const dirty = changedFields.length > 0;
 const draftName = title.trim() || originalDraft.current.title;
 const fieldNames:Record<keyof typeof currentDraft,string> = {title:'Chore name',date:'Date',member:'Person',start:'Start time',end:'End time',description:'Notes',repeat:'Repeat',priority:'Priority',category:'Category',estimate:'Estimated minutes'};
 const formRef = useRef<HTMLFormElement>(null);
 const titleRef = useRef<HTMLInputElement>(null);
 const pendingAction = useRef<(() => void) | null>(null);
 const pendingWhileBusy = useRef<(() => void) | null>(null);
 const busyRef = useRef(false);
 const inline = presentation === 'inline';
 useEffect(()=>{if(inline)titleRef.current?.focus({preventScroll:true});},[inline]);
 const returnPoint = useRef<{focus:HTMLElement|null;scroll:number}|null>(null);
 const restoring = useRef(false);
 const keepRef = useRef<HTMLButtonElement>(null);
 function keepEditing(){pendingAction.current=null;restoring.current=true;setConfirmDiscard(false);}
 useLayoutEffect(()=>{
   if(confirmDiscard){keepRef.current?.focus();}
   if(!inline&&!confirmDiscard&&restoring.current){
     restoring.current=false;
     if(formRef.current?.parentElement)formRef.current.parentElement.scrollTop=returnPoint.current?.scroll||0;
     returnPoint.current?.focus?.focus({preventScroll:true});
   }
 },[confirmDiscard]);
 useEffect(()=>{
   if(inline&&!confirmDiscard&&restoring.current){
     restoring.current=false;
     if(formRef.current?.parentElement)formRef.current.parentElement.scrollTop=returnPoint.current?.scroll||0;
     returnPoint.current?.focus?.focus({preventScroll:true});
   }
 },[confirmDiscard,inline]);
 const errorRef=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if(error){errorRef.current?.focus();errorRef.current?.scrollIntoView?.({block:'nearest'});}},[error]);
 const hasDefaultDetails=useRef(!!start||!!end||!!description||repeat!=='none'||priority!=='medium'||!!category||!!estimate).current;
 const hasAdvancedDetails=useRef(priority!=='medium'||!!category||!!estimate).current;
 useEffect(()=>{const prevent=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',prevent);return ()=>window.removeEventListener('beforeunload',prevent);},[dirty]);
 function requestTransition(action:()=>void){if(busyRef.current){pendingWhileBusy.current=action;return;}if(dirty){pendingAction.current=()=>{onClose();action();};returnPoint.current={focus:inline&&!formRef.current?.contains(document.activeElement)?titleRef.current:document.activeElement as HTMLElement,scroll:formRef.current?.parentElement?.scrollTop||0};setConfirmDiscard(true);}else {onClose();action();}}
 useImperativeHandle(ref,()=>({requestTransition}));
 useEffect(()=>{if(!busy&&pendingWhileBusy.current){const action=pendingWhileBusy.current;pendingWhileBusy.current=null;requestTransition(action);}},[busy]);
 function close(){if(busyRef.current)return;if(confirmDiscard){keepEditing();return;}requestTransition(()=>{});}
 function discard(){const next=pendingAction.current;pendingAction.current=null;setConfirmDiscard(false);if(next)next();else onClose();}
 async function save(event:React.FormEvent){event.preventDefault();if(busyRef.current)return;setError('');if(!title.trim()||!date){setError('Enter a task name and date.');return;}if(end&&(!start||end<=start)){setError('Choose an end time after the start time, on the same day.');return;}if(estimate&&(!Number.isInteger(Number(estimate))||Number(estimate)<1)){setError('Estimated minutes must be a positive whole number.');return;}
 busyRef.current=true;setBusy(true);try{const values={title:title.trim(),date,assigneeId:member||null,dueTime:start||undefined,endTime:end||undefined,allDay:!start,description:description.trim()||undefined,recurrence:repeat,priority,categoryId:category||undefined,estimatedMinutes:estimate?Number(estimate):undefined};if(editChore)await updateChore({...editChore,...values});else await addChore(values);const action=pendingWhileBusy.current;pendingWhileBusy.current=null;onClose();action?.();}catch(e){setError(e instanceof Error?e.message:'Could not save this chore. Please try again.');}finally{busyRef.current=false;setBusy(false);}}
 const input=(label:string,id:string,value:string,change:(s:string)=>void,type='text',required=false)=><label className="chore-label" htmlFor={id}>{label}<input className="chore-input" id={id} ref={id==='chore-title'?titleRef:undefined} value={value} type={type} required={required} onChange={e=>change(e.target.value)}/></label>;
 const footer=<><button type="button" className="chore-button secondary" disabled={busy} onClick={close}>Cancel</button><button className="chore-button primary" type="submit" form="chore-edit-form" disabled={busy}>{busy?'Saving…':editChore?'Save changes':'Add chore'}</button></>;
 const discardFooter=<><button ref={keepRef} type="button" className="chore-button secondary" onClick={keepEditing}>Keep editing</button><button type="button" className="chore-button secondary" onClick={discard}>Discard changes</button></>;
 const discardContent=<section className="nesmi-discard-confirmation" aria-label="Unsaved changes"><p>{draftName?<>Your changes to <strong>{draftName}</strong> haven’t been saved.</>:<>Your new chore has unsaved details.</>}</p><p className="nesmi-discard-fields">Changed: {changedFields.map(key=>fieldNames[key]).join(", ")}.</p></section>;
 const form=<>
 <form id="chore-edit-form" className={presentation==='sheet'?'nesmi-chore-sheet':undefined} ref={formRef} hidden={confirmDiscard&&!inline} onSubmit={save}><fieldset className="nesmi-chore-fields" disabled={busy}>
 {editChore?.recurrence!=='none'&&editChore&&<p className="chore-notice">You are editing the repeating series, starting {editChore.date}. Changes apply to all occurrences{instanceDate&&instanceDate!==editChore.date?`, not just ${instanceDate}`:''}.</p>}
 {error&&<p className="chore-error" role="alert" tabIndex={-1} ref={errorRef}>{error} Your entries are still here.</p>}
 {input('Chore','chore-title',title,setTitle,'text',true)}
 <label className="chore-label" htmlFor="chore-member">Person<ChoicePicker id="chore-member" className="chore-input" label="Person" value={member} onChange={setMember} options={[{id:'',label:'Unassigned'},...state.teamMembers.map(m=>({id:m.id,label:m.name}))]}/></label>
 {input('Date','chore-date',date,setDate,'date',true)}
 <details className="chore-more" open={hasDefaultDetails||undefined}><summary>Details <small>Time, repeat and notes</small></summary>
 <div className="chore-time-row">{input('Start time · optional','chore-start',start,setStart,'time')}{input('End time · optional','chore-end',end,setEnd,'time')}</div><p className="chore-muted">Optional. Leave times blank for all day.</p>
 <label className="chore-label" htmlFor="chore-repeat">Repeat<ChoicePicker id="chore-repeat" className="chore-input" label="Repeat" value={repeat} onChange={value=>setRepeat(value as RecurrenceType)} options={[{id:'none',label:'Does not repeat'},{id:'daily',label:'Every day'},{id:'weekly',label:'Every week'},{id:'monthly',label:'Every month'}]}/></label>
 <label className="chore-label" htmlFor="chore-notes">Notes · optional<textarea id="chore-notes" className="chore-input" rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label>
 <details className="chore-advanced" open={hasAdvancedDetails||undefined}><summary>Advanced</summary>
 <label className="chore-label" htmlFor="chore-priority">Priority<ChoicePicker id="chore-priority" className="chore-input" label="Priority" value={priority} onChange={value=>setPriority(value as Priority)} options={[{id:'low',label:'Low'},{id:'medium',label:'Normal'},{id:'high',label:'High'}]}/></label>
 {state.categories.length>0&&<label className="chore-label" htmlFor="chore-category">Category<ChoicePicker id="chore-category" className="chore-input" label="Category" value={category} onChange={setCategory} options={[{id:'',label:'No category'},...state.categories.map(c=>({id:c.id,label:c.name}))]}/></label>}
 {input('Estimated minutes · optional','chore-estimate',estimate,setEstimate,'number')}
 </details>
 </details>

 {!inline&&editChore&&<div className="chore-delete"><button type="button" disabled={busy} className="chore-button danger" onClick={()=>setConfirmDelete(true)}>Delete {editChore.recurrence==='none'?'chore':'series'}</button></div>}
 </fieldset></form></>;
 const deleteDialog=confirmDelete&&editChore?<DeleteChoreDialog chore={editChore} onClose={()=>setConfirmDelete(false)} onDeleted={onClose}/>:null;
 if(inline)return <><section className="nesmi-inline-editor" aria-label={`Edit ${editChore?.title||'chore'}`} onKeyDown={event=>{if(event.key==='Escape'&&!event.defaultPrevented){event.preventDefault();event.stopPropagation();close();}}}>
   <div className="nesmi-inline-editor-heading"><h4>Edit chore</h4><span>Your changes are saved only when you choose Save.</span></div>
   {form}<div className="nesmi-inline-editor-footer">{footer}</div>
 </section>{confirmDiscard&&<Dialog title="Discard changes?" variant="centered" onClose={keepEditing} initialFocusRef={keepRef} footer={discardFooter}>{discardContent}</Dialog>}{deleteDialog}</>;
 return <><Dialog title={confirmDiscard?'Discard changes?':editChore?'Edit chore':'Add a chore'} variant={confirmDiscard?'centered':'dialog'} onClose={close} busy={busy} initialFocusRef={titleRef} footer={confirmDiscard?discardFooter:footer}>
   {confirmDiscard&&discardContent}{form}
 </Dialog>{deleteDialog}</>;
});
