import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// Legacy IDs remain valid for old saved preferences and existing callers.
export type ThemeId = 'light' | 'dark' | 'crystal-light' | 'crystal-dark' | 'aurora' | 'midnight';
export type ThemeSelection = ThemeId | 'system';
type SimpleTheme = 'light' | 'dark';
type SimpleSelection = SimpleTheme | 'system';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  description: string;
  isGlass: boolean;
  isDark: boolean;
}

export const THEMES: ThemeConfig[] = [
  { id: 'light', name: 'Light', description: 'Warm paper and clear type', isGlass: false, isDark: false },
  { id: 'dark', name: 'Dark', description: 'Quiet dark surfaces', isGlass: false, isDark: true },
];

interface ThemeContextType {
  theme: ThemeId;
  themeSelection: ThemeSelection;
  themeConfig: ThemeConfig;
  setTheme: (theme: ThemeSelection) => void;
  themes: ThemeConfig[];
  toggleTheme: () => void;
  isDark: boolean;
  isGlass: boolean;
  isSystemTheme: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function normalizeSelection(selection: string | null): SimpleSelection {
  if (selection === 'light' || selection === 'crystal-light' || selection === 'aurora') return 'light';
  if (selection === 'dark' || selection === 'crystal-dark' || selection === 'midnight') return 'dark';
  return 'system';
}

function getSystemTheme(): SimpleTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeSelection, setThemeSelection] = useState<SimpleSelection>(() => normalizeSelection(localStorage.getItem('theme')));
  const [systemTheme, setSystemTheme] = useState<SimpleTheme>(getSystemTheme);
  const appliedTheme = themeSelection === 'system' ? systemTheme : themeSelection;
  const themeConfig = THEMES.find(theme => theme.id === appliedTheme)!;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setSystemTheme(getSystemTheme());
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    // Migrate old visual themes while retaining their light/dark preference.
    localStorage.setItem('theme', themeSelection);
    document.documentElement.classList.remove('dark', 'glass-theme');
    document.documentElement.setAttribute('data-theme', appliedTheme);
    document.documentElement.style.colorScheme = appliedTheme;
    if (appliedTheme === 'dark') document.documentElement.classList.add('dark');
  }, [appliedTheme, themeSelection]);

  return <ThemeContext.Provider value={{
    theme: appliedTheme,
    themeSelection,
    themeConfig,
    setTheme: selection => setThemeSelection(normalizeSelection(selection)),
    themes: THEMES,
    toggleTheme: () => setThemeSelection(appliedTheme === 'dark' ? 'light' : 'dark'),
    isDark: appliedTheme === 'dark',
    isGlass: false,
    isSystemTheme: themeSelection === 'system',
  }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
