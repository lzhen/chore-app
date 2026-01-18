import { useState, useRef, useEffect } from 'react';
import { useTheme, ThemeId } from '../context/ThemeContext';

const themeSwatches: Record<ThemeId, { bg: string; accent: string }> = {
  light: { bg: 'bg-white', accent: 'bg-gray-200' },
  dark: { bg: 'bg-gray-800', accent: 'bg-gray-600' },
  'crystal-light': { bg: 'bg-gradient-to-br from-purple-400 to-pink-300', accent: 'bg-white/50' },
  'crystal-dark': { bg: 'bg-gradient-to-br from-slate-900 to-blue-900', accent: 'bg-blue-500/30' },
  aurora: { bg: 'bg-gradient-to-br from-green-300 via-blue-400 to-purple-400', accent: 'bg-white/50' },
  midnight: { bg: 'bg-gradient-to-br from-indigo-950 to-purple-900', accent: 'bg-purple-500/30' },
};

const themeIcons: Record<ThemeId, JSX.Element> = {
  light: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  dark: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  ),
  'crystal-light': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  'crystal-dark': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  aurora: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  ),
  midnight: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
};

interface ThemeSelectorProps {
  compact?: boolean;
}

export function ThemeSelector({ compact = false }: ThemeSelectorProps) {
  const { theme, setTheme, themes, themeConfig } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${isOpen ? 'z-[100]' : ''}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center rounded-lg glass-effect hover:opacity-80 transition-all duration-300 ${
          compact ? 'p-1.5 sm:p-2 gap-1' : 'px-2 sm:px-3 py-1.5 sm:py-2 gap-1 sm:gap-2'
        }`}
        title={`Theme: ${themeConfig.name}`}
      >
        <div className={`rounded-md ${themeSwatches[theme].bg} flex items-center justify-center shadow-sm transition-all duration-300 ${
          compact ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-5 h-5 sm:w-6 sm:h-6'
        }`}>
          <div className={`rounded-sm ${themeSwatches[theme].accent} transition-all duration-300 ${
            compact ? 'w-2 h-2 sm:w-3 sm:h-3' : 'w-2.5 h-2.5 sm:w-3 sm:h-3'
          }`}></div>
        </div>
        <svg
          className={`text-content-secondary transition-all duration-300 ${isOpen ? 'rotate-180' : ''} ${
            compact ? 'w-3 h-3 hidden sm:block' : 'w-3 h-3 sm:w-4 sm:h-4'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Mobile overlay */}
          <div className="fixed inset-0 bg-black/20 sm:hidden z-[99]" onClick={() => setIsOpen(false)} />
          <div className="fixed inset-x-2 bottom-2 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-72 glass-card p-4 animate-slide-up z-[100]">
            <h3 className="text-sm font-medium text-content-primary mb-3">Choose Theme</h3>
            <div className="grid grid-cols-2 gap-2">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id);
                  setIsOpen(false);
                }}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  theme === t.id
                    ? 'bg-accent/20 ring-2 ring-accent'
                    : 'hover:bg-surface-tertiary'
                }`}
              >
                {/* Theme Swatch */}
                <div
                  className={`w-10 h-10 rounded-lg ${themeSwatches[t.id].bg} flex items-center justify-center shadow-md flex-shrink-0`}
                >
                  <div className={`w-5 h-5 rounded ${themeSwatches[t.id].accent}`}></div>
                </div>
                {/* Theme Info */}
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-content-secondary">{themeIcons[t.id]}</span>
                    <span className="text-sm font-medium text-content-primary truncate">{t.name}</span>
                  </div>
                  <p className="text-xs text-content-secondary truncate">{t.description}</p>
                </div>
                {/* Check Mark */}
                {theme === t.id && (
                  <svg className="w-5 h-5 text-accent flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
