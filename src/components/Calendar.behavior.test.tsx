import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Chore } from '../types';
import { Calendar } from './Calendar';
const mock = vi.hoisted(() => ({props: {} as any, state:{chores:[] as Chore[], teamMembers:[], completions:[]}, updateChore:vi.fn()}));
vi.mock('../context/AppContext',()=>({useApp:()=>mock}));
vi.mock('@fullcalendar/react',async()=>{const {forwardRef}=await import('react');return {default:forwardRef((props:any,_ref)=>{mock.props=props;return null;})};});
const chore:Chore={id:'task',title:'15 minute task',date:'2026-01-05',dueTime:'09:00',endTime:'09:15',allDay:false,recurrence:'none',assigneeId:null,priority:'medium'};
function drop(start:string, end:string|null, options:any={}) {
 const oldStart=options.oldStart || '2026-01-05T09:00:00';
 return {event:{start:new Date(start),end:end?new Date(end):null,allDay:false,extendedProps:{choreId:'task',isRecurring:mock.state.chores[0].recurrence!=='none'},...options.event},oldEvent:{start:new Date(oldStart),end:new Date('2026-01-05T09:15:00'),allDay:false},revert:vi.fn()};
}
beforeEach(()=>{mock.state.chores=[{...chore}];mock.updateChore.mockReset().mockResolvedValue(undefined);vi.spyOn(window,'confirm').mockReturnValue(true);});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function mount(){render(<Calendar onAddClick={vi.fn()} onEventClick={vi.fn()}/>);}
it('regenerates the full visible range including leading and trailing dates',()=>{
 mock.state.chores=[{...chore,date:'2020-01-01',recurrence:'daily'}];mount();
 act(()=>mock.props.datesSet?.({start:new Date('2030-03-31T00:00:00'),end:new Date('2030-05-12T00:00:00')}));
 const dates=mock.props.events.map((e:any)=>e.start.slice(0,10));
 expect(dates).toContain('2030-03-31');expect(dates).toContain('2030-05-11');expect(dates).not.toContain('2030-05-12');
 act(()=>mock.props.datesSet?.({start:new Date('2021-01-31T00:00:00'),end:new Date('2021-03-07T00:00:00')}));
 expect(mock.props.events[0].start).toContain('2021-01-31');expect(mock.props.events.at(-1).start).toContain('2021-03-06');
});
it('keeps 15 minutes when moved to a different date and time',async()=>{mount();const info=drop('2026-01-06T10:30:00','2026-01-06T10:45:00');await act(()=>mock.props.eventDrop(info));expect(mock.updateChore).toHaveBeenCalledWith(expect.objectContaining({date:'2026-01-06',dueTime:'10:30',endTime:'10:45',allDay:false}));expect(info.revert).not.toHaveBeenCalled();});
it('shifts the series origin by the occurrence delta instead of deleting earlier occurrences',async()=>{mock.state.chores=[{...chore,recurrence:'weekly'}];mount();await act(()=>mock.props.eventDrop(drop('2026-02-03T10:30:00','2026-02-03T10:45:00',{oldStart:'2026-02-02T09:00:00'})));expect(window.confirm).toHaveBeenCalledOnce();expect(mock.updateChore).toHaveBeenCalledWith(expect.objectContaining({date:'2026-01-06',endTime:'10:45',recurrence:'weekly'}));});
it('cancels a recurring move without writing',async()=>{mock.state.chores=[{...chore,recurrence:'weekly'}];vi.mocked(window.confirm).mockReturnValue(false);mount();const info=drop('2026-01-06T09:00:00','2026-01-06T09:15:00');await act(()=>mock.props.eventDrop(info));expect(info.revert).toHaveBeenCalledOnce();expect(mock.updateChore).not.toHaveBeenCalled();});
it('rolls back failed saves and shows the failure',async()=>{mock.updateChore.mockRejectedValue(new Error('Save failed'));mount();const info=drop('2026-01-06T09:00:00','2026-01-06T09:15:00');await act(()=>mock.props.eventDrop(info));expect(info.revert).toHaveBeenCalledOnce();expect(screen.getByRole('alert')).toHaveTextContent('Save failed');});
it('reverts a move across midnight rather than corrupting the single-day time model',async()=>{mount();const info=drop('2026-01-06T23:50:00','2026-01-07T00:05:00');await act(()=>mock.props.eventDrop(info));expect(info.revert).toHaveBeenCalledOnce();expect(mock.updateChore).not.toHaveBeenCalled();expect(screen.getByRole('alert')).toHaveTextContent('same day');});
it('clears both time fields and sets allDay when moved to the all-day area',async()=>{mount();await act(()=>mock.props.eventDrop(drop('2026-01-06T00:00:00','2026-01-07T00:00:00',{event:{allDay:true}})));expect(mock.updateChore).toHaveBeenCalledWith(expect.objectContaining({allDay:true,dueTime:undefined,endTime:undefined}));});
it('keeps untimed tasks untimed when moved between dates',async()=>{mock.state.chores=[{...chore,dueTime:undefined,endTime:undefined,allDay:true}];mount();await act(()=>mock.props.eventDrop(drop('2026-01-06T00:00:00','2026-01-07T00:00:00',{event:{allDay:true}})));expect(mock.updateChore).toHaveBeenCalledWith(expect.objectContaining({date:'2026-01-06',allDay:true,dueTime:undefined,endTime:undefined}));});
it('does not persist a made-up end time for a task without one',async()=>{mock.state.chores=[{...chore,endTime:undefined}];mount();await act(()=>mock.props.eventDrop(drop('2026-01-06T10:00:00','2026-01-06T11:00:00')));expect(mock.updateChore).toHaveBeenCalledWith(expect.objectContaining({endTime:undefined}));});
it('uses stored recurrence scope even if event metadata is stale',async()=>{mock.state.chores=[{...chore,recurrence:'monthly'}];vi.mocked(window.confirm).mockReturnValue(false);mount();const info=drop('2026-02-06T09:00:00','2026-02-06T09:15:00',{event:{extendedProps:{choreId:'task',isRecurring:false}}});await act(()=>mock.props.eventDrop(info));expect(window.confirm).toHaveBeenCalledOnce();expect(info.revert).toHaveBeenCalledOnce();expect(mock.updateChore).not.toHaveBeenCalled();});
it('converts an all-day task to timed without inventing an estimate or explicit duration',async()=>{mock.state.chores=[{...chore,dueTime:undefined,endTime:undefined,allDay:true,estimatedMinutes:0}];mount();await act(()=>mock.props.eventDrop(drop('2026-01-06T10:00:00','2026-01-06T11:00:00',{oldStart:'2026-01-05T00:00:00'})));expect(mock.updateChore).toHaveBeenCalledWith(expect.objectContaining({date:'2026-01-06',dueTime:'10:00',endTime:undefined,allDay:false,estimatedMinutes:0}));});
it('reverts missing starts without writing',async()=>{mount();const info=drop('2026-01-06T10:00:00',null,{event:{start:null}});await act(()=>mock.props.eventDrop(info));expect(info.revert).toHaveBeenCalledOnce();expect(mock.updateChore).not.toHaveBeenCalled();});
it('moves a series across daylight saving using calendar days',async()=>{mock.state.chores=[{...chore,date:'2026-03-01',recurrence:'weekly'}];mount();await act(()=>mock.props.eventDrop(drop('2026-03-09T09:00:00','2026-03-09T09:15:00',{oldStart:'2026-03-08T09:00:00'})));expect(mock.updateChore).toHaveBeenCalledWith(expect.objectContaining({date:'2026-03-02',endTime:'09:15'}));});
it('keeps a time-only series move from resetting its origin',async()=>{mock.state.chores=[{...chore,recurrence:'weekly'}];mount();await act(()=>mock.props.eventDrop(drop('2026-02-02T10:00:00','2026-02-02T10:15:00',{oldStart:'2026-02-02T09:00:00'})));expect(mock.updateChore).toHaveBeenCalledWith(expect.objectContaining({date:'2026-01-05',dueTime:'10:00',endTime:'10:15'}));});
it('confirms series resize and reverts a rejected save',async()=>{mock.state.chores=[{...chore,recurrence:'weekly'}];mount();mock.updateChore.mockRejectedValue(new Error('Resize failed'));const info=drop('2026-01-05T09:00:00','2026-01-05T09:30:00');await act(()=>mock.props.eventResize(info));expect(window.confirm).toHaveBeenCalledOnce();expect(info.revert).toHaveBeenCalledOnce();expect(screen.getByRole('alert')).toHaveTextContent('Resize failed');});
it('rejects cross-day resize and all-day multi-day resize',async()=>{mount();for(const info of [drop('2026-01-05T23:30:00','2026-01-06T00:00:00'),drop('2026-01-05T00:00:00','2026-01-07T00:00:00',{event:{allDay:true}})]){await act(()=>mock.props.eventResize(info));expect(info.revert).toHaveBeenCalledOnce();}expect(mock.updateChore).not.toHaveBeenCalled();});
it('reverts an accepted monthly move when clamping prevents the requested target occurrence',async()=>{
 mock.state.chores=[{...chore,date:'2026-01-31',recurrence:'monthly'}];mount();
 const info=drop('2026-02-27T09:00:00','2026-02-27T09:15:00',{oldStart:'2026-02-28T09:00:00'});
 await act(()=>mock.props.eventDrop(info));expect(window.confirm).toHaveBeenCalledOnce();expect(mock.updateChore).not.toHaveBeenCalled();expect(info.revert).toHaveBeenCalledOnce();expect(screen.getByRole('alert')).toHaveTextContent('monthly schedule');
});
