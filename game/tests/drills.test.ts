/**
 * drills.ts behavioral tests: every hole's check() accepts the drill's own
 * reference query (drift guard: reference and holes must agree) and rejects
 * a plausible wrong fragment for the same hole.
 */
import { describe, test, expect } from 'bun:test';
import { drills, type SqlDrill, type CaseDrill } from '../src/drills';

const sqlDrills = drills.filter((d): d is SqlDrill => d.kind === 'sql');

/** One plausible wrong fragment per (drill, hole label). Must read like a
 *  real student mistake, not a strawman. */
const WRONG: Record<string, Record<string, string>> = {
  'approval-rate': {
    'האחוז': "SELECT m.name, COUNT(*) AS num_txn, AVG(t.amount) AS approval_rate FROM transactions t",
    'חלון הזמן': "WHERE t.txn_ts >= '2026-06-01' AND t.txn_ts < '2026-07-01'",
  },
  'monthly-rollup': {
    'הסכום': 'SELECT COUNT(t.amount) AS total_amount FROM transactions t',
    'הסינון': "WHERE m.name = 'Aurora Jewels'",
  },
  'window-top-per-category': {
    'הסינון': "WHERE t.status = 'approved'",
    'החלון': 'ROW_NUMBER() OVER (ORDER BY total_amount DESC) AS rn',
  },
};

describe('hole ladder vs reference (drift guard)', () => {
  for (const d of sqlDrills) {
    test(`${d.id}: every hole accepts the reference query`, () => {
      for (const h of d.holes) {
        expect(h.check(d.reference)).toBe(true);
      }
    });
  }
});

describe('hole ladder rejects plausible wrong fragments', () => {
  for (const d of sqlDrills) {
    for (const h of d.holes) {
      test(`${d.id} / ${h.label}: rejects the wrong fragment`, () => {
        const wrong = WRONG[d.id]?.[h.label];
        expect(wrong).toBeDefined();
        expect(h.check(wrong as string)).toBe(false);
      });
    }
  }
});

describe('case drill integrity', () => {
  test('the correct answer is a legal answer', () => {
    const cases = drills.filter((d): d is CaseDrill => d.kind === 'case');
    expect(cases.length).toBeGreaterThan(0);
    for (const c of cases) {
      expect(c.verdicts).toContain(c.correctVerdict);
      expect(c.correctBlock).toBeGreaterThanOrEqual(1);
      expect(c.correctBlock).toBeLessThanOrEqual(c.policy.length);
    }
  });
});
