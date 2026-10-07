import { useState, type Ref } from 'react';
import { Logo } from './Logo';
import { ViewMode } from '../types';

interface HeaderProps {
  onMenuClick: () => void;
  onDashboardClick: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchInputRef?: Ref<HTMLInputElement>;
  searchOpen?: boolean;
  onSearchOpenChange?: (open: boolean) => void;
}

const tabs: { id: ViewMode; name: string; path: string }[] = [
  { id: 'today', name: 'Today', path: 'M4 5h16v16H4z M8 2v6 M16 2v6 M4 10h16 M8 15l3 3 5-6' },
  { id: 'calendar', name: 'Calendar', path: 'M4 5h16v16H4z M8 2v6 M16 2v6 M4 10h16' },
  { id: 'list', name: 'Chores', path: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01' },
  { id: 'dashboard', name: 'Insights', path: 'M4 20V9 M9 20V4 M14 20v-7 M19 20V7' },
  { id: 'account', name: 'Account', path: 'M20 21a8 8 0 0 0-16 0 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0' },
];

export function Header({ onMenuClick, viewMode, onViewModeChange, searchQuery, onSearchChange, searchInputRef, searchOpen, onSearchOpenChange }: HeaderProps) {
  const [localSearchOpen, setLocalSearchOpen] = useState(false);
  const isSearchOpen = searchOpen ?? localSearchOpen;
  const tasks = ['today', 'calendar', 'list'].includes(viewMode);

  function setSearchOpen(open: boolean) {
    setLocalSearchOpen(open);
    onSearchOpenChange?.(open);
    if (!open) onSearchChange('');
  }

  return <>
    <div className="chore-shell-header">
      <header className="chore-header">
        <button className="chore-brand" type="button" aria-label="Chorely home" onClick={() => onViewModeChange('today')}>
          <span aria-hidden="true"><Logo size="sm" showText={false} /></span>
          <span className="chore-wordmark">Chorely</span>
        </button>
        <div className="chore-header-actions">
          <button className="touch-button chore-family-button" type="button" aria-label="Open family menu" onClick={onMenuClick}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 21v-3a5 5 0 0 1 10 0v3M17 21v-3a7 7 0 0 0-2-5M13 3a4 4 0 0 1 0 8" /><circle cx="8" cy="7" r="3" /></svg>
            <span className="chore-family-label">Our home</span>
          </button>
          {tasks && <button className="touch-button" type="button" aria-label={isSearchOpen ? 'Close search' : 'Search chores'} aria-expanded={isSearchOpen} aria-controls="chore-search" onClick={() => setSearchOpen(!isSearchOpen)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="m15 15 6 6" /></svg>
          </button>}
        </div>
      </header>
      <nav className="chore-tabs" aria-label="Primary navigation">
        {tabs.map(tab => <button key={tab.id} type="button" className={viewMode === tab.id ? 'active' : ''} aria-current={viewMode === tab.id ? 'page' : undefined} onClick={() => onViewModeChange(tab.id)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d={tab.path} /></svg>
          <span>{tab.name}</span>
        </button>)}
      </nav>
    </div>
    {tasks && isSearchOpen && <div className="chore-search" id="chore-search">
      <label className="sr-only" htmlFor="chore-search-input">Search chores</label>
      <input id="chore-search-input" autoFocus type="search" className="chore-input" placeholder="Search tasks, people or notes" value={searchQuery} onChange={event => onSearchChange(event.target.value)} ref={searchInputRef} onKeyDown={event => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          setSearchOpen(false);
        }
      }} />
    </div>}
  </>;
}
