import { useId } from 'react';

export function EstimateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  const invalid = value !== '' && (!Number.isInteger(Number(value)) || Number(value) < 1);
  return <div className="chore-label">
    <label htmlFor={id}>Estimated minutes · optional</label>
    <div className="nesmi-estimate-field">
      <input id={id} className="chore-input" type="number" step="any" inputMode="numeric"
        value={value} placeholder="Minutes" aria-invalid={invalid || undefined} aria-describedby={`${id}-hint`}
        onChange={event => onChange(event.target.value)}/>
      <button type="button" className="chore-button secondary" aria-label="Decrease estimated minutes"
        disabled={invalid || value === '' || Number(value) <= 1} onClick={() => onChange(String(Number(value) - 1))}>−</button>
      <button type="button" className="chore-button secondary" aria-label="Increase estimated minutes"
        disabled={invalid} onClick={() => onChange(String(Number(value) + 1))}>+</button>
    </div>
    <small id={`${id}-hint`} className="chore-muted">{invalid ? 'Enter a whole number of at least 1, or leave this blank.' : 'Leave blank if you are not sure.'}</small>
  </div>;
}
