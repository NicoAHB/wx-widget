// Feste öffentliche Bitget-Antworten; ausschließlich Tests, keine Produktionsdaten/Schlüssel.
import { createBitgetPublicClient, BITGET_FRAMES } from '../../shared/bitget-public.mjs';
import { scoreConfluence } from '../../shared/confluence-core.mjs';
export const NOW = Date.UTC(2026, 9, 7, 12, 25), HOUR = 3600e3;
export const contract = { symbol: 'BTCUSDT', baseCoin: 'BTC', quoteCoin: 'USDT', symbolType: 'perpetual', symbolStatus: 'normal', supportMarginCoins: ['USDT'], pricePlace: '1', priceEndStep: '5', sizeMultiplier: '0.001', minTradeNum: '0.001', minTradeUSDT: '5' };
export function selection(timeframe = '1h', contextTimeframe = '4h', bars = 260) {
  const anchor = tf => Math.floor(NOW / BITGET_FRAMES[tf].periodMs) * BITGET_FRAMES[tf].periodMs - bars * BITGET_FRAMES[tf].periodMs;
  return { instrument: 'BTCUSDT', timeframe, contextTimeframe, horizon: timeframe === '1h' ? 'short' : 'long', maxHoldMs: 24 * HOUR, slippageBps: 0, indicatorAnchors: { base: anchor(timeframe), context: anchor(contextTimeframe) } };
}
export function row(time, periodMs) {
  const i = time / periodMs, open = 100 + Math.sin(i / 7), close = 100 + Math.sin((i + 1) / 7);
  return [time, open, Math.max(open, close) + 1, Math.min(open, close) - 1, close, 100 + i % 21, 999999].map(String);
}
export function responseBody(url, at = NOW) {
  const u = new URL(url), tf = Object.keys(BITGET_FRAMES).find(tf => BITGET_FRAMES[tf].granularity === u.searchParams.get('granularity'));
  let data;
  if (u.pathname.endsWith('/contracts')) data = [structuredClone(contract)];
  else if (u.pathname.endsWith('/current-fund-rate')) data = [{ symbol: 'BTCUSDT', fundingRate: '-0.0001', fundingRateInterval: '2', nextUpdate: String(at + HOUR) }];
  else {
    const step = BITGET_FRAMES[tf].periodMs, end = Math.floor(Number(u.searchParams.get('endTime')) / step) * step;
    data = Array.from({ length: Number(u.searchParams.get('limit')) }, (_, i) => row(end - i * step, step));
  }
  return { code: '00000', requestTime: at, data };
}
export function transport(options = {}) {
  let at = options.at ?? NOW, active = 0, maxActive = 0;
  const calls = [], now = () => at, setNow = value => { at = value; };
  async function fetch(url, init) {
    calls.push({ url, init }); active++; maxActive = Math.max(maxActive, active);
    try {
      await Promise.resolve(); init.signal.throwIfAborted();
      const u = new URL(url), body = responseBody(url, at); // API darf absteigend liefern
      const result = options.mutate?.(body, u, calls.length) ?? body;
      return result instanceof Response ? result : new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } finally { active--; }
  }
  const client = createBitgetPublicClient({ fetch, now, spacingMs: 0, wait: async ms => { at += ms; }, ...options.client });
  return { client, calls, now, setNow, get maxActive() { return maxActive; } };
}
export async function bitgetParity() {
  const t = transport(), loaded = await t.client.load({ selection: selection(), config: { patternWeight: 0 } });
  t.setNow(NOW + 4 * HOUR);
  const resumed = await t.client.load({ selection: selection(), config: { patternWeight: 0 }, saved: JSON.parse(JSON.stringify(loaded.saved)) });
  return { first: loaded, resumed, score: scoreConfluence({ ...resumed.data, direction: 1 }, { patternWeight: 0 }), urls: t.calls.map(x => x.url) };
}
