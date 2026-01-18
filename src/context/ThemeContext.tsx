import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type ThemeId = 'light' | 'dark' | 'crystal-light' | 'crystal-dark' | 'aurora' | 'midnight';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  description: string;
  isGlass: boolean;
  isDark: boolean;
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'light',
    name: 'Light',
    description: 'Clean light theme',
    isGlass: false,
    isDark: false,
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Classic dark theme',
    isGlass: false,
    isDark: true,
  },
  {
    id: 'crystal-light',
    name: 'Crystal Light',
    description: 'Frosted glass with soft blur',
    isGlass: true,
    isDark: false,
  },
  {
    id: 'crystal-dark',
    name: 'Crystal Dark',
    description: 'Dark glass with glow effects',
    isGlass: true,
    isDark: true,
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Colorful gradient glass',
    isGlass: true,
    isDark: false,
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Deep purple with starry accents',
    isGlass: true,
    isDark: true,
  },
];

interface ThemeContextType {
  theme: ThemeId;
  themeConfig: ThemeConfig;
  setTheme: (theme: ThemeId) => void;
  themes: ThemeConfig[];
  toggleTheme: () => void;
  isDark: boolean;
  isGlass: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const saved = localStorage.getItem('theme') as ThemeId | null;
    if (saved && THEMES.find((t) => t.id === saved)) {
      return saved;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const themeConfig = THEMES.find((t) => t.id === theme)!;

  useEffect(() => {
    localStorage.setItem('theme', theme);

    // Remove all theme-related classes
    document.documentElement.classList.remove('dark', 'glass-theme');

    // Set data-theme attribute
    document.documentElement.setAttribute('data-theme', theme);

    // Add 'dark' class for Tailwind dark: prefix compatibility
    if (themeConfig.isDark) {
      document.documentElement.classList.add('dark');
    }

    // Add glass class for conditional styling
    if (themeConfig.isGlass) {
      document.documentElement.classList.add('glass-theme');
    }
  }, [theme, themeConfig]);

  const setTheme = (newTheme: ThemeId) => {
    setThemeState(newTheme);
  };

  // Backward compatibility: toggle between light and dark
  const toggleTheme = () => {
    setThemeState((prev) => {
      const currentConfig = THEMES.find((t) => t.id === prev)!;
      return currentConfig.isDark ? 'light' : 'dark';
    });
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeConfig,
        setTheme,
        themes: THEMES,
        toggleTheme,
        isDark: themeConfig.isDark,
        isGlass: themeConfig.isGlass,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
