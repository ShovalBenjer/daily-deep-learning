// The untrusted-input boundary of the teacher daemon, kept separate from the
// server so it can be tested without booting one.
//
// server.ts opens a port, reads a bearer key off disk and spawns a cloudflared
// tunnel at import time. Importing it from a test would do all three. This
// module has no side effects at import, so tests/fuzz.test.ts can throw two
// thousand hostile bodies at the parser with no network, no key and no rate
// limiter in the way.

export type ChatMsg = { role: 'user' | 'bot'; text: string };
export type ChatContext = Record<string, unknown>;

export type ParsedChat =
  | { ok: false; error: string }
  | { ok: true; message: string; history: ChatMsg[]; context: ChatContext;
      persona: 'teacher' | 'mentor'; verify: boolean };

//: Documented limits. The tests assert against these names, so the contract and
//: the enforcement cannot drift apart silently.
export const MAX_MESSAGE = 4000;
export const MAX_HISTORY = 10;
export const MAX_CONTEXT_CHARS = 1500;

/**
 * Parse and validate an untrusted /chat body.
 *
 * Purpose: this daemon is reachable from the public internet through a
 * cloudflared tunnel, and behind it sits an agent runtime holding tools that
 * write learner state. Every field arriving here is hostile until proven
 * otherwise.
 *
 * Contracts: total function. Any input at all, including null, a bare string, an
 * array, an object with a poisoned prototype, an object whose toString throws,
 * or deeply nested junk, yields either a rejection carrying a reason or a value
 * whose shape runAgent declares. It never throws and never returns a partially
 * valid object.
 *
 * - message: required, non-blank, at most MAX_MESSAGE characters.
 * - history: non-conforming entries are DROPPED rather than rejected, because a
 *   single corrupt entry in a client's scrollback should not cost the learner
 *   their reply. The LAST MAX_HISTORY are kept.
 * - context: must be a plain object; an array is not one for this purpose. Over
 *   MAX_CONTEXT_CHARS serialised it is replaced by an honest marker rather than
 *   truncated, since half a JSON blob is worse than a note saying it was
 *   dropped. A context that cannot be serialised at all is treated as oversized.
 * - persona: a closed set. Anything that is not exactly "mentor" is the teacher.
 *
 * Args:
 *     body: whatever JSON.parse produced, or null when parsing failed.
 *
 * Returns:
 *     A discriminated union. Callers must check `ok` before reading anything.
 */
export function parseChatRequest(body: unknown): ParsedChat {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return { ok: false, error: `message required (1-${MAX_MESSAGE} chars)` };

  const b = body as Record<string, unknown>;
  const message = b.message;
  if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE)
    return { ok: false, error: `message required (1-${MAX_MESSAGE} chars)` };

  const history: ChatMsg[] = (Array.isArray(b.history) ? b.history : [])
    .filter((m: unknown): m is ChatMsg =>
      !!m && typeof m === 'object' && !Array.isArray(m) &&
      typeof (m as ChatMsg).text === 'string' &&
      ((m as ChatMsg).role === 'user' || (m as ChatMsg).role === 'bot'))
    .slice(-MAX_HISTORY);

  let context: ChatContext = {};
  if (b.context && typeof b.context === 'object' && !Array.isArray(b.context)) {
    context = b.context as ChatContext;
    let size: number;
    try { size = JSON.stringify(context).length; } catch { size = Infinity; }
    if (size > MAX_CONTEXT_CHARS) context = { note: 'context too large, dropped' };
  }

  return {
    ok: true,
    message,
    history,
    context,
    persona: b.persona === 'mentor' ? 'mentor' : 'teacher',
    verify: !!b.verify,
  };
}
