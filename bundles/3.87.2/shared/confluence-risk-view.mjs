// 3.52.0: reine Größenhilfe/Ausführungsprüfung. Keine Originaländerung, Orders oder neue Scorefreigabe.
import { costFilter, executionExitPrice } from './confluence-core.mjs';
import { fundingScenario } from './confluence-live.mjs';
import { decimal, decimalText } from './bot-limits.mjs';
const positive = x => Number.isFinite(x) && x > 0;
const time = x => Number.isSafeInteger(x) && x >= 0;
const unavailable = reason => ({ status: 'nicht bewertbar', reason });
function plain(value) {
  if (!positive(value)) throw new Error('Positive Dezimalzahl fehlt');
  const [mantissa, exponent = '0'] = String(value).toLowerCase().split('e'), [whole, tail = ''] = mantissa.split('.'), digits = whole + tail, point = whole.length + Number(exponent);
  return point <= 0 ? '0.' + '0'.repeat(-point) + digits : point >= digits.length ? digits + '0'.repeat(point - digits.length) : digits.slice(0, point) + '.' + digits.slice(point);
}
export function floorQuantity(value, step) {
  try { const v = decimal(plain(value)), s = decimal(plain(step)), units = v.n * s.d / (v.d * s.n); return { quantity: Number(decimalText({ n: units * s.n, d: s.d })), units: String(units), text: decimalText({ n: units * s.n, d: s.d }) }; }
  catch { return null; }
}
export function originalRisk(card) {
  const q = card?.size?.quantity, fx = card?.size?.fx, net = card?.costs?.sl?.net;
  if (card?.size?.status !== 'bereit' || !positive(q) || !Number.isFinite(net) || net >= 0) return unavailable('Selbst gewählter Einsatz oder vollständige Stopkosten fehlen');
  const lossUSDT = -net * q;
  if (!positive(lossUSDT)) return unavailable('Stopverlust außerhalb des Zahlenbereichs');
  return { status: 'bereit', lossUSDT, lossEUR: positive(fx) ? lossUSDT / fx : null, quantity: q, marginEUR: card.size.marginEUR, notionalUSDT: card.size.notionalUSDT };
}
export function sizeForRisk({ budgetEUR = null, marginEUR = null, fx, leverage, entry, costs, contract }) {
  if (!positive(fx) || !positive(leverage) || !positive(entry) || !positive(contract?.quantityStep) || !positive(contract?.minQuantity) || !Number.isFinite(contract?.minNotional) || contract.minNotional < 0) return unavailable('FX, Hebel oder aktuelles Kontraktraster fehlt');
  const lossUnit = -costs?.sl?.net;
  if (!positive(lossUnit)) return unavailable('Vollständige Verlustkosten am Stop fehlen');
  if (budgetEUR !== null && !positive(budgetEUR)) return unavailable('Eigenes Verlustbudget muss positiv sein');
  if (budgetEUR === null && !positive(marginEUR)) return unavailable('Eigenen Einsatz oder Verlustbudget wählen');
  const raw = budgetEUR !== null ? budgetEUR * fx / lossUnit : marginEUR * fx * leverage / entry, rounded = floorQuantity(raw, contract.quantityStep);
  if (!rounded || !positive(rounded.quantity)) return unavailable('Menge nach Abrundung zu klein oder außerhalb des Zahlenbereichs');
  let quantity = rounded.quantity;
  // Keine optimistische Mengen-Toleranz am Budget: nach Rundung darf selbst Floatrechnung das Budget nicht überschreiten.
  if (budgetEUR !== null && quantity * lossUnit / fx > budgetEUR) { const s = decimal(plain(contract.quantityStep)), units = BigInt(rounded.units) - 1n; quantity = Number(decimalText({ n: units * s.n, d: s.d })); }
  const notionalUSDT = quantity * entry, lossUSDT = quantity * lossUnit, lossEUR = lossUSDT / fx;
  if (!positive(quantity) || !positive(notionalUSDT) || !positive(lossUSDT) || !Number.isFinite(lossEUR)) return unavailable('Positionsgröße außerhalb des Zahlenbereichs');
  if (quantity < contract.minQuantity || notionalUSDT < contract.minNotional) return { ...unavailable('Bitget-Mindestmenge oder Mindestwert nicht erreicht; Budget nicht automatisch erhöhen'), quantity, notionalUSDT, lossUSDT, lossEUR };
  return { status: 'bereit', basis: budgetEUR !== null ? 'Verlustbudget' : 'Margin', budgetEUR, quantity, notionalUSDT, marginEUR: notionalUSDT / leverage / fx, lossUSDT, lossEUR, fx, leverage };
}
export function executionPreview(card, { quote, contract, currentFunding, asOf, sizing = {} }) {
  if (card?.scope?.modelVersion !== 'cf-2' || card.levels?.status !== 'bereit') return unavailable('Aktueller cf-2-Preisplan fehlt; ältere Originale bleiben im Archiv');
  const d = card.scope.direction;
  if (![1, -1].includes(d) || !time(asOf) || quote?.venue !== 'bitget' || quote.product !== card.scope.product || quote.instrument !== card.scope.instrument
    || !time(quote.at) || !time(quote.knownAt) || quote.at > quote.knownAt || quote.knownAt > asOf || asOf - quote.at > 30000 || !positive(quote.bid) || !positive(quote.ask) || quote.ask < quote.bid) return unavailable('Frischer passender Bitget-Geld/Briefkurs fehlt');
  if (contract?.instrument !== card.scope.instrument || contract.venue !== 'bitget' || contract.product !== card.scope.product || !positive(contract.tickSize)) return unavailable('Passendes aktuelles Bitget-Kontraktraster fehlt');
  const entry = executionExitPrice(d === 1 ? quote.ask : quote.bid, -d, card.scope.slippageBps, contract.tickSize), risk = d * (entry - card.levels.sl), reward = d * (card.levels.tp - entry);
  const levels = { ...card.levels, entry, risk, rewardRisk: reward / risk, tickSize: contract.tickSize }, spreadBps = (quote.ask - quote.bid) / ((quote.ask + quote.bid) / 2) * 1e4;
  const distanceR = positive(card.levels.risk) ? d * (entry - card.levels.entry) / card.levels.risk : null;
  const base = { asOf, quote, contract, levels, spreadBps, distanceR, passed: false };
  if (!positive(entry) || !positive(risk) || !positive(reward)) return { ...base, status: 'gesperrt', reason: risk <= 0 ? 'Ursprünglicher Stop am aktuellen Einstieg bereits überschritten' : 'Ursprüngliches Ziel am aktuellen Einstieg bereits erreicht' };
  if (contract.tickSize !== card.levels.tickSize) return { ...base, status: 'gesperrt', reason: 'Tickraster geändert; neuen Originalplan prüfen' };
  const exitAt = asOf + card.scope.maxHoldMs, funding = fundingScenario({ current: currentFunding, entryAt: asOf, exitAt, entry, mode: card.options.fundingMode });
  const costs = costFilter({ levels, direction: d, entryAt: asOf, tpAt: exitAt, slAt: exitAt, fundingTP: funding, fundingSL: funding, slippageBps: card.scope.slippageBps }, card.config);
  const size = sizeForRisk({ ...sizing, entry, costs, contract });
  const passed = card.eligible && costs.passed && levels.rewardRisk >= card.config.rewardRisk && card.expiresAt > asOf && size.status === 'bereit';
  return { ...base, costs, funding, size, passed, status: passed ? 'Szenario geprüft' : 'nicht freigegeben',
    reason: !card.eligible ? 'Originalmodell hat keinen Kandidaten freigegeben; die Kursprüfung ersetzt den Score nicht' : card.expiresAt <= asOf ? 'Nachricht abgelaufen; neue Modellprüfung erforderlich' : levels.rewardRisk < card.config.rewardRisk ? 'Bruttoziel unterschreitet am aktuellen Einstieg die eigene R-Grenze' : !costs.passed ? 'Aktuelle Kostenprüfung nicht bestanden oder nicht bewertbar' : size.status !== 'bereit' ? size.reason : 'Aktuelle Kurs-/Kosten-/Mengenprüfung; Trend und Score nicht neu bestätigt, keine Orderfreigabe' };
}
