// G10(c): feste Fach-Snapshots; öffentliche Musterkerzen getrennt von den bereits geprüften Kernfällen.
import { fixture, HOUR } from './confluence.mjs';
import { BITGET_FRAMES } from '../../shared/bitget-public.mjs';
import { responseBody } from './bitget.mjs';
export function liveBitgetResponse(url, at, originAt = at) {
  const u = new URL(url), body = responseBody(url, at), symbol = u.searchParams.get('symbol');
  if (u.pathname.endsWith('/contracts')) body.data[0].symbol = symbol;
  else if (u.pathname.endsWith('/current-fund-rate')) body.data = [{ symbol, fundingRate: '0', fundingRateInterval: '2', nextUpdate: String(Math.floor(at / HOUR) * HOUR + HOUR) }];
  else if (u.pathname.endsWith('/ticker')) body.data = [{ symbol, bidPr: '123.9', askPr: '124', markPrice: '123.9', ts: String(at) }];
  else {
    const tf = Object.keys(BITGET_FRAMES).find(k => BITGET_FRAMES[k].granularity === u.searchParams.get('granularity'));
    const step = BITGET_FRAMES[tf].periodMs, anchor = Math.floor(originAt / step) * step - 260 * step;
    const value = i => tf === '1h' && i >= 252 ? i === 259 ? 123.9 : 125.1 - .2 * (i - 251) : 100 + .1 * i;
    body.data = body.data.map(row => { const t = Number(row[0]), i = (t - anchor) / step, open = value(i - 1), close = value(i);
      return [t, open, Math.max(open, close) + 1, Math.min(open, close) - 1, close, i === 259 ? 200 : 100, 999999].map(String); });
  }
  return body;
}
export function liveFixture(config = { patternWeight: 0 }) {
  const { input: data, p } = fixture(config);
  data.base.histogram = [-3, -2, -1, 0, 1];
  data.funding = { ...data.funding, kind: 'current', nextAt: data.scope.asOf + HOUR, costsComplete: false };
  data.contract = { venue: 'bitget', product: 'USDT-FUTURES', instrument: 'BTCUSDT', quote: 'USDT', tickSize: .5, quantityStep: .001, minQuantity: .001, minNotional: 5 };
  const series = {};
  for (const [role, period] of [['base', HOUR], ['context', 4 * HOUR]]) {
    const source = data[role].source, rows = Array.from({ length: 60 }, (_, i) => {
      const time = data.scope.asOf - (60 - i) * period;
      return { time, end: time + period, knownAt: time + period, open: 100, high: 101, low: 99, close: 100, volume: 100 };
    }); series[role] = { source, rows };
  }
  const quote = { venue: 'bitget', product: 'USDT-FUTURES', instrument: 'BTCUSDT', quote: 'USDT', bid: 100, ask: 100.1, markPrice: 100,
    at: data.scope.asOf + 100, knownAt: data.scope.asOf + 200, providerAt: data.scope.asOf + 100 };
  const options = { fundingMode: 'current-rate', anchorPolicy: 'nearest', marginEUR: null, leverage: 20, fx: null };
  return { data, saved: { series }, quote, planningAt: quote.knownAt, options, config: p };
}
