import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChoreModal } from './ChoreModal';
import { dateKey } from '../utils/dates';

const app = vi.hoisted(() => ({
  state: {teamMembers: [{id: 'alex', name: 'Alex'}], categories: [{id: 'cleaning', name: 'Cleaning'}]},
  addChore: vi.fn(), updateChore: vi.fn(), deleteChore: vi.fn(),
}));
vi.mock('../context/AppContext', () => ({useApp: () => app}));

describe('ChoreModal starter drafts', () => {
  beforeEach(() => {app.addChore.mockResolvedValue(undefined);});
  afterEach(cleanup);

  it('opens an editable suggestion without creating a chore, then saves the chosen owner and details', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ChoreModal isOpen onClose={onClose} defaultValues={{title: 'Wash dishes', recurrence: 'daily', estimatedMinutes: 15}}/>);

    expect(screen.getByRole('textbox', {name: 'Chore'})).toHaveValue('Wash dishes');
    expect(screen.getByRole('combobox', {name: 'Person'})).toHaveTextContent('Unassigned');
    expect(screen.getByRole('combobox', {name: 'Repeat'})).toHaveTextContent('Every day');
    expect(screen.getByRole('spinbutton', {name: 'Estimated minutes · optional'})).toHaveValue(15);
    expect(app.addChore).not.toHaveBeenCalled();
    await user.clear(screen.getByRole('textbox', {name: 'Chore'}));
    await user.type(screen.getByRole('textbox', {name: 'Chore'}), 'Clean the kitchen');
    await user.click(screen.getByRole('combobox', {name: 'Person'}));
    await user.click(screen.getByRole('option', {name: 'Alex'}));
    await user.click(screen.getByRole('combobox', {name: 'Repeat'}));
    await user.click(screen.getByRole('option', {name: 'Every week'}));
    await user.click(screen.getByRole('combobox', {name: 'Category'}));
    await user.click(screen.getByRole('option', {name: 'Cleaning'}));
    await user.clear(screen.getByRole('spinbutton', {name: 'Estimated minutes · optional'}));
    await user.type(screen.getByRole('spinbutton', {name: 'Estimated minutes · optional'}), '20');
    await user.click(screen.getByRole('button', {name: 'Add chore'}));

    expect(app.addChore).toHaveBeenCalledOnce();
    expect(app.addChore).toHaveBeenCalledWith(expect.objectContaining({title: 'Clean the kitchen', date: dateKey(), assigneeId: 'alex', recurrence: 'weekly', estimatedMinutes: 20, categoryId: 'cleaning'}));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('cancels an unchanged suggestion without saving', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ChoreModal isOpen onClose={onClose} defaultValues={{title: 'Do laundry', recurrence: 'weekly', estimatedMinutes: 45}}/>);
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(app.addChore).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('retains the edited draft when saving fails', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    app.addChore.mockRejectedValueOnce(new Error('Connection lost.'));
    render(<ChoreModal isOpen onClose={onClose} defaultValues={{title: 'Take out trash', recurrence: 'weekly', estimatedMinutes: 5}}/>);
    await user.click(screen.getByRole('button', {name: 'Add chore'}));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Connection lost. Your entries are still here.'));
    expect(screen.getByRole('textbox', {name: 'Chore'})).toHaveValue('Take out trash');
    expect(screen.getByRole('spinbutton', {name: 'Estimated minutes · optional'})).toHaveValue(5);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('reliable editor dismissal',()=>{
 afterEach(cleanup);
 it('closes pristine forms from X, while dirty X shows a visible decision and Keep preserves draft',async()=>{
  const user=userEvent.setup(),close=vi.fn();const view=render(<ChoreModal isOpen onClose={close}/>);
  await user.click(screen.getByRole('button',{name:'Close dialog'}));expect(close).toHaveBeenCalledOnce();view.unmount();close.mockClear();
  render(<ChoreModal isOpen onClose={close}/>);await user.type(screen.getByRole('textbox',{name:'Chore'}),'Clean kitchen');
  const form=document.querySelector<HTMLFormElement>('#chore-edit-form')!;const scroller=form.parentElement!;scroller.scrollTop=160;
  await user.click(screen.getByRole('button',{name:'Close dialog'}));expect(screen.getByRole('dialog',{name:'Discard changes?'})).toBeInTheDocument();expect(form).toHaveAttribute('hidden');
  expect(screen.getByRole('button',{name:'Keep editing'})).toHaveFocus();expect(close).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button',{name:'Keep editing'}));expect(screen.getByRole('textbox',{name:'Chore'})).toHaveValue('Clean kitchen');expect(scroller.scrollTop).toBe(160);expect(screen.getByRole('button',{name:'Close dialog'})).toHaveFocus();
  await user.click(screen.getByRole('button',{name:'Close dialog'}));await user.click(screen.getByRole('button',{name:'Discard changes'}));expect(close).toHaveBeenCalledOnce();
 });
 it('Escape first opens discard and then returns to editing; reverting values makes the form pristine',async()=>{
  const user=userEvent.setup(),close=vi.fn();render(<ChoreModal isOpen onClose={close}/>);const title=screen.getByRole('textbox',{name:'Chore'});
  await user.type(title,'Temporary');await user.keyboard('{Escape}');expect(screen.getByRole('dialog',{name:'Discard changes?'})).toBeInTheDocument();await user.keyboard('{Escape}');expect(title).toHaveValue('Temporary');expect(close).not.toHaveBeenCalled();
  await user.clear(title);await user.click(screen.getByRole('button',{name:'Close dialog'}));expect(close).toHaveBeenCalledOnce();
 });
 it('outside click uses the same dirty guard and never discards without a decision',async()=>{
  const user=userEvent.setup(),close=vi.fn();render(<ChoreModal isOpen onClose={close}/>);await user.type(screen.getByRole('textbox',{name:'Chore'}),'Draft');
  await user.click(screen.getByRole('dialog').parentElement!);expect(screen.getByRole('dialog',{name:'Discard changes?'})).toBeInTheDocument();expect(close).not.toHaveBeenCalled();
  await user.click(screen.getByRole('dialog').parentElement!);expect(screen.getByRole('textbox',{name:'Chore'})).toHaveValue('Draft');expect(close).not.toHaveBeenCalled();
 });
});

describe('editor save guard and optional data',()=>{
 afterEach(cleanup);
 it('blocks dismissal only while saving, then completes normally',async()=>{
  let finish:()=>void=()=>{};app.addChore.mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;}));
  const user=userEvent.setup(),close=vi.fn();render(<ChoreModal isOpen onClose={close} defaultValues={{title:'Clean kitchen'}}/>);
  await user.click(screen.getByRole('button',{name:'Add chore'}));expect(screen.getByRole('button',{name:'Close dialog'})).toBeDisabled();
  await user.keyboard('{Escape}');expect(close).not.toHaveBeenCalled();finish();await waitFor(()=>expect(close).toHaveBeenCalledOnce());
 });
 it('keeps Start/End validation and pre-existing advanced values while details are simplified',async()=>{
  const user=userEvent.setup(),close=vi.fn();render(<ChoreModal isOpen onClose={close} defaultValues={{title:'Clean kitchen',startTime:'11:00',endTime:'10:00',priority:'high',estimatedMinutes:30}}/>);
  await user.click(screen.getByRole('button',{name:'Add chore'}));expect(screen.getByRole('alert')).toHaveTextContent('Choose an end time after the start time');expect(close).not.toHaveBeenCalled();
  expect(screen.getByRole('combobox',{name:'Priority'})).toHaveTextContent('High');expect(screen.getByRole('spinbutton',{name:'Estimated minutes · optional'})).toHaveValue(30);
  expect(screen.getByLabelText('Start time · optional')).toHaveValue('11:00');expect(screen.getByLabelText('End time · optional')).toHaveValue('10:00');
 });
});

describe('editor choice menus', () => {
  afterEach(cleanup);
  it('Escape dismisses Person before the pristine dialog without changing its draft', async () => {
    const user = userEvent.setup(), onClose = vi.fn();
    render(<ChoreModal isOpen onClose={onClose}/>);
    const person = screen.getByRole('combobox', {name: 'Person'});
    await user.click(person); await user.keyboard('{End}{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(person).toHaveTextContent('Unassigned'); expect(person).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
    await user.keyboard('{Escape}'); expect(onClose).toHaveBeenCalledOnce();
  });
  it('a changed choice uses the dirty guard and Keep editing preserves the selection', async () => {
    const user = userEvent.setup(), onClose = vi.fn();
    render(<ChoreModal isOpen onClose={onClose}/>);
    const person = screen.getByRole('combobox', {name: 'Person'});
    await user.click(person); await user.click(screen.getByRole('option', {name: 'Alex'}));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', {name: 'Discard changes?'})).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Keep editing'}));
    expect(person).toHaveTextContent('Alex'); expect(person).toHaveFocus();
    await user.click(person); await user.click(screen.getByRole('option', {name: 'Unassigned'}));
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('all four choices save their values while Date and time stay native inputs', async () => {
    const user = userEvent.setup(); app.addChore.mockResolvedValueOnce(undefined);
    render(<ChoreModal isOpen onClose={vi.fn()} defaultValues={{title: 'Task', recurrence: 'weekly', priority: 'high'}}/>);
    for (const [field, option] of [['Person', 'Alex'], ['Repeat', 'Every month'], ['Priority', 'Low'], ['Category', 'Cleaning']]) {
      await user.click(screen.getByRole('combobox', {name: field}));
      await user.click(screen.getByRole('option', {name: option}));
    }
    expect(screen.getByLabelText('Date')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Start time · optional')).toHaveAttribute('type', 'time');
    expect(screen.getByLabelText('End time · optional')).toHaveAttribute('type', 'time');
    await user.click(screen.getByRole('button', {name: 'Add chore'}));
    expect(app.addChore).toHaveBeenCalledWith(expect.objectContaining({assigneeId: 'alex', recurrence: 'monthly', priority: 'low', categoryId: 'cleaning'}));
  });
});


describe('meaningful discard decisions', () => {
 afterEach(cleanup);
 it('opening optional sections, focusing time and selecting the existing owner does not dirty a default draft', async () => {
  const user=userEvent.setup(), onClose=vi.fn();
  render(<ChoreModal isOpen onClose={onClose} defaultDate="2026-10-10"/>);
  await user.click(screen.getByText('Details'));
  await user.click(screen.getByLabelText('Start time · optional'));
  await user.click(screen.getByRole('combobox',{name:'Person'}));
  await user.click(screen.getByRole('option',{name:'Unassigned'}));
  await user.click(screen.getByRole('button',{name:'Cancel'}));
  expect(onClose).toHaveBeenCalledOnce();
  expect(screen.queryByRole('dialog',{name:'Discard changes?'})).not.toBeInTheDocument();
 });
 it('ignores whitespace-only edits and equivalent estimate formatting, matching saved values', async () => {
  const user=userEvent.setup(), onClose=vi.fn();
  render(<ChoreModal isOpen onClose={onClose} defaultValues={{title:'Clean kitchen',description:'Wipe surfaces',estimatedMinutes:15}}/>);
  fireEvent.change(screen.getByRole('textbox',{name:'Chore'}),{target:{value:'  Clean kitchen  '}});
  fireEvent.change(screen.getByRole('textbox',{name:'Notes · optional'}),{target:{value:'Wipe surfaces  '}});
  fireEvent.change(screen.getByRole('spinbutton',{name:'Estimated minutes · optional'}),{target:{value:'015'}});
  await user.click(screen.getByRole('button',{name:'Close dialog'}));
  expect(onClose).toHaveBeenCalledOnce();
 });
 it('describes a changed person even when the chore name is empty and keeps the unsaved choice', async () => {
  const user=userEvent.setup(), onClose=vi.fn();
  render(<ChoreModal isOpen onClose={onClose}/>);
  await user.click(screen.getByRole('combobox',{name:'Person'}));
  await user.click(screen.getByRole('option',{name:'Alex'}));
  await user.click(screen.getByRole('button',{name:'Close dialog'}));
  expect(screen.getByText('Your new chore has unsaved details.')).toBeVisible();
  expect(screen.getByText('Changed: Person.')).toBeVisible();
  expect(screen.getByRole('button',{name:'Keep editing'})).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(screen.getByRole('combobox',{name:'Person'})).toHaveTextContent('Alex');
  expect(onClose).not.toHaveBeenCalled();
 });
 it('lists meaningful changed fields and named chore context without resetting its dates or times', async () => {
  const user=userEvent.setup(), onClose=vi.fn();
  render(<ChoreModal isOpen onClose={onClose} defaultValues={{title:'Clean kitchen',date:'2026-10-10',startTime:'09:00'}}/>);
  fireEvent.change(screen.getByLabelText('Date'),{target:{value:'2026-10-11'}});
  fireEvent.change(screen.getByLabelText('Start time · optional'),{target:{value:'10:30'}});
  await user.click(screen.getByRole('button',{name:'Cancel'}));
  expect(screen.getByRole('region',{name:'Unsaved changes'})).toHaveTextContent('Your changes to Clean kitchen haven’t been saved.');
  expect(screen.getByText('Changed: Date, Start time.')).toBeVisible();
  await user.click(screen.getByRole('button',{name:'Keep editing'}));
  expect(screen.getByLabelText('Date')).toHaveValue('2026-10-11');
  expect(screen.getByLabelText('Start time · optional')).toHaveValue('10:30');
  expect(onClose).not.toHaveBeenCalled();
 });
});
