// AMD (3.90.0): Accumulation → Manipulation → Distribution. Reine Rechnung auf geschlossenen Kerzen; kein Abruf, keine Oberfläche.
// Ablauf je Zeitrahmen: seitwärts laufende Range (Accumulation) → Kerze durchbricht Hoch/Tief (Manipulation) →
// Schluss zurück in der Range UND 1m-Strukturbruch in Gegenrichtung (Bestätigung) → Ziel ist die Gegenseite der Range (Distribution).
import { CHART_INTERVALS, INTERVAL_MS } from './market-intervals.mjs';

const MINUTE = 60000;
export const AMD_INTERVALS = Object.freeze(CHART_INTERVALS.filter(id => id !== '1m'));
export const AMD = Object.freeze({
  id: 'amd', name: 'AMD', version: 'amd-1', defaultInterval: '15m',
  history: 400,            // geschlossene Kerzen je Abruf
  atrPeriod: 14,           // Wilder-ATR
  minCandles: 12,          // Mindestlänge der Range
  maxCandles: 120,         // längste Range, die rückwärts gesucht wird
  maxHeightAtr: 1.5,       // Standard: Rangehöhe höchstens 1,5 × ATR
  minBreakAtr: 0.1,        // Durchbruch zählt erst ab 0,1 ATR über/unter dem Rand (kein Rauschen)
  maxOutsideCloses: 3,     // so viele Schlüsse in Folge außerhalb = echter Ausbruch → ungültig
  maxWaitCandles: 12,      // so viele Kerzen ab dem Durchbruch bleibt die Bestätigung möglich
  stopBufferAtr: 0.1,      // Stop 0,1 ATR hinter dem Manipulations-Extrem
  minRR: 2,                // Standard: nur Setups mit CRV ≥ 1:2
  pivotStrength: 2,        // 1m-Swing: höher als je 2 Nachbarkerzen
  pivotLookback: 120,      // so weit zurück wird der letzte 1m-Swing gesucht
  minuteLimit: 1000,       // 1m-Kerzen je Abruf (Binance-Obergrenze)
  displayEpisodes: 4,      // so viele jüngste Abläufe zeichnet der Chart
  futureSlotsMin: 12, futureSlotsMax: 40, futureShare: 0.2,   // freier Platz rechts im Chart für die Distribution-Box und die verlängerten Linien
  cardCandles: 90,         // Kerzen im Telegram-Bild
  validMinMs: 10 * MINUTE, validMaxMs: 15 * MINUTE, // so lange nach der Bestätigung darf noch gesendet werden (kein Nachzügler-Versand)
  closeGraceMs: 2500, retryMs: 30000, retryMaxMs: 300000, requestSpacingMs: 750
});
export const AMD_STAGE_NAMES = Object.freeze(['Accumulation', 'Manipulation', 'Distribution']);
export const AMD_STATUS_TEXT = Object.freeze({
  accumulating: 'Range läuft', manipulating: 'Manipulation läuft', confirmed: 'Bestätigt', filtered: 'CRV zu niedrig',
  invalid: 'Ungültig', unchecked: '1m nicht prüfbar'
});

const clamp = (v, min, max, fallback) => v !== '' && v !== null && Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : fallback;
export function amdOptions(value) {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    interval: AMD_INTERVALS.includes(v.interval) ? v.interval : AMD.defaultInterval,
    maxHeightAtr: Math.round(clamp(v.maxHeightAtr, 0.5, 4, AMD.maxHeightAtr) * 10) / 10,
    minRR: Math.round(clamp(v.minRR, 1, 5, AMD.minRR) * 2) / 2
  };
}

// Nur normale, geschlossene Kerzen; die Schlusszeit kommt von der Börse (auch für Wochen- und Monatskerzen)
export function amdClosed(candles, asOf) {
  const byTime = new Map();
  for (const c of candles || []) {
    const end = Number.isFinite(c?.end) ? c.end : c?.closeTime + 1;
    if (![c?.time, c?.open, c?.high, c?.low, c?.close, end].every(Number.isFinite) || !(c.low > 0) || c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close) || end > asOf || end <= c.time) continue;
    byTime.set(c.time, { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, end });
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

// Wilder-ATR; der Wert an Index i nutzt nur Kerzen bis i
export function amdAtr(rows, period = AMD.atrPeriod) {
  const out = new Array(rows.length).fill(null);
  let sum = 0;
  for (let i = 1; i < rows.length; i++) {
    const c = rows[i], p = rows[i - 1].close, tr = Math.max(c.high - c.low, Math.abs(c.high - p), Math.abs(c.low - p));
    if (i <= period) { sum += tr; if (i === period) out[i] = sum / period; } else out[i] = (out[i - 1] * (period - 1) + tr) / period;
  }
  return out;
}

// Längstes Fenster, das an Index e endet, mindestens minCandles lang und höchstens maxHeightAtr × ATR hoch ist
export function amdFindRange(rows, atr, e, from, options) {
  const a = atr[e]; if (!(a > 0)) return null;
  const limit = options.maxHeightAtr * a;
  let high = -Infinity, low = Infinity, start = e;
  for (let i = e; i >= Math.max(from, e - AMD.maxCandles + 1); i--) {
    const h = Math.max(high, rows[i].high), l = Math.min(low, rows[i].low);
    if (h - l > limit) break;
    high = h; low = l; start = i;
  }
  return e - start + 1 >= AMD.minCandles ? { start, end: e, high, low, atr: a, height: high - low } : null;
}

// Für Short wird gespiegelt (Preise negiert): programmiert ist nur der Long-Ablauf (Fehlausbruch nach unten).
const identity = c => c;
const mirror = c => ({ ...c, open: -c.open, high: -c.low, low: -c.high, close: -c.close });

// Letzter 1m-Hochpunkt vor dem Extrem (Swing mit je `pivotStrength` niedrigeren Nachbarn); sonst das Hoch der letzten Kerzen bis zum Extrem
export function amdStructureLevel(minutes, x) {
  const s = AMD.pivotStrength;
  for (let i = x - s; i >= Math.max(s, x - AMD.pivotLookback); i--) {
    let pivot = true;
    for (let d = 1; d <= s && pivot; d++) if (!(minutes[i].high > minutes[i - d].high && minutes[i].high > minutes[i + d].high)) pivot = false;
    if (pivot) return minutes[i].high;
  }
  let level = -Infinity;
  for (let i = Math.max(0, x - 3); i <= x; i++) level = Math.max(level, minutes[i].high);
  return level;
}

// Ablauf ab dem Durchbruch. dir 1 = Fehlausbruch nach unten (Long), -1 = nach oben (Short).
// Zeitrahmen-Kerzen und Minutenkerzen laufen in zeitlicher Reihenfolge. Bestätigt ist der erste Moment, in dem der letzte
// geschlossene Zeitrahmen-Schluss in der Range liegt UND seit dem letzten Extrem ein 1m-Schluss über dem letzten Swing-Hoch (Long) steht.
function walk({ rows, minutes, j, dir, range, depth }) {
  const flip = dir === 1 ? identity : mirror, lo = dir === 1 ? range.low : -range.high, hi = dir === 1 ? range.high : -range.low;
  const mins = minutes.map(flip), covered = minutes.length > 0 && minutes[0].time < rows[j].end && minutes.at(-1).end > rows[j].time;
  let k = j, n = minutes.findIndex(c => c.end > rows[j].time); if (n < 0) n = minutes.length;
  let tracking = minutes.length > 0 && minutes[0].time > rows[j].time;     // 1m beginnt erst nach dem Durchbruch: ab der ersten Kerze verfolgen
  let outside = 0, inside = false, insideSeen = false, extreme = null, level = null, bos = null, aext = Infinity, seen = 0;
  const original = v => dir === 1 ? v : -v;
  const result = (status, at, more = {}) => {
    const found = [aext === Infinity ? null : original(aext), extreme ? original(extreme.price) : null].filter(Number.isFinite);
    return { status, at, k, covered, closedInside: insideSeen, extreme: found.length ? (dir === 1 ? Math.min(...found) : Math.max(...found)) : null, ...more };
  };
  for (;;) {
    const ta = k < rows.length ? rows[k].end : Infinity, tm = n < mins.length ? minutes[n].end : Infinity;
    if (ta === Infinity && tm === Infinity) break;
    if (tm <= ta) {                                       // bei gleicher Zeit zuerst die Minutenkerze
      const c = mins[n]; seen++;
      if (!tracking && c.low < lo - depth) tracking = true;
      if (tracking) {
        if (c.high > hi + depth) return result('invalid', minutes[n].end, { reason: 'Die Gegenseite der Range wurde erreicht, bevor die Bestätigung stand.' });
        if (!extreme || c.low < extreme.price) { extreme = { price: c.low, time: minutes[n].time, index: n }; level = amdStructureLevel(mins, n); bos = null; }
        else if (!bos && c.close > level) bos = { at: minutes[n].end, level };
      }
      n++;
      if (bos && inside) return result('confirmed', minutes[n - 1].end, { bos, entryPrice: minutes[n - 1].close });
      continue;
    }
    const c = flip(rows[k]); aext = Math.min(aext, c.low); k++;
    const end = rows[k - 1].end;
    if (k - 1 > j && c.high > hi + depth) return result('invalid', end, { reason: 'Die Gegenseite der Range wurde erreicht, bevor die Bestätigung stand.' });
    if (c.close >= lo && c.close <= hi) { inside = insideSeen = true; outside = 0; }
    else if (c.close < lo) { inside = false; outside++; if (outside >= AMD.maxOutsideCloses) return result('invalid', end, { reason: `${AMD.maxOutsideCloses} Schlüsse in Folge außerhalb der Range – echter Ausbruch, kein Fehlausbruch.` }); }
    else return result('invalid', end, { reason: 'Schluss auf der Gegenseite der Range – kein Fehlausbruch.' });
    if (bos && inside) return result('confirmed', end, { bos, entryPrice: rows[k - 1].close });
    if (k - j >= AMD.maxWaitCandles) {
      const checked = covered && seen > 0;
      return result(checked ? 'invalid' : 'unchecked', end, { reason: checked ? `Kein 1m-Strukturbruch innerhalb von ${AMD.maxWaitCandles} Kerzen – Setup verfallen.` : 'Die 1m-Kerzen reichen nicht bis zum Durchbruch zurück; die Bestätigung ist nicht prüfbar.' });
    }
  }
  return result('manipulating', null, { inside, bos });
}

// Erster Treffer von Stop oder Ziel nach dem Einstieg; Stop vor Ziel bei unklarer Reihenfolge innerhalb einer Kerze
function outcome(direction, stop, target, candles, from) {
  for (const c of candles) {
    if (c.end <= from) continue;
    if (direction === 1 ? c.low <= stop : c.high >= stop) return { status: 'stop', at: c.end, price: stop };
    if (direction === 1 ? c.high >= target : c.low <= target) return { status: 'target', at: c.end, price: target };
  }
  return { status: 'open' };
}

// Alle Abläufe der geladenen Kerzen, von vorn nach hinten. Ein Ablauf endet mit Bestätigung, Ungültigkeit oder dem Datenende.
export function amdScan(rows, minutes, options) {
  const atr = amdAtr(rows), episodes = [];
  let from = 0;
  while (from + AMD.minCandles <= rows.length) {
    let range = null;
    for (let i = Math.max(from + AMD.minCandles - 1, AMD.atrPeriod); i < rows.length && !range; i++) range = amdFindRange(rows, atr, i, from, options);
    if (!range) break;
    const depth = AMD.minBreakAtr * range.atr;
    let j = range.end + 1;
    while (j < rows.length && rows[j].high <= range.high + depth && rows[j].low >= range.low - depth) { range.end = j; j++; }
    const box = { start: range.start, end: range.end, high: range.high, low: range.low, atr: range.atr, height: range.height, startTime: rows[range.start].time, endTime: rows[range.end].end };
    if (j >= rows.length) { episodes.push({ status: 'accumulating', direction: 0, range: box }); break; }
    const up = rows[j].high > range.high + depth, down = rows[j].low < range.low - depth;
    if (up && down) { from = j + 1; continue; }                      // beide Seiten in einer Kerze: kein verwertbarer Ablauf
    const dir = down ? 1 : -1, w = walk({ rows, minutes, j, dir, range, depth });
    const ep = { status: w.status, direction: dir, range: box, breakIndex: j, breakAt: rows[j].time, extreme: w.extreme, closedInside: w.closedInside, reason: w.reason, endAt: w.at ?? rows.at(-1).end, ...(w.status === 'manipulating' ? { inside: w.inside, bosAt: w.bos?.at ?? null } : {}) };
    if (w.status === 'confirmed') {
      const entry = w.entryPrice, extreme = w.extreme;
      const stop = extreme - dir * AMD.stopBufferAtr * range.atr, target = dir === 1 ? range.high : range.low;
      const risk = dir * (entry - stop), reward = dir * (target - entry), rr = risk > 0 && reward > 0 ? reward / risk : null;
      Object.assign(ep, { extreme, confirmedAt: w.at, entry, stop, target, risk, reward, rr, bosAt: w.bos.at, bosLevel: dir === 1 ? w.bos.level : -w.bos.level });
      if (!(reward > 0)) { ep.status = 'filtered'; ep.reason = 'Das Ziel (Gegenseite der Range) ist beim Einstieg schon erreicht.'; }
      else if (!(risk > 0)) { ep.status = 'filtered'; ep.reason = 'Der Einstieg liegt hinter dem Stop.'; }
      else if (rr < options.minRR) { ep.status = 'filtered'; ep.reason = `CRV 1:${rr.toLocaleString('de-DE', { maximumFractionDigits: 2 })} liegt unter 1:${options.minRR.toLocaleString('de-DE')}.`; }
      ep.outcome = ep.status === 'confirmed' ? outcome(dir, stop, target, minutes.length && w.at >= minutes[0].time ? minutes : rows, w.at) : { status: 'none' };
    }
    episodes.push(ep);
    if (w.status === 'manipulating') break;
    from = Math.max(j + 1, w.k);
  }
  return episodes;
}

// Die drei Kästen eines Ablaufs (Zeit in ms, Preise); Grundlage für Chart und Telegram-Bild
export function amdBoxes(e) {
  const r = e.range, boxes = { accumulation: { from: r.startTime, to: r.endTime, high: r.high, low: r.low } };
  if (e.direction && Number.isFinite(e.extreme)) boxes.manipulation = { from: e.breakAt, to: e.endAt, high: e.direction === 1 ? r.low : e.extreme, low: e.direction === 1 ? e.extreme : r.high };
  if (e.status === 'confirmed' || e.status === 'filtered') boxes.distribution = { from: e.confirmedAt, to: e.outcome?.at ?? null, high: e.direction === 1 ? e.target : e.stop, low: e.direction === 1 ? e.stop : e.target, entry: e.entry };
  return boxes;
}

// Kerzen für das Telegram-Bild: der ganze Ablauf, höchstens cardCandles
export function amdCardCandles(rows, e) {
  const first = rows.findIndex(c => c.time >= e.range.startTime), start = Math.max(0, (first < 0 ? rows.length : first) - 3);
  return rows.slice(start).slice(-AMD.cardCandles).map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }));
}

// Ergebnis für die Kerzen eines Zeitrahmens. `minutes` darf fehlen: dann steht `needsMinutes` im Ergebnis, der Aufrufer lädt und ruft erneut.
// Die laufende (noch nicht geschlossene) Kerze zeigt einen Durchbruch sofort als vorläufige Manipulation. Bestätigt wird nie mit ihr.
function provisional(rows, last, forming, now) {
  if (!forming || last?.status !== 'accumulating' || ![forming.time, forming.high, forming.low].every(Number.isFinite) || forming.time < rows.at(-1).end) return null;
  const r = last.range, depth = AMD.minBreakAtr * r.atr, up = forming.high > r.high + depth, down = forming.low < r.low - depth;
  if (up === down) return null;
  return { status: 'manipulating', provisional: true, direction: down ? 1 : -1, range: r, breakIndex: rows.length, breakAt: forming.time, extreme: down ? forming.low : forming.high, endAt: now };
}

export function evaluateAmd({ candles, minutes = [], forming = null, symbol, market, now, options: raw }) {
  const options = amdOptions(raw), iv = options.interval, ms = INTERVAL_MS[iv];
  const rows = amdClosed(candles, now), mins = amdClosed(minutes, now), minNeeded = AMD.atrPeriod + AMD.minCandles;
  const base = { analysisId: AMD.id, symbol, market, interval: iv, intervalMs: ms, options, signal: null, direction: 0, stage: 0, episodes: [], expiresAt: Infinity };
  if (rows.length < minNeeded) return { ...base, ready: false, phase: 'data', reason: `Zu wenige geschlossene ${iv}-Kerzen (${rows.length}); mindestens ${minNeeded} nötig.` };
  const all = amdScan(rows, mins, options), early = provisional(rows, all.at(-1), forming, now);
  if (early) all[all.length - 1] = early;
  const episodes = all.slice(-AMD.displayEpisodes).map(e => { const id = `${iv}|${e.range.startTime}|${e.breakAt ?? 0}`; return { ...e, id, boxes: amdBoxes(e) }; });
  const out = { ...base, ready: true, at: rows.at(-1).end, episodes, current: episodes.at(-1) || null };
  const e = out.current;
  if (!e) return { ...out, phase: 'none', reason: `Keine Seitwärtsrange: mindestens ${AMD.minCandles} ${iv}-Kerzen mit höchstens ${options.maxHeightAtr.toLocaleString('de-DE')} × ATR Höhe.` };
  // Minutenkerzen braucht, wer eine Manipulation prüft oder einen bestätigten Einstieg beobachtet – nur ab dem Durchbruch, höchstens 1000 Minuten
  const lastMinute = Math.floor(now / MINUTE) * MINUTE, wants = e.direction !== 0 && !e.provisional && (e.status === 'manipulating' || e.status === 'unchecked' || e.status === 'confirmed' && e.outcome.status === 'open');
  // live: solange eine Range läuft, ein Durchbruch geprüft oder ein Einstieg beobachtet wird, schaut der Abruf jede Minute nach
  out.live = e.status === 'accumulating' || e.status === 'manipulating' || e.status === 'confirmed' && e.outcome.status === 'open';
  const needFrom = Math.max(e.breakAt ?? 0, lastMinute - (AMD.minuteLimit - 1) * MINUTE);
  out.needsMinutes = wants && (!mins.length || mins[0].time > needFrom + MINUTE) ? { from: needFrom, to: lastMinute } : null;
  const stage = e.status === 'confirmed' ? 3 : e.status === 'filtered' ? 2 : 1, side = e.direction === 1 ? 'Long' : 'Short';
  if (e.status === 'accumulating') return { ...out, phase: 'accumulation', stage, reason: `Accumulation: seitwärts laufende Range über ${e.range.end - e.range.start + 1} Kerzen. Warten auf einen Durchbruch.` };
  if (e.status === 'manipulating') return { ...out, phase: 'manipulation', stage, direction: e.direction, reason: `Manipulation ${e.direction === 1 ? 'nach unten' : 'nach oben'} läuft. Warten auf einen Schluss in der Range und einen 1m-Strukturbruch (${side}).` };
  if (e.status !== 'confirmed') return { ...out, phase: e.status, stage, direction: e.direction, reason: e.reason };
  const open = e.outcome.status === 'open', expiresAt = e.confirmedAt + Math.min(AMD.validMaxMs, Math.max(AMD.validMinMs, ms)), fresh = open && now < expiresAt;
  const signal = {
    analysisId: AMD.id, analysisName: AMD.name, version: AMD.version, symbol, market, direction: e.direction, side: side.toLowerCase(), at: e.confirmedAt, expiresAt,
    setupId: e.id, interval: iv, intervalMs: ms, timeframe: iv, entry: e.entry, stop: e.stop, target: e.target, target1: e.target, rr: e.rr,
    range: { low: e.range.low, high: e.range.high }, boxes: e.boxes, stageNames: [...AMD_STAGE_NAMES], zoneLabel: 'Distribution',
    footer: `AMD · ${iv} → 1m · Ziel: Gegenseite der Range · keine Gewinngarantie`, setup: ['Accumulation', e.direction === 1 ? 'Fehlausbruch unten' : 'Fehlausbruch oben', '1m-Strukturbruch']
  };
  const reason = open ? (fresh ? `${side} bestätigt: Fehlausbruch ${e.direction === 1 ? 'nach unten' : 'nach oben'}, Schluss in der Range und 1m-Strukturbruch.` : `${side} war bestätigt; der Hinweis ist abgelaufen und wird nicht mehr gesendet.`) : e.outcome.status === 'target' ? `${side}: Ziel (Gegenseite der Range) erreicht.` : `${side}: Stop erreicht.`;
  return { ...out, phase: open ? (fresh ? 'signal' : 'expired') : e.outcome.status, stage, direction: e.direction, signal: fresh ? { ...signal, chart: amdCardCandles(rows, e) } : null, lastSignal: signal, reason };
}
