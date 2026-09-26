// L1 + L2 tests for the ember-economy game (game/src/economy.ts) and the SQL
// district drill content (game/src/drills.ts).
//
// WHY THIS EXISTS: the economy is where the ENGINE research's rules live in
// code (anti-farming, embers as durable memory, the lamplighter as earned
// automation). Those rules are easy to regress, and a regression pays out free
// embers or mints stability through repeated passes. These tests pin the
// invariants so a bad edit is caught here, not by the learner.
//
// economy.ts touches localStorage at module load, so the global mock below is
// installed once; each economy test then imports a fresh, cache-busted module
// over a cleared store so state never leaks between cases.
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => { mem.set(k, v); },
  removeItem: (k: string) => { mem.delete(k); },
  clear: () => mem.clear(),
};

import { test, expect } from 'bun:test';
import { DUE_RETENTION } from '../game/src/economy.ts';
import * as drills from '../game/src/drills.ts';

const ECO_PATH = '../game/src/economy.ts';
let seq = 0;
async function freshEco() {
  mem.clear();
  return await import(ECO_PATH + '?v=' + seq++);
}

test('DUE_RETENTION marks the not-due threshold', () => {
  expect(DUE_RETENTION).toBe(0.9);
});

test('a fresh lamp review earns stability-days', async () => {
  const eco = await freshEco();
  const gained = eco.review('l1', 'none', new Date());
  expect(gained).toBeGreaterThan(0);
});

test('anti-farming: re-passing a bright lamp earns nothing', async () => {
  const eco = await freshEco();
  const now = new Date();
  const first = eco.review('l1', 'none', now);
  expect(first).toBeGreaterThan(0);
  // same lamp, same instant: it is not due, so practice is free
  expect(eco.review('l1', 'none', now)).toBe(0);
});

test('a failed run earns no embers', async () => {
  const eco = await freshEco();
  expect(eco.review('l1', 'fail', new Date())).toBe(0);
});

test('embers accrue and carry the fractional remainder', async () => {
  const eco = await freshEco();
  for (let i = 0; i < 8; i++) eco.review('lamp' + i, 'none', new Date());
  const pending = eco.shiftGain();
  expect(pending).toBeGreaterThan(0);
  const banked = eco.endShift();
  expect(banked).toBe(Math.floor(pending));
  expect(eco.embers()).toBe(banked);
  expect(eco.shiftGain()).toBeCloseTo(pending - banked, 5);
});

test('buying the lamplighter requires and deducts embers', async () => {
  const eco = await freshEco();
  expect(eco.buyLamplighter()).toBe(false);
  for (let i = 0; i < 40; i++) eco.review('l' + i, 'none', new Date());
  eco.endShift();
  expect(eco.embers()).toBeGreaterThanOrEqual(eco.LAMPLIGHTER_PRICE);
  const before = eco.embers();
  expect(eco.buyLamplighter()).toBe(true);
  expect(eco.hasLamplighter()).toBe(true);
  expect(eco.embers()).toBe(before - eco.LAMPLIGHTER_PRICE);
});

test('the lamplighter refreshes exactly once per real day', async () => {
  const eco = await freshEco();
  for (let i = 0; i < 40; i++) eco.review('l' + i, 'none', new Date());
  eco.endShift();
  eco.buyLamplighter();
  const now = new Date();
  expect(eco.lamplighterRound(now)).not.toBeNull();
  expect(eco.lamplighterRound(now)).toBeNull();
});

test('retrievability: known lamp returns a number, unknown returns null', async () => {
  const eco = await freshEco();
  expect(eco.retrievability('nope')).toBeNull();
  eco.review('l1', 'none', new Date());
  const r = eco.retrievability('l1');
  expect(typeof r).toBe('number');
  expect(r!).toBeGreaterThan(0);
});

test('load() drops corrupt stored cards instead of throwing', async () => {
  mem.clear();
  mem.set('lamps-economy', JSON.stringify({
    cards: { bad: { stability: 'x', difficulty: 1 } },
    embers: 7,
  }));
  const eco = await import(ECO_PATH + '?v=' + seq++);
  expect(eco.embers()).toBe(7);
  expect(eco.retrievability('bad')).toBeNull();
  // a real card produced by the engine is still retrievable after the load
  eco.review('l1', 'none', new Date());
  expect(typeof eco.retrievability('l1')).toBe('number');
});

test('drills mix sql and case kinds', () => {
  expect(drills.drills.length).toBeGreaterThan(0);
  const kinds = new Set(drills.drills.map(d => d.kind));
  expect(kinds.has('sql')).toBe(true);
  expect(kinds.has('case')).toBe(true);
});

test('schema note names both tables', () => {
  expect(drills.schemaNote).toContain('merchants');
  expect(drills.schemaNote).toContain('transactions');
});

test('approval-rate holes detect a correct solution', () => {
  const d = drills.drills.find(x => x.id === 'approval-rate') as any;
  const good = "SELECT m.name, COUNT(*) AS num_txn, AVG(CASE WHEN t.status = 'approved' THEN 1.0 ELSE 0 END) AS approval_rate " +
    "FROM transactions t JOIN merchants m ON m.merchant_id = t.merchant_id " +
    "WHERE t.txn_ts >= '2026-07-01' AND t.txn_ts < '2026-08-01' GROUP BY m.name HAVING COUNT(*) >= 50 ORDER BY approval_rate";
  for (const h of d.holes) expect(h.check(good)).toBe(true);
});

test('case drill identifies the correct verdict and block', () => {
  const d = drills.drills.find(x => x.kind === 'case') as any;
  expect(d.correctVerdict).toBe('REJECT');
  expect(d.correctBlock).toBe(2);
  expect(d.verdicts).toContain(d.correctVerdict);
});
