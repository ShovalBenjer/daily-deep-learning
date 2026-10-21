/**
 * economy.ts behavioral tests: help-graded rewards and the shift bank.
 * Module state is shared, so every test uses a fresh lamp id and asserts
 * on deltas, never on absolutes.
 */
import { describe, test, expect } from 'bun:test';
import { review, endShift, embers } from '../src/economy';

const NOW = new Date('2026-10-21T08:00:00Z');

describe('help-graded rewards', () => {
  test("a clean pass banks more stability than a pass that needed a reveal", () => {
    const clean = review('econ-clean', 'none', NOW);
    const revealed = review('econ-reveal', 'reveal', NOW);
    expect(clean).toBeGreaterThan(0);
    expect(revealed).toBeGreaterThan(0);
    expect(clean).toBeGreaterThan(revealed);
  });

  test('re-passing a bright lamp is practice, not income (anti-farming)', () => {
    const first = review('econ-farm', 'none', NOW);
    expect(first).toBeGreaterThan(0);
    const second = review('econ-farm', 'none', NOW);
    expect(second).toBe(0);
  });
});

describe('the shift bank', () => {
  test('endShift moves the gain into embers exactly once', () => {
    const before = embers();
    const gained = review('econ-shift', 'none', NOW);
    expect(gained).toBeGreaterThan(0);
    const banked = endShift();
    expect(banked).toBeGreaterThanOrEqual(0);
    expect(embers() - before).toBe(banked);
    const again = endShift();
    expect(again).toBe(0);
    expect(embers() - before).toBe(banked);
  });
});
