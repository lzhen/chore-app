import {describe, expect, it} from 'vitest';
import type {Chore} from '../types';
import {moveChoreSchedule} from './calendarSchedule';
import {generateChoreInstances} from './recurrence';
import {parseDate} from './dates';
const monthly:Chore={id:'monthly',title:'Monthly task',date:'2026-01-31',recurrence:'monthly',assigneeId:null,priority:'medium',dueTime:'09:00',endTime:'09:15'};
const at=(day:string,time='09:00')=>new Date(`${day}T${time}:00`);
describe('series moves respect actual recurrence generation',()=>{
 it.each([
  ['2026-01-31','2026-02-28','2026-02-27'],
  ['2028-01-31','2028-02-29','2028-02-28'],
  ['2026-03-31','2026-04-30','2026-04-29'],
 ])('rejects clamped monthly origin %s, instance %s moved to %s',(origin,from,to)=>{
  const chore={...monthly,date:origin};
  expect(generateChoreInstances([chore],[],[],parseDate(from),parseDate(from))).toHaveLength(1);
  expect(()=>moveChoreSchedule(chore,at(from),at(to),false)).toThrow(/monthly schedule/);
  expect(()=>moveChoreSchedule(chore,at(from),at(to),true)).toThrow(/monthly schedule/);
 });
 it.each([
  ['monthly','2026-01-15','2026-02-15','2026-02-16','2026-01-16'],
  ['monthly','2026-01-31','2026-03-31','2026-03-30','2026-01-30'],
  ['monthly','2028-01-31','2028-02-29','2028-03-01','2028-02-01'],
  ['monthly','2026-01-31','2026-02-28','2026-02-28','2026-01-31'],
  ['weekly','2026-01-05','2026-02-02','2026-02-03','2026-01-06'],
 ] as const)('accepts representable %s move %s / %s to %s',(recurrence,origin,from,to,newOrigin)=>{
  const moved=moveChoreSchedule({...monthly,recurrence,date:origin},at(from),at(to,'10:30'),false);
  expect(moved.date).toBe(newOrigin);expect(moved.dueTime).toBe('10:30');expect(moved.endTime).toBe('10:45');
  expect(generateChoreInstances([moved],[],[],parseDate(to),parseDate(to))).toEqual([expect.objectContaining({date:to,dueTime:'10:30',endTime:'10:45'})]);
 });
});
