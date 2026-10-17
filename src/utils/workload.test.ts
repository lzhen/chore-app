import {expect,it} from 'vitest';
import {summarizeWorkload,workloadRange} from './workload';
import {findChores,findChore} from './chatAgent';
import {Chore,TeamMember} from '../types';
const member:TeamMember={id:'a',name:'Alex',color:'#000',points:0,badges:[]};
const chore=(extra:Partial<Chore>={}):Chore=>({id:'1',title:'Dishes',date:'2026-10-17',recurrence:'none',assigneeId:'a',priority:'medium',...extra});
it('counts exactly 7 days including today, not 8; unknown estimate/capacity stay unknown',()=>{
 const range=workloadRange('2026-10-17');expect(range).toEqual({start:'2026-10-17',end:'2026-10-23'});
 const [row]=summarizeWorkload([member],[chore({recurrence:'daily'})],range);expect(row.count).toBe(7);expect(row.missingEstimates).toBe(7);expect(row.capacityMinutes).toBeNull();expect(row.utilization).toBeNull();
});
it('uses weekly anchors and month-end clamp from the calendar, not approximate multipliers',()=>{
 const [weekly]=summarizeWorkload([member],[chore({date:'2026-10-11',recurrence:'weekly',estimatedMinutes:10})],workloadRange('2026-10-17'));expect(weekly.count).toBe(1);expect(weekly.estimatedMinutes).toBe(10);
 const [monthly]=summarizeWorkload([member],[chore({date:'2026-01-31',recurrence:'monthly',estimatedMinutes:15})],workloadRange('2026-02-26'));expect(monthly.count).toBe(1);expect(monthly.estimatedMinutes).toBe(15);
});
it('preserves explicit zero, excludes out-of-range chores, and suppresses ratios for incomplete estimates',()=>{
 const [row]=summarizeWorkload([{...member,weeklyCapacityMinutes:60}],[chore({estimatedMinutes:0}),chore({id:'2'}),chore({id:'3',date:'2026-10-24',estimatedMinutes:999})],workloadRange('2026-10-17'));expect(row.count).toBe(2);expect(row.missingEstimates).toBe(1);expect(row.estimatedMinutes).toBe(0);expect(row.utilization).toBeNull();
 const [known]=summarizeWorkload([{...member,weeklyCapacityMinutes:60}],[chore({estimatedMinutes:30})],workloadRange('2026-10-17'));expect(known.utilization).toBe(50);
});
it('never exposes a first fuzzy or duplicate match through the old single-result helper',()=>{
 const chores=[chore({title:'Wash dishes'}),chore({id:'2',title:'Wash windows'})];expect(findChore('wash',chores)).toBeNull();expect(findChores('wash',chores)).toHaveLength(2);expect(findChore('',chores)).toBeNull();expect(findChore('Wash dishes',chores)?.id).toBe('1');expect(findChore('Dishes',[chore(),chore({id:'2'})])).toBeNull();
});
it('monthly tasks outside the seven-day range do not appear, including before start',()=>{
 expect(summarizeWorkload([member],[chore({date:'2026-01-31',recurrence:'monthly',estimatedMinutes:10})],workloadRange('2026-10-17'))[0].count).toBe(0);
 expect(summarizeWorkload([member],[chore({date:'2026-10-24',recurrence:'daily',estimatedMinutes:10})],workloadRange('2026-10-17'))[0].count).toBe(0);
});
it('command summaries include recurring occurrences and use a bounded rolling range',async()=>{
 const {generateResponse}=await import('./chatAgent');const {dateKey,shiftDate}=await import('./dates');const today=dateKey();
 const context={chores:[chore({date:shiftDate(today,-20),recurrence:'daily'})],teamMembers:[member],completions:[-7,-6,0,1].map((offset,i)=>({id:String(i),choreId:'other',instanceDate:shiftDate(today,offset),completedAt:new Date().toISOString(),completedBy:'a'}))};
 const stats=generateResponse({type:'show_stats'},context).text;expect(stats).toContain('Last 7 days:');expect(stats).toContain('Completed: 2');expect(stats).toContain('Pending today: 1');expect(stats).not.toContain('This Week');
 const list=generateResponse({type:'list_chores'},context).text;expect(list).toContain('Next 7 days');expect(list.match(/Dishes/g)).toHaveLength(7);
});
it('empty command summaries retain their date and recurrence scope',async()=>{
 const {generateResponse}=await import('./chatAgent');const context={chores:[],teamMembers:[],completions:[]};
 expect(generateResponse({type:'show_overdue'},context).text).toBe('No overdue one-off chores.');
 expect(generateResponse({type:'list_chores'},context).text).toBe('No pending occurrences in the next 7 days.');
});
