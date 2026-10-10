import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { previewInteractionMode, useInteractionMode } from './useInteractionMode';
const flag = () => window as Window & { __NESMI_PREVIEW__?: boolean };
afterEach(() => { cleanup(); delete flag().__NESMI_PREVIEW__; window.location.search=''; vi.restoreAllMocks(); });
it('only accepts explicit modes inside the isolated preview', () => {
  window.location.search='?experience=web';
  expect(previewInteractionMode()).toBeNull(); flag().__NESMI_PREVIEW__=true;
  expect(previewInteractionMode()).toBe('web');
  window.location.search='?experience=app'; expect(previewInteractionMode()).toBe('app');
  window.location.search='?experience=unknown'; expect(previewInteractionMode()).toBeNull();
});
it('follows normal viewport changes but keeps explicit simulation stable', () => {
  const media = new EventTarget(); Object.assign(media, {matches:true,media:'(min-width: 900px)'});
  vi.spyOn(window, 'matchMedia').mockReturnValue(media as MediaQueryList);
  const {result}=renderHook(useInteractionMode); expect(result.current).toBe('web');
  act(()=>{Object.assign(media,{matches:false});media.dispatchEvent(new Event('change'));});expect(result.current).toBe('app');
  flag().__NESMI_PREVIEW__=true; window.location.search='?experience=web';
  act(()=>media.dispatchEvent(new Event('change')));expect(result.current).toBe('web');
});
