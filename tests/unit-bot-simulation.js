// G12: echte serialisierte Runtime, Save-vor-Bestätigung, IDs/Revisionen, Restore und keine privaten Orders.
let pass = 0, fail = 0; const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
(async () => {
  const R = await import('../shared/bot-simulation.mjs'); let clock = Date.UTC(2026, 9, 7, 12), saved = null, saveOn = true;
  const runtime = new R.BotSimulationRuntime({ now: () => clock, persist: async state => { if (!saveOn) return false; saved = structuredClone(state); return true; } });
  const command = (type, parameters, expectedRevision = runtime.state.revision, commandId = 'sim-' + type + '-' + expectedRevision + '-0001') => ({ type, parameters, expectedRevision, commandId });
  const rejects = async fn => { try { await fn(); return false; } catch { return true; } };
  const settings = { strategy: 'confluence', coins: ['BTCUSDT'], direction: 'both', minimumScore: 70, leverage: 20, maxPositions: 1, cooldownMs: 60000, stopRule: 'signal', tpRule: 'signal', exposureUSDT: '100', riskPercent: '1' };
  const snapshot = (sequence = 0, realized = '0') => ({ runId: 'simulation-test-run', at: clock, sequence, currency: 'USDT', completeNet: true, values: { realized, open: '0', fees: '0', rebates: '0', funding: '0', estimatedCloseFees: '0' } });
  try {
    check('Default deaktiviert, SimulationOnly, privater Adapter dauerhaft gesperrt', !runtime.view().enabled && runtime.view().simulationOnly && !runtime.view().privateAdapterReady);
    check('Keine Credentials im öffentlichen Modell-Command', await rejects(() => runtime.command(command('enable', { enabled: true, secret: 'TEST_ONLY' }))));
    const enable = command('enable', { enabled: true }); await runtime.command(enable); await runtime.command(enable);
    check('Bestätigung erst nach Persistenz; gleiche Command-ID einmal über Restore', runtime.state.revision === 1 && saved.enabled && runtime.state.commands.length === 1 && (await runtime.command(enable)).repeat);
    check('Gleiche ID mit anderem Inhalt abgelehnt', await rejects(() => runtime.command({ ...enable, parameters: { enabled: false } })));
    const start = command('start', { settings, runId: 'simulation-test-run', referenceUSDT: '1000', gain: { enabled: true, amount: '10', action: 'entries' }, loss: { enabled: true, amount: '5', action: 'close' }, snapshot: snapshot() }); await runtime.command(start);
    check('Eigene Strategie/Risiko/Exposition eingefroren, automatisches Trading AUS', runtime.state.settings.exposureUSDT === '100' && runtime.state.run.referenceUSDT === '1000' && !runtime.state.run.automaticTrading && !runtime.view().actions.privateOrders);
    check('Start ohne eigene Risikoeingaben und Demo-Modus gesperrt', await rejects(() => runtime.command(command('start', { ...start.parameters, settings: { ...settings, riskPercent: null } }))) && await rejects(() => runtime.command(command('start', { ...start.parameters, runId: 'demo-test-only', snapshot: { ...snapshot(), runId: 'demo-test-only' }, mode: 'demo' }))));
    const before = runtime.state.revision, two = await Promise.allSettled([runtime.command(command('snapshot', { snapshot: snapshot(1, '10') }, before, 'sim-parallel-0001')), runtime.command(command('snapshot', { snapshot: snapshot(2, '11') }, before, 'sim-parallel-0002'))]);
    check('Zwei Geräte gleichzeitig: eine bestätigte Revision, zweiter Auftrag gesperrt', two[0].status === 'fulfilled' && two[1].status === 'rejected' && runtime.state.revision === before + 1 && runtime.state.run.stops.gain);
    await runtime.command(command('snapshot', { snapshot: snapshot(2, '0') })); check('Reload/Kursrückkehr keine Gewinnsperre lösen', !runtime.view().actions.entries && runtime.state.run.stops.gain);
    const restore = new R.BotSimulationRuntime({ saved, now: () => clock, persist: async state => { saved = structuredClone(state); return true; } });
    check('Gesicherte Runtime erhält Sperren/Commands/Modell, kein Auto-Start', restore.state.run.stops.gain && !restore.view().actions.entries && !restore.state.run.automaticTrading); restore.stop();
    saveOn = false; const previous = JSON.stringify(runtime.state); check('Savefehler behält bestätigten Stand, keine stille Freigabe', await rejects(() => runtime.command(command('pause', {}))) && JSON.stringify(runtime.state) === previous); saveOn = true;
    const inventory = { complete: true, at: clock, positionAt: clock, context: { venue: 'simulation', account: 'paper', mode: 'one-way', marginMode: 'cross', quantityUnit: 'contracts', product: 'USDT-FUTURES' }, positionRevision: 1, fillRevision: 1, fills: [], positions: [{ instrument: 'BTCUSDT', leg: 'long', totalQuantity: '0.001' }] };
    await runtime.command(command('inventory', { snapshot: inventory })); check('Bestandsabweichung sichtbar, Limits bleiben verriegelt', runtime.view().actions.label.includes('Bestandsprüfung') && runtime.state.run.stops.gain && !runtime.view().actions.newCloses);
    clock += 10000; await runtime.clock(); check('Persistente Uhr verriegelt genau ab zehn Sekunden ohne neue Nachricht', saved.run.state === 'PAUSED_RECONCILIATION_REQUIRED' && runtime.view().actions.label.includes('Bot pausiert'));
    const closed = command('close', {}); check('Schließung während Bestandsstörung hart gesperrt', await rejects(() => runtime.command(closed)));
    await runtime.command(command('pause', {})); check('Pause verändert weder eigene Historie noch liegende Schutzwirkung', !runtime.state.enabled && runtime.view().actions.keepExistingProtection && runtime.state.run.state === 'PAUSED_RECONCILIATION_REQUIRED');
    const bad = structuredClone(saved); bad.version = 'unbekannt'; check('Unbekannte Modellversion nicht still mit neuen Regeln migrieren', (() => { try { new R.BotSimulationRuntime({ saved: bad }); return false; } catch { return true; } })());
    const all = structuredClone(saved); all.commands = Array.from({ length: 500 }, (_, i) => ({ id: 'old-' + i })); const full = new R.BotSimulationRuntime({ saved: all }); check('Protokollgrenze erhält alle bisherigen Aufträge/Stopps', await rejects(() => full.command({ commandId: 'sim-full-0001', expectedRevision: all.revision, type: 'enable', parameters: { enabled: true } })) && full.state.commands.length === 500 && full.state.run.stops.gain); full.stop();
  } finally { runtime.stop(); }
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
