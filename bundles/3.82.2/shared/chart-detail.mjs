// 3.64.0: eigenständige Anzeige feiner Binance-Kerzen; keine Signal-/Alarmberechnung.
import { MARKET_INTERVALS, INTERVAL_MS, intervalEnd } from './market-intervals.mjs';
export const DETAIL_VISIBLE_MAX = 1500, DETAIL_CACHE_MAX = 6000, DETAIL_CACHE_SERIES = 4;
export const detailOptions = main => MARKET_INTERVALS.find(x => x.id === main)?.details || [];
export const detailChoice = (main, choice) => detailOptions(main).includes(choice) ? choice : '';
export function candleStart(time, iv) {
  if (iv === '1M') { const d = new Date(time); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1); }
  if (iv === '1w') return Math.floor((time - 345600000) / 604800000) * 604800000 + 345600000; // Montag, UTC
  const ms = INTERVAL_MS[iv]; if (!ms || !Number.isFinite(time)) throw Error('Kerzenzeit oder Auflösung ungültig.');
  return Math.floor(time / ms) * ms;
}
export function timeIndex(rows, time, iv) {
  if (!rows.length || !Number.isFinite(time)) return null;
  let lo = 0, hi = rows.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (rows[mid].time <= time) lo = mid + 1; else hi = mid; }
  if (!lo) return (time - rows[0].time) / (intervalEnd(rows[0].time, iv) - rows[0].time);
  const i = lo - 1, end = rows[i + 1]?.time ?? intervalEnd(rows[i].time, iv);
  return i + (time - rows[i].time) / (end - rows[i].time);
}
export function closedSeries(main, values, fine) {
  if (!values) return null;
  let i = -1;
  return fine.map(c => { while (i + 1 < main.length && main[i + 1].closeTime < c.time) i++; return i < 0 ? null : values[i] ?? null; });
}
export function detailMerge(a, b, iv, maximum = DETAIL_CACHE_MAX) {
  const map = new Map(a.map(c => [c.time, c]));
  for (const c of b) {
    if (!c || ![c.time, c.closeTime, c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite)
      || c.time !== candleStart(c.time, iv) || c.closeTime !== intervalEnd(c.time, iv) - 1 || c.low <= 0
      || c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close) || c.volume < 0) throw Error('Detail-Kerzen sind unvollständig oder ungültig.');
    const old = map.get(c.time); if (!old || c.volume >= old.volume) map.set(c.time, { ...c });
  }
  const rows = [...map.values()].sort((x, y) => x.time - y.time).slice(-maximum);
  for (let i = 1; i < rows.length; i++) if (rows[i].time !== intervalEnd(rows[i - 1].time, iv)) throw Error('Lücke in den Detail-Kerzen – bitte erneut laden.');
  return rows;
}
export function createDetailCandles({ request, changed = () => {}, now = () => Date.now() }) {
  const cache = new Map(), s = { key: '', context: null, iv: '', candles: [], count: 80, pan: 0, anchorTime: null, busy: false, error: '', note: '', olderEnd: false, at: 0 };
  let epoch = 0, controller = null, next = 0, pendingPan = null, retryAt = 0, latestBounds = null;
  const notify = () => changed(s);
  function cancel() { epoch++; controller?.abort(); controller = null; s.busy = false; pendingPan = null; }
  function remember() {
    if (!s.key || !s.candles.length) return;
    cache.delete(s.key); cache.set(s.key, { candles: s.candles, at: s.at, olderEnd: s.olderEnd });
    while (cache.size > DETAIL_CACHE_SERIES) cache.delete(cache.keys().next().value);
  }
  function view() {
    const len = s.candles.length, count = Math.min(s.count, len, DETAIL_VISIBLE_MAX);
    if (s.anchorTime !== null) { const i = s.candles.findIndex(c => c.time === s.anchorTime); if (i >= 0) s.pan = len - 1 - i; }
    s.pan = Math.max(0, Math.min(s.pan, len - count)); if (!s.pan) s.anchorTime = null;
    return { start: Math.max(0, len - s.pan - count), end: len - s.pan };
  }
  async function pages(context, iv, start, end, limit, signal) {
    let rows = [], cursor = end;
    while (rows.length < limit) {
      const size = Math.min(1000, limit - rows.length), page = await request(context, iv, { endTime: cursor, limit: size }, signal);
      if (signal.aborted) { const error = Error('Abgebrochen'); error.name = 'AbortError'; throw error; }
      if (!page.length) break;
      const usable = page.filter(c => c.time <= cursor && c.closeTime >= start);
      rows = detailMerge(usable, rows, iv);
      const first = page[0].time;
      if (first <= start || first >= cursor || page.length < size) break;
      cursor = first - 1;
    }
    return rows;
  }
  async function select(context, choice, bounds) {
    remember(); cancel(); s.iv = detailChoice(context.main, choice); s.context = { ...context };
    Object.assign(s, { key: s.iv ? `${context.source}|${context.symbol}|${s.iv}` : '', candles: [], pan: 0, anchorTime: null, error: '', note: '', olderEnd: false });
    if (!s.iv) { notify(); return; }
    const iv = s.iv, ms = INTERVAL_MS[iv], end = Math.min(bounds.end, now()), wanted = Math.max(1, Math.ceil((end - bounds.start) / ms));
    latestBounds = { ...bounds }; retryAt = 0;
    s.count = Math.min(DETAIL_VISIBLE_MAX, wanted);
    if (wanted > DETAIL_VISIBLE_MAX) s.note = `Zeitraum auf ${DETAIL_VISIBLE_MAX} Detail-Kerzen begrenzt. Nach links wischen lädt ältere Kerzen.`;
    const start = candleStart(Math.max(bounds.start, end - s.count * ms), s.iv), old = cache.get(s.key);
    if (old && old.candles[0].time <= end && intervalEnd(old.candles.at(-1).time, iv) >= start) { s.candles = old.candles; s.at = old.at; s.olderEnd = old.olderEnd; const i = s.candles.findLastIndex(c => c.time <= end); if (i >= 0) s.pan = s.candles.length - 1 - i; view(); }
    const seq = epoch; controller = new AbortController(); s.busy = true; notify();
    try {
      const fresh = await pages(context, iv, start, end, s.count + 1, controller.signal);
      if (seq !== epoch) return;
      if (!fresh.length) throw Error('Keine Detail-Kerzen für diesen Zeitraum verfügbar.');
      s.candles = detailMerge(s.candles, fresh, s.iv); s.at = now(); s.olderEnd = fresh.length < s.count;
      const i = s.candles.findLastIndex(c => c.time <= end); s.pan = Math.max(0, s.candles.length - 1 - i);
      if (s.pan) s.anchorTime = s.candles[i]?.time ?? null;
      next = now() + 30000; remember();
    } catch (e) { if (seq === epoch && e.name !== 'AbortError') { s.error = e.message; next = now() + 30000; } }
    finally { if (seq === epoch) { s.busy = false; controller = null; notify(); } }
  }
  async function older() {
    if (!s.iv || s.busy || s.olderEnd || !s.candles.length || now() < retryAt) return;
    const seq = epoch, first = s.candles[0].time; controller = new AbortController(); s.busy = true; s.error = ''; notify();
    try {
      const page = await request(s.context, s.iv, { endTime: first - 1, limit: 1000 }, controller.signal);
      if (seq !== epoch) return;
      const fresh = page.filter(c => c.time < first);
      const merged = detailMerge(fresh, s.candles, s.iv, DETAIL_CACHE_MAX + 1000), dropped = Math.max(0, merged.length - DETAIL_CACHE_MAX);
      s.candles = merged.slice(0, DETAIL_CACHE_MAX); s.olderEnd = fresh.length < 1000;
      if (pendingPan !== null) s.pan = Math.max(0, Math.min(pendingPan - dropped, s.candles.length - Math.min(s.count, s.candles.length)));
      else s.pan = Math.max(0, s.pan - dropped);
      s.anchorTime = s.candles[s.candles.length - 1 - s.pan]?.time ?? null;
      remember();
    } catch (e) { if (seq === epoch && e.name !== 'AbortError') { s.error = e.message; retryAt = now() + 30000; } }
    finally { if (seq === epoch) { pendingPan = null; s.busy = false; controller = null; notify(); } }
  }
  async function newer() {
    if (!s.iv || s.busy || !s.candles.length || now() < retryAt || !latestBounds || s.candles.at(-1).time >= candleStart(Math.min(latestBounds.end, now()), s.iv)) return;
    const seq = epoch, anchor = s.candles[s.candles.length - 1 - s.pan]?.time; controller = new AbortController(); s.busy = true; notify();
    try {
      const rows = await request(s.context, s.iv, { startTime: intervalEnd(s.candles.at(-1).time, s.iv), limit: 1000 }, controller.signal);
      if (seq !== epoch) return;
      s.candles = detailMerge(s.candles, rows.filter(c=>c.time<=latestBounds.end), s.iv); s.anchorTime = anchor; view(); s.error = ''; remember();
    } catch (e) { if (seq === epoch && e.name !== 'AbortError') { s.error = e.message; retryAt = now() + 30000; } }
    finally { if (seq === epoch) { s.busy = false; controller = null; notify(); } }
  }
  function pan(value) {
    const max = Math.max(0, s.candles.length - Math.min(s.count, s.candles.length)), requested = Math.max(0, Math.round(value));
    s.pan = Math.min(requested, max); s.anchorTime = s.pan ? s.candles[s.candles.length - 1 - s.pan]?.time ?? null : null;
    if (requested >= Math.max(0, max - 20) && !s.busy && !s.olderEnd) { pendingPan = requested; void older(); }
    else if (requested <= 20) void newer();
    notify();
  }
  async function refresh() {
    if (!s.iv || s.busy || now() < next || !s.candles.length || intervalEnd(s.candles.at(-1).time, s.iv) < candleStart(now(), s.iv)) return;
    next = now() + 30000; const seq = epoch; controller = new AbortController(); s.busy = true;
    try {
      const last = s.candles.at(-1), rows = await request(s.context, s.iv, { startTime: last.time, limit: 1000 }, controller.signal);
      if (seq !== epoch) return;
      s.candles = detailMerge(s.candles, rows, s.iv); s.at = now(); s.error = ''; remember();
    } catch (e) { if (seq === epoch && e.name !== 'AbortError') s.error = e.message; }
    finally { if (seq === epoch) { s.busy = false; controller = null; notify(); } }
  }
  function live(context, iv, candle) {
    if (context.symbol !== s.context?.symbol || context.source !== s.context?.source || iv !== s.iv || !s.candles.length || candle.time < s.candles.at(-1).time) return false;
    try {
      const last = s.candles.at(-1), row = detailMerge([], [candle], s.iv)[0];
      if (row.time === last.time) { if (row.volume < last.volume) return false; s.candles[s.candles.length - 1] = row; }
      else if (row.time === intervalEnd(last.time, s.iv)) { s.candles.push(row); if (s.candles.length > DETAIL_CACHE_MAX) s.candles.shift(); }
      else { next = 0; return false; }
      s.at = now(); s.error = ''; return true;
    }
    catch { next = 0; return false; }
  }
  return { state: s, select, view, pan, older, newer, refresh, live, cancel, cacheSize: () => cache.size };
}
