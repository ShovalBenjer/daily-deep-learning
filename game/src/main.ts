/**
 * POC boot: city + drill sheets. Two content streets:
 *
 * The drill street (fintech world, seeded DuckDB) now teaches instead of
 * examining: each drill's holes carry a ladder (nudge, then a runnable
 * diagnostic query, then reveal), "בדוק חורים" grades each hole separately
 * with praise the moment it closes, and a failed run points at the first
 * open hole instead of buzzing. Execution against the reference stays the
 * final truth oracle.
 *
 * The book shelf (bank/book-drills.json, generated from the operator's own
 * corpus by tools/gen_drills.py) renders as smaller lamps behind the
 * street: each is a real query from the book with one load-bearing clause
 * masked, answered by choice among clause-family distractors mined from
 * the same corpus; a wrong pick quotes the book's own prose as the hint
 * and the drill stays open.
 *
 * Rendering contract (review panel 2026-08-24): no innerHTML anywhere;
 * every dynamic value enters the DOM as a text node via el().
 */
import { initDb, runSql, canonical, SqlResult } from './db';
import { drills, schemaNote, SqlDrill, CaseDrill, Hole } from './drills';
import { buildCity, CityHandles, LampState, LampSpec } from './city';
import {
  review, retrievability, shiftGain, embers, endShift,
  hasLamplighter, buyLamplighter, lamplighterRound, LAMPLIGHTER_PRICE, DUE_RETENTION, Help,
} from './economy';

const $ = (s: string) => document.querySelector(s) as HTMLElement;

type Attrs = Record<string, string | boolean | ((e: Event) => void)>;
function el(tag: string, attrs: Attrs = {}, ...children: (Node | string)[]): HTMLElement {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') (n as unknown as Record<string, unknown>)[k] = v;
    else if (typeof v === 'boolean') { if (v) n.setAttribute(k, ''); }
    else n.setAttribute(k, v);
  }
  for (const c of children) n.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return n;
}

interface BookDrill {
  id: string; source: string; section: string; prose: string;
  sqlMasked: string; maskLabel: string; options: string[]; correct: number;
}

type Progress = Record<string, 'attempted' | 'passed'>;
const loadP = (): Progress => {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem('lamps-poc') || '{}');
    const out: Progress = {};
    if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (v === 'attempted' || v === 'passed') out[k] = v;
      }
    }
    return out;
  } catch { return {}; }
};
const saveP = (p: Progress) => { try { localStorage.setItem('lamps-poc', JSON.stringify(p)); } catch { /* private mode */ } };

let city: CityHandles;
let progress = loadP();
let bookDrills: BookDrill[] = [];

const stateOf = (id: string): LampState =>
  progress[id] === 'passed' ? 'lit' : progress[id] === 'attempted' ? 'flicker' : 'dark';

function fmt(v: unknown): string {
  if (typeof v === 'bigint') return String(v);
  if (typeof v === 'number') {
    // DuckDB hands TIMESTAMP/DATE back as epoch millis; humanize anything
    // that lands between 2000 and 2100, a range no drill amount reaches.
    if (Number.isInteger(v) && v > 946684800000 && v < 4102444800000) return new Date(v).toISOString().slice(0, 10);
    return Number.isInteger(v) ? String(v) : v.toFixed(4);
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

function renderTable(res: SqlResult): HTMLElement {
  const thead = el('thead', {}, el('tr', {}, ...res.columns.map(c => el('th', {}, c))));
  const tbody = el('tbody', {}, ...res.rows.slice(0, 40).map(r =>
    el('tr', {}, ...r.map(v => el('td', {}, fmt(v))))));
  const wrap = el('div', { class: 'tblwrap' }, el('table', {}, thead, tbody));
  const box = el('div', {}, wrap);
  if (res.rows.length > 40) box.append(el('p', { class: 'muted' }, `ועוד ${res.rows.length - 40} שורות`));
  return box;
}

/* ---------- the ember economy (see src/economy.ts for the grounding) ---------- */
function paintEcon() {
  const n = $('#econ');
  const gain = shiftGain();
  const bank = embers();
  n.textContent = (gain > 0 || bank > 0)
    ? `משמרת: +${gain.toFixed(1)} ימי יציבות · גחלים: ${bank}`
    : '';
  ($('#endShift') as HTMLButtonElement).hidden = gain < 0.5;
  const shop = $('#shopBtn') as HTMLButtonElement;
  if (hasLamplighter()) { shop.hidden = false; shop.disabled = true; shop.textContent = 'הפנסאי פועל'; }
  else if (bank >= LAMPLIGHTER_PRICE) { shop.hidden = false; shop.disabled = false; shop.textContent = `שכור פנסאי (${LAMPLIGHTER_PRICE} גחלים)`; }
  else shop.hidden = true;
}

/** Grade-by-help for the pass being recorded; escalates monotonically. */
function makeHelpTracker() {
  const order: Help[] = ['none', 'hint', 'reveal'];
  let level: Help = 'none';
  return {
    escalate(to: Help) { if (order.indexOf(to) > order.indexOf(level)) level = to; },
    level() { return level; },
  };
}

function lampStateFromMemory(id: string): LampState {
  // lit is a PASSED-only state: a failed-and-abandoned drill has a card
  // whose post-review retrievability is ~1, and without this guard it
  // painted the lamp lit (PR #10 second-round High)
  if (progress[id] !== 'passed') return stateOf(id);
  const r = retrievability(id);
  if (r === null) return stateOf(id);
  if (r >= DUE_RETENTION) return 'lit';
  if (r >= 0.6) return 'flicker';
  return 'dark';
}

function markDone(id: string, help: Help) {
  const gained = review(id, help);
  progress[id] = 'passed'; saveP(progress);
  city.setLampState(id, 'lit');
  paintEcon();
  return gained;
}
const attemptedNow = new Set<string>();
function markTried(id: string) {
  attemptedNow.add(id);
  if (progress[id] !== 'passed') { progress[id] = 'attempted'; saveP(progress); city.setLampState(id, stateOf(id)); }
}

/**
 * Closing a sheet after attempting without passing records Again: walking
 * away from a failed drill is retrieval evidence too (this is the caller
 * the 'fail' grade was documented for; PR #10 warning).
 */
function closeBtn(id: string): HTMLElement {
  return el('button', { class: 'close', onclick: () => {
    if (attemptedNow.has(id) && progress[id] !== 'passed') { review(id, 'fail'); paintEcon(); }
    attemptedNow.delete(id);
    $('#sheet').hidden = true;
    city.setLampState(id, lampStateFromMemory(id));
  } }, 'סגור');
}
function returnToCity(id: string) {
  $('#sheet').hidden = true;
  city.pulseLamp(id); // the performed moment happens where you can see it
}
function returnBtn(id: string, extra = ''): HTMLElement {
  return el('button', { class: 'gold', onclick: () => returnToCity(id) }, extra || 'חזרה לעיר');
}

function block(title: string, ...children: (Node | string)[]): HTMLElement {
  return el('div', { class: 'block' }, el('h3', {}, title), ...children);
}

/* ---------- the guided hole ladder ---------- */

function holePanel(d: SqlDrill, ta: HTMLTextAreaElement, onHelp: (h: Help) => void): HTMLElement {
  const rung = new Map<Hole, number>(); // 0 untouched, 1 nudged, 2 diagnosed, 3 revealed
  const rows = d.holes.map(h => {
    const chip = el('span', { class: 'hole-chip' }, h.label);
    const msg = el('div', { class: 'hole-msg' });
    const more = el('button', { class: 'hole-more', onclick: async () => {
      const r = (rung.get(h) || 1) + 1;
      rung.set(h, r);
      onHelp(r >= 3 || !h.diagnostic ? 'reveal' : 'hint');
      if (r === 2 && h.diagnostic) {
        const res = el('div', {});
        msg.replaceChildren(
          el('p', {}, 'כלי אבחון, בדיוק מה שהיית עושה בעבודה:'),
          el('pre', { dir: 'ltr' }, h.diagnostic),
          el('button', { onclick: async () => { try { res.replaceChildren(renderTable(await runSql(h.diagnostic!))); } catch { res.replaceChildren(el('p', { class: 'muted' }, 'האבחון נכשל להריץ.')); } } }, 'הרץ אבחון'),
          res, more);
      } else {
        msg.replaceChildren(el('p', {}, 'הפתרון לחור הזה:'), el('pre', { dir: 'ltr' }, h.reveal),
          el('p', { class: 'muted' }, 'העתק פנימה, ותגיד בקול למה זו הצורה.'));
      }
    } }, 'עוד עזרה');
    return { h, chip, msg, more, row: el('div', { class: 'hole-row' }, chip, msg) };
  });

  const grade = () => {
    let allGood = true;
    for (const r of rows) {
      const ok = r.h.check(ta.value);
      r.chip.classList.toggle('ok', ok);
      if (ok) {
        r.msg.replaceChildren(el('p', { class: 'praise' }, r.h.praise));
      } else {
        allGood = false;
        onHelp('hint');
        if (!rung.get(r.h)) rung.set(r.h, 1);
        if (rung.get(r.h) === 1) r.msg.replaceChildren(el('p', {}, r.h.nudge), r.more);
      }
    }
    return allGood;
  };

  const panel = block('החורים', ...rows.map(r => r.row));
  panel.classList.add('holes');
  (panel as HTMLElement & { grade: () => boolean }).grade = grade;
  return panel;
}

/* ---------- drill sheets ---------- */

function openSql(d: SqlDrill) {
  const sheet = $('#sheet');
  sheet.replaceChildren();
  const ta = el('textarea', { id: 'sql', dir: 'ltr', spellcheck: 'false' }) as HTMLTextAreaElement;
  ta.value = d.starter;
  const out = el('div', { id: 'out', 'aria-live': 'polite' });
  const help = makeHelpTracker();
  const holes = holePanel(d, ta, help.escalate) as HTMLElement & { grade: () => boolean };
  const verbalA = el('p', {}, d.verbalA); verbalA.hidden = true;
  const verbal = block('השאלה המילולית', el('p', {}, d.verbalQ),
    el('button', { onclick: () => { verbalA.hidden = false; } }, 'הצג תשובת מודל'), verbalA);
  verbal.hidden = true;

  let running = false;
  const run = async () => {
    if (running) return;  // a double-tap must not race two grades onto one verdict
    running = true;
    out.replaceChildren(el('p', { class: 'muted' }, 'מריץ…'));
    markTried(d.id);
    try {
      const res = await runSql(ta.value);
      const ref = await runSql(d.reference);
      const pass = canonical(res) === canonical(ref);
      if (pass) {
        const gained = markDone(d.id, help.level());
        out.replaceChildren(renderTable(res),
          el('p', { class: 'verdict ok' }, `הפנס נדלק. התוצאה זהה לרפרנס, אחד לאחד. +${gained.toFixed(1)} ימי יציבות.`),
          el('p', { class: 'analyst' }, d.analystRead),
          returnBtn(d.id, 'חזרה לעיר, לראות אותו נדלק'));
        verbal.hidden = false;
      } else {
        help.escalate('hint');
        holes.grade();
        const firstOpen = d.holes.find(h => !h.check(ta.value));
        out.replaceChildren(renderTable(res),
          el('p', { class: 'verdict bad' }, firstOpen
            ? `רץ, והכיוון נכון, אבל התוצאה עוד לא זהה לרפרנס (${res.rows.length} שורות מול ${ref.rows.length}). תתחיל מהחור "${firstOpen.label}" למעלה.`
            : `רץ, כל החורים נראים במקום, אבל התוצאה שונה (${res.rows.length} שורות מול ${ref.rows.length}). בדוק את סדר העמודות ואת ה-ORDER BY שהמשימה מגדירה, ומספר חשוד מדי הוא כמעט תמיד באג.`));
      }
    } catch (e) {
      out.replaceChildren(el('p', { class: 'verdict bad' },
        'שגיאת SQL: ', el('span', { dir: 'ltr' }, (e as Error).message.slice(0, 300))));
    } finally {
      running = false;
    }
    // the verdict must never render below the sheet's fold unseen
    out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  sheet.append(
    closeBtn(d.id),
    el('h2', {}, d.title),
    el('p', {}, d.story),
    block('הסכימה', el('pre', { dir: 'ltr' }, schemaNote)),
    block('המשימה', el('p', {}, d.task)),
    (() => { const b = block('ניבוי לפני הרצה', el('p', {}, d.prediction)); b.classList.add('pred'); return b; })(),
    holes,
    ta,
    el('div', { class: 'row' },
      el('button', { id: 'checkBtn', onclick: () => { holes.grade(); } }, 'בדוק חורים'),
      el('button', { id: 'runBtn', class: 'gold', onclick: run }, 'הרץ')),
    out, verbal);
  sheet.hidden = false;
}

function openCase(d: CaseDrill) {
  const sheet = $('#sheet');
  sheet.replaceChildren();
  const out = el('div', { id: 'out', 'aria-live': 'polite' });
  const help = makeHelpTracker();
  let verdict = '', blockNo = 0;
  const judge = () => {
    if (!verdict || !blockNo) return;
    markTried(d.id);
    const right = verdict === d.correctVerdict && blockNo === d.correctBlock;
    if (right) {
      const gained = markDone(d.id, help.level());
      out.replaceChildren(
        el('p', { class: 'verdict ok' }, `הפנס נדלק: ${d.correctVerdict} דרך Block ${d.correctBlock}. +${gained.toFixed(1)} ימי יציבות.`),
        el('p', { class: 'analyst' }, d.modelRead),
        returnBtn(d.id, 'חזרה לעיר, לראות אותו נדלק'));
    } else {
      help.escalate('hint');
      out.replaceChildren(el('p', { class: 'verdict bad' },
        `${verdict} דרך Block ${blockNo} זו לא הקריאה של התיק הזה. קרא שוב אילו עובדות בתיק שייכות לאיזה Block, ונסה שוב.`));
    }
    out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const pick = (cls: string, set: () => void) => (e: Event) => {
    set();
    sheet.querySelectorAll('.' + cls).forEach(x => x.classList.remove('on'));
    (e.currentTarget as HTMLElement).classList.add('on');
    judge();
  };
  sheet.append(
    closeBtn(d.id),
    el('h2', {}, d.title),
    block('המדיניות', el('ol', {}, ...d.policy.map(p => el('li', {}, p)))),
    block('התיק', el('p', {}, d.caseFile)),
    el('div', { class: 'row' }, ...d.verdicts.map(v =>
      el('button', { class: 'verdict-btn', onclick: pick('verdict-btn', () => { verdict = v; }) }, v))),
    el('div', { class: 'row' }, ...d.policy.map((_, i) =>
      el('button', { class: 'block-btn', onclick: pick('block-btn', () => { blockNo = i + 1; }) }, `Block ${i + 1}`))),
    el('p', { class: 'muted' }, 'בחר פסיקה + את ה-Block שמנמק אותה, ואז אמור בקול את ההסבר של 30 השניות.'),
    out);
  sheet.hidden = false;
}

function openBook(d: BookDrill) {
  const sheet = $('#sheet');
  sheet.replaceChildren();
  const out = el('div', { id: 'out', 'aria-live': 'polite' });
  const next = () => {
    const remaining = bookDrills.find(b => progress[b.id] !== 'passed');
    if (remaining) openBook(remaining); else sheet.hidden = true;
  };
  const help = makeHelpTracker();
  const buttons = d.options.map((opt, i) => el('button', {
    class: 'opt-btn', dir: 'ltr',
    onclick: (e: Event) => {
      markTried(d.id);
      const btn = e.currentTarget as HTMLButtonElement;
      if (i === d.correct) {
        sheet.querySelectorAll<HTMLButtonElement>('.opt-btn').forEach(b => { b.disabled = true; });
        btn.classList.add('ok');
        const gained = markDone(d.id, help.level());
        out.replaceChildren(
          el('p', { class: 'verdict ok' }, `בדיוק. הפנס נדלק. +${gained.toFixed(1)} ימי יציבות.`),
          el('p', { class: 'analyst' }, `מהספר: ${d.prose.slice(0, 320)}`),
          el('div', { class: 'row' },
            el('button', { class: 'gold', onclick: next }, 'לפנס הבא במדף'),
            returnBtn(d.id)));
      } else {
        help.escalate('hint');
        btn.classList.add('bad'); btn.disabled = true;
        out.replaceChildren(
          el('p', { class: 'verdict bad' }, 'לא זה, ותשמע למה זה מבלבל:'),
          el('p', {}, `הרמז נמצא בטקסט של הספר עצמו: ${d.prose.slice(0, 260)}`),
          el('p', { class: 'muted' }, 'נסה שוב, נשארו אפשרויות.'));
      }
      out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
  }, opt));
  sheet.append(
    closeBtn(d.id),
    el('h2', {}, d.section || d.maskLabel),
    el('p', { class: 'muted' }, `מדף הספרים · ${d.source}`),
    block('מהספר', el('p', {}, d.prose)),
    block('השאילתה, עם חור אחד', el('pre', { dir: 'ltr' }, d.sqlMasked)),
    el('p', {}, `מה נכנס במקום הקו? (${d.maskLabel})`),
    el('div', { class: 'row opts' }, ...buttons),
    out);
  sheet.hidden = false;
}

function openDrill(id: string) {
  const d = drills.find(x => x.id === id);
  if (d) { if (d.kind === 'sql') openSql(d); else openCase(d); return; }
  const b = bookDrills.find(x => x.id === id);
  if (b) openBook(b);
}

async function boot() {
  try {
    const r = await fetch('/bank/book-drills.json');
    // an SPA-fallback server answers HTML with 200; demand actual JSON so a
    // broken bank is visible instead of silently empty
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) {
      const parsed: unknown = await r.json();
      if (Array.isArray(parsed)) bookDrills = parsed as BookDrill[];
    }
  } catch { /* shelf stays empty; the street still works */ }

  const canvas = document.getElementById('city') as HTMLCanvasElement;
  const specs: LampSpec[] = [
    ...drills.map(d => ({ id: d.id, row: 0 })),
    ...bookDrills.map(b => ({ id: b.id, row: 1 })),
  ];
  city = buildCity(canvas, specs);
  // dev hook for headless playtesting (agents drive drills without 3D picking)
  if (location.search.includes('dev')) {
    (window as unknown as Record<string, unknown>).__open = openDrill;
  }
  // lamp brightness IS live retrievability: FSRS decides what flickers
  specs.forEach(s => city.setLampState(s.id, lampStateFromMemory(s.id)));
  city.onLampTap(openDrill);
  const tended = lamplighterRound();
  if (tended) city.setLampState(tended, lampStateFromMemory(tended));
  paintEcon();
  ($('#endShift') as HTMLButtonElement).onclick = () => {
    const banked = endShift();
    $('#hint').textContent = `המשמרת נסגרה: ${banked} גחלים נכנסו לכיס.`;
    paintEcon();
  };
  ($('#shopBtn') as HTMLButtonElement).onclick = () => {
    if (buyLamplighter()) {
      $('#hint').textContent = 'הפנסאי נשכר: מעכשיו הוא מרענן את הפנס החלש ביותר פעם ביום.';
      paintEcon();
    }
  };
  const status = $('#status');
  try {
    await initDb(s => { status.textContent = s; });
    status.textContent = '';
    // set after initDb so the boot hint cannot overwrite it (PR #10 warning)
    const tendedNote = tended ? ' הפנסאי עבר בלילה וטיפל בפנס שדעך.' : '';
    $('#hint').textContent = (bookDrills.length
      ? `הקש על פנס ברחוב לתיק, או על מדף הספרים מאחור (${bookDrills.length} פנסים מהקורפוס).`
      : 'הקש על פנס ברחוב כדי לפתוח תיק.') + tendedNote;
  } catch (e) {
    status.textContent = 'המנוע לא עלה: ' + (e as Error).message.slice(0, 200);
  }
}

boot();
