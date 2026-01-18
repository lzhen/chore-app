import { useAuth } from '../context/AuthContext';
import { ThemeSelector } from './ThemeSelector';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user, signOut } = useAuth();

  return (
    <header className="glass-effect border-b border-glass-border px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between relative z-[100]">
      {/* Left side - Menu button and title */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-content-secondary hover:text-content-primary hover:bg-surface-tertiary rounded-md transition-colors"
          aria-label="Toggle sidebar"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-content-primary">Office Chore Manager</h1>
          <p className="text-xs sm:text-sm text-content-secondary mt-0.5 sm:mt-1 hidden sm:block">Keep track of office chores and assignments</p>
        </div>
      </div>

      {/* Right side - Theme, user, sign out */}
      <div className="flex items-center gap-2 sm:gap-4">
        <ThemeSelector />
        <span className="text-xs sm:text-sm text-content-secondary hidden sm:inline truncate max-w-[150px]">{user?.email}</span>
        <button
          onClick={signOut}
          className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-content-secondary hover:text-content-primary border border-border rounded-md hover:bg-surface-tertiary transition-colors"
        >
          <span className="hidden sm:inline">Sign Out</span>
          <svg className="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>
  );
}
