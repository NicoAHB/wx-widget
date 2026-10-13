// 3.68.1: Konfluenz-Score je KI-Zone (0–100) und „starke Zonen“ – reine Regel-Logik ohne externe API.
// Jede Faktorgruppe zählt höchstens einmal (abgeleitete Indikatoren derselben Gruppe zählen nicht doppelt);
// weitere Faktoren einer Gruppe erscheinen nur in der Erklärung. Alle Gewichte und Schwellen stehen hier zentral.
export const ZONE_STRENGTH = Object.freeze({
  // Gruppengewichte, Summe 100. Struktur + Volumen + (Trend oder Auslöser) erreicht genau die Schwelle 70.
  weights: Object.freeze({ struktur: 25, volumen: 25, derivate: 10, trend: 20, ausloeser: 20 }),
  strongScore: 70,          // starke Zone ab diesem Score …
  strongAgainstEma: 85,     // … gegen die EMA-200-Richtung erst ab diesem Score
  minGroups: 3,             // und mindestens so viele verschiedene Gruppen
  nearATR: .25,             // Abstand, in dem ein Preisniveau noch „an der Zone“ liegt (× ATR)
  bandATR: .5,              // Bollinger-Rand darf etwas weiter weg liegen
  reversalBars: 20,         // Umkehrkerze/Divergenz zählt, wenn sie höchstens so viele Kerzen alt ist
  highVolume: 1.5           // Volumendichte der Zone ab diesem Vielfachen des Durchschnitts
});
export const ZONE_GROUPS = Object.freeze([['struktur', 'Struktur'], ['volumen', 'Volumen'], ['derivate', 'Derivate'], ['trend', 'Trend'], ['ausloeser', 'Auslöser']]);
const finite = Number.isFinite, de = (v, d = 3) => String(+v.toFixed(d)).replace('.', ',');

/**
 * zone: { side:'buy'|'sell', low, high, broken, volumeRatio? } aus computeKiZones.
 * ctx (alles optional – fehlende Daten zählen nicht): atr, price, ema200, higher {label, poc, vaLow, vaHigh, ema200, bbUpper, bbLower},
 * periodHigh, periodLow, fib [{r, price}], sr [{price, name}], profile {poc, vaLow, vaHigh}, liq [{price, side}] | null,
 * whales [{price, sell}] | null, trend {'1h': -1|0|1, '4h': -1|0|1}, divergences [{kind, price, age}],
 * reversals [{dir, low, high, age, name}], bands {upper, lower}, lastIndex.
 */
export function scoreZoneStrength(zone, ctx = {}, settings = ZONE_STRENGTH) {
  const s = settings, d = zone.side === 'buy' ? 1 : -1, atr = ctx.atr > 0 ? ctx.atr : Math.max(zone.high - zone.low, 1e-12), pad = s.nearATR * atr;
  const near = (v, p = pad) => finite(v) && v >= zone.low - p && v <= zone.high + p, found = { struktur: [], volumen: [], derivate: [], trend: [], ausloeser: [] };
  // Struktur
  const h = ctx.higher;
  if (h) { const hit = [['POC', h.poc], [d === 1 ? 'Value Area unten' : 'Value Area oben', d === 1 ? h.vaLow : h.vaHigh], ['EMA 200', h.ema200], ['Bollinger', d === 1 ? h.bbLower : h.bbUpper]].find(([, v]) => near(v)); if (hit) found.struktur.push(`Zone ${h.label || '4h'} (${hit[0]})`); }
  if (d === 1 && near(ctx.periodLow)) found.struktur.push('Tief'); if (d === -1 && near(ctx.periodHigh)) found.struktur.push('Hoch');
  const fib = (ctx.fib || []).find(f => near(f.price)); if (fib) found.struktur.push(`Fib ${de(fib.r)}`);
  const sr = (ctx.sr || []).find(l => near(l.price)); if (sr) found.struktur.push(sr.name || (d === 1 ? 'Unterstützung' : 'Widerstand'));
  // Volumen
  const p = ctx.profile;
  if (p && near(p.poc)) found.volumen.push('POC');
  if (p && near(d === 1 ? p.vaLow : p.vaHigh)) found.volumen.push(d === 1 ? 'Value-Area-Unterkante' : 'Value-Area-Oberkante');
  if (zone.volumeRatio >= s.highVolume) found.volumen.push('hohes Volumen');
  // Derivate (nur echte Daten: null = nicht verfügbar)
  if (Array.isArray(ctx.liq) && ctx.liq.some(c => near(c.price))) found.derivate.push('Liquidationscluster');
  if (Array.isArray(ctx.whales) && ctx.whales.some(w => (d === 1 ? !w.sell : w.sell) && near(w.price))) found.derivate.push(d === 1 ? 'Whale-Käufe' : 'Whale-Verkäufe');
  // Trend
  const emaDir = finite(ctx.ema200) && finite(ctx.price) ? Math.sign(ctx.price - ctx.ema200) : 0;
  if (emaDir === d) found.trend.push(d === 1 ? 'über EMA 200' : 'unter EMA 200');
  for (const iv of ['1h', '4h']) if (ctx.trend?.[iv] === d) found.trend.push(`Trend ${iv} ${d === 1 ? '▲' : '▼'}`);
  // Auslöser
  if ((ctx.divergences || []).some(v => v.kind === (d === 1 ? 'bull' : 'bear') && near(v.price) && !(v.age > s.reversalBars))) found.ausloeser.push('RSI-Divergenz');
  const rev = (ctx.reversals || []).find(r => r.dir === (d === 1 ? 'bull' : 'bear') && near(d === 1 ? r.low : r.high) && !(r.age > s.reversalBars)); if (rev) found.ausloeser.push(rev.name ? `Umkehrkerze (${rev.name})` : 'Umkehrkerze');
  if (ctx.bands && near(d === 1 ? ctx.bands.lower : ctx.bands.upper, s.bandATR * atr)) found.ausloeser.push('Bollinger-Rand');
  const groups = ZONE_GROUPS.map(([key, label]) => ({ key, label, factors: found[key], points: found[key].length ? s.weights[key] : 0 }));
  const score = Math.round(groups.reduce((a, g) => a + g.points, 0)), groupCount = groups.filter(g => g.points > 0).length;
  const withEma = emaDir ? emaDir === d : null, threshold = withEma === false ? s.strongAgainstEma : s.strongScore;
  const strong = !zone.broken && groupCount >= s.minGroups && score >= threshold;
  return { score, groups, groupCount, withEma, threshold, strong, factors: groups.flatMap(g => g.factors), factorsText: groups.flatMap(g => g.factors).join(' + ') };
}
// Score-Stufen für den Backtest (<50, 50–70, 70–85, >85; Grenzwerte zählen zur oberen Stufe)
export const ZONE_SCORE_BANDS = Object.freeze([['<50', 0, 50], ['50–69', 50, 70], ['70–84', 70, 85], ['≥85', 85, 101]]);
export const zoneScoreBand = score => ZONE_SCORE_BANDS.find(([, a, b]) => score >= a && score < b)?.[0] || '<50';

// ---- 3.68.1: Ein-/Ausstiegssignale an starken Zonen (gleiche Regeln für Live-Anzeige und Backtest) ----
// Elliott, Prognose und Wellen-Prognose sind bewusst keine Eingaben: nur Anzeige, nie Auslöser.
export const ZONE_SIGNAL = Object.freeze({
  minCrv: 1.5,              // Signal nur bei Chance/Risiko ≥ 1,5
  leverage: 5,              // Startwert, in der App einstellbar (1–50)
  maxLeverage: 50,
  mmr: .005,                // modellierte Wartungsmarge (isolierte Margin)
  liqSafety: .7,            // Stop-Abstand höchstens 70 % des Abstands bis zur Liquidation („deutlich davor“)
  stopBufferATR: .15,       // Stop so weit hinter ZigZag-Tief/-Hoch bzw. Zone
  zigzagMaxATR: 2,          // ZigZag-Punkt zählt als Stop-Anker, wenn er höchstens so weit hinter der Zone liegt
  triggerBars: 3,           // Auslöser höchstens so viele Kerzen alt
  holdMoveATR: 1,           // Backtest: Zone „gehalten“, wenn der Kurs danach mind. 1 ATR wegläuft …
  brokenATR: .3,            // … bevor ein Schluss mind. 0,3 ATR jenseits der Zone liegt
  horizon: 30               // Backtest: höchstens so viele Folgekerzen bis zur Entscheidung
});
// Trend-Filter: Long nur mit dem Trend – Kurs über EMA 200 oder 1h und 4h aufwärts (Short spiegelverkehrt).
export function zoneTrendOk(side, ctx) {
  const d = side === 'buy' ? 1 : -1, emaDir = Number.isFinite(ctx.ema200) && Number.isFinite(ctx.price) ? Math.sign(ctx.price - ctx.ema200) : 0;
  return emaDir === d || (ctx.trend?.['1h'] === d && ctx.trend?.['4h'] === d);
}
// Frische Auslöser an der Zone: RSI-Divergenz, Umkehrkerze, Bollinger-Rand (Kerze berührt das Band).
export function zoneTriggers(zone, ctx, candle, settings = ZONE_SIGNAL) {
  const d = zone.side === 'buy' ? 1 : -1, atr = ctx.atr > 0 ? ctx.atr : zone.high - zone.low, pad = ZONE_STRENGTH.nearATR * atr, near = v => Number.isFinite(v) && v >= zone.low - pad && v <= zone.high + pad, out = [];
  if ((ctx.divergences || []).some(v => v.kind === (d === 1 ? 'bull' : 'bear') && near(v.price) && v.age <= settings.triggerBars)) out.push('RSI-Divergenz');
  const rev = (ctx.reversals || []).find(r => r.dir === (d === 1 ? 'bull' : 'bear') && near(d === 1 ? r.low : r.high) && r.age <= settings.triggerBars); if (rev) out.push(rev.name ? `Umkehrkerze (${rev.name})` : 'Umkehrkerze');
  if (ctx.bands && candle && (d === 1 ? candle.low <= ctx.bands.lower : candle.high >= ctx.bands.upper)) out.push('Bollinger-Rand');
  return out;
}
/**
 * Signal zur Schlusskerze `candle` (nur Daten bis zu dieser Kerze):
 * strong: starke Zonen mit .strength; targets: { zones (alle KI-Zonen), poc, liq [{price}] }; pivots: ZigZag-Punkte [{type:'L'|'H', price}].
 */
export function zoneSignal({ strong = [], candle, ctx = {}, targets = {}, pivots = [], leverage = ZONE_SIGNAL.leverage, settings = ZONE_SIGNAL }) {
  if (!candle) return { ok: false, reason: 'keine Kerze' };
  let best = null, why = 'keine starke Zone berührt';
  for (const zone of strong) {
    const d = zone.side === 'buy' ? 1 : -1, touched = candle.low <= zone.high && candle.high >= zone.low, held = d === 1 ? candle.close >= zone.low : candle.close <= zone.high;
    if (!touched || !held) continue;
    if (!zoneTrendOk(zone.side, ctx)) { why = 'Trend-Filter passt nicht'; continue; }
    const triggers = zoneTriggers(zone, ctx, candle, settings); if (!triggers.length) { why = 'kein Auslöser'; continue; }
    const atr = ctx.atr > 0 ? ctx.atr : zone.high - zone.low, entry = candle.close, edge = d === 1 ? zone.low : zone.high;
    const pivot = [...pivots].reverse().find(p => p.type === (d === 1 ? 'L' : 'H') && d * (edge - p.price) >= 0 && d * (edge - p.price) <= settings.zigzagMaxATR * atr);
    const anchor = pivot ? (d === 1 ? Math.min(edge, pivot.price) : Math.max(edge, pivot.price)) : edge, stop = anchor - d * settings.stopBufferATR * atr, risk = d * (entry - stop);
    if (!(risk > 0)) { why = 'Stop liegt nicht hinter dem Einstieg'; continue; }
    const cands = [...(targets.zones || []).filter(z => !z.broken && z.side !== zone.side).map(z => ({ price: d === 1 ? z.low : z.high, name: 'Gegenzone' })),
      ...(Number.isFinite(targets.poc) ? [{ price: targets.poc, name: 'POC' }] : []), ...(targets.liq || []).map(c => ({ price: c.price, name: 'Liquidationscluster' }))]
      .filter(t => Number.isFinite(t.price) && d * (t.price - entry) > 0).sort((a, b) => d * (a.price - b.price));
    const target = cands[0]; if (!target) { why = 'kein Ziel (Gegenzone, POC, Liquidationscluster)'; continue; }
    const crv = d * (target.price - entry) / risk; if (!(crv >= settings.minCrv)) { why = `CRV ${crv.toFixed(2).replace('.', ',')} unter ${String(settings.minCrv).replace('.', ',')}`; continue; }
    const lev = Math.min(settings.maxLeverage, Math.max(1, leverage)), liquidation = lev > 1 ? entry * (1 - d / lev + d * settings.mmr) : (d === 1 ? null : entry * (2 - settings.mmr));
    if (liquidation !== null && !(risk <= settings.liqSafety * Math.abs(entry - liquidation))) { why = `Stop zu nah an der Liquidation (Hebel ${lev}×)`; continue; }
    const sig = { ok: true, side: zone.side, dir: d, entry, stop, target: target.price, targetName: target.name, crv, risk, leverage: lev, liquidation, zone, score: zone.strength?.score ?? null, triggers, time: candle.time };
    if (!best || sig.score > best.score || (sig.score === best.score && sig.crv > best.crv)) best = sig;
  }
  return best || { ok: false, reason: why };
}
// Offene Position mit der nächsten abgeschlossenen Kerze führen: Stop vor Ziel (konservativ, auch bei Lücken).
export function zoneStep(position, candle, opposite = false) {
  const d = position.dir, adverse = d === 1 ? candle.low : candle.high, favorable = d === 1 ? candle.high : candle.low;
  if (d * (adverse - position.stop) <= 0) return { price: d * (candle.open - position.stop) < 0 ? candle.open : position.stop, reason: 'Stop', time: candle.time };
  if (d * (favorable - position.target) >= 0) return { price: position.target, reason: 'Ziel', time: candle.time };
  if (opposite) return { price: candle.close, reason: 'Gegensignal', time: candle.time };
  return null;
}
// Backtest: hielt die Zone ab Kerze `from`? 'held' | 'broken' | null (unentschieden innerhalb des Horizonts).
export function zoneOutcome(zone, candles, from, atr, settings = ZONE_SIGNAL) {
  const d = zone.side === 'buy' ? 1 : -1;
  for (let i = from; i < Math.min(candles.length, from + settings.horizon); i++) {
    const c = candles[i];
    if (d * ((d === 1 ? zone.low : zone.high) - c.close) > settings.brokenATR * atr) return 'broken';
    if (d * ((d === 1 ? c.high : c.low) - (d === 1 ? zone.high : zone.low)) >= settings.holdMoveATR * atr) return 'held';
  }
  return null;
}
// Auswertung je Score-Stufe: gehaltene Zonen, Trefferquote, Ø Ergebnis (R und %), Ø CRV, max. Drawdown (in R, Reihenfolge der Trades).
export function summarizeZoneBacktest({ tests = [], trades = [] }) {
  return ZONE_SCORE_BANDS.map(([band]) => {
    const t = tests.filter(x => zoneScoreBand(x.score) === band && x.outcome), tr = trades.filter(x => zoneScoreBand(x.score) === band);
    let eq = 0, peak = 0, dd = 0; for (const x of tr) { eq += x.r; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); }
    const avg = (arr, k) => arr.length ? arr.reduce((a, x) => a + x[k], 0) / arr.length : null;
    return { band, zones: t.length, held: t.filter(x => x.outcome === 'held').length, heldRate: t.length ? t.filter(x => x.outcome === 'held').length / t.length * 100 : null,
      trades: tr.length, winRate: tr.length ? tr.filter(x => x.r > 0).length / tr.length * 100 : null, avgR: avg(tr, 'r'), avgPct: avg(tr, 'pct'), avgCrv: avg(tr, 'crv'), maxDd: tr.length ? dd : null };
  });
}
