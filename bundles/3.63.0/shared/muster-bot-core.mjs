// Kausales Long-Modell. Keine Netzwerkzugriffe, Börsenschlüssel oder echten Orders.
import { INTERVAL_MS } from './market-intervals.mjs';
export const MUSTER_VERSION = 'hammer-engulfing-1';
export const MUSTER_DEFAULTS = Object.freeze({ capital: 1000, riskPercent: 1, feePercent: .05, supportBars: 20, atrPeriod: 14, trendFilter: false, emaPeriod: 50,
  pattern: 'both', timeframe: '15m', hammerBodyMax: .35, hammerLowerMin: .6, hammerWickBody: 2, hammerUpperMax: .15, hammerRangeATR: .5,
  engulfBodyATR: .5, supportDistanceATR: .5, volumePeriod: 20, hammerEntry: 'instant', engulfEntry: 'instant', buyOffsetATR: .05, stopOffsetATR: .1, buyValidBars: 1, rewardRisk: 2, days: 90 });
const bounds = { capital: [1, 1e9], riskPercent: [.01, 10], feePercent: [0, 5], supportBars: [2, 200], atrPeriod: [2, 100], emaPeriod: [2, 200], hammerBodyMax: [0, 1], hammerLowerMin: [0, 1], hammerWickBody: [0, 20], hammerUpperMax: [0, 1], hammerRangeATR: [0, 10], engulfBodyATR: [0, 10], supportDistanceATR: [0, 10], volumePeriod: [2, 200], buyOffsetATR: [0, 10], stopOffsetATR: [0, 10], buyValidBars: [1, 100], rewardRisk: [.1, 20], days: [1, 365] };
const integers = ['supportBars', 'atrPeriod', 'emaPeriod', 'volumePeriod', 'buyValidBars', 'days'];
export function musterSettings(input = {}) {
  const c = { ...MUSTER_DEFAULTS, ...input };
  if (Object.keys(c).some(k => !Object.hasOwn(MUSTER_DEFAULTS, k))) throw new Error('Unbekannte Muster-Bot-Einstellung');
  for (const [key, [min, max]] of Object.entries(bounds)) if (!Number.isFinite(c[key]) || c[key] < min || c[key] > max || (integers.includes(key) && !Number.isInteger(c[key]))) throw new Error(`„${key}“ muss zwischen ${min} und ${max} liegen`);
  if (!['hammer', 'engulfing', 'both'].includes(c.pattern) || !['5m', '15m', '1h'].includes(c.timeframe) || ![c.hammerEntry, c.engulfEntry].every(x => ['instant', 'buy-stop', 'close'].includes(x)) || typeof c.trendFilter !== 'boolean') throw new Error('Muster, Zeitrahmen oder Einstiegsmodus ungültig');
  return c;
}
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
  if (hammer && config.pattern !== 'engulfing') return { pattern: 'hammer', low: b.low, high: b.high, atr, time: b.time, end: b.end, entryMode: config.hammerEntry };
  if (engulf && config.pattern !== 'hammer') return { pattern: 'engulfing', low: Math.min(p.low, b.low), high: b.high, atr, time: b.time, end: b.end, entryMode: config.engulfEntry };
  return null;
}
export function musterContext(htf, values, index, config) {
  if (index < config.supportBars - 1 || !(values[index]?.atr > 0)) return null;
  const last = htf[index], value = values[index]; if (config.trendFilter && !(value.ema != null && last.close > value.ema)) return null;
  return { support: Math.min(...htf.slice(index + 1 - config.supportBars, index + 1).map(x => x.low)), atr: value.atr, closedAt: last.end, ema: value.ema };
}
export function runMusterBacktest({ rows, context, config: input = {}, asOf = Date.now(), startTime = 0, symbol = 'BTCUSDT', market = 'spot', liveOpen = null }) {
  const config = musterSettings(input), bars = musterCandles(rows, config.timeframe, asOf), htf = musterCandles(context, '4h', asOf), indicators = musterIndicators(bars, config), higher = musterIndicators(htf, config);
  let cash = config.capital, position = null, pending = null, highWater = cash, drawdown = 0, htfIndex = -1;
  const trades = [], signals = [], equity = [], events = [], fee = config.feePercent / 100;
  const key = p => [MUSTER_VERSION, market, symbol, config.timeframe, p.pattern, p.time, p.entryMode].join('|');
  function enter(p, price, time, index) {
    const stop = p.stop, risk = price - stop; if (!(stop > 0) || !(risk > 0) || !(price > 0) || !(cash > 0)) return;
    const riskQuantity = cash * config.riskPercent / 100 / risk, quantity = Math.min(riskQuantity, cash / (price * (1 + fee)));
    if (!(quantity > 0)) return;
    const entryFee = quantity * price * fee; cash -= entryFee;
    position = { id: key(p), pattern: p.pattern, signalTime: p.time, entryMode: p.entryMode, entry: price, stop, target: price + config.rewardRisk * risk, quantity, riskCash: quantity * risk, entryFee, openedAt: time, openedIndex: index, capitalCapped: quantity < riskQuantity, symbol, market, timeframe: config.timeframe };
    events.push({ kind: 'entry', at: time, ...position });
  }
  function exit(price, time, reason) {
    const p = position, exitFee = p.quantity * price * fee, gross = p.quantity * (price - p.entry), pnl = gross - p.entryFee - exitFee;
    cash += gross - exitFee; const trade = { ...p, exit: price, closedAt: time, reason, gross, pnl, fees: p.entryFee + exitFee, r: pnl / p.riskCash };
    trades.push(trade); events.push({ kind: 'exit', at: time, ...trade }); position = null;
  }
  function protect(bar, justEntered = false) {
    if (!position) return;
    // Gaps: Stop zum schlechteren Open, Ziel konservativ zum Zielpreis. Bei SL+TP stets SL.
    if (bar.low <= position.stop) exit(!justEntered && bar.open < position.stop ? bar.open : position.stop, bar.end, 'Stop');
    else if (bar.high >= position.target) exit(position.target, bar.end, 'Ziel');
  }
  function mark(time, price) {
    const value = cash + (position ? position.quantity * (price - position.entry) : 0); highWater = Math.max(highWater, value); drawdown = Math.max(drawdown, highWater > 0 ? (highWater - value) / highWater * 100 : 0); equity.push({ time, value });
  }
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]; while (htfIndex + 1 < htf.length && htf[htfIndex + 1].end <= b.end && (htf[htfIndex + 1].knownAt ?? htf[htfIndex + 1].end) <= b.end) htfIndex++;
    if (b.end < startTime) continue;
    let entered = false;
    if (pending) {
      const p = pending;
      if (p.stage === 'open' && i === p.nextIndex) { pending = null; enter(p, b.open, b.time, i); entered = !!position; }
      else if (p.stage === 'buy-stop') {
        if (i > p.expiresIndex) pending = null;
        else if (i > p.patternIndex && b.high >= p.orderPrice) { pending = null; enter(p, Math.max(b.open, p.orderPrice), b.open >= p.orderPrice ? b.time : b.end, i); entered = !!position; }
      } else if (p.stage === 'confirmation' && i === p.patternIndex + 1) {
        pending = b.close > p.high ? { ...p, stage: 'open', nextIndex: i + 1, stop: Math.min(p.low, b.low) - config.stopOffsetATR * p.atr } : null;
      }
    }
    protect(b, entered);
    if (!position && !pending) {
      const pattern = musterPattern(bars, i, indicators[i], config), ctx = musterContext(htf, higher, htfIndex, config);
      if (pattern && ctx && pattern.low > config.stopOffsetATR * pattern.atr && pattern.low <= ctx.support + config.supportDistanceATR * ctx.atr) {
        const p = { ...pattern, stop: pattern.low - config.stopOffsetATR * pattern.atr, patternIndex: i, context: ctx };
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
    stats: { trades: trades.length, winRate: trades.length ? wins.length / trades.length * 100 : null, profitFactor: lossSum > 0 ? winSum / lossSum : null, noLosses: winSum > 0 && lossSum === 0, netProfitPercent: (endEquity / config.capital - 1) * 100, maxDrawdown: drawdown, averageR: trades.length ? trades.reduce((sum, t) => sum + t.r, 0) / trades.length : null, endEquity, realizedProfit: trades.reduce((sum, t) => sum + t.pnl, 0), lowSample: trades.length < 100 } };
}
export function musterCombinations(config) {
  return ['hammer', 'engulfing', 'both'].flatMap(pattern => ['5m', '15m', '1h'].flatMap(timeframe => ['instant', 'buy-stop', 'close'].map(entry => ({ ...musterSettings(config), pattern, timeframe, hammerEntry: entry, engulfEntry: entry }))));
}
