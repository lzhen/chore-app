import {describe,it,expect} from 'vitest';
import {dateKey,parseDate,shiftDate,formatDay} from './dates';
import {generateChoreInstances} from './recurrence';
import {Chore} from '../types';
const chore:Chore={id:'test',title:'Water plants',date:'2026-01-01',recurrence:'daily',assigneeId:null,priority:'medium'};
describe('calendar-date stability',()=>{
 it('round trips a calendar date without converting to UTC',()=>{expect(dateKey(parseDate('2026-09-27'))).toBe('2026-09-27');});
 it('labels explicit today and tomorrow',()=>{expect(formatDay('2026-09-25','2026-09-25')).toBe('Today');expect(formatDay('2026-09-26','2026-09-25')).toBe('Tomorrow');});
 it('preserves weekday when formatting',()=>{expect(formatDay('2026-09-27','2026-09-25')).toBe('Sun, Sep 27');});
 it('adds calendar days across daylight-saving changes',()=>{expect(shiftDate('2026-03-08',1)).toBe('2026-03-09');expect(shiftDate('2026-11-01',1)).toBe('2026-11-02');});
 it('does not lose daily chores more than 100 days after creation',()=>{const a=generateChoreInstances([chore],[],[],parseDate('2026-09-25'),parseDate('2026-09-27'));expect(a.map(x=>x.date)).toEqual(['2026-09-25','2026-09-26','2026-09-27']);});
 it('clamps monthly days without drifting the following month',()=>{const a=generateChoreInstances([{...chore,date:'2026-01-31',recurrence:'monthly'}],[],[],parseDate('2026-01-01'),parseDate('2026-03-31'));expect(a.map(x=>x.date)).toEqual(['2026-01-31','2026-02-28','2026-03-31']);});
 it('keeps time fields and exact completion dates attached to an occurrence',()=>{const a=generateChoreInstances([{...chore,date:'2026-09-25',dueTime:'18:00',endTime:'19:00'}],[],[{id:'done',choreId:'test',instanceDate:'2026-09-25',completedBy:'member',completedAt:'2026-09-25T19:00Z'}],parseDate('2026-09-25'),parseDate('2026-09-26'));expect(a[0]).toMatchObject({date:'2026-09-25',dueTime:'18:00',endTime:'19:00',isCompleted:true});expect(a[1].isCompleted).toBe(false);});
});
