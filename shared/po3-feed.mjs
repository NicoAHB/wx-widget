// G11: eine begrenzte Phase pro Auftrag; öffentliche Bitget-Warteschlange aus G10 wiederverwenden.
import { FEED_VERSION } from './bitget-public.mjs';
import { PO3_FRAMES, po3Settings, po3Window, po3Key } from './po3-core.mjs';
import { po3Frames, createPo3Stream, advancePo3Stream } from './po3-stream.mjs';
export async function loadPo3Phase({ client, instrument, config, windowMode = 'today', custom = {}, saved = null, journal = [], sizing = {}, fx = null, signal, now = Date.now }) {
  const p = po3Settings(config), startedAt = now(), window = po3Window(windowMode, startedAt, custom), period = PO3_FRAMES[p.entry];
  let stream = saved;
  // Neue Konfiguration/Tagesgrenze beginnt eigene Detektion; das Journal bleibt unverändert.
  if (!stream || stream.parametersKey !== po3Key(p) || stream.instrument !== instrument || window.from < stream.window.from || windowMode === 'today' && stream.window.from !== window.from) {
    const anchors = Object.fromEntries(po3Frames(p).map(tf => [tf, Math.max(0, Math.floor(window.from / PO3_FRAMES[tf]) * PO3_FRAMES[tf] - 260 * PO3_FRAMES[tf])]));
    stream = createPo3Stream({ instrument, config: p, window, anchors, source: { venue: 'bitget', product: 'USDT-FUTURES', quote: 'USDT', dataRevision: FEED_VERSION, windowMode } });
  }
  const contract = stream.contract?.knownAt >= startedAt - 86400e3 ? stream.contract : await client.contract({ symbol: instrument, signal });
  const cursor = stream.series[p.entry].indicator.nextTime, warmup = cursor < Math.floor(window.from / period) * period;
  const cutoff = warmup ? Math.floor(window.from / period) * period : Math.min(Math.floor(window.to / period) * period, cursor + 200 * period);
  const frames = {}, ownFrames = [...new Set([...po3Frames(p), ...journal.filter(x => x.instrument === instrument && ['Aktiv', 'Offen'].includes(x.status)).map(x => x.config.entry)])];
  for (const tf of ownFrames) {
    const step = PO3_FRAMES[tf], ownOpen = journal.filter(x => x.instrument === instrument && x.config.entry === tf && ['Aktiv', 'Offen'].includes(x.status));
    const from = Math.min(stream.series[tf]?.indicator.nextTime ?? cutoff, ...ownOpen.map(x => x.processedTo ?? x.plan.availableAt));
    // Abschlussprüfung alter offener Fälle darf über das heutige Detektionsfenster hinausgehen.
    const to = Math.min(Math.floor(startedAt / step) * step, Math.floor(cutoff / step) * step);
    if (from < to) { const batch = await client.range({ symbol: instrument, timeframe: tf, from, to, maxPages: 2, signal }); frames[tf] = batch.rows; }
    else frames[tf] = [];
  }
  const latest = cutoff === Math.floor(startedAt / period) * period;
  let funding = null, fundingReason = null;
  if (latest && p.criteria === 'g10') { try { funding = await client.currentFunding({ symbol: instrument, source: { ...stream.source, timeframe: p.entry }, signal }); } catch (e) { signal?.throwIfAborted(); fundingReason = e.message; } }
  signal?.throwIfAborted(); const asOf = now();
  const result = advancePo3Stream(stream, frames, { asOf, window, contract, funding, sizing, fx, journal }); result.stream.contract = contract;
  // Ein langer Backfill einer alten Entryebene darf keine Kerzen anderer Ebenen vorwegnehmen.
  const next = result.stream.series[p.entry].indicator.nextTime;
  const pendingOld = result.journal.some(x => x.instrument === instrument && ['Aktiv', 'Offen'].includes(x.status) && (x.processedTo ?? x.plan.availableAt) < Math.floor(cutoff / x.plan.periodMs) * x.plan.periodMs);
  return { ...result, fundingReason, complete: !warmup && next >= Math.floor(window.to / period) * period && !pendingOld, asOf, cutoff, progress: { warmup, from: cursor, to: next, target: Math.floor(window.to / period) * period } };
}
