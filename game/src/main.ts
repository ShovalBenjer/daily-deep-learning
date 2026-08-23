/**
 * POC boot: city + drill sheet. The loop is the Cowork coach's loop made
 * playable: story, prediction, write real SQL, run it on the seeded DuckDB,
 * grade by result-set match against the reference, then the verbal answer
 * and the analyst read. A passing drill lights its lamp; progress persists
 * in localStorage under 'lamps-poc'.
 */
import { initDb, runSql, canonical, SqlResult } from './db';
import { drills, schemaNote, SqlDrill, CaseDrill } from './drills';
import { buildCity, CityHandles, LampState } from './city';

const $ = (s: string) => document.querySelector(s) as HTMLElement;

type Progress = Record<string, 'attempted' | 'passed'>;
const loadP = (): Progress => { try { return JSON.parse(localStorage.getItem('lamps-poc') || '{}'); } catch { return {}; } };
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

function renderTable(res: SqlResult): string {
  const head = res.columns.map(c => `<th>${c}</th>`).join('');
  const body = res.rows.slice(0, 40).map(r => `<tr>${r.map(v => `<td>${fmt(v)}</td>`).join('')}</tr>`).join('');
  const more = res.rows.length > 40 ? `<p class="muted">…ועוד ${res.rows.length - 40} שורות</p>` : '';
  return `<div class="tblwrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>${more}`;
}

async function loadBank(id: string): Promise<string> {
  try {
    const r = await fetch(`/bank/${id}.json`);
    if (!r.ok) throw 0;
    const items: { source: string; excerpt: string }[] = await r.json();
    return items.map(i => `<blockquote><p>${i.excerpt}</p><cite>${i.source}</cite></blockquote>`).join('');
  } catch {
    return '<p class="muted">בנק העיון ריק. הרץ <code>python3 tools/build_bank.py</code> (הקטעים נשארים מקומיים, מחוץ ל-git).</p>';
  }
}

function openSql(d: SqlDrill) {
  const sheet = $('#sheet');
  sheet.innerHTML = `
    <button class="close" id="closeBtn">סגור</button>
    <h2>${d.title}</h2>
    <p>${d.story}</p>
    <div class="block"><h3>הסכימה</h3><pre dir="ltr">${schemaNote}</pre></div>
    <div class="block"><h3>המשימה</h3><p>${d.task}</p></div>
    <div class="block pred"><h3>ניבוי לפני הרצה</h3><p>${d.prediction}</p></div>
    <textarea id="sql" dir="ltr" spellcheck="false">${d.starter}</textarea>
    <div class="row"><button id="runBtn" class="gold">הרץ</button><button id="studyBtn">עיון</button></div>
    <div id="out"></div>
    <div id="study" class="block" hidden><h3>מהספרים</h3><div id="bank"></div></div>
    <div id="verbal" hidden class="block">
      <h3>השאלה המילולית</h3><p>${d.verbalQ}</p>
      <button id="revealBtn">הצג תשובת מודל</button>
      <p id="verbalA" hidden>${d.verbalA}</p>
    </div>`;
  sheet.hidden = false;
  $('#closeBtn').onclick = () => { sheet.hidden = true; };
  $('#studyBtn').onclick = async () => { const s = $('#study'); s.hidden = !s.hidden; if (!s.hidden) $('#bank').innerHTML = await loadBank(d.id); };
  $('#runBtn').onclick = async () => {
    const sql = ($('#sql') as HTMLTextAreaElement).value;
    const out = $('#out');
    out.innerHTML = '<p class="muted">מריץ…</p>';
    if (progress[d.id] !== 'passed') { progress[d.id] = 'attempted'; saveP(progress); city.setLampState(d.id, stateOf(d.id)); }
    try {
      const res = await runSql(sql);
      const ref = await runSql(d.reference);
      const pass = canonical(res) === canonical(ref);
      out.innerHTML = renderTable(res) + (pass
        ? `<p class="verdict ok">הפנס נדלק. התוצאה זהה לרפרנס, אחד לאחד.</p><p class="analyst">${d.analystRead}</p>`
        : `<p class="verdict bad">רץ, אבל לא זהה לרפרנס (${res.rows.length} שורות מול ${ref.rows.length}). בדוק את החורים, את חלון הזמן, ואת סדר העמודות שהמשימה מגדירה. ומספר חשוד מדי? כמעט תמיד באג בשאילתה.</p>`);
      if (pass) {
        progress[d.id] = 'passed'; saveP(progress);
        city.setLampState(d.id, 'lit');
        $('#verbal').hidden = false;
        $('#revealBtn').onclick = () => { $('#verbalA').hidden = false; };
      }
    } catch (e) {
      out.innerHTML = `<p class="verdict bad">שגיאת SQL: <span dir="ltr">${(e as Error).message.slice(0, 300)}</span></p>`;
    }
  };
}

function openCase(d: CaseDrill) {
  const sheet = $('#sheet');
  sheet.innerHTML = `
    <button class="close" id="closeBtn">סגור</button>
    <h2>${d.title}</h2>
    <div class="block"><h3>המדיניות</h3><ol>${d.policy.map(p => `<li>${p}</li>`).join('')}</ol></div>
    <div class="block"><h3>התיק</h3><p>${d.caseFile}</p></div>
    <div class="row">${d.verdicts.map(v => `<button class="verdict-btn" data-v="${v}">${v}</button>`).join('')}</div>
    <div class="row" id="blocks">${d.policy.map((_, i) => `<button class="block-btn" data-b="${i + 1}">Block ${i + 1}</button>`).join('')}</div>
    <p class="muted">בחר פסיקה + את ה-Block שמנמק אותה, ואז אמור בקול את ההסבר של 30 השניות.</p>
    <div id="out"></div>`;
  sheet.hidden = false;
  $('#closeBtn').onclick = () => { sheet.hidden = true; };
  let verdict = '', block = 0;
  const judge = () => {
    if (!verdict || !block) return;
    if (progress[d.id] !== 'passed') { progress[d.id] = 'attempted'; saveP(progress); }
    const right = verdict === d.correctVerdict && block === d.correctBlock;
    $('#out').innerHTML = right
      ? `<p class="verdict ok">הפנס נדלק: ${d.correctVerdict} דרך Block ${d.correctBlock}.</p><p class="analyst">${d.modelRead}</p>`
      : `<p class="verdict bad">${verdict} דרך Block ${block} זו לא הקריאה של התיק הזה. קרא שוב אילו עובדות בתיק שייכות לאיזה Block, ונסה שוב.</p>`;
    if (right) { progress[d.id] = 'passed'; saveP(progress); city.setLampState(d.id, 'lit'); }
    else city.setLampState(d.id, stateOf(d.id));
  };
  sheet.querySelectorAll<HTMLButtonElement>('.verdict-btn').forEach(b => b.onclick = () => {
    verdict = b.dataset.v!; sheet.querySelectorAll('.verdict-btn').forEach(x => x.classList.remove('on')); b.classList.add('on'); judge();
  });
  sheet.querySelectorAll<HTMLButtonElement>('.block-btn').forEach(b => b.onclick = () => {
    block = Number(b.dataset.b); sheet.querySelectorAll('.block-btn').forEach(x => x.classList.remove('on')); b.classList.add('on'); judge();
  });
}

async function boot() {
  const canvas = document.getElementById('city') as HTMLCanvasElement;
  city = buildCity(canvas, drills.map(d => d.id));
  // dev hook for headless playtesting (agents drive drills without 3D picking)
  if (location.search.includes('dev')) {
    (window as unknown as Record<string, unknown>).__open = (id: string) => {
      const d = drills.find(x => x.id === id)!;
      if (d.kind === 'sql') openSql(d); else openCase(d);
    };
  }
  drills.forEach(d => city.setLampState(d.id, stateOf(d.id)));
  city.onLampTap(id => {
    const d = drills.find(x => x.id === id)!;
    if (d.kind === 'sql') openSql(d); else openCase(d);
  });
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
