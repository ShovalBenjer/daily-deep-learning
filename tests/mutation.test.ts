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

// ------------------------------------------------------- L4 mutation: mentor
//
// TESTING-SOTA-2026-GAPS.md section 6 item 3: mentorQueue decides what the
// learner is told about their own mistakes and had no mutation coverage, so
// nothing measured whether tests/mentor.test.ts could fail. Same shape as the
// deck layer: an oracle of behavioural invariants, planted defects that must
// all die against it, and a harmless control that must survive.

function mentorSource(): string {
  const start = HTML.indexOf('const MENTOR = {');
  const end = HTML.indexOf('function renderMentor');
  if (start < 0 || end < 0) throw new Error('mentor block not found in index.html');
  return HTML.slice(start, end);
}

const mDay = (offset: number) =>
  new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

/**
 * The mentor invariants, each one a case tests/mentor.test.ts proved against
 * the real source. Returns the first violated invariant's name, or null.
 */
function mentorViolated(src: string): string | null {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const load = (partial: any, kodex: any = null) => {
    // Real state always carries the three maps; only the deliberate
    // empty-object case below passes bare {} the way the app's first boot does.
    const S = Object.keys(partial).length
      ? { answers: {}, reviews: {}, beliefs: {}, ...partial } : partial;
    try {
      return new Function('S', 'kodex', 'iso',
        src + '\nreturn { mentorQueue };')(S, kodex, iso).mentorQueue();
    } catch (e) { throw new Error('threw: ' + String(e).slice(0, 60)); }
  };
  try {
    // The four-signal split, at and around both boundaries.
    let q = load({ answers: {
      'at-70': { ok: false, attempts: 2, conf: 70, q: 'a', date: '2026-07-20' },
      'at-69': { ok: false, attempts: 2, conf: 69, q: 'b', date: '2026-07-20' },
      'at-40': { ok: true, attempts: 1, conf: 40, q: 'c', date: '2026-07-20' },
      'at-41': { ok: true, attempts: 1, conf: 41, q: 'd', date: '2026-07-20' },
      'scraped': { ok: true, attempts: 2, conf: 20, q: 'e', date: '2026-07-20' },
      'legacy': { ok: false, attempts: 2, q: 'f', date: '2026-07-20' },
    } });
    const by = Object.fromEntries(q.map((x: any) => [x.id, x.kind]));
    if (by['at-70'] !== 'misconception') return 'certain at 70 is not a misconception';
    if (by['at-69'] !== 'gap') return 'unsure at 69 is not a gap';
    if (by['at-40'] !== 'imposter') return 'first-try right at 40 is not imposter';
    if (by['at-41'] !== undefined) return 'right and confident produced a row';
    if (by['scraped'] !== undefined) return 'a second-attempt pass produced a row';
    if (by['legacy'] !== 'gap') return 'a missing confidence counted as certain';

    // Decay fires at the lapse floor, not below it.
    q = load({ reviews: { leaky: { iv: 1, due: '2026-07-20', lapses: 2 },
                          fine: { iv: 3, due: '2026-07-20', lapses: 1 } } });
    const decays = q.filter((x: any) => x.kind === 'decay').map((x: any) => x.id);
    if (decays.join(',') !== 'leaky') return 'lapse floor is wrong: ' + decays.join(',');

    // A due retest exists, outranks a fresh misconception, and survives its
    // own belief being settled (settling suppresses the answer, never the
    // retest the settlement scheduled).
    q = load({ answers: { miss: { ok: false, attempts: 2, conf: 90, q: 'n', date: mDay(0) } },
               beliefs: { 'isolation-serial': { believed: 'x', actual: 'y', opened: mDay(-7),
                                                status: 'corrected', retest: mDay(-1) } } });
    if (!q.length || q[0].kind !== 'retest') return 'a due retest is not first';
    if (!q.find((x: any) => x.kind === 'misconception')) return 'the misconception vanished';

    // A retest that is not due yet stays out.
    q = load({ beliefs: { later: { believed: 'x', actual: 'y', opened: mDay(0),
                                   status: 'corrected', retest: mDay(3) } } });
    if (q.length) return 'a not-yet-due retest entered the queue';

    // Suppression matches the answers named in `from`, and nothing else.
    q = load({ answers: { 'u-m3-tx-q2': { ok: false, attempts: 2, conf: 88, q: 'i', date: mDay(-2) },
                          'unrelated': { ok: false, attempts: 2, conf: 88, q: 'j', date: mDay(-2) } },
               beliefs: { 'isolation-serial': { believed: 'x', actual: 'y', opened: mDay(-1),
                                                status: 'corrected', retest: mDay(5),
                                                from: ['u-m3-tx-q2'] } } });
    const ids = q.map((x: any) => x.id);
    if (ids.includes('u-m3-tx-q2')) return 'a worked-through answer resurfaced';
    if (!ids.includes('unrelated')) return 'suppression swallowed an unrelated answer';

    // An open belief suppresses nothing: only corrected or retested settle.
    q = load({ answers: { 'u-m3-tx-q2': { ok: false, attempts: 2, conf: 88, q: 'i', date: mDay(-2) } },
               beliefs: { 'isolation-serial': { believed: 'x', actual: 'y', opened: mDay(-1),
                                                status: 'open', retest: mDay(5),
                                                from: ['u-m3-tx-q2'] } } });
    if (!q.find((x: any) => x.id === 'u-m3-tx-q2')) return 'an open belief already suppressed';

    // Empty state is an empty queue, not a throw.
    if (load({}).length) return 'empty state produced rows';
  } catch (e) { return String((e as Error).message); }
  return null;
}

/** Each mentor mutant is a defect someone could plausibly introduce. */
const MENTOR_MUTANTS: Array<{ name: string; from: string; to: string }> = [
  { name: 'certainty boundary made exclusive',
    from: 'a.conf >= MENTOR.sure', to: 'a.conf > MENTOR.sure' },
  { name: 'certainty threshold drifted to 95',
    from: 'const MENTOR = { sure: 70,', to: 'const MENTOR = { sure: 95,' },
  { name: 'imposter requires no first-try',
    from: 'a.ok && a.attempts === 1 &&', to: 'a.ok &&' },
  { name: 'suppression keyed on the belief id alone (the shipped regression)',
    from: 'for (const src of [].concat(b.from || [], k)) settled.add(src);',
    to: 'settled.add(k);' },
  { name: 'open beliefs settle too',
    from: "if (!b || (b.status !== 'corrected' && b.status !== 'retested')) continue;",
    to: 'if (!b) continue;' },
  { name: 'retest due gate dropped',
    from: "if (b.status === 'corrected' && b.retest && b.retest <= today)",
    to: "if (b.status === 'corrected' && b.retest)" },
  { name: 'a settled belief suppresses its own retest',
    from: "x.kind === 'retest' || !settled.has(x.id)", to: '!settled.has(x.id)' },
  { name: 'priority order inverted',
    from: 'MENTOR_KINDS[a.kind].w - MENTOR_KINDS[b.kind].w',
    to: 'MENTOR_KINDS[b.kind].w - MENTOR_KINDS[a.kind].w' },
  { name: 'lapse floor dropped to any lapse',
    from: '>= MENTOR.lapseFloor', to: '>= 1' },
];

test('L4 mutation: the real mentor source passes its own oracle', () => {
  expect(mentorViolated(mentorSource())).toBeNull();
});

test('L4 mutation: every planted mentor defect is caught', () => {
  const src = mentorSource();
  const survivors: string[] = [];
  for (const m of MENTOR_MUTANTS) {
    expect(src.includes(m.from)).toBe(true);          // the mutation still applies
    const mutated = src.replace(m.from, m.to);
    expect(mutated).not.toBe(src);
    if (!mentorViolated(mutated)) survivors.push(m.name);
  }
  expect(survivors).toEqual([]);
});

test('L4 mutation: the mentor harness can actually fail (control)', () => {
  const src = mentorSource();
  const harmless = src.replace('function mentorQueue()',
    'const MENTOR_UNUSED_ALIAS = 0;\nfunction mentorQueue()');
  expect(harmless).not.toBe(src);
  expect(mentorViolated(harmless)).toBeNull();
});
