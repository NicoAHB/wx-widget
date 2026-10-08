// 3.44.0 (G10b): öffentlicher Bitget-Adapter für Browser, Worker und Node. Keine Kontoabfrage/Orders.
import { MODEL_VERSION, settings, parametersKey, createIndicatorState, advanceIndicators, closedCandles, frameSnapshot } from './confluence-core.mjs';

export const FEED_VERSION = 'bg-public-1';
export const BITGET_ORIGIN = 'https://api.bitget.com';
export const BITGET_FRAMES = Object.freeze({ '1m': { granularity: '1m', periodMs: 60e3 }, '5m': { granularity: '5m', periodMs: 300e3 }, '15m': { granularity: '15m', periodMs: 900e3 }, '1h': { granularity: '1H', periodMs: 3600e3 }, '4h': { granularity: '4H', periodMs: 14400e3 }, '1d': { granularity: '1Dutc', periodMs: 86400e3 } });
const TAIL = 512, MAX_PAGES = 8, MAX_BODY = 1024 * 1024;
const time = x => Number.isSafeInteger(x) && x >= 0;
const positive = x => Number.isFinite(x) && x > 0;
const clone = x => JSON.parse(JSON.stringify(x));
function numeric(x) {
  if (typeof x !== 'number' && (typeof x !== 'string' || !/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(x))) throw new Error('Bitget-Zahlenwert fehlt/ist ungültig');
  const n = Number(x); if (!Number.isFinite(n)) throw new Error('Bitget-Zahlenwert außerhalb des Zahlenbereichs'); return n;
}
function instrument(x) { if (typeof x !== 'string' || !/^[A-Z0-9]+USDT$/.test(x)) throw new Error('Gültiges Bitget-USDT-Instrument fehlt'); return x; }
function frame(x) { if (!Object.hasOwn(BITGET_FRAMES, x)) throw new Error('Bitget-Zeitebene nicht unterstützt'); return BITGET_FRAMES[x]; }
const sameBar = (a, b) => ['time', 'end', 'open', 'high', 'low', 'close', 'volume'].every(k => a[k] === b[k]);
const errorMessage = e => e.name === 'SyntaxError' ? 'Bitget-Antwort ist kein gültiges JSON' : e.name === 'TypeError' ? 'Bitget-Netzwerkzugriff oder Antwortformat nicht verfügbar' : e.name === 'AbortError' ? 'Bitget-Abfrage abgebrochen' : e.message;
async function readBody(res) {
  if (!res.body) throw new Error('Bitget-Antwort ist leer');
  const reader = res.body.getReader(), decoder = new TextDecoder(); let size = 0, text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); throw new Error('Bitget-Antwort überschreitet die Größenbegrenzung'); }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}

export function normalizeBitgetCandles(data, { timeframe, from, to, knownAt }) {
  const { periodMs } = frame(timeframe);
  if (!Array.isArray(data) || data.length > 200 || ![from, to, knownAt].every(time) || from > to || to > knownAt || from % periodMs || to % periodMs) throw new Error('Bitget-Kerzenkontext ungültig');
  const byTime = new Map();
  for (const row of data) {
    if (!Array.isArray(row) || row.length < 7) throw new Error('Bitget-OHLCV-Antwort ungültig');
    const t = numeric(row[0]);
    if (!time(t) || t % periodMs) throw new Error('Bitget-Kerze nicht an UTC-Grenze');
    if (t < from || t + periodMs > to) continue; // laufende/außerhalb angefragte Kerzen nie verwenden
    const c = { time: t, end: t + periodMs, knownAt, open: numeric(row[1]), high: numeric(row[2]), low: numeric(row[3]), close: numeric(row[4]), volume: numeric(row[5]) };
    if (byTime.has(t) && !sameBar(byTime.get(t), c)) throw new Error('Widersprüchliche doppelte Bitget-Kerze');
    byTime.set(t, c);
  }
  return closedCandles([...byTime.values()].sort((a, b) => a.time - b.time), knownAt, periodMs);
}

export function normalizeBitgetContract(data, symbol) {
  instrument(symbol);
  if (!Array.isArray(data)) throw new Error('Bitget-Kontraktdaten fehlen');
  const matches = data.filter(x => x?.symbol === symbol);
  if (matches.length !== 1) throw new Error('Bitget-Instrument fehlt oder ist mehrdeutig');
  const c = matches[0], places = numeric(c.pricePlace), step = numeric(c.priceEndStep);
  if (c.quoteCoin !== 'USDT' || c.symbolType !== 'perpetual' || c.symbolStatus !== 'normal' || !Array.isArray(c.supportMarginCoins) || !c.supportMarginCoins.includes('USDT') || !Number.isInteger(places) || places < 0 || places > 12 || !Number.isInteger(step) || !positive(step)) throw new Error('Kein aktiver Bitget-USDT-Perpetual-Kontrakt');
  const tickSize = step * 10 ** -places, quantityStep = numeric(c.sizeMultiplier), minQuantity = numeric(c.minTradeNum), minNotional = numeric(c.minTradeUSDT);
  if (!positive(tickSize) || !positive(quantityStep) || minQuantity < 0 || minNotional < 0) throw new Error('Bitget-Preis-/Mengengrenzen ungültig');
  return { venue: 'bitget', product: 'USDT-FUTURES', instrument: symbol, quote: 'USDT', tickSize, quantityStep, minQuantity, minNotional, status: 'normal' };
}

export function normalizeBitgetFunding(data, { symbol, source, providerAt, observedAt }) {
  if (!Array.isArray(data) || ![providerAt, observedAt].every(time) || providerAt > observedAt || observedAt - providerAt > 30000) throw new Error('Bitget-Fundingzeit fehlt/ist veraltet');
  const rows = data.filter(x => x?.symbol === instrument(symbol));
  if (rows.length !== 1) throw new Error('Bitget-Funding fehlt oder ist mehrdeutig');
  const f = rows[0], rate = numeric(f.fundingRate), intervalHours = numeric(f.fundingRateInterval), nextAt = numeric(f.nextUpdate);
  if (!positive(intervalHours) || intervalHours > 24 || !time(nextAt) || nextAt <= providerAt || nextAt - providerAt > intervalHours * 3600e3) throw new Error('Tatsächliches Bitget-Fundingintervall/Abrechnungstermin fehlt');
  // Aktuell angekündigte Rate: für die Punkte, keine belegte historische oder künftige Netto-Abrechnung.
  return { source: clone(source), rate, intervalHours, at: providerAt, knownAt: observedAt, nextAt, positiveMeans: 'long-pays', kind: 'current', costsComplete: false };
}

// G10(c): öffentlicher Referenzkurs erst nach der Score-Entscheidung, keine rückwirkende Ausführung.
export function normalizeBitgetQuote(data, { symbol, decisionAt, providerAt, observedAt }) {
  if (![decisionAt, providerAt, observedAt].every(time) || decisionAt > observedAt || providerAt < decisionAt || providerAt > observedAt || observedAt - providerAt > 30000 || !Array.isArray(data)) throw new Error('Bitget-Referenzkurs nach Entscheidung fehlt');
  const matches = data.filter(x => x?.symbol === instrument(symbol));
  if (matches.length !== 1) throw new Error('Bitget-Referenzkurs fehlt oder ist mehrdeutig');
  const r = matches[0], at = numeric(r.ts), bid = numeric(r.bidPr), ask = numeric(r.askPr), markPrice = numeric(r.markPrice);
  if (!time(at) || at < decisionAt || at > observedAt || observedAt - at > 30000 || ![bid, ask, markPrice].every(positive) || bid > ask) throw new Error('Bitget-Referenzkurs veraltet/ungültig');
  return { venue: 'bitget', product: 'USDT-FUTURES', instrument: symbol, quote: 'USDT', bid, ask, markPrice, at, providerAt, knownAt: observedAt };
}

// G10(d): abgerechnete Raten sind ausschließlich historische Kosten, keine damaligen Scoreeingaben.
export function normalizeBitgetSettlements(data, { symbol, observedAt }) {
  instrument(symbol);
  if (!Array.isArray(data) || data.length > 100 || !time(observedAt)) throw new Error('Bitget-Abrechnungshistorie ungültig');
  const by = new Map();
  for (const row of data) {
    const at = numeric(row.fundingTime), rate = numeric(row.fundingRate);
    if (row.symbol !== symbol || !time(at) || at > observedAt) throw new Error('Fremde/zukünftige Bitget-Abrechnung');
    if (by.has(at) && by.get(at).rate !== rate) throw new Error('Widersprüchliche Bitget-Abrechnung');
    by.set(at, { instrument: symbol, at, rate, kind: 'settled', observedAt, intervalHours: null, announcedRate: null });
  }
  return [...by.values()].sort((a, b) => b.at - a.at);
}

function sourceContext(selection, config) {
  const p = settings(config), keys = ['instrument', 'timeframe', 'contextTimeframe', 'horizon', 'maxHoldMs', 'slippageBps', 'indicatorAnchors'];
  if (!selection || Object.keys(selection).some(k => !keys.includes(k))) throw new Error('Unbekannter Bitget-Signalkontext');
  const s = clone(selection);
  if (![s.timeframe, s.contextTimeframe].every(x => ['1h', '4h', '1d'].includes(x))) throw new Error('Konfluenz-Zeitebene nicht unterstützt');
  const base = frame(s.timeframe), context = frame(s.contextTimeframe);
  instrument(s.instrument);
  if (context.periodMs <= base.periodMs || !['short', 'long'].includes(s.horizon) || !Number.isSafeInteger(s.maxHoldMs) || s.maxHoldMs <= 0 || !Number.isFinite(s.slippageBps) || s.slippageBps < 0 || s.slippageBps >= 1e4 || !time(s.indicatorAnchors?.base) || !time(s.indicatorAnchors?.context) || s.indicatorAnchors.base % base.periodMs || s.indicatorAnchors.context % context.periodMs) throw new Error('Bitget-Signalkontext/Startanker fehlt');
  return { ...s, venue: 'bitget', product: 'USDT-FUTURES', quote: 'USDT', modelVersion: MODEL_VERSION, settingsRevision: p.revision, parametersKey: parametersKey(p), feedVersion: FEED_VERSION };
}
export function bitgetSelection(selection, config) { sourceContext(selection, config); return clone(selection); }
function identity(s) {
  return JSON.stringify(['venue', 'product', 'quote', 'instrument', 'timeframe', 'contextTimeframe', 'horizon', 'modelVersion', 'settingsRevision', 'parametersKey', 'feedVersion', 'maxHoldMs', 'slippageBps'].map(k => s?.[k]).concat([s?.indicatorAnchors?.base, s?.indicatorAnchors?.context]));
}
function seriesSource(scope, role) { return { ...clone(scope), timeframe: role === 'base' ? scope.timeframe : scope.contextTimeframe }; }
function newSaved(scope) {
  const s = { version: 1, contextKey: identity(scope), series: {} };
  for (const role of ['base', 'context']) {
    const source = seriesSource(scope, role);
    s.series[role] = { source, before: createIndicatorState({ time: scope.indicatorAnchors[role], periodMs: frame(source.timeframe).periodMs }), rows: [] };
  }
  return s;
}
function validateSaved(saved, scope, asOf) {
  if (saved.version !== 1 || saved.contextKey !== identity(scope)) throw new Error('Gespeicherter Bitget-Zustand gehört zu anderem Markt/Modell/Parametern');
  for (const role of ['base', 'context']) {
    const s = saved.series?.[role], expected = seriesSource(scope, role), periodMs = frame(expected.timeframe).periodMs;
    if (!s || identity(s.source) !== identity(expected) || s.before?.anchor !== scope.indicatorAnchors[role] || s.before?.periodMs !== periodMs || !Array.isArray(s.rows) || s.rows.length > TAIL || s.rows.some(c => c.knownAt > asOf || c.end > asOf) || (s.rows.length && s.rows[0].time !== s.before.nextTime)) throw new Error('Beschädigter/fremder Bitget-Indikatorzustand');
    advanceIndicators(s.before, s.rows, asOf); // gemeinsame Zustands-/OHLCV-Prüfung, keine zweite Indikatorrechnung
  }
}

export function createBitgetPublicClient({ fetch: fetcher = globalThis.fetch, now = Date.now, wait = ms => new Promise(r => setTimeout(r, ms)), timeoutMs = 8000, spacingMs = 150 } = {}) {
  if (typeof fetcher !== 'function' || typeof now !== 'function' || typeof wait !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000 || !Number.isFinite(spacingMs) || spacingMs < 0) throw new Error('Bitget-Transportkonfiguration ungültig');
  let queue = Promise.resolve(), nextRequestAt = 0, cooldown = 0;
  function request(path, params, signal) {
    const task = queue.then(async () => {
      signal?.throwIfAborted();
      if (now() < cooldown) throw Object.assign(new Error('Bitget-Abfrage gedrosselt; später erneut laden'), { retryAt: cooldown });
      const pause = Math.max(0, nextRequestAt - now()); if (pause) await wait(pause);
      signal?.throwIfAborted(); nextRequestAt = now() + spacingMs;
      const url = new URL(path, BITGET_ORIGIN); url.search = new URLSearchParams(params).toString();
      const controller = new AbortController(), abort = () => controller.abort(signal.reason);
      signal?.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(() => controller.abort(new Error('Bitget-Abfrage dauert zu lange')), timeoutMs);
      try {
        const res = await fetcher(url.href, { method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' }, signal: controller.signal });
        const observedAt = now();
        if (res.status === 429) {
          const value = res.headers?.get('retry-after'), parsed = value && /^\d+$/.test(value) ? Number(value) : null;
          const seconds = parsed !== null && Number.isSafeInteger(observedAt + parsed * 1000) ? parsed : null;
          cooldown = Math.max(observedAt + 1000, seconds !== null ? observedAt + seconds * 1000 : Date.parse(value) || observedAt + 30000);
          throw Object.assign(new Error('Bitget-Abfrage gedrosselt; später erneut laden'), { retryAt: cooldown });
        }
        if (!res.ok || res.redirected || (res.url && new URL(res.url).origin !== BITGET_ORIGIN)) throw new Error('Bitget-HTTP-Antwort nicht verfügbar');
        const text = await readBody(res);
        const body = JSON.parse(text), receivedAt = now();
        if (body?.code !== '00000' || !time(body.requestTime) || body.requestTime > receivedAt || receivedAt - body.requestTime > 30000) throw new Error('Bitget-Antwortcode oder Providerzeit ungültig/veraltet');
        return { data: body.data, providerAt: body.requestTime, observedAt: receivedAt };
      } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
    });
    queue = task.catch(() => {}); return task;
  }

  async function candlesRange({ symbol, timeframe, from, to, maxPages = MAX_PAGES, signal }, mark = false) {
    instrument(symbol); const { periodMs, granularity } = frame(timeframe);
    if (![from, to].every(time) || from > to || from % periodMs || to % periodMs || to > now() || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > MAX_PAGES) throw new Error('Bitget-Historienjob ungültig');
    const rows = [], pageSize = Math.min(200, Math.floor(90 * 86400e3 / periodMs)); let cursor = from, pages = 0;
    while (cursor < to && pages < maxPages) {
      const end = Math.min(to, cursor + pageSize * periodMs), limit = (end - cursor) / periodMs;
      // Bitget rundet endTime ab und liefert davor: exklusive UTC-Schlussgrenze ohne 1-ms-Abzug.
      const r = await request(mark ? '/api/v2/mix/market/history-mark-candles' : '/api/v2/mix/market/history-candles', { symbol, productType: 'USDT-FUTURES', granularity, endTime: end, limit }, signal);
      const page = normalizeBitgetCandles(r.data, { timeframe, from: cursor, to: end, knownAt: r.observedAt }); pages++;
      if (page.length !== limit || page[0]?.time !== cursor || page.at(-1)?.end !== end) throw new Error('Bitget-Historie hat eine Datenlücke oder zu wenig Warm-up');
      rows.push(...page); cursor = end;
    }
    return { rows, complete: cursor === to, nextFrom: cursor, coverage: { from, to, loadedTo: cursor, candles: rows.length, pages }, feedVersion: FEED_VERSION };
  }

  const range = request => candlesRange(request);
  const markRange = request => candlesRange(request, true);
  async function fundingPage({ symbol, pageNo = 1, pageSize = 100, signal }) {
    if (!Number.isInteger(pageNo) || pageNo < 1 || pageNo > 10000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Bitget-Fundingseite ungültig');
    const r = await request('/api/v2/mix/market/history-fund-rate', { symbol: instrument(symbol), productType: 'USDT-FUTURES', pageNo, pageSize }, signal);
    return { events: normalizeBitgetSettlements(r.data, { symbol, observedAt: r.observedAt }), observedAt: r.observedAt, rawCount: r.data.length };
  }

  async function load({ selection, config = {}, saved = null, signal } = {}) {
    try {
      const scope = sourceContext(selection, config), startedAt = now();
      const next = saved ? clone(saved) : newSaved(scope); validateSaved(next, scope, startedAt);
      const r = await request('/api/v2/mix/market/contracts', { symbol: scope.instrument, productType: 'USDT-FUTURES' }, signal);
      const contract = { ...normalizeBitgetContract(r.data, scope.instrument), providerAt: r.providerAt, knownAt: r.observedAt };
      const progress = {};
      for (const role of ['base', 'context']) {
        const s = next.series[role], periodMs = frame(s.source.timeframe).periodMs, to = Math.floor(startedAt / periodMs) * periodMs;
        const from = s.rows.length ? s.rows.at(-1).time : s.before.nextTime; // letzte gespeicherte geschlossene Kerze erneut abgleichen
        const batch = await range({ symbol: scope.instrument, timeframe: s.source.timeframe, from, to, signal }); progress[role] = batch.coverage;
        if (s.rows.length && batch.rows.length) {
          if (!sameBar(s.rows.at(-1), batch.rows[0])) throw new Error('Bitget-Kerze widerspricht dem gespeicherten Stand');
          batch.rows.shift(); // früheste tatsächliche Kenntniszeit des gespeicherten Originals erhalten
        }
        s.rows.push(...batch.rows);
        if (s.rows.length > TAIL) {
          const removed = s.rows.splice(0, s.rows.length - TAIL);
          s.before = advanceIndicators(s.before, removed, now()).state;
        }
        if (!batch.complete) return { status: 'nachladen', reason: 'Begrenzter Bitget-Job abgeschlossen; mit gespeichertem Zustand fortsetzen', saved: next, progress };
      }
      let funding = null, fundingReason = null;
      try {
        const f = await request('/api/v2/mix/market/current-fund-rate', { symbol: scope.instrument, productType: 'USDT-FUTURES' }, signal);
        funding = normalizeBitgetFunding(f.data, { symbol: scope.instrument, source: seriesSource(scope, 'base'), providerAt: f.providerAt, observedAt: f.observedAt });
      } catch (e) { signal?.throwIfAborted(); fundingReason = errorMessage(e); }
      const asOf = now(), frames = {};
      for (const role of ['base', 'context']) {
        const s = next.series[role]; frames[role] = frameSnapshot({ source: s.source, state: s.before, candles: s.rows, asOf }).frame;
        if (!frames[role] || frames[role].ema200 === null || frames[role].closedAt !== Math.floor(asOf / frame(s.source.timeframe).periodMs) * frame(s.source.timeframe).periodMs) throw new Error('Jüngste geschlossene Bitget-Trendkerze/EMA200 fehlt; erneut laden');
      }
      return { status: funding ? 'bereit' : 'nicht bewertbar', reason: fundingReason, data: { scope: { ...scope, asOf }, ...frames, funding, contract, patterns: null }, saved: next, progress };
    } catch (e) {
      return { status: signal?.aborted ? 'abgebrochen' : 'nicht bewertbar', reason: errorMessage(e), retryAt: e.retryAt ?? null, data: null, saved: null };
    }
  }
  async function quote({ symbol, decisionAt, signal }) {
    if (!time(decisionAt) || decisionAt > now()) throw new Error('Bitget-Entscheidungszeit ungültig');
    const r = await request('/api/v2/mix/market/ticker', { symbol: instrument(symbol), productType: 'USDT-FUTURES' }, signal);
    return normalizeBitgetQuote(r.data, { symbol, decisionAt, providerAt: r.providerAt, observedAt: r.observedAt });
  }
  async function contract({ symbol, signal }) {
    const r = await request('/api/v2/mix/market/contracts', { symbol: instrument(symbol), productType: 'USDT-FUTURES' }, signal);
    return { ...normalizeBitgetContract(r.data, symbol), providerAt: r.providerAt, knownAt: r.observedAt };
  }
  async function currentFunding({ symbol, source, signal }) {
    const r = await request('/api/v2/mix/market/current-fund-rate', { symbol: instrument(symbol), productType: 'USDT-FUTURES' }, signal);
    return normalizeBitgetFunding(r.data, { symbol, source, providerAt: r.providerAt, observedAt: r.observedAt });
  }
  return Object.freeze({ range, load, quote, markRange, fundingPage, contract, currentFunding });
}
