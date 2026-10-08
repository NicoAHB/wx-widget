// KI-Prüfung: derselbe echte Ausstieg in Filter/Live/Dienst/Replay; alte Modelle bleiben original.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
const near = (a, b) => Number.isFinite(a) && Math.abs(a - b) < 1e-9, clone = x => structuredClone(x);
(async () => {
  const C = await import('../shared/confluence-core.mjs'), L = await import('../shared/confluence-live.mjs'), R = await import('../shared/confluence-replay.mjs');
  const LC = await import('../shared/confluence-legacy-core.mjs'), LL = await import('../shared/confluence-legacy-live.mjs'), LR = await import('../shared/confluence-legacy-replay.mjs');
  const { liveFixture } = await import('./fixtures/confluence-live.mjs'), { replayFixture, HOUR } = await import('./fixtures/confluence-replay.mjs');
  const { ConfluenceService, kiMessage } = await import('../shared/confluence-service.mjs'), { loadHistoryJob } = await import('../shared/confluence-history.mjs');
  const { validateModelArchive } = await import('../shared/model-archive.mjs'), { selection } = await import('./fixtures/bitget.mjs');
  check('Korrigiertes Kostenmodell mit eigener Kern-/Live-/Replayversion', C.MODEL_VERSION === 'cf-2' && L.LIVE_VERSION === 'cf-live-2' && R.REPLAY_VERSION === 'cf-replay-2');
  for (const part of ['core', 'live', 'replay']) {
    const published = fs.readFileSync(path.join(__dirname, `../bundles/3.51.0/shared/confluence-${part}.mjs`), 'utf8');
    const frozen = fs.readFileSync(path.join(__dirname, `../shared/confluence-legacy-${part}.mjs`), 'utf8').replaceAll('./confluence-legacy-core.mjs', './confluence-core.mjs').replaceAll('./confluence-legacy-live.mjs', './confluence-live.mjs').replaceAll('./confluence-legacy-indicators.mjs', './indicators.mjs').replaceAll('./confluence-legacy-pattern-score.mjs', './pattern-score.mjs');
    check(`Altkern ${part} exakt wie veröffentlichte 3.51.0, nur Importadressen angepasst`, frozen === published);
  }
  for (const part of ['indicators', 'pattern-score']) check(`Altes Hilfsmodul ${part} vollständig von künftigen Kernänderungen getrennt`, fs.readFileSync(path.join(__dirname, `../shared/confluence-legacy-${part}.mjs`)).equals(fs.readFileSync(path.join(__dirname, `../bundles/3.51.0/shared/${part}.mjs`))));
  const narrow = liveFixture(); narrow.data.base.price = 100.1; narrow.data.base.ema50 = 100; narrow.data.base.atr = .6; narrow.data.base.zones = [];
  narrow.data.contract.tickSize = .01; narrow.quote.ask = 99.9; narrow.quote.bid = 99.89;
  for (const source of [narrow.data.scope, narrow.data.base.source, narrow.data.context.source, narrow.data.funding.source, ...Object.values(narrow.saved.series).map(s => s.source)]) source.slippageBps = 10;
  const oldInput = clone(narrow);
  function oldSource(value) { if (!value || typeof value !== 'object') return; for (const [key, child] of Object.entries(value)) {
    if (key === 'modelVersion' && child === C.MODEL_VERSION) value[key] = LC.MODEL_VERSION;
    else if (key === 'parametersKey') value[key] = LC.parametersKey(oldInput.config);
    else oldSource(child);
  } }
  oldSource(oldInput);
  const oldLive = LL.evaluateLive(oldInput), legacyCard = oldLive.cards[0], current = L.evaluateLive(narrow), card = current.cards[0];
  check('Audit-Gegenbeleg: Original cf-1 bleibt 95 Punkte, 1,57 Netto-R:R und freigegeben', legacyCard.eligible && legacyCard.score.score === 95 && near(legacyCard.costs.netRR, 1.5712448192082489));
  check('Korrektur cf-2: gleicher Score/Plan, 1,24 Netto-R:R und gesperrt', !card.eligible && card.score.score === 95 && near(card.costs.netRR, 1.2373600950415806) && card.levels.entry === 100 && near(card.levels.sl, 99.4) && near(card.levels.tp, 101.2));
  check('TP/SL-Ausführung samt Gebühren sichtbar an Kostenszenario gebunden', near(card.costs.execution.tp, 101.09) && near(card.costs.execution.sl, 99.3) && near(card.costs.tp.net, .989455) && near(card.costs.sl.net, -.79965) && card.costs.execution.slippageBps === 10);
  check('Original und Korrektur tragen getrennte Signal-/Parameter-IDs', legacyCard.id !== card.id && legacyCard.score.parametersKey !== card.score.parametersKey);
  const f = liveFixture(), at = f.data.scope.asOf, exitAt = at + HOUR;
  for (const direction of [1, -1]) for (const slip of [0, 10]) for (const rate of [-.001, 0, .001]) {
    const levels = C.tradeLevels({ entry: 100, anchor: direction === 1 ? 99 : 101, atr: 1, direction, tickSize: .01 }, f.config);
    const funding = { kind: 'scenario', complete: true, from: at, to: exitAt, events: [{ at, rate, markPrice: 100 }] };
    const costs = C.costFilter({ levels, direction, entryAt: at, tpAt: exitAt, slAt: exitAt, fundingTP: funding, fundingSL: funding, slippageBps: slip }, f.config);
    const outcomes = ['tp', 'sl'].map(outcome => { const raw = levels[outcome], row = { time: at, end: exitAt, knownAt: exitAt, open: 100, high: direction === 1 ? outcome === 'tp' ? raw : 101 : outcome === 'sl' ? raw : 101,
      low: direction === 1 ? outcome === 'sl' ? raw : 99 : outcome === 'tp' ? raw : 99, close: 100 };
      const sim = R.simulateTrade({ rows: [row], levels, direction, entryAt: at, maxHoldMs: HOUR, asOf: exitAt, slippageBps: slip });
      const pnl = C.netPnl({ direction, quantity: 1, entry: levels.entry, exit: sim.exit, entryAt: at, exitAt: sim.resolvedAt, funding }, f.config);
      return sim.outcome === outcome && near(sim.exit, costs.execution[outcome]) && near(pnl.net, costs[outcome].net);
    });
    check(`${direction === 1 ? 'Long' : 'Short'}, ${slip} bp, Funding ${rate}: Filter = tatsächlicher TP-/SL-Simulator`, outcomes.every(Boolean));
  }
  check('Ungültige Slippage und Tickgröße sperren statt kostenlos zu rechnen', [-1, 10000, NaN, null].every(s => C.executionExitPrice(100, 1, s, .01) === null) && C.executionExitPrice(100, 1, 0, 0) === null);
  check('Tickgrenze bei null Slippage stabil, Bruchteile stets ungünstig', near(C.executionExitPrice(100.1, 1, 0, .1), 100.1) && near(C.executionExitPrice(100.15, 1, 0, .1), 100.1) && near(C.executionExitPrice(100.15, -1, 0, .1), 100.2));
  check('Ungültige Ausstiegsannahme lässt Kostenprüfung nicht durch', !C.costFilter({ levels: card.levels, direction: 1, slippageBps: -1 }, f.config).passed);
  const normal = L.evaluateLive(f).cards[0], before = JSON.stringify(f);
  const forged = clone(normal.costs); forged.execution.slippageBps = 10;
  check('Freigabe sperrt Ausstiegsmodell mit abweichender Slippage', !C.signalDecision({ signal: normal.score, levels: normal.levels, costs: forged }, f.config).eligible);
  check('Zu alter Referenzkurs auch bei verspätetem Planungsschritt gesperrt', !L.evaluateLive({ ...f, planningAt: f.quote.at + 30001 }).eligible.length);
  check('Referenzalter exakt 30 Sekunden erlaubt, danach nicht', L.evaluateLive({ ...f, planningAt: f.quote.at + 30000 }).eligible.length === 1);
  check('Berechnung verändert Fach-Snapshot, Originalquote und Einstellungen nicht', before === JSON.stringify(f));
  const rf = replayFixture(), observation = LR.captureObservation(oldLive, oldInput.config, oldInput.options), original = JSON.stringify(observation);
  const archive = R.mergeObservations([observation], [rf.observation, clone(observation)]);
  check('Archive beider Modelle zusammenführbar, Dubletten zählen einmal, Originale bytegleich', archive.length === 2 && JSON.stringify(archive.find(o => o.version === LR.REPLAY_VERSION)) === original);
  check('Native Originalsicherung akzeptiert beide Modelle ohne Migration', validateModelArchive({ app: 'scalpdesk-model-archive', version: 1, exportedAt: at, observations: archive, po3Journal: [], bot: null }).observations.length === 2);
  const oldReplay = R.replayObservation(observation, { ...rf, threshold: 70 }), exactReplay = LR.replayObservation(observation, { ...rf, threshold: 70 });
  check('Alte Beobachtung wird exakt mit veröffentlichtem Kern nachbewertet', JSON.stringify(oldReplay) === JSON.stringify(exactReplay) && JSON.stringify(observation) === original);
  const tightRows = clone(rf.rows); tightRows[0].open = 99.9; tightRows[0].high = 102; tightRows[0].low = 99.8;
  const correctedObservation = R.captureObservation(current, narrow.config, narrow.options);
  check('Replay-Auswahl verwendet ebenfalls korrigierte Ausstiegskosten: cf-1 besteht, cf-2 sperrt', R.replayObservation(observation, { ...rf, rows: tightRows, threshold: 70 }).cases.length === 1 && R.replayObservation(correctedObservation, { ...rf, rows: tightRows, threshold: 70 }).cases.length === 0);
  check('Alte Kohorte bleibt vom cf-2-Datensatz getrennt', JSON.stringify(R.cardHistoricalStats(legacyCard, { observations: archive, cases: oldReplay.cases, asOf: rf.asOf })) === JSON.stringify(LR.cardHistoricalStats(legacyCard, { observations: archive, cases: oldReplay.cases, asOf: rf.asOf })));
  const damaged = clone(observation); damaged.data.scope.modelVersion = 'cf-2';
  try { R.mergeObservations([], [damaged]); check('Falsche Kern-/Replaykombination wird zurückgewiesen', false); } catch { check('Falsche Kern-/Replaykombination wird zurückgewiesen', true); }
  const savedJob = { version: LR.REPLAY_VERSION, id: observation.key, instrument: 'BTCUSDT', asOf: rf.asOf, from: at, to: rf.asOf, stage: 'prices', cursor: at, rows: [], marks: [], events: [], pageNo: 1 };
  const client = { range: async () => ({ rows: [], nextFrom: rf.asOf, complete: true }) };
  const resumed = await loadHistoryJob({ client, instrument: 'BTCUSDT', key: observation.key, observations: [observation], asOf: rf.asOf, saved: savedJob });
  check('Unterbrochener alter Historienjob setzt Originalgrenze/Version fort', resumed.saved.version === LR.REPLAY_VERSION && resumed.saved.stage === 'marks' && resumed.saved.asOf === savedJob.asOf);
  const crossed = { ...savedJob, id: rf.observation.key };
  try { await loadHistoryJob({ client, instrument: 'BTCUSDT', key: rf.observation.key, observations: [rf.observation], asOf: rf.asOf, saved: crossed }); check('Alte Jobversion darf keine neuen Originale auswerten', false); } catch { check('Alte Jobversion darf keine neuen Originale auswerten', true); }
  const saved = { modelVersion: 'cf-1', rev: 3, since: at - HOUR, config: { config: f.config, options: f.options, items: [selection()] }, series: { 'BTCUSDT|short': oldInput.saved }, due: { 'BTCUSDT|short': rf.asOf }, observations: [observation], cards: [legacyCard], last: { 'BTCUSDT|short': at }, statistics: { original: { asOf: at } } }, rawSaved = JSON.stringify(saved);
  let clock = f.planningAt; const sent = [];
  const service = new ConfluenceService({ now: () => clock, saved, client: { load: async req => { check('Dienst erneuert ausschließlich alten Feedcache', req.saved === null); return { ...f, status: 'bereit' }; }, quote: async () => f.quote }, persist: () => true, notify: async c => sent.push(c), policy: () => ({ on: true, since: 0 }) });
  check('Dienstupgrade erhält Originale, Revision, Anker, Quoten und Zustellmerker', JSON.stringify(service.state.cards) === JSON.stringify(saved.cards) && JSON.stringify(service.state.observations) === JSON.stringify(saved.observations) && service.state.rev === saved.rev && JSON.stringify(service.state.statistics) === JSON.stringify(saved.statistics) && JSON.stringify(service.state.last) === JSON.stringify(saved.last) && rawSaved === JSON.stringify(saved));
  await service.scan();
  check('Dienst nutzt cf-2 für neue Karten und versendet bestätigte alte Kerzen nicht erneut', service.state.modelVersion === C.MODEL_VERSION && service.state.cards.some(c => c.scope.modelVersion === C.MODEL_VERSION) && service.state.cards.some(c => c.scope.modelVersion === LC.MODEL_VERSION) && !sent.length);
  clock += HOUR;
  const restart = new ConfluenceService({ now: () => clock, saved: service.state });
  check('Nächster Neustart erhält cf-2-Fortschritt und setzt Aktivierung nicht erneut zurück', restart.state.since === service.state.since && JSON.stringify(restart.state.series) === JSON.stringify(service.state.series));
  check('Alte Karte niemals als korrigiertes neues Modell weiterleiten', !await service.send(legacyCard));
  check('Dienststatus benennt verwendetes Kostenmodell ohne Zugangsdaten', service.view().modelVersion === C.MODEL_VERSION);
  const W = await import('../server/scalpdesk-247.mjs'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ki-cost-upgrade-')), delivered = [], watchers = [];
  try {
    const make = () => { const w = new W.Watcher({ token: '123456789:TEST_ONLY_not_a_real_token_000000000', chat: '-100888', key: 'k'.repeat(43), statePath: path.join(dir, 'state.json'), now: () => f.planningAt, log: () => {} }); watchers.push(w); w.tg = async (_, body) => { delivered.push(body.text); return { message_id: delivered.length }; }; return w; };
    const w = make(); w.pol.targets.ki.on = true; w.ki.state = clone(saved); delete w.ki.state.modelVersion; w.saveKi(w.ki.state); // tatsächlicher 2.8-Zustand ohne neuen Modellmarker
    const ev = 'ki:' + crypto.createHash('sha256').update(legacyCard.id).digest('hex'); w.reserveOwn(ev, 'ALTE_KI', 'ki');
    w.out = [{ id: 'alt-ki', target: 'ki', epoch: w.pol.targets.ki.epoch, kiRev: saved.rev, at: f.planningAt, next: 0, text: 'ALTE_KI', tz: 'UTC', ev },
      { id: 'kurs', target: 'course-alert', epoch: w.pol.targets['course-alert'].epoch, at: f.planningAt, next: 0, text: 'KURSALARM', tz: 'UTC' }]; w.saveStateNow(); clearTimeout(w.saveTimer);
    const upgraded = make(); await upgraded.deliver();
    check('Tatsächlicher Dienst verwirft noch wartende cf-1-Meldung, Kursalarm wird zugestellt', delivered.length === 1 && delivered[0].startsWith('KURSALARM') && upgraded.evs[ev].st === 'discarded' && !upgraded.out.length);
    check('Verworfene alte Meldung löscht weder Signalplan noch Beobachtung', JSON.stringify(upgraded.ki.state.cards[0]) === JSON.stringify(legacyCard) && JSON.stringify(upgraded.ki.state.observations[0]) === original);
  } finally { for (const w of watchers) { w.ki.stop(); w.po3.stop(); w.stopped = true; clearTimeout(w.saveTimer); } fs.rmSync(dir, { recursive: true, force: true }); }
  const message = kiMessage(normal, R.cardHistoricalStats(normal, { asOf: at }));
  check('Diensttext nennt Netto-R:R, Gebühren und Slippage auf beiden Seiten', /Netto-R:R/.test(message) && /je Ein-\/Ausstieg mit Tickraster/.test(message) && /Modell cf-2/.test(message));
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
