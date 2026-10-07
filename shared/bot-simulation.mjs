// G12: serialisierte, haltbare Simulation. Kein Bitget-Orderadapter, kein Wechsel nach Demo/Echtgeld.
import { BOT_LIMITS_VERSION, createBotLimits, startBotRun, evaluateBotSnapshot, reconcileBotInventory, simulateBotClose, advanceBotClock, botActionState, decimal } from './bot-limits.mjs';
const clone = x => JSON.parse(JSON.stringify(x));
export function botSettings(input) {
  if (!input || !['confluence', 'po3'].includes(input.strategy) || !Array.isArray(input.coins) || !input.coins.length || input.coins.length > 40 || new Set(input.coins).size !== input.coins.length
    || input.coins.some(x => !/^[A-Z0-9]{2,20}USDT$/.test(x)) || !['both', 'long', 'short'].includes(input.direction) || !Number.isFinite(input.minimumScore) || input.minimumScore < 70 || input.minimumScore > 100
    || !Number.isInteger(input.leverage) || input.leverage < 1 || input.leverage > 125 || !Number.isInteger(input.maxPositions) || input.maxPositions < 1 || input.maxPositions > 40
    || !Number.isSafeInteger(input.cooldownMs) || input.cooldownMs < 0 || !['signal', 'own'].includes(input.stopRule) || !['tp1', 'signal'].includes(input.tpRule)) throw new Error('Strategie/Coins/Richtung/Score/Hebel/Positionsregeln prüfen');
  for (const key of ['exposureUSDT', 'riskPercent']) { const v = decimal(input[key]); if (v.n <= 0n || key === 'riskPercent' && v.n > 100n * v.d) throw new Error('Exposition und Risiko selbst positiv wählen'); }
  return clone(input);
}
export class BotSimulationRuntime {
  constructor({ saved = null, now = Date.now, persist = async () => false, notify = () => {} } = {}) {
    this.now = now; this.persist = persist; this.notify = notify; this.queue = Promise.resolve(); this.timer = null; this.stopped = false;
    this.state = saved ? clone(saved) : { ...createBotLimits(), commands: [], settings: null };
    if (this.state.version !== BOT_LIMITS_VERSION || !Number.isSafeInteger(this.state.revision) || !Array.isArray(this.state.commands) || !Array.isArray(this.state.logs) || !Array.isArray(this.state.history)) throw new Error('Unbekannter Bot-Simulationszustand; Original erhalten');
    if (typeof this.state.enabled !== 'boolean' || this.state.mode !== 'simulation') throw new Error('Nur bestätigte Simulationszustände wiederherstellen');
    if (this.state.run) { const r = this.state.run; if (!['RUNNING', 'STOPPED_LIMIT', 'RECONCILING', 'PAUSED_RECONCILIATION_REQUIRED'].includes(r.state) || !r.latest || !r.stops || r.latest.runId !== r.id || decimal(r.referenceUSDT).n <= 0n) throw new Error('Bot-Lauf beschädigt; Original prüfen'); }
    if (this.state.run?.state === 'RECONCILING') this.state.run.reconciliation.restartPending = true;
    this.schedule();
  }
  view() { const state = advanceBotClock(this.state, this.now()); return { ...clone(state), actions: botActionState(state), simulationOnly: true, privateAdapterReady: false }; }
  schedule() { clearTimeout(this.timer); this.timer = null; const r = this.state.run; if (!this.stopped && r?.state === 'RECONCILING') this.timer = setTimeout(() => { void this.clock().catch(() => {}); }, Math.max(0, Math.min(10000, r.reconciliation.deadline - this.now()))); }
  async clock() {
    const task = this.queue.then(async () => { const next = advanceBotClock(this.state, this.now()); if (next.run?.state !== this.state.run?.state) { next.revision++; if (!await this.persist(next)) throw new Error('Bestandsstörung nicht dauerhaft gespeichert'); this.state = next; this.notify(this.view()); } this.schedule(); return this.view(); }); this.queue = task.catch(() => {}); return task;
  }
  async command(command) {
    const task = this.queue.then(async () => {
      if (this.stopped) throw new Error('Bot-Simulation gestoppt; Originalzustand prüfen');
      const cmd = clone(command);
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(cmd?.commandId || '') || !Number.isSafeInteger(cmd.expectedRevision) || !['enable', 'start', 'snapshot', 'inventory', 'close', 'pause'].includes(cmd.type)) throw new Error('Simulationsauftrag ungültig');
      if (JSON.stringify(cmd).length > 64 * 1024 || /"(?:apiKey|secret|passphrase|token)"\s*:/i.test(JSON.stringify(cmd))) throw new Error('Nur öffentliche Simulationsdaten, keine Zugangsdaten');
      const prior = this.state.commands.find(x => x.id === cmd.commandId), identity = JSON.stringify([cmd.type, cmd.parameters ?? {}]);
      if (prior) { if (prior.identity !== identity) throw new Error('Auftrags-ID bereits mit anderem Inhalt verwendet'); return { ...this.view(), repeat: true, commandId: cmd.commandId }; }
      if (cmd.expectedRevision !== this.state.revision) throw Object.assign(new Error('Bot-Revision geändert; bestätigten Stand neu lesen'), { status: 409 });
      if (this.state.commands.length >= 500 || this.state.logs.length >= 500) throw new Error('Bot-Simulationsprotokoll voll; sichern und bewusst löschen. Keine neuen Modellaufträge.');
      let next = advanceBotClock(this.state, this.now()); const p = cmd.parameters ?? {}, at = this.now();
      if (cmd.type === 'enable') { if (typeof p.enabled !== 'boolean') throw new Error('Aktivierung ausdrücklich wählen'); next.enabled = p.enabled; }
      if (cmd.type === 'start') { next.settings = botSettings(p.settings); next = startBotRun(next, p, at); }
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
