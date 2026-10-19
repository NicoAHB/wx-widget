// Reine Information: kein Signalfilter und keine Verbindung zu Heikin-Ashi oder Chart-Einstellungen.
import { ema, confirmedPivots } from './indicators.mjs';
import { musterIndicators } from './muster-bot-core.mjs';
import { analysisClosed } from './analysis-top-down.mjs';
import { directionalMovement } from './directional-movement.mjs';
import { INTERVAL_MS } from './market-intervals.mjs';

// Startwerte ausschließlich hier ändern. Feste Messfenster machen Live-/Neustart-/Historienwerte identisch.
export const PHASE_ZEITRAHMEN = '1h';
export const MARKET_PHASE = Object.freeze({ version: 'market-phase-1', metricBars: 300, replayBars: 100,
  swingLeft: 3, swingRight: 3, emaFast: 20, emaMiddle: 50, emaSlow: 200,
  slopeBars: 10, slopeATR: .3, atrPeriod: 14, adxPeriod: 14, minADX: 20,
  efficiencyBars: 30, minEfficiency: .25, minVotes: 3, confirmations: 2,
  closeGraceMs: 2500, staleGraceMs: 15000, requestSpacingMs: 400, retryMs: 30000, maxRetryMs: 300000,
  checkMonths: 6, checkForwardBars: 24, checkMoveATR: 3, historyChunkDays: 14,
  maxLog: 10000, visibleLog: 100 });
export const PHASE_CACHE_KEY = 'scalpdesk.idb.market-phase.cache.v1';
export const PHASE_LOG_KEY = 'scalpdesk.idb.market-phase.log.v1';
export const PHASE_CHECK_KEY = 'scalpdesk.idb.market-phase.check.v1';
export const PHASE_NAMES = Object.freeze({ '1': 'Aufwärts', '-1': 'Abwärts', '0': 'Seitwärts' });
export const PHASE_ARROWS = Object.freeze({ '1': '↗', '-1': '↘', '0': '→' });
export const PHASE_MS = INTERVAL_MS[PHASE_ZEITRAHMEN];
export const phaseHistoryBars = () => MARKET_PHASE.metricBars + MARKET_PHASE.replayBars - 1;
export const unknownPhase = reason => ({ ready: false, phase: null, votes: {}, count: null, at: null, reason });

export function phaseMeasurement(rows) {
  if (rows.length < MARKET_PHASE.metricBars) return null;
  const bars = rows.slice(-MARKET_PHASE.metricBars), last = bars.at(-1), prices = bars.map(c => c.close),
    fast = ema(prices, MARKET_PHASE.emaFast).at(-1), middle = ema(prices, MARKET_PHASE.emaMiddle), slow = ema(prices, MARKET_PHASE.emaSlow).at(-1),
    atr = musterIndicators(bars, { atrPeriod: MARKET_PHASE.atrPeriod, emaPeriod: MARKET_PHASE.emaMiddle, volumePeriod: 1 }).at(-1).atr,
    dmi = directionalMovement(bars, MARKET_PHASE.adxPeriod).at(-1),
    pivots = confirmedPivots(bars, last.end, PHASE_MS, { left: MARKET_PHASE.swingLeft, right: MARKET_PHASE.swingRight }),
    highs = pivots.filter(p => p.type === 'high').slice(-2), lows = pivots.filter(p => p.type === 'low').slice(-2);
  const structure = highs.length === 2 && lows.length === 2
    ? highs[1].price > highs[0].price && lows[1].price > lows[0].price ? 1 : highs[1].price < highs[0].price && lows[1].price < lows[0].price ? -1 : 0 : 0;
  const slope = middle.at(-1) - middle.at(-1 - MARKET_PHASE.slopeBars), slopeThreshold = MARKET_PHASE.slopeATR * atr,
    emaDirection = fast > middle.at(-1) && middle.at(-1) > slow && slope >= slopeThreshold && slope > 0 ? 1
      : fast < middle.at(-1) && middle.at(-1) < slow && slope <= -slopeThreshold && slope < 0 ? -1 : 0,
    strength = dmi.adx < MARKET_PHASE.minADX ? 0 : dmi.plusDI > dmi.minusDI ? 1 : -1;
  const move = last.close - prices.at(-1 - MARKET_PHASE.efficiencyBars);
  let path = 0;
  for (let i = bars.length - MARKET_PHASE.efficiencyBars; i < bars.length; i++) path += Math.abs(prices[i] - prices[i - 1]);
  const efficiency = path > 0 ? Math.abs(move) / path : 0,
    efficientDirection = efficiency < MARKET_PHASE.minEfficiency ? 0 : Math.sign(move);
  const votes = {
    structure: { direction: structure, highs: highs.map(p => ({ price: p.price, time: p.time, knownAt: p.knownAt })), lows: lows.map(p => ({ price: p.price, time: p.time, knownAt: p.knownAt })) },
    ema: { direction: emaDirection, ema20: fast, ema50: middle.at(-1), ema200: slow, slope, threshold: slopeThreshold, atr },
    adx: { direction: strength, ...dmi },
    efficiency: { direction: efficientDirection, value: efficiency, move, path }
  };
  const counts = Object.fromEntries([1, -1, 0].map(d => [d, Object.values(votes).filter(v => v.direction === d).length])),
    candidate = [1, -1, 0].find(d => counts[d] >= MARKET_PHASE.minVotes) ?? 0;
  return { candidate, votes, counts, atr, at: last.end, candleTime: last.time };
}

export function prepareMarketPhase(candles, asOf) {
  const rows = analysisClosed(candles, PHASE_ZEITRAHMEN, asOf), measurements = Array(rows.length).fill(null);
  for (let i = MARKET_PHASE.metricBars - 1; i < rows.length; i++) measurements[i] = phaseMeasurement(rows.slice(Math.max(0, i + 1 - MARKET_PHASE.metricBars), i + 1));
  return { rows, measurements };
}
export function advancePhase(state, candidate) {
  if (candidate === state.phase) return { phase: state.phase, pending: null, streak: 0 };
  const streak = candidate === state.pending ? state.streak + 1 : 1;
  return streak >= MARKET_PHASE.confirmations ? { phase: candidate, pending: null, streak: 0 } : { phase: state.phase, pending: candidate, streak };
}
export function marketPhaseAt(prepared, index = prepared.rows.length - 1) {
  if (index + 1 < phaseHistoryBars()) return unknownPhase(`Mindestens ${phaseHistoryBars()} geschlossene 1H-Kerzen für Vorlauf und reproduzierbare Bestätigung nötig.`);
  let state = { phase: 0, pending: null, streak: 0 };
  for (let i = index + 1 - MARKET_PHASE.replayBars; i <= index; i++) state = advancePhase(state, prepared.measurements[i].candidate);
  const last = prepared.measurements[index];
  return { ready: true, version: MARKET_PHASE.version, ...last, ...state, count: last.counts[state.phase] };
}
export function calculateMarketPhase({ candles, now, symbol, market }) {
  const prepared = prepareMarketPhase(candles, now), result = marketPhaseAt(prepared);
  if (!result.ready) return { ...result, symbol, market };
  if (result.at !== Math.floor(now / PHASE_MS) * PHASE_MS) return { ...unknownPhase('Neueste geschlossene 1H-Kerze fehlt.'), symbol, market };
  return { ...result, symbol, market };
}
