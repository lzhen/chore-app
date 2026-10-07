import { useId } from 'react';
import { useTheme } from '../context/ThemeContext';

interface ThemeSelectorProps {
  compact?: boolean;
}

const choices = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
] as const;

export function ThemeSelector({ compact = false }: ThemeSelectorProps) {
  const { themeSelection, setTheme } = useTheme();
  const name = useId();

  return <fieldset className={`chore-theme-control${compact ? ' is-compact' : ''}`}>
    <legend className="sr-only">Appearance</legend>
    {choices.map(choice => <label key={choice.id} className={`chore-theme-option${themeSelection === choice.id ? ' is-selected' : ''}`}>
      <input className="sr-only" type="radio" name={name} value={choice.id} checked={themeSelection === choice.id} onChange={() => setTheme(choice.id)} />
      <span>{choice.label}</span>
    </label>)}
  </fieldset>;
}
