// Analyse-Katalog: neue Analysen ausschließlich hier per Code registrieren.
import { evaluateTopDown } from './analysis-top-down.mjs';
import { describeTopDown, topDownStatus } from './analysis-status.mjs';

export const ANALYSIS_KEY = 'scalpdesk.analysis.v1';
export const ANALYSIS_LOG_KEY = 'scalpdesk.analysis-log.v1';
export const ANALYSES = Object.freeze([
  Object.freeze({ id: 'top-down', name: 'Top-Down', version: 'top-down-1',
    indicators: Object.freeze(['ema200', 'macd']),
    intervals: Object.freeze(['4h', '1h', '15m']), evaluate: evaluateTopDown,
    description: '4h: Struktur + Trend + EMA 200. 1h: mindestens zwei unterschiedliche Bausteine in einer Zone. 15m: Umkehr und danach ein bestätigender Strukturschluss.',
    describe: describeTopDown, status: topDownStatus })
]);

export function analysisSettings(value = {}, definitions = ANALYSES) {
  const object = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const flags = v => Object.fromEntries(Object.entries(object(v)).filter(([k, x]) => /^[A-Z0-9]{2,20}USDT$/.test(k) && typeof x === 'boolean'));
  const rows = Object.fromEntries(definitions.map(d => { const r = object(value?.rows?.[d.id]); return [d.id, { telegram: r.telegram === true, chart: r.chart === true, coinsOpen: r.coinsOpen !== false, coins: flags(r.coins) }]; }));
  // 3.78.1: Name und Haken aktivieren dieselbe exklusive Ansicht; auch alte additive Einstellungen migrieren.
  const focus = definitions.some(d => d.id === value?.focus) ? value.focus : definitions.find(d => rows[d.id].chart)?.id || null;
  for (const d of definitions) rows[d.id].chart = d.id === focus;
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
