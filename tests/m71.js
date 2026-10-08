// KI-Korrekturen: tatsächlicher App-Worker, Abruffehler, Originalschutz, Modellwechsel und Farben.
const h = require('./harness'); let pass = 0, fail = 0;
const check = (name, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${info ? ' — ' + String(info).slice(0, 500) : ''}`); };
(async () => {
  let browser;
  try {
    const F = await import('./fixtures/confluence-live.mjs'), LC = await import('../shared/confluence-legacy-core.mjs'), LL = await import('../shared/confluence-legacy-live.mjs'), LR = await import('../shared/confluence-legacy-replay.mjs');
    const oldFixture = F.liveFixture();
    function legacySource(value) { if (!value || typeof value !== 'object') return; for (const [key, child] of Object.entries(value)) {
      if (key === 'modelVersion' && child === 'cf-2') value[key] = 'cf-1'; else if (key === 'parametersKey') value[key] = LC.parametersKey(oldFixture.config); else legacySource(child);
    } }
    legacySource(oldFixture); const oldResult = LL.evaluateLive(oldFixture), oldCard = { ...oldResult.eligible[0], read: true }, oldObservation = LR.captureObservation(oldResult, oldFixture.config, oldFixture.options);
    await h.setup(); browser = await h.launch(); const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage(), errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message)); let tickerFail = false, allFail = false, fundingFail = false; const started = Date.now();
    await ctx.route('https://api.bitget.com/**', async route => {
      const req = route.request(), u = new URL(req.url()); requests.push({ method: req.method(), url: req.url(), headers: req.headers() });
      if (allFail || tickerFail && u.pathname.endsWith('/ticker')) return route.abort();
      const body = F.liveBitgetResponse(req.url(), Date.now(), started); if (fundingFail && u.pathname.endsWith('/current-fund-rate')) body.code = '40000';
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body), headers: { 'access-control-allow-origin': '*' } });
    });
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => !!window.__g10 && __g05.state.candles.length && !__g10.state.busy);
    await page.click('#ki-signal-tab'); await page.evaluate(() => { __g05.state.watch = ['BTC']; });
    await page.fill('#ki-slippageBps', '0'); await page.selectOption('#ki-fundingMode', 'current-rate'); await page.selectOption('#ki-anchorPolicy', 'nearest'); await page.fill('#ki-patternWeight', '0'); await page.uncheck('#ki-longOn'); await page.click('#ki-save');
    await page.waitForFunction(() => __g10.state.cards.length === 1 && !__g10.state.busy, null, { timeout: 25000 });
    const original = await page.evaluate(() => JSON.stringify(__g10.state.cards[0]));
    check('Tatsächlicher Worker erzeugt neue cf-2-Karte mit gebundenen Ausstiegskosten', await page.evaluate(() => { const c = __g10.state.cards[0]; return c.scope.modelVersion === 'cf-2' && c.version === 'cf-live-2' && c.costs.execution.slippageBps === 0 && c.eligible; }));
    check('Frische vollständige Prüfung bestätigt Long im Richtungs-Chip', await page.evaluate(() => document.getElementById('ki-hold-chip').classList.contains('ki-positive') && document.getElementById('ki-hold-chip').textContent === 'KI: Long'));
    check('Karte nennt Originalmodell, Revision und referenzierten Bitget-Kurszeitpunkt', /Modell cf-2 · Revision.*Referenzkurs/.test(await page.textContent('#ki-list')));
    check('Kosteninfo zeigt beide Ausstiege und ungünstiges Tickraster', /je Ein-\/Ausstieg.*Ausführung am Ziel.*am Stop.*Tickraster/.test(await page.textContent('#ki-list')));
    const refresh = async () => { const serial = await page.evaluate(() => __g10.state.serial); await page.click('#ki-refresh'); await page.waitForFunction(n => __g10.state.serial > n && !__g10.state.busy, serial, { timeout: 25000 }); };
    tickerFail = true; await refresh();
    check('Audit-Reproduktion korrigiert: Tickerfehler nimmt grünen Chip zurück', await page.evaluate(() => !document.getElementById('ki-hold-chip').classList.contains('ki-positive') && !__g10.state.current.get('BTCUSDT|short').some(c => c.eligible)));
    check('Gespeicherte positive Karte nach Fehler nur gelb mit aktuellem Datenhinweis', await page.evaluate(() => !!document.querySelector('#ki-list .ki-card-head .ki-warning') && /aktuelle Daten fehlen/.test(document.getElementById('ki-list').textContent)));
    check('Fehlertext auf Deutsch und konkrete Handlung sichtbar', /Bitget-Netzwerkzugriff.*Erneut prüfen/.test(await page.textContent('#ki-list')) && !/Failed to fetch/.test(await page.textContent('#ki-status')));
    check('Fehlgeschlagene Neuberechnung ersetzt den Originalplan nicht', await page.evaluate(raw => JSON.stringify(__g10.state.cards[0]) === raw, original));
    tickerFail = false; await refresh();
    check('Erfolgreiche Folgeprüfung bestätigt Richtung erneut, kein doppeltes Signal', await page.evaluate(() => __g10.state.cards.length === 1 && document.getElementById('ki-hold-chip').classList.contains('ki-positive')));
    const stale = await page.evaluate(() => { const saved = __g10.state.current.get('BTCUSDT|short'), current = structuredClone(saved); current[0].quote.at = Date.now() - 30001; __g10.state.current.set('BTCUSDT|short', current); __g10.render();
      const ok = !document.getElementById('ki-hold-chip').classList.contains('ki-positive') && /Referenzkurs erneut prüfen/.test(document.getElementById('ki-list').textContent); __g10.state.current.set('BTCUSDT|short', saved); __g10.render(); return ok; });
    check('Überalterter Referenzkurs neutralisiert Chip und gespeicherte Kartenanzeige', stale);
    fundingFail = true; await refresh();
    check('Fehlendes Funding nimmt Freigabe und positive Kartenfarbe zurück', await page.evaluate(() => !document.getElementById('ki-hold-chip').classList.contains('ki-positive') && !document.querySelector('#ki-list .ki-card-head .ki-positive') && __g10.state.current.get('BTCUSDT|short')[0].score.score === null));
    fundingFail = false; allFail = true; await refresh();
    check('Vollständiger Feedfehler bestätigt auch mit früheren Snapshots kein Signal', await page.evaluate(() => !__g10.state.current.has('BTCUSDT|short') && __g10.state.checks.get('BTCUSDT|short').error && !document.getElementById('ki-hold-chip').classList.contains('ki-positive')));
    await page.evaluate(() => document.getElementById('ki-settings').open = true); await page.fill('#ki-patternWeight', '15'); await page.click('#ki-save');
    await page.waitForFunction(() => !__g10.state.busy && __g10.state.checks.size > 0, null, { timeout: 25000 });
    check('Audit-Modellwechsel korrigiert: frühere Karte grau und sichtbar bezeichnet', await page.evaluate(() => !!document.querySelector('#ki-list .ki-card-head .ki-muted') && /früheres Modell/.test(document.getElementById('ki-list').textContent) && document.getElementById('ki-hold-chip').textContent === 'KI: Halten'));
    check('Einstellungswechsel lässt damaligen Score, Kosten und Parameter bytegleich', await page.evaluate(raw => JSON.stringify(__g10.state.cards[0]) === raw, original));
    await page.click('#ki-stop');
    const paused = await page.evaluate(() => __g10.state.cfg.on === false && !document.getElementById('ki-hold-chip').classList.contains('ki-positive'));
    check('Pause bleibt neutral; bestehende Positionen werden nicht geschlossen', paused && await page.evaluate(() => !__g05.state.positions.length && !__g05.state.demoPositions.length));
    await page.evaluate(async c => { __g10.state.cards = [c, ...__g10.state.cards]; __g10.render(); await new Promise((resolve, reject) => { const r = indexedDB.open('scalpdesk'); r.onsuccess = () => { const db = r.result, tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(__g10.state.cards, 'scalpdesk.idb.ki.cards.v1'); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; }); }, oldCard);
    check('Gespeicherte cf-1-Karte bleibt lesbar mit Originalscore und Modellhinweis', /Modell cf-1.*Ausstiegsslippage im damaligen Kostenfilter nicht enthalten/.test(await page.textContent('#ki-list')));
    const importResult = await page.evaluate(async observation => { const input = { app: 'scalpdesk-model-archive', version: 1, exportedAt: Date.now(), observations: [observation], po3Journal: [], bot: null };
      await __g13.importModelArchive(input); await __g13.importModelArchive(input); const saved = await __g13.exportModelArchive(); return { old: saved.observations.filter(o => o.version === 'cf-replay-1'), newer: saved.observations.filter(o => o.version === 'cf-replay-2').length }; }, oldObservation);
    check('Tatsächlicher nativer Archivimport/Wiederimport erhält alte Originale genau einmal', importResult.old.length === 1 && JSON.stringify(importResult.old[0]) === JSON.stringify(oldObservation) && importResult.newer > 0);
    for (const width of [320, 390, 1100]) { await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => document.getElementById('ki-settings').open = true);
      check(`Originalhinweise und Kostenfelder bei ${width}px ohne Seitenüberlauf`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
    await page.reload(); await page.waitForFunction(() => !!window.__g10 && __g05.state.candles.length && !__g10.state.busy); await page.click('#ki-signal-tab');
    check('Neustart erhält beide Kartenmodelle und beginnt ohne grüne Altfreigabe', await page.evaluate(() => __g10.state.cards.some(c => c.scope.modelVersion === 'cf-1') && __g10.state.cards.some(c => c.scope.modelVersion === 'cf-2') && !document.getElementById('ki-hold-chip').classList.contains('ki-positive')));
    check('Alle tatsächlichen Börsenabrufe weiterhin öffentliche GETs ohne Kontozugang/Orders', requests.length > 0 && requests.every(r => r.method === 'GET' && new URL(r.url).pathname.startsWith('/api/v2/mix/market/') && !r.headers.authorization && !r.headers['access-key']));
    check('Keine JavaScript-Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  } finally { await browser?.close(); await h.teardown(); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
