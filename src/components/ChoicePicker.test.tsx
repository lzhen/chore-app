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

describe('refined choice picker interactions and bounds', () => {
  afterEach(() => { vi.restoreAllMocks(); });
  it('opens directly on Home or End, and Space commits only once without reopening', async () => {
    const user = userEvent.setup(), onChange = vi.fn();
    render(<ChoicePicker value="eric" options={options} onChange={onChange} label="Person"/>);
    const trigger = screen.getByRole('combobox'); trigger.focus();
    await user.keyboard('{End}');
    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', {name: 'Jen'}).id);
    await user.keyboard(' ');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('jen');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.keyboard('{Home}');
    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', {name: 'Alex'}).id);
  });
  it('cycles Arrow keys and resets type-ahead when the menu is reopened', async () => {
    const user = userEvent.setup(), onChange = vi.fn();
    render(<ChoicePicker value="alex" options={options} onChange={onChange} label="Person"/>);
    const trigger = screen.getByRole('combobox'); trigger.focus();
    await user.keyboard('e{Escape}j');
    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', {name: 'Jen'}).id);
    await user.keyboard('{ArrowDown}');
    expect(trigger).toHaveAttribute('aria-activedescendant', screen.getByRole('option', {name: 'Alex'}).id);
    await user.keyboard('{ArrowUp}{Enter}');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('jen');
    expect(trigger).toHaveFocus();
  });
  it('Tab keeps the selected value and moves to the next control', async () => {
    const user = userEvent.setup(), onChange = vi.fn();
    render(<><ChoicePicker value="alex" options={options} onChange={onChange} label="Person"/><button>Next</button></>);
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{End}'); await user.tab();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next'})).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });
  it('keeps the current option selected while keyboard navigation previews another', async () => {
    const user = userEvent.setup();
    render(<ChoicePicker value="eric" options={options} onChange={() => {}} label="Person"/>);
    await user.click(screen.getByRole('combobox')); await user.keyboard('{End}');
    expect(screen.getByRole('option', {name: 'Eric'})).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', {name: 'Jen'})).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('option', {name: 'Jen'})).toHaveAttribute('data-active', 'true');
  });
  it('uses a 200px minimum and matches wider triggers, separated below by 8px', () => {
    render(<ChoicePicker value="alex" options={options} onChange={() => {}} label="Person"/>);
    const trigger = screen.getByRole('combobox');
    const rect = vi.spyOn(trigger, 'getBoundingClientRect');
    rect.mockReturnValue({left: 20, right: 160, top: 40, bottom: 84, width: 140, height: 44} as DOMRect);
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toHaveStyle({width: '200px', top: '92px'});
    fireEvent.click(trigger);
    rect.mockReturnValue({left: 20, right: 370, top: 40, bottom: 84, width: 350, height: 44} as DOMRect);
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toHaveStyle({width: '350px'});
  });
  it('caps a long menu at 320px and flips above a low trigger', () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000);
    render(<ChoicePicker value="alex" options={options} onChange={() => {}} label="Person"/>);
    const trigger = screen.getByRole('combobox');
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({left: 20, right: 220, top: 710, bottom: 754, width: 200, height: 44} as DOMRect);
    fireEvent.click(trigger);
    const menu = screen.getByRole('listbox');
    expect(menu).toHaveStyle({maxHeight: '320px', top: '382px'});
    expect(parseFloat(menu.style.top) + parseFloat(menu.style.maxHeight)).toBe(702);
  });
  it('shows long option text intact and keeps a dialog menu inside its focus boundary', async () => {
    const user = userEvent.setup(), label = 'Alexandria with an exceptionally long family member name';
    render(<Dialog title="Add chore" onClose={() => {}}><ChoicePicker value="long" options={[{id: 'long', label}]} onChange={() => {}} label="Person"/></Dialog>);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('dialog')).toContainElement(screen.getByRole('listbox'));
    expect(screen.getByRole('option', {name: label})).toHaveTextContent(label);
    expect(screen.getByRole('option')).toHaveAttribute('tabindex', '-1');
  });
});
