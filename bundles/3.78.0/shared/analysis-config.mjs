// Analyse-Katalog: neue Analysen ausschließlich hier per Code registrieren.
import { evaluateTopDown } from './analysis-top-down.mjs';

export const ANALYSIS_KEY = 'scalpdesk.analysis.v1';
export const ANALYSIS_LOG_KEY = 'scalpdesk.analysis-log.v1';
export const ANALYSES = Object.freeze([
  Object.freeze({ id: 'top-down', name: 'Top-Down', version: 'top-down-1',
    indicators: Object.freeze(['vp', 'ema200', 'hz', 'fvg', 'liq', 'lmap', 'hilo', 'div', 'macd']),
    intervals: Object.freeze(['4h', '1h', '15m']), evaluate: evaluateTopDown,
    description: '4h: Struktur + Trend + EMA 200. 1h: mindestens zwei unterschiedliche Bausteine in einer Zone. 15m: Umkehr und danach ein bestätigender Strukturschluss.',
    describe: (r, { price, number }) => {
      const s = r.signal, zone = s?.zone || r.zones?.[0], direction = r.bias?.direction === 1 ? 'Long' : r.bias?.direction === -1 ? 'Short' : 'neutral';
      return `${r.stage}/3 Stufen\n${r.stage >= 1 ? '✓' : '○'} 4h Bias: ${direction}\n${r.stage >= 2 ? '✓' : '○'} 1h Setup${zone ? ': ' + zone.labels.join(' + ') + ' · ' + price(zone.low) + '–' + price(zone.high) : ': wartet'}\n${r.stage >= 3 ? '✓' : '○'} 15m: ${r.reason}${s ? '\nEinstieg ' + price(s.entry) + ' · Stop ' + price(s.stop) + '\nZiel 1 ' + price(s.target1) + ' · Ziel 2 ' + price(s.target2) + ' · CRV ' + number(s.rr, 2) + ' / ' + number(s.rr2, 2) : ''}`;
    } })
]);

export function analysisSettings(value = {}, definitions = ANALYSES) {
  const object = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const flags = v => Object.fromEntries(Object.entries(object(v)).filter(([k, x]) => /^[A-Z0-9]{2,20}USDT$/.test(k) && typeof x === 'boolean'));
  const rows = Object.fromEntries(definitions.map(d => { const r = object(value?.rows?.[d.id]); return [d.id, { telegram: r.telegram === true, chart: r.chart === true, coinsOpen: r.coinsOpen !== false, coins: flags(r.coins) }]; }));
  const focus = definitions.some(d => d.id === value?.focus) ? value.focus : null;
  const base = Object.fromEntries(Object.entries(object(value?.base)).filter(([k, v]) => /^[a-z0-9]+$/.test(k) && typeof v === 'boolean'));
  return { version: 1, open: value?.open === true, rows, globalCoins: flags(value?.globalCoins), focus, base: Object.keys(base).length ? base : null };
}
export function analysisCoinAllowed(settings, id, symbol, watch) {
  return watch.includes(symbol) && settings.rows[id]?.telegram === true && settings.globalCoins[symbol] !== false && settings.rows[id].coins[symbol] !== false;
}
// Kein Rückfall auf einen bestehenden Bot/Chat. Die numerische ID ist die des Ziel-Chats, nie die Bot-ID aus dem Token.
export function analysisDestination({ atoken = '', achat = '', athread = '' } = {}) {
  const token = atoken.trim(), chat = achat.trim(), thread = athread.trim();
  if (!/^\d{5,15}:[A-Za-z0-9_-]{30,80}$/.test(token) || !/^-?\d{1,20}$/.test(chat) || /^-?0+$/.test(chat) || thread && !/^\d{1,10}$/.test(thread)) return null;
  if (!chat.startsWith('-') && BigInt(chat) === BigInt(token.split(':')[0])) return null;
  return { token, chat, thread };
}
