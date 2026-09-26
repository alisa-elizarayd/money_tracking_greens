/* ============================================================
   Service Worker — Трекер оплат репетитора
   Стратегии:
   - HTML: network-first (чтобы всегда получать свежую версию)
   - Статика (иконки, manifest): cache-first
   ============================================================ */

const CACHE_VERSION = 'tutor-tracker-v1';
const CACHE_STATIC  = `${CACHE_VERSION}-static`;
const CACHE_DYNAMIC = `${CACHE_VERSION}-dynamic`;

/* Файлы, которые кэшируем сразу при установке */
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

/* ---------- INSTALL ---------- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] precache error:', err))
  );
});

/* ---------- ACTIVATE ---------- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys
        .filter(k => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
        .map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

/* ---------- FETCH ---------- */
self.addEventListener('fetch', event => {
  const req = event.request;

  // только GET
  if (req.method !== 'GET') return;

  // не кэшируем внешние домены (аналитика, шрифты и т.п.)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // HTML — network-first
  const accept = req.headers.get('accept') || '';
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Остальное — cache-first
  event.respondWith(cacheFirst(req));
});

/* ---------- Стратегии ---------- */
async function networkFirst(req) {
  const cache = await caches.open(CACHE_DYNAMIC);
  try {
    const fresh = await fetch(req);
    cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(req);
    if (cached) return cached;
    const fallback = await caches.match('./index.html');
    if (fallback) return fallback;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(CACHE_DYNAMIC);
    cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

/* ---------- Сообщение от страницы: принудительное обновление ---------- */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
