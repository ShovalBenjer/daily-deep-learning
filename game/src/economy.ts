/**
 * The ember economy, grounded in the corpus research instead of invented:
 *
 * - Memory model: FSRS via ts-fsrs (the library COMPETITIVE-OSS-INVESTIGATION
 *   selected; MIT, no deps). Each lamp holds an FSRS card; lamp brightness
 *   is live retrievability R(t,S), and FSRS's own 0.9 request-retention
 *   line is the flicker threshold, so "the lamp dims" and "the review is
 *   due" are the same fact, not two systems.
 * - Grades come from how much help the pass needed (the coach mapping the
 *   same research table specifies): no help = Easy, hints/diagnostics =
 *   Good, a reveal = Hard, a failed run = Again.
 * - Embers (the prestige currency, per the incremental research's
 *   reset-banks-permanent-currency anchor) equal STABILITY-DAYS gained in
 *   the shift: the permanent currency is literally durable memory earned,
 *   which is the ENGINE research's reward-as-information rule in code.
 * - The lamplighter (automation-as-reward, the same research's fourth
 *   anchor) is bought with embers and auto-refreshes the weakest lamp once
 *   per real day: earned automation, never default.
 *
 * TUNABLE and said so: the lamplighter's price (30 embers, roughly a
 * focused week of stability gains) and its one-lamp-per-day throughput.
 * NOT tunable here: the forgetting curve, which is ts-fsrs's own.
 */
import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs';

const f = fsrs();

export type Help = 'none' | 'hint' | 'reveal' | 'fail';

const RATING: Record<Help, Grade> = {
  none: Rating.Easy,
  hint: Rating.Good,
  reveal: Rating.Hard,
  fail: Rating.Again,
};

interface Store { cards: Record<string, Card>; lastGrade: Record<string, Help>; embers: number; lamplighter: boolean; lastLight: string; pendingGain: number; }

const KEY = 'lamps-economy';

function load(): Store {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) || '{}');
    const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<Store>;
    // validate each stored card's shape: one corrupted entry must not take
    // the whole city render down (PR #10 round-1 carry)
    const cards: Record<string, Card> = {};
    if (s.cards && typeof s.cards === 'object') {
      for (const [k, v] of Object.entries(s.cards as Record<string, unknown>)) {
        const c = v as Partial<Card>;
        if (c && typeof c.stability === 'number' && typeof c.difficulty === 'number'
            && c.due !== undefined && !Number.isNaN(new Date(c.due as never).getTime())) {
          cards[k] = c as Card;
        }
      }
    }
    const lastGrade: Record<string, Help> = {};
    if (s.lastGrade && typeof s.lastGrade === 'object') {
      for (const [k, v] of Object.entries(s.lastGrade as Record<string, unknown>)) {
        if (v === 'none' || v === 'hint' || v === 'reveal' || v === 'fail') lastGrade[k] = v;
      }
    }
    return {
      cards, lastGrade,
      embers: typeof s.embers === 'number' ? s.embers : 0,
      lamplighter: s.lamplighter === true,
      lastLight: typeof s.lastLight === 'string' ? s.lastLight : '',
      // a reload before end-shift must not discard earned light (PR #10)
      pendingGain: typeof s.pendingGain === 'number' ? s.pendingGain : 0,
    };
  } catch {
    return { cards: {}, lastGrade: {}, embers: 0, lamplighter: false, lastLight: '', pendingGain: 0 };
  }
}

const store = load();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* private mode */ }
}

function reviveCard(c: Card): Card {
  return { ...c, due: new Date(c.due), last_review: c.last_review ? new Date(c.last_review) : undefined };
}

/**
 * Record a graded review for a lamp; returns stability-days gained.
 *
 * Anti-farming rule (PR #10 High, and the ENGINE research's own
 * mastery-evidence law): a lamp still burning bright is not due, so
 * re-passing it is practice, not evidence, and earns nothing. The FSRS
 * card is untouched too: same-session repeats must not inflate stability.
 */
/** FSRS request-retention: at or above this a lamp is not due. One constant
 *  shared with the lamp visuals so "not due" and "still bright" never drift. */
export const DUE_RETENTION = 0.9;

export function review(id: string, help: Help, now = new Date()): number {
  const existing = store.cards[id] ? reviveCard(store.cards[id]) : null;
  if (existing) {
    const r = f.get_retrievability(existing, now, false);
    // The gate is keyed on the LAST GRADE, not FSRS state: a state-based
    // relearning exemption let repeated passes mint stability through
    // ts-fsrs's learning steps (PR #10 round-4). Rules: a bright lamp whose
    // last grade succeeded is untouchable in both directions; a lamp whose
    // last grade was a fail stays earnable exactly once, for the recovery.
    const lapsed = store.lastGrade[id] === 'fail';
    if (typeof r === 'number' && r >= DUE_RETENTION && !lapsed) return 0; // not due: practice is free
  }
  const prev: Card = existing ?? createEmptyCard(now);
  const before = prev.stability || 0;
  const next = f.next(prev, now, RATING[help]).card;
  store.cards[id] = next;
  // Again is a lapse, never income: without this, failing a fresh lamp once
  // minted its initial stability as embers (PR #10 second-round High).
  const gained = help === 'fail' ? 0 : Math.max(0, next.stability - before);
  store.lastGrade[id] = help;
  store.pendingGain += gained;
  save();
  return gained;
}

/** Live retrievability for a lamp, or null if it was never passed. */
export function retrievability(id: string, now = new Date()): number | null {
  const c = store.cards[id];
  if (!c) return null;
  const r = f.get_retrievability(reviveCard(c), now, false);
  return typeof r === 'number' ? r : null;
}

export function shiftGain(): number { return store.pendingGain; }
export function embers(): number { return store.embers; }
export function hasLamplighter(): boolean { return store.lamplighter; }

export const LAMPLIGHTER_PRICE = 30; // tunable, see header

/** Bank the shift: stability-days become embers. Returns embers banked. */
export function endShift(): number {
  // floor + carry: fractional stability is never discarded, it waits for
  // the next shift (PR #10 nit: Math.round leaked sub-0.5 gains)
  const banked = Math.floor(store.pendingGain);
  store.embers += banked;
  store.pendingGain -= banked;
  save();
  return banked;
}

export function buyLamplighter(): boolean {
  if (store.lamplighter || store.embers < LAMPLIGHTER_PRICE) return false;
  store.embers -= LAMPLIGHTER_PRICE;
  store.lamplighter = true;
  save();
  return true;
}

/**
 * The lamplighter's daily round: once per real day, refresh the single
 * weakest previously-passed lamp (a Good review it performs for you).
 * Returns the lamp id it tended, or null.
 */
export function lamplighterRound(now = new Date()): string | null {
  if (!store.lamplighter) return null;
  const today = now.toISOString().slice(0, 10);
  if (store.lastLight === today) return null;
  let weakest: { id: string; r: number } | null = null;
  for (const id of Object.keys(store.cards)) {
    const r = retrievability(id, now);
    if (r !== null && (!weakest || r < weakest.r)) weakest = { id, r };
  }
  if (!weakest) return null;
  store.lastLight = today;
  const prev = reviveCard(store.cards[weakest.id]);
  store.cards[weakest.id] = f.next(prev, now, Rating.Good).card;
  save();
  return weakest.id;
}
