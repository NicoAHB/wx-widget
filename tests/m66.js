// G10(e): Browser und echter HTTP-Dienst, bestätigter Schalter, Parameter und Dienstkarten.
const fs = require('fs'), path = require('path'), os = require('os'), h = require('./harness');
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${info ? ' — ' + String(info).slice(0, 400) : ''}`); };
(async () => {
  let browser, w; const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm66-'));
  try {
    const W = await import('../server/scalpdesk-247.mjs'), F = await import('./fixtures/confluence-live.mjs');
    await h.setup(); w = new W.Watcher({ token: '123456789:TEST_ONLY_not_a_real_token_000000000', chat: '-100888', key: 'k'.repeat(43), statePath: path.join(dir, 'state.json'), origins: [h.URL_BASE], listen: '127.0.0.1:0', log: () => {} });
    const port = await w.listenNow(), original = w.handle.bind(w); let failPolicy = false, failConfig = false;
    w.handle = async (req, res) => { if (req.method === 'POST' && (failPolicy && req.url === '/v1/policy' || failConfig && req.url === '/v1/ki/config')) { res.writeHead(503, { 'Access-Control-Allow-Origin': h.URL_BASE, 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'Teststörung' })); return; } return original(req, res); };
    browser = await h.launch(); const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message)); await ctx.addInitScript(({ port }) => { localStorage.setItem('scalpdesk.svc.v1', JSON.stringify({ url: 'http://127.0.0.1:' + port, key: 'k'.repeat(43), inst: 'test6601' })); }, { port });
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => !!window.__g10 && __g05.svc.pol.conf?.ki);
    await page.click('#ki-signal-tab');
    check('Dienststart: KI AUS, Auswahl noch nicht eingerichtet und Schalter gesperrt', !w.pol.targets.ki.on && await page.isDisabled('#ki-telegram') && /AUS.*bestätigt/.test(await page.textContent('#ki-telegram')));
    await page.evaluate(() => { __g05.state.watch = ['BTC']; const c = __g10.state.cfg; Object.assign(c, { on: false, slippageBps: 0, fundingMode: 'current-rate', anchorPolicy: 'nearest', patternWeight: 0, longOn: false }); });
    failConfig = true; await page.evaluate(() => __g10.serviceConfig());
    check('Konfigurationsfehler: kein erfundener bestätigter Stand, bisherige Auswahl bleibt', w.ki.state.rev === 0 && /Teststörung/.test(await page.textContent('#ki-status')));
    failConfig = false; await page.evaluate(() => __g10.serviceConfig());
    check('Verlorenen/gespeicherten Auftrag wiederholen: Dienst bestätigt dieselben Parameter und Anker', w.ki.state.rev === 1 && w.ki.state.config.config.patternWeight === 0 && await page.evaluate(() => !!__g05.svc.pol.conf.ki.config && !document.getElementById('ki-telegram').disabled));
    check('Bestätigter Dienst nennt korrigiertes Konfluenzmodell explizit', await page.evaluate(() => __g05.svc.pol.conf.ki.modelVersion === 'cf-2'));
    await page.evaluate(() => { __g05.svc.pol.conf.ki.modelVersion = 'cf-1'; }); const oldRevision = w.ki.state.rev;
    await page.evaluate(() => __g10.serviceConfig());
    check('Altes Dienstmodell erhält keine als korrigiert ausgegebene neue Auswahl', w.ki.state.rev === oldRevision && /auf 2.9.0 aktualisieren/.test(await page.textContent('#ki-status')));
    await page.evaluate(() => __g05.svcRefresh(true));
    await page.click('#ki-telegram'); await page.waitForFunction(() => __g05.svc.pol.conf.targets.ki.on);
    check('Telegram AN erst nach Dienstbestätigung, zweiter Schalter in Einstellungen synchron', w.pol.targets.ki.on && /AN.*bestätigt/.test(await page.textContent('#ki-settings-telegram')));
    failPolicy = true; await page.click('#ki-telegram'); await page.waitForTimeout(300);
    check('Schalterfehler behält bestätigtes AN, Kursalarme und lokale Analyse unverändert', w.pol.targets.ki.on && await page.evaluate(() => __g05.svc.pol.conf.targets.ki.on && __g05.svc.pol.conf.targets['course-alert'].on && !__g10.state.cfg.on));
    failPolicy = false; await page.evaluate(() => __g05.svcRefresh(true)); await page.click('#ki-telegram'); await page.waitForFunction(() => !__g05.svc.pol.conf.targets.ki.on);
    check('KI AUS unabhängig vom Preisalarm, keine Bot-Orderwirkung', !w.pol.targets.ki.on && w.pol.targets['course-alert'].on);
    const card = (await import('../shared/confluence-live.mjs')).evaluateLive(F.liveFixture()).eligible[0]; w.ki.state.cards = [card]; w.ki.state.statistics[card.id] = { asOf: Date.now(), statistics: (await import('../shared/confluence-replay.mjs')).cardHistoricalStats(card, { asOf: Date.now() }) }; w.saveKi(w.ki.state);
    await page.evaluate(() => __g10.serviceCards()); await page.evaluate(() => __g10.serviceCards());
    check('Dienstkarten wiederholt laden: stabile ID einmal, eigener Markt/Modell und ungelesenes Badge', await page.evaluate(id => __g10.state.cards.length === 1 && __g10.state.cards[0].id === id && __g10.state.cards[0].origin === 'dienst', card.id));
    check('Diensthistorie separat übernommen: kein Addieren mit lokalem Originalarchiv', await page.evaluate(() => __g10.state.history.values().next().value.origin === 'dienst') && /Originaldatensatz des 24\/7-Dienstes/.test(await page.textContent('#ki-list')));
    const LC = await import('../shared/confluence-legacy-core.mjs'), LL = await import('../shared/confluence-legacy-live.mjs'), oldInput = F.liveFixture();
    function oldSource(value) { if (!value || typeof value !== 'object') return; for (const [key, child] of Object.entries(value)) { if (key === 'modelVersion' && child === 'cf-2') value[key] = 'cf-1'; else if (key === 'parametersKey') value[key] = LC.parametersKey(oldInput.config); else oldSource(child); } }
    oldSource(oldInput); const oldCard = LL.evaluateLive(oldInput).eligible[0]; w.ki.state.cards.push(oldCard); w.saveKi(w.ki.state);
    await page.evaluate(() => __g10.serviceCards()); await page.evaluate(() => __g10.serviceCards());
    check('Gemischtes Dienstarchiv: cf-1 lesbar, genau einmal und Originalkosten unverändert', await page.evaluate(c => { const old = __g10.state.cards.find(x => x.id === c.id); return __g10.state.cards.length === 2 && old.scope.modelVersion === 'cf-1' && JSON.stringify(old.costs) === JSON.stringify(c.costs) && JSON.stringify(old.score) === JSON.stringify(c.score) && /früheres Modell/.test(document.getElementById('ki-list').textContent); }, oldCard));
    check('Eigene Serverdestination erklärt; keine Telegram-/Bitget-Schlüssel im Auswahlvertrag', /Bot 123456789.*Chat -100888/.test(await page.textContent('#ki-telegram-note')) && !JSON.stringify(w.ki.state.config).includes(w.token));
    await page.reload(); await page.waitForFunction(() => !!window.__g10 && __g05.svc.pol.conf?.ki);
    check('Reload übernimmt bestätigtes AUS und beide Dienstkartenmodelle, ohne automatischen Start', !w.pol.targets.ki.on && await page.evaluate(() => __g10.state.cards.length === 2 && !__g10.state.cfg.on));
    check('390px kein Seitenüberlauf und keine JavaScript-Fehler', !errors.length && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), errors.join('; '));
  } finally { if (browser) await browser.close(); if (w) { w.ki.stop(); clearTimeout(w.saveTimer); w.server.closeAllConnections?.(); await new Promise(resolve => w.server.close(resolve)); } await h.teardown(); fs.rmSync(dir, { recursive: true, force: true }); }
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
