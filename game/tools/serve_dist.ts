/**
 * Static server for the built game: serves game/dist/ under /game/,
 * the same shape Cloudflare Pages serves after tools/stage_site.py maps
 * "game/dist:game". Used by tests/db.engine.test.ts and by the manual
 * gate drive. Honest 404s everywhere (no SPA fallback): a missing asset
 * must fail loudly, the way Pages would 404 it.
 *
 * Run directly: `bun tools/serve_dist.ts [port]` (default 4123).
 */
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

export function serveDist(port: number) {
  return Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      if (!url.pathname.startsWith('/game/')) {
        return new Response('not found', { status: 404 });
      }
      let rel = decodeURIComponent(url.pathname.slice('/game/'.length));
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      if (rel.includes('..')) return new Response('not found', { status: 404 });
      const file = Bun.file(join(DIST, rel));
      if (!(await file.exists())) return new Response('not found', { status: 404 });
      return new Response(file, {
        headers: { 'content-type': TYPES[extname(rel)] ?? 'application/octet-stream' },
      });
    },
  });
}

if (import.meta.main) {
  const port = Number(process.argv[2] || 4123);
  const server = serveDist(port);
  console.log(`game dist on http://127.0.0.1:${server.port}/game/`);
}
