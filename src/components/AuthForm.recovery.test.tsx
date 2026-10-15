import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {AuthForm} from './AuthForm';
const auth=vi.hoisted(()=>({signIn:vi.fn(),signUp:vi.fn(),resetPassword:vi.fn()}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('./Logo',()=>({Logo:()=> <span>Nesmi</span>}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
function fill(){fireEvent.change(screen.getByLabelText('Email'),{target:{value:'person@example.test'}});fireEvent.change(screen.getByLabelText('Password'),{target:{value:'sample-password'}});}
describe('authentication recovery',()=>{
 it('recovers from rejected requests without losing entries and permits retry',async()=>{
  auth.signIn.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({error:null});render(<AuthForm/>);fill();
  fireEvent.submit(screen.getByRole('form'));
  expect(await screen.findByRole('alert')).toHaveTextContent('try again');
  expect(screen.getByLabelText('Email')).toHaveAttribute('aria-describedby', 'nesmi-auth-feedback');
  expect(screen.getByLabelText('Email')).toHaveValue('person@example.test');expect(screen.getByLabelText('Password')).toHaveValue('sample-password');
  fireEvent.submit(screen.getByRole('form'));await waitFor(()=>expect(auth.signIn).toHaveBeenCalledTimes(2));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Sign In'})).toBeEnabled());
 });
 it('guards same-tick submissions and mode changes while a request is pending',async()=>{
  let finish!:(v:{error:null})=>void;auth.signIn.mockReturnValue(new Promise(resolve=>{finish=resolve;}));render(<AuthForm/>);fill();
  const form=screen.getByRole('form');fireEvent.submit(form);fireEvent.submit(form);
  expect(screen.getByRole('button',{name:'Signing in…'})).toBeDisabled();
  expect(auth.signIn).toHaveBeenCalledTimes(1);expect(screen.getByRole('button',{name:/Don’t|Don't have/})).toBeDisabled();
  finish({error:null});await waitFor(()=>expect(screen.getByLabelText('Email')).toBeEnabled());
 });
 it('keeps email but clears password and old feedback when switching modes',async()=>{
  auth.signIn.mockResolvedValue({error:{message:'Try again'}});render(<AuthForm/>);fill();fireEvent.submit(screen.getByRole('form'));await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button',{name:"Don't have an account? Sign up"}));
  expect(screen.getByLabelText('Email')).toHaveValue('person@example.test');expect(screen.getByLabelText('Password')).toHaveValue('');expect(screen.queryByRole('alert')).toBeNull();
 });
 it.each([
  {mode:"Don't have an account? Sign up", method:'signUp' as const, label:'Creating account…'},
  {mode:'Forgot your password?', method:'resetPassword' as const, label:'Sending reset link…'},
 ])('announces the actual pending action for $method',async({mode,method,label})=>{
  let finish!:(value:{error:null})=>void;auth[method].mockReturnValue(new Promise(resolve=>{finish=resolve;}));render(<AuthForm/>);
  fireEvent.click(screen.getByRole('button',{name:mode}));fireEvent.change(screen.getByLabelText('Email'),{target:{value:'sample@example.test'}});
  if(method==='signUp')fireEvent.change(screen.getByLabelText('Password'),{target:{value:'sample-password'}});
  fireEvent.submit(screen.getByRole('form'));expect(screen.getByRole('button',{name:label})).toBeDisabled();
  finish({error:null});expect(await screen.findByRole('status')).toHaveTextContent('Check your email');
 });
});
