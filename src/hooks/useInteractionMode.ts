import { useEffect, useState } from 'react';
export type InteractionMode = 'web' | 'app';
const desktopQuery = '(min-width: 900px)';
export function previewInteractionMode(): InteractionMode | null {
  if ((window as Window & { __NESMI_PREVIEW__?: boolean }).__NESMI_PREVIEW__ !== true) return null;
  const value = new URLSearchParams(window.location.search).get('experience');
  return value === 'web' || value === 'app' ? value : null;
}
/** Preview modes are explicit simulations; normal app behavior follows available width. */
export function useInteractionMode(): InteractionMode {
  const [mode, setMode] = useState<InteractionMode>(() => previewInteractionMode() || (window.matchMedia(desktopQuery).matches ? 'web' : 'app'));
  useEffect(() => {
    const media = window.matchMedia(desktopQuery);
    const update = () => setMode(previewInteractionMode() || (media.matches ? 'web' : 'app'));
    media.addEventListener('change', update); update();
    return () => media.removeEventListener('change', update);
  }, []);
  return mode;
}
