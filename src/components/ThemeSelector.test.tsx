import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/ThemeContext';
import { ThemeSelector } from './ThemeSelector';
beforeEach(()=>localStorage.clear());
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function media(initial:boolean){let dark=initial;const listeners=new Set<()=>void>();const query={get matches(){return dark;},addEventListener:(_type:string,cb:()=>void)=>listeners.add(cb),removeEventListener:(_type:string,cb:()=>void)=>listeners.delete(cb)};vi.spyOn(window,'matchMedia').mockReturnValue(query as unknown as MediaQueryList);return(value:boolean)=>act(()=>{dark=value;listeners.forEach(fn=>fn());});}
describe('direct appearance toggle with automatic default',()=>{
 it('follows device changes until the button is pressed and never opens a menu',()=>{
  const device=media(true);render(<ThemeProvider><ThemeSelector/></ThemeProvider>);
  expect(document.documentElement).toHaveAttribute('data-theme','dark');expect(localStorage.getItem('theme')).toBe('system');
  expect(screen.getByRole('button',{name:'Switch to light mode'})).toBeInTheDocument();
  device(false);expect(screen.getByRole('button',{name:'Switch to dark mode'})).toBeInTheDocument();
  expect(screen.queryByRole('combobox')).toBeNull();expect(screen.queryByRole('listbox')).toBeNull();expect(localStorage.getItem('theme')).toBe('system');
 });
 it('switches immediately, persists manual choice, and supports keyboard toggling',async()=>{
  const device=media(true),user=userEvent.setup();const view=render(<ThemeProvider><ThemeSelector/></ThemeProvider>);
  await user.click(screen.getByRole('button',{name:'Switch to light mode'}));expect(localStorage.getItem('theme')).toBe('light');
  device(false);device(true);expect(document.documentElement).toHaveAttribute('data-theme','light');
  view.unmount();render(<ThemeProvider><ThemeSelector/></ThemeProvider>);expect(document.documentElement).toHaveAttribute('data-theme','light');
  screen.getByRole('button',{name:'Switch to dark mode'}).focus();await user.keyboard('{Enter}');expect(document.documentElement).toHaveAttribute('data-theme','dark');
  await user.keyboard(' ');expect(document.documentElement).toHaveAttribute('data-theme','light');expect(screen.queryByRole('listbox')).toBeNull();
 });
});
