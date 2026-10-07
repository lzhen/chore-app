import { useEffect, useRef, useState } from 'react';
import { useTheme, type ThemeSelection } from '../context/ThemeContext';

const options: { id: ThemeSelection; name: string; description: string; icon: string }[] = [
  { id: 'system', name: 'System', description: 'Follow your device', icon: '◐' },
  { id: 'light', name: 'Light', description: 'A brighter space', icon: '☼' },
  { id: 'dark', name: 'Dark', description: 'A quieter space', icon: '☾' },
];

export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const { themeSelection, setTheme, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Older saved appearance choices keep their light/dark preference.
  const selected = themeSelection === 'system' ? 'system' : isDark ? 'dark' : 'light';
  const current = options.find(option => option.id === selected)!;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return <div className="nesmi-theme" ref={ref} onKeyDown={event => {
    if (event.key === 'Escape') {
      setOpen(false);
      ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }
  }}>
    <button className="nesmi-theme-trigger" aria-label={`Theme: ${current.name}`} title={`Theme: ${current.name}`} aria-expanded={open} onClick={() => setOpen(!open)}>
      <span aria-hidden="true">{current.icon}</span>{!compact && <small>Appearance</small>}
    </button>
    {open && <div className="nesmi-theme-options" role="group" aria-label="Choose appearance">
      {options.map(option => <button key={option.id} aria-pressed={selected === option.id} onClick={() => { setTheme(option.id); setOpen(false); }}>
        <span aria-hidden="true">{option.icon}</span><span><strong>{option.name}</strong><small>{option.description}</small></span><b aria-hidden="true">{selected === option.id ? '✓' : ''}</b>
      </button>)}
    </div>}
  </div>;
}
