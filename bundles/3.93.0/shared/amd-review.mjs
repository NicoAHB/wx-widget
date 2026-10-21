// AMD (3.91.0): Rückblick auf die letzten Tage. Zählt für die Vorauswahl-Coins, wie oft eine Accumulation, eine Manipulation, ein Schluss
// zurück in der Range und eine Bestätigung vorkamen – bei mehreren Empfindlichkeiten (maximale Rangehöhe in ATR) nebeneinander.
// Dieselben Regeln wie live (amd-core.mjs); kein Versand, nichts wird gespeichert.
import { AMD, amdClosed, amdScan, amdOptions } from './amd-core.mjs';
import { INTERVAL_MS } from './market-intervals.mjs';

const DAY = 86400000, MINUTE = 60000;
export const AMD_REVIEW = Object.freeze({
  days: 30, thresholds: Object.freeze([1.5, 2, 3, 4]), intervals: Object.freeze(['5m', '15m', '1h', '4h']),   // die historische Quelle liefert nur diese Zeitrahmen
  chunkMs: 7 * DAY, lookbackMinutes: 60, maxWindowsPerCoin: 60
});
const cancelled = s => { if (s?.aborted) throw s.reason || new globalThis.DOMException('Abgebrochen', 'AbortError'); };
const zero = () => ({ accumulations: 0, manipulations: 0, closedInside: 0, confirmed: 0, reported: 0, filtered: 0, invalid: 0, unchecked: 0, open: 0 });

// Zählung der Abläufe eines Coins, die im Fenster liegen
export function amdCount(episodes, start) {
  const c = zero();
  for (const e of episodes) {
    if (e.range.endTime >= start) c.accumulations++;
    if (!e.direction || e.breakAt < start) continue;
    c.manipulations++;
    if (e.closedInside) c.closedInside++;
    if (e.status === 'confirmed') { c.confirmed++; c.reported++; } else if (e.status === 'filtered') { c.confirmed++; c.filtered++; }
    else if (e.status === 'invalid') c.invalid++; else if (e.status === 'unchecked') c.unchecked++; else if (e.status === 'manipulating') c.open++;
  }
  return c;
}
const add = (a, b) => { for (const k of Object.keys(a)) a[k] += b[k] || 0; return a; };

// Minutenfenster eines Ablaufs: eine Stunde vor dem Durchbruch bis zum Ende der Wartezeit, höchstens 1000 Minuten
const windowOf = (e, interval, end) => {
  const from = Math.floor((e.breakAt - AMD_REVIEW.lookbackMinutes * MINUTE) / MINUTE) * MINUTE, wait = e.breakAt + (AMD.maxWaitCandles + 1) * INTERVAL_MS[interval];
  const to = Math.min(Math.floor(end / MINUTE) * MINUTE, wait, from + AMD.minuteLimit * MINUTE);
  return to - from >= 5 * MINUTE ? { from, to } : null;
};

export async function runAmdReview({ symbols, history, now, interval = AMD.defaultInterval, days = AMD_REVIEW.days, thresholds = AMD_REVIEW.thresholds, minRR = AMD.minRR, signal, progress = () => {} }) {
  if (!AMD_REVIEW.intervals.includes(interval)) throw new Error(`Der Rückblick läuft für ${AMD_REVIEW.intervals.join(', ')}; für ${interval} liefert die Datenquelle keine Historie.`);
  const ms = INTERVAL_MS[interval], end = Math.floor(now / ms) * ms, start = end - days * DAY, from = start - (AMD.atrPeriod + AMD.maxCandles + 5) * ms;
  const list = (symbols || []).filter(s => s.market), levels = [...new Set(thresholds.map(t => amdOptions({ maxHeightAtr: t }).maxHeightAtr))].sort((a, b) => a - b);
  const total = new Map(levels.map(t => [t, zero()])), perCoin = [], errors = []; let windows = 0, checked = 0;
  for (const coin of list) {
    cancelled(signal); progress({ checked, total: list.length, symbol: coin.symbol, step: 'Kerzen' });
    try {
      let all = []; for (let cursor = Math.floor(from / ms) * ms; cursor < end; cursor = Math.min(end, cursor + AMD_REVIEW.chunkMs)) { cancelled(signal); all = all.concat(await history({ symbol: coin.symbol, market: coin.market, timeframe: interval, from: cursor, to: Math.min(end, cursor + AMD_REVIEW.chunkMs), signal })); }
      const rows = amdClosed(all, now), cells = new Map();
      if (rows.length < AMD.atrPeriod + AMD.minCandles) throw new Error(`zu wenige ${interval}-Kerzen (${rows.length})`);
      const minutes = new Map(), fetched = new Set(); let used = 0;
      for (const t of levels) {
        const options = { ...amdOptions({ maxHeightAtr: t, minRR }) };
        let episodes = amdScan(rows, [], options);
        // 1m-Prüfung für jeden Ablauf mit Schluss zurück in der Range (nur dort kann eine Bestätigung vorkommen) und mit Minutenfenster (bis 1h)
        if (ms <= 3600000) {
          for (const e of episodes.filter(e => e.direction && e.breakAt >= start && e.closedInside)) {
            const w = windowOf(e, interval, now), key = w && `${w.from}|${w.to}`; if (!w || fetched.has(key)) continue;
            if (used >= AMD_REVIEW.maxWindowsPerCoin) break; used++; windows++; fetched.add(key); cancelled(signal); progress({ checked, total: list.length, symbol: coin.symbol, step: '1m' });
            try { for (const c of await history({ symbol: coin.symbol, market: coin.market, timeframe: '1m', from: w.from, to: w.to, signal })) minutes.set(c.time, c); }
            catch (error) { if (signal?.aborted) throw error; errors.push({ symbol: coin.symbol, text: `1m-Fenster ${new Date(w.from).toISOString().slice(0, 16)}: ${error.message || error}` }); }
          }
          if (minutes.size) episodes = amdScan(rows, amdClosed([...minutes.values()].sort((a, b) => a.time - b.time), now), options);
        }
        const count = amdCount(episodes, start); cells.set(t, count); add(total.get(t), count);
      }
      perCoin.push({ symbol: coin.symbol, market: coin.market, candles: rows.length, cells: Object.fromEntries(cells) });
    } catch (error) { if (signal?.aborted) throw error; errors.push({ symbol: coin.symbol, text: error.message || String(error) }); }
    checked++;
  }
  return { interval, days, from: start, to: end, minRR, levels, coins: list.length, checked, windows, errors, total: Object.fromEntries(total), perCoin, minuteCheck: ms <= 3600000 };
}
