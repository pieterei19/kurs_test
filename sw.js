const CACHE = 'nullroute-v7';

// Pliki KRYTYCZNE - apka nie działa bez nich
const CORE = [
  './index.html',
  './quiz.html',
  './flashcards.html',
  './manifest.json'
];

// Pliki OPCJONALNE - cachujemy jeśli się uda
const OPTIONAL = [
  './',
  './icon-192.png',
  './icon-512.png',
  './mtcna.txt',
  './inf03.txt',
  './flashcards.txt',
  './protokoly.txt'
];

async function tryCache(cache, url) {
  try {
    const res = await fetch(url);
    if (res.ok) await cache.put(url, res);
  } catch (_) {}
}

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      await cache.addAll(CORE);
      await Promise.all(OPTIONAL.map(url => tryCache(cache, url)));
      return self.skipWaiting();
    })
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
  if (e.request.method !== 'GET') return;

  const url = e.request.url;

  // HTML i .txt — network-first: po każdym pushu apka dostaje świeży kod,
  // offline fallback z cache
  if (url.endsWith('.html') || url.endsWith('.txt') || /\/$/.test(url.split('?')[0])) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Zasoby statyczne (ikony, manifest) — cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request)
        .then(res => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
