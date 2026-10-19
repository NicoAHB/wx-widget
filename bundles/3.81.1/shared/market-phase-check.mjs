import { MARKET_PHASE, PHASE_MS, PHASE_ZEITRAHMEN, phaseHistoryBars, prepareMarketPhase, marketPhaseAt, calculateMarketPhase } from './market-phase-core.mjs';
import { nyWait } from './ny-open-history.mjs';
const cancelled = s => { if (s?.aborted) throw s.reason || new globalThis.DOMException('Abgebrochen', 'AbortError'); };

export function phaseCheckRange(now) {
  const date = new Date(now), day = date.getUTCDate(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - MARKET_PHASE.checkMonths);
  date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()));
  return { from: Math.floor(date.getTime() / PHASE_MS) * PHASE_MS, to: Math.floor(now / PHASE_MS) * PHASE_MS };
}
export function phaseFutureOutcome(close, laterClose, atr) {
  const move = laterClose - close, threshold = MARKET_PHASE.checkMoveATR * atr;
  return move > threshold ? 1 : move < -threshold ? -1 : 0;
}
export async function scanPhaseCheck({ candles, symbol, market, from, to, signal }) {
  cancelled(signal); const prepared = prepareMarketPhase(candles, to), buckets = Object.fromEntries([1, -1, 0].map(d => [d, { phase: d, count: 0, hits: 0, actual: 0 }]));
  let total = 0;
  for (let i = phaseHistoryBars() - 1; i + MARKET_PHASE.checkForwardBars < prepared.rows.length; i++) {
    cancelled(signal); if (i % 128 === 0) await nyWait(0, signal);
    const c = prepared.rows[i], future = prepared.rows[i + MARKET_PHASE.checkForwardBars];
    if (c.end < from || c.end > to || future.end > to) continue;
    const r = marketPhaseAt(prepared, i); if (!r.ready || !(r.atr > 0)) continue;
    const actual = phaseFutureOutcome(c.close, future.close, r.atr);
    buckets[r.phase].count++; buckets[r.phase].hits += actual === r.phase ? 1 : 0; buckets[actual].actual++; total++;
  }
  return { symbol, market, total, rows: [1, -1, 0].map(d => ({ ...buckets[d], hitrate: buckets[d].count ? buckets[d].hits / buckets[d].count : null, baseline: total ? buckets[d].actual / total : null })) };
}
export function phaseWorkerJob(factory, job, signal) {
  if (!factory) return job.type === 'calculate' ? Promise.resolve(calculateMarketPhase(job)) : scanPhaseCheck({ ...job, signal });
  return new Promise((resolve, reject) => {
    cancelled(signal); let worker;
    const finish = (error, value) => { signal?.removeEventListener('abort', abort); worker?.terminate(); error ? reject(error) : resolve(value); },
      abort = () => finish(signal.reason || new globalThis.DOMException('Abgebrochen', 'AbortError'));
    try { worker = factory(); worker.onmessage = e => e.data.error ? finish(Error(e.data.error)) : e.data.done && finish(null, e.data.value);
      worker.onerror = () => finish(Error('Marktphasen-Worker konnte nicht ausgeführt werden.'));
      signal?.addEventListener('abort', abort, { once: true }); worker.postMessage(job);
    } catch (e) { finish(e); }
  });
}
export async function runPhaseCheck({ symbols, history, now = Date.now(), from, to, signal, workerFactory, progress = () => {} }) {
  const window = { ...phaseCheckRange(now), ...(from != null ? { from } : {}), ...(to != null ? { to } : {}) }, coins = [], errors = [];
  for (const coin of symbols) {
    cancelled(signal);
    try {
      if (!coin.market) throw Error('Börsenmarkt der Vorauswahl noch nicht geladen.');
      const rows = [], first = window.from - phaseHistoryBars() * PHASE_MS;
      for (let cursor = first; cursor < window.to;) {
        cancelled(signal); const next = Math.min(window.to, cursor + MARKET_PHASE.historyChunkDays * 86400000);
        progress({ symbol: coin.symbol, checked: coins.length, total: symbols.length, from: cursor, to: next });
        const batch = await history({ ...coin, timeframe: PHASE_ZEITRAHMEN, from: cursor, to: next, signal }); cancelled(signal);
        if (batch.length !== (next - cursor) / PHASE_MS || batch.some((c, i) => c.time !== cursor + i * PHASE_MS || c.end !== c.time + PHASE_MS)) throw Error('Historische 1H-Kerzen fehlen; Coin nicht vollständig geprüft.');
        rows.push(...batch); cursor = next;
      }
      coins.push(await phaseWorkerJob(workerFactory, { type: 'check', ...coin, ...window, candles: rows }, signal));
    } catch (error) { cancelled(signal); errors.push({ symbol: coin.symbol, text: error.message }); }
  }
  return { version: MARKET_PHASE.version, at: now, ...window, symbols, coins, errors, checked: coins.length };
}
