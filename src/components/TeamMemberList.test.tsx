import {render,screen,fireEvent,act,cleanup} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {TeamMemberList} from './TeamMemberList';
const m=vi.hoisted(()=>({state:{teamMembers:[],availability:[]},addMember:vi.fn(),removeMember:vi.fn(),isMemberAvailable:vi.fn(()=>true)}));
vi.mock('../context/AppContext',()=>({useApp:()=>m}));
afterEach(cleanup);beforeEach(()=>vi.clearAllMocks());
it('rejects empty and whitespace names and accepts a trimmed name',async()=>{
 m.addMember.mockResolvedValue(undefined);render(<TeamMemberList/>);const add=screen.getByRole('button',{name:'Add'});const input=screen.getByRole('textbox',{name:'Family member name'});
 expect(add).toBeDisabled();fireEvent.change(input,{target:{value:'   '}});expect(add).toBeDisabled();fireEvent.submit(screen.getByRole('form'));expect(m.addMember).not.toHaveBeenCalled();
 fireEvent.change(input,{target:{value:'  Alice  '}});expect(add).toBeEnabled();await act(async()=>fireEvent.submit(screen.getByRole('form')));expect(m.addMember).toHaveBeenCalledWith('Alice');expect(input).toHaveValue('');expect(add).toBeDisabled();
});
it('blocks duplicate form submissions while pending and preserves the name after failure',async()=>{
 let reject!:(e:Error)=>void;m.addMember.mockImplementation(()=>new Promise((_,r)=>{reject=r}));render(<TeamMemberList/>);const input=screen.getByRole('textbox',{name:'Family member name'});fireEvent.change(input,{target:{value:'Alice'}});const form=screen.getByRole('form');fireEvent.submit(form);fireEvent.submit(form);
 expect(m.addMember).toHaveBeenCalledTimes(1);expect(input).toBeDisabled();expect(screen.getByRole('button',{name:'Add'})).toBeDisabled();await act(async()=>reject(new Error('Offline')));expect(screen.getByRole('alert')).toHaveTextContent('Offline');expect(input).toHaveValue('Alice');expect(screen.getByRole('button',{name:'Add'})).toBeEnabled();
});
it('keeps a keyboard and screen-reader close action without an X icon',()=>{
 const close=vi.fn();render(<TeamMemberList onClose={close}/>);const button=screen.getByRole('button',{name:'Close sidebar'});expect(button).toHaveClass('sr-only');expect(button.querySelector('svg')).toBeNull();fireEvent.click(button);expect(close).toHaveBeenCalledOnce();
});
