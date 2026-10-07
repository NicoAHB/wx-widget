// Ausschließlich feste Testdaten, kein Startbestand für die App.
import * as C from '../../shared/confluence-core.mjs';
export const HOUR = 3600e3, START = Date.UTC(2026, 0, 1);
export function fixedCandles(closes, periodMs = HOUR) {
  return closes.map((close, i) => { const open = i ? closes[i - 1] : close, time = START + i * periodMs;
    return { time, end: time + periodMs, knownAt: time + periodMs, open, close, high: Math.max(open, close) + 1, low: Math.min(open, close) - 1, volume: 100 + i }; });
}
export function fixture(config = {}) {
  const p = C.settings(config), asOf = START + 300 * HOUR;
  const scope = { venue: 'bitget', product: 'USDT-FUTURES', instrument: 'BTCUSDT', quote: 'USDT', timeframe: '1h', contextTimeframe: '4h', horizon: 'short', modelVersion: C.MODEL_VERSION, settingsRevision: p.revision, asOf, maxHoldMs: 24 * HOUR, slippageBps: 0, indicatorAnchors: { base: START, context: START - 500 * HOUR } };
  const source = timeframe => ({ ...scope, timeframe, parametersKey: C.parametersKey(p) });
  const base = { source: source('1h'), anchor: START, closedAt: asOf, knownAt: asOf, price: 100, ema50: 99, ema200: 90, atr: 4, rsiValues: [40, 39, 38, 37, 36, 35, 36, 37, 39, 40], lastIndex: 9, histogram: [0, 0, 0, 0, 0], volume: 151, previousVolumes: Array(20).fill(100), pivots: [], zones: [] };
  const context = { source: source('4h'), anchor: scope.indicatorAnchors.context, closedAt: asOf, knownAt: asOf, price: 100, ema50: 99, ema200: 90 };
  const funding = { source: source('1h'), rate: 0, intervalHours: 8, at: asOf - HOUR, knownAt: asOf, positiveMeans: 'long-pays' };
  const pattern = { source: source('1h'), family: 'test-umkehr', direction: 1, quality: 90, timeframe: '1h', confirmed: true, provisional: false, from: asOf - 3 * HOUR, to: asOf - HOUR, closedAt: asOf, knownAt: asOf };
  return { p, input: { scope, base, context, funding, direction: 1, patterns: [pattern] }, pattern };
}
export function caseFixture(id, options = {}) {
  const { input, p } = fixture(), scope = { ...input.scope, direction: 1 }, decisionAt = scope.asOf - 30 * HOUR;
  const entryAt = options.entryAt ?? options.decisionAt ?? decisionAt;
  return { id, scope, parametersKey: C.parametersKey(p), score: 80, decisionAt, entryAt, maxHoldMs: scope.maxHoldMs, resolvedAt: entryAt + scope.maxHoldMs, outcome: 'timeout', netReturn: .01, costsComplete: true, costKind: 'history', ...options };
}
export function parityFixture() {
  const { p, input } = fixture(), candles = fixedCandles(Array.from({ length: 240 }, (_, i) => 100 + Math.sin(i / 7) * 3 + i * .05));
  const initial = C.createIndicatorState({ time: START, periodMs: HOUR }), asOf = candles.at(-1).end;
  const first = C.advanceIndicators(initial, candles.slice(0, 101), asOf), resumed = C.advanceIndicators(JSON.parse(JSON.stringify(first.state)), candles.slice(101), asOf);
  const funding = { kind: 'history', complete: true, from: 0, to: 3000, events: [{ at: 2000, rate: -.001, markPrice: 105 }] };
  return { signal: C.scoreConfluence(input, p), state: resumed.state, values: resumed.values, macd: C.macd(candles.map(c => c.close)), levels: C.tradeLevels({ entry: 100.03, anchor: 99, atr: 2, direction: 1, tickSize: .1 }), pnl: C.netPnl({ direction: 1, quantity: 2, entry: 100, exit: 110, entryAt: 1000, exitAt: 3000, funding }), cross: C.crossStatus() };
}
