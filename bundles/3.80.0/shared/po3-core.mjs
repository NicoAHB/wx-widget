// G11: eigenes PO3-Modell; alle Preisereignisse aus abgeschlossenen Kerzen und festen Regeln.
import { closedCandles, confirmedPivots } from './indicators.mjs';
export const PO3_VERSION = 'po3-1';
export const PO3_FRAMES = Object.freeze({ '1m': 60e3, '5m': 300e3, '15m': 900e3, '1h': 3600e3, '4h': 14400e3 });
export const PO3_DEFAULTS = Object.freeze({ revision: 1, contextOn: false, context: '4h', bias: '1h', setup: '5m', entry: '1m',
  boxBars: 6, boxATR: 1.5, impulseBodies: 10, impulseFactor: 1.5, stop: 'eng', bufferATR: .1, rewardRisk: 2, entryMode: 'close',
  closure: null, entryExpiryBars: 20, maxHoldMs: 3600e3, feeEntry: .0005, feeExit: .0005, criteria: 'pending', approachATR: .25, cooldownMs: 60000 });
const positive = x => Number.isFinite(x) && x > 0, time = x => Number.isSafeInteger(x) && x >= 0;
export function po3Settings(input = {}) {
  if (!input || Object.keys(input).some(k => !Object.hasOwn(PO3_DEFAULTS, k))) throw new Error('Unbekannte PO3-Einstellung');
  const c = { ...PO3_DEFAULTS, ...input }, levels = [c.contextOn ? c.context : null, c.bias, c.setup, c.entry].filter(Boolean);
  if (!Number.isSafeInteger(c.revision) || c.revision < 1 || levels.some(tf => !PO3_FRAMES[tf]) || levels.some((tf, i) => i && PO3_FRAMES[tf] > PO3_FRAMES[levels[i - 1]])
    || !Number.isInteger(c.boxBars) || c.boxBars < 6 || c.boxBars > 100 || !positive(c.boxATR) || !Number.isInteger(c.impulseBodies) || c.impulseBodies < 10 || !positive(c.impulseFactor)
    || !['eng', 'weit'].includes(c.stop) || !positive(c.bufferATR) || !Number.isFinite(c.rewardRisk) || c.rewardRisk < 2 || !['close', 'limit'].includes(c.entryMode)
    || ![null, 'tp1', 'thirds'].includes(c.closure) || !Number.isInteger(c.entryExpiryBars) || c.entryExpiryBars < 1 || !Number.isSafeInteger(c.maxHoldMs) || c.maxHoldMs < PO3_FRAMES[c.entry]
    || c.maxHoldMs % PO3_FRAMES[c.entry] || ![c.feeEntry, c.feeExit].every(x => Number.isFinite(x) && x >= 0 && x < 1) || !['pending', 'g10'].includes(c.criteria)
    || !Number.isFinite(c.approachATR) || c.approachATR < 0 || !Number.isSafeInteger(c.cooldownMs) || c.cooldownMs < 0) throw new Error('Ungültige PO3-Regeln/Ebenenhierarchie');
  return Object.freeze(c);
}
export const po3Key = input => JSON.stringify({ model: PO3_VERSION, ...po3Settings(input) });
export function po3Window(mode, asOf, custom = {}) {
  if (!time(asOf)) throw new Error('PO3-Zeit fehlt');
  const from = mode === 'today' ? Math.floor(asOf / 86400e3) * 86400e3 : mode === '4h' ? Math.max(0, asOf - 14400e3) : mode === '1h' ? Math.max(0, asOf - 3600e3) : mode === 'custom' ? custom.from : null;
  const to = mode === 'custom' ? custom.to : asOf;
  if (!time(from) || !time(to) || to > asOf || from >= to) throw new Error('Zeitraum ungültig/zukünftig');
  return { from, to, exclusive: true };
}
// Historische Preiskenntnis ist modelliert am Schluss; der tatsächliche spätere Abruf bleibt separat im Feed.
export function po3Pivots(rows, cutoff, tf, from = 0) {
  const period = PO3_FRAMES[tf];
  return confirmedPivots(rows.filter(c => c.time >= from && c.end <= cutoff).map(c => ({ ...c, knownAt: c.end })), cutoff, period);
}
export function po3Bias({ pivots, price, ema50, asOf }) {
  if (!positive(price) || !positive(ema50) || !time(asOf) || !Array.isArray(pivots)) return { direction: 0, complete: false };
  const lows = pivots.filter(p => p.type === 'low' && p.knownAt <= asOf).slice(-2), highs = pivots.filter(p => p.type === 'high' && p.knownAt <= asOf).slice(-2);
  if (lows.length < 2 || highs.length < 2) return { direction: 0, complete: false };
  return { complete: true, direction: price > ema50 && lows[1].price > lows[0].price && highs[1].price > highs[0].price ? 1 : price < ema50 && lows[1].price < lows[0].price && highs[1].price < highs[0].price ? -1 : 0 };
}
export function accumulation(rows, atr, config = {}) {
  const p = po3Settings(config), previous = rows.slice(-p.boxBars);
  if (previous.length < p.boxBars || !positive(atr)) return null;
  const high = Math.max(...previous.map(c => c.high)), low = Math.min(...previous.map(c => c.low));
  return high > low && high - low <= p.boxATR * atr ? { high, low, height: high - low, from: previous[0].time, to: previous.at(-1).end, bars: previous.length } : null;
}
export function manipulation(box, candle) {
  if (!box || candle.time < box.to) return null;
  const down = candle.low < box.low, up = candle.high > box.high;
  if (down && up) return { direction: 0, ambiguous: true, at: candle.end };
  if (candle.close < box.low || candle.close > box.high || !down && !up) return null;
  return down || up ? { direction: down ? 1 : -1, extreme: down ? candle.low : candle.high, time: candle.time, at: candle.end, box: { ...box } } : null;
}
export function po3Fvg(three, { timeframe, atr, instrument, after = null } = {}) {
  if (!Array.isArray(three) || three.length !== 3 || !PO3_FRAMES[timeframe] || !positive(atr)) return null;
  const [a, b, c] = three;
  if (a.end !== b.time || b.end !== c.time || after !== null && a.time < after) return null;
  const direction = a.high < c.low ? 1 : a.low > c.high ? -1 : 0;
  if (!direction) return null;
  const low = direction === 1 ? a.high : c.high, high = direction === 1 ? c.low : a.low;
  return { id: JSON.stringify([PO3_VERSION, instrument, timeframe, direction, a.time, c.time, low, high]), timeframe, direction, low, high,
    from: a.time, to: c.end, confirmedAt: c.end, atr, alarmEligible: high - low >= .5 * atr, filledAt: null };
}
export function fvgState(zone, later) {
  const fill = later.find(c => c.time >= zone.confirmedAt && (zone.direction === 1 ? c.low <= zone.low : c.high >= zone.high));
  return { ...zone, filledAt: fill?.end ?? null };
}
export function po3Retest(zone, candle) { return !!zone && candle.time >= zone.confirmedAt && candle.low <= zone.high && candle.high >= zone.low; }
export function po3Impulse(rows, direction, counter, config = {}) {
  const p = po3Settings(config), c = rows.at(-1), prior = rows.slice(-p.impulseBodies - 1, -1);
  if (!c || prior.length !== p.impulseBodies || !positive(counter) || ![1, -1].includes(direction)) return false;
  const avg = prior.reduce((s, x) => s + Math.abs(x.close - x.open), 0) / prior.length;
  return avg > 0 && Math.abs(c.close - c.open) >= p.impulseFactor * avg && direction * (c.close - c.open) > 0 && direction * (c.close - counter) > 0;
}
export function po3Levels({ candle, direction, sweep, setupSweep, entryATR, setupATR, box, tickSize, contextLevels = [] }, config = {}) {
  const p = po3Settings(config);
  if (![1, -1].includes(direction) || !sweep || !setupSweep || !box || ![tickSize, entryATR, setupATR].every(positive)) return { status: 'nicht bewertbar', reason: 'Preisanker/ATR/Tick fehlen' };
  const round = (v, up) => (up ? Math.ceil(v / tickSize - 1e-10) : Math.floor(v / tickSize + 1e-10)) * tickSize;
  const entry = round(p.entryMode === 'limit' ? (candle.high + candle.low) / 2 : candle.close, direction === 1);
  const sl = round((p.stop === 'eng' ? sweep.extreme : setupSweep.extreme) - direction * p.bufferATR * (p.stop === 'eng' ? entryATR : setupATR), direction === -1), risk = direction * (entry - sl);
  if (!positive(entry) || !positive(sl) || !positive(risk)) return { status: 'abgelehnt', reason: 'Einstieg jenseits Stop' };
  const tp1 = round(entry + direction * p.rewardRisk * risk, direction === 1), tp2 = round(direction === 1 ? box.high : box.low, direction === -1);
  let raw3 = tp2 + direction * box.height;
  const ahead = contextLevels.filter(x => positive(x.price) && direction * (x.price - entry) > 0).sort((a, b) => direction * (a.price - b.price));
  if (ahead[0] && direction * (ahead[0].price - raw3) < 0) raw3 = ahead[0].price;
  const tp3 = round(raw3, direction === -1);
  if (![tp1, tp2, tp3].every(positive) || direction * (tp2 - tp1) < 0 || direction * (tp3 - tp2) < 0 || direction * (tp1 - entry) / risk < 2 - 1e-10) return { status: 'abgelehnt', reason: 'TP2/TP3 liegen vor vorherigem Ziel; kein geordnetes 2R-Setup' };
  return { status: 'bereit', direction, entry, sl, tps: [tp1, tp2, tp3], risk, rewardRisk: direction * (tp1 - entry) / risk, tickSize };
}
export function po3Score(input, config = {}) {
  const p = po3Settings(config), points = { sweep: input.sweep ? 20 : 0, retest: input.retest ? 15 : 0, bias: input.bias === input.direction ? 15 : 0,
    impulse: input.impulse ? 15 : 0, contextBias: p.contextOn && input.contextBias === input.direction ? 10 : 0, contextFvg: p.contextOn && input.contextFvg ? 10 : 0,
    volume: input.volume === true ? 8 : 0, rsi: input.rsi === true ? 4 : 0, funding: input.funding === true ? 3 : 0 };
  if (p.criteria === 'pending') { points.volume = 0; points.rsi = 0; points.funding = 0; }
  const denominator = p.contextOn ? 100 : 80, score = Object.values(points).reduce((a, b) => a + b, 0) / denominator * 100;
  return { score, points, denominator, eligible: !!input.sweep && !!input.retest && !!input.impulse && score >= 70,
    unknown: p.criteria === 'pending' ? ['volume', 'rsi', 'funding'] : ['volume', 'rsi', 'funding'].filter(k => input[k] == null), parametersKey: po3Key(p) };
}
export function fvgOverlaps(zones, selected) {
  if (!Array.isArray(selected) || selected.length < 2 || new Set(selected).size !== selected.length) return [];
  let parts = zones.filter(z => z.timeframe === selected[0] && z.alarmEligible && z.filledAt === null).map(z => ({ direction: z.direction, low: z.low, high: z.high, zones: [z] }));
  for (const tf of selected.slice(1)) parts = parts.flatMap(part => zones.filter(z => z.timeframe === tf && z.alarmEligible && z.filledAt === null && z.direction === part.direction).flatMap(z => {
    const low = Math.max(z.low, part.low), high = Math.min(z.high, part.high); return high > low ? [{ direction: z.direction, low, high, zones: [...part.zones, z] }] : []; }));
  return parts.map(p => ({ ...p, id: JSON.stringify(p.zones.map(z => z.id).sort()), confirmedAt: Math.max(...p.zones.map(z => z.confirmedAt)), timeframes: selected.slice() }));
}
export function po3Size({ balanceUSDT, riskPercent, leverage, levels, quantityStep }, config = {}) {
  const p = po3Settings(config);
  if (![balanceUSDT, riskPercent, leverage, quantityStep].every(positive) || riskPercent > 100 || levels?.status !== 'bereit') return { status: 'nicht verfügbar', quantity: null, reason: 'Eigenes Guthaben/Risiko/Marktgrößen fehlen' };
  const loss = levels.risk + levels.entry * p.feeEntry + levels.sl * p.feeExit, raw = Math.min(balanceUSDT * riskPercent / 100 / loss, balanceUSDT * leverage / levels.entry);
  const quantity = Math.floor(raw / quantityStep + 1e-10) * quantityStep;
  return positive(quantity) ? { status: 'bereit', quantity, margin: quantity * levels.entry / leverage, riskUSDT: quantity * loss, fundingComplete: false } : { status: 'nicht verfügbar', quantity: null, reason: 'Menge unter Kontraktschritt' };
}
export function validatePo3Rows(rows, tf, asOf) { return closedCandles(rows, asOf, PO3_FRAMES[tf]); }
