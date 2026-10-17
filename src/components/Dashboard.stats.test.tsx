import {render,screen,cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,it,expect,vi} from 'vitest';
import {Dashboard} from './Dashboard';
import {dateKey,shiftDate} from '../utils/dates';
const mock=vi.hoisted(()=>({state:{chores:[] as any[],teamMembers:[] as any[],completions:[] as any[]}}));
vi.mock('../context/AppContext',()=>({useApp:()=>mock}));
afterEach(cleanup);
it('defaults to Activity; counts 7 local dates only and includes recurring pending instances',async()=>{
 const today=dateKey();mock.state.chores=[{id:'a',title:'Daily',date:shiftDate(today,-20),recurrence:'daily',assigneeId:null}];
 mock.state.completions=[-7,-6,0,1].map((offset,i)=>({id:String(i),choreId:'other',instanceDate:shiftDate(today,offset),completedAt:new Date().toISOString(),completedBy:'other'}));
 render(<Dashboard embedded onClose={()=>{}}/>);expect(screen.getByRole('button',{name:'Activity'})).toHaveAttribute('aria-pressed','true');await userEvent.click(screen.getByRole('button',{name:'Overview'}));
 expect(screen.getByText('Last 7 days',{exact:true}).parentElement).toHaveTextContent('2Last 7 days');expect(screen.getByText('Pending Today').parentElement).toHaveTextContent('1Pending Today');
});
