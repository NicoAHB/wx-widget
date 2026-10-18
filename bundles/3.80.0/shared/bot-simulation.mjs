// G12: serialisierte, haltbare Simulation. Kein Bitget-Orderadapter, kein Wechsel nach Demo/Echtgeld.
import { BOT_LIMITS_VERSION, createBotLimits, startBotRun, evaluateBotSnapshot, reconcileBotInventory, simulateBotClose, advanceBotClock, botActionState, decimal, decimalText, botLimit, runNet } from './bot-limits.mjs';
// 3.57.0: persistenter Long-Grid-Modellplan; private Ausführung bleibt gesperrt.
import { AdaptiveAIGridStrategy, GRID_MODEL_VERSION, gridSettings } from './adaptive-grid.mjs';
const clone = x => JSON.parse(JSON.stringify(x));
export function botSettings(input) {
  if (!input || !['confluence', 'po3', 'adaptive-grid'].includes(input.strategy) || !Array.isArray(input.coins) || !input.coins.length || input.coins.length > 40 || new Set(input.coins).size !== input.coins.length
    || input.coins.some(x => !/^[A-Z0-9]{2,20}USDT$/.test(x)) || !['both', 'long', 'short'].includes(input.direction) || !Number.isFinite(input.minimumScore) || input.minimumScore < 70 || input.minimumScore > 100
    || !Number.isInteger(input.leverage) || input.leverage < 1 || input.leverage > 125 || !Number.isInteger(input.maxPositions) || input.maxPositions < 1 || input.maxPositions > 40
    || !Number.isSafeInteger(input.cooldownMs) || input.cooldownMs < 0 || !['signal', 'own'].includes(input.stopRule) || !['tp1', 'signal'].includes(input.tpRule)) throw new Error('Strategie/Coins/Richtung/Score/Hebel/Positionsregeln prüfen');
  for (const key of ['exposureUSDT', 'riskPercent']) { const v = decimal(input[key]); if (v.n <= 0n || key === 'riskPercent' && v.n > 100n * v.d) throw new Error('Exposition und Risiko selbst positiv wählen'); }
  if (input.strategy === 'adaptive-grid') { gridSettings(input.grid); if (input.coins.length !== 1 || input.direction !== 'long' || input.maxPositions !== 1) throw new Error('Adaptive AI-Grid verwendet genau einen Coin und ausschließlich einen Long-Modellbestand'); }
  return clone(input);
}
export class BotSimulationRuntime {
  constructor({ saved = null, now = Date.now, persist = async () => false, notify = () => {} } = {}) {
    this.now = now; this.persist = persist; this.notify = notify; this.queue = Promise.resolve(); this.timer = null; this.stopped = false;
    this.state = saved ? clone(saved) : { ...createBotLimits(), commands: [], settings: null };
    if (this.state.version !== BOT_LIMITS_VERSION || !Number.isSafeInteger(this.state.revision) || !Array.isArray(this.state.commands) || !Array.isArray(this.state.logs) || !Array.isArray(this.state.history)) throw new Error('Unbekannter Bot-Simulationszustand; Original erhalten');
    if (typeof this.state.enabled !== 'boolean' || this.state.mode !== 'simulation') throw new Error('Nur bestätigte Simulationszustände wiederherstellen');
    if (this.state.commands.length > 500 || this.state.logs.length > 500 || this.state.history.length > 100 || new TextEncoder().encode(JSON.stringify(this.state)).length > 5 * 1024 * 1024) throw new Error('Bot-Simulationszustand überschreitet Speichergrenze');
    for (const r of [...this.state.history, ...(this.state.run ? [this.state.run] : [])]) {
      if (!['RUNNING', 'STOPPED_LIMIT', 'RECONCILING', 'PAUSED_RECONCILIATION_REQUIRED'].includes(r.state) || !r.latest || !r.stops || r.latest.runId !== r.id || decimal(r.referenceUSDT).n <= 0n || r.automaticTrading !== false
        || r.latest.completeNet !== true || r.latest.currency !== 'USDT' || !Number.isSafeInteger(r.latest.sequence) || !Number.isSafeInteger(r.startedAt)) throw new Error('Bot-Lauf beschädigt; Original prüfen');
      botLimit(r.gain, 'gain'); botLimit(r.loss, 'loss'); runNet(r.baselineValues); runNet(r.latest.values); decimal(r.netUSDT);
      if ([r.gain, r.loss].some(x => x.enabled && x.unit === 'EUR') && (!r.fx || decimal(r.fx.value).n <= 0n)) throw new Error('Gesicherter Start-FX fehlt');
      if (['RECONCILING', 'PAUSED_RECONCILIATION_REQUIRED'].includes(r.state) && !Number.isSafeInteger(r.reconciliation?.deadline)) throw new Error('Bestandsstörungszeit fehlt');
      if (Object.keys(r.stops).some(k => !['gain', 'loss'].includes(k))) throw new Error('Gesicherte Grenzsperre unbekannt');
      for (const stop of Object.values(r.stops)) { botLimit(stop.limit); decimal(stop.netUSDT); if (!Number.isSafeInteger(stop.at)) throw new Error('Gesicherte Grenzsperre beschädigt'); }
    }
    for (const r of [...this.state.history, ...(this.state.run ? [this.state.run] : [])]) if (r.grid) {
      const grid = r.grid; if (grid.modelVersion !== GRID_MODEL_VERSION || grid.scope?.runId !== r.id) throw new Error('Grid-Originalformat prüfen');
      const strategy = new AdaptiveAIGridStrategy({ scope: grid.scope, config: grid.config, saved: grid.state }); strategy.inventory(grid.inventory);
      const p = grid.plan, m = grid.market;
      if ((p === null) !== (m === null)) throw new Error('Gesicherte Grid-Prüfung unvollständig; Original erhalten');
      if (p !== null) {
        if (!m || m.kind !== 'public-grid-model-input' || m.privateOrders !== false || !Number.isSafeInteger(m.asOf) || !m.range || !p.range || m.modelVersion !== GRID_MODEL_VERSION || ['venue', 'product', 'instrument', 'quote', 'runId'].some(k => m.scope?.[k] !== grid.scope[k]) || p.modelVersion !== GRID_MODEL_VERSION || p.privateOrders !== false || p.simulationOnly !== true || p.keepExistingProtection !== true || !['grid', 'pause', 'close', 'trend'].includes(p.action) || JSON.stringify(p.state) !== JSON.stringify(grid.state) || !Array.isArray(p.orders) || p.orders.length > 60 || !Array.isArray(p.contingent) || p.contingent.length > 30) throw new Error('Gesicherte Grid-Pläne beschädigt; Original erhalten');
        for (const o of p.orders) if (typeof o.intentId !== 'string' || !o.intentId.startsWith('grid|' + r.id + '|' + grid.scope.instrument + '|') || !['buy', 'sell'].includes(o.side) || o.type !== 'limit' || o.status !== 'planned' || o.reduceOnly !== (o.side === 'sell') || decimal(o.price).n <= 0n || decimal(o.quantity).n <= 0n) throw new Error('Gesicherter Grid-Limitplan ungültig');
        for (const o of p.contingent) if (o.side !== 'sell' || o.reduceOnly !== true || o.status !== 'conditional-after-confirmed-fill' || decimal(o.price).n <= 0n || decimal(o.maximumQuantity).n <= 0n || !p.orders.some(b => b.side === 'buy' && b.intentId === o.afterFillOf && b.quantity === o.maximumQuantity)) throw new Error('Gesichertes Grid-Ziel ohne passenden Kaufplan');
        if (new Set(p.orders.map(o => o.intentId)).size !== p.orders.length) throw new Error('Doppelte gesicherte Grid-Absicht');
        new AdaptiveAIGridStrategy({ scope: grid.scope, config: grid.config, saved: { ...grid.state, range: p.range } });
        new AdaptiveAIGridStrategy({ scope: grid.scope, config: grid.config, saved: { ...grid.state, range: m.range } });
      }
    }
    if (this.state.run?.state === 'RECONCILING') this.state.run.reconciliation.restartPending = true;
    this.schedule();
  }
  view() { const state = advanceBotClock(this.state, this.now()); return { ...clone(state), actions: botActionState(state), simulationOnly: true, privateAdapterReady: false, gridModelVersion: GRID_MODEL_VERSION, supportedStrategies: ['confluence', 'po3', 'adaptive-grid'] }; }
  schedule() { clearTimeout(this.timer); this.timer = null; const r = this.state.run; if (!this.stopped && r?.state === 'RECONCILING') this.timer = setTimeout(() => { void this.clock().catch(() => {}); }, Math.max(0, Math.min(10000, r.reconciliation.deadline - this.now()))); }
  async clock() {
    const task = this.queue.then(async () => { const next = advanceBotClock(this.state, this.now()); if (next.run?.state !== this.state.run?.state) { next.revision++; if (!await this.persist(next)) throw new Error('Bestandsstörung nicht dauerhaft gespeichert'); this.state = next; this.notify(this.view()); } this.schedule(); return this.view(); }); this.queue = task.catch(() => {}); return task;
  }
  async command(command) {
    const task = this.queue.then(async () => {
      if (this.stopped) throw new Error('Bot-Simulation gestoppt; Originalzustand prüfen');
      const cmd = clone(command);
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(cmd?.commandId || '') || !Number.isSafeInteger(cmd.expectedRevision) || !['enable', 'start', 'snapshot', 'inventory', 'close', 'pause', 'grid'].includes(cmd.type)) throw new Error('Simulationsauftrag ungültig');
      if (JSON.stringify(cmd).length > 64 * 1024 || /"(?:apiKey|secret|passphrase|token)"\s*:/i.test(JSON.stringify(cmd))) throw new Error('Nur öffentliche Simulationsdaten, keine Zugangsdaten');
      const prior = this.state.commands.find(x => x.id === cmd.commandId), identity = JSON.stringify([cmd.type, cmd.parameters ?? {}]);
      if (prior) { if (prior.identity !== identity) throw new Error('Auftrags-ID bereits mit anderem Inhalt verwendet'); return { ...this.view(), repeat: true, commandId: cmd.commandId }; }
      if (cmd.expectedRevision !== this.state.revision) throw Object.assign(new Error('Bot-Revision geändert; bestätigten Stand neu lesen'), { status: 409 });
      if (this.state.commands.length >= 500 || this.state.logs.length >= 500) throw new Error('Bot-Simulationsprotokoll voll; sichern und bewusst löschen. Keine neuen Modellaufträge.');
      let next = advanceBotClock(this.state, this.now()); const p = cmd.parameters ?? {}, at = this.now();
      if (cmd.type === 'enable') { if (typeof p.enabled !== 'boolean') throw new Error('Aktivierung ausdrücklich wählen'); next.enabled = p.enabled; }
      if (cmd.type === 'start') {
        const previousGrid = next.run?.grid?.inventory; if (previousGrid && (decimal(previousGrid.quantity).n > 0n || decimal(previousGrid.reservedBuyNotional).n > 0n || decimal(previousGrid.reservedSellQuantity).n > 0n || previousGrid.openOrders > 0)) throw new Error('Vor neuem Lauf eigenen Grid-Bestand und offene Orders zuerst vollständig abgleichen');
        next.settings = botSettings(p.settings); next = startBotRun(next, p, at);
        if (next.settings.strategy === 'adaptive-grid') { const scope = { venue: 'bitget', product: 'USDT-FUTURES', instrument: next.settings.coins[0], quote: 'USDT', runId: next.run.id }, config = gridSettings(next.settings.grid), strategy = new AdaptiveAIGridStrategy({ scope, config });
          next.run.grid = { modelVersion: GRID_MODEL_VERSION, scope, config, state: strategy.snapshot(), market: null, plan: null, inventory: { confirmed: true, owner: next.run.id, instrument: scope.instrument, product: scope.product, leg: 'long', quantity: '0', averageEntry: '0', reservedSellQuantity: '0', reservedBuyNotional: '0', reservedBuyRiskUSDT: '0', openOrders: 0, source: 'ausdrücklich leerer Long-Modelllauf, keine Börsenfills' } }; }
      }
      if (cmd.type === 'grid') {
        const r = next.run, m = p.market;
        if (!r?.grid || next.settings?.strategy !== 'adaptive-grid' || !m || m.kind !== 'public-grid-model-input' || m.modelVersion !== GRID_MODEL_VERSION || ['venue', 'product', 'instrument', 'quote', 'runId'].some(k => m.scope?.[k] !== r.grid.scope[k]) || m.privateOrders !== false || !Number.isSafeInteger(m.asOf) || m.asOf > at || at - m.asOf > 30000 || m.coverage?.from !== m.range?.historyFrom || m.coverage?.to !== m.range?.closedAt || m.coverage?.loadedTo !== m.coverage?.to || m.coverage?.candles !== 1344 || !Number.isInteger(m.coverage?.pages) || m.coverage.pages < 1 || m.coverage.pages > 8) throw new Error('Passende frische öffentliche Grid-Modellprüfung fehlt');
        const conflict = ['RECONCILING', 'PAUSED_RECONCILIATION_REQUIRED'].includes(r.state), actions = botActionState(next), grid = r.grid;
        const strategy = new AdaptiveAIGridStrategy({ scope: grid.scope, config: grid.config, saved: grid.state });
        const reference = decimal(r.referenceUSDT), risk = decimal(next.settings.riskPercent), riskUSDT = decimalText({ n: reference.n * risk.n, d: reference.d * risk.d * 100n });
        const result = strategy.place_grid_orders({ candidate: m.range, quote: m.quote, contract: m.contract, liveVolume: m.liveVolume ?? null, inventory: grid.inventory, asOf: at, leverage: next.settings.leverage, exposureUSDT: next.settings.exposureUSDT, riskUSDT,
          guard: { entries: actions.entries, closes: next.enabled && !conflict && !r.dataPaused, conflict, paused: !next.enabled, limitClose: Object.values(r.stops).some(x => x.limit.action === 'close') && !r.simulatedCloseAt } });
        grid.state = result.state; grid.market = clone(m); grid.plan = result;
      }
      if (cmd.type === 'snapshot') next = evaluateBotSnapshot(next, p.snapshot, at);
      if (cmd.type === 'inventory') next = reconcileBotInventory(next, p.snapshot, at);
      if (cmd.type === 'close') next = simulateBotClose(next, at);
      if (cmd.type === 'pause') next.enabled = false;
      next.revision++; next.commands.push({ id: cmd.commandId, identity, at, revision: next.revision }); next.logs.push({ id: cmd.commandId, type: cmd.type, at, revision: next.revision, runId: next.run?.id ?? null, state: next.run?.state ?? null });
      if (new TextEncoder().encode(JSON.stringify(next)).length > 5 * 1024 * 1024) throw new Error('Bot-Simulationsspeicher voll (5 MiB); Originale sichern');
      if (!await this.persist(next)) throw new Error('Simulationsauftrag nicht dauerhaft gespeichert; bisheriger bestätigter Stand bleibt');
      this.state = next; this.schedule(); this.notify(this.view()); return { ...this.view(), commandId: cmd.commandId };
    }); this.queue = task.catch(() => {}); return task;
  }
  stop() { this.stopped = true; clearTimeout(this.timer); this.timer = null; }
}
