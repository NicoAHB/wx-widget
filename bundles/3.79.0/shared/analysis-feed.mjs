import { ANALYSES } from './analysis-config.mjs';
import { TOP_DOWN, analysisClosed } from './analysis-top-down.mjs';
import { INTERVAL_MS } from './market-intervals.mjs';

// Pro Feed ein Abruf gleichzeitig; vorhandener App-/IndexedDB-Kerzen-Cache wird injiziert.
// Kein Tick-/Sekundenkurs löst die Auswertung aus: Schlüssel sind ausschließlich die letzten Schlusszeiten.
export function createAnalysisFeed({ context, fetchRows, definitions = ANALYSES, now = Date.now, changed = () => {}, signal = async () => {}, log = () => {}, runtimeServices = {} }) {
  const state = { entries: new Map(), busy: false, generation: 0, evaluations: 0, requests: 0 };
  let signature = '', controller = null, lastStart = -Infinity;
  // Erweiterbare, sessionspezifische Analysen; der bisherige Top-Down-Pfad bleibt unverändert.
  const runtimes = new Map(definitions.filter(d => d.createRuntime).map(d => [d.id, d.createRuntime({ ...runtimeServices, context, fetchRows, now, changed, signal, log })]));
  function sync() {
    for (const r of runtimes.values()) r.sync();
    const c = context(), enabled = !c.paused && !c.hidden && c.online !== false;
    const wanted = (c.symbols || []).map(s => ({ ...s, analyses:s.analyses.filter(id => !runtimes.has(id)) })).filter(s => s.analyses.length).filter(s => /^[A-Z0-9]{2,20}USDT$/.test(s.symbol) && ['spot', 'futures'].includes(s.market));
    const key = JSON.stringify([enabled, wanted.map(s => [s.symbol, s.market, [...s.analyses].sort()]).sort()]);
    if (key !== signature) {
      signature = key; state.generation++; controller?.abort(); controller = null; state.busy = false;
      // Pause/Offline/Zuklappen erhalten den Cache. Ohne neuen Schluss gibt es beim Zurückkehren keinen neuen Abruf/Rechenlauf.
      for (const e of state.entries.values()) e.analyses = [];
      for (const s of wanted) { const k = `${s.symbol}|${s.market}`, old = state.entries.get(k); if (old) old.analyses = [...s.analyses]; else state.entries.set(k, { ...s, rows: {}, next: {}, results: {}, resultKeys: {}, retryAt: 0, failures: 0, error: '', attempted: new Set() }); }
      for (const [k, e] of state.entries) if (state.entries.size > Math.max(32, wanted.length) && !e.analyses.length) state.entries.delete(k);
    }
    return enabled && wanted.length > 0;
  }
  function result(symbol, market, id) {
    if (runtimes.has(id)) return runtimes.get(id).result(symbol, market);
    const c = context(); if (c.paused || c.hidden || c.online === false) return { ready: false, stage: 0, reason: 'Analyse pausiert oder offline.' };
    const e = state.entries.get(`${symbol}|${market}`), r = e?.results[id];
    if (e?.error) return { ready: false, stage: 0, reason: e.error };
    if (r?.ready === false) return r;
    return r && now() < r.expiresAt ? r : { ready: false, stage: 0, reason: r ? 'Neue Schlusskerzen werden geladen.' : 'Kerzendaten werden geladen.' };
  }
  async function tick() {
    sync();
    for (const r of runtimes.values()) void r.tick().catch(e => log({kind:"error",text:"NY-Analyse: " + e.message}));
    if (!sync() || state.busy || now() - lastStart < 750) return;
    const at = now();
    const e = [...state.entries.values()].find(e => at >= e.retryAt && e.analyses.some(id => definitions.find(d => d.id === id)?.intervals.some(iv => !e.rows[iv]?.length || at >= (e.next[iv] || 0))));
    if (!e) return;
    const generation = state.generation; controller = new AbortController(); const abort = controller.signal; state.busy = true; lastStart = at;
    try {
      const intervals = [...new Set(e.analyses.flatMap(id => definitions.find(d => d.id === id)?.intervals || []))];
      for (const iv of intervals) {
        if (e.rows[iv]?.length && now() < e.next[iv]) continue;
        state.requests++; const r = await fetchRows(e.symbol, iv, TOP_DOWN.history + 2, abort);
        if (abort.aborted || generation !== state.generation) return;
        if (r.source !== e.market) throw Error('Analyse-Zeitrahmen müssen denselben Börsenmarkt verwenden.');
        const rows = analysisClosed(r.candles, iv, now());
        if (!rows.length || rows.at(-1).end !== Math.floor(now() / INTERVAL_MS[iv]) * INTERVAL_MS[iv]) throw Error(`${iv}: neue Schlusskerze fehlt.`);
        e.rows[iv] = rows.slice(-TOP_DOWN.history); e.next[iv] = rows.at(-1).end + INTERVAL_MS[iv] + 2500;
      }
      for (const id of e.analyses) {
        const d = definitions.find(d => d.id === id); if (!d) continue;
        const key = d.version + '|' + d.intervals.map(iv => e.rows[iv]?.at(-1)?.end).join('|');
        if (key !== e.resultKeys[id]) { e.results[id] = d.evaluate({ candles: e.rows, symbol: e.symbol, market: e.market, now: now() }); e.resultKeys[id] = key; state.evaluations++; }
        const r = e.results[id], s = r?.signal;
        if (s && now() < s.expiresAt) {
          const event = `${id}|${s.symbol}|${s.market}|${s.direction}|${s.setupId}`;
          if (!e.attempted.has(event)) void Promise.resolve(signal(s)).then(attempted => { if (attempted !== false && !abort.aborted && generation === state.generation) e.attempted.add(event); }).catch(() => log({ kind: 'error', symbol: e.symbol, text: `${e.symbol}: Analyse-Versand fehlgeschlagen; die übrigen Coins werden weiter geprüft.` }));
        }
      }
      e.error = ''; e.retryAt = 0; e.failures = 0;
    } catch (error) {
      if (!abort.aborted && generation === state.generation) { e.error = error.message || 'Kerzendaten fehlen.'; e.failures++; e.retryAt = now() + Math.min(300000, 15000 * 2 ** Math.min(e.failures, 4)); log({ symbol: e.symbol, kind: 'error', text: `${e.symbol}: ${e.error} Coin übersprungen; erneuter Versuch nach Wartezeit.` }); }
    } finally { if (generation === state.generation) { state.busy = false; controller = null; changed(); } }
  }
  // Einstellungen können während des Bildaufbaus geändert werden. Die Sendefreigabe wird deshalb im Aufrufer erneut geprüft.
  async function dispatch() {
    sync();
    for (const r of runtimes.values()) await r.dispatch();
    if (!sync()) return;
    for (const e of state.entries.values()) for (const id of e.analyses) {
      const s = result(e.symbol, e.market, id)?.signal; if (!s || now() >= s.expiresAt) continue;
      const event = `${id}|${s.symbol}|${s.market}|${s.direction}|${s.setupId}`;
      if (!e.attempted.has(event) && await signal(s) !== false) e.attempted.add(event);
    }
  }
  return { state, sync, tick, result, dispatch, runtime:id => runtimes.get(id) };
}
