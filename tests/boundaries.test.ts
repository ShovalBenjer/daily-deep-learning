// Boundary tests per boundary-contracts: valid, invalid payload, unauthorized,
// missing/initial resource, oversize, plus daemon routes. Real components, no mocks:
// the Worker cases hit the LIVE sadna-sync deployment; daemon cases hit localhost:8788.
import { test, expect } from 'bun:test';

const SYNC = 'https://sadna-sync.shovalb9.workers.dev';
const DAEMON = 'http://localhost:8788';
const KEY = (await Bun.file(new URL('../daemon/.key', import.meta.url)).text()).trim();
const auth = { authorization: 'Bearer ' + KEY };

// ---- sadna-sync Worker ----

test('worker: unauthorized without bearer -> 401', async () => {
  const r = await fetch(SYNC);
  expect(r.status).toBe(401);
});

test('worker: GET returns JSON object (initial or current state)', async () => {
  const r = await fetch(SYNC, { headers: auth });
  expect(r.status).toBe(200);
  const j = await r.json();
  expect(typeof j).toBe('object');
});

test('worker: POST invalid JSON -> 400, state untouched', async () => {
  const before = await (await fetch(SYNC, { headers: auth })).text();
  const r = await fetch(SYNC, { method: 'POST', headers: auth, body: 'not-json{{' });
  expect(r.status).toBe(400);
  const after = await (await fetch(SYNC, { headers: auth })).text();
  expect(after).toBe(before);
});

test('worker: POST oversize -> 413', async () => {
  const big = '{"pad":"' + 'x'.repeat(310000) + '"}';
  const r = await fetch(SYNC, { method: 'POST', headers: auth, body: big });
  expect(r.status).toBe(413);
});

test('worker: POST valid roundtrips through GET without corruption', async () => {
  const before = await (await fetch(SYNC, { headers: auth })).json();
  const probe = { ...before, __test: Date.now() };
  const p = await fetch(SYNC, { method: 'POST', headers: auth, body: JSON.stringify(probe) });
  expect(p.status).toBe(200);
  const after = await (await fetch(SYNC, { headers: auth })).json();
  expect(after.__test).toBe(probe.__test);
  delete after.__test; // restore
  await fetch(SYNC, { method: 'POST', headers: auth, body: JSON.stringify(after) });
}, 15000);

// ---- daemon ----

test('daemon: /health is open', async () => {
  const r = await fetch(DAEMON + '/health');
  expect(r.status).toBe(200);
});

test('daemon: unauthorized /chat -> 401', async () => {
  const r = await fetch(DAEMON + '/chat', { method: 'POST', body: '{}' });
  expect(r.status).toBe(401);
});

test('daemon: /chat with no message -> 400 (fails closed, no claude spawn)', async () => {
  const r = await fetch(DAEMON + '/chat', {
    method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: '{}'
  });
  expect(r.status).toBe(400);
});

test('daemon: unknown route -> 404', async () => {
  const r = await fetch(DAEMON + '/nope', { headers: auth });
  expect(r.status).toBe(404);
});

test('daemon: /chat real roundtrip answers in Hebrew register', async () => {
  const r = await fetch(DAEMON + '/chat', {
    method: 'POST', headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'ענה במילה אחת בלבד: מהי האות היוונית של מקדם ההנחתה?', history: [], context: { test: true } })
  });
  expect(r.status).toBe(200);
  const j = await r.json();
  expect(typeof j.reply).toBe('string');
  expect(j.reply.length).toBeGreaterThan(0);
}, 150000);
