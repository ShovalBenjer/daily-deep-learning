// The spine's ordering engine: which unit the app proposes next.
//
// Written 2026-08-10, after running ROUTINE 1.3's own formula over the 328
// unbuilt units and finding it did not discriminate. Two defects, both silent:
//
//   1. goalPull() combined active goals with Math.max, so a unit serving two
//      deadlines scored the same as one serving the larger deadline alone. On
//      the real data the tighter deadline was not merely diluted, it was
//      erased: hire-2026-09-30 scored 0.137 and ai103-sit scored 0.136, so the
//      twenty AI-103 units ranked identically to units serving neither.
//   2. The top priority band held 76 units at one value, and estMin was the
//      only tiebreak, so the shortest unit in any module always won.
//
// Both tests below are run a second time against the PRE-FIX source, recovered
// by string-substitution on the lifted block, and asserted to FAIL there. A
// regression test that has never been shown to go red is not an oracle.
//
// Goal deadlines are synthesised at fixed offsets from now rather than read
// from goals.json, because urgency() reads the real clock: a test pinned to
// real deadlines passes today and rots silently in October.
import { test, expect } from 'bun:test';
import { readFileSync } from 'fs';

const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const SKILLS = JSON.parse(readFileSync(new URL('../skills.json', import.meta.url), 'utf8'));
const CURRICULUM = JSON.parse(readFileSync(new URL('../curriculum.json', import.meta.url), 'utf8'));

const OLD_GOAL_PULL = 'return gs.reduce((m, g) => Math.max(m, g.weight * urgency(g)), 0);';
const NEW_GOAL_PULL = 'return 1 - gs.reduce((acc, g) => acc * (1 - Math.min(1, g.weight * urgency(g))), 1);';
const NEW_SORT = '.sort((a, b) => b.p - a.p || inStarted(b.u) - inStarted(a.u) || a.u.estMin - b.u.estMin);';
const OLD_SORT = '.sort((a, b) => b.p - a.p || a.u.estMin - b.u.estMin);';

/** Lift the ordering block out of the one inline script and evaluate it. */
function loadSpine(S: any, curriculum: any, goalDefs: any, mutate?: (src: string) => string) {
  const start = HTML.indexOf('const MOSCOW_W');
  const end = HTML.indexOf('function treeOfNode');
  if (start < 0 || end < 0 || end < start)
    throw new Error('ordering block not found in index.html');
  let src = HTML.slice(start, end);
  if (mutate) {
    const before = src;
    src = mutate(src);
    if (src === before) throw new Error('pre-fix substitution matched nothing; the block moved');
  }
  return new Function('S', 'curriculum', 'goalDefs', 'skills',
    src + '\nreturn { goalPull, gapFactor, priority, rankedUnits, knownConcepts };')(
      S, curriculum, goalDefs, SKILLS);
}

const preFixGoalPull = (src: string) => src.replace(NEW_GOAL_PULL, OLD_GOAL_PULL);
const preFixSort = (src: string) => src.replace(NEW_SORT, OLD_SORT);

const inDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

// The measured 2026-08-10 configuration, held at fixed offsets so it cannot rot.
const GOALS = {
  goals: [
    { id: 'hire-2026-09-30', deadline: inDays(51), weight: 1.0, active: true },
    { id: 'ai103-sit', deadline: inDays(36), weight: 0.7, active: true },
    { id: 'msc-application', deadline: inDays(203), weight: 0.4, active: true },
  ],
};

const freshState = () => ({ unitState: {}, skillLevels: {}, known: [] as string[] });

const unit = (id: string, goals: string[], extra: any = {}) => ({
  id, title: id, moscow: 'must', estMin: 10, skills: ['sql'],
  goals, teaches: [], requires: [], ...extra,
});

/* ---------- defect 1: the tighter deadline was erased ---------- */

test('a unit serving two deadlines outranks one serving only the larger', () => {
  const S = freshState();
  const curriculum = {
    units: [
      unit('m5-both', ['hire-2026-09-30', 'ai103-sit']),
      unit('m2-hire-only', ['hire-2026-09-30']),
    ],
  };
  const { goalPull } = loadSpine(S, curriculum, GOALS);
  const both = goalPull(curriculum.units[0]);
  const one = goalPull(curriculum.units[1]);
  expect(both).toBeGreaterThan(one);
  expect(both).toBeLessThan(1);            // saturating, never runs away
});

test('the same case is a TIE under the pre-fix Math.max, which is the defect', () => {
  const S = freshState();
  const curriculum = {
    units: [
      unit('m5-both', ['hire-2026-09-30', 'ai103-sit']),
      unit('m2-hire-only', ['hire-2026-09-30']),
    ],
  };
  const { goalPull } = loadSpine(S, curriculum, GOALS, preFixGoalPull);
  // Not "close to" - byte-identical, because max() discarded ai103-sit whole.
  expect(goalPull(curriculum.units[0])).toBe(goalPull(curriculum.units[1]));
});

test('a unit with no active goal still scores zero, unchanged', () => {
  const S = freshState();
  const curriculum = { units: [unit('c1-orphan', [])] };
  const { goalPull, rankedUnits } = loadSpine(S, curriculum, GOALS);
  expect(goalPull(curriculum.units[0])).toBe(0);
  expect(rankedUnits()).toHaveLength(0);   // unreachable, and visibly so
});

/* ---------- defect 2: length was the only tiebreak ---------- */

test('a tie prefers the module already started, over a shorter unit elsewhere', () => {
  const S = freshState();
  (S.unitState as any)['m2-joins'] = { closed: '2026-08-01', skips: 0 };
  const curriculum = {
    units: [
      unit('m2-joins', ['hire-2026-09-30'], { estMin: 10 }),
      unit('m2-dedup', ['hire-2026-09-30'], { estMin: 25 }),   // same block, longer
      unit('m3-rate-limiter', ['hire-2026-09-30'], { estMin: 10 }), // cold block, shorter
    ],
  };
  const { rankedUnits } = loadSpine(S, curriculum, GOALS);
  const order = rankedUnits().map((x: any) => x.u.id);
  expect(order[0]).toBe('m2-dedup');
  expect(order).not.toContain('m2-joins');   // closed units are never proposed
});

test('the pre-fix sort takes the shorter cold-block unit, which is the defect', () => {
  const S = freshState();
  (S.unitState as any)['m2-joins'] = { closed: '2026-08-01', skips: 0 };
  const curriculum = {
    units: [
      unit('m2-joins', ['hire-2026-09-30'], { estMin: 10 }),
      unit('m2-dedup', ['hire-2026-09-30'], { estMin: 25 }),
      unit('m3-rate-limiter', ['hire-2026-09-30'], { estMin: 10 }),
    ],
  };
  const { rankedUnits } = loadSpine(S, curriculum, GOALS, preFixSort);
  expect(rankedUnits().map((x: any) => x.u.id)[0]).toBe('m3-rate-limiter');
});

test('length still breaks a tie inside one block', () => {
  const S = freshState();
  const curriculum = {
    units: [
      unit('m2-long', ['hire-2026-09-30'], { estMin: 45 }),
      unit('m2-short', ['hire-2026-09-30'], { estMin: 10 }),
    ],
  };
  const { rankedUnits } = loadSpine(S, curriculum, GOALS);
  expect(rankedUnits().map((x: any) => x.u.id)[0]).toBe('m2-short');
});

/* ---------- against the real curriculum ---------- */

test('the fix strictly increases discrimination over the real 355 units', () => {
  const distinct = (mutate?: (s: string) => string) => {
    const S = freshState();
    const { rankedUnits } = loadSpine(S, CURRICULUM, GOALS, mutate);
    return new Set(rankedUnits().map((x: any) => x.p.toFixed(6))).size;
  };
  expect(distinct()).toBeGreaterThan(distinct(preFixGoalPull));
});

test('the AI-103 block separates from the rest of the must-set', () => {
  const S = freshState();
  const { rankedUnits, goalPull } = loadSpine(S, CURRICULUM, GOALS);
  const ranked = rankedUnits();
  const ai = ranked.filter((x: any) => (x.u.goals || []).includes('ai103-sit'));
  const hireOnly = ranked.filter((x: any) =>
    (x.u.goals || []).includes('hire-2026-09-30') && !(x.u.goals || []).includes('ai103-sit'));
  expect(ai.length).toBeGreaterThan(0);
  expect(hireOnly.length).toBeGreaterThan(0);
  // Every AI-103 unit now pulls harder than every unit serving the hire goal alone.
  expect(Math.min(...ai.map((x: any) => goalPull(x.u))))
    .toBeGreaterThan(Math.max(...hireOnly.map((x: any) => goalPull(x.u))));
});

test('no must or should unit in the real curriculum is unreachable', () => {
  const active = new Set(GOALS.goals.filter(g => g.active).map(g => g.id));
  const stranded = CURRICULUM.units
    .filter((u: any) => (u.moscow === 'must' || u.moscow === 'should'))
    .filter((u: any) => !(u.goals || []).some((g: string) => active.has(g)))
    .map((u: any) => u.id);
  // 33 units carry no goal at all; all are could or wont, and that is a choice.
  // A must or should unit that can never be proposed is not.
  expect(stranded).toEqual([]);
});
