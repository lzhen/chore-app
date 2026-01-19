/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    screens: {
      'xs': '375px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      // Fluent Design System font family
      fontFamily: {
        fluent: ['Segoe UI Variable', 'Segoe UI', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      // Fluent spacing (4px base unit)
      spacing: {
        'fluent-xs': '4px',
        'fluent-s': '8px',
        'fluent-m': '12px',
        'fluent-l': '16px',
        'fluent-xl': '20px',
        'fluent-xxl': '24px',
      },
      // Fluent border radius
      borderRadius: {
        'fluent-sm': '4px',
        'fluent-md': '8px',
        'fluent-lg': '12px',
        'fluent-xl': '16px',
        'fluent-circle': '9999px',
      },
      colors: {
        // Theme-aware colors using CSS variables
        glass: {
          DEFAULT: 'var(--glass-bg)',
          secondary: 'var(--glass-bg-secondary)',
          border: 'var(--glass-border)',
        },
        surface: {
          primary: 'var(--surface-primary)',
          secondary: 'var(--surface-secondary)',
          tertiary: 'var(--surface-tertiary)',
        },
        content: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          accent: 'var(--text-accent)',
        },
        accent: {
          DEFAULT: 'var(--accent-primary)',
          hover: 'var(--accent-hover)',
          subtle: 'var(--accent-subtle)',
        },
        border: {
          DEFAULT: 'var(--border-default)',
          subtle: 'var(--border-subtle)',
        },
        overlay: 'var(--overlay-bg)',
        // Fluent brand colors
        brand: {
          DEFAULT: 'var(--color-brand-background)',
          hover: 'var(--color-brand-background-hover)',
          pressed: 'var(--color-brand-background-pressed)',
          foreground: 'var(--color-brand-foreground)',
        },
        // Fluent neutral colors
        neutral: {
          background: 'var(--color-neutral-background)',
          foreground: 'var(--color-neutral-foreground)',
          stroke: 'var(--color-neutral-stroke)',
        },
        // Fluent subtle colors
        subtle: {
          background: 'var(--color-subtle-background)',
          'background-hover': 'var(--color-subtle-background-hover)',
          'background-pressed': 'var(--color-subtle-background-pressed)',
        },
      },
      boxShadow: {
        glass: 'var(--glass-shadow)',
        glow: 'var(--glass-glow)',
        // Fluent elevation shadows
        'fluent-2': 'var(--shadow-2)',
        'fluent-4': 'var(--shadow-4)',
        'fluent-8': 'var(--shadow-8)',
        'fluent-16': 'var(--shadow-16)',
        'fluent-28': 'var(--shadow-28)',
        'fluent-64': 'var(--shadow-64)',
      },
      animation: {
        'aurora-shift': 'auroraShift 15s ease infinite',
        'star-twinkle': 'starTwinkle 3s ease-in-out infinite',
        'glow-pulse': 'glowPulse 4s ease-in-out infinite',
        'fade-in': 'fadeIn var(--duration-fast) var(--curve-decelerate)',
        'slide-up': 'slideUp var(--duration-normal) var(--curve-decelerate)',
        'fluent-appear': 'fluentAppear var(--duration-normal) var(--curve-decelerate)',
      },
      keyframes: {
        auroraShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        starTwinkle: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.02)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fluentAppear: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '200ms',
        'slow': '250ms',
        '400': '400ms',
      },
      transitionTimingFunction: {
        'fluent-decelerate': 'cubic-bezier(0.1, 0.9, 0.2, 1)',
        'fluent-accelerate': 'cubic-bezier(0.9, 0.1, 1, 0.2)',
        'fluent-standard': 'cubic-bezier(0.8, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
