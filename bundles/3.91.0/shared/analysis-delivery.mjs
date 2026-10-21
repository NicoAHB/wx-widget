import { TOP_DOWN } from './analysis-top-down.mjs';
export const analysisSignalKey = s => `${s.analysisId}|${s.version || TOP_DOWN.version}|${s.symbol}|${s.market}|${s.direction}|${s.setupId}`;

// Dieselben Schlüssel können später vom Dienst verwendet werden. claim() ist die vorhandene atomare IndexedDB-Sperre.
export function createAnalysisDelivery({ allowed, destination, claim, release = async () => {}, send, now = Date.now, log = () => {}, delivered = () => {}, policy = () => null }) {
  const pending = new Set();
  return async function deliver(s) {
    const can = () => allowed(s) && !!destination() && now() >= s.at && now() < s.expiresAt;
    if (!can()) return false;
    const rules = policy(s), key = rules?.key || analysisSignalKey(s); if (pending.has(key)) return false;
    const target = JSON.stringify(destination()); pending.add(key);
    try {
      if (!await claim('analysis:setup:' + key, 30 * 86400000)) return true;
      if (!can() || JSON.stringify(destination()) !== target) return true;
      const cooldown = `analysis:cooldown:${s.analysisId}|${s.symbol}|${s.market}|${s.direction}`;
      if (!rules?.daily && !await claim(cooldown, TOP_DOWN.cooldownMs)) { log({ kind: 'cooldown', symbol: s.symbol, text: `${s.symbol}: neues ${s.side}-Setup während der 2h-Sperrzeit – nicht gesendet.` }); return true; }
      const result = await send(s, () => can() && JSON.stringify(destination()) === target);
      const outcome = result.ok ? 'sent' : result.lost ? 'uncertain' : 'failed';
      log({ kind: outcome, symbol: s.symbol, text: `${s.symbol} · ${s.side === 'long' ? 'Long' : 'Short'} · ${outcome === 'sent' ? 'Analyse-Foto zugestellt' : outcome === 'uncertain' ? 'Zustellung unbestätigt; kein zweiter Versand' : 'Analyse-Foto nicht zugestellt: ' + (result.msg || 'Versandfehler')}.` });
      delivered(s, result);
      // 3.82.2: eindeutig nicht zugestellt (weder angekommen noch unklar) – Sperren wieder freigeben, damit derselbe Hinweis innerhalb
      // seiner Gültigkeit erneut versucht werden kann; vorher blieb er 30 Tage gesperrt. Unklare Zustellung bleibt ohne zweiten Versuch.
      if (!result.ok && !result.lost) { await release('analysis:setup:' + key); if (!rules?.daily) await release(cooldown); return false; }
      return true;
    } finally { pending.delete(key); }
  };
}
