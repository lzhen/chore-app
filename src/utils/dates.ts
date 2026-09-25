/** Calendar dates stay in local time; timestamps are reserved for actual instants. */
export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function parseDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}
export function shiftDate(value: string, days: number): string {
  const date = parseDate(value); date.setDate(date.getDate() + days); return dateKey(date);
}
export function formatDay(value: string, today = dateKey()): string {
  if (value === today) return 'Today';
  if (value === shiftDate(today, 1)) return 'Tomorrow';
  return parseDate(value).toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
}
export function shortTime(value?: string | null): string | undefined { return value ? value.slice(0,5) : undefined; }
