const V = 'sadna-v14';
const SHELL = ['./', 'index.html', 'style.css', 'manifest.webmanifest',
  'vendor/katex.min.css', 'vendor/katex.min.js', 'vendor/auto-render.min.js', 'vendor/marked.min.js'];
const FRESH = ['/posts/', 'judgment_map.json', 'research_ladder.json', 'course_plan.json', 'talents.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Content that changes daily: network-first, cache fallback offline.
  if (FRESH.some(f => url.pathname.includes(f))) {
    e.respondWith(
      fetch(e.request).then(r => {
        const cp = r.clone();
        caches.open(V).then(c => c.put(e.request, cp));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Shell, fonts, CDN: cache-first.
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok || r.type === 'opaque') {
        const cp = r.clone();
        caches.open(V).then(c => c.put(e.request, cp));
      }
      return r;
    }))
  );
});
