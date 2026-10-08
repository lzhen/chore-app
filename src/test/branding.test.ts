import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('NestMe public identity', () => {
  it('uses NestMe for page and install names at the current route while preserving install identity', () => {
    const html = read('index.html');
    const manifest = JSON.parse(read('public/manifest.webmanifest'));
    expect(html).toContain('<title>NestMe');
    expect(html).toContain('name="apple-mobile-web-app-title" content="NestMe"');
    expect(manifest.name).toBe('NestMe - Family Chore Manager');
    expect(manifest.short_name).toBe('NestMe');
    expect(manifest.id).toBe('/chore-app/');
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.icons[0].src).toBe('icons/chorely-light-192.png');
  });

  it('keeps user-visible copy and privacy labels consistent', () => {
    for (const path of ['src/components/App.tsx', 'src/components/Header.tsx', 'src/components/Logo.tsx', 'src/components/AccountSettings.tsx', 'src/components/AuthForm.tsx', 'src/utils/googleCalendar.ts', 'public/privacy.html', 'chrome-extension/manifest.json', 'chrome-extension/popup.html']) {
      expect(read(path), path).toMatch(/NestMe|NESTME/);
      expect(read(path), path).not.toMatch(/Chorely|CHORELY|Pawssible/);
    }
  });
});
