import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';

describe('approved Nesmi web artwork', () => {
  it('uses the approved silhouette as a theme-aware mask without a background tile', () => {
    const { container } = render(<Logo />);
    const mark = container.querySelector<HTMLElement>('.nesmi-logo-mark');
    expect(mark).not.toBeNull();
    expect(mark?.style.maskImage).toContain('icons/nesmi-1024-20261008.png');
    expect(mark?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('img')).toBeNull();
  });

  it('preserves the existing text and large-size subtitle', () => {
    const { getByText } = render(<Logo size="lg" />);
    expect(getByText('Nesmi')).toBeInTheDocument();
    expect(getByText('Family Chore Manager')).toBeInTheDocument();
  });

  it('labels the icon when it is displayed without text', () => {
    const { container, queryByText } = render(<Logo size="sm" showText={false} />);
    expect(queryByText('Nesmi')).toBeNull();
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Nesmi');
  });
});
