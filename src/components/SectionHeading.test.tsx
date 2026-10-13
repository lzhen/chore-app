import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SectionHeading } from './SectionHeading';

afterEach(cleanup);
describe('section title and period hierarchy', () => {
  it('reads as one level-three heading with distinct title and period spans', () => {
    render(<SectionHeading title="Team Workload" context="This Week"/>);
    const heading = screen.getByRole('heading', { level: 3, name: 'Team Workload This Week' });
    expect(heading.querySelector('.nesmi-section-heading-title')).toHaveTextContent('Team Workload');
    expect(heading.querySelector('.nesmi-section-heading-context')).toHaveTextContent('This Week');
    expect(heading).not.toHaveTextContent('|');
  });
  it('keeps the decorative divider attached to secondary context and supports narrow wrapping', () => {
    const css = readFileSync('src/components/SectionHeading.css', 'utf8');
    expect(css).toContain('flex-wrap: wrap');
    expect(css).toContain('border-inline-start: 1px solid var(--border-subtle)');
    expect(css).toContain('font-size: var(--nesmi-type-label, .8125rem)');
    expect(css).toContain('color: var(--text-secondary)');
    expect(css).toContain('@media (max-width: 359px)');
    expect(css).toContain('border-inline-start: 0; padding-inline-start: 0');
  });
  it('is reused by the real workload screen and reference without touching metric styling', () => {
    for (const file of ['src/components/Dashboard.tsx', 'src/reference/DesignSystemReference.tsx']) {
      expect(readFileSync(file, 'utf8')).toContain('<SectionHeading title="Team Workload" context="This Week"/>');
    }
    const dashboard = readFileSync('src/components/Dashboard.tsx', 'utf8');
    expect(dashboard).not.toContain('Team Workload (This Week)');
    expect(dashboard).toContain('<div className="text-2xl font-bold text-content-primary">{stats.completedToday}</div>');
    expect(readFileSync('src/components/SectionHeading.css', 'utf8')).not.toMatch(/nesmi-metrics|WorkloadChart/);
  });
});
