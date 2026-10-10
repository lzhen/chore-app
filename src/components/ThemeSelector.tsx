import { useTheme } from '../context/ThemeContext';
export function ThemeSelector() {
  const { setTheme, isDark } = useTheme();
  const action = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  return <div className="nesmi-theme"><button type="button" className="nesmi-theme-trigger touch-button" aria-label={action} title={action} onClick={()=>setTheme(isDark?'light':'dark')}>
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{isDark?<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>:<path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z"/>}</svg>
  </button></div>;
}
