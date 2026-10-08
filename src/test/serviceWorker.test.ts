import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function worker(scope: string) {
  const handlers: Record<string, (event: any) => void> = {};
  const cache = { addAll: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue(['chorely-design-20261007', 'nestme-20261008', 'movelight-cache', 'care-cache']),
    delete: vi.fn().mockResolvedValue(true),
    match: vi.fn().mockResolvedValue(undefined),
  };
  const fetch = vi.fn().mockRejectedValue(new Error('Offline'));
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    self: { registration: { scope }, addEventListener: (name: string, handler: (event: any) => void) => { handlers[name] = handler; } },
    caches, fetch, URL, Response,
  });
  return { handlers, cache, caches, fetch };
}

describe('PWA route compatibility', () => {
  for (const scope of ['https://empathie.ai/nestme/', 'https://lzhen.github.io/chore-app/']) {
    it(`installs and falls back within ${scope}`, async () => {
      const { handlers, cache, caches } = worker(scope);
      let pending: Promise<unknown>;
      handlers.install({ waitUntil: (promise: Promise<unknown>) => { pending = promise; } });
      await pending!;
      expect(cache.addAll).toHaveBeenCalledWith([scope, `${scope}manifest.webmanifest`]);
      const offlinePage = new Response('NestMe offline');
      caches.match.mockImplementation(async (url: unknown) => url === scope ? offlinePage : undefined);
      handlers.fetch({ request: { method: 'GET', url: `${scope}?view=today`, mode: 'navigate' }, respondWith: (promise: Promise<unknown>) => { pending = promise; } });
      expect(await pending!).toBe(offlinePage);
    });
  }

  it('leaves other product caches and requests alone', async () => {
    const { handlers, caches, fetch } = worker('https://empathie.ai/nestme/');
    let pending: Promise<unknown>;
    handlers.activate({ waitUntil: (promise: Promise<unknown>) => { pending = promise; } });
    await pending!;
    expect(caches.delete.mock.calls).toEqual([['chorely-design-20261007']]);
    const respondWith = vi.fn();
    handlers.fetch({ request: { method: 'GET', url: 'https://empathie.ai/movelight/' }, respondWith });
    expect(fetch).not.toHaveBeenCalled();
    expect(respondWith).not.toHaveBeenCalled();
  });
});
