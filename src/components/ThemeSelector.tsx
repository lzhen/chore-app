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
          <div className="fixed inset-x-2 bottom-2 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-80 glass-card p-4 animate-slide-up z-[100]">
            <h3 className="text-sm font-medium text-content-primary mb-3">Choose Theme</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id);
                  setIsOpen(false);
                }}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-all ${
                  theme === t.id
                    ? 'bg-accent/20 ring-2 ring-accent'
                    : 'hover:bg-surface-tertiary'
                }`}
              >
                {/* Theme Swatch */}
                <div className="relative">
                  <div
                    className={`w-12 h-12 rounded-xl ${themeSwatches[t.id].bg} flex items-center justify-center shadow-md`}
                  >
                    <div className={`w-6 h-6 rounded-lg ${themeSwatches[t.id].accent}`}></div>
                  </div>
                  {/* Check Mark */}
                  {theme === t.id && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
                {/* Theme Name */}
                <span className="text-xs font-medium text-content-primary text-center leading-tight">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
