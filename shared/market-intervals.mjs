// Eine Binance-Intervallliste für Chart, Muster, Indikatoraufrufe und Live-/Historienfeeds.
// Die sechs bisherigen Stimmen des Gesamt-Signals bleiben unverändert gewichtet.
const definitions = [
  ['1s', 1000], ['1m', 60000, 1, 1, 1, 1], ['3m', 180000, 0, 0, 1, 1], ['5m', 300000, 1, 1, 1, 1],
  ['15m', 900000, 1, 1, 1, 1], ['30m', 1800000, 0, 0, 1, 1], ['1h', 3600000, 1, 1, 1, 1],
  ['2h', 7200000, 1, 0, 1, 1], ['4h', 14400000, 1, 1, 1, 1], ['6h', 21600000, 0, 0, 0, 1],
  ['12h', 43200000, 0, 0, 0, 1], ['1d', 86400000, 1, 1, 1, 1], ['3d', 259200000, 0, 0, 0, 1],
  ['1w', 604800000, 1, 0, 1, 1], ['1M', 2678000000, 1, 0, 1, 0]
];
const details = { '1h': ['1m', '5m', '15m', '30m'], '2h': ['1m', '5m', '15m', '30m', '1h'], '4h': ['5m', '15m', '30m', '1h', '2h'], '1d': ['15m', '30m', '1h', '2h', '4h'], '1w': ['1h', '4h', '1d'], '1M': ['4h', '1d', '1w'] };
export const MARKET_INTERVALS = Object.freeze(definitions.map(([id, ms, chart = 0, signal = 0, pattern = 0, tradeImage = 0]) => Object.freeze({ id, api: id, label: id, ms, chart: !!chart, signal: !!signal, pattern: !!pattern, tradeImage: !!tradeImage, calendar: id === '1M', details: Object.freeze(details[id] || []) })));
export const CHART_INTERVALS = Object.freeze(MARKET_INTERVALS.filter(x => x.chart).map(x => x.id));
export const SIGNAL_INTERVALS = Object.freeze(MARKET_INTERVALS.filter(x => x.signal).map(x => x.id));
export const INTERVAL_MS = Object.freeze(Object.fromEntries(MARKET_INTERVALS.map(x => [x.id, x.ms])));
export const PATTERN_STEPS = Object.freeze(Object.fromEntries(MARKET_INTERVALS.filter(x => x.pattern).map(x => [x.id, x.calendar ? 0 : x.ms])));
export function intervalEnd(time, interval) {
  const config = MARKET_INTERVALS.find(x => x.id === interval); if (!config || !Number.isFinite(time)) throw new Error('Kerzenzeit oder Intervall fehlt');
  if (config.calendar) { const d = new Date(time); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); }
  return time + config.ms;
}
export function nearestChartInterval(value, fallback = '1h') {
  if (CHART_INTERVALS.includes(value)) return value;
  const m = /^(\d+(?:\.\d+)?)(s|m|h|d|w|M)$/.exec(String(value));
  if (!m || !(Number(m[1]) > 0)) return CHART_INTERVALS.includes(fallback) ? fallback : '1h';
  const duration = Number(m[1]) * { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000, M: 30 * 86400000 }[m[2]];
  return MARKET_INTERVALS.filter(x => x.chart).reduce((a, b) => Math.abs(Math.log(b.ms / duration)) < Math.abs(Math.log(a.ms / duration)) ? b : a).id;
}
