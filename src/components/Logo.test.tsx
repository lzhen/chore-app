import { readFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';

const artworkUrl = `${import.meta.env.BASE_URL}icons/nesmi-1024-20261008.png`;
const logoCss = readFileSync('src/components/Logo.css', 'utf8');

describe('approved Nesmi web artwork', () => {
  it('renders the same wreath geometry through a transparent light-mode glyph', () => {
    const { container } = render(<Logo />);
    const glyph = container.querySelector('.nesmi-header-glyph');
    expect(glyph?.querySelector('image')?.getAttribute('href')).toBe(artworkUrl);
    expect(glyph?.querySelector('feColorMatrix')?.getAttribute('type')).toBe('luminanceToAlpha');
    expect(glyph?.querySelector('mask')?.getAttribute('style')).toContain('mask-type: alpha');
    expect(glyph?.querySelector('rect')?.getAttribute('fill')).toBe('currentColor');
    expect(glyph?.getAttribute('aria-hidden')).toBe('true');
    // Remove the source's near-black RGB background as well as pure black.
    const alpha = glyph?.querySelector('feFuncA');
    const slope = Number(alpha?.getAttribute('slope'));
    const intercept = Number(alpha?.getAttribute('intercept'));
    expect((6 / 255) * slope + intercept).toBeCloseTo(0);
    expect(slope + intercept).toBeCloseTo(1);
    expect(logoCss).toMatch(/\.nesmi-logo \.nesmi-header-icon\s*\{\s*background: transparent;\s*color: #141414;/);
    expect(logoCss).toMatch(/\.nesmi-logo \.nesmi-header-dark-artwork\s*\{\s*display: none;/);
  });

  it('preserves the approved original PNG and tile in all dark themes', () => {
    const { container } = render(<Logo />);
    const icon = container.querySelector<HTMLImageElement>('.nesmi-header-dark-artwork');
    expect(icon?.getAttribute('src')).toBe(artworkUrl);
    expect(icon?.getAttribute('alt')).toBe('');
    const darkSelector = ':is(.dark, [data-theme="dark"], [data-theme="crystal-dark"], [data-theme="midnight"])';
    expect(logoCss).toContain(`${darkSelector} .nesmi-logo .nesmi-header-icon {\n  background: #000;`);
    expect(logoCss).toContain(`${darkSelector} .nesmi-logo .nesmi-header-glyph {\n  display: none;`);
    expect(logoCss).toContain(`${darkSelector} .nesmi-logo .nesmi-header-dark-artwork {\n  display: block;`);
  });

  it('gives repeated logos independent mask and filter IDs', () => {
    const { container } = render(<><Logo /><Logo size="lg" /><Logo showText={false} /></>);
    const definitions = [...container.querySelectorAll('mask, filter')];
    expect(new Set(definitions.map((node) => node.id)).size).toBe(6);
    for (const glyph of container.querySelectorAll('svg')) {
      expect(glyph.querySelector('rect')?.getAttribute('mask')).toBe(`url(#${glyph.querySelector('mask')?.id})`);
      expect(glyph.querySelector('image')?.getAttribute('filter')).toBe(`url(#${glyph.querySelector('filter')?.id})`);
    }
  });

  it('preserves the existing text and large-size subtitle', () => {
    const { getByText, container } = render(<Logo size="lg" />);
    expect(getByText('Nesmi')).toBeInTheDocument();
    expect(getByText('Family Chore Manager')).toBeInTheDocument();
    expect(container.querySelector('.nesmi-transparent-logo-mark image')?.getAttribute('href')).toBe(artworkUrl);
    expect(logoCss).toMatch(/\.nesmi-transparent-logo-mark\s*\{\s*display: block;\s*color: var\(--text-primary\);/);
  });

  it('labels the icon when it is displayed without text', () => {
    const { container, queryByText } = render(<Logo size="sm" showText={false} />);
    expect(queryByText('Nesmi')).toBeNull();
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Nesmi');
  });
});
