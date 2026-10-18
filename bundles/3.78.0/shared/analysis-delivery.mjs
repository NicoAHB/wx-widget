import { TOP_DOWN } from './analysis-top-down.mjs';
export const analysisSignalKey = s => `${s.analysisId}|${s.version || TOP_DOWN.version}|${s.symbol}|${s.market}|${s.direction}|${s.setupId}`;

// Dieselben Schlüssel können später vom Dienst verwendet werden. claim() ist die vorhandene atomare IndexedDB-Sperre.
export function createAnalysisDelivery({ allowed, destination, claim, send, now = Date.now, log = () => {}, delivered = () => {} }) {
  const pending = new Set();
  return async function deliver(s) {
    const can = () => allowed(s) && !!destination() && now() >= s.at && now() < s.expiresAt;
    if (!can()) return false;
    const key = analysisSignalKey(s); if (pending.has(key)) return false;
    const target = JSON.stringify(destination()); pending.add(key);
    try {
      if (!await claim('analysis:setup:' + key, 30 * 86400000)) return true;
      if (!can() || JSON.stringify(destination()) !== target) return true;
      if (!await claim(`analysis:cooldown:${s.analysisId}|${s.symbol}|${s.market}|${s.direction}`, TOP_DOWN.cooldownMs)) { log({ kind: 'cooldown', symbol: s.symbol, text: `${s.symbol}: neues ${s.side}-Setup während der 2h-Sperrzeit – nicht gesendet.` }); return true; }
      const result = await send(s, () => can() && JSON.stringify(destination()) === target);
      const outcome = result.ok ? 'sent' : result.lost ? 'uncertain' : 'failed';
      log({ kind: outcome, symbol: s.symbol, text: `${s.symbol} · ${s.side === 'long' ? 'Long' : 'Short'} · ${outcome === 'sent' ? 'Analyse-Foto zugestellt' : outcome === 'uncertain' ? 'Zustellung unbestätigt; kein zweiter Versand' : 'Analyse-Foto nicht zugestellt: ' + (result.msg || 'Versandfehler')}.` });
      delivered(s, result); return true;
    } finally { pending.delete(key); }
  };
}
