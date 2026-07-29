// L4 mutation and L2 property, per SOTA-TESTING-CRITERIA-2026 section 1.
//
// WHY THIS EXISTS: tests/decks.test.ts and tests/mentor.test.ts are L1 example
// tests. Nothing in this repo measured whether they can fail, so "30 pass" was
// evidence of nothing. This file damages the source on purpose and requires the
// invariants to notice. A mutant that survives is a hole in the suite, named.
//
// No fast-check and no Stryker: "no npm at the root" is a stated non-goal of
// this repo (CLAUDE.md), so the generator and the mutation runner are written
// here. Generation is seeded, so a failure reproduces from its printed seed
// rather than being a flake.
import { test, expect } from 'bun:test';
import { readFileSync } from 'fs';

const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function deckSource(): string {
  const start = HTML.indexOf('const DECK_PER_DAY');
  const end = HTML.indexOf('const dueReviews');
  if (start < 0 || end < 0) throw new Error('deck block not found in index.html');
  return HTML.slice(start, end);
}

function build(src: string, S: any, kodex: any) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const plusDays = (d: string, n: number) =>
    new Date(new Date(d + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
  return new Function('S', 'kodex', 'iso', 'plusDays', 'store', 'idToPostDate',
    src + '\nreturn { seedReviews, deckCounts, openDeck, deckOn, DECK_PER_DAY };')(
      S, kodex, iso, plusDays, { save() {} }, () => null);
}

// ---------------------------------------------------------------- L2 property

/** Deterministic PRNG so a failing case is reproducible from its seed. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function genConcepts(rand: () => number) {
  const n = Math.floor(rand() * 120);
  return Array.from({ length: n }, (_, i) => {
    const tagged = rand() < 0.6;
    return {
      id: `g${i}`, t: `T${i}`,
      d: rand() < 0.9 ? `def ${i}` : undefined,        // some have no definition
      ...(tagged ? { deck: rand() < 0.5 ? 'corporate' : 'other' } : {})
    };
  });
}

const today = () => new Date().toISOString().slice(0, 10);

//: The per-day budget read ONCE from the unmutated source. Invariant 4 must
//: compare against this and never against the constant inside the code under
//: test: an oracle that reads its own expectation out of the subject asserts
//: nothing, and the "budget raised to 1000" mutant survived until this existed.
const BASE_PER_DAY: number = (() => {
  const m = /const DECK_PER_DAY = (\d+);/.exec(deckSource());
  if (!m) throw new Error('DECK_PER_DAY not found');
  return Number(m[1]);
})();

/**
 * The invariants that must hold for ANY concept set and ANY deck state.
 * Returns the name of the first violated invariant, or null. Used both as the
 * property test and as the oracle the mutation runner kills mutants with.
 */
function violated(src: string, seed: number): string | null {
  const rand = rng(seed);
  const concepts = genConcepts(rand);
  const openCorporate = rand() < 0.5;
  const S: any = { answers: {}, reviews: {}, decks: {} };

  // Some cards are already part-way through the recall schedule. Seeding must
  // never touch them: resetting a card that reached interval 4 back to 0 throws
  // away weeks of retrieval history, and that is what the already-scheduled
  // guard exists to prevent. Without this state in the fixture, dropping the
  // guard looked harmless.
  // Only core cards carry prior progress here. A card can only have progress if
  // it was scheduled at some point, and a closed deck's cards never were, so
  // injecting progress onto them would be an impossible state that makes the
  // closed-deck invariant fire against the real source.
  const prior: Record<string, any> = {};
  for (const c of concepts as any[]) {
    if (c.deck || !c.d || rand() > 0.25) continue;
    prior[`c-${c.id}`] = { iv: 4, due: '2026-12-31', lapses: 2 };
  }
  Object.assign(S.reviews, JSON.parse(JSON.stringify(prior)));

  let mod;
  try {
    mod = build(src, S, { concepts });
    if (openCorporate) mod.openDeck('corporate');
    mod.seedReviews();
  } catch (e) {
    return 'threw: ' + String(e).slice(0, 60);
  }

  const scheduled = Object.keys(S.reviews);
  const byId = new Map(concepts.map(c => [`c-${c.id}`, c]));

  // 1. Nothing without a definition is ever scheduled.
  for (const k of scheduled) if (!byId.get(k)?.d) return 'scheduled a concept with no definition';

  // 2. A concept from a deck that is not open is never scheduled.
  for (const k of scheduled) {
    const c: any = byId.get(k);
    if (c?.deck && !(S.decks[c.deck] && S.decks[c.deck].on))
      return `scheduled ${c.deck} while that deck is closed`;
  }

  // 3. Every core (deck-less) concept with a definition IS scheduled, and today,
  //    unless it already had a schedule of its own.
  for (const c of concepts as any[]) {
    if (c.deck || !c.d) continue;
    const k = `c-${c.id}`;
    if (!S.reviews[k]) return 'a core concept was not scheduled';
    if (!prior[k] && S.reviews[k].due !== today()) return 'a core concept was not due today';
  }

  // 3b. Existing retrieval progress is never rewritten.
  for (const [k, rec] of Object.entries(prior)) {
    if (JSON.stringify(S.reviews[k]) !== JSON.stringify(rec))
      return `existing review progress for ${k} was overwritten`;
  }

  // 4. THE FLOOD BOUND. However many cards a deck holds, at most DECK_PER_DAY
  //    of them may come due on any single day.
  const perDay: Record<string, number> = {};
  for (const k of scheduled) {
    const c: any = byId.get(k);
    if (!c?.deck) continue;
    if (prior[k]) continue;                       // pre-existing, not this seeding
    const d = S.reviews[k].due;
    perDay[d] = (perDay[d] || 0) + 1;
    if (perDay[d] > BASE_PER_DAY) return `${perDay[d]} deck cards due on ${d}`;
  }

  // 5. Idempotence: seeding again changes nothing.
  const before = JSON.stringify(S.reviews);
  mod.seedReviews();
  if (JSON.stringify(S.reviews) !== before) return 'seedReviews is not idempotent';

  return null;
}

test('L2 property: invariants hold over 300 generated concept sets', () => {
  const failures: string[] = [];
  for (let seed = 1; seed <= 300; seed++) {
    const v = violated(deckSource(), seed);
    if (v) failures.push(`seed ${seed}: ${v}`);
  }
  expect(failures.slice(0, 5)).toEqual([]);
});

// ---------------------------------------------------------------- L4 mutation

/** Each mutant is a real defect someone could plausibly introduce. */
const MUTANTS: Array<{ name: string; from: string; to: string }> = [
  { name: 'deck gate removed (the flood)', from: 'if (!deckOn(c.deck)) return;', to: '' },
  { name: 'core and deck handling swapped', from: 'if (!c.deck) {', to: 'if (c.deck) {' },
  { name: 'stagger flattened to day zero', from: 'Math.floor(n / DECK_PER_DAY)', to: '0' },
  { name: 'per-day budget raised to 1000', from: 'const DECK_PER_DAY = 8;', to: 'const DECK_PER_DAY = 1000;' },
  { name: 'already-scheduled guard dropped', from: "|| S.reviews['c-' + c.id]", to: '' },
  { name: 'definition guard dropped', from: '!c.id || !c.d', to: '!c.id' },
  { name: 'stage counter never advances', from: 'staged[c.deck]++;', to: '' },
  { name: 'deckOn always true', from: 'return !!(S.decks && S.decks[id] && S.decks[id].on);', to: 'return true;' },
];

test('L4 mutation: every planted defect is caught by the invariants', () => {
  const src = deckSource();
  const survivors: string[] = [];
  for (const m of MUTANTS) {
    expect(src.includes(m.from)).toBe(true);          // the mutation still applies
    const mutated = src.replace(m.from, m.to);
    expect(mutated).not.toBe(src);
    let killed = false;
    for (let seed = 1; seed <= 60 && !killed; seed++) {
      if (violated(mutated, seed)) killed = true;
    }
    if (!killed) survivors.push(m.name);
  }
  // A survivor is a hole in the suite. Naming it is the point of the layer.
  expect(survivors).toEqual([]);
});

test('L4 mutation: the harness can actually fail (control)', () => {
  // Guards against a mutation runner that reports 100 percent because its
  // oracle never returns anything. A deliberately harmless edit must survive.
  const src = deckSource();
  const harmless = src.replace('const DECK_NAMES', 'const DECK_NAMES_UNUSED_ALIAS = 0; const DECK_NAMES');
  expect(harmless).not.toBe(src);
  let anyViolation = false;
  for (let seed = 1; seed <= 60; seed++) if (violated(harmless, seed)) anyViolation = true;
  expect(anyViolation).toBe(false);
});
