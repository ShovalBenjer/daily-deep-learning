const V = 'dl-v3';
const SHELL = ['./', 'index.html', 'style.css', 'codex-bg.js', 'manifest.webmanifest'];

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

  // Posts, their index, and the course plan: network-first, cache fallback offline.
  if (url.pathname.includes('/posts/') || url.pathname.endsWith('course_plan.json')) {
    e.respondWith(
      fetch(e.request).then(r => {
        const cp = r.clone();
        caches.open(V).then(c => c.put(e.request, cp));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Shell, fonts, CDN assets: cache-first.
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
