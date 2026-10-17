import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

beforeEach(()=>{vi.stubGlobal('scrollTo',vi.fn());});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Dialog visible viewport', () => {
 it('keeps the background locked until the last nested dialog closes and restores page position', () => {
  vi.stubGlobal('scrollY',120);vi.stubGlobal('scrollX',0);
  const first=render(<Dialog title="Editor" onClose={()=>{}}>Form</Dialog>);
  expect(document.body.style.position).toBe('fixed');expect(document.body.style.top).toBe('-120px');
  const second=render(<Dialog title="Confirm" onClose={()=>{}}>Confirm</Dialog>);
  second.unmount();expect(document.body.style.position).toBe('fixed');expect(window.scrollTo).not.toHaveBeenCalledWith(0,120);
  first.unmount();expect(document.body.style.position).toBe('');expect(document.body.style.top).toBe('');
  expect(window.scrollTo).toHaveBeenCalledWith(0,120);
 });
 it('tracks visible bounds, restores them after dismissal, and removes listeners', () => {
  const viewport = Object.assign(new EventTarget(), {height: 800, offsetTop: 0});
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {callback(0);return 1;});
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const remove = vi.spyOn(viewport, 'removeEventListener');
  const {unmount} = render(<Dialog title="Editor" onClose={()=>{}} size="form"><input aria-label="Task" /></Dialog>);
  const dialog = screen.getByRole('dialog');
  const host = dialog.parentElement!;
  expect(document.activeElement).toBe(dialog);
  expect(host.style.getPropertyValue('--dialog-viewport-height')).toBe('800px');
  act(()=>{viewport.height=420;viewport.offsetTop=30;viewport.dispatchEvent(new Event('resize'));});
  expect(host.style.getPropertyValue('--dialog-viewport-height')).toBe('420px');
  expect(host.style.getPropertyValue('--dialog-viewport-top')).toBe('30px');
  act(()=>{viewport.height=800;viewport.offsetTop=0;viewport.dispatchEvent(new Event('resize'));});
  expect(host.style.getPropertyValue('--dialog-viewport-height')).toBe('800px');
  expect(host.style.getPropertyValue('--dialog-viewport-top')).toBe('0px');
  unmount();
  expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
  expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
 });
 it('resets document panning while preserving the form internal scroll', () => {
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{callback(0);return 1;});
  vi.stubGlobal('cancelAnimationFrame',vi.fn());
  render(<Dialog title="Editor" onClose={()=>{}}><input aria-label="Notes" /></Dialog>);
  const body=screen.getByRole('textbox').parentElement!;body.scrollTop=240;
  vi.stubGlobal('scrollY',90);
  act(()=>window.dispatchEvent(new Event('scroll')));
  expect(window.scrollTo).toHaveBeenCalledWith(0,0);expect(body.scrollTop).toBe(240);
  vi.stubGlobal('scrollY',0);
 });
 it('reveals a focused field by scrolling only the dialog body', () => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {callback(0);return 1;});
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  render(<Dialog title="Editor" onClose={()=>{}}><input aria-label="Notes" /></Dialog>);
  const field=screen.getByRole('textbox'), body=field.parentElement!;
  vi.spyOn(body,'getBoundingClientRect').mockReturnValue({top:100,bottom:300} as DOMRect);
  vi.spyOn(field,'getBoundingClientRect').mockReturnValue({top:310,bottom:350} as DOMRect);
  act(()=>field.focus());
  expect(body.scrollTop).toBe(62);
  expect(document.documentElement.scrollTop).toBe(0);
  expect(document.body.scrollTop).toBe(0);
 });
});
