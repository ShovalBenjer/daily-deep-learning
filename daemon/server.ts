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
    // The calendar was retired on 2026-07-29 and units replaced dated posts, so
    // a date-keyed lookup now misses every lesson written after that. Unit id
    // first, dated post only as an archive fallback.
    tool('get_lesson', 'A lesson body, first 7000 chars. Pass a unit id (m0-streams) or an archive date (YYYY-MM-DD)', {
      id: z.string().optional().describe('unit id, e.g. s2-artifact-repo'),
      date: z.string().optional().describe('YYYY-MM-DD, archived posts only')
    }, async (args) => {
      if (args.id) {
        try {
          const md = await Bun.file(`${REPO}units/${args.id}.md`).text();
          return { content: [{ type: 'text', text: md.slice(0, 7000) }] };
        } catch { return { content: [{ type: 'text', text: 'no unit body for ' + args.id }] }; }
      }
      const d = args.date || new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
      try {
        const md = await Bun.file(`${REPO}posts/${d}.md`).text();
        return { content: [{ type: 'text', text: md.slice(0, 7000) }] };
      } catch { return { content: [{ type: 'text', text: 'no page for ' + d }] }; }
    }),
    // המנטור's own instruments. get_mistakes is the same four-signal split the
    // client computes in mentorQueue(); it is recomputed here rather than trusted
    // from the request, so the model cannot be handed a fabricated diagnosis.
    tool('get_mistakes', 'The four measured signals: wrong-and-certain, wrong-and-unsure, right-and-unsure, and repeatedly leaked. Read this BEFORE forming any view of what the learner believes', {}, async () => {
      const st = await getState();
      const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
      const rows: string[] = [];
      for (const [id, b] of Object.entries<any>(st.beliefs || {}))
        if (b.status === 'corrected' && b.retest && b.retest <= today)
          rows.push(`RETEST DUE | ${id} | believed: ${b.believed} | corrected ${b.opened}`);
      for (const [id, a] of Object.entries<any>(st.answers || {})) {
        if (!a) continue;
        const label = a.q || id;
        if (a.ok === false && a.conf != null && a.conf >= 70)
          rows.push(`WRONG+CERTAIN (${a.conf}%) | ${id} | ${label} | skill ${a.skill} | ${a.date}`);
        else if (a.ok === false)
          rows.push(`WRONG+UNSURE (${a.conf ?? '-'}%) | ${id} | ${label} | skill ${a.skill} | ${a.date}`);
        else if (a.ok && a.attempts === 1 && a.conf != null && a.conf <= 40)
          rows.push(`RIGHT+UNSURE (${a.conf}%) | ${id} | ${label} | skill ${a.skill} | ${a.date}`);
      }
      for (const [id, r] of Object.entries<any>(st.reviews || {}))
        if ((r?.lapses || 0) >= 2) rows.push(`LEAKED x${r.lapses} | ${id}`);
      const beliefs = Object.entries<any>(st.beliefs || {})
        .map(([id, b]) => `${id}: ${b.status} | believed: ${b.believed} | actual: ${b.actual}`);
      return { content: [{ type: 'text', text:
        (rows.length ? rows.join('\n') : 'no measured signal yet') +
        '\n\nBELIEF LEDGER:\n' + (beliefs.length ? beliefs.join('\n') : 'empty') }] };
    }),
    tool('open_belief', 'Record a misconception ONLY after the learner has confirmed in his own words that this is what he believed. Never open one from an assumption', {
      id: z.string().describe('stable kebab id, e.g. isolation-serial'),
      believed: z.string().describe("what he actually said he believed, in his words, Hebrew"),
      actual: z.string().describe('what is true, one or two sentences, Hebrew'),
      from: z.array(z.string()).optional()
        .describe('the answer or review ids this came from, e.g. ["u-m0-streams-q1"]. Without it the same row keeps resurfacing after you have worked through it'),
      retestDays: z.number().optional().describe('days until a cold re-check, default 7')
    }, async (args) => {
      const st = await getState();
      st.beliefs = st.beliefs || {};
      const now = new Date(Date.now() + 3 * 3600e3);
      const retest = new Date(now.getTime() + (args.retestDays ?? 7) * 864e5);
      st.beliefs[args.id] = {
        believed: String(args.believed).slice(0, 400),
        actual: String(args.actual).slice(0, 400),
        opened: now.toISOString().slice(0, 10),
        status: 'open',
        retest: retest.toISOString().slice(0, 10),
        from: Array.isArray(args.from) ? args.from.slice(0, 8) : [],
        src: 'mentor'
      };
      st.ts = Date.now();
      await putState(st);
      return { content: [{ type: 'text', text: `נרשם: ${args.id}, בדיקה חוזרת ב-${st.beliefs[args.id].retest}` }] };
    }),
    tool('close_belief', 'Move a belief to corrected (he restated it right), retested (a later cold check passed) or relapsed (it came back)', {
      id: z.string(),
      status: z.enum(['corrected', 'retested', 'relapsed'])
    }, async (args) => {
      const st = await getState();
      if (!st.beliefs || !st.beliefs[args.id])
        return { content: [{ type: 'text', text: 'no such belief: ' + args.id }] };
      st.beliefs[args.id].status = args.status;
      if (args.status === 'corrected' || args.status === 'relapsed') {
        const d = new Date(Date.now() + 3 * 3600e3 + 7 * 864e5);
        st.beliefs[args.id].retest = d.toISOString().slice(0, 10);
      }
      st.ts = Date.now();
      await putState(st);
      return { content: [{ type: 'text', text: `${args.id} -> ${args.status}` }] };
    }),
    tool('get_inbox', 'Open items the learner dropped into inbox.md. A line ending in a question mark is measured evidence of a gap', {}, async () => {
      try {
        const raw = await Bun.file(`${REPO}inbox.md`).text();
        const open = raw.split('## Open')[1]?.split('## Routed')[0] || '';
        const lines = open.split('\n').map(l => l.trim())
          .filter(l => l && !l.startsWith('<!--'));
        return { content: [{ type: 'text', text: lines.join('\n') || 'inbox empty' }] };
      } catch { return { content: [{ type: 'text', text: 'no inbox' }] }; }
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

const MENTOR = `אתה "המנטור" של הסדנה, אצל שובל בנג'ר (מהנדס AI, עברית + מונחים באנגלית).
אתה לא המורה. המורה מסביר נושא ומדרג תשובה. אתה עובד על הדפוס: מה הוא מאמין, למה הוא האמין בזה, ומה נשאר אחרי שבוע.

הכלל הראשון, והוא גובר על כל השאר: אל תניח מה הוא חושב. אתה רואה תשובות וביטחון, לא סיבות.
- לפני כל תיקון, שאל שאלה אחת שמבררת מה הוא באמת חשב. שאלה אחת, לא שלוש.
- כשאתה כן מנסח קריאה שלך, אמור אותה כהשערה עם רמת ביטחון משלך: "אני מנחש בביטחון בינוני ש...". אם הביטחון שלך נמוך, אל תנסח קריאה בכלל, רק תשאל.
- אל תפתח belief ברישום לפני שהוא אישר במילים שלו שזה מה שהוא חשב. open_belief אחרי אישור, לא לפניו. תמיד העבר ב-from את מזהי התשובות שממנו זה עלה, אחרת אותה שורה תחזור אליו שוב ושוב.
- אם הוא אומר שקראת אותו לא נכון, זה נתון, לא ויכוח. תודה ותשאל מחדש.

ארבעת המצבים שאתה מקבל מ-get_mistakes, ולכל אחד תגובה אחרת:
- WRONG+CERTAIN: אמונה, לא חור. זה מה שהכי שווה את הזמן. בירור, ואז תיקון מדויק, ואז retest.
- WRONG+UNSURE: פשוט לא ידע. תלמד את זה קצר וישר, בלי דרמה. זו לא טעות אופי.
- RIGHT+UNSURE: ידע ולא האמין. כאן אתה מרגיע, ובראיות: תראה לו שהוא ענה נכון מהניסיון הראשון. אל תשבח סתם, תצביע על הנתון.
- LEAKED: דליפה בזיכרון, לא אי-הבנה. אל תסביר מחדש מאפס, תשאל אותו קר ותתזמן חזרה.

סגנון: עברית, מונחים באנגלית, תמציתי. בלי אימוג'ים, בלי קווים מפרידים, בלי שבחים ריקים.
נושא אחד בשיחה. אל תערום שלוש בעיות בהודעה אחת.
אתה מותר לומר "אני לא יודע למה טעית שם" ולשאול.
כשמשהו נסגר: close_belief. כשמשהו שווה שמירה: save_note.`;

const SYSTEM = `אתה "המורה" של הסדנה, מערכת הלמידה של שובל בנג'ר (מהנדס AI, עברית + מונחים באנגלית).
תפקידך: להסביר לעומק ברמת gadial, לדרג תשובות חופשיות בכנות (ציון 1-10 + מה חסר + מה היה משכנע מראיין), ולחבר לפרויקטים שלו (MatchIQ, agenteval-bench, mcp-guard, Azure Foundry, Seekapa gateway).
יש לך כלים: get_state (מצב הלומד), get_today_page (דף היום), save_note (שמירת הערה לאוצר). השתמש בהם כשרלוונטי, במיוחד get_state לפני דירוג והתאמת רמה.
סגנון: תמציתי וישיר, בלי אימוג'ים, בלי קווים מפרידים. כשמדרגים: קשוח והוגן.`;

const TOOLS_TEACHER = ['mcp__sadna__get_state', 'mcp__sadna__get_lesson', 'mcp__sadna__save_note'];
const TOOLS_MENTOR = ['mcp__sadna__get_state', 'mcp__sadna__get_mistakes', 'mcp__sadna__get_inbox',
                      'mcp__sadna__get_lesson', 'mcp__sadna__open_belief',
                      'mcp__sadna__close_belief', 'mcp__sadna__save_note'];

type ChatMsg = { role: 'user' | 'bot'; text: string };
type ChatContext = Record<string, unknown>;

async function runAgent(message: string, history: ChatMsg[], context: ChatContext,
                        verify: boolean, persona: string): Promise<string> {
  const mentor = persona === 'mentor';
  const who = mentor ? 'המנטור: ' : 'המורה: ';
  const hist = (history || []).slice(-8)
    .map(m => (m.role === 'user' ? 'שובל: ' : who) + m.text).join('\n');
  const prompt = `${hist ? 'שיחה עד כה:\n' + hist + '\n\n' : ''}הקשר באפליקציה: ${JSON.stringify(context || {})}\nשובל: ${message}`;
  const ac = new AbortController();
  const killer = setTimeout(() => ac.abort(), 150000);
  let result = '';
  try {
    for await (const msg of query({
      prompt,
      options: {
        systemPrompt: mentor ? MENTOR : SYSTEM,
        mcpServers: { sadna: sadnaTools },
        allowedTools: mentor ? TOOLS_MENTOR : TOOLS_TEACHER,
        permissionMode: 'bypassPermissions',
        maxTurns: mentor ? 8 : 6,
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
      const critique = mentor
        ? `אתה המבקר. בדוק את תשובת המנטור הבאה על כלל אחד: האם היא מניחה מה שובל חושב בלי ששובל אמר את זה. אם היא קובעת קריאה פסיכולוגית בלי ראיה, או מתקנת לפני שביררה, החזר גרסה שמתחילה בשאלה אחת במקום. אם היא בסדר, החזר אותה כלשונה. בלי הערות מטא.`
        : `אתה המבקר. בדוק את תשובת המורה הבאה (דיוק עובדתי, הוגנות הדירוג, מה חסר). אם היא טובה, החזר אותה כלשונה. אם לא, החזר גרסה מתוקנת בלבד, בלי הערות מטא.`;
      for await (const msg of query({
        prompt: `${critique}\n\nשאלת שובל: ${message}\n\nהתשובה:\n${result}`,
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
      // Boundary: the request is untrusted, so history is filtered to the shape
      // runAgent declares rather than cast into it.
      const history: ChatMsg[] = (Array.isArray(body.history) ? body.history : [])
        .filter((m: unknown): m is ChatMsg =>
          !!m && typeof (m as ChatMsg).text === 'string' &&
          ((m as ChatMsg).role === 'user' || (m as ChatMsg).role === 'bot'))
        .slice(-10);
      let context: ChatContext = (body.context && typeof body.context === 'object') ? body.context : {};
      if (JSON.stringify(context).length > 1500) context = { note: 'context too large, dropped' };
      const persona = body.persona === 'mentor' ? 'mentor' : 'teacher';
      // המנטור always gets the presumption check. It is the one rule the feature
      // exists for, so it is not left to a client flag.
      const reply = await runAgent(body.message, history, context, !!body.verify || persona === 'mentor', persona);
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
// The boundary tests only ever reach http://localhost:8788, so running them does
// not require publishing anything. The tunnel is the outward-facing half: it
// exposes this daemon on a public trycloudflare hostname and overwrites
// daemon_url in shared state, which is also what breaks the phone's saved
// endpoint on every restart. SADNA_NO_TUNNEL=1 starts the daemon local-only, for
// tests and for working on the agent without republishing.
if (process.env.SADNA_NO_TUNNEL === '1') {
  console.log('tunnel skipped (SADNA_NO_TUNNEL=1): local only, daemon_url left untouched');
} else {
  tunnel().catch(e => console.error('tunnel failed', e));
}
