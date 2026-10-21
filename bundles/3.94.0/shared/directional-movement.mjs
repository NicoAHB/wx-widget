// Gemeinsamer Wilder-ADX mit +DI/−DI. Vorlauf bleibt null, fehlende Werte werden nicht erfunden.
export function directionalMovement(rows, period = 14) {
  if (!Number.isInteger(period) || period < 2) throw Error('Ungültige ADX-Periode');
  const out = rows.map(() => ({ adx: null, plusDI: null, minusDI: null }));
  let tr = 0, plus = 0, minus = 0, dxSum = 0, dxCount = 0, adx = null;
  for (let i = 1; i < rows.length; i++) {
    const c = rows[i], p = rows[i - 1], up = c.high - p.high, down = p.low - c.low,
      t = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)),
      a = up > down && up > 0 ? up : 0, b = down > up && down > 0 ? down : 0;
    if (i <= period) { tr += t; plus += a; minus += b; }
    else { tr = tr - tr / period + t; plus = plus - plus / period + a; minus = minus - minus / period + b; }
    if (i < period) continue;
    const plusDI = tr ? 100 * plus / tr : 0, minusDI = tr ? 100 * minus / tr : 0,
      dx = plusDI + minusDI ? 100 * Math.abs(plusDI - minusDI) / (plusDI + minusDI) : 0;
    if (adx === null) { dxSum += dx; if (++dxCount === period) adx = dxSum / period; }
    else adx = (adx * (period - 1) + dx) / period;
    out[i] = { adx, plusDI, minusDI };
  }
  return out;
}
