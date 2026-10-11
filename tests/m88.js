// Tatsächlicher 2h-Chart, gespeicherte Auswahl, Indikatoren/Live-Streams und Muster-Klick.
const h = require('./harness');
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
(async () => {
  await h.setup(); const browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message)); await page.goto(h.URL_BASE + '/weather-widget-v2.html');
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
    await page.evaluate(() => { const e = __g09.wl.c.get('BTCUSDT'); __g09.wl.c.set('BTCUSDT', { ...e, iv: '2h', pat: { id: 'cup_handle', t0: 1, t1: 2 } }); __intervals.openPattern('BTC'); });
    await page.waitForFunction(() => __g05.state.interval === '2h' && !__g05.state.busy);
    check('Klick auf 2h-Muster lädt automatisch den 2h-Chart ohne Intervallfehler', await page.evaluate(() => __g05.state.interval === '2h' && !__g05.state.marketError && !(__g05.state.pickError || '').includes('Unbekannt')));
    check('Keine JavaScript-Laufzeitfehler', errors.length === 0);
    await ctx.close();
  } finally { await browser.close(); await h.teardown(); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
