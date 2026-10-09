// Öffentliche Grid-Momentaufnahme: vorhandener Bitget-Transport, keine Konto-/Orderaufrufe.
import { AdaptiveAIGridStrategy, GRID_MODEL_VERSION, GRID_POLICY } from './adaptive-grid.mjs';
export async function loadAdaptiveGridMarket({ client, instrument, runId, config, signal, now = Date.now }) {
  const scope = { venue: 'bitget', product: 'USDT-FUTURES', instrument, quote: 'USDT', runId }, strategy = new AdaptiveAIGridStrategy({ scope, config });
  signal?.throwIfAborted(); const to = Math.floor(now() / GRID_POLICY.periodMs) * GRID_POLICY.periodMs, from = to - GRID_POLICY.historyDays * 86400000;
  const history = await client.range({ symbol: instrument, timeframe: '15m', from, to, maxPages: 8, signal });
  if (!history.complete) throw new Error('Grid-Historienjob unvollständig; keine Freigabe');
  const contract = await client.contract({ symbol: instrument, signal });
  const liveVolume = typeof client.liveVolume === 'function' ? await client.liveVolume({ symbol: instrument, signal }) : null;
  const quote = await client.quote({ symbol: instrument, decisionAt: now(), signal }), asOf = now(); signal?.throwIfAborted();
  const range = strategy.calculate_dynamic_range({ scope, candles: history.rows, asOf });
  return { kind: 'public-grid-model-input', modelVersion: GRID_MODEL_VERSION, scope, range, contract, liveVolume, quote, asOf, coverage: history.coverage, privateOrders: false };
}
