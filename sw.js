self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('aavd-cache').then((cache) => {
      return cache.addAll([
        '/VKrDownloader',
        '/VKrDownloader/index.html',
        '/VKrDownloader/manifest.webmanifest',
        '/VKrDownloader/logo.png'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
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
