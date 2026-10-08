import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';

describe('approved Nesmi web artwork', () => {
  it('uses the exact light and dark wreath assets with theme-aware visibility', () => {
    const { container } = render(<Logo />);
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(2);
    expect(images[0].getAttribute('src')).toBe(`${import.meta.env.BASE_URL}icons/chorely-light.png`);
    expect(images[1].getAttribute('src')).toBe(`${import.meta.env.BASE_URL}icons/chorely-dark.png`);
    expect(images[0].className).toContain('dark:hidden');
    expect(images[1].className).toContain('dark:block');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('preserves the existing text and large-size subtitle', () => {
    const { getByText } = render(<Logo size="lg" />);
    expect(getByText('Nesmi')).toBeInTheDocument();
    expect(getByText('Family Chore Manager')).toBeInTheDocument();
  });

  it('labels the icon when it is displayed without text', () => {
    const { container, queryByText } = render(<Logo size="sm" showText={false} />);
    expect(queryByText('Nesmi')).toBeNull();
    for (const image of container.querySelectorAll('img')) {
      expect(image.getAttribute('alt')).toBe('Nesmi');
    }
  });
});
