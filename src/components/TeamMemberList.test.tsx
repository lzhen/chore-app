import { readFileSync } from 'node:fs';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {TeamMemberList} from './TeamMemberList';
import {Dialog} from './Dialog';
const app=vi.hoisted(()=>({state:{teamMembers:[{id:'alex',name:'Alex',color:'#3B82F6',points:45},{id:'eric',name:'Eric',color:'#EC4899',points:60}]},addMember:vi.fn(),removeMember:vi.fn()}));
vi.mock('../context/AppContext',()=>({useApp:()=>app}));
const interaction = vi.hoisted(() => ({ mode: 'app' as 'app' | 'web' }));
vi.mock('../hooks/useInteractionMode', () => ({ useInteractionMode: () => interaction.mode }));
const memberStyles = readFileSync('src/components/TeamMemberList.css', 'utf8');
beforeEach(() => { interaction.mode = 'app'; });
afterEach(()=>{cleanup();vi.restoreAllMocks();app.removeMember.mockReset();});
describe('simplified family drawer',()=>{
 it('shows names first, replaces square checks with labelled checkbox targets and keeps add after people',async()=>{
  const toggle=vi.fn(),{container,rerender}=render(<TeamMemberList onToggleMemberVisibility={toggle}/>);
  const check=screen.getByRole('checkbox',{name:'Show Alex’s chores'});
  expect(check).toHaveAttribute('aria-checked','true');expect(check.querySelector('.nesmi-member-check')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Open Alex’s profile'})).toHaveTextContent('Alex');
  expect(screen.queryByText('45pts')).toBeNull();expect(screen.queryByText('Oct 2026')).toBeNull();
  const list=container.querySelector('ul')!,form=container.querySelector('form')!;
  expect(list.compareDocumentPosition(form)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await userEvent.click(check);expect(toggle).toHaveBeenCalledWith('alex');
  rerender(<TeamMemberList hiddenMembers={new Set(['alex'])} onToggleMemberVisibility={toggle}/>);expect(check).toHaveAttribute('aria-checked','false');
 });
 it('retains availability/profile and explicit removal confirmation behind one actions control',async()=>{
  const profile=vi.fn(),availability=vi.fn(),confirm=vi.spyOn(window,'confirm'),user=userEvent.setup();
  render(<TeamMemberList onProfileOpen={profile} onAvailabilityOpen={availability}/>);
  await user.click(screen.getByRole('button',{name:'Open Alex’s profile'}));expect(profile).toHaveBeenCalledWith(app.state.teamMembers[0]);
  const more=screen.getByRole('combobox',{name:'Actions for Alex'});await user.click(more);await user.click(screen.getByRole('option',{name:'Availability'}));expect(availability).toHaveBeenCalledWith(app.state.teamMembers[0]);
  await user.click(more);await user.click(screen.getByRole('option',{name:'Profile'}));expect(profile).toHaveBeenCalledTimes(2);
  await user.click(more);await user.click(screen.getByRole('option',{name:'Remove member'}));
  const dialog=screen.getByRole('alertdialog',{name:'Remove Alex?'});
  expect(confirm).not.toHaveBeenCalled();expect(app.removeMember).not.toHaveBeenCalled();
  expect(dialog).toHaveAccessibleDescription('Their chores will become unassigned. Their availability and completion history will also be removed. This can’t be undone.');
  expect(within(dialog).getByRole('button',{name:'Cancel'})).toHaveFocus();
  await user.click(within(dialog).getByRole('button',{name:'Cancel'}));
  expect(screen.queryByRole('alertdialog')).toBeNull();expect(app.removeMember).not.toHaveBeenCalled();
  await waitFor(()=>expect(more).toHaveFocus());
 });
 it('retains add, trims names and blocks empty submissions',async()=>{
  const user=userEvent.setup();render(<TeamMemberList/>);expect(screen.getByRole('button',{name:'Add'})).toBeDisabled();await user.type(screen.getByLabelText('Add a person'),'  Jen  ');await user.click(screen.getByRole('button',{name:'Add'}));expect(app.addMember).toHaveBeenCalledWith('Jen');expect(screen.getByLabelText('Add a person')).toHaveValue('');
 });
 it('uses a side drawer with no visible X, retains accessible close and nested Escape handling',async()=>{
  const onClose=vi.fn(),user=userEvent.setup();render(<Dialog variant="drawer" title="Family" onClose={onClose}><TeamMemberList/></Dialog>);
  const dialog=screen.getByRole('dialog',{name:'Family'});expect(dialog).toHaveClass('family-panel');expect(dialog).not.toHaveClass('chore-dialog');
  expect(within(dialog).getByRole('button',{name:'Close family menu'})).toHaveClass('sr-only');expect(within(dialog).queryByText('✕')).toBeNull();
  await user.click(screen.getByRole('combobox',{name:'Actions for Alex'}));await user.keyboard('{Escape}');expect(screen.queryByRole('listbox')).toBeNull();expect(onClose).not.toHaveBeenCalled();await user.keyboard('{Escape}');expect(onClose).toHaveBeenCalledOnce();
 });
});

describe('member removal confirmation',()=>{
 async function openRemoval(user:ReturnType<typeof userEvent.setup>){
  await user.click(screen.getByRole('combobox',{name:'Actions for Alex'}));
  await user.click(screen.getByRole('option',{name:'Remove member'}));
  return screen.getByRole('alertdialog',{name:'Remove Alex?'});
 }
 it('covers only the family layer and restores its keyboard/focus boundary after cancellation',async()=>{
  const user=userEvent.setup(),onClose=vi.fn();
  render(<Dialog variant="drawer" title="Family" onClose={onClose}><TeamMemberList/></Dialog>);
  const family=screen.getByRole('dialog',{name:'Family'}),overlay=family.parentElement!;
  const more=screen.getByRole('combobox',{name:'Actions for Alex'});
  await openRemoval(user);
  expect(overlay.inert).toBe(true);expect(overlay).toHaveAttribute('aria-hidden','true');expect(family).toHaveAttribute('aria-modal','false');
  fireEvent.click(overlay.querySelector('.family-backdrop')!);expect(onClose).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('alertdialog')).toBeNull();expect(onClose).not.toHaveBeenCalled();expect(overlay.inert).toBe(false);
  expect(family).toHaveAttribute('aria-modal','true');expect(overlay).not.toHaveAttribute('aria-hidden');expect(document.body.style.overflow).toBe('hidden');
  await waitFor(()=>expect(more).toHaveFocus());
  await user.keyboard('{Escape}');expect(onClose).toHaveBeenCalledOnce();
 });
 it('keeps Tab and Shift+Tab inside only the active confirmation',async()=>{
  vi.spyOn(HTMLElement.prototype,'getClientRects').mockImplementation(function(){return [{width:44,height:44}] as unknown as DOMRectList;});
  const user=userEvent.setup();render(<Dialog variant="drawer" title="Family" onClose={vi.fn()}><TeamMemberList/></Dialog>);
  const dialog=await openRemoval(user),remove=within(dialog).getByRole('button',{name:'Remove Alex'}),close=within(dialog).getByRole('button',{name:'Close dialog'}),cancel=within(dialog).getByRole('button',{name:'Cancel'});
  expect(cancel).toHaveFocus();
  await user.tab();expect(remove).toHaveFocus();
  await user.tab();expect(close).toHaveFocus();
  await user.tab({shift:true});expect(remove).toHaveFocus();
  await user.tab({shift:true});expect(cancel).toHaveFocus();
 });
 it('supports safe backdrop and X cancellation without removing anyone',async()=>{
  const user=userEvent.setup();render(<TeamMemberList/>);
  let dialog=await openRemoval(user);fireEvent.click(dialog.parentElement!);
  expect(screen.queryByRole('alertdialog')).toBeNull();expect(app.removeMember).not.toHaveBeenCalled();
  dialog=await openRemoval(user);await user.click(within(dialog).getByRole('button',{name:'Close dialog'}));
  expect(screen.queryByRole('alertdialog')).toBeNull();expect(app.removeMember).not.toHaveBeenCalled();
 });
 it('guards repeat submissions and dismissal while pending, then keeps failure available for retry',async()=>{
  let reject!:(error:Error)=>void;
  app.removeMember.mockImplementationOnce(()=>new Promise<void>((_,fail)=>{reject=fail;}));
  const user=userEvent.setup(),onClose=vi.fn();
  render(<Dialog variant="drawer" title="Family" onClose={onClose}><TeamMemberList/></Dialog>);
  const dialog=await openRemoval(user),remove=within(dialog).getByRole('button',{name:'Remove Alex'});
  fireEvent.click(remove);fireEvent.click(remove);
  expect(app.removeMember).toHaveBeenCalledTimes(1);expect(app.removeMember).toHaveBeenCalledWith('alex');
  expect(dialog).toHaveAttribute('aria-busy','true');expect(within(dialog).getByRole('button',{name:'Cancel'})).toBeDisabled();expect(within(dialog).getByRole('button',{name:'Removing…'})).toBeDisabled();
  await user.keyboard('{Escape}');fireEvent.click(dialog.parentElement!);expect(dialog).toBeInTheDocument();expect(onClose).not.toHaveBeenCalled();
  await act(async()=>reject(new Error('Could not remove member. Please try again.')));
  expect(within(dialog).getByRole('alert')).toHaveTextContent('Could not remove member. Please try again.');expect(within(dialog).getByRole('button',{name:'Remove Alex'})).toBeEnabled();
  app.removeMember.mockResolvedValueOnce(undefined);
  await user.click(within(dialog).getByRole('button',{name:'Remove Alex'}));
  expect(app.removeMember).toHaveBeenCalledTimes(2);expect(screen.queryByRole('alertdialog')).toBeNull();expect(screen.getByRole('dialog',{name:'Family'})).toBeInTheDocument();
 });
 it('restores safe fallback focus when the removed member disappears',async()=>{
  const user=userEvent.setup(),members=app.state.teamMembers;
  app.removeMember.mockImplementationOnce(async()=>{app.state.teamMembers=members.filter(member=>member.id!=='alex');});
  try{
   render(<Dialog variant="drawer" title="Family" onClose={vi.fn()}><TeamMemberList/></Dialog>);
   const dialog=await openRemoval(user);await user.click(within(dialog).getByRole('button',{name:'Remove Alex'}));
   expect(screen.queryByRole('combobox',{name:'Actions for Alex'})).toBeNull();
   await waitFor(()=>expect(screen.getByRole('heading',{name:'Family members'})).toHaveFocus());
  }finally{app.state.teamMembers=members;}
 });
 it('releases the shared page lock even when both layers unmount together',async()=>{
  const root=document.createElement('div');root.id='root';root.inert=false;document.body.appendChild(root);
  document.body.style.overflow='scroll';
  const user=userEvent.setup(),view=render(<Dialog variant="drawer" title="Family" onClose={vi.fn()}><TeamMemberList/></Dialog>,{container:root});
  await openRemoval(user);expect(root.inert).toBe(true);expect(document.body.style.overflow).toBe('hidden');
  view.unmount();expect(root.inert).toBe(false);expect(document.body.style.overflow).toBe('scroll');root.remove();document.body.style.overflow='';
 });
});


describe('platform-aware family actions', () => {
 it('keeps app actions explicit through one tap menu', async () => {
  const user = userEvent.setup();
  render(<TeamMemberList />);
  expect(screen.queryByRole('button', { name: 'Manage Alex’s availability' })).toBeNull();
  expect(screen.queryByRole('group', { name: 'Actions for Alex' })).toBeNull();
  await user.click(screen.getByRole('combobox', { name: 'Actions for Alex' }));
  expect(screen.getByRole('option', { name: 'Profile' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Availability' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Remove member' })).toBeInTheDocument();
 });
 it('gives web rows direct named availability/remove actions and one profile route', async () => {
  interaction.mode = 'web';
  const user = userEvent.setup(), profile = vi.fn(), availability = vi.fn();
  render(<TeamMemberList onProfileOpen={profile} onAvailabilityOpen={availability} />);
  expect(screen.queryByRole('combobox', { name: 'Actions for Alex' })).toBeNull();
  const actions = screen.getByRole('group', { name: 'Actions for Alex' });
  expect(within(actions).getAllByRole('button')).toHaveLength(2);
  expect(screen.getAllByRole('button', { name: /Alex.*profile/ })).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Open Alex’s profile' }));
  expect(profile).toHaveBeenCalledWith(app.state.teamMembers[0]);
  await user.click(within(actions).getByRole('button', { name: 'Manage Alex’s availability' }));
  expect(availability).toHaveBeenCalledWith(app.state.teamMembers[0]);
  expect(within(actions).getByText('Availability')).toHaveAttribute('aria-hidden', 'true');
 });
 it('keeps web removal guarded and returns focus to its direct action on cancel', async () => {
  interaction.mode = 'web';
  const user = userEvent.setup(), close = vi.fn();
  render(<Dialog variant="drawer" title="Family" onClose={close}><TeamMemberList /></Dialog>);
  const remove = screen.getByRole('button', { name: 'Remove Alex from family' });
  await user.click(remove);
  const dialog = screen.getByRole('alertdialog', { name: 'Remove Alex?' });
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
  expect(app.removeMember).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('alertdialog')).toBeNull();expect(close).not.toHaveBeenCalled();
  await waitFor(() => expect(remove).toHaveFocus());
 });
 it('keeps a pending confirmation when the interaction mode changes and uses safe focus fallback', async () => {
  interaction.mode = 'web';
  const user = userEvent.setup(), view = render(<TeamMemberList />);
  await user.click(screen.getByRole('button', { name: 'Remove Alex from family' }));
  interaction.mode = 'app';view.rerender(<TeamMemberList />);
  const dialog = screen.getByRole('alertdialog', { name: 'Remove Alex?' });
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
  await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Family members' })).toHaveFocus());
  expect(screen.getByRole('combobox', { name: 'Actions for Alex' })).toBeInTheDocument();
  expect(app.removeMember).not.toHaveBeenCalled();
 });
 it('reserves action space, reveals keyboard actions, and leaves coarse/no-hover controls visible', () => {
  expect(memberStyles).toMatch(/grid-template-columns:\s*44px minmax\(0, 1fr\)/);
  expect(memberStyles).toMatch(/\.nesmi-member-inline-actions\s*\{[^}]*min-height:\s*44px/s);
  expect(memberStyles).toMatch(/\.nesmi-member-inline-action\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/s);
  expect(memberStyles).toContain('.nesmi-family-row:focus-within .nesmi-member-inline-actions');
  expect(memberStyles).toContain('.nesmi-member-inline-action:focus-visible .nesmi-member-action-tooltip');
  expect(memberStyles).toMatch(/@media \(any-pointer: coarse\), \(hover: none\)\s*\{\s*\.nesmi-member-inline-actions\s*\{ opacity: 1; pointer-events: auto;/);
  expect(memberStyles).not.toMatch(/\.nesmi-member-inline-actions\s*\{[^}]*(display:\s*none|visibility:\s*hidden)/);
 });
});
