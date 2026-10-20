// Kausales Muster-Modell. Keine Netzwerkzugriffe, Börsenschlüssel oder echten Orders.
// 3.68.0: zusätzlich Konfluenz und Power of Three (aus den entfernten KI-Signalen) auf den Binance-Kerzen des Charts,
// Short-Trades und Hebel mit modellierter isolierter Liquidation.
import { INTERVAL_MS } from './market-intervals.mjs';
import { createIndicatorState, advanceIndicators, confirmedPivots, fib618, divergenceInDirection, macdInDirection } from './indicators.mjs';
import { accumulation, manipulation, po3Fvg, po3Retest, po3Impulse, po3Bias, po3Score } from './po3-core.mjs';
export const MUSTER_VERSION = 'hammer-engulfing-1';
// Eigene Kennung für die neuen Modelle; Hammer/Engulfing behalten ihre bisherigen Signal-IDs (keine doppelten Meldungen).
export const MUSTER_MODELS_VERSION = 'muster-modelle-1';
export const MUSTER_PATTERNS = Object.freeze(['hammer', 'engulfing', 'both', 'confluence', 'po3']);
export const MUSTER_MMR = .005; // modellierte Wartungsmarge für die isolierte Liquidation
export const MUSTER_DEFAULTS = Object.freeze({ capital: 1000, riskPercent: 1, feePercent: .05, supportBars: 20, atrPeriod: 14, trendFilter: false, emaPeriod: 50,
  pattern: 'both', timeframe: '15m', hammerBodyMax: .35, hammerLowerMin: .6, hammerWickBody: 2, hammerUpperMax: .15, hammerRangeATR: .5,
  engulfBodyATR: .5, supportDistanceATR: .5, volumePeriod: 20, hammerEntry: 'instant', engulfEntry: 'instant', buyOffsetATR: .05, stopOffsetATR: .1, buyValidBars: 1, rewardRisk: 2, days: 90,
  leverage: 1, sizing: 'risk', marginPercent: 10, allowShort: true, confMinScore: 70, confStopATR: 1, po3BoxBars: 6, po3BoxATR: 1.5, po3ImpulseFactor: 1.5, po3BufferATR: .1, po3ExpiryBars: 20 });
const bounds = { capital: [1, 1e9], riskPercent: [.01, 10], feePercent: [0, 5], supportBars: [2, 200], atrPeriod: [2, 100], emaPeriod: [2, 200], hammerBodyMax: [0, 1], hammerLowerMin: [0, 1], hammerWickBody: [0, 20], hammerUpperMax: [0, 1], hammerRangeATR: [0, 10], engulfBodyATR: [0, 10], supportDistanceATR: [0, 10], volumePeriod: [2, 200], buyOffsetATR: [0, 10], stopOffsetATR: [0, 10], buyValidBars: [1, 100], rewardRisk: [.1, 20], days: [1, 365],
  leverage: [1, 50], marginPercent: [1, 100], confMinScore: [50, 100], confStopATR: [.1, 10], po3BoxBars: [6, 100], po3BoxATR: [.1, 10], po3ImpulseFactor: [.5, 10], po3BufferATR: [0, 5], po3ExpiryBars: [1, 200] };
const integers = ['supportBars', 'atrPeriod', 'emaPeriod', 'volumePeriod', 'buyValidBars', 'days', 'po3BoxBars', 'po3ExpiryBars'];
export function musterSettings(input = {}) {
  const c = { ...MUSTER_DEFAULTS, ...input };
  if (Object.keys(c).some(k => !Object.hasOwn(MUSTER_DEFAULTS, k))) throw new Error('Unbekannte Muster-Bot-Einstellung');
  for (const [key, [min, max]] of Object.entries(bounds)) if (!Number.isFinite(c[key]) || c[key] < min || c[key] > max || (integers.includes(key) && !Number.isInteger(c[key]))) throw new Error(`„${key}“ muss zwischen ${min} und ${max} liegen`);
  if (!MUSTER_PATTERNS.includes(c.pattern) || !['5m', '15m', '1h'].includes(c.timeframe) || ![c.hammerEntry, c.engulfEntry].every(x => ['instant', 'buy-stop', 'close'].includes(x)) || !['risk', 'margin'].includes(c.sizing) || typeof c.trendFilter !== 'boolean' || typeof c.allowShort !== 'boolean') throw new Error('Muster, Zeitrahmen oder Einstiegsmodus ungültig');
  return c;
}
export const musterModel = pattern => pattern === 'confluence' || pattern === 'po3';
// Vorlauf geschlossener Kerzen vor dem Auswertungsfenster (EMA200 braucht 200 Kerzen auf beiden Ebenen).
export function musterWarmup(config) { return Math.max(config.atrPeriod, config.volumePeriod, config.emaPeriod, config.supportBars, config.pattern === 'confluence' ? 205 : config.pattern === 'po3' ? 60 : 0) + 5; }
export function musterCandles(rows, timeframe, asOf = Date.now()) {
  const ms = INTERVAL_MS[timeframe]; if (!Number.isSafeInteger(asOf) || asOf < 0) throw new Error('Kerzen-Kenntniszeit fehlt'); if (!ms) throw new Error('Kerzenintervall fehlt');
  const out = []; for (const row of rows) {
    const c = Array.isArray(row) ? { time: +row[0], open: +row[1], high: +row[2], low: +row[3], close: +row[4], volume: +row[5], end: +row[6] + 1 } : { ...row };
    if (![c.time, c.open, c.high, c.low, c.close, c.volume, c.end].every(Number.isFinite) || c.end !== c.time + ms || c.time < 0 || Math.min(c.open, c.low, c.close) <= 0 || c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close) || c.volume < 0) throw new Error('Muster-Bot: ungültige Kerze');
    if (c.end > asOf || (c.knownAt != null && c.knownAt > asOf)) continue;
    if (out.length && c.time !== out.at(-1).end) throw new Error('Muster-Bot: Datenlücke oder doppelte Kerze');
    out.push(c);
  } return out;
}
export function musterIndicators(rows, c) {
  let trSum = 0, atr = null, ema = null, sum = 0, volumeSum = 0;
  return rows.map((bar, i) => {
    const tr = i ? Math.max(bar.high - bar.low, Math.abs(bar.high - rows[i - 1].close), Math.abs(bar.low - rows[i - 1].close)) : bar.high - bar.low;
    if (i < c.atrPeriod) { trSum += tr; if (i === c.atrPeriod - 1) atr = trSum / c.atrPeriod; } else atr = (atr * (c.atrPeriod - 1) + tr) / c.atrPeriod;
    if (i < c.emaPeriod) { sum += bar.close; if (i === c.emaPeriod - 1) ema = sum / c.emaPeriod; } else ema += 2 / (c.emaPeriod + 1) * (bar.close - ema);
    volumeSum += bar.volume; if (i >= c.volumePeriod) volumeSum -= rows[i - c.volumePeriod].volume;
    return { atr, ema, volumeMean: i >= c.volumePeriod - 1 ? volumeSum / c.volumePeriod : null };
  });
}
export function musterPattern(rows, i, value, config) {
  const b = rows[i], p = rows[i - 1], atr = value.atr;
  if (!(atr > 0) || !(value.volumeMean > 0) || !(b.volume > value.volumeMean)) return null;
  const span = b.high - b.low, body = Math.abs(b.close - b.open), lower = Math.min(b.open, b.close) - b.low, upper = b.high - Math.max(b.open, b.close);
  const hammer = span > 0 && body <= config.hammerBodyMax * span && lower >= config.hammerLowerMin * span && lower >= config.hammerWickBody * body && upper <= config.hammerUpperMax * span && span >= config.hammerRangeATR * atr;
  const engulf = p && p.close < p.open && b.close > b.open && b.open <= p.close && b.close >= p.open && body >= config.engulfBodyATR * atr;
  if (hammer && config.pattern !== 'engulfing') return { pattern: 'hammer', direction: 1, low: b.low, high: b.high, atr, time: b.time, end: b.end, entryMode: config.hammerEntry };
  if (engulf && config.pattern !== 'hammer') return { pattern: 'engulfing', direction: 1, low: Math.min(p.low, b.low), high: b.high, atr, time: b.time, end: b.end, entryMode: config.engulfEntry };
  return null;
}
export function musterContext(htf, values, index, config) {
  if (index < config.supportBars - 1 || !(values[index]?.atr > 0)) return null;
  const last = htf[index], value = values[index]; if (config.trendFilter && !(value.ema != null && last.close > value.ema)) return null;
  return { support: Math.min(...htf.slice(index + 1 - config.supportBars, index + 1).map(x => x.low)), atr: value.atr, closedAt: last.end, ema: value.ema };
}

// Gemeinsame Indikatoren des früheren KI-Kerns (EMA50/200, RSI, ATR, MACD) auf einer Muster-Reihe.
function frameValues(rows, timeframe) {
  if (!rows.length) return { values: [], pivots: [] };
  const periodMs = INTERVAL_MS[timeframe], known = rows.map(c => ({ ...c, knownAt: c.end })), asOf = known.at(-1).end;
  const { values } = advanceIndicators(createIndicatorState({ time: known[0].time, periodMs }), known, asOf);
  return { values, pivots: confirmedPivots(known, asOf, periodMs) };
}
const trendOf = (price, v) => v && v.ema50 != null && v.ema200 != null ? (price > v.ema50 && v.ema50 > v.ema200 ? 1 : price < v.ema50 && v.ema50 < v.ema200 ? -1 : 0) : null;

// Konfluenz wie in den bisherigen KI-Signalen: Trend 25/10, Setup-Zone 20, RSI 15 (+5 Divergenz), MACD 15, Volumen 10.
// Funding ist im Muster-Bot nicht verfügbar; der Score wird deshalb auf 90 erreichbare Punkte normiert (0–100).
export function confluenceSignal({ bars, base, htf, higher, i, htfIndex, config }) {
  const v = base.values[i], b = bars[i], asOf = b.end;
  if (i < 25 || !(v?.atr > 0) || v.ema200 == null || htfIndex < 0) return null;
  const contextTrend = trendOf(htf[htfIndex].close, higher.values[htfIndex]); if (contextTrend === null) return null;
  const rsiValues = base.rsi, rsiNow = rsiValues[i], rsiPrevious = rsiValues[i - 1], histogram = base.histogram.slice(i - 4, i + 1);
  if (![rsiNow, rsiPrevious].every(Number.isFinite) || !histogram.every(Number.isFinite)) return null;
  const known = base.pivots.filter(p => p.confirmedIndex <= i).slice(-40), zones = known.map(p => ({ price: p.price, direction: p.type === 'low' ? 1 : -1 }));
  for (const direction of [1, -1]) for (let k = known.length - 1; k > 0; k--) { const f = fib618(known[k - 1], known[k], direction, asOf); if (f) { zones.push({ price: f.price, direction }); break; } }
  const averageVolume = bars.slice(i - 20, i).reduce((s, x) => s + x.volume, 0) / 20, baseTrend = trendOf(b.close, v), found = [];
  for (const direction of [1, -1]) {
    if (direction === -1 && !config.allowShort) continue;
    const near = [{ price: v.ema50, direction }, ...zones].filter(z => z.direction === direction && direction * (b.close - z.price) >= 0 && Math.abs(b.close - z.price) <= .5 * v.atr).sort((x, y) => Math.abs(b.close - x.price) - Math.abs(b.close - y.price))[0];
    const rsiOK = direction === 1 ? rsiNow >= 30 && rsiNow <= 45 && rsiNow > rsiPrevious : rsiNow >= 55 && rsiNow <= 70 && rsiNow < rsiPrevious;
    const divergence = divergenceInDirection(base.pivots, rsiValues, direction, i, asOf, 3) === true, macdOK = macdInDirection(histogram, direction) === true;
    const points = { trend: baseTrend === direction ? (contextTrend === direction ? 25 : 10) : 0, setup: near ? 20 : 0, rsi: (rsiOK ? 15 : 0) + (divergence ? 5 : 0), macd: macdOK ? 15 : 0, volume: averageVolume > 0 && b.volume > 1.5 * averageVolume ? 10 : 0 };
    const score = Math.round(Object.values(points).reduce((s, x) => s + x, 0) / 90 * 100), blocked = baseTrend === -direction && contextTrend === -direction;
    if (!blocked && score >= config.confMinScore) {
      const recent = bars.slice(i - 2, i + 1), anchor = near ? near.price : direction === 1 ? Math.min(...recent.map(x => x.low)) : Math.max(...recent.map(x => x.high));
      found.push({ pattern: 'confluence', direction, score, points, anchor, stop: anchor - direction * config.confStopATR * v.atr, low: Math.min(b.low, anchor), high: Math.max(b.high, anchor), atr: v.atr, time: b.time, end: b.end, entryMode: 'instant' });
    }
  }
  return found.length === 1 ? found[0] : null; // Long und Short zugleich: kein eindeutiges Signal
}

// Power of Three auf einer Ebene: Box (Akkumulation) → Sweep (Manipulation) → FVG-Retest → Impuls über die Gegenstruktur.
// Bias aus den abgeschlossenen 4h-Kerzen (EMA50 und Hoch/Tief-Folge); Score und Mindestwert 70 wie im bisherigen PO3-Modell.
export function createPo3Detector(config, symbol) {
  const rules = { boxBars: config.po3BoxBars, boxATR: config.po3BoxATR, impulseFactor: config.po3ImpulseFactor, bufferATR: Math.max(.01, config.po3BufferATR || .01) };
  let active = null;
  return function step({ bars, atrs, i, htf, higher, htfIndex }) {
    const b = bars[i], atr = atrs[i];
    if (!(atr > 0)) return null;
    if (active && i - active.sweepIndex > config.po3ExpiryBars) active = null;
    if (!active) {
      const box = accumulation(bars.slice(Math.max(0, i - config.po3BoxBars), i), atrs[i - 1], rules), sweep = box ? manipulation(box, b) : null;
      if (sweep?.direction && (sweep.direction === 1 || config.allowShort)) active = { direction: sweep.direction, sweep, box, sweepIndex: i, zone: null, retest: false };
      return null;
    }
    const d = active.direction;
    if (!active.zone && i - active.sweepIndex >= 2) { const z = po3Fvg(bars.slice(i - 2, i + 1), { timeframe: config.timeframe, atr, instrument: symbol, after: active.sweep.time }); if (z?.direction === d) active.zone = z; return null; }
    if (active.zone && !active.retest && po3Retest(active.zone, b)) active.retest = true;
    if (!active.retest) return null;
    const between = bars.slice(active.sweepIndex, i), counter = d === 1 ? Math.max(...between.map(x => x.high)) : Math.min(...between.map(x => x.low));
    if (!po3Impulse(bars.slice(Math.max(0, i - 10), i + 1), d, counter, rules)) return null;
    let bias = 0;
    if (htfIndex >= 0 && higher.values[htfIndex]?.ema50 > 0) bias = po3Bias({ pivots: higher.pivots.filter(p => p.confirmedIndex <= htfIndex), price: htf[htfIndex].close, ema50: higher.values[htfIndex].ema50, asOf: htf[htfIndex].end }).direction;
    const score = po3Score({ sweep: true, retest: true, impulse: true, bias, direction: d }), signal = { pattern: 'po3', direction: d, score: Math.round(score.score), points: score.points, sweep: active.sweep.extreme,
      stop: active.sweep.extreme - d * config.po3BufferATR * atr, low: Math.min(b.low, active.sweep.extreme), high: Math.max(b.high, active.sweep.extreme), box: { high: active.box.high, low: active.box.low }, atr, time: b.time, end: b.end, entryMode: 'instant' };
    active = null;
    return score.eligible ? signal : null;
  };
}

export function runMusterBacktest({ rows, context, config: input = {}, asOf = Date.now(), startTime = 0, symbol = 'BTCUSDT', market = 'spot', liveOpen = null }) {
  const config = musterSettings(input), bars = musterCandles(rows, config.timeframe, asOf), htf = musterCandles(context, '4h', asOf), indicators = musterIndicators(bars, config), higher = musterIndicators(htf, config);
  const model = musterModel(config.pattern), base = model ? frameValues(bars, config.timeframe) : null, higherFrame = model ? frameValues(htf, '4h') : null;
  if (base) { base.rsi = base.values.map(x => x.rsi); base.histogram = base.values.map(x => x.histogram); }
  const po3 = config.pattern === 'po3' ? createPo3Detector(config, symbol) : null, atrs = po3 ? base.values.map(x => x.atr) : null;
  let cash = config.capital, position = null, pending = null, highWater = cash, drawdown = 0, htfIndex = -1;
  const trades = [], signals = [], equity = [], events = [], fee = config.feePercent / 100, lev = config.leverage;
  const key = p => [musterModel(p.pattern) ? MUSTER_MODELS_VERSION : MUSTER_VERSION, market, symbol, config.timeframe, p.pattern, p.time, p.entryMode, ...(musterModel(p.pattern) ? [p.direction] : [])].join('|');
  function enter(p, price, time, index) {
    const d = p.direction || 1, stop = p.stop, risk = d * (price - stop); if (!(stop > 0) || !(risk > 0) || !(price > 0) || !(cash > 0)) return;
    // Größe: Risiko in % des Guthabens (Abstand zum Stop) oder Einsatz (Margin) in % × Hebel. Immer begrenzt durch
    // Margin + Einstiegsgebühr ≤ Guthaben (bei Hebel 1 wie bisher: kein versteckter Hebel).
    const wanted = config.sizing === 'margin' ? cash * config.marginPercent / 100 * lev / price : cash * config.riskPercent / 100 / risk, quantity = Math.min(wanted, cash / (price * (1 / lev + fee)));
    const riskQuantity = wanted;
    if (!(quantity > 0)) return;
    const entryFee = quantity * price * fee, margin = quantity * price / lev, liquidation = d === 1 ? (lev > 1 ? price * (1 - 1 / lev + MUSTER_MMR) : null) : price * (1 + 1 / lev - MUSTER_MMR); cash -= entryFee; // Long ohne Hebel: keine Liquidation
    position = { id: key(p), pattern: p.pattern, direction: d, score: p.score ?? null, signalTime: p.time, entryMode: p.entryMode, entry: price, stop, target: price + d * config.rewardRisk * risk, quantity, riskCash: quantity * risk, entryFee, margin, leverage: lev, liquidation: liquidation > 0 ? liquidation : null, openedAt: time, openedIndex: index, capitalCapped: quantity < riskQuantity, symbol, market, timeframe: config.timeframe };
    events.push({ kind: 'entry', at: time, ...position });
  }
  function exit(price, time, reason) {
    // Liquidation: die ganze isolierte Margin ist weg (die Restmarge behält die Börse).
    const p = position, exitFee = p.quantity * price * fee, gross = reason === 'Liquidation' ? -p.margin : Math.max(p.direction * p.quantity * (price - p.entry), -p.margin), pnl = gross - p.entryFee - exitFee;
    cash += gross - exitFee; const trade = { ...p, exit: price, closedAt: time, reason, gross, pnl, fees: p.entryFee + exitFee, r: pnl / p.riskCash };
    trades.push(trade); events.push({ kind: 'exit', at: time, ...trade }); position = null;
  }
  function protect(bar, justEntered = false) {
    if (!position) return;
    const d = position.direction, liq = position.liquidation, adverse = d === 1 ? bar.low : bar.high, favorable = d === 1 ? bar.high : bar.low;
    // Liquidation vor dem Stop, wenn der Stop jenseits des Liquidationspreises liegt (zu hoher Hebel für den Stopabstand).
    if (liq && d * (adverse - liq) <= 0 && d * (position.stop - liq) < 0) exit(liq, bar.end, 'Liquidation');
    // Gaps: Stop zum schlechteren Open, Ziel konservativ zum Zielpreis. Bei SL+TP stets SL.
    else if (d * (adverse - position.stop) <= 0) exit(!justEntered && d * (bar.open - position.stop) < 0 ? bar.open : position.stop, bar.end, 'Stop');
    else if (d * (favorable - position.target) >= 0) exit(position.target, bar.end, 'Ziel');
  }
  function mark(time, price) {
    const value = cash + (position ? Math.max(position.direction * position.quantity * (price - position.entry), -position.margin) : 0); highWater = Math.max(highWater, value); drawdown = Math.max(drawdown, highWater > 0 ? (highWater - value) / highWater * 100 : 0); equity.push({ time, value });
  }
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]; while (htfIndex + 1 < htf.length && htf[htfIndex + 1].end <= b.end && (htf[htfIndex + 1].knownAt ?? htf[htfIndex + 1].end) <= b.end) htfIndex++;
    // PO3 verfolgt seinen Ablauf über alle Kerzen (auch vor dem Fenster), damit kein Zustand erfunden wird.
    const po3Signal = po3 ? po3({ bars, atrs, i, htf, higher: higherFrame, htfIndex }) : null;
    if (b.end < startTime) continue;
    let entered = false;
    if (pending) {
      const p = pending;
      if (p.stage === 'open' && i === p.nextIndex) { pending = null; enter(p, b.open, b.time, i); entered = !!position; }
      else if (p.stage === 'open' && i > p.nextIndex) pending = null;
      else if (p.stage === 'buy-stop') {
        if (i > p.expiresIndex) pending = null;
        else if (i > p.patternIndex && b.high >= p.orderPrice) { pending = null; enter(p, Math.max(b.open, p.orderPrice), b.open >= p.orderPrice ? b.time : b.end, i); entered = !!position; }
      } else if (p.stage === 'confirmation' && i === p.patternIndex + 1) {
        pending = b.close > p.high ? { ...p, stage: 'open', nextIndex: i + 1, stop: Math.min(p.low, b.low) - config.stopOffsetATR * p.atr } : null;
      }
    }
    protect(b, entered);
    if (!position && !pending) {
      let p = null;
      if (config.pattern === 'confluence') { const s = confluenceSignal({ bars, base, htf, higher: higherFrame, i, htfIndex, config }); if (s && s.stop > 0) p = { ...s, patternIndex: i }; }
      else if (po3) { if (po3Signal && po3Signal.stop > 0) p = { ...po3Signal, patternIndex: i }; }
      else {
        const pattern = musterPattern(bars, i, indicators[i], config), ctx = musterContext(htf, higher, htfIndex, config);
        if (pattern && ctx && pattern.low > config.stopOffsetATR * pattern.atr && pattern.low <= ctx.support + config.supportDistanceATR * ctx.atr) p = { ...pattern, stop: pattern.low - config.stopOffsetATR * pattern.atr, patternIndex: i, context: ctx };
      }
      if (p) {
        p.id = key(p); signals.push(p);
        pending = p.entryMode === 'instant' ? { ...p, stage: 'open', nextIndex: i + 1 } : p.entryMode === 'buy-stop' ? { ...p, stage: 'buy-stop', orderPrice: p.high + config.buyOffsetATR * p.atr, expiresIndex: i + config.buyValidBars } : { ...p, stage: 'confirmation' };
        events.push({ kind: 'signal', ...pending, at: b.end });
      }
    }
    mark(b.end, b.close);
  }
  // Nur das bereits bekannte Open der laufenden Kerze. Weder High/Low noch ihr Schluss gehen in die Strategie ein.
  if (liveOpen && bars.length && liveOpen.time === bars.at(-1).end && liveOpen.time <= asOf && liveOpen.open > 0) {
    const i = bars.length;
    if (pending?.stage === 'open' && pending.nextIndex === i) { const p = pending; pending = null; enter(p, liveOpen.open, liveOpen.time, i); }
    else if (pending?.stage === 'buy-stop' && i <= pending.expiresIndex && liveOpen.open >= pending.orderPrice) { const p = pending; pending = null; enter(p, liveOpen.open, liveOpen.time, i); }
    mark(liveOpen.time, liveOpen.open);
  }
  const wins = trades.filter(t => t.pnl > 0), losses = trades.filter(t => t.pnl < 0), winSum = wins.reduce((a, t) => a + t.pnl, 0), lossSum = -losses.reduce((a, t) => a + t.pnl, 0), endEquity = equity.at(-1)?.value ?? config.capital;
  return { version: MUSTER_VERSION, config, symbol, market, trades, signals, equity, events, position, pending, cash, lastPrice: bars.at(-1)?.close ?? null,
    stats: { trades: trades.length, winRate: trades.length ? wins.length / trades.length * 100 : null, profitFactor: lossSum > 0 ? winSum / lossSum : null, noLosses: winSum > 0 && lossSum === 0, netProfitPercent: (endEquity / config.capital - 1) * 100, maxDrawdown: drawdown, averageR: trades.length ? trades.reduce((sum, t) => sum + t.r, 0) / trades.length : null, endEquity, realizedProfit: trades.reduce((sum, t) => sum + t.pnl, 0), liquidations: trades.filter(t => t.reason === 'Liquidation').length, lowSample: trades.length < 100 } };
}
// Vergleich: 27 Hammer/Engulfing-Varianten plus Konfluenz und PO3 je Zeitrahmen (Einstieg immer zur nächsten Öffnung).
export function musterCombinations(config) {
  const base = musterSettings(config);
  return [...['hammer', 'engulfing', 'both'].flatMap(pattern => ['5m', '15m', '1h'].flatMap(timeframe => ['instant', 'buy-stop', 'close'].map(entry => ({ ...base, pattern, timeframe, hammerEntry: entry, engulfEntry: entry })))),
    ...['confluence', 'po3'].flatMap(pattern => ['5m', '15m', '1h'].map(timeframe => ({ ...base, pattern, timeframe, hammerEntry: 'instant', engulfEntry: 'instant' })))];
}
