/* Change VERSION whenever the cached application files change. */
const VERSION = '2026-10-20-pwa-1';
const ROOT = new URL('./', self.registration.scope);
const PREFIX = `nexus-arena-${encodeURIComponent(ROOT.pathname)}-`;
const CACHE_NAME = PREFIX + VERSION;
const APP_FILES = [
  './', 'index.html', 'style.css', 'app.js', 'pwa.css', 'pwa.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png',
  'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'
].map(path => new URL(path, ROOT).href);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_FILES.map(url => new Request(url, {cache: 'reload'})));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  // Only the static app shell is cached. User uploads and other responses are not stored here.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const shell = await cache.match(new URL('index.html', ROOT).href);
      return shell || fetch(request);
    })());
    return;
  }
  const known = APP_FILES.some(path => new URL(path).pathname === url.pathname);
  if (!known) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(request, {ignoreSearch: true})) || fetch(request);
  })());
});
