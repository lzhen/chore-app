import { Chore, ChoreInstance, TeamMember, ChoreCompletion } from '../types';
import { dateKey, parseDate } from './dates';
export function generateChoreInstances(chores:Chore[], members:TeamMember[], completions:ChoreCompletion[], rangeStart:Date, rangeEnd:Date):ChoreInstance[]{
 const result:ChoreInstance[]=[];const map=new Map(members.map(m=>[m.id,m]));
 const done=new Set(completions.map(c=>`${c.choreId}-${c.instanceDate}`));
 const from=dateKey(rangeStart),to=dateKey(rangeEnd);
 for(const chore of chores){
  const member=chore.assigneeId?map.get(chore.assigneeId):undefined;
  const emit=(day:string)=>{if(day<from||day>to)return;result.push({id:chore.recurrence==='none'?chore.id:`${chore.id}-${day}`,choreId:chore.id,title:chore.title,description:chore.description,date:day,dueTime:chore.dueTime,endTime:chore.endTime,allDay:!chore.dueTime,assigneeId:chore.assigneeId,assigneeName:member?.name,color:member?.color||'#64748b',isRecurring:chore.recurrence!=='none',priority:chore.priority,categoryId:chore.categoryId,isCompleted:done.has(`${chore.id}-${day}`)});};
  if(chore.recurrence==='none'){emit(chore.date);continue;}
  const origin=parseDate(chore.date);if(!Number.isFinite(origin.getTime()))continue;
  if(!['daily','weekly','monthly'].includes(chore.recurrence))continue;
  let current=new Date(origin); let offset=0;
  if(chore.recurrence==='monthly'){
   const start=parseDate(from);offset=Math.max(0,(start.getFullYear()-origin.getFullYear())*12+start.getMonth()-origin.getMonth());
  } else {
   const step=chore.recurrence==='weekly'?7:1;
   const days=Math.floor((Date.UTC(...[parseDate(from).getFullYear(),parseDate(from).getMonth(),parseDate(from).getDate()] as [number,number,number])-Date.UTC(origin.getFullYear(),origin.getMonth(),origin.getDate()))/86400000);
   offset=Math.max(0,Math.floor(days/step));
  }
  for(let count=0;count<2000;count++,offset++){
   if(chore.recurrence==='monthly'){
    current=new Date(origin.getFullYear(),origin.getMonth()+offset,1,12);
    current.setDate(Math.min(origin.getDate(),new Date(current.getFullYear(),current.getMonth()+1,0).getDate()));
   }else {current=new Date(origin);current.setDate(origin.getDate()+offset*(chore.recurrence==='weekly'?7:1));}
   const day=dateKey(current);if(day>to)break;emit(day);
  }
 }
 return result;
}
export function getCalendarRange():{start:Date;end:Date}{const now=new Date();return {start:new Date(now.getFullYear(),now.getMonth()-1,1),end:new Date(now.getFullYear(),now.getMonth()+4,0)};}
