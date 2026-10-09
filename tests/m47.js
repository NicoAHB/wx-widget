// 3.27.0 – Prüfbericht umgesetzt. Abgleich zwischen zwei Geräten (Datei): Vorschau vor dem Übernehmen, geänderte Notiz,
// Löschungen (Grabsteine) in beide Richtungen, hier Gelöschtes bleibt gelöscht (oder wiederherstellen), Abbrechen ändert nichts,
// Einstellungen (Risiko, Tages-Verlustlimit, Rücklage-Satz) und Listen mit Zeitpunkt, Datei im alten Format (ohne Zeitpunkte).
// Kurs-Alarm: Richtung nur aus frischem Kurs (alter Kurs drehte sie um), ohne Kurs Richtung wählen lassen. Futures-Kurse parallel
// mit Fehler je Kürzel. Verlauf in Seiten zu 200 mit wiederverwendeten Zeilen (Messung). Kanäle der App: letzte Zustellung,
// Wiederholen über gut 6 Minuten. 24/7-Dienst 1.3 als eigener Prozess: Telegram lehnt ab → „Störung“ in der App, die App sendet
// selbst; Telegram wieder in Ordnung → Dienst stellt nach, „Zuletzt zugestellt“. Aufruf: node m47.js [merge|price|futures|history|deliver|svc]
const h = require('./harness'), { spawn } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const REPO = require('path').resolve(__dirname, '..'), DBG = 'weather-widget-v2.debug.html';
const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', CHAT = '987654321';
const CHAN = { tg: { token: TOKEN, chat: CHAT, on: true }, dc: { url: '', on: true }, ev: { alarm: true, pos: true, day: true, news: true, pnl: true, pulse: false } };
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const until = async (fn, ms = 20000, step = 250) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
const real = errs => errs.filter(e => !/Service Worker registration blocked/.test(e));
const median = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
function writeDebugPage() {
  const s = fs.readFileSync(`${REPO}/weather-widget-v2.html`, 'utf8'), hook = '\nwindow.__p = { get state() { return state; }, renderHistory };\nrender();startLive();';
  if (!s.includes('\nrender();startLive();')) throw new Error('Einstiegspunkt fehlt');
  fs.writeFileSync(`${REPO}/${DBG}`, s.replace('\nrender();startLive();', hook));
}
async function openPage(browser, seed = {}, { debug = false, ctx = null, viewport = { width: 1600, height: 1000 } } = {}) {
  ctx = ctx || await browser.newContext({ viewport, acceptDownloads: true, timezoneId: 'Europe/Berlin' });
  if (!ctx.seeded) { ctx.seeded = true; await ctx.addInitScript(items => { if (localStorage.getItem('seeded47')) return; localStorage.setItem('seeded47', '1'); for (const [k, v] of items) localStorage.setItem(k, JSON.stringify(v)); }, Object.entries(seed)); }
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  await page.goto(`${h.URL_BASE}/${debug ? DBG : 'weather-widget-v2.html'}`);
  await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 15000 }).catch(() => {});
  return { ctx, page, errors };
}
const ls = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);
const setInput = (page, id, v) => page.evaluate(([id, v]) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [id, v]);
const jsClick = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); if (!e) throw new Error('fehlt: ' + sel); e.click(); }, sel);
async function backup(page, name) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => document.getElementById('backup-save').click())]);
  const f = path.join(os.tmpdir(), `m47-${name}.json`); await dl.saveAs(f); return { f, data: JSON.parse(fs.readFileSync(f, 'utf8')) };
}
async function load(page, f) {
  await page.evaluate(() => { if (document.getElementById('data-panel').hidden) document.getElementById('data-toggle').click(); });
  await page.setInputFiles('#backup-file', f); await page.waitForTimeout(500);
  return page.evaluate(() => { const b = document.getElementById('sync-preview'); return { shown: !b.hidden, items: [...b.querySelectorAll('.sp-list > li')].map(li => li.innerText.replace(/\s*\n\s*/g, ' ⏎ ')), restore: !!b.querySelector('.sp-restore'), status: document.getElementById('history-status').textContent }; });
}
async function take(page, restore = false) {
  if (restore) await page.check('#sync-preview .sp-restore input');
  await page.click('#sync-preview .sp-actions .button.primary-lite'); await page.waitForTimeout(400);
  return page.textContent('#history-status');
}
const ids = (page, k) => page.evaluate(k => (JSON.parse(localStorage.getItem(k) || '[]')).map(x => x.id).sort().join(','), k);
const trade = (id, sym, pnl, closedAt, extra = {}) => ({ id, symbol: sym, side: 'long', mode: 'isolated', entry: 100, leverage: 10, qty: 1, margin: 10, openedAt: closedAt - 3600e3, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false }, note: '', setup: null, exit: 100 + pnl, fees: 0, pnl, pnlSource: 'calc', closedAt, fx: 0.92, ...extra });
const position = (id, sym, entry, extra = {}) => ({ id, symbol: sym, side: 'long', mode: 'cross', entry, leverage: 10, qty: 1, margin: entry / 10, openedAt: Date.now() - 3600e3, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false }, updatedAt: Date.now() - 3600e3, ...extra });

const tests = {
  // ================= Abgleich zwischen zwei Geräten =================
  async merge(browser) {
    const T0 = Date.now() - 5 * 864e5, now = Date.now();
    const seedA = {
      'scalpdesk.positions.v1': [position('P1', 'BTCUSDT', 60000), position('P2', 'XRPUSDT', 1.4)],
      'scalpdesk.history.v1': [trade('T1', 'ETHUSDT', 12.3, T0), trade('T2', 'SOLUSDT', -4.5, T0 + 864e5)],
      'scalpdesk.money.v1': [{ id: 'M1', type: 'deposit', amount: 500, currency: 'EUR', fx: 0.92, date: T0, note: '', createdAt: T0 }],
      'scalpdesk.alarms.v1': [{ id: 'AL1', symbol: 'BTCUSDT', source: 'spot', dir: 'above', price: 99000, note: '', createdAt: now - 600e3, armedAt: now - 600e3, triggeredAt: null, triggerPrice: null }] };
    const A = await openPage(browser, seedA);
    // Einstellungen und Vorauswahl über die Oberfläche ändern (setzt die Änderungszeitpunkte)
    await setInput(A.page, 'risk-pct', '2'); await setInput(A.page, 'risk-fee', '0,05'); await setInput(A.page, 'day-limit', '40');
    await jsClick(A.page, '[data-watchedit]'); await jsClick(A.page, '[data-unwatch="ETC"]'); await jsClick(A.page, '[data-watchedit]');
    const a1 = await backup(A.page, 'a1');
    // 3.29.0: Schema 8 – Abstammung der Einstellungen und Listen (settingsH); die Zeitpunkte bleiben für ältere Versionen in der Datei
    check('Backup Version 8: Abstammung der Einstellungen und der Vorauswahl, Zeitpunkte für ältere Versionen, Löschungen (noch keine)', a1.data.version === 8 && a1.data.kind === 'full' && !!a1.data.settingsH?.risk?.h && !!a1.data.settingsH?.dayLimit?.h && !!a1.data.settingsH?.watch?.h && a1.data.settingsH.watch.hist?.length >= 1
      && a1.data.settings.at.risk > 0 && a1.data.listsAt.watch > 0 && JSON.stringify(a1.data.deleted) === '{}' && a1.data.settings.risk.riskPct === 2,
      JSON.stringify({ v: a1.data.version, kind: a1.data.kind, lin: Object.keys(a1.data.settingsH || {}), at: a1.data.settings.at, lists: a1.data.listsAt, del: a1.data.deleted }));
    // ---- Gerät B (leer): Vorschau, dann übernehmen ----
    const B = await openPage(browser, {});
    let pv = await load(B.page, a1.f);
    const posBefore = await ids(B.page, 'scalpdesk.positions.v1');
    check('B: Vorschau vor dem Übernehmen – neu, Einstellungen, Vorauswahl; noch nichts geändert', pv.shown && pv.items.some(t => /^Neu: 2 Positionen, 2 Trades, 1 Geldbewegung, 1 Kurs-Alarm( ⏎|$)/.test(t)) && pv.items.some(t => /^Risiko-Rechner: Risiko 1 % · Gebühr 0,06 % → Risiko 2 % · Gebühr 0,05 %$/.test(t))
      && pv.items.some(t => /^Tages-Verlustlimit: aus → 40,00 USDT$/.test(t)) && pv.items.some(t => /^Vorauswahl: − ETC$/.test(t)) && posBefore === '' && /Vorschau prüfen/.test(pv.status), JSON.stringify(pv));
    let msg = await take(B.page);
    const bState = await B.page.evaluate(() => ({ risk: JSON.parse(localStorage.getItem('scalpdesk.risk.v1') || 'null'), riskInput: document.getElementById('risk-pct').value, lim: JSON.parse(localStorage.getItem('scalpdesk.daylimit.v1') || 'null'), watch: JSON.parse(localStorage.getItem('scalpdesk.watchlist.v1') || 'null') }));
    check('B: übernommen – Positionen, Trades, Geldbewegung, Alarm', await ids(B.page, 'scalpdesk.positions.v1') === 'P1,P2' && await ids(B.page, 'scalpdesk.history.v1') === 'T1,T2' && await ids(B.page, 'scalpdesk.money.v1') === 'M1' && await ids(B.page, 'scalpdesk.alarms.v1') === 'AL1'
      && /^Übernommen: 2 Positionen neu, 2 Trades, 1 Geldbewegung, 1 Kurs-Alarm, .*Vorauswahl wie auf dem anderen Gerät.*Einstellungen: Risiko-Rechner, Tages-Verlustlimit/.test(msg), msg);
    check('B: Risiko-Einstellungen wiederhergestellt (Befund: blieben bisher auf dem Standard), Tages-Verlustlimit, Vorauswahl ohne ETC', bState.risk?.riskPct === 2 && bState.risk?.feePct === 0.05 && bState.riskInput === '2' && bState.lim === 40 && Array.isArray(bState.watch) && !bState.watch.includes('ETC'), JSON.stringify(bState));
    // ---- B ändert: Notiz an T1, löscht Geldbewegung und Alarm ----
    await B.page.evaluate(() => { document.getElementById('history').open = true; });
    await jsClick(B.page, '[data-trade="T1"] [data-action="trade-note"]'); await B.page.fill('[data-note="T1"]', 'Notiz von Gerät B');
    await jsClick(B.page, '[data-trade="T1"] [data-action="note-save"]');
    await jsClick(B.page, '[data-mv="M1"] [data-action="mv-delete"]'); await jsClick(B.page, '[data-mv="M1"] [data-action="mv-confirm"]');
    await jsClick(B.page, '[data-alarm="AL1"] [data-action="al-delete"]'); await B.page.waitForTimeout(300);
    const b1 = await backup(B.page, 'b1'), t1b = b1.data.history.find(t => t.id === 'T1');
    check('B: Backup enthält die geänderte Notiz (mit Zeitpunkt) und die Löschungen', t1b?.note === 'Notiz von Gerät B' && t1b.updatedAt > t1b.closedAt && b1.data.deleted['m:M1'] > 0 && b1.data.deleted['a:AL1'] > 0 && !b1.data.movements.length && !b1.data.alarms.length, JSON.stringify({ note: t1b?.note, del: b1.data.deleted }));
    // ---- A spielt B ein: geänderte Notiz und Löschungen kommen an ----
    pv = await load(A.page, b1.f);
    check('A: Vorschau nennt die geänderte Notiz und die Löschungen mit Beispiel', pv.shown && pv.items.some(t => /^Geändert: 1 Trade ⏎ Trade ETH Long vom \d\d\.\d\d\.\d\d, \d\d:\d\d \(\+12,30 USDT\): Notiz$/.test(t))
      && pv.items.some(t => /^Auf dem anderen Gerät gelöscht: 1 Geldbewegung, 1 Kurs-Alarm – werden hier gelöscht ⏎ Einzahlung aufs Tradingkonto 500,00 EUR vom \d+\.\d+\.\d{4} ⏎ Kurs-Alarm BTC auf\/über 99\.000,00$/.test(t)) && !pv.items.some(t => /^Neu|Risiko|Vorauswahl/.test(t)), JSON.stringify(pv.items));
    msg = await take(A.page);
    const aT1 = (await ls(A.page, 'scalpdesk.history.v1')).find(t => t.id === 'T1');
    check('A: Notiz übernommen, Geldbewegung und Alarm gelöscht (Befund: blieben bisher bestehen)', aT1?.note === 'Notiz von Gerät B' && await ids(A.page, 'scalpdesk.money.v1') === '' && await ids(A.page, 'scalpdesk.alarms.v1') === '' && /^Übernommen: 1 Trade geändert, 2 gelöscht wie auf dem anderen Gerät/.test(msg), msg);
    // ---- A löscht T2; dieselbe Datei von B (T2 noch drin): bleibt gelöscht, auf Wunsch wiederherstellen ----
    await A.page.evaluate(() => { document.getElementById('history').open = true; });
    await jsClick(A.page, '[data-trade="T2"] [data-action="trade-delete"]'); await jsClick(A.page, '[data-trade="T2"] [data-action="trade-confirm"]');
    pv = await load(A.page, b1.f);
    check('A: hier gelöschter Trade, in der Datei noch vorhanden → Vorschau „bleibt hier gelöscht“ mit Wiederherstellen', pv.shown && pv.restore && pv.items.some(t => /^Hier gelöscht: 1 Trade – noch in der Sicherung, bleibt hier gelöscht ⏎ Trade SOL Long vom .* \(−4,50 USDT\)$/.test(t)), JSON.stringify(pv));
    msg = await take(A.page);
    check('A: ohne Häkchen bleibt T2 gelöscht', await ids(A.page, 'scalpdesk.history.v1') === 'T1' && /^Nichts Neues – alle \d+ Einträge waren schon aktuell · 1 hier gelöschter Eintrag bleibt gelöscht\.$/.test(msg), msg);
    await load(A.page, b1.f); msg = await take(A.page, true);
    const tombs = await ls(A.page, 'scalpdesk.deleted.v1');
    check('A: mit Häkchen „wiederherstellen“: T2 zurück, Grabstein entfernt', await ids(A.page, 'scalpdesk.history.v1') === 'T1,T2' && !('pt:T2' in tombs) && /1 wiederhergestellt/.test(msg), `${msg} · ${JSON.stringify(tombs)}`);
    // ---- Abbrechen: nichts ändert sich ----
    const C = await openPage(browser, {});
    pv = await load(C.page, a1.f);
    await C.page.click('#sync-preview .sp-actions .button.ghost'); await C.page.waitForTimeout(300);
    check('Abbrechen: nichts übernommen, Vorschau weg', pv.shown && await ids(C.page, 'scalpdesk.positions.v1') === '' && await C.page.evaluate(() => document.getElementById('sync-preview').hidden) && /^Abgleich abgebrochen – nichts geändert\.$/.test(await C.page.textContent('#history-status')));
    // ---- Datei im alten Format (bis 3.26, ohne Zeitpunkte, Abstammung und Löschungen) auf B ----
    // 3.29.0: Was dort nie geändert wurde (Standardwert), bleibt hier; was hier nie geändert wurde, kommt von dort; haben beide
    // Geräte verschieden geändert, entscheidest du (Konflikt) – nicht mehr „hier gesetzt gewinnt“ und nicht nach Uhrzeit.
    const SETUPS0 = ['Ausbruch', 'Rücklauf zum POC', 'Unterstützung hält', 'Widerstand hält', 'RSI überverkauft', 'RSI überkauft', 'Bollinger außen', 'EMA 200', 'Trendfolge'];
    const old = { app: 'scalp-desk', version: 6, settings: { dayLimit: 25, risk: { riskPct: 3, feePct: 0.1 } }, taxRate: 30, exportedAt: Date.now(), positions: [], history: [trade('T9', 'LTCUSDT', 3, T0 + 2 * 864e5)], movements: [], alarms: [], setups: [...SETUPS0, 'Altes Setup'], watchlist: ['BTC', 'DOGE'] };
    const fOld = path.join(os.tmpdir(), 'm47-alt.json'); fs.writeFileSync(fOld, JSON.stringify(old));
    pv = await load(B.page, fOld);
    check('Altes Format: T9 neu, hier nie Geändertes kommt (Rücklage-Satz, Setup); beidseitig Geändertes (Risiko, Limit, Vorauswahl) als Konflikt; nichts gelöscht', pv.items.some(t => /^Neu: 1 Trade( ⏎|$)/.test(t)) && pv.items.some(t => /^Rücklage-Satz: aus → 30 %$/.test(t)) && pv.items.some(t => /^Setups & eigene Gründe: \+ Altes Setup$/.test(t))
      && pv.items.some(t => /^⚖ Konflikte: 3 – .* ⏎ Risiko-Rechner ⏎ Tages-Verlustlimit ⏎ Vorauswahl$/.test(t)) && !pv.items.some(t => /gelöscht/.test(t)), JSON.stringify(pv.items));
    msg = await take(B.page);
    const bSt = () => B.page.evaluate(() => { const g = k => JSON.parse(localStorage.getItem(k) || 'null'); return { lim: g('scalpdesk.daylimit.v1'), risk: g('scalpdesk.risk.v1'), tax: g('scalpdesk.taxrate.v1'), watch: g('scalpdesk.watchlist.v1'), setups: g('scalpdesk.setups.v1'), conf: (g('scalpdesk.conflicts.v1') || []).map(c => c.f || c.id) }; });
    let b2 = await bSt();
    check('Altes Format übernommen: T9 dazu, Rücklage 30 %, „Altes Setup“; bis zur Entscheidung gelten Limit 40, Risiko 2 % und die Vorauswahl dieses Geräts', await ids(B.page, 'scalpdesk.history.v1') === 'T1,T2,T9' && b2.lim === 40 && b2.risk.riskPct === 2 && b2.tax === 30 && b2.setups?.includes('Altes Setup') && !b2.watch?.includes('DOGE')
      && b2.conf.join() === 'risk,dayLimit,watch' && /3 Konflikte warten auf deine Entscheidung/.test(msg), `${msg} · ${JSON.stringify(b2)}`);
    // Einzeln entscheiden: Risiko vom anderen Gerät übernehmen, Limit behalten, Vorauswahl später
    await B.page.waitForFunction(() => document.getElementById('conf-dialog').open, null, { timeout: 5000 }).catch(() => {});
    for (let i = 0; i < 3; i++) {
      const w = await B.page.evaluate(() => document.getElementById('conf-what').textContent);
      await jsClick(B.page, /^Risiko/.test(w) ? '#conf-take' : /^Tages-Verlustlimit/.test(w) ? '#conf-keep' : '#conf-later'); await B.page.waitForTimeout(250);
    }
    b2 = await bSt();
    check('Entschieden: Risiko 3 % · Gebühr 0,1 % (Entwurf übernommen), Limit 40 behalten, Vorauswahl bleibt offen und unverändert', b2.risk?.riskPct === 3 && b2.risk?.feePct === 0.1 && b2.lim === 40 && b2.conf.join() === 'watch' && !b2.watch?.includes('DOGE'), JSON.stringify(b2));
    if (await B.page.evaluate(() => document.getElementById('conf-dialog').open)) await jsClick(B.page, '#conf-close');
    pv = await load(B.page, fOld);
    check('Dieselbe alte Datei noch einmal: keine neue Rückfrage zu Risiko und Limit (entschieden), Vorauswahl nur einmal offen', !pv.items.some(t => /Risiko|Tages-Verlustlimit|^Neu/.test(t)) && (await bSt()).conf.join() === 'watch', JSON.stringify(pv));
    if (pv.shown) await B.page.click('#sync-preview .sp-actions .button.ghost');
    // ---- Zweiter Tab desselben Geräts übernimmt die Löschungen (Grabsteine) mit ----
    const B2 = await B.ctx.newPage(), e2 = []; h.collect(B2, e2); await B2.goto(`${h.URL_BASE}/weather-widget-v2.html`); await B2.waitForTimeout(1500);
    await B.page.evaluate(() => { document.getElementById('history').open = true; });
    await jsClick(B.page, '[data-trade="T9"] [data-action="trade-delete"]'); await jsClick(B.page, '[data-trade="T9"] [data-action="trade-confirm"]'); await B.page.waitForTimeout(600);
    const t2 = await B2.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.deleted.v1') || '{}'));
    check('Zweiter Tab: Löschung samt Grabstein übernommen', 'pt:T9' in t2, JSON.stringify(t2));
    check('keine Fehler (Abgleich)', !real([...A.errors, ...B.errors, ...C.errors, ...e2]).length, real([...A.errors, ...B.errors, ...C.errors, ...e2]).join(' | ').slice(0, 400));
    await A.ctx.close(); await B.ctx.close(); await C.ctx.close();
  },

  // ================= Kurs-Alarm: Richtung nur aus frischem Kurs =================
  async price(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=ETHUSDT&price=2500');
    const now = Date.now(), seed = { 'scalpdesk.alarms.v1': [{ id: 'old', symbol: 'ETHUSDT', source: 'spot', dir: 'above', price: 1, note: '', createdAt: now - 7200e3, armedAt: now - 7200e3, triggeredAt: now - 3600e3, triggerPrice: 1 }] };
    const { ctx, page, errors } = await openPage(browser, seed, { debug: true }); await live(page); await page.waitForTimeout(800);
    const stale = () => page.evaluate(() => { window.__p.state.prices.ETHUSDT = { price: 1000, at: Date.now() - 600e3, error: null }; });
    const alarms = () => ls(page, 'scalpdesk.alarms.v1');
    await stale();
    await jsClick(page, '#alarm-toggle'); await page.fill('#al-symbol', 'ETH'); await page.fill('#al-price', '2000'); await page.waitForTimeout(200);
    const pre = await page.textContent('#al-preview');
    check('Vorschau mit altem Kurs: nennt ihn mit Uhrzeit, Richtung prüft die App beim Speichern', /\(zuletzt 1\.000,00 um \d\d:\d\d; die Richtung prüft die App beim Speichern mit dem aktuellen Kurs\)\.$/.test(pre), pre);
    await page.click('#al-save'); await page.waitForTimeout(1200);
    let a = (await alarms()).find(x => x.id !== 'old' && x.price === 2000);
    const p = await page.evaluate(() => window.__p.state.prices.ETHUSDT);
    check('Alter Kurs 1.000, aktuell 2.500, Ziel 2.000: Richtung „fällt auf/unter“ aus dem frisch geholten Kurs (Befund: bisher „steigt“)', a?.dir === 'below' && p.price === 2500 && Date.now() - p.at < 5000, JSON.stringify({ dir: a?.dir, preis: p }));
    // Binance liefert keinen Kurs: ohne gewählte Richtung nicht speichern, mit gewählter speichern
    // ohne frischen Kurs auch über den Live-Stream (sonst kann er während des Tests einen nachschieben – Wettlauf im Test, nicht in der App)
    await h.ctl('/blockws?on=1'); await h.ctl('/tick?fail=ETHUSDT'); await stale();
    await jsClick(page, '#alarm-toggle'); await page.fill('#al-symbol', 'ETH'); await page.fill('#al-price', '1800'); await page.click('#al-save'); await page.waitForTimeout(1500);
    const err = await page.evaluate(() => { const e = document.getElementById('al-error'); return e.hidden ? '' : e.textContent; });
    check('Kein aktueller Kurs: Hinweis „Richtung wählen“, nichts gespeichert', /^Kein aktueller Kurs für ETH – die Richtung lässt sich nicht sicher bestimmen\. Bitte oben „steigt auf\/über“ oder „fällt auf\/unter“ antippen und erneut speichern\.$/.test(err) && !(await alarms()).some(x => x.price === 1800), err);
    await page.click('[data-al-dir="below"]'); await page.click('#al-save'); await page.waitForTimeout(1500);
    a = (await alarms()).find(x => x.price === 1800);
    check('… Richtung gewählt („fällt auf/unter“): gespeichert', a?.dir === 'below', JSON.stringify(a));
    await h.ctl('/tick'); await h.ctl('/blockws?on=0');
    // „Aktuellen Kurs einsetzen“ nur mit frischem Kurs
    await page.evaluate(() => { window.__p.state.prices.SOLUSDT = { price: 99, at: Date.now() - 600e3, error: null }; });
    await jsClick(page, '#pos-add-toggle'); await page.fill('#pos-symbol', 'SOL'); await page.waitForTimeout(300);
    const btnHidden = await page.evaluate(() => document.getElementById('pos-entry-now').hidden);
    check('Position erfassen: alter Kurs → kein „Aktuellen Kurs einsetzen“', btnHidden === true);
    check('keine Fehler (Kurs-Alarm; ohne die absichtlich gescheiterten Abfragen)', !real(errors).filter(e => !/status of 503/.test(e)).length, real(errors).join(' | ').slice(0, 300)); await ctx.close();
  },

  // ================= Futures-Kurse parallel, Fehler je Kürzel =================
  async futures(browser) {
    const fut = (id, sym, entry) => position(id, sym, entry, { source: 'futures' });
    await h.ctl('/blockws?on=1'); await h.ctl('/tick?fail=ETHUSDT&delay=BTCUSDT:1500,SOLUSDT:1500');
    const t0 = Date.now(), { ctx, page, errors } = await openPage(browser, { 'scalpdesk.positions.v1': [fut('F1', 'BTCUSDT', 60000), fut('F2', 'ETHUSDT', 2400), fut('F3', 'SOLUSDT', 140)] }, { debug: true });
    const st = await until(async () => { const p = await page.evaluate(() => { const s = window.__p.state.prices; return { b: s.BTCUSDT, e: s.ETHUSDT, s: s.SOLUSDT }; }); return p.b?.price && p.s?.price && p.e?.error ? p : null; }, 30000);
    const log = (await h.ctl(`/log?since=${t0}`)).filter(e => e.path === '/fapi/v1/ticker/price' && ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].includes(e.q.symbol));
    const first = {}; for (const e of log) if (!(e.q.symbol in first)) first[e.q.symbol] = e.at;
    const spread = Math.max(...Object.values(first)) - Math.min(...Object.values(first));
    check('Futures-Kurse: BTC und SOL kommen, ETH mit eigenem Fehler (vorher: ein Fehler → alle ohne Kurs)', !!st && st.b.error === null && st.s.error === null && /503|Service unavailable|nicht erreichbar|Fehler/i.test(st.e.error || ''), JSON.stringify(st));
    check('Futures-Kurse parallel: alle drei Abfragen beginnen gleichzeitig (vorher nacheinander, je 1,5 s Verzögerung)', Object.keys(first).length === 3 && spread < 600, `${Object.entries(first).map(([k, v]) => `${k} +${v - t0} ms`).join(', ')} · Abstand ${spread} ms`);
    await h.ctl('/tick'); await h.ctl('/blockws?on=0');
    check('keine Fehler (Futures; ohne die absichtlich gescheiterten Abfragen)', !real(errors).filter(e => !/status of 503/.test(e)).length, real(errors).join(' | ').slice(0, 300)); await ctx.close();
  },

  // ================= Verlauf: Seiten zu 200, Zeilen wiederverwenden =================
  async history(browser) {
    const many = n => Array.from({ length: n }, (_, i) => trade('h' + i, ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'][i % 4], (i % 7) - 3, Date.now() - (i + 1) * 3 * 3600e3, { note: i % 5 ? '' : 'Notiz ' + i }));
    let { ctx, page, errors } = await openPage(browser, { 'scalpdesk.history.v1': many(1000) }, { debug: true });
    await page.waitForTimeout(1200); await page.evaluate(() => { document.getElementById('history').open = true; });
    const rows = () => page.evaluate(() => ({ n: document.querySelectorAll('#history-list > .trade-row').length, more: document.getElementById('history-more').hidden ? '' : document.getElementById('history-more').textContent }));
    let r = await rows();
    check('1.000 Trades: 200 Zeilen gezeichnet, Knopf „Weitere 200 anzeigen (noch 800 ältere)“', r.n === 200 && r.more === 'Weitere 200 anzeigen (noch 800 ältere)', JSON.stringify(r));
    await page.click('#history-more'); r = await rows();
    check('„Weitere anzeigen“: 400 Zeilen', r.n === 400 && r.more === 'Weitere 200 anzeigen (noch 600 ältere)', JSON.stringify(r));
    await page.evaluate(() => { const s = document.getElementById('year-filter'); s.value = 'all'; s.dispatchEvent(new Event('change', { bubbles: true })); }); r = await rows();
    check('Anderes Jahr gewählt: wieder 200 Zeilen', r.n === 200, JSON.stringify(r));
    // Zeilen bleiben stehen, wenn sich nur eine ändert
    await page.evaluate(() => { document.querySelectorAll('#history-list > .trade-row')[4].__keep = 1; });
    await jsClick(page, '#history-list > .trade-row:first-child [data-action="trade-note"]'); await page.fill('#history-list > .trade-row:first-child textarea', 'Neue Notiz');
    await jsClick(page, '#history-list > .trade-row:first-child [data-action="note-save"]');
    const kept = await page.evaluate(() => ({ keep: document.querySelectorAll('#history-list > .trade-row')[4].__keep === 1, note: document.querySelector('#history-list > .trade-row:first-child .trade-note')?.textContent, n: document.querySelectorAll('#history-list > .trade-row').length }));
    check('Notiz gespeichert: nur die geänderte Zeile neu, die anderen bleiben dieselben', kept.keep && kept.note === 'Neue Notiz' && kept.n === 200, JSON.stringify(kept));
    check('keine Fehler (Verlauf 1.000)', !real(errors).length, real(errors).join(' | ').slice(0, 300)); await ctx.close();
    // Messung: Notiz speichern bei 5.000 und 10.000 Trades (vorher 2,2 s und 4,0 s)
    for (const N of [5000, 10000]) {
      ({ ctx, page, errors } = await openPage(browser, { 'scalpdesk.history.v1': many(N) }, { debug: true }));
      await page.waitForTimeout(2000); await page.evaluate(() => { document.getElementById('history').open = true; });
      const ms = await page.evaluate(async () => {
        const out = [];
        for (let k = 0; k < 5; k++) {
          document.querySelector('#history-list > .trade-row:nth-child(3) [data-action="trade-note"]').click();
          const ta = document.querySelector('#history-list > .trade-row:nth-child(3) textarea'); ta.value = 'Messung ' + k; ta.dispatchEvent(new Event('input', { bubbles: true }));
          const t = performance.now(); document.querySelector('#history-list > .trade-row:nth-child(3) [data-action="note-save"]').click(); out.push(performance.now() - t);
          await new Promise(r => setTimeout(r, 300));
        }
        return out;
      });
      check(`${N} Trades: Notiz speichern samt Neuzeichnen im Median ${Math.round(median(ms))} ms (vorher ${N === 5000 ? '2,2 s' : '4,0 s'})`, median(ms) < 400, ms.map(x => Math.round(x)).join(', ') + ' ms');
      check(`keine Fehler (Verlauf ${N})`, !real(errors).length, real(errors).join(' | ').slice(0, 300)); await ctx.close();
    }
  },

  // ================= Kanäle der App: letzte Zustellung, längeres Wiederholen =================
  async deliver(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/tgreset');
    const st0 = (await h.ctl('/state')).price, B0 = Math.round(st0.BTCUSDT), E0 = Math.round(st0.ETHUSDT);
    await h.ctl(`/set?symbol=BTCUSDT&price=${B0}`); await h.ctl(`/set?symbol=ETHUSDT&price=${E0}`);
    const now = Date.now(), al = (id, sym, price) => ({ id, symbol: sym, source: 'spot', dir: 'above', price, note: '', createdAt: now - 60e3, armedAt: now - 60e3, triggeredAt: null, triggerPrice: null });
    let { ctx, page, errors } = await openPage(browser, { 'scalpdesk.channels.v1': CHAN, 'scalpdesk.alarms.v1': [al('ab', 'BTCUSDT', B0 + 100), al('ae', 'ETHUSDT', E0 + 10)] });
    await live(page); await page.waitForTimeout(1500);
    let t0 = Date.now(); await h.ctl(`/set?symbol=BTCUSDT&price=${B0 + 150}`);
    const sentOk = (re, since) => h.ctl('/sent').then(s => s.filter(m => m.svc === 'tg' && m.method === undefined && re.test(m.text || '') && m.at >= since));
    let m = await until(async () => { const x = (await sentOk(/^🔔 Kurs-Alarm BTC/, t0)).filter(y => !y.failed); return x.length ? x : null; }, 20000);
    await page.waitForTimeout(800);
    let sum = await page.textContent('#chan-summary');
    check('Kurs-Alarm gesendet: Übersicht „zuletzt zugestellt … (Kurs-Alarm BTC)“', !!m && /^Telegram: aktiv · zuletzt zugestellt \d\d\.\d\d\., \d\d:\d\d \(Kurs-Alarm BTC\)/.test(sum), sum);
    await page.reload(); await page.waitForTimeout(2000); sum = await page.textContent('#chan-summary');
    check('… auch nach dem Neuladen', /zuletzt zugestellt \d\d\.\d\d\., \d\d:\d\d \(Kurs-Alarm BTC\)/.test(sum), sum);
    // Telegram lehnt 5 Versuche mit 502 ab: früher nach dem 5. Versuch verloren, jetzt kommt der 6. an (nach knapp 2 Minuten)
    await live(page); await h.ctl('/chan?tg502=5'); t0 = Date.now(); await h.ctl(`/set?symbol=ETHUSDT&price=${E0 + 20}`);
    m = await until(async () => { const x = await sentOk(/^🔔 Kurs-Alarm ETH/, t0); return x.some(y => !y.failed) ? x : null; }, 170000, 1000);
    check('Telegram 5× „502“: die Meldung kommt beim 6. Versuch an (vorher nach 5 Versuchen verloren)', !!m && m.filter(y => y.failed === 502).length === 5 && m.filter(y => !y.failed).length === 1, m ? `${m.length} Versuche, zugestellt nach ${Math.round((m.at(-1).at - t0) / 1000)} s` : 'nicht zugestellt');
    await page.waitForTimeout(800); sum = await page.textContent('#chan-summary');
    check('… Übersicht: zuletzt zugestellt (Kurs-Alarm ETH)', /\(Kurs-Alarm ETH\)/.test(sum), sum);
    check('keine Fehler (Kanäle)', !real(errors).length, real(errors).join(' | ').slice(0, 300)); await ctx.close();
  },

  // ================= 24/7-Dienst 1.3: Störung in der App, Nachstellen =================
  async svc(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/tgreset');
    const P0 = Math.round((await h.ctl('/state')).price.BTCUSDT); await h.ctl(`/set?symbol=BTCUSDT&price=${P0}`);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm47-')), mock = p => fetch('http://127.0.0.1:8790' + p).then(r => r.json());
    const pinnedMsg = async () => { const m = (await mock(`/tgmsgs?chat=${CHAT}`)).filter(x => x.pinnedAt).sort((a, b) => b.message_id - a.message_id)[0] || null; if (m) m.caption = String(m.caption || '').replace(/\r/g, ''); return m; };
    const now = Date.now(), alarms = [{ id: 'sv1', symbol: 'BTCUSDT', source: 'spot', dir: 'above', price: P0 + 200, note: '', createdAt: now - 60e3, armedAt: now - 60e3, triggeredAt: null, triggerPrice: null }];
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Berlin' });
    let svc = null;
    try {
      let { page, errors } = await openPage(browser, { 'scalpdesk.channels.v1': CHAN, 'scalpdesk.alarms.v1': alarms }, { ctx }); await live(page); await page.waitForTimeout(1200);
      console.log('Diagnose Dienststart:', JSON.stringify(await page.evaluate(() => ({ alarms: __g05.state.alarms.map(a => ({ id: a.id, price: a.price, triggeredAt: a.triggeredAt, triggerPrice: a.triggerPrice })), price: __g05.state.prices.BTCUSDT?.price }))));
      await page.click('#notify-menu'); await page.waitForTimeout(250); await page.click('#chan-open'); await page.waitForTimeout(400);
      await page.check('#s247-on'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      svc = startService(dir);
      const conf = await until(async () => { const m = await pinnedMsg(); return m && /\nDienst: aktiv · .* übernommen\nZustellung: geprüft, noch keine Meldung/.test(m.caption) ? m : null; }, 25000);
      check('Dienst 1.3: „Dienst: aktiv“, darunter „Zustellung: geprüft, noch keine Meldung“', !!conf, (await pinnedMsg())?.caption.replace(/\n/g, ' ⏎ ') || svc.log.join(' | '));
      let st = await s247Status(page);
      check('App: „Übergeben ✓ vom Dienst bestätigt … Zugestellt hat er noch keine Meldung.“', /^Übergeben ✓ vom Dienst bestätigt .*Zugestellt hat er noch keine Meldung\./.test(st), st);
      // Telegram lehnt die Meldungen des Dienstes ab (400); App geschlossen
      await h.ctl('/chan?tgfail=400&match=' + encodeURIComponent('24/7-Dienst'));
      await page.close(); const t0 = Date.now();
      await h.ctl(`/set?symbol=BTCUSDT&price=${P0 + 250}`);
      const bad = await until(async () => { const m = await pinnedMsg(); return m && /\nDienst: Störung · .* · Telegram-Nachricht nicht zustellbar seit \d\d:\d\d \(Telegram sendMessage: Bad Request: message is too long/.test(m.caption) ? m : null; }, 30000);
      const tries = (await h.ctl('/sent')).filter(m => m.svc === 'tg' && /^🔔 Kurs-Alarm BTC/.test(m.text || '') && m.at >= t0);
      check('Telegram lehnt ab: Dienst meldet „Störung“ (Befund: galt als gesendet, Status „aktiv“), Meldung bleibt im Ausgang', !!bad && tries.length >= 1 && tries.every(m => m.failed === 400), (await pinnedMsg())?.caption.split('\n').find(l => l.startsWith('Dienst:')) || '');
      // Dieser Test nutzt die ältere Telegram-Übergabe, keine HTTPS-Sendefreigabe.
      // Kurs bei Wiederöffnung unter Ziel halten, bis die App die Dienststörung
      // bestätigt hat. Sonst kann die Auslösung vor der Statusabfrage stattfinden.
      await h.ctl(`/set?symbol=BTCUSDT&price=${P0}`);
      ({ page, errors } = await openPage(browser, {}, { ctx })); await live(page); await page.waitForTimeout(1500);
      console.log('Diagnose Wiederöffnung:', JSON.stringify(await page.evaluate(() => ({ alarms: __g05.state.alarms.map(a => ({ id: a.id, price: a.price, triggeredAt: a.triggeredAt, triggerPrice: a.triggerPrice, svcAt: a.svcAt })), price: __g05.state.prices.BTCUSDT?.price }))));
      st = await s247Status(page); const sum = await page.textContent('#chan-summary');
      check('App: „⚠ Der Dienst meldet eine Störung: Telegram-Nachricht nicht zustellbar …“, Übersicht „24/7-Dienst: Störung“', /^⚠ Der Dienst meldet eine Störung: Telegram-Nachricht nicht zustellbar seit \d\d:\d\d .*Die App sendet deshalb selbst\./.test(st) && /24\/7-Dienst: Störung/.test(sum), `${st} · ${sum}`);
      const beforeFallback = await page.evaluate(() => { const a = __g05.state.alarms.find(a => a.id === 'sv1'); return { triggeredAt: a?.triggeredAt, price: __g05.state.prices.BTCUSDT?.price }; });
      check('Legacy-Fallback erst nach bestätigter Störung und ohne vorherige App-Auslösung', beforeFallback.triggeredAt === null && beforeFallback.price < P0 + 200 && /Die App sendet deshalb selbst/.test(st), JSON.stringify(beforeFallback));
      await h.ctl(`/set?symbol=BTCUSDT&price=${P0 + 250}`);
      const own = await until(async () => { const x = (await h.ctl('/sent')).filter(m => m.svc === 'tg' && /^🔔 Kurs-Alarm BTC/.test(m.text || '') && !/24\/7-Dienst/.test(m.text) && !m.failed && m.at >= t0); return x.length ? x : null; }, 20000);
      check('… und die App sendet den Kurs-Alarm selbst', own?.length === 1, own ? own[0].text.replace(/\n/g, ' ⏎ ') : 'keine Meldung der App');
      // Telegram wieder in Ordnung: der Dienst stellt nach
      await h.ctl('/chan?tgfail=');
      const done = await until(async () => { const x = (await h.ctl('/sent')).filter(m => m.svc === 'tg' && /^🔔 Kurs-Alarm BTC/.test(m.text || '') && /24\/7-Dienst/.test(m.text) && !m.failed && m.at >= t0); return x.length ? x : null; }, 150000, 1000);
      const cap = await until(async () => { const m = await pinnedMsg(); return m && /\nDienst: aktiv · /.test(m.caption) && /\nZustellung: zuletzt \d\d\.\d\d\. \d\d:\d\d · Kurs-Alarm BTC/.test(m.caption) ? m : null; }, 30000);
      check('Telegram wieder erreichbar: Dienst stellt die Meldung einmal nach, Status wieder „aktiv“, „Zustellung: zuletzt … · Kurs-Alarm BTC“', done?.length === 1 && !!cap, `${done ? done[0].text.replace(/\n/g, ' ⏎ ') : 'nicht nachgestellt'} · ${cap ? 'Beschriftung ok' : (await pinnedMsg())?.caption.replace(/\n/g, ' ⏎ ')}`);
      st = await s247Status(page);
      check('App: „Übergeben ✓ vom Dienst bestätigt … Zuletzt zugestellt: … (Kurs-Alarm BTC).“', /^Übergeben ✓ vom Dienst bestätigt .*Zuletzt zugestellt: \d\d\.\d\d\., \d\d:\d\d \(Kurs-Alarm BTC\)\./.test(st), st);
      check('keine Fehler (24/7-Dienst)', !real(errors).length, real(errors).join(' | ').slice(0, 300));
      check('Dienst-Protokoll ohne Token', svc && !svc.log.join('\n').includes(TOKEN.split(':')[1]), '');
    } finally { svc?.kill(); await ctx.close(); await h.ctl('/chan?tgfail='); }
  },
};
function startService(dir) {
  const env = { ...process.env, SCALPDESK_FAST: '1', NODE_TLS_REJECT_UNAUTHORIZED: '0', SCALPDESK_TG_API: 'https://127.0.0.1/_h/api.telegram.org', SCALPDESK_SPOT_API: 'https://127.0.0.1/_h/data-api.binance.vision',
    SCALPDESK_FUT_API: 'https://127.0.0.1/_h/fapi.binance.com', SCALPDESK_CAL_URL: 'https://127.0.0.1/_h/raw.githubusercontent.com/NicoAHB/wx-widget/kalender/calendar.json', NODE_NO_WARNINGS: '1' };
  for (const k of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']) delete env[k];
  fs.writeFileSync(path.join(dir, 'conf.json'), JSON.stringify({ token: TOKEN, chat: CHAT }));
  const p = spawn('node', [`${REPO}/server/scalpdesk-247.mjs`, '--config', path.join(dir, 'conf.json'), '--state', path.join(dir, 'state.json')], { env });
  p.log = []; p.stdout.on('data', d => p.log.push(String(d).trim())); p.stderr.on('data', d => p.log.push('! ' + String(d).trim()));
  return p;
}
async function s247Status(page) {
  for (const b of await page.$$('#toasts .toast button')) await b.click().catch(() => {});
  await page.click('#notify-menu'); await page.waitForTimeout(250); await page.click('#chan-open'); await page.waitForTimeout(400);
  await page.click('#s247-check'); await page.waitForFunction(() => !document.getElementById('s247-check').disabled, null, { timeout: 10000 }).catch(() => {}); await page.waitForTimeout(400);
  // Eine durch den ausgelösten Alarm parallel angestoßene Übergabe kann noch laufen.
  // Erst deren tatsächlichen Abschluss lesen, statt zufällig „Übergebe …“ zu prüfen.
  await page.waitForFunction(() => !/^Übergebe an den 24\/7-Dienst/.test(document.getElementById('s247-status').textContent), null, { timeout: 10000 }).catch(() => {});
  const t = await page.evaluate(() => document.getElementById('s247-status').textContent);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300); return t;
}

(async () => {
  const want = process.argv.slice(2), names = want.length ? want : Object.keys(tests);
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/tgreset'); writeDebugPage();
  const browser = await h.launch();
  try { for (const n of names) { console.log(`== ${n}`); try { await tests[n](browser); } catch (e) { check(`${n}: Abbruch`, false, e.message.split('\n')[0]); } await h.ctl('/reset'); } }
  finally { await browser.close(); await h.teardown(); try { fs.unlinkSync(`${REPO}/${DBG}`); } catch {} }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
