/**
 * POC boot: city + drill sheet. The loop is the Cowork coach's loop made
 * playable: story, prediction, write real SQL, run it on the seeded DuckDB,
 * grade by result-set match against the reference, then the verbal answer
 * and the analyst read. A passing drill lights its lamp; progress persists
 * in localStorage under 'lamps-poc'.
 *
 * Rendering contract (review panel 2026-08-24): no innerHTML anywhere.
 * All markup is built with el(); every dynamic value (DB cells, SQL error
 * text, book excerpts) enters the DOM as a text node, so the XSS class the
 * panel flagged is closed by construction, not by sanitizer discipline.
 */
import { initDb, runSql, canonical, SqlResult } from './db';
import { drills, schemaNote, SqlDrill, CaseDrill } from './drills';
import { buildCity, CityHandles, LampState } from './city';

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

async function loadBank(id: string): Promise<HTMLElement> {
  try {
    const r = await fetch(`/bank/${id}.json`);
    if (!r.ok) throw new Error('no bank');
    const items: unknown = await r.json();
    const box = el('div', {});
    if (Array.isArray(items)) {
      for (const i of items as { source?: unknown; excerpt?: unknown }[]) {
        box.append(el('blockquote', {}, el('p', {}, String(i.excerpt ?? '')), el('cite', {}, String(i.source ?? ''))));
      }
    }
    return box;
  } catch {
    return el('p', { class: 'muted' },
      'בנק העיון ריק. הרץ ', el('code', {}, 'python3 tools/build_bank.py'),
      ' (הקטעים נשארים מקומיים, מחוץ ל-git).');
  }
}

function block(title: string, ...children: (Node | string)[]): HTMLElement {
  return el('div', { class: 'block' }, el('h3', {}, title), ...children);
}

function openSql(d: SqlDrill) {
  const sheet = $('#sheet');
  sheet.replaceChildren();
  const ta = el('textarea', { id: 'sql', dir: 'ltr', spellcheck: 'false' }) as HTMLTextAreaElement;
  ta.value = d.starter;
  const out = el('div', { id: 'out', 'aria-live': 'polite' });
  const bank = el('div', { id: 'bank' });
  const study = block('מהספרים', bank); study.hidden = true;
  const verbalA = el('p', {}, d.verbalA); verbalA.hidden = true;
  const verbal = block('השאלה המילולית', el('p', {}, d.verbalQ),
    el('button', { onclick: () => { verbalA.hidden = false; } }, 'הצג תשובת מודל'), verbalA);
  verbal.hidden = true;

  let running = false;
  const run = async () => {
    if (running) return;  // a double-tap must not race two grades onto one verdict
    running = true;
    out.replaceChildren(el('p', { class: 'muted' }, 'מריץ…'));
    if (progress[d.id] !== 'passed') { progress[d.id] = 'attempted'; saveP(progress); city.setLampState(d.id, stateOf(d.id)); }
    try {
      const res = await runSql(ta.value);
      const ref = await runSql(d.reference);
      const pass = canonical(res) === canonical(ref);
      out.replaceChildren(renderTable(res), pass
        ? el('p', { class: 'verdict ok' }, 'הפנס נדלק. התוצאה זהה לרפרנס, אחד לאחד.')
        : el('p', { class: 'verdict bad' },
            `רץ, אבל לא זהה לרפרנס (${res.rows.length} שורות מול ${ref.rows.length}). ` +
            'בדוק את החורים, את חלון הזמן, ואת סדר העמודות שהמשימה מגדירה. ומספר חשוד מדי? כמעט תמיד באג בשאילתה.'));
      if (pass) {
        out.append(el('p', { class: 'analyst' }, d.analystRead));
        progress[d.id] = 'passed'; saveP(progress);
        city.setLampState(d.id, 'lit');
        verbal.hidden = false;
      }
      // the verdict must never render below the sheet's fold unseen
      out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {
      out.replaceChildren(el('p', { class: 'verdict bad' },
        'שגיאת SQL: ', el('span', { dir: 'ltr' }, (e as Error).message.slice(0, 300))));
    } finally {
      running = false;
    }
  };

  sheet.append(
    el('button', { class: 'close', onclick: () => { sheet.hidden = true; } }, 'סגור'),
    el('h2', {}, d.title),
    el('p', {}, d.story),
    block('הסכימה', el('pre', { dir: 'ltr' }, schemaNote)),
    block('המשימה', el('p', {}, d.task)),
    (() => { const b = block('ניבוי לפני הרצה', el('p', {}, d.prediction)); b.classList.add('pred'); return b; })(),
    ta,
    el('div', { class: 'row' },
      el('button', { id: 'runBtn', class: 'gold', onclick: run }, 'הרץ'),
      el('button', { onclick: async () => { study.hidden = !study.hidden; if (!study.hidden) bank.replaceChildren(await loadBank(d.id)); } }, 'עיון')),
    out, study, verbal);
  sheet.hidden = false;
}

function openCase(d: CaseDrill) {
  const sheet = $('#sheet');
  sheet.replaceChildren();
  const out = el('div', { id: 'out', 'aria-live': 'polite' });
  let verdict = '', blockNo = 0;
  const judge = () => {
    if (!verdict || !blockNo) return;
    if (progress[d.id] !== 'passed') { progress[d.id] = 'attempted'; saveP(progress); }
    const right = verdict === d.correctVerdict && blockNo === d.correctBlock;
    out.replaceChildren(right
      ? el('p', { class: 'verdict ok' }, `הפנס נדלק: ${d.correctVerdict} דרך Block ${d.correctBlock}.`)
      : el('p', { class: 'verdict bad' },
          `${verdict} דרך Block ${blockNo} זו לא הקריאה של התיק הזה. קרא שוב אילו עובדות בתיק שייכות לאיזה Block, ונסה שוב.`));
    if (right) {
      out.append(el('p', { class: 'analyst' }, d.modelRead));
      progress[d.id] = 'passed'; saveP(progress); city.setLampState(d.id, 'lit');
    } else city.setLampState(d.id, stateOf(d.id));
    out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const pick = (cls: string, set: () => void) => (e: Event) => {
    set();
    sheet.querySelectorAll('.' + cls).forEach(x => x.classList.remove('on'));
    (e.currentTarget as HTMLElement).classList.add('on');
    judge();
  };
  sheet.append(
    el('button', { class: 'close', onclick: () => { sheet.hidden = true; } }, 'סגור'),
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

function openDrill(id: string) {
  const d = drills.find(x => x.id === id);
  if (!d) return;
  if (d.kind === 'sql') openSql(d); else openCase(d);
}

async function boot() {
  const canvas = document.getElementById('city') as HTMLCanvasElement;
  city = buildCity(canvas, drills.map(d => d.id));
  // dev hook for headless playtesting (agents drive drills without 3D picking)
  if (location.search.includes('dev')) {
    (window as unknown as Record<string, unknown>).__open = openDrill;
  }
  drills.forEach(d => city.setLampState(d.id, stateOf(d.id)));
  city.onLampTap(openDrill);
  const status = $('#status');
  try {
    await initDb(s => { status.textContent = s; });
    status.textContent = '';
    $('#hint').textContent = 'הקש על פנס ברחוב כדי לפתוח תיק.';
  } catch (e) {
    status.textContent = 'המנוע לא עלה: ' + (e as Error).message.slice(0, 200);
  }
}

boot();
