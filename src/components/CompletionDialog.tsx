import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ChoreInstance } from '../types';
import { Dialog } from './Dialog';
import { formatDay } from '../utils/dates';
export function CompletionDialog({instance,onClose}:{instance:ChoreInstance;onClose:()=>void}){
 const {state,completeChore,uncompleteChore,addMember}=useApp();
 const [name,setName]=useState('');
 async function createMember(event:React.FormEvent){event.preventDefault();if(busy||!name.trim())return;setBusy(true);setError('');try{await addMember(name.trim());setName('');}catch(e){setError(e instanceof Error?e.message:'Could not add this member. Try again.');}finally{setBusy(false);}}
 const [member,setMember]=useState(state.teamMembers.some(m=>m.id===instance.assigneeId)?instance.assigneeId||'':''); const [busy,setBusy]=useState(false);const [error,setError]=useState('');
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
 return <Dialog title={instance.isCompleted?'Undo completion':'Complete chore'} onClose={onClose} busy={busy} footer={<><button className="chore-button secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="chore-button primary" onClick={submit} disabled={busy||(!instance.isCompleted&&!member)}>{busy?'Saving…':instance.isCompleted?'Mark not done':'Mark done'}</button></>}>
  <h3 className="completion-title">{instance.title}</h3><p className="chore-muted">{formatDay(instance.date)}</p>
  {instance.isCompleted?<p>This occurrence will return to your to-do list.</p>:<><label className="chore-label" htmlFor="completed-by">Who completed it?</label><select className="chore-input" id="completed-by" value={member} onChange={e=>setMember(e.target.value)}><option value="">Choose a family member</option>{state.teamMembers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>{!state.teamMembers.length&&<form className="completion-add-member" onSubmit={createMember}><p className="chore-muted">Add the person who did this chore, then choose them above.</p><label className="chore-label" htmlFor="completion-member-name">Name<input id="completion-member-name" className="chore-input" value={name} onChange={e=>setName(e.target.value)} required disabled={busy}/></label><button className="chore-button secondary" disabled={busy||!name.trim()} type="submit">{busy?'Adding…':'Add member'}</button></form>}</>}
  {error&&<p className="chore-error" role="alert">{error}</p>}
 </Dialog>;
}
