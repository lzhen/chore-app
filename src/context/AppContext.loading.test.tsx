import {render,screen,act,cleanup} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {AppProvider,useApp} from './AppContext';
const mock=vi.hoisted(()=>({auth:{user:{id:'test-owner'},loading:true},fetch:vi.fn()}));
vi.mock('./AuthContext',()=>({useAuth:()=>mock.auth}));
vi.mock('../utils/supabaseStorage',()=>({fetchChores:mock.fetch,fetchTeamMembers:mock.fetch,fetchCategories:mock.fetch,fetchCompletions:mock.fetch,fetchAvailability:mock.fetch}));
afterEach(cleanup);
it('keeps loading until both auth and household reads finish, without exposing transient navigation',async()=>{
 const resolve:(()=>void)[]=[];mock.fetch.mockImplementation(()=>new Promise(r=>resolve.push(()=>r([]))));
 const Probe=()=>{const {state}=useApp();return <div>{state.loading?'Loading':'Ready'}</div>};
 const {rerender}=render(<AppProvider><Probe/></AppProvider>);expect(screen.getByText('Loading')).toBeVisible();expect(mock.fetch).not.toHaveBeenCalled();
 mock.auth.loading=false;rerender(<AppProvider><Probe/></AppProvider>);expect(screen.getByText('Loading')).toBeVisible();
 await act(async()=>{resolve.forEach(r=>r())});expect(screen.getByText('Ready')).toBeVisible();
});
