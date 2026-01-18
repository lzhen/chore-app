import { useAuth } from '../context/AuthContext';
import { ThemeSelector } from './ThemeSelector';

export function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="glass-effect border-b border-glass-border px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-content-primary">Office Chore Manager</h1>
        <p className="text-sm text-content-secondary mt-1">Keep track of office chores and assignments</p>
      </div>
      <div className="flex items-center gap-4">
        <ThemeSelector />
        <span className="text-sm text-content-secondary">{user?.email}</span>
        <button
          onClick={signOut}
          className="px-3 py-1.5 text-sm text-content-secondary hover:text-content-primary border border-border rounded-md hover:bg-surface-tertiary transition-colors"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
