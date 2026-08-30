// L6 contract and the 3.D prefers-reduced-motion gate.
//
// L6 first. This product crosses three network hops (browser to Worker, browser
// to daemon, daemon to Worker) and had zero contract tests, which is the exact
// shape of failure where a field rename ships green: the client keeps sending
// `persona`, someone renames the server's field, the parser falls through to its
// default, and every reply silently comes from the wrong persona with no error
// anywhere. These are consumer-driven: the payload is built by the REAL client
// code lifted out of src/app.js, then fed to the REAL server parser.
import { test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { parseChatRequest, MAX_MESSAGE, MAX_HISTORY, MAX_CONTEXT_CHARS }
  from '../daemon/server_parse';

const APP = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

/**
 * Build the /chat body exactly as sendChat() does, by lifting its own
 * JSON.stringify argument out of src/app.js. Copying the shape here instead
 * would defeat the purpose: the copy would keep passing after the client
 * changed.
 */
function clientBody(opts: { who: string; text: string; hist: any[]; item?: any }) {
  const i = APP.indexOf('const r = await fetch(S.daemon_url + \'/chat\'');
  if (i < 0) throw new Error('sendChat fetch not found in src/app.js');
  const bodyStart = APP.indexOf('body: JSON.stringify(', i);
  const open = APP.indexOf('{', bodyStart);
  // Walk braces to find the object literal the client actually sends.
  let depth = 0, end = open;
  for (; end < APP.length; end++) {
    if (APP[end] === '{') depth++;
    else if (APP[end] === '}') { depth--; if (depth === 0) { end++; break; } }
  }
  const literal = APP.slice(open, end);
  const chat = { hist: opts.hist };
  const fn = new Function('who', 'text', 'verify', 'chat', 'location', 'index',
    'level', 'mentorItem', `return (${literal});`);
  return fn(opts.who, opts.text, false, chat, { hash: '#/mentor' },
            [{ date: '2026-07-29' }], () => 3, opts.item);
}

test('L6: the body the client builds is accepted by the server parser', () => {
  const body = clientBody({
    who: 'teacher', text: 'מה ההבדל בין isolation ל-durability',
    hist: [{ role: 'user', text: 'קודם' }, { role: 'bot', text: 'תשובה' }],
  });
  const out = parseChatRequest(body);
  expect(out.ok).toBe(true);
});

test('L6: persona survives the hop, so a rename cannot pass silently', () => {
  const body = clientBody({ who: 'mentor', text: 'x', hist: [] });
  const out = parseChatRequest(body);
  expect(out.ok && out.persona).toBe('mentor');

  const renamed = { ...(body as any) };
  delete renamed.persona;
  const broken = parseChatRequest(renamed);
  expect(broken.ok && broken.persona).toBe('teacher');
});

test('L6: the client history shape is the shape the server keeps', () => {
  const hist = Array.from({ length: 30 }, (_, i) =>
    ({ role: i % 2 ? 'bot' : 'user', text: `m${i}` }));
  const body = clientBody({ who: 'teacher', text: 'x', hist });
  const out = parseChatRequest(body);
  expect(out.ok).toBe(true);
  const sent = (body as any).history.length;
  expect(out.ok && out.history.length).toBe(Math.min(sent, MAX_HISTORY));
  expect(out.ok && out.history.length).toBeGreaterThan(0);
});

test('L6: a realistic mentor context fits the server budget', () => {
  const item = {
    kind: 'misconception', id: 'u-m3-tx-q2',
    label: 'מה ההבדל בין isolation לבין durability במסד נתונים',
    conf: 88, skill: 'postgresql', date: '2026-07-29',
  };
  const body = clientBody({ who: 'mentor', text: 'בוא נדבר על זה', hist: [], item });
  expect(JSON.stringify((body as any).context).length).toBeLessThan(MAX_CONTEXT_CHARS);
  const out = parseChatRequest(body);
  expect(out.ok && (out.context as any).item.id).toBe('u-m3-tx-q2');
});

test('L6: the client cannot construct a message the server rejects on length', () => {
  const body = clientBody({ who: 'teacher', text: 'a'.repeat(MAX_MESSAGE), hist: [] });
  expect(parseChatRequest(body).ok).toBe(true);
  const over = clientBody({ who: 'teacher', text: 'a'.repeat(MAX_MESSAGE + 1), hist: [] });
  expect(parseChatRequest(over).ok).toBe(false);
});

test('L6: the client knows the Worker cap and does not fail silently', () => {
  const push = APP.slice(APP.indexOf('function schedulePush'),
                          APP.indexOf('async function pullState'));
  const code = push.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  expect(code).toContain('SYNC_CAP');
  expect(code).toContain('r.ok');
  expect(code).not.toMatch(/\.catch\(\(\)\s*=>\s*\{\}\)/);

  const cap = /const SYNC_CAP = (\d+);/.exec(APP);
  expect(cap).not.toBeNull();
  expect(Number(cap![1])).toBe(300000);
});

// ------------------------------------------- 3.D prefers-reduced-motion gate

function motion(reduced: boolean) {
  const start = APP.indexOf('const SPRING =');
  const end = APP.indexOf('function countUp');
  const src = APP.slice(start, end);
  const matchMedia = (q: string) => ({ matches: reduced && q.includes('reduce') });
  return new Function('matchMedia', src + '\nreturn { REDUCED, anim };')(matchMedia);
}

test('3.D: reduced motion is honoured, and animate() is never called', () => {
  let animateCalls = 0;
  const el: any = { animate: () => { animateCalls++; return { finished: Promise.resolve() }; } };

  const on = motion(true);
  expect(on.REDUCED()).toBe(true);
  const r = on.anim(el, [{ opacity: 0 }], { duration: 300 });
  expect(animateCalls).toBe(0);
  expect(r.finished).toBeInstanceOf(Promise);
});

test('3.D: with motion allowed the animation actually runs, so the gate is real', () => {
  let animateCalls = 0;
  const el: any = { animate: () => { animateCalls++; return { finished: Promise.resolve() }; } };
  const off = motion(false);
  expect(off.REDUCED()).toBe(false);
  off.anim(el, [{ opacity: 0 }], { duration: 300 });
  expect(animateCalls).toBe(1);
});

test('3.D: anim always returns an awaitable, however it is called', () => {
  for (const reduced of [true, false]) {
    const m = motion(reduced);
    for (const el of [null, undefined, {}, { animate: undefined }]) {
      const out = m.anim(el as any, [{ opacity: 0 }], {});
      expect(out.finished).toBeInstanceOf(Promise);
    }
  }
});

test('3.D: every REDUCED() call site is a guard, not a decoration', () => {
  const uses = [...APP.matchAll(/REDUCED\(\)/g)].map(m => m.index || 0);
  expect(uses.length).toBeGreaterThan(4);
  for (const i of uses) {
    const around = APP.slice(Math.max(0, i - 40), i + 40);
    const guarded = /if\s*\(|\|\||&&|\?/.test(around);
    expect(guarded).toBe(true);
  }
});
