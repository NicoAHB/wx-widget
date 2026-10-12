// 3.64.0: reine Auswahl-/Statushilfe auf den unveränderten pat-1-Treffern.
export const patternChipKey = hit => `${hit.id}|${hit.t0}`;
export function patternChipState(hit, candles, now = Date.now(), maxAge = 10) {
  const index = new Map(candles.map((c, i) => [c.time, i])), end = index.get(hit.t1);
  const age = end === undefined ? candles.filter(c => c.time > hit.t1).length : candles.length - 1 - end;
  if (age > maxAge) return { status: 'abgelaufen', disabled: true, age };
  const after = candles.filter(c => c.time > hit.t1 && c.closeTime < now);
  let invalid = /ungültig|invalid/i.test(hit.status || '');
  const slopes = /channel|triangle|wedge|flag|pennant/.test(hit.id);
  if (slopes) for (const [t0, p0, t1, p1, kind] of hit.lines || []) {
    const a = index.get(t0), b = index.get(t1); if (a === undefined || b === undefined || b <= a) continue;
    if ((hit.dir === 'bull' && kind !== 'sup') || (hit.dir === 'bear' && kind !== 'res') || hit.dir === 'neutral') continue;
    invalid ||= after.some(c => { const price = p0 + (p1 - p0) * (index.get(c.time) - a) / (b - a); return hit.dir === 'bull' ? c.close < price : c.close > price; });
  }
  else if (Number.isFinite(hit.levels?.inv)) invalid ||= after.some(c => hit.dir === 'bull' ? c.close < hit.levels.inv : hit.dir === 'bear' ? c.close > hit.levels.inv : false);
  return { status: invalid ? 'ungültig' : !hit.prelim && /^(?:bestätigt|Ausbruch bestätigt)$/i.test(hit.status || '') ? 'bestätigt' : 'aktiv', disabled: invalid, age, preliminary: !!hit.prelim };
}
export function patternChipRows(hits, candles, { minimum = 60, filter = 'all', now = Date.now(), maxAge = 10 } = {}) {
  const grouped = new Map();
  for (const h of hits) {
    if (h.kind !== 'form' || h.q < minimum || (filter !== 'all' && h.dir !== filter)) continue;
    const old = grouped.get(h.id); if (!old || h.t1 > old.t1 || h.t1 === old.t1 && h.q > old.q) grouped.set(h.id, h);
  }
  return [...grouped.values()].map(hit => ({ key: patternChipKey(hit), hit, ...patternChipState(hit, candles, now, maxAge) })).sort((a, b) => a.disabled - b.disabled || b.hit.t1 - a.hit.t1 || b.hit.q - a.hit.q);
}
