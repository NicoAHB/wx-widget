// G12: exakte Dezimalrechnung; keine privaten API-Aufrufe und keine alleinige Orderfreigabe.
export const BOT_LIMITS_VERSION = 'bot-limits-1';
const clone = x => JSON.parse(JSON.stringify(x));
function gcd(a, b) { a = a < 0n ? -a : a; while (b) [a, b] = [b, a % b]; return a || 1n; }
function fraction(n, d = 1n) { const g = gcd(n, d); return { n: n / g, d: d / g }; }
export function decimal(value) {
  if (typeof value !== 'string' || value.length > 64 || !/^-?(?:0|[1-9]\d{0,29})(?:\.\d{1,18})?$/.test(value)) throw new Error('Exakte Dezimalzeichenfolge fehlt');
  const [whole, tail = ''] = value.replace('-', '').split('.'); return fraction(BigInt(whole + tail) * (value.startsWith('-') ? -1n : 1n), 10n ** BigInt(tail.length));
}
const add = (a, b) => fraction(a.n * b.d + b.n * a.d, a.d * b.d), sub = (a, b) => add(a, { n: -b.n, d: b.d });
const mul = (a, b) => fraction(a.n * b.n, a.d * b.d), cmp = (a, b) => a.n * b.d < b.n * a.d ? -1 : a.n * b.d > b.n * a.d ? 1 : 0;
const zero = () => decimal('0'), positive = value => cmp(decimal(value), zero()) > 0;
export function decimalText(value, places = 18) {
  const f = typeof value === 'string' ? decimal(value) : value, negative = f.n < 0n, n = negative ? -f.n : f.n, scale = 10n ** BigInt(places), units = n * scale / f.d;
  const whole = units / scale, tail = String(units % scale).padStart(places, '0').replace(/0+$/, ''); return (negative && units ? '-' : '') + whole + (tail ? '.' + tail : '');
}
export const exactQuantityEqual = (a, b) => cmp(decimal(a), decimal(b)) === 0;
export function runNet(values) {
  const keys = ['realized', 'open', 'fees', 'rebates', 'funding', 'estimatedCloseFees'];
  if (!values || Object.keys(values).some(k => !keys.includes(k)) || keys.some(k => typeof values[k] !== 'string')) throw new Error('Vollständige Kosten-/Ergebniswerte fehlen');
  for (const k of ['fees', 'rebates', 'estimatedCloseFees']) if (cmp(decimal(values[k]), zero()) < 0) throw new Error('Gebühren/Rabatte ungültig');
  return sub(add(sub(add(decimal(values.realized), decimal(values.open)), decimal(values.fees)), decimal(values.rebates)), add(decimal(values.funding), decimal(values.estimatedCloseFees)));
}
export function botLimit(input = {}, name = 'loss') {
  const v = { enabled: false, amount: null, unit: 'USDT', action: 'entries', ...input };
  if (typeof v.enabled !== 'boolean' || !['USDT', 'EUR', '%'].includes(v.unit) || !['entries', 'close'].includes(v.action) || v.enabled && !positive(v.amount)) throw new Error(`${name === 'loss' ? 'Verlust' : 'Gewinn'}grenze selbst wählen und prüfen`);
  return v;
}
export function createBotLimits() { return { version: BOT_LIMITS_VERSION, revision: 0, enabled: false, mode: 'simulation', run: null, history: [], error: '', logs: [] }; }
export function startBotRun(previous, { runId, referenceUSDT, fx = null, gain = {}, loss = {}, mode = 'simulation', snapshot, inventory = null, restartReview = null }, now) {
  if (!previous?.enabled || !/^[A-Za-z0-9_-]{8,64}$/.test(runId || '') || !Number.isSafeInteger(now) || !positive(referenceUSDT)) throw new Error('Bot aktivieren und eigene Laufbasis ausdrücklich wählen');
  if (mode !== 'simulation') throw new Error('Demo/Echtgeld gesperrt: privater Bitget-Executor und geprüfte Kontomodus-/Risikoeinrichtung fehlen');
  if (previous.run?.id === runId || previous.history.some(r => r.id === runId)) throw new Error('Ein bewusster neuer Lauf braucht eine neue Lauf-ID');
  const profit = botLimit(gain, 'gain'), stopLoss = botLimit(loss, 'loss');
  if ([profit, stopLoss].some(l => l.enabled && l.unit === 'EUR') && (!fx || !positive(fx.value) || !Number.isSafeInteger(fx.at) || fx.at > now || now - fx.at > 15 * 60e3)) throw new Error('EUR-Grenze braucht gültigen, beim Start festgehaltenen EUR/USDT-Referenzkurs');
  if (!snapshot || snapshot.completeNet !== true || snapshot.currency !== 'USDT' || snapshot.runId !== runId || !Number.isSafeInteger(snapshot.at) || snapshot.at > now || now - snapshot.at > 10000 || !Number.isSafeInteger(snapshot.sequence) || snapshot.sequence < 0) throw new Error('Gültiger vollständiger Bot-Start-Snapshot fehlt');
  if (previous.run && ['RECONCILING', 'PAUSED_RECONCILIATION_REQUIRED'].includes(previous.run.state)) {
    if (!restartReview?.historyReviewed || !restartReview.protectionReviewed || !restartReview.positionReviewed || !inventory?.complete || !Number.isSafeInteger(inventory.at) || inventory.at > now || now - inventory.at > 10000
      || !Array.isArray(inventory.positions) || inventory.positions.some(p => !exactQuantityEqual(p.totalQuantity, '0'))) throw new Error('Bewusster Wiederanlauf braucht geprüften Nullbestand, Historie und Schutzorders');
  }
  const baseline = runNet(snapshot.values), next = clone(previous);
  if (previous.run) { if (next.history.length >= 100) throw new Error('Bot-Laufarchiv voll; sichern und bewusst löschen'); next.history.push(clone(previous.run)); }
  next.mode = mode; next.run = { id: runId, startedAt: now, referenceUSDT, fx: fx ? clone(fx) : null, gain: profit, loss: stopLoss, baseline: decimalText(baseline), baselineValues: clone(snapshot.values),
    state: 'RUNNING', stops: {}, latest: clone(snapshot), netUSDT: '0', dataPaused: false, reconciliation: null, inventory: {}, simulatedClosePending: false, automaticTrading: false };
  next.error = ''; return next;
}
function threshold(limit, run) { return limit.unit === 'EUR' ? mul(decimal(limit.amount), decimal(run.fx.value)) : limit.unit === '%' ? mul(decimal(limit.amount), fraction(decimal(run.referenceUSDT).n, decimal(run.referenceUSDT).d * 100n)) : decimal(limit.amount); }
export function evaluateBotSnapshot(previous, snapshot, now) {
  const next = clone(previous), r = next.run; if (!r) throw new Error('Noch kein gestarteter Bot-Lauf');
  if (snapshot?.runId !== r.id || snapshot.currency !== 'USDT' || snapshot.completeNet !== true || !Number.isSafeInteger(snapshot.at) || snapshot.at > now || now - snapshot.at > 10000 || !Number.isSafeInteger(snapshot.sequence)) {
    r.dataPaused = true; next.error = 'Kosten-/Kontodaten unvollständig oder veraltet: neue Einstiege pausiert, bekannte Schutzmaßnahmen bleiben.'; return next;
  }
  if (snapshot.sequence < r.latest.sequence) return next;
  if (snapshot.sequence === r.latest.sequence) { if (JSON.stringify(snapshot) !== JSON.stringify(r.latest)) { r.dataPaused = true; next.error = 'Widersprüchlicher Bot-Snapshot; neue Einstiege pausiert.'; } return next; }
  let net; try { net = sub(runNet(snapshot.values), runNet(r.baselineValues)); } catch (e) { r.dataPaused = true; next.error = e.message; return next; }
  r.latest = clone(snapshot); r.netUSDT = decimalText(net); r.dataPaused = false; next.error = '';
  for (const [name, limit] of [['gain', r.gain], ['loss', r.loss]]) if (limit.enabled && !r.stops[name] && (name === 'gain' ? cmp(net, threshold(limit, r)) >= 0 : cmp(net, { ...threshold(limit, r), n: -threshold(limit, r).n }) <= 0)) {
    r.stops[name] = { at: now, netUSDT: r.netUSDT, limit: clone(limit) };
  }
  if (Object.keys(r.stops).length && !['RECONCILING', 'PAUSED_RECONCILIATION_REQUIRED'].includes(r.state)) r.state = 'STOPPED_LIMIT';
  r.simulatedClosePending = Object.values(r.stops).some(x => x.limit.action === 'close') && !r.simulatedCloseAt;
  return next;
}
// Vor jedem gedachten Versand: gesamte Position, identischer Kontext, bestätigte eigene Fills.
export function reconcileBotInventory(previous, snapshot, now) {
  const next = advanceBotClock(previous, now), r = next.run; if (!r) throw new Error('Kein Lauf für Bestandsprüfung');
  if (r.state === 'PAUSED_RECONCILIATION_REQUIRED') return next;
  const complete = snapshot && snapshot.complete === true && Number.isSafeInteger(snapshot.at) && snapshot.at <= now && now - snapshot.at <= 10000 && snapshot.positionRevision === snapshot.fillRevision && Number.isSafeInteger(snapshot.positionAt) && snapshot.positionAt <= now && now - snapshot.positionAt <= 10000;
  let mismatch = !complete, expected = {}, actual = {}, foreign = snapshot?.foreignIntervention === true;
  if (complete) {
    try {
      if (!Array.isArray(snapshot.positions) || !Array.isArray(snapshot.fills) || !snapshot.context || !['simulation', 'bitget-demo', 'bitget-live'].includes(snapshot.context.venue)
        || !['one-way', 'hedge'].includes(snapshot.context.mode) || !['cross', 'isolated'].includes(snapshot.context.marginMode) || !snapshot.context.account || snapshot.context.product !== 'USDT-FUTURES' || snapshot.context.quantityUnit !== 'contracts') throw new Error('Bestandskontext fehlt');
      if (r.inventory.context && ['venue', 'account', 'product', 'mode', 'marginMode', 'quantityUnit'].some(k => r.inventory.context[k] !== snapshot.context[k])) foreign = true;
      const ids = new Set(); for (const f of snapshot.fills) { if (f.owner && f.owner !== r.id) foreign = true; if (!f.id || ids.has(f.id) || f.confirmed !== true || f.owner !== r.id || !Number.isSafeInteger(f.at) || f.at > snapshot.positionAt || !/^[A-Z0-9]{2,20}USDT$/.test(f.instrument || '') || !['long', 'short'].includes(f.leg) || !['buy', 'sell'].includes(f.side)) throw new Error('Fill-Ledger nicht vollständig/eindeutig'); ids.add(f.id);
        const key = f.instrument + '|' + (snapshot.context.mode === 'one-way' ? 'net' : f.leg), amount = decimal(f.quantity); if (cmp(amount, zero()) < 0) throw new Error('Fillmenge ungültig'); expected[key] = add(expected[key] ?? zero(), { n: amount.n * (f.side === 'buy' ? 1n : -1n) * (snapshot.context.mode === 'hedge' && f.leg === 'short' ? -1n : 1n), d: amount.d }); }
      for (const p of snapshot.positions) { const key = p.instrument + '|' + (snapshot.context.mode === 'one-way' ? 'net' : p.leg); if (Object.hasOwn(actual, key) || !/^[A-Z0-9]{2,20}USDT$/.test(p.instrument || '') || !['long', 'short'].includes(p.leg)) throw new Error('Gesamtposition nicht eindeutig');
        const quantity = decimal(p.totalQuantity); if (cmp(quantity, zero()) < 0) throw new Error('Gesamtmenge muss nichtnegativ sein'); actual[key] = snapshot.context.mode === 'one-way' && p.leg === 'short' ? { n: -quantity.n, d: quantity.d } : quantity; // verfügbares Volumen ist ausdrücklich kein Bestandsbeweis
      }
      mismatch = foreign || [...new Set([...Object.keys(expected), ...Object.keys(actual)])].some(k => cmp(expected[k] ?? zero(), actual[k] ?? zero()) !== 0);
      r.inventory = { context: clone(snapshot.context), expected: Object.fromEntries(Object.entries(expected).map(([k, v]) => [k, decimalText(v)])), actual: Object.fromEntries(Object.entries(actual).map(([k, v]) => [k, decimalText(v)])), at: snapshot.at, fillRevision: snapshot.fillRevision, positionRevision: snapshot.positionRevision };
    } catch { mismatch = true; }
  }
  if (mismatch) {
    if (!r.reconciliation) r.reconciliation = { since: now, deadline: now + 10000, foreign, reason: complete ? 'Bestand/Modus weicht ab' : 'Vollständiger Positions-/Fillabgleich fehlt' };
    r.reconciliation.foreign ||= foreign; r.state = now >= r.reconciliation.deadline ? 'PAUSED_RECONCILIATION_REQUIRED' : 'RECONCILING';
  } else if (r.reconciliation && !r.reconciliation.foreign && now < r.reconciliation.deadline) { r.reconciliation = null; r.state = Object.keys(r.stops).length ? 'STOPPED_LIMIT' : 'RUNNING'; }
  else if (r.reconciliation) r.state = 'PAUSED_RECONCILIATION_REQUIRED';
  return next;
}
export function advanceBotClock(previous, now) {
  const next = clone(previous), r = next.run;
  if (r?.state === 'RECONCILING' && r.reconciliation && now >= r.reconciliation.deadline) r.state = 'PAUSED_RECONCILIATION_REQUIRED';
  return next;
}
export function botActionState(state) {
  const r = state?.run, conflict = !r || ['RECONCILING', 'PAUSED_RECONCILIATION_REQUIRED'].includes(r.state);
  return { entries: !!state?.enabled && !!r && r.state === 'RUNNING' && !r.dataPaused && !Object.keys(r.stops).length,
    newCloses: !!r && !conflict && !r.dataPaused && Object.values(r.stops).some(x => x.limit.action === 'close'),
    keepExistingProtection: true, cancelOwnedEntries: !!r && (conflict || Object.keys(r.stops).length > 0), privateOrders: false,
    label: r?.state === 'RECONCILING' ? 'Bestandsprüfung – neue Orders gesperrt' : r?.state === 'PAUSED_RECONCILIATION_REQUIRED' ? 'Bestand weicht ab – Bot pausiert' : Object.keys(r?.stops ?? {}).length ? 'Laufgrenze dauerhaft verriegelt' : r?.dataPaused ? 'Daten fehlen – neue Einstiege pausiert' : 'Simulation; privater Executor nicht verfügbar' };
}
export function simulateBotClose(previous, now) {
  if (!botActionState(previous).newCloses || !previous.run?.simulatedClosePending) throw new Error('Neue Schließungen gesperrt; bekannte Börsenschutzorders bleiben bestehen');
  const next = clone(previous), r = next.run, v = r.latest.values;
  const values = { ...v, realized: decimalText(add(decimal(v.realized), decimal(v.open))), open: '0', fees: decimalText(add(decimal(v.fees), decimal(v.estimatedCloseFees))), estimatedCloseFees: '0' };
  r.latest = { ...r.latest, sequence: r.latest.sequence + 1, at: now, values }; r.netUSDT = decimalText(sub(runNet(values), runNet(r.baselineValues))); r.simulatedCloseAt = now; r.simulatedClosePending = false;
  return next;
}
