self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('aavd-cache').then((cache) => {
      const assets = [
        '/',
        '/index.html',
        '/manifest.webmanifest',
        '/logo.jpeg',
        '/style.css',
        '/javascript.js'
      ];
      return cache.addAll(assets.map(a => new Request(a, { cache: 'reload' }))).catch(() => {
        // Ignore failures for optional assets
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Only handle same-origin requests; let cross-origin go to network directly
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request);
      })
    );
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== 'aavd-cache') {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
