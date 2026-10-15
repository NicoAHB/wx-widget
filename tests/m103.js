// 3.69.0 – Trade-Karte: Kerzen ohne Fehler −1100, einmal geladen und zum Trade gespeichert, Ersatzquellen, Kennzahlen,
// Markierungen und kurze Bildunterschrift. Beispiel-Trade wie gemeldet: XRP/USDT 24.09.2026, 1:52 Std. (3.71.0: Long-Gewinn 19:35 bis 21:27).
// xrp:      Anfrage mit ganzzahligen startTime/endTime (10 Min. vor Eintritt bis 10 Min. nach Austritt, 1m), Kerzen kompakt in der
//           IndexedDB, zweites Öffnen ohne Börse (auch bei Ausfall); Max. Gewinn/Verlust und Positionswerte unabhängig nachgerechnet;
//           Beschriftungen „Kurs (± €)“ ohne Überlappung im Chart; Senden von Hand mit kurzer Bildunterschrift.
// fallback: Futures mit zwei Wiederholungen; −1100 ohne Wiederholung; dann data-api.binance.vision; dann Bybit; alles aus →
//           Ersatzlinie (nichts gespeichert), später nachgeladen.
// auto:     Abschluss in der App → Kerzen sofort gespeichert, genau ein Bild; Neuladen ohne zweites; Telegram-Fehler im Klartext.
// Aufruf: node m103.js [xrp|fallback|auto]
const h = require('./harness'), https = require('https'), fs = require('fs'), path = require('path');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 700) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR/.test(e));
const until = async (fn, ms = 20000, step = 200) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', ALERT = '987654321', BACKUP = '-100555', TRADES = '-100777';
const EV = { alarm: true, pos: true, day: true, news: false, pnl: false, pulse: false, trade: true };
const chanCfg = () => ({ tg: { token: TOKEN, chat: ALERT, thread: '', bchat: BACKUP, bthread: '', btoken: '', tchat: TRADES, tthread: '', ttoken: '' }, dc: { url: '', on: true }, ev: EV, mig33: true });
const FX = 1.138, Q = 760, LEV = 20;   // 3.71.0: wie in der Vorlage des Nutzers (760 XRP, 20×, Cross)
// 24.09.2026, 19:35 bis 21:27 (Europe/Berlin, Sommerzeit = UTC+2) – in den Attrappen-Kerzen ein Anstieg (Long im Gewinn wie in der Vorlage)
const OPEN = Date.UTC(2026, 8, 24, 17, 35), CLOSE = Date.UTC(2026, 8, 24, 19, 27);
const getJson = url => new Promise((resolve, reject) => https.get(url, { rejectUnauthorized: false }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { resolve({ status: r.statusCode, body: JSON.parse(b) }); } catch (e) { reject(e); } }); }).on('error', reject));
const klines = (host, p) => getJson(`https://127.0.0.1/_h/${host}${host === 'fapi.binance.com' ? '/fapi/v1/klines' : '/api/v3/klines'}?${new URLSearchParams(p)}`);
const r2 = x => Math.round(x * 100) / 100;
// Ein abgeschlossener Trade im Journal (Format wie ältere Trades): Kurse aus den Kerzen beim Eintritt bzw. Austritt
async function tradeAt(id, openedAt, closedAt, source = 'futures', o = {}) {
  const host = source === 'futures' ? 'fapi.binance.com' : 'data-api.binance.vision';
  const k = (await klines(host, { symbol: 'XRPUSDT', interval: '1m', startTime: openedAt, endTime: closedAt, limit: 1000 })).body;
  const entry = Number(k[0][1]) * (o.entryShift || 1), exit = Number(k.at(-1)[1]), fees = o.fees ?? r2((entry + exit) * Q * 0.0005), pnl = r2((exit - entry) * Q - fees);
  return { id, symbol: 'XRPUSDT', side: 'long', mode: o.mode || 'isolated', reasons: o.reasons || [], entry, leverage: LEV, qty: Q, margin: entry * Q / LEV, openedAt, source, liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false },
    exit, fees, pnl, pnlSource: 'calc', closedAt, note: '', fx: FX, fxSrc: 'm1', fxAt: closedAt - 60e3 };
}
async function openPage(browser, seed = {}, viewport = { width: 1500, height: 1000 }) {
  const ctx = await browser.newContext({ viewport, acceptDownloads: true, timezoneId: 'Europe/Berlin' });
  await ctx.addInitScript(items => { if (localStorage.getItem('seeded103')) return; localStorage.setItem('seeded103', '1'); for (const [k, v] of items) localStorage.setItem(k, JSON.stringify(v)); }, Object.entries(seed));
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  page.on('dialog', d => void d.accept());
  await page.goto(`${h.URL_BASE}/weather-widget-v2.html`);
  await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800); await page.evaluate(() => { __g06.wait = [100, 200]; });
  return { ctx, page, errors };
}
const ls = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);
const jsClick = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); if (!e) throw new Error('fehlt: ' + sel); e.click(); }, sel);
const txt = (page, sel) => page.evaluate(sel => document.querySelector(sel)?.textContent ?? null, sel);
const photos = async since => (await h.ctl('/sent')).filter(m => m.svc === 'tg' && m.method === 'sendPhoto' && m.at >= since);
const kreq = async (since, f = () => true) => (await h.ctl('/log')).filter(e => (/klines$/.test(e.path || '') || /\/v5\/market\/kline$/.test(e.path || '')) && e.q?.symbol === 'XRPUSDT' && (e.q.startTime || e.q.start) && e.at >= since && f(e));   // nur Abrufe mit Zeitfenster (Trade-Karte), nicht die Live-Kerzen des Charts
const job = async (page, id) => (await ls(page, 'scalpdesk.tradeimg.v1'))?.jobs?.find(j => j.id === id) || null;
const waitJob = (page, id, test, ms = 25000) => until(async () => { const j = await job(page, id); return j && test(j) ? j : null; }, ms);
const stored = (page, id) => page.evaluate(id => __g06.stored(id), id);
async function preview(page, id) {
  await page.evaluate(() => { document.getElementById('pos-over').open = true; document.getElementById('history').open = true; });
  await page.evaluate(() => { const d = document.getElementById('timg-dialog'); if (d.open) d.close(); }); await page.waitForTimeout(100);
  await jsClick(page, `#history-list [data-trade="${id}"] [data-action="trade-img"]`);
  const lay = await until(() => page.evaluate(() => !document.getElementById('timg-img').hidden && __g06.layout), 30000);
  if (!lay) console.log('    (Vorschau hängt: ' + await page.evaluate(() => document.getElementById('timg-wait').textContent + ' | offen=' + document.getElementById('timg-dialog').open) + ')');
  return lay;
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const keep = [];

// Unabhängige Nachrechnung (ein Einstieg, ein Ausstieg): sicher in der Haltezeit gehandelte Kurse – Ausführungskurse, Schluss der
// Einstiegskerze, Hoch/Tief der Kerzen dazwischen, Eröffnung der Ausstiegskerze
function expected(t, rows) {
  const ms = 60e3, P = [t.entry, t.exit];
  for (const r of rows) {
    const [time, o, hi, lo, c] = r;
    if (time + ms <= t.openedAt || time > t.closedAt) continue;
    const hasIn = t.openedAt >= time && t.openedAt < time + ms, hasOut = t.closedAt >= time && t.closedAt < time + ms;
    if (!hasIn) P.push(o); if (!hasOut) P.push(c); if (!hasIn && !hasOut) P.push(hi, lo);
  }
  const fr = t.fees / ((t.entry + t.exit) * t.qty), net = p => (p - t.entry) * t.qty - fr * (t.entry * t.qty + p * t.qty), gross = p => (p - t.entry) * t.qty;
  const best = Math.max(...P.map(net)), worst = Math.min(...P.map(net));
  return { gain: Math.max(...P.map(gross)) <= 0 ? 0 : best, loss: Math.min(...P.map(gross)) >= 0 ? 0 : worst, neverMinus: Math.min(...P.map(gross)) >= 0, posHi: t.qty * Math.max(...P), posLo: t.qty * Math.min(...P), hi: Math.max(...P), lo: Math.min(...P) };
}

const tests = {
  async xrp(browser) {
    await h.ctl('/walk?on=0');
    // der gemeldete Fehler: Binance lehnt Kommazahlen in startTime/endTime mit −1100 ab (bisher endTime = Austritt + 12 % der Haltedauer)
    const old = await klines('fapi.binance.com', { symbol: 'XRPUSDT', interval: '1m', startTime: OPEN - 900e3, endTime: CLOSE + (CLOSE - OPEN) * 0.12 + 0.4, limit: 200 });
    check('Nachgestellt: Kommazahl in endTime → Binance-Fehler −1100 (Ursache von „Chartdaten nicht verfügbar“)', old.status === 400 && old.body.code === -1100, JSON.stringify(old.body));
    const T = await tradeAt('X1', OPEN, CLOSE, 'futures', { mode: 'cross', fees: 0, reasons: ['Trend ↑', 'RSI', 'MACD (15m)'] });   // Gebühren 0 wie in der Vorlage
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.channels.v1': chanCfg(), 'scalpdesk.history.v1': [T] });
    let t0 = Date.now(); const lay = await preview(page, 'X1');
    const reqs = await kreq(t0), q = reqs[0]?.q || {};
    check('Kerzen-Anfrage: XRPUSDT ohne Schrägstrich, Futures, 1m, ganzzahlig 19:25 bis 21:37 (10 Min. Rand), ein Abruf', reqs.length === 1 && reqs[0].host === 'fapi.binance.com' && q.symbol === 'XRPUSDT' && q.interval === '1m' && q.startTime === String(OPEN - 600e3) && q.endTime === String(CLOSE + 600e3) && /^\d+$/.test(q.limit), JSON.stringify(reqs.map(r => ({ host: r.host, q: r.q }))));
    const rec = await stored(page, 'X1');
    check('Kerzen im Journal-Speicher (IndexedDB je Trade): kompakt [Zeit, O, H, L, C], 1m, höchstens 300, vollständig, Quelle Binance Futures', rec && rec.iv === '1m' && rec.c.length === 133 && rec.c.length <= 300 && rec.c.every(r => r.length === 5 && r.every(Number.isFinite)) && rec.full === true && rec.src === 'binance-futures' && rec.label === 'Binance Futures' && rec.c[0][0] === OPEN - 600e3, JSON.stringify(rec && { iv: rec.iv, n: rec.c.length, full: rec.full, src: rec.src, first: rec.c[0] }));
    check('… nicht im localStorage und nicht im Journal-Eintrag (keine Speichergrenze, Sicherung bleibt klein)', await page.evaluate(() => { for (let i = 0; i < localStorage.length; i++) if (/1712|\[\[17/.test(localStorage.getItem(localStorage.key(i)) || '') && /tradecandles/.test(localStorage.key(i))) return false; return !JSON.stringify(JSON.parse(localStorage.getItem('scalpdesk.history.v1'))).includes('"c":[['); }));
    check('Karte mit Kerzen gezeichnet (keine Ersatzlinie)', lay.mode === 'candles', JSON.stringify(lay.mode));
    // Kennzahlen unabhängig nachgerechnet
    const S = await page.evaluate(() => __g06.stats('X1')), E = expected(T, rec.c), eur = v => Math.round(v / FX * 100) / 100;
    check('Max. Gewinn = höchster unrealisierter Gewinn nach Gebühren (USD, €, % vom Einsatz)', Math.abs(S.gain.usd - E.gain) < 1e-6 && Math.abs(S.gain.eur - eur(E.gain)) < 0.011 && Math.abs(S.gain.pct - E.gain / T.margin * 100) < 1e-6, JSON.stringify({ app: S.gain, test: E.gain }));
    check('Max. Verlust = tiefster unrealisierter Stand (bzw. 0 „nie im Minus“)', Math.abs(S.loss.usd - E.loss) < 1e-6 && !!S.loss.never === E.neverMinus && Math.abs(S.loss.eur - eur(E.loss)) < 0.011, JSON.stringify({ app: S.loss, test: E.loss, never: E.neverMinus }));
    check('Höchster und tiefster Positionswert (Menge × Kurs)', Math.abs(S.posHi.usd - E.posHi) < 1e-6 && Math.abs(S.posLo.usd - E.posLo) < 1e-6 && Math.abs(S.posHi.eur - eur(E.posHi)) < 0.011, JSON.stringify({ app: [S.posHi.usd, S.posLo.usd], test: [E.posHi, E.posLo] }));
    check('Hoch/Tief der Haltezeit für die Markierungen', S.hi.px === E.hi && S.lo.px === E.lo, JSON.stringify({ app: [S.hi.px, S.lo.px], test: [E.hi, E.lo] }));
    // Markierungen
    const L = lay.labels, ch = lay.chart, fmtL = /^(E|A|H|T) \d,\d{4} \((Einsatz \d{1,3}(\.\d{3})*,\d\d €|[+−]\d{1,3}(\.\d{3})*,\d\d €)\)$/;
    check('Beschriftungen Einstieg, Ausstieg, Hoch, Tief im Format „1,5420 (+55,12 €)“', ['E', 'A'].every(k => L.some(l => l.kind === k)) && L.every(l => fmtL.test(l.text)) && L.filter(l => l.kind === 'H' || l.kind === 'T').length + lay.marks.filter(m => m.kind === 'H' || m.kind === 'T').length >= 2, JSON.stringify(L.map(l => l.text)));
    const aLab = L.find(l => l.kind === 'A')?.text || '', euroNet = r2(T.pnl / FX);
    check('Ausstieg: Kurs und Netto in € aus dem Journal', aLab.includes(`(${euroNet < 0 ? '−' : '+'}${Math.abs(euroNet).toFixed(2).replace('.', ',')} €)`), `${aLab} / ${euroNet}`);
    const clash = []; L.forEach((a, i) => { L.slice(i + 1).forEach(b => { if (overlap(a, b)) clash.push([a.text, b.text]); }); lay.marks.forEach(m => { if (overlap(a, m)) clash.push([a.text, 'Marke ' + m.kind]); }); });
    check('Beschriftungen überlappen sich nicht (auch nicht mit den Marken) und liegen im Chart', !clash.length && L.every(l => l.x >= ch.X0 - 4 && l.x + l.w <= ch.X1 + 4.5 && l.y >= ch.Y0 - 6 && l.y + l.h <= ch.Y1 + 6), JSON.stringify({ clash, L }));
    check('Beschriftungen gut lesbar (26 px fett auf 1080 px, Feld ≥ 40 px hoch)', L.every(l => l.h >= 40));
    // 3.71.0: Aufbau der Karte (Texte mit Schriftgröße aus dem Zeichnen)
    const sg = v => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(2).replace('.', ',')}`;
    const TX = lay.texts || [], has = (re) => TX.some(t => re.test(t.s)), at = re => TX.find(t => re.test(t.s));
    check('3.71.0: Kopf „Trade #1 abgeschlossen“, Datum, Chips LONG · 20× · Cross · Futures', has(/^Trade #1 abgeschlossen$/) && has(/^24\.09\.2026, 21:27$/) && ['LONG', '20×', 'Cross', 'Futures'].every(c => has(new RegExp('^' + c + '$'))), JSON.stringify(TX.slice(0, 8).map(t => t.s)));
    const big = at(/^[+−][\d.]+,\d\d €$/);
    check('3.71.0: Netto in € groß (≥ 90 px), USD klein darunter, % auf den Einsatz, „Heute … · 1 Trade“', big && big.px >= 90 && big.s === `${sg(euroNet)} €` && has(new RegExp(`^${sg(T.pnl).replace('+', '\\+')} USD · Netto aus dem Journal$`)) && has(/^auf den Einsatz$/) && has(new RegExp(`^Heute ${sg(euroNet).replace('+', '\\+')} € · 1 Trade$`)), JSON.stringify(TX.filter(t => /€|USD|Heute/.test(t.s)).map(t => t.s)));
    check('3.71.0: Ablauf: Einstieg/Ausstieg mit Datum, Haltedauer, Menge mit Einsatz in € und USD, Auslöser', has(/^Einstieg$/) && has(/^Ausstieg$/) && has(/^24\.09\.2026, 19:35$/) && has(/^1 Std\. 52 Min\.$/) && has(/^760 XRP$/) && has(/^Einsatz [\d.,]+ € \([\d.,]+ USD\)$/) && has(/^Trend ↑ · RSI · MACD \(15m\)$/));
    const effT = at(/^\d+ %$/), effLine = at(/ von [\d.,]+ € Max\. Gewinn \(\d\d:\d\d\)$/), expEff = Math.round(euroNet / eur(E.gain) * 100);
    check('3.71.0: Exit-Effizienz = Netto ÷ Max. Gewinn × 100 mit Balken und „X von Y € Max. Gewinn (Uhrzeit)“', E.gain > 0 && effT && Math.abs(parseInt(effT.s) - expEff) <= 1 && effLine && effLine.s.startsWith(`${Math.abs(euroNet).toFixed(2).replace('.', ',')} von ${eur(E.gain).toFixed(2).replace('.', ',')} €`), JSON.stringify({ eff: effT?.s, line: effLine?.s, expEff }));
    check('3.71.0: Max. Verlust („nie im Minus“ bei 0) und Gebühren 0 mit „⚠ nicht erfasst, bitte prüfen“', has(/^Max\. Verlust$/) && (!E.neverMinus || has(/^nie im Minus$/)) && has(/^0,00 USD$/) && has(/^⚠ nicht erfasst, bitte prüfen$/));
    check('3.71.0: ohne „Höchster/Tiefster Positionswert“ und ohne Legende; alle Schriften ≥ 22 px', !has(/Positionswert/) && !has(/^Haltezeit$/) && !has(/Ø Einstieg/) && TX.every(t => t.px >= 22), JSON.stringify(TX.filter(t => t.px < 22).map(t => [t.s, t.px])));
    check('3.71.0: Quelle unter der Chart-Überschrift: Binance Futures (Markt des Trades), Zahlen deutsch', has(/^Kursverlauf · 1m-Kerzen$/) && has(/^Quelle: Binance Futures$/) && !TX.some(t => /\d\.\d{2}(?!\d)/.test(t.s) && /USD|€/.test(t.s)));
    const cover = []; L.forEach(l => (lay.candles || []).forEach(c => { if (overlap(l, c)) cover.push(l.text); }));
    check('3.71.0: Pills E (unter der Linie), H (links vom Hoch), A (unten rechts) verdecken keine Kerzen', !cover.length && (lay.candles || []).length > 100 && ['E', 'H', 'A'].every(k => L.some(l => l.kind === k)) && (() => { const e = L.find(l => l.kind === 'E'), hh = L.find(l => l.kind === 'H'), hm = lay.marks.find(m => m.kind === 'H'), em = lay.marks.find(m => m.kind === 'E'), a = L.find(l => l.kind === 'A'), am = lay.marks.find(m => m.kind === 'A'); return e.y > em.y && hh.x + hh.w <= hm.x + hm.w && a.y > am.y; })(), JSON.stringify({ cover: [...new Set(cover)], L, M: lay.marks }));
    // zweites Öffnen: keine Börse nötig, auch wenn alle Quellen ausfallen
    await page.reload(); await page.waitForTimeout(1500); await page.evaluate(() => { __g06.wait = [100, 200]; });
    await h.ctl('/restfail?on=1'); t0 = Date.now(); const lay2 = await preview(page, 'X1'); await h.ctl('/restfail?on=0');
    check('Erneut geöffnet (nach Neuladen, Börse aus): Kerzen aus dem Speicher, kein Abruf', lay2.mode === 'candles' && !(await kreq(t0)).length, (await kreq(t0)).length);
    // Senden von Hand
    t0 = Date.now(); await page.click('#timg-send'); const j = await waitJob(page, 'X1', x => x.st === 'ok'); const p = (await photos(t0))[0] || {};
    const cap = String(p.caption || '').replace(/\r/g, ''), pct = (T.pnl / T.margin * 100);
    check('Senden von Hand: genau ein Foto 1080×1730 an „Trades“', j && (await photos(t0)).length === 1 && String(p.chat_id) === TRADES && p.w === 1080 && p.h === 1730, JSON.stringify({ j, w: p.w, h: p.h }));
    check('3.71.0: Bildunterschrift eine Zeile für die Push-Vorschau: „XRP/USDT Long 20× · ±x,xx € (±x,x %) · 1:52 Std.“, als Foto', cap === `XRP/USDT Long 20× · ${sg(euroNet)} € (${(pct < 0 ? '−' : '+') + Math.abs(pct).toFixed(1).replace('.', ',')} %) · 1:52 Std.` && cap.length <= 1024 && !p.parse_mode, cap);
    keep.push(['xrp', p.path]);
    // 3.71.0: Einstieg 1,5 % neben der Einstiegskerze → Hinweis auf der Karte und im Protokoll des Auftrags
    await ctx.close();
    const T2 = await tradeAt('X2', OPEN, CLOSE, 'futures', { mode: 'cross', entryShift: 1.015 });
    const o2 = await openPage(browser, { 'scalpdesk.channels.v1': chanCfg(), 'scalpdesk.history.v1': [T2] });
    const lay3 = await preview(o2.page, 'X2'); t0 = Date.now(); await o2.page.click('#timg-send'); const j2 = await waitJob(o2.page, 'X2', x => x.st === 'ok');
    check('3.71.0: Einstieg weicht > 0,5 % von der 1m-Kerze ab → „⚠ Einstieg weicht vom Chart ab“ auf der Karte und im Protokoll', (lay3.texts || []).some(t => /^⚠ Einstieg weicht vom Chart ab/.test(t.s)) && /Einstieg weicht vom Chart ab/.test(j2?.warn || '') && /Einstieg weicht vom Chart ab/.test(await txt(o2.page, '#history-list [data-trade="X2"] .timg-why') || ''), JSON.stringify({ warn: j2?.warn }));
    check('… ohne Abweichung kein Hinweis (X1)', !(lay.texts || []).some(t => /Einstieg weicht/.test(t.s)));
    keep.push(['xrp-abweichung', (await photos(t0))[0]?.path]);
    const logged = o2.errors.filter(e => /^\[console\.warning\] Trade-Bild XRP \(X2\): ⚠ Einstieg weicht vom Chart ab/.test(e));
    check('… und als Warnung im Konsolen-Log (Trade-Kennung und Text)', logged.length >= 1, o2.errors.join(' | '));
    errors.push(...o2.errors.filter(e => !logged.includes(e))); await o2.ctx.close();
    const src = fs.readFileSync(path.join(__dirname, '..', 'weather-widget-v2.html'), 'utf8');
    check('„Chartdaten nicht verfügbar“ gibt es in der Karte nicht mehr', !src.includes('Chartdaten nicht verfügbar'));
    check('keine Fehler (xrp)', !real(errors).length, real(errors).join(' | ')); await h.ctl('/walk?on=1');
  },

  async fallback(browser) {
    await h.ctl('/walk?on=0');
    const D = 864e5, mk = (id, k) => tradeAt(id, OPEN - k * D, CLOSE - k * D);
    const trades = [await mk('F1', 1), await mk('F2', 2), await mk('F3', 3), await mk('F4', 4), await mk('F5', 5), await mk('F6', 6)];
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.channels.v1': chanCfg(), 'scalpdesk.history.v1': trades });
    // zwei Wiederholungen, dann Erfolg am selben Markt
    await h.ctl('/klinefail?hosts=fapi.binance.com&n=2'); let t0 = Date.now(); await preview(page, 'F1');
    let rec = await stored(page, 'F1'), r = await kreq(t0);
    check('Futures fällt zweimal aus: zwei Wiederholungen, dann Binance Futures', rec?.src === 'binance-futures' && r.length === 3 && r.every(x => x.host === 'fapi.binance.com'), JSON.stringify(r.map(x => x.host)));
    // Futures dauerhaft aus → data-api.binance.vision
    await h.ctl('/klinefail?hosts=fapi.binance.com'); t0 = Date.now(); let lay = await preview(page, 'F2');
    rec = await stored(page, 'F2'); r = await kreq(t0);
    check('Futures aus: nach 3 Versuchen Ersatzquelle data-api.binance.vision, Quelle im Chart genannt', rec?.src === 'binance-vision' && /data-api\.binance\.vision/.test(rec.label) && r.filter(x => x.host === 'fapi.binance.com').length === 3 && r.at(-1).host === 'data-api.binance.vision' && lay.mode === 'candles', JSON.stringify({ src: rec?.src, hosts: r.map(x => x.host) }));
    // Parameterfehler (−1100) wird nicht wiederholt
    await h.ctl('/klinefail?hosts=fapi.binance.com&code=400'); t0 = Date.now(); await preview(page, 'F3');
    r = await kreq(t0);
    check('Fehler −1100: keine sinnlose Wiederholung, gleich zur Ersatzquelle', r.filter(x => x.host === 'fapi.binance.com').length === 1 && (await stored(page, 'F3'))?.src === 'binance-vision', JSON.stringify(r.map(x => x.host)));
    // Binance ganz aus → Bybit
    await h.ctl('/klinefail?hosts=all'); t0 = Date.now(); lay = await preview(page, 'F4');
    rec = await stored(page, 'F4'); r = await kreq(t0); const by = r.find(x => x.host === 'api.bybit.com');
    check('Binance ganz aus: Bybit (linear, ganzzahlige Zeiten), Kerzen gespeichert', rec?.src === 'bybit' && by && by.q.category === 'linear' && by.q.interval === '1' && /^\d+$/.test(by.q.start) && /^\d+$/.test(by.q.end) && rec.c.length === 133 && lay.mode === 'candles', JSON.stringify({ src: rec?.src, by: by?.q }));
    // alles aus → Ersatzlinie, nichts gespeichert
    await h.ctl('/bybit?mode=fail'); t0 = Date.now(); lay = await preview(page, 'F5');
    check('Alle Quellen aus: Karte mit Ersatzlinie Einstieg → Ausstieg und Marken, nichts gespeichert', lay.mode === 'line' && lay.labels.some(l => l.kind === 'E') && lay.labels.some(l => l.kind === 'A') && !(await stored(page, 'F5')), JSON.stringify(lay));
    const st = await txt(page, '#timg-wait'); check('… Vorschau zeigt trotzdem ein Bild', await page.evaluate(() => !document.getElementById('timg-img').hidden), st);
    await h.ctl('/klinefail'); await h.ctl('/bybit?mode=ok'); t0 = Date.now(); lay = await preview(page, 'F5');
    check('Wieder erreichbar: alter Trade ohne Kerzen wird beim Öffnen einmal nachgeladen und gespeichert', lay.mode === 'candles' && (await stored(page, 'F5'))?.src === 'binance-futures' && (await kreq(t0)).length === 1, JSON.stringify({ mode: lay.mode, src: (await stored(page, 'F5'))?.src, req: (await kreq(t0)).map(x => x.host + ' ' + x.path) }));
    t0 = Date.now(); await preview(page, 'F5'); check('… danach ohne Abruf', !(await kreq(t0)).length, JSON.stringify((await kreq(t0)).map(x => [x.host, x.at - t0, x.q?.startTime])));
    check('keine Fehler (fallback)', !real(errors).filter(e => !/503|400/.test(e)).length, real(errors).join(' | ')); await ctx.close(); await h.ctl('/walk?on=1');
  },

  async auto(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=XRPUSDT&price=1.47');
    const now = Date.now(), pos = (id, entry) => ({ id, symbol: 'XRPUSDT', side: 'long', mode: 'isolated', entry, leverage: LEV, qty: Q, margin: entry * Q / LEV, openedAt: now - 100 * 60e3, source: 'futures', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false } });
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.channels.v1': chanCfg(), 'scalpdesk.positions.v1': [pos('A1', 1.46), pos('A2', 1.465)] });
    const C = id => `.pos-card[data-id="${id}"]`, setIn = (id, key, v) => page.evaluate(([sel, key, v]) => { const i = document.querySelector(`${sel} [data-input="${key}"]`); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, [C(id), key, v]);
    const close = async (id, exit) => { await jsClick(page, `${C(id)} [data-action="realize"]`); await page.waitForTimeout(120); await setIn(id, 'qty', String(Q)); await setIn(id, 'exit', exit); await jsClick(page, `${C(id)} [data-action="save-realize"]`); await page.waitForTimeout(300); };
    let t0 = Date.now(); await close('A1', '1,475');
    const j = await waitJob(page, 'A1', x => x.st === 'ok'); await page.waitForTimeout(1000);
    const rec = await stored(page, 'A1'), r = await kreq(t0), p = (await photos(t0))[0] || {};
    check('Abschluss: Kerzen einmal geladen und zum Trade gespeichert (1m, Rand nach dem Austritt folgt später)', rec && rec.iv === '1m' && rec.src === 'binance-futures' && rec.full === false && r.length === 1 && Number(r[0].q.startTime) % 60e3 === 0, JSON.stringify({ rec: rec && { iv: rec.iv, n: rec.c.length, full: rec.full }, n: r.length }));
    check('… genau ein Bild automatisch, mit Kerzen (keine Ersatzlinie)', j?.by === 'auto' && (await photos(t0)).length === 1 && /^1m · \d+ Kerzen · Binance Futures · gespeichert$/.test(j.chart), JSON.stringify(j));
    check('… Bildunterschrift „XRP/USDT Long 20× · ±x,xx € (±x,x %) · h:mm Std.“', /^XRP\/USDT Long 20× · [+−][\d.]+,\d\d € \([+−][\d.]+,\d %\) · (\d+:\d\d Std\.|\d+ Min\.)$/.test(String(p.caption || '')), p.caption);
    await page.reload(); await page.waitForTimeout(4000);
    check('Neu laden: kein zweites Bild (Trade-ID „gesendet“ gemerkt)', (await photos(t0)).length === 1 && (await job(page, 'A1'))?.st === 'ok');
    // Telegram lehnt ab → Grund im Klartext in der Historie und als Hinweis
    await h.ctl('/chan?photofail=400'); t0 = Date.now(); await close('A2', '1,47');
    const jf = await waitJob(page, 'A2', x => x.st === 'fail'); await h.ctl('/chan?photofail=0');
    await page.evaluate(() => { document.getElementById('pos-over').open = true; document.getElementById('history').open = true; }); await page.waitForTimeout(300);
    const why = await txt(page, '#history-list [data-trade="A2"] .timg-why'), toast = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent).join(' | '));
    check('Telegram-Fehler im Klartext mit Chat-Name: unter dem Trade und als Hinweis', jf && /^Telegram: Chat „Trades“ \(-100777\): Telegram lehnt ab: /.test(why || '') && /Trade-Bild XRP nicht an Telegram gesendet: Chat „Trades“ \(-100777\): Telegram lehnt ab/.test(toast) && await page.evaluate(() => { const e = document.querySelector('#history-list [data-trade="A2"] .timg-why'); return !!e && e.getBoundingClientRect().height > 0; }), JSON.stringify({ why, toast, jf }));
    const logA2 = errors.filter(e => /^\[console\.warning\] Trade-Bild XRP \(A2\): Chat „Trades“ \(-100777\): Telegram lehnt ab: /.test(e));
    check('3.71.0: Sendefehler auch im Konsolen-Log, mit Chat-Name und Fehlertext, ohne Token', logA2.length === 1 && !errors.some(e => /bot\d+:|api\.telegram\.org\/bot/.test(e)), errors.join(' | '));
    await preview(page, 'A2'); const sb = await txt(page, '#timg-send');
    check('„Erneut senden …“ bleibt möglich', sb === 'Erneut senden …', sb);
    check('keine Fehler (auto)', !real(errors).filter(e => !/400/.test(e) && !logA2.includes(e)).length, real(errors).join(' | ')); await ctx.close(); await h.ctl('/walk?on=1');
  },
};

(async () => {
  const only = process.argv[2];
  await h.setup(); await h.ctl('/reset'); const browser = await h.launch();
  try { for (const [name, fn] of Object.entries(tests)) { if (only && only !== name) continue; console.log(`\n▶ ${name}`); await h.ctl('/reset'); try { await fn(browser); } catch (e) { check(`${name}: Abbruch`, false, e.stack || e.message); } } }
  finally { await browser.close(); await h.teardown(); }
  for (const [n, p] of keep) if (p) console.log(`BILD ${n}: ${p}`);
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
