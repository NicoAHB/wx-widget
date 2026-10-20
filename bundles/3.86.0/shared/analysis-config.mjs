// Analyse-Katalog: neue Analysen ausschließlich hier per Code registrieren.
import { createAnalysisLearningTools } from './analysis-learning-view.mjs';
import { evaluateTopDown } from './analysis-top-down.mjs';
import { NY_OPEN, nySettings, evaluateNyOpen } from './ny-open-core.mjs';
import { createNyRuntime } from './ny-open-feed.mjs';
import { describeNyOpen, nyStatus, createNyTools } from './ny-open-view.mjs';
import { describeTopDown, topDownStatus } from './analysis-status.mjs';
import { PULLBACK, pullbackOptions, evaluatePullback } from './trend-pullback-core.mjs';
import { createPullbackRuntime } from './trend-pullback-feed.mjs';
import { describePullback, pullbackStatus, createPullbackTools } from './trend-pullback-view.mjs';
import { STRATEGY_IDS, STRATEGY_NAMES, MARKET_STRATEGY, strategyOptions, evaluateStrategy } from './market-strategy-core.mjs';
import { createStrategyRuntime } from './market-strategy-feed.mjs';
import { strategyStatus, strategyExplanation, createStrategyTools, drawMarketStrategyChart } from './market-strategy-view.mjs';
import { RELATIVE_STRENGTH, createRelativeStrengthRuntime, relativeStrengthStatus, drawRelativeStrengthChart } from './relative-strength.mjs';

export const ANALYSIS_KEY = 'scalpdesk.analysis.v1';
export const ANALYSIS_LOG_KEY = 'scalpdesk.analysis-log.v1';
export const ANALYSES = Object.freeze([
  Object.freeze({ id: 'top-down', name: 'Top-Down', version: 'top-down-1',
    indicators: Object.freeze(['ema200', 'macd']),
    intervals: Object.freeze(['4h', '1h', '15m']), evaluate: evaluateTopDown,
    description: '4h: Struktur + Trend + EMA 200. 1h: mindestens zwei unterschiedliche Bausteine in einer Zone. 15m: Umkehr und danach ein bestätigender Strukturschluss.',
    describe: describeTopDown, status: topDownStatus, learning:true, tools:args=>createAnalysisLearningTools({...args,id:'top-down',name:'Top-Down'}) }),
  Object.freeze({ id:NY_OPEN.id, name:"NY Open Killzone", version:NY_OPEN.version, indicators:Object.freeze([]), intervals:Object.freeze([]), evaluate:evaluateNyOpen, createRuntime:createNyRuntime, normalizeOptions:nySettings, tools:args=>createAnalysisLearningTools({...args,id:NY_OPEN.id,name:'NY Open Killzone',existing:createNyTools(args)}), learning:true,
    description:"09:30–09:35 New York: Opening Range. 09:35–10:30: 1m-Ausbruch mit starkem Körper und bestätigtem FVG. Fester Stop, Ziel 2R; nur normale, geschlossene Kerzen. Maximal ein Signal pro Coin und NY-Handelstag.", describe:describeNyOpen, status:nyStatus }),
  Object.freeze({ id:PULLBACK.id, name:PULLBACK.name, version:PULLBACK.version, indicators:Object.freeze([]), intervals:Object.freeze([]), evaluate:evaluatePullback,
    createRuntime:createPullbackRuntime, normalizeOptions:pullbackOptions, tools:createPullbackTools, focusOnName:true, learning:true,
    description:'4h-Trend mit EMA 21/50/200, Struktur und ADX. 1h-Fibonacci-Rücksetzer in EMA-Band oder 4h-Zone. 15m: mindestens zwei Bestätigungen, CRV/Stop-Filter. Lokale, zeitlich getrennt geprüfte logistische Regression; feste Regeln bleiben unverändert.',
    describe:describePullback, status:pullbackStatus }),
  ...STRATEGY_IDS.map(id=>Object.freeze({id,name:STRATEGY_NAMES[id],version:MARKET_STRATEGY.version,indicators:Object.freeze([]),intervals:Object.freeze([]),defaultInterval:'15m',observe:true,
    evaluate:input=>evaluateStrategy({...input,id}),createRuntime:args=>createStrategyRuntime({...args,id}),normalizeOptions:strategyOptions,
    status:(r,f)=>strategyStatus({...r,analysisId:id},f),describe:(r,f)=>strategyExplanation(id,r,f.price),draw:args=>drawMarketStrategyChart({...args,id}),tools:args=>createStrategyTools({...args,id}),
    description:id==='range-return'?'Beobachtungsmodell: 1H-Seitwärtsrange, 15m-Sweep und bestätigte Rückkehr. Ziele Mitte und Gegenseite; Kosten-/Stop-/CRV-Filter.':'Beobachtungsmodell: 1H-Verdichtung, geschlossener 15m-Volumenausbruch, gehaltener Rücktest und Schlussbestätigung. Historischer 70/30-Vergleich ohne automatische Regeländerung.'})),
  Object.freeze({id:RELATIVE_STRENGTH.id,name:RELATIVE_STRENGTH.name,version:RELATIVE_STRENGTH.version,indicators:Object.freeze([]),intervals:Object.freeze([]),defaultInterval:'1h',observe:true,information:true,
    createRuntime:createRelativeStrengthRuntime,status:relativeStrengthStatus,describe:r=>r.reason,draw:drawRelativeStrengthChart,
    description:'Auswahlhilfe: Stärke gegenüber BTC über 1/4/24 geschlossene 1H-Kerzen, ATR-normalisierter Rang, Volumen und Abstand zur EMA 20. Keine eigenen Einstiegssignale und kein Telegram-Versand.'})
]);

export function analysisSettings(value = {}, definitions = ANALYSES) {
  const object = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const flags = v => Object.fromEntries(Object.entries(object(v)).filter(([k, x]) => /^[A-Z0-9]{2,20}USDT$/.test(k) && typeof x === 'boolean'));
  // 3.79.1: bisher standardmäßig offene Listen einmal schließen; bewusste Auswahl danach erhalten.
  const rows = Object.fromEntries(definitions.map(d => { const r = object(value?.rows?.[d.id]); return [d.id, { telegram: !d.information && r.telegram === true, chart: r.chart === true, coinsOpen: value?.version >= 2 && r.coinsOpen === true, coins: flags(r.coins), ...(d.normalizeOptions ? {options:d.normalizeOptions(r.options)} : {}) }]; }));
  // 3.78.1: Name und Haken aktivieren dieselbe exklusive Ansicht; auch alte additive Einstellungen migrieren.
  const focus = definitions.some(d => d.id === value?.focus) ? value.focus : definitions.find(d => rows[d.id].chart)?.id || null;
  for (const d of definitions) rows[d.id].chart = d.id === focus;
  const base = Object.fromEntries(Object.entries(object(value?.base)).filter(([k, v]) => /^[a-z0-9]+$/.test(k) && typeof v === 'boolean'));
  return { version: 2, open: value?.open === true, rows, globalCoins: flags(value?.globalCoins), focus, base: Object.keys(base).length ? base : null };
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
