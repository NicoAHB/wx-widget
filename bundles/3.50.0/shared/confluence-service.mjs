// G10(e): derselbe öffentliche Fachkern im Dienst, versionierte Auswahl und dauerhafte Originalfälle.
import { settings } from './confluence-core.mjs';
import { createBitgetPublicClient, bitgetSelection } from './bitget-public.mjs';
import { evaluateLive } from './confluence-live.mjs';
import { captureObservation, mergeObservations, cardHistoricalStats, observationKey, replayJob } from './confluence-replay.mjs';
import { loadHistoryJob } from './confluence-history.mjs';
import { PAT_ALL_NAMES } from '../server/pattern-engine.mjs';
const clone = x => JSON.parse(JSON.stringify(x));
export function serviceSelection(input) {
  const config = settings(input?.config), options = input?.options;
  if (!options || !['current-rate', 'unknown'].includes(options.fundingMode) || !['nearest', 'latest-pivot'].includes(options.anchorPolicy)
    || !Array.isArray(input.items) || !input.items.length || input.items.length > 80) throw new Error('KI-Auswahl, Funding-/Ankerregel oder Coinliste fehlt');
  const items = input.items.map(item => bitgetSelection(item, config));
  if (new Set(items.map(x => x.instrument + '|' + x.horizon)).size !== items.length) throw new Error('Doppelte KI-Coin-/Horizontauswahl');
  return { forward: { short: input.forward?.short !== false, long: input.forward?.long !== false }, config: { ...config }, options: { fundingMode: options.fundingMode, anchorPolicy: options.anchorPolicy }, items };
}
export function kiMessage(card, statistics) {
  const quote = (name, label) => { const s = statistics[name], period = s.samplePeriod ? ` · Fälle ${new Date(s.samplePeriod.from).toISOString()} – ${new Date(s.samplePeriod.to).toISOString()}` : ' · kein abgeschlossener Fallzeitraum'; return `${label}: ${s.tpPercent == null ? s.status + ' (N=' + s.n + ')' : s.tpPercent.toFixed(1) + ' % (N=' + s.n + ')'} · nur protokollierte Originaleingaben${period}`; };
  return `🧠 KI-Signal ${card.scope.instrument} · ${card.scope.direction === 1 ? 'Long' : 'Short'} · ${card.scope.horizon === 'short' ? 'kurz' : 'lang'}\n`
    + `Bitget USDT-Futures · ${card.scope.timeframe}/${card.scope.contextTimeframe} · Score ${card.score.score}/100\nEntry ${card.levels.entry} · SL ${card.levels.sl} · TP ${card.levels.tp} · ${card.levels.rewardRisk}R brutto\n`
    + `${quote('short', '90 Tage')}\n${quote('long', '2 Jahre')}\nMuster: ${card.patterns.map(p => PAT_ALL_NAMES[p.id] || p.id).join(', ') || 'keine'}\n`
    + `Kosten: ${card.funding?.assumption || 'unbekannt'}\nCross-Liquidation unbekannt. Historische Auswertung, keine Garantie. Modell ${card.modelVersion || card.scope.modelVersion} · Revision ${card.config.revision}. Keine Order.`;
}
export class ConfluenceService {
  constructor({ now = Date.now, client = createBitgetPublicClient({ now }), saved = null, history = null, persistHistory = () => false, persist = () => false, notify = async () => {}, policy = () => null }) {
    Object.assign(this, { now, client, persist, notify, policy }); this.busy = false; this.stopped = false; this.controller = null;
    this.history = history; this.persistHistory = persistHistory;
    this.state = { rev: 0, since: 0, config: null, series: {}, due: {}, observations: [], cards: [], last: {}, statistics: {}, error: '', at: 0 };
    if (saved) { const config = saved.config ? serviceSelection(saved.config) : null; this.state = { ...this.state, ...clone(saved), config, observations: mergeObservations([], saved.observations || []) }; }
  }
  view() { const s = this.state; return { rev: s.rev, since: s.since, config: s.config, error: s.error, at: s.at, observations: s.observations.length, cards: s.cards.length }; }
  configure(config) {
    const next = serviceSelection(config), previous = clone(this.state);
    if (JSON.stringify(next) === JSON.stringify(this.state.config)) return this.view();
    this.state.config = next; this.state.rev++; this.state.since = this.now(); this.state.due = {}; this.state.series = {}; // alte feste Startanker bleiben in Originalfällen
    if (!this.persist(this.state)) { this.state = previous; throw new Error('KI-Auswahl nicht dauerhaft gespeichert; bisheriger Stand bleibt'); }
    return this.view();
  }
  async scan() {
    if (this.busy || this.stopped || !this.state.config) return;
    this.busy = true; this.controller = new AbortController(); const signal = this.controller.signal, rev = this.state.rev, cfg = this.state.config;
    try {
      for (const selection of cfg.items) {
        if (signal.aborted) break;
        const key = selection.instrument + '|' + selection.horizon;
        if ((this.state.due[key] || 0) > this.now()) continue;
        const before = clone(this.state);
        let committed = false;
        try {
          const loaded = await this.client.load({ selection, config: cfg.config, saved: this.state.series[key] || null, signal });
          if (rev !== this.state.rev || signal.aborted) break;
          let result = loaded.data ? evaluateLive({ ...loaded, config: cfg.config, options: cfg.options }) : null;
          if (result?.cards.some(c => c.score.score >= 50 && !c.score.blocked)) {
            const quote = await this.client.quote({ symbol: selection.instrument, decisionAt: loaded.data.scope.asOf, signal });
            result = evaluateLive({ ...loaded, quote, planningAt: this.now(), config: cfg.config, options: cfg.options });
          }
          if (rev !== this.state.rev || signal.aborted) break;
          if (loaded.saved) this.state.series[key] = loaded.saved;
          const observation = result ? captureObservation(result, cfg.config, cfg.options) : null;
          if (observation) this.state.observations = mergeObservations(this.state.observations, [observation]);
          const fresh = result?.eligible.filter(c => !this.state.cards.some(old => old.id === c.id)).map(c => ({ ...c, chartRows: loaded.saved.series.base.rows.slice(-120) })) || [];
          if (this.state.cards.length + fresh.length > 200 || new TextEncoder().encode(JSON.stringify([...this.state.cards, ...fresh])).length > 5 * 1024 * 1024) throw new Error('Dienst-KI-Kartenspeicher voll (200); neue Karten pausieren, Originalbestand bleibt');
          this.state.cards.push(...fresh); this.state.cards.sort((a, b) => b.decisionAt - a.decisionAt);
          const period = { '1h': 3600e3, '4h': 14400e3, '1d': 86400e3 }[selection.timeframe];
          this.state.due[key] = loaded.status === 'nachladen' ? this.now() + 2000 : loaded.status === 'bereit' ? Math.floor(this.now() / period) * period + period + 4000 : Math.max(loaded.retryAt || 0, this.now() + 60000);
          this.state.at = this.now(); this.state.error = loaded.reason || '';
          if (!this.persist(this.state)) throw new Error('Dienst-KI-Zustand nicht dauerhaft gespeichert; keine Meldung');
          committed = true;
          for (const card of fresh) await this.send(card);
        } catch (e) {
          if (rev !== this.state.rev || signal.aborted) break;
          if (!committed) this.state = before; this.state.error = e.message; this.state.due[key] = Math.max(e.retryAt || 0, this.now() + 60000); this.persist(this.state);
        }
      }
    } finally { this.busy = false; this.controller = null; }
  }
  stop() { this.stopped = true; this.controller?.abort(); }
  async resolveHistory() {
    if (this.busy || this.stopped || !this.state.cards.length) return;
    this.busy = true; this.controller = new AbortController(); const signal = this.controller.signal;
    try {
      const card = this.state.cards.find(c => !this.state.statistics[c.id] || this.now() - this.state.statistics[c.id].asOf >= 3600e3);
      if (!card) return;
      const key = observationKey(card.scope, card.config, card.options), existing = this.history;
      const saved = existing?.id === key && existing.stage !== 'done' ? existing : null, asOf = saved?.asOf ?? this.now();
      const observations = this.state.observations.filter(o => o.key === key && o.decisionAt <= asOf && o.decisionAt >= asOf - 730 * 86400e3);
      if (!observations.length) return;
      const loaded = saved?.stage === 'replay' ? { saved } : await loadHistoryJob({ client: this.client, instrument: card.scope.instrument, key, observations, asOf, saved, signal });
      let next = loaded.saved;
      if (next?.stage === 'replay') {
        const batch = replayJob({ observations, rows: next.rows, marks: next.marks, history: next.history, asOf, observedAt: this.now(), cursor: next.replayCursor });
        next = { ...next, cases: [...next.cases, ...batch.cases], replayCursor: batch.nextCursor, conflicts: next.conflicts + batch.conflicts, stage: batch.complete ? 'done' : 'replay' };
      }
      signal.throwIfAborted(); if (!next || !this.persistHistory(next)) throw new Error('Historienjob am Dienst nicht dauerhaft gespeichert; letzter Bestand bleibt');
      this.history = next;
      if (next.stage === 'done') {
        for (const own of this.state.cards.filter(c => observationKey(c.scope, c.config, c.options) === key)) this.state.statistics[own.id] = { asOf, statistics: cardHistoricalStats(own, { observations, cases: next.cases, asOf }) };
        if (!this.persist(this.state)) throw new Error('Dienstquoten nicht dauerhaft gespeichert');
      }
    } catch (e) { if (!signal.aborted) this.state.error = 'Historie: ' + e.message; }
    finally { this.busy = false; this.controller = null; }
  }
  async send(card) {
    const policy = this.policy(), s = this.state, key = card.scope.instrument + '|' + card.scope.horizon;
    // Keine Nachlieferung vor Aktivierung/Parameterübernahme bestätigter Kerzen. Message-Lebensdauer ist kein Trade-Exit.
    if (!policy?.on || !s.config?.forward[card.scope.horizon] || !card.eligible || card.score.score < 70 || card.context.base.closedAt < Math.max(policy.since, s.since)
      || card.decisionAt < Math.max(policy.since, s.since) || card.expiresAt <= this.now() || this.now() - (s.last[key] || 0) < 3600e3) return false;
    const previous = s.last[key]; s.last[key] = this.now();
    if (!this.persist(s)) { if (previous === undefined) delete s.last[key]; else s.last[key] = previous; return false; }
    const keyOfCard = observationKey(card.scope, card.config, card.options), cached = this.history?.stage === 'done' && this.history.id === keyOfCard ? this.history : null;
    const statistics = s.statistics[card.id]?.statistics || cardHistoricalStats(card, { observations: s.observations, cases: cached?.cases || [], asOf: cached?.asOf ?? this.now() });
    await this.notify(card, statistics, s.rev); return true;
  }
}
