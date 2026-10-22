/**
 * db.ts engine test: the truth oracle against the REAL vendored engine in
 * real Chromium. Serves game/dist/ at /game/ (the staged shape) and drives
 * the actual UI path: tap lamp -> lazy engine boot -> paste the reference
 * query -> run -> the pass verdict proves canonical(res) === canonical(ref).
 *
 * Requires `bun run build` first; fails loudly when dist/ is absent.
 * Also asserts the lazy-init contract: no duckdb byte crosses the network
 * before the first SQL drill opens. Clicks go through evaluate(), the
 * pattern phase 1 proved: Playwright's scroll-into-view hangs on the
 * fixed drill sheet over the WebGL canvas.
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { chromium, devices, type Browser, type Page } from 'playwright';
import { join } from 'node:path';
import { serveDist } from '../tools/serve_dist';
import { drills, type SqlDrill } from '../src/drills';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 4123;

let server: ReturnType<typeof serveDist>;
let browser: Browser;

async function newPage(): Promise<{ page: Page; errors: string[]; requested: string[]; notFound: string[] }> {
  const page = await browser.newPage({ ...devices['iPhone 14'], locale: 'he-IL' });
  const errors: string[] = [];
  const requested: string[] = [];
  const notFound: string[] = [];
  page.on('pageerror', e => errors.push('[pageerror] ' + String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 200)); });
  page.on('request', r => requested.push(r.url()));
  page.on('response', r => { if (r.status() === 404) notFound.push(r.url()); });
  return { page, errors, requested, notFound };
}

/** App-thrown errors: the honest 404 for the optional (empty-by-design)
 *  book bank is Chrome's resource log, not an app error. The console message
 *  carries no URL, so one generic 404 log is forgiven per bank 404 response. */
const appErrors = (errors: string[], notFound: string[]) => {
  let forgiven = notFound.filter(u => u.includes('book-drills.json')).length;
  return errors.filter(e => {
    if (forgiven > 0 && e.includes('status of 404')) { forgiven--; return false; }
    return true;
  });
};

const evalClick = (page: Page, sel: string) =>
  page.evaluate((s) => (document.querySelector(s) as HTMLElement).click(), sel);

beforeAll(async () => {
  if (!(await Bun.file(join(ROOT, 'dist', 'index.html')).exists())) {
    throw new Error('game/dist/ is absent: run `bun run build` before `bun test`');
  }
  server = serveDist(PORT);
  browser = await chromium.launch({ args: ['--no-sandbox'] });
});

afterAll(async () => {
  await browser?.close();
  server?.stop();
});

describe('truth oracle (vendored engine, real browser)', () => {
  test('the reference query passes its own drill', async () => {
    const drill = drills.find((d): d is SqlDrill => d.kind === 'sql' && d.id === 'approval-rate');
    expect(drill).toBeDefined();
    const { page, errors, requested, notFound } = await newPage();

    await page.goto(`http://127.0.0.1:${PORT}/game/?dev`, { waitUntil: 'load', timeout: 60000 });
    // the city boots with no engine: the hint is up and no duckdb byte moved
    await page.waitForFunction(
      () => (document.getElementById('hint')?.textContent || '').includes('פנס'),
      { timeout: 60000 },
    );
    expect(requested.filter(u => u.includes('duckdb'))).toEqual([]);

    // first SQL drill open: lazy engine boot + prepared-statement seed
    await page.evaluate(() => (window as unknown as { __open: (id: string) => void }).__open('approval-rate'));
    await page.waitForSelector('#runBtn', { timeout: 180000 });
    expect(requested.filter(u => u.includes('duckdb-eh.wasm')).length).toBeGreaterThan(0);

    await page.fill('#sql', drill!.reference);
    await evalClick(page, '#runBtn');
    await page.waitForSelector('.verdict.ok', { timeout: 60000 });
    const verdict = await page.textContent('.verdict.ok');
    expect(verdict).toContain('הפנס נדלק');
    expect(appErrors(errors, notFound)).toEqual([]);
    await page.close();
  }, 300000);

  test('seed inserts stay inside the sheet-open budget', async () => {
    const { page, errors, notFound } = await newPage();
    await page.goto(`http://127.0.0.1:${PORT}/game/?dev`, { waitUntil: 'load', timeout: 60000 });
    // pause the render loop first (the DB-free case drill), matching the real
    // SQL-drill path where the open sheet pauses rendering before initDb.
    await page.evaluate(() => (window as unknown as { __open: (id: string) => void }).__open('case-file-1'));
    await page.waitForSelector('.verdict-btn', { timeout: 30000 });
    const phases = await page.evaluate(() =>
      (window as unknown as {
        __db: {
          initDb: (onStatus: (s: string) => void, opts: { baseUrl: string; onPhase?: (p: string, ms: number) => void }) => Promise<void>;
        };
      }).__db.initDb(() => {}, {
        baseUrl: document.baseURI,
        onPhase: (p, ms) => { (window as unknown as { __phases: Record<string, number> }).__phases ??= {}; (window as unknown as { __phases: Record<string, number> }).__phases[p] = ms; },
      }).then(() => (window as unknown as { __phases: Record<string, number> }).__phases),
    );
    expect(phases['instantiate']).toBeGreaterThan(0);
    expect(phases['seed']).toBeGreaterThan(0);
    // budget: the lazy boot must stay usable on first drill open.
    // Measured mechanism: CSV bulk-load of 3.9k rows (prepared-statement
    // batches were ~70s; per-row bridge cost is linear, so no batch size
    // fixes it). Over budget -> the mechanism, not the batch size, is wrong.
    expect(phases['seed']).toBeLessThan(15000);
    expect(appErrors(errors, notFound)).toEqual([]);
    await page.close();
  }, 300000);
});
