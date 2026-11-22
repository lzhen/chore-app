import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {Dashboard} from './Dashboard';
import {ListView} from './ListView';
import {AccountSettings} from './AccountSettings';
import type {Chore, ChoreCompletion, TeamMember} from '../types';
import {dateKey, shiftDate} from '../utils/dates';
const auth=vi.hoisted(()=>({user:{email:'sample@example.test'},signOut:vi.fn(),deleteAccount:vi.fn()}));
const appState=vi.hoisted(()=>({chores:[] as Chore[],teamMembers:[] as TeamMember[],completions:[] as ChoreCompletion[],categories:[]}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('../context/AppContext',()=>({useApp:()=>({state:appState})}));
vi.mock('./ThemeSelector',()=>({ThemeSelector:()=> <button>Appearance</button>}));
afterEach(()=>{
 cleanup();
 vi.useRealTimers();
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
  vi.useFakeTimers({toFake:['Date']});
  vi.setSystemTime(new Date(2026,1,25,12));
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
 it('shows the five newest completions in Overview and links to the full Activity feed',async()=>{
  vi.useFakeTimers({toFake:['Date']});
  vi.setSystemTime(new Date(2026,10,19,12));
  const today=dateKey();
  const tasks=[2,5,1,7,4,3,6];
  appState.chores=tasks.map(number=>({
   id:`chore-${number}`,title:`Household chore ${number}`,date:today,
   priority:'medium',recurrence:'none',assigneeId:'alex',
  }));
  appState.teamMembers=[{id:'alex',name:'Alex',color:'#448844',points:0,badges:[]}];
  appState.completions=tasks.map(number=>({
   id:`done-${number}`,choreId:`chore-${number}`,instanceDate:today,
   completedBy:'alex',completedAt:`${today}T00:00:0${number}Z`,
  }));

  render(<Dashboard embedded onClose={vi.fn()}/>);

  const recent=within(screen.getByRole('heading',{name:'Recent Completions'}).parentElement!);
  const choreTitles=/^Household chore \d$/;
  expect(recent.getAllByText(choreTitles).map(title=>title.textContent)).toEqual(
   [7,6,5,4,3].map(number=>`Household chore ${number}`),
  );
  expect(recent.getAllByText('by Alex')).toHaveLength(5);
  expect(within(screen.getByText('Completed Today').parentElement!).getByText('7')).toBeInTheDocument();

  await userEvent.setup().click(recent.getByRole('button',{name:/view all activity/i}));

  expect(screen.getByRole('button',{name:'Activity'})).toHaveAttribute('aria-pressed','true');
  expect(screen.getByRole('heading',{name:'Activity Feed (7 completions)'})).toBeInTheDocument();
  expect(screen.getAllByText(choreTitles).map(title=>title.textContent)).toEqual(
   [7,6,5,4,3,2,1].map(number=>`Household chore ${number}`),
  );
 });
 it('counts completed occurrences scheduled from local Sunday through Saturday',()=>{
  vi.useFakeTimers({toFake:['Date']});
  vi.setSystemTime(new Date(2026,10,22,0,30));
  const previousSaturday=new Date(2026,10,21,18).toISOString();
  const sunday=new Date().toISOString();
  appState.completions=[
   {id:'prior-week',choreId:'dishes',instanceDate:'2026-11-21',completedBy:'alex',completedAt:previousSaturday},
   {id:'first-day',choreId:'dishes',instanceDate:'2026-11-22',completedBy:'alex',completedAt:sunday},
   {id:'last-day',choreId:'dishes',instanceDate:'2026-11-28',completedBy:'alex',completedAt:previousSaturday},
   {id:'next-week',choreId:'dishes',instanceDate:'2026-11-29',completedBy:'alex',completedAt:sunday},
  ];

  render(<Dashboard embedded onClose={vi.fn()}/>);

  expect(within(screen.getByText('This Week').parentElement!).getByText('2')).toBeInTheDocument();
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
 it('matches the overdue occurrences shown on the unfiltered Today list',()=>{
  vi.useFakeTimers({toFake:['Date']});
  vi.setSystemTime(new Date(2026,2,8,0,30));
  const defaults={priority:'medium',assigneeId:null} as const;
  appState.chores=[
   {...defaults,id:'old-once',title:'Repair the shelf',date:'2000-01-01',recurrence:'none'},
   {...defaults,id:'daily',title:'Feed pets',date:'2026-03-06',recurrence:'daily'},
   {...defaults,id:'weekly',title:'Take bins out',date:'2026-01-25',recurrence:'weekly'},
   {...defaults,id:'monthly',title:'Check filters',date:'2026-01-31',recurrence:'monthly'},
   {...defaults,id:'today',title:'Fold towels',date:'2026-03-08',recurrence:'none'},
   {...defaults,id:'future',title:'Buy groceries',date:'2026-03-09',recurrence:'none'},
  ];
  const complete=(choreId:string,instanceDate:string)=>({
   id:`${choreId}-${instanceDate}`,choreId,instanceDate,completedBy:'alex',completedAt:new Date().toISOString(),
  });
  appState.completions=[
   complete('daily','2026-03-07'),
   ...['2026-02-08','2026-02-15','2026-02-22','2026-03-01'].map(date=>complete('weekly',date)),
  ];

  render(<><ListView todayView onAddClick={vi.fn()} onEventClick={vi.fn()}/><Dashboard embedded onClose={vi.fn()}/></>);

  const overdueGroup=within(screen.getByRole('heading',{name:/^Overdue\s+4$/}).parentElement!);
  for(const title of ['Repair the shelf','Feed pets','Take bins out','Check filters']) {
   expect(overdueGroup.getByRole('button',{name:`Edit ${title}`})).toBeInTheDocument();
  }
  expect(within(screen.getByText('Overdue',{selector:'div.text-sm'}).parentElement!).getByText('4')).toBeInTheDocument();
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
