/**
 * Production build for the game: bun build -> game/dist/.
 *
 * Steps (exact, no placeholders):
 *   1. Vendor the DuckDB eh bundle: copy duckdb-browser-eh.worker.js and
 *      duckdb-eh.wasm from node_modules/@duckdb/duckdb-wasm/dist/ into
 *      game/vendor/ (exactly the two eh files; the coi pthread worker is
 *      never shipped). Skipped when both files are already present.
 *   2. Bun.build ./index.html --outdir dist --target browser --minify.
 *   3. Copy static runtime assets into dist/: manifest.webmanifest,
 *      icons/, vendor/ (the two eh files from step 1). Note: woff2 fonts
 *      referenced from styles.css are inlined by bun as data: URIs into
 *      the emitted CSS (verified: no build flag changes this), so there
 *      is no dist/fonts/ — the three voices ship self-hosted inside the
 *      CSS with their Hebrew/Latin unicode-ranges intact.
 *   4. Generate dist/sw.js from ./sw.js: __PRECACHE__ becomes the JSON
 *      list of every dist-relative file (minus sw.js itself), __V__ a
 *      content hash so the cache name changes exactly when assets do.
 *
 * `bun tools/build.ts vendor` runs step 1 only (used by `bun run dev`).
 *
 * Contracts: dist/ is the exact tree tools/stage_site.py maps to /game/
 * (SHIP entry "game/dist:game"). Nothing outside dist/ is staged.
 */
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const VENDOR = join(ROOT, 'vendor');
const DUCKDB_DIST = join(ROOT, 'node_modules', '@duckdb', 'duckdb-wasm', 'dist');
const EH_FILES = ['duckdb-browser-eh.worker.js', 'duckdb-eh.wasm'] as const;

async function exists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

async function copyDir(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  for (const name of await readdir(src)) {
    const s = join(src, name), d = join(dest, name);
    if ((await stat(s)).isDirectory()) await copyDir(s, d);
    else await copyFile(s, d);
  }
}

/** Step 1: vendor the eh bundle from the installed dependency. */
export async function vendorBundle(): Promise<void> {
  await mkdir(VENDOR, { recursive: true });
  for (const f of EH_FILES) {
    const dest = join(VENDOR, f);
    if (await exists(dest)) continue;
    await copyFile(join(DUCKDB_DIST, f), dest);
    console.log('vendored', f);
  }
}

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    if ((await stat(p)).isDirectory()) out.push(...await listFiles(p));
    else out.push(relative(DIST, p));
  }
  return out.sort();
}

/** Steps 2-4: bundle, copy statics, generate the service worker. */
export async function build(): Promise<void> {
  await vendorBundle();

  const result = await Bun.build({
    entrypoints: [join(ROOT, 'index.html')],
    outdir: DIST,
    target: 'browser',
    minify: true,
  });
  if (!result.success) {
    for (const log of result.logs) console.error(String(log));
    throw new Error('bun build failed');
  }
  for (const o of result.outputs) console.log('built', relative(DIST, o.path), o.size, 'bytes');

  // Step 3: static runtime assets the bundler does not copy. (The manifest
  // is already emitted hashed by the bundler and referenced from the HTML;
  // fonts are inlined into the CSS — see the header note.)
  await mkdir(join(DIST, 'icons'), { recursive: true });
  for (const icon of ['icon-192.png', 'icon-512.png']) {
    await copyFile(join(ROOT, 'icons', icon), join(DIST, 'icons', icon));
  }
  await copyDir(VENDOR, join(DIST, 'vendor'));

  // Step 4: service worker with the real precache list.
  const files = (await listFiles(DIST)).filter(f => f !== 'sw.js');
  const hasher = createHash('sha256');
  for (const f of files) {
    hasher.update(f);
    hasher.update(String((await stat(join(DIST, f))).size));
  }
  const version = hasher.digest('hex').slice(0, 12);
  const template = await Bun.file(join(ROOT, 'sw.js')).text();
  const sw = template
    .replace('__V__', version)
    .replace('__PRECACHE__', JSON.stringify(files));
  await Bun.write(join(DIST, 'sw.js'), sw);
  console.log('sw.js: precache', files.length, 'files, version', version);
}

const mode = process.argv[2];
if (mode === 'vendor') await vendorBundle();
else await build();
