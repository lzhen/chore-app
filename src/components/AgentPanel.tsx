import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import '../styles/planning-tools.css';
import { ChatAssistant } from './ChatAssistant';

export function AgentPanel({ suspended = false, showTrigger = true }: { suspended?: boolean; showTrigger?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const visible = isOpen && !suspended;
  useEffect(() => { if (suspended) setIsOpen(false); }, [suspended]);
  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    const oldInert = root?.inert || false;
    const oldOverflow = document.body.style.overflow;
    const media = window.matchMedia('(max-width: 1099px)');
    const adapt = () => {
      if (root) root.inert = media.matches || oldInert;
      document.body.style.overflow = media.matches ? 'hidden' : oldOverflow;
      document.body.classList.toggle('nesmi-assistant-docked', !media.matches);
      panel.current?.setAttribute('aria-modal', String(media.matches));
      if (media.matches && !panel.current?.contains(document.activeElement)) panel.current?.focus();
    };
    adapt(); media.addEventListener('change', adapt);
    panel.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (media.matches || panel.current?.contains(document.activeElement))) { event.preventDefault(); event.stopPropagation(); setIsOpen(false); }
      if (event.key !== 'Tab' || !media.matches || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(el => el.getClientRects().length > 0);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      media.removeEventListener('change', adapt); document.removeEventListener('keydown', key, true);
      if (root) root.inert = oldInert; document.body.style.overflow = oldOverflow; document.body.classList.remove('nesmi-assistant-docked');
      if (document.activeElement === document.body || panel.current?.contains(document.activeElement)) (trigger.current || previous)?.focus();
    };
  }, [visible]);

  return (
    <>
      {/* Floating Agent Button */}
      {showTrigger && !suspended && <button
        ref={trigger}
        onClick={() => setIsOpen(!isOpen)}
        className="nesmi-agent-trigger rounded-full flex items-center justify-center"
        aria-label="Assistant" aria-expanded={visible} aria-controls="nesmi-assistant"
        title="Assistant"
      >
        <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      </button>}

      {createPortal(<section ref={panel} id="nesmi-assistant" className="nesmi-assistant" role="dialog" aria-label="Assistant" tabIndex={-1} hidden={!visible}>
        <header className="nesmi-assistant-header"><h2>Assistant</h2><button type="button" className="touch-button" aria-label="Close assistant" onClick={() => setIsOpen(false)}>✕</button></header>
        <div className="nesmi-assistant-chat"><ChatAssistant active={visible}/></div>
      </section>, document.body)}
    </>
  );
}
