// L10 performance budget, per TESTING-SOTA-2026-GAPS.md section 6 item 4.
//
// The app script was extracted from an inline block into src/app.js.
// These budgets fail with the measured figure in the message, so crossing
// one is renegotiated in a diff that changes the budget constant,
// consciously, rather than by deleting the check.
import { test, expect } from 'bun:test';
import { readFileSync, statSync, existsSync, readdirSync } from 'fs';

const root = (p: string) => new URL('../' + p, import.meta.url);
const HTML = readFileSync(root('index.html'), 'utf8');
const SW = readFileSync(root('sw.js'), 'utf8');

//: Total size of all src/*.js modules. 184344 bytes measured 2026-08-30
//: after extraction from the inline script.
const SRC_MODULES_BUDGET = 200_000;

//: Everything sw.js precaches before the app works offline: what a phone pays
//: on first install. 1337808 bytes measured 2026-08-29, dominated by board art.
const PRECACHE_BUDGET = 1_600_000;

function srcModules(): string[] {
  const dir = new URL('../src/', import.meta.url);
  return readdirSync(dir).filter(f => f.endsWith('.js')).map(f => 'src/' + f);
}

function inlineScripts(): string[] {
  return [...HTML.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]);
}

function shellEntries(): string[] {
  const m = /const SHELL = \[([\s\S]*?)\];/.exec(SW);
  if (!m) throw new Error('SHELL precache list not found in sw.js');
  const entries = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
  if (entries.length < 5) throw new Error('SHELL list implausibly short');
  return entries.map(e => (e === './' ? 'index.html' : e));
}

test('L10: inline scripts are minimal (app logic lives in src/)', () => {
  const scripts = inlineScripts();
  const totalBytes = scripts.reduce((sum, s) => sum + Buffer.byteLength(s, 'utf8'), 0);
  expect(totalBytes,
    `inline scripts total ${totalBytes} bytes; app logic should be in src/*.js`
  ).toBeLessThanOrEqual(200);
});

test('L10: src/ modules stay inside their byte budget', () => {
  const files = srcModules();
  expect(files.length).toBeGreaterThan(0);
  let total = 0;
  for (const f of files) total += statSync(root(f)).size;
  expect(total,
    `src/ modules are ${total} bytes, budget ${SRC_MODULES_BUDGET}. ` +
    'Raise the budget in a reviewed diff or split the block, never both silently.'
  ).toBeLessThanOrEqual(SRC_MODULES_BUDGET);
});

test('L10: the offline-install precache stays inside its byte budget', () => {
  let total = 0;
  for (const e of shellEntries()) total += statSync(root(e)).size;
  expect(total,
    `precached shell is ${total} bytes, budget ${PRECACHE_BUDGET}. ` +
    'A new asset on this list is paid by every fresh install on a phone.'
  ).toBeLessThanOrEqual(PRECACHE_BUDGET);
});

test('every precached path exists, so the service worker can install at all', () => {
  for (const e of shellEntries())
    expect(existsSync(root(e)), `sw.js precaches ${e}, which does not exist`).toBe(true);
});

test('every precached path is shipped by the stager', () => {
  const stager = readFileSync(root('tools/stage_site.py'), 'utf8');
  const m = /SHIP = \[([\s\S]*?)\]/.exec(stager);
  if (!m) throw new Error('SHIP allowlist not found in tools/stage_site.py');
  const ship = [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]);
  for (const e of shellEntries()) {
    const covered = ship.includes(e) || ship.includes(e.split('/')[0]);
    expect(covered, `sw.js precaches ${e}, which SHIP does not cover`).toBe(true);
  }
});
