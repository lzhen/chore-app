import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {Dashboard} from './Dashboard';
import {AccountSettings} from './AccountSettings';
import type {Chore, ChoreCompletion, TeamMember} from '../types';
import {dateKey, shiftDate} from '../utils/dates';
const auth=vi.hoisted(()=>({user:{email:'sample@example.test'},signOut:vi.fn(),deleteAccount:vi.fn()}));
const appState=vi.hoisted(()=>({chores:[] as Chore[],teamMembers:[] as TeamMember[],completions:[] as ChoreCompletion[]}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('../context/AppContext',()=>({useApp:()=>({state:appState})}));
vi.mock('./ThemeSelector',()=>({ThemeSelector:()=> <button>Appearance</button>}));
afterEach(()=>{
 cleanup();
 appState.chores=[];
 appState.teamMembers=[];
 appState.completions=[];
});
describe('shared product surfaces',()=>{
 it('renders embedded insights as a page and keeps every section available',async()=>{
  const {container}=render(<Dashboard embedded onClose={vi.fn()}/>);
  expect(container.querySelector('.nesmi-page-content')).toBeInTheDocument();
  expect(container.querySelector('.fluent-card')).not.toBeInTheDocument();
  const user=userEvent.setup();
  for(const name of ['Activity','Workload','Achievements','Overview']) {
   await user.click(screen.getByRole('button',{name}));
   expect(screen.getByRole('button',{name})).toHaveAttribute('aria-pressed','true');
  }
 });
 it('shows household totals and recent completions without ranking members',()=>{
  const today=dateKey();
  const yesterday=shiftDate(today,-1);
  const defaults={recurrence:'none',priority:'medium'} as const;
  appState.teamMembers=[
   {id:'alex',name:'Alex',color:'#448844',points:30,badges:[]},
   {id:'robin',name:'Robin',color:'#444488',points:10,badges:[]},
  ];
  appState.chores=[
   {...defaults,id:'plants',title:'Water plants',date:today,assigneeId:'alex'},
   {...defaults,id:'dishes',title:'Wash dishes',date:yesterday,assigneeId:'robin'},
   {...defaults,id:'towels',title:'Fold towels',date:today,assigneeId:'robin'},
   {...defaults,id:'mail',title:'Sort mail',date:yesterday,assigneeId:'alex'},
  ];
  appState.completions=[
   {id:'c1',choreId:'plants',instanceDate:today,completedBy:'alex',completedAt:new Date().toISOString()},
   {id:'c2',choreId:'dishes',instanceDate:yesterday,completedBy:'robin',completedAt:new Date(Date.now()-86400000).toISOString()},
  ];

  render(<Dashboard embedded onClose={vi.fn()}/>);

  expect(screen.queryByRole('heading',{name:'Leaderboard'})).not.toBeInTheDocument();
  for(const [label,value] of [['Completed Today','1'],['Pending Today','1'],['Overdue','1'],['This Week','2']]) {
   expect(within(screen.getByText(label).parentElement!).getByText(value)).toBeInTheDocument();
  }
  const recent=within(screen.getByRole('heading',{name:'Recent Completions'}).parentElement!);
  expect(recent.getByText('Water plants')).toBeInTheDocument();
  expect(recent.getByText('by Alex')).toBeInTheDocument();
  expect(recent.getByText('Wash dishes')).toBeInTheDocument();
  expect(recent.getByText('by Robin')).toBeInTheDocument();
 });
 it('counts only unfinished chore occurrences scheduled for today',()=>{
  vi.useFakeTimers({toFake:['Date']});
  try {
   vi.setSystemTime(new Date(2026,1,28,12));
   const today=dateKey();
   const yesterday=shiftDate(today,-1);
   const defaults={priority:'medium',assigneeId:'alex'} as const;
   appState.chores=[
    {...defaults,id:'daily',title:'Wash dishes',date:yesterday,recurrence:'daily'},
    {...defaults,id:'weekly',title:'Do laundry',date:shiftDate(today,-7),recurrence:'weekly'},
    {...defaults,id:'monthly',title:'Check filters',date:'2026-01-31',recurrence:'monthly'},
    {...defaults,id:'done',title:'Feed pets',date:yesterday,recurrence:'daily'},
    {...defaults,id:'off-cycle',title:'Water plants',date:yesterday,recurrence:'weekly'},
    {...defaults,id:'future',title:'Buy groceries',date:shiftDate(today,1),recurrence:'daily'},
    {...defaults,id:'once',title:'Fold towels',date:today,recurrence:'none'},
    {...defaults,id:'past',title:'Sort mail',date:yesterday,recurrence:'none'},
   ];
   appState.completions=[
    {id:'prior',choreId:'daily',instanceDate:yesterday,completedBy:'alex',completedAt:`${yesterday}T12:00:00`},
    {id:'current',choreId:'done',instanceDate:today,completedBy:'alex',completedAt:`${today}T12:00:00`},
   ];

   render(<Dashboard embedded onClose={vi.fn()}/>);

   expect(within(screen.getByText('Pending Today').parentElement!).getByText('4')).toBeInTheDocument();
  } finally {
   vi.useRealTimers();
  }
 });
 it('keeps account actions behind explicit activation, with cancellable deletion',async()=>{
  const {container}=render(<AccountSettings embedded isOpen onClose={vi.fn()}/>);
  expect(container.querySelector('.nesmi-page-content')).toBeInTheDocument();
  expect(container.querySelector('.fluent-card')).not.toBeInTheDocument();
  expect(screen.getByText('sample@example.test')).toBeInTheDocument();
  const user=userEvent.setup();
  await user.click(screen.getByRole('button',{name:'Delete my account'}));
  expect(screen.getByRole('button',{name:'Delete permanently'})).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Cancel'}));
  expect(screen.queryByRole('button',{name:'Delete permanently'})).not.toBeInTheDocument();
  expect(auth.signOut).not.toHaveBeenCalled();expect(auth.deleteAccount).not.toHaveBeenCalled();
 });
});
