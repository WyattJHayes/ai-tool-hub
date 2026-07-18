// Service Worker for AI Tool Hub v6.4.1
const CACHE_NAME = 'ai-tool-hub-v6.4.1';

const PRECACHE_URLS = [
  './',
  './index.html'
];

const MAX_CACHE_ENTRIES = 200;

function isJsonResponse(response) {
  const contentType = response?.headers?.get?.('content-type') || '';
  return response?.status === 200 && contentType.includes('application/json');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => { console.warn('SW precache failed:', err); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (['chrome-extension:', 'file:', 'blob:', 'data:'].includes(url.protocol)) return;
  if (!['http:', 'https:'].includes(url.protocol)) return;
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((net) => {
          if (net && net.status === 200) {
            const cloned = net.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, cloned));
          }
          return net;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (event.request.url.includes('tools.json')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then(async (matched) => {
          let cached = matched;
          if (cached && !isJsonResponse(cached)) {
            await cache.delete(event.request);
            cached = null;
          }

          const fetchPromise = fetch(event.request).then((net) => {
            if (isJsonResponse(net)) {
              const cloned = net.clone();
              cache.put(event.request, cloned);
            }
            return net;
          }).catch(() => cached);

          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((net) => {
        if (net && net.status === 200 && net.type === 'basic') {
          const cloned = net.clone();
          caches.open(CACHE_NAME).then(c => {
            c.put(event.request, cloned);
            trimCache(c);
          });
        }
        return net;
      });
    })
  );
});

function trimCache(cache) {
  cache.keys().then(keys => {
    if (keys.length > MAX_CACHE_ENTRIES) {
      // Delete the oldest entry by evicting excess entries starting from the front.
      // keys() returns requests in insertion order in most browsers.
      const excess = keys.length - MAX_CACHE_ENTRIES;
      for (let i = 0; i < excess; i++) {
        cache.delete(keys[i]).catch(() => {});
      }
    }
  });
}
