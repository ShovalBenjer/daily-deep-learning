/**
 * Dev server: Bun's fullstack pattern. The bare `bun index.html` server
 * answers EVERY path with the bundled HTML (SPA fallback), which silently
 * broke all /bank/* fetches: HTML came back with status 200 and the game
 * treated the study bank as empty. This serves the bundle at / and the
 * gitignored bank/ files as real static JSON, 404ing honestly otherwise.
 */
import index from './index.html';

const server = Bun.serve({
  port: Number(process.env.PORT || 3000),
  routes: { '/': index },
  async fetch(req) {
    const path = new URL(req.url).pathname;
    if (path.startsWith('/bank/') && !path.includes('..')) {
      const f = Bun.file('.' + path);
      if (await f.exists()) return new Response(f, { headers: { 'content-type': 'application/json' } });
      return new Response('no bank file', { status: 404 });
    }
    return new Response('not found', { status: 404 });
  },
});

console.log(`city dev server on :${server.port}`);
