// 3.35.0 (G07) – Analyse-Intervall, Trendkontext, höhere Zonen und Umschalter Kurs / Market Cap (über die Oberfläche).
// ana:    Start 4h, unabhängig vom Chart (1m); nur abgeschlossene Kerzen; Wahl bleibt nach Neuladen und steht in der Sicherung,
//         ungültige Wahl → 4h; Blättern und Chart-Intervall verschieben die Zonen nicht; Trendkontext „übergeordnet“ nur bei höherer Ebene.
// b30:    30-Tage-Blöcke (Epoche 1970, nur vollständig und abgeschlossen), EMA 200 gesperrt mit Grund, POC N/100, Tageskerzen ab
//         Handelsbeginn nur aus dem Markt des Charts (Futures nie mit Spot verlängert).
// hz:     Zonen 4h im 1m-Chart zuschaltbar, ohne Rückwärts-Projektion; gleiche Ebene gesperrt.
// cap:    eine Anfrage, nur market_caps (nie Kurs), USD, Quelle, Preisebenen aus, Kursansicht zurück; Mehrfach-Umschalten = eine Anfrage;
//         schneller Coin-Wechsel; nie CoinLore; Zuordnung über die Binance-Notierung (Köder mit besserem Rang verworfen).
// cache:  24 h für abgeschlossene Tage, 5 min für den laufenden Wert; abgelaufene Werte mit Datum; Grenze 10 MiB (verkleinert) verdrängt älteste.
// limits: 429 mit Retry-After → Sperre übersteht Neuladen, Ausweichen auf CoinPaprika; Monatsbudget; Zugriff verweigert → 24 h keine Versuche.
// Aufruf: node m56.js [ana|b30|hz|cap|cache|limits]
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 600) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR|status of (429|401|500)/.test(e));
const until = async (fn, ms = 20000, step = 200) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
async function openPage(browser, seed = {}, { ctx = null, viewport = { width: 1500, height: 1000 } } = {}) {
  ctx = ctx || await browser.newContext({ viewport, timezoneId: 'Europe/Berlin' });
  if (!ctx.seeded) { ctx.seeded = true; await ctx.addInitScript(items => { if (localStorage.getItem('seeded56')) return; localStorage.setItem('seeded56', '1'); for (const [k, v] of items) localStorage.setItem(k, JSON.stringify(v)); }, Object.entries(seed)); }
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  await page.goto(`${h.URL_BASE}/weather-widget-v2.html`);
  await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  return { ctx, page, errors };
}
const txt = (page, sel) => page.evaluate(sel => document.querySelector(sel)?.textContent ?? null, sel);
const anaReady = page => until(() => page.evaluate(() => !!__g07.ana.calc && !__g07.ana.loading), 20000);
const capLog = async () => (await h.ctl('/cap')).log;
const capReady = page => until(() => page.evaluate(() => !__g07.cap.loading && (!!__g07.cap.data || !!__g07.cap.err)), 25000);
const setSym = async (page, c) => { await page.fill('#symbol', c); await page.press('#symbol', 'Enter'); };
// Ein Knopf „MCap“ schaltet zwischen Kurs- und Cap-Ansicht um
const toCap = async page => { if (await page.getAttribute('[data-metric="cap"]', 'aria-pressed') !== 'true') await page.click('[data-metric="cap"]'); };
const toPrice = async page => { if (await page.getAttribute('[data-metric="cap"]', 'aria-pressed') === 'true') await page.click('[data-metric="cap"]'); };
const B = 30 * 864e5;

const tests = {
  async ana(browser) {
    const { ctx, page, errors } = await openPage(browser);
    await anaReady(page);
    const a = await page.evaluate(() => ({ iv: __g07.ana.iv, chart: document.querySelector('[data-interval].active')?.dataset.interval, ctx: document.getElementById('zones-context').textContent, ic: document.getElementById('indicator-context').textContent, n: __g07.ana.closed.length, last: __g07.ana.closed.at(-1)?.closeTime, now: Date.now(), btn: document.querySelector('.ana-bar [data-ana="4h"]').getAttribute('aria-pressed') }));
    check('Start: Analyse 4h, Chart weiter 1m – beide Bereiche nennen „Analyse 4h · abgeschlossene Kerzen bis … UTC“', a.iv === '4h' && a.chart === '1m' && a.btn === 'true' && /^Analyse 4h · abgeschlossene Kerzen bis \d\d\.\d\d\.\d{4}, \d\d:\d\d UTC$/.test(a.ctx) && a.ic === a.ctx, JSON.stringify(a));
    const k = await page.evaluate(async () => { const r = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=4h&limit=2').then(x => x.json()); return { runOpen: r.at(-1)[0], runClose: r.at(-1)[6] }; });
    check('Nur abgeschlossene 4h-Kerzen: die laufende fehlt, die letzte gezählte endete vor jetzt', a.last < a.now && a.last < k.runOpen && k.runClose >= a.now && a.n >= 200, JSON.stringify({ last: a.last, runOpen: k.runOpen }));
    const nextAt = await page.evaluate(() => __g07.ana.nextAt);
    check('Neu gerechnet wird erst nach dem Schluss der laufenden 4h-Kerze', nextAt > k.runClose && nextAt - k.runClose < 10e3, String(nextAt - k.runClose));
    const w = await page.evaluate(() => { const A = __g07.ana.calc; return { ema: document.getElementById('ema-value').textContent, emaTitle: document.getElementById('ema-title').textContent, ema1d: document.getElementById('ema-chart-label').textContent, rsi: document.getElementById('rsi-value').textContent, poc: document.getElementById('poc-foot').textContent, A: { ema: A.ema200, rsi: A.rsi, poc: A.prof.poc } }; });
    const fmt = v => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    check('Karten aus der Analyse-Reihe: EMA 200 (4h), extra „EMA 200 (1D)“, RSI, POC aus 100/100 Kerzen', w.emaTitle === 'EMA 200 (4h)' && w.ema1d === 'EMA 200 (1D)' && w.ema === `${fmt(w.A.ema)} USDT` && w.rsi === fmt(w.A.rsi) && /^100\/100 abgeschlossene 4h-Kerzen · 40 Stufen/.test(w.poc), JSON.stringify(w));
    // Blättern und Chart-Intervall verschieben nichts
    const z0 = await page.evaluate(() => [document.getElementById('poc-value').textContent, document.getElementById('ema-value').textContent, document.getElementById('bb-value').textContent].join('|'));
    await page.click('#pan-back'); await page.click('#pan-back'); await page.waitForTimeout(400);
    const z1 = await page.evaluate(() => [document.getElementById('poc-value').textContent, document.getElementById('ema-value').textContent, document.getElementById('bb-value').textContent].join('|'));
    await page.click('[data-interval="5m"]'); await page.waitForTimeout(3000);
    const z2 = await page.evaluate(() => [document.getElementById('poc-value').textContent, document.getElementById('ema-value').textContent, document.getElementById('bb-value').textContent].join('|'));
    check('Blättern im Chart und anderes Chart-Intervall verschieben POC, EMA und Bänder nicht', z0 === z1 && z1 === z2 && !z0.includes('—'), [z0, z1, z2].join(' / '));
    // Trendkontext: übergeordnet nur bei höherer Ebene
    const tt = async () => page.evaluate(() => [document.getElementById('trend-title').textContent, document.getElementById('trend-sub').textContent].join(' | '));
    const t5 = await tt(); await page.click('.ana-bar [data-ana="1m"]'); await anaReady(page); await page.click('[data-interval="1m"]'); await page.waitForTimeout(2500); const t1 = await tt();
    await page.click('[data-interval="4h"]'); await page.click('.ana-bar [data-ana="1h"]'); await anaReady(page); await page.waitForTimeout(2500); const t4 = await tt();
    check('„Übergeordneter Trendkontext 4h“ nur über einem kleineren Chart; gleiche bzw. kleinere Ebene ehrlich benannt', /^Übergeordneter Trendkontext 4h \| über dem Chart-Intervall 5m$/.test(t5) && t1 === 'Trendkontext 1m | gleiche Ebene wie der Chart' && t4 === 'Trendkontext 1h | kleinere Ebene als der Chart (4h)', [t5, t1, t4].join(' / '));
    const tr = await page.evaluate(() => { const T = __g07.ana.calc.trend; return { T, shown: document.getElementById('trend-value').textContent, recompute: __g07.anaTrend({ C: T.C, e200: T.e200, e50: [T.E50 - T.S * T.A, 0, 0, T.E50], A: T.A }).st }; });
    check('Trendkontext nach der Formel (Long/Short/neutral) und angezeigt', tr.T.st && ['long', 'short', 'neutral'].includes(tr.T.st) && tr.recompute === tr.T.st && { long: 'Long-Kontext', short: 'Short-Kontext', neutral: 'neutral' }[tr.T.st] === tr.shown, JSON.stringify(tr));
    const f = await page.evaluate(() => [__g07.anaTrend({ C: 110, e200: 100, e50: [99, 100, 101, 102], A: 4 }).st, __g07.anaTrend({ C: 100.5, e200: 100, e50: [99, 100, 101, 102], A: 4 }).st, __g07.anaTrend({ C: 90, e200: 100, e50: [99, 98, 97, 96], A: 4 }).st, __g07.anaTrend({ C: 110, e200: 100, e50: [99, 100, 101, 102], A: 0 }).st, __g07.anaTrend({ C: 110, e200: 100, e50: [101, 101, 101, 101.1], A: 4 }).st]);
    check('Formel: Long, zu nah an der EMA → neutral, Short, ATR 0 → nicht bewertbar, flache EMA 50 → neutral', JSON.stringify(f) === '["long","neutral","short","na","neutral"]', JSON.stringify(f));
    // Wahl bleibt, steht in der Sicherung; ungültig → 4h
    const st = await page.evaluate(() => [JSON.parse(localStorage.getItem('scalpdesk.anaiv.v1')), __g05.backupPayload().prefs['scalpdesk.anaiv.v1']]);
    await page.reload(); await page.waitForTimeout(1500);
    const iv2 = await page.evaluate(() => __g07.ana.iv);
    const P2 = await openPage(browser, { 'scalpdesk.anaiv.v1': '30d' }); const iv3 = await P2.page.evaluate(() => __g07.ana.iv); await P2.ctx.close(); // frisches Profil mit ungültigem Wert
    check('Wahl „1h“ gespeichert, in der Sicherung (Anzeige-Einstellungen), nach Neuladen weiter 1h; ungültiger Wert („30d“) → 4h', st[0] === '1h' && st[1] === '1h' && iv2 === '1h' && iv3 === '4h', JSON.stringify({ st, iv2, iv3 }));
    check('Funding und Open Interest behalten ihre eigene Zeitbasis', /Futures-Daten|%/.test(await txt(page, '#funding-value') + await txt(page, '#funding-note')) && !/Analyse/.test(await txt(page, '#funding-note')));
    check('keine Fehler (ana)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  async b30(browser) {
    // Bausteine: Blöcke ab 01.01.1970, nur vollständig und abgeschlossen
    const { ctx, page, errors } = await openPage(browser);
    const u = await page.evaluate(B => {
      const day = 864e5, k0 = 20000, mk = t => ({ time: t, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10, closeTime: t + day - 1 });
      const days = []; for (let t = (k0 * B) + 5 * day; t < (k0 + 4) * B; t += day) days.push(mk(t)); // erster Block unvollständig (ab Tag 5)
      const now = (k0 + 3) * B + 10 * day, out = __g07.blocks30(days, now);
      const gap = days.filter(d => d.time !== (k0 + 1) * B + 7 * day), out2 = __g07.blocks30(gap, now);
      return { n: out.length, times: out.map(b => b.time / B), aligned: out.every(b => b.time % B === 0 && b.closeTime === b.time + B - 1), vol: out[0]?.volume, n2: out2.length, t2: out2.map(b => b.time / B) };
    }, B);
    check('30-Tage-Blöcke: an 01.01.1970 UTC verankert, erster unvollständiger und laufender Block nicht bestätigt, Summen aus 30 Tagen', u.n === 2 && JSON.stringify(u.times) === '[20001,20002]' && u.aligned && u.vol === 300, JSON.stringify(u));
    check('… fehlt ein Tag in einem Block, wird dieser Block nicht bestätigt', u.n2 === 1 && JSON.stringify(u.t2) === '[20002]', JSON.stringify(u));
    let t0 = Date.now(); await page.click('.ana-bar [data-ana="30d_fixed"]'); await anaReady(page);
    const v = await page.evaluate(() => ({ n: __g07.ana.closed.length, last: __g07.ana.closed.at(-1), ema: document.getElementById('ema-note').textContent, poc: document.getElementById('poc-foot').textContent, trend: document.getElementById('trend-value').textContent, ctx: document.getElementById('zones-context').textContent }));
    const log = (await h.ctl('/log')).filter(e => e.at >= t0 && /klines$/.test(e.path) && e.q.symbol === 'BTCUSDT' && e.q.interval === '1d');
    check('30 T: Tageskerzen ab Handelsbeginn (startTime 0, je 1.000), Blöcke abgeschlossen', log.length >= 1 && log[0].q.startTime === '0' && log[0].q.limit === '1000' && v.n > 20 && v.last.closeTime < Date.now() && (v.last.closeTime + 1) % (30 * 864e5) === 0, JSON.stringify({ log: log.map(e => e.q), n: v.n }));
    check('EMA 200 (30 T) gesperrt mit Grund (6.000 Tage), Periode nicht verkürzt; POC „N/100 … (kürzere Reihe)“; Trend nicht bewertbar', new RegExp(`^Gesperrt: EMA 200 \\(30 T\\) braucht 200 vollständige 30-Tage-Blöcke, also mindestens 6\\.000 Tage Historie dieses Markts – vorhanden sind ${v.n} Blöcke`).test(v.ema) && /Die Periode wird nicht verkürzt\.$/.test(v.ema) && new RegExp(`^${v.n}/100 abgeschlossene 30 T-Kerzen \\(kürzere Reihe\\)`).test(v.poc) && v.trend === 'nicht bewertbar' && /^Analyse 30 T · /.test(v.ctx), JSON.stringify(v));
    // Futures-Coin (BSV nur Futures): Historie nur aus Futures
    t0 = Date.now(); await page.fill('#symbol', 'BSV'); await page.press('#symbol', 'Enter'); await page.waitForTimeout(500);
    await until(() => page.evaluate(() => __g07.ana.key.startsWith('BSVUSDT|') && !!__g07.ana.calc), 20000);
    const lg = (await h.ctl('/log')).filter(e => e.at >= t0 && /klines$/.test(e.path) && e.q.symbol === 'BSVUSDT' && e.q.interval === '1d' && e.q.startTime);
    check('Futures-Coin: Tageskerzen nur aus Futures (keine Spot-Verlängerung)', lg.length >= 1 && lg.every(e => e.path === '/fapi/v1/klines'), JSON.stringify(lg.map(e => e.path)));
    check('keine Fehler (b30)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  async hz(browser) {
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.overlays.v1': { vp: false, ema200: true, bb: false, liq: false, lmap: false, zz: false, div: false, ew: false, ewfc: false, fib: false, whale: false, hilo: false, hz: false } });
    await anaReady(page); await page.click('[data-interval="15m"]'); await page.waitForTimeout(3000);
    const b = await page.evaluate(() => { const x = document.querySelector('[data-overlay="hz"]'); return { t: x.textContent.trim(), dis: x.getAttribute('aria-disabled'), on: x.getAttribute('aria-pressed') }; });
    check('Chart 15m, Analyse 4h: „Zonen 4h“ zuschaltbar, anfangs aus', b.t === 'Zonen 4h' && b.dis === 'false' && b.on === 'false', JSON.stringify(b));
    await page.click('[data-overlay="hz"]'); await page.waitForTimeout(800);
    const d = await page.evaluate(() => ({ on: document.querySelector('[data-overlay="hz"]').getAttribute('aria-pressed'), cap: [...document.querySelectorAll('#chart svg text')].map(t => t.textContent).filter(t => /^Zonen 4h · Stand|EMA 200 · 4h|POC 4h/.test(t)) }));
    check('Eingeschaltet: Linien mit Intervall und Zeitpunkt („Zonen 4h · Stand … UTC“, „EMA 200 · 4h“)', d.on === 'true' && d.cap.some(t => /^Zonen 4h · Stand \d\d\.\d\d\.\d{4}, \d\d:\d\d UTC$/.test(t)) && d.cap.some(t => /EMA 200 · 4h/.test(t)), JSON.stringify(d));
    const nl = await page.evaluate(() => { const s = __g07.hzSeries(window.__g05.state.candles), c = __g07.ana.closed, A = __g07.ana.calc; let bad = 0, n = 0;
      window.__g05.state.candles.forEach((k, i) => { const v = s.e200[i]; if (v === null) return; n++; const j = c.findLastIndex(x => x.closeTime < k.time); if (A.e200s[j] !== v) bad++; });
      const lastIn = window.__g05.state.candles.filter(k => k.time <= A.last.closeTime).length, pocBefore = s.after.slice(0, lastIn).some(Boolean); return { bad, n, pocBefore }; });
    check('Keine Rückwärts-Projektion: je Chart-Kerze der Wert der zuvor abgeschlossenen 4h-Kerze; POC erst ab dem letzten 4h-Schluss', nl.n > 0 && nl.bad === 0 && !nl.pocBefore, JSON.stringify(nl));
    await page.click('.ana-bar [data-ana="15m"]').catch(() => {}); await page.click('.ana-bar [data-ana="1m"]'); await anaReady(page); await page.waitForTimeout(500);
    const l = await page.evaluate(() => { const x = document.querySelector('[data-overlay="hz"]'); return { dis: x.getAttribute('aria-disabled'), why: x.title, drawn: [...document.querySelectorAll('#chart svg text')].some(t => /^Zonen /.test(t.textContent)) }; });
    check('Analyse 1m unter Chart 15m: gesperrt mit Grund („keine höhere Ebene“), nicht gezeichnet, Wunsch bleibt', l.dis === 'true' && /^Zonen 1m sind keine höhere Ebene als der Chart \(15m\)/.test(l.why) && !l.drawn && await page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.overlays.v1')).hz === true), JSON.stringify(l));
    check('keine Fehler (hz)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  async cap(browser) {
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.alarms.v1': [{ id: 'C1', symbol: 'BTCUSDT', source: 'spot', dir: 'above', price: 70000, note: '', createdAt: Date.now(), armedAt: Date.now(), triggeredAt: null, triggerPrice: null }] });
    await page.click('#zoom-in'); await page.click('#pan-back'); await page.waitForTimeout(300);
    const view0 = await page.evaluate(() => [window.__g05.state.count, window.__g05.state.pan]);
    await h.ctl('/cap?clear=1&delay=1200');
    for (let i = 0; i < 5; i++) { await page.click('[data-metric="cap"]'); await page.waitForTimeout(60); }
    await capReady(page); await h.ctl('/cap?delay=0');
    const lg = await capLog();
    check('Mehrfach umgeschaltet (5×): genau eine Anfrage an CoinGecko (stündlich, 90 Tage)', lg.length === 1 && lg[0].prov === 'cg' && lg[0].path === '/api/v3/coins/bitcoin/market_chart' && lg[0].q.days === '90', JSON.stringify(lg.map(x => x.path + JSON.stringify(x.q))));
    const v = await page.evaluate(() => ({ ohlc: document.getElementById('ohlc').textContent, texts: [...document.querySelectorAll('#chart svg text')].map(t => t.textContent), rects: document.querySelectorAll('#chart svg rect').length, data: __g07.cap.data && { prov: __g07.cap.data.prov, res: __g07.cap.data.res, first: __g07.cap.data.pts[0], last: __g07.cap.data.pts.at(-1) } }));
    check('Ansicht: „Market Cap (USD) · CoinGecko · stündlich (Chart 1m) · Datenstand … UTC“, Quelle, Achse in USD', v.texts.some(t => /^Market Cap \(USD\) · CoinGecko · stündlich \(Chart 1m\) · Datenstand \d\d\.\d\d\.\d{4}, \d\d:\d\d UTC$/.test(t)) && v.texts.some(t => /^Daten: CoinGecko/.test(t)) && v.texts.filter(t => / (Bio|Mrd)\. USD$/.test(t)).length >= 4 && /^MCap \d+,\d+ (Bio|Mrd)\. USD · CoinGecko$/.test(v.ohlc), JSON.stringify({ ohlc: v.ohlc, t: v.texts.slice(0, 8) }));
    const j = await page.evaluate(() => fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=90').then(r => r.json()));
    check('Werte aus market_caps (nicht aus prices); nie CoinLore', v.data.first[1] === j.market_caps[0][1] && v.data.first[1] !== j.prices[0][1] && Math.abs(v.data.first[1] / j.prices[0][1] - v.data.last[1] / j.prices.at(-1)[1]) > 1 && !(await capLog()).some(x => x.prov === 'lore'), JSON.stringify({ cap0: v.data.first, price0: j.prices[0] }));
    const o = await page.evaluate(() => ({ dis: [...document.querySelectorAll('[data-overlay]')].every(b => b.getAttribute('aria-disabled') === 'true'), why: document.querySelector('[data-overlay="ema200"]').title, alarm: [...document.querySelectorAll('#chart svg text')].some(t => /🔔|Einstieg|SL |TP /.test(t.textContent)), fib: getComputedStyle(document.getElementById('fib-strip')).display, mag: getComputedStyle(document.getElementById('magnet')).pointerEvents }));
    check('Preisebenen aus (gesperrt mit Erklärung), keine Alarm-/SL-/TP-Linien auf der Cap-Achse, Fib-Leiste und Magnet aus', o.dis && /^In der Market-Cap-Ansicht aus/.test(o.why) && !o.alarm && o.fib === 'none' && o.mag === 'none', JSON.stringify(o));
    await toPrice(page); await page.waitForTimeout(600);
    const back = await page.evaluate(() => ({ view: [window.__g05.state.count, window.__g05.state.pan], rects: document.querySelectorAll('#chart svg rect').length, ohlc: document.getElementById('ohlc').textContent, ov: document.querySelector('[data-overlay="ema200"]').getAttribute('aria-disabled') }));
    check('Zurück zur Kursansicht: Zoom und Ausschnitt wie vorher, Kerzen und Ebenen wieder da', JSON.stringify(back.view) === JSON.stringify(view0) && back.rects > 20 && /^O /.test(back.ohlc) && back.ov === 'false', JSON.stringify({ back, view0 }));
    // schneller Coin-Wechsel in der Cap-Ansicht
    await toCap(page); await capReady(page);
    for (const c of ['ETH', 'XRP', 'SOL']) { await setSym(page, c); await page.waitForTimeout(150); }
    await until(() => page.evaluate(() => __g07.cap.data?.sym === 'SOL' && !__g07.cap.loading), 25000);
    const sol = await page.evaluate(() => ({ sym: __g07.cap.data.sym, id: __g07.cap.data.id, ohlc: document.getElementById('ohlc').textContent }));
    check('Schneller Coin-Wechsel (ETH → XRP → SOL): angezeigt wird SOL, keine ältere Antwort', sol.sym === 'SOL' && sol.id === 'solana' && /^MCap .* (CoinGecko|CoinPaprika)$/.test(sol.ohlc), JSON.stringify(sol));
    // Zuordnung über die Binance-Notierung (KAS steht nicht in der Liste; ein Köder mit besserem Rang wird nicht bei Binance gehandelt)
    await h.ctl('/cap?clear=1'); await page.evaluate(() => localStorage.removeItem('scalpdesk.capbudget.v1'));
    await setSym(page, 'KAS'); await until(() => page.evaluate(() => __g07.cap.data?.sym === 'KAS' && !__g07.cap.loading), 30000);
    const kas = await page.evaluate(() => ({ id: __g07.cap.data?.id, how: __g07.cap.data?.how, prov: __g07.cap.data?.prov, ids: JSON.parse(localStorage.getItem('scalpdesk.capids.v1') || '{}').KAS })), kl = await capLog();
    check('Unbekannter Coin: Suche + Nachweis über die Binance-Notierung KAS/USDT; Köder (besserer Rang, nicht bei Binance) verworfen; Zuordnung gemerkt', kas.id === 'kaspa' && kas.how === 'Binance-Notierung' && kas.ids?.cg?.id === 'kaspa' && kl.some(x => x.path === '/api/v3/coins/kaspa-fork-token/tickers') && kl.some(x => x.path === '/api/v3/coins/kaspa/tickers'), JSON.stringify({ kas, log: kl.map(x => x.path) }));
    check('keine Fehler (cap)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  async bar(browser) {
    // Kompakter Toggle in der Chart-Menüleiste: ein Knopf „MCap“ in der Zeile der Intervalle – die Leiste bekommt keine zusätzliche Zeile
    // (iPad mini hochkant hatte nur 20 px Luft; dort rutschten die Zoom-Knöpfe nach unten und schoben den Chart aus dem Bild)
    for (const [name, w, hh, oneRow] of [['iPad mini hoch', 744, 1133, true], ['iPad quer', 820, 700, true], ['Handy', 390, 844, false], ['Handy schmal', 360, 780, false]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: hh }, hasTouch: true, isMobile: true, timezoneId: 'Europe/Berlin' });
      const { page, errors } = await openPage(browser, {}, { ctx });
      const m = await page.evaluate(() => { const t = s => Math.round(document.querySelector(s).getBoundingClientRect().top), r = document.querySelector('[data-metric="cap"]').getBoundingClientRect(), tb = document.querySelector('.chart-toolbar').getBoundingClientRect();
        return { iv: t('.chart-toolbar .intervals'), mt: Math.round(r.top), zc: t('.chart-toolbar .zoom-controls'), inside: r.right <= tb.right + 0.5, n: document.querySelectorAll('[data-metric]').length, label: document.querySelector('[data-metric="cap"]').textContent }; });
      const ok = m.n === 1 && m.label === 'MCap' && m.inside && Math.abs(m.mt - m.iv) <= 6 && (oneRow ? Math.abs(m.zc - m.iv) <= 6 : m.zc > m.iv + 20);
      check(`${name} (${w} px): „MCap“ in der Zeile der Intervalle, ${oneRow ? 'Zoom-Knöpfe in derselben Zeile' : 'Zoom-Knöpfe in der zweiten Zeile wie bisher'}`, ok, JSON.stringify(m));
      if (name === 'Handy') {
        await page.click('[data-metric="cap"]'); const on = await page.getAttribute('[data-metric="cap"]', 'aria-pressed'); await capReady(page);
        // Cap-Ansicht am Handy: Kopf und Unterzeile umgebrochen statt abgeschnitten, Zeitachse ohne überlappende Beschriftungen
        const fit = await page.evaluate(() => { const svg = document.querySelector('#chart svg'); if (!svg) return null; const W = svg.getBoundingClientRect(), ts = [...svg.querySelectorAll('text')].map(t => ({ s: t.textContent, r: t.getBoundingClientRect() }));
          const out = ts.filter(t => t.r.right > W.right + 1 || t.r.left < W.left - 1).map(t => t.s), ax = ts.filter(t => Math.abs(t.r.bottom - W.bottom) < 22).sort((a, b) => a.r.left - b.r.left);
          return { out, head: ts.filter(t => /Market Cap|Datenstand|Daten:/.test(t.s)).map(t => t.s), axis: ax.map(t => t.s), overlap: ax.some((t, i) => i && t.r.left < ax[i - 1].r.right + 2) }; });
        check('Cap-Ansicht am Handy: kein Text über den Rand, Kopf umgebrochen, Zeitachse ohne Überlappung (UTC)', fit && !fit.out.length && fit.head.length >= 2 && fit.axis.length >= 2 && !fit.overlap, JSON.stringify(fit));
        await page.click('[data-metric="cap"]'); const off = await page.getAttribute('[data-metric="cap"]', 'aria-pressed');
        check('Ein Tippen: Cap-Ansicht (gedrückt), noch einmal: zurück zum Kurs', on === 'true' && off === 'false', `${on} → ${off}`);
      }
      check(`keine Fehler (bar, ${name})`, !real(errors).length, real(errors).join(' | ')); await ctx.close();
    }
  },

  async cache(browser) {
    let { ctx, page, errors } = await openPage(browser);
    await page.click('[data-interval="1d"]'); await page.waitForTimeout(2500);
    await h.ctl('/cap?clear=1'); await toCap(page); await capReady(page);
    const l1 = await capLog();
    check('Täglich (Chart 1d): eine Anfrage (365 Tage, interval=daily)', l1.length === 1 && l1[0].q.days === '365' && l1[0].q.interval === 'daily', JSON.stringify(l1.map(x => x.q)));
    await page.reload(); await page.waitForTimeout(1500); await page.click('[data-interval="1d"]'); await page.waitForTimeout(1500); await h.ctl('/cap?clear=1'); await toCap(page); await capReady(page);
    check('Neu geladen: Tageshistorie und laufender Wert aus dem Cache (IndexedDB) – keine Anfrage', (await capLog()).length === 0 && await page.evaluate(() => __g07.cap.data?.prov === 'cg'));
    // laufender Wert älter als 5 Minuten: nur er wird neu geholt
    await page.evaluate(async () => { const k = __g07.capKey('cg', 'bitcoin', 'now', 'now'), e = await __g07.capGet(k); e.fetchedAt = Date.now() - 6 * 60e3; await __g07.capPut(e); });
    await h.ctl('/cap?clear=1'); await toPrice(page); await toCap(page); await capReady(page);
    const l2 = await capLog();
    check('Laufender Wert nach 5 min: nur simple/price, die abgeschlossene Tageshistorie bleibt (24 h)', l2.length === 1 && l2[0].path === '/api/v3/simple/price' && l2[0].q.include_market_cap === 'true', JSON.stringify(l2.map(x => x.path)));
    // Tageshistorie älter als 24 h: neu geholt
    await page.evaluate(async () => { const k = __g07.capKey('cg', 'bitcoin', '1d', '365d'), e = await __g07.capGet(k); e.fetchedAt = Date.now() - 25 * 3600e3; await __g07.capPut(e); });
    await h.ctl('/cap?clear=1'); await toPrice(page); await toCap(page); await capReady(page);
    check('Tageshistorie nach 24 h: neu geholt', (await capLog()).some(x => x.path === '/api/v3/coins/bitcoin/market_chart'));
    const ent = await page.evaluate(async () => { const e = await __g07.capGet(__g07.capKey('cg', 'bitcoin', '1d', '365d')); const cut = Math.floor(Date.now() / 864e5) * 864e5; return { allDone: e.pts.every(p => p[0] < cut), n: e.pts.length, key: e.key }; });
    check('Cache-Schlüssel aus Anbieter, ID, Währung, Auflösung, Zeitraum und Schema; gespeichert nur abgeschlossene Tage', ent.key === 'cg|bitcoin|usd|1d|365d|v1' && ent.allDone && ent.n >= 360, JSON.stringify(ent));
    // abgelaufen und beide Anbieter gestört: Werte mit Datum weiter zeigen
    await page.evaluate(async () => { for (const r of [['1d', '365d'], ['now', 'now']]) { const k = __g07.capKey('cg', 'bitcoin', ...r), e = await __g07.capGet(k); e.fetchedAt = Date.now() - 26 * 3600e3; await __g07.capPut(e); } localStorage.removeItem('scalpdesk.capbudget.v1'); });
    await h.ctl('/cap?cg=fail&cp=fail'); await toPrice(page); await toCap(page); await capReady(page);
    const st = await page.evaluate(() => [...document.querySelectorAll('#chart svg text')].map(t => t.textContent).find(t => /^Daten:/.test(t)) || '');
    check('Abgelaufen und Anbieter gestört: Kurve bleibt, mit „abgelaufen, Stand … UTC“ und Grund', /abgelaufen, Stand \d\d\.\d\d\.\d{4}, \d\d:\d\d UTC – CoinGecko antwortet mit Fehler 500/.test(st), st);
    await h.ctl('/cap?cg=ok&cp=ok');
    // Grenze (verkleinert): älteste ungenutzte Einträge zuerst verdrängt
    const ev = await page.evaluate(async () => {
      __g07.setCapMax(60000); const pts = Array.from({ length: 700 }, (_, i) => [1.7e12 + i * 36e5, 1e9 + i]), keys = [];
      for (let i = 0; i < 5; i++) { const key = __g07.capKey('cg', 'test' + i, '1h', '90d'); keys.push(key); await __g07.capPut({ key, prov: 'cg', id: 'test' + i, cur: 'usd', res: '1h', range: '90d', schema: 1, pts, fetchedAt: Date.now() }); await new Promise(r => setTimeout(r, 15)); }
      const have = []; for (const k of keys) have.push(!!(await __g07.capGet(k))); __g07.setCapMax(10 * 1024 * 1024); return have;
    });
    check('Cachegrenze: bei Überschreiten verschwinden die ältesten ungenutzten Einträge, der neueste bleibt', ev.at(-1) === true && ev[0] === false && ev.filter(Boolean).length < 5, JSON.stringify(ev));
    check('keine Fehler (cache)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  async limits(browser) {
    let { ctx, page, errors } = await openPage(browser);
    await h.ctl('/cap?clear=1&cg=429&ra=120'); await setSym(page, 'ETH'); await page.waitForTimeout(1500);
    await toCap(page); await capReady(page);
    const a = await page.evaluate(() => ({ prov: __g07.cap.data?.prov, blk: __g07.capBlock('cg'), now: Date.now() })), l = await capLog();
    check('429 mit Retry-After 120 s: CoinGecko gesperrt bis +120 s, Ausweichen auf CoinPaprika (täglich, Vermerk)', a.prov === 'cp' && a.blk && Math.abs(a.blk.until - a.now - 120e3) < 10e3 && l.filter(x => x.prov === 'cg').length === 1, JSON.stringify({ a, l: l.map(x => x.prov + x.path) }));
    const note = await page.evaluate(() => [...document.querySelectorAll('#chart svg text')].map(t => t.textContent).find(t => /^Daten:/.test(t)) || '');
    check('… Hinweis „CoinPaprika liefert schlüssellos nur Tageswerte – Auflösung täglich“', /^Daten: CoinPaprika · CoinPaprika liefert schlüssellos nur Tageswerte – Auflösung täglich/.test(note), note);
    await h.ctl('/cap?clear=1&cg=ok'); await page.reload(); await page.waitForTimeout(1500); await setSym(page, 'XRP'); await page.waitForTimeout(1500);
    await toCap(page); await capReady(page);
    check('Neu laden umgeht die Sperre nicht: keine CoinGecko-Anfrage, CoinPaprika liefert', !(await capLog()).some(x => x.prov === 'cg') && await page.evaluate(() => __g07.cap.data?.prov === 'cp'));
    // Monatsbudget beider Anbieter erreicht
    await page.evaluate(() => { const m = new Date().toISOString().slice(0, 7); localStorage.setItem('scalpdesk.capbudget.v1', JSON.stringify({ cg: { mon: m, n: 3000 }, cp: { mon: m, n: 10000 } })); });
    await h.ctl('/cap?clear=1'); await setSym(page, 'LTC'); await capReady(page); await page.waitForTimeout(500);
    const mb = await page.evaluate(() => ({ err: __g07.cap.err, txt: document.querySelector('#chart .cap-why')?.textContent || '' }));
    check('Monatsbudget erreicht: keine Anfrage, verständlich „nicht verfügbar“ mit Grund und nächstem Versuch', !(await capLog()).length && /CoinGecko: Monatsbudget der App erreicht \(3000 Abrufe\)/.test(mb.txt) && /CoinPaprika: Monatsbudget der App erreicht \(10000 Abrufe\)/.test(mb.txt), JSON.stringify(mb));
    // Zugriff verweigert: 24 h keine Versuche
    await page.evaluate(() => localStorage.removeItem('scalpdesk.capbudget.v1')); await h.ctl('/cap?clear=1&cg=denied');
    await setSym(page, 'BCH'); await capReady(page);
    const d1 = await page.evaluate(() => __g07.capBlock('cg'));
    await h.ctl('/cap?clear=1&cg=ok'); await page.reload(); await page.waitForTimeout(1500); await setSym(page, 'ETC'); await page.waitForTimeout(1500); await toCap(page); await capReady(page);
    check('Zugriff verweigert (401): 24 h keine weiteren CoinGecko-Versuche, auch nach Neuladen', d1 && d1.until - Date.now() > 23 * 3600e3 && /Zugriff ohne Schlüssel verweigert/.test(d1.why) && !(await capLog()).some(x => x.prov === 'cg'), JSON.stringify(d1));
    // Minutenbudget: jeder Versuch zählt, höchstens 5 je Minute
    const mbud = await page.evaluate(() => { const b = JSON.parse(localStorage.getItem('scalpdesk.capbudget.v1') || '{}'); return { cp: (b.cp?.m || []).length, cgN: b.cg?.n }; });
    check('Jeder Versuch zählt ins Budget (auch abgelehnte)', mbud.cgN >= 1 && mbud.cp >= 1, JSON.stringify(mbud));
    check('keine Fehler (limits)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },
};

(async () => {
  const only = process.argv[2];
  await h.setup(); await h.ctl('/reset'); const browser = await h.launch();
  try { for (const [name, fn] of Object.entries(tests)) { if (only && only !== name) continue; console.log(`\n▶ ${name}`); await h.ctl('/reset'); try { await fn(browser); } catch (e) { check(`${name}: Abbruch`, false, e.stack || e.message); } } }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
