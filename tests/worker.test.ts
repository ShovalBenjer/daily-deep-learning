// L7 replayable integration for the sync boundary, per
// TESTING-SOTA-2026-GAPS.md section 6 item 1.
//
// tests/boundaries.test.ts exercises the LIVE Worker and stays that way on
// purpose (quality-contract.json documents it as fail-closed, not skippable).
// What the rubric calls mandatory and this repo lacked is a run of the SAME
// boundary contract that needs no network, no key and no production state:
// sadna-sync/worker.js is a single module with no Cloudflare-only imports, so
// the honest replayable layer is the real handler in-process over a stub KV,
// not a cassette of yesterday's responses.
import { test, expect } from 'bun:test';
import worker from '../sadna-sync/worker';

const KEY = 'test-key';

function env() {
  const kv = new Map<string, string>();
  return {
    SYNC_KEY: KEY,
    STATE: {
      async get(k: string) { return kv.has(k) ? kv.get(k)! : null; },
      async put(k: string, v: string) { kv.set(k, v); },
    },
    _kv: kv,
  };
}

const call = (e: any, init: RequestInit = {}, bearer: string | null = KEY) => {
  const headers = new Headers(init.headers);
  if (bearer !== null) headers.set('authorization', 'Bearer ' + bearer);
  return worker.fetch(new Request('https://sync.test/', { ...init, headers }), e);
};

test('worker: OPTIONS preflight answers without auth', async () => {
  const r = await worker.fetch(new Request('https://sync.test/', { method: 'OPTIONS' }), env());
  expect(r.status).toBe(200);
  expect(r.headers.get('access-control-allow-methods')).toContain('POST');
});

test('worker: no bearer -> 401, wrong bearer -> 401', async () => {
  const e = env();
  expect((await call(e, {}, null)).status).toBe(401);
  expect((await call(e, {}, 'not-the-key')).status).toBe(401);
});

test('worker: GET before any push returns the empty object, as JSON', async () => {
  const r = await call(env());
  expect(r.status).toBe(200);
  expect(r.headers.get('content-type')).toContain('application/json');
  expect(await r.json()).toEqual({});
});

test('worker: POST invalid JSON -> 400 and state is untouched', async () => {
  const e = env();
  await call(e, { method: 'POST', body: '{"ok":1}' });
  const r = await call(e, { method: 'POST', body: 'not-json{{' });
  expect(r.status).toBe(400);
  expect(e._kv.get('state')).toBe('{"ok":1}');
});

test('worker: the cap the client believes is the cap enforced here', async () => {
  // contract.test.ts pins the client's SYNC_CAP to 300000; this pins the
  // Worker's behaviour to the same number, so neither side can drift alone.
  // Exactly at the cap passes, one byte over is rejected and never stored.
  const e = env();
  const at = '{"pad":"' + 'x'.repeat(300000 - 10) + '"}';
  expect(at.length).toBe(300000);
  expect((await call(e, { method: 'POST', body: at })).status).toBe(200);
  const over = '{"pad":"' + 'x'.repeat(300000 - 9) + '"}';
  expect((await call(e, { method: 'POST', body: over })).status).toBe(413);
  expect(e._kv.get('state')).toBe(at);
});

test('worker: POST valid roundtrips through GET without corruption', async () => {
  const e = env();
  const probe = { ts: 123, answers: { 'u-m0-streams-q1': { ok: true, conf: 55 } }, he: 'עברית' };
  const p = await call(e, { method: 'POST', body: JSON.stringify(probe) });
  expect(p.status).toBe(200);
  expect(await (await call(e)).json()).toEqual(probe);
});

test('worker: CORS is pinned to the deployed origin, on every response', async () => {
  // The app origin is the only browser context that may read these responses.
  // A widened allow-origin here would hand learner state to any page that
  // guessed the key was in localStorage.
  const e = env();
  for (const r of [await call(e, {}, null), await call(e), await call(e, { method: 'POST', body: '{}' })])
    expect(r.headers.get('access-control-allow-origin')).toBe('https://daily-deep-learning.pages.dev');
});
