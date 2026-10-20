// VWAP (3.84.0): volumengewichteter Durchschnittspreis ab einem Anker, mit ±1 Standardabweichung als Band.
// Reiner Rechenkern ohne Netz und Oberfläche. Preis je Kerze = (Hoch + Tief + Schluss) / 3, Gewicht = Volumen.
// Es wird nie geschätzt: Beginnt die Kerzenreihe nach dem Anker oder fehlt dazwischen eine Kerze, gibt es keinen VWAP (null) – ein
// VWAP „ab irgendwo“ wäre eine andere Zahl als der, den man auf dem Chart erwartet.
const DAY = 864e5;
// Tag, Woche und Monat werden aus gröberen Kerzen gebildet, damit sie unabhängig vom Chart-Zeitrahmen sind und mit wenigen Abrufen
// auskommen (Näherung an den Tick-VWAP): Tag aus 15m (96 Kerzen), Woche aus 1h (168), Monat aus 4h (bis 186).
export const VWAP = Object.freeze({ version: 1, sources: Object.freeze({ day: ['15m', 9e5, 400], week: ['1h', 36e5, 300], month: ['4h', 144e5, 250] }), bandSigma: 1 });
export const VWAP_MODES = Object.freeze([['day', 'Tag'], ['week', 'Woche'], ['month', 'Monat'], ['low', 'ab Swing-Tief'], ['high', 'ab Swing-Hoch'], ['anchor', 'ab Anker']]);
export const vwapMode = v => (VWAP_MODES.some(([k]) => k === v) ? v : 'day');
export const modeName = mode => VWAP_MODES.find(([k]) => k === mode)?.[1] || 'Tag';
// Beginn der Periode (UTC): Tag 00:00, Woche ab Montag 00:00, Monat ab dem Ersten 00:00
export function periodStart(mode, now) {
  const day = Math.floor(now / DAY) * DAY;
  if (mode === 'week') return day - ((new Date(day).getUTCDay() + 6) % 7) * DAY;
  if (mode === 'month') { const d = new Date(day); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); }
  return day;
}
// Letzter bestätigter ZigZag-Umkehrpunkt der gewünschten Art ('L' Tief, 'H' Hoch) → Zeit der Kerze
export const anchorFromPivots = (pivots, type) => (Array.isArray(pivots) ? pivots.filter(p => p?.ok && p.type === type && Number.isFinite(p.t)).at(-1)?.t ?? null : null);
const usable = c => c && [c.time, c.high, c.low, c.close, c.volume].every(Number.isFinite) && c.volume >= 0;
// rows: Kerzen aufsteigend; ms: Kerzenlänge; start: Anker (Beginn einer Kerze); now: Obergrenze
export function vwapSeries(rows, start, { ms, now = Date.now(), sigma = VWAP.bandSigma } = {}) {
  if (!Array.isArray(rows) || !Number.isFinite(start) || !(ms > 0)) return null;
  const part = rows.filter(c => c && c.time >= start && c.time <= now);
  if (!part.length || part[0].time !== start || !part.every(usable) || part.some((c, i) => i && c.time - part[i - 1].time !== ms)) return null;
  let sv = 0, spv = 0, spp = 0; const points = [];
  for (const c of part) {
    const p = (c.high + c.low + c.close) / 3; sv += c.volume; spv += p * c.volume; spp += p * p * c.volume;
    if (!(sv > 0)) continue;
    const vwap = spv / sv, sd = Math.sqrt(Math.max(0, spp / sv - vwap * vwap));
    points.push({ time: c.time, vwap, upper: vwap + sigma * sd, lower: vwap - sigma * sd });
  }
  return points.length ? { start, ms, points, last: points.at(-1) } : null;
}
