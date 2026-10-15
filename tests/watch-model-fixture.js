// Deterministische OHLCV-Reihen: echte Indikatorberechnung ergibt 5/5 Long bzw. gespiegelt Short.
const M = 900000, H = 14400000;
const range = (n, a, b) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
function watchFixture(end = Date.UTC(2026, 9, 15, 12)) {
  const rows = (prices, step, until) => prices.map((close, i) => ({ time: until - (prices.length - i) * step, end: until - (prices.length - i - 1) * step, closeTime: until - (prices.length - i - 1) * step - 1, open: close, high: close + .1, low: close - .1, close, volume: 100 }));
  const lower = rows([...range(491, 100, 200), ...Array.from({ length: 8 }, (_, i) => 200 - (i + 1) * .6), 207.2], M, end); lower.at(-1).volume = 250;
  return { lower, higher: rows(range(500, 80, 180), H, Math.floor(end / H) * H) };
}
const mirrorWatch = rows => rows.map(c => ({ ...c, open: 400 - c.open, high: 400 - c.low, low: 400 - c.high, close: 400 - c.close }));
module.exports = { watchFixture, mirrorWatch };
