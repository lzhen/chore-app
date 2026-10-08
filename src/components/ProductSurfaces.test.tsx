import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {Dashboard} from './Dashboard';
import {AccountSettings} from './AccountSettings';
const auth=vi.hoisted(()=>({user:{email:'sample@example.test'},signOut:vi.fn(),deleteAccount:vi.fn()}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('../context/AppContext',()=>({useApp:()=>({state:{chores:[],teamMembers:[],completions:[]}})}));
vi.mock('./ThemeSelector',()=>({ThemeSelector:()=> <button>Appearance</button>}));
afterEach(cleanup);
describe('shared product surfaces',()=>{
 it('renders embedded insights as a page and keeps every section available',async()=>{
  const {container}=render(<Dashboard embedded onClose={vi.fn()}/>);
  expect(container.querySelector('.nesmi-page-content')).toBeInTheDocument();
  expect(container.querySelector('.fluent-card')).not.toBeInTheDocument();
  const user=userEvent.setup();
  for(const name of ['Activity','Workload','Achievements','Overview']) {
   await user.click(screen.getByRole('button',{name}));
   expect(screen.getByRole('button',{name})).toHaveAttribute('aria-pressed','true');
  }
 });
 it('keeps account actions behind explicit activation, with cancellable deletion',async()=>{
  const {container}=render(<AccountSettings embedded isOpen onClose={vi.fn()}/>);
  expect(container.querySelector('.nesmi-page-content')).toBeInTheDocument();
  expect(container.querySelector('.fluent-card')).not.toBeInTheDocument();
  expect(screen.getByText('sample@example.test')).toBeInTheDocument();
  const user=userEvent.setup();
  await user.click(screen.getByRole('button',{name:'Delete my account'}));
  expect(screen.getByRole('button',{name:'Delete permanently'})).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Cancel'}));
  expect(screen.queryByRole('button',{name:'Delete permanently'})).not.toBeInTheDocument();
  expect(auth.signOut).not.toHaveBeenCalled();expect(auth.deleteAccount).not.toHaveBeenCalled();
 });
});
