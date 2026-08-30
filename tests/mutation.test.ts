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
const SRC = readFileSync(new URL('../daemon/server.ts', import.meta.url), 'utf8');

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

// ------------------------------------------------- L4 mutation: daemon tools
//
// TESTING-SOTA-2026-GAPS.md section 6 item 2: get_mistakes and open_belief are
// the daemon's write surface for the mentor contract. get_mistakes recomputes
// the four-signal split server-side; open_belief records a confirmed misconception.
// Both had zero mutation coverage. Same shape as the deck and mentor layers:
// an oracle of behavioural invariants, planted defects that must all die, and
// a harmless control that must survive.

function getMistakesSource(): string {
  const toolStart = SRC.indexOf("tool('get_mistakes'");
  const toolEnd = SRC.indexOf("tool('open_belief'");
  if (toolStart < 0 || toolEnd < 0) throw new Error('get_mistakes tool not found in daemon/server.ts');
  const body = SRC.slice(toolStart, toolEnd);
  const start = body.indexOf('const today');
  const end = body.indexOf('const beliefs');
  if (start < 0 || end < 0) throw new Error('get_mistakes classify block not found');
  return body.slice(start, end)
    .replace(/: string\[\]/g, '')
    .replace(/<any>/g, '');
}

function classifyMistakes(src: string, st: any): string[] {
  return new Function('st', src + '\nreturn rows;')(st);
}

function getMistakesViolated(src: string): string | null {
  const now = new Date(Date.now() + 3 * 3600e3);
  const yesterday = new Date(now.getTime() - 864e5).toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 864e5).toISOString().slice(0, 10);
  try {
    let rows = classifyMistakes(src, {
      answers: { q1: { ok: false, conf: 70, attempts: 2, q: 'a', date: '2026-01-01', skill: 's' } },
      beliefs: {}, reviews: {}
    });
    if (!rows.some((r: string) => r.includes('WRONG+CERTAIN'))) return 'conf=70 not WRONG+CERTAIN';

    rows = classifyMistakes(src, {
      answers: { q1: { ok: false, conf: 69, attempts: 2, q: 'a', date: '2026-01-01', skill: 's' } },
      beliefs: {}, reviews: {}
    });
    if (!rows.some((r: string) => r.includes('WRONG+UNSURE'))) return 'conf=69 not WRONG+UNSURE';

    rows = classifyMistakes(src, {
      answers: { q1: { ok: true, conf: 40, attempts: 1, q: 'a', date: '2026-01-01', skill: 's' } },
      beliefs: {}, reviews: {}
    });
    if (!rows.some((r: string) => r.includes('RIGHT+UNSURE'))) return 'conf=40 first-try not RIGHT+UNSURE';

    rows = classifyMistakes(src, {
      answers: { q1: { ok: true, conf: 30, attempts: 2, q: 'a', date: '2026-01-01', skill: 's' } },
      beliefs: {}, reviews: {}
    });
    if (rows.some((r: string) => r.includes('RIGHT+UNSURE'))) return 'second attempt RIGHT+UNSURE';

    rows = classifyMistakes(src, {
      answers: {}, beliefs: {},
      reviews: { r1: { iv: 1, due: '2026-01-01', lapses: 2 } }
    });
    if (!rows.some((r: string) => r.includes('LEAKED'))) return 'lapses=2 not LEAKED';

    rows = classifyMistakes(src, {
      answers: {}, beliefs: {},
      reviews: { r1: { iv: 1, due: '2026-01-01', lapses: 1 } }
    });
    if (rows.some((r: string) => r.includes('LEAKED'))) return 'lapses=1 falsely LEAKED';

    rows = classifyMistakes(src, {
      answers: {}, reviews: {},
      beliefs: { b1: { status: 'corrected', retest: yesterday, believed: 'x', opened: '2026-01-01' } }
    });
    if (!rows.some((r: string) => r.includes('RETEST DUE'))) return 'past retest not due';

    rows = classifyMistakes(src, {
      answers: {}, reviews: {},
      beliefs: { b1: { status: 'corrected', retest: tomorrow, believed: 'x', opened: '2026-01-01' } }
    });
    if (rows.some((r: string) => r.includes('RETEST DUE'))) return 'future retest fired';

    rows = classifyMistakes(src, {
      answers: {}, reviews: {},
      beliefs: { b1: { status: 'open', retest: yesterday, believed: 'x', opened: '2026-01-01' } }
    });
    if (rows.some((r: string) => r.includes('RETEST DUE'))) return 'open belief fired retest';

    rows = classifyMistakes(src, { answers: { q1: null }, beliefs: {}, reviews: {} });

    rows = classifyMistakes(src, {
      answers: { q1: { ok: true, conf: 90, attempts: 1, q: 'a', date: '2026-01-01', skill: 's' } },
      beliefs: {}, reviews: {}
    });
    if (rows.length) return 'correct+confident produced a signal';

    rows = classifyMistakes(src, { answers: {}, beliefs: {}, reviews: {} });
    if (rows.length) return 'empty state produced rows';
  } catch (e) { return 'threw: ' + String(e).slice(0, 80); }
  return null;
}

const GET_MISTAKES_MUTANTS: Array<{ name: string; from: string; to: string }> = [
  { name: 'WRONG+CERTAIN boundary made exclusive',
    from: 'a.conf >= 70', to: 'a.conf > 70' },
  { name: 'RIGHT+UNSURE boundary made exclusive',
    from: 'a.conf <= 40', to: 'a.conf < 40' },
  { name: 'RIGHT+UNSURE first-try guard dropped',
    from: 'a.ok && a.attempts === 1 && a.conf != null && a.conf <= 40',
    to: 'a.ok && a.conf != null && a.conf <= 40' },
  { name: 'lapse floor raised to 3',
    from: '(r?.lapses || 0) >= 2', to: '(r?.lapses || 0) >= 3' },
  { name: 'retest date check inverted',
    from: 'b.retest <= today', to: 'b.retest >= today' },
  { name: 'retest status check dropped',
    from: "b.status === 'corrected' && b.retest && b.retest <= today",
    to: 'b.retest && b.retest <= today' },
  { name: 'null answer guard dropped',
    from: 'if (!a) continue;', to: '' },
  { name: 'WRONG+UNSURE swallows correct answers',
    from: 'else if (a.ok === false)', to: 'else if (true)' },
];

test('L4 mutation: the real get_mistakes source passes its own oracle', () => {
  expect(getMistakesViolated(getMistakesSource())).toBeNull();
});

test('L4 mutation: every planted get_mistakes defect is caught', () => {
  const src = getMistakesSource();
  const survivors: string[] = [];
  for (const m of GET_MISTAKES_MUTANTS) {
    expect(src.includes(m.from)).toBe(true);
    const mutated = src.replace(m.from, m.to);
    expect(mutated).not.toBe(src);
    if (!getMistakesViolated(mutated)) survivors.push(m.name);
  }
  expect(survivors).toEqual([]);
});

test('L4 mutation: the get_mistakes harness can actually fail (control)', () => {
  const src = getMistakesSource();
  const harmless = src.replace('const rows', 'const GET_MISTAKES_UNUSED = 0;\nconst rows');
  expect(harmless).not.toBe(src);
  expect(getMistakesViolated(harmless)).toBeNull();
});

// --- open_belief ---

function openBeliefSource(): string {
  const toolStart = SRC.indexOf("tool('open_belief'");
  const toolEnd = SRC.indexOf("tool('close_belief'");
  if (toolStart < 0 || toolEnd < 0) throw new Error('open_belief tool not found in daemon/server.ts');
  const body = SRC.slice(toolStart, toolEnd);
  const start = body.indexOf('st.beliefs = st.beliefs');
  const end = body.indexOf('st.ts =');
  if (start < 0 || end < 0) throw new Error('open_belief body not found');
  return body.slice(start, end);
}

function runOpenBelief(src: string, st: any, args: any): any {
  new Function('st', 'args', src)(st, args);
  return st.beliefs[args.id];
}

function openBeliefViolated(src: string): string | null {
  try {
    const st1: any = {};
    const b1 = runOpenBelief(src, st1, {
      id: 'test-1', believed: 'wrong thing', actual: 'right thing',
      from: ['q-1', 'q-2'], retestDays: 7
    });
    if (b1.status !== 'open') return 'new belief not open';
    if (b1.src !== 'mentor') return 'missing src:mentor';
    if (b1.believed !== 'wrong thing') return 'believed text wrong';
    if (!b1.from || b1.from.length !== 2) return 'from not stored';

    const long = 'x'.repeat(500);
    const st2: any = {};
    const b2 = runOpenBelief(src, st2, { id: 'test-2', believed: long, actual: long, from: [] });
    if (b2.believed.length > 400) return 'believed not truncated';
    if (b2.actual.length > 400) return 'actual not truncated';

    const st3: any = {};
    const b3 = runOpenBelief(src, st3, {
      id: 'test-3', believed: 'x', actual: 'y',
      from: ['a','b','c','d','e','f','g','h','i','j']
    });
    if (b3.from.length > 8) return 'from not capped at 8';

    const st4: any = {};
    const now = new Date(Date.now() + 3 * 3600e3);
    const expected7 = new Date(now.getTime() + 7 * 864e5).toISOString().slice(0, 10);
    runOpenBelief(src, st4, { id: 'test-4', believed: 'x', actual: 'y' });
    if (st4.beliefs['test-4'].retest !== expected7) return 'default retest not 7 days';

    const st5: any = {};
    runOpenBelief(src, st5, { id: 'test-5', believed: 'x', actual: 'y' });
    if (!Array.isArray(st5.beliefs['test-5'].from)) return 'from not defaulted to array';
    if (st5.beliefs['test-5'].from.length !== 0) return 'from default not empty';
  } catch (e) { return 'threw: ' + String(e).slice(0, 80); }
  return null;
}

const OPEN_BELIEF_MUTANTS: Array<{ name: string; from: string; to: string }> = [
  { name: 'believed not truncated',
    from: 'believed: String(args.believed).slice(0, 400)',
    to: 'believed: String(args.believed)' },
  { name: 'from always empty',
    from: 'from: Array.isArray(args.from) ? args.from.slice(0, 8) : []',
    to: 'from: []' },
  { name: 'default retest changed to 14 days',
    from: '(args.retestDays ?? 7)', to: '(args.retestDays ?? 14)' },
  { name: 'new belief stamped as corrected',
    from: "status: 'open'", to: "status: 'corrected'" },
  { name: 'src marker replaced',
    from: "src: 'mentor'", to: "src: 'system'" },
  { name: 'from array uncapped',
    from: 'args.from.slice(0, 8)', to: 'args.from' },
];

test('L4 mutation: the real open_belief source passes its own oracle', () => {
  expect(openBeliefViolated(openBeliefSource())).toBeNull();
});

test('L4 mutation: every planted open_belief defect is caught', () => {
  const src = openBeliefSource();
  const survivors: string[] = [];
  for (const m of OPEN_BELIEF_MUTANTS) {
    expect(src.includes(m.from)).toBe(true);
    const mutated = src.replace(m.from, m.to);
    expect(mutated).not.toBe(src);
    if (!openBeliefViolated(mutated)) survivors.push(m.name);
  }
  expect(survivors).toEqual([]);
});

test('L4 mutation: the open_belief harness can actually fail (control)', () => {
  const src = openBeliefSource();
  const harmless = src.replace('st.beliefs = st.beliefs',
    'const OPEN_BELIEF_UNUSED = 0;\nst.beliefs = st.beliefs');
  expect(harmless).not.toBe(src);
  expect(openBeliefViolated(harmless)).toBeNull();
});

// ----------------------------------------- L4 mutation: unit-ranking pipeline
//
// TESTING-SOTA-2026-GAPS.md section 6 item 2: the client-side scheduling
// algorithm (rankedUnits, priority, goalPull, gapFactor, skillGap, urgency)
// decides what the learner studies next. Pure computation, no DOM, zero
// mutation coverage until now. Same shape: behavioural oracle, planted
// defects that must all die, and a harmless control that must survive.

function rankingSource(): string {
  const start = HTML.indexOf('const MOSCOW_W = {');
  const end = HTML.indexOf('function treeOfNode');
  if (start < 0 || end < 0) throw new Error('ranking block not found in index.html');
  return HTML.slice(start, end);
}

function buildRanking(src: string, curriculum: any, goalDefs: any, skillsData: any, S: any) {
  return new Function('curriculum', 'goalDefs', 'skills', 'S',
    src + '\nreturn { rankedUnits, priority, knownConcepts, goalPull, gapFactor, skillGap };'
  )(curriculum, goalDefs, skillsData, S);
}

function rankingViolated(src: string): string | null {
  try {
    const skillsData = { skills: [{ id: 's1', current: 1, target: 5 }] };
    const goalDefs = { goals: [
      { id: 'g1', active: true, weight: 1 },
      { id: 'g-big', active: true, weight: 2 },
      { id: 'g-small', active: true, weight: 0.1 },
      { id: 'g-near', active: true, weight: 1,
        deadline: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10) },
      { id: 'g-far', active: true, weight: 1,
        deadline: new Date(Date.now() + 70 * 864e5).toISOString().slice(0, 10) },
    ] };
    const curriculum = { units: [
      { id: 'u-must', moscow: 'must', goals: ['g1'], skills: ['s1'],
        requires: [], teaches: ['concept-a'], estMin: 30 },
      { id: 'u-should', moscow: 'should', goals: ['g1'], skills: ['s1'],
        requires: [], teaches: [], estMin: 30 },
      { id: 'u-could', moscow: 'could', goals: ['g1'], skills: ['s1'],
        requires: [], teaches: [], estMin: 30 },
      { id: 'u-blocked', moscow: 'must', goals: ['g1'], skills: ['s1'],
        requires: ['concept-z'], teaches: [], estMin: 30 },
      { id: 'u-closed', moscow: 'must', goals: ['g1'], skills: ['s1'],
        requires: [], teaches: [], estMin: 30 },
      { id: 'u-cheap', moscow: 'must', goals: ['g1'], skills: ['s1'],
        requires: [], teaches: [], estMin: 10 },
      { id: 'u-expensive', moscow: 'must', goals: ['g1'], skills: ['s1'],
        requires: [], teaches: [], estMin: 60 },
      { id: 'u-noskills', moscow: 'must', goals: ['g1'],
        requires: [], teaches: [], estMin: 30 },
      { id: 'u-nogoals', moscow: 'must', skills: ['s1'],
        requires: [], teaches: [], estMin: 30 },
      { id: 'u-skipped', moscow: 'must', goals: ['g1'], skills: ['s1'],
        requires: [], teaches: [], estMin: 30 },
      { id: 'u-multi', moscow: 'must', goals: ['g-big', 'g-small'], skills: ['s1'],
        requires: [], teaches: [], estMin: 30 },
      { id: 'u-near', moscow: 'must', goals: ['g-near'], skills: ['s1'],
        requires: [], teaches: [], estMin: 30 },
      { id: 'u-far', moscow: 'must', goals: ['g-far'], skills: ['s1'],
        requires: [], teaches: [], estMin: 30 },
    ] };
    const S: any = {
      unitState: {
        'u-closed': { closed: '2026-01-01', skips: 0 },
        'u-skipped': { closed: null, skips: 2 },
      },
      skillLevels: {},
      known: [],
    };

    const mod = buildRanking(src, curriculum, goalDefs, skillsData, S);
    const ranked = mod.rankedUnits();

    if (ranked.some((x: any) => x.u.id === 'u-closed'))
      return 'closed unit in ranked list';

    if (ranked.some((x: any) => x.u.id === 'u-blocked'))
      return 'blocked unit in ranked list';

    const p = (id: string) => ranked.find((x: any) => x.u.id === id)?.p;

    const mustP = p('u-must'), shouldP = p('u-should'), couldP = p('u-could');
    if (!mustP || !shouldP || !couldP) return 'moscow units missing';
    if (mustP <= shouldP) return 'must not > should';
    if (shouldP <= couldP) return 'should not > could';

    const skippedP = p('u-skipped');
    if (!skippedP || skippedP >= mustP) return 'skip decay not working';

    if (ranked.some((x: any) => x.u.id === 'u-nogoals'))
      return 'goalless unit in ranked list';

    const noskillsP = p('u-noskills');
    if (!noskillsP || noskillsP <= 0) return 'no-skills unit dead';

    const cheapIdx = ranked.findIndex((x: any) => x.u.id === 'u-cheap');
    const expIdx = ranked.findIndex((x: any) => x.u.id === 'u-expensive');
    if (cheapIdx < 0 || expIdx < 0) return 'cheap/expensive missing';
    if (cheapIdx > expIdx) return 'tie not broken by cheapest estMin';

    const multiP = p('u-multi');
    const singleP = p('u-must');
    if (!multiP || !singleP || multiP <= singleP)
      return 'multi-goal unit not boosted by stronger goal';

    const nearP = p('u-near'), farP = p('u-far');
    if (!nearP || !farP || nearP <= farP)
      return 'closer deadline not higher urgency';

    const masteredSkills = { skills: [{ id: 's1', current: 5, target: 5 }] };
    const S2: any = { unitState: {}, skillLevels: {}, known: [] };
    const curric2 = { units: [
      { id: 'u-mastered', moscow: 'must', goals: ['g1'], skills: ['s1'],
        requires: [], teaches: [], estMin: 30 },
    ] };
    const mod2 = buildRanking(src, curric2, goalDefs, masteredSkills, S2);
    if (mod2.rankedUnits().some((x: any) => x.u.id === 'u-mastered'))
      return 'mastered skill still has priority';

  } catch (e) { return 'threw: ' + String(e as Error).message?.slice(0, 80); }
  return null;
}

const RANKING_MUTANTS: Array<{ name: string; from: string; to: string }> = [
  { name: 'closed unit not excluded',
    from: 'if (uState(u.id).closed) return -1;',
    to: '' },
  { name: 'MOSCOW should weight equals must',
    from: 'should: 0.45', to: 'should: 1' },
  { name: 'skip decay inverted (skipping boosts)',
    from: 'Math.pow(0.6,', to: 'Math.pow(1.4,' },
  { name: 'goal pull takes min instead of max',
    from: 'Math.max(m, g.weight', to: 'Math.min(m, g.weight' },
  { name: 'skill gap inverted (mastered ranks highest)',
    from: '(row ? row.target : 5) - cur',
    to: 'cur - (row ? row.target : 5)' },
  { name: 'available gate ignored (prereqs not enforced)',
    from: '(available(u, known) ? 1 : 0)', to: '1' },
  { name: 'no-deadline urgency dropped to zero',
    from: ') : 0.6', to: ') : 0' },
  { name: 'gap factor default zeroed (no-skills units die)',
    from: 'return 0.5;', to: 'return 0;' },
];

test('L4 mutation: the real ranking source passes its own oracle', () => {
  expect(rankingViolated(rankingSource())).toBeNull();
});

test('L4 mutation: every planted ranking defect is caught', () => {
  const src = rankingSource();
  const survivors: string[] = [];
  for (const m of RANKING_MUTANTS) {
    expect(src.includes(m.from)).toBe(true);
    const mutated = src.replace(m.from, m.to);
    expect(mutated).not.toBe(src);
    if (!rankingViolated(mutated)) survivors.push(m.name);
  }
  expect(survivors).toEqual([]);
});

test('L4 mutation: the ranking harness can actually fail (control)', () => {
  const src = rankingSource();
  const harmless = src.replace('const MOSCOW_W', 'const RANKING_UNUSED = 0;\nconst MOSCOW_W');
  expect(harmless).not.toBe(src);
  expect(rankingViolated(harmless)).toBeNull();
});

// -------------------------------------------------- L4 mutation: gradeReview
//
// The SRS interval-stepping logic decides when recall cards come back.
// Wrong demotes interval by 1, increments lapses, due tomorrow.
// Confident correct (first try, conf >= 50 or null) promotes interval.
// Shaky correct (multi-attempt or low conf) repeats the same interval.

function gradeReviewSource(): string {
  const start = HTML.indexOf('function gradeReview(id, r)');
  const end = HTML.indexOf('async function openReview');
  if (start < 0 || end < 0) throw new Error('gradeReview not found in index.html');
  return HTML.slice(start, end);
}

function runGrade(src: string, reviews: any, id: string, result: any): any {
  const REV_IV = [1, 3, 7, 21, 60];
  const isoFn = (d: Date) => d.toISOString().slice(0, 10);
  const plusDaysFn = (ds: string, n: number) => {
    const t = new Date(ds + 'T12:00:00'); t.setDate(t.getDate() + n); return isoFn(t);
  };
  const S = { reviews: JSON.parse(JSON.stringify(reviews)) };
  new Function('S', 'iso', 'plusDays', 'REV_IV', 'store',
    src + '\ngradeReview("' + id + '", arguments[5]);'
  )(S, isoFn, plusDaysFn, REV_IV, { save() {} }, result);
  return S.reviews[id];
}

function gradeReviewViolated(src: string): string | null {
  const isoFn = (d: Date) => d.toISOString().slice(0, 10);
  const plusDaysFn = (ds: string, n: number) => {
    const t = new Date(ds + 'T12:00:00'); t.setDate(t.getDate() + n); return isoFn(t);
  };
  const today = isoFn(new Date());
  try {
    let rec = runGrade(src, { q1: { iv: 2, due: today, lapses: 0 } },
      'q1', { ok: false, attempts: 2, conf: 30 });
    if (rec.iv !== 1) return 'wrong: interval not demoted';
    if (rec.lapses !== 1) return 'wrong: lapses not incremented';
    if (rec.due !== plusDaysFn(today, 1)) return 'wrong: not due tomorrow';

    rec = runGrade(src, { q1: { iv: 0, due: today, lapses: 0 } },
      'q1', { ok: false, attempts: 1, conf: 50 });
    if (rec.iv !== 0) return 'wrong at floor: went below 0';

    rec = runGrade(src, { q1: { iv: 1, due: today, lapses: 0 } },
      'q1', { ok: true, attempts: 1, conf: 70 });
    if (rec.iv !== 2) return 'confident correct: not promoted';
    if (rec.due !== plusDaysFn(today, 7)) return 'confident correct: wrong due (expected REV_IV[2]=7)';

    rec = runGrade(src, { q1: { iv: 1, due: today, lapses: 0 } },
      'q1', { ok: true, attempts: 1 });
    if (rec.iv !== 2) return 'null confidence not treated as promotion';

    rec = runGrade(src, { q1: { iv: 1, due: today, lapses: 0 } },
      'q1', { ok: true, attempts: 1, conf: 49 });
    if (rec.iv !== 1) return 'low confidence promoted';
    if (rec.due !== plusDaysFn(today, 3)) return 'shaky: wrong due (expected REV_IV[1]=3)';

    rec = runGrade(src, { q1: { iv: 1, due: today, lapses: 0 } },
      'q1', { ok: true, attempts: 2, conf: 90 });
    if (rec.iv !== 1) return 'multi-attempt promoted';

    rec = runGrade(src, { q1: { iv: 4, due: today, lapses: 0 } },
      'q1', { ok: true, attempts: 1, conf: 70 });
    if (rec.iv !== 4) return 'IV exceeded cap';
    if (rec.due !== plusDaysFn(today, 60)) return 'capped: wrong due (expected REV_IV[4]=60)';

    rec = runGrade(src, { q1: { iv: 1, due: today, lapses: 0 } },
      'q1', { ok: true, attempts: 1, conf: 70 });
    if (rec.last !== today) return 'last not set to today';

  } catch (e) { return 'threw: ' + String(e).slice(0, 80); }
  return null;
}

const GRADE_REVIEW_MUTANTS: Array<{ name: string; from: string; to: string }> = [
  { name: 'wrong does not demote interval',
    from: 'rec.iv = Math.max(0, rec.iv - 1)',
    to: 'rec.iv = rec.iv' },
  { name: 'wrong does not increment lapses',
    from: 'rec.lapses = (rec.lapses || 0) + 1',
    to: 'rec.lapses = (rec.lapses || 0)' },
  { name: 'confident correct does not promote',
    from: 'rec.iv = Math.min(REV_IV.length - 1, rec.iv + 1)',
    to: 'rec.iv = rec.iv' },
  { name: 'confidence threshold raised to 80',
    from: 'r.conf >= 50', to: 'r.conf >= 80' },
  { name: 'multi-attempt counts as confident',
    from: 'r.attempts === 1 && (r.conf',
    to: '(r.conf' },
  { name: 'IV cap removed (overflows interval array)',
    from: 'Math.min(REV_IV.length - 1, rec.iv + 1)',
    to: 'rec.iv + 1' },
];

test('L4 mutation: the real gradeReview source passes its own oracle', () => {
  expect(gradeReviewViolated(gradeReviewSource())).toBeNull();
});

test('L4 mutation: every planted gradeReview defect is caught', () => {
  const src = gradeReviewSource();
  const survivors: string[] = [];
  for (const m of GRADE_REVIEW_MUTANTS) {
    expect(src.includes(m.from)).toBe(true);
    const mutated = src.replace(m.from, m.to);
    expect(mutated).not.toBe(src);
    if (!gradeReviewViolated(mutated)) survivors.push(m.name);
  }
  expect(survivors).toEqual([]);
});

test('L4 mutation: the gradeReview harness can actually fail (control)', () => {
  const src = gradeReviewSource();
  const harmless = src.replace('function gradeReview',
    'const GRADE_UNUSED = 0;\nfunction gradeReview');
  expect(harmless).not.toBe(src);
  expect(gradeReviewViolated(harmless)).toBeNull();
});
