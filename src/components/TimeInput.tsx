import { useId, useRef, useState } from 'react';
import { formatTime, parseTime } from '../utils/time';

/** App-owned time editor: no platform picker; stored values remain local HH:mm. */
export function TimeInput({ id, label, value, onChange, className = 'chore-input', disabled = false, descriptionId }: {
  id?: string; label: string; value: string; onChange: (value: string) => void; className?: string; disabled?: boolean; descriptionId?: string;
}) {
  const hint = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [invalid, setInvalid] = useState(false);
  const example = formatTime('13:30');
  return <><input ref={input} id={id} aria-label={label} aria-describedby={[descriptionId, invalid ? hint : undefined].filter(Boolean).join(" ") || undefined} aria-invalid={invalid || undefined}
    type="text" inputMode="text" autoComplete="off" spellCheck={false} disabled={disabled}
    className={className} value={draft ?? formatTime(value)} placeholder={example}
    onChange={event => {
      const text = event.target.value; setDraft(text);
      const parsed = parseTime(text);
      const error = parsed === null;
      event.target.setCustomValidity(error ? `Enter a time such as ${example}, or 13:30.` : '');
      setInvalid(error);
      onChange(parsed ?? text);
    }}
    onBlur={() => { if (!input.current?.validationMessage) setDraft(null); }} />
    {invalid && <span id={hint} className="nesmi-time-hint" role="alert">{`Enter a time such as ${example}, or 13:30.`}</span>}</>;
}
