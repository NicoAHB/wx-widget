// Öffentlicher Krypto-Kalenderauszug. Reine Anzeige: keine Alarm-/Score-/Bot-Stimme.
export const CRYPTO_CALENDAR = Object.freeze({ version: 1, refreshMs: 30 * 60000, retryMs: 5 * 60000, staleMs: 12 * 3600000, maxEvents: 200, horizonDays: 90 });
const dayMs = 86400000;
const text = (v, n = 120) => typeof v === 'string' ? v.trim().slice(0, n) : '';
const day = v => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(v)) return null;
  const date = v.slice(0, 10), t = Date.parse(date + 'T00:00:00Z');
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === date ? t : null;
};
const symbols = a => [...new Set((Array.isArray(a) ? a : []).map(s => text(s, 24).toUpperCase()).filter(s => /^[A-Z0-9]{1,24}$/.test(s)))].slice(0, 20);
const sourceUrl = v => { try { const u = new URL(v); return u.protocol === 'https:' && u.hostname === 'coinmarketcal.com' && !u.username && !u.password ? u.href : null; } catch { return null; } };

export function normalizePublicCryptoEvents(rows, now = Date.now()) {
  if (!Array.isArray(rows)) throw new Error('Krypto-Kalenderformat ohne Terminliste.');
  const today = Math.floor(now / dayMs) * dayMs, result = [], seen = new Set();
  for (const e of rows.slice(0, 1000)) {
    if (!e || e.dateTypeSelected !== 'date' || !['exact', 'range'].includes(e.displayDateType)) continue;
    const t = day(e.dateEventFrom || e.dateEvent), end = e.dateEventTo ? day(e.dateEventTo) : t;
    const title = text(e.title), coins = symbols(e.coins?.map(c => c?.symbol));
    if (!Number.isSafeInteger(e.id) || e.id <= 0 || !/^[a-z0-9][a-z0-9-]{1,150}$/.test(e.slug || '') || !title || !coins.length || t === null || end === null || end < t || end < today || t > today + CRYPTO_CALENDAR.horizonDays * dayMs || seen.has(e.id)) continue;
    seen.add(e.id);
    result.push({ id: `cmc-${e.id}`, t, end, dayOnly: true, title, coins, category: text(e.categories?.[0]?.name, 60), url: `https://coinmarketcal.com/event/${e.slug}`, source: 'CoinMarketCal · öffentlich' });
  }
  return result.sort((a, b) => Math.max(a.t, today) - Math.max(b.t, today) || a.end - b.end || a.title.localeCompare(b.title)).slice(0, CRYPTO_CALENDAR.maxEvents);
}

export function parseCryptoCalendar(data) {
  if (data?.v !== 1 || !Array.isArray(data.events) || data.events.length > CRYPTO_CALENDAR.maxEvents) throw new Error('Krypto-Kalenderdatei ungültig.');
  const fetchedAt = Date.parse(data.fetchedAt), seen = new Set(), events = [];
  if (!Number.isFinite(fetchedAt)) throw new Error('Krypto-Kalender ohne gültigen Datenstand.');
  for (const e of data.events) {
    const coins = symbols(e?.coins), url = sourceUrl(e?.url), title = text(e?.title);
    if (!/^cmc-\d+$/.test(e?.id || '') || !Number.isSafeInteger(e.t) || !Number.isSafeInteger(e.end) || !Number.isFinite(new Date(e.t).getTime()) || !Number.isFinite(new Date(e.end).getTime()) || e.t % dayMs || e.end % dayMs || e.end < e.t || e.dayOnly !== true || !title || !coins.length || !url || seen.has(e.id)) continue;
    seen.add(e.id); events.push({ id: e.id, t: e.t, end: e.end, dayOnly: true, title, coins, category: text(e.category, 60), url, source: 'CoinMarketCal · öffentlich' });
  }
  if (data.events.length && !events.length) throw new Error('Krypto-Kalender enthält keine gültigen Termine.');
  return { fetchedAt, source: 'CoinMarketCal · öffentlicher Auszug', events };
}

export function cryptoCalendarEvents(data, { mode = 'all', coin = '', watch = [] } = {}, now = Date.now()) {
  const today = Math.floor(now / dayMs) * dayMs, selected = new Set(mode === 'coin' ? [coin.replace(/USDT$/, '')] : watch);
  return (data?.events || []).filter(e => e.end >= today && e.t <= today + CRYPTO_CALENDAR.horizonDays * dayMs && (mode === 'all' || e.coins.some(c => selected.has(c))))
    .sort((a, b) => Math.max(a.t, today) - Math.max(b.t, today) || a.end - b.end || a.title.localeCompare(b.title));
}

// Konkrete Termine aus dem frei zugänglichen, serverseitig gerenderten Kalender.
// Nur JSON lesen, niemals Website-Code ausführen. Fehlendes Schema ist ein Fehler,
// kein leerer Kalender; der Aktualisierungsjob behält dann seinen letzten Stand.
export function readPublicCryptoPage(html) {
  if (typeof html !== 'string' || html.length > 2 * 1024 * 1024) throw new Error('Öffentliche Kalenderseite zu groß oder ungültig.');
  const parts = [];
  for (const [, block] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const m = /self\.__next_f\.push\((\[[\s\S]*\])\)\s*;?\s*$/.exec(block.trim());
    if (!m) continue;
    try { const value = JSON.parse(m[1]); if (typeof value[1] === 'string') parts.push(value[1]); } catch { /* andere Seitenskripte sind keine Kalenderdaten */ }
  }
  const source = parts.join(''), rows = []; let found = false;
  for (const name of ['initialEvents', 'initialOngoingEvents', 'initialFeaturedPinned']) {
    const marker = `"${name}":`, pos = source.indexOf(marker); if (pos < 0) continue;
    let start = pos + marker.length; while (/\s/.test(source[start] || '') && start < source.length) start++;
    if (source[start] !== '[') continue;
    let depth = 0, quoted = false, escaped = false;
    for (let i = start; i < source.length; i++) {
      const c = source[i];
      if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; continue; }
      if (c === '"') quoted = true; else if (c === '[' || c === '{') depth++; else if (c === ']' || c === '}') {
        if (--depth === 0) { try { const list = JSON.parse(source.slice(start, i + 1)); if (Array.isArray(list)) { rows.push(...list); if (name === 'initialEvents') found = true; } } catch { throw new Error('Öffentliche Kalenderliste beschädigt.'); } break; }
      }
    }
  }
  if (!found) throw new Error('Öffentliche Kalenderstruktur geändert; bisherigen Stand behalten.');
  return rows;
}
