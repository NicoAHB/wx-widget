import { nyNoticeCurrent } from './ny-open-notices.mjs';
import { compactAnalysisSignal } from './analysis-chart.mjs';
import { analysisSignalKey } from './analysis-delivery.mjs';

export const ANALYSIS_NOTICE_KEY = 'scalpdesk.analysis-notices.v1';
export const ANALYSIS_BLINK_MS = 3 * 60000;
export function analysisNoticeCurrent(event, result, { now, available = true } = {}) {
  if (!available || event.acknowledged || !Number.isFinite(event.at) || now < event.at || now >= event.until || !result?.ready || now >= result.expiresAt) return false;
  if (event.analysisId === 'ny-open') return nyNoticeCurrent(event,result,now);
  if (event.type === 'entry') return !!result.signal && event.id === analysisSignalKey(result.signal) + '|entry' && now < result.signal.expiresAt;
  // Ziel-/Stop-Berührungen sind abgeschlossene Ereignisse, keine fortdauernde Long-/Short-Empfehlung.
  return event.at === result.at;
}
export function analysisNoticeState(value = {}) {
  return { seen: Array.isArray(value.seen) ? value.seen.slice(-200) : [], active: Array.isArray(value.active) ? value.active.slice(-30) : [], events: Array.isArray(value.events) ? value.events.slice(-40) : [] };
}
export function observeAnalysis(state, { signal = null, symbol, market, rows = [], now }) {
  const next = analysisNoticeState(state); let changed = false;
  const add = (s, type, at, tone, reason) => { const id = analysisSignalKey(s) + '|' + type; if (next.events.some(e => e.id === id)) return; next.events.push({ id, analysisId: s.analysisId, symbol: s.symbol, market: s.market, type, at, tone, reason, signal: compactAnalysisSignal(s), until: now + ANALYSIS_BLINK_MS, acknowledged: false }); changed = true; };
  if (signal && signal.at <= now && now < signal.expiresAt) {
    const key = analysisSignalKey(signal);
    if (!next.seen.includes(key)) {
      next.seen.push(key); const saved = { ...signal }; delete saved.chart; delete saved.components;
      next.active.push({ signal: saved, checkedAt: signal.at, target1: false, done: false });
      add(signal, 'entry', signal.at, signal.direction === 1 ? 'long' : 'short', `${signal.symbol.replace(/USDT$/, '/USDT')} · ${signal.direction === 1 ? 'Long' : 'Short'} bestätigt: 4h-Bias + 1h-Konfluenz (${signal.setup.join(' + ')}) + 15m ${signal.reversal.reasons.join(' / ')} und Schlussbruch.`);
    }
  }
  for (const position of next.active) {
    const s = position.signal; if (position.done || s.symbol !== symbol || s.market !== market) continue;
    const fresh = rows.filter(c => c.time >= position.checkedAt && c.end <= now);
    if (fresh.length && fresh[0].time !== position.checkedAt) { position.done = true; add(s, 'gap', now, 'neutral', `${s.symbol}: Ausstiegsprüfung unterbrochen – geschlossene 15m-Kerzen fehlen. Kein Ziel-/Stop-Treffer behauptet.`); continue; }
    for (const c of fresh) {
      position.checkedAt = c.end; changed = true;
      // Derselbe konservative Vorrang wie im bestehenden Modellvergleich: Stop vor Ziel bei unbekannter Reihenfolge in einer Kerze.
      const stop = s.direction === 1 ? c.low <= s.stop : c.high >= s.stop, t1 = s.direction === 1 ? c.high >= s.target1 : c.low <= s.target1, t2 = s.direction === 1 ? c.high >= s.target2 : c.low <= s.target2;
      if (stop) { add(s, 'stop', c.end, 'short', `${s.symbol.replace(/USDT$/, '/USDT')} · Stop-Marke erreicht. Die geschlossene 15m-Kerze berührt den berechneten Stop; Ausstiegshinweis, keine Ausführungsbestätigung.`); position.done = true; break; }
      if (t2) { add(s, 'target2', c.end, 'long', `${s.symbol.replace(/USDT$/, '/USDT')} · Ziel 2 erreicht. Die geschlossene 15m-Kerze berührt das zweite Ziel; Ausstiegshinweis, keine Ausführungsbestätigung.`); position.done = true; break; }
      if (t1 && !position.target1) { add(s, 'target1', c.end, 'long', `${s.symbol.replace(/USDT$/, '/USDT')} · Ziel 1 erreicht. Erstes Teilziel berührt; Stop und Ziel 2 werden weiter beobachtet.`); position.target1 = true; }
    }
  }
  next.seen = next.seen.slice(-200); next.active = next.active.filter(p => !p.done).slice(-30); next.events = next.events.slice(-40);
  return { state: next, changed };
}
