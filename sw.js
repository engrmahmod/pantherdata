/* Panther Data web app — service worker.
   Pages and backend calls are ALWAYS network-first, so prices, wallets and
   new publishes are never served stale. Only icons/manifest are cached.
   If the network is down, the last loaded page is shown from cache. */
const CACHE = 'panther-v1';
const STATIC_ASSETS = ['/icon-192.png', '/icon-512.png', '/icon-180.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Backend calls: network only, never cached (wallets, buys, funding).
  if (url.hostname.includes('onrender.com') || url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  // Icons and manifest: cache-first, they rarely change.
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((hit) => hit || fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return res;
      }))
    );
    return;
  }
  // Pages: network first, fall back to the cached page when offline.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put('/', copy));
        return res;
      }).catch(() => caches.match('/'))
    );
    return;
  }
  // Everything else: network, no caching.
  event.respondWith(fetch(event.request));
});
