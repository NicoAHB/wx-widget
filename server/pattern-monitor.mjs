// 2.4.0 (G09 C6b): Marktvertrag, frische bestätigte Formationen und deutscher Meldungstext.
import { patEngine, PAT_NAMES } from './pattern-engine.mjs';
import { formatMessage } from './telegram-format.mjs';
import { PATTERN_STEPS, intervalEnd } from './market-intervals.mjs';
import fs from 'node:fs';
// 2.13.0: gemeinsamer Qualitätsfilter (Repository ../shared, Installer ./shared) – derselbe Code wie in der App.
const SHARED = fs.existsSync(new URL('./shared/pattern-quality.mjs', import.meta.url)) ? './shared/' : '../shared/';
export const PQ = await import(new URL(SHARED + 'pattern-quality.mjs', import.meta.url));
const SC = await import(new URL(SHARED + 'pattern-signal-card.mjs', import.meta.url));   // 3.71.0: Mini-Chart-Daten der Signalkarte
const PK = await import(new URL(SHARED + 'pattern-knowledge.mjs', import.meta.url));   // 2.17.0: Trefferzählung je Muster über alle Coins
export const PAT_STEPS = PATTERN_STEPS;
export const patternId = c => [c.mkt, c.sym, c.iv, c.pat, c.t0, c.t1, c.model].join('|');
export const patternEnd = intervalEnd;
export function patternConfig(c) {
  if (c && ((c.model && c.model !== 'pat-1') || c.gap === true)) throw new Error('Chartmuster: nur Modell pat-1 im Krypto-Modus ohne strenge Gaps unterstützt.');
  if (!c || !Array.isArray(c.items) || c.items.length > 40 || !/^(-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$/.test(c.chat) || !/^\d{1,20}$/.test(c.bot)
    || (c.thread && !/^\d{1,10}$/.test(c.thread))) throw new Error('Chartmuster: Liste, Chat, Bot oder Thema ungültig.');
  const items = c.items.map(x => {
    if (!x || !/^[A-Z0-9]{2,20}USDT$/.test(x.sym) || !['spot', 'futures'].includes(x.mkt) || !Object.hasOwn(PAT_STEPS, x.iv)) throw new Error('Chartmuster: Markt oder Intervall ungültig.');
    return { sym: x.sym, mkt: x.mkt, iv: x.iv };
  }).sort((a, b) => `${a.mkt}|${a.sym}|${a.iv}`.localeCompare(`${b.mkt}|${b.sym}|${b.iv}`));
  if (new Set(items.map(x => `${x.mkt}|${x.sym}|${x.iv}`)).size !== items.length) throw new Error('Chartmuster: doppelter Markt.');
  return { model: 'pat-1', gap: false, chat: String(c.chat), thread: String(c.thread || ''), bot: String(c.bot), items, filter: PQ.patternFilterSettings(c.filter) };
}
export function patternCandles(rows, iv, now) {
  if (!Array.isArray(rows)) throw new Error('Chartmuster: keine Kerzen.');
  const k = []; let previous = null;
  for (const r of rows) {
    if (!Array.isArray(r) || r.length < 7) throw new Error('Chartmuster: Kerzendaten ungültig.');
    const [t, o, h, l, c, v, end] = r.slice(0, 7).map(Number), expected = patternEnd(t, iv);
    if (![t, o, h, l, c, v, end].every(Number.isFinite) || t <= 0 || l <= 0 || v < 0 || h < Math.max(o, c) || l > Math.min(o, c)
      || end !== expected - 1 || (previous !== null && t !== patternEnd(previous, iv))) throw new Error('Chartmuster: ungültige Kerze oder Datenlücke.');
    previous = t;
    if (expected <= now) k.push({ t, o, h, l, c, v });
  }
  return k.slice(-540);
}
const engine = patEngine();
export function patternCases(k, item, now) {
  if (k.length < 40) return [];
  const last = k.at(-1), step = PAT_STEPS[item.iv];
  // Alte API-Daten nicht als frische Bestätigung werten; Monatsgrenzen bleiben kalendergenau.
  if (patternEnd(patternEnd(last.t, item.iv), item.iv) <= now) throw new Error('Chartmuster: Kerzendaten veraltet.');
  return engine.detect(k, { from: Math.max(0, k.length - 500), step, gap: false, running: false, formOnly: true }).hits
    .filter(h => !h.prelim && h.kind === 'form' && h.dir !== 'neutral' && /^Ausbruch/.test(h.status) && h.q >= 80 && h.i1 >= k.length - 2)
    .map(h => { const c = { ...item, pat: h.id, kind: 'form', dir: h.dir, t0: h.t0, t1: h.t1, tc: k[h.i1].t, p0: k[h.i1].c,
      model: 'pat-1', profile: 'H12-e0.10', q: h.q, at: now, src: 'live', rules: h.rules.map(r => [r.k, r.w, r.ok]), res: null }; c.id = patternId(c); return { c, h }; });
}
export function patternFresh(c, now, since) {
  return !!c && c.id === patternId(c) && Object.hasOwn(PAT_NAMES, c.pat) && c.kind === 'form' && c.model === 'pat-1'
    && c.src === 'live' && c.q >= 80 && c.q <= 100 && ['bull', 'bear'].includes(c.dir) && ['spot', 'futures'].includes(c.mkt)
    && /^[A-Z0-9]{2,20}USDT$/.test(c.sym) && Object.hasOwn(PAT_STEPS, c.iv)
    && [c.t0, c.t1, c.tc, c.p0].every(Number.isFinite) && c.p0 > 0 && c.t0 <= c.t1 && c.t1 === c.tc
    && patternEnd(c.tc, c.iv) <= now && patternEnd(c.tc, c.iv) > since && patternEnd(patternEnd(patternEnd(c.tc, c.iv), c.iv), c.iv) > now;
}
// 2.13.0: Bewertung eines Kandidaten für den Qualitätsfilter. Höherer Zeitrahmen, BTC und Spread werden nur für Kandidaten
// geladen (je Prüflauf zwischengespeichert); fehlen sie, zählt der Trend als unbekannt bzw. der Spread nicht.
export async function patternEvaluate({ c, h, k, fetchRows, fetchSpread = null, cache = new Map(), settings, journal = [], now }) {
  const htf = PQ.HIGHER_TIMEFRAME[c.iv];
  const load = (sym, iv) => { const key = `${c.mkt}|${sym}|${iv}`; if (!cache.has(key)) cache.set(key, Promise.resolve().then(() => fetchRows({ mkt: c.mkt, sym, iv }, 260)).then(rows => patternCandles(rows, iv, now)).catch(() => null)); return cache.get(key); };
  const higher = htf ? await load(c.sym, htf) : null, btc = htf && !/^BTC/.test(c.sym) ? await load('BTCUSDT', htf) : null;
  let spreadPct = null; if (fetchSpread) { const key = `spread|${c.mkt}|${c.sym}`; if (!cache.has(key)) cache.set(key, Promise.resolve().then(() => fetchSpread(c)).catch(() => null)); spreadPct = await cache.get(key); }
  return PQ.evaluatePatternSignal({ c, h, k, i1: h.i1, higher, btc, liquidity: { spreadPct }, hits: PQ.patternHitStats(journal, c.pat, c.iv), settings });
}
export const patternFilterLog = (c, ev, decision) => `Chartmuster ${decision.send ? 'gesendet' : 'gefiltert'}: ${c.sym} · ${c.iv} · ${PAT_NAMES[c.pat] || c.pat} · ${c.dir === 'bull' ? 'Long' : 'Short'} · Score ${ev.score}${decision.send ? '' : ' – ' + (decision.reason || ev.reason)}`;
// 1.2.0: strukturierte Signaldaten der Meldung – daraus entstehen Textmeldung und Trading-Karte (gleiche Werte)
// 3.71.0: plus Signalkarte – Trend/Volumen, Chance/Risiko, ATR(14), Kurs, Bestätigungskerze, Kartenwerte des Filters und das
// Mini-Chart (aus den Kerzen k und den Musterlinien; ohne k ein schon fertiges h.chart, z. B. aus der App)
export function patternMessageData(c, h, archive = [], ev = null, k = null) {
  const lv = h.levels || {};
  // 2.17.0: je Muster, Intervall und Richtung über alle Coins (ab 30 Fällen) statt je Coin; Zufallsvergleich aus den Kerzen des Coins
  const learned = PK.patternLearned(archive, { pat: c.pat, iv: c.iv, dir: c.dir, sym: c.sym, mkt: c.mkt, model: c.model, profile: c.profile }, { baseline: Array.isArray(k) ? PK.patternBaseline(k) : null });
  return { pattern: PAT_NAMES[c.pat], symbol: c.sym, market: c.mkt === 'spot' ? 'Spot' : 'Futures', timeframe: c.iv, status: 'Ausbruch bestätigt', direction: c.dir, entry: c.p0, target: lv.tgt, invalid: lv.inv, quality: c.q, model: c.model || 'pat-1',
    learned, score: ev?.score, scoreWhy: ev?.summary,
    marks: ev?.marks || null, rr: ev?.rr ?? null, atr: ev?.atr ?? null, price: ev?.price ?? null, tc: c.tc, now: Number.isFinite(c.at) ? c.at : undefined,   // „Jetzt“ im Kurztext zur Erkennungszeit
    chart: (k ? SC.patternChartData(k, h) : null) || h.chart || null, ...(ev?.settings ? { settings: { ...PQ.patternCardSettings(ev.settings), minRR: ev.settings.minRR } } : {}) };
}
export const patternText = (c, h, archive = [], ev = null, k = null) => formatMessage('pattern', patternMessageData(c, h, archive, ev, k));
