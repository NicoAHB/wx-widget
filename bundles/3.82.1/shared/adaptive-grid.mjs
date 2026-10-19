// 3.57.0: Adaptive AI-Grid: gemeinsamer regelbasierter Modellkern, keine privaten Orders/Schlüssel.
import { closedCandles, createIndicatorState, advanceIndicators } from './indicators.mjs';
import { decimal, decimalText } from './bot-limits.mjs';
export const GRID_MODEL_VERSION = 'adaptive-grid-1';
export const GRID_POLICY = Object.freeze({ historyDays: 14, periodMs: 900000, bollingerPeriod: 20, sigma: 2, atrFloor: 1.5, stopAtr: .5, trailingAtr: 1.5, efficiencyMax: .35, volumeSpike: 2.5, trendRsi: 70, quoteMaxAge: 30000, maximumLines: 30 });
export const GRID_DEFAULTS = Object.freeze({ lines: 8, makerFeePct: .1, takerFeePct: .1, minimumNetPct: .1, slippageReservePct: .05, fundingReservePct: .05, dumpAction: 'pause' });
const clone = x => JSON.parse(JSON.stringify(x)), finite = Number.isFinite, positive = x => finite(x) && x > 0, time = x => Number.isSafeInteger(x) && x >= 0;
function plain(x) { if (!finite(x)) throw new Error('Grid-Zahlenwert fehlt'); const [m, e = '0'] = String(x).toLowerCase().split('e'); if (!Number(e)) return m; const sign = m.startsWith('-') ? '-' : '', [whole, tail = ''] = m.replace('-', '').split('.'), digits = whole + tail, point = whole.length + Number(e); return sign + (point <= 0 ? '0.' + '0'.repeat(-point) + digits : point >= digits.length ? digits + '0'.repeat(point - digits.length) : digits.slice(0, point) + '.' + digits.slice(point)); }
const rat = x => decimal(typeof x === 'number' ? plain(x) : x), add = (a, b) => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d }), neg = a => ({ n: -a.n, d: a.d }), sub = (a, b) => add(a, neg(b)), mul = (a, b) => ({ n: a.n * b.n, d: a.d * b.d }), div = (a, b) => { if (b.n === 0n) throw new Error('Grid-Division durch 0'); return { n: a.n * b.d, d: a.d * b.n }; }, cmp = (a, b) => { const n = a.n * b.d - b.n * a.d; return n < 0n ? -1 : n > 0n ? 1 : 0; };
const zero = () => rat('0'), one = () => rat('1'), percent = x => div(rat(x), rat('100')), text = x => decimalText(x);
function quantize(value, step, up = false) { const units = div(typeof value === 'object' ? value : rat(value), rat(step)); if (units.n < 0n || units.d <= 0n) throw new Error('Positives Grid-Raster fehlt'); const count = units.n / units.d + (up && units.n % units.d ? 1n : 0n); return text(mul({ n: count, d: 1n }, rat(step))); }
const minimum = (...values) => values.reduce((a, b) => cmp(a, b) < 0 ? a : b), maximum = (...values) => values.reduce((a, b) => cmp(a, b) > 0 ? a : b);
export function gridSettings(input) {
  const s = { ...GRID_DEFAULTS, ...input }, allowed = ['capitalUSDT', ...Object.keys(GRID_DEFAULTS)];
  if (!input || Object.keys(input).some(k => !allowed.includes(k)) || cmp(rat(s.capitalUSDT), zero()) <= 0 || !Number.isInteger(s.lines) || s.lines < 3 || s.lines > GRID_POLICY.maximumLines || !['pause', 'close'].includes(s.dumpAction)) throw new Error('Grid-Kapital, Linien und Ausbruchaktion prüfen');
  if (!['makerFeePct', 'takerFeePct', 'minimumNetPct', 'slippageReservePct', 'fundingReservePct'].every(k => finite(s[k]) && s[k] >= 0 && s[k] <= 5) || s.minimumNetPct <= 0 || s.takerFeePct < s.makerFeePct) throw new Error('Grid-Gebühren und positive Nettospanne prüfen; Taker mindestens Maker');
  return clone(s);
}
function scopeValid(scope) { return scope?.venue === 'bitget' && scope.product === 'USDT-FUTURES' && /^[A-Z0-9]{2,20}USDT$/.test(scope.instrument || '') && scope.quote === 'USDT'; }
function median(xs) { const a = [...xs].sort((a, b) => a - b), i = a.length >> 1; return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2; }
function rangeValid(r) { return r && r.modelVersion === GRID_MODEL_VERSION && [r.lower, r.upper, r.center, r.atr].every(positive) && r.lower < r.upper && r.lower < r.center && r.center < r.upper && time(r.closedAt) && time(r.measuredAt) && r.measuredAt >= r.closedAt && r.bars === 1344 && r.historyFrom === r.closedAt - 14 * 86400000 && typeof r.sideways === 'boolean' && r.sideways === (r.efficiency <= GRID_POLICY.efficiencyMax) && finite(r.efficiency) && r.efficiency >= 0 && r.efficiency <= 1 && finite(r.rsi) && r.rsi >= 0 && r.rsi <= 100 && (r.volumeRatio === null || finite(r.volumeRatio) && r.volumeRatio >= 0); }
export class AdaptiveAIGridStrategy {
  constructor({ scope, config, saved = null }) {
    if (!scopeValid(scope) || !/^[A-Za-z0-9_-]{8,64}$/.test(scope.runId || '')) throw new Error('Grid braucht eigenen Bitget-USDT-Futures-Long-Modelllauf');
    this.scope = clone(scope); this.config = gridSettings(config); this.parametersKey = JSON.stringify(this.config);
    this.state = saved ? clone(saved) : { modelVersion: GRID_MODEL_VERSION, instrument: scope.instrument, runId: scope.runId, parametersKey: this.parametersKey, mode: 'WAITING', range: null, stop: null, peak: null, lastQuoteAt: null, reason: 'Öffentliche 15m-Daten prüfen.' };
    const s = this.state;
    if (s.modelVersion !== GRID_MODEL_VERSION || s.instrument !== scope.instrument || s.runId !== scope.runId || s.parametersKey !== this.parametersKey || !['WAITING', 'GRID', 'PAUSED_BREAKOUT', 'TREND', 'STOPPED'].includes(s.mode) || s.range !== null && !rangeValid(s.range) || s.stop !== null && !positive(s.stop) || s.peak !== null && !positive(s.peak) || s.lastQuoteAt !== null && !time(s.lastQuoteAt)) throw new Error('Unbekannter/beschädigter Grid-Stand; Original erhalten');
  }
  snapshot() { return clone(this.state); }
  calculate_dynamic_range({ scope, candles, asOf }) {
    if (!scopeValid(scope) || scope.instrument !== this.scope.instrument || !time(asOf) || !Array.isArray(candles) || candles.length > 1400) throw new Error('Passende vollständige öffentliche Grid-Historie fehlt');
    const rows = closedCandles(candles, asOf, GRID_POLICY.periodMs), to = Math.floor(asOf / GRID_POLICY.periodMs) * GRID_POLICY.periodMs, count = GRID_POLICY.historyDays * 86400000 / GRID_POLICY.periodMs;
    if (rows.length !== count || rows[0].time !== to - count * GRID_POLICY.periodMs || rows.at(-1).end !== to) throw new Error('Grid benötigt vollständige 14 Tage geschlossene 15m-Kerzen');
    const tail = rows.slice(-GRID_POLICY.bollingerPeriod), prices = tail.map(c => c.close), center = prices.reduce((a, b) => a + b, 0) / prices.length, deviation = Math.sqrt(prices.reduce((s, c) => s + (c - center) ** 2, 0) / prices.length);
    const indicator = advanceIndicators(createIndicatorState({ time: rows[0].time, periodMs: GRID_POLICY.periodMs }), rows, asOf).values.at(-1);
    const atr = indicator.atr, half = Math.max(GRID_POLICY.sigma * deviation, GRID_POLICY.atrFloor * atr), movement = prices.slice(1).reduce((s, c, i) => s + Math.abs(c - prices[i]), 0), efficiency = movement > 0 ? Math.abs(prices.at(-1) - prices[0]) / movement : 0;
    const volumeBase = median(rows.slice(-21, -1).map(c => c.volume)), volumeRatio = volumeBase > 0 ? rows.at(-1).volume / volumeBase : null;
    const range = { modelVersion: GRID_MODEL_VERSION, lower: center - half, upper: center + half, center, deviation, bollingerLower: center - GRID_POLICY.sigma * deviation, bollingerUpper: center + GRID_POLICY.sigma * deviation, atr, rsi: indicator.rsi, efficiency, volumeRatio, volumeBase, runningVolumeBase: median(rows.slice(-20).map(c => c.volume)), closedAt: to, historyFrom: rows[0].time, bars: rows.length, measuredAt: asOf, sideways: efficiency <= GRID_POLICY.efficiencyMax };
    if (!rangeValid(range)) throw new Error('Grid-Range nicht bewertbar; ATR/positive Kursgrenzen fehlen'); return range;
  }
  quote(quote, asOf) {
    if (!scopeValid(quote) || quote.instrument !== this.scope.instrument || ![quote.bid, quote.ask].every(positive) || quote.bid > quote.ask || ![quote.at, quote.knownAt, asOf].every(time) || quote.at > quote.knownAt || quote.knownAt > asOf || asOf - quote.at > GRID_POLICY.quoteMaxAge || this.state.lastQuoteAt !== null && quote.at < this.state.lastQuoteAt) throw new Error('Frischer passender Grid-Geld/Briefkurs fehlt');
    return (quote.bid + quote.ask) / 2;
  }
  inventory(inventory) {
    if (inventory?.confirmed !== true || inventory.instrument !== this.scope.instrument || inventory.product !== 'USDT-FUTURES' || inventory.leg !== 'long' || inventory.owner !== this.scope.runId) throw new Error('Belegter eigener Long-Modellbestand fehlt');
    const quantity = rat(inventory.quantity), reserved = rat(inventory.reservedSellQuantity ?? '0'), buyReserved = rat(inventory.reservedBuyNotional ?? '0'), buyRisk = rat(inventory.reservedBuyRiskUSDT ?? '0');
    if (!Number.isInteger(inventory.openOrders) || inventory.openOrders < 0 || cmp(quantity, zero()) < 0 || cmp(reserved, zero()) < 0 || cmp(reserved, quantity) > 0 || cmp(buyReserved, zero()) < 0 || cmp(buyRisk, zero()) < 0 || cmp(quantity, zero()) > 0 && cmp(rat(inventory.averageEntry), zero()) <= 0) throw new Error('Grid-Bestand/Reservierung ungültig');
    return { quantity, reserved, buyReserved, buyRisk, averageEntry: cmp(quantity, zero()) > 0 ? rat(inventory.averageEntry) : zero() };
  }
  monitor_market_and_breakout({ candidate, quote, asOf, inventory, guard, liveVolume = null }) {
    if (!rangeValid(candidate) || candidate.closedAt !== Math.floor(asOf / GRID_POLICY.periodMs) * GRID_POLICY.periodMs || candidate.measuredAt > asOf) throw new Error('Jüngste Grid-Kerzenbewertung fehlt');
    const price = this.quote(quote, asOf), own = this.inventory(inventory), s = this.state, r = s.range ?? candidate;
    let volumeRatio = candidate.volumeRatio, volumeBasis = 'letzte geschlossene 15m-Kerze';
    if (liveVolume !== null) { if (!scopeValid(liveVolume) || liveVolume.instrument !== this.scope.instrument || liveVolume.kind !== 'running-15m' || ![liveVolume.at, liveVolume.knownAt, liveVolume.time].every(time) || liveVolume.at < liveVolume.time || liveVolume.at >= liveVolume.time + GRID_POLICY.periodMs || liveVolume.end !== liveVolume.time + GRID_POLICY.periodMs || liveVolume.at > liveVolume.knownAt || liveVolume.knownAt > asOf || asOf - liveVolume.at > GRID_POLICY.quoteMaxAge || liveVolume.time !== Math.floor(asOf / GRID_POLICY.periodMs) * GRID_POLICY.periodMs || !finite(liveVolume.volume) || liveVolume.volume < 0 || !finite(candidate.runningVolumeBase) || candidate.runningVolumeBase < 0) throw new Error('Passendes aktuelles Grid-Volumen fehlt');
      const fraction = Math.max(1 / 15, Math.min(1, (liveVolume.at - liveVolume.time) / GRID_POLICY.periodMs)); volumeRatio = candidate.runningVolumeBase > 0 ? liveVolume.volume / (candidate.runningVolumeBase * fraction) : null; volumeBasis = 'laufende 15m-Kerze, zeitanteilig mit mindestens 1-Minuten-Basis'; }
    s.lastQuoteAt = quote.at;
    const closeIntent = source => guard?.closes && cmp(own.quantity, zero()) > 0 && cmp(own.reserved, zero()) === 0 ? { intentId: 'grid-close|' + this.scope.runId + '|' + source, side: 'sell', reduceOnly: true, quantity: text(own.quantity), kind: 'market-model', status: 'planned', source, requiresFreshInventory: true } : null;
    const outcome = (action, reason, extra = {}) => ({ mode: s.mode, action, reason, keepExistingProtection: true, privateOrders: false, volumeRatio, volumeBasis, ...extra });
    if (!guard || guard.conflict || guard.paused) return outcome('pause', guard?.conflict ? 'Bestandsprüfung hat Vorrang; keine neuen Grid-Orders oder Schließungen.' : 'Bot pausiert; bestehender Schutz bleibt.');
    if (guard.limitClose) return outcome('close', 'Gewinn-/Verlustgrenze hat Vorrang.', { closeIntent: closeIntent('Laufgrenze'), cancelOwnedTakeProfit: cmp(own.reserved, zero()) > 0 });
    if (!s.range) s.range = clone(candidate);
    if (s.mode === 'STOPPED') return outcome(cmp(own.quantity, zero()) > 0 ? 'close' : 'pause', s.reason, { cancelOwnedEntries: true, cancelOwnedTakeProfit: cmp(own.reserved, zero()) > 0, closeIntent: closeIntent('Grid-Stopp') });
    if (s.stop !== null && quote.bid <= s.stop && cmp(own.quantity, zero()) > 0) { s.mode = 'STOPPED'; s.reason = 'Grid-Schutzstopp erreicht. Neuer Lauf erst nach bewusstem Abgleich.'; return outcome('close', s.reason, { cancelOwnedEntries: true, closeIntent: closeIntent('Grid-Stopp'), cancelOwnedTakeProfit: cmp(own.reserved, zero()) > 0 }); }
    if (s.mode === 'PAUSED_BREAKOUT') {
      if (price < r.lower && volumeRatio !== null && volumeRatio >= GRID_POLICY.volumeSpike && this.config.dumpAction === 'close' && cmp(own.quantity, zero()) > 0) { s.mode = 'STOPPED'; s.reason = 'Dump nachträglich bestätigt: belegten Long-Bestand reduzierend schließen.'; return outcome('close', s.reason, { cancelOwnedEntries: true, closeIntent: closeIntent('Grid-Stopp'), cancelOwnedTakeProfit: cmp(own.reserved, zero()) > 0 }); }
      return outcome('pause', s.reason, { cancelOwnedEntries: true });
    }
    if (price < r.lower) { s.mode = 'PAUSED_BREAKOUT'; const spike = volumeRatio !== null && volumeRatio >= GRID_POLICY.volumeSpike;
      s.reason = spike ? 'Abwärtsausbruch mit Volumenspike: Nachkäufe stoppen, Grid pausieren.' : 'Unter Unterstützung: Nachkäufe pausieren; Volumenspike noch nicht bestätigt.';
      const close = spike && this.config.dumpAction === 'close' && cmp(own.quantity, zero()) > 0; if (close) { s.mode = 'STOPPED'; s.reason = 'Dump-Schließung vorgemerkt: Nachkäufe stoppen und belegten Long-Bestand reduzierend schließen.'; }
      return outcome(close ? 'close' : 'pause', s.reason, { cancelOwnedEntries: true, volumeSpike: spike, closeIntent: close ? closeIntent('Grid-Stopp') : null, cancelOwnedTakeProfit: close && cmp(own.reserved, zero()) > 0 }); }
    if (s.mode === 'TREND' || price > r.upper && candidate.rsi > GRID_POLICY.trendRsi && volumeRatio !== null && volumeRatio >= GRID_POLICY.volumeSpike) {
      s.mode = 'TREND'; s.peak = Math.max(s.peak || price, price); s.stop = Math.max(s.stop || 0, s.peak - GRID_POLICY.trailingAtr * candidate.atr); s.reason = 'Aufwärtstrend: keine Nachkäufe, Grid-Verkäufe pausieren, Long-Gewinne mit nachgezogenem Stopp begleiten.';
      return outcome('trend', s.reason, { cancelOwnedEntries: true, cancelOwnedTakeProfit: true, trailingStop: s.stop }); }
    if (price > r.upper) return outcome('pause', 'Oberhalb Range: kein bestätigter Volumentrend; neue Grid-Einstiege pausieren.', { cancelOwnedEntries: true });
    if (!candidate.sideways) return outcome('pause', 'Gerichteter Markt statt normalem Rauschen; neues Grid abwarten.', { cancelOwnedEntries: true });
    if (!guard.entries) return outcome('pause', 'Neue Einstiege durch Laufgrenzen/Datenprüfung gesperrt.', { cancelOwnedEntries: true });
    s.mode = 'GRID'; s.reason = 'Seitwärtsbereich: Gebühren, Raster, Kapital und Stoprisiko prüfen.';
    // Alte Grenze zuerst prüfen; nur ohne eigenen Bestand/liegende Orders dynamisch zentrieren.
    if (!s.range || cmp(own.quantity, zero()) === 0 && !inventory.openOrders && candidate.closedAt > s.range.closedAt) s.range = clone(candidate);
    return outcome('grid', s.reason);
  }
  place_grid_orders(options) {
    const before = this.snapshot();
    try { return this.plan(options); } catch (e) { this.state = before; throw e; }
  }
  plan({ candidate, quote, contract, inventory, guard, asOf, leverage, exposureUSDT, riskUSDT, liveVolume = null }) {
    const status = this.monitor_market_and_breakout({ candidate, quote, asOf, inventory, guard, liveVolume }), empty = { ...status, modelVersion: GRID_MODEL_VERSION, orders: [], contingent: [], range: clone(this.state.range ?? candidate), state: this.snapshot(), simulationOnly: true };
    if (status.action !== 'grid') return empty;
    if (!scopeValid(contract) || contract.instrument !== this.scope.instrument || ![contract.tickSize, contract.quantityStep].every(positive) || !finite(contract.minQuantity) || contract.minQuantity < 0 || !finite(contract.minNotional) || contract.minNotional < 0 || !Number.isInteger(leverage) || leverage < 1 || leverage > 125 || cmp(rat(exposureUSDT), zero()) <= 0 || cmp(rat(riskUSDT), zero()) <= 0) throw new Error('Grid-Kontraktraster und eigene Kapital-/Risikogrenzen prüfen');
    const cfg = this.config, r = this.state.range, own = this.inventory(inventory), fee = Math.max(cfg.makerFeePct, cfg.takerFeePct), entryFee = percent(fee), exitFee = percent(fee), buffer = percent(cfg.slippageReservePct + cfg.fundingReservePct), required = percent(cfg.minimumNetPct), totalBuffer = add(buffer, required);
    const ratio = sub(div(add(add(one(), entryFee), totalBuffer), sub(one(), exitFee)), one()), desired = (r.upper - r.lower) / (cfg.lines - 1), feeSpacing = r.upper * Number(text(ratio)), step = Number(quantize(Math.max(desired, feeSpacing, contract.tickSize), contract.tickSize, true));
    const levels = []; for (let p = Number(quantize(r.lower, contract.tickSize, true)); p <= r.upper && levels.length < GRID_POLICY.maximumLines; p = Number(quantize(add(rat(p), rat(step)), contract.tickSize, true))) { if (levels.length && p <= levels.at(-1)) throw new Error('Grid-Preisraster außerhalb des Zahlenbereichs'); levels.push(p); }
    const stop = Number(quantize(Math.max(contract.tickSize, r.lower - GRID_POLICY.stopAtr * r.atr), contract.tickSize)); this.state.stop = Math.max(this.state.stop || 0, stop);
    const buys = levels.filter(p => p < quote.bid && p > this.state.stop), sells = levels.filter(p => p > quote.ask);
    const netUnit = (buy, sell) => sub(sub(mul(rat(sell), sub(one(), exitFee)), mul(rat(buy), add(one(), entryFee))), mul(rat(buy), buffer));
    const goodPair = (buy, sell) => cmp(netUnit(buy, sell), mul(rat(buy), required)) >= 0 && cmp(netUnit(buy, sell), zero()) > 0;
    const pairs = buys.map(buy => { const target = Number(quantize(Math.max(buy + step, quote.ask + contract.tickSize), contract.tickSize, true)); return { buy, target }; }).filter(p => p.target <= r.upper && goodPair(p.buy, p.target));
    const cap = minimum(mul(rat(cfg.capitalUSDT), rat(leverage)), rat(exposureUSDT)), used = add(mul(own.quantity, maximum(own.averageEntry, rat(quote.ask))), own.buyReserved), available = sub(cap, used);
    const perCapital = pairs.length ? div(available, rat(pairs.length)) : zero(), usedRisk = add(own.buyRisk, mul(own.quantity, maximum(zero(), add(sub(own.averageEntry, rat(this.state.stop)), add(mul(own.averageEntry, add(entryFee, buffer)), mul(rat(this.state.stop), exitFee)))))), remainingRisk = sub(rat(riskUSDT), usedRisk), perRisk = pairs.length && cmp(remainingRisk, zero()) > 0 ? div(remainingRisk, rat(pairs.length)) : zero(); let orders = [], contingent = [];
    const id = (side, price) => ['grid', this.scope.runId, this.scope.instrument, r.closedAt, side, plain(price)].join('|');
    for (const pair of pairs) { if (cmp(available, zero()) <= 0 || cmp(remainingRisk, zero()) <= 0) break;
      const lossUnit = add(sub(rat(pair.buy), rat(this.state.stop)), add(mul(rat(pair.buy), add(entryFee, buffer)), mul(rat(this.state.stop), exitFee)));
      const raw = minimum(div(perCapital, mul(rat(pair.buy), add(one(), entryFee))), div(perRisk, lossUnit)), quantity = quantize(raw, contract.quantityStep);
      if (cmp(rat(quantity), zero()) <= 0 || cmp(rat(quantity), rat(contract.minQuantity)) < 0 || cmp(mul(rat(quantity), rat(pair.buy)), rat(contract.minNotional)) < 0 || cmp(mul(rat(quantity), lossUnit), perRisk) > 0 || cmp(mul(mul(rat(quantity), rat(pair.buy)), add(one(), entryFee)), perCapital) > 0) continue;
      const intentId = id('buy', pair.buy); orders.push({ intentId, side: 'buy', type: 'limit', price: plain(pair.buy), quantity, reduceOnly: false, status: 'planned', riskUSDT: text(mul(rat(quantity), lossUnit)), notionalUSDT: text(mul(rat(quantity), rat(pair.buy))) });
      contingent.push({ intentId: id('tp-' + intentId, pair.target), afterFillOf: intentId, side: 'sell', type: 'limit', price: plain(pair.target), maximumQuantity: quantity, reduceOnly: true, status: 'conditional-after-confirmed-fill', netUnitUSDT: text(netUnit(pair.buy, pair.target)) });
    }
    const usable = sub(own.quantity, own.reserved), profitableSells = sells.filter(p => goodPair(text(own.averageEntry), p));
    if (cmp(usable, zero()) > 0 && guard.closes && profitableSells.length) { const quantity = quantize(div(usable, rat(profitableSells.length)), contract.quantityStep);
      for (const price of profitableSells) if (cmp(rat(quantity), zero()) > 0 && cmp(rat(quantity), rat(contract.minQuantity)) >= 0 && cmp(mul(rat(quantity), rat(price)), rat(contract.minNotional)) >= 0) orders.push({ intentId: id('sell', price), side: 'sell', type: 'limit', price: plain(price), quantity, reduceOnly: true, status: 'planned' }); }
    const sum = (xs, key) => xs.reduce((sum, x) => add(sum, rat(x[key])), zero()), buyOrders = orders.filter(o => o.side === 'buy'), sellOrders = orders.filter(o => o.side === 'sell');
    if (cmp(sum(sellOrders, 'quantity'), usable) > 0 || cmp(sum(buyOrders, 'riskUSDT'), maximum(zero(), remainingRisk)) > 0 || cmp(sum(buyOrders, 'notionalUSDT'), maximum(zero(), available)) > 0) throw new Error('Grid-Summen überschreiten belegte Grenze');
    const capitalExceeded = cmp(available, zero()) < 0, riskExceeded = cmp(remainingRisk, zero()) < 0;
    const reason = capitalExceeded || riskExceeded ? 'Vorhandener Bestand über Kapital-/Risikobudget: keine Nachkäufe; nur belegte reduzierende Verkaufspläne.' : orders.length ? 'Limit-Pläne geprüft. Verkäufe nur reduzierend; bedingte Ziele erst nach bestätigtem Kauf-Fill.' : 'Kein passendes Grid: Range, Gebühren, Raster oder Budget reichen nicht. Kapital nicht erhöhen.';
    return { ...empty, action: orders.length ? 'grid' : 'pause', reason, orders, contingent, step, requestedLines: cfg.lines, effectiveLines: levels.length, stop: this.state.stop, existingRiskUSDT: text(usedRisk), notionalUSDT: text(sum(buyOrders, 'notionalUSDT')), riskUSDT: text(sum(buyOrders, 'riskUSDT')), fees: { entryPct: fee, exitPct: fee, reservedPct: cfg.slippageReservePct + cfg.fundingReservePct, minimumNetPct: cfg.minimumNetPct, kind: 'explicit-scenario' }, capitalExceeded, riskExceeded, state: this.snapshot() };
  }
}
