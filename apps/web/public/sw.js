const CACHE = 'urbanmag-offline-v3';
const OFFLINE = '/offline.html';
const FONTS = ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext', 'currency'].map(subset => `/fonts/inter-${subset}-wght-normal.woff2`);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([OFFLINE, ...FONTS])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('urbanmag-offline-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method === 'GET' && url.origin === self.location.origin && FONTS.includes(url.pathname) && !url.search) {
    event.respondWith(caches.match(request).then(response => response || fetch(request)));
    return;
  }
  // Next emits content-hashed font files. Cache only font requests at this static path.
  if (request.method === 'GET' && url.origin === self.location.origin && !url.search && request.destination === 'font' && /^\/_next\/static\/media\/[a-zA-Z0-9._-]+\.woff2$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
        const fonts = (await cache.keys()).filter(key => new URL(key.url).pathname.startsWith('/_next/static/media/'));
        if (fonts.length > 40) await cache.delete(fonts[0]);
      }
      return response;
    })());
    return;
  }
  // Only public, query-free shop navigations get an offline fallback; no response is cached.
  if (request.method !== 'GET' || request.mode !== 'navigate' || url.origin !== self.location.origin || url.search || !/^\/(ru|kk|en)(?:\/(?:c|p)\/[^/]+)?\/?$/.test(url.pathname)) return;
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE).then(response => response || Response.error())));
});
