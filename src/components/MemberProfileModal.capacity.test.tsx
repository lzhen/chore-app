import {render,screen,cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,it,expect,vi} from 'vitest';
import {MemberProfileModal} from './MemberProfileModal';
const mock=vi.hoisted(()=>({updateMember:vi.fn().mockResolvedValue(undefined),getMemberStats:()=>({badges:[],points:0,totalCompleted:0,currentStreak:0,longestStreak:0})}));
vi.mock('../context/AppContext',()=>({useApp:()=>mock}));
afterEach(cleanup);
it('does not silently add 480 minutes when saving a profile with no capacity',async()=>{
 render(<MemberProfileModal member={{id:'a',name:'Alex',color:'#333333',points:0,badges:[]}} onClose={()=>{}}/>);
 expect(screen.getByLabelText('Weekly capacity (minutes) · this session')).toHaveValue(null);await userEvent.click(screen.getByRole('button',{name:'Save Profile'}));expect(mock.updateMember).toHaveBeenCalledWith(expect.objectContaining({weeklyCapacityMinutes:undefined}));
});
