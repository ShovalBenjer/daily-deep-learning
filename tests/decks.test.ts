// Deck gating: the guarantee that importing a glossary does not wreck the
// recall queue.
//
// seedReviews() walks every concept in concepts.json and marks it due. Before
// deck support that was ungated, so merging the 79-item corporate deck would
// have put 79 cards due the same morning on top of the existing curriculum. The
// point of these tests is that the flood cannot come back silently.
import { test, expect } from 'bun:test';
import { readFileSync } from 'fs';

function loadDecks(S: any, kodex: any) {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const start = html.indexOf('const DECK_PER_DAY');
  const end = html.indexOf('const dueReviews');
  if (start < 0 || end < 0 || end < start)
    throw new Error('deck block not found in index.html');
  const src = html.slice(start, end);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const plusDays = (d: string, n: number) =>
    new Date(new Date(d + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
  const store = { save() {} };
  const idToPostDate = () => null;
  return new Function('S', 'kodex', 'iso', 'plusDays', 'store', 'idToPostDate',
    src + '\nreturn { seedReviews, deckCounts, openDeck, deckOn, DECK_PER_DAY };')(
      S, kodex, iso, plusDays, store, idToPostDate);
}

const today = () => new Date().toISOString().slice(0, 10);
const concepts = (n: number, deck?: string) =>
  Array.from({ length: n }, (_, i) => ({
    id: `c${i}`, t: `T${i}`, d: `definition ${i}`, ...(deck ? { deck } : {})
  }));

test('a concept with no deck is due immediately, exactly as before', () => {
  const S: any = { answers: {}, reviews: {}, decks: {} };
  const { seedReviews } = loadDecks(S, { concepts: concepts(5) });
  seedReviews();
  expect(Object.keys(S.reviews)).toHaveLength(5);
  expect(S.reviews['c-c0'].due).toBe(today());
});

test('a deck-tagged concept stays out of the queue until its deck is opened', () => {
  const S: any = { answers: {}, reviews: {}, decks: {} };
  const { seedReviews } = loadDecks(S, { concepts: concepts(79, 'corporate') });
  seedReviews();
  expect(Object.keys(S.reviews)).toHaveLength(0);   // the flood that must not happen
});

test('opening a deck drips it instead of dumping it', () => {
  const S: any = { answers: {}, reviews: {}, decks: {} };
  const { openDeck, DECK_PER_DAY } = loadDecks(S, { concepts: concepts(79, 'corporate') });
  openDeck('corporate');
  const ids = Object.keys(S.reviews);
  expect(ids).toHaveLength(79);                     // all scheduled...
  const dueToday = ids.filter(k => S.reviews[k].due <= today());
  expect(dueToday).toHaveLength(DECK_PER_DAY);      // ...but only 8 land today
  const spread = new Set(ids.map(k => S.reviews[k].due));
  expect(spread.size).toBe(Math.ceil(79 / DECK_PER_DAY));
});

test('an unopened deck does not leak in through a second seed', () => {
  const S: any = { answers: {}, reviews: {}, decks: {} };
  const mixed = [...concepts(3), ...concepts(40, 'corporate').map(c => ({ ...c, id: 'x' + c.id }))];
  const { seedReviews } = loadDecks(S, { concepts: mixed });
  seedReviews(); seedReviews(); seedReviews();
  expect(Object.keys(S.reviews)).toHaveLength(3);
});

test('seeding twice does not reschedule what is already in the queue', () => {
  const S: any = { answers: {}, reviews: {}, decks: {} };
  const { openDeck, seedReviews } = loadDecks(S, { concepts: concepts(20, 'corporate') });
  openDeck('corporate');
  const before = JSON.stringify(S.reviews);
  seedReviews();
  expect(JSON.stringify(S.reviews)).toBe(before);
});

test('a concept with no definition is never scheduled, deck or not', () => {
  const S: any = { answers: {}, reviews: {}, decks: {} };
  const kodex = { concepts: [{ id: 'nodef', t: 'T' }, { id: 'ok', t: 'T', d: 'has one' }] };
  const { seedReviews } = loadDecks(S, kodex);
  seedReviews();
  expect(Object.keys(S.reviews)).toEqual(['c-ok']);
});

test('deckCounts reports total and how much has actually been scheduled', () => {
  const S: any = { answers: {}, reviews: {}, decks: {} };
  const { deckCounts, openDeck } = loadDecks(S, { concepts: concepts(79, 'corporate') });
  expect(deckCounts().corporate).toEqual({ total: 79, seeded: 0 });
  openDeck('corporate');
  expect(deckCounts().corporate).toEqual({ total: 79, seeded: 79 });
});

test('the real concepts.json carries a deck that is gated, not loose', () => {
  // Guards the merge itself: if a future import forgets the deck field, those
  // concepts become due immediately for everyone and this fails.
  const doc = JSON.parse(readFileSync(new URL('../concepts.json', import.meta.url), 'utf8'));
  const corporate = doc.concepts.filter((c: any) => c.deck === 'corporate');
  expect(corporate.length).toBeGreaterThan(50);
  for (const c of corporate) expect(['org', 'company']).toContain(c.node);

  const S: any = { answers: {}, reviews: {}, decks: {} };
  const { seedReviews } = loadDecks(S, doc);
  seedReviews();
  const scheduled = Object.keys(S.reviews);
  expect(scheduled.length).toBe(doc.concepts.length - corporate.length);
});
