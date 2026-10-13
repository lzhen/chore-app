import {act,cleanup,fireEvent,render,screen,within,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {App} from './App';
import {dateKey} from '../utils/dates';
import type {Chore} from '../types';
const experience=vi.hoisted(()=>({value:'app' as 'web'|'app'}));
vi.mock('../hooks/useInteractionMode',()=>({useInteractionMode:()=>experience.value}));
const app=vi.hoisted(()=>({state:{chores:[] as Chore[],teamMembers:[],categories:[],completions:[],loading:false,error:null},reload:vi.fn(),addChore:vi.fn(),updateChore:vi.fn(),deleteChore:vi.fn()}));
vi.mock('../context/AppContext',()=>({useApp:()=>app}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>({user:{id:'test',email:'demo@example.test'},loading:false})}));
vi.mock('./Calendar',()=>({Calendar:({onAddClick}:{onAddClick:(v:{date:string})=>void})=><button onClick={()=>onAddClick({date:'2026-11-01'})}>Select calendar date</button>}));
vi.mock('./Dashboard',()=>({Dashboard:()=> <h2>Insights overview</h2>}));
vi.mock('./AccountSettings',()=>({AccountSettings:()=> <h2>Account settings</h2>}));
vi.mock('./ChatAssistant',()=>({ChatAssistant:({onClose,open}:{onClose:()=>void;open:boolean})=>open?<div role="dialog" aria-label="Chore assistant"><button onClick={onClose}>Close assistant</button></div>:null}));
vi.mock('./AgentPanel',()=>({AgentPanel:({onDismiss}:{onDismiss:()=>void})=><div role="dialog" aria-label="Planning tools"><button onClick={onDismiss}>Close tools</button></div>}));
afterEach(cleanup);
beforeEach(()=>{experience.value='app';(window as Window & {__NESMI_PREVIEW__?:boolean}).__NESMI_PREVIEW__=false;app.addChore.mockResolvedValue(undefined);app.updateChore.mockResolvedValue(undefined);app.state.chores=[{id:'task',title:'Water plants',date:dateKey(),assigneeId:null,recurrence:'none',priority:'medium'}];});
async function navigate(user:ReturnType<typeof userEvent.setup>,name:string){
 await user.click(screen.getByRole('button',{name:'Open family menu'}));
 const nav=screen.getByRole('navigation',{name:'Primary navigation'});
 await user.click(within(nav).getByRole('button',{name}));
 expect(screen.queryByRole('navigation')).toBeNull();
 expect(screen.getAllByRole('button',{name:'Add new chore'})).toHaveLength(1);
}
describe('Home and drawer navigation',()=>{
 it('keeps every destination in the drawer and one global create action',async()=>{
  const user=userEvent.setup();render(<App/>);
  expect(screen.queryByRole('navigation')).toBeNull();
  expect(screen.queryByRole('button',{name:'Next week'})).toBeNull();
  expect(screen.getByRole('button',{name:/Chore assistant/})).toBeVisible();
  for(const [name,heading] of [['Chores','Chores'],['Calendar','Calendar'],['Insights','Insights overview'],['Account','Account settings'],['Today','Today']]){
   await navigate(user,name);expect(screen.getByRole('heading',{name:heading})).toBeInTheDocument();
   await waitFor(()=>expect(screen.getByRole('heading',{name:heading})).toHaveFocus());
   await user.click(screen.getByRole('button',{name:'Open family menu'}));
   expect(within(screen.getByRole('navigation')).getByRole('button',{name})).toHaveAttribute('aria-current','page');
   await user.keyboard('{Escape}');
  }
 });
 it('opens chat directly on Home and keeps search across all dates',async()=>{
  const user=userEvent.setup();render(<App/>);
  await user.click(screen.getByRole('button',{name:/Chore assistant/}));
  expect(screen.getByRole('dialog',{name:'Chore assistant'})).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Close assistant'}));
  await user.click(screen.getByRole('button',{name:'Search chores'}));
  expect(screen.getByRole('heading',{name:'Chores'})).toBeVisible();
  expect(screen.getByRole('searchbox')).toHaveFocus();
 });
 it('keeps global add today even after an explicit Calendar date draft',async()=>{
  const user=userEvent.setup();render(<App/>);
  await navigate(user,'Calendar');
  await user.click(screen.getByRole('button',{name:'Planning tools'}));
  expect(screen.getByRole('dialog',{name:'Planning tools'})).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Close tools'}));
  await user.click(screen.getByRole('button',{name:'Select calendar date'}));
  expect(screen.getByLabelText('Date')).toHaveValue('2026-11-01');
  await user.click(screen.getByRole('button',{name:'Cancel'}));
  await navigate(user,'Today');
  await user.click(screen.getByRole('button',{name:'Add new chore'}));
  expect(screen.getByLabelText('Date')).toHaveValue(dateKey());
  await user.type(screen.getByRole('textbox',{name:'Chore'}),'Draft task');
  await user.keyboard('{Escape}');expect(screen.getByRole('dialog',{name:'Discard changes?'})).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Keep editing'}));expect(screen.getByRole('textbox',{name:'Chore'})).toHaveValue('Draft task');
 });
 it('keeps empty Home useful without duplicate add buttons',()=>{
  app.state.chores=[];render(<App/>);
  expect(screen.getAllByRole('button',{name:'Add new chore'})).toHaveLength(1);
  expect(screen.getByText('Use the + below to add a chore.')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:/Chore assistant/})).toBeVisible();
 });
});


describe('safe transitions out of the active task draft',()=>{
 beforeEach(()=>{experience.value='web';});
 it('guards global create, keeps the inline draft, then resumes create after explicit discard',async()=>{
  const user=userEvent.setup();render(<App/>);await user.click(screen.getByRole('button',{name:'Edit Water plants'}));await user.type(screen.getByRole('textbox',{name:'Chore'}),' carefully');
  await user.click(screen.getByRole('button',{name:'Add new chore'}));expect(screen.getByRole('dialog',{name:'Discard changes?'})).toBeVisible();expect(screen.queryByRole('dialog',{name:'Add a chore'})).toBeNull();
  await user.click(screen.getByRole('button',{name:'Keep editing'}));expect(screen.getByRole('textbox',{name:'Chore'})).toHaveValue('Water plants carefully');expect(screen.getByRole('textbox',{name:'Chore'})).toHaveFocus();
  await user.click(screen.getByRole('button',{name:'Add new chore'}));await user.click(screen.getByRole('button',{name:'Discard changes'}));
  expect(screen.getByRole('dialog',{name:'Add a chore'})).toBeVisible();expect(screen.getByRole('textbox',{name:'Chore'})).toHaveValue('');expect(screen.getByRole('textbox',{name:'Chore'})).toHaveFocus();
 });
 it('guards drawer navigation without losing the current view or draft when kept',async()=>{
  const user=userEvent.setup();render(<App/>);await user.click(screen.getByRole('button',{name:'Edit Water plants'}));await user.type(screen.getByRole('textbox',{name:'Chore'}),' carefully');
  await user.click(screen.getByRole('button',{name:'Open family menu'}));await user.click(screen.getByRole('button',{name:'Keep editing'}));expect(screen.queryByRole('navigation')).toBeNull();expect(screen.getByRole('textbox',{name:'Chore'})).toHaveValue('Water plants carefully');
  await user.click(screen.getByRole('button',{name:'Open family menu'}));await user.click(screen.getByRole('button',{name:'Discard changes'}));await user.click(within(screen.getByRole('navigation')).getByRole('button',{name:'Chores'}));expect(screen.getByRole('heading',{name:'Chores'})).toBeVisible();expect(screen.queryByRole('textbox',{name:'Chore'})).toBeNull();
 });
 it('guards search changes that would remove the inline editor',async()=>{
  const user=userEvent.setup();render(<App/>);await user.click(screen.getByRole('button',{name:'Search chores'}));await user.click(screen.getByRole('button',{name:'Edit Water plants'}));await user.type(screen.getByRole('textbox',{name:'Chore'}),' carefully');
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'laundry'}});await user.click(screen.getByRole('button',{name:'Keep editing'}));expect(screen.getByRole('searchbox')).toHaveValue('');expect(screen.getByRole('textbox',{name:'Chore'})).toHaveValue('Water plants carefully');
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'laundry'}});await user.click(screen.getByRole('button',{name:'Discard changes'}));expect(screen.getByRole('searchbox')).toHaveValue('laundry');expect(screen.queryByRole('textbox',{name:'Chore'})).toBeNull();expect(screen.getByRole('heading',{name:'No matching chores'})).toBeVisible();
 });
 it('trusts only the preview parent protocol and approves a requested mode only after explicit discard',async()=>{
  const user=userEvent.setup();const post=vi.spyOn(window.parent,'postMessage').mockImplementation(()=>{});render(<App/>);
  const send=(origin=window.location.origin,source:MessageEventSource|null=window.parent,experience='app')=>act(()=>window.dispatchEvent(new MessageEvent('message',{origin,source,data:{type:'nesmi-preview-mode-request',experience,requestId:'request-1'}})));
  send();expect(post).not.toHaveBeenCalled();(window as Window & {__NESMI_PREVIEW__?:boolean}).__NESMI_PREVIEW__=true;
  send('https://elsewhere.example');send(window.location.origin,null);send(window.location.origin,window.parent,'invalid');expect(post).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button',{name:'Edit Water plants'}));await user.type(screen.getByRole('textbox',{name:'Chore'}),' carefully');send();expect(post).not.toHaveBeenCalled();await user.click(screen.getByRole('button',{name:'Keep editing'}));expect(post).not.toHaveBeenCalled();expect(screen.getByRole('textbox',{name:'Chore'})).toHaveValue('Water plants carefully');
  send();await user.click(screen.getByRole('button',{name:'Discard changes'}));expect(post).toHaveBeenCalledWith({type:'nesmi-preview-mode-ready',experience:'app',requestId:'request-1'},window.location.origin);post.mockRestore();
 });
 it('waits for a pending save before approving a queued experience switch, without duplicate saves',async()=>{
  const user=userEvent.setup();let finish!:()=>void;app.updateChore.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));const post=vi.spyOn(window.parent,'postMessage').mockImplementation(()=>{});(window as Window & {__NESMI_PREVIEW__?:boolean}).__NESMI_PREVIEW__=true;render(<App/>);
  await user.click(screen.getByRole('button',{name:'Edit Water plants'}));await user.type(screen.getByRole('textbox',{name:'Chore'}),' carefully');
  fireEvent.submit(document.getElementById('chore-edit-form')!);fireEvent.submit(document.getElementById('chore-edit-form')!);expect(app.updateChore).toHaveBeenCalledOnce();expect(screen.getByRole('textbox',{name:'Chore'})).toBeDisabled();
  act(()=>window.dispatchEvent(new MessageEvent('message',{origin:window.location.origin,source:window.parent,data:{type:'nesmi-preview-mode-request',experience:'app',requestId:'while-saving'}})));expect(post).not.toHaveBeenCalled();
  await act(async()=>finish());expect(post).toHaveBeenCalledWith({type:'nesmi-preview-mode-ready',experience:'app',requestId:'while-saving'},window.location.origin);post.mockRestore();
 });
 it('keeps a failed save draft and waits for a discard decision before completing a queued mode change',async()=>{
  const user=userEvent.setup();let fail!:(reason:Error)=>void;app.updateChore.mockImplementationOnce(()=>new Promise<void>((_,reject)=>{fail=reject;}));const post=vi.spyOn(window.parent,'postMessage').mockImplementation(()=>{});(window as Window & {__NESMI_PREVIEW__?:boolean}).__NESMI_PREVIEW__=true;render(<App/>);
  await user.click(screen.getByRole('button',{name:'Edit Water plants'}));await user.type(screen.getByRole('textbox',{name:'Chore'}),' carefully');await user.click(screen.getByRole('button',{name:'Save changes'}));
  act(()=>window.dispatchEvent(new MessageEvent('message',{origin:window.location.origin,source:window.parent,data:{type:'nesmi-preview-mode-request',experience:'app',requestId:'failed-save'}})));
  await act(async()=>fail(new Error('Offline.')));expect(post).not.toHaveBeenCalled();expect(screen.getByRole('dialog',{name:'Discard changes?'})).toBeVisible();
  await user.click(screen.getByRole('button',{name:'Keep editing'}));expect(screen.getByRole('textbox',{name:'Chore'})).toHaveValue('Water plants carefully');expect(screen.getByRole('alert')).toHaveTextContent('Offline. Your entries are still here.');expect(post).not.toHaveBeenCalled();post.mockRestore();
 });

});
