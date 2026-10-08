// G11: tatsächlicher App-Worker, optionales PO3, natives Journal und gemeinsamer Feed.
const h = require('./harness'), fs = require('fs'), os = require('os'), path = require('path'); let pass = 0, fail = 0;
const check = (name, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${info ? ' — ' + String(info).slice(0, 350) : ''}`); };
(async () => { let browser, watcher, dir;
  try {
    await h.setup(); browser = await h.launch(); const context = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await context.newPage(), errors = [], calls = [];
    const F = await import('./fixtures/bitget.mjs'); page.on('pageerror', e => errors.push(e.message));
    await context.route('https://api.bitget.com/**', async route => { calls.push(route.request().url()); await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(F.responseBody(route.request().url(), Date.now())) }); });
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => !!window.__g11);
    check('Appstart: PO3 und Konfluenz AUS, keine Bitget-/privaten Abrufe', !calls.length && await page.evaluate(() => !__g11.view.active() && !__g10.state.cfg.on));
    await page.click('#ki-signal-tab'); await page.locator('#po3-panel > summary').click(); await page.locator('#po3-settings summary').click(); await page.click('#po3-start');
    check('Schließmodell bewusst wählen; leeres Modell startet nichts', !calls.length && /bewusst wählen/.test(await page.textContent('#po3-status')));
    await page.selectOption('#po3-bias', '5m'); await page.selectOption('#po3-setup', '1h'); await page.selectOption('#po3-closure', 'tp1'); await page.click('#po3-start');
    check('Falsche Ebenenhierarchie verhindert Abruf', !calls.length && /hierarchie/i.test(await page.textContent('#po3-status')));
    await page.selectOption('#po3-bias', '1m'); await page.selectOption('#po3-setup', '1m'); await page.selectOption('#po3-windowMode', '1h');
    await page.evaluate(() => { __g05.state.watch = ['BTC']; }); await page.click('#po3-start');
    try { await page.waitForFunction(() => __g11.view.state.stream?.series['1m'].indicator.count > 260 && !__g10.state.busy, null, { timeout: 30000 }); } catch (e) { console.log(await page.evaluate(() => ({ message: document.getElementById('po3-status').textContent, ki: document.getElementById('ki-status').textContent, options: __g11.view.state.options, busy: __g10.state.busy }))); console.log('Öffentliche Testabrufe:', calls.length); throw e; }
    check('Echter KI-Worker lädt Minutenkerzen und EMA/ATR, ohne Konfluenz-Start', calls.length >= 4 && await page.evaluate(() => !!__g10.state.worker && __g11.view.state.stream.series['1m'].values.at(-1).ema50 !== null && !__g10.state.cfg.on));
    check('Gleiche Ebenen nur einmal je Phase, Warm-up vor Zeitraum ohne alte Bias-Struktur', calls.filter(x => x.includes('history-candles')).every(x => new URL(x).searchParams.get('granularity') === '1m') && await page.evaluate(() => __g11.view.state.stream.series['1m'].periodPivots.every(x => x.time >= __g11.view.state.stream.window.from)));
    check('Nur öffentliche GET-Marktpfade, keine Positionen/Orders erzeugt', calls.every(x => new URL(x).pathname.startsWith('/api/v2/mix/market/')) && await page.evaluate(() => !__g05.state.positions.length && !__g05.state.demoPositions.length));
    await page.click('#po3-stop'); await page.waitForFunction(() => !__g10.state.busy);
    const instrument = await page.evaluate(() => __g11.view.state.stream.instrument);
    await page.evaluate(async instrument => {
      const P = await import('/shared/po3-core.mjs'), S = await import('/shared/po3-simulator.mjs'), D = await import('/shared/po3-store.mjs'); const root = await D.readPo3State(), stream = __g11.view.state.stream, p = { ...stream.config }, at = Math.floor(Date.now() / 60000) * 60000 - 2 * 60000;
      const score = P.po3Score({ direction: 1, sweep: true, retest: true, bias: 1, impulse: true }, p), own = S.po3Signal({ instrument, confirmedAt: at, levels: { status: 'bereit', direction: 1, entry: 100, sl: 99, tps: [102, 103, 104], risk: 1, rewardRisk: 2 }, score,
        sweep: { time: at - 60000, extreme: 99 }, setupSweep: { time: at - 5 * 60000, extreme: 98 }, box: { high: 103, low: 99, height: 4, from: at - 10 * 60000 }, zone: { id: 'test-only', low: 99, high: 100 }, source: { ...stream.source, anchors: stream.anchors, origin: 'rekonstruiert', fixture: 'Ausschließlich Browsertest' } }, p);
      await D.changePo3State(root.revision, state => ({ ...state, journal: [own] }));
    }, instrument);
    await page.click('#po3-refresh'); await page.waitForFunction(() => __g11.view.state.loaded && __g11.view.state.journal.length === 1); await page.evaluate(() => document.getElementById('po3-filter-origin').closest('details').open = true); await page.selectOption('#po3-filter-origin', 'rekonstruiert'); await page.click('#ki-view-watch');
    check('Eigenes IDB-Journal und ehrliche 30er-Grenze/Fundinggrenze', await page.locator('#ki-list article[data-po3-id]').count() === 1 && /zu wenig Daten.*vor Funding/.test(await page.textContent('#po3-stats')));
    await page.locator('#ki-list .ki-card-details > summary').click(); await page.locator('#ki-list input[type=checkbox]').check(); await page.waitForFunction(() => __g11.view.state.journal[0]?.tradedByMe);
    check('Eigene Markierung separat, keine Börsenausführung behauptet', /kein Ausführungsbeleg/.test(await page.textContent('#ki-list')) && await page.evaluate(() => __g11.view.state.journal[0].tradedByMe));
    await page.locator('#ki-list button').click(); check('PO3-Chart mit fünf Levels, Box/FVG und Herkunft; normales 3-Linien-Chart unverändert', await page.locator('#po3-chart-area svg').count() === 1 && /Entry D.*SL.*TP1.*TP2.*TP3/.test(await page.textContent('#po3-chart-area')) && await page.locator('#ki-chart .ki-level').count() === 0);
    const exported = await page.evaluate(() => __g11.view.action('export')); check('CSV enthält vollständiges Modell und Quellenrevision, Markierung gespeichert', exported.csv.includes('po3-1') && exported.csv.includes('tradedByMe') && exported.csv.includes('dataRevision'));
    await page.reload(); await page.waitForFunction(() => !!window.__g11); await page.click('#ki-signal-tab'); await page.waitForFunction(() => !__g10.state.busy && !__g10.state.pending); await page.evaluate(() => { document.getElementById('ki-setup').open = true; document.getElementById('po3-panel').open = true; }); await page.click('#po3-refresh'); await page.waitForFunction(() => __g11.view.state.loaded); await page.click('#ki-view-watch'); await page.locator('#ki-list .ki-card-details > summary').click();
    check('Reload: AUS bleibt erhalten, Signal und Markierung wiederhergestellt', await page.evaluate(() => !__g11.view.active() && __g11.view.state.journal.length === 1 && __g11.view.state.journal[0].tradedByMe));
    for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 844 }); check(width + 'px ohne horizontalen Seitenüberlauf', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
    await page.locator('#ki-list button').click(); await page.click('#po3-full-open');
    check('PO3-Vollbild: zugänglicher Dialog mit einklappbarer Toolbar', await page.locator('#po3-fullscreen').evaluate(x => x.open) && await page.locator('#po3-fullscreen svg').count() === 1);
    await page.click('#po3-fullscreen summary'); await page.keyboard.press('Escape');
    check('Vollbild schließen gibt denselben Chart zurück und hält Journal', await page.locator('#po3-chart-area svg').count() === 1 && await page.evaluate(() => __g11.view.state.journal.length === 1));
    const W = await import('../server/scalpdesk-247.mjs'); dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm67-oracle-'));
    watcher = new W.Watcher({ token: '123456789:TEST_ONLY_NOT_A_REAL_TOKEN_000000000', chat: '-100777', key: 'k'.repeat(43), statePath: path.join(dir, 'state.json'), origins: [h.URL_BASE], listen: '127.0.0.1:0', log: () => {} }); const port = await watcher.listenNow();
    const context2 = await browser.newContext({ viewport: { width: 390, height: 844 } }); await context2.addInitScript(port => { localStorage.setItem('scalpdesk.svc.v1', JSON.stringify({ url: 'http://127.0.0.1:' + port, key: 'k'.repeat(43), inst: 'po3test67' })); }, port);
    const page2 = await context2.newPage(); page2.on('pageerror', e => errors.push(e.message)); await page2.goto(h.URL_BASE + '/weather-widget-v2.html'); await page2.waitForFunction(() => !!window.__g11 && __g05.svc.pol.conf?.po3); await page2.click('#ki-signal-tab');
    await page2.evaluate(() => { __g11.view.state.options.config.closure = 'tp1'; __g05.state.watch = ['BTC']; }); await page2.locator('#po3-panel > summary').click(); await page2.locator('#po3-service summary').click(); await page2.click('#po3-service-config'); try { await page2.waitForFunction(() => __g05.svc.pol.conf.po3.revision === 1); } catch (e) { console.log(await page2.textContent('#po3-status')); throw e; }
    check('Tatsächliches HTTP-Command: PO3 bestätigt, Konfluenz und Telegram bleiben aus', watcher.po3.state.config.on && watcher.ki.state.config === null && !watcher.pol.targets.ki.on && await page2.isEnabled('#ki-telegram'));
    await page2.click('#ki-telegram'); await page2.waitForFunction(() => __g05.svc.pol.conf.targets.ki.on); check('PO3-only Auswahl verwendet bestätigten gemeinsamen KI-/Telegram-Schalter', watcher.pol.targets.ki.on && /PO3 Revision 1/.test(await page2.textContent('#ki-telegram-note')));
    await page2.click('#po3-service-stop'); await page2.waitForFunction(() => __g05.svc.pol.conf.po3.revision === 2); check('Dienstpause bestätigt und Preisalarm bleibt aktiv, keine Handelsorder', !watcher.po3.state.config.on && watcher.pol.targets['course-alert'].on);
    check('Keine doppelte PO3-DOM-ID', await page.evaluate(() => { const ids = [...document.querySelectorAll('#po3-panel [id]')].map(x => x.id); return new Set(ids).size === ids.length; }));
    check('Keine JavaScript-Fehler', errors.length === 0, errors.join('; '));
  } finally { await browser?.close(); if (watcher) { watcher.po3.stop(); watcher.ki.stop(); clearTimeout(watcher.saveTimer); watcher.server.closeAllConnections?.(); await new Promise(resolve => watcher.server.close(resolve)); } await h.teardown(); if (dir) fs.rmSync(dir, { recursive: true, force: true }); }
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
