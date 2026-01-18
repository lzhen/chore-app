// Color palette for team members - distinct, accessible colors
export const MEMBER_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#6366F1', // Indigo
];

export function getNextColor(usedColors: string[]): string {
  const available = MEMBER_COLORS.find(c => !usedColors.includes(c));
  return available || MEMBER_COLORS[usedColors.length % MEMBER_COLORS.length];
}
