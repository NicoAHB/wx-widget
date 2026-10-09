// PDF Etappe 1: API-Wiederverwendung, REST-Rennen, Lücken, Wiederverbindung und Rate-Limit.
const h = require('./harness'); let pass = 0, fail = 0;
const check = (name, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
(async () => { let browser;
  try {
    await h.setup(); browser = await h.launch(); const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message)); await page.goto(h.URL_BASE + '/weather-widget-v2.html');
    await page.waitForFunction(() => window.__pdf1 && __pdf1.view.state.series['1m'].length >= 5);
    // Originalposition und Alarm über dieselben Formulare wie bei bestehender Bedienung.
    await page.click('#tabbar [data-tab=pos]'); await page.click('#pos-add-toggle'); await page.fill('#pos-symbol', 'BTC'); await page.fill('#pos-lev', '5'); await page.fill('#pos-qty', '0,01'); await page.fill('#pos-entry', '64000'); await page.click('#pos-save');
    await page.waitForFunction(() => __g05.state.positions.length === 1);
    const position = await page.evaluate(() => JSON.stringify(__g05.state.positions));
    await page.click('#tabbar [data-tab=chart]');
    await page.evaluate(() => { __g05.state.positions[0].tp = 100000; __g05.syncStreams(); });
    await h.ctl('/orderflow?mult=100'); await page.waitForFunction(() => __pdf1.view.state.series['1m'].at(-1).c > 6000000);
    check('Spot-Position bleibt bei Spotkurs, kein Zielereignis aus Zusatz-Futures', await page.evaluate(() => __g05.state.prices.BTCUSDT.price < 100000 && !__g05.state.positions[0].ack.tp));
    await page.evaluate(() => { __g05.state.positions[0].tp = null; });
    check('Originalposition durch Panel unverändert', await page.evaluate(raw => JSON.stringify(__g05.state.positions) === raw, position));
    await h.ctl('/orderflow');
    // Eine echte aktuelle App-REST-Anfrage der höheren Zeitebene: Observer übernimmt die Rohvolumen.
    await page.fill('#symbol', 'BSV'); await page.press('#symbol', 'Enter');
    await page.waitForFunction(() => __g05.state.sourceFor === 'BSVUSDT' && __g05.state.source === 'futures' && !__g05.state.busy);
    await page.locator('[data-interval="1h"]').first().click();
    await page.waitForFunction(() => __g05.state.interval === '1h' && !__g05.state.busy && __pdf1.view.state.series['1h'].length === 5);
    await page.waitForFunction(() => __pdf1.view.state.series['1m'].at(-1).source === 'ws');
    check('Bereits offener Panel-Feed gehört nach Futures-Chartwechsel zur bisherigen Wiederverbindungsprüfung', await page.evaluate(() => __pdf1.live.need.has('futures') && __pdf1.live.everUp.futures));
    const logs = await h.ctl('/log'), hour = logs.filter(e => e.path === '/fapi/v1/klines' && e.q.symbol === 'BSVUSDT' && e.q.interval === '1h');
    check('Vorhandene Futures-Historie wird als Rohdaten übernommen', await page.evaluate(() => __pdf1.view.state.series['1h'].slice(0, 4).every(c => c.closed && c.source === 'rest' && c.usdt)), JSON.stringify(hour.map(e => e.q.limit)));
    const conn = (await h.ctl('/state')).conns.filter(c => /fstream/.test(c.host));
    check('Hauptchart 1h und Panel teilen dieselbe einmalige Subscription', conn.length === 1 && conn[0].streams.filter(s => s === 'bsvusdt@kline_1h').length === 1 && conn[0].streams.filter(s => s === 'bsvusdt@kline_1m').length === 1);
    const race = await page.evaluate(() => {
      const s = __pdf1.view.state, c = s.series['1m'].at(-1), before = JSON.stringify(c);
      const row = [c.t, c.o, c.h, c.l, c.c, '999999', c.T, '999999999', 5, '123', '123', '0'];
      __pdf1.view.acceptRest({ symbol: s.symbol, interval: '1m', rows: [row], startedAt: c.seenAt - 1 });
      return JSON.stringify(s.series['1m'].at(-1)) === before;
    }); check('Verspätete REST-Antwort überschreibt inzwischen empfangene Live-Kerze nicht', race);
    const oldSince = await page.evaluate(() => __pdf1.view.state.since);
    await page.fill('#symbol', 'ETH'); await page.press('#symbol', 'Enter'); await page.waitForFunction(() => __pdf1.view.state.symbol === 'ETHUSDT' && !__g05.state.busy);
    await page.fill('#symbol', 'BSV'); await page.press('#symbol', 'Enter'); await page.waitForFunction(() => __pdf1.view.state.symbol === 'BSVUSDT' && __pdf1.view.state.series['1m'].length >= 5);
    check('A→B→A: alte Anfrage desselben Symbols wird anhand Kontextbeginn abgewiesen', await page.evaluate(startedAt => {
      const s = __pdf1.view.state, c = s.series['1m'].at(-1), before = JSON.stringify(s.series);
      __pdf1.view.acceptRest({ symbol: s.symbol, interval: '1m', rows: [[c.t, c.o, c.h, c.l, c.c, '999999', c.T, '999999999', 5, '123', '123', '0']], startedAt }); return before === JSON.stringify(s.series);
    }, oldSince));
    // Tatsächliche Zeitlücke: fehlende geschlossene Kerze entfernen; normaler Tick lädt gezielt nach.
    await page.waitForTimeout(10500); const gapStart = Date.now();
    const missing = await page.evaluate(() => { const s = __pdf1.view.state, c = s.series['1m'].at(-3); s.series['1m'] = s.series['1m'].filter(x => x.t !== c.t); return c.t; });
    await page.waitForFunction(t => __pdf1.view.state.series['1m'].some(c => c.t === t && c.closed), missing);
    check('Lücke wird mit begrenzter bestehender REST-API repariert', (await h.ctl('/log')).some(e => e.at >= gapStart && e.path === '/fapi/v1/klines' && e.q.symbol === 'BSVUSDT' && e.q.interval === '1m' && e.q.limit === '30'));
    await h.ctl('/blockws?on=1'); await page.waitForFunction(() => __pdf1.live.markets.futures.st !== 'live' && !__pdf1.view.quote()?.fresh && document.getElementById('of-demo-price').disabled);
    check('Getrennte Verbindung sperrt Demo-Livekurs ohne störende Alterszeile', await page.evaluate(() => !__pdf1.view.quote()?.fresh && document.querySelector('.of-quality').hidden && document.getElementById('of-demo-price').disabled));
    await h.ctl('/blockws?on=0'); await page.waitForFunction(() => document.querySelector('.of-block[data-interval="1m"]').dataset.quality === 'live', null, { timeout: 25000 });
    check('Bestehender Worker verbindet erneut, neue Daten frisch', await page.evaluate(() => __pdf1.live.markets.futures.st === 'live'));
    check('Touch-iPad quer: Panel tatsächlich neben Chart, 380px', await page.evaluate(() => { const p = document.getElementById('orderflow-panel').getBoundingClientRect(), c = document.getElementById('chart').getBoundingClientRect(); return p.left >= c.right && p.width === 380; }));
    check('Keine JavaScript-Fehler im Touch-/Wiederverbindungstest', errors.length === 0, errors.join(' | ')); await ctx.close();
    // Eigenes Profil: Rate-Limit eines tatsächlichen Panel-Neuabrufs. Die größere Signalhistorie
    // kann den Initialabruf inzwischen vollständig liefern; deshalb gezielt „Neu laden“ antippen.
    const rateCtx = await browser.newContext({ serviceWorkers: 'block' }), ratePage = await rateCtx.newPage(); let rateCalls = 0;
    await ratePage.goto(h.URL_BASE + '/weather-widget-v2.html'); await ratePage.waitForFunction(() => window.__pdf2 && __pdf1.view.state.series['1m'].length >= 5 && __pdf2.feed.state.series['1m']?.length >= 50 && !document.getElementById('of-retry').disabled, null, { timeout: 20000 });
    await rateCtx.route('https://fapi.binance.com/fapi/v1/klines?**', async route => {
      const u = new URL(route.request().url());
      if (u.searchParams.get('interval') === '1m' && u.searchParams.get('limit') === '30') { rateCalls++; await route.fulfill({ status: 429, headers: { 'Retry-After': '15', 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Retry-After' }, contentType: 'application/json', body: JSON.stringify({ code: -1003 }) }); }
      else await route.continue();
    });
    await ratePage.click('#of-retry'); await ratePage.waitForFunction(() => /Rate-Limit/.test(document.getElementById('of-status')?.textContent || ''));
    check('Rate-Limit mit Wartezeit offen angezeigt', /15 Sekunden/.test(await ratePage.textContent('#of-status')), await ratePage.textContent('#of-status'));
    await ratePage.waitForTimeout(6000); check('Kein enger REST-Wiederholungsfeed nach Rate-Limit', rateCalls === 1);
    check('Hauptchart lädt trotz Zusatzpanel-Rate-Limit weiter Spotdaten', await ratePage.evaluate(() => __g05.state.source === 'spot' && __g05.state.candles.length > 100));
    await rateCtx.close(); console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
  } catch (e) { console.error('Abbruch', e); process.exitCode = 1; }
  finally { if (browser) await browser.close(); await h.teardown(); }
})();
