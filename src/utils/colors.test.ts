import { describe, expect, it } from 'vitest';
import { memberAvatarStyle } from './colors';
describe('restrained member avatar palette', () => {
 it('preserves established blue, rose and amber hue identity', () => {
  expect(memberAvatarStyle('#3B82F6').backgroundColor).toBe('var(--avatar-blue-bg)');
  expect(memberAvatarStyle('#EC4899').backgroundColor).toBe('var(--avatar-rose-bg)');
  expect(memberAvatarStyle('#F59E0B').backgroundColor).toBe('var(--avatar-amber-bg)');
 });
 it('supplies matching theme-responsive text and a neutral fallback', () => {
  expect(memberAvatarStyle('#3b82f6').color).toBe('var(--avatar-blue-ink)');
  expect(memberAvatarStyle('invalid').backgroundColor).toBe('var(--avatar-neutral-bg)');
 });
});
