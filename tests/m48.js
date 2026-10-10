// 3.28.0 – Gründe für die Trade-Entscheidung (Mehrfachauswahl statt Setup) und Modus ECHT/DEMO.
// reasons: alte Einträge mit „setup“ werden verlustfrei zu einem Grund; Änderung durch eine ältere App-Version; Formular mit
//   Gruppen, Mehrfachauswahl und eigenem Grund; Karte, Bearbeiten, Schließen, Historie, Notiz mit Gründen, CSV; Auswertung
//   „Nach Grund“ und „Nach Bereich der Gründe“ ohne erhöhte Gesamtsumme; Hinweis „kein Handelssignal“.
// demo: Demo-Positionen mit erreichtem Stop und Ziel – kein Hinweis, Ton, Browser-Hinweis, Telegram/Discord, keine Übergabe an
//   den 24/7-Dienst, nicht im Gewinn-/Verlust-Alarm, Tages-Verlustlimit und in den Summen; eine echte Kontrollposition alarmiert
//   über alle Wege. Schließen in die richtige Historie, Demo-Historie getrennt (Auswertung, Steuer, Geld), Demo-CSV, Chart,
//   Wechsel ECHT ↔ DEMO beim Bearbeiten.
// backup: Neue Sicherung ohne Demo; lokale Originale bleiben. Alte Schema-7-Dateien mit Demo-Feldern weiterhin
//   wiederherstellen/abgleichen (Änderung, Löschung, ECHT → DEMO); Datei ohne Demo-Felder. sync: zweiter Tab übernimmt Demo sofort.
// reset: Zurücksetzen sichert persönliche Daten ohne Demo und entfernt alle Karten.
// Aufruf: node m48.js [reasons|demo|backup|sync|reset]
const h = require('./harness'), fs = require('fs'), path = require('path'), os = require('os');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', CHAT = '987654321', DC_URL = 'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_ABC-123';
const CHAN = { tg: { token: TOKEN, chat: CHAT, on: true }, dc: { url: DC_URL, on: true }, ev: { alarm: true, pos: true, day: true, news: false, pnl: true, pulse: false } };
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const until = async (fn, ms = 20000, step = 250) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
const real = errs => errs.filter(e => !/Service Worker registration blocked/.test(e));
const mock = p => fetch('http://127.0.0.1:8790' + p).then(r => r.json());
// Benachrichtigungen und Ton zählbar machen: Browser-Hinweise (Notification) und Töne (AudioContext.createOscillator)
const STUBS = () => {
  window.__notes = []; window.__osc = 0;
  class N { constructor(title, o) { window.__notes.push({ title, body: o?.body || '' }); } close() {} static requestPermission(cb) { cb?.('granted'); return Promise.resolve('granted'); } }
  N.permission = 'granted'; window.Notification = N;
  class AC { constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; } resume() { return Promise.resolve(); }
    createOscillator() { window.__osc++; return { frequency: { value: 0 }, type: 'sine', connect() { return this; }, start() {}, stop() {} }; }
    createGain() { return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() { return this; } }; } }
  window.AudioContext = AC; window.webkitAudioContext = AC;
};
async function openPage(browser, seed = {}, { ctx = null, stubs = false, viewport = { width: 1600, height: 1000 } } = {}) {
  ctx = ctx || await browser.newContext({ viewport, acceptDownloads: true, timezoneId: 'Europe/Berlin' });
  if (!ctx.seeded) {
    ctx.seeded = true;
    if (stubs) await ctx.addInitScript(STUBS);
    await ctx.addInitScript(items => { if (localStorage.getItem('seeded48')) return; localStorage.setItem('seeded48', '1'); for (const [k, v] of items) localStorage.setItem(k, JSON.stringify(v)); }, Object.entries(seed));
  }
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  await page.goto(`${h.URL_BASE}/weather-widget-v2.html`);
  await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 15000 }).catch(() => {});
  return { ctx, page, errors };
}
const ls = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);
const ids = async (page, k) => ((await ls(page, k)) || []).map(x => x.id).sort().join(',');
const setInput = (page, id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [id, v]);
const jsClick = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); if (!e) throw new Error('fehlt: ' + sel); e.click(); }, sel);
const txt = (page, sel) => page.evaluate(sel => document.querySelector(sel)?.textContent ?? null, sel);
async function download(page, sel, name) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), jsClick(page, sel)]);
  const f = path.join(os.tmpdir(), `m48-${name}`); await dl.saveAs(f); return fs.readFileSync(f, 'utf8');
}
async function backup(page, name) { const s = await download(page, '#backup-save', `${name}.json`), f = path.join(os.tmpdir(), `m48-${name}.json`); return { f, data: JSON.parse(s) }; }
// Absichtliche Altdatei für Rückwärtskompatibilität: aktueller Export bleibt ohne Übungstrades.
async function legacyDemoFile(page, data, name) {
  const { integrity, ...oldFields } = data; // Schema 7 vor Dateiprüfsummen; beschädigte Schema-8-Dateien prüft m50 weiter.
  void integrity;
  const legacy = { ...oldFields, version: 7, appVersion: '3.28.0', demoPositions: (await ls(page, 'scalpdesk.demopositions.v1')) || [], demoHistory: (await ls(page, 'scalpdesk.demohistory.v1')) || [] };
  const f = path.join(os.tmpdir(), `m48-alt-${name}.json`); fs.writeFileSync(f, JSON.stringify(legacy)); return f;
}

async function load(page, f) {
  await page.evaluate(() => { if (document.getElementById('data-panel').hidden) document.getElementById('data-toggle').click(); });
  await page.setInputFiles('#backup-file', f); await page.waitForTimeout(500);
  return page.evaluate(() => { const b = document.getElementById('sync-preview'); return { shown: !b.hidden, items: [...b.querySelectorAll('.sp-list > li')].map(li => li.innerText.replace(/\s*\n\s*/g, ' ⏎ ')) }; });
}
async function take(page) { await page.click('#sync-preview .sp-actions .button.primary-lite'); await page.waitForTimeout(400); return page.textContent('#history-status'); }
const csvRows = s => s.replace(/^﻿/, '').trim().split('\r\n').map(l => l.split(';').map(c => c.replace(/^"|"$/g, '').replace(/""/g, '"')));
const trade = (id, sym, pnl, closedAt, extra = {}) => ({ id, symbol: sym, side: 'long', mode: 'isolated', entry: 100, leverage: 10, qty: 1, margin: 10, openedAt: closedAt - 3600e3, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false }, note: '', exit: 100 + pnl, fees: 0, pnl, pnlSource: 'calc', closedAt, fx: 0.92, ...extra });
const position = (id, sym, entry, extra = {}) => ({ id, symbol: sym, side: 'long', mode: 'cross', entry, leverage: 10, qty: 1, margin: entry / 10, openedAt: Date.now() - 3600e3, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false }, ...extra });
// Formular: Position erfassen (Gründe per Klick auf die Chips, Modus ECHT/DEMO)
async function fillForm(page, { sym, lev = 10, qty, entry, sl = '', tp = '', side = 'long', demo = false, reasons = [] }) {
  if (await page.evaluate(() => document.getElementById('pos-form').hidden)) await jsClick(page, '#pos-add-toggle');
  await page.waitForTimeout(150);
  await setInput(page, 'pos-symbol', sym); await jsClick(page, `[data-pos-side="${side}"]`); await jsClick(page, `[data-pos-real="${demo ? 'demo' : 'real'}"]`);
  await setInput(page, 'pos-lev', String(lev)); await setInput(page, 'pos-qty', String(qty)); await setInput(page, 'pos-entry', String(entry));
  await setInput(page, 'pos-sl', String(sl)); await setInput(page, 'pos-tp', String(tp));
  await page.evaluate(() => { document.getElementById('reasons-box').open = true; });
  for (const r of reasons) await page.evaluate(r => { const b = [...document.querySelectorAll('#setup-chips [data-reason]')].find(x => x.dataset.reason === r); if (!b) throw new Error('Grund fehlt: ' + r); if (b.getAttribute('aria-pressed') !== 'true') b.click(); }, r);
}
const save = async page => { await jsClick(page, '#pos-save'); await page.waitForFunction(() => document.getElementById('pos-form').hidden, null, { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(300); };
const card = (page, id) => page.evaluate(id => { const c = document.querySelector(`.pos-card[data-id="${id}"]`); if (!c) return null;
  return { list: c.parentElement.id, demo: c.classList.contains('demo'), tags: [...c.querySelectorAll('.pos-tag')].map(t => t.textContent), sim: c.querySelector('.pos-sim')?.textContent || '', pnl: c.querySelector('[data-f="pnl"]').textContent,
    reasons: c.querySelector('.pos-reasons')?.textContent || '', alert: !c.querySelector('[data-f="alert"]').hidden, warn: !c.querySelector('[data-f="warn"]').hidden, close: c.querySelector('[data-action="realize"]')?.textContent || '' }; }, id);
const closeCard = async (page, id, override = null) => {
  await jsClick(page, `.pos-card[data-id="${id}"] [data-action="realize"]`); await page.waitForTimeout(200);
  if (override !== null) await page.evaluate(([id, v]) => { const i = document.querySelector(`.pos-card[data-id="${id}"] [data-input="override"]`); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, [id, override]);
  await jsClick(page, `.pos-card[data-id="${id}"] [data-action="save-realize"]`); await page.waitForTimeout(400);
};
const rowText = (page, list, id) => page.evaluate(([list, id]) => { const r = document.querySelector(`#${list} [data-trade="${id}"]`); return r ? { text: r.textContent, demo: r.classList.contains('demo') } : null; }, [list, id]);

const tests = {
  // ================= Gründe: Alt-Daten, Formular, Karte, Historie, CSV, Auswertung =================
  async reasons(browser) {
    await h.ctl('/walk?on=0');
    const B0 = Math.round((await h.ctl('/state')).price.BTCUSDT); await h.ctl(`/set?symbol=BTCUSDT&price=${B0}`);
    const T0 = Date.now() - 3 * 864e5;
    const seed = {
      'scalpdesk.positions.v1': [position('PO', 'ETHUSDT', 2500, { setup: 'Ausbruch' })],
      'scalpdesk.history.v1': [
        trade('TO', 'ETHUSDT', 5, T0, { setup: 'Trendfolge' }), // Format bis 3.27: ein Setup
        trade('TM', 'SOLUSDT', 10, T0 + 3600e3, { reasons: ['RSI', 'MACD'], setup: 'RSI' }), // zwei Gründe derselben Gruppe
        trade('TR', 'XRPUSDT', -4, T0 + 7200e3, { reasons: ['RSI', 'Funding'], setup: 'RSI' }),
        trade('TN', 'LTCUSDT', 2, T0 + 10800e3), // ohne Grund
        // 3.29.0: „setupSeen“ = zuletzt von dieser App geschriebenes Setup; weicht „setup“ davon ab, hat nachweisbar eine ältere App es geändert
        trade('TX', 'BCHUSDT', 1, T0 + 14400e3, { reasons: ['RSI', 'News'], setup: 'Fibonacci', setupSeen: 'RSI' }), // ältere App hat das Setup geändert
        trade('TY', 'NEARUSDT', 1, T0 + 18000e3, { reasons: ['Orderbuch', 'News'], setup: null, setupSeen: 'Orderbuch' })] }; // ältere App hat es entfernt
    // Ohne diesen Nachweis (Stand 3.28.0) passt das Setup nicht zu den Gründen, die Herkunft ist offen: beide Fassungen bleiben, du entscheidest
    seed['scalpdesk.positions.v1'].push(position('PX', 'XRPUSDT', 1.4, { reasons: ['RSI', 'News'], setup: 'Fibonacci' }));
    const { ctx, page, errors } = await openPage(browser, seed); await live(page); await page.waitForTimeout(800);
    const po = await card(page, 'PO');
    check('Alte Position mit Setup „Ausbruch“: Karte zeigt „Gründe: Ausbruch“', po?.reasons === 'Gründe: Ausbruch', po?.reasons);
    await page.evaluate(() => { document.getElementById('history').open = true; }); await page.waitForTimeout(200);
    const to = await rowText(page, 'history-list', 'TO');
    check('Alter Trade mit Setup „Trendfolge“: Historie zeigt „Gründe: Trendfolge“, kein „Setup:“', /Gründe: Trendfolge/.test(to?.text) && !/Setup:/.test(to?.text), to?.text);
    // Formular: nichts vorausgewählt, Gruppen, Hinweis
    await jsClick(page, '#pos-add-toggle'); await page.waitForTimeout(200); await page.evaluate(() => { document.getElementById('reasons-box').open = true; });
    const f0 = await page.evaluate(() => ({ sel: document.getElementById('reasons-sel').textContent, pressed: document.querySelectorAll('#setup-chips [aria-pressed="true"]').length, note: document.querySelector('#reasons-box .reasons-note').textContent,
      groups: [...document.querySelectorAll('#setup-chips .reason-group')].map(g => g.getAttribute('aria-label') + ': ' + [...g.querySelectorAll('[data-reason]')].map(b => b.dataset.reason).join(', ')) }));
    const want = ['Trend: EMA-20/50-Trend, Kurs zu EMA 20', 'Momentum: RSI, MACD, RSI-Divergenz', 'Chartstruktur: ZigZag, Elliott-Wellen, Fibonacci', 'Volumen: POC/Value Area, Volumenprofil',
      'Markt & Orderflow: Liquidations-Heatmap, Whale-Trades, Orderbuch, Open Interest, Funding', 'Umfeld: Volatilität, News, Wirtschaftstermine'];
    check('Neue Position: kein Grund vorausgewählt („keine gewählt“)', f0.sel === 'keine gewählt' && f0.pressed === 0, `${f0.sel}, ${f0.pressed} gewählt`);
    check('Gruppen: die neun Setups unter „Setups & eigene Gründe“, dazu Trend, Momentum, Chartstruktur, Volumen, Markt & Orderflow, Umfeld', f0.groups.length === 7 && /^Setups & eigene Gründe: Ausbruch, Rücklauf zum POC, Unterstützung hält, Widerstand hält, RSI überverkauft, RSI überkauft, Bollinger außen, EMA 200, Trendfolge$/.test(f0.groups[0]) && want.every((w, i) => f0.groups[i + 1] === w), f0.groups.join(' | '));
    check('Hinweis: Auswahl dokumentiert die Entscheidung, kein Handelssignal', /nicht als Handelssignal und bestätigt sie nicht/.test(f0.note), f0.note);
    // Mehrfachauswahl und eigener Grund
    await fillForm(page, { sym: 'BTC', qty: 1, entry: B0, reasons: ['EMA-20/50-Trend', 'RSI', 'Funding'] });
    await jsClick(page, '#setup-chips [data-setup-new]'); await page.fill('#setup-new', 'Doppelboden'); await jsClick(page, '#setup-add-ok'); await page.waitForTimeout(200);
    await page.evaluate(() => { document.getElementById('reasons-box').open = true; });
    await jsClick(page, '#setup-chips [data-setup-new]'); await page.fill('#setup-new', 'RSI'); await jsClick(page, '#setup-add-ok'); await page.waitForTimeout(200); // steht schon unter Momentum
    const f1 = await page.evaluate(() => ({ sel: document.getElementById('reasons-sel').textContent, own: [...document.querySelectorAll('#setup-chips .reason-group')][0].textContent, rsi: [...document.querySelectorAll('#setup-chips [data-reason="RSI"]')].length, preview: document.getElementById('pos-preview').textContent }));
    check('Vier Gründe gewählt, eigener Grund „Doppelboden“ steht bei „Setups & eigene Gründe“', f1.sel === '4 gewählt: EMA-20/50-Trend, RSI, Funding, Doppelboden' && /Doppelboden/.test(f1.own), f1.sel);
    check('Eigener Grund „RSI“ (steht schon unter Momentum): nur einmal vorhanden', f1.rsi === 1 && !(await ls(page, 'scalpdesk.setups.v1') || []).includes('RSI'), `${f1.rsi}× RSI`);
    check('Vorschau nennt die Gründe', /Gründe: EMA-20\/50-Trend, RSI, Funding, Doppelboden/.test(f1.preview), f1.preview.slice(0, 160));
    await save(page);
    let pos = (await ls(page, 'scalpdesk.positions.v1')).find(p => p.symbol === 'BTCUSDT');
    check('Gespeichert: reasons mit vier Gründen, setup = erster Grund (für ältere Versionen)', JSON.stringify(pos?.reasons) === '["EMA-20/50-Trend","RSI","Funding","Doppelboden"]' && pos?.setup === 'EMA-20/50-Trend', JSON.stringify([pos?.reasons, pos?.setup]));
    check('Eigener Grund bleibt in der Liste (Setups & eigene Gründe)', (await ls(page, 'scalpdesk.setups.v1') || []).includes('Doppelboden'));
    let c = await card(page, pos.id);
    check('Karte: „Gründe: EMA-20/50-Trend · RSI · Funding · Doppelboden“', c?.reasons === 'Gründe: EMA-20/50-Trend · RSI · Funding · Doppelboden', c?.reasons);
    // Alt-Daten nach dem Speichern verlustfrei übernommen (auch die Änderungen älterer App-Versionen)
    const hist = Object.fromEntries((await ls(page, 'scalpdesk.history.v1')).map(t => [t.id, JSON.stringify([t.reasons, t.setup])]));
    const posO = (await ls(page, 'scalpdesk.positions.v1')).find(p => p.id === 'PO');
    check('Alt-Daten: Setup → ein Grund (Position und Trade)', JSON.stringify([posO.reasons, posO.setup]) === '[["Ausbruch"],"Ausbruch"]' && hist.TO === '[["Trendfolge"],"Trendfolge"]', `${JSON.stringify([posO.reasons, posO.setup])} ${hist.TO}`);
    check('Mehrere Gründe bleiben, Trade ohne Grund bleibt leer', hist.TM === '[["RSI","MACD"],"RSI"]' && hist.TN === '[[],null]', `${hist.TM} ${hist.TN}`);
    check('Ältere App änderte das Setup nachweisbar (RSI → Fibonacci): erster Grund ersetzt, „News“ bleibt', hist.TX === '[["Fibonacci","News"],"Fibonacci"]', hist.TX);
    check('Ältere App entfernte das Setup nachweisbar: erster Grund entfernt, „News“ bleibt', hist.TY === '[["News"],"News"]', hist.TY);
    const px = (await ls(page, 'scalpdesk.positions.v1')).find(p => p.id === 'PX'), cx = (await ls(page, 'scalpdesk.conflicts.v1')) || [];
    const cpx = cx.find(c => c.id === 'PX');
    check('Setup ohne Herkunftsnachweis (Stand 3.28): Gründe bleiben „RSI, News“, Fassung „Fibonacci, News“ wartet als Konflikt', JSON.stringify([px?.reasons, px?.setup]) === '[["RSI","News"],"RSI"]' && cx.length === 1 && cpx?.why === 'setup' && JSON.stringify(cpx.draft?.reasons) === '["Fibonacci","News"]'
      && /1 Konflikt wartet auf deine Entscheidung/.test(await txt(page, '#integrity-text')), JSON.stringify([px?.reasons, cx.map(c => [c.id, c.why, c.draft?.reasons])]));
    // Bearbeiten: Auswahl vorbelegt, einen Grund abwählen
    await jsClick(page, `.pos-card[data-id="${pos.id}"] [data-action="edit"]`); await page.waitForTimeout(200); await page.evaluate(() => { document.getElementById('reasons-box').open = true; });
    const pressed = await page.evaluate(() => [...document.querySelectorAll('#setup-chips [aria-pressed="true"]')].map(b => b.dataset.reason).join(', '));
    check('Bearbeiten: die vier Gründe sind gewählt', pressed === 'Doppelboden, EMA-20/50-Trend, RSI, Funding', pressed);
    await page.evaluate(() => [...document.querySelectorAll('#setup-chips [data-reason="Funding"]')][0].click()); await save(page);
    pos = (await ls(page, 'scalpdesk.positions.v1')).find(p => p.symbol === 'BTCUSDT'); c = await card(page, pos.id);
    check('„Funding“ abgewählt: drei Gründe, Karte aktualisiert', JSON.stringify(pos.reasons) === '["EMA-20/50-Trend","RSI","Doppelboden"]' && c?.reasons === 'Gründe: EMA-20/50-Trend · RSI · Doppelboden', `${JSON.stringify(pos.reasons)} | ${c?.reasons}`);
    // Schließen: Gründe wandern in den Trade
    await closeCard(page, pos.id);
    const closed = (await ls(page, 'scalpdesk.history.v1')).find(t => t.id === pos.id), row = await rowText(page, 'history-list', pos.id);
    check('Geschlossen: Trade mit denselben Gründen, Historie zeigt „Gründe: EMA-20/50-Trend, RSI, Doppelboden“', JSON.stringify(closed?.reasons) === '["EMA-20/50-Trend","RSI","Doppelboden"]' && /Gründe: EMA-20\/50-Trend, RSI, Doppelboden/.test(row?.text), row?.text?.slice(0, 200));
    // Notiz eines Trades: Gründe nachtragen
    await jsClick(page, '#history-list [data-trade="TN"] [data-action="trade-note"]'); await page.waitForTimeout(250);
    await page.evaluate(() => { const d = document.querySelector('#history-list [data-trade="TN"] details.trade-reasons'); d.open = true; [...d.querySelectorAll('[data-reason="Volatilität"]')][0].click(); });
    await jsClick(page, '#history-list [data-trade="TN"] [data-action="note-save"]'); await page.waitForTimeout(300);
    const tn = (await ls(page, 'scalpdesk.history.v1')).find(t => t.id === 'TN'), tnRow = await rowText(page, 'history-list', 'TN');
    check('Notiz-Editor: Grund „Volatilität“ nachgetragen, mit Änderungszeitpunkt', JSON.stringify(tn.reasons) === '["Volatilität"]' && tn.updatedAt > Date.now() - 60e3 && /Gründe: Volatilität/.test(tnRow?.text), JSON.stringify([tn.reasons, tn.updatedAt]));
    // CSV
    const csv = csvRows(await download(page, '#export-csv', 'trades.csv')), head = csv[0], gi = head.indexOf('Gründe');
    const byOpen = r => csv.find(x => x[2] === r);
    check('CSV: Spalte „Gründe“ statt „Setup“', gi > 0 && !head.includes('Setup'), head.join(' | ').slice(-80));
    check('CSV: mehrere Gründe in einer Zelle, alter Trade mit seinem Setup als Grund', byOpen('SOLUSDT')?.[gi] === 'RSI, MACD' && byOpen('ETHUSDT')?.[gi] === 'Trendfolge' && byOpen('BTCUSDT')?.[gi] === 'EMA-20/50-Trend, RSI, Doppelboden', `${byOpen('SOLUSDT')?.[gi]} | ${byOpen('ETHUSDT')?.[gi]} | ${byOpen('BTCUSDT')?.[gi]}`);
    // Auswertung
    await page.evaluate(() => { document.getElementById('analysis').open = true; }); await page.waitForTimeout(300);
    const an = await page.evaluate(() => { const out = {}; for (const bd of document.querySelectorAll('#breakdowns .bd')) out[bd.querySelector('h4').textContent] = [...bd.querySelectorAll('.bd-row:not(.head)')].map(r => { const s = r.querySelectorAll(':scope > span'); return `${s[0].textContent}=${s[1].textContent}`; });
      return { tables: out, note: document.querySelector('#breakdowns .bd-note')?.textContent || '' }; });
    const all = await ls(page, 'scalpdesk.history.v1'), net = all.reduce((s, t) => s + t.pnl, 0);
    const g = an.tables['Nach Grund'] || [], a = an.tables['Nach Bereich der Gründe'] || [];
    const sortSet = l => l.slice().sort().join(' ');
    check('Keine Tabelle „Nach Setup“ mehr; „Nach Grund“ und „Nach Bereich der Gründe“ vorhanden', !an.tables['Nach Setup'] && g.length && a.length, Object.keys(an.tables).join(', '));
    check('Nach Grund: jeder Trade zählt bei jedem seiner Gründe einmal', sortSet(g) === sortSet(['RSI=3', 'MACD=1', 'Funding=1', 'Trendfolge=1', 'Fibonacci=1', 'News=2', 'Volatilität=1', 'EMA-20/50-Trend=1', 'Doppelboden=1']), g.join(' '));
    check('Nach Bereich: RSI und MACD im selben Trade zählen bei „Momentum“ nur einmal', sortSet(a) === sortSet(['Momentum=3', 'Markt & Orderflow=1', 'Setups & eigene Gründe=2', 'Chartstruktur=1', 'Umfeld=3', 'Trend=1']), a.join(' '));
    const fmt = v => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(2).replace('.', ',');
    check('Gesamt ohne Doppelzählung: 7 Trades, Summe jedes Trades einmal; Hinweis „kein Signal der App“', an.note.includes(`Gesamt, jeder Trade einmal: 7 Trades, ${fmt(net)} USDT`) && /4 Trades haben mehrere Gründe/.test(an.note) && /kein Signal der App/.test(an.note), an.note);
    check('keine Fehler (Gründe)', !real(errors).length, real(errors).join(' | ').slice(0, 300)); await ctx.close();
  },

  // ================= DEMO: keine Alarme, getrennte Summen und Historie =================
  async demo(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/tgreset');
    const st0 = (await h.ctl('/state')).price, B0 = Math.round(st0.BTCUSDT), E0 = Math.round(st0.ETHUSDT);
    await h.ctl(`/set?symbol=BTCUSDT&price=${B0}`); await h.ctl(`/set?symbol=ETHUSDT&price=${E0}`);
    const now = Date.now();
    const seed = { 'scalpdesk.channels.v1': CHAN, 'scalpdesk.s247.v1': { on: true }, 'scalpdesk.sound.v1': true, 'scalpdesk.notify.v1': true, 'scalpdesk.daylimit.v1': 50,
      'scalpdesk.pnlalarm.v1': { profit: { on: true, value: 300, state: 'armed', at: now - 60e3 }, loss: { on: true, value: 300, state: 'armed', at: now - 60e3 }, u: now - 60e3 },
      'scalpdesk.positions.v1': [position('R1', 'ETHUSDT', E0, { qty: 0.5, margin: E0 * 0.5 / 10, sl: E0 - 20, tp: E0 + 60 })],
      'scalpdesk.demopositions.v1': [position('D2', 'BTCUSDT', B0, { side: 'short', qty: 2, margin: B0 * 2 / 10, sl: B0 + 100, tp: B0 - 300, reasons: ['Whale-Trades'], setup: 'Whale-Trades' })] };
    const { ctx, page, errors } = await openPage(browser, seed, { stubs: true }); await live(page);
    await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointerdown'))); // Ton freigeben (wie die erste Berührung)
    const docs = async () => (await mock(`/tgmsgs?chat=${CHAT}`)).filter(m => m.document?.file_name === 'scalpdesk-247.json').sort((a, b) => b.message_id - a.message_id);
    const pinned = async () => { const d = (await docs()).find(m => m.pinnedAt); try { return d ? JSON.parse(d.content) : null; } catch { return null; } };
    let ho = await until(pinned, 20000);
    check('24/7-Übergabe: nur die echte Position R1 (Stop/Ziel) und im Gewinn-/Verlust-Alarm', ho && ho.positions.map(p => p.id).join() === 'R1' && ho.pnl?.pos.map(p => p.id).join() === 'R1' && ho.pnl?.n === 1, ho ? JSON.stringify({ pos: ho.positions.map(p => p.id), pnl: ho.pnl?.pos.map(p => p.id) }) : 'keine Übergabe');
    // Demo-Position im Formular anlegen
    await fillForm(page, { sym: 'BTC', qty: 1, entry: B0, sl: B0 - 100, tp: B0 + 200, demo: true, reasons: ['Liquidations-Heatmap', 'Orderbuch'] });
    const form = await page.evaluate(() => ({ hint: !document.getElementById('pos-demo-hint').hidden, label: document.getElementById('pos-save').textContent, cls: document.getElementById('pos-form').classList.contains('demo'), preview: document.getElementById('pos-preview').textContent }));
    check('Formular DEMO: Hinweis „keine Alarme“, Knopf „Demo-Position speichern“, Vorschau „DEMO, simuliert“', form.hint && form.cls && form.label === 'Demo-Position speichern' && /^DEMO, simuliert · /.test(form.preview), `${form.label} | ${form.preview.slice(0, 60)}`);
    const handovers = async () => (await h.ctl('/sent')).filter(m => m.svc === 'tg' && (m.method === 'sendDocument' || m.method === 'editMessageMedia')).length; // neue oder überschriebene Datei
    const sentDocs0 = await handovers();
    await save(page);
    const d1 = (await ls(page, 'scalpdesk.demopositions.v1')).find(p => p.symbol === 'BTCUSDT' && p.side === 'long'), D1 = d1?.id;
    check('Gespeichert in der Demo-Liste (eigener Speicher), echte Liste unverändert', !!D1 && (await ids(page, 'scalpdesk.positions.v1')) === 'R1' && (await ls(page, 'scalpdesk.demopositions.v1')).length === 2, await ids(page, 'scalpdesk.demopositions.v1'));
    let c1 = await card(page, D1);
    check('Demo-Karte: in „Demo-Positionen“, Markierung DEMO, „simuliert · ohne Alarme“, Gründe, Schließen-Knopf nach G/V (3.30.0)', c1?.list === 'demo-list' && c1.demo && c1.tags.includes('DEMO') && c1.sim === 'simuliert · ohne Alarme' && c1.reasons === 'Gründe: Liquidations-Heatmap · Orderbuch' && /^(Gewinn realisieren|Verlust realisieren|Position schließen)/.test(c1.close), JSON.stringify(c1));
    const chartTags = await page.evaluate(() => [...document.querySelectorAll('svg text')].map(t => t.textContent).filter(t => /^DEMO /.test(t)));
    check('Chart: Demo-Einstieg und Demo-SL/TP beschriftet „DEMO …“', chartTags.some(t => /^DEMO Einstieg Long 10×$/.test(t)) && chartTags.some(t => /^DEMO SL /.test(t)) && chartTags.some(t => /^DEMO TP /.test(t)), chartTags.join(' | '));
    await page.waitForTimeout(4500); // Übergabe an den Dienst wartet 3 s
    check('Keine neue Übergabe an den 24/7-Dienst nach dem Anlegen der Demo-Position', (await handovers()) === sentDocs0, `${await handovers()} Übergaben (vorher ${sentDocs0})`);
    // Kurs fällt unter den Demo-Stop (D1 Long) und unter das Demo-Ziel (D2 Short)
    const t0 = Date.now(); await h.ctl(`/set?symbol=BTCUSDT&price=${B0 - 400}`);
    await until(async () => /^−400,00 USDT$/.test((await card(page, D1))?.pnl || ''), 15000);
    await page.waitForTimeout(3500);
    const quiet = async label => {
      const st = await page.evaluate(() => ({ toasts: [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent.slice(0, 60)), notes: window.__notes.map(n => n.title), osc: window.__osc }));
      const sent = (await h.ctl('/sent')).filter(m => m.at >= t0 && ((m.svc === 'tg' && !m.method) || m.svc === 'dc')); // Nachrichten (keine Datei-Übergaben)
      check(`${label}: kein Hinweis in der App, kein Browser-Hinweis, kein Ton`, !st.toasts.length && !st.notes.length && st.osc === 0, JSON.stringify(st));
      check(`${label}: keine Telegram- oder Discord-Nachricht`, !sent.length, JSON.stringify(sent.map(m => `${m.svc}:${m.method || ''}:${(m.text || m.content || '').slice(0, 40)}`)));
      const cd = [await card(page, D1), await card(page, 'D2')];
      check(`${label}: Demo-Karten ohne Alarmfeld und Warnhinweis`, cd.every(x => x && !x.alert && !x.warn), JSON.stringify(cd.map(x => x && [x.alert, x.warn])));
      const pa = await ls(page, 'scalpdesk.pnlalarm.v1');
      check(`${label}: Gewinn-/Verlust-Alarm bleibt scharf (Demo zählt nicht)`, pa.profit.state === 'armed' && pa.loss.state === 'armed', `${pa.profit.state}/${pa.loss.state}`);
    };
    await quiet('Demo-Stop (Long) und Demo-Ziel (Short) erreicht');
    let tot = await page.evaluate(() => ({ demo: document.getElementById('demo-open-total').textContent, real: document.getElementById('open-total').textContent, eur: document.getElementById('open-total-eur').textContent }));
    check('Summen getrennt: Demo „+400,00 USDT simuliert · 2 offen“, echtes Live-Ergebnis nur R1 („1 offen“)', tot.demo === '+400,00 USDT simuliert · 2 offen' && /· 1 offen$/.test(tot.eur) && !/400/.test(tot.real), JSON.stringify(tot));
    await h.ctl(`/set?symbol=BTCUSDT&price=${B0 + 400}`);
    await until(async () => /^\+400,00 USDT$/.test((await card(page, D1))?.pnl || ''), 15000);
    await page.waitForTimeout(3500);
    await quiet('Demo-Ziel (Long) und Demo-Stop (Short) erreicht');
    tot = await page.evaluate(() => document.getElementById('demo-open-total').textContent);
    check('Demo simuliert jetzt −400,00 USDT (über der Verlust-Grenze von 300 USDT), ohne Alarm', tot === '−400,00 USDT simuliert · 2 offen', tot);
    check('Weiterhin keine Übergabe an den 24/7-Dienst (Kursbewegung, Demo-Stop und -Ziel)', (await handovers()) === sentDocs0, `${await handovers()} Übergaben (vorher ${sentDocs0})`);
    // Schließen: Demo in die Demo-Historie, nicht ins Tages-Verlustlimit
    const day0 = await page.evaluate(() => ({ pnl: document.getElementById('day-pnl').textContent, info: document.getElementById('day-info').textContent }));
    await closeCard(page, 'D2', '-500');
    await closeCard(page, D1);
    const dh = await ls(page, 'scalpdesk.demohistory.v1'), rh = await ls(page, 'scalpdesk.history.v1');
    check('Geschlossene Demo-Positionen nur in der Demo-Historie', dh?.map(t => t.id).sort().join() === [D1, 'D2'].sort().join() && !(rh || []).length && !(await ls(page, 'scalpdesk.demopositions.v1')).length, `${dh?.map(t => t.id)} | echt: ${(rh || []).length}`);
    const dt = dh.find(t => t.id === 'D2');
    check('Demo-Trade D2: −500 USDT laut Eingabe, Gründe bleiben', dt.pnl === -500 && dt.pnlSource === 'exchange' && JSON.stringify(dt.reasons) === '["Whale-Trades"]', JSON.stringify([dt.pnl, dt.reasons]));
    await page.waitForTimeout(500);
    const day1 = await page.evaluate(() => ({ pnl: document.getElementById('day-pnl').textContent, info: document.getElementById('day-info').textContent, banner: !document.getElementById('day-banner').hidden }));
    check('Tages-Verlustlimit (50 USDT): Demo-Verlust von 500 USDT zählt nicht, kein Banner', day1.pnl === day0.pnl && day1.pnl === '0,00 USDT' && day1.info === day0.info && !day1.banner, JSON.stringify(day1));
    const hv = await page.evaluate(() => ({ count: document.getElementById('history-count').textContent, dcount: document.getElementById('demo-history-count').textContent, dhidden: document.getElementById('demo-history').hidden,
      rows: document.querySelectorAll('#history-list [data-trade]').length, drows: [...document.querySelectorAll('#demo-history-list [data-trade]')].map(r => r.classList.contains('demo')),
      dsum: document.getElementById('demo-summary').textContent, analysis: document.getElementById('analysis-count').textContent, money: document.getElementById('money-info').textContent, monthly: document.getElementById('monthly').textContent }));
    check('Historien: echte „(0)“ ohne Zeilen, Demo-Historie sichtbar „(2)“ mit markierten Zeilen', /^\(0( in \d{4})?\)$/.test(hv.count) && !hv.rows && !hv.dhidden && hv.dcount === '(2)' && hv.drows.length === 2 && hv.drows.every(Boolean), JSON.stringify(hv).slice(0, 200));
    check('Demo-Zusammenfassung: 2 Demo-Trades, Netto simuliert', /Demo-Trades2/.test(hv.dsum) && /Netto simuliert/.test(hv.dsum), hv.dsum);
    check('Auswertung, Monatsübersicht und Geld-/Steuerübersicht ohne Demo-Trades („Realisierter Nettogewinn …: 0,00 USDT“)', hv.analysis === '' && (hv.monthly === '' || /Noch keine Einträge/.test(hv.monthly)) && /^Realisierter Nettogewinn [^:]+: 0,00 USDT/.test(hv.money), `${hv.analysis} | ${hv.monthly.slice(0, 40)} | ${hv.money.slice(0, 80)}`);
    const dcsv = csvRows(await download(page, '#demo-csv', 'demo.csv')), dhd = dcsv[0];
    check('Demo-CSV: Spalten „Gründe“ und „Handelsmodus“, jede Zeile „DEMO (simuliert)“', dhd.includes('Gründe') && dhd.at(-1) === 'Handelsmodus' && dcsv.length === 3 && dcsv.slice(1).every(r => r.at(-1) === 'DEMO (simuliert)') && dcsv.some(r => r[dhd.indexOf('Gründe')] === 'Liquidations-Heatmap, Orderbuch'), dhd.slice(-3).join(' | '));
    // Kontrolle: die echte Position alarmiert über alle Wege
    const t1 = Date.now(); await h.ctl(`/set?symbol=ETHUSDT&price=${E0 - 30}`);
    const toastR = await until(() => page.evaluate(() => !!document.querySelector('#toasts .toast[data-id="R1"][data-type="sl"]')), 15000);
    const sentR = await until(async () => { const s = (await h.ctl('/sent')).filter(m => m.at >= t1 && /🛑 ETH Long: Stop-Loss erreicht/.test(m.text || m.content || '')); return s.length >= 2 ? s : null; }, 15000);
    const st = await page.evaluate(() => ({ notes: window.__notes.map(n => n.title), osc: window.__osc }));
    check('Kontrolle echte Position: Hinweis, Browser-Hinweis, Ton, Telegram und Discord', toastR && st.notes.includes('🔔 ETH Long: Stop-Loss erreicht') && st.osc >= 3 && sentR?.some(m => m.svc === 'tg') && sentR?.some(m => m.svc === 'dc'), JSON.stringify({ toast: !!toastR, ...st, sent: sentR?.map(m => m.svc) }));
    // Wechsel ECHT → DEMO beim Bearbeiten: Hinweis weg, nicht mehr in der Übergabe; zurück auf ECHT: wieder dabei
    let hv0 = await handovers();
    await jsClick(page, '.pos-card[data-id="R1"] [data-action="edit"]'); await page.waitForTimeout(200);
    await jsClick(page, '[data-pos-real="demo"]'); await save(page);
    const sw = await page.evaluate(() => ({ toast: !!document.querySelector('#toasts .toast[data-id="R1"]'), list: document.querySelector('.pos-card[data-id="R1"]')?.parentElement.id }));
    check('ECHT → DEMO: Position wandert in die Demo-Liste, ihr Hinweis verschwindet', sw.list === 'demo-list' && !sw.toast && (await ids(page, 'scalpdesk.demopositions.v1')) === 'R1' && !(await ls(page, 'scalpdesk.positions.v1')).length, JSON.stringify(sw));
    ho = await until(async () => { if ((await handovers()) <= hv0) return null; const p = await pinned(); return p && !p.positions.length ? p : null; }, 15000);
    check('… 24/7-Übergabe danach ohne Positionen und ohne Gewinn-/Verlust-Positionen', ho && !ho.positions.length && (!ho.pnl || !ho.pnl.pos.length), ho ? JSON.stringify({ pos: ho.positions, pnl: ho.pnl }) : 'keine neue Übergabe');
    hv0 = await handovers();
    await jsClick(page, '.pos-card[data-id="R1"] [data-action="edit"]'); await page.waitForTimeout(200);
    await jsClick(page, '[data-pos-real="real"]'); await save(page);
    ho = await until(async () => { if ((await handovers()) <= hv0) return null; const p = await pinned(); return p && p.positions.length ? p : null; }, 15000);
    check('DEMO → ECHT: wieder in der echten Liste und in der Übergabe', (await ids(page, 'scalpdesk.positions.v1')) === 'R1' && ho?.positions.map(p => p.id).join() === 'R1', ho ? JSON.stringify(ho.positions.map(p => p.id)) : 'keine neue Übergabe');
    const all = (await mock(`/tgmsgs?chat=${CHAT}`)).filter(m => m.content).map(m => m.content).join('\n');
    const files = (await h.ctl('/sent')).filter(m => m.svc === 'tg' && (m.method === 'sendDocument' || m.method === 'editMessageMedia')).map(m => String(m.file || ''));
    check('Keine Übergabedatei enthielt je eine Demo-Position (alle gesendeten und überschriebenen Fassungen)', files.length >= 3 && ![D1, 'D2'].some(id => files.some(f => f.includes(`"${id}"`)) || all.includes(`"${id}"`)), `${files.length} Fassungen geprüft`);
    check('keine Fehler (Demo)', !real(errors).length, real(errors).join(' | ').slice(0, 300)); await ctx.close();
  },

  // ================= Backup, Wiederherstellung und Abgleich beider Handelsmodi =================
  async backup(browser) {
    await h.ctl('/walk?on=0');
    const T0 = Date.now() - 2 * 864e5;
    const seedA = {
      'scalpdesk.positions.v1': [position('RA', 'ETHUSDT', 2500, { reasons: ['Orderbuch'], setup: 'Orderbuch', updatedAt: Date.now() - 3600e3 })],
      'scalpdesk.history.v1': [trade('TA', 'SOLUSDT', 7, T0, { reasons: ['ZigZag', 'Fibonacci'], setup: 'ZigZag' })],
      'scalpdesk.demopositions.v1': [position('DA', 'BTCUSDT', 60000, { reasons: ['Whale-Trades'], setup: 'Whale-Trades', sl: 59000, tp: 62000, updatedAt: Date.now() - 3600e3 })],
      'scalpdesk.demohistory.v1': [trade('DTA', 'XRPUSDT', -3, T0 + 3600e3, { reasons: ['Wirtschaftstermine'], setup: 'Wirtschaftstermine' })] };
    const A = await openPage(browser, seedA); await A.page.waitForTimeout(1200);
    const a1 = await backup(A.page, 'a1'), d = a1.data, idl = l => (l || []).map(x => x.id).join();
    check('Neue Sicherung: echte Daten vollständig, Demo-Felder leer und lokale Übungsbücher erhalten', d.version === 8 && idl(d.positions) === 'RA' && idl(d.history) === 'TA' && !d.demoPositions.length && !d.demoHistory.length && (await ids(A.page, 'scalpdesk.demopositions.v1')) === 'DA' && (await ids(A.page, 'scalpdesk.demohistory.v1')) === 'DTA', JSON.stringify({ v: d.version, p: idl(d.positions), h: idl(d.history), dp: idl(d.demoPositions), dh: idl(d.demoHistory) }));
    check('Sicherung: Gründe als Liste, setup für ältere Versionen', JSON.stringify(d.history[0].reasons) === '["ZigZag","Fibonacci"]' && d.history[0].setup === 'ZigZag' && JSON.stringify((await ls(A.page, 'scalpdesk.demopositions.v1'))[0].reasons) === '["Whale-Trades"]');
    // Gerät B (leer): Wiederherstellen
    const B = await openPage(browser, {}); await B.page.waitForTimeout(800);
    let pv = await load(B.page, a1.f);
    check('Neue Datei auf leerem Gerät: nur persönliche Position und Trade in Vorschau', pv.shown && pv.items.some(t => t.split(' ⏎ ')[0] === 'Neu: 1 Position, 1 Trade'), pv.items.join(' | '));
    await take(B.page);
    check('Neue Datei überträgt echte Daten vollständig und keine Übungen', (await ids(B.page, 'scalpdesk.positions.v1')) === 'RA' && (await ids(B.page, 'scalpdesk.history.v1')) === 'TA' && !(await ids(B.page, 'scalpdesk.demopositions.v1')) && !(await ids(B.page, 'scalpdesk.demohistory.v1')));
    pv = await load(B.page, await legacyDemoFile(A.page, d, 'a1'));
    check('Alte Schema-7-Datei: nur die fehlenden Demo-Positionen/Trades als neu, echte Einträge bleiben', pv.shown && pv.items.some(t => t.split(' ⏎ ')[0] === 'Neu: 1 Demo-Position, 1 Demo-Trade'), pv.items.join(' | '));
    await take(B.page);
    check('Wiederhergestellt: jede Liste an ihrem Platz', (await ids(B.page, 'scalpdesk.positions.v1')) === 'RA' && (await ids(B.page, 'scalpdesk.history.v1')) === 'TA' && (await ids(B.page, 'scalpdesk.demopositions.v1')) === 'DA' && (await ids(B.page, 'scalpdesk.demohistory.v1')) === 'DTA');
    const bv = await B.page.evaluate(() => ({ real: document.querySelector('.pos-card[data-id="RA"]')?.parentElement.id, demo: document.querySelector('.pos-card[data-id="DA"]')?.parentElement.id, dcount: document.getElementById('demo-history-count').textContent, count: document.getElementById('history-count').textContent }));
    check('… Anzeige: RA bei den echten, DA bei den Demo-Positionen, Historien (1) und Demo (1)', bv.real === 'pos-list' && bv.demo === 'demo-list' && /^\(1( in \d{4})?\)$/.test(bv.count) && bv.dcount === '(1)', JSON.stringify(bv));
    // B ändert: Notiz und Grund am Demo-Trade, löscht die Demo-Position, stellt RA auf DEMO
    await B.page.evaluate(() => { document.getElementById('demo-history').open = true; });
    await jsClick(B.page, '#demo-history-list [data-trade="DTA"] [data-action="trade-note"]'); await B.page.waitForTimeout(250);
    await B.page.fill('#demo-history-list [data-note="DTA"]', 'Notiz von B');
    await B.page.evaluate(() => { const d = document.querySelector('#demo-history-list [data-trade="DTA"] details.trade-reasons'); d.open = true; [...d.querySelectorAll('[data-reason="Volatilität"]')][0].click(); });
    await jsClick(B.page, '#demo-history-list [data-trade="DTA"] [data-action="note-save"]'); await B.page.waitForTimeout(300);
    await jsClick(B.page, '.pos-card[data-id="DA"] [data-action="delete"]'); await jsClick(B.page, '.pos-card[data-id="DA"] [data-action="confirm-delete"]'); await B.page.waitForTimeout(300);
    await jsClick(B.page, '.pos-card[data-id="RA"] [data-action="edit"]'); await B.page.waitForTimeout(200); await jsClick(B.page, '[data-pos-real="demo"]'); await save(B.page);
    const dta = (await ls(B.page, 'scalpdesk.demohistory.v1')).find(t => t.id === 'DTA');
    check('B: Demo-Trade mit Notiz und zweitem Grund, Demo-Position gelöscht, RA jetzt DEMO', dta.note === 'Notiz von B' && JSON.stringify(dta.reasons) === '["Wirtschaftstermine","Volatilität"]' && (await ids(B.page, 'scalpdesk.demopositions.v1')) === 'RA' && !(await ls(B.page, 'scalpdesk.positions.v1')).length, JSON.stringify([dta.note, dta.reasons]));
    const b1 = await backup(B.page, 'b1');
    check('Neue Sicherung von B: Löschvermerk bleibt, keine Demo-Trades/Positionen übertragen', !!b1.data.deleted?.['pt:DA'] && !b1.data.demoPositions.length && !b1.data.demoHistory.length && !b1.data.positions.length && (await ids(B.page, 'scalpdesk.demopositions.v1')) === 'RA');
    // A übernimmt bewusst eine alte Datei von B: alle bisherigen Altformat-Abgleichsgrenzen bleiben geprüft.
    pv = await load(A.page, await legacyDemoFile(B.page, b1.data, 'b1'));
    const pvt = pv.items.join(' | ');
    check('Vorschau auf A: Demo-Trade geändert (Notiz, Gründe), RA „jetzt DEMO“', pv.items.some(t => /^Geändert: 1 Demo-Position, 1 Demo-Trade/.test(t)) && /Position ETH Long, Einstieg 2\.?500(,\d+)?: jetzt DEMO/.test(pvt) && /Demo-Trade XRP Long vom [\d., :]+ \(−3,00 USDT\): Notiz, Gründe/.test(pvt), pvt);
    check('Vorschau auf A: „Auf dem anderen Gerät gelöscht: 1 Demo-Position – wird hier gelöscht“', pv.items.some(t => /^Auf dem anderen Gerät gelöscht: 1 Demo-Position – wird hier gelöscht ⏎ Demo-Position BTC Long, Einstieg 60\.?000/.test(t)), pvt);
    await take(A.page);
    const adta = (await ls(A.page, 'scalpdesk.demohistory.v1')).find(t => t.id === 'DTA');
    check('A nach dem Abgleich: Demo-Notiz und Gründe von B, DA gelöscht, RA in der Demo-Liste', adta?.note === 'Notiz von B' && JSON.stringify(adta.reasons) === '["Wirtschaftstermine","Volatilität"]' && (await ids(A.page, 'scalpdesk.demopositions.v1')) === 'RA' && !(await ls(A.page, 'scalpdesk.positions.v1')).length && (await ids(A.page, 'scalpdesk.history.v1')) === 'TA');
    const av = await A.page.evaluate(() => ({ ra: document.querySelector('.pos-card[data-id="RA"]')?.parentElement.id, da: !!document.querySelector('.pos-card[data-id="DA"]') }));
    check('… Anzeige auf A: RA bei den Demo-Positionen, DA weg', av.ra === 'demo-list' && !av.da, JSON.stringify(av));
    // Datei ohne Demo-Felder (z. B. von 3.27): nichts Demo wird gelöscht, altes Setup wird Grund
    // wie von 3.27 geschrieben: Listen vollständig (dort nie geändert = Standard), ohne Demo-Felder
    const SETUPS0 = ['Ausbruch', 'Rücklauf zum POC', 'Unterstützung hält', 'Widerstand hält', 'RSI überverkauft', 'RSI überkauft', 'Bollinger außen', 'EMA 200', 'Trendfolge'];
    const old = { app: 'scalp-desk', version: 7, settings: { dayLimit: null, taxRate: null, at: {} }, exportedAt: Date.now(), positions: [], history: [trade('TOLD', 'LTCUSDT', 2, T0 + 7200e3, { setup: 'Ausbruch' })], movements: [], alarms: [], setups: SETUPS0, watchlist: ['BTC', 'ETC', 'BCH', 'LTC', 'XRP', 'NEAR'], listsAt: {}, deleted: {} };
    const fo = path.join(os.tmpdir(), 'm48-old.json'); fs.writeFileSync(fo, JSON.stringify(old));
    pv = await load(A.page, fo);
    check('Datei ohne Demo-Felder: Vorschau nur „Neu: 1 Trade“, nichts gelöscht', pv.items.length === 1 && pv.items[0].split(' ⏎ ')[0] === 'Neu: 1 Trade', pv.items.join(' | '));
    await take(A.page);
    const told = (await ls(A.page, 'scalpdesk.history.v1')).find(t => t.id === 'TOLD');
    check('… Demo-Listen unverändert, altes Setup als Grund übernommen', (await ids(A.page, 'scalpdesk.demopositions.v1')) === 'RA' && (await ids(A.page, 'scalpdesk.demohistory.v1')) === 'DTA' && JSON.stringify(told?.reasons) === '["Ausbruch"]');
    check('keine Fehler (Backup)', !real(A.errors).length && !real(B.errors).length, [...real(A.errors), ...real(B.errors)].join(' | ').slice(0, 300));
    await A.ctx.close(); await B.ctx.close();
  },

  // ================= Zweiter Tab (Geräteabgleich im Browser) =================
  async sync(browser) {
    await h.ctl('/walk?on=0');
    const B0 = Math.round((await h.ctl('/state')).price.BTCUSDT); await h.ctl(`/set?symbol=BTCUSDT&price=${B0}`);
    const one = await openPage(browser, {}, { stubs: true }); await live(one.page);
    const two = await openPage(browser, {}, { ctx: one.ctx }); await two.page.waitForTimeout(1500);
    await fillForm(one.page, { sym: 'BTC', qty: 1, entry: B0, sl: B0 - 50, tp: B0 + 500, demo: true, reasons: ['Kurs zu EMA 20'] }); await save(one.page);
    const id = (await ls(one.page, 'scalpdesk.demopositions.v1'))[0]?.id;
    const seen = await until(() => two.page.evaluate(id => document.querySelector(`#demo-list .pos-card[data-id="${id}"] .pos-reasons`)?.textContent, id), 8000);
    check('Zweiter Tab zeigt die neue Demo-Position sofort bei den Demo-Positionen', seen === 'Gründe: Kurs zu EMA 20', String(seen));
    // Demo-Stop erreicht: auch im zweiten Tab kein Hinweis
    await h.ctl(`/set?symbol=BTCUSDT&price=${B0 - 60}`); await two.page.waitForTimeout(3000);
    const t2 = await two.page.evaluate(() => document.querySelectorAll('#toasts .toast').length), t1 = await one.page.evaluate(() => ({ toasts: document.querySelectorAll('#toasts .toast').length, notes: window.__notes.length }));
    check('Demo-Stop erreicht: in keinem Tab ein Hinweis', !t2 && !t1.toasts && !t1.notes, `${t2} / ${JSON.stringify(t1)}`);
    await closeCard(one.page, id);
    const cnt = await until(() => two.page.evaluate(() => document.getElementById('demo-history-count').textContent === '(1)' && !document.querySelector('#demo-list .pos-card') && /^\(0( in \d{4})?\)$/.test(document.getElementById('history-count').textContent)), 8000);
    check('Zweiter Tab: Demo-Historie (1), echte Historie (0), keine offene Demo-Position', !!cnt);
    check('keine Fehler (Tabs)', !real(one.errors).length && !real(two.errors).length, [...real(one.errors), ...real(two.errors)].join(' | ').slice(0, 300));
    await one.ctx.close();
  },

  // ================= Zurücksetzen: persönliche Sicherung ohne Demo, danach keine Karten mehr =================
  async reset(browser) {
    const seed = { 'scalpdesk.positions.v1': [position('RZ', 'ETHUSDT', 2500)], 'scalpdesk.demopositions.v1': [position('DZ', 'BTCUSDT', 60000)],
      'scalpdesk.demohistory.v1': [trade('DZT', 'XRPUSDT', 1, Date.now() - 864e5)] };
    const { ctx, page, errors } = await openPage(browser, seed); await page.waitForTimeout(1200);
    const before = await page.evaluate(() => document.querySelectorAll('#pos-list .pos-card, #demo-list .pos-card').length);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), jsClick(page, '#reset-go')]);
    const f = path.join(os.tmpdir(), 'm48-reset.json'); await dl.saveAs(f); const bk = JSON.parse(fs.readFileSync(f, 'utf8'));
    check('Sicherung vor dem Zurücksetzen enthält echte Daten, keine Übungstrades', bk.demoPositions?.length === 0 && bk.demoHistory?.length === 0 && bk.positions?.map(x => x.id).join() === 'RZ');
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => ({ cards: document.querySelectorAll('#pos-list .pos-card, #demo-list .pos-card').length, demoPos: !document.getElementById('demo-pos').hidden, demoHist: !document.getElementById('demo-history').hidden, empty: !document.getElementById('pos-empty').hidden }));
    check('Nach dem Zurücksetzen: keine Karten mehr (echt und Demo), Demo-Bereiche ausgeblendet (vorher blieben Karten stehen)', before === 2 && !after.cards && !after.demoPos && !after.demoHist && after.empty, JSON.stringify({ before, ...after }));
    check('… Demo-Listen gespeichert leer', !(await ls(page, 'scalpdesk.demopositions.v1')).length && !(await ls(page, 'scalpdesk.demohistory.v1')).length);
    check('keine Fehler (Zurücksetzen)', !real(errors).length, real(errors).join(' | ').slice(0, 300)); await ctx.close();
  },
};

(async () => {
  const only = process.argv[2];
  await h.setup(); const browser = await h.launch();
  try {
    for (const [name, fn] of Object.entries(tests)) {
      if (only && only !== name) continue;
      console.log(`\n▶ ${name}`);
      try { await fn(browser); } catch (e) { check(`${name}: Abbruch`, false, e.stack?.split('\n').slice(0, 3).join(' ')); }
    }
  } finally { await browser.close(); await h.teardown(); }
  const ok = results.filter(r => r.ok).length;
  console.log(`\n${ok}/${results.length} bestanden`);
  process.exit(ok === results.length ? 0 : 1);
})();
