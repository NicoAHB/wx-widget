// 3.72.0: feste Modelle für Vorauswahl und gepaarten Vergleich. Keine Orders oder Netzwerkzugriffe.
export const WATCH_MODELS = Object.freeze({ classic: 'watch-classic-1', strict: 'watch-strict-1' });
export const WATCH_MODEL_KEY = 'scalpdesk.watch-model.v1';
export const WATCH_COMPARE_KEY = 'scalpdesk.watch-compare.v1';
export const WATCH_BASE_MS = 900000, WATCH_TREND_MS = 14400000, WATCH_HISTORY = 500, WATCH_WARMUP = 300;
export const WATCH_COMPARE_DEFAULTS = Object.freeze({ days: 30, feePct: .05, slippagePct: .02, stopAtr: 1.5, rewardRisk: 2, holdBars: 16 });

// Die bisherigen SMA-/Wilder-Starts und vier Signalregeln unverändert übernommen.
function rsi(closes, period = 14) {
  const out = Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    gain += Math.max(d, 0); loss += Math.max(-d, 0);
  }
  gain /= period; loss /= period;
  const value = () => gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  out[period] = value();
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = value();
  }
  return out;
}

function ema(values, period) {
  const out = Array(values.length).fill(null);
  if (values.length < period) return out;
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period; out[period - 1] = e;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) { e = values[i] * k + e * (1 - k); out[i] = e; }
  return out;
}
function macd(values, fast = 12, slow = 26, signalPeriod = 9) {
  const f = ema(values, fast), s = ema(values, slow);
  const line = values.map((_, i) => f[i] === null || s[i] === null ? null : f[i] - s[i]);
  const start = line.findIndex(v => v !== null), signal = Array(values.length).fill(null);
  if (start >= 0) ema(line.slice(start), signalPeriod).forEach((v, j) => { signal[start + j] = v; });
  return { line, signal };
}
// Regelbasierte Bewertung auf abgeschlossenen Kerzen: vier Regeln je +1/0/−1.
export function watchClassicRating(closed) {
  const closes = closed.map(c => c.close);
  if (closes.length < 60) return null;
  const last = closes.at(-1), e20 = ema(closes, 20).at(-1), e50 = ema(closes, 50).at(-1);
  const r = rsi(closes), rNow = r.at(-1), rPrev = r.at(-2), m = macd(closes), mLine = m.line.at(-1), mSig = m.signal.at(-1);
  if (![last, e20, e50, rNow, rPrev, mLine, mSig].every(Number.isFinite)) return null;
  const cmp = (a, b) => a > b ? 1 : a < b ? -1 : 0;
  const rules = [
    { label: 'Trend', score: cmp(e20, e50), detail: 'EMA 20 zu EMA 50' },
    { label: 'Kurs', score: cmp(last, e20), detail: 'Schluss zu EMA 20' },
    { label: 'RSI ' + Math.round(rNow), score: rNow < 30 && rNow > rPrev ? 1 : rNow > 70 && rNow < rPrev ? -1 : 0, detail: 'RSI 14' },
    { label: 'MACD', score: cmp(mLine, mSig), detail: 'MACD zu Signallinie' }
  ];
  const score = rules.reduce((s, x) => s + x.score, 0);
  return { score, verdict: score >= 2 ? 'buy' : score <= -2 ? 'sell' : 'hold', rules, closeTime: closed.at(-1).closeTime };
}
export function watchCompareSettings(input = {}) {
  const c = { ...WATCH_COMPARE_DEFAULTS, ...input };
  const bounds = { days: [7, 90], feePct: [0, 1], slippagePct: [0, 1], stopAtr: [.5, 5], rewardRisk: [1, 5], holdBars: [1, 96] };
  for (const [key, [lo, hi]] of Object.entries(bounds)) if (!Number.isFinite(c[key]) || c[key] < lo || c[key] > hi || (['days', 'holdBars'].includes(key) && !Number.isInteger(c[key]))) throw new Error('Vergleichseinstellung „' + key + '“ prüfen.');
  if (Object.keys(c).some(k => !Object.hasOwn(bounds, k))) throw new Error('Unbekannte Vergleichseinstellung.');
  return c;
}

export function watchClosed(rows, step, asOf) {
  if (!Array.isArray(rows) || !Number.isSafeInteger(asOf)) throw new Error('Kerzenkontext fehlt.');
  const out = [];
  for (const raw of rows) {
    const c = { ...raw, end: raw.end ?? raw.closeTime + 1 };
    if (!Number.isSafeInteger(c.time) || c.time < 0 || c.time % step || c.end !== c.time + step) throw new Error('Ungültige Kerzenzeit.');
    if (c.end > asOf || c.knownAt > asOf) continue;
    if (![c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite) || Math.min(c.open, c.low, c.close) <= 0 || c.high < Math.max(c.open, c.close, c.low) || c.low > Math.min(c.open, c.close) || c.volume < 0) throw new Error('Ungültige OHLCV-Daten.');
    if (out.length && c.time !== out.at(-1).end) throw new Error('Datenlücke oder doppelte Kerze.');
    out.push(c);
  }
  return out;
}

export function watchFeatures(rows) {
  const closes = rows.map(c => c.close), e = ema(closes, 200), rs = rsi(closes), m = macd(closes);
  return rows.map((c, i) => ({ ...c, ema: e[i], rsi: rs[i], macd: m.line[i], signal: m.signal[i] }));
}

export function watchStrictGates(low, high) {
  const c = low.at(-1), p = low.at(-2), h = high.at(-1), hp = high.at(-2);
  const avg = low.slice(-21, -1).reduce((sum, x) => sum + x.volume, 0) / 20, volume = avg > 0 && c.volume >= 2 * avg;
  const long = [h.close > h.ema && h.ema > hp.ema, c.close > c.ema, p.rsi <= 30 && c.rsi > 30, p.macd <= p.signal && c.macd > c.signal, volume];
  const short = [h.close < h.ema && h.ema < hp.ema, c.close < c.ema, p.rsi >= 70 && c.rsi < 70, p.macd >= p.signal && c.macd < c.signal, volume];
  return { long, short, volumeRatio: avg > 0 ? c.volume / avg : null };
}

export function watchStrictRating({ lower, higher, now }) {
  try {
    const low = watchClosed(lower, WATCH_BASE_MS, now).slice(-WATCH_HISTORY), end = low.at(-1)?.end;
    if (!end || now - end >= WATCH_BASE_MS) throw new Error('15m-Kerzen fehlen oder sind veraltet.');
    const high = watchClosed(higher, WATCH_TREND_MS, end).slice(-WATCH_HISTORY);
    if (!high.length || end - high.at(-1).end >= WATCH_TREND_MS) throw new Error('4h-Kerzen fehlen oder sind veraltet.');
    if (low.length < WATCH_WARMUP || high.length < WATCH_WARMUP) throw new Error('Mindestens 300 geschlossene Kerzen auf 15m und 4h erforderlich.');
    const l = watchFeatures(low), h = watchFeatures(high), last = l.at(-1), prev = l.at(-2), top = h.at(-1), topPrev = h.at(-2);
    if (![last.ema, last.rsi, prev.rsi, last.macd, prev.macd, last.signal, prev.signal, top.ema, topPrev.ema].every(Number.isFinite)) throw new Error('Indikatoren noch nicht bereit.');
    const { long, short, volumeRatio } = watchStrictGates(l, h), count = xs => xs.filter(Boolean).length, longCount = count(long), shortCount = count(short), direction = longCount === 5 ? 1 : shortCount === 5 ? -1 : 0;
    const keys = ['trend', 'kurs', 'rsi', 'macd', 'volume'], labels = ['4h-Trend · EMA 200', '15m-Kurs · EMA 200', 'RSI 14 · Kreuzung 30/70', 'MACD · neue Kreuzung', 'Volumen ≥ 2 × Ø20 davor'];
    const rules = keys.map((key, i) => ({ key, label: labels[i], long: long[i], short: short[i] }));
    return { ready: true, model: WATCH_MODELS.strict, direction, longCount, shortCount, count: Math.max(longCount, shortCount), rules, rsi: last.rsi, volumeRatio, closeTime: end - 1, expiresAt: end + WATCH_BASE_MS,
      reason: direction ? '' : `${longCount}/5 Long · ${shortCount}/5 Short – alle fünf Regeln müssen gleichzeitig passen.` };
  } catch (e) { return { ready: false, model: WATCH_MODELS.strict, direction: 0, longCount: 0, shortCount: 0, count: null, rules: [], reason: e.message }; }
}

export function watchClassicDirection(rating) {
  if (!rating) return 0;
  const n = d => rating.rules.filter(x => x.score === d).length;
  return n(1) >= 3 ? 1 : n(-1) >= 3 ? -1 : 0;
}

function atrRows(rows) {
  let avg = null, sum = 0;
  return rows.map((c, i) => {
    const previous = rows[i - 1]?.close, tr = i ? Math.max(c.high - c.low, Math.abs(c.high - previous), Math.abs(c.low - previous)) : c.high - c.low;
    if (i < 14) { sum += tr; if (i === 13) avg = sum / 14; } else avg = (avg * 13 + tr) / 14;
    return avg;
  });
}

export function watchExecution(open, direction, atr, config) {
  const slip = config.slippagePct / 100, fee = config.feePct / 100, entry = open * (1 + direction * slip), distance = atr * config.stopAtr;
  const stop = entry - direction * distance, target = entry + direction * distance * config.rewardRisk, stopFill = stop * (1 - direction * slip);
  if (![entry, stop, target, stopFill, distance].every(n => Number.isFinite(n) && n > 0)) return null;
  const riskPerUnit = -direction * (stopFill - entry) + fee * (entry + stopFill);
  return riskPerUnit > 0 ? { entry, stop, target, riskPerUnit } : null;
}

export function watchTradeStep(p, bar, index, settings) {
  const d = p.direction, adverse = d === 1 ? bar.low : bar.high, favorable = d === 1 ? bar.high : bar.low;
  let price, reason;
  if (d * (adverse - p.stop) <= 0) { price = d * (bar.open - p.stop) < 0 ? bar.open : p.stop; reason = 'Stop'; }
  else if (d * (favorable - p.target) >= 0) { price = p.target; reason = 'Ziel'; }
  else if (index - p.entryIndex + 1 >= settings.holdBars) { price = bar.close; reason = 'Zeitablauf'; }
  else return null;
  const exit = price * (1 - d * settings.slippagePct / 100), net = d * (exit - p.entry) - settings.feePct / 100 * (p.entry + exit);
  return { ...p, exit, exitAt: bar.end, reason, netR: net / p.riskPerUnit };
}

export function watchComparisonStats(trades, { open = 0, pending = 0, signals = 0 } = {}) {
  const ordered = [...trades].sort((a, b) => a.exitAt - b.exitAt || a.symbol.localeCompare(b.symbol)), wins = ordered.filter(t => t.netR > 0), losses = ordered.filter(t => t.netR < 0);
  const gains = wins.reduce((s, t) => s + t.netR, 0), loss = -losses.reduce((s, t) => s + t.netR, 0);
  let equity = 0, peak = 0, realizedDrawdownR = 0;
  for (const t of ordered) { equity += t.netR; peak = Math.max(peak, equity); realizedDrawdownR = Math.max(realizedDrawdownR, peak - equity); }
  return { trades: ordered.length, wins: wins.length, losses: losses.length, netR: equity, averageR: ordered.length ? equity / ordered.length : null, winRate: ordered.length ? wins.length / ordered.length * 100 : null,
    profitFactor: loss > 0 ? gains / loss : null, noLosses: gains > 0 && loss === 0, realizedDrawdownR, open, pending, signals };
}

// Ausstiege gleich für beide Modelle. Ein Einstieg erst an der NÄCHSTEN Öffnung;
// Stop vor Ziel bei unklarer Intrabar-Reihenfolge. Offene Fälle nie als Gewinner zählen.
export async function compareWatchModels({ lower, higher, symbol, from, asOf, settings = {}, cancelled = () => false, yieldWork = () => Promise.resolve(), progress = () => {} }) {
  const config = watchCompareSettings(settings), low = watchClosed(lower, WATCH_BASE_MS, asOf), high = watchClosed(higher, WATCH_TREND_MS, asOf);
  if (!Number.isSafeInteger(from) || from >= asOf || !/^[A-Z0-9]{2,20}USDT$/.test(symbol)) throw new Error('Vergleichszeitraum oder Coin ungültig.');
  const start = low.findIndex(c => c.end >= from);
  if (start < WATCH_HISTORY - 1 || low.at(-1).end !== asOf || low[start].end !== from) throw new Error('Vergleichsfenster nicht vollständig mit Vorlauf geladen.');
  const firstHigh = high.filter(c => c.end <= from);
  if (firstHigh.length < WATCH_HISTORY || from - firstHigh.at(-1).end >= WATCH_TREND_MS) throw new Error('4h-Vorlauf fehlt.');
  const atr = atrRows(low), books = Object.fromEntries(['classic', 'strict'].map(k => [k, { trades: [], position: null, pending: null, signals: 0 }]));
  let hi = -1, sliceAt = performance.now();
  for (let i = start; i < low.length; i++) {
    if (cancelled()) throw new Error('Vergleich abgebrochen.');
    if (performance.now() - sliceAt > 12) { progress((i - start) / (low.length - start)); await yieldWork(); sliceAt = performance.now(); }
    const bar = low[i];
    while (hi + 1 < high.length && high[hi + 1].end <= bar.end) hi++;
    const before = low.slice(Math.max(0, i - WATCH_HISTORY + 1), i + 1), h = high.slice(Math.max(0, hi - WATCH_HISTORY + 1), hi + 1);
    const strict = watchStrictRating({ lower: before, higher: h, now: bar.end });
    if (!strict.ready) throw new Error(strict.reason); // derselbe gültige Datenbereich für beide Modelle
    const directions = { classic: watchClassicDirection(watchClassicRating(before.slice(-199))), strict: strict.direction };
    for (const [key, book] of Object.entries(books)) {
      if (book.pending) {
        const plan = watchExecution(bar.open, book.pending.direction, book.pending.atr, config);
        if (plan) book.position = { ...plan, model: WATCH_MODELS[key], symbol, direction: book.pending.direction, signalAt: book.pending.signalAt, entryAt: bar.time, entryIndex: i };
        book.pending = null;
      }
      if (book.position) { const closed = watchTradeStep(book.position, bar, i, config); if (closed) { book.trades.push(closed); book.position = null; } }
      if (directions[key]) book.signals++;
      if (!book.position && directions[key]) book.pending = { direction: directions[key], signalAt: bar.end, atr: atr[i] };
      if (book.trades.length > 10000) throw new Error('Zu viele Test-Trades – kürzeren Zeitraum wählen.');
    }
  }
  progress(1);
  const result = { symbol, from, asOf, market: 'spot', models: {} };
  for (const [key, book] of Object.entries(books)) result.models[key] = { version: WATCH_MODELS[key], trades: book.trades, stats: watchComparisonStats(book.trades, { open: book.position ? 1 : 0, pending: book.pending ? 1 : 0, signals: book.signals }), openPosition: book.position, pendingSignal: book.pending };
  return result;
}

export function summarizeWatchComparison(coins) {
  return Object.fromEntries(['classic', 'strict'].map(key => {
    const all = coins.flatMap(c => c.models[key].trades), sum = k => coins.reduce((n, c) => n + c.models[key].stats[k], 0);
    return [key, watchComparisonStats(all, { open: sum('open'), pending: sum('pending'), signals: sum('signals') })];
  }));
}
