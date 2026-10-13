import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ListView } from './ListView';
import type { Chore, ChoreCompletion, TeamMember } from '../types';
import { dateKey, shiftDate } from '../utils/dates';
const mode = vi.hoisted(() => ({ value: 'web' as 'web' | 'app' }));
const app = vi.hoisted(() => ({state: {chores: [] as Chore[], teamMembers: [] as TeamMember[], categories: [], completions: [] as ChoreCompletion[]}, addChore: vi.fn(), updateChore: vi.fn(), deleteChore: vi.fn(), completeChore: vi.fn(), uncompleteChore: vi.fn()}));
vi.mock('../hooks/useInteractionMode', () => ({useInteractionMode: () => mode.value}));
vi.mock('../context/AppContext', () => ({useApp: () => app}));
const props = {onAddClick: vi.fn(), onEventClick: vi.fn()};
function chore(id: string, title: string, extra: Partial<Chore> = {}): Chore { return {id,title,date:dateKey(),assigneeId:null,recurrence:'none',priority:'medium',...extra}; }
beforeEach(() => {
 mode.value='web';app.state.chores=[chore('one','Wash dishes',{description:'Use the gentle soap',dueTime:'09:00',endTime:'09:30'}),chore('two','Water plants')];
 app.state.teamMembers=[{id:'alex',name:'Alex',color:'#456789',points:0,badges:[]}];app.state.completions=[];
 app.updateChore.mockResolvedValue(undefined);app.deleteChore.mockResolvedValue(undefined);
});
afterEach(cleanup);
describe('Web task rows', () => {
 it('opens inline details separately from edit, with no dialog or page lock and title focus', async () => {
  const user=userEvent.setup();render(<ListView {...props} todayView/>);
  await user.click(screen.getByRole('button',{name:'View details: Wash dishes'}));
  expect(screen.getByText('Use the gentle soap')).toBeVisible();expect(screen.queryByRole('textbox',{name:'Chore'})).toBeNull();
  await user.click(screen.getByRole('button',{name:'Edit Wash dishes'}));
  expect(screen.queryByRole('dialog')).toBeNull();expect(document.body.style.overflow).not.toBe('hidden');
  expect(screen.getByRole('textbox',{name:'Chore'})).toHaveFocus();
  expect(screen.getByLabelText('Date')).toHaveAttribute('type','date');expect(screen.getByLabelText('Start time · optional')).toHaveAttribute('type','time');
  await user.keyboard('{Escape}');expect(screen.queryByRole('textbox',{name:'Chore'})).toBeNull();expect(screen.getByRole('button',{name:'Edit Wash dishes'})).toHaveFocus();
 });
 it('keeps dirty values when cancelling a second edit, then resumes the requested edit after discard', async () => {
  const user=userEvent.setup();render(<ListView {...props} todayView/>);
  await user.click(screen.getByRole('button',{name:'Edit Wash dishes'}));await user.type(screen.getByRole('textbox',{name:'Chore'}),' carefully');
  await user.click(screen.getByRole('button',{name:'Edit Water plants'}));expect(screen.getByRole('dialog',{name:'Discard changes?'})).toHaveTextContent('Changed: Chore name.');expect(document.getElementById('chore-edit-form')).not.toHaveAttribute('hidden');
  await user.click(screen.getByRole('button',{name:'Keep editing'}));expect(screen.getByRole('textbox',{name:'Chore'})).toHaveValue('Wash dishes carefully');
  await user.click(screen.getByRole('button',{name:'Edit Water plants'}));await user.click(screen.getByRole('button',{name:'Discard changes'}));
  expect(screen.getAllByRole('textbox',{name:'Chore'})).toHaveLength(1);expect(screen.getByRole('textbox',{name:'Chore'})).toHaveValue('Water plants');expect(screen.getByRole('textbox',{name:'Chore'})).toHaveFocus();
 });
 it('guards filters that would hide the draft and resumes the chosen filter only after discard', async () => {
  const user=userEvent.setup();render(<ListView {...props} todayView/>);
  await user.click(screen.getByRole('button',{name:'Edit Wash dishes'}));await user.type(screen.getByRole('textbox',{name:'Chore'}),' today');
  await user.click(screen.getByRole('combobox',{name:'Filter by family member'}));await user.click(screen.getByRole('option',{name:'Alex'}));
  expect(screen.getByRole('dialog',{name:'Discard changes?'})).toBeVisible();await user.click(screen.getByRole('button',{name:'Keep editing'}));
  expect(screen.getByRole('combobox',{name:'Filter by family member'})).toHaveTextContent('Everyone');expect(screen.getByRole('textbox',{name:'Chore'})).toHaveValue('Wash dishes today');
  await user.click(screen.getByRole('combobox',{name:'Filter by family member'}));await user.click(screen.getByRole('option',{name:'Alex'}));await user.click(screen.getByRole('button',{name:'Discard changes'}));
  expect(screen.getByRole('combobox',{name:'Filter by family member'})).toHaveTextContent('Alex');expect(screen.queryByRole('textbox',{name:'Chore'})).toBeNull();
 });
 it('retains the draft and shared validation on a failed save, with explicit retry only', async () => {
  const user=userEvent.setup();app.updateChore.mockRejectedValueOnce(new Error('Offline.'));render(<ListView {...props} todayView/>);
  await user.click(screen.getByRole('button',{name:'Edit Wash dishes'}));await user.type(screen.getByRole('textbox',{name:'Chore'}),' carefully');
  await user.click(screen.getByRole('button',{name:'Save changes'}));expect(screen.getByRole('alert')).toHaveTextContent('Offline. Your entries are still here.');expect(screen.getByRole('textbox',{name:'Chore'})).toHaveValue('Wash dishes carefully');
  fireEvent.change(screen.getByLabelText('End time · optional'),{target:{value:'08:00'}});await user.click(screen.getByRole('button',{name:'Save changes'}));expect(screen.getByRole('alert')).toHaveTextContent('Choose an end time after the start time');expect(app.updateChore).toHaveBeenCalledOnce();
  fireEvent.change(screen.getByLabelText('End time · optional'),{target:{value:'10:00'}});await user.click(screen.getByRole('button',{name:'Save changes'}));expect(app.updateChore).toHaveBeenCalledTimes(2);expect(screen.queryByRole('textbox',{name:'Chore'})).toBeNull();
 });
 it('keys the single editor by recurring occurrence and retains the whole-series edit warning', async () => {
  const user=userEvent.setup();app.state.chores=[chore('series','Feed cat',{recurrence:'weekly'})];render(<ListView {...props}/>);
  const edits=screen.getAllByRole('button',{name:'Edit Feed cat'});await user.click(edits[1]);expect(screen.getByText(/Changes apply to all occurrences/)).toHaveTextContent(`not just ${shiftDate(dateKey(),7)}`);
  await user.type(screen.getByRole('textbox',{name:'Chore'}),' safely');await user.click(edits[2]);expect(screen.getByRole('dialog',{name:'Discard changes?'})).toBeVisible();await user.click(screen.getByRole('button',{name:'Discard changes'}));
  expect(screen.getAllByRole('textbox',{name:'Chore'})).toHaveLength(1);expect(screen.getByText(/Changes apply to all occurrences/)).toHaveTextContent(`not just ${shiftDate(dateKey(),14)}`);
 });
 it('keeps the draft through a declined responsive experience change', async () => {
  const user=userEvent.setup();const view=render(<ListView {...props} todayView/>);
  await user.click(screen.getByRole('button',{name:'Edit Wash dishes'}));await user.type(screen.getByRole('textbox',{name:'Chore'}),' carefully');
  mode.value='app';view.rerender(<ListView {...props} todayView/>);await user.click(screen.getByRole('button',{name:'Keep editing'}));
  expect(screen.getByRole('textbox',{name:'Chore'})).toHaveValue('Wash dishes carefully');expect(screen.queryByRole('dialog')).toBeNull();await user.click(screen.getByRole('button',{name:'Save changes'}));expect(screen.getByRole('button',{name:'More actions for Wash dishes'})).toBeInTheDocument();
 });
});
describe('App task rows and deliberate deletion', () => {
 it('omits only the action-sheet Cancel and retains close, backdrop, Escape and focus return', async () => {
  mode.value='app';const user=userEvent.setup();render(<ListView {...props} todayView/>);
  const trigger=screen.getByRole('button',{name:'More actions for Wash dishes'});
  for(const exit of ['close','backdrop','escape']) {
   await user.click(trigger);const sheet=screen.getByRole('dialog',{name:'Wash dishes'});
   expect(within(sheet).queryByRole('button',{name:'Cancel'})).toBeNull();
   expect(within(sheet).getByRole('button',{name:'Edit Wash dishes'})).toBeVisible();
   expect(within(sheet).getByRole('button',{name:'Delete Wash dishes'})).toBeVisible();
   if(exit==='close')await user.click(within(sheet).getByRole('button',{name:'Close dialog'}));
   else if(exit==='backdrop')await user.click(sheet.parentElement!);
   else await user.keyboard('{Escape}');
   expect(screen.queryByRole('dialog',{name:'Wash dishes'})).toBeNull();
   expect(trigger).toHaveFocus();expect(trigger).toHaveAttribute('aria-expanded','false');
  }
  expect(app.updateChore).not.toHaveBeenCalled();expect(app.deleteChore).not.toHaveBeenCalled();
 });

 it('opens a named action sheet from the title, edits in a sheet, and restores the initiating row', async () => {
  mode.value='app';const user=userEvent.setup();render(<ListView {...props} todayView/>);
  const trigger=screen.getByRole('button',{name:'Actions: Wash dishes'});await user.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded','true');expect(screen.getByRole('dialog',{name:'Wash dishes'})).toHaveTextContent('Use the gentle soap');
  await user.click(screen.getByRole('button',{name:'Edit Wash dishes'}));expect(screen.queryByRole('dialog',{name:'Wash dishes'})).toBeNull();expect(screen.getByRole('textbox',{name:'Chore'})).toHaveFocus();
  expect(screen.getByRole('dialog',{name:'Edit chore'})).toBeVisible();await user.click(screen.getByRole('button',{name:'Cancel'}));expect(trigger).toHaveFocus();expect(document.body.style.overflow).not.toBe('hidden');
 });
 it('uses a topmost safe-Cancel alertdialog; Escape cancels only deletion and preserves the underlying sheet', async () => {
  mode.value='app';const user=userEvent.setup();render(<ListView {...props} todayView/>);
  await user.click(screen.getByRole('button',{name:'More actions for Wash dishes'}));await user.click(screen.getByRole('button',{name:'Delete Wash dishes'}));
  const dialog=screen.getByRole('alertdialog',{name:'Delete chore?'});expect(dialog).toHaveTextContent('Wash dishes');expect(dialog).toHaveTextContent('completion history');expect(within(dialog).getByRole('button',{name:'Cancel'})).toHaveFocus();
  await user.keyboard('{Escape}');expect(screen.queryByRole('alertdialog')).toBeNull();expect(screen.getByRole('dialog',{name:'Wash dishes'})).toBeVisible();expect(app.deleteChore).not.toHaveBeenCalled();
 });
 it.each(['web','app'] as const)('moves focus to the surviving list heading after %s deletion removes the initiating row',async experience=>{
  mode.value=experience;const user=userEvent.setup();app.deleteChore.mockImplementationOnce(async(id:string)=>{app.state.chores=app.state.chores.filter(chore=>chore.id!==id);});render(<ListView {...props} todayView/>);
  if(experience==='app')await user.click(screen.getByRole('button',{name:'More actions for Wash dishes'}));
  await user.click(screen.getByRole('button',{name:'Delete Wash dishes'}));await user.click(within(screen.getByRole('alertdialog')).getByRole('button',{name:'Delete chore'}));
  expect(screen.queryByText('Wash dishes')).toBeNull();expect(screen.queryByRole('dialog')).toBeNull();expect(screen.getByRole('heading',{name:'Today'})).toHaveFocus();
 });
 it('moves focus to a surviving heading after saving a date removes the edited row',async()=>{
  const user=userEvent.setup();app.updateChore.mockImplementationOnce(async(updated:Chore)=>{app.state.chores=app.state.chores.map(chore=>chore.id===updated.id?updated:chore);});render(<ListView {...props} todayView/>);
  await user.click(screen.getByRole('button',{name:'Edit Wash dishes'}));fireEvent.change(screen.getByLabelText('Date'),{target:{value:shiftDate(dateKey(),2)}});await user.click(screen.getByRole('button',{name:'Save changes'}));
  expect(screen.queryByRole('button',{name:'View details: Wash dishes'})).toBeNull();expect(screen.getByRole('heading',{name:'Today'})).toHaveFocus();
 });
 it('warns about the full series and history, blocks repeat submission, retains failures, then deletes only the named fixture', async () => {
  const user=userEvent.setup();app.state.chores=[chore('series','Feed cat',{recurrence:'daily'})];render(<ListView {...props} todayView/>);
  await user.click(screen.getByRole('button',{name:'Delete Feed cat'}));const dialog=screen.getByRole('alertdialog');expect(dialog).toHaveTextContent('every occurrence');expect(dialog).toHaveTextContent('completion history');
  let fail!:(reason:Error)=>void;app.deleteChore.mockImplementationOnce(()=>new Promise((_,reject)=>{fail=reject;}));
  fireEvent.click(within(dialog).getByRole('button',{name:'Delete entire series'}));fireEvent.click(within(dialog).getByRole('button',{name:'Deleting…'}));expect(app.deleteChore).toHaveBeenCalledOnce();expect(within(dialog).getByRole('button',{name:'Cancel'})).toBeDisabled();
  await act(async()=>fail(new Error('Offline.')));expect(screen.getByRole('alert')).toHaveTextContent('The chore has not been deleted.');expect(screen.getByRole('button',{name:'View details: Feed cat'})).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button',{name:'Delete entire series'}));await waitFor(()=>expect(screen.queryByRole('alertdialog')).toBeNull());expect(app.deleteChore).toHaveBeenLastCalledWith('series');
 });
});
