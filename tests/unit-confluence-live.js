// G10(c): Referenzkurs nach Entscheidung, Kostenannahmen, Anker, Größe und Kartenablauf.
const path = require('path'), { pathToFileURL } = require('url');
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const clone = x => structuredClone(x), near = (a, b) => Number.isFinite(a) && Math.abs(a - b) < 1e-8;
(async () => {
  const L = await import(pathToFileURL(path.join(__dirname, '../shared/confluence-live.mjs')));
  const B = await import(pathToFileURL(path.join(__dirname, '../shared/bitget-public.mjs')));
  const { liveFixture } = await import(pathToFileURL(path.join(__dirname, 'fixtures/confluence-live.mjs')));
  const f = liveFixture(), original = JSON.stringify(f), result = L.evaluateLive(f), card = result.cards[0], HOUR = 3600e3;
  check('Anzeige 69,999 bleibt ausdrücklich unter 70; keine scheinbar bestandene Grenzprüfung', L.scoreLabel(69.999) === '< 70' && L.scoreLabel(70) === '70');
  check('Anzeige 49,999 bleibt ausdrücklich unter Beobachten-Grenze 50', L.scoreLabel(49.999) === '< 50' && L.scoreLabel(50) === '50');
  check('Eigener Grenzwert wird ebenfalls nicht durch Rundung erreicht', L.scoreLabel(79.999, 80) === '< 80');
  check('Unbekannte oder ungültige Scores werden nicht zu null Punkten', [null, undefined, NaN, -1, 101].every(v => L.scoreLabel(v) === 'nicht bewertbar'));
  check('Zwei Richtungen getrennt geprüft, ausschließlich Long mit 95 Punkten freigegeben', result.cards.length === 2 && result.eligible.length === 1 && card.score.score === 95 && result.cards[1].score.blocked);
  check('Referenzeinstieg Brief + Tickrundung nach Entscheidung, Stop 1 ATR unter EMA-Anker und mindestens 2R', card.entryAt > card.decisionAt && card.levels.entry === 100.5 && card.anchor.label === 'EMA 50' && card.levels.sl === 95 && card.levels.tp === 111.5 && card.levels.rewardRisk === 2);
  const short = clone(f); short.data.base.ema50 = 101; short.data.base.ema200 = 110; short.data.context.ema50 = 101; short.data.context.ema200 = 110;
  short.data.base.rsiValues = [60, 61, 62, 63, 64, 65, 64, 63, 61, 60]; short.data.base.histogram = [3, 2, 1, 0, -1];
  const shortResult = L.evaluateLive(short), shortCard = shortResult.cards[1];
  check('Short spiegelbildlich: nur Short-Kandidatur mit 95 Punkten, Long hart gesperrt', shortResult.eligible.length === 1 && shortCard.eligible && shortCard.score.score === 95 && shortResult.cards[0].score.blocked);
  check('Short nimmt Geldkurs; Stop über EMA-Anker und TP mindestens 2R darunter', shortCard.levels.entry === 100 && shortCard.levels.sl === 105 && shortCard.levels.tp === 90 && shortCard.levels.rewardRisk === 2);
  check('Short-Kostenszenario prüft positive TP-/negative SL-Nettoergebnisse separat', shortCard.costs.tp.net > 0 && shortCard.costs.sl.net < 0 && shortCard.costs.netRR >= 1.5);
  check('Kostenfilter tatsächlich bestanden, ohne erfundene Eurogröße', card.costs.passed && card.costs.netRR > 1.5 && card.size.status === 'nicht verfügbar' && card.size.quantity === null);
  check('Cross erhält keine Liquidations-/Abstandsfreigabe', card.cross.liquidationPrice === null && card.cross.distance === null && !card.cross.approved);
  check('Beide historischen Fenster sind noch nicht ausgewertet, keine erfundene Quote/Fallzahl', card.statistics.short.status === 'noch nicht ausgewertet' && card.statistics.long.status === 'noch nicht ausgewertet' && !('tpPercent' in card.statistics.short));
  check('Karte bindet Kern, Musteradapter, Kosten-/Ankerpolitik und Revision', card.liveKey.includes('cf-live-1') && card.liveKey.includes('bg-patterns-1') && card.liveKey.includes('current-rate') && card.config.revision === f.config.revision);
  check('Eingabedaten und Einstellungen bleiben unverändert', JSON.stringify(f) === original);
  for (const [name, mutate] of [
    ['vor Entscheidungszeit', q => { q.at = f.data.scope.asOf - 1; }],
    ['Kenntnis liegt in der Zukunft', q => { q.knownAt++; }],
    ['zu spät (über 30 s)', q => { q.at += 31000; q.knownAt += 31000; }],
    ['falsche Börse', q => { q.venue = 'binance'; }],
    ['falscher Coin', q => { q.instrument = 'ETHUSDT'; }],
    ['invertierter Spread', q => { q.bid = 101; }]
  ]) { const bad = clone(f); mutate(bad.quote); check('Kein Referenzkurs: ' + name, !L.evaluateLive(bad).eligible.length); }
  const noQuote = L.evaluateLive({ ...f, quote: null });
  check('Score bleibt verfügbar, aber ohne neuen Kurs keine geprüfte Karte', noQuote.cards[0].score.score === 95 && !noQuote.eligible.length && noQuote.cards[0].levels.status === 'nicht bewertbar');
  const unknown = L.evaluateLive({ ...f, options: { ...f.options, fundingMode: 'unknown' } });
  check('Unbekanntes künftiges Funding: Preisplan/Score bleiben, Nettofilter gibt nicht frei', unknown.cards[0].levels.status === 'bereit' && unknown.cards[0].costs.netRR === null && !unknown.eligible.length);
  check('Ungewählte Stop-Regel gibt keine Karte frei', !L.evaluateLive({ ...f, options: { ...f.options, anchorPolicy: '' } }).eligible.length);
  const slippage = clone(f); slippage.data.scope.slippageBps = .5; for (const frame of [slippage.data.base, slippage.data.context]) frame.source.slippageBps = .5;
  slippage.data.funding.source.slippageBps = .5; for (const series of Object.values(slippage.saved.series)) series.source.slippageBps = .5;
  check('Ungünstige Long-Slippage ist explizit gespeichert und angewandt', L.evaluateLive(slippage).cards[0].levels.entry >= card.levels.entry && L.evaluateLive(slippage).cards[0].scope.slippageBps === .5);
  const sized = L.evaluateLive({ ...f, options: { ...f.options, marginEUR: 100, fx: { value: 1.1, at: f.data.scope.asOf, source: 'Test' } } }).cards[0];
  check('Freier Einsatz wird mit X und Hebel skaliert; Preisplan bleibt unabhängig', near(sized.size.notionalUSDT, 2200) && near(sized.size.quantity, 2200 / 100.5) && sized.levels.entry === card.levels.entry);
  const expensive = clone(f); expensive.config.feeEntry = .1; expensive.config.feeExit = .1;
  check('Fremde/ungeprüfte Kostenrevision verhindert Kandidatur', !L.evaluateLive(expensive).eligible.length);
  const funding = { ...f.data.funding, rate: .001, intervalHours: 2, nextAt: 1000, knownAt: 100 };
  const scenario = L.fundingScenario({ current: funding, entryAt: 500, exitAt: 1000 + 2 * HOUR, entry: 100, mode: 'current-rate' });
  check('Tatsächlicher 2h-Takt, nur Abrechnung innerhalb Haltedauer, Austritt exakt am Termin ausgeschlossen', scenario.events.length === 1 && scenario.events[0].at === 1000 && scenario.events[0].markPrice === 100 && scenario.kind === 'scenario');
  check('Keine Abrechnung vor nächstem Termin wird als null Kosten korrekt modelliert', L.fundingScenario({ current: funding, entryAt: 500, exitAt: 999, entry: 100, mode: 'current-rate' }).events.length === 0);
  check('Abgelaufene aktuelle Rate wird für spätere Einstiege nicht fortgeschrieben', L.fundingScenario({ current: funding, entryAt: 1000, exitAt: 2000, entry: 100, mode: 'current-rate' }) === null);
  check('Fehlender Funding-Takt oder unbekannter Modus wird nicht ersetzt', L.fundingScenario({ current: { ...funding, intervalHours: null }, entryAt: 500, exitAt: 2000, entry: 100, mode: 'current-rate' }) === null && L.fundingScenario({ current: funding, entryAt: 500, exitAt: 2000, entry: 100, mode: 'unknown' }) === null);
  const zones = { ...f.data.base, pivots: [{ type: 'low', price: 98.5, time: 1, knownAt: 10 }, { type: 'low', price: 98, time: 2, knownAt: 10 }],
    zones: [{ price: 98.5, direction: 1, confirmed: true, knownAt: 10 }, { price: 98, direction: 1, confirmed: true, knownAt: 10 }] };
  check('Nächste passende Zone wählt EMA50; jüngste Pivot-Regel wählt den jüngsten Strukturpunkt trotz gleicher Downloadzeit', L.setupAnchor(zones, 1, f.data.scope.asOf, 'nearest').label === 'EMA 50' && L.setupAnchor(zones, 1, f.data.scope.asOf, 'latest-pivot').price === 98);
  zones.zones[1].price = 90; zones.pivots[1].price = 90;
  check('Jüngster Pivot außerhalb Setup-Zone: kein Rückgriff auf älteren passenden Pivot', L.setupAnchor(zones, 1, f.data.scope.asOf, 'latest-pivot') === null);
  check('Ungültiger Anker-/Zeitkontext bleibt unbekannt', L.setupAnchor(null, 1, 1, 'nearest') === null);
  check('Keine bestätigte Divergenz: neutral, keine erfundene Restzeit', card.divergence.status === 'keine bestätigte Divergenz' && card.divergence.confirmedAt === undefined);
  const divBase = clone(f.data.base), at = f.data.scope.asOf;
  divBase.rsiValues[2] = 20; divBase.rsiValues[7] = 25;
  divBase.pivots = [{ type: 'low', index: 2, confirmedIndex: 4, time: at - 8 * HOUR, price: 95, knownAt: at - 5 * HOUR },
    { type: 'low', index: 7, confirmedIndex: 9, time: at - 3 * HOUR, price: 94, knownAt: at }];
  const freshDiv = L.liveDivergence(divBase, 1, at);
  check('Divergenz-Alter startet am Ende der zweiten Nachbarkerze, drei volle Basiskerzen grün', freshDiv.confirmedAt === at && freshDiv.expiresAt === at + 3 * HOUR && freshDiv.remainingMs === 3 * HOUR && freshDiv.tone === 'positive');
  const lastDiv = L.liveDivergence({ ...divBase, lastIndex: 11, rsiValues: [...divBase.rsiValues, 41, 42] }, 1, at + 2 * HOUR);
  check('Letzte aktive Basiskerze gelb mit genau einer Stunde Restzeit', lastDiv.tone === 'warning' && lastDiv.remainingMs === HOUR);
  const expiredDiv = L.liveDivergence({ ...divBase, lastIndex: 12, rsiValues: [...divBase.rsiValues, 41, 42, 43] }, 1, at + 3 * HOUR);
  check('Ab Alter drei grau, keine Restzeit und konkrete Empfehlung neue Bestätigung abzuwarten', expiredDiv.status === 'abgelaufen' && expiredDiv.tone === 'muted' && expiredDiv.remainingMs === 0 && /Neue Bestätigung/.test(expiredDiv.action));
  divBase.pivots[1].knownAt = at + 1;
  check('Später bekannter zweiter Pivot erzeugt keinen vorzeitigen Divergenz-Hinweis', L.liveDivergence(divBase, 1, at).status === 'keine bestätigte Divergenz');
  check('Kurzkarte genau nach 1h grau abgelaufen, vorher grün; keine Positionsschließung', L.cardState(card, card.decisionAt + HOUR - 1).tone === 'positive' && L.cardState(card, card.decisionAt + HOUR).expired && L.cardState(card, card.decisionAt + HOUR).action.includes('Position bleibt unverändert'));
  const long = clone(f); long.data.scope.horizon = 'long'; for (const frame of [long.data.base, long.data.context]) frame.source.horizon = 'long'; long.data.funding.source.horizon = 'long'; for (const s of Object.values(long.saved.series)) s.source.horizon = 'long';
  const longCard = L.evaluateLive(long).cards[0];
  check('Langkarte genau nach 24h abgelaufen; maximale Haltedauer ist ein anderer Wert', longCard.expiresAt - longCard.decisionAt === 24 * HOUR && L.cardState(longCard, longCard.decisionAt + 24 * HOUR).expired);
  check('Gleiches Signal wird bei geändertem Referenzkurs nicht zu einem neuen Ereignis', L.evaluateLive({ ...f, quote: { ...f.quote, ask: 100.2 } }).cards[0].id === card.id);
  check('Andere Funding-/Ankerpolitik bleibt getrennt', unknown.cards[0].id !== card.id && L.evaluateLive({ ...f, options: { ...f.options, anchorPolicy: 'latest-pivot' } }).cards[0].id !== card.id);
  const qData = [{ symbol: 'BTCUSDT', bidPr: '100', askPr: '100.1', markPrice: '100', ts: String(f.quote.at) }], qContext = { symbol: 'BTCUSDT', decisionAt: card.decisionAt, providerAt: f.quote.providerAt, observedAt: f.quote.knownAt };
  check('Öffentlicher Bitget-Ticker wird mit Provider-/Kenntniszeit validiert', B.normalizeBitgetQuote(qData, qContext).ask === 100.1);
  let rejects = 0; for (const bad of [[], [...qData, ...qData], [{ ...qData[0], bidPr: '' }], [{ ...qData[0], ts: String(card.decisionAt - 1) }]]) { try { B.normalizeBitgetQuote(bad, qContext); } catch { rejects++; } }
  check('Leerer/doppelter/veralteter/ungültiger Ticker wird verworfen', rejects === 4);
  const F = await import(pathToFileURL(path.join(__dirname, 'fixtures/bitget.mjs'))), t = F.transport({ mutate(body, u) { if (u.pathname.endsWith('/ticker')) body.data = [{ ...qData[0], ts: String(F.NOW) }]; } });
  const q = await t.client.quote({ symbol: 'BTCUSDT', decisionAt: F.NOW });
  check('Ticker nutzt denselben seriellen öffentlichen GET-Transport ohne Konto/Orderpfad', q.at === F.NOW && new URL(t.calls[0].url).pathname === '/api/v2/mix/market/ticker' && t.calls[0].init.method === 'GET' && t.calls[0].init.credentials === 'omit');
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
