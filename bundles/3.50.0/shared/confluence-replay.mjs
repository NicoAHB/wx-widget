// G10(d): Originale Entscheidungseingaben, anschließend historische Preis-/Kostenauflösung.
import { settings, parametersKey, scoreConfluence, referenceEntry, tradeLevels, costFilter, netPnl, cohortStats, closedCandles } from './confluence-core.mjs';
import { setupAnchor, fundingScenario } from './confluence-live.mjs';

export const REPLAY_VERSION = 'cf-replay-1';
export const OBSERVATION_LIMIT = 5000, OBSERVATION_BYTES = 12 * 1024 * 1024;
const HOUR = 3600e3, DAY = 24 * HOUR;
const time = x => Number.isSafeInteger(x) && x >= 0;
const positive = x => Number.isFinite(x) && x > 0;
const clone = x => JSON.parse(JSON.stringify(x));
const encode = x => new TextEncoder().encode(JSON.stringify(x)).length;
export function observationKey(scope, config, options) {
  return JSON.stringify([REPLAY_VERSION, parametersKey(config), scope.venue, scope.product, scope.instrument, scope.timeframe, scope.contextTimeframe,
    scope.horizon, scope.maxHoldMs, scope.slippageBps, scope.indicatorAnchors, options.fundingMode, options.anchorPolicy]);
}
export function captureObservation(result, config, options) {
  const data = result?.data, p = settings(config);
  if (!data?.scope || !time(data.scope.asOf) || !time(data.base?.closedAt) || !data.funding || data.funding.kind !== 'current'
    || !Array.isArray(data.patterns) || ![1, -1].some(direction => Number.isFinite(scoreConfluence({ ...data, direction }, p).score))) return null;
  const compact = clone(data); delete compact.context.rsiValues; delete compact.context.pivots; delete compact.context.zones;
  // Die vollständigen Basiswerte bleiben erhalten; nur grafische Musterbeilagen entfallen.
  compact.patterns.forEach(pattern => { delete pattern.hit; });
  const key = observationKey(data.scope, p, options);
  return { version: REPLAY_VERSION, id: JSON.stringify([key, data.base.closedAt]), key, origin: 'beobachtet', decisionAt: data.scope.asOf,
    data: compact, config: { ...p }, options: { fundingMode: options.fundingMode, anchorPolicy: options.anchorPolicy } };
}
export function mergeObservations(old, incoming) {
  if (!Array.isArray(old) || !Array.isArray(incoming)) throw new Error('Originalbeobachtungen fehlen');
  const by = new Map();
  for (const row of [...old, ...incoming]) {
    if (!row || row.version !== REPLAY_VERSION || row.origin !== 'beobachtet' || !time(row.decisionAt) || row.decisionAt !== row.data?.scope?.asOf
      || row.key !== observationKey(row.data.scope, row.config, row.options) || row.id !== JSON.stringify([row.key, row.data.base.closedAt])) throw new Error('Fremde oder beschädigte Originalbeobachtung');
    const prior = by.get(row.id);
    if (prior?.decisionAt === row.decisionAt && JSON.stringify(prior) !== JSON.stringify(row)) throw new Error('Widersprüchliche Originalbeobachtung');
    if (!prior || row.decisionAt < prior.decisionAt) by.set(row.id, row);
  }
  const next = [...by.values()].sort((a, b) => a.decisionAt - b.decisionAt || a.id.localeCompare(b.id));
  if (next.length > OBSERVATION_LIMIT || encode(next) > OBSERVATION_BYTES) throw new Error('Originalarchiv voll (5000 / 12 MiB); neue Beobachtungen pausieren, Bestand bleibt erhalten');
  return next;
}

function exitPrice(raw, direction, slip, tick) {
  const units = raw * (1 - direction * slip / 1e4) / tick;
  return (direction === 1 ? Math.floor(units + 1e-10) : Math.ceil(units - 1e-10)) * tick;
}
export function simulateTrade({ rows, levels, direction, entryAt, maxHoldMs, asOf, observedAt = asOf, slippageBps = 0, periodMs = HOUR }) {
  const deadline = entryAt + maxHoldMs;
  if (levels?.status !== 'bereit' || levels.direction !== direction || !positive(levels.tickSize) || ![entryAt, deadline, asOf, observedAt].every(time) || observedAt < asOf || !positive(maxHoldMs)
    || !Number.isFinite(slippageBps) || slippageBps < 0 || slippageBps >= 1e4 || !positive(periodMs)) return { outcome: 'gap', reason: 'Simulationskontext ungültig' };
  if (deadline > asOf) return { outcome: 'unreif', deadline }; // auch schneller TP bleibt bis zum gesamten Horizont unreif
  let cursor = entryAt, last = null;
  for (const c of rows.filter(c => c.time >= entryAt && c.time <= deadline)) {
    if (c.time !== cursor || c.end !== c.time + periodMs || c.end > asOf || c.knownAt > observedAt || ![c.open, c.high, c.low, c.close].every(positive)
      || c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close)) return { outcome: 'gap', deadline, reason: 'Preisreihe unvollständig/ungültig' };
    if (c.time === deadline) return { outcome: 'timeout', resolvedAt: deadline, exit: exitPrice(c.open, direction, slippageBps, levels.tickSize), deadline };
    if (c.end > deadline) return { outcome: 'gap', deadline, reason: 'Für den Ablauf fehlt eine feinere Kerze' };
    const gapSL = direction * (c.open - levels.sl) <= 0, gapTP = direction * (c.open - levels.tp) >= 0;
    const sl = direction === 1 ? c.low <= levels.sl : c.high >= levels.sl;
    const tp = direction === 1 ? c.high >= levels.tp : c.low <= levels.tp;
    if (gapSL || gapTP || sl || tp) {
      const outcome = gapSL || (!gapTP && sl) ? 'sl' : 'tp';
      return { outcome, resolvedAt: gapSL || gapTP ? c.time : c.end, exit: exitPrice(gapSL ? c.open : outcome === 'sl' ? levels.sl : levels.tp, direction, slippageBps, levels.tickSize),
        deadline, ambiguity: !gapSL && !gapTP && sl && tp, gapFill: gapSL, timing: gapSL || gapTP ? 'Kerzenbeginn' : 'modellierter Schluss der Trefferkerze' };
    }
    cursor = c.end; last = c;
    if (cursor === deadline) return { outcome: 'timeout', resolvedAt: deadline, exit: exitPrice(last.close, direction, slippageBps, levels.tickSize), deadline };
  }
  return { outcome: 'gap', deadline, reason: 'Preisabdeckung bis Ablauf fehlt' };
}

export function historicalFunding({ history, marks, entryAt, exitAt }) {
  if (!history || history.complete !== true || !time(history.from) || !time(history.to) || history.from > entryAt || history.to < exitAt
    || !Array.isArray(history.events) || !Array.isArray(marks)) return null;
  const prices = new Map(marks.map(c => [c.time, c.open])), by = new Map();
  for (const e of history.events) {
    if (!time(e.at) || !Number.isFinite(e.rate) || e.kind !== 'settled') return null;
    if (e.at < entryAt || e.at >= exitAt) continue;
    const markPrice = prices.get(e.at);
    if (!positive(markPrice) || by.has(e.at) && by.get(e.at).rate !== e.rate) return null;
    by.set(e.at, { at: e.at, rate: e.rate, markPrice });
  }
  return { kind: 'history', complete: true, from: entryAt, to: exitAt, events: [...by.values()].sort((a, b) => a.at - b.at),
    source: 'öffentliche Bitget-Abrechnungen; Markpreis = Open der am Termin beginnenden 1h-Markkerze' };
}

export function replayObservation(observation, { rows, history, marks, asOf, observedAt = asOf, threshold }) {
  if (observation?.version !== REPLAY_VERSION || observation.origin !== 'beobachtet' || !time(asOf) || !time(observedAt) || observedAt < asOf || !Number.isFinite(threshold) || threshold < 60 || threshold > 100
    || observation.decisionAt !== observation.data?.scope?.asOf || observation.key !== observationKey(observation.data.scope, observation.config, observation.options)) throw new Error('Originalmodell/Schwelle fehlt');
  const o = observation, p = settings(o.config), data = o.data;
  if (o.decisionAt > asOf) return { cases: [], reason: 'Originalbeobachtung zukünftig' };
  const scores = [1, -1].map(direction => scoreConfluence({ ...data, direction }, p));
  const candidates = scores.filter(score => Number.isFinite(score.score) && !score.blocked && score.score >= threshold);
  if (candidates.length > 1) return { cases: [], conflict: true };
  const cases = [];
  for (const score of candidates) {
    const direction = score.direction, anchor = setupAnchor(data.base, direction, o.decisionAt, o.options.anchorPolicy);
    const usable = rows.filter(c => c.end <= asOf && c.knownAt <= observedAt);
    const ref = referenceEntry(usable, o.decisionAt, direction, data.scope.slippageBps);
    if (!anchor || ref.status !== 'bereit') continue;
    const levels = tradeLevels({ entry: ref.entry, anchor: anchor.price, atr: data.base.atr, direction, tickSize: data.contract?.tickSize }, p);
    const deadline = ref.at + data.scope.maxHoldMs;
    const scenario = fundingScenario({ current: data.funding, entryAt: ref.at, exitAt: deadline, entry: levels.entry, mode: o.options.fundingMode });
    const costs = costFilter({ levels, direction, entryAt: ref.at, tpAt: deadline, slAt: deadline, fundingTP: scenario, fundingSL: scenario }, p);
    if (levels.status !== 'bereit' || !costs.passed) continue; // niemals später realisierte Fundingraten als Auswahlfilter benutzen
    const resolved = simulateTrade({ rows: usable, levels, direction, entryAt: ref.at, maxHoldMs: data.scope.maxHoldMs, asOf, observedAt, slippageBps: data.scope.slippageBps });
    const cashflow = historicalFunding({ history, marks, entryAt: ref.at, exitAt: resolved.resolvedAt });
    const pnl = resolved.exit > 0 ? netPnl({ direction, quantity: 1, entry: levels.entry, exit: resolved.exit, entryAt: ref.at, exitAt: resolved.resolvedAt, funding: cashflow }, p) : null;
    cases.push({ id: JSON.stringify([o.id, threshold, direction]), observationKey: o.key, replayVersion: REPLAY_VERSION, scope: { ...data.scope, direction }, parametersKey: parametersKey(p),
      threshold, score: score.score, decisionAt: o.decisionAt, entryAt: ref.at, maxHoldMs: data.scope.maxHoldMs, levels, ...resolved,
      costsComplete: pnl?.status === 'bereit', costKind: 'history', netReturn: pnl?.status === 'bereit' ? pnl.net / levels.entry : null,
      netR: pnl?.status === 'bereit' ? pnl.net / levels.risk : null, costs: pnl, funding: cashflow });
  }
  return { cases, conflict: false };
}

export function backtestSummary(cases, threshold, asOf) {
  const selected = cases.filter(c => c.threshold === threshold), mature = selected.filter(c => c.entryAt + c.maxHoldMs <= asOf), evaluated = mature.filter(c => ['tp', 'sl', 'timeout'].includes(c.outcome));
  const costsComplete = evaluated.every(c => c.costsComplete && Number.isFinite(c.netR)), enough = evaluated.length >= 30;
  let equity = 0, peak = 0, maxDrawdownR = 0;
  for (const c of [...evaluated].sort((a, b) => a.entryAt - b.entryAt || a.id.localeCompare(b.id))) { if (!costsComplete) break; equity += c.netR; peak = Math.max(peak, equity); maxDrawdownR = Math.max(maxDrawdownR, peak - equity); }
  return { threshold, n: evaluated.length, immature: selected.length - mature.length, gaps: mature.length - evaluated.length,
    tpPercent: enough ? 100 * evaluated.filter(c => c.outcome === 'tp').length / evaluated.length : null,
    averageRR: evaluated.length ? evaluated.reduce((sum, c) => sum + c.levels.rewardRisk, 0) / evaluated.length : null,
    netR: costsComplete && evaluated.length ? equity : null, maxDrawdownR: costsComplete && evaluated.length ? maxDrawdownR : null,
    incompleteCosts: evaluated.filter(c => !c.costsComplete).length,
    sequence: 'Einzelsignalfolge nach Einstieg/ID; mögliche Überlappung, kein finanziertes Portfolio. Kein Euro-/Prozent-Drawdown.' };
}

export function cardHistoricalStats(card, { cases = [], observations = [], asOf, sizing = null }) {
  const scope = { ...card.scope, asOf }, key = observationKey(scope, card.config, card.options), own = cases.filter(c => c.observationKey === key && c.threshold === card.config.minimumScore);
  const records = observations.filter(o => o.key === key && o.decisionAt <= asOf);
  return Object.fromEntries([['short', 90], ['long', 730]].map(([name, days]) => {
    const from = Math.max(0, asOf - days * DAY), stats = cohortStats(own, { scope, targetScore: card.score.score, from, asOf, sizing }, card.config);
    const dates = records.filter(o => o.decisionAt >= from).map(o => o.decisionAt);
    return [name, { ...stats, status: dates.length ? stats.status : 'nicht bewertbar', requestedDays: days, originalObservationPeriod: dates.length ? { from: Math.min(...dates), to: Math.max(...dates) } : null,
      coverage: 'Nur tatsächlich protokollierte Originaleingaben; keine lückenlose 90-Tage-/2-Jahres-Historie behauptet.',
      missingHistoricalInputs: true, reason: 'Bitget-Abrechnungshistorie enthält keine damals angekündigte Fundingrate samt Intervall. Frühere Originalentscheidungen sind nicht rekonstruierbar.' }];
  }));
}

export function replayJob({ observations, rows, history, marks, asOf, observedAt = asOf, cursor = 0, limit = 25 }) {
  if (!Array.isArray(observations) || observations.length > OBSERVATION_LIMIT || !time(asOf) || !time(observedAt) || observedAt < asOf || !Number.isSafeInteger(cursor) || cursor < 0 || !Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Begrenzter Backtestjob ungültig');
  for (const row of rows) closedCandles([row], observedAt, HOUR); // Auswertungsgrenze und tatsächlicher Abruf sind verschiedene Zeiten
  const end = Math.min(observations.length, cursor + limit), cases = []; let conflicts = 0;
  for (let i = cursor; i < end; i++) {
    const thresholds = [...new Set([60, 70, 80, observations[i].config.minimumScore])];
    for (const threshold of thresholds) { const result = replayObservation(observations[i], { rows, history, marks, asOf, observedAt, threshold }); cases.push(...result.cases); conflicts += result.conflict ? 1 : 0; }
  }
  return { cases, conflicts, nextCursor: end, complete: end === observations.length, version: REPLAY_VERSION };
}
