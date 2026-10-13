import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isDesignSystemReference } from './previewReference';

describe('private design-reference routing', () => {
  it('requires both the exact preview flag and exact reference query', () => {
    expect(isDesignSystemReference(true, '?reference=design-system')).toBe(true);
    expect(isDesignSystemReference(true, '?experience=app&reference=design-system&theme=dark')).toBe(true);
    for (const flag of [undefined, false, 'true', 1]) expect(isDesignSystemReference(flag, '?reference=design-system')).toBe(false);
    for (const query of ['', '?experience=web', '?reference=other', '?reference=Design-System']) expect(isDesignSystemReference(true, query)).toBe(false);
  });
  it('does not statically initialize the product or register a worker for the gallery', () => {
    const main = readFileSync('src/main.tsx', 'utf8');
    expect(main).toContain("lazy(() => import('./reference/DesignSystemReference'))");
    expect(main).toContain("import('./components/SessionApp')");
    expect(main).toContain("import('./context/AuthContext')");
    expect(main).not.toMatch(/^import .* from ['"].*(?:SessionApp|AuthContext)['"]/m);
    expect(main).toContain('persistPreference={!reference}');
    expect(main).toContain("if (!reference && 'serviceWorker' in navigator)");
  });
  it('preserves the existing product CSS order ahead of global refinements', () => {
    const main = readFileSync('src/main.tsx', 'utf8');
    const expected = ['Logo', 'ChoicePicker', 'TeamMemberList', 'Calendar', 'DeleteChoreDialog', 'ChoreModal', 'ChoreTaskRow', 'AuthForm', 'ChatPanel', 'SectionHeading', 'AvailabilityModal'].map(name => `./components/${name}.css`);
    expected.push('./index.css', './nesmi-refinement.css', './styles/nesmi-tokens.css');
    const positions = expected.map(path => main.indexOf(`'${path}'`));
    expect(positions.every(position => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(main).not.toContain("import './reference/DesignSystemReference.css'");
  });
  it('keeps fixtures and gallery source independent of app/auth/backend contexts', () => {
    const source = readFileSync('src/reference/DesignSystemReference.tsx', 'utf8');
    expect(source).not.toMatch(/(?:AppContext|AuthContext|supabase|fetch\(|https?:\/\/)/);
    expect(source).toContain('./design-system-v0.1.md');
    expect(source).toContain('./index.html?experience=web');
    expect(source).toContain('./index.html?experience=app');
  });
});
