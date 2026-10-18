// Top-Down v1: feste, nachvollziehbare Regeln. Keine laufende Kerze, kein rückdatierter Pivot.
import { createIndicatorState, advanceIndicators, closedCandles, confirmedPivots, divergenceInDirection } from './indicators.mjs';
import { computeKiZones } from './ki-zones.mjs';
import { detectFvgs } from './fvg.mjs';
import { macdFindings } from './macd-chart.mjs';
import { volumeProfile } from './volume-profile.mjs';
import { INTERVAL_MS } from './market-intervals.mjs';

export const TOP_DOWN = Object.freeze({ version: 'top-down-1', history: 500, warmup: 220, structureBars: 100,
  trendSlopeBars: 3, impulseATR: 1.5, blockLookback: 5, zoneAgeHours: 72, levelPadATR: .15,
  zoneMaxATR: 1.5, poolToleranceATR: .15, reversalBars: 4, executionBars: 8,
  microStructureBars: 3, stopPadATR: .2, cooldownMs: 2 * 3600000, signalAgeMs: 900000 });
const HOUR = INTERVAL_MS['1h'], QUARTER = INTERVAL_MS['15m'];
const overlaps = (c, z) => c.low <= z.high && c.high >= z.low;
const series = (rows, ms) => advanceIndicators(createIndicatorState({ time: rows[0].time, periodMs: ms }), rows, rows.at(-1).end).values;

export function analysisClosed(candles, interval, asOf) {
  const ms = INTERVAL_MS[interval];
  const rows = (candles || []).map(c => ({ ...c, end: c.end ?? c.closeTime + 1, knownAt: c.knownAt ?? c.end ?? c.closeTime + 1 }));
  const closed = closedCandles(rows, asOf, ms);
  if (closed.some(c => c.time % ms !== 0)) throw Error(`${interval}: Kerzenanker stimmt nicht mit der Börse überein.`);
  return closed;
}

export function topDownBias(rows, values = series(rows, INTERVAL_MS['4h'])) {
  if (rows.length < TOP_DOWN.warmup) return { direction: 0, reason: 'Mindestens 220 geschlossene 4h-Kerzen für EMA/Struktur nötig.' };
  const last = rows.at(-1), v = values.at(-1), before = values.at(-1 - TOP_DOWN.trendSlopeBars);
  const pivots = confirmedPivots(rows, last.end, INTERVAL_MS['4h']).filter(p => p.index >= rows.length - TOP_DOWN.structureBars);
  const highs = pivots.filter(p => p.type === 'high').slice(-2), lows = pivots.filter(p => p.type === 'low').slice(-2);
  const structure = highs.length === 2 && lows.length === 2 ? highs[1].price > highs[0].price && lows[1].price > lows[0].price ? 1 : highs[1].price < highs[0].price && lows[1].price < lows[0].price ? -1 : 0 : 0;
  const trend = v.ema50 > v.ema200 && v.ema50 > before.ema50 && v.ema200 > before.ema200 && last.close > v.ema200 ? 1 : v.ema50 < v.ema200 && v.ema50 < before.ema50 && v.ema200 < before.ema200 && last.close < v.ema200 ? -1 : 0;
  const direction = structure === trend ? trend : 0;
  // 3.78.2: ausschließlich Diagnosewerte; Richtung und sämtliche Signalbedingungen bleiben unverändert.
  return { direction, structure, trend, ema200: v.ema200, ema50: v.ema50, highs, lows, at: last.end,
    diagnostics: { close: last.close, ema50Before: before.ema50, ema200Before: before.ema200, slopeBars: TOP_DOWN.trendSlopeBars },
    reason: direction ? `${direction === 1 ? 'Höhere Hochs/Tiefs' : 'Tiefere Hochs/Tiefs'} und Trend/EMA 200 stimmen überein.` : '4h-Struktur, Trend und EMA 200 stimmen nicht vollständig überein.' };
}

// Letzte Gegenkerze vor einer Impulskerze: Körper >= 1,5 ATR der VORHERIGEN Kerze + Schluss über/unter vorheriger Struktur.
// Die Box ist erst beim Impulsschluss bekannt; spätere Schlüsse hinter der Box entwerten sie.
export function detectOrderBlocks(rows, values) {
  const out = [];
  for (let i = 6; i < rows.length; i++) {
    const c = rows[i], atr = values[i - 1]?.atr, direction = Math.sign(c.close - c.open);
    if (!(atr > 0) || !direction || Math.abs(c.close - c.open) < TOP_DOWN.impulseATR * atr) continue;
    const previous = rows.slice(i - 5, i), level = direction === 1 ? Math.max(...previous.map(k => k.high)) : Math.min(...previous.map(k => k.low));
    if (direction * (c.close - level) <= 0) continue;
    for (let j = i - 1; j >= Math.max(0, i - TOP_DOWN.blockLookback); j--) {
      const b = rows[j]; if (direction * (b.close - b.open) >= 0) continue;
      const invalid = rows.slice(i + 1).some(k => direction === 1 ? k.close < b.low : k.close > b.high);
      if (!invalid) out.push({ id: `ob:${b.time}:${direction}`, kind: 'order-block', label: 'Order Block', direction, low: b.low, high: b.high, time: b.time, knownAt: c.end });
      break;
    }
  }
  return out;
}

// Frühere bestätigte Swings werden vor der Sweep-Kerze gefiltert. Ein nachträglicher Pivot ist nie ein damals bekanntes Level.
export function detectSweeps(rows, ms) {
  if (!rows.length) return [];
  const pivots = confirmedPivots(rows, rows.at(-1).end, ms), out = [];
  for (let i = Math.max(5, rows.length - 72); i < rows.length; i++) {
    const c = rows[i];
    for (const [type, direction, field] of [['low', 1, 'low'], ['high', -1, 'high']]) {
      const p = pivots.filter(p => p.type === type && p.knownAt <= c.time && i - p.index <= 48).at(-1);
      if (p && direction * (c[field] - p.price) < 0 && direction * (c.close - p.price) > 0) out.push({ id: `sweep:${c.time}:${direction}`, kind: 'liquidity', label: 'Liquidity Sweep', direction, low: Math.min(c[field], p.price), high: Math.max(c[field], p.price), time: c.time, knownAt: c.end, level: p.price, index: i });
    }
  }
  return out;
}

export function topDownComponents(rows, values, direction) {
  const last = rows.at(-1), atr = values.at(-1).atr, pad = TOP_DOWN.levelPadATR * atr, cutoff = last.end - TOP_DOWN.zoneAgeHours * HOUR;
  const pivots = confirmedPivots(rows, last.end, HOUR), recent = pivots.filter(p => p.index >= rows.length - TOP_DOWN.structureBars), out = [], levels = [];
  const point = (id, label, price, time, knownAt, kind = 'key-level', dir = direction) => {
    levels.push({ id, label, price, time, knownAt }); out.push({ id, kind, label, direction: dir, low: price - pad, high: price + pad, time, knownAt });
  };
  for (const p of recent) point(`swing:${p.type}:${p.time}`, p.type === 'low' ? 'Unterstützung / Tief' : 'Widerstand / Hoch', p.price, p.time, p.knownAt);
  const window = rows.slice(-120), vp = volumeProfile(window);
  if (vp) point(`poc:${window[0].time}`, 'Volumenprofil · POC', vp.poc, window[0].time, last.end);
  const supply = computeKiZones({ candles: rows, interval: '1h', profile: vp, ema200: values.at(-1).ema200, levels: levels.map(l => l.price) });
  for (const z of supply.zones) if (!z.broken && z.side === (direction === 1 ? 'buy' : 'sell')) {
    // KI-Zonen benutzen vier rechte Nachbarn; konservative Kenntniszeit: aktueller 1h-Schluss.
    out.push({ id: `sd:${z.side}:${z.firstTime}`, kind: 'supply-demand', label: direction === 1 ? 'Demand' : 'Supply', direction, low: z.low, high: z.high, time: z.firstTime, knownAt: last.end });
  }
  for (const g of detectFvgs(rows)) if (g.mit < 0) out.push({ id: `fvg:${rows[g.i].time}`, kind: 'fvg', label: 'FVG', direction: g.dir === 'bull' ? 1 : -1, low: g.bottom, high: g.top, time: rows[g.start].time, knownAt: rows[g.i].end });
  out.push(...detectOrderBlocks(rows, values), ...detectSweeps(rows, HOUR));
  // Ähnliche bestätigte Hochs/Tiefs: Liquiditätspool, keine behaupteten echten Stop-Orders.
  for (const type of ['low', 'high']) {
    const same = recent.filter(p => p.type === type);
    for (let i = 1; i < same.length; i++) { const a = same[i - 1], b = same[i]; if (Math.abs(a.price - b.price) <= TOP_DOWN.poolToleranceATR * atr) point(`pool:${a.time}:${b.time}`, type === 'low' ? 'Tief-Liquiditätspool' : 'Hoch-Liquiditätspool', (a.price + b.price) / 2, a.time, b.knownAt, 'liquidity'); }
  }
  // Ein vorher bekanntes Level wird per Schluss gebrochen; mögliche Retest-Zone in Bias-Richtung.
  for (let i = Math.max(5, rows.length - 24); i < rows.length; i++) {
    const c = rows[i], p = recent.filter(p => p.type === (direction === 1 ? 'high' : 'low') && p.knownAt <= c.time).at(-1);
    if (p && direction * (rows[i - 1].close - p.price) <= 0 && direction * (c.close - p.price) > 0) out.push({ id: `break:${p.time}:${c.time}`, kind: 'break', label: 'Strukturbruch / Retest', direction, low: p.price - pad, high: p.price + pad, time: c.time, knownAt: c.end });
  }
  return { atr, levels, pivots, components: out.filter(z => z.direction === direction && z.knownAt >= cutoff && z.high >= z.low && z.high - z.low <= TOP_DOWN.zoneMaxATR * atr) };
}

export function confluenceZones(components, atr) {
  const zones = [], seen = new Set();
  const priority = { 'order-block': 0, fvg: 1, 'supply-demand': 2, liquidity: 3, break: 4, 'key-level': 5 };
  for (const anchor of [...components].sort((a, b) => priority[a.kind] - priority[b.kind] || b.knownAt - a.knownAt)) {
    let low = anchor.low, high = anchor.high; const selected = [anchor];
    for (const other of components) if (other !== anchor && Math.max(low, other.low) <= Math.min(high, other.high)) { selected.push(other); low = Math.max(low, other.low); high = Math.min(high, other.high); }
    const kinds = [...new Set(selected.map(z => z.kind))];
    if (kinds.length < 2 || high - low > TOP_DOWN.zoneMaxATR * atr || seen.has(anchor.id)) continue;
    // Dieselbe stabile Anker-ID bleibt bei jeder Kerzenaktualisierung dasselbe Setup.
    seen.add(anchor.id); zones.push({ id: anchor.id, low, high, direction: anchor.direction, time: Math.min(...selected.map(z => z.time)), knownAt: Math.max(...selected.map(z => z.knownAt)),
      kinds, labels: [...new Set(selected.map(z => z.label))], components: selected });
  }
  return zones.sort((a, b) => b.kinds.length - a.kinds.length || b.knownAt - a.knownAt);
}

function reversalAt(rows, values, index, direction, sweeps) {
  const c = rows[index], prev = rows[index - 1]; if (!prev) return [];
  const body = Math.max(Math.abs(c.close - c.open), (c.high - c.low) * .1), wick = direction === 1 ? Math.min(c.open, c.close) - c.low : c.high - Math.max(c.open, c.close);
  const reasons = [];
  if (direction * (c.close - c.open) > 0 && wick >= 1.5 * body && direction * (c.close - (c.high + c.low) / 2) > 0) reasons.push('Umkehrkerze mit Abweisungsdocht');
  if (direction * (prev.close - prev.open) < 0 && direction * (c.close - c.open) > 0 && direction * (c.close - prev.open) > 0 && direction * (c.open - prev.close) <= 0) reasons.push('Engulfing-Umkehrkerze');
  if (sweeps.some(s => s.index === index && s.direction === direction)) reasons.push('Liquidity Sweep');
  const prefix = rows.slice(0, index + 1), prefixValues = values.slice(0, index + 1), pivots = confirmedPivots(prefix, c.end, QUARTER);
  if (divergenceInDirection(pivots, prefixValues.map(v => v.rsi), direction, index, c.end, 3) === true) reasons.push('Bestätigte RSI-Divergenz');
  const found = macdFindings(prefix.map(k => ({ ...k, closeTime: k.end - 1 })), { line: prefixValues.map(v => v.macd), signal: prefixValues.map(v => v.signal) }, { now: c.end });
  if (found.events.divergence?.direction === direction) reasons.push('Bestätigte MACD-Divergenz');
  return reasons;
}

export function confirmTopDownEntry({ rows, values, zones, components, levels, direction, symbol, market }) {
  const last = rows.at(-1), prior = rows.at(-2), sweeps = detectSweeps(rows, QUARTER);
  for (const zone of zones) {
    const start = Math.max(1, rows.length - TOP_DOWN.executionBars), eligible = rows.slice(start).filter(c => c.time >= zone.knownAt);
    if (eligible.some(c => direction === 1 ? c.close < zone.low : c.close > zone.high)) continue;
    const touch = rows.findIndex((c, i) => i >= start && c.time >= zone.knownAt && overlaps(c, zone));
    if (touch < 0 || touch >= rows.length - 1) continue;
    const reversals = [];
    for (let i = Math.max(touch, rows.length - TOP_DOWN.reversalBars - 1); i < rows.length - 1; i++) {
      const reasons = reversalAt(rows, values, i, direction, sweeps);
      if (reasons.length) reversals.push({ index: i, at: rows[i].end, reasons });
    }
    if (!reversals.length) continue;
    // Vor der Bestätigung bekannte Mikrostruktur; erster Schlussbruch, kein fortlaufendes Wiederholungssignal.
    const reference = rows.slice(Math.max(0, rows.length - 1 - TOP_DOWN.microStructureBars), -1);
    const level = direction === 1 ? Math.max(...reference.map(c => c.high)) : Math.min(...reference.map(c => c.low));
    if (direction * (last.close - level) <= 0 || direction * (prior.close - level) > 0) continue;
    const atr = values.at(-1).atr, stop = direction === 1 ? Math.min(zone.low, ...rows.slice(touch).map(c => c.low)) - TOP_DOWN.stopPadATR * atr : Math.max(zone.high, ...rows.slice(touch).map(c => c.high)) + TOP_DOWN.stopPadATR * atr;
    const targets = levels.filter(l => l.knownAt <= last.time && direction * (l.price - last.close) > .1 * atr).sort((a, b) => direction * (a.price - b.price)).filter((l, i, a) => !i || Math.abs(l.price - a[i - 1].price) > .1 * atr).slice(0, 2);
    if (targets.length < 2 || !(direction * (last.close - stop) > 0)) continue;
    const risk = Math.abs(last.close - stop), signal = { analysisId: 'top-down', analysisName: 'Top-Down', version: TOP_DOWN.version, symbol, market, direction, side: direction === 1 ? 'long' : 'short',
      at: last.end, expiresAt: last.end + TOP_DOWN.signalAgeMs, setupId: zone.id, zone, bias: direction, setup: zone.labels, reversal: reversals.at(-1), confirmationLevel: level,
      entry: last.close, stop, target1: targets[0].price, target2: targets[1].price, targets, rr: Math.abs(targets[0].price - last.close) / risk, rr2: Math.abs(targets[1].price - last.close) / risk,
      chart: rows.slice(-60).map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume })), components };
    return signal;
  }
  return null;
}

export function evaluateTopDown({ candles, now, symbol, market = 'spot' }) {
  const base = analysisClosed(candles['15m'], '15m', now);
  if (base.length < 80) return { ready: false, direction: 0, stage: 0, reason: 'Mindestens 80 geschlossene 15m-Kerzen nötig.' };
  const last = base.at(-1), expiresAt = last.end + QUARTER;
  // 4h-/1h-Kontext war VOR Beginn der bestätigenden 15m-Kerze bekannt, auch an gemeinsamen Schlusszeiten.
  const higher = analysisClosed(candles['4h'], '4h', last.time), hour = analysisClosed(candles['1h'], '1h', Math.floor(last.time / HOUR) * HOUR);
  if (higher.length < TOP_DOWN.warmup || hour.length < 80) return { ready: false, direction: 0, stage: 0, reason: '4h-/1h-Vorlauf fehlt.' };
  if (now >= expiresAt || last.end !== Math.floor(now / QUARTER) * QUARTER || higher.at(-1).end !== Math.floor(last.time / INTERVAL_MS['4h']) * INTERVAL_MS['4h'] || hour.at(-1).end !== Math.floor(last.time / HOUR) * HOUR) return { ready: false, direction: 0, stage: 0, reason: 'Neue Schlusskerzen fehlen – keine Freigabe.' };
  const bias = topDownBias(higher), common = { ready: true, symbol, market, bias, direction: bias.direction, at: last.end, expiresAt, stage: bias.direction ? 1 : 0, signal: null, zones: [], components: [], trend: { '4h': bias.direction } };
  if (!bias.direction) return { ...common, reason: bias.reason };
  const contextZones = computeKiZones({ candles: higher, interval: '4h', ema200: bias.ema200 }).zones.filter(z => !z.broken && z.side === (bias.direction === 1 ? 'buy' : 'sell')).sort((a, b) => b.score - a.score).slice(0, 2).map(z => ({ ...z, knownAt: higher.at(-1).end, label: '4h ' + (z.side === 'buy' ? 'Demand' : 'Supply') }));
  const hv = series(hour, HOUR), lowerValues = series(base, QUARTER), setup = topDownComponents(hour, hv, bias.direction), zones = confluenceZones(setup.components, setup.atr);
  const trend = { '4h': bias.direction, '1h': Math.sign(hv.at(-1).ema50 - hv.at(-1).ema200), '15m': Math.sign(lowerValues.at(-1).ema50 - lowerValues.at(-1).ema200) };
  const touched = zones.filter(z => { const eligible = base.slice(-TOP_DOWN.executionBars).filter(c => c.time >= z.knownAt); return eligible.some(c => overlaps(c, z)) && eligible.every(c => bias.direction === 1 ? c.close >= z.low : c.close <= z.high); });
  const higherPivots = confirmedPivots(higher, higher.at(-1).end, INTERVAL_MS['4h']).slice(-24).map(p => ({ ...p, label: '4h-Strukturlevel' }));
  const signal = confirmTopDownEntry({ rows: base, values: lowerValues, zones: touched, components: setup.components, levels: [...setup.levels, ...higherPivots], direction: bias.direction, symbol, market });
  return { ...common, trend, stage: signal ? 3 : touched.length ? 2 : 1, signal, zones, contextZones, components: setup.components,
    setupZone: signal?.zone || touched[0] || null,
    reason: signal ? '15m-Umkehr und Schlussbruch bestätigt.' : touched.length ? '1h-Konfluenzzone berührt; 15m-Umkehr und Schlussbruch abwarten.' : '4h-Bias aktiv; Eintritt in eine 1h-Zone mit mindestens zwei Bausteinarten abwarten.' };
}
