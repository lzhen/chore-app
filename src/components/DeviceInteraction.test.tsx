import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Dialog} from './Dialog';
import {ChoicePicker} from './ChoicePicker';
import {AccountSettings} from './AccountSettings';
import {ThemeProvider} from '../context/ThemeContext';
vi.mock('../context/AuthContext',()=>({useAuth:()=>({user:{email:'synthetic@example.test'},signOut:vi.fn(),deleteAccount:vi.fn()})}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();localStorage.clear();});
it('account appearance changes directly with touch/click and never exposes a system menu',()=>{
 render(<ThemeProvider><AccountSettings isOpen embedded onClose={()=>{}}/></ThemeProvider>);
 const button=screen.getByRole('button',{name:'Switch to dark mode'});
 fireEvent.pointerDown(button,{pointerType:'touch'});fireEvent.click(button);
 expect(document.documentElement).toHaveAttribute('data-theme','dark');
 expect(localStorage.getItem('theme')).toBe('dark');expect(screen.queryByRole('listbox')).toBeNull();expect(screen.queryByText('System')).toBeNull();
});
it('adapts the dialog to viewport resize and restores listeners on close',()=>{
 const viewport=new EventTarget() as EventTarget & {height:number;offsetTop:number};viewport.height=812;viewport.offsetTop=0;
 vi.stubGlobal('visualViewport',viewport);
 const view=render(<Dialog title="Edit" onClose={()=>{}}><input aria-label="Time"/></Dialog>);
 const layer=screen.getByRole('dialog').parentElement!;expect(layer.style.getPropertyValue('--dialog-height')).toBe('812px');
 act(()=>{viewport.height=400;viewport.offsetTop=20;viewport.dispatchEvent(new Event('resize'));});
 expect(layer.style.getPropertyValue('--dialog-height')).toBe('400px');expect(layer.style.getPropertyValue('--dialog-top')).toBe('20px');
 view.unmount();act(()=>viewport.dispatchEvent(new Event('resize')));
});
it('a touch option selection closes only the picker and returns focus to the trigger',()=>{
 const select=vi.fn(),close=vi.fn();render(<Dialog title="Edit" onClose={close}><ChoicePicker label="Notify" value="never" options={[{id:'never',label:'Never'},{id:'day',label:'On the day'}]} onChange={select}/></Dialog>);
 const trigger=screen.getByRole('combobox',{name:'Notify'});fireEvent.click(trigger);
 const option=screen.getByRole('option',{name:'On the day'});fireEvent.pointerDown(option,{pointerType:'touch'});fireEvent.click(option);
 expect(select).toHaveBeenCalledWith('day');expect(close).not.toHaveBeenCalled();expect(trigger).toHaveFocus();expect(screen.queryByRole('listbox')).toBeNull();
});
