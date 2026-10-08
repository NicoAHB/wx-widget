// G11: gemeinsame öffentliche Laufzeit, haltbare Stufensperren und echter Oracle-Zustand.
const fs = require('fs'), os = require('os'), path = require('path'); let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
const throws = fn => { try { fn(); return false; } catch { return true; } };
(async () => {
  const P = await import('../shared/po3-core.mjs'), S = await import('../shared/po3-service.mjs'), F = await import('./fixtures/bitget.mjs'), B = await import('../shared/bitget-public.mjs'), Sim = await import('../shared/po3-simulator.mjs'), W = await import('../server/scalpdesk-247.mjs');
  const M = 60000; let clock = F.NOW, saved = null, sends = [], calls = [], allowSave = true;
  const config = { on: true, config: P.po3Settings({ bias: '1m', setup: '1m', entry: '1m', closure: 'tp1' }), windowMode: '1h', custom: {}, instruments: ['BTCUSDT'], selected: ['1m'], singleFvg: true, sizing: { balanceUSDT: null, riskPercent: null, leverage: 20 } };
  const client = B.createBitgetPublicClient({ now: () => clock, spacingMs: 0, fetch: async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify(F.responseBody(url, clock)), { status: 200, headers: { 'content-type': 'application/json' } }); } });
  const policy = { on: false, epoch: 1, since: clock - 4 * M };
  const make = original => new S.Po3Service({ client, now: () => clock, saved: original, policy: () => policy, persist: x => { if (!allowSave) return false; saved = structuredClone(x); return true; }, notify: async a => sends.push(a) });
  const svc = make(); check('Default: keine Auswahl, keine Abrufe/Meldungen/Orders', svc.state.config === null && !calls.length && !sends.length);
  check('Überlappung mindestens zwei aktive verschiedene Ebenen; Einzelfall ausdrücklich wählbar', throws(() => S.po3ServiceSelection({ ...config, singleFvg: false })) && throws(() => S.po3ServiceSelection({ ...config, selected: ['1h'] })) && S.po3ServiceSelection(config).singleFvg);
  svc.configure(config); await svc.scan(); clock += 3000; await svc.scan();
  check('Dienst verwendet echte öffentliche GET-Warteschlange und begrenzte Phasen', calls.length >= 4 && calls.every(c => c.options.method === 'GET' && new URL(c.url).pathname.startsWith('/api/v2/mix/market/')) && svc.state.streams.BTCUSDT.series['1m'].indicator.count >= 300);
  check('KI-Versand AUS: Analyse/Persistenz laufen, Meldung bleibt aus', !!saved.streams.BTCUSDT && !sends.length && !svc.state.error);
  if (svc.state.error) console.log('Fehler aus tatsächlichem Dienst:', svc.state.error);
  const stream = svc.state.streams.BTCUSDT, at = Math.floor(clock / M) * M, row = { time: at - M, end: at, knownAt: at, open: 100, high: 102, low: 99.5, close: 100, volume: 100 };
  const zone = { id: 'fixture-confirmed-zone', timeframe: '1m', direction: 1, low: 99, high: 101, confirmedAt: at - 2 * M, from: at - 4 * M, to: at - 2 * M, atr: 2, alarmEligible: true, filledAt: null };
  stream.zones = [zone]; stream.series['1m'].rows = [row]; stream.series['1m'].values = [{ atr: 2 }]; policy.on = true;
  let result = { stream, complete: true, journal: [], created: [] }; await svc.sendCandidates(result, 'BTCUSDT', config, svc.state.revision); await svc.sendCandidates(result, 'BTCUSDT', config, svc.state.revision);
  check('Stufe 1 einmal pro Zone/Stufe/Chat-Epoche und dauerhaft vor Versand gespeichert', sends.length === 1 && sends[0].stage === 1 && Object.keys(saved.alerts).length === 1);
  const score = P.po3Score({ direction: 1, sweep: true, retest: true, bias: 1, impulse: true }, config.config), record = Sim.po3Signal({ instrument: 'BTCUSDT', confirmedAt: at, score, levels: { status: 'bereit', direction: 1, entry: 100, sl: 98, tps: [104, 105, 106], risk: 2, rewardRisk: 2 },
    sweep: { time: at - M, extreme: 98 }, setupSweep: { time: at - 3 * M, extreme: 97 }, box: { high: 105, low: 98, height: 7 }, zone, source: { dataRevision: 'bitget-v1', venue: 'bitget', product: 'USDT-FUTURES', origin: 'dienst-beobachtet' } }, config.config);
  result = { ...result, journal: [record], created: [record.id] }; await svc.sendCandidates(result, 'BTCUSDT', config, svc.state.revision);
  check('Stufe 2 trotz Stufe-1-Cooldown mit Levels, danach einmal', sends.length === 2 && sends[1].stage === 2 && sends[1].levels.sl === 98); await svc.sendCandidates(result, 'BTCUSDT', config, svc.state.revision); check('Stufe 2 wiederholt nicht', sends.length === 2);
  const restarted = make(saved); await restarted.sendCandidates(result, 'BTCUSDT', config, restarted.state.revision); check('Neustart erhält beide Stufensperren, keine doppelte Nachricht', sends.length === 2);
  policy.on = false; policy.epoch++; await svc.sendCandidates(result, 'BTCUSDT', config, svc.state.revision); check('KI AUS unterdrückt beide PO3-Stufen', sends.length === 2);
  policy.on = true; policy.since = clock + M; policy.epoch++; await svc.sendCandidates(result, 'BTCUSDT', config, svc.state.revision); check('AN gibt keine alte Kerze rückwirkend frei', sends.length === 2);
  policy.since = clock - 4 * M; stream.zones = [{ ...zone, filledAt: at }]; await svc.sendCandidates(result, 'BTCUSDT', config, svc.state.revision); check('Gefüllte Alarmzone nicht durch Setup-Original wieder aktivieren', sends.length === 2);
  stream.zones = [{ ...zone, id: 'new-zone' }]; allowSave = false; let failed = false; try { await svc.sendCandidates({ ...result, created: [] }, 'BTCUSDT', config, svc.state.revision); } catch { failed = true; }
  check('Nicht gespeicherte Stufensperre sendet nichts und rollt zurück', failed && sends.length === 2 && !svc.state.alerts[JSON.stringify(['new-zone', 1, policy.epoch])]); allowSave = true;
  check('Nachricht deutsch, eigener PO3-Score/Preisplan, keine Order und vor Funding', /Entrybestätigung.*BTCUSDT/s.test(S.po3Message(sends[1])) && /TP1.*TP2.*TP3/s.test(S.po3Message(sends[1])) && /vor Funding.*Cross unbekannt/.test(S.po3Message(sends[1])));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'po3-service-')); let watcher;
  try {
    const opts = { token: '123456789:TEST_ONLY_NOT_A_REAL_TOKEN_000000000', chat: '-100777', key: 'k'.repeat(43), statePath: path.join(dir, 'state.json'), now: () => clock, kiClient: client, log: () => {} };
    watcher = new W.Watcher(opts); const cmd = { commandId: 'po3-test-0001', expectedRevision: 0, config };
    check('Oracle und Konfluenz teilen denselben Client, PO3 standardmäßig AUS', watcher.po3.client === watcher.ki.client && watcher.po3.state.config === null && !watcher.pol.targets.ki.on);
    const answer = watcher.applyPo3Config(cmd), repeat = watcher.applyPo3Config(cmd), stale = watcher.applyPo3Config({ ...cmd, commandId: 'po3-test-0002' });
    check('Serverbestätigte Auswahl: eigene Revision, Auftragswiederholung idempotent, veralteter Auftrag 409', answer.status === 200 && repeat.body.repeat && watcher.po3.state.revision === 1 && stale.status === 409);
    check('Öffentliche PO3-Datei atomar, keine Tokens/privaten Orderdaten gespeichert', fs.existsSync(path.join(dir, 'po3-public.json')) && !fs.readFileSync(path.join(dir, 'po3-public.json'), 'utf8').includes(opts.token));
    watcher.pol.targets.ki = { on: true, epoch: 2, since: clock - M }; let delivered = [];
    watcher.tg = async (method, body) => { delivered.push({ method, body }); return { message_id: 1 }; };
    const alarm = { ...sends[1], revision: 1, epoch: 2, expiresAt: clock + M }; watcher.po3.state.alerts[alarm.id] = alarm; watcher.savePo3(watcher.po3.state); await watcher.notifyPo3(alarm); await watcher.notifyPo3(alarm);
    check('Echter Oracle-Ausgang/Freigabe: PO3 einmal, nur freigegebener Telegram-Sender', delivered.filter(x => x.method === 'sendMessage').length === 1 && watcher.out.length === 0);
    const restored = new W.Watcher(opts); check('Oracle-Neustart erhält Auswahl und Ereignisledger, Preisziele unverändert', restored.po3.state.revision === 1 && restored.pol.targets['course-alert'].on && Object.keys(restored.po3.state.alerts).length === 1); clearTimeout(restored.saveTimer); restored.po3.stop(); restored.ki.stop();
    const snapshot = watcher.stateView(); check('Stateansicht klein: nur PO3-Metadaten, kein kompletter Kerzen-/Journalbestand', !!snapshot.po3 && !snapshot.po3.streams && !JSON.stringify(snapshot).includes(opts.token));
    fs.writeFileSync(path.join(dir, 'po3-public.json'), '{beschädigt'); const broken = new W.Watcher(opts); check('Beschädigte PO3-Datei stoppt nur PO3, Originaldatei und Preisalarme bleiben', broken.po3.stopped && broken.pol.targets['course-alert'].on && fs.readFileSync(path.join(dir, 'po3-public.json'), 'utf8') === '{beschädigt'); clearTimeout(broken.saveTimer); broken.po3.stop(); broken.ki.stop();
  } finally { if (watcher) { clearTimeout(watcher.saveTimer); watcher.po3.stop(); watcher.ki.stop(); } fs.rmSync(dir, { recursive: true, force: true }); }
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
