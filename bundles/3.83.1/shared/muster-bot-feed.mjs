import { INTERVAL_MS } from './market-intervals.mjs';
import { musterSettings, musterCandles, musterWarmup } from './muster-bot-core.mjs';
const abort = signal => { if (signal?.aborted) throw signal.reason || new globalThis.DOMException('Abgebrochen', 'AbortError'); };
const wait = (ms, signal) => new Promise((resolve, reject) => { abort(signal); const timer = setTimeout(done, ms); function done() { signal?.removeEventListener('abort', cancelled); resolve(); } function cancelled() { clearTimeout(timer); reject(signal.reason || new globalThis.DOMException('Abgebrochen', 'AbortError')); } signal?.addEventListener('abort', cancelled, { once: true }); });
export function createMusterClient({ fetcher = fetch, sleep = wait } = {}) {
  async function page({ symbol, market, timeframe, startTime, endTime, signal }) {
    const bases = market === 'futures' ? ['https://fapi.binance.com'] : ['https://data-api.binance.vision', 'https://api.binance.com'];
    let problem;
    for (const base of bases) {
      for (let attempt = 0; attempt < 4; attempt++) {
        abort(signal);
        try {
          const query = new URLSearchParams({ symbol, interval: timeframe, startTime, endTime, limit: 1000 });
          const response = await fetcher(base + (market === 'futures' ? '/fapi/v1/klines?' : '/api/v3/klines?') + query, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000) });
          if ([418, 429].includes(response.status)) { if (attempt === 3) throw new Error('Börse begrenzt Anfragen – später erneut testen'); const seconds = Number(response.headers?.get('retry-after')); await sleep(Math.min(60000, seconds > 0 ? seconds * 1000 : 2000 * 2 ** attempt), signal); continue; }
          if ([403, 451].includes(response.status)) throw new Error('Datenquelle in dieser Region nicht erreichbar');
          if (!response.ok) throw new Error('Kerzenabruf fehlgeschlagen (HTTP ' + response.status + ')');
          const rows = await response.json(); if (!Array.isArray(rows)) throw new Error('Ungültige Antwort der Datenquelle'); return rows;
        } catch (e) { abort(signal); problem = e; if (/begrenzt Anfragen/.test(e.message)) throw e; break; }
      }
    }
    throw problem || new Error('Kerzen nicht erreichbar');
  }
  async function history({ symbol, market, timeframe, from, to, signal, progress = () => {} }) {
    if (!/^[A-Z0-9]{2,20}USDT$/.test(symbol) || !['spot', 'futures'].includes(market) || !['1m', '5m', '15m', '1h', '4h'].includes(timeframe) || !Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from >= to) throw new Error('Historienauswahl ungültig');
    const ms = INTERVAL_MS[timeframe]; let cursor = Math.max(0, Math.floor(from / ms) * ms), calls = 0, liveOpen = null; const collected = [];
    while (cursor < to) {
      abort(signal); if (++calls > 300) throw new Error('Historie zu groß – kürzeren Zeitraum wählen');
      const rows = await page({ symbol, market, timeframe, startTime: cursor, endTime: to - 1, signal }); if (!rows.length) break;
      const accepted = rows.filter(r => Number(r[0]) >= cursor && Number(r[0]) < to);
      if (!accepted.length) throw new Error('Datenquelle liefert keinen Historienfortschritt');
      const running = accepted.find(r => Number(r[6]) + 1 > to && Number(r[0]) <= to); if (running && Number(running[1]) > 0) liveOpen = { time: Number(running[0]), open: Number(running[1]) };
      const candles = musterCandles(accepted, timeframe, to); collected.push(...candles);
      const next = Number(accepted.at(-1)[0]) + ms; if (!(next > cursor)) throw new Error('Historie enthält doppelte Zeitstempel'); cursor = next;
      progress({ timeframe, candles: collected.length, fraction: Math.min(1, (cursor - from) / (to - from)) });
      if (cursor < to && rows.length >= 1000) await sleep(250, signal); else break;
    }
    const result = musterCandles(collected, timeframe, to); result.liveOpen = liveOpen; return result;
  }
  async function load({ symbol, market, config: input, all = false, asOf = Date.now(), startTime = null, paper = false, signal, progress }) {
    const config = musterSettings(input), start = startTime ?? asOf - config.days * 86400000, frames = all ? ['5m', '15m', '1h'] : [config.timeframe], rows = {};
    // Alle Indikatoren werden vor dem Auswertungsfenster mit realen Kerzen gestartet (Konfluenz: EMA200 auf beiden Ebenen).
    const warmup = all ? Math.max(...['both', 'confluence', 'po3'].map(pattern => musterWarmup({ ...config, pattern }))) : musterWarmup(config);
    const context = await history({ symbol, market, timeframe: '4h', from: start - warmup * INTERVAL_MS['4h'], to: asOf, signal, progress });
    for (const timeframe of frames) rows[timeframe] = await history({ symbol, market, timeframe, from: start - warmup * INTERVAL_MS[timeframe], to: asOf, signal, progress });
    return { symbol, market, config, rows, context, startTime: start, asOf, liveOpen: paper ? rows[config.timeframe]?.liveOpen : null };
  }
  return { page, history, load };
}
