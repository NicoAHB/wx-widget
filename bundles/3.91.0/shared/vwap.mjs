// VWAP (3.84.0): volumengewichteter Durchschnittspreis ab einem Anker, mit ±1 Standardabweichung als Band.
// Reiner Rechenkern ohne Netz und Oberfläche. Preis je Kerze = (Hoch + Tief + Schluss) / 3, Gewicht = Volumen.
// Es wird nie geschätzt: Beginnt die Kerzenreihe nach dem Anker oder fehlt dazwischen eine Kerze, gibt es keinen VWAP (null) – ein
// VWAP „ab irgendwo“ wäre eine andere Zahl als der, den man auf dem Chart erwartet.
import { SESSIONS, latestSession } from './key-levels.mjs';
const DAY = 864e5;
// Tag, Woche und Monat werden aus gröberen Kerzen gebildet, damit sie unabhängig vom Chart-Zeitrahmen sind und mit wenigen Abrufen
// auskommen (Näherung an den Tick-VWAP): Tag aus 15m (96 Kerzen), Woche aus 1h (168), Monat aus 4h (bis 186). Die Ankerpunkte
// (Sitzungen, Vortag, Wochen, Volumenspitze) nutzen dieselben Quellen: Tag-nahe Anker 15m, Wochen-Anker 1h, Vorwochen-Anker 4h.
export const VWAP = Object.freeze({
  version: 2, bandSigma: 1, volumeDays: 7,
  sources: Object.freeze({ day: ['15m', 9e5, 400], week: ['1h', 36e5, 300], month: ['4h', 144e5, 250] }),
  sourceOf: Object.freeze({ day: 'day', week: 'week', month: 'month', asia: 'day', london: 'day', ny: 'day', pdl: 'day', pdh: 'day', wl: 'week', wh: 'week', vol: 'week', pwl: 'month', pwh: 'month' })
});
// Auswahl im Menü, in Gruppen. low/high/anchor kommen aus den Kerzen des Charts, alle anderen aus den Quellen oben.
export const VWAP_MODE_GROUPS = Object.freeze([
  ['Perioden', [['day', 'Tag'], ['week', 'Woche'], ['month', 'Monat']]],
  ['Handelssitzungen', [['asia', 'ab Asien-Open'], ['london', 'ab London-Open'], ['ny', 'ab NY-Open']]],
  ['Wendepunkte', [['low', 'ab Swing-Tief'], ['high', 'ab Swing-Hoch'], ['pdl', 'ab Vortag-Tief'], ['pdh', 'ab Vortag-Hoch'], ['wl', 'ab Wochen-Tief'], ['wh', 'ab Wochen-Hoch'], ['pwl', 'ab Vorwochen-Tief'], ['pwh', 'ab Vorwochen-Hoch']]],
  ['Auffälligkeiten', [['vol', 'ab Volumenspitze']]],
  ['Eigener Punkt', [['anchor', 'ab Anker']]]
]);
export const VWAP_MODES = Object.freeze(VWAP_MODE_GROUPS.flatMap(([, list]) => list));
export const vwapMode = v => (VWAP_MODES.some(([k]) => k === v) ? v : 'day');
export const modeName = mode => VWAP_MODES.find(([k]) => k === mode)?.[1] || 'Tag';
export const vwapSource = mode => VWAP.sources[VWAP.sourceOf[mode]] || null;
// Beginn der Periode (UTC): Tag 00:00, Woche ab Montag 00:00, Monat ab dem Ersten 00:00
export function periodStart(mode, now) {
  const day = Math.floor(now / DAY) * DAY;
  if (mode === 'week') return day - ((new Date(day).getUTCDay() + 6) % 7) * DAY;
  if (mode === 'month') { const d = new Date(day); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); }
  return day;
}
const usableRow = c => c && [c.time, c.high, c.low, c.close, c.volume].every(Number.isFinite) && c.volume >= 0;
// Kerze mit dem höchsten (key 'high'/'volume') bzw. tiefsten (key 'low') Wert; bei Gleichstand die früheste
const extreme = (list, key, sign) => list.reduce((best, c) => (!best || sign * c[key] > sign * best[key] ? c : best), null);
// Anker eines Modus aus den Kerzen seiner Quelle → { start, why }: start = Beginn der Kerze (UTC-ms), null mit Grund, wenn er sich nicht bestimmen lässt.
// Gerechnet wird nur aus vorhandenen Kerzen; fehlen sie, gibt es keinen Anker (nichts wird geschätzt).
export function anchorStart(mode, rows, now = Date.now()) {
  const src = vwapSource(mode); if (!src) return { start: null, why: '' };
  const ms = src[1], iv = src[0], list = (Array.isArray(rows) ? rows : []).filter(usableRow).filter(c => c.time <= now).sort((a, b) => a.time - b.time);
  const day0 = Math.floor(now / DAY) * DAY, weekStart = day0 - ((new Date(day0).getUTCDay() + 6) % 7) * DAY, name = modeName(mode).replace(/^ab /, '');
  const between = (from, to) => list.filter(c => c.time >= from && c.time < to);
  const full = (part, from, to) => part.length === (to - from) / ms && part[0].time === from && part.every((c, i) => !i || c.time - part[i - 1].time === ms);
  const missing = what => ({ start: null, why: `Für „ab ${name}“ fehlen lückenlose ${iv}-Kerzen ${what}.` });
  if (mode === 'day' || mode === 'week' || mode === 'month') return { start: periodStart(mode, now), why: '' };
  const session = SESSIONS.find(s => s.id === mode);
  if (session) { const w = latestSession(session, now); return w ? { start: w.start, why: '' } : missing('der Sitzung'); }
  if (mode === 'pdl' || mode === 'pdh') {
    const part = between(day0 - DAY, day0); if (!full(part, day0 - DAY, day0)) return missing('von gestern');
    return { start: extreme(part, mode === 'pdh' ? 'high' : 'low', mode === 'pdh' ? 1 : -1).time, why: '' };
  }
  if (mode === 'wl' || mode === 'wh') {
    const part = between(weekStart, now + 1); if (!part.length) return missing('dieser Woche');
    return { start: extreme(part, mode === 'wh' ? 'high' : 'low', mode === 'wh' ? 1 : -1).time, why: '' };
  }
  if (mode === 'pwl' || mode === 'pwh') {
    const part = between(weekStart - 7 * DAY, weekStart); if (!full(part, weekStart - 7 * DAY, weekStart)) return missing('der Vorwoche');
    return { start: extreme(part, mode === 'pwh' ? 'high' : 'low', mode === 'pwh' ? 1 : -1).time, why: '' };
  }
  if (mode === 'vol') {
    const part = list.filter(c => c.time >= now - VWAP.volumeDays * DAY && c.time + ms <= now); if (!part.length) return missing('der letzten 7 Tage');
    return { start: extreme(part, 'volume', 1).time, why: '' };
  }
  return { start: null, why: '' };
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
