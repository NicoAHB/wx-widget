// G10(d): Original-IDB, tatsächlicher App-Worker, historische Quoten und Wiederaufnahme.
const path = require('path'), { pathToFileURL } = require('url'), h = require('./harness');
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${info ? ' — ' + String(info).slice(0, 600) : ''}`); };
(async () => {
  let browser;
  try {
    const R = await import(pathToFileURL(path.join(__dirname, '../shared/confluence-replay.mjs')));
    const { replayFixture, HOUR } = await import(pathToFileURL(path.join(__dirname, 'fixtures/confluence-replay.mjs')));
    const f = replayFixture(); await h.setup(); browser = await h.launch();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage(), errors = [], calls = [];
    page.on('pageerror', e => errors.push(e.message));
    await ctx.route('https://api.bitget.com/**', async route => {
      const req = route.request(), u = new URL(req.url()); calls.push({ url: req.url(), method: req.method(), headers: req.headers() });
      let data;
      if (u.pathname.endsWith('/history-fund-rate')) data = f.history.events.map(e => ({ symbol: 'BTCUSDT', fundingRate: String(e.rate), fundingTime: String(e.at) })).reverse();
      else { const end = Number(u.searchParams.get('endTime')), limit = Number(u.searchParams.get('limit')), mark = u.pathname.endsWith('/history-mark-candles');
        data = Array.from({ length: limit }, (_, i) => { const time = end - (i + 1) * HOUR, c = (mark ? f.marks : f.rows).find(c => c.time === time) || { open: 100, high: 101, low: 99, close: 100, volume: mark ? 0 : 100 };
          return [time, c.open, c.high, c.low, c.close, c.volume, 0].map(String); }); }
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ code: '00000', requestTime: Date.now(), data }) });
    });
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => !!window.__g10 && __g05.state.candles.length);
    await page.click('#ki-signal-tab');
    const parity = await page.evaluate(async f => { const R = await import('/shared/confluence-replay.mjs'); return R.replayJob({ observations: [f.observation], ...f }); }, f);
    check('Browser und Node: identische Originalreplays mit 60/70/80', JSON.stringify(parity) === JSON.stringify(R.replayJob({ observations: [f.observation], ...f })));
    await page.evaluate(card => { __g10.state.cards = [card]; __g10.render(); }, f.card);
    await page.evaluate(card => __g10.backtest(card), f.card);
    check('Ohne Originaleingaben ehrlich nicht bewertbar, kein öffentlicher Ersatzabruf', !calls.length && await page.evaluate(() => __g10.state.history.values().next().value.statistics.short.status === 'nicht bewertbar'));
    const stored = await page.evaluate(async observation => { const S = await import('/shared/confluence-replay-store.mjs');
      await Promise.all([S.saveObservation(observation), S.saveObservation(structuredClone(observation))]); const old = await S.readReplay('observations');
      const later = structuredClone(observation); later.decisionAt++; later.data.scope.asOf++; await S.saveObservation(later);
      return { n: old.length, at: (await S.readReplay('observations'))[0].decisionAt, usage: await S.readReplay('meta', 'usage') }; }, f.observation);
    check('Atomarer Originalspeicher: gleichzeitige Schreibversuche zählen einmal, spätere Daten ersetzen nichts', stored.n === 1 && stored.usage.n === 1 && stored.at === f.observation.decisionAt);
    const old = await page.evaluate(async ({ card, asOf, observation }) => { const S = await import('/shared/confluence-replay-store.mjs'), R = await import('/shared/confluence-replay.mjs');
      await S.saveReplay('jobs', { id: observation.key, version: R.REPLAY_VERSION, instrument: 'BTCUSDT', asOf, from: observation.decisionAt, to: asOf, stage: 'prices', cursor: observation.decisionAt, rows: [], marks: [], events: [], pageNo: 1, fundingTo: null, cases: [], replayCursor: 0, conflicts: 0 });
      await __g10.backtest(card); return __g10.state.history.get(card.id); }, f);
    check('App-Worker setzt historische Grenze fort und löst echte TP-Fälle mit Originalmodell auf', old.asOf === f.asOf && old.backtests.every(r => r.n === 1 && r.netR > 0 && r.maxDrawdownR === 0), JSON.stringify(old.backtests));
    check('Unter 30 keine Prozentquote oder Euro-Erwartung; beide Fenster mit N und Datenlücken', old.statistics.short.tpPercent === null && old.statistics.long.tpPercent === null && old.statistics.short.expectedEUR === null && /N=1/.test(await page.textContent('#ki-list')));
    check('Vergangene Preise/Mark/Funding nur öffentliche GETs, keine Orders/Schlüssel', calls.length === 3 && calls.every(c => c.method === 'GET' && !c.headers.authorization && !c.headers['access-key'] && c.url.includes('/mix/market/')));
    check('Backtests sichtbar getrennt, Kostenmodell und R-Folge erklärt', /Score ≥ 60.*Score ≥ 70.*Score ≥ 80/.test(await page.textContent('#ki-list')) && /kein finanziertes Portfolio/.test(await page.textContent('#ki-list')));
    check('Originalkarte unverändert, keine Konto- oder Demo-Position erzeugt', await page.evaluate(card => JSON.stringify(__g10.state.cards[0]) === JSON.stringify(card) && !__g05.state.positions.length && !__g05.state.demoPositions.length, f.card));
    const cleared = await page.evaluate(async () => { const S = await import('/shared/confluence-replay-store.mjs'); await S.clearReplayJobs(); return { observations: (await S.readReplay('observations')).length, jobs: (await S.readReplay('jobs')).length, results: (await S.readReplay('results')).length }; });
    check('Nur öffentliche Zwischenstände löschen: Originalarchiv und kleine Ergebnisse bleiben', cleared.observations === 1 && cleared.jobs === 0 && cleared.results === 1);
    await page.reload(); await page.waitForFunction(() => !!window.__g10 && __g10.state.history.size === 1);
    check('Reload lädt kleine Ergebnisse, keinen großen Historienzustand auf den Hauptthread', await page.evaluate(() => __g10.state.history.size === 1 && !Object.keys(localStorage).some(k => /ki-history|ki\.observations|ki\.jobs/.test(k))));
    check('390px: Karten und Backtest-Tabelle ohne Seitenüberlauf', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    check('Keine Browserfehler', !errors.length, errors.join('; '));
  } finally { if (browser) await browser.close(); await h.teardown(); }
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(async e => { console.error(e); process.exitCode = 1; await h.teardown(); });
