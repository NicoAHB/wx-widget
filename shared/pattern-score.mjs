// G10(a): Muster bleiben ein gedeckelter Teil des 100-Punkte-Modells.
const WEIGHTS = Object.freeze({ '1m': .35, '5m': .45, '15m': .60, '1h': .80, '4h': 1, '1d': 1, '1D': 1, '1w': 1, '1W': 1, '1M': 1 });
const finite = Number.isFinite;
const time = x => Number.isSafeInteger(x) && x >= 0;

export function patternScore({ baseScore, weight = 15, direction, patterns, asOf }) {
  if (!finite(baseScore) || baseScore < 0 || baseScore > 100 || !finite(weight) || weight < 0 || weight > 100 || ![1, -1].includes(direction) || !time(asOf)) return { status: 'nicht bewertbar', score: null, reason: 'Ungültiger Score-/Musterkontext' };
  const base = baseScore * (100 - weight) / 100;
  if (weight === 0) return { status: 'bereit', score: baseScore, base, pattern: 0, matching: 0, opposing: 0 };
  if (!Array.isArray(patterns)) return { status: 'nicht bewertbar', score: null, reason: 'Musteranalyse nicht verfügbar' };
  const eligible = [];
  for (const p of patterns) {
    if (!p || !time(p.knownAt) || !time(p.closedAt)) return { status: 'nicht bewertbar', score: null, reason: 'Muster-Kenntniszeit fehlt' };
    if (p.knownAt > asOf || p.closedAt > asOf || p.provisional === true) continue;
    if (!p.family || ![1, -1, 0].includes(p.direction) || !finite(p.quality) || p.quality < 0 || p.quality > 100 || !finite(WEIGHTS[p.timeframe]) || typeof p.confirmed !== 'boolean' || !time(p.from) || !time(p.to) || p.to < p.from || p.to > p.closedAt || p.knownAt < p.closedAt) return { status: 'nicht bewertbar', score: null, reason: 'Ungültige Muster-Metadaten' };
    if (p.direction === 0) continue;
    eligible.push({ ...p, timeframe: p.timeframe === '1D' ? '1d' : p.timeframe === '1W' ? '1w' : p.timeframe, contribution: weight * p.quality / 100 * WEIGHTS[p.timeframe] * (p.confirmed ? 1 : .5) });
  }
  // Äquivalente Familie, Richtung und Ebene: überlappende Strecken nur einmal zählen.
  eligible.sort((a, b) => a.from - b.from || a.to - b.to);
  const groups = [];
  for (const p of eligible) {
    const g = groups.find(x => x.family === p.family && x.direction === p.direction && x.timeframe === p.timeframe && x.to >= p.from);
    if (g) { g.to = Math.max(g.to, p.to); g.contribution = Math.max(g.contribution, p.contribution); }
    else groups.push({ ...p });
  }
  const sum = d => Math.min(weight, groups.filter(p => p.direction === d).reduce((n, p) => n + p.contribution, 0));
  const matching = sum(direction), opposing = sum(-direction), pattern = matching - opposing;
  return { status: 'bereit', score: Math.max(0, Math.min(100, base + pattern)), base, pattern, matching, opposing };
}
