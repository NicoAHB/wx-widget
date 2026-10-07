// G10(c): reine Vorbereitung der lokalen Karten; öffentliche Daten, ausdrücklich benannte Kostenannahmen.
import { settings, parametersKey, scoreConfluence, combineDirections, tradeLevels, positionSize, costFilter, signalDecision,
  crossStatus, divergenceInDirection, divergenceInfo } from './confluence-core.mjs';
import { BITGET_FRAMES } from './bitget-public.mjs';
import { attachBitgetPatterns, PATTERN_ADAPTER_VERSION } from './bitget-patterns.mjs';

export const LIVE_VERSION = 'cf-live-1';
const positive = x => Number.isFinite(x) && x > 0;
const time = x => Number.isSafeInteger(x) && x >= 0;
export function scoreLabel(value, minimum = 70) {
  if (!Number.isFinite(value) || value < 0 || value > 100 || !Number.isFinite(minimum) || minimum < 70 || minimum > 100) return 'nicht bewertbar';
  const format = x => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(x), rounded = Number(value.toFixed(2));
  // Anzeige darf 69,999 nicht wie einen erreichten Grenzwert aussehen lassen; Fachscore bleibt ungerundet.
  for (const threshold of [50, minimum]) if (value < threshold && rounded >= threshold) return '< ' + format(threshold);
  return format(value);
}
export function setupAnchor(base, direction, asOf, policy) {
  if (!base || ![1, -1].includes(direction) || !positive(base.price) || !positive(base.atr) || !time(asOf)) return null;
  const pivots = (base.pivots || []).filter(p => p.type === (direction === 1 ? 'low' : 'high') && p.knownAt <= asOf);
  const zones = (base.zones || []).map(z => ({ ...z, label: z.from !== undefined ? 'Fib 0,618' : direction === 1 ? 'bestätigte Unterstützung' : 'bestätigter Widerstand',
    structureAt: z.to ?? pivots.findLast(p => p.price === z.price && p.knownAt === z.knownAt)?.time ?? 0 }));
  if (policy === 'nearest') zones.push({ price: base.ema50, direction, confirmed: true, knownAt: asOf, label: 'EMA 50', structureAt: base.closedAt });
  else if (policy !== 'latest-pivot') return null;
  const candidates = policy === 'latest-pivot' ? zones.filter(z => z.direction === direction && z.from === undefined && z.confirmed && z.knownAt <= asOf).sort((a, b) => b.structureAt - a.structureAt).slice(0, 1) : zones;
  const eligible = candidates.filter(z => positive(z.price) && z.direction === direction && z.confirmed === true && z.knownAt <= asOf
    && direction * (base.price - z.price) >= 0 && Math.abs(base.price - z.price) <= .5 * base.atr && (policy !== 'latest-pivot' || z.from === undefined));
  eligible.sort((a, b) => policy === 'nearest' ? Math.abs(base.price - a.price) - Math.abs(base.price - b.price) || b.structureAt - a.structureAt : b.structureAt - a.structureAt);
  return eligible[0] || null;
}

export function fundingScenario({ current, entryAt, exitAt, entry, mode }) {
  if (mode !== 'current-rate' || !current || current.kind !== 'current' || !Number.isFinite(current.rate) || !positive(current.intervalHours) || current.positiveMeans !== 'long-pays'
    || !time(current.knownAt) || !time(current.nextAt) || !time(entryAt) || !time(exitAt) || exitAt < entryAt || current.knownAt > entryAt || entryAt >= current.nextAt || !positive(entry)) return null;
  const interval = current.intervalHours * 3600e3, events = [];
  if (!Number.isSafeInteger(interval) || interval <= 0 || (exitAt - entryAt) / interval > 1024) return null;
  for (let at = current.nextAt; at < exitAt; at += interval) events.push({ at, rate: current.rate, markPrice: entry });
  return { kind: 'scenario', complete: true, from: entryAt, to: exitAt, events,
    assumption: 'Aktuelle Rate und tatsächlicher Takt bis zur maximalen Haltedauer konstant; Markpreis = Referenzeinstieg. Künftiges Funding unbekannt.' };
}

export function liveDivergence(base, direction, asOf, maxAge = 3) {
  const periodMs = BITGET_FRAMES[base?.source?.timeframe]?.periodMs;
  if (!periodMs || divergenceInDirection(base.pivots, base.rsiValues, direction, base.lastIndex, asOf, base.lastIndex + 1) !== true)
    return { status: 'keine bestätigte Divergenz', tone: 'muted', action: 'Neue passende Bestätigung abwarten.', explanation: 'Zwei geschlossene Nachbarkerzen bestätigen einen Pivot; ohne passende Preis-/RSI-Pivotpaare gibt es keine Zusatzpunkte.' };
  const pivots = base.pivots.filter(p => p.type === (direction === 1 ? 'low' : 'high') && p.knownAt <= asOf && p.confirmedIndex <= base.lastIndex).sort((a, b) => a.index - b.index);
  const [a, b] = pivots.slice(-2), confirmedAt = b.time + 3 * periodMs;
  return { ...divergenceInfo({ confirmedAt, asOf, periodMs, maxAge }), knownAt: b.knownAt,
    pivots: [a, b].map(p => ({ at: p.time, price: p.price, rsi: base.rsiValues[p.index] })) };
}

export function evaluateLive({ data, saved, quote = null, planningAt = data?.scope?.asOf, config = {}, options = {} }) {
  const p = settings(config), attached = attachBitgetPatterns(data, saved);
  if (!attached.data) return { status: 'nicht bewertbar', reason: attached.reason, cards: [], eligible: [] };
  const snapshot = attached.data, decisionAt = snapshot.scope.asOf;
  const scores = [1, -1].map(direction => scoreConfluence({ ...snapshot, direction }, p));
  const conflict = combineDirections(...scores).status === 'konflikt';
  const liveKey = JSON.stringify({ version: LIVE_VERSION, patternAdapter: PATTERN_ADAPTER_VERSION,
    core: parametersKey(p), fundingMode: options.fundingMode || null, anchorPolicy: options.anchorPolicy || null });
  const cards = scores.map((score, index) => {
    const direction = index === 0 ? 1 : -1;
    const anchor = setupAnchor(snapshot.base, direction, decisionAt, options.anchorPolicy);
    const quoteOK = quote?.venue === 'bitget' && quote.product === snapshot.scope.product && quote.instrument === snapshot.scope.instrument
      && time(quote.at) && quote.at >= decisionAt && time(quote.knownAt) && quote.knownAt >= quote.at && quote.knownAt - quote.at <= 30000
      && time(planningAt) && quote.knownAt <= planningAt && quote.knownAt - decisionAt <= 30000 && [quote.ask, quote.bid].every(positive) && quote.ask >= quote.bid;
    const reference = quoteOK ? (direction === 1 ? quote.ask : quote.bid) * (1 + direction * snapshot.scope.slippageBps / 1e4) : null;
    const levels = tradeLevels({ entry: reference, anchor: anchor?.price, atr: snapshot.base.atr, direction, tickSize: snapshot.contract?.tickSize }, p);
    const entryAt = quoteOK ? quote.knownAt : null, exitAt = entryAt === null ? null : entryAt + snapshot.scope.maxHoldMs;
    const funding = levels.status === 'bereit' ? fundingScenario({ current: snapshot.funding, entryAt, exitAt, entry: levels.entry, mode: options.fundingMode }) : null;
    const costs = costFilter({ levels, direction, entryAt, tpAt: exitAt, slAt: exitAt, fundingTP: funding, fundingSL: funding }, p);
    const decision = signalDecision({ signal: score, levels, costs, conflict }, p);
    const size = positionSize({ marginEUR: options.marginEUR, fx: options.fx?.value, leverage: options.leverage, entry: levels.entry });
    const id = JSON.stringify([liveKey, snapshot.scope.instrument, snapshot.scope.timeframe, snapshot.scope.contextTimeframe, snapshot.scope.horizon,
      snapshot.scope.maxHoldMs, snapshot.scope.slippageBps, snapshot.scope.indicatorAnchors, snapshot.base.closedAt, direction]);
    const reason = conflict ? 'Long und Short zugleich: warten.' : score.reason || (!anchor ? 'Passender Stop-Anker fehlt oder ist noch nicht gewählt.' : !quoteOK ? 'Frischer öffentlicher Referenzkurs nach Entscheidung fehlt.' : !funding ? 'Kostenszenario nicht gewählt oder nicht bewertbar.' : decision.reason);
    return { id, liveKey, version: LIVE_VERSION, scope: { ...snapshot.scope, direction }, config: { ...p }, options: { fundingMode: options.fundingMode || null, anchorPolicy: options.anchorPolicy || null,
      marginEUR: options.marginEUR ?? null, leverage: options.leverage ?? null, fx: options.fx || null }, decisionAt, entryAt, expiresAt: decisionAt + (snapshot.scope.horizon === 'short' ? 3600e3 : 86400e3),
      score, levels, costs, size, cross: crossStatus(), anchor, quote, funding, divergence: liveDivergence(snapshot.base, direction, decisionAt, p.divergenceMaxAge),
      patterns: snapshot.patterns || [], context: { base: snapshot.base, higher: snapshot.context }, eligible: decision.eligible,
      status: conflict ? 'konflikt' : score.blocked ? 'gesperrt' : score.status === 'nicht bewertbar' ? 'nicht bewertbar' : decision.eligible ? 'geprüftes Szenario' : score.status,
      contract: snapshot.contract, reason, statistics: { short: { status: 'noch nicht ausgewertet', requestedDays: 90 }, long: { status: 'noch nicht ausgewertet', requestedDays: 730 } } };
  });
  return { status: conflict ? 'konflikt' : attached.status, cards, eligible: cards.filter(c => c.eligible), data: snapshot };
}

export function cardState(card, asOf) {
  if (!card || !time(card.decisionAt) || !time(card.expiresAt) || !time(asOf) || card.decisionAt > asOf || card.expiresAt <= card.decisionAt) return { expired: true, tone: 'muted', label: 'nicht verfügbar', action: 'Neue Daten laden.' };
  if (asOf >= card.expiresAt) return { expired: true, tone: 'muted', label: 'abgelaufen', action: 'Neue Analyse abwarten. Eine echte Position bleibt unverändert.' };
  if (card.status === 'konflikt' || card.status === 'gesperrt') return { expired: false, tone: 'negative', label: card.status, action: 'Warten; keine eindeutige passende Trendrichtung.' };
  if (card.eligible) return { expired: false, tone: 'positive', label: 'geprüftes Szenario', action: 'Referenzkurs, Risiko und Kostenannahmen vor einem eigenen Einstieg prüfen.' };
  return { expired: false, tone: card.score?.score >= 50 ? 'warning' : 'muted', label: card.status, action: card.score?.score >= 50 ? 'Beobachten; noch kein vollständig geprüftes Signal.' : 'Abwarten; kein geprüftes Signal.' };
}
