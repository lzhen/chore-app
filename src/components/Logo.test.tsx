import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';

describe('approved Nesmi web artwork', () => {
  it('uses the approved black icon for the product header', () => {
    const { container } = render(<Logo />);
    const icon = container.querySelector<HTMLImageElement>('.nesmi-header-icon img');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('src')).toBe(`${import.meta.env.BASE_URL}icons/nesmi-1024-20261008.png`);
    expect(icon?.getAttribute('alt')).toBe('');
    expect(container.querySelector('.nesmi-logo-mark')).toBeNull();
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
