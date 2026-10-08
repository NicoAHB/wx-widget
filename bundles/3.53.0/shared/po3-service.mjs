// G11: Oracle nutzt denselben Stream, öffentlichen Feed und Simulator wie der App-Worker.
import { PO3_VERSION, PO3_FRAMES, po3Settings, po3Window, fvgOverlaps } from './po3-core.mjs';
import { loadPo3Phase } from './po3-feed.mjs';
import { po3AlarmCandidates } from './po3-stream.mjs';
import { mergePo3Journal } from './po3-store.mjs';
const clone = x => JSON.parse(JSON.stringify(x));
export function po3ServiceSelection(raw) {
  const allowed = ['on', 'config', 'windowMode', 'custom', 'instruments', 'selected', 'singleFvg', 'sizing', 'fx'];
  if (!raw || Object.keys(raw).some(k => !allowed.includes(k)) || typeof raw.on !== 'boolean' || !Array.isArray(raw.instruments) || raw.instruments.length < 1 || raw.instruments.length > 40
    || new Set(raw.instruments).size !== raw.instruments.length || raw.instruments.some(x => !/^[A-Z0-9]{2,20}USDT$/.test(x)) || !['today', '4h', '1h', 'custom'].includes(raw.windowMode)
    || !Array.isArray(raw.selected) || new Set(raw.selected).size !== raw.selected.length || !(raw.singleFvg ? [1, 2, 3, 4] : [2, 3, 4]).includes(raw.selected.length) || raw.selected.some(x => !PO3_FRAMES[x]) || typeof raw.singleFvg !== 'boolean') throw new Error('PO3-Dienstauswahl ungültig');
  const config = po3Settings(raw.config), frames = new Set([config.contextOn ? config.context : null, config.bias, config.setup, config.entry]);
  if (raw.selected.some(x => !frames.has(x)) || !config.closure) throw new Error('Alarm-Ebenen müssen aktiv sein; Schließmodell fehlt');
  if (raw.windowMode === 'custom') po3Window('custom', Date.now(), raw.custom);
  const sizing = raw.sizing ?? {}; if (Object.keys(sizing).some(k => !['balanceUSDT', 'riskPercent', 'leverage'].includes(k)) || Object.values(sizing).some(v => v !== null && (!Number.isFinite(v) || v <= 0))) throw new Error('PO3-Modellgröße ungültig');
  return { ...clone(raw), config: { ...config }, sizing };
}
export function po3Message(alarm) { return `PO3 · ${alarm.stage === 1 ? 'FVG-Vorwarnung' : 'Entrybestätigung'} · ${alarm.instrument}\n${alarm.direction === 1 ? 'Long' : 'Short'} · ${alarm.timeframes.join(' + ')} · Zone ${alarm.low} bis ${alarm.high}\nKurs ${alarm.price} · Invalidierung ${alarm.invalidation}`
  + (alarm.contextConfirmed ? '\n4h bestätigt' : '') + (alarm.levels ? `\nEntry ${alarm.levels.entry} · SL ${alarm.levels.sl} · TP1 ${alarm.levels.tps[0]} · TP2 ${alarm.levels.tps[1]} · TP3 ${alarm.levels.tps[2]}` : '')
  + `\n${new Date(alarm.at).toISOString()} · Kerzenschluss · Modell ${PO3_VERSION}\n${alarm.stage === 1 ? 'Abwarten: noch kein bestätigter Einstieg.' : 'Preisplan prüfen; idealisierte Referenz, keine ausgeführte Order.'} Nach Gebühren, vor Funding; Cross unbekannt.`; }
export class Po3Service {
  constructor({ client, now = Date.now, saved = null, persist = () => false, notify = async () => {}, policy = () => null }) {
    Object.assign(this, { client, now, persist, notify, policy }); this.busy = false; this.stopped = false; this.controller = null;
    this.state = { version: PO3_VERSION, revision: 0, since: 0, config: null, streams: {}, journal: [], alerts: {}, cooldown: {}, due: {}, at: 0, error: '' };
    if (saved) { if (saved.version !== PO3_VERSION || !Number.isSafeInteger(saved.revision) || !saved.streams || !saved.alerts) throw new Error('PO3-Dienstmodell/Zustand unbekannt'); this.state = { ...this.state, ...clone(saved), config: saved.config ? po3ServiceSelection(saved.config) : null, journal: mergePo3Journal([], saved.journal ?? []) }; }
  }
  view() { const s = this.state; return { revision: s.revision, since: s.since, config: s.config, journal: s.journal.length, at: s.at, error: s.error }; }
  configure(raw) { const config = po3ServiceSelection(raw), before = clone(this.state); if (JSON.stringify(config) === JSON.stringify(before.config)) return this.view(); this.state.config = config; this.state.revision++; this.state.since = this.now(); this.state.streams = {}; this.state.due = {};
    if (!this.persist(this.state)) { this.state = before; throw new Error('PO3-Auswahl nicht dauerhaft gespeichert'); } return this.view(); }
  async scan() {
    if (this.busy || this.stopped || !this.state.config?.on) return; this.busy = true; this.controller = new AbortController(); const rev = this.state.revision;
    try { const cfg = this.state.config;
      for (const instrument of cfg.instruments) {
        if (this.controller.signal.aborted || rev !== this.state.revision) break;
        if ((this.state.due[instrument] || 0) > this.now()) continue;
        const result = await loadPo3Phase({ client: this.client, instrument, config: cfg.config, windowMode: cfg.windowMode, custom: cfg.custom, saved: this.state.streams[instrument] ?? null,
          journal: this.state.journal, sizing: cfg.sizing, fx: cfg.fx ?? null, signal: this.controller.signal, now: this.now, originPrefix: 'dienst-', selected: cfg.selected });
        if (rev !== this.state.revision || this.controller.signal.aborted) break;
        const next = { ...clone(this.state), streams: { ...this.state.streams, [instrument]: result.stream }, journal: result.journal, at: this.now(), error: '', due: { ...this.state.due, [instrument]: result.complete ? Math.floor(this.now() / 60000) * 60000 + 64000 : this.now() + 2000 } };
        if (!this.persist(next)) throw new Error('PO3-Originale nicht dauerhaft gesichert; Meldungen gesperrt'); this.state = next;
        await this.sendCandidates(result, instrument, cfg, rev);
      }
    } catch (e) { if (!this.controller.signal.aborted) { this.state.error = e.message; this.persist(this.state); } }
    finally { this.busy = false; this.controller = null; }
  }
  async sendCandidates(result, instrument, cfg, revision) {
    const policy = this.policy(), stream = result.stream;
    if (!policy?.on || !result.complete) return;
    let candidates = po3AlarmCandidates(stream, { selected: cfg.selected });
    if (cfg.singleFvg) { const c = stream.series[cfg.config.entry].rows.at(-1), atr = stream.series[cfg.config.entry].values.at(-1)?.atr;
      if (c && atr > 0) candidates = stream.zones.filter(z => z.alarmEligible && z.filledAt === null && c.close >= z.low - cfg.config.approachATR * atr && c.close <= z.high + cfg.config.approachATR * atr).map(z => ({ ...z, stage: 1, price: c.close, instrument, at: c.end, timeframes: [z.timeframe], invalidation: z.direction === 1 ? z.low : z.high })); }
    // Vollständig gefüllte Alarmzonen erhalten keine neue Stufe 2; Setup-FVG bleibt separat dokumentiert.
    for (const id of result.created) { const card = result.journal.find(x => x.id === id); if (!card || card.instrument !== instrument) continue;
      const zones = stream.zones, overlaps = cfg.singleFvg ? zones.filter(z => z.alarmEligible && z.filledAt === null).map(z => ({ ...z, timeframes: [z.timeframe] })) : fvgOverlaps(zones, cfg.selected);
      for (const z of overlaps.filter(z => z.direction === card.direction && card.zone.low < z.high && card.zone.high > z.low)) candidates.push({ ...z, stage: 2, instrument, at: card.plan.confirmedAt, price: card.plan.levels.entry, invalidation: card.plan.levels.sl, levels: card.plan.levels, signalId: card.id });
    }
    for (const candidate of candidates) {
      const current = this.policy(), freshAt = Math.floor(this.now() / PO3_FRAMES[cfg.config.entry]) * PO3_FRAMES[cfg.config.entry];
      if (!current?.on || current.epoch !== policy.epoch || revision !== this.state.revision || candidate.at < Math.max(current.since, this.state.since) || candidate.at !== freshAt) continue;
      const key = JSON.stringify([candidate.id, candidate.stage, current.epoch]), cooldownKey = instrument + '|' + candidate.stage + '|' + current.epoch;
      if (this.state.alerts[key] || (this.state.cooldown[cooldownKey] ?? 0) + cfg.config.cooldownMs > this.now()) continue;
      if (Object.keys(this.state.alerts).length >= 4000) throw new Error('PO3-Meldungsjournal voll; neue Meldungen pausieren');
      const alarm = { ...candidate, id: key, revision, epoch: current.epoch, expiresAt: candidate.at + PO3_FRAMES[cfg.config.entry], contextConfirmed: cfg.config.contextOn && cfg.config.context === '4h' && stream.checklist.context?.direction === candidate.direction };
      const before = clone(this.state); this.state.alerts[key] = alarm; this.state.cooldown[cooldownKey] = this.now(); if (!this.persist(this.state)) { this.state = before; throw new Error('PO3-Stufensperre nicht gesichert'); }
      await this.notify(alarm);
    }
  }
  stop() { this.stopped = true; this.controller?.abort(); }
}
