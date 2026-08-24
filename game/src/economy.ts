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

interface Store { cards: Record<string, Card>; embers: number; lamplighter: boolean; lastLight: string; pendingGain: number; }

const KEY = 'lamps-economy';

function load(): Store {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) || '{}');
    const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<Store>;
    return {
      cards: s.cards && typeof s.cards === 'object' ? s.cards as Record<string, Card> : {},
      embers: typeof s.embers === 'number' ? s.embers : 0,
      lamplighter: s.lamplighter === true,
      lastLight: typeof s.lastLight === 'string' ? s.lastLight : '',
      // a reload before end-shift must not discard earned light (PR #10)
      pendingGain: typeof s.pendingGain === 'number' ? s.pendingGain : 0,
    };
  } catch {
    return { cards: {}, embers: 0, lamplighter: false, lastLight: '', pendingGain: 0 };
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
export function review(id: string, help: Help, now = new Date()): number {
  const existing = store.cards[id] ? reviveCard(store.cards[id]) : null;
  if (existing) {
    const r = f.get_retrievability(existing, now, false) as number;
    if (r >= 0.95) return 0; // not due: practice is free, embers are not
  }
  const prev: Card = existing ?? createEmptyCard(now);
  const before = prev.stability || 0;
  const next = f.next(prev, now, RATING[help]).card;
  store.cards[id] = next;
  const gained = Math.max(0, next.stability - before);
  store.pendingGain += gained;
  save();
  return gained;
}

/** Live retrievability for a lamp, or null if it was never passed. */
export function retrievability(id: string, now = new Date()): number | null {
  const c = store.cards[id];
  if (!c) return null;
  return f.get_retrievability(reviveCard(c), now, false) as number;
}

export function shiftGain(): number { return store.pendingGain; }
export function embers(): number { return store.embers; }
export function hasLamplighter(): boolean { return store.lamplighter; }

export const LAMPLIGHTER_PRICE = 30; // tunable, see header

/** Bank the shift: stability-days become embers. Returns embers banked. */
export function endShift(): number {
  const banked = Math.round(store.pendingGain);
  store.embers += banked;
  store.pendingGain = 0;
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
