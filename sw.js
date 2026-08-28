const CACHE_NAME = 'kasir-mami-v12';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './css/style.css',
  './js/app.js',
  './js/config.js',
  './js/state.js',
  './js/utils.js',
  './js/qris.js',
  './js/firebase.js',
  './js/modules/pos.js',
  './js/modules/payment.js',
  './js/modules/admin.js',
  './js/modules/report.js',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24..48,400..700,0..1,-50..200',
  'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Let Firebase, WebSockets, and non-GET requests pass directly to network
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('firestore.googleapis.com') ||
    event.request.url.includes('firebase') ||
    event.request.url.includes('googleapis.com')
  ) {
    return;
  }

  // Network-First strategy: Always fetch freshest files when online, fallback to cache when offline
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // When offline, serve from cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
  );
});
