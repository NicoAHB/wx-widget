// Darstellungshilfe, keine Änderung an pat-1, Güte, Zielen oder Handelssignalen.
import { INTERVAL_MS, intervalEnd } from './market-intervals.mjs';
import { confirmedPatternLifecycle } from './pattern-lifecycle.mjs';
export const PROJECTION_DEFAULTS = Object.freeze({ on: true, bars: 25 });
const types = new Set(['double_top', 'double_bottom', 'triple_top', 'triple_bottom', 'head_shoulders', 'inv_head_shoulders', 'asc_triangle', 'desc_triangle', 'sym_triangle', 'rising_wedge', 'falling_wedge', 'asc_channel', 'desc_channel', 'rectangle', 'flag_bull', 'flag_bear', 'pennant_bull', 'pennant_bear', 'cup_handle']);
const converging = new Set(['asc_triangle', 'desc_triangle', 'sym_triangle', 'rising_wedge', 'falling_wedge', 'pennant_bull', 'pennant_bear']);
export function projectionSettings(value) { return { on: value?.on !== false, bars: Number.isInteger(value?.bars) && value.bars >= 1 && value.bars <= 100 ? value.bars : PROJECTION_DEFAULTS.bars }; }
export function projectionTime(time, timeframe, slots) {
  if (!Number.isFinite(time) || !Number.isFinite(slots) || slots < 0 || !Object.hasOwn(INTERVAL_MS, timeframe)) return null;
  if (timeframe !== '1M') return time + slots * INTERVAL_MS[timeframe];
  let end = time; for (let n = 0; n < Math.floor(slots); n++) end = intervalEnd(end, timeframe);
  return end + (slots % 1) * (intervalEnd(end, timeframe) - end);
}
export function projectPatternLines(hit, candles, { timeframe = '1h', bars = 25, maxAge = 10, now = Date.now() } = {}) {
  if (hit?.kind !== 'form' || !types.has(hit.id) || hit.prelim || !Array.isArray(candles) || !candles.length || !Object.hasOwn(INTERVAL_MS, timeframe)) return [];
  const index = new Map(candles.map((c, i) => [c.time, i])), last = candles.length - 1, at = index.get(hit.t1);
  if (at === undefined || last - at > maxAge || /ungültig|invalid|abgelaufen/i.test(hit.status || '')) return [];
  const rows = candles.map((c, i) => ({ ...c, i })).filter(c => (c.closeTime ?? intervalEnd(c.time, timeframe) - 1) < now), after = rows.filter(c => c.time > hit.t1);
  const life = confirmedPatternLifecycle(hit, candles.map(c => ({ ...c, closeTime: c.closeTime ?? intervalEnd(c.time, timeframe) - 1 })), { now, maxAge });
  if (life?.disabled) return [];
  const invalid = hit.levels?.inv, slopingContext = /channel|triangle|wedge|flag|pennant/.test(hit.id);
  if (!life && !slopingContext && Number.isFinite(invalid) && after.some(c => hit.dir === 'bull' ? c.close < invalid : hit.dir === 'bear' ? c.close > invalid : false)) return [];
  const lines = (hit.lines || []).filter(l => ['res', 'sup', 'neck'].includes(l[4])).flatMap(([t0, p0, t1, p1, kind]) => {
    const i0 = index.get(t0), i1 = index.get(t1); if (i0 === undefined || i1 === undefined || i1 <= i0 || ![p0, p1].every(Number.isFinite)) return [];
    const slope = (p1 - p0) / (i1 - i0), intercept = p0 - slope * i0; return [{ kind, i0, i1, slope, intercept, value: i => intercept + slope * i }];
  });
  if (!lines.length) return [];
  if (!life && slopingContext && after.some(c => lines.some(l => (hit.dir === 'bull' && l.kind === 'sup' && c.close < l.value(c.i)) || (hit.dir === 'bear' && l.kind === 'res' && c.close > l.value(c.i))))) return [];
  let end = last + Math.max(1, Math.min(100, Math.floor(bars) || 25));
  if (converging.has(hit.id)) {
    const upper = lines.find(l => l.kind === 'res'), lower = lines.find(l => l.kind === 'sup'); if (!upper || !lower) return [];
    const difference = upper.slope - lower.slope;
    if (!(difference < -1e-12)) return []; const apex = (lower.intercept - upper.intercept) / difference;
    if (!Number.isFinite(apex) || apex <= last) return []; end = Math.min(end, apex);
  }
  return lines.flatMap(l => {
    const start = l.i1; if (end <= start || l.value(end) <= 0) return [];
    const broken = rows.some(c => c.time >= hit.t1 && c.i >= l.i0 && (l.kind === 'sup' ? c.close < l.value(c.i) : l.kind === 'neck' ? (hit.dir === 'bear' ? c.close < l.value(c.i) : c.close > l.value(c.i)) : c.close > l.value(c.i)));
    return [{ kind: l.kind, fromIndex: start, toIndex: end, fromPrice: l.value(start), price: l.value(end), toTime: projectionTime(candles.at(-1).time, timeframe, end - last), broken }];
  });
}
