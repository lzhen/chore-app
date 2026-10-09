const CACHE = 'nesmi-brand-20261009';
const APP_URL = self.registration.scope;
const MANIFEST_URL = new URL('manifest.webmanifest', APP_URL).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([APP_URL, MANIFEST_URL])));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key !== CACHE && /^(?:nesmi-|nestme-|chorely-design-)/.test(key))
      .map(key => caches.delete(key))
  )));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Keep other Empathie products outside this worker's cache.
  if (!url.href.startsWith(APP_URL)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    if (event.request.mode === 'navigate') return (await caches.match(APP_URL)) || Response.error();
    return Response.error();
  }));
});


