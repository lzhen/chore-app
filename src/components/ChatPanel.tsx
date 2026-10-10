import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './ChatPanel.css';

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  suspended?: boolean;
  children: ReactNode;
  footer: ReactNode;
}

const DESKTOP_QUERY = '(min-width: 1024px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const TRANSITION_MS = 200;

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

// Shared chore forms are separate portals. Their keyboard/focus ownership takes
// precedence, including the brief interval before React processes suspension.
function hasOtherDialog(panel: HTMLElement | null) {
  return [...document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')]
    .some(dialog => dialog !== panel && !dialog.closest('[hidden], [aria-hidden="true"]'));
}

function restoreFocus(target: HTMLElement | null) {
  if (target?.isConnected && !target.closest('[inert], [hidden], [aria-hidden="true"]')) {
    target.focus({ preventScroll: true });
  }
}

export function ChatPanel({ open, onClose, busy = false, suspended = false, children, footer }: ChatPanelProps) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const panel = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const focusOnActivation = useRef(true);
  const close = useRef(onClose);
  const current = useRef({ open, busy, suspended, desktop });
  const [otherDialog, setOtherDialog] = useState(false);
  const detectedDialog = useRef(false);
  const [present, setPresent] = useState(open);
  const [entered, setEntered] = useState(false);
  const [bounds, setBounds] = useState<CSSProperties>({});
  const titleId = useId();
  const subtitleId = useId();
  const inactive = suspended || otherDialog;
  close.current = onClose;
  current.current = { open, busy, suspended, desktop };

  useLayoutEffect(() => {
    let frame = 0;
    let timer = 0;
    if (open) {
      setPresent(true);
      if (reducedMotion) setEntered(true);
      else {
        // Commit the offscreen style before the next frame starts the transition.
        panel.current?.getBoundingClientRect();
        frame = requestAnimationFrame(() => setEntered(true));
      }
    } else {
      setEntered(false);
      if (reducedMotion) setPresent(false);
      else timer = window.setTimeout(() => setPresent(false), TRANSITION_MS);
    }
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [open, reducedMotion]);

  useLayoutEffect(() => {
    panel.current?.toggleAttribute('inert', !open || inactive);
  }, [open, inactive]);

  useEffect(() => {
    if (!open) {
      detectedDialog.current = false;
      setOtherDialog(false);
      return;
    }
    const update = () => {
      const next = hasOtherDialog(panel.current);
      if (next !== detectedDialog.current) {
        detectedDialog.current = next;
        setOtherDialog(next);
      }
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['role', 'hidden', 'aria-hidden'] });
    return () => observer.disconnect();
  }, [open]);

  // Measure the actual fixed shell, rather than assuming a header/footer height.
  // visualViewport also keeps the composer above mobile browser chrome/keyboard.
  useLayoutEffect(() => {
    if (!open && !present) return;
    const header = document.querySelector<HTMLElement>('.chore-header');
    const addBar = document.querySelector<HTMLElement>('.nesmi-add-bar');
    const viewport = window.visualViewport;
    const measure = () => {
      const headerRect = header?.getBoundingClientRect();
      const addRect = addBar?.getBoundingClientRect();
      setBounds({
        '--chat-panel-top': `${Math.max(12, (headerRect?.bottom || 0) + 12)}px`,
        '--chat-panel-bottom': `${Math.max(12, addRect && addRect.height > 0 ? window.innerHeight - addRect.top + 12 : 12)}px`,
        '--chat-viewport-top': `${viewport?.offsetTop || 0}px`,
        '--chat-viewport-left': `${viewport?.offsetLeft || 0}px`,
        '--chat-viewport-height': `${viewport?.height || window.innerHeight}px`,
        '--chat-viewport-width': `${viewport?.width || window.innerWidth}px`,
      } as CSSProperties);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (header) observer.observe(header);
    if (addBar) observer.observe(addBar);
    window.addEventListener('resize', measure);
    viewport?.addEventListener('resize', measure);
    viewport?.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      viewport?.removeEventListener('resize', measure);
      viewport?.removeEventListener('scroll', measure);
    };
  }, [open, present, desktop]);

  // This passive cleanup precedes shared Dialog's passive setup when a form
  // replaces chat. Resuming similarly waits for the form to release its lock.
  // An unexpected external dialog may have inherited our lock; defer its final
  // release until that dialog has removed its own saved lock.
  useEffect(() => {
    if (!open || desktop || suspended) return;
    const root = document.getElementById('root');
    const previousInert = root?.inert ?? false;
    const previousInertAttribute = root?.hasAttribute('inert') ?? false;
    const previousOverflow = document.body.style.overflow;
    if (root) {
      root.inert = true;
      root.setAttribute('inert', '');
    }
    document.body.style.overflow = 'hidden';
    const release = () => {
      if (root) {
        root.inert = previousInert;
        root.toggleAttribute('inert', previousInertAttribute);
      }
      document.body.style.overflow = previousOverflow;
    };
    return () => {
      if (hasOtherDialog(panel.current) && !current.current.suspended) {
        const observer = new MutationObserver(() => {
          if (!hasOtherDialog(panel.current)) {
            observer.disconnect();
            release();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden'] });
      } else release();
    };
  }, [open, desktop, suspended]);

  useLayoutEffect(() => {
    let frame = 0;
    if (open && !wasOpen.current) {
      focusOnActivation.current = true;
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && !panel.current?.contains(focused)) opener.current = focused;
    } else if (!open && wasOpen.current && !inactive && !hasOtherDialog(panel.current)) {
      frame = requestAnimationFrame(() => {
        if (!current.current.open && !hasOtherDialog(panel.current)) restoreFocus(opener.current);
      });
    }
    wasOpen.current = open;
    return () => cancelAnimationFrame(frame);
  }, [open, inactive]);

  useLayoutEffect(() => {
    if (open && inactive) focusOnActivation.current = !desktop || Boolean(panel.current?.contains(document.activeElement));
  }, [open, inactive, desktop]);

  useEffect(() => {
    if (!open || inactive) return;
    if (desktop && !focusOnActivation.current) {
      focusOnActivation.current = true;
      return;
    }
    // Focus the shell, never the composer: opening chat must not summon a keyboard.
    const frame = requestAnimationFrame(() => {
      if (!hasOtherDialog(panel.current)) {
        if (!opener.current?.isConnected || opener.current === document.body) {
          const focused = document.activeElement;
          if (focused instanceof HTMLElement && focused !== document.body && !panel.current?.contains(focused)) opener.current = focused;
        }
        panel.current?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [open, inactive, desktop]);

  useEffect(() => {
    if (!open || inactive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const box = panel.current;
      if (!box || event.defaultPrevented || event.isComposing || current.current.suspended || hasOtherDialog(box)) return;
      const ownsFocus = box.contains(document.activeElement);
      if (event.key === 'Escape' && (ownsFocus || !current.current.desktop) && !box.querySelector('[data-open-picker]')) {
        event.preventDefault();
        event.stopPropagation();
        if (!current.current.busy) close.current();
      }
      if (event.key !== 'Tab' || current.current.desktop) return;
      const items = [...box.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]')]
        .filter(element => element.tabIndex >= 0 && !element.closest('[hidden], [inert], [aria-hidden="true"]') && window.getComputedStyle(element).visibility !== 'hidden' && window.getComputedStyle(element).display !== 'none')
        .sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) {
        event.preventDefault();
        box.focus({ preventScroll: true });
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === box || !ownsFocus)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === box || !ownsFocus)) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      const box = panel.current;
      if (!current.current.desktop && !current.current.suspended && box && !box.contains(event.target as Node) && !hasOtherDialog(box)) {
        box.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open, inactive]);

  useEffect(() => () => {
    if (current.current.open && !current.current.suspended && !hasOtherDialog(panel.current)) restoreFocus(opener.current);
  }, []);

  const requestClose = () => {
    if (open && !busy && !inactive && !hasOtherDialog(panel.current)) close.current();
  };

  return createPortal(
    <div
      className="nesmi-chat-layer"
      data-mode={desktop ? 'desktop' : 'mobile'}
      data-state={open && entered ? 'open' : 'closed'}
      data-suspended={inactive ? 'true' : undefined}
      hidden={!open && !present}
      aria-hidden={!open || inactive ? true : undefined}
      style={bounds}
    >
      {!desktop && <div className="nesmi-chat-backdrop" aria-hidden="true" onClick={requestClose} />}
      <section
        ref={panel}
        className="nesmi-chat-panel"
        role={open ? (desktop ? 'complementary' : 'dialog') : undefined}
        aria-modal={!desktop && open && !inactive ? true : undefined}
        aria-labelledby={titleId}
        aria-describedby={subtitleId}
        tabIndex={-1}
      >
        <header className="nesmi-chat-panel-header">
          <div>
            <h2 id={titleId}>Chore assistant</h2>
            <p id={subtitleId}>Simple commands</p>
          </div>
          <button className="nesmi-chat-panel-close" type="button" aria-label="Close chore assistant" onClick={requestClose} disabled={busy}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m6 6 12 12M6 18 18 6" strokeLinecap="round" /></svg>
          </button>
        </header>
        <div className="nesmi-chat-panel-messages">{children}</div>
        <footer className="nesmi-chat-panel-footer">{footer}</footer>
      </section>
    </div>,
    document.body,
  );
}
