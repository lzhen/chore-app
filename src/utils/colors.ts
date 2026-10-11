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

// Presentation only: keep stored member identity/colors and status colors unchanged.
// Derive a restrained hue family from existing colors; ordering never affects identity.
export function memberAvatarStyle(color = '#888888') {
  const hex = color.replace('#', '');
  const normalized = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  let tone = 'neutral';
  if (/^[\da-f]{6}$/i.test(normalized)) {
    const [r, g, b] = [0, 2, 4].map(i => parseInt(normalized.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    if (delta > .05) {
      const hue = ((max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60 + 360) % 360;
      tone = hue < 20 || hue >= 300 ? 'rose' : hue < 70 ? 'amber' : hue < 165 ? 'sage' : hue < 255 ? 'blue' : 'violet';
    }
  }
  return { backgroundColor: `var(--avatar-${tone}-bg)`, color: `var(--avatar-${tone}-ink)` };
}
