// L10 performance budget, per TESTING-SOTA-2026-GAPS.md section 6 item 4.
//
// The app is prod-deployed with a growing inline script (113 KB when AGENTS.md
// first measured it, 139 KB by 2026-08-07) and until now no number anywhere
// made that growth a decision instead of a drift. These budgets fail with the
// measured figure in the message, so crossing one is renegotiated in a diff
// that changes the budget constant, consciously, rather than by deleting the
// check. Real LCP/INP field budgets need the deployed site and stay a named
// gap; bytes on the boot path are the half that is measurable hermetically.
import { test, expect } from 'bun:test';
import { readFileSync, statSync, existsSync } from 'fs';

const root = (p: string) => new URL('../' + p, import.meta.url);
const HTML = readFileSync(root('index.html'), 'utf8');
const SW = readFileSync(root('sw.js'), 'utf8');

//: The one inline <script> that is the entire client. 179212 bytes measured
//: 2026-08-30 after 13 interactive widgets (+hash-lookup, trie-insert,
//: partition-row). Raising is allowed, silently drifting is not.
const INLINE_SCRIPT_BUDGET = 180_000;

//: Everything sw.js precaches before the app works offline: what a phone pays
//: on first install. 1337808 bytes measured 2026-08-29, dominated by board art.
const PRECACHE_BUDGET = 1_600_000;

function inlineScripts(): string[] {
  // Same extraction contract as tools/check_inline_js.py: script blocks with
  // no src attribute.
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

test('L10: the inline script stays inside its byte budget', () => {
  const scripts = inlineScripts();
  expect(scripts.length).toBeGreaterThan(0);
  const bytes = Math.max(...scripts.map(s => Buffer.byteLength(s, 'utf8')));
  expect(bytes,
    `inline script is ${bytes} bytes, budget ${INLINE_SCRIPT_BUDGET}. ` +
    'Raise the budget in a reviewed diff or split the block, never both silently.'
  ).toBeLessThanOrEqual(INLINE_SCRIPT_BUDGET);
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
  // caches.addAll rejects on a single 404, and a rejected install means no
  // offline mode anywhere, not one missing file. A rename that misses sw.js
  // must fail here rather than on a phone.
  for (const e of shellEntries())
    expect(existsSync(root(e)), `sw.js precaches ${e}, which does not exist`).toBe(true);
});

test('every precached path is shipped by the stager', () => {
  // The deploy allowlist (tools/stage_site.py SHIP) is default-deny: a file
  // the service worker precaches but the stager does not ship 404s in
  // production only, where no local server can reproduce it.
  const stager = readFileSync(root('tools/stage_site.py'), 'utf8');
  const m = /SHIP = \[([\s\S]*?)\]/.exec(stager);
  if (!m) throw new Error('SHIP allowlist not found in tools/stage_site.py');
  const ship = [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]);
  for (const e of shellEntries()) {
    const covered = ship.includes(e) || ship.includes(e.split('/')[0]);
    expect(covered, `sw.js precaches ${e}, which SHIP does not cover`).toBe(true);
  }
});
