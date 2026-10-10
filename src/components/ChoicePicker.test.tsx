import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChoicePicker } from './ChoicePicker';
import { Dialog } from './Dialog';
const options = [{id:'alex',label:'Alex'},{id:'eric',label:'Eric'},{id:'jen',label:'Jen'}];
afterEach(cleanup);
describe('app-owned choice picker', () => {
  it('uses keyboard navigation, selects once, restores focus and closes', async () => {
    const onChange=vi.fn(); render(<ChoicePicker value="" options={options} onChange={onChange} label="Family"/>);
    const trigger=screen.getByRole('combobox'); trigger.focus();
    fireEvent.keyDown(trigger,{key:'ArrowDown'}); fireEvent.keyDown(trigger,{key:'End'}); fireEvent.keyDown(trigger,{key:'Enter'});
    expect(onChange).toHaveBeenCalledExactlyOnceWith('jen'); expect(screen.queryByRole('listbox')).not.toBeInTheDocument(); expect(trigger).toHaveFocus();
  });
  it('Escape closes the picker before its parent dialog and preserves selection', async () => {
    const onClose=vi.fn(), onChange=vi.fn(), user=userEvent.setup();
    render(<Dialog title="Complete chore" onClose={onClose}><ChoicePicker value="eric" options={options} onChange={onChange} label="Family"/></Dialog>);
    const trigger=screen.getByRole('combobox'); await user.click(trigger);
    expect(screen.getByRole('option',{name:'Eric'})).toHaveAttribute('aria-selected','true');
    await user.keyboard('{Escape}'); expect(screen.queryByRole('listbox')).not.toBeInTheDocument(); expect(onClose).not.toHaveBeenCalled(); expect(onChange).not.toHaveBeenCalled();
    await user.keyboard('{Escape}'); expect(onClose).toHaveBeenCalledOnce();
  });
  it('outside pointer and Tab dismiss without committing a member', async () => {
    const onChange=vi.fn(), user=userEvent.setup(); render(<><ChoicePicker value="" options={options} onChange={onChange} label="Family"/><button>Outside</button></>);
    await user.click(screen.getByRole('combobox')); await user.click(screen.getByRole('button',{name:'Outside'})); expect(screen.queryByRole('listbox')).toBeNull();
    await user.click(screen.getByRole('combobox')); await user.tab(); expect(screen.queryByRole('listbox')).toBeNull(); expect(onChange).not.toHaveBeenCalled();
  });
  for (const width of [320,375,390,430,1440]) for (const align of ['start','end'] as const) it(`clamps ${align} menu to ${width}px visible viewport`, () => {
    vi.spyOn(window,'innerWidth','get').mockReturnValue(width);
    render(<ChoicePicker value="alex" options={options} onChange={()=>{}} label="Theme" align={align}/>);
    const trigger=screen.getByRole('combobox');
    vi.spyOn(trigger,'getBoundingClientRect').mockReturnValue({left:20,right:64,top:150,bottom:194,width:44,height:44,x:20,y:150,toJSON(){}});
    fireEvent.click(trigger);
    const list=screen.getByRole('listbox'); const x=parseFloat(list.style.left), w=parseFloat(list.style.width);
    expect(x).toBeGreaterThanOrEqual(12); expect(x+w).toBeLessThanOrEqual(width-12); vi.restoreAllMocks();
  });
  it('supports name type-ahead and Home without committing until Enter', () => {
    const onChange=vi.fn(); render(<ChoicePicker value="alex" options={options} onChange={onChange} label="Family"/>);
    const trigger=screen.getByRole('combobox'); fireEvent.keyDown(trigger,{key:'e'});
    expect(trigger).toHaveAttribute('aria-activedescendant',screen.getByRole('option',{name:'Eric'}).id);
    expect(onChange).not.toHaveBeenCalled(); fireEvent.keyDown(trigger,{key:'Home'});
    expect(trigger).toHaveAttribute('aria-activedescendant',screen.getByRole('option',{name:'Alex'}).id);
    fireEvent.keyDown(trigger,{key:'End'}); fireEvent.keyDown(trigger,{key:'Enter'}); expect(onChange).toHaveBeenCalledExactlyOnceWith('jen');
  });
  it('repositions when the visible viewport shrinks for a keyboard', () => {
    const viewport=new EventTarget(); Object.assign(viewport,{width:390,height:340,offsetTop:80,offsetLeft:0});
    Object.defineProperty(window,'visualViewport',{configurable:true,value:viewport});
    render(<ChoicePicker value="alex" options={options} onChange={()=>{}} label="Family"/>);
    const trigger=screen.getByRole('combobox');
    vi.spyOn(trigger,'getBoundingClientRect').mockReturnValue({left:20,right:370,top:310,bottom:354,width:350,height:44,x:20,y:310,toJSON(){}});
    fireEvent.click(trigger); const list=screen.getByRole('listbox');
    expect(parseFloat(list.style.top)).toBeGreaterThanOrEqual(92);
    expect(parseFloat(list.style.top)+parseFloat(list.style.maxHeight)).toBeLessThanOrEqual(408);
    Object.defineProperty(window,'visualViewport',{configurable:true,value:undefined}); vi.restoreAllMocks();
  });
  it('empty members do not produce a selection on keyboard input', () => {
    const onChange=vi.fn(); render(<ChoicePicker value="" options={[]} onChange={onChange} label="Family"/>);
    const trigger=screen.getByRole('combobox'); fireEvent.keyDown(trigger,{key:'ArrowDown'}); fireEvent.keyDown(trigger,{key:'ArrowDown'}); fireEvent.keyDown(trigger,{key:'Enter'}); expect(onChange).not.toHaveBeenCalled();
  });
});
