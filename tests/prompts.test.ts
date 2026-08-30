// Prompt-as-code regression, per TESTING-SOTA-2026-GAPS.md section 4 and
// section 6 item 2.
//
// The MENTOR and SYSTEM prompts in daemon/server.ts are load-bearing: the
// mentor's entire contract (never presume, confirm before recording a belief,
// carry `from` so a worked-through row stops resurfacing) lives in prose the
// model reads, and until now nothing failed when that prose changed. These
// tests pin the clauses the product depends on. They assert presence of the
// rule, not exact wording, so the prompt can be edited without breaking a test
// unless the edit removes the rule itself.
import { test, expect } from 'bun:test';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../daemon/server.ts', import.meta.url), 'utf8');
const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function prompt(name: 'MENTOR' | 'SYSTEM'): string {
  const open = SRC.indexOf('const ' + name + ' = `');
  if (open < 0) throw new Error(name + ' prompt not found in daemon/server.ts');
  const start = SRC.indexOf('`', open) + 1;
  const end = SRC.indexOf('`', start);
  if (end < 0) throw new Error(name + ' prompt is unterminated');
  return SRC.slice(start, end);
}

test('mentor prompt: the refusal-to-presume rule exists and is ranked first', () => {
  const p = prompt('MENTOR');
  // The one rule the persona exists for. It must be stated as overriding.
  expect(p).toContain('אל תניח');
  expect(p).toContain('גובר על כל השאר');
  // A correction may only follow a clarifying question, one question.
  expect(p).toContain('שאלה אחת');
});

test('mentor prompt: a belief is recorded only after confirmation, with from', () => {
  const p = prompt('MENTOR');
  expect(p).toContain('open_belief אחרי אישור');
  expect(p).toMatch(/from/);
  // Being told the read was wrong is data, not an argument.
  expect(p).toContain('נתון, לא ויכוח');
});

test('mentor prompt: all four measured signals have a distinct response', () => {
  const p = prompt('MENTOR');
  for (const signal of ['WRONG+CERTAIN', 'WRONG+UNSURE', 'RIGHT+UNSURE', 'LEAKED'])
    expect(p).toContain(signal);
});

test('the signal names the prompt teaches are the names get_mistakes emits', () => {
  // The prompt and the tool are two halves of one contract. If get_mistakes
  // renames a row the mentor was taught the old vocabulary and the mapping
  // between diagnosis and response silently breaks.
  const tool = SRC.slice(SRC.indexOf("tool('get_mistakes'"), SRC.indexOf("tool('open_belief'"));
  for (const signal of ['WRONG+CERTAIN', 'WRONG+UNSURE', 'RIGHT+UNSURE', 'LEAKED'])
    expect(tool).toContain(signal);
});

test('the daemon thresholds cannot drift from the client MENTOR constants', () => {
  // The client computes the four-signal split in mentorQueue() from
  // MENTOR.sure/unsure/lapseFloor; get_mistakes recomputes it server-side so a
  // fabricated diagnosis cannot be handed to the model. Same split, two
  // codebases, so the numbers are asserted equal here.
  const m = /const MENTOR = \{ sure: (\d+), unsure: (\d+), lapseFloor: (\d+) \};/.exec(HTML);
  expect(m).not.toBeNull();
  const [sure, unsure, lapseFloor] = [Number(m![1]), Number(m![2]), Number(m![3])];
  const tool = SRC.slice(SRC.indexOf("tool('get_mistakes'"), SRC.indexOf("tool('open_belief'"));
  expect(tool).toContain(`a.conf >= ${sure}`);
  expect(tool).toContain(`a.conf <= ${unsure}`);
  expect(tool).toContain(`>= ${lapseFloor}`);
});

test('teacher prompt: grading and tools are named', () => {
  const p = prompt('SYSTEM');
  expect(p).toContain('1-10');
  for (const t of ['get_state', 'save_note']) expect(p).toContain(t);
});

test('both prompts obey the content style they demand', () => {
  // The style rules are AGENTS.md content rules, applied to the prompts
  // themselves: no emoji, no em-dash or en-dash connectors.
  for (const name of ['MENTOR', 'SYSTEM'] as const) {
    const p = prompt(name);
    expect(p).not.toMatch(/[\u2013\u2014]/);
    expect(p).not.toMatch(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u);
  }
});

test('the mentor persona always gets the verifier pass, not a client flag', () => {
  // The presumption check is the feature. Assert against code, not comments,
  // the same way contract.test.ts guards schedulePush.
  const code = SRC.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
  expect(code).toContain("parsed.verify || parsed.persona === 'mentor'");
});
