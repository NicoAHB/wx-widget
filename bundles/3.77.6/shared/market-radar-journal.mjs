// Lokale Beobachtungen: Marktbewegungen nach einem Radarhinweis, keine simulierten Trades oder Gewinnquoten.
import { RADAR_MODEL } from './market-radar-core.mjs';
export const RADAR_KEY = 'scalpdesk.market-radar.v1';
export const RADAR_MAX = 200;
const validPrice = v => typeof v === 'number' && Number.isFinite(v) && v > 0;
const validTime = v => Number.isSafeInteger(v) && v > 0 && v < 8640000000000000;
const validResult = (r, at, minutes) => r && validTime(r.at) && validPrice(r.price) && r.at >= at + minutes * 60000 && r.at < at + (minutes + 1) * 60000 ? { at: r.at, price: r.price } : null;
export function radarBook(value) {
  const observations = [];
  for (const row of Array.isArray(value?.observations) ? value.observations.slice(-RADAR_MAX * 2) : []) {
    if (row?.model !== RADAR_MODEL || !/^[A-Z0-9]{2,24}USDT$/.test(row.symbol) || !validTime(row.at) || !validPrice(row.price) || !Array.isArray(row.flags)) continue;
    const flags = [...new Set(row.flags.filter(f => ['volume', 'oi', 'funding', 'macro', 'announcement', 'news'].includes(f)))].sort();
    if (!flags.length) continue;
    const id = `${RADAR_MODEL}|${row.symbol}|${Math.floor(row.at / 60000)}|${flags.join(',')}`;
    observations.push({ id, model: RADAR_MODEL, symbol: row.symbol, at: row.at, price: row.price, flags,
      after15: validResult(row.after15, row.at, 15), after60: validResult(row.after60, row.at, 60) });
  }
  return { v: 1, open: value?.open === true, track: value?.track === true,
    observations: [...new Map(observations.sort((a, b) => a.at - b.at).map(r => [r.id, r])).values()].slice(-RADAR_MAX) };
}
export function updateRadarBook(value, radar, series = []) {
  const book = radarBook(value);
  if (!radar.live || !radar.quote || ['paused', 'offline'].includes(radar.status)) return book;
  if (book.track && radar.flags.length) {
    const flags = radar.flags.map(f => f.id).sort(), last = book.observations.filter(r => r.symbol === radar.symbol && r.flags.join() === flags.join()).at(-1);
    // Dauerzustände nicht jede Sekunde neu zählen. Pro Coin/Flagkombination höchstens eine Beobachtung je 15 Minuten.
    if (!last || radar.quote.at - last.at >= 15 * 60000) book.observations.push({ model: RADAR_MODEL, symbol: radar.symbol, at: radar.quote.at, price: radar.quote.price, flags, after15: null, after60: null });
  }
  const closed = series.filter(c => c?.closed && validTime(c.end) && c.end <= radar.now && validPrice(c.close)).sort((a, b) => a.end - b.end);
  for (const row of book.observations) {
    if (row.symbol !== radar.symbol) continue;
    for (const [key, minutes] of [['after15', 15], ['after60', 60]]) {
      const target = row.at + minutes * 60000;
      const current = row[key];
      if (current && current.at >= target && current.at < target + 60000) continue;
      const candle = closed.find(c => c.end >= target && c.end < target + 60000);
      row[key] = candle ? { at: candle.end, price: candle.close } : null;
    }
  }
  return radarBook(book);
}
