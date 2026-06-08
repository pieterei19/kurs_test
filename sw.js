const CACHE = 'nullroute-v8';

const CORE = [
  './index.html',
  './quiz.html',
  './flashcards.html',
  './manifest.json'
];

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

  const path = e.request.url.split('?')[0];

  // Pliki .txt — network-first: zawsze świeże pytania, offline fallback z cache
  if (path.endsWith('.txt')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Pliki HTML — stale-while-revalidate:
  // 1. Serwuj z cache natychmiast (brak "can't connect", działa offline)
  // 2. Równolegle pobierz z sieci i zaktualizuj cache
  // 3. Kolejne otwarcie = nowa wersja po pushu
  if (path.endsWith('.html') || path.endsWith('/')) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(e.request);

      if (cached) {
        // Odśwież cache w tle — nie blokuj odpowiedzi
        fetch(e.request)
          .then(res => { if (res && res.status === 200) cache.put(e.request, res.clone()); })
          .catch(() => {});
        return cached;
      }

      // Brak w cache (pierwsze uruchomienie) — pobierz z sieci
      try {
        const res = await fetch(e.request);
        if (res && res.ok) cache.put(e.request, res.clone());
        return res;
      } catch {
        // Offline i brak cache — fallback do index.html
        return (await cache.match('./index.html')) ||
               new Response('App offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }

  // Zasoby statyczne (ikony, manifest) — cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request)
        .then(res => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
