import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ChoreInstance } from '../types';
import { Dialog } from './Dialog';
import { ChoicePicker } from './ChoicePicker';
import { formatDay } from '../utils/dates';
export function CompletionDialog({instance,onClose}:{instance:ChoreInstance;onClose:()=>void}){
 const {state,completeChore,uncompleteChore}=useApp();
 const [member,setMember]=useState(instance.assigneeId||''); const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function submit(){
  if(busy)return;
  if(!instance.isCompleted&&!member){setError('Choose who completed this chore.');return;}
  setBusy(true);setError('');
  try{
   if(instance.isCompleted){const c=state.completions.find(c=>c.choreId===instance.choreId&&c.instanceDate===instance.date);if(!c)throw Error('This completion is no longer available. Refresh and try again.');await uncompleteChore(c.id);}
   else await completeChore(instance.choreId,instance.date,member);
   onClose();
  }catch(e){setError(e instanceof Error?e.message:'Could not save. Please try again.');}finally{setBusy(false);}
 }
 return <Dialog title={instance.isCompleted?'Undo completion':'Complete chore'} onClose={onClose} busy={busy} footer={<><button className="chore-button secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="chore-button secondary" onClick={submit} disabled={busy||(!instance.isCompleted&&!member)}>{busy?'Saving…':instance.isCompleted?'Mark not done':'Mark done'}</button></>}>
  <section className="nesmi-completion-content"><h3 className="completion-title">{instance.title}</h3><p className="chore-muted">{formatDay(instance.date)}</p>
  {instance.isCompleted?<p>This occurrence will return to your to-do list.</p>:<><label className="chore-label" htmlFor="completed-by">Who completed it?</label><ChoicePicker id="completed-by" className="chore-input nesmi-member-picker" label="Who completed it?" value={member} onChange={setMember} placeholder="Choose a family member" options={state.teamMembers.map(m=>({id:m.id,label:m.name}))}/>{!state.teamMembers.length&&<p className="chore-muted">Add a family member in the family menu first. No one has been credited.</p>}</>}
  {error&&<p className="chore-error" role="alert">{error}</p>}
 </section></Dialog>;
}
