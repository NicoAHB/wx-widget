// 3.77.4: UI-Bestätigung und einmaliger Hinweis, keine Handels-/Alarmregeln.
export const MACD_NOTICE = Object.freeze({
  confirmBars: 2, minFraction: .02, referenceBars: 60,
  pulseMs: 5000, maxLagMs: 30000, seenLimit: 256,
  storeKey: 'scalpdesk.macd-notices.v1'
});

export function createMacdNotice({ load = () => [], save = () => {} } = {}) {
  let initial; try { initial = load(); } catch { initial = []; }
  const seen = new Set((Array.isArray(initial) ? initial : []).filter(k => typeof k === 'string' && k.length < 400).slice(-MACD_NOTICE.seenLimit));
  let scope = '', until = 0, triggering = new Set();
  return {
    update(context, now = Date.now()) {
      const nextScope = JSON.stringify([context.symbol, context.source, context.interval]);
      if (scope !== nextScope) { scope = nextScope; until = 0; triggering.clear(); }
      const events = context.findings?.ready ? Object.entries(context.findings.events) : [];
      const active = new Set(), fresh = [];
      let changed = false;
      for (const [kind, e] of events) {
        if (!['signal', 'zero', 'divergence'].includes(kind) || ![1, -1].includes(e.direction) || !Number.isFinite(e.confirmedAt) || e.confirmedAt > now) continue;
        const id = JSON.stringify([scope, kind, e.direction, e.originTime ?? e.confirmedAt, e.firstTime ?? null, e.secondTime ?? null]);
        active.add(id);
        if (seen.has(id)) continue;
        seen.add(id); changed = true;
        // Alte Befunde beim Öffnen/Nachladen bleiben farbig, ohne neuen Blinkimpuls.
        if (e.age === 0 && now - e.confirmedAt <= MACD_NOTICE.maxLagMs) fresh.push(id);
      }
      if (![...triggering].some(id => active.has(id))) { until = 0; triggering.clear(); }
      let started = false;
      if (fresh.length) {
        // Zeitgleich eintreffende Befunde teilen einen Impuls, verlängern ihn nicht.
        if (now >= until) { until = now + MACD_NOTICE.pulseMs; started = true; triggering = new Set(fresh); }
        else fresh.forEach(id => triggering.add(id));
      }
      if (changed) {
        while (seen.size > MACD_NOTICE.seenLimit) seen.delete(seen.values().next().value);
        try { save([...seen]); } catch { /* In-Memory-Schutz bleibt bei vollem Speicher aktiv. */ }
      }
      return { blink: active.size > 0 && now < until, started };
    }
  };
}
