const { fixture } = require('./muster-fixtures');
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
const throws = f => { try { f(); return false; } catch { return true; } };
// 3.68.0: reproduzierbarer Zufallspfad (xorshift) für Konfluenz/PO3, ohne echte Börsendaten
function series(n, ms, seed, start = Date.UTC(2026, 0, 1)) {
  let x = seed >>> 0, price = 100, drift = 0; const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }, rows = [];
  for (let i = 0; i < n; i++) { if (i % 200 === 0) drift = (rnd() - .5) * .004; const open = price, close = Math.max(1, open * (1 + drift + (rnd() - .5) * .02)), high = Math.max(open, close) * (1 + rnd() * .006), low = Math.min(open, close) * (1 - rnd() * .006);
    rows.push({ time: start + i * ms, open, high, low, close, volume: 1000 * (.5 + rnd() * (rnd() < .05 ? 4 : 1)), end: start + (i + 1) * ms }); price = close; }
  return rows;
}
(async () => {
  const M = await import('../shared/muster-bot-core.mjs');
  const run = (data, config = {}) => M.runMusterBacktest({ ...data, config: { timeframe: '15m', ...config } });
  let d = fixture(), r = run(d);
  check('Hammer mit Volumen am abgeschlossenen 4h-Support erkannt', r.signals.length === 1 && r.signals[0].pattern === 'hammer' && r.signals[0].context.closedAt <= r.signals[0].end);
  check('Sofort-Einstieg erst zum nächsten Open', r.position?.entry === d.rows[31].open && r.position?.openedAt === d.rows[31].time && r.position?.signalTime === d.rows[30].time);
  check('SL und TP nach Muster-ATR und 2R berechnet', r.position && Math.abs(r.position.stop - (100 - .1 * r.signals[0].atr)) < 1e-10 && Math.abs(r.position.target - (r.position.entry + 2 * (r.position.entry - r.position.stop))) < 1e-10);
  check('Ohne Hebel, Risiko und Gebühren pro Seite', r.position.quantity * r.position.entry + r.position.entryFee <= 1000 && Math.abs(r.position.riskCash - 10) < 1e-8 && r.position.entryFee > 0);
  d = fixture(); d.rows[31] = { ...d.rows[31], high: 110, low: 98, close: 104 }; r = run(d);
  check('SL und TP in derselben Kerze: konservativ Stop, inklusive Eintrittskerze', r.trades.length === 1 && r.trades[0].reason === 'Stop' && r.trades[0].pnl < -10);
  check('Nettoergebnis enthält Kauf- und Verkaufsgebühr', Math.abs(r.trades[0].pnl - (r.trades[0].gross - r.trades[0].fees)) < 1e-10 && r.trades[0].fees > 0 && r.stats.maxDrawdown > 0);
  d = fixture(); d.rows[31] = { ...d.rows[31], high: 101.7, low: 100.5, close: 101.6 }; d.rows[32] = { ...d.rows[32], high: 110 }; r = run(d, { hammerEntry: 'buy-stop', buyValidBars: 1 });
  check('Buy-Stop nach N Folgekerzen verfallen, späteres Hoch kauft nicht', !r.position && !r.pending && !r.trades.length);
  d = fixture(); d.rows[31] = { ...d.rows[31], open: 104, high: 120, low: 99, close: 110 }; r = run(d, { hammerEntry: 'buy-stop' });
  check('Buy-Stop mit Gap: höheres Open ist Einstieg, SL bleibt vorrangig', r.trades[0]?.entry === 104 && r.trades[0]?.reason === 'Stop');
  d = fixture(); d.rows[31] = { ...d.rows[31], open: 101.7, high: 103.5, low: 98, close: 103 }; d.rows[32] = { ...d.rows[32], open: 103, high: 104, low: 102, close: 103.5 }; r = run(d, { hammerEntry: 'close' });
  check('Schlusskurs: nächste Kerze bestätigt, erst folgende Öffnung wird gekauft', r.position?.openedAt === d.rows[32].time && r.position?.entry === 103 && r.position.stop < 98);
  d.rows[31].close = 101.7; r = run(d, { hammerEntry: 'close' }); check('Unzureichender Bestätigungsschluss: kein Kauf', !r.position && !r.trades.length);
  d = fixture('engulfing'); r = run(d, { pattern: 'engulfing' }); check('Bullish Engulfing verwendet das tiefere Tief beider Kerzen', r.signals.length === 1 && r.signals[0].low === 100.4 && [...r.trades, ...(r.position ? [r.position] : [])].some(p => p.pattern === 'engulfing'));
  d.rows[29].low = 99.9; r = run(d, { pattern: 'engulfing' }); check('Engulfing berücksichtigt auch ein tieferes Tief der vorherigen Kerze', r.signals[0]?.low === 99.9 && Math.abs(r.signals[0].stop - (99.9 - .1 * r.signals[0].atr)) < 1e-10);
  r = run(d, { pattern: 'both', hammerBodyMax: 1, hammerLowerMin: 0, hammerWickBody: 0, hammerUpperMax: 1, hammerRangeATR: 0, hammerEntry: 'close', engulfEntry: 'buy-stop' });
  check('Gleichzeitiger Treffer: Hammer und dessen eigene Einstiegseinstellung', r.signals[0]?.pattern === 'hammer' && r.signals[0]?.entryMode === 'close');
  d = fixture(); d.rows[30].open = d.rows[30].close = 101.7; r = run(d); check('Dragonfly-Doji mit passender Geometrie zählt als Hammer', r.signals[0]?.pattern === 'hammer');
  d = fixture(); d.rows[30].volume = 100; r = run(d); check('Volumen gleich Durchschnitt genügt nicht', r.signals.length === 0);
  d = fixture(); d.context.forEach(c => { c.close = c.open = 102; }); r = run(d, { trendFilter: true }); check('Trendfilter verlangt strikt geschlossenen Kurs über EMA', r.signals.length === 0);
  d = fixture(); d.context.forEach(c => { c.low = 90; c.high = 103; }); r = run(d, { supportDistanceATR: .1 }); check('Muster weit über Support wird gefiltert', r.signals.length === 0);
  d = fixture(); const cut = d.rows[30].end, before = run({ ...d, asOf: cut }); d.rows[34].high = 5000; d.context.filter(c => c.end > cut).forEach(c => { c.high = 9000; c.low = 1; }); const after = run(d);
  check('Zukunfts-/laufende Kerzen ändern frühere Signale nicht', JSON.stringify(before.signals) === JSON.stringify(after.signals.filter(s => s.end <= cut)) && before.position === null && before.pending?.stage === 'open');
  const open = run({ ...d, asOf: cut, liveOpen: { time: cut, open: 102 } }); check('Live darf das bekannte nächste Open nutzen, ohne künftiges High/Low', open.position?.entry === 102 && open.trades.length === 0);
  r = run(fixture(), { riskPercent: 10 }); check('Positionsgröße wird auf verfügbares Kapital ohne Hebel begrenzt', r.position?.capitalCapped && r.position.quantity * r.position.entry + r.position.entryFee <= 1000 + 1e-8);
  // 3.68.0: 27 Hammer/Engulfing-Varianten plus Konfluenz und Power of Three je Zeitrahmen
  const combinations = M.musterCombinations({ hammerEntry: 'close', engulfEntry: 'instant' }), classic = combinations.filter(c => !M.musterModel(c.pattern));
  check('33 eindeutige Kombinationen (27 Hammer/Engulfing + Konfluenz/PO3 × 3 Ebenen), gleicher Einstieg bei Beide', combinations.length === 33 && classic.length === 27 && new Set(combinations.map(c => [c.pattern, c.timeframe, c.hammerEntry].join('|'))).size === 33 && combinations.every(c => c.hammerEntry === c.engulfEntry) && combinations.filter(c => c.pattern === 'confluence').length === 3 && combinations.filter(c => c.pattern === 'po3').length === 3);
  r = run(fixture()); check('Weniger als 100 Abschlüsse ehrlich markiert, keine NaN/Infinity-Quoten', r.stats.lowSample && r.stats.winRate === null && r.stats.profitFactor === null && r.stats.averageR === null);
  check('Ungültige Einstellungen/Datenlücken/Zeiten abgelehnt', throws(() => M.musterSettings({ riskPercent: 0 })) && throws(() => run({ ...fixture(), rows: fixture().rows.filter((_, i) => i !== 20) })) && throws(() => run({ ...fixture(), asOf: NaN })));
  // ---- 3.68.0: Hebel, Größenwahl, Liquidation, Short, Konfluenz und Power of Three ----
  check('Hammer/Engulfing-IDs unverändert (bestehende Demos bleiben gültig)', run(fixture()).signals[0]?.id.startsWith(M.MUSTER_VERSION + '|') && M.MUSTER_VERSION === 'hammer-engulfing-1');
  r = run(fixture(), { riskPercent: 10, leverage: 10 }); check('Mit Hebel 10 wird Risiko 10 % nicht mehr durch das Kapital begrenzt; Margin = Wert ÷ Hebel', r.position && !r.position.capitalCapped && Math.abs(r.position.riskCash - 100) < 1e-6 && Math.abs(r.position.margin - r.position.quantity * r.position.entry / 10) < 1e-9 && r.position.leverage === 10);
  r = run(fixture(), { sizing: 'margin', marginPercent: 10, leverage: 5 }); check('Größe nach Einsatz: 10 % Margin × Hebel 5', r.position && Math.abs(r.position.margin - 100) < 1e-6 && Math.abs(r.position.quantity * r.position.entry - 500) < 1e-6);
  check('Liquidationspreis Long = Einstieg × (1 − 1/Hebel + Wartungsmarge)', Math.abs(r.position.liquidation - r.position.entry * (1 - 1 / 5 + M.MUSTER_MMR)) < 1e-9 && run(fixture()).position.liquidation === null);
  d = fixture(); d.rows[31] = { ...d.rows[31], high: 102, low: 98, close: 99 }; r = run(d, { sizing: 'margin', marginPercent: 10, leverage: 50 });
  check('Hebel 50: Liquidation vor dem zu weiten Stop, Verlust höchstens Margin + Gebühren', r.trades[0]?.reason === 'Liquidation' && r.stats.liquidations === 1 && Math.abs(r.trades[0].gross + r.trades[0].margin) < 1e-6 && r.trades[0].pnl >= -(r.trades[0].margin + r.trades[0].fees) - 1e-9);
  d = fixture(); d.rows[31] = { ...d.rows[31], high: 102, low: 98, close: 99 }; r = run(d, { sizing: 'margin', marginPercent: 10, leverage: 2 }); check('Hebel 2: Stop greift vor der Liquidation', r.trades[0]?.reason === 'Stop' && r.stats.liquidations === 0);
  check('Ungültiger Hebel/Einsatz abgelehnt', throws(() => M.musterSettings({ leverage: 0 })) && throws(() => M.musterSettings({ leverage: 51 })) && throws(() => M.musterSettings({ sizing: 'alles' })) && throws(() => M.musterSettings({ marginPercent: 0 })));
  const ms15 = 900e3, walk = series(6000, ms15, 7), ctx4h = series(1600, 4 * 3600e3, 11, walk[0].time - 600 * 4 * 3600e3), asOf = walk.at(-1).end;
  const model = (pattern, config = {}, rows = walk, until = asOf) => M.runMusterBacktest({ rows, context: ctx4h.filter(c => c.end <= until), config: { pattern, timeframe: '15m', ...config }, asOf: until });
  const conf = model('confluence'), confLong = model('confluence', { allowShort: false });
  check('Konfluenz erzeugt Long- und Short-Signale mit Score ≥ Mindestscore und Stop auf der richtigen Seite', conf.signals.length >= 5 && conf.signals.some(x => x.direction === 1) && conf.signals.some(x => x.direction === -1) && conf.signals.every(x => x.score >= conf.config.confMinScore && x.score <= 100 && x.direction * (walk.find(c => c.time === x.time).close - x.stop) > 0));
  check('Nur Long: keine Short-Signale bei Konfluenz und PO3', confLong.signals.length > 0 && confLong.signals.every(x => x.direction === 1) && model('po3', { allowShort: false }).signals.every(x => x.direction === 1));
  check('Short-Ergebnis spiegelbildlich: Gewinn bei fallendem Kurs, Verlust höchstens Margin', conf.trades.every(t => Math.abs(t.gross - Math.max(t.direction * t.quantity * (t.exit - t.entry), -t.margin)) < 1e-9) && conf.trades.some(t => t.direction === -1));
  check('Konfluenz-IDs mit Modellversion und Richtung', conf.signals.every(x => x.id.startsWith(M.MUSTER_MODELS_VERSION + '|') && x.id.endsWith('|' + x.direction)));
  const causal = pattern => { const full = model(pattern); return full.signals.slice(0, 6).every(x => { const cut = walk.findIndex(c => c.time === x.time) + 1, part = model(pattern, {}, walk.slice(0, cut), walk[cut - 1].end); return part.signals.some(y => y.id === x.id); }) && full.signals.length > 0; };
  check('Konfluenz kausal: spätere Kerzen ändern frühere Signale nicht', causal('confluence'));
  const po3 = model('po3', {}, series(9000, ms15, 3), series(9000, ms15, 3).at(-1).end);
  check('Power of Three: Signale nur mit Sweep-Stop jenseits des Extrems und Score ≥ 70', po3.signals.every(x => x.score >= 70 && x.direction * (x.sweep - x.stop) > 0 && x.entryMode === 'instant'));
  check('Power of Three kausal', (() => { const rows = series(9000, ms15, 3), full = M.runMusterBacktest({ rows, context: ctx4h, config: { pattern: 'po3', timeframe: '15m' }, asOf: rows.at(-1).end }); return full.signals.slice(0, 4).every(x => { const cut = rows.findIndex(c => c.time === x.time) + 1; return M.runMusterBacktest({ rows: rows.slice(0, cut), context: ctx4h, config: { pattern: 'po3', timeframe: '15m' }, asOf: rows[cut - 1].end }).signals.some(y => y.id === x.id); }); })());
  check('Warmup: Konfluenz braucht EMA 200, PO3 zusätzliche Box-Historie', M.musterWarmup(M.musterSettings({ pattern: 'confluence' })) >= 205 && M.musterWarmup(M.musterSettings({ pattern: 'po3' })) > M.musterWarmup(M.musterSettings({ pattern: 'hammer' })));
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
