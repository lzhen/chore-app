import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

export type ThemeId = 'light' | 'dark' | 'crystal-light' | 'crystal-dark' | 'aurora' | 'midnight';

// Theme selection includes 'system' which auto-follows system preference
export type ThemeSelection = ThemeId | 'system';

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
  theme: ThemeId;                    // Actual applied theme
  themeSelection: ThemeSelection;    // User selection (including 'system')
  themeConfig: ThemeConfig;
  setTheme: (theme: ThemeSelection) => void;
  themes: ThemeConfig[];
  toggleTheme: () => void;
  isDark: boolean;
  isGlass: boolean;
  isSystemTheme: boolean;            // Whether using system preference
}

const ThemeContext = createContext<ThemeContextType | null>(null);

// Get system preference
function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // User's theme selection (can be 'system' or a specific theme)
  const [themeSelection, setThemeSelection] = useState<ThemeSelection>(() => {
    const saved = localStorage.getItem('theme') as ThemeSelection | null;
    if (saved === 'system') return 'system';
    if (saved && THEMES.find((t) => t.id === saved)) {
      return saved as ThemeId;
    }
    return 'system'; // Default to system
  });

  // Actual applied theme
  const [appliedTheme, setAppliedTheme] = useState<ThemeId>(() => {
    if (themeSelection === 'system') {
      return getSystemTheme();
    }
    return themeSelection;
  });

  // Update applied theme when selection or system preference changes
  const updateAppliedTheme = useCallback(() => {
    if (themeSelection === 'system') {
      setAppliedTheme(getSystemTheme());
    } else {
      setAppliedTheme(themeSelection);
    }
  }, [themeSelection]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (themeSelection === 'system') {
        setAppliedTheme(getSystemTheme());
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [themeSelection]);

  // Update applied theme when selection changes
  useEffect(() => {
    updateAppliedTheme();
  }, [updateAppliedTheme]);

  const themeConfig = THEMES.find((t) => t.id === appliedTheme)!;

  useEffect(() => {
    localStorage.setItem('theme', themeSelection);

    // Remove all theme-related classes
    document.documentElement.classList.remove('dark', 'glass-theme');

    // Set data-theme attribute
    document.documentElement.setAttribute('data-theme', appliedTheme);

    // Add 'dark' class for Tailwind dark: prefix compatibility
    if (themeConfig.isDark) {
      document.documentElement.classList.add('dark');
    }

    // Add glass class for conditional styling
    if (themeConfig.isGlass) {
      document.documentElement.classList.add('glass-theme');
    }
  }, [appliedTheme, themeSelection, themeConfig]);

  const setTheme = (newTheme: ThemeSelection) => {
    setThemeSelection(newTheme);
  };

  // Backward compatibility: toggle between light and dark
  const toggleTheme = () => {
    setThemeSelection((prev) => {
      if (prev === 'system') {
        // If system, toggle to opposite of current applied theme
        return appliedTheme === 'dark' ? 'light' : 'dark';
      }
      const currentConfig = THEMES.find((t) => t.id === prev)!;
      return currentConfig.isDark ? 'light' : 'dark';
    });
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: appliedTheme,
        themeSelection,
        themeConfig,
        setTheme,
        themes: THEMES,
        toggleTheme,
        isDark: themeConfig.isDark,
        isGlass: themeConfig.isGlass,
        isSystemTheme: themeSelection === 'system',
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
