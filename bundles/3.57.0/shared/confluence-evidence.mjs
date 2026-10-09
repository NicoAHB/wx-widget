// 3.52.0: beschreibende Netto-Verteilung aus Originalreplays, kein Optimierer oder Echttrade-Beleg.
export function resultEvidence(cases, { key, threshold, asOf, from = 0 }) {
  if (!Array.isArray(cases) || typeof key !== 'string' || !Number.isFinite(threshold) || !Number.isSafeInteger(asOf) || !Number.isSafeInteger(from) || from < 0 || from > asOf) throw new Error('Auswertungsfenster prüfen');
  const unique = new Map(), conflicts = new Set();
  for (const c of cases.filter(x => x.observationKey === key && x.threshold === threshold && x.decisionAt >= from && x.decisionAt <= asOf)) {
    if (unique.has(c.id) && JSON.stringify(unique.get(c.id)) !== JSON.stringify(c)) conflicts.add(c.id); else unique.set(c.id, c);
  }
  const time = n => Number.isSafeInteger(n) && n >= 0;
  const own = [...unique.values()].filter(c => !conflicts.has(c.id)), mature = own.filter(c => time(c.entryAt) && time(c.maxHoldMs) && c.maxHoldMs > 0 && time(c.entryAt + c.maxHoldMs) && c.entryAt + c.maxHoldMs <= asOf), resolved = mature.filter(c => ['tp', 'sl', 'timeout'].includes(c.outcome) && time(c.resolvedAt) && c.resolvedAt >= c.entryAt && c.resolvedAt <= c.entryAt + c.maxHoldMs && (c.outcome !== 'timeout' || c.resolvedAt === c.entryAt + c.maxHoldMs)), complete = resolved.filter(c => c.costsComplete && c.costKind === 'history' && Number.isFinite(c.netR));
  const sorted = complete.map(c => c.netR).sort((a, b) => a - b), enough = complete.length >= 30 && complete.length === resolved.length, quantile = p => { const i = (sorted.length - 1) * p, n = Math.floor(i); return sorted[n] + (sorted[Math.min(n + 1, sorted.length - 1)] - sorted[n]) * (i - n); };
  return { status: enough ? 'beschreibende Auswertung' : complete.length !== resolved.length ? 'Kosten unvollständig' : 'zu wenig Daten', key, threshold, from, asOf, n: resolved.length, complete: complete.length,
    immature: own.length - mature.length, gaps: mature.length - resolved.length, incompleteCosts: resolved.length - complete.length, conflicts: conflicts.size,
    meanR: enough ? sorted.reduce((a, b) => a + b, 0) / sorted.length : null, medianR: enough ? quantile(.5) : null, p10R: enough ? quantile(.1) : null, p90R: enough ? quantile(.9) : null,
    netPositivePercent: enough ? 100 * sorted.filter(x => x > 0).length / sorted.length : null,
    period: complete.length ? { from: Math.min(...complete.map(x => x.decisionAt)), to: Math.max(...complete.map(x => x.resolvedAt)) } : null,
    label: 'Hypothetische Originalreplays nach modellierten Gebühren, Slippage und belegtem Funding. Überlappende/korrelierte Signale; keine statistisch abgesicherte Profitabilität.' };
}
