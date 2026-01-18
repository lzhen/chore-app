import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeSelector } from './ThemeSelector';

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
        isCollapsed ? 'py-2' : 'py-2 sm:py-4'
      }`}
    >
      {/* Left side - Menu button and title */}
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

        {/* Logo/Icon for very small screens */}
        <div className="flex items-center gap-2 min-w-0">
          {/* App icon - visible on xs, hidden on sm+ when not collapsed */}
          <div className={`flex-shrink-0 w-8 h-8 bg-accent rounded-lg flex items-center justify-center ${isCollapsed ? 'sm:flex' : 'sm:hidden'}`}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>

          {/* Title - hidden on xs, shown on sm+ */}
          <div className={`min-w-0 ${isCollapsed ? 'hidden sm:block' : ''}`}>
            <h1 className={`font-bold text-content-primary truncate transition-all duration-300 ${
              isCollapsed
                ? 'text-sm sm:text-base'
                : 'hidden xs:block text-base sm:text-lg md:text-2xl'
            }`}>
              {isCollapsed ? 'Chores' : 'Office Chore Manager'}
            </h1>
            <p className={`text-content-secondary truncate transition-all duration-300 ${
              isCollapsed ? 'hidden' : 'hidden md:block text-xs md:text-sm mt-0.5'
            }`}>
              Keep track of office chores and assignments
            </p>
          </div>
        </div>
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
