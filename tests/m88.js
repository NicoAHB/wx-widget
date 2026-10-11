// Tatsächlicher 2h-Chart, gespeicherte Auswahl, Indikatoren/Live-Streams und Muster-Klick.
const h = require('./harness'), fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
(async () => {
  await h.setup(); const browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.stack || e.message)); await page.goto(h.URL_BASE + '/weather-widget-v2.html');
    await page.waitForFunction(() => window.__intervals && __g05.state.candles.length > 200);
    await page.click('.tb-main [data-interval="2h"]'); await page.waitForFunction(() => __g05.state.interval === '2h' && !__g05.state.busy && __g05.state.candles.length > 200);
    let s = await page.evaluate(() => ({ iv: __g05.state.interval, rows: __g05.state.candles, active: document.querySelector('.tb-main [data-interval="2h"]').getAttribute('aria-pressed'), rating: __intervals.ratingFor('2h') }));
    check('2h ausgewählt, OHLC mit zwei Stunden Abstand', s.iv === '2h' && s.active === 'true' && s.rows.slice(1).every((r, i) => r.time - s.rows[i].time === 7200000));
    check('2h-Signal wird aus denselben Chartkerzen berechnet', !!s.rating.rating);
    await page.reload(); await page.waitForFunction(() => window.__intervals && __g05.state.interval === '2h' && __g05.state.candles.length > 200);
    check('2h wird beim nächsten Öffnen wiederhergestellt', await page.evaluate(() => __g05.state.interval === '2h'));
    await page.evaluate(() => __intervals.setMarket('BTCUSDT', '3h')); await page.waitForFunction(() => __g05.state.interval === '4h' && !__g05.state.busy);
    check('Unbekanntes Intervall: nächstliegendes geöffnet und kurzer Hinweis', (await page.locator('#market-error').innerText()).includes('4h geöffnet'));
    for (const iv of ['1m', '5m', '15m', '1h', '4h', '1d']) { await page.evaluate(iv => __intervals.setMarket('BTCUSDT', iv), iv); await page.waitForFunction(iv => __g05.state.interval === iv && !__g05.state.busy && __g05.state.candles.length > 100, iv); check(`Bisheriges ${iv} lädt unverändert`, await page.evaluate(iv => __g05.state.interval === iv && !__g05.state.marketError, iv)); }
    // Echte Formation statt eines erfundenen Muster-Klicks: öffentliche 2h-Kerzen mit passender pat-1-Geometrie.
    await h.ctl('/silent?on=1'); await h.ctl('/walk?on=0');
    const src = fs.readFileSync(__dirname + '/m58.js', 'utf8'), build = vm.runInNewContext(src.slice(src.indexOf('const BUILD = () => {'), src.indexOf('\nconst tests = {')) + '\nBUILD()');
    const shape = build.path(build.F.double_bottom), ms = 7200000, base = Math.floor(Date.now() / ms) * ms - 500 * ms;
    const candles = [...Array.from({ length: 450 }, () => ({ o: shape[0].o, h: shape[0].o + .1, l: shape[0].o - .1, c: shape[0].o, v: 100 })), ...shape].map((c, i) => ({ ...c, t: base + i * ms }));
    const last = candles.at(-1).c, rows = [...candles.map(c => [c.t, c.o, c.h, c.l, c.c, c.v, c.t + ms - 1]), [base + 500 * ms, last, last + .01, last - .01, last, 1, base + 501 * ms - 1]];
    await ctx.route(/https:\/\/(?:data-api\.binance\.vision|api\.binance\.com)\/.*klines\?/, route => {
      const u = new URL(route.request().url()); if (u.searchParams.get('symbol') !== 'BTCUSDT' || u.searchParams.get('interval') !== '2h') return route.continue();
      const from = +(u.searchParams.get('startTime') || 0); return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(rows.filter(c => c[0] >= from).slice(-Number(u.searchParams.get('limit') || 500))) });
    });
    const hit = await page.evaluate(candles => __g09.engine().detect(candles, { from: 380, step: 7200000 }).hits.find(h => h.id === 'double_bottom' && /Ausbruch/.test(h.status)), candles);
    if (!hit) throw Error('2h-Formationsfixture fehlt');
    // Nur den vorhandenen nativen Vorauswahl-Eintrag ändern, keinen unvollständigen Datensatz anlegen.
    await page.waitForFunction(() => { const e = __g09.wl.c.get('BTCUSDT'); return e && Array.isArray(e.hist) && Array.isArray(e.closed) && !e.loading && e.at > 0; });
    await page.evaluate(hit => { const e = __g09.wl.c.get('BTCUSDT'); e.iv = '2h'; e.pat = hit; __intervals.openPattern('BTC'); }, hit);
    await page.waitForFunction(() => __g05.state.interval === '2h' && !__g05.state.busy && __g09.pat.sel !== null && document.querySelector('#chart .pat-hl')).catch(async e => { console.log('DIAG', JSON.stringify(await page.evaluate(() => ({ iv: __g05.state.interval, count: __g05.state.candles.length, error: __g05.state.marketError, first: __g05.state.candles[0]?.close, sel: __g09.pat.sel, want: __g09.pat.want, meta: __g09.pat.meta && { reason: __g09.pat.meta.reason, n: __g09.pat.meta.n }, hits: __g09.pat.res?.hits.map(h => ({ id: h.id, t0: h.t0, t1: h.t1, q: h.q })) })))); throw e; });
    check('Klick auf echte 2h-Formation lädt Start/Ende und markiert genau das Muster', await page.evaluate(hit => { const h = __g09.pat.res.hits[__g09.pat.sel]; return h.id === hit.id && h.t0 === hit.t0 && h.t1 === hit.t1 && !!document.querySelector('#chart .pat-hl') && document.querySelectorAll('#chart .pat-line').length >= 2; }, hit));
    check('Originale Nacken-/Ausbruchslinie wird eingezeichnet', await page.evaluate(() => __g09.pat.res.hits[__g09.pat.sel].lines.some(l => l[4] === 'neck') && !!document.querySelector('#chart .pat-line[stroke-dasharray="5 3"]')));
    await page.evaluate(() => __g05.state.pan = 0); await page.evaluate(() => __g09.zoom(__g09.pat.sel));
    await page.waitForFunction(() => !!document.querySelector('#chart .pat-projection'));
    check('Aktive Linien werden rechts dezent mit Preis verlängert', await page.locator('#chart .pat-projection').count() >= 1 && (await page.locator('#chart .pat-projection-price').first().textContent()).includes('≈'));
    await page.locator('#chart').scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
    const scale = await page.evaluate(() => __g09.chartScale());
    await page.evaluate(() => { const e = document.getElementById('pat-project-on'); e.checked = false; e.dispatchEvent(new Event('change')); });
    await page.locator('#chart').scrollIntoViewIfNeeded(); await page.waitForFunction(() => !document.querySelector('#chart .pat-projection')).catch(async e => { console.log('PROJ', JSON.stringify(await page.evaluate(() => ({ settings: __g09.projection(), rows: __g09.projectionRows().length, error: document.querySelector('.widget-error')?.textContent })))); throw e; });
    check('Ausschalten entfernt Projektion ohne Änderung der Preisachse', await page.evaluate(scale => { const next = __g09.chartScale(); return next.min === scale.min && next.max === scale.max; }, scale));
    await page.evaluate(() => { const b = document.getElementById('pat-project-bars'); b.value = '30'; document.getElementById('pat-project-on').checked = true; b.dispatchEvent(new Event('change')); });
    await page.waitForFunction(() => !!document.querySelector('#chart .pat-projection'));
    check('Länge und Schalter werden gespeichert, Durchbruch blasser markiert', await page.evaluate(() => __g09.projection().bars === 30 && JSON.parse(localStorage.getItem('scalpdesk.pattern-projection.v1')).on && !!document.querySelector('#chart .pat-projection.broken')));
    if (errors.length) console.log('Laufzeitfehler:', JSON.stringify(errors));
    check('Keine JavaScript-Laufzeitfehler', errors.length === 0);
    await ctx.close();
  } finally { await browser.close(); await h.teardown(); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
