import { runMusterBacktest, musterCombinations } from './muster-bot-core.mjs';
import { createMusterClient } from './muster-bot-feed.mjs';
const client = createMusterClient(); let controller;
globalThis.onmessage = async ({ data: job }) => {
  if (job.type === 'cancel') { controller?.abort(); return; }
  if (job.type !== 'backtest') return; controller?.abort(); const active = new AbortController(); controller = active;
  try {
    const data = await client.load({ ...job, signal: active.signal, progress: p => globalThis.postMessage({ id: job.id, type: 'progress', ...p }) });
    const combinations = job.all ? musterCombinations(data.config) : [data.config], results = [];
    for (let i = 0; i < combinations.length; i++) {
      active.signal.throwIfAborted(); const config = combinations[i];
      const result = runMusterBacktest({ ...data, rows: data.rows[config.timeframe], config });
      const stride = Math.max(1, Math.ceil(result.equity.length / 2000)), equity = result.equity.filter((_, n) => n % stride === 0 || n === result.equity.length - 1);
      results.push({ config: result.config, symbol: result.symbol, market: result.market, stats: result.stats, equity, position: result.position, pending: result.pending });
      globalThis.postMessage({ id: job.id, type: 'progress', combinations: i + 1, total: combinations.length });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    globalThis.postMessage({ id: job.id, type: 'result', results });
  } catch (error) { globalThis.postMessage({ id: job.id, type: 'error', message: active.signal.aborted ? 'Test abgebrochen' : error.message }); }
  finally { if (controller === active) controller = null; }
};
