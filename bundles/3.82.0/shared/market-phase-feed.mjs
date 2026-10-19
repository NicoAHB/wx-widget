import { MARKET_PHASE, PHASE_MS, PHASE_ZEITRAHMEN, PHASE_CACHE_KEY, PHASE_LOG_KEY, phaseHistoryBars, unknownPhase } from './market-phase-core.mjs';
import { analysisClosed } from './analysis-top-down.mjs';
import { phaseWorkerJob } from './market-phase-check.mjs';

// Ein gemeinsamer Verbraucher je Coin/Markt. Chart-Zeitrahmen und HA sind bewusst keine Eingänge.
export function createMarketPhaseFeed({ context, fetchRows, now = Date.now, changed = () => {}, read = () => null, write = () => {}, workerFactory }) {
  const state = { entries: new Map(), pending: false, requests: 0, calculations: 0 };
  let signature = '', generation = 0, controller = null, lastStart = -Infinity;
  function sync() {
    const c = context(), symbols = (c.symbols || []).filter(s => /^[A-Z0-9]{2,20}USDT$/.test(s.symbol) && ['spot', 'futures'].includes(s.market)),
      enabled = !c.paused && !c.hidden && c.online !== false, key = JSON.stringify([enabled, symbols.map(s => [s.symbol, s.market]).sort()]);
    if (key !== signature) {
      signature = key; generation++; controller?.abort(); controller = null; state.pending = false;
      for (const [symbol, e] of state.entries) if (!symbols.some(s => s.symbol === symbol && s.market === e.market)) state.entries.delete(symbol);
      for (const s of symbols) if (!state.entries.has(s.symbol)) state.entries.set(s.symbol, { ...s, next: 0, result: null, failures: 0 });
    }
    return enabled;
  }
  function getMarktphase(coin) {
    sync(); coin=String(coin||''); const symbol = coin.endsWith('USDT') ? coin : coin + 'USDT', e = state.entries.get(symbol);
    if (e?.error) return { ...unknownPhase(e.error), symbol, market: e.market };
    if (!e?.result?.ready) return { ...unknownPhase('Geschlossene 1H-Kerzen werden geladen.'), symbol, market: e?.market };
    if (now() >= e.result.at + PHASE_MS + MARKET_PHASE.staleGraceMs) return { ...unknownPhase('Neueste geschlossene 1H-Kerze fehlt.'), symbol, market: e.market };
    return e.result;
  }
  function recordChange(result) {
    const saved = read(PHASE_LOG_KEY), list = Array.isArray(saved) ? saved : [], previous = list.filter(x => x.symbol === result.symbol && x.market === result.market && x.version === result.version).at(-1);
    if (previous?.phase === result.phase) return;
    const id = [result.version, result.symbol, result.market, result.at, result.phase].join('|');
    if (!list.some(x => x.id === id)) write(PHASE_LOG_KEY, [...list, { ...result, id, loggedAt: now() }].sort((a, b) => a.at - b.at).slice(-MARKET_PHASE.maxLog));
  }
  async function tick() {
    if (!sync() || state.pending || now() - lastStart < MARKET_PHASE.requestSpacingMs) return;
    const at = now(), end = Math.floor(at / PHASE_MS) * PHASE_MS,
      e = [...state.entries.values()].find(x => at >= x.next && (!x.result?.ready || x.result.at < end));
    if (!e) return;
    const gen = generation; controller = new AbortController(); const abort = controller.signal; state.pending = true; lastStart = at;
    try {
      const saved = read(PHASE_CACHE_KEY), cached = saved?.version === MARKET_PHASE.version ? saved.entries?.[e.symbol + '|' + e.market] : null;
      let rows;
      if (cached?.at(-1)?.end === end && cached.length >= phaseHistoryBars()) rows = cached;
      else { state.requests++; const loaded = await fetchRows(e.symbol, PHASE_ZEITRAHMEN, phaseHistoryBars() + 1, abort);
        if (abort.aborted || gen !== generation) return;
        if (loaded.source !== e.market) throw Error('1H-Marktdaten müssen zum Markt der Signalkarte gehören.');
        rows = loaded.candles;
      }
      rows = analysisClosed(rows, PHASE_ZEITRAHMEN, at).slice(-phaseHistoryBars());
      if (rows.at(-1)?.end !== end) throw Error('Neueste geschlossene 1H-Kerze fehlt.');
      const result = await phaseWorkerJob(workerFactory, { type: 'calculate', candles: rows, now: at, symbol: e.symbol, market: e.market }, abort);
      if (abort.aborted || gen !== generation) return;
      if (!result.ready) throw Error(result.reason);
      state.calculations++; e.result = result; e.error = ''; e.failures = 0; e.next = end + PHASE_MS + MARKET_PHASE.closeGraceMs;
      const entries = {};
      for (const x of state.entries.values()) { const key = x.symbol + '|' + x.market, value = key === e.symbol + '|' + e.market ? rows : saved?.entries?.[key]; if (value) entries[key] = value; }
      write(PHASE_CACHE_KEY, { version: MARKET_PHASE.version, entries }); recordChange(result);
    } catch (error) { if (!abort.aborted && gen === generation) { e.error = error.message || '1H-Daten nicht erreichbar.'; e.failures++; e.next = now() + Math.min(MARKET_PHASE.maxRetryMs, MARKET_PHASE.retryMs * 2 ** Math.min(e.failures - 1, 4)); } }
    finally { if (gen === generation) { state.pending = false; controller = null; changed(); } }
  }
  return { state, sync, tick, getMarktphase };
}
