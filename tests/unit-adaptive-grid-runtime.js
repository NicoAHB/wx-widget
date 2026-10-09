(async () => {
  const { BotSimulationRuntime, botSettings } = await import('../shared/bot-simulation.mjs');
  const { AdaptiveAIGridStrategy, GRID_MODEL_VERSION } = await import('../shared/adaptive-grid.mjs');
  const { validateModelArchive } = await import('../shared/model-archive.mjs');
// Echte Runtime mit eigenen festen öffentlichen Modellinputs; keine Börsenfills.
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); }, copy = x => structuredClone(x);
const rejects = async fn => { try { await fn(); return false; } catch { return true; } };
let clock = Date.UTC(2026, 9, 9, 12, 0, 5), saved, saveOn = true;
const runtime = new BotSimulationRuntime({ now: () => clock, persist: async s => { if (!saveOn) return false; saved = copy(s); return true; } });
const cmd = (type, parameters, id = 'grid-' + type + '-' + runtime.state.revision + '-0001') => ({ type, parameters, commandId: id, expectedRevision: runtime.state.revision });
const grid = { capitalUSDT: '100', lines: 8, makerFeePct: .1, takerFeePct: .1, minimumNetPct: .1, slippageReservePct: .05, fundingReservePct: .05, dumpAction: 'pause' };
const settings = { strategy: 'adaptive-grid', coins: ['BTCUSDT'], direction: 'long', minimumScore: 70, leverage: 3, maxPositions: 1, cooldownMs: 60000, stopRule: 'signal', tpRule: 'signal', exposureUSDT: '100', riskPercent: '1', grid };
const snapshot = { runId: 'grid-runtime-0001', at: clock, sequence: 0, currency: 'USDT', completeNet: true, values: { realized: '0', open: '0', fees: '0', rebates: '0', funding: '0', estimatedCloseFees: '0' } };
try {
  check('Grid-Konfiguration akzeptiert ausschließlich einen Long-Markt', botSettings(settings).strategy === 'adaptive-grid' && await rejects(() => botSettings({ ...settings, direction: 'both' })) && await rejects(() => botSettings({ ...settings, coins: ['BTCUSDT', 'ETHUSDT'] })) && await rejects(() => botSettings({ ...settings, maxPositions: 2 })));
  check('Keine still angenommenen Kapital-/Kostenwerte', await rejects(() => botSettings({ ...settings, grid: { ...grid, capitalUSDT: null } })) && await rejects(() => botSettings({ ...settings, grid: { ...grid, minimumNetPct: 0 } })));
  await runtime.command(cmd('enable', { enabled: true }));
  await runtime.command(cmd('start', { settings, runId: snapshot.runId, referenceUSDT: '1000', gain: { enabled: true, amount: '10', action: 'entries' }, loss: { enabled: true, amount: '5', action: 'close' }, snapshot }));
  const r = runtime.state.run, scope = r.grid.scope, end = Math.floor(clock / 900000) * 900000;
  check('Eigener leerer Long-Modellbestand, keine Orders/Fills/automatische Ausführung', r.grid.inventory.quantity === '0' && r.grid.inventory.source.includes('keine Börsenfills') && !r.automaticTrading && !runtime.view().actions.privateOrders);
  const candles = Array.from({ length: 1344 }, (_, i) => ({ time: end - (1344 - i) * 900000, end: end - (1343 - i) * 900000, knownAt: clock, open: 100, high: 101, low: 99, close: 100, volume: 100 }));
  const range = new AdaptiveAIGridStrategy({ scope, config: grid }).calculate_dynamic_range({ scope, candles, asOf: clock });
  const market = { kind: 'public-grid-model-input', modelVersion: GRID_MODEL_VERSION, scope, range, contract: { ...scope, tickSize: .01, quantityStep: .001, minQuantity: .001, minNotional: 5 }, quote: { ...scope, bid: 99.99, ask: 100.01, at: clock, knownAt: clock }, asOf: clock, coverage: { from: range.historyFrom, to: end, loadedTo: end, candles: 1344, pages: 7 }, privateOrders: false };
  const first = cmd('grid', { market }); await runtime.command(first);
  check('Bestätigter Grid-Plan erst nach Save, Originalrange gespeichert', saved.run.grid.market.range.historyFrom === range.historyFrom && saved.run.grid.plan.orders.length > 1 && runtime.state.revision === 3);
  check('Laufbasis begrenzt gesamtes Grid-Stoprisiko, nominale Exposition ebenso', Number(saved.run.grid.plan.riskUSDT) <= 10 && Number(saved.run.grid.plan.notionalUSDT) <= 100);
  check('Pläne verändern keinen Bestand und kein fiktives Netto', saved.run.grid.inventory.quantity === '0' && saved.run.netUSDT === '0' && saved.run.latest.sequence === 0);
  const old = JSON.stringify(runtime.state); await runtime.command(first);
  check('Identischer Modellauftrag wiederholbar ohne doppelte Absichten/Revision', JSON.stringify(runtime.state) === old && (await runtime.command(first)).repeat);
  check('Gleiche ID mit anderem Markt abgewiesen', await rejects(() => runtime.command({ ...first, parameters: { market: { ...market, asOf: clock - 1 } } })));
  for (const [name, bad] of [['anderer Lauf', { ...market, scope: { ...scope, runId: 'other-run-0001' } }], ['Spot', { ...market, scope: { ...scope, product: 'SPOT' } }], ['andere Quote', { ...market, scope: { ...scope, quote: 'EUR' } }], ['anderer Coin', { ...market, scope: { ...scope, instrument: 'ETHUSDT' } }], ['fehlende Abdeckung', { ...market, coverage: { ...market.coverage, candles: 1343 } }], ['zu viele Seiten', { ...market, coverage: { ...market.coverage, pages: 9 } }], ['zukünftig', { ...market, asOf: clock + 1 }]]) check('Modellauftrag sperrt ' + name, await rejects(() => runtime.command(cmd('grid', { market: bad }))) && JSON.stringify(runtime.state) === old);
  saveOn = false;
  check('Speicherfehler erhält alle bestätigten Pläne/Stops/Revisionen', await rejects(() => runtime.command(cmd('grid', { market }))) && JSON.stringify(runtime.state) === old); saveOn = true;
  const restored = new BotSimulationRuntime({ saved, now: () => clock });
  check('Reload erhält identische Grid-Version/Konfiguration/Absichten', JSON.stringify(restored.state.run.grid) === JSON.stringify(saved.run.grid) && !restored.state.run.automaticTrading); restored.stop();
  for (const [name, change] of [['fehlende Pläne', g => { g.plan.orders = null; }], ['fehlende Marktrange', g => { g.market.range = null; }], ['fingierter Fill', g => { g.plan.orders[0].status = 'filled'; }], ['veränderter Originalstand', g => { g.plan.state = { ...g.plan.state, reason: 'verändert' }; }]]) { const corrupt = copy(saved); change(corrupt.run.grid); check('Reload sperrt ' + name + ' vor UI/Handlungsanzeige', await rejects(() => new BotSimulationRuntime({ saved: corrupt }))); }
  const badSaved = copy(saved); badSaved.run.grid.state.modelVersion = 'unknown';
  check('Beschädigtes Grid-Original nicht still wiederherstellen', await rejects(() => new BotSimulationRuntime({ saved: badSaved })));
  clock += 30001;
  check('Veraltete Prüfung erzeugt keine neue Freigabe', await rejects(() => runtime.command(cmd('grid', { market }))) && JSON.stringify(runtime.state) === old);
  clock = market.asOf;
  await runtime.command(cmd('snapshot', { snapshot: { ...snapshot, sequence: 1, values: { ...snapshot.values, realized: '10' } } }));
  await runtime.command(cmd('grid', { market }));
  check('Bestehende G12-Gewinnsperre stoppt Grid-Einstiege vorrangig', !runtime.view().actions.entries && runtime.state.run.grid.plan.orders.length === 0 && runtime.state.run.grid.plan.keepExistingProtection);
  await runtime.command(cmd('pause', {})); await runtime.command(cmd('grid', { market }));
  check('Deaktivierter Bot erzeugt keine Grid-Einstiege/Schließungen', !runtime.state.enabled && runtime.state.run.grid.plan.action === 'pause' && !runtime.state.run.grid.plan.closeIntent);
  for (const [name, patch] of [['belegtem Long', { quantity: '1', averageEntry: '98' }], ['offenen Grid-Orders', { openOrders: 1, reservedBuyNotional: '20' }]]) {
    const occupied = copy(saved); Object.assign(occupied.run.grid.inventory, patch); const ownRuntime = new BotSimulationRuntime({ saved: occupied, now: () => clock, persist: async () => true });
    const before = JSON.stringify(ownRuntime.state);
    check('Neuer Lauf nicht über ' + name + ' hinweg starten', await rejects(() => ownRuntime.command({ type: 'start', commandId: 'grid-own-start-0001', expectedRevision: occupied.revision, parameters: { settings, runId: 'grid-new-run-0001', referenceUSDT: '1000', snapshot: { ...snapshot, runId: 'grid-new-run-0001' } } })) && JSON.stringify(ownRuntime.state) === before); ownRuntime.stop();
  }
  const archived = validateModelArchive({ kind: 'scalpdesk-bot-simulation', version: 1, simulationOnly: true, state: saved }); check('Echter Archivimport erhält Grid-Original und bleibt deaktiviert', JSON.stringify(archived.bot.run.grid) === JSON.stringify(saved.run.grid) && !archived.bot.enabled); const corrupt = copy(saved); corrupt.run.grid.state.modelVersion = 'broken'; check('Echter Archivimport lehnt beschädigtes Grid vor Änderung ab', await rejects(() => validateModelArchive({ kind: 'scalpdesk-bot-simulation', version: 1, simulationOnly: true, state: corrupt }))); 
  // Derselbe Grid-Kern über den echten lokalen Oracle-HTTP-Vertrag.
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path'), W = await import('../server/scalpdesk-247.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-service-')), serviceKey = 'k'.repeat(43), watchers = [];
  const create = () => { const w = new W.Watcher({ token: '123456789:TEST_ONLY_NOT_A_REAL_TOKEN_000000000', chat: '-100777', key: serviceKey, statePath: path.join(dir, 'state.json'), now: () => clock, listen: '127.0.0.1:0', log: () => {} }); watchers.push(w); return w; };
  try {
    const w = create(), port = await w.listenNow(), url = 'http://127.0.0.1:' + port + '/v1/bot/simulation', headers = { Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' };
    const post = async command => { const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(command) }); return { status: r.status, body: await r.json() }; };
    const command = (type, parameters) => ({ type, parameters, commandId: 'grid-service-' + type + '-' + w.botSimulation.state.revision + '-0001', expectedRevision: w.botSimulation.state.revision });
    const denied = await fetch(url); check('Echter Dienst sperrt anonyme Grid-/Bot-Steuerung', denied.status === 401);
    await post(command('enable', { enabled: true })); const runId = 'grid-service-run-0001';
    const started = await post(command('start', { settings, runId, referenceUSDT: '1000', gain: { enabled: true, amount: '10', action: 'entries' }, loss: { enabled: true, amount: '5', action: 'close' }, snapshot: { ...snapshot, runId, at: clock } }));
    check('Dienst bestätigt denselben Long-Grid-Modellstart erst nach Dateisicherung', started.status === 200 && started.body.bot.run.grid.scope.runId === runId && fs.existsSync(w.botSimulationFile));
    const marketForService = { ...market, scope: { ...market.scope, runId } }, gridCommand = command('grid', { market: marketForService }), result = await post(gridCommand);
    check('Echter HTTP-Grid-Auftrag persistiert Pläne ohne Börsenbestand/Fills', result.status === 200 && result.body.bot.run.grid.plan.orders.length > 1 && result.body.bot.run.grid.inventory.quantity === '0' && !result.body.bot.privateAdapterReady && !result.body.bot.run.automaticTrading);
    const persisted = JSON.parse(fs.readFileSync(w.botSimulationFile, 'utf8'));
    check('Gesicherter Dienststand und HTTP-Antwort haben identische Modellabsichten', JSON.stringify(persisted.run.grid) === JSON.stringify(result.body.bot.run.grid) && !fs.readFileSync(w.botSimulationFile, 'utf8').includes(serviceKey));
    const repeat = await post(gridCommand); check('HTTP-Wiederholung bestätigt dieselbe ID ohne zweite Revision', repeat.status === 200 && repeat.body.bot.repeat && w.botSimulation.state.revision === result.body.bot.revision);
    const corrupt = command('grid', { market: { ...marketForService, scope: { ...marketForService.scope, product: 'SPOT' } } }), beforeBad = JSON.stringify(w.botSimulation.state), bad = await post(corrupt);
    check('Echter Dienst lehnt fremde Marktidentität atomar ab', bad.status === 400 && JSON.stringify(w.botSimulation.state) === beforeBad);
    const restarted = create(); check('Dienst-Neustart erhält Grid-Originale/Commands ohne automatische Orders', JSON.stringify(restarted.botSimulation.state.run.grid) === JSON.stringify(persisted.run.grid) && !restarted.botSimulation.view().privateAdapterReady);
    const inv = { complete: true, at: clock, positionAt: clock, positionRevision: 1, fillRevision: 1, context: { venue: 'simulation', account: 'paper', mode: 'one-way', marginMode: 'cross', quantityUnit: 'contracts', product: 'USDT-FUTURES' }, fills: [], positions: [{ instrument: 'BTCUSDT', leg: 'long', totalQuantity: '1' }] };
    await post(command('inventory', { snapshot: inv })); const conflict = await post(command('grid', { market: marketForService }));
    check('Bestandskonflikt sperrt auch im Dienst Grid-Käufe und neue Schließungen', conflict.status === 200 && conflict.body.bot.run.grid.plan.action === 'pause' && !conflict.body.bot.run.grid.plan.closeIntent && conflict.body.bot.run.grid.plan.orders.length === 0 && !conflict.body.bot.actions.newCloses);
  } finally {
    for (const w of watchers) { w.botSimulation.stop(); w.po3.stop(); w.ki.stop(); clearTimeout(w.saveTimer); if (w.server) { w.server.closeAllConnections?.(); await new Promise(resolve => w.server.close(resolve)); } }
    fs.rmSync(dir, { recursive: true, force: true });
  }

} finally { runtime.stop(); }
console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
