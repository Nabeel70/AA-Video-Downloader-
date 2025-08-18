self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open('aavd-cache-v1').then((cache) => {
      console.log('Service Worker: Caching files...');
      return cache.addAll([
        './',
        './index.html',
        './style.css',
        './javascript.js',
        './manifest.webmanifest',
        './logo.jpeg'
      ]).catch(error => {
        console.error('Service Worker: Cache addAll failed:', error);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Skip service worker for localhost and API requests to prevent CORS issues
  const url = new URL(event.request.url);
  if (url.hostname === 'localhost' || 
      url.hostname === '127.0.0.1' || 
      url.pathname.includes('/api/') ||
      url.pathname.includes('/video-info') ||
      url.pathname.includes('/download')) {
    console.log('Service Worker: Bypassing cache for API request:', event.request.url);
    return; // Let the request go through normally
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        console.log('Service Worker: Serving from cache:', event.request.url);
        return response;
      }
      console.log('Service Worker: Fetching from network:', event.request.url);
      return fetch(event.request).catch(error => {
        console.error('Service Worker: Fetch failed:', error);
        throw error;
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== 'aavd-cache-v1') {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});
