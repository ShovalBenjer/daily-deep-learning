/**
 * DuckDB-WASM boot + deterministic seed for the SQL district.
 *
 * Purpose: give the drills a real database with a story in it. The dataset
 * plants two patterns on purpose: PixelPay carries a card-testing burst in
 * July (many small txns, almost all declined) and Aurora Jewels is the
 * unverified-KYC merchant whose August volume spikes (bust-out shape).
 * Numbers are deterministic (seeded RNG) so drill predictions stay true.
 *
 * Contracts: initDb() resolves once with a connected AsyncDuckDB; runSql()
 * returns { columns, rows } or throws with the engine's message; the
 * schema matches the drill text exactly (merchants, transactions).
 *
 * Agent-context: worker+wasm load from jsdelivr at runtime. POC-only
 * shortcut, acceptable because the POC runs on localhost (no CSP); the
 * deploy story vendors the bundle per ADR-0002's consequences.
 */
import * as duckdb from '@duckdb/duckdb-wasm';

let conn: duckdb.AsyncDuckDBConnection | null = null;

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

function seedSql(): string {
  const rnd = mulberry32(20260824);
  const rows: string[] = [];
  let txn = 1000;
  const push = (mid: number, ts: string, amount: number, status: string, card: number) =>
    rows.push(`(${txn++}, ${mid}, TIMESTAMP '${ts}', ${amount.toFixed(2)}, '${status}', ${card})`);

  const day = (m: number, d: number) =>
    `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(Math.floor(rnd() * 14) + 8).padStart(2, '0')}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}:00`;

  for (const [mid, , , , signup, , perMonth, approvalP] of MERCHANTS) {
    for (const month of [6, 7, 8]) {
      // Aurora opens 2026-06-20: June is a stub month; August is the spike.
      let n = perMonth as number;
      if (mid === 6 && month === 6) n = 14;
      if (mid === 6 && month === 8) n = 340;
      for (let i = 0; i < n; i++) {
        const d = mid === 6 && month === 6 ? 20 + Math.floor(rnd() * 10) : 1 + Math.floor(rnd() * 28);
        const amount = mid === 6 && month === 8 ? 900 + rnd() * 2600 : 15 + rnd() * 480;
        const status = rnd() < (approvalP as number) ? 'approved' : (rnd() < 0.8 ? 'declined' : 'refunded');
        push(mid as number, day(month, d), amount, status, 5000 + Math.floor(rnd() * 900));
      }
    }
  }
  // PixelPay July card-testing burst: small amounts, many cards, ~4% approved.
  for (let i = 0; i < 200; i++) {
    push(7, day(7, 9 + Math.floor(rnd() * 3)), 1 + rnd() * 4, rnd() < 0.04 ? 'approved' : 'declined', 7000 + i);
  }
  return `
    CREATE TABLE merchants (merchant_id INT, name TEXT, category TEXT, country TEXT, signup_date DATE, kyc_verified BOOLEAN);
    INSERT INTO merchants VALUES ${MERCHANTS.map(m => `(${m[0]}, '${m[1]}', '${m[2]}', '${m[3]}', DATE '${m[4]}', ${m[5]})`).join(',')};
    CREATE TABLE transactions (txn_id INT, merchant_id INT, txn_ts TIMESTAMP, amount DOUBLE, status TEXT, card_id INT);
    INSERT INTO transactions VALUES ${rows.join(',')};
  `;
}

export async function initDb(onStatus: (s: string) => void): Promise<void> {
  onStatus('טוען מנוע SQL');
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }));
  const worker = new Worker(workerUrl);
  const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.ERROR), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  conn = await db.connect();
  onStatus('זורע נתונים');
  await conn.query(seedSql());
  onStatus('');
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
