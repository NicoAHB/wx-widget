// G10(c): begrenzte öffentliche Abrufe und Muster/Score abseits des iPhone-Hauptthreads.
import { createBitgetPublicClient, bitgetErrorMessage } from './bitget-public.mjs';
import { evaluateLive } from './confluence-live.mjs';
import { executionPreview } from './confluence-risk-view.mjs';
import { resultEvidence } from './confluence-evidence.mjs';
import { observationKey } from './confluence-replay.mjs';
import { readReplay } from './confluence-replay-store.mjs';
import { captureObservation } from './confluence-replay.mjs';
import { saveObservation } from './confluence-replay-store.mjs';
import { runHistoricalBacktest } from './confluence-history.mjs';
import { loadPo3Phase } from './po3-feed.mjs';
import { readPo3State, changePo3State, importPo3Csv, exportPo3Csv, mergePo3Journal } from './po3-store.mjs';
const client = createBitgetPublicClient();
let running = null;
globalThis.onmessage = async ({ data: job }) => {
  if (job?.type === 'cancel') { running?.controller.abort(); return; }
  if (!['load', 'backtest', 'po3', 'po3-journal', 'execution', 'evidence'].includes(job?.type) || !Number.isSafeInteger(job.id) || running) return;
  const controller = new AbortController(); running = { id: job.id, controller };
  try {
    if (job.type === 'execution') {
      const card = job.request.card, symbol = card.scope.instrument;
      const contract = await client.contract({ symbol, signal: controller.signal });
      const currentFunding = await client.currentFunding({ symbol, source: card.context.base.source, signal: controller.signal });
      const quote = await client.quote({ symbol, decisionAt: Date.now(), signal: controller.signal });
      controller.signal.throwIfAborted(); globalThis.postMessage({ id: job.id, execution: executionPreview(card, { contract, currentFunding, quote, asOf: Date.now(), sizing: job.options }) }); return;
    }
    if (job.type === 'evidence') {
      const card = job.request.card, key = observationKey(card.scope, card.config, card.options), jobState = await readReplay('jobs', key);
      controller.signal.throwIfAborted(); globalThis.postMessage({ id: job.id, evidence: resultEvidence(jobState?.cases ?? [], { key, threshold: card.config.minimumScore, asOf: jobState?.asOf ?? Date.now(), from: job.request.from }) }); return;
    }
    if (job.type.startsWith('po3')) {
      let root = await readPo3State(), result = null, csv = null;
      if (job.request.action === 'pending') { globalThis.postMessage({ id: job.id, po3: { pending: root.journal.filter(x => x.modelVersion === 'po3-1' && ['Aktiv', 'Offen'].includes(x.status)).map(x => x.instrument) } }); return; }
      if (job.type === 'po3') {
        result = await loadPo3Phase({ client, ...job.request, saved: root.streams[job.request.instrument] ?? null, journal: root.journal, signal: controller.signal });
        controller.signal.throwIfAborted(); root = await changePo3State(root.revision, state => ({ ...state, journal: result.journal, streams: { ...state.streams, [job.request.instrument]: result.stream } }));
      } else if (job.request.action === 'export') csv = exportPo3Csv(root.journal);
      else if (job.request.action === 'import') root = await changePo3State(root.revision, state => ({ ...state, journal: importPo3Csv(job.request.csv, state.journal) }));
      else if (job.request.action === 'append') root = await changePo3State(root.revision, state => ({ ...state, journal: mergePo3Journal(state.journal, job.request.journal.map(x => { const old = state.journal.find(s => s.id === x.id); return old ? { ...x, tradedByMe: old.tradedByMe } : x; }), { update: true }) }));
      else if (job.request.action === 'clear') root = await changePo3State(root.revision, state => ({ ...state, journal: [] }));
      else if (job.request.action === 'clear-cache') root = await changePo3State(root.revision, state => ({ ...state, streams: {} }));
      else if (job.request.action === 'flag') root = await changePo3State(root.revision, state => ({ ...state, journal: state.journal.map(x => x.id === job.request.id ? { ...x, tradedByMe: job.request.value === true } : x) }));
      controller.signal.throwIfAborted(); globalThis.postMessage({ id: job.id, po3: { revision: root.revision, journal: root.journal, stream: result?.stream ?? root.streams[job.request.instrument] ?? null,
        pending: root.journal.filter(x => x.modelVersion === 'po3-1' && ['Aktiv', 'Offen'].includes(x.status)).map(x => x.instrument), complete: result?.complete, progress: result?.progress, warnings: result?.warnings ?? [], fundingReason: result?.fundingReason, csv } }); return;
    }
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
      } catch (e) { controller.signal.throwIfAborted(); result.quoteReason = bitgetErrorMessage(e); result.quoteRetryAt = e.retryAt ?? null; }
    }
    let archive = null, archiveError = null;
    if (result) { try { archive = await saveObservation(captureObservation(result, job.request.config, job.options)); } catch (e) { archiveError = e.message; } }
    controller.signal.throwIfAborted(); globalThis.postMessage({ id: job.id, loaded, result, archive, archiveError });
  } catch (e) { globalThis.postMessage({ id: job.id, error: controller.signal.aborted ? 'abgebrochen' : bitgetErrorMessage(e) }); }
  finally { running = null; }
};
