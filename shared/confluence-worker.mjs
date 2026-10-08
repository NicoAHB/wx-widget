// G10(c): begrenzte öffentliche Abrufe und Muster/Score abseits des iPhone-Hauptthreads.
import { createBitgetPublicClient } from './bitget-public.mjs';
import { evaluateLive } from './confluence-live.mjs';
import { captureObservation } from './confluence-replay.mjs';
import { saveObservation } from './confluence-replay-store.mjs';
import { runHistoricalBacktest } from './confluence-history.mjs';
const client = createBitgetPublicClient();
let running = null;
globalThis.onmessage = async ({ data: job }) => {
  if (job?.type === 'cancel') { running?.controller.abort(); return; }
  if (!['load', 'backtest'].includes(job?.type) || !Number.isSafeInteger(job.id) || running) return;
  const controller = new AbortController(); running = { id: job.id, controller };
  try {
    if (job.type === 'backtest') {
      const history = await runHistoricalBacktest({ client, card: job.request.card, signal: controller.signal,
        progress: progress => globalThis.postMessage({ id: job.id, progress }) });
      controller.signal.throwIfAborted(); globalThis.postMessage({ id: job.id, history }); return;
    }
    const loaded = await client.load({ ...job.request, signal: controller.signal });
    let result = loaded.data ? evaluateLive({ ...loaded, config: job.request.config, options: job.options }) : null;
    if (result?.cards.some(c => c.score.score >= 50 && !c.score.blocked)) {
      try {
        const quote = await client.quote({ symbol: loaded.data.scope.instrument, decisionAt: loaded.data.scope.asOf, signal: controller.signal });
        result = evaluateLive({ ...loaded, quote, planningAt: Date.now(), config: job.request.config, options: job.options });
      } catch (e) { controller.signal.throwIfAborted(); result.quoteReason = e.message; result.quoteRetryAt = e.retryAt ?? null; }
    }
    let archive = null, archiveError = null;
    if (result) { try { archive = await saveObservation(captureObservation(result, job.request.config, job.options)); } catch (e) { archiveError = e.message; } }
    controller.signal.throwIfAborted(); globalThis.postMessage({ id: job.id, loaded, result, archive, archiveError });
  } catch (e) { globalThis.postMessage({ id: job.id, error: controller.signal.aborted ? 'abgebrochen' : e.message }); }
  finally { running = null; }
};
