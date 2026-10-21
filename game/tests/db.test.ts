/**
 * db.ts behavioral tests (engine-free): seed determinism and the
 * canonical grading form. The engine-backed truth-oracle test lives in
 * db.engine.test.ts (real Chromium, real vendored wasm).
 */
import { describe, test, expect } from 'bun:test';
import { seedRows, canonical, type SqlResult } from '../src/db';

describe('seed determinism', () => {
  test('same seed -> identical row count and rows, twice', () => {
    const a = seedRows();
    const b = seedRows();
    expect(a.length).toBe(b.length);
    expect(a.length).toBe(3869);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('the planted story survives: PixelPay burst and Aurora spike', () => {
    const rows = seedRows();
    // burst rows carry card ids 7000+; the merchant's regular July rows sit below
    const burst = rows.filter(r => r.merchant_id === 7 && r.card_id >= 7000);
    expect(burst.length).toBe(200);
    expect(burst.filter(r => r.status === 'approved').length).toBe(12);
    const auroraAug = rows.filter(r => r.merchant_id === 6 && r.txn_ts.startsWith('2026-08'));
    expect(auroraAug.length).toBe(340);
    // money never floated in JS: every amount is integer cents
    for (const r of rows) expect(Number.isInteger(r.amount_cents)).toBe(true);
  });
});

describe('canonical()', () => {
  const res = (rows: unknown[][]): SqlResult => ({ columns: ['a'], rows });

  test('distinguishes row order (grading is order-sensitive)', () => {
    const r1 = res([[1], [2]]);
    const r2 = res([[2], [1]]);
    expect(canonical(r1)).not.toBe(canonical(r2));
    expect(canonical(r1)).toBe(canonical(res([[1], [2]])));
  });

  test('normalizes bigints, floats and dates', () => {
    const a = res([[10n, 1.23456789, new Date('2026-07-01T10:00:00Z')]]);
    const b = res([[10, 1.2346, '2026-07-01']]);
    expect(canonical(a)).toBe(canonical(b));
  });
});
