// הסדנה daemon: chat + grading on the Claude subscription via the local CLI.
// Runs on the always-on PC. Exposes itself through a cloudflared quick tunnel
// and registers the tunnel URL into the sadna-sync state so the PWA finds it.
// Auth: the same sync bearer key. Run: bun daemon/server.ts

const PORT = 8788;
const SYNC_URL = 'https://sadna-sync.shovalb9.workers.dev';
const ORIGIN = 'https://daily-deep-learning.pages.dev';
const KEY = (await Bun.file(new URL('./.key', import.meta.url)).text()).trim();

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
    `${t}: first-try ${v.n ? Math.round(100 * v.ok / v.n) : 0}% of ${v.n}, avg confidence ${v.conf.length ? Math.round(v.conf.reduce((a, b) => a + b, 0) / v.conf.length) : '-'}`);
  const earned = Object.values<any>(st.points || {}).reduce((a: number, p: any) => a + (p.earned || 0), 0);
  return `points earned: ${earned}. per-tree: ${lines.join(' | ') || 'no answers yet'}. ranks: ${JSON.stringify(st.ranks || {})}`;
}

async function askClaude(prompt: string): Promise<string> {
  const proc = Bun.spawn(['cmd', '/c', 'claude', '-p', '--output-format', 'json', '--max-turns', '1'], {
    stdin: new Response(prompt), stdout: 'pipe', stderr: 'pipe'
  });
  const killer = setTimeout(() => proc.kill(), 120000);
  const out = await new Response(proc.stdout).text();
  clearTimeout(killer);
  try { return JSON.parse(out).result || out; } catch { return out.trim() || 'שגיאה: אין תשובה.'; }
}

Bun.serve({
  port: PORT,
  idleTimeout: 240,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (url.pathname === '/health') return new Response('ok', { headers: cors });
    if ((req.headers.get('authorization') || '') !== 'Bearer ' + KEY)
      return new Response('unauthorized', { status: 401, headers: cors });

    if (url.pathname === '/chat' && req.method === 'POST') {
      const body = await req.json().catch(() => null);
      if (!body || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 4000)
        return Response.json({ error: 'message required (1-4000 chars)' }, { status: 400, headers: cors });
      const state = await getState();
      const history = (body.history || []).slice(-8)
        .map((m: any) => (m.role === 'user' ? 'שובל: ' : 'המורה: ') + m.text).join('\n');
      const prompt = `אתה "המורה" של הסדנה, מערכת הלמידה האישית של שובל בנג'ר (מהנדס AI, עברית+אנגלית).
תפקידך: להסביר לעומק ברמת gadial, לדרג תשובות חופשיות בכנות (ציון 1-10 + מה חסר), ולחבר לפרויקטים שלו (MatchIQ, agenteval-bench, mcp-guard, Azure Foundry).
ענה תמציתי וישיר, עברית (מונחים טכניים באנגלית), בלי אימוג'ים, בלי קווים מפרידים.
מצב הלומד (אמיתי, מהמערכת): ${summarizeState(state)}
הקשר נוכחי באפליקציה: ${JSON.stringify(body.context || {})}
${history ? 'שיחה עד כה:\n' + history + '\n' : ''}שובל: ${body.message || ''}
המורה:`;
      const reply = await askClaude(prompt);
      return Response.json({ reply }, { headers: cors });
    }
    return new Response('not found', { status: 404, headers: cors });
  }
});
console.log('sadna daemon on :' + PORT);

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
      // keep draining so the pipe never blocks
      (async () => { for await (const _ of proc.stderr) {} })().catch(() => {});
      break;
    }
  }
}
tunnel().catch(e => console.error('tunnel failed', e));
