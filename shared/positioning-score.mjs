// position-1: getrennte Anzeigenbewertung, keine Handelsstimme und keine Kursprognose.
export const POSITIONING_CONFIG = Object.freeze({
  windowMs: 30 * 86400000, updateMs: 300000, fundingHistoryMs: 3600000,
  ratioHistoryMs: 14400000, ratioPeriod: '4h', cacheSize: 4, minSamples: 2,
  fundingWeight: .5, ratioWeight: .5, squeezeLow: 15, squeezeHigh: 85
});
const numeric = v => (typeof v === 'number' || typeof v === 'string' && v.trim() !== '') && Number.isFinite(Number(v)) ? Number(v) : null;
const validSymbol = s => typeof s === 'string' && /^[A-Z0-9]{2,24}USDT$/.test(s);

// Empirischer Perzentilrang: gleiche Werte teilen ihren Rang. Eine konstante Reihe ergibt 50.
export function positioningPercentile(value, samples) {
  if (!Number.isFinite(value) || !Array.isArray(samples) || !samples.length || samples.some(v => !Number.isFinite(v))) return null;
  let below = 0, equal = 0;
  for (const v of samples) { if (v < value) below++; else if (v === value) equal++; }
  return 100 * (below + .5 * equal) / samples.length;
}
export function positioningScore(funding, ratio, fundingHistory, ratioHistory, config = POSITIONING_CONFIG) {
  if (!Number.isFinite(ratio) || ratio < 0 || !fundingHistory || !ratioHistory || fundingHistory.length < config.minSamples || ratioHistory.length < config.minSamples) return null;
  const fundingPercentile = positioningPercentile(funding, fundingHistory), ratioPercentile = positioningPercentile(ratio, ratioHistory);
  if (fundingPercentile === null || ratioPercentile === null) return null;
  const score = Math.round(config.fundingWeight * fundingPercentile + config.ratioWeight * ratioPercentile);
  return { score, fundingPercentile, ratioPercentile, funding, ratio,
    label: score < 50 ? 'Short-lastig' : score > 50 ? 'Long-lastig' : 'Neutral',
    squeeze: score < config.squeezeLow || score > config.squeezeHigh };
}

function series(rows, symbol, kind, from, to) {
  if (!Array.isArray(rows)) throw Error('Binance-Futures-Historie fehlt.');
  const out = new Map();
  for (const r of rows) {
    const at = numeric(r?.[kind === 'funding' ? 'fundingTime' : 'timestamp']);
    const value = numeric(r?.[kind === 'funding' ? 'fundingRate' : 'longShortRatio']);
    if (r?.symbol != null && r.symbol !== symbol || !Number.isSafeInteger(at) || at < 0 || value === null || kind === 'ratio' && value < 0) throw Error('Unvollständige oder fremde Binance-Futures-Daten.');
    if (at >= from && at <= to) out.set(at, { at, value });
  }
  return [...out.values()].sort((a, b) => a.at - b.at);
}
const merge = (a, b, from, to) => [...new Map([...a, ...b].filter(r => r.at >= from && r.at <= to).map(r => [r.at, r])).values()].sort((a, b) => a.at - b.at);

// Flüssige Anzeige aus einem begrenzten RAM-Cache; alle Abrufe laufen über den vorhandenen API-Client.
export function createPositioningFeed({ request, changed = () => {}, now = () => Date.now(), config = POSITIONING_CONFIG }) {
  const state = { symbol: '', busy: false, result: null, error: '', nextAt: 0, requests: 0 }, cache = new Map();
  let epoch = 0, controller = null, task = null, current = null, blockedUntil = 0;
  const notify = () => changed(state);
  function cancel() { epoch++; controller?.abort(); controller = null; task = null; state.busy = false; }
  function context(symbol) {
    symbol = validSymbol(symbol) ? symbol : '';
    if (symbol === state.symbol) return;
    cancel(); state.symbol = symbol;
    current = cache.get(symbol) || { funding: [], ratios: [], fundingAt: 0, ratiosAt: 0, result: null, error: '', nextAt: 0 };
    if (symbol) { cache.delete(symbol); cache.set(symbol, current); while (cache.size > config.cacheSize) cache.delete(cache.keys().next().value); }
    Object.assign(state, { result: current.result, error: current.error, nextAt: current.nextAt }); notify();
  }
  function usable() { return state.result && !state.error && now() >= state.result.at && now() - state.result.at <= config.updateMs + 30000 ? state.result : null; }
  async function tick(symbol, enabled = true) {
    context(symbol);
    if (!enabled || !state.symbol) { if (state.busy) cancel(); return; }
    if (task) return task;
    if (now() < Math.max(state.nextAt, blockedUntil)) return;
    const token = epoch, captured = state.symbol, entry = current, ctrl = new AbortController(), at = now(), from = at - config.windowMs;
    controller = ctrl; state.busy = true; notify();
    const active = () => token === epoch && !ctrl.signal.aborted;
    const get = async (path, params) => {
      state.requests++; const r = await request(path, { symbol: captured, ...params }, ctrl.signal);
      if (!active()) throw new DOMException('Abgebrochen', 'AbortError');
      return r;
    };
    const promise = (async () => {
      try {
        const premium = await get('/fapi/v1/premiumIndex', {}), funding = numeric(premium?.lastFundingRate), time = numeric(premium?.time);
        if (premium?.symbol !== captured || funding === null || time === null || Math.abs(at - time) > 180000) throw Error('Aktuelle Funding-Rate nicht verfügbar.');
        entry.funding = merge(entry.funding, [], from, at); entry.ratios = merge(entry.ratios, [], from, at);
        if (!entry.fundingAt || at - entry.fundingAt >= config.fundingHistoryMs || entry.funding.length < config.minSamples) {
          const fresh = []; let startTime = entry.funding.length >= config.minSamples ? entry.funding.at(-1).at + 1 : from;
          // fundingRate liefert aufsteigend maximal 1000 Werte; auch kürzere Funding-Intervalle vollständig laden.
          for (let page = 0; page < 8; page++) {
            const rows = await get('/fapi/v1/fundingRate', { startTime, endTime: at, limit: 1000 });
            const part = series(rows, captured, 'funding', from, at); fresh.push(...part);
            if (rows.length < 1000) break;
            if (!part.length || part.at(-1).at < startTime || page === 7) throw Error('Funding-Historie konnte nicht vollständig geladen werden.');
            startTime = part.at(-1).at + 1; if (startTime > at) break;
          }
          entry.funding = merge(entry.funding, fresh, from, at); entry.fundingAt = at;
        }
        let ratioCurrent;
        if (!entry.ratiosAt || at - entry.ratiosAt >= config.ratioHistoryMs || entry.ratios.length < config.minSamples) {
          entry.ratios = series(await get('/futures/data/globalLongShortAccountRatio', { period: config.ratioPeriod, startTime: from, endTime: at, limit: 500 }), captured, 'ratio', from, at);
          entry.ratiosAt = at; ratioCurrent = entry.ratios.at(-1);
        } else {
          const latest = series(await get('/futures/data/globalLongShortAccountRatio', { period: config.ratioPeriod, limit: 1 }), captured, 'ratio', from, at);
          ratioCurrent = latest.at(-1); entry.ratios = merge(entry.ratios, latest, from, at);
        }
        if (!ratioCurrent || at - ratioCurrent.at > config.ratioHistoryMs + config.updateMs) throw Error('Aktuelles Long/Short-Verhältnis nicht verfügbar.');
        const q = positioningScore(funding, ratioCurrent.value, entry.funding.map(r => r.value), entry.ratios.map(r => r.value), config);
        if (!q) throw Error('Zu wenig gültige Vergleichsdaten für die Positionierung.');
        if (!active()) return;
        entry.result = { ...q, symbol: captured, at, fundingAt: time, ratioAt: ratioCurrent.at, fundingCount: entry.funding.length, ratioCount: entry.ratios.length,
          fundingFrom: entry.funding[0].at, ratioFrom: entry.ratios[0].at };
        entry.error = ''; entry.nextAt = now() + config.updateMs;
      } catch (e) {
        if (!active()) return;
        entry.result = null; entry.error = e.code === -1121 ? 'Für diesen Coin ist kein Binance-USDT-Perpetual verfügbar.' : e.message || 'Positionierung derzeit nicht verfügbar.';
        const wait = Math.max(config.updateMs, Number(e.retryMs) || Number(e.retryAfterMs) || 0);
        entry.nextAt = now() + wait; if (e.rate || e.status === 429 || e.status === 418) blockedUntil = entry.nextAt;
      } finally {
        if (active()) { Object.assign(state, { result: entry.result, error: entry.error, nextAt: entry.nextAt, busy: false }); task = null; controller = null; notify(); }
      }
    })();
    task = promise; await promise;
  }
  return { state, tick, cancel, usable };
}
