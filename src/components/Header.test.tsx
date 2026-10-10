import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Header } from './Header';
vi.mock('./ThemeSelector', () => ({ThemeSelector: () => <button>Theme</button>}));
afterEach(cleanup);
const props={onMenuClick:vi.fn(),onDashboardClick:vi.fn(),onViewModeChange:vi.fn(),searchQuery:'',onSearchChange:vi.fn()};
describe('centered Nesmi header', () => {
 it('uses the existing family action through a decorative three-line hamburger', async () => {
  const {container,rerender}=render(<Header {...props} viewMode="today" menuOpen={false}/>);
  const menu=screen.getByRole('button',{name:'Open family menu'});
  expect(menu).toHaveAttribute('aria-expanded','false'); expect(menu).not.toHaveAttribute('aria-controls');
  expect(menu.querySelector('svg')).toHaveAttribute('aria-hidden','true');
  expect(menu.querySelector('path')).toHaveAttribute('d','M4 6h16 M4 12h16 M4 18h16'); expect(menu.querySelector('circle')).toBeNull();
  await userEvent.click(menu); expect(props.onMenuClick).toHaveBeenCalledOnce();
  rerender(<Header {...props} viewMode="today" menuOpen/>); expect(menu).toHaveAttribute('aria-expanded','true'); expect(menu).toHaveAttribute('aria-controls','nesmi-family-panel');
  expect(container.querySelector('.nesmi-header-leading')).toContainElement(menu);
 });
 it('keeps the original brand in a separate center track as search appears and disappears', async () => {
  const {container,rerender}=render(<Header {...props} viewMode="today"/>);
  const header=screen.getByRole('banner'); expect(header).toHaveClass('nesmi-header-centered');
  const brand=container.querySelector('.chore-brand'); expect(brand).toHaveTextContent('Nesmi');
  expect(container.querySelector('.nesmi-header-actions')).toContainElement(screen.getByRole('button',{name:'Search chores'}));
  await userEvent.click(screen.getByRole('button',{name:'Search chores'})); expect(screen.getByRole('searchbox',{name:'Search chores'})).toBeInTheDocument();
  rerender(<Header {...props} viewMode="account"/>); expect(within(header).queryByRole('button',{name:'Search chores'})).toBeNull(); expect(container.querySelector('.chore-brand')).toBe(brand);
  expect(within(header).getByRole('button',{name:'Theme'})).toBeInTheDocument();
 });
});
