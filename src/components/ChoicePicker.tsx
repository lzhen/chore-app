import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './ChoicePicker.css';

type Option = { id: string; label: string; content?: ReactNode };
/** App-owned select: one predictable surface across browsers and input methods. */
export function ChoicePicker({ value, options, onChange, label, children, className = '', align = 'start', id, placeholder = 'Choose an option' }: {
  value: string; options: Option[]; onChange: (value: string) => void; label: string;
  children?: ReactNode; className?: string; align?: 'start' | 'end'; id?: string; placeholder?: string;
}) {
  const listId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 12, top: 12, width: 200, maxHeight: 320 });
  const [host, setHost] = useState<HTMLElement | null>(null);
  const activeIndex = Math.min(active, Math.max(0, options.length - 1));
  const close = (focus = true) => {
    setOpen(false);
    typed.current = { text: '', time: 0 };
    if (focus) trigger.current?.focus({ preventScroll: true });
  };
  const show = (index = Math.max(0, options.findIndex(option => option.id === value))) => {
    setActive(index);
    typed.current = { text: '', time: 0 };
    // Keep dialog menus inside its focus/inert boundary, outside its scrollable body.
    setHost(trigger.current?.closest<HTMLElement>('[role="dialog"]') || document.body);
    setOpen(true);
  };
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = trigger.current?.getBoundingClientRect();
      if (!anchor) return;
      const viewport = window.visualViewport;
      const x = viewport?.offsetLeft || 0, y = viewport?.offsetTop || 0;
      const width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight;
      const safe = getComputedStyle(list.current || trigger.current!);
      const inset = (edge: string) => parseFloat(safe.getPropertyValue(`--picker-safe-${edge}`)) || 0;
      const leftGutter = 12 + inset('left'), rightGutter = 12 + inset('right');
      const topGutter = 12 + inset('top'), bottomGutter = 12 + inset('bottom');
      const menuWidth = Math.max(0, Math.min(Math.max(200, anchor.width), width - leftGutter - rightGutter));
      const below = y + height - bottomGutter - anchor.bottom - 8;
      const above = anchor.top - y - topGutter - 8;
      const border = (parseFloat(safe.borderTopWidth) || 0) + (parseFloat(safe.borderBottomWidth) || 0);
      const desired = Math.min(320, (list.current?.scrollHeight || 208) + border);
      const flip = below < desired && above > below;
      const maxHeight = Math.max(0, Math.min(320, height - topGutter - bottomGutter, flip ? above : below));
      const actualHeight = Math.min(desired, maxHeight);
      setPosition({
        left: Math.max(x + leftGutter, Math.min(align === 'end' ? anchor.right - menuWidth : anchor.left, x + width - rightGutter - menuWidth)),
        top: Math.max(y + topGutter, Math.min(y + height - bottomGutter - actualHeight, flip ? anchor.top - actualHeight - 8 : anchor.bottom + 8)),
        width: menuWidth, maxHeight,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    if (trigger.current) observer.observe(trigger.current);
    if (list.current) observer.observe(list.current);
    window.addEventListener('resize', update); window.addEventListener('scroll', update, { capture: true, passive: true });
    window.visualViewport?.addEventListener('resize', update); window.visualViewport?.addEventListener('scroll', update);
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !list.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true);
      window.visualViewport?.removeEventListener('resize', update); window.visualViewport?.removeEventListener('scroll', update);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open, align, options.length]);
  useLayoutEffect(() => {
    if (open) list.current?.children[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, open]);
  return <>
    <button id={id} ref={trigger} type="button" className={`nesmi-choice-trigger ${className}`} role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-activedescendant={open && options.length ? `${listId}-${activeIndex}` : undefined}
      onClick={() => open ? close() : show()} onKeyDown={event => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); }
        else if (event.key === 'Tab') close(false);
        else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          if (!open) {
            const selected = options.findIndex(option => option.id === value);
            show(event.key === 'Home' ? 0 : event.key === 'End' ? Math.max(0, options.length - 1) : selected >= 0 ? selected : event.key === 'ArrowUp' ? Math.max(0, options.length - 1) : 0);
          } else if (options.length) {
            setActive(event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
          }
        } else if (['Enter', ' '].includes(event.key)) {
          event.preventDefault();
          if (!open) show();
          else { if (options[activeIndex]) onChange(options[activeIndex].id); close(); }
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault(); if (!open) show();
          const now = Date.now(), character = event.key.toLocaleLowerCase();
          const prefix = now - typed.current.time < 700 ? typed.current.text + character : character;
          typed.current = { text: prefix, time: now };
          const search = [...prefix].every(c => c === character) ? character : prefix;
          const start = search.length === 1 && open ? activeIndex + 1 : 0;
          for (let offset = 0; offset < options.length; offset++) {
            const index = (start + offset) % options.length;
            if (options[index].label.toLocaleLowerCase().startsWith(search)) { setActive(index); break; }
          }
        }
      }}>
      {children || <><span className="nesmi-choice-value">{options.find(option => option.id === value)?.label || placeholder}</span><svg className="nesmi-choice-chevron" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg></>}
    </button>
    {open && host && createPortal(<div id={listId} ref={list} className="nesmi-choice-options nesmi-choice-menu" data-open-picker role="listbox" aria-label={label} style={position}>
      {options.map((option, index) => <button key={option.id} id={`${listId}-${index}`} type="button" role="option" aria-selected={option.id === value} tabIndex={-1} data-active={activeIndex === index} onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => { onChange(option.id); close(); }}>
        <span>{option.content || option.label}</span><svg className="nesmi-choice-check" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{option.id === value && <path d="m5 12 4 4L19 6"/>}</svg>
      </button>)}
      {!options.length && <p>No options available</p>}
    </div>, host)}
  </>;
}
