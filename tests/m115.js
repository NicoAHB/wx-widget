// 3.73.0: v2, Filterdiagnose und unveränderte v1-Ergebnisse; tatsächlicher Settings-Schalter, Live-Modell, Worker-Vergleich und persistentes Ergebnis.
const h = require('./harness'), { watchFixture, mirrorWatch } = require('./watch-model-fixture');
const results = [], check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const settings = async p => { await p.click('[data-workspace-target="settings"]'); await p.locator('#watch-model-toggle').scrollIntoViewIfNeeded(); };
(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0'); const b = await h.launch({ workspace: 'fresh' });
  try {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true }), p = await c.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message));
    await c.addInitScript(() => { if (localStorage.getItem('seed115')) return; localStorage.setItem('seed115', '1'); localStorage.setItem('scalpdesk.watchlist.v1', '["BTC","ETC"]'); localStorage.setItem('scalpdesk.wlspan.v1', '"1h"'); });
    await p.goto(h.URL_BASE + '/weather-widget-v2.html'); await p.waitForFunction(() => window.__watchModels && __g09.wl.c.size === 2 && [...__g09.wl.c.values()].every(e => e.rating));
    check('Standard bleibt das bisherige Modell ohne zusätzliche 501-Kerzen-Abrufe', await p.evaluate(() => __watchModels.mode === 'classic' && __watchModels.feed.streams().length === 0) && !(await h.ctl('/log')).some(e => e.q?.limit === '501'));
    const baseline = await p.evaluate(() => JSON.stringify([...__g09.wl.c].map(([s, e]) => [s, e.rating])));
    await settings(p); await p.locator('#watch-model-toggle').tap(); await p.waitForFunction(() => __watchModels.mode === 'strict' && !document.getElementById('watch-model-toggle').disabled);
    check('Ein Tipp aktiviert und speichert das 5/5-Modell mit klarer Beschriftung', await p.getAttribute('#watch-model-toggle', 'aria-checked') === 'true' && /15m.*4h/.test(await p.locator('#watch-model-current').textContent()) && await p.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.watch-model.v1'))) === 'strict');
    await p.waitForFunction(() => [...__watchModels.feed.state.entries.values()].every(e => e.lower.length === 500 && e.higher.length === 500), null, { timeout: 30000 });
    const now = await p.evaluate(() => Math.floor(Date.now() / 900000) * 900000), fixture = watchFixture(now);
    await p.evaluate(({ lower, higher, shortLower, shortHigher }) => { const f = __watchModels.feed; for (const [s, l, h] of [['BTCUSDT', lower, higher], ['ETCUSDT', shortLower, shortHigher]]) { const e = f.state.entries.get(s); Object.assign(e, { lower: l, higher: h, loadedAt: Date.now(), retryAt: Date.now() + 60000, error: '', cachedKey: '' }); } f.state.revision++; __watchModels.refresh(); }, { ...fixture, shortLower: mirrorWatch(fixture.lower), shortHigher: mirrorWatch(fixture.higher) });
    await p.click('#watch-model-settings [data-goto="watchlist"]'); await p.waitForFunction(() => document.querySelector('[data-watch="BTC"]')?.dataset.wmSignal === 'long');
    check('Nur echte 5/5-Konfluenz blinkt: Long grün, Short rot', await p.$eval('[data-watch="BTC"]', e => e.dataset.wmSignal === 'long' && /wmLong/.test(getComputedStyle(e).animationName)) && await p.$eval('[data-watch="ETC"]', e => e.dataset.wmSignal === 'short' && /wmShort/.test(getComputedStyle(e).animationName)));
    await p.tap('[data-wlfilter="strong"]'); check('Long-Filter zeigt ausschließlich bestätigte Long-Coins', await p.$eval('[data-watch="BTC"]', e => !e.closest('.wl-item').hidden) && await p.$eval('[data-watch="ETC"]', e => e.closest('.wl-item').hidden));
    await p.tap('[data-wlfilter="weak"]'); check('Short-Filter zeigt ausschließlich bestätigte Short-Coins', await p.$eval('[data-watch="BTC"]', e => e.closest('.wl-item').hidden) && await p.$eval('[data-watch="ETC"]', e => !e.closest('.wl-item').hidden)); await p.tap('[data-wlfilter="all"]');
    check('Bisherige Bewertungen bleiben beim Testmodell unverändert gespeichert', await p.evaluate(() => JSON.stringify([...__g09.wl.c].map(([s, e]) => [s, e.rating]))) === baseline);
    await p.tap('[data-watch="BTC"]'); check('Detail erklärt alle fünf Regeln mit festen Zeitrahmen', await p.locator('#wl-detail .wm-detail li').count() === 5 && /15m.*4h/.test(await p.locator('#wl-detail .wl-d-meta').textContent())); await p.click('#wl-detail .wm-detail [data-goto]'); check('Detail führt direkt zum Modellschalter in Einstellungen', await p.locator('#watch-model-toggle').isVisible() && await p.evaluate(() => document.documentElement.dataset.workspaceView === 'settings')); await p.click('#watch-model-settings [data-goto="watchlist"]'); await p.tap('[data-watch="BTC"]');
    await p.tap('button[data-wlview="list"]'); check('Dasselbe bestätigte Signal erscheint in der Listenansicht', await p.$eval('[data-watch="BTC"]', e => e.dataset.wmSignal === 'long') && await p.getAttribute('#watchlist', 'data-wlview') === 'list');
    await p.evaluate(() => { const e = __watchModels.feed.state.entries.get('BTCUSDT'); e.lower.at(-1).volume = 100; e.cachedKey = ''; __watchModels.feed.state.revision++; __watchModels.refresh(); });
    check('4/5 sperrt das Blinksignal sofort', await p.$eval('[data-watch="BTC"]', e => e.dataset.wmSignal === 'none' && getComputedStyle(e).animationName === 'none'));
    await p.emulateMedia({ reducedMotion: 'reduce' }); check('Reduzierte Bewegung unterdrückt Blinken bei erhaltenem Short-Signal', await p.$eval('[data-watch="ETC"]', e => e.dataset.wmSignal === 'short' && getComputedStyle(e).animationName === 'none')); await p.emulateMedia({ reducedMotion: 'no-preference' });
    await c.setOffline(true); await p.waitForFunction(() => document.querySelector('[data-watch="ETC"]').dataset.wmSignal === 'none'); check('Offline entfernt bestätigte Blinksignale sofort', await p.$eval('[data-watch="ETC"]', e => getComputedStyle(e).animationName === 'none')); await c.setOffline(false);
    await p.click('#pause'); check('Pause beendet das Blinken sofort und sperrt Freigaben', await p.$eval('[data-watch="ETC"]', e => e.dataset.wmSignal === 'none')); await p.click('#pause');
    await p.reload(); await p.waitForFunction(() => window.__watchModels); check('Neustart stellt Modell, Listenansicht und ursprünglichen Prozent-Zeitraum wieder her', await p.evaluate(() => __watchModels.mode === 'strict' && __g09.wl.span === '1h') && await p.getAttribute('#watchlist', 'data-wlview') === 'list');
    await settings(p); await p.tap('#watch-model-toggle'); await p.waitForFunction(() => __watchModels.mode === 'classic' && !document.getElementById('watch-model-toggle').disabled);
    check('Rückwechsel stellt Original und seine Zeitraumwahl her und entfernt Zusatzstreams', await p.evaluate(() => __g09.wl.span === '1h' && __watchModels.feed.streams().length === 0) && await p.getAttribute('#watch-model-toggle', 'aria-checked') === 'false');
    await p.locator('#watch-model-comparison > summary').click(); await p.fill('#watch-compare-days', '7'); await p.fill('#watch-compare-feePct', ''); await p.click('#watch-compare-start');
    check('Leere Kosteneingabe wird nicht als kostenfreier Test angenommen', /prüfen/.test(await p.locator('#watch-compare-status').textContent()) && !await p.evaluate(() => __watchModels.view.state.busy)); await p.fill('#watch-compare-feePct', '0.05');
    for (const width of [320, 390, 768, 1440]) { await p.setViewportSize({ width, height: 900 }); await p.waitForTimeout(200); check(`${width}px: Settings ohne seitlichen Überlauf, Schalter ≥44px`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.getElementById('watch-model-toggle').getBoundingClientRect().height >= 44)); }
    // Der alte Mock besitzt nur eine kurze Live-Historie. Für paginierte Backtests liefert diese
    // lokale Börsenattrappe lückenlose, zeitstabile Rohdaten im wirklichen Binance-Format.
    await c.route('**/api/v3/klines?**', async route => {
      const q = new URL(route.request().url()).searchParams;
      if (!q.has('startTime') || q.get('limit') !== '1000') return route.continue();
      const step = q.get('interval') === '4h' ? 14400000 : 900000, start = Number(q.get('startTime')), until = Number(q.get('endTime')), rows = [];
      for (let t = start; t <= until && rows.length < 1000; t += step) {
        const close = 100 + Math.sin(t / 900000 / 7) * 4 + Math.sin(t / 900000 / 23) * 2;
        rows.push([t, String(close), String(close + .5), String(close - .5), String(close), '100', t + step - 1, '0', 10]);
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
    });
    await p.setViewportSize({ width: 390, height: 844 }); await p.click('#watch-compare-start'); await p.waitForFunction(() => !__watchModels.view.state.busy, null, { timeout: 120000 });
    let report = await p.evaluate(() => __watchModels.view.state.report); check('Echter Worker-Vergleich berechnet und speichert beide Modelle', report?.coins.length === 2 && report?.models.classic === 'watch-classic-1' && report?.models.strict === 'watch-strict-2', await p.locator('#watch-compare-status').textContent());
    check('Gepaarte Coins und Zeitfenster, offene Fälle separat und Kosten sichtbar', report && report.coins.every(x => x.from === report.from && x.asOf === report.asOf && Object.keys(x.models).length === 2) && await p.locator('.wm-result-card').count() === 2 && /Gebühr.*Slippage/.test(await p.locator('#watch-compare-results').textContent()));
    if (!report) throw new Error('Kein Vergleichsergebnis');
    check('Neuer Lauf nennt v2 und speichert die Filterzahlen', report.coins.every(c => c.diagnostics?.rules.length === 5 && c.diagnostics.allLong + c.diagnostics.allShort === c.models.strict.stats.signals) && /Trend-Pullback.*v2/.test(await p.locator('.wm-result-card[data-model="strict"] h4').textContent()));
    await p.click('.wm-diagnostics > summary');
    check('Filterdiagnose zeigt fünf Einzelregeln und alle fünf gemeinsam', await p.locator('.wm-diagnostics tbody tr').count() === 6 && /Alle fünf gleichzeitig/.test(await p.locator('.wm-diagnostics').textContent()));
    check('Null abgeschlossene Trades werden ausdrücklich nicht als Modellvorteil dargestellt', /Null Trades belegen keinen Modellvorteil/.test(await p.locator('#watch-compare-results').textContent()));
    for (const width of [320, 390, 768, 1440]) { await p.setViewportSize({ width, height: 900 }); check(`${width}px: Ergebniskarten bleiben innerhalb des Panels`, await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll('.wm-result-card,.wm-diagnostics table')].every(e => e.scrollWidth <= e.clientWidth + 1))); }
    const incomplete = async route => { const q = new URL(route.request().url()).searchParams; if (q.get('symbol') === 'ETCUSDT' && q.has('startTime') && q.get('limit') === '1000') await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }); else await route.fallback(); };
    await c.route('**/api/v3/klines?**', incomplete); await p.click('#watch-compare-start'); await p.waitForFunction(() => !__watchModels.view.state.busy, null, { timeout: 120000 });
    report = await p.evaluate(() => __watchModels.view.state.report);
    check('Fehlende Coin-Historie wird für beide Modelle gemeinsam ausgeschlossen und benannt', report.coins.length === 1 && report.coins[0].symbol === 'BTCUSDT' && report.failed[0]?.symbol === 'ETCUSDT' && /Teilvergleich.*ETCUSDT/.test(await p.locator('#watch-compare-results').textContent())); await c.unroute('**/api/v3/klines?**', incomplete);
    const downloaded = p.waitForEvent('download'); await p.click('#watch-compare-download'); const file = await downloaded, stream = await file.createReadStream(); let json = ''; for await (const chunk of stream) json += chunk; check('JSON-Download enthält exakt den überprüfbaren gespeicherten Lauf', JSON.stringify(JSON.parse(json)) === JSON.stringify(report));
    await p.click('#watch-compare-start'); await p.click('#watch-compare-stop'); await p.waitForTimeout(500); check('Abbrechen erhält das vorherige Ergebnis', await p.evaluate(r => !__watchModels.view.state.busy && JSON.stringify(__watchModels.view.state.report) === r, JSON.stringify(report)));
    await p.reload(); await p.waitForFunction(() => window.__watchModels); await settings(p); await p.locator('#watch-model-comparison > summary').click();
    check('Vergleich überlebt Neustart und Rückwechsel ohne Neuberechnung', await p.evaluate(r => JSON.stringify(__watchModels.view.state.report) === r && __watchModels.mode === 'classic', JSON.stringify(report)));
    const legacyReport = structuredClone(report); legacyReport.models.strict = 'watch-strict-1';
    for (const coin of legacyReport.coins) { delete coin.diagnostics; coin.models.strict.version = 'watch-strict-1'; for (const trade of coin.models.strict.trades) trade.model = 'watch-strict-1'; }
    const oldCtx = await b.newContext({ viewport: { width: 320, height: 844 }, isMobile: true, hasTouch: true });
    await oldCtx.addInitScript(r => { localStorage.setItem('scalpdesk.watch-model.v1', '"strict"'); localStorage.setItem('scalpdesk.watch-compare.v1', JSON.stringify({ settings: r.settings, report: r })); }, legacyReport);
    const oldPage = await oldCtx.newPage(), legacyErrors = []; oldPage.on('pageerror', e => legacyErrors.push(e.message)); await oldPage.goto(h.URL_BASE + '/weather-widget-v2.html'); await oldPage.waitForFunction(() => window.__watchModels);
    await settings(oldPage); await oldPage.locator('#watch-model-comparison > summary').click();
    check('V1-Bericht bleibt unverändert erhalten und als altes Modell beschriftet', await oldPage.evaluate(r => JSON.stringify(__watchModels.view.state.report) === r, JSON.stringify(legacyReport)) && /v1.*alt/.test(await oldPage.locator('.wm-result-card[data-model="strict"] h4').textContent()));
    check('Aktiver v2-Test und alter v1-Bericht sind sichtbar unterschieden', /Trend-Pullback.*v2/.test(await oldPage.locator('#watch-model-current').textContent()) && /neuen Vergleich starten/.test(await oldPage.locator('.wm-report-version-note').textContent()) && await oldPage.locator('#watch-compare-download').isVisible());
    await oldPage.click('.wm-diagnostics > summary'); check('Fehlende alte Diagnose verlangt neuen Lauf und erzeugt keine Fehler', /neuer Vergleich ergänzt/.test(await oldPage.locator('.wm-diagnostics').textContent()) && !legacyErrors.length); await oldCtx.close();
    // Beschädigte Sicherung darf keinen Modulstart oder Navigation verhindern.
    // Eigener frischer Kontext vermeidet absichtliche Konflikte mit dem bestehenden IDB-Snapshot.
    const bad = await b.newContext(); await bad.addInitScript(() => localStorage.setItem('scalpdesk.watch-compare.v1', '{"report":{"protocol":"watch-compare-1","models":{"classic":"watch-classic-1","strict":"watch-strict-1"},"coins":[{}]}}')); const q = await bad.newPage(); const badErrors = []; q.on('pageerror', e => badErrors.push(e.message)); await q.goto(h.URL_BASE + '/weather-widget-v2.html'); await q.waitForFunction(() => window.__watchModels); check('Beschädigter gespeicherter Bericht wird sicher verworfen', await q.evaluate(() => __watchModels.view.state.report === null) && !badErrors.length); await bad.close();
    check('Keine JavaScript-Fehler', !errors.length, errors.join(' | ')); await c.close();
  } catch (e) { check('Abbruch', false, e.stack); }
  finally { await b.close(); await h.ctl('/walk?on=1'); await h.teardown(); }
  const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} bestanden`); process.exitCode = pass === results.length ? 0 : 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
