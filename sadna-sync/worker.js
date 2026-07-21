const ORIGIN = 'https://daily-deep-learning.pages.dev';
const cors = {
  'access-control-allow-origin': ORIGIN,
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET,POST,OPTIONS'
};

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const auth = req.headers.get('authorization') || '';
    if (auth !== 'Bearer ' + env.SYNC_KEY) return new Response('unauthorized', { status: 401, headers: cors });

    if (req.method === 'POST') {
      const body = await req.text();
      if (body.length > 300000) return new Response('too big', { status: 413, headers: cors });
      try { JSON.parse(body); } catch (e) { return new Response('not json', { status: 400, headers: cors }); }
      await env.STATE.put('state', body);
      return new Response('ok', { headers: cors });
    }

    const text = (await env.STATE.get('state')) || '{}';
    return new Response(text, { headers: { ...cors, 'content-type': 'application/json' } });
  }
};
