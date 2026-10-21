import {render, screen, cleanup, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {ChatAssistant} from './ChatAssistant';
import {dateKey, shiftDate} from '../utils/dates';
const mock = vi.hoisted(() => ({state: {chores: [] as any[], teamMembers: [{id:'a',name:'Alex'},{id:'b',name:'Sam'}], completions: [] as any[]}, addChore:vi.fn(), updateChore:vi.fn(), completeChore:vi.fn()}));
vi.mock('../context/AppContext',()=>({useApp:()=>mock}));
beforeEach(()=>{Element.prototype.scrollIntoView=vi.fn();mock.state.teamMembers=[{id:"a",name:"Alex"},{id:"b",name:"Sam"}];mock.state.chores=[];mock.state.completions=[];mock.completeChore.mockResolvedValue(undefined);mock.updateChore.mockResolvedValue(undefined);});
afterEach(cleanup);
it.each(['add a chore called', 'create a task named', 'new chore', 'add a chore called: ', 'ADD A CHORE CALLED'])('asks for a name without saving incomplete command %s', async text => {
 render(<ChatAssistant active/>);await command(text);
 expect(screen.getByRole('log')).toHaveTextContent('Please add a chore name');
 expect(mock.addChore).not.toHaveBeenCalled();expect(mock.updateChore).not.toHaveBeenCalled();expect(mock.completeChore).not.toHaveBeenCalled();
 expect(screen.getByRole('log')).not.toHaveTextContent('Could not save');
});
it('lets the quick-action starter be completed after an incomplete submission', async () => {
 render(<ChatAssistant active/>);await userEvent.click(screen.getByRole('button',{name:'Add a chore'}));
 await userEvent.click(screen.getByRole('button',{name:'Send message'}));expect(mock.addChore).not.toHaveBeenCalled();
 await command('add a chore called Wash dishes');
 expect(mock.addChore).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({title:'Wash dishes',date:dateKey()}));
 expect(screen.getByRole('log')).toHaveTextContent('Added “Wash dishes”.');
});
it.each(['create a task named Wash dishes','new task: Wash dishes','add chore Wash dishes'])('preserves complete command %s', async text => {
 render(<ChatAssistant active/>);await command(text);
 expect(mock.addChore).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({title:'Wash dishes'}));
});
const chore=(id:string,title:string,extra={})=>({id,title,date:dateKey(),assigneeId:'a',recurrence:'none',priority:'medium',...extra});
async function command(text:string){await userEvent.type(screen.getByRole('textbox',{name:'Message'}),text);await userEvent.click(screen.getByRole('button',{name:'Send message'}));}
it('requires explicit choice for fuzzy and duplicate exact titles; mutates only selected ID',async()=>{
 mock.state.chores=[chore('1','Wash dishes'),chore('2','Wash windows')];render(<ChatAssistant active/>);
 await command('complete wash');expect(mock.completeChore).not.toHaveBeenCalled();
 await userEvent.click(screen.getByRole('button',{name:/Wash windows ·/}));expect(mock.completeChore).toHaveBeenCalledWith('2',dateKey(),'a');
 mock.completeChore.mockClear();mock.state.chores=[chore('1','Wash'),chore('2','Wash')];
 await command('complete Wash');expect(mock.completeChore).not.toHaveBeenCalled();expect(within(screen.getByRole('group',{name:'Choose a chore'})).getAllByRole('button')).toHaveLength(3);
});
it('requires a completer for unassigned chores and never defaults to first member',async()=>{
 mock.state.chores=[chore('1','Dishes',{assigneeId:null})];render(<ChatAssistant active/>);await command('complete Dishes');expect(mock.completeChore).not.toHaveBeenCalled();
 await userEvent.click(screen.getByRole('button',{name:'Sam'}));expect(mock.completeChore).toHaveBeenCalledWith('1',dateKey(),'b');
});
it('assign ambiguity cannot write before explicit selection; cancellation writes nothing',async()=>{
 mock.state.chores=[chore('1','Wash dishes'),chore('2','Wash windows')];render(<ChatAssistant active/>);await command('assign wash to Sam');expect(mock.updateChore).not.toHaveBeenCalled();await userEvent.click(screen.getByRole('button',{name:'Cancel selection'}));expect(mock.updateChore).not.toHaveBeenCalled();
 await command('assign wash to Sam');await userEvent.click(screen.getByRole('button',{name:/Wash windows ·/}));expect(mock.updateChore).toHaveBeenCalledWith(expect.objectContaining({id:'2',assigneeId:'b'}));
});
it('uses the one-off instance date and does not complete an unscheduled recurring date',async()=>{
 mock.state.chores=[chore('1','Dishes',{date:shiftDate(dateKey(),-2)}),chore('2','Windows',{date:shiftDate(dateKey(),-1),recurrence:'weekly'})];render(<ChatAssistant active/>);
 await command('complete Dishes');expect(mock.completeChore).toHaveBeenCalledWith('1',shiftDate(dateKey(),-2),'a');mock.completeChore.mockClear();await command('complete Windows');expect(mock.completeChore).not.toHaveBeenCalled();expect(screen.getByRole('log')).toHaveTextContent('No occurrence today');
});
it('handles failed writes without claiming completion',async()=>{
 mock.state.chores=[chore('1','Dishes')];mock.completeChore.mockRejectedValue(new Error('offline'));render(<ChatAssistant active/>);await command('complete Dishes');expect(screen.getByRole('log')).toHaveTextContent('Could not save');expect(screen.getByRole('log')).not.toHaveTextContent('Completed “');
});

it.each(["don't complete Dishes", "never mind", "cancel", "a random sentence", "complete Dishes yesterday", "add a chore called Dishes for February 5", "add a chore called Dishes on 2026-02-30"])('does not mutate for unsupported command %s',async text=>{
 mock.state.chores=[chore('1','Dishes',{recurrence:'daily'})];render(<ChatAssistant active/>);await command(text);
 expect(mock.addChore).not.toHaveBeenCalled();expect(mock.completeChore).not.toHaveBeenCalled();expect(mock.updateChore).not.toHaveBeenCalled();
});
it('preserves ISO dates when creating',async()=>{
 render(<ChatAssistant active/>);await command('add a chore called Dishes on 2026-10-23');expect(mock.addChore).toHaveBeenCalledWith(expect.objectContaining({title:'Dishes',date:'2026-10-23'}));
});
it.each(['assign Dishes to Al','add a chore called Dishes assigned to Al'])('requires explicit member selection for %s',async text=>{
 mock.state.teamMembers=[{id:'a',name:'Alex'},{id:'b',name:'Alexa'}];mock.state.chores=[chore('1','Dishes')];render(<ChatAssistant active/>);await command(text);
 expect(mock.addChore).not.toHaveBeenCalled();expect(mock.updateChore).not.toHaveBeenCalled();await userEvent.click(screen.getByRole('button',{name:'Alexa'}));
 const save=text.startsWith('assign')?mock.updateChore:mock.addChore;expect(save).toHaveBeenCalledWith(expect.objectContaining({assigneeId:'b'}));
});
it('distinguishes duplicate member names',async()=>{
 mock.state.teamMembers=[{id:'a',name:'Alex'},{id:'b',name:'Alex'}];mock.state.chores=[chore('1','Dishes',{assigneeId:null})];render(<ChatAssistant active/>);await command('complete Dishes');expect(mock.completeChore).not.toHaveBeenCalled();await userEvent.click(screen.getByRole('button',{name:'Alex · Member b'}));expect(mock.completeChore).toHaveBeenCalledWith('1',dateKey(),'b');
});
it.each(['assign Dishes to Alex','add a chore called Dishes assigned to Alex'])('requires selection for duplicate exact member names: %s',async text=>{
 mock.state.teamMembers=[{id:'a',name:'Alex'},{id:'b',name:'Alex'}];mock.state.chores=[chore('1','Dishes')];render(<ChatAssistant active/>);await command(text);
 expect(mock.addChore).not.toHaveBeenCalled();expect(mock.updateChore).not.toHaveBeenCalled();await userEvent.click(screen.getByRole('button',{name:'Alex · Member b'}));
 const save=text.startsWith('assign')?mock.updateChore:mock.addChore;expect(save).toHaveBeenCalledWith(expect.objectContaining({assigneeId:'b'}));
});
