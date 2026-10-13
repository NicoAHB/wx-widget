// 3.68.0: KI-Zonen – Kauf- und Verkaufszonen aus bestätigten Swing-Punkten, vollständig lokal und ohne externe Dienste.
// Ablauf je Zeitrahmen: Fraktale (3–5 Kerzen links/rechts) → Gruppierung nahe beieinander liegender Swings mit ATR-Toleranz
// (eindimensionale Distanzgruppierung, wie DBSCAN mit einem Punkt Mindestgröße) → Zonenbreite nach ATR → Bewertung 1–100.
// Swing-Tiefs ergeben Kaufzonen, Swing-Hochs Verkaufszonen. Eigener Code, keine Fremdbibliothek.
import { ema } from './indicators.mjs';

export const KI_ZONES_VERSION = 'ki-zonen-1';
export const KI_ZONE_INTERVALS = Object.freeze(['5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d']);
// Fraktalgröße: kurze Zeitrahmen 3, mittlere 4, ab 4h 5 Kerzen links und rechts.
export const kiZoneFractal = interval => ({ '5m': 3, '15m': 3, '30m': 4, '1h': 4, '2h': 4, '4h': 5, '6h': 5, '12h': 5, '1d': 5 })[interval] || 0;
// Gewichte der Bewertung (Summe 100). Übereinstimmungen: POC 8, EMA 200 6, S/R 6, Bollinger 4, Hoch/Tief 6.
export const KI_ZONE_WEIGHTS = Object.freeze({ touches: 25, bounce: 15, volume: 15, recency: 15, poc: 8, ema200: 6, sr: 6, bollinger: 4, extreme: 6 });
const SETTINGS = { maxCandles: 500, minCandles: 60, atrPeriod: 14, joinATR: .6, spanATR: 1.5, padATR: .15, minWidthATR: .5, brokenATR: .3, nearATR: .25, top: 3 };
const finite = Number.isFinite, clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function atrSeries(k, period) {
  const out = new Array(k.length).fill(null); let sum = 0, a = null;
  for (let i = 0; i < k.length; i++) {
    const c = k[i], tr = i ? Math.max(c.high - c.low, Math.abs(c.high - k[i - 1].close), Math.abs(c.low - k[i - 1].close)) : c.high - c.low;
    if (i < period) { sum += tr; if (i === period - 1) out[i] = a = sum / period; } else out[i] = a = (a * (period - 1) + tr) / period;
  }
  return out;
}
// Bestätigte Fraktale: links strikt, rechts mindestens gleich (bei gleich hohen Nachbarn zählt der erste Punkt).
function fractals(k, f) {
  const highs = [], lows = [];
  for (let i = f; i < k.length - f; i++) {
    let hi = true, lo = true;
    for (let j = i - f; j <= i + f && (hi || lo); j++) {
      if (j === i) continue;
      if (j < i ? k[j].high >= k[i].high : k[j].high > k[i].high) hi = false;
      if (j < i ? k[j].low <= k[i].low : k[j].low < k[i].low) lo = false;
    }
    if (hi) highs.push({ index: i, price: k[i].high }); if (lo) lows.push({ index: i, price: k[i].low });
  }
  return { highs, lows };
}
// Distanzgruppierung: sortiert nach Preis; ein Swing gehört zur Gruppe, wenn er höchstens joinATR vom vorigen und
// höchstens spanATR vom Gruppenanfang entfernt ist. Danach werden überlappende Zonen derselben Seite zusammengelegt.
function clusters(points, atr, s) {
  const sorted = points.slice().sort((a, b) => a.price - b.price), out = [];
  for (const p of sorted) {
    const g = out.at(-1);
    if (g && p.price - g.points.at(-1).price <= s.joinATR * atr && p.price - g.points[0].price <= s.spanATR * atr) g.points.push(p); else out.push({ points: [p] });
  }
  const zones = out.map(g => { const lo = g.points[0].price, hi = g.points.at(-1).price; let low = lo - s.padATR * atr, high = hi + s.padATR * atr; if (high - low < s.minWidthATR * atr) { const mid = (lo + hi) / 2; low = mid - s.minWidthATR * atr / 2; high = mid + s.minWidthATR * atr / 2; } return { low, high, points: g.points }; });
  const merged = [];
  for (const z of zones.sort((a, b) => a.low - b.low)) { const m = merged.at(-1); if (m && z.low <= m.high) { m.high = Math.max(m.high, z.high); m.points.push(...z.points); } else merged.push({ ...z, points: [...z.points] }); }
  return merged;
}
// Volumen je Preis: vorhandenes Volumenprofil der App ({ lo, step, bins, total }) oder gleichmäßige Verteilung über die Kerzenspanne.
function fallbackProfile(k, bins = 60) {
  const lo = Math.min(...k.map(c => c.low)), hi = Math.max(...k.map(c => c.high)); if (!(hi > lo)) return null;
  const step = (hi - lo) / bins, vol = new Array(bins).fill(0), idx = v => clamp(Math.floor((v - lo) / step), 0, bins - 1);
  for (const c of k) { if (!(c.volume > 0)) continue; const a = idx(c.low), b = idx(c.high); for (let i = a; i <= b; i++) vol[i] += c.volume / (b - a + 1); }
  let poc = 0; vol.forEach((v, i) => { if (v > vol[poc]) poc = i; });
  return { lo, hi, step, bins: vol, total: vol.reduce((a, b) => a + b, 0), poc: lo + (poc + .5) * step };
}
function zoneVolumeRatio(profile, low, high) {
  if (!profile || !(profile.total > 0) || !(profile.step > 0)) return null;
  let sum = 0;
  profile.bins.forEach((v, i) => { const a = profile.lo + i * profile.step, b = a + profile.step, overlap = Math.min(b, high) - Math.max(a, low); if (overlap > 0) sum += v * overlap / profile.step; });
  const span = profile.step * profile.bins.length, width = Math.min(high, profile.lo + span) - Math.max(low, profile.lo);
  return width > 0 ? (sum / width) / (profile.total / span) : null;
}
const near = (value, low, high, pad) => finite(value) && value >= low - pad && value <= high + pad;
const priceDigits = v => v >= 1000 ? 0 : v >= 100 ? 1 : v >= 1 ? 2 : Math.min(8, 3 - Math.floor(Math.log10(v)));

/**
 * candles: nur abgeschlossene Kerzen { time, open, high, low, close, volume }, aufsteigend.
 * profile/ema200/bands/levels: optionale Werte der App (Volumenprofil, letzter EMA 200, letzte Bollinger-Bänder, S/R-Preise).
 */
export function computeKiZones({ candles, interval, profile = null, ema200 = null, bands = null, levels = [], settings = {} }) {
  const s = { ...SETTINGS, ...settings }, f = kiZoneFractal(interval), empty = reason => ({ version: KI_ZONES_VERSION, interval, zones: [], buy: [], sell: [], reason });
  if (!f) return empty('KI-Zonen gibt es für 5m bis 1d');
  const k = (Array.isArray(candles) ? candles : []).filter(c => c && [c.open, c.high, c.low, c.close].every(finite) && c.high >= c.low).slice(-s.maxCandles);
  if (k.length < s.minCandles) return empty('Zu wenige abgeschlossene Kerzen');
  const n = k.length, atrs = atrSeries(k, s.atrPeriod), atr = atrs.at(-1);
  if (!(atr > 0)) return empty('ATR nicht verfügbar');
  const closes = k.map(c => c.close), last = k.at(-1);
  const e200 = finite(ema200) ? ema200 : n >= 200 ? ema(closes, 200).at(-1) : null;
  let bb = bands && finite(bands.upper) && finite(bands.lower) ? bands : null;
  if (!bb && n >= 20) { const w = closes.slice(-20), m = w.reduce((a, b) => a + b, 0) / 20, sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / 20); bb = { upper: m + 2 * sd, lower: m - 2 * sd }; }
  const vp = profile && profile.bins?.length ? profile : fallbackProfile(k), poc = finite(vp?.poc) ? vp.poc : null;
  const periodLow = Math.min(...k.map(c => c.low)), periodHigh = Math.max(...k.map(c => c.high)), srLevels = (levels || []).filter(v => finite(v) && v > 0);
  const { highs, lows } = fractals(k, f), zones = [];
  for (const [side, points] of [['buy', lows], ['sell', highs]]) for (const z of clusters(points, atr, s)) {
    const d = side === 'buy' ? 1 : -1, first = Math.min(...z.points.map(p => p.index)), lastSwing = Math.max(...z.points.map(p => p.index));
    // Berührungen: zusammenhängende Kerzen mit Docht in der Zone, deren Schluss nicht jenseits der Zone liegt; Abprall in ATR.
    const touches = []; let inside = false;
    for (let i = first; i < n; i++) {
      const c = k[i], overlap = c.low <= z.high && c.high >= z.low, held = d === 1 ? c.close >= z.low : c.close <= z.high;
      if (overlap && held && !inside) { touches.push({ index: i }); inside = true; } else if (!overlap) inside = false;
      if (overlap && held) touches.at(-1).end = i;
    }
    for (const t of touches) {
      const after = k.slice(t.end + 1, Math.min(n, t.end + 1 + 2 * f));
      t.bounce = after.length ? Math.max(0, d === 1 ? (Math.max(...after.map(c => c.high)) - z.high) / atr : (z.low - Math.min(...after.map(c => c.low))) / atr) : null;
    }
    const measured = touches.filter(t => finite(t.bounce)), bounce = measured.length ? measured.reduce((a, t) => a + Math.min(t.bounce, 5), 0) / measured.length : 0;
    // Deutlich durchbrochen: nach dem letzten Swing ein Schluss mindestens brokenATR jenseits der Zone.
    let broken = false, brokenAt = null;
    for (let i = lastSwing + 1; i < n; i++) if (d === 1 ? k[i].close < z.low - s.brokenATR * atr : k[i].close > z.high + s.brokenATR * atr) { broken = true; brokenAt = k[i].time; break; }
    const lastTouch = Math.max(lastSwing, ...touches.map(t => t.end ?? t.index)), age = n - 1 - lastTouch, ratio = zoneVolumeRatio(vp, z.low, z.high);
    const hits = { poc: near(poc, z.low, z.high, s.nearATR * atr), ema200: near(e200, z.low, z.high, s.nearATR * atr), sr: srLevels.some(v => near(v, z.low, z.high, s.nearATR * atr)),
      bollinger: !!bb && near(d === 1 ? bb.lower : bb.upper, z.low, z.high, 2 * s.nearATR * atr), extreme: near(d === 1 ? periodLow : periodHigh, z.low, z.high, s.nearATR * atr) };
    const W = KI_ZONE_WEIGHTS, count = Math.max(touches.length, z.points.length);
    const points = { touches: Math.min(count, 5) / 5 * W.touches, bounce: Math.min(bounce, 3) / 3 * W.bounce, volume: ratio === null ? 0 : clamp((ratio - .6) / 1.4, 0, 1) * W.volume,
      recency: W.recency * Math.exp(-age / Math.max(20, n / 4)), poc: hits.poc ? W.poc : 0, ema200: hits.ema200 ? W.ema200 : 0, sr: hits.sr ? W.sr : 0, bollinger: hits.bollinger ? W.bollinger : 0, extreme: hits.extreme ? W.extreme : 0 };
    const raw = Object.values(points).reduce((a, b) => a + b, 0), score = clamp(Math.round(broken ? raw * .6 : raw), 1, 100);
    const volumeText = ratio === null ? null : ratio >= 1.5 ? 'hohes Volumen' : ratio >= 1 ? 'mittleres Volumen' : 'wenig Volumen';
    const reasons = [`${count} ${count === 1 ? 'Berührung' : 'Berührungen'}`, measured.length ? `Ø Abprall ${bounce.toFixed(1).replace('.', ',')} ATR` : null, volumeText, hits.poc ? 'POC' : null, hits.ema200 ? 'EMA 200' : null,
      hits.sr ? 'S/R-Level' : null, hits.bollinger ? (d === 1 ? 'unteres' : 'oberes') + ' Bollinger-Band' : null, hits.extreme ? (d === 1 ? 'Periodentief' : 'Periodenhoch') : null, age === 0 ? 'zuletzt in der letzten Kerze' : `zuletzt vor ${age} Kerzen`, broken ? 'deutlich durchbrochen' : null].filter(Boolean);
    zones.push({ side, low: z.low, high: z.high, mid: (z.low + z.high) / 2, score, broken, brokenAt, touches: count, swings: z.points.length, bounceATR: bounce, volumeRatio: ratio, age, firstTime: k[first].time, lastTouchTime: k[lastTouch].time, hits, points, reasons });
  }
  const top = side => zones.filter(z => z.side === side).sort((a, b) => b.score - a.score || b.lastTouchTime - a.lastTouchTime).slice(0, s.top);
  return { version: KI_ZONES_VERSION, interval, lastTime: last.time, count: n, atr, fractal: f, price: last.close, digits: priceDigits(last.close), zones, buy: top('buy'), sell: top('sell'), reason: '' };
}
