/**
 * DuckDB-WASM boot + deterministic seed for the SQL district.
 *
 * Purpose: give the drills a real database with a story in it. The dataset
 * plants two patterns on purpose: PixelPay carries a card-testing burst in
 * July (many small txns, almost all declined) and Aurora Jewels is the
 * unverified-KYC merchant whose August volume spikes (bust-out shape).
 * Numbers are deterministic (seeded RNG) so drill predictions stay true.
 *
 * Boot: the eh bundle is vendored at build time into vendor/
 * (duckdb-browser-eh.worker.js + duckdb-eh.wasm, copied from
 * node_modules/@duckdb/duckdb-wasm/dist/ by tools/build.ts) and loaded
 * from same-origin URLs. No jsdelivr, no extensions.duckdb.org, no
 * SharedArrayBuffer, so no COOP/COEP headers. The eh build is picked
 * explicitly; the coi/pthread worker is never shipped.
 *
 * Seed: CREATE TABLE ... AS FROM read_csv over registered CSV files.
 * read_csv is DuckDB core, so no extension is ever autoloaded (unlike
 * read_json, whose extensions.duckdb.org fetch failed in Phase 1); the rows
 * travel as a data file, never assembled into SQL text (review panel
 * 2026-08-24, sql-concat). Batched prepared-statement inserts were measured
 * at ~70s for these 3.9k rows in the eh build (per-row bridge cost is
 * linear, so no batch size fixes it); CSV bulk-loads the same rows in
 * ~100ms. Money is generated as integer cents and divided by 100 in SQL,
 * never floated in JS.
 *
 * Lifecycle: initDb() is lazy (called on first SQL drill open, never at
 * boot) and idempotent; concurrent callers share one in-flight init.
 * Contracts: initDb() resolves once with a connected engine; runSql()
 * returns { columns, rows } or throws with the engine's message; the
 * schema matches the drill text exactly (merchants, transactions).
 */
import * as duckdb from '@duckdb/duckdb-wasm';

let conn: duckdb.AsyncDuckDBConnection | null = null;
let initPromise: Promise<void> | null = null;

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MERCHANTS = [
  // id, name, category, country, signup, kyc, baseTxnPerMonth, approvalP
  [1, 'Tel Aviv Coffee Co', 'food', 'IL', '2024-03-11', true, 190, 0.96],
  [2, 'GadgetHub', 'electronics', 'IL', '2023-11-02', true, 260, 0.91],
  [3, 'StreamBoost Media', 'digital', 'US', '2024-07-19', true, 350, 0.93],
  [4, 'Nomad Outdoor', 'retail', 'IL', '2025-01-25', true, 135, 0.91],
  [5, 'Haifa Home Decor', 'retail', 'IL', '2024-09-30', true, 100, 0.89],
  [6, 'Aurora Jewels', 'retail', 'IL', '2026-06-20', false, 120, 0.81],
  [7, 'PixelPay Top-ups', 'digital', 'IL', '2025-12-05', true, 30, 0.72],
] as const;

export interface TxnRow { txn_id: number; merchant_id: number; txn_ts: string; amount_cents: number; status: string; card_id: number; }

/** The deterministic seed, exported for tests. Same seed -> same rows. */
export function seedRows(): TxnRow[] {
  const rnd = mulberry32(20260824);
  const rows: TxnRow[] = [];
  let txn = 1000;
  const push = (mid: number, ts: string, amountCents: number, status: string, card: number) =>
    rows.push({ txn_id: txn++, merchant_id: mid, txn_ts: ts, amount_cents: amountCents, status, card_id: card });

  const day = (m: number, d: number) =>
    `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(Math.floor(rnd() * 14) + 8).padStart(2, '0')}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}:00`;

  for (const [mid, , , , , , perMonth, approvalP] of MERCHANTS) {
    for (const month of [6, 7, 8]) {
      // Aurora opens 2026-06-20: June is a stub month; August is the spike.
      let n = perMonth as number;
      if (mid === 6 && month === 6) n = 14;
      if (mid === 6 && month === 8) n = 340;
      for (let i = 0; i < n; i++) {
        const d = mid === 6 && month === 6 ? 20 + Math.floor(rnd() * 10) : 1 + Math.floor(rnd() * 28);
        const cents = mid === 6 && month === 8
          ? 90000 + Math.floor(rnd() * 260000)
          : 1500 + Math.floor(rnd() * 48000);
        const status = rnd() < (approvalP as number) ? 'approved' : (rnd() < 0.8 ? 'declined' : 'refunded');
        push(mid as number, day(month, d), cents, status, 5000 + Math.floor(rnd() * 900));
      }
    }
  }
  // PixelPay July card-testing burst: small amounts, many cards, ~4% approved.
  for (let i = 0; i < 200; i++) {
    push(7, day(7, 9 + Math.floor(rnd() * 3)), 100 + Math.floor(rnd() * 400), rnd() < 0.04 ? 'approved' : 'declined', 7000 + i);
  }
  return rows;
}

/** Minimal CSV field quoter: quotes when the field needs it, doubles quotes. */
function csvField(v: string | number | boolean): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function seed(
  db: duckdb.AsyncDuckDB,
  c: duckdb.AsyncDuckDBConnection,
  onStatus: (s: string) => void,
): Promise<void> {
  // Bulk load via CSV: read_csv is DuckDB core (no extension autoload, unlike
  // read_json), and the rows travel as a registered data file, never as SQL
  // text — the 2026-08-24 sql-concat rule. Prepared-statement seeding was
  // measured at ~70s for 3.9k rows in this build (per-row bridge cost is
  // linear, so larger batches cannot fix it); CSV bulk-loads the same rows
  // in ~2s, inside the sheet-open budget.
  const merchantsCsv = MERCHANTS.map(m =>
    [m[0], m[1], m[2], m[3], m[4], m[5]].map(csvField).join(',')).join('\n');
  const rows = seedRows();
  onStatus(`זורע נתונים 0/${rows.length}`);
  const txnsCsv = rows.map(r =>
    [r.txn_id, r.merchant_id, r.txn_ts, r.amount_cents, r.status, r.card_id].map(csvField).join(',')).join('\n');
  await db.registerFileText('seed_merchants.csv', merchantsCsv);
  await db.registerFileText('seed_transactions.csv', txnsCsv);
  await c.query(`CREATE TABLE merchants AS SELECT
      CAST(merchant_id AS INTEGER) AS merchant_id, name, category, country,
      CAST(signup_date AS DATE) AS signup_date, CAST(kyc_verified AS BOOLEAN) AS kyc_verified
    FROM read_csv('seed_merchants.csv', header=false,
      columns={merchant_id: 'VARCHAR', name: 'VARCHAR', category: 'VARCHAR',
               country: 'VARCHAR', signup_date: 'VARCHAR', kyc_verified: 'VARCHAR'})`);
  await c.query(`CREATE TABLE transactions AS SELECT
      CAST(txn_id AS INTEGER) AS txn_id, CAST(merchant_id AS INTEGER) AS merchant_id,
      CAST(txn_ts AS TIMESTAMP) AS txn_ts,
      CAST(amount_cents AS DECIMAL(14,2)) / 100 AS amount,
      status, CAST(card_id AS INTEGER) AS card_id
    FROM read_csv('seed_transactions.csv', header=false,
      columns={txn_id: 'VARCHAR', merchant_id: 'VARCHAR', txn_ts: 'VARCHAR',
               amount_cents: 'VARCHAR', status: 'VARCHAR', card_id: 'VARCHAR'})`);
}

export interface DbOptions {
  /** Base URL the vendored bundle resolves against (document.baseURI in the app). */
  baseUrl: string;
  /** Timing seam for measurements: phase name -> elapsed ms. */
  onPhase?: (phase: 'instantiate' | 'seed', ms: number) => void;
}

/**
 * Boot the vendored eh engine and seed it. Idempotent: concurrent callers
 * share the one in-flight init; a failed init clears so a retry re-runs it.
 */
export function initDb(onStatus: (s: string) => void, opts: DbOptions): Promise<void> {
  if (conn) return Promise.resolve();
  if (initPromise) return initPromise;
  initPromise = (async () => {
    onStatus('טוען מנוע SQL');
    const workerUrl = new URL('vendor/duckdb-browser-eh.worker.js', opts.baseUrl).href;
    const wasmUrl = new URL('vendor/duckdb-eh.wasm', opts.baseUrl).href;
    // same blob+importScripts boot the POC used; the URL is now same-origin.
    const bootUrl = URL.createObjectURL(
      new Blob([`importScripts(${JSON.stringify(workerUrl)});`], { type: 'text/javascript' }));
    const worker = new Worker(bootUrl);
    try {
      const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.ERROR), worker);
      const t0 = performance.now();
      await db.instantiate(wasmUrl);
      opts.onPhase?.('instantiate', performance.now() - t0);
      const c = await db.connect();
      const t1 = performance.now();
      await seed(db, c, onStatus);
      opts.onPhase?.('seed', performance.now() - t1);
      conn = c;
    } finally {
      URL.revokeObjectURL(bootUrl);
    }
    onStatus('');
  })();
  initPromise.catch(() => { initPromise = null; });
  return initPromise;
}

export interface SqlResult { columns: string[]; rows: unknown[][]; }

export async function runSql(sql: string): Promise<SqlResult> {
  if (!conn) throw new Error('db not ready');
  const table = await conn.query(sql);
  const columns = table.schema.fields.map(f => f.name);
  const rows = table.toArray().map(r => columns.map(c => (r as Record<string, unknown>)[c]));
  return { columns, rows };
}

/** Canonical form for grading: numbers rounded to 4dp, bigints unboxed, dates ISO. */
export function canonical(res: SqlResult): string {
  return JSON.stringify(res.rows.map(row => row.map(v => {
    if (typeof v === 'bigint') return Number(v);
    if (typeof v === 'number') return Math.round(v * 10000) / 10000;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return v;
  })));
}
