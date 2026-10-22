// Volumenprofil aus OHLCV. Binance-Kerzen enthalten kein Volumen je Preisstufe; verteilt wird deshalb nach einer Normalverteilung
// um die Mitte des Kerzenkörpers, begrenzt auf [Tief, Hoch]: σ = halbe Körperhöhe, mindestens ein Sechstel der Spanne.
// So bekommen Dochte (kurz gehandelte Preise) weniger Volumen als der Körper; bei Doji-Kerzen liegt es eng um Eröffnung/Schluss.
const erf = x => { const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a); return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)); };
const normCdf = z => 0.5 * (1 + erf(z / Math.SQRT2));
function candleSpread(c) { return { mu: (c.open + c.close) / 2, sigma: Math.max(Math.abs(c.close - c.open) / 2, (c.high - c.low) / 6) }; }
export function volumeProfile(candles, bins = 40, valueArea = 0.7) {
  if (candles.length < 10) return null;
  const lo = Math.min(...candles.map(c => c.low)), hi = Math.max(...candles.map(c => c.high));
  if (!(hi > lo)) return null;
  const step = (hi - lo) / bins, vol = Array(bins).fill(0), idx = v => Math.min(bins - 1, Math.max(0, Math.floor((v - lo) / step)));
  for (const c of candles) {
    if (!(c.volume > 0)) continue;
    if (!(c.high > c.low)) { vol[idx(c.low)] += c.volume; continue; }
    const { mu, sigma } = candleSpread(c), cdf = x => normCdf((x - mu) / sigma), base = cdf(c.low), mass = cdf(c.high) - base;
    if (!(mass > 1e-9)) { vol[idx(Math.min(c.high, Math.max(c.low, mu)))] += c.volume; continue; }
    let prev = base;
    for (let i = idx(c.low), last = idx(c.high); i <= last; i++) {
      const cur = i === last ? cdf(c.high) : cdf(Math.min(c.high, lo + (i + 1) * step));
      if (cur > prev) vol[i] += c.volume * (cur - prev) / mass;
      prev = cur;
    }
  }
  const total = vol.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return null;
  let poc = 0; vol.forEach((v, i) => { if (v > vol[poc]) poc = i; });
  let a = poc, b = poc, acc = vol[poc];
  while (acc < valueArea * total && (a > 0 || b < bins - 1)) {
    const up = b < bins - 1 ? vol[b + 1] : -1, down = a > 0 ? vol[a - 1] : -1;
    if (up >= down) acc += vol[++b]; else acc += vol[--a];
  }
  return { lo, hi, step, bins: vol, total, pocIndex: poc, poc: lo + (poc + 0.5) * step, vaLow: lo + a * step, vaHigh: lo + (b + 1) * step, vaShare: acc / total, count: candles.length };
}

