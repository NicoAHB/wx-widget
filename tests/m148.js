// 3.90.0 – AMD (Accumulation, Manipulation, Distribution) in der App: feste Zeile mit Telegram-Schalter und Chart-Haken, Hintergrundprüfung aller
// Vorauswahl-Coins, Telegram-Bild nur bei Bestätigung und nur einmal, Chart nur für den geöffneten Coin (blau/rot/grün, ungültig grau),
// Zeitrahmen-Wahl, Relative-Stärke-Liste in der Reihenfolge der Stärke. Aufruf: node m148.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 600) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR/.test(e));
const Q = 900000, M = 60000, AT = Date.UTC(2026, 9, 20, 10, 45), TJ = AT - Q, NOW = AT + 5000;

// 70 ruhige 15m-Kerzen (Höhe 2 → ATR 2, Range 99–101); die letzten Kerzen formen je nach Coin den Ablauf
function candles15(kind, N = 70) {
  const rows = []; for (let i = 0; i < N; i++) { const o = 99.6 + (i * 7 % 9) * .1, c = 99.6 + (i * 5 % 9) * .1; rows.push([AT - (N - i) * Q, o, 101, 99, c]); }   // Dochte 99–101 (ATR 2), Körper wechseln
  const set = (back, o, hi, lo, c) => { rows[N - 1 - back] = [AT - (back + 1) * Q, o, hi, lo, c]; };
  if (kind === 'long') set(0, 99.55, 99.8, 98.7, 99.2);
  if (kind === 'quiet') set(0, 100, 100.6, 99.4, 100.2);
  if (kind === 'invalid') { set(2, 98.8, 98.9, 98.4, 98.5); set(1, 98.5, 98.6, 98.1, 98.2); set(0, 98.2, 98.3, 97.8, 97.9); }
  return rows;
}
const PATH = [[99.55, 99.6, 99.45, 99.5], [99.5, 99.65, 99.4, 99.6], [99.6, 99.7, 99.4, 99.45], [99.45, 99.55, 99.2, 99.25], [99.25, 99.5, 99.0, 99.05], [99.05, 99.15, 98.8, 98.85], [98.85, 99.0, 98.7, 98.75],
  [98.75, 98.95, 98.72, 98.9], [98.9, 99.1, 98.85, 99.05], [99.05, 99.25, 99.0, 99.2], [99.2, 99.4, 99.15, 99.35], [99.35, 99.6, 99.3, 99.55], [99.55, 99.75, 99.5, 99.72], [99.72, 99.8, 99.6, 99.65], [99.65, 99.7, 99.1, 99.2]];
function minutes1(until) {
  const rows = []; for (let i = 0; i < 60; i++) rows.push([TJ - (60 - i) * M, 100, 100.2, 99.8, 100]);
  PATH.forEach((x, i) => rows.push([TJ + i * M, ...x]));
  for (let t = AT; t <= until; t += M) rows.push([t, 99.2, 99.3, 99.1, 99.2]);
  return rows;
}
const wire = (r, ms) => [r[0], String(r[1]), String(r[2]), String(r[3]), String(r[4]), '100', r[0] + ms - 1, '10000', 5, '50', '5000', '0'];

(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch({ workspace: 'fresh' });
  const wall = Date.now(), clockNow = () => NOW + Date.now() - wall, photos = [], errors = [];
  const tg = { token: '111111111:' + 'A'.repeat(35), chat: '111000001', btoken: '222222222:' + 'B'.repeat(35), bchat: '222000002', ttoken: '333333333:' + 'C'.repeat(35), tchat: '333000003', ptoken: '444444444:' + 'D'.repeat(35), pchat: '444000004', atoken: '555555555:' + 'E'.repeat(35), achat: '555000005' };
  const fixtures = { BTCUSDT: candles15('long'), ETCUSDT: candles15('quiet'), LTCUSDT: candles15('invalid') };
  const longer = { BTCUSDT: candles15('long', 4400), ETCUSDT: candles15('quiet', 4400), LTCUSDT: candles15('invalid', 4400) };   // für Anfragen mit Zeitfenster (Rückblick)
  try {
    const ctx = await browser.newContext({ viewport: { width: +process.env.WX_W || 390, height: +process.env.WX_H || 844 }, hasTouch: true, isMobile: true, timezoneId: 'Europe/Berlin' }), p = await ctx.newPage();
    p.on('pageerror', e => { errors.push(e.message); console.log('APP ERROR', e.message); });
    await ctx.addInitScript(({ names, tg }) => {
      if (!localStorage.getItem('amd-seeded')) { localStorage.setItem('amd-seeded', '1'); localStorage.setItem('scalpdesk.fsrotate.v1', '"native"'); localStorage.setItem('scalpdesk.watchlist.v1', JSON.stringify(names)); localStorage.setItem('scalpdesk.channels.v1', JSON.stringify({ tg, mig33: true })); localStorage.setItem('scalpdesk.idb.trend-pullback.data.v1', JSON.stringify({ version: 1, records: {}, bootstrap: { status: 'paused' } })); }
      const Native = window.Worker; window.Worker = new Proxy(Native, { construct(Target, args) { if (String(args[0]).startsWith('blob:')) throw Error('Isolierte Live-Daten'); return Reflect.construct(Target, args); } });
    }, { names: ['BTC', 'ETC', 'LTC'], tg });
    await p.clock.setSystemTime(NOW);
    await ctx.routeWebSocket('**/*', r => r.onMessage(() => {}));
    await ctx.route('**/api/v3/time*', r => r.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { serverTime: clockNow() } }));
    const requests = [];
    await ctx.route(/\/(?:api|fapi)\/v[13]\/klines\?/, route => {
      const q = new URL(route.request().url()).searchParams, iv = q.get('interval'), symbol = q.get('symbol'), ms = iv === '15m' ? Q : iv === '1m' ? M : 0;
      if (!ms || !fixtures[symbol] || iv === '15m' && false) return route.fallback();
      requests.push(symbol + '|' + iv);
      let rows;
      if (iv === '15m') { rows = (q.has('startTime') ? longer : fixtures)[symbol].map(r => [...r]); const last = rows.at(-1), time = Math.floor(clockNow() / Q) * Q; if (last[0] < time) rows.push([time, last[4], last[4] + .1, last[4] - .1, last[4]]); }
      else if (symbol === 'BTCUSDT') rows = minutes1(Math.floor(clockNow() / M) * M);
      else { rows = []; for (let t = Math.floor(clockNow() / M) * M - 999 * M; t <= Math.floor(clockNow() / M) * M; t += M) rows.push([t, 100, 100.1, 99.9, 100]); }
      if (q.has('startTime')) rows = rows.filter(r => r[0] >= +q.get('startTime')); if (q.has('endTime')) rows = rows.filter(r => r[0] <= +q.get('endTime'));
      rows = q.has('startTime') ? rows.slice(0, +q.get('limit') || 500) : rows.slice(-(+q.get('limit') || 500));
      return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: rows.map(r => wire(r, ms)) });
    });
    await ctx.route('https://api.telegram.org/**', route => {
      if (route.request().url().endsWith('/sendPhoto')) { const body = route.request().postDataBuffer().toString('latin1'), field = n => new RegExp('name="' + n + '"\\r\\n\\r\\n([^\\r]*)').exec(body)?.[1]; photos.push({ chat: field('chat_id'), caption: Buffer.from(field('caption') || '', 'latin1').toString('utf8') }); }
      return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { ok: true, result: route.request().url().endsWith('/getMe') ? { id: 555555555, is_bot: true, first_name: 'Analyse-Signale_111' } : { message_id: photos.length || 1 } } });
    });
    await p.goto(h.URL_BASE + '/weather-widget-v2.html');
    try { await p.waitForFunction(() => window.__analysis && ['BTCUSDT', 'ETCUSDT', 'LTCUSDT'].every(s => __analysis.feed.result(s, 'spot', 'amd').ready), null, { timeout: 90000 }); }
    catch (error) { console.log('DEBUG', JSON.stringify(await p.evaluate(() => ({ loaded: !!window.__analysis, results: ['BTCUSDT', 'ETCUSDT', 'LTCUSDT'].map(s => __analysis.feed.result(s, 'spot', 'amd')).map(r => [r.ready, r.phase, r.reason]) })).catch(e => String(e)))); }
    await p.click('[data-workspace-target=chart]'); if (!await p.locator('#analysis-panel').evaluate(n => n.open)) await p.locator('#analysis-panel>summary').click();
    const row = p.locator('[data-analysis="amd"]');

    // ---------- 1. Zeile ----------
    check('AMD hat eine feste Zeile mit Telegram-Schalter (Aus) und Chart-Haken (aus) wie Top-Down und NY Open', await row.count() === 1 && await row.locator('.analysis-focus').textContent() === 'AMD'
      && !await row.locator('>.analysis-switch input').isChecked() && await row.locator('>.analysis-switch span').textContent() === 'Aus' && !await row.locator('.analysis-check input').isChecked() && await p.locator('.analysis-table>[data-analysis]').count() === 7);
    check('Reihenfolge der Zeilen: Top-Down, NY Open, AMD, Rücksetzer, Range, Ausbruch, Relative Stärke', await p.evaluate(() => [...document.querySelectorAll('.analysis-table>[data-analysis]')].map(n => n.dataset.analysis).join()) === 'top-down,ny-open,amd,trend-pullback,range-return,breakout-retest,relative-strength');

    // ---------- 2. Hintergrundprüfung aller Coins ----------
    const phases = await p.evaluate(() => Object.fromEntries(['BTCUSDT', 'ETCUSDT', 'LTCUSDT'].map(s => { const r = __analysis.feed.result(s, 'spot', 'amd'); return [s, [r.phase, r.stage, !!r.signal]]; })));
    check('Alle drei Vorauswahl-Coins werden im Hintergrund geprüft: BTC bestätigt, ETC Accumulation, LTC ungültig', JSON.stringify(phases) === JSON.stringify({ BTCUSDT: ['signal', 3, true], ETCUSDT: ['accumulation', 1, false], LTCUSDT: ['invalid', 1, false] }), JSON.stringify(phases));
    const amdRequests = await p.evaluate(() => __analysis.feed.runtime('amd').state.requests);
    check('Sparsam: ein Abruf je Coin und Zeitrahmen plus 1m-Kerzen nur für den Durchbruch (höchstens 12 Abrufe für 3 Coins)', requests.includes('BTCUSDT|1m') && amdRequests >= 4 && amdRequests <= 12, amdRequests);
    check('Telegram aus: trotz bestätigtem Setup wird nichts gesendet', photos.length === 0);

    // ---------- 3. Statuskarte ----------
    const status = await row.locator('.analysis-status').textContent();
    check('Statuskarte (Chart-Coin BTC): „Long bestätigt“, 3/3 Stufen, Einstieg/Stop/Ziel/CRV', /Long bestätigt/.test(status) && /3\/3 Stufen/.test(status) && /Einstieg/.test(status) && /Stop/.test(status) && /Ziel · Gegenseite/.test(status) && /CRV1:2,57/.test(status), status);
    check('Drei Stufen: Accumulation, Manipulation, Distribution', await row.locator('.analysis-progress li').allTextContents().then(t => t.map(x => x.replace(/^[✓\d]/, '')).join('|') === 'Accumulation|Manipulation|Distribution'));

    // ---------- 4. Telegram ----------
    await row.locator('.analysis-focus').tap(); await row.locator('>.analysis-switch input').check();
    try { await p.waitForFunction(() => true, null, { timeout: 100 }); await new Promise(r => setTimeout(r, 100)); for (let i = 0; i < 60 && !photos.length; i++) await new Promise(r => setTimeout(r, 500)); } catch { /* weiter */ }
    check('Telegram an: genau ein Bild in den Analyse-Chat, mit Coin, Richtung und Einstieg', photos.length === 1 && photos[0].chat === '555000005' && /^BTC\/USDT · Long · Einstieg /.test(photos[0].caption), JSON.stringify(photos));
    await new Promise(r => setTimeout(r, 4000)); await p.evaluate(() => __analysis.feed.dispatch());
    check('Kein zweites Bild für dasselbe Setup (Doppelschutz)', photos.length === 1, photos.length);
    await p.evaluate(() => __g05.persist()); await p.reload(); await p.waitForFunction(() => window.__analysis && __analysis.feed.result('BTCUSDT', 'spot', 'amd').ready, null, { timeout: 60000 }); await new Promise(r => setTimeout(r, 4000));
    check('Auch nach einem Neustart der App kein zweites Bild', photos.length === 1, photos.length);

    // ---------- 5. Chart ----------
    if (!await p.locator('#analysis-panel').evaluate(n => n.open)) await p.locator('#analysis-panel>summary').click();
    await p.locator('[data-analysis="amd"] .analysis-check input').check();
    try { await p.waitForFunction(() => __g05.state.interval === '15m' && document.querySelectorAll('.amd-box').length >= 3, null, { timeout: 30000 }); } catch { console.log('CHART DEBUG', JSON.stringify(await p.evaluate(() => ({ symbol: __g05.state.symbol, interval: __g05.state.interval, boxes: document.querySelectorAll('.amd-box').length, focus: document.documentElement.dataset.analysisFocus })))); }
    const chart = await p.evaluate(() => ({
      boxes: [...document.querySelectorAll('.amd-box')].map(n => [n.dataset.amdBox, n.getAttribute('fill'), n.closest('.amd-episode')?.dataset.amdStatus]), focus: document.documentElement.dataset.analysisFocus, overlays: Object.values(__g05.state.overlays).every(x => !x), interval: __g05.state.interval, symbol: __g05.state.symbol,
      labels: [...document.querySelectorAll('.amd-label')].map(n => n.textContent), lineLabels: [...document.querySelectorAll('.amd-line-label')].map(n => n.textContent), lines: [...document.querySelectorAll('.amd-line')].map(n => n.dataset.amdLine), status: document.querySelector('[data-amd-chart-status]')?.textContent
    }));
    check('Chart-Haken: Chart öffnet auf 15m, alle anderen Ebenen aus, Fokus AMD', chart.interval === '15m' && chart.focus === 'amd' && chart.overlays && chart.symbol === 'BTCUSDT', JSON.stringify(chart));
    check('BTC: drei Kästen – Accumulation blau, Manipulation rot, Distribution grün – mit Beschriftung', chart.boxes.map(b => b[0]).sort().join() === 'accumulation,distribution,manipulation' && chart.boxes.find(b => b[0] === 'accumulation')[1] === '#4aa8ff' && chart.boxes.find(b => b[0] === 'manipulation')[1].toLowerCase() !== '#8a93a3' && chart.boxes.find(b => b[0] === 'distribution')[1].toLowerCase() !== '#8a93a3'
      && ['Accumulation', 'Manipulation', 'Distribution'].every(t => chart.labels.includes(t)) && chart.lineLabels.some(t => /^CRV 1:2,57 · Einstieg 99,2000/.test(t)) && chart.lineLabels.some(t => /^Ziel 101,00/.test(t)) && chart.lineLabels.some(t => /^Stop 98,5000/.test(t)), JSON.stringify([chart.boxes, chart.labels, chart.lineLabels]));
    check('Range-Hoch und Range-Tief laufen nach rechts weiter; Statuszeile nennt Zeitrahmen und Ergebnis', ['range-high', 'range-low'].every(k => chart.lines.includes(k)) && /AMD · 15m · Long bestätigt/.test(chart.status || ''), chart.status);
    const colors = await p.evaluate(() => { const css = getComputedStyle(document.documentElement); return { up: css.getPropertyValue('--c-up').trim(), down: css.getPropertyValue('--c-down').trim(), dist: document.querySelector('[data-amd-box=distribution]').getAttribute('fill'), man: document.querySelector('[data-amd-box=manipulation]').getAttribute('fill') }; });
    check('Farben: Distribution (Long) in der Kerzenfarbe „steigend“, Manipulation in „fallend“ (rot)', colors.dist === colors.up && colors.man === colors.down, JSON.stringify(colors));
    const shot = name => require('path').join(__dirname, 'out', 'amd-' + name + '-' + (process.env.WX_BROWSER || 'chromium') + '.png');
    await row.screenshot({ path: shot('row') }); await p.locator('#chart').scrollIntoViewIfNeeded(); await p.locator('#chart').screenshot({ path: shot('chart') });
    const tap = await p.evaluate(() => { const b = document.querySelector('[data-amd-chart-status]'); const r = b.getBoundingClientRect(); return { w: r.width, h: r.height }; });
    check('Statuszeile ist eine Tippfläche von mindestens 44 px Höhe', tap.h >= 44, JSON.stringify(tap));
    await p.locator('[data-amd-chart-status]').dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true, clientX: 30, clientY: 40 }).catch(() => {});

    // ---------- 6. andere Coins im Chart: nur der geöffnete Coin ----------
    const coinsOpen = async () => { if (await row.locator('.analysis-focus').getAttribute('aria-expanded') !== 'true') await row.locator('.analysis-focus').tap(); };
    await coinsOpen();
    await p.locator('[data-analysis="amd"] [data-analysis-open-coin=ETCUSDT]').click();
    try { await p.waitForFunction(() => __g05.state.loadedSymbol === 'ETCUSDT' && __g05.state.interval === '15m' && /Range läuft/.test(document.querySelector('[data-amd-chart-status]')?.textContent || '') && document.querySelectorAll('.amd-box').length >= 1, null, { timeout: 30000 }); } catch { console.log('ETC DEBUG', JSON.stringify(await p.evaluate(() => ({ s: __g05.state.symbol, l: __g05.state.loadedSymbol, i: __g05.state.interval, n: document.querySelectorAll('.amd-box').length })))); }
    const etc = await p.evaluate(() => [...document.querySelectorAll('.amd-box')].map(n => [n.dataset.amdBox, n.getAttribute('fill')]));
    check('ETC (nur Range): nur der blaue Accumulation-Kasten, keine Manipulation, keine Distribution', JSON.stringify(etc) === JSON.stringify([['accumulation', '#4aa8ff']]), JSON.stringify(etc));
    await coinsOpen(); await p.locator('[data-analysis="amd"] [data-analysis-open-coin=LTCUSDT]').click();
    try { await p.waitForFunction(() => __g05.state.loadedSymbol === 'LTCUSDT' && /Ungültig/.test(document.querySelector('[data-amd-chart-status]')?.textContent || '') && document.querySelectorAll('.amd-box').length >= 2, null, { timeout: 30000 }); } catch { console.log('LTC DEBUG'); }
    const ltc = await p.evaluate(() => ({ boxes: [...document.querySelectorAll('.amd-box')].map(n => [n.dataset.amdBox, n.getAttribute('fill')]), status: document.querySelector('[data-amd-chart-status]')?.textContent }));
    check('LTC (echter Ausbruch, ungültig): Kästen grau, keine Distribution, Status „Ungültig“', ltc.boxes.length >= 2 && ltc.boxes.every(b => b[1] === '#8a93a3') && !ltc.boxes.some(b => b[0] === 'distribution') && /Ungültig/.test(ltc.status || ''), JSON.stringify(ltc));
    check('Für LTC wurde keine Nachricht gesendet', photos.length === 1);

    // ---------- 7. Zeitrahmen ----------
    await coinsOpen(); await p.locator('[data-analysis="amd"] [data-analysis-open-coin=BTCUSDT]').click(); await p.waitForFunction(() => __g05.state.loadedSymbol === 'BTCUSDT', null, { timeout: 30000 });
    const tools = row.locator('.amd-tools'); await tools.locator('>summary').click();
    const bar = await tools.locator('[data-amd-interval]').evaluateAll(bs => bs.map(b => [b.dataset.amdInterval, b.getAttribute('aria-pressed'), b.getBoundingClientRect().height]));
    check('Zeitrahmen-Auswahl 5m, 15m, 1h, 2h, 4h, 1d, 1w, 1M (kein 1m); 15m gewählt; Tippflächen ≥ 36 px', bar.map(b => b[0]).join() === '5m,15m,1h,2h,4h,1d,1w,1M' && bar.filter(b => b[1] === 'true').map(b => b[0]).join() === '15m' && bar.every(b => b[2] >= 36), JSON.stringify(bar));
    await tools.locator('[data-amd-interval="1h"]').click();
    try { await p.waitForFunction(() => __g05.state.interval === '1h' && __analysis.view.settings.rows.amd.options.interval === '1h', null, { timeout: 30000 }); } catch { /* geprüft unten */ }
    check('Zeitrahmen 1h: gespeichert, Chart wechselt mit, Ergebnis wird neu geladen', await p.evaluate(() => __g05.state.interval === '1h' && __analysis.view.settings.rows.amd.options.interval === '1h' && document.documentElement.dataset.analysisFocus === 'amd'));
    await tools.locator('[data-amd-interval="15m"]').click(); await p.waitForFunction(() => __g05.state.interval === '15m' && __analysis.feed.result('BTCUSDT', 'spot', 'amd').ready, null, { timeout: 60000 });
    const maxH = tools.locator('[data-amd-option=maxHeightAtr]'); await maxH.fill('9'); await maxH.press('Tab');
    check('Rangehöhe wird auf höchstens 4 × ATR begrenzt und gespeichert', await maxH.inputValue() === '4' && await p.evaluate(() => __analysis.view.settings.rows.amd.options.maxHeightAtr === 4));
    await maxH.fill('1.5'); await maxH.press('Tab');

    // ---------- 8. Rückblick ----------
    await coinsOpen(); if (!await tools.evaluate(n => n.open)) await tools.locator('>summary').click();
    await tools.locator('[data-amd-review]').click();
    try { await p.waitForFunction(() => document.querySelectorAll('[data-amd-level]').length === 4, null, { timeout: 120000 }); } catch { console.log('REVIEW DEBUG', await tools.locator('.amd-review-report').textContent().catch(() => ''), await tools.locator('p[role=status]').textContent()); }
    const review = await p.evaluate(() => ({ levels: [...document.querySelectorAll('[data-amd-level]')].map(n => [n.dataset.amdLevel, n.dataset.current, n.textContent]), note: document.querySelector('.amd-tools p[role=status]').textContent, coins: document.querySelector('.amd-review-coins')?.textContent || '' }));
    check('Rückblick: vier Rangehöhen (1,5 · 2 · 3 · 4 × ATR), eingestellte Stufe markiert, Hinweis „nichts gesendet“', review.levels.map(l => l[0]).join() === '1.5,2,3,4' && review.levels[0][1] === 'true' && /Rückblick fertig: 3\/3 Coins/.test(review.note) && /nichts/i.test(review.note), JSON.stringify(review));
    check('Rückblick zählt die Abläufe der Mock-Daten: 3 Accumulationen, 2 Manipulationen, 1 mit Schluss in der Range, 1 bestätigt und gemeldet', /3 Accumulationen · 2 Manipulationen · 1 mit Schluss in der Range · 1 bestätigt · 1 gemeldet/.test(review.levels[0][2]), review.levels[0][2]);
    check('Rückblick je Coin: BTC bestätigt, ETC nur Range, LTC echter Ausbruch', /BTC: 1 Accumulation · 1 Manipulation · 1 mit Schluss in der Range · 1 bestätigt/.test(review.coins) && /ETC: 1 Accumulation · 0 Manipulationen/.test(review.coins) && /LTC: 1 Accumulation · 1 Manipulation · 0 mit Schluss/.test(review.coins), review.coins);
    check('Rückblick sendet nichts', photos.length === 1, photos.length);
    await tools.locator('[data-amd-adopt="3"]').click();
    check('„Übernehmen“ stellt die Rangehöhe 3 × ATR ein, die Marke wandert mit', await p.evaluate(() => __analysis.view.settings.rows.amd.options.maxHeightAtr === 3 && document.querySelector('[data-amd-level="3"]').dataset.current === 'true' && document.querySelector('[data-amd-level="1.5"]').dataset.current === 'false'));
    await tools.locator('[data-amd-option=maxHeightAtr]').fill('1.5'); await tools.locator('[data-amd-option=maxHeightAtr]').press('Tab');

    // ---------- 9. Layout ----------
    const layout = await p.evaluate(() => { const panel = document.getElementById('analysis-panel'), r = document.querySelector('[data-analysis="amd"]'); return { doc: document.documentElement.scrollWidth <= innerWidth + 1, row: r.scrollWidth <= r.clientWidth + 1, panel: panel.scrollWidth <= panel.clientWidth + 1 }; });
    check('Bei 390 px kein waagerechter Überlauf in der AMD-Zeile', layout.doc && layout.row && layout.panel, JSON.stringify(layout));
    check('Testkarten-Knopf „AMD“ in den Telegram-Einstellungen vorhanden', await p.locator('#analysis-amd-test-card').count() === 1);
    check('Keine JavaScript-Fehler', real(errors).length === 0, real(errors).join(' | '));
  } finally { await browser.close(); await h.teardown?.(); }
  const failed = results.filter(r => !r.ok).length; console.log(`\n${results.length - failed}/${results.length} bestanden`); process.exit(failed ? 1 : 0);
})().catch(e => { console.log('Abbruch —', e.stack || e); process.exit(1); });
