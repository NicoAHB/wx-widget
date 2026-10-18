// 3.77.5: Nur Anzeige-Lebenszyklus bestätigter Chartmuster; pat-1 bleibt unverändert.
export const PATTERN_RETEST_CONFIG = Object.freeze({ atrPeriod: 14, bufferAtr: .25, retestAtr: .5, failureCloses: 2 });
const positive = n => Number.isFinite(n) && n > 0;
export const patternIsConfirmed = h => !h.prelim && !/fehlt|nicht|unbestätigt|ungültig|invalid/i.test(h.status || '') && /bestätigt|^(über|unter) dem Kanal$/i.test(h.status || '');

// Wilder-ATR ausschließlich bis zum Bestätigungsschluss: spätere Volatilität darf
// einen früheren Strukturbruch weder löschen noch nachträglich erzeugen.
function breakoutAtr(hit, candles, now, period) {
  const rows = candles.filter(c => c.time <= hit.t1 && c.closeTime < now);
  let value = null, seed = [], previous = null;
  for (const c of rows) {
    if (![c.high, c.low, c.close].every(positive) || c.high < c.low || (previous && c.time > previous.closeTime + 1)) { value = null; seed = []; previous = null; }
    if (![c.high, c.low, c.close].every(positive) || c.high < c.low) continue;
    const tr = previous ? Math.max(c.high - c.low, Math.abs(c.high - previous.close), Math.abs(c.low - previous.close)) : c.high - c.low;
    if (value !== null) value = (value * (period - 1) + tr) / period;
    else { seed.push(tr); if (seed.length === period) value = seed.reduce((a, b) => a + b, 0) / period; }
    previous = c;
  }
  return value !== null && value >= 0 ? value : Number.isFinite(hit.vals?.ATR) && hit.vals.ATR >= 0 ? hit.vals.ATR : null;
}

function boundaries(hit, candles) {
  const index = new Map(candles.map((c, i) => [c.time, i]));
  const sloping = /channel|triangle|wedge|flag|pennant/.test(hit.id);
  const line = kind => (hit.lines || []).filter(l => l[4] === kind).flatMap(([t0, p0, t1, p1]) => {
    const a = index.get(t0), b = index.get(t1);
    if (a === undefined || b === undefined || b <= a || ![p0, p1].every(positive)) return [];
    const slope = (p1 - p0) / (b - a); return [{ slope, intercept: p0 - slope * a }];
  })[0];
  const upper = sloping ? line('res') : null, lower = sloping ? line('sup') : null;
  // Nach der Spitze eines konvergierenden Musters keine gekreuzten Grenzen
  // fortschreiben. Dort gelten die zuletzt zusammenlaufenden Strukturwerte.
  const difference = upper && lower ? upper.slope - lower.slope : 0;
  const apex = difference < -1e-12 ? (lower.intercept - upper.intercept) / difference : Infinity;
  const at = (kind, i) => {
    const l = kind === 'res' ? upper : lower, p = l ? l.intercept + l.slope * Math.min(i, Math.max(index.get(hit.t1) ?? i, apex)) : null;
    return positive(p) ? p : null;
  };
  const bull = hit.dir === 'bull';
  return i => ({ breakout: at(bull ? 'res' : 'sup', i) ?? (positive(hit.levels?.brk) ? hit.levels.brk : null),
    invalidation: at(bull ? 'sup' : 'res', i) ?? (positive(hit.levels?.inv) ? hit.levels.inv : null) });
}

// null: unbestätigtes/neutrales Muster; dafür bleibt die bisherige Prüfung zuständig.
export function confirmedPatternLifecycle(hit, candles, { now = Date.now(), maxAge = 10, liveOffset = 0, config = PATTERN_RETEST_CONFIG } = {}) {
  if (!patternIsConfirmed(hit) || !['bull', 'bear'].includes(hit.dir)) return null;
  const dir = hit.dir === 'bull' ? 1 : -1, end = candles.findIndex(c => c.time === hit.t1);
  const age = end < 0 ? candles.filter(c => c.time > hit.t1).length : candles.length - 1 - end;
  const boundary = boundaries(hit, candles), atr = breakoutAtr(hit, candles, now, config.atrPeriod), buffer = (atr ?? 0) * config.bufferAtr;
  let failures = 0, previous = null, last = null, lastBoundary = boundary(Math.max(0, end));
  const liveBoundary = boundary(Math.max(0, candles.length - 1 + liveOffset));
  const base = { age, confirmed: true, preliminary: false, atrAtBreakout: atr, structureBuffer: buffer, failureCloses: config.failureCloses,
    bufferAtr: config.bufferAtr, retestAtr: config.retestAtr,
    breakoutBoundary: liveBoundary.breakout, invalidationBoundary: liveBoundary.invalidation };
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c.time <= hit.t1 || !(c.closeTime < now)) continue;
    // Eine fehlende/ungültige Kerze darf keine Bestätigungsserie überbrücken.
    if (!positive(c.close) || (previous && c.time > previous.closeTime + 1)) failures = 0;
    if (!positive(c.close)) { previous = null; continue; }
    const b = boundary(i), beyond = positive(b.invalidation) && (c.close - b.invalidation) * dir < -buffer - Math.max(1, Math.abs(c.close)) * 1e-12;
    failures = beyond ? failures + 1 : 0;
    if (failures >= config.failureCloses) return { ...base, status: 'gescheitert', disabled: true, terminalAt: c.closeTime,
      invalidationBoundary: b.invalidation, failureCount: failures, trap: dir > 0 ? 'Mögliche Bullenfalle' : 'Mögliche Bärenfalle' };
    // Ziel gilt erst nach der Bestätigungskerze. Bei gleichzeitig bestätigtem
    // Strukturbruch und Zielwick entscheidet konservativ der Strukturbruch.
    const extreme = dir > 0 ? c.high : c.low;
    if (positive(hit.levels?.tgt) && Number.isFinite(extreme) && (extreme - hit.levels.tgt) * dir >= 0)
      return { ...base, status: 'erfüllt', disabled: true, terminalAt: c.closeTime, failureCount: 0 };
    previous = c; last = c; lastBoundary = b;
  }
  const retest = !!last && (failures > 0 || (positive(lastBoundary.breakout) && (last.close - lastBoundary.breakout) * dir <= (atr ?? 0) * config.retestAtr));
  return { ...base, status: age > maxAge ? 'abgelaufen' : retest ? 'rücktest' : 'bestätigt', disabled: age > maxAge, failureCount: failures };
}
