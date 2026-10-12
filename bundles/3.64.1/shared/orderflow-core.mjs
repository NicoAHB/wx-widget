// PDF Etappe 1: reine Binance-Kerzenprojektion. Keine Handelsentscheidung.
export const ORDERFLOW_PERIODS = Object.freeze({ '1m': 60000, '1h': 3600000 });
export const ORDERFLOW_LIMITS = Object.freeze({ '1m': 30, '1h': 5 });
export const ORDERFLOW_FRESH_MS = 5000;
const numeric = v => (typeof v === 'number' || typeof v === 'string' && v.trim() !== '') && Number.isFinite(Number(v)) ? Number(v) : null;
function volumes(total, buy) {
  total = numeric(total); buy = numeric(buy);
  if (total === null || buy === null || total < 0 || buy < 0 || buy > total) return null;
  const sell = total - buy, delta = buy - sell;
  return { total, buy, sell, delta, share: total > 0 ? buy / total : null };
}
function candle(iv, k, meta) {
  const step = ORDERFLOW_PERIODS[iv], t = numeric(k.t), T = numeric(k.T), prices = ['o', 'h', 'l', 'c'].map(key => numeric(k[key]));
  if (!step || !Number.isFinite(meta.now) || !Number.isSafeInteger(t) || t < 0 || t % step || T !== t + step - 1 || prices.some(p => !(p > 0))) return null;
  const [o, h, l, c] = prices;
  if (h < Math.max(o, c) || l > Math.min(o, c) || l > h || t > meta.now + ORDERFLOW_FRESH_MS) return null;
  return { t, T, o, h, l, c, coins: volumes(k.v, k.V), usdt: volumes(k.q, k.Q), ...meta };
}
export function restCandle(row, iv, { now, startedAt = now, seenAt = now } = {}) {
  if (!Array.isArray(row)) return null;
  return candle(iv, { t: row[0], T: row[6], o: row[1], h: row[2], l: row[3], c: row[4], v: row[5], q: row[7], V: row[9], Q: row[10] }, { now, startedAt, seenAt, eventAt: 0, source: 'rest', closed: row[6] < now });
}
export function liveCandle(k, iv, { now, eventAt, seenAt = now } = {}) {
  if (!k || typeof k.x !== 'boolean' || !Number.isSafeInteger(eventAt) || eventAt < k.t || k.x && eventAt < k.T || eventAt > now + ORDERFLOW_FRESH_MS) return null;
  return candle(iv, k, { now, seenAt, eventAt, source: 'ws', closed: k.x });
}
// Verspätete REST-Antworten und ältere Events dürfen neuere Live-Werte nicht zurückdrehen.
export function mergeCandles(existing, incoming, iv) {
  const byTime = new Map(existing.map(c => [c.t, c]));
  for (const c of incoming.filter(Boolean)) {
    const old = byTime.get(c.t);
    if (old) {
      if (c.source === 'rest' && c.closed && old.source === 'ws' && old.closed && c.startedAt > old.seenAt && (!old.coins || !old.usdt)) {
        byTime.set(c.t, { ...old, coins: old.coins || c.coins, usdt: old.usdt || c.usdt }); continue;
      }
      if (c.source === 'rest' && old.source === 'ws' && (old.closed || old.seenAt >= c.startedAt)) continue;
      if (c.source === 'ws' && old.source === 'ws' && (c.eventAt < old.eventAt || old.closed && !c.closed)) continue;
      if (old.closed && !c.closed) continue;
      if (c.source === 'ws' && old.source === 'ws' && ['coins', 'usdt'].some(unit => old[unit] && c[unit] && c[unit].total < old[unit].total)) continue;
    }
    byTime.set(c.t, c);
  }
  return [...byTime.values()].sort((a, b) => a.t - b.t).slice(-ORDERFLOW_LIMITS[iv]);
}
export function visibleCandles(series, iv, now) {
  const step = ORDERFLOW_PERIODS[iv], lastClosed = series.filter(c => c.closed).at(-1);
  const current = Math.max(Math.floor(now / step) * step, lastClosed ? lastClosed.t + step : 0), byTime = new Map(series.map(c => [c.t, c]));
  return Array.from({ length: 5 }, (_, i) => { const t = current - (4 - i) * step; return { t, running: i === 4, candle: byTime.get(t) || null }; });
}
export function dataQuality(series, iv, { now, receivedNow = now, connected, unit = 'usdt', paused = false } = {}) {
  if (paused) return { kind: 'paused', label: 'Pausiert' };
  const rows = visibleCandles(series, iv, now), last = series.filter(c => c.source === 'ws').reduce((a, c) => !a || c.eventAt > a.eventAt ? c : a, null);
  const age = last ? Math.max(receivedNow - last.seenAt, now - last.eventAt, 0) : null;
  if (!connected) return { kind: 'stale', label: 'Live-Verbindung getrennt', age };
  if (!last) return { kind: 'rest', label: 'REST · wartet auf Live-Daten', age };
  if (age > ORDERFLOW_FRESH_MS) return { kind: 'stale', label: 'Daten veraltet', age };
  if (rows.some(r => !r.candle || !r.candle[unit] || !r.running && !r.candle.closed)) return { kind: 'incomplete', label: 'Daten unvollständig', age };
  return { kind: 'live', label: 'Live', age };
}
const formatters = new Map();
// 3.54.0: identischer Preismaßstab je sichtbarem Kerzenblock; Doji bleibt sichtbar.
export function candleGlyph(c, low, high) {
  if (!c || ![c.o, c.h, c.l, c.c, low, high].every(Number.isFinite) || low > c.l || high < c.h) return null;
  const range = high - low, y = price => range > 0 ? 3 + (high - price) / range * 36 : 21;
  const open = y(c.o), close = y(c.c);
  return { high: y(c.h), low: y(c.l), top: Math.min(open, close), height: Math.max(1, Math.abs(open - close)), tone: c.c > c.o ? 'up' : c.c < c.o ? 'down' : 'neutral' };
}
export function candleCountdown(iv, now) {
  const step = ORDERFLOW_PERIODS[iv]; if (!step || !Number.isFinite(now)) return '—';
  const seconds = Math.ceil((step - ((now % step) + step) % step) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
export const CANDLE_NEUTRAL_BODY_SHARE = .1;
export function candleAssessment(c) {
  if (!c || ![c.o, c.h, c.l, c.c].every(Number.isFinite)) return { tone: 'neutral', text: 'Kerzenbild: —' };
  const range = c.h - c.l, share = range > 0 ? Math.abs(c.c - c.o) / range : 0, at = range > 0 ? (c.c - c.l) / range : .5;
  if (share <= CANDLE_NEUTRAL_BODY_SHARE) return { tone: 'neutral', text: 'Neutral · kleiner Körper' };
  return c.c > c.o ? { tone: 'up', text: at >= .75 ? 'Bullisch · Schluss nahe Hoch' : 'Bullisch · positiver Körper' }
    : { tone: 'down', text: at <= .25 ? 'Bärisch · Schluss nahe Tief' : 'Bärisch · negativer Körper' };
}
export function compactVolume(value, signed = false) {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value), scale = abs >= 1e9 ? 1e9 : abs >= 1e6 ? 1e6 : abs >= 1e3 ? 1e3 : 1, suffix = scale === 1e9 ? ' Mrd.' : scale === 1e6 ? ' Mio.' : scale === 1e3 ? ' Tsd.' : '';
  const n = abs / scale, prefix = signed && value !== 0 ? value > 0 ? '+' : '−' : '';
  if (n > 0 && n < 0.000001) return prefix + n.toExponential(1).replace('.', ',').replace('e-', 'E−').replace('e+', 'E+');
  const digits = n > 0 && n < 1 ? Math.min(8, Math.ceil(-Math.log10(n)) + 1) : scale > 1 ? 1 : 2;
  if (!formatters.has(digits)) formatters.set(digits, new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits }));
  return prefix + formatters.get(digits).format(n) + suffix;
}
