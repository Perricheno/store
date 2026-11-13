const CACHE = 'urbanmag-offline-v2';
const OFFLINE = '/offline.html';
const FONTS = ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'].map(subset => `/fonts/inter-${subset}-wght-normal.woff2`);
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
  // Only public, query-free shop navigations get an offline fallback; no response is cached.
  if (request.method !== 'GET' || request.mode !== 'navigate' || url.origin !== self.location.origin || url.search || !/^\/(ru|kk|en)(?:\/(?:c|p)\/[^/]+)?\/?$/.test(url.pathname)) return;
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE).then(response => response || Response.error())));
});
