// 3.52.0: Anzeigezustand getrennt vom unveränderten Originalsignal. Keine neue Berechnung/Order.
import { cardState, LIVE_VERSION } from './confluence-live.mjs';
import { MODEL_VERSION, signalDecision } from './confluence-core.mjs';
import { BITGET_FRAMES } from './bitget-public.mjs';
export const QUOTE_MAX_AGE_MS = 30000;
const time = x => Number.isSafeInteger(x) && x >= 0;
function freshQuote(card, asOf) {
  const q = card?.quote;
  const framesCurrent = [[card.context?.base, card.scope.timeframe], [card.context?.higher, card.scope.contextTimeframe]].every(([frame, tf]) =>
    time(frame?.closedAt) && frame.closedAt <= asOf && asOf - frame.closedAt < (BITGET_FRAMES[tf]?.periodMs || 0));
  return q?.venue === 'bitget' && q.product === card.scope.product && q.instrument === card.scope.instrument
    && framesCurrent && time(q.at) && time(q.knownAt) && q.at >= card.decisionAt && q.at <= q.knownAt && q.knownAt <= asOf && asOf - q.at <= QUOTE_MAX_AGE_MS;
}
export function currentSignal(cards, { asOf, enabled, isCurrentModel, checks = new Map() }) {
  if (!enabled || !time(asOf)) return null;
  return [...cards].filter(c => {
    const check = checks.get(c.scope.instrument + '|' + c.scope.horizon);
    return !check?.pending && !check?.error && c.version === LIVE_VERSION && c.scope.modelVersion === MODEL_VERSION && isCurrentModel(c)
      && c.eligible && c.status !== 'konflikt' && signalDecision({ signal: c.score, levels: c.levels, costs: c.costs }, c.config).eligible
      && !cardState(c, asOf).expired && freshQuote(c, asOf);
  }).sort((a, b) => b.decisionAt - a.decisionAt || b.entryAt - a.entryAt)[0] || null;
}
export function presentCard(card, { asOf, currentModel, enabled, check = null, current = [] }) {
  const original = cardState(card, asOf);
  if (!currentModel) return { ...original, tone: 'muted', label: 'früheres Modell' + (original.expired ? ' · abgelaufen' : ''),
    action: 'Originalplan und Score bleiben dokumentiert. Für einen neuen Einstieg das aktuelle Modell prüfen.' };
  if (original.expired) return original;
  if (!enabled) return { ...original, tone: 'muted', label: 'Analyse pausiert', action: 'Gespeicherter Referenzplan. Analyse starten und frischen Bitget-Kurs prüfen.' };
  if (check?.pending) return { ...original, tone: 'muted', label: 'wird erneut geprüft', action: 'Die neue Datenprüfung abwarten. Der Originalplan bleibt erhalten.' };
  if (check?.error) return { ...original, tone: 'warning', label: 'aktuelle Daten fehlen', action: check.error + ' Erneut prüfen; der Originalplan ist keine aktuelle Einstiegsbestätigung.' };
  if (!card.eligible) return original;
  const latest = current.filter(c => c.scope.direction === card.scope.direction && c.decisionAt >= card.decisionAt && currentModelFor(c, card)).sort((a, b) => b.decisionAt - a.decisionAt || b.entryAt - a.entryAt)[0];
  if (!latest || !freshQuote(latest, asOf)) return { ...original, tone: 'warning', label: 'Referenzkurs erneut prüfen', action: 'Frischer Bitget-Kurs fehlt. Vor einem Einstieg Kurs, Stop, Ziel und Kosten erneut prüfen.' };
  if (!latest.eligible) return { ...original, tone: 'warning', label: 'aktuell nicht bestätigt', action: latest.reason || 'Die aktuelle Prüfung gibt keinen Kandidaten frei. Abwarten.' };
  if (latest.id !== card.id || !['entry', 'sl', 'tp'].every(k => latest.levels[k] === card.levels[k]) || latest.costs.netRR !== card.costs.netRR)
    return { ...original, tone: 'warning', label: 'älterer Referenzplan', action: 'Eine neue Bewertung liegt vor. Vor einem Einstieg deren Kurs und Kosten prüfen; dieses Original wird nicht überschrieben.' };
  return original;
}
function currentModelFor(a, b) {
  return a.score?.parametersKey === b.score?.parametersKey && a.scope.instrument === b.scope.instrument && a.scope.horizon === b.scope.horizon
    && a.scope.timeframe === b.scope.timeframe && a.scope.contextTimeframe === b.scope.contextTimeframe && a.scope.slippageBps === b.scope.slippageBps
    && a.scope.maxHoldMs === b.scope.maxHoldMs && a.options.fundingMode === b.options.fundingMode && a.options.anchorPolicy === b.options.anchorPolicy;
}
