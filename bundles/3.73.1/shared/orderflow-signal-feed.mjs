// Öffentliche Futures-Daten des bestehenden Workers/API-Clients. Keine private Börsenschnittstelle.
export const SIGNAL_PERIODS = Object.freeze({ '1m': 60000, '5m': 300000, '1h': 3600000, '4h': 14400000 });
export const SIGNAL_HISTORY = 121;
const n = value => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)) ? Number(value) : null;
function vol(total, buy) { total = n(total); buy = n(buy); return total !== null && buy !== null && total >= 0 && buy >= 0 && buy <= total ? { total, buy, sell: total - buy, delta: 2 * buy - total } : null; }
export function signalCandle(k, iv, { now, seenAt, eventAt = 0, startedAt = 0, source }) {
  const step = SIGNAL_PERIODS[iv], time = n(k?.t), end = n(k?.T) + 1, [open, high, low, close, volume] = ['o', 'h', 'l', 'c', 'v'].map(key => n(k?.[key]));
  if (!step || !Number.isSafeInteger(time) || time < 0 || time % step || end !== time + step || ![open, high, low, close].every(p => p > 0) || high < Math.max(open, close) || low > Math.min(open, close) || volume === null || volume < 0 || time > now + 5000) return null;
  if (source === 'ws' && (typeof k.x !== 'boolean' || !Number.isSafeInteger(eventAt) || eventAt < time || eventAt > now + 5000 || k.x && eventAt < end - 1)) return null;
  return { time, end, open, high, low, close, volume, closed: source === 'ws' ? k.x : end <= now, usdt: vol(k.q, k.Q), coins: vol(k.v, k.V), source, seenAt, eventAt, startedAt };
}
export function signalRows(rows, iv, meta) {
  return Array.isArray(rows) ? rows.slice(-SIGNAL_HISTORY).map(r => Array.isArray(r) ? signalCandle({ t: r[0], T: r[6], o: r[1], h: r[2], l: r[3], c: r[4], v: r[5], q: r[7], V: r[9], Q: r[10] }, iv, { ...meta, source: 'rest' }) : null).filter(Boolean) : [];
}
export function mergeSignalRows(previous, incoming) {
  const map = new Map(previous.map(c => [c.time, c]));
  for (const c of incoming) { const old = map.get(c.time);
    if (old?.closed && old.source === 'ws' && c.source === 'rest' && c.closed && c.startedAt >= old.seenAt) { if (!old.usdt || !old.coins) map.set(c.time, { ...old, usdt: old.usdt || c.usdt, coins: old.coins || c.coins }); continue; }
    if (old && (old.closed && !c.closed || c.source === 'rest' && old.source === 'ws' && (old.closed || old.seenAt >= c.startedAt) || c.source === 'ws' && old.source === 'ws' && (c.eventAt < old.eventAt || c.volume < old.volume))) continue;
    map.set(c.time, c);
  }
  return [...map.values()].sort((a, b) => a.time - b.time).slice(-SIGNAL_HISTORY);
}
export function oiWindow(rows, minuteSeries, now) {
  const xs = Array.isArray(rows) ? rows.filter(r => n(r.timestamp) !== null && n(r.sumOpenInterest) > 0).map(r => ({ at: n(r.timestamp), value: n(r.sumOpenInterest) })).sort((a, b) => a.at - b.at) : [], last = xs.at(-1), ref = last && xs.find(x => x.at === last.at - 900000);
  const price = at => minuteSeries.filter(c => c.closed && c.end <= at).at(-1);
  const a = last && price(last.at), b = ref && price(ref.at);
  if (!last || !ref || last.at > now || now - last.at > 600000 || !a || !b || last.at - a.end >= 60000 || ref.at - b.end >= 60000) return null;
  return { change: (last.value / ref.value - 1) * 100, priceChange: (a.close / b.close - 1) * 100, at: last.at };
}
export function createSignalFeed({ context, now, fetchKlines, fetchMarket, changed }) {
  const state = { symbol: '', epoch: 0, since: 0, paused: false, unavailable: false, sourceUnavailable: false, series: {}, btc: [], samples: [], oiRows: [], funding: null, longShort: null, marketAt: {}, tickSize: null, errors: {}, revision: 0 };
  const pending = new Map(), loadedAt = new Map(); let initial = null;
  function acceptRest({ symbol, interval, rows, startedAt }) {
    if (state.paused || !SIGNAL_PERIODS[interval] || symbol !== state.symbol && symbol !== 'BTCUSDT' || symbol === state.symbol && (state.unavailable || startedAt < state.since)) return;
    const incoming = signalRows(rows, interval, { now: now(), seenAt: Date.now(), startedAt }); if (!incoming.length) return;
    if (symbol === 'BTCUSDT' && interval === '1m') state.btc = mergeSignalRows(state.btc, incoming);
    if (symbol === state.symbol) state.series[interval] = mergeSignalRows(state.series[interval] || [], incoming);
    state.revision++; changed();
  }
  async function load(symbol, iv) {
    const key = symbol + '|' + iv, at = Date.now(); if (pending.has(key) || at - (loadedAt.get(key) || 0) < 30000 || state.paused) return;
    const controller = new AbortController(), epoch = state.epoch; pending.set(key, controller); loadedAt.set(key, at);
    try { const rows = await fetchKlines(symbol, iv, SIGNAL_HISTORY, controller.signal); if (epoch === state.epoch) { acceptRest({ symbol, interval: iv, rows, startedAt: at }); delete state.errors[key]; } }
    catch (e) { if (epoch === state.epoch && !controller.signal.aborted) { state.errors[key] = e.message; if (e.code === -1121 && symbol === state.symbol) state.unavailable = true; } }
    finally { if (pending.get(key) === controller) pending.delete(key); changed(); }
  }
  async function market(kind) {
    const at = Date.now(), key = state.symbol + '|' + kind, wait = kind === 'contract' ? 86400000 : kind === 'oi' || kind === 'longShort' ? 300000 : 900000;
    if (state.paused || state.unavailable || pending.has(key) || at - (loadedAt.get(key) || 0) < wait) return;
    const symbol = state.symbol, epoch = state.epoch, controller = new AbortController(); pending.set(key, controller); loadedAt.set(key, at);
    try { const data = await fetchMarket(kind, symbol, controller.signal); if (epoch !== state.epoch) return;
      if (kind === 'oi') state.oiRows = Array.isArray(data) ? data : [];
      if (kind === 'funding') state.funding = n(data?.lastFundingRate);
      if (kind === 'longShort') state.longShort = n(Array.isArray(data) ? data.at(-1)?.longShortRatio : null);
      if (kind === 'contract') { const contract = data?.symbols?.find(s => s.symbol === symbol), tick = n(contract?.filters?.find(f => f.filterType === 'PRICE_FILTER')?.tickSize); state.tickSize = tick > 0 ? tick : null; }
      state.marketAt[kind] = now();
      delete state.errors[key];
    } catch (e) { if (epoch === state.epoch && !controller.signal.aborted) state.errors[key] = e.message; }
    finally { if (pending.get(key) === controller) pending.delete(key); state.revision++; changed(); }
  }
  const latestQuote = rows => { const c = rows.filter(c => c.source === 'ws').at(-1); return c ? { price: c.close, at: c.eventAt, fresh: !state.paused && context().connected && Math.max(now() - c.eventAt, Date.now() - c.seenAt, 0) <= 5000 } : null; };
  function sync() {
    const ctx = context(); if (state.symbol !== ctx.symbol || state.paused !== ctx.paused) {
      state.epoch++; state.since = Date.now(); for (const p of pending.values()) p.abort(); pending.clear(); loadedAt.clear(); clearTimeout(initial);
      if (state.symbol !== ctx.symbol) { state.symbol = ctx.symbol; state.series = {}; state.oiRows = []; state.funding = state.longShort = state.tickSize = null; state.marketAt = {}; state.errors = {}; state.unavailable = false; }
      state.paused = ctx.paused; if (!state.paused) initial = setTimeout(() => tick(), 350);
    }
    if (ctx.unavailable) state.unavailable = true; else if (state.sourceUnavailable) { state.unavailable = false; loadedAt.clear(); }
    state.sourceUnavailable = !!ctx.unavailable;
    return !state.paused;
  }
  function streams() { sync(); return state.paused ? [] : [...(!state.unavailable ? Object.keys(SIGNAL_PERIODS).map(iv => `${state.symbol.toLowerCase()}@kline_${iv}`) : []), 'btcusdt@kline_1m']; }
  function kline(m) {
    sync(); if (state.paused || m.m !== 'futures' || !SIGNAL_PERIODS[m.i] || m.s !== state.symbol && !(m.s === 'BTCUSDT' && m.i === '1m')) return;
    const c = signalCandle({ ...m.k, v: m.k.ofV, x: m.k.ofX }, m.i, { now: now(), seenAt: Date.now(), eventAt: m.E, source: 'ws' }); if (!c) return;
    if (m.s === state.symbol && !state.unavailable) state.series[m.i] = mergeSignalRows(state.series[m.i] || [], [c]);
    if (m.s === 'BTCUSDT' && m.i === '1m') { state.btc = mergeSignalRows(state.btc, [c]); const last = state.samples.at(-1); if (!last || m.E - last.at >= 500) state.samples.push({ at: m.E, price: c.close }); state.samples = state.samples.filter(s => s.at >= m.E - 3660000); }
    state.revision++; changed();
  }
  function tick() {
    sync(); if (state.paused) return;
    if (state.btc.length < 65 || !latestQuote(state.btc)?.fresh) void load('BTCUSDT', '1m');
    if (!state.unavailable) { for (const iv of Object.keys(SIGNAL_PERIODS)) {
      const rows = state.series[iv] || [], end = Math.floor(now() / SIGNAL_PERIODS[iv]) * SIGNAL_PERIODS[iv], closed = rows.filter(c => c.closed), gap = closed.length && (closed.at(-1).end < end || closed.some((c, i) => i && c.time !== closed[i - 1].end));
      if (rows.length < (iv === '1m' ? 24 : 51) || gap) void load(state.symbol, iv);
    } for (const kind of ['oi', 'funding', 'longShort', 'contract']) void market(kind); }
  }
  return { state, sync, streams, kline, tick, acceptRest, quote: () => latestQuote(state.series['1m'] || []), btcQuote: () => latestQuote(state.btc), oi: () => oiWindow(state.oiRows, state.series['1m'] || [], now()) };
}
