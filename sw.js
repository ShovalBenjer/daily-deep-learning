const V = 'sadna-v35';
const SHELL = ['./', 'index.html', 'style.css', 'manifest.webmanifest',
  'vendor/katex.min.css', 'vendor/katex.min.js', 'vendor/auto-render.min.js', 'vendor/marked.min.js', 'vendor/purify.min.js',
  'assets/ui/frame-plate.svg', 'assets/ui/frame-hero.svg', 'assets/ui/frame-plate-light.svg', 'assets/ui/frame-hero-light.svg',
  'assets/art/board-bg.webp', 'assets/art/crest-systems.webp', 'assets/art/crest-craft.webp', 'assets/art/crest-ops.webp', 'assets/art/spark-portrait.webp',
  'assets/art/frame-hero-painted.png', 'assets/art/ledger-banner.webp'];
const FRESH = ['/posts/', 'judgment_map.json', 'research_ladder.json', 'course_plan.json', 'talents.json', 'corpus_manifest.json', 'concepts.json', 'discoveries.json', 'skills.json', 'syllabus.json'];
// The shell itself is NETWORK-FIRST so an open with connectivity always gets
// the latest app (staleness burned us repeatedly); cache is the offline fallback.
const NETFIRST_SHELL = ['index.html', 'style.css', 'tree3d.js', 'sw.js'];

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

function netFirst(e) {
  e.respondWith(
    fetch(e.request).then(r => {
      const cp = r.clone();
      caches.open(V).then(c => c.put(e.request, cp));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: e.request.mode === 'navigate' })
      .then(hit => hit || caches.match('index.html')))
  );
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const path = url.pathname;

  if (e.request.mode === 'navigate' || NETFIRST_SHELL.some(f => path.endsWith('/' + f)) ||
      FRESH.some(f => path.includes(f))) {
    return netFirst(e);
  }

  // Fonts, vendor libs, icons: cache-first (immutable in practice).
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
