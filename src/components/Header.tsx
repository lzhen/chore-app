import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeSelector } from './ThemeSelector';
import { Logo } from './Logo';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
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
      className={`glass-effect border-b border-glass-border px-3 sm:px-6 flex items-center justify-between relative z-[100] transition-all duration-300 ${
        isCollapsed ? 'py-2' : 'py-2 sm:py-3'
      }`}
    >
      {/* Left side - Menu button and logo */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 sm:p-2 -ml-1 text-content-secondary hover:text-content-primary hover:bg-surface-tertiary rounded-md transition-colors flex-shrink-0"
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
          <p className="hidden lg:block text-xs text-content-secondary ml-2">
            Keep track of office chores and assignments
          </p>
        )}
      </div>

      {/* Right side - Theme, user, sign out */}
      <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
        <ThemeSelector compact={isCollapsed} />
        <span className={`text-content-secondary truncate max-w-[100px] md:max-w-[150px] transition-all duration-300 ${
          isCollapsed ? 'hidden' : 'hidden md:inline text-xs md:text-sm'
        }`}>
          {user?.email}
        </span>
        <button
          onClick={signOut}
          className={`text-content-secondary hover:text-content-primary border border-border rounded-md hover:bg-surface-tertiary transition-all duration-300 ${
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
