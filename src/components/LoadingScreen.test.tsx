import {cleanup,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {App} from './App';
import {LoadingScreen} from './LoadingScreen';
const auth=vi.hoisted(()=>({user:null as {id:string}|null,loading:true,isEmailVerification:false,isPasswordReset:false}));
const app=vi.hoisted(()=>({state:{chores:[],teamMembers:[],categories:[],completions:[],loading:false,error:null as string|null},reload:vi.fn()}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('../context/AppContext',()=>({useApp:()=>app}));
vi.mock('./AuthForm',()=>({AuthForm:()=> <h1>Sign in</h1>}));
vi.mock('./Header',()=>({Header:()=> <header>Nesmi</header>}));
afterEach(()=>{cleanup();auth.user=null;auth.loading=true;app.state.loading=false;app.state.error=null;app.reload.mockClear();});
it('shows a restrained accessible startup state and hands off immediately to sign-in',()=>{
 const {rerender}=render(<App/>);expect(screen.getByRole('status')).toHaveTextContent('Opening Nesmi…');expect(document.querySelector('.animate-spin')).toBeNull();
 auth.loading=false;rerender(<App/>);expect(screen.queryByRole('status')).not.toBeInTheDocument();expect(screen.getByRole('heading',{name:'Sign in'})).toBeVisible();
});
it('replaces the skeleton on success and preserves data-error retry',async()=>{
 auth.loading=false;auth.user={id:'fixture'};app.state.loading=true;
 const {rerender}=render(<App/>);expect(screen.getByRole('status')).toHaveTextContent('Loading your chores…');
 expect(document.querySelector('.nesmi-loading-row')).not.toBeNull();
 app.state.loading=false;app.state.error='Synthetic offline error';rerender(<App/>);
 expect(screen.queryByRole('status')).not.toBeInTheDocument();expect(screen.getByRole('alert')).toHaveTextContent('Synthetic offline error');
 await userEvent.setup().click(screen.getByRole('button',{name:'Retry'}));expect(app.reload).toHaveBeenCalledOnce();
 app.state.error=null;app.state.loading=true;rerender(<App/>);expect(screen.getByRole('status')).toBeInTheDocument();
 app.state.loading=false;rerender(<App/>);expect(screen.queryByRole('status')).not.toBeInTheDocument();expect(screen.getByRole('heading',{name:'A lighter home starts with one chore.'})).toBeVisible();
});
it('has no synthetic progress percentage or timer to keep a dismissed loader alive',()=>{
 const {unmount}=render(<LoadingScreen phase="chores"/>);
 expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();unmount();expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
