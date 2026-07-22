// הסדנה daemon v2: the teacher on the REAL Claude Agent SDK.
// In-process custom tools (learner state, today's page, save-note), optional
// verifier pass for grading, subscription-billed via the local CLI runtime.
// Exposed through a cloudflared quick tunnel; registers its URL in sync state.
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const PORT = 8788;
const SYNC_URL = 'https://sadna-sync.shovalb9.workers.dev';
const ORIGIN = 'https://daily-deep-learning.pages.dev';
const KEY = (await Bun.file(new URL('./.key', import.meta.url)).text()).trim();
const REPO = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const cors = {
  'access-control-allow-origin': ORIGIN,
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS'
};

async function getState(): Promise<any> {
  try {
    const r = await fetch(SYNC_URL, { headers: { authorization: 'Bearer ' + KEY } });
    return await r.json();
  } catch { return {}; }
}
async function putState(st: any) {
  await fetch(SYNC_URL, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + KEY, 'content-type': 'application/json' },
    body: JSON.stringify(st)
  }).catch(() => {});
}

function summarizeState(st: any): string {
  const answers = st.answers || {};
  const per: Record<string, { ok: number; n: number; conf: number[] }> = {};
  for (const a of Object.values<any>(answers)) {
    const t = a.tree || 'craft';
    per[t] = per[t] || { ok: 0, n: 0, conf: [] };
    per[t].n++; if (a.ok && a.attempts === 1) per[t].ok++;
    if (a.conf != null) per[t].conf.push(a.conf);
  }
  const lines = Object.entries(per).map(([t, v]) =>
    `${t}: first-try ${v.n ? Math.round(100 * v.ok / v.n) : 0}% of ${v.n}, avg conf ${v.conf.length ? Math.round(v.conf.reduce((a, b) => a + b, 0) / v.conf.length) : '-'}`);
  const earned = Object.values<any>(st.points || {}).reduce((a: number, p: any) => a + (p.earned || 0), 0);
  return `XP ${earned}. per-tree: ${lines.join(' | ') || 'no answers yet'}. days done: ${(st.daysDone || []).length}. ranks: ${JSON.stringify(st.ranks || {})}`;
}

const sadnaTools = createSdkMcpServer({
  name: 'sadna',
  version: '2.0.0',
  tools: [
    tool('get_state', 'Learner state snapshot: XP, per-tree accuracy, confidence, ranks, days done', {}, async () => {
      const st = await getState();
      return { content: [{ type: 'text', text: summarizeState(st) }] };
    }),
    tool('get_today_page', "Today's (or a given date's) lesson page markdown, first 7000 chars", {
      date: z.string().optional().describe('YYYY-MM-DD; defaults to today Asia/Jerusalem')
    }, async (args) => {
      const d = args.date || new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
      try {
        const md = await Bun.file(`${REPO}posts/${d}.md`).text();
        return { content: [{ type: 'text', text: md.slice(0, 7000) }] };
      } catch { return { content: [{ type: 'text', text: 'no page for ' + d }] }; }
    }),
    tool('save_note', "Save a note into the learner's אוצר (visible in the app)", {
      text: z.string().describe('the note text, Hebrew, max ~600 chars')
    }, async (args) => {
      const st = await getState();
      st.notes = st.notes || [];
      st.notes.push({ t: String(args.text).slice(0, 800), d: new Date().toISOString().slice(0, 10), ctx: 'המורה' });
      st.ts = Date.now();
      await putState(st);
      return { content: [{ type: 'text', text: 'נשמר לאוצר' }] };
    })
  ]
});

const SYSTEM = `אתה "המורה" של הסדנה, מערכת הלמידה של שובל בנג'ר (מהנדס AI, עברית + מונחים באנגלית).
תפקידך: להסביר לעומק ברמת gadial, לדרג תשובות חופשיות בכנות (ציון 1-10 + מה חסר + מה היה משכנע מראיין), ולחבר לפרויקטים שלו (MatchIQ, agenteval-bench, mcp-guard, Azure Foundry, Seekapa gateway).
יש לך כלים: get_state (מצב הלומד), get_today_page (דף היום), save_note (שמירת הערה לאוצר). השתמש בהם כשרלוונטי, במיוחד get_state לפני דירוג והתאמת רמה.
סגנון: תמציתי וישיר, בלי אימוג'ים, בלי קווים מפרידים. כשמדרגים: קשוח והוגן.`;

async function runAgent(message: string, history: any[], context: any, verify: boolean): Promise<string> {
  const hist = (history || []).slice(-8)
    .map((m: any) => (m.role === 'user' ? 'שובל: ' : 'המורה: ') + m.text).join('\n');
  const prompt = `${hist ? 'שיחה עד כה:\n' + hist + '\n\n' : ''}הקשר באפליקציה: ${JSON.stringify(context || {})}\nשובל: ${message}`;
  const ac = new AbortController();
  const killer = setTimeout(() => ac.abort(), 150000);
  let result = '';
  try {
    for await (const msg of query({
      prompt,
      options: {
        systemPrompt: SYSTEM,
        mcpServers: { sadna: sadnaTools },
        allowedTools: ['mcp__sadna__get_state', 'mcp__sadna__get_today_page', 'mcp__sadna__save_note'],
        permissionMode: 'bypassPermissions',
        maxTurns: 6,
        abortController: ac
      }
    })) {
      if (msg.type === 'result') result = (msg as any).subtype === 'success' ? (msg as any).result : result;
    }
  } finally { clearTimeout(killer); }

  if (verify && result) {
    const ac2 = new AbortController();
    const k2 = setTimeout(() => ac2.abort(), 90000);
    try {
      let refined = '';
      for await (const msg of query({
        prompt: `אתה המבקר. בדוק את תשובת המורה הבאה (דיוק עובדתי, הוגנות הדירוג, מה חסר). אם היא טובה, החזר אותה כלשונה. אם לא, החזר גרסה מתוקנת בלבד, בלי הערות מטא.\n\nשאלת שובל: ${message}\n\nתשובת המורה:\n${result}`,
        options: { maxTurns: 1, allowedTools: [], abortController: ac2 }
      })) {
        if (msg.type === 'result') refined = (msg as any).subtype === 'success' ? (msg as any).result : '';
      }
      if (refined && refined.length > 20) result = refined;
    } catch { /* verifier optional */ } finally { clearTimeout(k2); }
  }
  return result || 'שגיאה: אין תשובה.';
}

const hits: number[] = [];
Bun.serve({
  port: PORT,
  idleTimeout: 250,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (url.pathname === '/health') return new Response('ok v2-sdk', { headers: cors });
    if ((req.headers.get('authorization') || '') !== 'Bearer ' + KEY)
      return new Response('unauthorized', { status: 401, headers: cors });

    if (url.pathname === '/chat' && req.method === 'POST') {
      const now = Date.now();
      while (hits.length && now - hits[0] > 60000) hits.shift();
      if (hits.length >= 6) return Response.json({ error: 'rate limited, wait a minute' }, { status: 429, headers: cors });
      hits.push(now);
      const body = await req.json().catch(() => null);
      if (!body || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 4000)
        return Response.json({ error: 'message required (1-4000 chars)' }, { status: 400, headers: cors });
      const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
      let context = body.context || {};
      if (JSON.stringify(context).length > 1500) context = { note: 'context too large, dropped' };
      const reply = await runAgent(body.message, history, context, !!body.verify);
      return Response.json({ reply }, { headers: cors });
    }
    return new Response('not found', { status: 404, headers: cors });
  }
});
console.log('sadna daemon v2 (agent-sdk) on :' + PORT);

// --- quick tunnel + registration ---
async function tunnel() {
  const proc = Bun.spawn(['C:/Users/shova/bin/cloudflared.exe', 'tunnel', '--url', 'http://localhost:' + PORT],
    { stdout: 'pipe', stderr: 'pipe' });
  const reader = proc.stderr.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value);
    const m = buf.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m) {
      const st = await getState();
      st.daemon_url = m[0]; st.daemon_ts = Date.now();
      await putState(st);
      console.log('tunnel registered: ' + m[0]);
      reader.releaseLock();
      (async () => { for await (const _ of proc.stderr) {} })().catch(() => {});
      break;
    }
  }
}
tunnel().catch(e => console.error('tunnel failed', e));
