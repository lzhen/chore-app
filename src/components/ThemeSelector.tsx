import { useTheme, type ThemeSelection } from '../context/ThemeContext';
import { ChoicePicker } from './ChoicePicker';
const options = [
  { id: 'system', label: 'System', description: 'Follow your device', icon: '◐' },
  { id: 'light', label: 'Light', description: 'A brighter space', icon: '☼' },
  { id: 'dark', label: 'Dark', description: 'A quieter space', icon: '☾' },
];
export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const { themeSelection, setTheme, isDark } = useTheme();
  const selected = themeSelection === 'system' ? 'system' : isDark ? 'dark' : 'light';
  const current = options.find(option => option.id === selected)!;
  return <div className="nesmi-theme"><ChoicePicker value={selected} onChange={value => setTheme(value as ThemeSelection)} label={`Theme: ${current.label}`} className="nesmi-theme-trigger" align={compact ? 'end' : 'start'} options={options.map(option => ({ ...option, content: <span className="nesmi-theme-choice"><span aria-hidden="true">{option.icon}</span><span><strong>{option.label}</strong><small>{option.description}</small></span></span> }))}>
    <span aria-hidden="true">{current.icon}</span>{!compact && <small>Appearance</small>}
  </ChoicePicker></div>;
}
