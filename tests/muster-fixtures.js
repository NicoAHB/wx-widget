// Reale OHLC-Struktur mit festen Zeiten, keine zukünftigen Werte im Musterkontext.
const STEP = 900000, T0 = Date.UTC(2026, 8, 1);
function fixture(pattern = 'hammer') {
  const context = Array.from({ length: 80 }, (_, i) => ({ time: T0 + (i - 60) * 14400000, end: T0 + (i - 59) * 14400000, open: 102, high: 104, low: 100, close: 102, volume: 100 }));
  const rows = Array.from({ length: 35 }, (_, i) => ({ time: T0 + i * STEP, end: T0 + (i + 1) * STEP, open: 101.7, high: 102, low: 100, close: 101.8, volume: 100 }));
  rows[30] = { ...rows[30], open: 101.6, high: 101.8, low: 100, close: 101.7, volume: 500 };
  if (pattern === 'engulfing') { rows[29] = { ...rows[29], open: 102, high: 102.2, low: 100.5, close: 101, volume: 100 }; rows[30] = { ...rows[30], open: 100.9, high: 102.3, low: 100.4, close: 102.1 }; }
  return { rows, context, asOf: rows.at(-1).end, startTime: T0, symbol: 'BTCUSDT', market: 'spot' };
}
module.exports = { fixture, T0, STEP };
