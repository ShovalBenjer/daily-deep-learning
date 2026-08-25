// L1 boundary tests for the daemon's untrusted-input parser.
//
// WHY THIS EXISTS: daemon/server_parse.ts is the only thing between a hostile
// internet caller and an agent runtime that can write learner state. It is
// imported by tests/fuzz.test.ts (two thousand hostile bodies) and by the
// parser mutation layer in tests/mutation.test.ts, which mutates the function
// and checks that every planted defect is still caught here. These tests are
// the oracle the mutation layer relies on, so they name each documented
// contract (the MAX_* limits, the drop-vs-reject rules) explicitly rather than
// folding them into one over-broad case.
import { test, expect } from 'bun:test';
import {
  parseChatRequest,
  MAX_MESSAGE,
  MAX_HISTORY,
  MAX_CONTEXT_CHARS,
} from '../daemon/server_parse';

test('rejects null', () => {
  expect(parseChatRequest(null).ok).toBe(false);
});

test('rejects a bare string', () => {
  expect(parseChatRequest('just a string').ok).toBe(false);
});

test('rejects an array body', () => {
  expect(parseChatRequest([1, 2, 3]).ok).toBe(false);
});

test('rejects a missing message', () => {
  expect(parseChatRequest({}).ok).toBe(false);
});

test('rejects a blank (whitespace-only) message', () => {
  expect(parseChatRequest({ message: '    ' }).ok).toBe(false);
});

test('rejects a non-string message', () => {
  expect(parseChatRequest({ message: 123 }).ok).toBe(false);
});

test('rejects a message over MAX_MESSAGE', () => {
  expect(parseChatRequest({ message: 'x'.repeat(MAX_MESSAGE + 1) }).ok).toBe(false);
});

test('accepts a minimal valid message', () => {
  const r = parseChatRequest({ message: 'hello' });
  expect(r.ok).toBe(true);
});

test('valid input returns the documented shape', () => {
  const r = parseChatRequest({ message: 'hello' }) as any;
  expect(r.message).toBe('hello');
  expect(r.history).toEqual([]);
  expect(r.context).toEqual({});
  expect(r.persona).toBe('teacher');
  expect(r.verify).toBe(false);
});

test('whitespace around a valid message is preserved', () => {
  const r = parseChatRequest({ message: '  hi  ' }) as any;
  expect(r.ok).toBe(true);
  expect(r.message).toBe('  hi  ');
});

test('persona "mentor" is honored', () => {
  const r = parseChatRequest({ message: 'hi', persona: 'mentor' }) as any;
  expect(r.persona).toBe('mentor');
});

test('any non-mentor persona collapses to teacher', () => {
  const r = parseChatRequest({ message: 'hi', persona: 'admin' }) as any;
  expect(r.persona).toBe('teacher');
});

test('verify is truthy when set', () => {
  const r = parseChatRequest({ message: 'hi', verify: 1 }) as any;
  expect(r.verify).toBe(true);
});

test('verify defaults to false', () => {
  const r = parseChatRequest({ message: 'hi', verify: false }) as any;
  expect(r.verify).toBe(false);
});

test('valid history entries are kept verbatim', () => {
  const history = [
    { role: 'user', text: 'a' },
    { role: 'bot', text: 'b' },
  ];
  const r = parseChatRequest({ message: 'hi', history }) as any;
  expect(r.history).toEqual(history);
});

test('malformed history entries are dropped, valid ones kept', () => {
  const history = [
    { role: 'user', text: 'a' },
    { role: 'user' },
    { text: 'x' },
    'garbage',
    null,
    5,
  ] as any;
  const r = parseChatRequest({ message: 'hi', history }) as any;
  expect(r.history).toEqual([{ role: 'user', text: 'a' }]);
});

test('a non-array history is ignored and defaults to []', () => {
  const r = parseChatRequest({ message: 'hi', history: 'nope' }) as any;
  expect(r.history).toEqual([]);
});

test('history is capped to MAX_HISTORY, keeping the last entries', () => {
  const history = Array.from({ length: 15 }, (_, i) => ({ role: 'user', text: 'm' + i }));
  const r = parseChatRequest({ message: 'hi', history }) as any;
  expect(r.history).toHaveLength(MAX_HISTORY);
  expect(r.history[0].text).toBe('m' + (15 - MAX_HISTORY));
});

test('a plain-object context is kept', () => {
  const r = parseChatRequest({ message: 'hi', context: { a: 1 } }) as any;
  expect(r.context).toEqual({ a: 1 });
});

test('an array context is not treated as an object', () => {
  const r = parseChatRequest({ message: 'hi', context: [1, 2] }) as any;
  expect(r.context).toEqual({});
});

test('an oversized context is replaced with an honest marker', () => {
  const big = { x: 'y'.repeat(MAX_CONTEXT_CHARS + 10) };
  const r = parseChatRequest({ message: 'hi', context: big }) as any;
  expect(r.context).toEqual({ note: 'context too large, dropped' });
});

test('an unserialisable context is treated as oversized', () => {
  const circ: any = {};
  circ.self = circ;
  const r = parseChatRequest({ message: 'hi', context: circ }) as any;
  expect(r.context).toEqual({ note: 'context too large, dropped' });
});

test('every rejection carries a reason string', () => {
  const r = parseChatRequest({}) as any;
  expect(r.ok).toBe(false);
  expect(typeof r.error).toBe('string');
  expect(r.error.length).toBeGreaterThan(0);
});
