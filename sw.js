// Zmień wersję żeby wymusić odświeżenie cache po każdym deploy
const CACHE = 'mtcna-v4';

// Ścieżki relatywne — działają niezależnie od podkatalogu repo
const FILES = [
  './',
  './index.html',
  './1pyt.html',
  './30pyt.html',
  './questions.txt',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Tylko GET, tylko same-origin
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      // Network-first dla questions.txt żeby zawsze mieć świeże pytania
      if (e.request.url.includes('questions.txt')) {
        return fetch(e.request)
          .then(res => {
            if (res && res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE).then(c => c.put(e.request, clone));
            }
            return res;
          })
          .catch(() => cached); // fallback do cache gdy offline
      }

      // Cache-first dla reszty
      if (cached) return cached;

      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
