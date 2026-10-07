// G11: ideale Preisreferenzen; Ergebnisse nach modellierten Gebühren, ausdrücklich vor Funding.
import { PO3_VERSION, PO3_FRAMES, po3Settings, po3Key } from './po3-core.mjs';
const clone = x => JSON.parse(JSON.stringify(x));
export function po3Signal({ instrument, levels, confirmedAt, sweep, setupSweep, zone, score, box, source, sizing = null, fx = null }, config = {}) {
  const p = po3Settings(config);
  if (levels?.status !== 'bereit' || !p.closure || !score?.eligible || !Number.isSafeInteger(confirmedAt) || confirmedAt < 0 || !/^[A-Z0-9]{2,20}USDT$/.test(instrument || '') || !sweep || !setupSweep || !zone || !source) throw new Error('Vollständiger PO3-Preisplan/Modellwahl fehlt');
  const parametersKey = po3Key(p), sourceKey = JSON.stringify([source.venue, source.product, source.dataRevision, source.anchors ?? null]);
  const id = JSON.stringify([PO3_VERSION, parametersKey, sourceKey, instrument, levels.direction, sweep.time, zone.id, confirmedAt]);
  return { id, strategy: 'po3', modelVersion: PO3_VERSION, instrument, direction: levels.direction, parametersKey, sourceKey, config: { ...p }, source: clone(source),
    score: clone(score), box: clone(box), zone: clone(zone), sweep: clone(sweep), setupSweep: clone(setupSweep), sizing: clone(sizing), fx,
    plan: { levels: clone(levels), confirmedAt, availableAt: confirmedAt, entryExpiryAt: confirmedAt + p.entryExpiryBars * PO3_FRAMES[p.entry],
      maxHoldMs: p.maxHoldMs, entryMode: p.entryMode, closure: p.closure, feeEntry: p.feeEntry, feeExit: p.feeExit, periodMs: PO3_FRAMES[p.entry] },
    tradedByMe: false, status: p.entryMode === 'close' ? 'Offen' : 'Aktiv', costsLabel: 'Nach modellierten Gebühren, vor Funding', fundingComplete: false, completeNet: false };
}
export function simulatePo3(signal, rows, asOf) { return processPo3(signal, rows, asOf, false); }
export function advancePo3Signal(signal, rows, asOf) { return processPo3(signal, rows, asOf, true); }
function processPo3(signal, rows, asOf, resume) {
  if (signal?.modelVersion !== PO3_VERSION || signal.strategy !== 'po3' || signal.parametersKey !== po3Key(signal.config) || !Array.isArray(rows) || !Number.isSafeInteger(asOf)) throw new Error('PO3-Modell/Preisreihe fehlt');
  const p = signal.plan, l = p.levels, d = l.direction;
  if (asOf < p.availableAt) throw new Error('PO3-Entscheidung noch nicht bekannt');
  if (!resume) { signal = clone(signal); for (const key of ['processedTo', 'lastRow', 'priceConflict', 'entryAt', 'executionEntry', 'exitAt', 'remaining', 'tpsHit', 'outcome', 'grossR', 'netR', 'netEUR', 'fees', 'gross', 'netUnit', 'initialRisk', 'dataGap', 'needsFrom', 'durationMs', 'exits']) delete signal[key]; }
  const s = resume && Number.isSafeInteger(signal.processedTo) ? clone(signal) : { ...clone(signal), status: p.entryMode === 'close' ? 'Offen' : 'Aktiv', entryAt: p.entryMode === 'close' ? p.availableAt : null,
    executionEntry: p.entryMode === 'close' ? l.entry : null, exitAt: null, remaining: 1, tpsHit: [], outcome: null, grossR: null, netR: null, netEUR: null,
    fees: 0, gross: 0, netUnit: null, initialRisk: p.entryMode === 'close' ? l.risk : null, dataGap: false, needsFrom: null, durationMs: null, exits: [] };
  let cursor = s.processedTo ?? p.availableAt;
  if (s.processedTo === undefined && s.executionEntry !== null) s.fees = s.executionEntry * p.feeEntry;
  s.processedTo = cursor;
  if (s.priceConflict) return s;
  if (!['Aktiv', 'Offen'].includes(s.status)) return s;
  const duplicate = rows.find(c => c.time === s.lastRow?.time);
  if (duplicate && ['time', 'end', 'open', 'high', 'low', 'close', 'volume'].some(k => duplicate[k] !== s.lastRow[k])) {
    s.dataGap = true; s.priceConflict = true; s.needsFrom = s.lastRow.time; return s;
  }
  const close = (amount, price, at, kind) => { s.gross += d * amount * (price - s.executionEntry); s.fees += amount * price * p.feeExit; s.remaining = Math.max(0, s.remaining - amount); s.exits.push({ amount, price, at, kind });
    if (s.remaining < 1e-12) { s.remaining = 0; s.status = 'Abgeschlossen'; s.exitAt = at; s.outcome = kind; s.netUnit = s.gross - s.fees;
      s.grossR = s.initialRisk > 0 ? s.gross / s.initialRisk : null; s.netR = s.initialRisk > 0 ? s.netUnit / s.initialRisk : null;
      s.durationMs = at - s.entryAt; s.netEUR = s.sizing?.status === 'bereit' && Number.isFinite(s.fx) && s.fx > 0 ? (s.gross - s.fees) * s.sizing.quantity / s.fx : null; } };
  for (const c of rows.filter(c => c.time >= cursor && c.end <= asOf && c.knownAt <= asOf)) {
    if (c.time !== cursor || c.end !== c.time + p.periodMs || ![c.open, c.high, c.low, c.close].every(x => Number.isFinite(x) && x > 0)
      || c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close)) { s.dataGap = true; s.needsFrom = cursor; break; }
    cursor = c.end; s.processedTo = cursor; s.lastRow = clone(c); s.dataGap = false; s.needsFrom = null;
    if (s.status === 'Aktiv' && c.time >= p.entryExpiryAt) { s.status = 'Verfallen'; break; }
    let sameIntrabarEntry = false;
    if (s.entryAt === null) {
      const atOpen = d * (c.open - l.entry) <= 0, touched = d === 1 ? c.low <= l.entry : c.high >= l.entry;
      if (!atOpen && !touched) { if (d * (c.close - (signal.config.stop === 'eng' ? signal.sweep.extreme : signal.setupSweep.extreme)) < 0) { s.status = 'Ungültig'; break; } continue; }
      s.entryAt = atOpen ? c.time : c.end; s.executionEntry = atOpen ? c.open : l.entry; s.initialRisk = d * (s.executionEntry - l.sl); s.status = 'Offen'; s.fees = s.executionEntry * p.feeEntry; sameIntrabarEntry = !atOpen;
    }
    const deadline = s.entryAt + p.maxHoldMs;
    if (c.time >= deadline) { close(s.remaining, c.open, deadline, 'timeout'); break; }
    const slGap = d * (c.open - l.sl) <= 0, sl = d === 1 ? c.low <= l.sl : c.high >= l.sl;
    if (slGap || sl) { close(s.remaining, slGap ? c.open : l.sl, slGap ? c.time : c.end, 'sl'); break; }
    // Intrabar Limit+TP beweist keine Reihenfolge: SL blieb vorrangig, TP erst in späterer Minute.
    if (!sameIntrabarEntry) for (let i = 0; i < 3; i++) {
      if (s.tpsHit.includes(i + 1) || !(d === 1 ? c.high >= l.tps[i] : c.low <= l.tps[i])) continue;
      s.tpsHit.push(i + 1); close(p.closure === 'tp1' ? s.remaining : i === 2 ? s.remaining : 1 / 3, l.tps[i], c.end, 'tp' + (i + 1));
      if (s.status === 'Abgeschlossen') break;
    }
    if (s.status === 'Abgeschlossen') break;
    if (c.end === deadline) { close(s.remaining, c.close, deadline, 'timeout'); break; }
    if (c.end > deadline) { s.dataGap = true; s.needsFrom = c.time; break; }
  }
  if (s.status === 'Aktiv' && !s.dataGap && asOf >= p.entryExpiryAt) { if (cursor < p.entryExpiryAt) { s.dataGap = true; s.needsFrom = cursor; } else s.status = 'Verfallen'; }
  if (s.status === 'Offen' && asOf >= s.entryAt + p.maxHoldMs && cursor < s.entryAt + p.maxHoldMs) { s.dataGap = true; s.needsFrom = cursor; }
  return s;
}
export function po3JournalStats(records, { key, sourceKey, from, to, origin, instrument, direction, minimumScore = 0, context } = {}) {
  const unique = new Map(), conflicts = new Set();
  for (const s of records) { if (!s?.id) continue; const old = unique.get(s.id); if (old && JSON.stringify(old) !== JSON.stringify(s)) conflicts.add(s.id); else unique.set(s.id, s); }
  const own = [...unique.values()].filter(s => !conflicts.has(s.id) && s.parametersKey === key && (!sourceKey || s.sourceKey === sourceKey) && s.score.score >= minimumScore && (context === undefined || s.config.contextOn === context) && s.plan.confirmedAt >= from && s.plan.confirmedAt < to && (!origin || s.source.origin === origin)
    && (!instrument || s.instrument === instrument) && (!direction || s.direction === direction));
  const completed = own.filter(s => s.status === 'Abgeschlossen' && !s.dataGap);
  const n = completed.length, tp1 = completed.filter(s => s.tpsHit.includes(1)).length;
  return { n, tp1, tpPercent: n >= 30 ? tp1 / n * 100 : null, netR: completed.filter(s => Number.isFinite(s.netR)).reduce((sum, s) => sum + s.netR, 0), incompleteR: completed.filter(s => !Number.isFinite(s.netR)).length,
    active: own.filter(s => s.status === 'Aktiv').length, open: own.filter(s => s.status === 'Offen').length, expired: own.filter(s => s.status === 'Verfallen').length,
    invalid: own.filter(s => s.status === 'Ungültig').length, gaps: own.filter(s => s.dataGap).length, conflicts: conflicts.size, period: { from, to },
    label: 'Nach Gebühren, vor Funding. Hypothetische Signale; „von mir gehandelt“ ist keine belegte Ausführung.' };
}
