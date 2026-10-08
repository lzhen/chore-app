import {cleanup,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {AgentPanel} from './AgentPanel';
const update=vi.hoisted(()=>vi.fn());
vi.mock('../context/AppContext',()=>({useApp:()=>({state:{chores:Array.from({length:101},(_,i)=>({id:String(i),assigneeId:null})),teamMembers:[]},updateChore:update})}));
vi.mock('../utils/schedulingAgent',()=>({analyzeWorkloadBalance:()=>({isBalanced:true,suggestions:[],stats:[]}),autoAssignChores:()=>[],getUpcomingChores:()=>[],suggestAssignee:()=>null}));
vi.mock('../utils/googleCalendar',()=>({isGoogleCalendarConfigured:()=>false,initGoogleApi:vi.fn(),isGoogleSignedIn:()=>false,signInToGoogle:vi.fn(),signOutFromGoogle:vi.fn(),syncChoresToGoogleCalendar:vi.fn()}));
vi.mock('../utils/notifications',()=>({areNotificationsEnabled:()=>false,requestNotificationPermission:vi.fn(),checkAndNotifyUpcomingChores:vi.fn()}));
afterEach(cleanup);
it('keeps the real assistant launcher and panel available without invoking integrations or assignments',async()=>{
 const user=userEvent.setup();render(<AgentPanel/>);
 const trigger=screen.getByRole('button',{name:'Calendar Agent'});
 expect(trigger).toHaveTextContent('99+');expect(trigger).toHaveAttribute('aria-expanded','false');
 await user.click(trigger);expect(trigger).toHaveAttribute('aria-expanded','true');
 expect(screen.getByRole('button',{name:'Chat with Assistant'})).toBeVisible();
 await user.click(screen.getByRole('button',{name:'Close Calendar Agent'}));expect(trigger).toHaveAttribute('aria-expanded','false');
 expect(update).not.toHaveBeenCalled();
});
