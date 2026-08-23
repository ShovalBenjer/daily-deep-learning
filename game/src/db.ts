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
 * Seeding never assembles row values into SQL text: rows are registered
 * as JSON files and loaded with read_json, so the only SQL strings are
 * literal DDL (review panel 2026-08-24, sql-concat). Money is generated
 * as integer cents and stored as DECIMAL(12,2), never floated in JS.
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

interface TxnRow { txn_id: number; merchant_id: number; txn_ts: string; amount_cents: number; status: string; card_id: number; }

function seedRows(): TxnRow[] {
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
  const merchants = MERCHANTS.map(m => ({
    merchant_id: m[0], name: m[1], category: m[2], country: m[3], signup_date: m[4], kyc_verified: m[5],
  }));
  await db.registerFileText('seed_merchants.json', JSON.stringify(merchants));
  await db.registerFileText('seed_transactions.json', JSON.stringify(seedRows()));
  await conn.query(`
    CREATE TABLE merchants AS
      SELECT merchant_id, name, category, country,
             CAST(signup_date AS DATE) AS signup_date, kyc_verified
      FROM read_json('seed_merchants.json',
        columns={merchant_id: 'INT', name: 'TEXT', category: 'TEXT', country: 'TEXT', signup_date: 'TEXT', kyc_verified: 'BOOLEAN'});
    CREATE TABLE transactions AS
      SELECT txn_id, merchant_id, CAST(txn_ts AS TIMESTAMP) AS txn_ts,
             CAST(amount_cents AS DECIMAL(14,2)) / 100 AS amount,
             status, card_id
      FROM read_json('seed_transactions.json',
        columns={txn_id: 'INT', merchant_id: 'INT', txn_ts: 'TEXT', amount_cents: 'BIGINT', status: 'TEXT', card_id: 'INT'});
  `);
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
