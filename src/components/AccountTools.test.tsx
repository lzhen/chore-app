import {cleanup,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {AccountTools,HouseholdToolsProvider} from './AccountTools';
const mocks=vi.hoisted(()=>({update:vi.fn(),permission:vi.fn(),state:vi.fn(),connect:vi.fn(),disconnect:vi.fn(),sync:vi.fn(),notify:vi.fn(),init:vi.fn()}));
vi.mock('../context/AppContext',()=>({useApp:()=>({state:{chores:[{id:'chore',title:'Clean kitchen',assigneeId:null}],teamMembers:[{id:'alex',name:'Alex'}]},updateChore:mocks.update})}));
vi.mock('../utils/schedulingAgent',()=>({analyzeWorkloadBalance:()=>({isBalanced:true,suggestions:[],stats:[{memberId:'alex',memberName:'Alex',recentAssignments:2}]}),autoAssignChores:()=>[['chore','alex']],getUpcomingChores:()=>[],suggestAssignee:()=>({id:'alex',name:'Alex'})}));
vi.mock('../utils/googleCalendar',()=>({isGoogleCalendarConfigured:()=>true,initGoogleApi:mocks.init,isGoogleSignedIn:()=>false,signInToGoogle:mocks.connect,signOutFromGoogle:mocks.disconnect,syncChoresToGoogleCalendar:mocks.sync}));
vi.mock('../utils/notifications',()=>({getNotificationState:mocks.state,requestNotificationAccess:mocks.permission,checkAndNotifyUpcomingChores:mocks.notify}));
beforeEach(()=>{vi.clearAllMocks();mocks.notify.mockReturnValue(true);mocks.init.mockResolvedValue(undefined);mocks.connect.mockResolvedValue(true);mocks.state.mockReturnValue('default');mocks.permission.mockResolvedValue('granted');mocks.sync.mockResolvedValue({success:1,failed:0});});
afterEach(cleanup);
it('keeps tools in settings without granting permission, connecting or writing on mount',async()=>{
 render(<HouseholdToolsProvider><AccountTools/></HouseholdToolsProvider>);
 await screen.findByRole('button',{name:'Connect Google Calendar'});
 expect(screen.queryByText('Workload Balance')).not.toBeInTheDocument();
 for(const fn of [mocks.permission,mocks.connect,mocks.disconnect,mocks.sync,mocks.update,mocks.notify])expect(fn).not.toHaveBeenCalled();
});
it('preserves explicit integration actions and sync state across Account remounts',async()=>{
 const user=userEvent.setup();const view=render(<HouseholdToolsProvider><AccountTools/></HouseholdToolsProvider>);
 await user.click(await screen.findByRole('button',{name:'Connect Google Calendar'}));
 await user.click(screen.getByRole('button',{name:'Sync to Google Calendar'}));
 await screen.findByText('Synced 1 chores');
 view.rerender(<HouseholdToolsProvider><span>Today</span></HouseholdToolsProvider>);
 view.rerender(<HouseholdToolsProvider><AccountTools/></HouseholdToolsProvider>);
 expect(screen.getByText('Synced 1 chores')).toBeInTheDocument();
 expect(mocks.connect).toHaveBeenCalledTimes(1);expect(mocks.sync).toHaveBeenCalledTimes(1);
 await user.click(screen.getByRole('button',{name:'Disconnect'}));
 expect(mocks.disconnect).toHaveBeenCalledTimes(1);expect(screen.queryByText('Synced 1 chores')).not.toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:'Enable Reminders'}));
 expect(mocks.permission).toHaveBeenCalledTimes(1);await screen.findByText('Allowed');
 expect(mocks.update).not.toHaveBeenCalled();
});

for (const [state, text] of [
 ['denied','Notifications are blocked.'],
 ['insecure','Reminders require HTTPS'],
 ['dismissed','Permission was not allowed'], ['error','Could not enable reminders'],
]) it(`shows recovery feedback for ${state}`,async()=>{
 const user=userEvent.setup();mocks.permission.mockResolvedValue(state);
 render(<HouseholdToolsProvider><AccountTools/></HouseholdToolsProvider>);
 await user.click(screen.getByRole('button',{name:'Enable Reminders'}));
 expect(await screen.findByRole('status')).toHaveTextContent(text);
 expect(screen.queryByText('Allowed',{exact:true})).not.toBeInTheDocument();
});
it('refreshes blocked permission after returning from browser settings',async()=>{
 mocks.state.mockReturnValue('denied');render(<HouseholdToolsProvider><AccountTools/></HouseholdToolsProvider>);
 expect(screen.getByRole('status')).toHaveTextContent('Notifications are blocked');
 mocks.state.mockReturnValue('granted');window.dispatchEvent(new Event('focus'));
 expect(await screen.findByText('Allowed',{exact:true})).toBeInTheDocument();
 expect(mocks.permission).not.toHaveBeenCalled();
});

it('reports delivery failure instead of claiming reminders work',async()=>{
 mocks.state.mockReturnValue('granted');mocks.notify.mockReturnValue(false);
 render(<HouseholdToolsProvider><AccountTools/></HouseholdToolsProvider>);
 expect(await screen.findByRole('status')).toHaveTextContent('Could not enable reminders');
 expect(screen.queryByText('Allowed',{exact:true})).not.toBeInTheDocument();
});

for (const state of ['native','unsupported']) it(`hides the whole unsupported notification section: ${state}`,()=>{
 mocks.state.mockReturnValue(state);render(<HouseholdToolsProvider><AccountTools/></HouseholdToolsProvider>);
 expect(screen.queryByRole('region',{name:'Notifications'})).not.toBeInTheDocument();
 expect(screen.queryByRole('heading',{name:'Notifications'})).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Enable Reminders'})).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Check again'})).not.toBeInTheDocument();
 expect(mocks.permission).not.toHaveBeenCalled();
});
