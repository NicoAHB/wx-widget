import { ema, macd, createIndicatorState, advanceIndicators, confirmedPivots, fib618, divergenceInDirection } from './indicators.mjs';
import { po3Fvg, fvgState } from './po3-core.mjs';

// 3.54.0: zusätzliches PDF-Regelmodell; Konfluenz/PO3 und ihre Originalarchive bleiben unverändert.
export const SIGNAL_DEFAULTS = Object.freeze({ btc1Normal: .08, btc1Strong: .3, btc5Normal: .15, btc5Strong: .5, accelerationNormal: .3, accelerationStrong: .5,
  btc1StableMs: 5000, btc5StableMs: 10000, signalStableMs: 10000, btcWeight: 1, entryScore: 3, exitScore: -3, secureScore: -1,
  flowBuy: .55, flowSell: .45, flowVolume: 1.2, thinVolume: .7, absorptionShare: .6, rsiBuy: 55, rsiSell: 45, levelNearAtr: .3, levelRoomAtr: 1.5,
  feePct: .06, spreadPct: .02, atrCostFactor: 3, liquidationAtr: 1, stopLiquidationRatio: .5, eventBeforeMin: 15, eventAfterMin: 5,
  fundingExtremePct: .1, longShortExtreme: 3, stopAtr: 1, swingBufferAtr: .1, maxSwingAtr: 1.5, targetAtr: 2, targetSearchAtr: 3, breakEvenAtr: 1, trailingAtr: 1, runTarget: false });
export function signalSettings(raw = {}) {
  const cfg = { ...SIGNAL_DEFAULTS };
  for (const k of Object.keys(cfg)) { const v = raw[k]; if (typeof cfg[k] === 'boolean') { if (typeof v === 'boolean') cfg[k] = v; } else if (Number.isFinite(v) && v >= 0) cfg[k] = v; }
  cfg.btcWeight = Math.min(1, cfg.btcWeight); cfg.entryScore = Math.min(7, Math.max(1, cfg.entryScore)); cfg.exitScore = Number.isFinite(raw.exitScore) && raw.exitScore <= -1 ? Math.max(-7, raw.exitScore) : -3;
  cfg.secureScore = Number.isFinite(raw.secureScore) && raw.secureScore <= -1 ? Math.max(cfg.exitScore + 1, raw.secureScore) : -1;
  cfg.btc1Normal = Math.min(cfg.btc1Normal, cfg.btc1Strong); cfg.btc5Normal = Math.min(cfg.btc5Normal, cfg.btc5Strong);
  cfg.flowBuy = Math.max(.5, Math.min(1, cfg.flowBuy)); cfg.flowSell = Math.min(.5, cfg.flowSell); cfg.absorptionShare = Math.max(.5, Math.min(1, cfg.absorptionShare));
  cfg.signalStableMs = Math.max(5000, Math.min(15000, cfg.signalStableMs)); cfg.btc1StableMs = Math.min(60000, cfg.btc1StableMs); cfg.btc5StableMs = Math.min(60000, cfg.btc5StableMs);
  cfg.rsiBuy = Math.max(50, Math.min(100, cfg.rsiBuy)); cfg.rsiSell = Math.min(50, cfg.rsiSell); cfg.stopLiquidationRatio = Math.min(1, cfg.stopLiquidationRatio); cfg.longShortExtreme = Math.max(1, cfg.longShortExtreme);
  cfg.accelerationNormal = Math.min(cfg.accelerationNormal, cfg.accelerationStrong); return cfg;
}
export function validateSignalSettings(raw) {
  const cfg = signalSettings(raw);
  for (const [key, value] of Object.entries(raw)) if (key in cfg && cfg[key] !== value) throw new Error('Startwerte außerhalb des zulässigen Bereichs: ' + key + '.');
  if (cfg.btc1Normal <= 0 || cfg.btc5Normal <= 0 || cfg.btc1Strong <= cfg.btc1Normal || cfg.btc5Strong <= cfg.btc5Normal || cfg.stopAtr <= 0 || cfg.targetAtr <= 0 || cfg.trailingAtr <= 0 || cfg.breakEvenAtr <= 0) throw new Error('Positive Abstände und starke BTC-Schwellen oberhalb der normalen Schwellen wählen.');
  return cfg;
}
export function btcStage(change, normal, strong) {
  if (!Number.isFinite(change)) return null; const mag = Math.abs(change), sign = Math.sign(change);
  return mag + 1e-10 >= strong && mag > 0 ? 2 * sign : mag + 1e-10 >= normal && mag > 0 ? sign : 0;
}
export function btcJudgment(changes, cfg = SIGNAL_DEFAULTS) {
  const one = btcStage(changes[1], cfg.btc1Normal, cfg.btc1Strong); let five = btcStage(changes[5], cfg.btc5Normal, cfg.btc5Strong);
  // Erst nach vorhandenem 5m-Rohwert beschleunigen; kein erfundener Kontext im Warm-up.
  if (five !== null && Number.isFinite(changes[1]) && Math.abs(changes[1]) + 1e-10 >= cfg.accelerationNormal) {
    const sign = Math.sign(changes[1]), minimum = Math.abs(changes[1]) + 1e-10 >= cfg.accelerationStrong ? 2 : 1;
    if (sign * five < minimum) five = minimum * sign;
  }
  const counter = five !== null && five !== 0 && Number.isFinite(changes[15]) && five * changes[15] < 0;
  if (counter && Math.abs(five) === 2) five /= 2;
  return { one, five, counter, turning: one !== null && five !== null && one * five < 0, changes: { ...changes } };
}
export function stableValue(previous, value, at, delay, key = JSON.stringify(value)) {
  if (!Number.isFinite(at)) throw new Error('Stabilisierungszeit fehlt');
  if (!previous || previous.candidateKey !== key || at < previous.since) return { candidateKey: key, candidate: value, since: at, value: previous?.value ?? null };
  return { ...previous, value: at - previous.since >= delay ? value : previous.value };
}
// Reale Live-Stichprobe, sonst tatsächlicher Minuten-Schlusskurs vor dem Referenzzeitpunkt (als solcher kenntlich).
export function btcChanges(series, samples, price, at) {
  const out = {}, basis = {};
  for (const minute of [1, 5, 15, 60]) {
    const target = at - minute * 60000, sample = [...samples].reverse().find(s => s.at <= target && target - s.at <= 5000);
    const closed = series.filter(c => c.closed), ref = closed.filter(c => c.end <= target).at(-1), following = ref ? closed.filter(c => c.time >= ref.time && c.end <= at) : [];
    const contiguous = ref && following.length >= minute && following.every((c, i) => !i || c.time === following[i - 1].end) && at - following.at(-1).end < 60000 && target - ref.end < 60000;
    const value = sample || (contiguous ? { at: ref.end, price: ref.close } : null);
    out[minute] = value && price > 0 ? (price / value.price - 1) * 100 : null;
    basis[minute] = value ? { at: value.at, precision: sample ? 'live' : 'minute-close' } : null;
  }
  return { changes: out, basis };
}
const vote = (name, value, reason, available = true) => ({ name, vote: value, reason, available });
function closed(series, at, step) {
  const end = Math.floor(at / step) * step, rows = (series || []).filter(c => c.closed && c.end <= end);
  if (!rows.length || rows.at(-1).end !== end || rows.some((c, i) => i > 0 && c.time !== rows[i - 1].end)) return [];
  return rows;
}
export function indicatorGroups({ series, price, now, oi = null, funding = null, longShort = null, extraLevels = [] }, cfg = SIGNAL_DEFAULTS) {
  const m1 = closed(series['1m'], now, 60000), m5 = closed(series['5m'], now, 300000), h1 = closed(series['1h'], now, 3600000), h4 = closed(series['4h'], now, 14400000);
  const pct = n => Number.isFinite(n) ? n.toFixed(2).replace('.', ',') + ' %' : '—', groups = [], warnings = [];
  const direction = rows => { if (rows.length < 50 || !(price > 0)) return null; const fast = ema(rows.map(c => c.close), 20).at(-1), slow = ema(rows.map(c => c.close), 50).at(-1); return price > fast && fast > slow ? 1 : price < fast && fast < slow ? -1 : 0; };
  const a = direction(h1), b = direction(h4), trend = a !== null && b !== null && a === b ? a : 0;
  groups.push(vote('Trend 1h/4h', trend, a === null || b === null ? 'EMA20/50-Historie wird geladen' : `EMA20/50 · 1h ${a > 0 ? '↑' : a < 0 ? '↓' : '→'} · 4h ${b > 0 ? '↑' : b < 0 ? '↓' : '→'}`, a !== null && b !== null));
  const flow = m1.slice(-3), reference = m1.slice(-23, -3), flowAvailable = flow.length === 3 && reference.length === 20 && [...flow, ...reference].every(c => c.usdt);
  let share = null, ratio = null;
  if (flowAvailable) {
    const total = flow.reduce((s, c) => s + c.usdt.total, 0), buy = flow.reduce((s, c) => s + c.usdt.buy, 0), average = reference.reduce((s, c) => s + c.usdt.total, 0) / 20;
    share = total > 0 ? buy / total : null; ratio = average > 0 ? total / 3 / average : null;
    const absorbed = share !== null && (share >= cfg.absorptionShare && flow.at(-1).close <= flow[0].open || share <= 1 - cfg.absorptionShare && flow.at(-1).close >= flow[0].open);
    const v = !absorbed && ratio >= cfg.flowVolume && ratio >= cfg.thinVolume && share !== null ? share >= cfg.flowBuy ? 1 : share <= cfg.flowSell ? -1 : 0 : 0;
    groups.push(vote('Orderflow 1m', v, `Kauf ${share === null ? '—' : pct(share * 100)} · Volumen ${ratio === null ? '—' : ratio.toFixed(2).replace('.', ',') + '×'}${absorbed ? ' · Absorption' : ratio < cfg.thinVolume ? ' · zu dünn' : ''}`));
    if (absorbed) warnings.push('Absorption');
  } else groups.push(vote('Orderflow 1m', 0, '23 vollständige USDT-Minutenkerzen benötigt', false));
  let atr = null, rsi = null, histogram = null, pivots = [];
  if (m5.length >= 35) {
    const data = advanceIndicators(createIndicatorState({ time: m5[0].time, periodMs: 300000 }), m5.map(c => ({ ...c, knownAt: c.end })), now).values;
    rsi = data.at(-1).rsi; atr = data.at(-1).atr; histogram = macd(m5.map(c => c.close)).histogram.at(-1);
    const ps = confirmedPivots(m5.map(c => ({ ...c, knownAt: c.end })), now, 300000), direction = rsi >= cfg.rsiBuy && histogram > 0 ? 1 : rsi <= cfg.rsiSell && histogram < 0 ? -1 : 0;
    const divergence = direction !== 0 && divergenceInDirection(ps, data.map(x => x.rsi), -direction, m5.length - 1, now) === true;
    groups.push(vote('Momentum 5m', divergence ? 0 : direction, `RSI ${rsi === null ? '—' : rsi.toFixed(1).replace('.', ',')} · MACD ${histogram === null ? '—' : histogram > 0 ? '+' : histogram < 0 ? '−' : '0'}${divergence ? ' · Gegen-Divergenz' : ''}`));
  } else groups.push(vote('Momentum 5m', 0, 'RSI/MACD-Historie wird geladen', false));
  if (m1.length >= 5) pivots = confirmedPivots(m1.map(c => ({ ...c, knownAt: c.end })), now, 60000);
  const derived = [], endPivot = pivots.at(-1), startPivot = endPivot && [...pivots].reverse().find(p => p.time < endPivot.time && p.type !== endPivot.type), fib = fib618(startPivot, endPivot, endPivot?.type === 'high' ? 1 : -1, now);
  if (fib) derived.push({ price: fib.price, kind: 'Fibonacci 61,8 % · bestätigter 1m-Swing' });
  if (atr > 0) for (let i = 2; i < m5.length; i++) { const zone = po3Fvg(m5.slice(i - 2, i + 1), { timeframe: '5m', atr, instrument: 'orderflow' }); if (zone && !fvgState(zone, m5.slice(i + 1)).filledAt) derived.push({ price: zone.low, kind: 'FVG 5m Unterkante' }, { price: zone.high, kind: 'FVG 5m Oberkante' }); }
  const levels = [...pivots.map(p => ({ price: p.price, kind: p.type === 'low' ? 'Unterstützung' : 'Widerstand' })), ...derived, ...extraLevels].filter(l => Number.isFinite(l.price) && l.price > 0);
  const support = levels.filter(l => l.price < price).sort((a, b) => b.price - a.price)[0] || null, resistance = levels.filter(l => l.price > price).sort((a, b) => a.price - b.price)[0] || null;
  const below = support && atr > 0 ? (price - support.price) / atr : null, above = resistance && atr > 0 ? (resistance.price - price) / atr : null;
  const levelVote = below !== null && above !== null ? below <= cfg.levelNearAtr && above >= cfg.levelRoomAtr ? 1 : above <= cfg.levelNearAtr && below >= cfg.levelRoomAtr ? -1 : 0 : 0;
  groups.push(vote('Level', levelVote, atr > 0 ? `Support ${below === null ? '—' : below.toFixed(1) + ' ATR'} · Widerstand ${above === null ? '—' : above.toFixed(1) + ' ATR'}` : 'ATR/Level wird geladen', atr > 0 && (support !== null || resistance !== null)));
  if (above !== null && above < 1 || below !== null && below < 1) warnings.push('Level nah');
  const oiValid = oi && Number.isFinite(oi.change) && Number.isFinite(oi.priceChange) && now - oi.at <= 600000;
  groups.push(vote('Positionierung 15m', oiValid && oi.change > 0 ? Math.sign(oi.priceChange) : 0, oiValid ? `Preis ${pct(oi.priceChange)} · OI ${pct(oi.change)}${oi.change < 0 ? ' · Abbau/Eindeckung' : ''}` : 'Öffentliche 15m-OI-Basis nicht verfügbar', !!oiValid));
  if (Number.isFinite(funding) && Math.abs(funding) * 100 >= cfg.fundingExtremePct) warnings.push('Funding extrem');
  if (Number.isFinite(longShort) && (longShort >= cfg.longShortExtreme || longShort <= 1 / cfg.longShortExtreme)) warnings.push('Long/Short-Verhältnis extrem');
  return { groups, warnings, atr, atrPct: atr > 0 && price > 0 ? atr / price * 100 : null, rsi, histogram, share3: share, volumeRatio: ratio, support, resistance, pivots, minute: m1.at(-1), momentumRows: m5, levels };
}
export function evaluateSignal({ groups, btc, price, position = null, fresh = true, atrPct = null, atr = null, event = null, lastExit = null, now, nextLevel = null }, cfg = SIGNAL_DEFAULTS) {
  const btcVote = Number.isFinite(btc?.five) ? btc.five * cfg.btcWeight : 0, score = groups.reduce((s, g) => s + g.vote, 0) + btcVote;
  const warnings = [], vetoes = [], raw = btc?.changes?.[5], rawImpulse = Number.isFinite(raw) && Math.abs(raw) > cfg.btc5Strong + 1e-10 ? Math.sign(raw) : 0;
  if (!fresh) vetoes.push('Live-Daten fehlen'); if (groups.some(g => !g.available) || !Number.isFinite(btc?.five)) warnings.push('Analyse unvollständig');
  if (Number.isFinite(event?.at) && event.at - now <= cfg.eventBeforeMin * 60000 && event.at - now >= -cfg.eventAfterMin * 60000) vetoes.push(`Wirtschaftstermin: ${event.title || 'wichtiger Termin'}`);
  if (Number.isFinite(atrPct) && atrPct < cfg.atrCostFactor * (2 * cfg.feePct + cfg.spreadPct)) vetoes.push('ATR zu klein für Kosten');
  const state = position ? 'position' : 'flat'; let signal, reason = '', positionScore = null, immediate = false;
  if (!position) {
    signal = score >= cfg.entryScore ? 'buy' : score <= -cfg.entryScore ? 'sell' : 'wait';
    const direction = signal === 'buy' ? 1 : signal === 'sell' ? -1 : 0, trend = groups[0]?.vote || 0;
    if (direction && trend * direction < 0) vetoes.push('Höherer Trend entgegen');
    if (direction && rawImpulse * direction < 0) vetoes.push('Starker BTC-Impuls entgegen');
    if (direction && lastExit && direction * lastExit.direction < 0 && now < (Math.floor(lastExit.at / 60000) + 2) * 60000) vetoes.push('Pause: eine vollständige Minutenkerze nach Ausstieg');
    if (warnings.includes('Analyse unvollständig')) vetoes.push('Analyse wird vervollständigt');
    if (vetoes.length) signal = 'wait'; reason = vetoes[0] || (signal === 'wait' ? 'Noch keine drei Richtungsstimmen' : 'Score bestätigt Richtung');
  } else {
    const d = position.side === 'short' ? -1 : 1; positionScore = score * d; signal = positionScore <= cfg.exitScore ? 'exit' : positionScore < 0 ? 'secure' : 'hold';
    if (rawImpulse * d < 0) { signal = groups.some(g => g.available && g.vote * d < 0) ? 'exit' : signal === 'exit' ? 'exit' : 'secure'; reason = 'Starker BTC-Impuls gegen Position'; }
    if (btc?.one * d < 0 && !(btc?.five * d < 0)) warnings.push('BTC dreht gegen Position');
    warnings.push(...vetoes); vetoes.length = 0;
    if (Number.isFinite(price) && price > 0) {
      if (position.stop > 0 && d * (price - position.stop) <= 0) { signal = 'exit'; reason = 'Stop erreicht'; immediate = true; }
      else if (position.liquidation > 0 && (d * (price - position.liquidation) <= 0 || atr > 0 && d * (price - position.liquidation) <= cfg.liquidationAtr * atr)) { signal = 'exit'; reason = 'Liquidation zu nah'; immediate = true; }
      else if (position.target > 0 && d * (price - position.target) >= 0 && !cfg.runTarget) { signal = 'exit'; reason = 'Ziel erreicht'; immediate = true; }
      else if (nextLevel > 0 && atr > 0 && Math.abs(nextLevel - price) <= cfg.levelNearAtr * atr && signal !== 'exit') { signal = 'secure'; reason = 'Nächstes Level nah · Teilgewinn prüfen'; immediate = true; }
    }
    if (!reason) reason = signal === 'hold' ? 'Lage stützt Position' : signal === 'secure' ? 'Stop nachziehen · Teilgewinn prüfen' : 'Mehrere Stimmen gegen Position';
  }
  const direction = position ? position.side === 'short' ? -1 : 1 : signal === 'buy' ? 1 : signal === 'sell' ? -1 : 0;
  const count = groups.filter(g => g.available && g.vote === direction).length + (Number.isFinite(btc?.five) && (direction === 0 ? btc.five === 0 : btc.five * direction > 0) ? 1 : 0);
  const confidence = state === 'flat' && vetoes.length ? 'hoch' : count >= 4 ? 'hoch' : count >= 3 ? 'mittel' : 'niedrig';
  const positionSnapshot = position ? Object.fromEntries(['id', 'symbol', 'side', 'entry', 'leverage', 'qty', 'margin', 'openedAt', 'stop', 'target', 'liquidation', 'source', 'mode', 'manual', 'practice', 'demo'].filter(k => position[k] !== undefined).map(k => [k, position[k]])) : null;
  return { score, btcVote, positionScore, state, signal, reason, immediate, confidence, warnings, vetoes, groups, btc, position: positionSnapshot };
}
export function stableSignal(previous, result, at, delay) {
  const identity = `${result.state}|${result.position?.id || ''}`, oldIdentity = previous?.identity;
  if (oldIdentity !== identity) previous = null;
  if (result.immediate || result.state === 'flat' && result.vetoes.length) return { ...stableValue(null, result, at, 0), value: result, identity };
  const previousSignal = previous?.value?.signal, reversed = previousSignal && ['buy', 'sell'].includes(previousSignal) && ['buy', 'sell'].includes(result.signal) && previousSignal !== result.signal;
  const state = stableValue(previous, result, at, delay, identity + '|' + result.signal);
  if (reversed) state.value = { ...result, signal: 'wait', reason: 'Richtungswechsel wird bestätigt', confidence: 'niedrig' };
  if (!state.value) state.value = { ...result, signal: result.state === 'position' ? 'hold' : 'wait', reason: 'Regelzustand wird bestätigt', confidence: 'niedrig' };
  return { ...state, identity };
}
// Vorschlag separat von echten Positionen: kein bestehender Stop wird zurückgeschrieben.
export function positionWarningSigns(position, model, series, now) {
  if (!position) return [];
  const d = position.side === 'short' ? -1 : 1, signs = [], hourRows = (series['1h'] || []).filter(c => c.end <= now && c.closed), hour = (series['1h'] || []).find(c => c.time <= now && c.end > now), last = hourRows.at(-1);
  if (model.groups[1]?.vote * d < 0) signs.push('Orderflow entgegen');
  if ([hour, last].some(c => c?.usdt && c.usdt.delta * d < 0 && (c.close - c.open) * d < 0)) signs.push('Stundenkerze entgegen');
  if (model.histogram * d < 0 || model.groups[2]?.reason.includes('Gegen-Divergenz')) signs.push('Momentum entgegen');
  const c = model.minute, level = d === 1 ? model.resistance?.price : model.support?.price;
  if (model.warnings.includes('Absorption') || c && level > 0 && (d === 1 ? c.high >= level && c.close < level : c.low <= level && c.close > level)) signs.push('Level / Absorption');
  if (model.warnings.includes('Funding extrem') || model.groups[4]?.reason.includes('Abbau/Eindeckung')) signs.push('Positionierung unsicher');
  return signs;
}
export function protectiveLevels(position, { price, atr, pivots = [], support, resistance, at, tickSize = null, warningSigns = [], minute = null, targetSupported = false }, cfg = SIGNAL_DEFAULTS) {
  if (!position || !(atr > 0) || !(price > 0)) return position ? { ...position } : null;
  const p = { ...position }, d = p.side === 'short' ? -1 : 1, swing = pivots.filter(x => x.type === (d === 1 ? 'low' : 'high') && x.time < p.openedAt).at(-1);
  if (!(p.stop > 0)) { const proposal = swing ? swing.price - d * cfg.swingBufferAtr * atr : p.entry - d * cfg.stopAtr * atr; p.stop = d * (p.entry - proposal) > 0 && Math.abs(proposal - p.entry) <= cfg.maxSwingAtr * atr ? proposal : p.entry - d * cfg.stopAtr * atr; }
  const level = d === 1 ? resistance?.price : support?.price;
  if (!(p.target > 0)) p.target = level > 0 && d * (level - p.entry) > 0 && Math.abs(level - p.entry) <= cfg.targetSearchAtr * atr ? level - d * cfg.swingBufferAtr * atr : p.entry + d * cfg.targetAtr * atr;
  p.extreme = d === 1 ? Math.max(p.extreme || p.entry, price) : Math.min(p.extreme || p.entry, price);
  if (d * (price - p.entry) >= cfg.breakEvenAtr * atr) {
    const latest = pivots.filter(x => x.type === (d === 1 ? 'low' : 'high') && x.time >= p.openedAt).at(-1), candidates = [p.stop, p.entry * (1 + d * (2 * cfg.feePct + cfg.spreadPct) / 100), p.extreme - d * cfg.trailingAtr * atr, ...(latest ? [latest.price - d * cfg.swingBufferAtr * atr] : [])];
    p.stop = d === 1 ? Math.max(...candidates) : Math.min(...candidates);
  }
  if (warningSigns.length >= 2 && minute?.closed) { const tighter = d === 1 ? minute.low : minute.high; p.stop = d === 1 ? Math.max(p.stop, tighter) : Math.min(p.stop, tighter); }
  if (cfg.runTarget && targetSupported && d * (price - p.target) >= 0) p.target = level > 0 && d * (level - price) > 0 ? level - d * cfg.swingBufferAtr * atr : price + d * cfg.targetAtr * atr;
  if (tickSize > 0 && Number.isFinite(tickSize)) { const round = (value, sign) => Number(((sign > 0 ? Math.ceil(value / tickSize - 1e-9) : Math.floor(value / tickSize + 1e-9)) * tickSize).toPrecision(15)); p.stop = round(p.stop, d); p.target = round(p.target, -d); }
  p.proposedAt = at; return p;
}
