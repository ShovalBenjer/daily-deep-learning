// המנטור queue: the four-signal split, tested against the real source.
//
// src/app.js has no module boundary, so the honest choice is to lift the block
// out of the file and evaluate it. A hand-copied version here would pass forever
// after the app drifted away from it. If the block is renamed or moved,
// loadMentor throws rather than silently testing nothing.
import { test, expect } from 'bun:test';
import { readFileSync } from 'fs';

function loadMentor(S: any, kodex: any) {
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  const start = app.indexOf('const MENTOR = {');
  const end = app.indexOf('function renderMentor');
  if (start < 0 || end < 0 || end < start)
    throw new Error('mentor block not found in src/app.js');
  const src = app.slice(start, end);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return new Function('S', 'kodex', 'iso',
    src + '\nreturn { mentorQueue, mentorLabel, MENTOR_KINDS };')(S, kodex, iso);
}

const blank = () => ({ answers: {}, reviews: {}, beliefs: {} });
const day = (offset: number) =>
  new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

test('wrong and certain is a misconception, wrong and unsure is a gap', () => {
  const S = blank();
  S.answers['q-sure'] = { ok: false, attempts: 2, conf: 85, q: 'isolation', date: '2026-07-20' };
  S.answers['q-unsure'] = { ok: false, attempts: 2, conf: 20, q: 'durability', date: '2026-07-20' };
  const { mentorQueue } = loadMentor(S, null);
  const q = mentorQueue();
  expect(q.find((x: any) => x.id === 'q-sure').kind).toBe('misconception');
  expect(q.find((x: any) => x.id === 'q-unsure').kind).toBe('gap');
});

test('the boundary is inclusive at 70 and at 40', () => {
  const S = blank();
  S.answers['at-70'] = { ok: false, attempts: 2, conf: 70, q: 'a', date: '2026-07-20' };
  S.answers['at-69'] = { ok: false, attempts: 2, conf: 69, q: 'b', date: '2026-07-20' };
  S.answers['at-40'] = { ok: true, attempts: 1, conf: 40, q: 'c', date: '2026-07-20' };
  S.answers['at-41'] = { ok: true, attempts: 1, conf: 41, q: 'd', date: '2026-07-20' };
  const { mentorQueue } = loadMentor(S, null);
  const by = Object.fromEntries(mentorQueue().map((x: any) => [x.id, x.kind]));
  expect(by['at-70']).toBe('misconception');
  expect(by['at-69']).toBe('gap');
  expect(by['at-40']).toBe('imposter');
  expect(by['at-41']).toBeUndefined();     // right and confident is not a signal
});

test('right on the first try but unsure is the reassure case, not a mistake', () => {
  const S = blank();
  S.answers['knew-it'] = { ok: true, attempts: 1, conf: 25, q: 'gradient', date: '2026-07-20' };
  S.answers['scraped-it'] = { ok: true, attempts: 2, conf: 25, q: 'chain rule', date: '2026-07-20' };
  const { mentorQueue } = loadMentor(S, null);
  const q = mentorQueue();
  expect(q.find((x: any) => x.id === 'knew-it').kind).toBe('imposter');
  // Second attempt means he did not know it cold, so it is not evidence to
  // reassure him with. It produces no row at all.
  expect(q.find((x: any) => x.id === 'scraped-it')).toBeUndefined();
});

test('a missing confidence never counts as certain', () => {
  const S = blank();
  S.answers['legacy'] = { ok: false, attempts: 2, q: 'old answer', date: '2026-07-01' };
  const { mentorQueue } = loadMentor(S, null);
  expect(mentorQueue()[0].kind).toBe('gap');
});

test('two lapses is decay, one is not', () => {
  const S = blank();
  S.reviews['leaky'] = { iv: 1, due: '2026-07-20', lapses: 2 };
  S.reviews['fine'] = { iv: 3, due: '2026-07-20', lapses: 1 };
  const { mentorQueue } = loadMentor(S, null);
  const q = mentorQueue();
  expect(q.filter((x: any) => x.kind === 'decay').map((x: any) => x.id)).toEqual(['leaky']);
});

test('a due retest outranks everything else', () => {
  const S = blank();
  S.answers['fresh-miss'] = { ok: false, attempts: 2, conf: 90, q: 'newest', date: day(0) };
  S.beliefs['isolation-serial'] = {
    believed: 'טרנזקציות רצות אחת אחרי השנייה', actual: 'רצות במקביל',
    opened: day(-7), status: 'corrected', retest: day(-1)
  };
  const { mentorQueue } = loadMentor(S, null);
  expect(mentorQueue()[0].kind).toBe('retest');
});

test('a retest that is not due yet stays out of the queue', () => {
  const S = blank();
  S.beliefs['later'] = {
    believed: 'x', actual: 'y', opened: day(0), status: 'corrected', retest: day(3)
  };
  const { mentorQueue } = loadMentor(S, null);
  expect(mentorQueue()).toHaveLength(0);
});

test('a settled belief suppresses the answer that produced it', () => {
  const S = blank();
  S.answers['isolation-q'] = { ok: false, attempts: 2, conf: 88, q: 'isolation', date: day(-2) };
  const { mentorQueue } = loadMentor(S, null);
  expect(mentorQueue()).toHaveLength(1);              // before it is settled

  S.beliefs['isolation-q'] = {
    believed: 'x', actual: 'y', opened: day(-1), status: 'corrected', retest: day(5)
  };
  const { mentorQueue: again } = loadMentor(S, null);
  expect(again()).toHaveLength(0);                    // corrected, retest not due
});

test('a belief suppresses the answer named in `from`, not just its own id', () => {
  // The regression this exists for: המנטור names a belief semantically
  // (isolation-serial) while the answer that exposed it is u-m3-tx-q2. Keying
  // suppression on the belief id alone means the row never stops resurfacing.
  const S = blank();
  S.answers['u-m3-tx-q2'] = { ok: false, attempts: 2, conf: 88, q: 'isolation', date: day(-2) };
  S.beliefs['isolation-serial'] = {
    believed: 'רצות אחת אחרי השנייה', actual: 'רצות במקביל',
    opened: day(-1), status: 'corrected', retest: day(5), from: ['u-m3-tx-q2']
  };
  const { mentorQueue } = loadMentor(S, null);
  expect(mentorQueue()).toHaveLength(0);
});

test('a belief with no `from` still suppresses nothing else', () => {
  const S = blank();
  S.answers['u-m3-tx-q2'] = { ok: false, attempts: 2, conf: 88, q: 'isolation', date: day(-2) };
  S.beliefs['isolation-serial'] = {
    believed: 'x', actual: 'y', opened: day(-1), status: 'corrected', retest: day(5)
  };
  const { mentorQueue } = loadMentor(S, null);
  expect(mentorQueue().map((x: any) => x.id)).toEqual(['u-m3-tx-q2']);
});

test('the label prefers the stored question, then a concept, then the raw id', () => {
  const S = blank();
  S.answers['u-m0-streams-q1'] = { ok: false, attempts: 2, conf: 80, q: 'מה יש ב-out.txt', date: day(0) };
  S.reviews['c-exit-code'] = { iv: 0, due: day(0), lapses: 3 };
  S.reviews['c-unknown-thing'] = { iv: 0, due: day(0), lapses: 3 };
  const kodex = { concepts: [{ id: 'exit-code', t: 'Exit code', he: 'קוד יציאה' }] };
  const { mentorQueue } = loadMentor(S, kodex);
  const by = Object.fromEntries(mentorQueue().map((x: any) => [x.id, x.label]));
  expect(by['u-m0-streams-q1']).toBe('מה יש ב-out.txt');
  expect(by['c-exit-code']).toBe('Exit code · קוד יציאה');
  expect(by['c-unknown-thing']).toBe('c-unknown-thing');
});

test('empty state produces an empty queue rather than throwing', () => {
  const { mentorQueue } = loadMentor({}, null);
  expect(mentorQueue()).toEqual([]);
});
