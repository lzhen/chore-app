/** Local wall-clock values; never convert through UTC. */
export function formatTime(value?: string | null, locale?: string): string {
  if (!value) return '';
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value);
  if (!match) return value;
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' })
    .format(new Date(2026, 0, 1, Number(match[1]), Number(match[2])));
}
export function parseTime(text: string, locale?: string): string | null {
  if (!text.trim()) return '';
  let normalized = text.toLocaleLowerCase(locale).replace(/[\s\u200e\u200f\u061c.]/g, '');
  const numbers = new Intl.NumberFormat(locale, {useGrouping:false});
  for (let digit = 0; digit <= 9; digit++) normalized = normalized.split(numbers.format(digit)).join(String(digit));
  const formatter = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12: true });
  let period: number | undefined;
  for (const hour of [1, 13]) {
    const token = formatter.formatToParts(new Date(2026, 0, 1, hour)).find(part => part.type === 'dayPeriod')?.value
      .toLocaleLowerCase(locale).replace(/[\s.]/g, '');
    for (const marker of [token, hour === 1 ? 'am' : 'pm']) {
      if (marker && normalized.includes(marker)) { period = hour === 1 ? 0 : 12; normalized = normalized.replace(marker, ''); break; }
    }
  }
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(normalized);
  if (!match) return null;
  let hour = Number(match[1]);
  if (period !== undefined) { if (hour < 1 || hour > 12) return null; hour = hour % 12 + period; }
  if (hour > 23) return null;
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}
