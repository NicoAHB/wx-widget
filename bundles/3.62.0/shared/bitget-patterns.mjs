// G10(c): die unveränderte G09-Engine auf geschlossenen Bitget-Kerzen, unabhängig vom sichtbaren Chart.
import { patEngine } from '../server/pattern-engine.mjs';
import { BITGET_FRAMES } from './bitget-public.mjs';
import { closedCandles } from './confluence-core.mjs';

export const PATTERN_ADAPTER_VERSION = 'bg-patterns-1';
const engine = patEngine();
// Äquivalente Formen derselben Richtung/Ebene werden vom gemeinsamen Score nur einmal gewertet.
const families = {
  doji: 'doji', spinning_top: 'kreisel', doji_dragonfly: 'unterer-docht', hammer: 'unterer-docht', hanging_man: 'unterer-docht',
  doji_gravestone: 'oberer-docht', inverted_hammer: 'oberer-docht', shooting_star: 'oberer-docht',
  marubozu_bull: 'marubozu', marubozu_bear: 'marubozu', engulfing_bull: 'engulfing', engulfing_bear: 'engulfing',
  harami_bull: 'harami', harami_bear: 'harami', piercing: 'koerper-ruecklauf', dark_cloud: 'koerper-ruecklauf',
  tweezer_bottom: 'pinzette', tweezer_top: 'pinzette', morning_star: 'stern', evening_star: 'stern',
  three_white_soldiers: 'drei-kerzen', three_black_crows: 'drei-kerzen', double_top: 'mehrfach-extrem', double_bottom: 'mehrfach-extrem',
  triple_top: 'mehrfach-extrem', triple_bottom: 'mehrfach-extrem', head_shoulders: 'kopf-schulter', inv_head_shoulders: 'kopf-schulter',
  asc_triangle: 'dreieck', desc_triangle: 'dreieck', sym_triangle: 'dreieck', rising_wedge: 'keil', falling_wedge: 'keil',
  asc_channel: 'kanal', desc_channel: 'kanal', rectangle: 'rechteck', flag_bull: 'mast-konsolidierung', flag_bear: 'mast-konsolidierung',
  pennant_bull: 'mast-konsolidierung', pennant_bear: 'mast-konsolidierung', cup_handle: 'tasse-henkel'
};

export function bitgetPatterns({ source, rows, asOf }) {
  try {
    const periodMs = BITGET_FRAMES[source?.timeframe]?.periodMs;
    if (!periodMs || source.venue !== 'bitget' || source.product !== 'USDT-FUTURES' || source.quote !== 'USDT' || !/^[A-Z0-9]+USDT$/.test(source.instrument || '') || !Array.isArray(rows) || rows.length > 512) throw new Error('Bitget-Musterquelle fehlt/ist ungültig');
    const closed = closedCandles(rows, asOf, periodMs);
    if (closed.length < 40 || closed.at(-1).end !== Math.floor(asOf / periodMs) * periodMs) throw new Error('Aktuelle geschlossene Bitget-Musterkerzen fehlen');
    const k = closed.map(c => ({ t: c.time, o: c.open, h: c.high, l: c.low, c: c.close, v: c.volume }));
    const detected = engine.detect(k, { from: Math.max(0, k.length - 500), step: periodMs, gap: false, running: false });
    const latest = new Map();
    for (const h of detected.hits) {
      if (h.prelim || !Object.hasOwn(families, h.id) || h.status === 'nicht bestätigt') continue;
      const confirmed = h.status === 'bestätigt' || h.status === 'abgeschlossen' || /^Ausbruch.*bestätigt$/.test(h.status);
      // Kerzen: zuletzt abgeschlossen oder erst mit letzter Folgekerze bestätigt.
      // Formationen: frischer Ausbruch (wie C6b); aktuell noch gültige Bildung bleibt halbes Gewicht.
      const endIndex = h.kind === 'candle' && h.status === 'bestätigt' ? h.i1 + 1 : h.i1;
      if ((h.kind === 'candle' && endIndex !== k.length - 1) || (h.kind === 'form' && confirmed && h.i1 < k.length - 2)) continue;
      const previous = latest.get(h.id);
      if (previous && previous.i1 >= h.i1) continue;
      latest.set(h.id, h);
    }
    const knownAt = Math.max(...closed.map(c => c.knownAt));
    const hits = [...latest.values()];
    const patterns = hits.map(h => {
      const confirmed = h.status === 'bestätigt' || h.status === 'abgeschlossen' || /^Ausbruch.*bestätigt$/.test(h.status);
      const endIndex = h.kind === 'candle' && h.status === 'bestätigt' ? h.i1 + 1 : h.i1;
      // Die Geometrie kann spätere Pivotbestätigung brauchen: Kenntnis niemals auf t1 zurückdatieren.
      const closedAt = h.kind === 'form' ? closed.at(-1).end : closed[endIndex].end;
      return { id: h.id, family: families[h.id], direction: h.dir === 'bull' ? 1 : h.dir === 'bear' ? -1 : 0,
        quality: h.q, timeframe: source.timeframe, confirmed, provisional: false, from: h.t0, to: h.t1,
        closedAt, knownAt: Math.max(closedAt, knownAt), source: globalThis.structuredClone(source), modelVersion: detected.ver,
        adapterVersion: PATTERN_ADAPTER_VERSION, hit: globalThis.structuredClone(h) };
    });
    return { status: 'bereit', patterns, hits, ver: detected.ver, adapterVersion: PATTERN_ADAPTER_VERSION, knownAt, closedAt: closed.at(-1).end };
  } catch (e) { return { status: 'nicht bewertbar', patterns: null, reason: e.message }; }
}

export function attachBitgetPatterns(data, saved) {
  if (!data?.scope || !saved?.series) return { status: 'nicht bewertbar', data: null, reason: 'Bitget-Snapshot für Muster fehlt' };
  const keys = ['venue', 'product', 'instrument', 'quote', 'timeframe', 'contextTimeframe', 'horizon', 'modelVersion', 'settingsRevision', 'parametersKey', 'maxHoldMs', 'slippageBps'];
  if (['base', 'context'].some(role => {
    const a = saved.series[role]?.source, b = data[role]?.source;
    return !a || !b || keys.some(k => a[k] !== b[k]) || a.indicatorAnchors?.base !== b.indicatorAnchors?.base || a.indicatorAnchors?.context !== b.indicatorAnchors?.context;
  })) return { status: 'nicht bewertbar', data: { ...data, patterns: null }, reason: 'Musterkerzen gehören zu anderem Markt/Modell/Parametern' };
  const results = ['base', 'context'].map(role => bitgetPatterns({ ...saved.series[role], asOf: data.scope.asOf }));
  const unavailable = results.find(r => r.status !== 'bereit');
  return unavailable ? { ...unavailable, data: { ...data, patterns: null } }
    : { status: 'bereit', data: { ...data, patterns: results.flatMap(r => r.patterns) }, results };
}
