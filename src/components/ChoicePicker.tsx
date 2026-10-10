import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Option = { id: string; label: string; content?: ReactNode };
/** App-owned picker: native iOS select surfaces cannot guarantee theme colors. */
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
  const [position, setPosition] = useState({ left: 12, top: 12, width: 236, maxHeight: 320 });
  const [host, setHost] = useState<HTMLElement | null>(null);
  const close = (focus = true) => { setOpen(false); if (focus) trigger.current?.focus(); };
  const show = () => {
    setActive(Math.max(0, options.findIndex(option => option.id === value)));
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
      const gutter = 12 + Math.max(inset('left'), inset('right'));
      const topGutter = 12 + inset('top'), bottomGutter = 12 + inset('bottom');
      const menuWidth = Math.min(Math.max(236, anchor.width), width - gutter * 2);
      const below = y + height - bottomGutter - anchor.bottom - 8;
      const above = anchor.top - y - topGutter - 8;
      const border = (parseFloat(safe.borderTopWidth) || 0) + (parseFloat(safe.borderBottomWidth) || 0);
      const desired = (list.current?.scrollHeight || 208) + border;
      const flip = below < Math.min(desired, 240) && above > below;
      const maxHeight = Math.max(0, Math.min(height - topGutter - bottomGutter, flip ? above : below));
      const actualHeight = Math.min(desired, maxHeight);
      setPosition({ left: Math.max(x + gutter, Math.min(align === 'end' ? anchor.right - menuWidth : anchor.left, x + width - gutter - menuWidth)), top: Math.max(y + topGutter, Math.min(y + height - bottomGutter - actualHeight, flip ? anchor.top - actualHeight - 8 : anchor.bottom + 8)), width: menuWidth, maxHeight });
    };
    update();
    const observer = new ResizeObserver(update);
    if (trigger.current) observer.observe(trigger.current);
    if (list.current) observer.observe(list.current);
    window.addEventListener('resize', update); window.addEventListener('scroll', update, { capture: true, passive: true });
    window.visualViewport?.addEventListener('resize', update); window.visualViewport?.addEventListener('scroll', update);
    const outside = (event: PointerEvent) => { if (!trigger.current?.contains(event.target as Node) && !list.current?.contains(event.target as Node)) close(false); };
    document.addEventListener('pointerdown', outside);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); window.visualViewport?.removeEventListener('resize', update); window.visualViewport?.removeEventListener('scroll', update); document.removeEventListener('pointerdown', outside); };
  }, [open, align]);
  useLayoutEffect(() => { if (open) list.current?.children[active]?.scrollIntoView?.({ block: 'nearest' }); }, [active, open]);
  return <>
    <button id={id} ref={trigger} type="button" className={className} role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-activedescendant={open && options.length ? `${listId}-${active}` : undefined}
      onClick={() => open ? close() : show()} onKeyDown={event => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); }
        else if (event.key === 'Tab') close(false);
        else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); if (!open) show();
          else if (options.length) setActive(index => event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
        } else if (open && ['Enter', ' '].includes(event.key)) { event.preventDefault(); if (options[active]) onChange(options[active].id); close(); }
        else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== ' ') {
          event.preventDefault(); if (!open) show();
          const now = Date.now(), character = event.key.toLocaleLowerCase();
          const prefix = now - typed.current.time < 700 ? typed.current.text + character : character;
          typed.current = { text: prefix, time: now };
          const search = [...prefix].every(c => c === character) ? character : prefix;
          const start = search.length === 1 && open ? active + 1 : 0;
          for (let offset = 0; offset < options.length; offset++) {
            const index = (start + offset) % options.length;
            if (options[index].label.toLocaleLowerCase().startsWith(search)) { setActive(index); break; }
          }
        }
      }}>
      {children || <><span>{options.find(option => option.id === value)?.label || placeholder}</span><span aria-hidden="true">⌄</span></>}
    </button>
    {open && host && createPortal(<div id={listId} ref={list} className="nesmi-choice-options" data-open-picker role="listbox" aria-label={label} style={position}>
      {options.map((option, index) => <button key={option.id} id={`${listId}-${index}`} type="button" role="option" aria-selected={option.id === value} tabIndex={-1} data-active={active === index} onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => { onChange(option.id); close(); }}>
        <span>{option.content || option.label}</span><b aria-hidden="true">{option.id === value ? '✓' : ''}</b>
      </button>)}
      {!options.length && <p>No family members yet</p>}
    </div>, host)}
  </>;
}
