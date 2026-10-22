/**
 * Scoped worker for the game: controls /game/ only (the site root worker
 * is untouched). Precaches the shell + the vendored wasm + fonts so the
 * loop plays offline after the first visit.
 *
 * The V and PRECACHE constants below are filled by tools/build.ts at build
 * time: the cache name changes exactly when the asset set changes, so
 * phones never keep a stale bundle.
 */
const V = '__V__';
const CACHE = 'lamps-game-' + V;
/** @type {string[]} dist-relative paths, replaced at build time */
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // offline-first inside the scope: cache, then network, then the shell.
  event.respondWith(
    caches.match(event.request).then((hit) => {
      if (hit) return hit;
      return fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy));
        return res;
      }).catch(() => caches.match('index.html'));
    }),
  );
});
