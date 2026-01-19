import { useState, useEffect, type Ref } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeSelector } from './ThemeSelector';
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
}

export function Header({ onMenuClick, onDashboardClick, viewMode, onViewModeChange, searchQuery, onSearchChange, searchInputRef }: HeaderProps) {
  const { user, signOut } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Collapse header on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsCollapsed(scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fluent-surface border-b border-border px-3 sm:px-6 flex items-center justify-between relative z-[100] transition-all duration-normal ease-fluent-decelerate ${
        isCollapsed ? 'py-2' : 'py-2 sm:py-3'
      }`}
    >
      {/* Left side - Menu button and logo */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 sm:p-2 -ml-1 text-content-secondary hover:text-content-primary hover:bg-subtle-background-hover rounded-fluent-sm transition-all duration-fast flex-shrink-0"
          aria-label="Toggle sidebar"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Logo */}
        <Logo size={isCollapsed ? 'sm' : 'sm'} showText={!isCollapsed} />

        {/* Subtitle - only on larger screens when not collapsed */}
        {!isCollapsed && (
          <p className="hidden xl:block text-xs text-content-secondary ml-2">
            Keep track of office chores and assignments
          </p>
        )}
      </div>

      {/* Center - Search bar */}
      <div className="hidden md:flex flex-1 max-w-md mx-4">
        <div className="relative w-full">
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-content-secondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search chores... (press /)"
            className="w-full pl-10 pr-8 py-1.5 text-sm bg-surface-secondary border border-border rounded-fluent-md text-content-primary placeholder-content-secondary focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-content-secondary hover:text-content-primary"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Right side - View toggle, Dashboard, Theme, user, sign out */}
      <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
        {/* View toggle */}
        <div className="flex rounded-fluent-md border border-border overflow-hidden">
          <button
            onClick={() => onViewModeChange('calendar')}
            className={`p-1.5 sm:p-2 transition-all duration-fast ${
              viewMode === 'calendar'
                ? 'bg-accent text-white'
                : 'bg-surface-secondary text-content-secondary hover:bg-subtle-background-hover'
            }`}
            title="Calendar View"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-1.5 sm:p-2 transition-all duration-fast ${
              viewMode === 'list'
                ? 'bg-accent text-white'
                : 'bg-surface-secondary text-content-secondary hover:bg-subtle-background-hover'
            }`}
            title="List View"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
        </div>
        {/* Dashboard button */}
        <button
          onClick={onDashboardClick}
          className={`fluent-button-subtle text-content-secondary hover:text-content-primary border border-border rounded-fluent-sm hover:bg-subtle-background-hover transition-all duration-fast ${
            isCollapsed
              ? 'p-1.5 sm:p-2'
              : 'px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm'
          }`}
          title="Dashboard"
        >
          <span className={isCollapsed ? 'hidden' : 'hidden sm:inline'}>Dashboard</span>
          <svg className={`${isCollapsed ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-5 h-5 sm:hidden'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </button>
        <ThemeSelector compact={isCollapsed} />
        <span className={`text-content-secondary truncate max-w-[100px] md:max-w-[150px] transition-all duration-normal ${
          isCollapsed ? 'hidden' : 'hidden md:inline text-xs md:text-sm'
        }`}>
          {user?.email}
        </span>
        <button
          onClick={signOut}
          className={`fluent-button-subtle text-content-secondary hover:text-content-primary border border-border rounded-fluent-sm hover:bg-subtle-background-hover transition-all duration-fast ${
            isCollapsed
              ? 'p-1.5 sm:p-2'
              : 'px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm'
          }`}
          title="Sign Out"
        >
          <span className={isCollapsed ? 'hidden' : 'hidden sm:inline'}>Sign Out</span>
          <svg className={`${isCollapsed ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-5 h-5 sm:hidden'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>
  );
}
