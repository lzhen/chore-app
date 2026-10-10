import {cleanup,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {EventPopover} from './EventPopover';
import {Chore,ChoreInstance} from '../types';
afterEach(cleanup);
const chore={id:'one',title:'Tidy the living room',date:'2026-10-10',assigneeId:'eric',recurrence:'none',priority:'medium'} as Chore;
const instance={id:'one-2026-10-10',choreId:'one',title:chore.title,date:chore.date,assigneeId:'eric',assigneeName:'Eric',color:'#EC4899',priority:'medium',isCompleted:true,isRecurring:false,dueTime:'09:00',endTime:'10:00',description:'Put books away'} as ChoreInstance;
describe('centered task details',()=>{
 it('uses centered modal layout instead of an edge position; completion uses enabled Cancel styling',async()=>{
  const complete=vi.fn(),edit=vi.fn(),close=vi.fn(),user=userEvent.setup();render(<EventPopover chore={chore} instance={instance} position={{x:9999,y:9999}} onComplete={complete} onEdit={edit} onClose={close}/>);
  const dialog=screen.getByRole('dialog',{name:chore.title});expect(dialog.parentElement).toHaveClass('is-centered');expect(dialog).not.toHaveAttribute('style');
  expect(screen.getByText(/09:00 – 10:00/)).toBeInTheDocument();expect(screen.getByText('Eric')).toBeInTheDocument();expect(screen.getByText('Put books away')).toBeInTheDocument();
  const toggle=screen.getByRole('button',{name:'Mark incomplete'});expect(toggle).toBeEnabled();expect(toggle).toHaveClass('chore-button','secondary');await user.click(toggle);expect(complete).toHaveBeenCalledOnce();
  await user.click(screen.getByRole('button',{name:'Edit'}));expect(edit).toHaveBeenCalledOnce();await user.keyboard('{Escape}');expect(close).toHaveBeenCalledOnce();
 });
 it('outside click closes and pending chores keep the same enabled secondary action',async()=>{
  const close=vi.fn(),user=userEvent.setup();const {container}=render(<EventPopover chore={chore} instance={{...instance,isCompleted:false}} position={{x:0,y:0}} onComplete={vi.fn()} onEdit={vi.fn()} onClose={close}/>);
  expect(screen.getByRole('button',{name:'Mark complete'})).toHaveClass('secondary');
  await user.click(screen.getByRole('dialog').parentElement!);expect(close).toHaveBeenCalledOnce();expect(container).toBeInTheDocument();
 });
});
