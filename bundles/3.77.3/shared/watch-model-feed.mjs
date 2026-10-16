// 3.72.0: zusätzlicher 15m-/4h-Kontext nur bei eingeschaltetem Testmodell.
import { WATCH_BASE_MS, WATCH_TREND_MS, WATCH_HISTORY, watchClosed, watchStrictRating } from './watch-model-core.mjs';
export function createWatchModelFeed({ context, fetchRows, now = Date.now, changed = () => {} }) {
  const state = { entries: new Map(), enabled: false, pending: false, revision: 0 };
  let universeKey = '', generation = 0, controller = null, lastStart = 0;
  const fail = reason => ({ ready: false, direction: 0, count: null, longCount: 0, shortCount: 0, rules: [], reason });
  function sync() {
    const c = context(), enabled = !!c.enabled && !c.paused && !c.hidden && c.online !== false;
    const universe = (c.symbols || []).filter(x => /^[A-Z0-9]{2,20}USDT$/.test(x.symbol) && ['spot', 'futures'].includes(x.market));
    const key = JSON.stringify(universe.map(x => [x.symbol, x.market]).sort());
    if (enabled !== state.enabled || key !== universeKey) {
      generation++; controller?.abort(); controller = null; state.pending = false; state.enabled = enabled; universeKey = key; lastStart = 0;
      for (const [symbol, e] of state.entries) if (!universe.some(x => x.symbol === symbol && x.market === e.market)) state.entries.delete(symbol);
      for (const u of universe) if (!state.entries.has(u.symbol)) state.entries.set(u.symbol, { ...u, lower: [], higher: [], loadedAt: 0, retryAt: 0, error: '', cachedKey: '', cached: null });
      state.revision++;
    }
    return enabled;
  }
  function result(symbol, at = now()) {
    if (!sync()) return fail('Testmodell pausiert oder nicht aktiv.');
    const e = state.entries.get(symbol); if (!e) return fail('Coin-Daten werden geladen.');
    if (e.error) return fail(e.error);
    const key = `${e.lower.at(-1)?.end}|${e.higher.at(-1)?.end}|${state.revision}`;
    if (key !== e.cachedKey) { e.cached = watchStrictRating({ lower: e.lower, higher: e.higher, now: at }); e.cachedKey = key; }
    const r = e.cached;
    if (r?.ready && at >= r.expiresAt) return fail('Neue 15m-Kerze fehlt – noch keine Freigabe.');
    return r || fail('15m-/4h-Daten werden geladen.');
  }
  async function tick() {
    if (!sync() || state.pending || now() - lastStart < 400) return;
    const at = now(), e = [...state.entries.values()].find(x => at >= x.retryAt && (!x.loadedAt || !x.lower.length || !x.higher.length || x.lower.at(-1).end < Math.floor(at / WATCH_BASE_MS) * WATCH_BASE_MS || x.higher.at(-1).end < Math.floor(at / WATCH_TREND_MS) * WATCH_TREND_MS));
    if (!e) return;
    const mine = generation; controller = new AbortController(); const signal = controller.signal; state.pending = true; lastStart = at;
    try {
      const lower = await fetchRows(e.symbol, '15m', WATCH_HISTORY + 1, signal);
      if (signal.aborted || generation !== mine) return;
      const higher = await fetchRows(e.symbol, '4h', WATCH_HISTORY + 1, signal);
      if (signal.aborted || generation !== mine) return;
      if (lower.source !== e.market || higher.source !== e.market) throw new Error('15m und 4h müssen zum selben Markt wie die Vorauswahl gehören.');
      e.lower = watchClosed(lower.candles, WATCH_BASE_MS, now()).slice(-WATCH_HISTORY);
      e.higher = watchClosed(higher.candles, WATCH_TREND_MS, now()).slice(-WATCH_HISTORY);
      e.loadedAt = now(); e.error = ''; e.retryAt = now() + 15000; e.cachedKey = '';
    } catch (error) { if (mine === generation && !signal.aborted) { e.error = error.message || 'Kerzendaten nicht erreichbar.'; e.retryAt = now() + 60000; e.cachedKey = ''; } }
    finally { if (mine === generation) { state.pending = false; controller = null; state.revision++; changed(); } }
  }
  function kline(m) {
    if (!sync() || !['15m', '4h'].includes(m.i)) return;
    const e = state.entries.get(m.s); if (!e || e.market !== m.m || !m.k.x) return;
    const step = m.i === '15m' ? WATCH_BASE_MS : WATCH_TREND_MS, key = m.i === '15m' ? 'lower' : 'higher', k = m.k;
    try {
      const rows = watchClosed([{ time: k.t, end: k.T + 1, open: k.o, high: k.h, low: k.l, close: k.c, volume: k.v }], step, now());
      if (!rows.length || !e[key].length) return;
      const c = rows[0], last = e[key].at(-1);
      if (c.time < last.time) return;
      if (c.time > last.end) { e.error = 'Datenlücke – Kerzen werden erneut geladen.'; e.loadedAt = 0; e.retryAt = 0; state.revision++; changed(); return; }
      if (c.time === last.time) e[key][e[key].length - 1] = c; else e[key].push(c);
      e[key] = e[key].slice(-WATCH_HISTORY); e.cachedKey = ''; e.error = ''; state.revision++;
      changed();
    } catch { e.error = 'Ungültige Live-Kerze – keine Freigabe.'; e.loadedAt = 0; e.retryAt = 0; state.revision++; changed(); }
  }
  function streams() { return sync() ? [...state.entries.values()].flatMap(e => ['15m', '4h'].map(iv => ({ m: e.market, s: `${e.symbol.toLowerCase()}@kline_${iv}` }))) : []; }
  function suspend() { generation++; controller?.abort(); controller = null; state.pending = false; state.enabled = false; state.revision++; }
  return { state, result, tick, kline, streams, sync, suspend };
}
