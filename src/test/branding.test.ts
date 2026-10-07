import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Nesmi public identity', () => {
  it('uses Nesmi for page and install names while preserving existing app routes', () => {
    const html = read('index.html');
    const manifest = JSON.parse(read('public/manifest.webmanifest'));
    expect(html).toContain('<title>Nesmi');
    expect(html).toContain('name="apple-mobile-web-app-title" content="Nesmi"');
    expect(manifest.name).toBe('Nesmi - Family Chore Manager');
    expect(manifest.short_name).toBe('Nesmi');
    expect(manifest.start_url).toBe('/chore-app/');
    expect(manifest.scope).toBe('/chore-app/');
    expect(manifest.icons[0].src).toBe('icons/chorely-light-192.png');
  });

  it('keeps user-visible copy and privacy labels consistent', () => {
    for (const path of ['src/components/App.tsx', 'src/components/Header.tsx', 'src/components/Logo.tsx', 'src/components/AccountSettings.tsx', 'src/components/AuthForm.tsx', 'src/utils/googleCalendar.ts', 'public/privacy.html', 'chrome-extension/manifest.json', 'chrome-extension/popup.html']) {
      expect(read(path), path).toMatch(/Nesmi|NESMI/);
      expect(read(path), path).not.toMatch(/Chorely|CHORELY|Pawssible/);
    }
  });
});
