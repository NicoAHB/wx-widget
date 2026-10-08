// Risiko/Ausführbarkeit: tatsächlicher Worker, öffentliche Abrufe, eigene Budgets, spätere Originalfälle.
const h = require('./harness'); let pass = 0, fail = 0;
const check = (name, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${info ? ' — ' + JSON.stringify(info) : ''}`); };
(async () => { let browser;
 try {
  const F = await import('./fixtures/confluence-live.mjs'); await h.setup(); browser = await h.launch(); const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } }), page = await ctx.newPage(), errors = [], requests = []; page.on('pageerror', e => errors.push(e.message)); const origin = Date.now(); let quoteFail = false, far = false;
  await ctx.route('https://api.bitget.com/**', async route => { const req = route.request(), url = new URL(req.url()); requests.push({ url: req.url(), method: req.method(), headers: req.headers() });
   if (quoteFail && url.pathname.endsWith('/ticker')) return route.abort(); const body = F.liveBitgetResponse(req.url(), Date.now(), origin);
   if (far && url.pathname.endsWith('/ticker')) { body.data[0].askPr = '1000'; body.data[0].bidPr = '999.9'; }
   await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => !!window.__g10 && !__g10.state.busy); await page.click('#ki-signal-tab');
  check('Eigenes Verlustbudget zunächst leer und keine Börsenabfrage durch Öffnen', !requests.length && await page.inputValue('#ki-loss-budget') === '');
  await page.evaluate(() => { __g05.state.watch = ['BTC']; __g05.state.fxMode = 'manual'; const input = document.getElementById('fx'); input.disabled = false; input.value = '1.1'; });
  await page.fill('#ki-slippageBps', '0'); await page.fill('#ki-marginEUR', '10'); await page.selectOption('#ki-fundingMode', 'current-rate'); await page.selectOption('#ki-anchorPolicy', 'nearest'); await page.fill('#ki-patternWeight', '0'); await page.uncheck('#ki-longOn'); await page.click('#ki-save');
  await page.waitForFunction(() => __g10.state.cards.length === 1 && !__g10.state.busy);
  const original = await page.evaluate(() => JSON.stringify(__g10.state.cards[0]));
  check('Stopverlust, Margin und Positionswert direkt sichtbar ohne Details', await page.locator('#ki-list .ki-risk-summary').evaluate(n => /Modellverlust.*USDT.*EUR.*Margin.*Positionswert/.test(n.textContent) && !n.closest('details')));
  await page.evaluate(() => { document.getElementById('ki-setup').open = true; document.getElementById('ki-loss-budget').closest('details').open = true; }); await page.fill('#ki-loss-budget', '1'); await page.click('#ki-risk-save');
  check('Eigenes Budget separat gespeichert, Originalmodell und Plan unverändert', await page.evaluate(raw => __g10.state.risk.budgetEUR === 1 && JSON.stringify(__g10.state.cards[0]) === raw && __g05.backupPayload().prefs['scalpdesk.ki.risk-view.v1'].budgetEUR === 1, original));
  await page.locator('#ki-list [data-ki-execution]').click(); await page.waitForFunction(() => [...__g10.state.executions.values()].some(x => x.execution) && !__g10.state.busy);
  const result = await page.evaluate(() => __g10.state.executions.values().next().value.execution);
  check('Echter Worker prüft Bitget-Kurs, Funding und aktuelles Kontraktraster', result.quote.venue === 'bitget' && result.contract.instrument === 'BTCUSDT' && result.costs.execution.slippageBps === 0 && result.size.status === 'bereit', result);
  check('Mengenraster/Mindestwert und eigenes Budget respektiert', result.size.lossEUR <= 1 && result.size.quantity >= result.contract.minQuantity && result.size.notionalUSDT >= result.contract.minNotional);
  check('Quelle, Spread, Kursabstand und Umfang der Momentaufnahme sichtbar', /Bitget.*Geld.*Brief.*Spread.*Abstand.*Zwischenzeitliche Berührungen.*nicht geprüft/.test(await page.textContent('#ki-list')));
  check('Keine Score-/Originalüberschreibung durch aktuelle Größe', await page.evaluate(raw => JSON.stringify(__g10.state.cards[0]) === raw, original));
  await page.evaluate(() => { const item = __g10.state.executions.values().next().value; item.execution.quote.at = Date.now() - 30001; __g10.render(); });
  check('Veraltete Ausführungsprüfung gekennzeichnet ohne grüne Freigabe', /Kursprüfung veraltet/.test(await page.textContent('#ki-list')));
  far = true; await page.locator('#ki-list [data-ki-execution]').click(); await page.waitForFunction(() => !__g10.state.busy && __g10.state.executions.values().next().value.execution?.quote.ask === 1000);
  check('Originalziel aktuell überschritten: Sperrgrund statt neuer positiver Planung', /Ursprüngliches Ziel.*bereits erreicht/.test(await page.textContent('#ki-list'))); far = false;
  quoteFail = true; await page.locator('#ki-list [data-ki-execution]').click(); await page.waitForFunction(() => !__g10.state.busy && !!__g10.state.executions.values().next().value.error);
  check('Tickerfehler deutsch, Original bleibt erhalten', /Bitget-Netzwerkzugriff.*Gespeicherter Plan unverändert/.test(await page.textContent('#ki-list')) && await page.evaluate(raw => JSON.stringify(__g10.state.cards[0]) === raw, original)); quoteFail = false;
  const before = requests.length; await page.fill('#ki-forward-from', '2026-01-01T00:00'); await page.click('#ki-risk-save');
  await page.evaluate(async () => { const R = await import('/shared/confluence-replay.mjs'), S = await import('/shared/confluence-replay-store.mjs'), card = __g10.state.cards[0], key = R.observationKey(card.scope, card.config, card.options), start = Date.UTC(2026, 0, 1);
   const cases = Array.from({ length: 30 }, (_, i) => ({ id: 'm73-sim-' + i, observationKey: key, threshold: card.config.minimumScore, decisionAt: start + i * 60000, entryAt: start + i * 60000 + 1, maxHoldMs: 3600000, resolvedAt: start + (i + 1) * 60000, outcome: i % 2 ? 'tp' : 'sl', costsComplete: true, costKind: 'history', netR: i % 2 ? 1 : -1 }));
   cases.push({ ...cases[0], id: 'm73-other-model', observationKey: 'anderes Modell', netR: 100 }); await S.saveReplay('jobs', { id: key, asOf: Date.now(), cases });
  });
  await page.locator('#ki-list .ki-card-details > summary').click(); await page.locator('#ki-list details').filter({ has: page.locator('summary', { hasText: 'Netto-Verteilung und getrennte Vorwärtsprüfung' }) }).last().locator('summary').first().click();
  await page.locator('#ki-list button').filter({ hasText: 'Gewähltes Vorwärtsfenster auswerten' }).click(); await page.waitForFunction(() => !__g10.state.busy && !!__g10.state.evidence.values().next().value.value);
  const evidence = await page.evaluate(() => __g10.state.evidence.values().next().value.value);
  check('Vorwärtsfenster wertet Originalfälle im Worker aus, kein neuer Marktfeed', requests.length === before && evidence.complete === 30 && evidence.meanR === 0 && evidence.netPositivePercent === 50);
  check('Hypothetische Nettoverteilung getrennt von tatsächlichen Trades', /Hypothetische Originalreplays.*keine tatsächlichen Börsenfills.*Ø Netto.*Median.*Perzentil.*TP-Quote ist etwas anderes/s.test(await page.textContent('#ki-list')));
  check('Füllstand von Karten und Originalarchiv sichtbar', /Signalkarten 1 \/ 200.*Originalarchiv 1 \/ 5000/.test(await page.textContent('#ki-storage-usage')));
  for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); check(`${width}px: Risiko-/Ausführungsinfos ohne Seitenüberlauf`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
  await page.click('#ki-stop'); await page.reload(); await page.waitForFunction(() => !!window.__g10 && !__g10.state.busy);
  check('Neustart erhält Budget/Prüfzeitpunkt und keine alte aktuelle Kursprüfung', await page.evaluate(() => __g10.state.risk.budgetEUR === 1 && __g10.state.risk.forwardFrom === '2026-01-01T00:00' && !__g10.state.executions.size && !__g10.state.evidence.size));
  check('Ausschließlich öffentliche Markt-GETs ohne Orders/Kontozugang', requests.every(x => x.method === 'GET' && new URL(x.url).pathname.startsWith('/api/v2/mix/market/') && !x.headers.authorization && !x.headers['access-key']) && await page.evaluate(() => !__g05.state.positions.length && !__g05.state.demoPositions.length));
  check('Keine JavaScript-Fehler', !errors.length, errors.join('; ')); await ctx.close();
 } finally { await browser?.close(); await h.teardown(); }
 console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
