// G10(a): gemeinsamer Fachkern. Keine Netzwerk-, Speicher-, DOM- oder Sendeseiteneffekte.
import { macdInDirection, advanceIndicators, closedCandles, confirmedPivots, fib618, divergenceInDirection } from './indicators.mjs';
import { patternScore } from './pattern-score.mjs';
export { ema, macd, macdInDirection, createIndicatorState, advanceIndicators, closedCandles, confirmedPivots, fib618, divergenceInDirection, divergenceInfo } from './indicators.mjs';
export { patternScore } from './pattern-score.mjs';

export const MODEL_VERSION = 'cf-1';
export const DEFAULT_SETTINGS = Object.freeze({ revision: 1, patternWeight: 15, minimumScore: 70, divergenceMaxAge: 3, slAtrFactor: 1, rewardRisk: 2, minimumNetRR: 1.5, feeEntry: .0005, feeExit: .0005 });
const finite = Number.isFinite;
const positive = x => finite(x) && x > 0;
const time = x => Number.isSafeInteger(x) && x >= 0;
const unavailable = reason => ({ status: 'nicht bewertbar', reason });
const TF = Object.freeze({ '1h': 3600e3, '4h': 14400e3, '1d': 86400e3 });

export function settings(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !Object.hasOwn(DEFAULT_SETTINGS, k))) throw new Error('Unbekannte Konfluenz-Einstellung');
  const s = { ...DEFAULT_SETTINGS, ...input };
  if (!Number.isSafeInteger(s.revision) || s.revision < 1 || !finite(s.patternWeight) || s.patternWeight < 0 || s.patternWeight > 100 || !finite(s.minimumScore) || s.minimumScore < 70 || s.minimumScore > 100 || !Number.isInteger(s.divergenceMaxAge) || s.divergenceMaxAge < 0 || !positive(s.slAtrFactor) || !finite(s.rewardRisk) || s.rewardRisk < 2 || !positive(s.minimumNetRR) || ![s.feeEntry, s.feeExit].every(x => finite(x) && x >= 0 && x < 1)) throw new Error('Ungültige Konfluenz-Einstellung');
  return Object.freeze(s);
}

export function parametersKey(input = {}) { return JSON.stringify({ model: MODEL_VERSION, ...settings(input) }); }

function validScope(s, params) {
  return s && s.venue === 'bitget' && s.product === 'USDT-FUTURES' && s.quote === 'USDT' && typeof s.instrument === 'string' && /^[A-Z0-9]+USDT$/.test(s.instrument) && Object.hasOwn(TF, s.timeframe) && Object.hasOwn(TF, s.contextTimeframe) && TF[s.contextTimeframe] > TF[s.timeframe] && ['short', 'long'].includes(s.horizon) && s.modelVersion === MODEL_VERSION && s.settingsRevision === params.revision && time(s.asOf) && Number.isSafeInteger(s.maxHoldMs) && s.maxHoldMs > 0 && finite(s.slippageBps) && s.slippageBps >= 0 && s.slippageBps < 1e4 && time(s.indicatorAnchors?.base) && time(s.indicatorAnchors?.context);
}

function sameSource(source, scope, timeframe, key) {
  return source && ['venue', 'product', 'instrument', 'quote', 'modelVersion', 'settingsRevision', 'horizon', 'maxHoldMs', 'slippageBps', 'contextTimeframe'].every(k => source[k] === scope[k]) && source.timeframe === timeframe && source.parametersKey === key && source.indicatorAnchors?.base === scope.indicatorAnchors.base && source.indicatorAnchors?.context === scope.indicatorAnchors.context;
}

function knownFrame(frame, scope, timeframe, key) {
  return frame && sameSource(frame.source, scope, timeframe, key) && time(frame.anchor) && frame.anchor === scope.indicatorAnchors[timeframe === scope.timeframe ? 'base' : 'context'] && time(frame.closedAt) && time(frame.knownAt) && frame.closedAt - frame.anchor >= 200 * TF[timeframe] && frame.knownAt >= frame.closedAt && frame.knownAt <= scope.asOf && scope.asOf - frame.closedAt < TF[timeframe] && [frame.price, frame.ema50, frame.ema200].every(positive);
}

function trend(frame) { return frame.price > frame.ema50 && frame.ema50 > frame.ema200 ? 1 : frame.price < frame.ema50 && frame.ema50 < frame.ema200 ? -1 : 0; }

export function frameSnapshot({ source, state, candles, asOf }) {
  if (!source || !Object.hasOwn(TF, source.timeframe) || state?.periodMs !== TF[source.timeframe]) throw new Error('Indikatorzustand gehört zu einer anderen Zeitebene');
  const rows = closedCandles(candles, asOf, state.periodMs), result = advanceIndicators(state, rows, asOf);
  if (!rows.length) return { frame: null, state: result.state };
  const last = rows.at(-1), v = result.values.at(-1), pivots = confirmedPivots(rows, asOf, state.periodMs);
  const zones = pivots.map(p => ({ price: p.price, direction: p.type === 'low' ? 1 : -1, confirmed: true, knownAt: p.knownAt }));
  for (const direction of [1, -1]) {
    for (let i = pivots.length - 1; i > 0; i--) {
      const fib = fib618(pivots[i - 1], pivots[i], direction, asOf);
      if (fib) { zones.push({ ...fib, direction, confirmed: true }); break; }
    }
  }
  return { state: result.state, frame: { source: { ...source, indicatorAnchors: { ...source.indicatorAnchors } }, anchor: state.anchor, closedAt: last.end, knownAt: Math.max(...rows.map(c => c.knownAt)), price: last.close, ema50: v.ema50, ema200: v.ema200, atr: v.atr,
    rsiValues: result.values.map(x => x.rsi), lastIndex: rows.length - 1, histogram: result.values.map(x => x.histogram).slice(-5), volume: last.volume, previousVolumes: rows.slice(-21, -1).map(c => c.volume), pivots, zones } };
}

export function setupInDirection({ price, atr, ema50, zones, direction, asOf }) {
  if (![price, atr, ema50].every(positive) || !Array.isArray(zones) || ![1, -1].includes(direction) || !time(asOf)) return null;
  const candidates = [{ price: ema50, direction, knownAt: asOf, confirmed: true }, ...zones];
  for (const z of zones) {
    if (!z || !positive(z.price) || ![1, -1].includes(z.direction) || !time(z.knownAt) || typeof z.confirmed !== 'boolean') return null;
  }
  return candidates.some(z => z.direction === direction && z.confirmed && z.knownAt <= asOf && direction * (price - z.price) >= 0 && Math.abs(price - z.price) <= .5 * atr);
}

export function normalizeFunding({ rate, intervalHours, at, knownAt, positiveMeans }, asOf) {
  if (!finite(rate) || !positive(intervalHours) || !time(at) || !time(knownAt) || !time(asOf) || knownAt < at || knownAt > asOf || positiveMeans !== 'long-pays') return null;
  const normalized = rate * 8 / intervalHours;
  return finite(normalized) ? normalized : null;
}

export function scoreConfluence(input, config = {}) {
  const p = settings(config), key = parametersKey(p), { scope, base, context, funding, direction, patterns } = input || {};
  if (![1, -1].includes(direction) || !validScope(scope, p)) return { ...unavailable('Signalquelle, Richtung oder Parameterrevision fehlen'), score: null };
  if (!knownFrame(base, scope, scope.timeframe, key) || !knownFrame(context, scope, scope.contextTimeframe, key)) return { ...unavailable('Trenddaten fehlen, haben weniger als 200 Kerzen, sind zukünftig oder gehören zu einer anderen Quelle/Revision'), score: null };
  const baseTrend = trend(base), contextTrend = trend(context), blocked = baseTrend === -direction && contextTrend === -direction;
  const zone = setupInDirection({ ...base, direction, asOf: scope.asOf }), macdOK = macdInDirection(base.histogram, direction);
  const divergence = divergenceInDirection(base.pivots, base.rsiValues, direction, base.lastIndex, scope.asOf, p.divergenceMaxAge);
  const rate = funding && sameSource(funding.source, scope, scope.timeframe, key) ? normalizeFunding(funding, scope.asOf) : null;
  if (zone === null || macdOK === null || rate === null || divergence === null || base.lastIndex < 1 || base.rsiValues.length !== base.lastIndex + 1 || !base.rsiValues.slice(-2).every(x => finite(x) && x >= 0 && x <= 100) || !finite(base.volume) || base.volume < 0 || !Array.isArray(base.previousVolumes) || base.previousVolumes.length !== 20 || !base.previousVolumes.every(x => finite(x) && x >= 0)) return { ...unavailable('Notwendige Setup-, RSI-, MACD-, Volumen- oder Fundingdaten fehlen'), score: null, blocked };
  const [rsiPrevious, rsiNow] = base.rsiValues.slice(-2), averageVolume = base.previousVolumes.reduce((a, b) => a + b, 0) / 20;
  const rsiInRange = direction === 1 ? rsiNow >= 30 && rsiNow <= 45 && rsiNow > rsiPrevious : rsiNow >= 55 && rsiNow <= 70 && rsiNow < rsiPrevious;
  const points = { trend: baseTrend === direction ? (contextTrend === direction ? 25 : 10) : 0, setup: zone ? 20 : 0, rsi: (rsiInRange ? 15 : 0) + (divergence ? 5 : 0), macd: macdOK ? 15 : 0, volume: base.volume > 1.5 * averageVolume ? 10 : 0, funding: direction * rate < .0005 ? 10 : 0 };
  if (p.patternWeight > 0 && Array.isArray(patterns) && patterns.some(x => x && x.knownAt <= scope.asOf && x.closedAt <= scope.asOf && x.provisional !== true && !sameSource(x.source, scope, x.timeframe === '1D' ? '1d' : x.timeframe === '1W' ? '1w' : x.timeframe, key))) return { ...unavailable('Muster stammen aus einer anderen Quelle oder Parameterrevision'), score: null, blocked, points };
  const baseScore = Object.values(points).reduce((a, b) => a + b, 0), combined = patternScore({ baseScore, weight: p.patternWeight, direction, patterns, asOf: scope.asOf });
  if (combined.score === null) return { ...combined, blocked, points, baseScore };
  const score = combined.score;
  return { status: blocked ? 'gesperrt' : score >= p.minimumScore ? 'kandidat' : score >= 50 ? 'beobachten' : 'kein Signal', score, baseScore, points, pattern: combined, blocked, direction, funding8h: rate, scope: { ...scope, indicatorAnchors: { ...scope.indicatorAnchors } }, parametersKey: key, anchors: { base: base.anchor, context: context.anchor }, candidate: !blocked && score >= p.minimumScore, reason: blocked ? 'Beide Trends gegen die Signalrichtung' : null };
}

export function combineDirections(long, short) {
  if (long?.candidate && short?.candidate) return { status: 'konflikt', candidate: false, reason: 'Long und Short zugleich; keine eindeutige Signalrichtung' };
  return long?.candidate ? long : short?.candidate ? short : { status: 'kein eindeutiger Kandidat', candidate: false };
}

export function referenceEntry(candles, decisionAt, direction, slippageBps) {
  if (!Array.isArray(candles) || !time(decisionAt) || ![1, -1].includes(direction) || !finite(slippageBps) || slippageBps < 0 || slippageBps >= 1e4) return { ...unavailable('Explizites Einstiegs-/Slippage-Modell fehlt'), entry: null };
  if (candles.some((c, i) => !c || !time(c.time) || !positive(c.open) || (i && c.time <= candles[i - 1].time))) return { ...unavailable('Einstiegskerzen unsortiert/ungültig'), entry: null };
  const next = candles.find(c => c.time >= decisionAt);
  return next ? { status: 'bereit', entry: next.open * (1 + direction * slippageBps / 1e4), at: next.time, slippageBps } : { ...unavailable('Nächster Kerzenbeginn noch nicht verfügbar'), entry: null };
}

export function tradeLevels({ entry: referencePrice, anchor, atr, direction, tickSize }, config = {}) {
  const p = settings(config);
  if (![referencePrice, anchor, atr, tickSize].every(positive) || ![1, -1].includes(direction)) return { ...unavailable('Preislevel oder Tickgröße fehlen'), sl: null, tp: null };
  const round = (value, up) => { const units = value / tickSize, nearest = Math.round(units); return (Math.abs(units - nearest) <= 1e-10 ? nearest : up ? Math.ceil(units) : Math.floor(units)) * tickSize; };
  const entry = round(referencePrice, direction === 1);
  const sl = round(anchor - direction * atr * p.slAtrFactor, direction === -1), risk = direction * (entry - sl);
  if (!positive(sl) || !positive(risk)) return { ...unavailable('Einstieg liegt jenseits des gültigen Stops'), sl: null, tp: null };
  const tp = round(entry + direction * p.rewardRisk * risk, direction === 1), rewardRisk = direction * (tp - entry) / risk;
  if (!positive(tp) || rewardRisk + 1e-10 < p.rewardRisk) return { ...unavailable('Gerundetes Ziel erfüllt das Brutto-R:R nicht'), sl: null, tp: null };
  return { status: 'bereit', entry, sl, tp, risk, rewardRisk, tickSize, direction, parametersKey: parametersKey(p) };
}

export function positionSize({ marginEUR, fx, leverage, entry }) {
  if (!positive(marginEUR) || !positive(fx) || !positive(leverage) || !positive(entry)) return { status: 'nicht verfügbar', reason: 'Selbst gewählter Einsatz oder USDT/EUR-Kurs fehlt', notionalUSDT: null, quantity: null, marginEUR: null };
  const notionalUSDT = marginEUR * fx * leverage, quantity = notionalUSDT / entry;
  return finite(notionalUSDT) && finite(quantity) ? { status: 'bereit', marginEUR, fx, leverage, notionalUSDT, quantity } : { status: 'nicht verfügbar', reason: 'Positionsgröße außerhalb des Zahlenbereichs', notionalUSDT: null, quantity: null, marginEUR: null };
}

export function crossStatus() { return { liquidationPrice: null, distance: null, approved: false, reason: 'Bitget Cross: ohne vollständige private Kontodaten nicht berechenbar' }; }

export function netPnl({ direction, quantity, entry, exit, entryAt, exitAt, funding }, config = {}) {
  const p = settings(config);
  if (![1, -1].includes(direction) || ![quantity, entry, exit].every(positive) || !time(entryAt) || !time(exitAt) || exitAt < entryAt) return { ...unavailable('Ungültiger Positions-/Zeitkontext'), net: null };
  const gross = direction * quantity * (exit - entry), fees = quantity * entry * p.feeEntry + quantity * exit * p.feeExit;
  if (!funding || !['history', 'scenario'].includes(funding.kind) || funding.complete !== true || !time(funding.from) || !time(funding.to) || funding.from > entryAt || funding.to < exitAt || !Array.isArray(funding.events)) return { ...unavailable('Fundingkosten unvollständig'), gross, fees, funding: null, net: null, costsComplete: false };
  const seen = new Set(); let cost = 0;
  for (const f of funding.events) {
    if (!f || !time(f.at) || !finite(f.rate) || !positive(f.markPrice) || !positive(f.quantity ?? quantity) || (f.quantity ?? quantity) > quantity || seen.has(f.at)) return { ...unavailable('Funding-Abrechnung ungültig oder doppelt'), gross, fees, funding: null, net: null, costsComplete: false };
    seen.add(f.at);
    // Eintritt am Abrechnungszeitpunkt zählt, Austritt genau am Zeitpunkt nicht.
    if (f.at >= entryAt && f.at < exitAt) cost += direction * (f.quantity ?? quantity) * f.markPrice * f.rate;
  }
  const net = gross - fees - cost;
  if (![gross, fees, cost, net].every(finite)) return { ...unavailable('Kosten außerhalb des Zahlenbereichs'), net: null, costsComplete: false };
  return { status: 'bereit', gross, fees, funding: cost, net, netReturn: net / (quantity * entry), costsComplete: true, costKind: funding.kind, label: funding.kind === 'history' ? 'Modelliertes Netto mit belegtem Funding' : 'Netto-Szenario; künftiges Funding unbekannt' };
}

export function costFilter({ levels, direction, entryAt, tpAt, slAt, fundingTP, fundingSL }, config = {}) {
  const p = settings(config);
  if (levels?.status !== 'bereit') return { ...unavailable('Gültige Preislevel fehlen'), passed: false, netRR: null };
  const tp = netPnl({ direction, quantity: 1, entry: levels.entry, exit: levels.tp, entryAt, exitAt: tpAt, funding: fundingTP }, p);
  const sl = netPnl({ direction, quantity: 1, entry: levels.entry, exit: levels.sl, entryAt, exitAt: slAt, funding: fundingSL }, p);
  if (tp.net === null || sl.net === null) return { ...unavailable('Vollständige Kostenszenarien fehlen'), passed: false, netRR: null, tp, sl };
  const netRR = tp.net > 0 && sl.net < 0 ? tp.net / Math.abs(sl.net) : null;
  return { status: 'bereit', passed: netRR !== null && netRR >= p.minimumNetRR, netRR, tp, sl, direction, levels: { entry: levels.entry, sl: levels.sl, tp: levels.tp }, parametersKey: parametersKey(p) };
}

// Eine Score-Kandidatur allein erteilt keine Freigabe zur Weiterleitung.
export function signalDecision({ signal, levels, costs, conflict = false }, config = {}) {
  const p = settings(config);
  if (conflict) return { eligible: false, reason: 'Widersprüchliche Long-/Short-Kandidaten' };
  if (!signal?.candidate || signal.blocked || !finite(signal.score) || signal.score < p.minimumScore || signal.parametersKey !== parametersKey(p)) return { eligible: false, reason: 'Score-, Trend- oder Parameterprüfung nicht bestanden' };
  if (levels?.status !== 'bereit' || levels.direction !== signal.direction || levels.parametersKey !== signal.parametersKey || !positive(levels.risk) || !finite(levels.rewardRisk) || levels.rewardRisk + 1e-10 < p.rewardRisk) return { eligible: false, reason: 'Gültige Preislevel mit mindestens 2R fehlen' };
  if (costs?.direction !== signal.direction || costs?.parametersKey !== signal.parametersKey || !['entry', 'sl', 'tp'].every(k => costs?.levels?.[k] === levels[k])) return { eligible: false, reason: 'Kosten gehören zu einer anderen Richtung, Preisplanung oder Parameterrevision' };
  if (costs?.status !== 'bereit' || !costs.passed || !finite(costs.netRR) || costs.netRR < p.minimumNetRR || !positive(costs.tp?.net) || !finite(costs.sl?.net) || costs.sl.net >= 0) return { eligible: false, reason: 'Kostenprüfung nicht bestanden oder nicht bewertbar' };
  return { eligible: true, reason: 'Score, Trend, Preislevel und Kostenszenario geprüft; keine Orderfreigabe' };
}

// Einzelfall-Auflösung; der vollständige Simulator/Worker folgt erst in G10(d).
export function barrierOutcome(candle, levels, direction) {
  if (![1, -1].includes(direction) || levels?.status !== 'bereit' || levels.direction !== direction || !candle || ![candle.open, candle.high, candle.low, candle.close].every(positive) || candle.high < Math.max(candle.open, candle.close) || candle.low > Math.min(candle.open, candle.close)) return null;
  const stop = direction === 1 ? candle.low <= levels.sl : candle.high >= levels.sl;
  const target = direction === 1 ? candle.high >= levels.tp : candle.low <= levels.tp;
  return stop ? 'sl' : target ? 'tp' : 'offen'; // beide getroffen: konservativ Stop
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}
function cohortScope(a, b) { return a && ['venue', 'product', 'instrument', 'quote', 'timeframe', 'contextTimeframe', 'horizon', 'modelVersion', 'settingsRevision', 'direction', 'maxHoldMs', 'slippageBps'].every(k => a[k] === b[k]) && JSON.stringify(stable(a.indicatorAnchors)) === JSON.stringify(stable(b.indicatorAnchors)); }

export function cohortStats(cases, { scope, targetScore, from, asOf, sizing = null }, config = {}) {
  const p = settings(config), key = parametersKey(p);
  if (!Array.isArray(cases) || !validScope(scope, p) || ![1, -1].includes(scope.direction) || !finite(targetScore) || targetScore < 0 || targetScore > 100 || !time(from) || !time(asOf) || from > asOf || asOf !== scope.asOf) return { ...unavailable('Ungültiger Kohortenfilter'), n: 0, tpPercent: null, expectedEUR: null };
  const byID = new Map(), conflicts = new Set(); let immature = 0, gaps = 0, incompleteCosts = 0;
  for (const c of cases) {
    if (!c || !cohortScope(c.scope, scope) || c.parametersKey !== key || !finite(c.score) || c.score < p.minimumScore || Math.abs(c.score - targetScore) > 10 || !time(c.decisionAt) || c.decisionAt < from || c.decisionAt > asOf) continue;
    if (typeof c.id !== 'string' || !c.id || c.maxHoldMs !== scope.maxHoldMs) continue;
    // Identische Wiederimporte zählen einmal; widersprüchliche IDs gehen nie in die Quote.
    if (byID.has(c.id) && JSON.stringify(stable(byID.get(c.id))) !== JSON.stringify(stable(c))) conflicts.add(c.id);
    else byID.set(c.id, c);
  }
  const evaluated = [];
  for (const [id, c] of byID) {
    if (conflicts.has(id)) continue;
    if (!time(c.entryAt) || c.entryAt < c.decisionAt) { gaps++; continue; }
    const deadline = c.entryAt + c.maxHoldMs;
    if (deadline > asOf) { immature++; continue; }
    if (c.outcome === 'gap' || !['tp', 'sl', 'timeout'].includes(c.outcome) || !time(c.resolvedAt) || c.resolvedAt > deadline || c.resolvedAt < c.entryAt || (c.outcome === 'timeout' && c.resolvedAt !== deadline)) { gaps++; continue; }
    if (c.costsComplete !== true || c.costKind !== 'history' || !finite(c.netReturn)) incompleteCosts++;
    evaluated.push(c);
  }
  const n = evaluated.length, tp = evaluated.filter(c => c.outcome === 'tp').length, sl = evaluated.filter(c => c.outcome === 'sl').length;
  const timeout = { positive: 0, negative: 0, zero: 0, unknownCosts: 0 };
  for (const c of evaluated.filter(x => x.outcome === 'timeout')) timeout[c.costsComplete !== true || c.costKind !== 'history' || !finite(c.netReturn) ? 'unknownCosts' : c.netReturn > 0 ? 'positive' : c.netReturn < 0 ? 'negative' : 'zero']++;
  const enough = n >= 30, tpPercent = enough ? 100 * tp / n : null, meanNetReturn = enough && incompleteCosts === 0 ? evaluated.reduce((a, c) => a + c.netReturn, 0) / n : null;
  const size = positionSize(sizing || {}), expectedEUR = meanNetReturn !== null && size.status === 'bereit' ? meanNetReturn * size.notionalUSDT / size.fx : null;
  return { status: enough ? 'bereit' : 'zu wenig Daten', n, tp, sl, timeout, tpPercent, meanNetReturn, expectedEUR, weak: enough && p.rewardRisk === 2 && tpPercent < 40, immature, gaps, incompleteCosts, conflicts: conflicts.size,
    requestedPeriod: { from, to: asOf }, samplePeriod: n ? { from: Math.min(...evaluated.map(c => c.decisionAt)), to: Math.max(...evaluated.map(c => c.resolvedAt)) } : null, label: 'Historische Auswertung, keine Garantie.' };
}
