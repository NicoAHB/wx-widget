// G11: begrenzte zustandsbehaftete Kerzenverarbeitung, gleicher Kern in Worker und Dienst.
import { createIndicatorState, advanceIndicators, confirmedPivots } from './indicators.mjs';
import { PO3_VERSION, PO3_FRAMES, po3Settings, po3Key, po3Bias, accumulation, manipulation, po3Fvg, po3Retest, po3Impulse, po3Levels, po3Score, po3Size, fvgOverlaps } from './po3-core.mjs';
import { po3Signal, advancePo3Signal } from './po3-simulator.mjs';
export const PO3_LIMITS = Object.freeze({ journal: 2000, journalBytes: 12 * 1024 * 1024, streams: 40, streamBytes: 12 * 1024 * 1024, zones: 500, tail: 128 });
const clone = x => JSON.parse(JSON.stringify(x));
export const po3Frames = config => [...new Set([config.contextOn ? config.context : null, config.bias, config.setup, config.entry].filter(Boolean))];
export function createPo3Stream({ instrument, config, window, anchors, source }) {
  const p = po3Settings(config);
  if (!/^[A-Z0-9]{2,20}USDT$/.test(instrument || '') || !window || !Number.isSafeInteger(window.from) || !Number.isSafeInteger(window.to) || window.from >= window.to || !source?.dataRevision) throw new Error('PO3-Markt/Zeitfenster/Datenrevision fehlt');
  const series = {};
  for (const tf of po3Frames(p)) { const periodMs = PO3_FRAMES[tf], anchor = anchors?.[tf];
    if (!Number.isSafeInteger(anchor) || anchor < 0 || anchor % periodMs || anchor > window.from) throw new Error('PO3-Warm-up-Anker ungültig');
    series[tf] = { indicator: createIndicatorState({ time: anchor, periodMs }), rows: [], values: [], pivots: [], periodPivots: [] };
  }
  return { version: PO3_VERSION, parametersKey: po3Key(p), instrument, config: { ...p }, window: { ...window }, anchors: { ...anchors }, source: clone(source), series, zones: [], mechanical: {}, checklist: {}, lastAt: 0 };
}
function addPivot(pool, pivot) { pool.push(pivot); for (const type of ['low', 'high']) { const own = pool.filter(x => x.type === type); for (const old of own.slice(0, -2)) pool.splice(pool.indexOf(old), 1); } }
function snapshot(stream, tf, context = false) { const s = stream.series[tf], last = s.rows.at(-1), value = s.values.at(-1); return po3Bias({ pivots: context ? s.pivots : s.periodPivots, price: last?.close, ema50: value?.ema50, asOf: last?.end }); }
function structure(stream, direction) { const pivots = stream.series[stream.config.entry].periodPivots; return { swing: pivots.filter(p => p.type === (direction === 1 ? 'low' : 'high')).at(-1), counter: pivots.filter(p => p.type === (direction === 1 ? 'high' : 'low')).at(-1) }; }
export function advancePo3Stream(saved, frames, { asOf, window = saved.window, contract, funding = null, sizing = {}, fx = null, journal = [] } = {}) {
  if (saved?.version !== PO3_VERSION || saved.parametersKey !== po3Key(saved.config) || !Number.isSafeInteger(asOf) || !window || window.from >= window.to || window.to > asOf || window.from < saved.window.from) throw new Error('Fremder/beschädigter PO3-Zustand/Zeitfenster');
  const s = clone(saved), p = s.config, records = new Map(journal.map(x => [x.id, clone(x)])), created = [], warnings = [];
  if (window.from !== s.window.from) { if (s.mechanical.box?.from < window.from) s.mechanical = {}; for (const f of Object.values(s.series)) f.periodPivots = f.periodPivots.filter(x => x.time >= window.from); }
  s.window = { ...window };
  const events = Object.entries(frames).flatMap(([tf, rows]) => rows.map(c => ({ tf, c }))).sort((a, b) => a.c.end - b.c.end || PO3_FRAMES[b.tf] - PO3_FRAMES[a.tf]);
  for (const { tf, c: raw } of events) {
    const period = PO3_FRAMES[tf]; if (!period || raw.end > asOf || raw.knownAt > asOf) continue;
    // Journalfälle behalten ihre eingefrorene Entryebene auch nach Auswahlwechsel.
    for (const [id, record] of records) if (record.modelVersion === PO3_VERSION && record.instrument === s.instrument && record.config.entry === tf && ['Aktiv', 'Offen'].includes(record.status)) records.set(id, advancePo3Signal(record, [raw], asOf));
    const f = s.series[tf]; if (!f) continue;
    if (raw.time < f.indicator.nextTime) { const old = f.rows.find(x => x.time === raw.time); if (old && ['open', 'high', 'low', 'close', 'volume'].some(k => old[k] !== raw[k])) throw new Error('PO3-Preiskonflikt: Original bleibt erhalten'); continue; }
    const c = { ...raw, knownAt: raw.end }, advanced = advanceIndicators(f.indicator, [c], c.end), value = advanced.values[0], before = f.rows.slice(), previous = f.values.at(-1);
    f.indicator = advanced.state; f.rows.push(c); f.values.push(value); f.rows = f.rows.slice(-PO3_LIMITS.tail); f.values = f.values.slice(-PO3_LIMITS.tail);
    const lastFive = f.rows.slice(-5), pivots = lastFive.length === 5 ? confirmedPivots(lastFive, c.end, period) : [];
    for (const pivot of pivots) { const own = { ...pivot, index: f.indicator.count - 3, confirmedIndex: f.indicator.count - 1 }; addPivot(f.pivots, own); if (lastFive[0].time >= window.from) addPivot(f.periodPivots, own); }
    for (const zone of s.zones.filter(z => z.timeframe === tf && z.filledAt === null && c.time >= z.confirmedAt)) if (zone.direction === 1 ? c.low <= zone.low : c.high >= zone.high) zone.filledAt = c.end;
    // Nur aktuelle FVG-Referenzen; archivierte Signale tragen ihre vollständige Originalzone.
    s.zones = s.zones.filter(z => z.filledAt === null);
    const z = po3Fvg(f.rows.slice(-3), { timeframe: tf, atr: value.atr, instrument: s.instrument });
    if (z && !s.zones.some(old => old.id === z.id)) { if (s.zones.length >= PO3_LIMITS.zones) throw new Error('PO3-Zonenspeicher voll; Analyse pausiert, keine Originalfälle gelöscht'); s.zones.push(z); }
    s.lastAt = Math.max(s.lastAt, c.end);
    if (c.time < window.from || c.end > window.to) continue;
    const m = s.mechanical;
    if (tf === p.setup) {
      if (!m.setupSweep) { const box = accumulation(before.filter(x => x.time >= window.from), previous?.atr, p), sweep = manipulation(box, c);
        if (box) m.box = box;
        if (sweep?.direction) { m.box = { ...box }; m.setupSweep = sweep; m.setupATR = value.atr; } else if (sweep?.ambiguous) warnings.push('Beide Boxseiten gesweept: kein Setup.');
      } else if (!m.zone) { const candidate = po3Fvg(f.rows.slice(-3), { timeframe: tf, atr: value.atr, instrument: s.instrument, after: m.setupSweep.at });
        if (candidate?.direction === m.setupSweep.direction) m.zone = candidate;
      } else if (!m.retestAt && po3Retest(m.zone, c)) { m.retestAt = c.end; const own = structure(s, m.setupSweep.direction); if (own.swing && own.counter) m.entryStructure = clone(own); }
    }
    if (tf !== p.entry || !m.retestAt || c.time < m.retestAt) continue;
    const d = m.setupSweep.direction;
    if (!m.entryStructure) { const own = structure(s, d); if (own.swing && own.counter) m.entryStructure = clone(own); }
    if (!m.entryStructure) continue;
    if (!m.entrySweep) { const pivot = m.entryStructure.swing.price, swept = d === 1 ? c.low < pivot && c.close > pivot : c.high > pivot && c.close < pivot;
      const crossedBoth = c.low < Math.min(pivot, m.entryStructure.counter.price) && c.high > Math.max(pivot, m.entryStructure.counter.price);
      if (swept && !crossedBoth) m.entrySweep = { extreme: d === 1 ? c.low : c.high, time: c.time, at: c.end }; continue;
    }
    if (c.time < m.entrySweep.at) continue;
    const invalidation = p.stop === 'eng' ? m.entrySweep.extreme : m.setupSweep.extreme;
    if (d * (c.close - invalidation) < 0) { warnings.push('Setup vor Entry durch Kerzenschluss ungültig.'); s.mechanical = {}; continue; }
    if (!po3Impulse(f.rows, d, m.entryStructure.counter.price, p)) continue;
    const bias = snapshot(s, p.bias), context = p.contextOn ? snapshot(s, p.context, true) : { direction: 0 }, contextZones = p.contextOn ? s.zones.filter(x => x.timeframe === p.context) : [];
    const avg = before.slice(-20).length === 20 ? before.slice(-20).reduce((a, x) => a + x.volume, 0) / 20 : null;
    const rsi = value.rsi == null || previous?.rsi == null ? null : d === 1 ? value.rsi >= 30 && value.rsi <= 45 && value.rsi > previous.rsi : value.rsi >= 55 && value.rsi <= 70 && value.rsi < previous.rsi;
    const fresh = c.end === Math.floor(asOf / period) * period;
    const rate = fresh && funding?.knownAt <= asOf && funding.intervalHours > 0 ? funding.rate * 8 / funding.intervalHours : null;
    const score = po3Score({ direction: d, sweep: true, retest: true, impulse: true, bias: bias.direction, contextBias: context.direction,
      contextFvg: contextZones.some(x => x.direction === d && m.zone.low >= x.low && m.zone.high <= x.high), volume: avg === null ? null : c.volume > 1.5 * avg, rsi, funding: rate === null ? null : d * rate < .0005 }, p);
    const levels = po3Levels({ candle: c, direction: d, sweep: m.entrySweep, setupSweep: m.setupSweep, entryATR: value.atr, setupATR: m.setupATR,
      box: m.box, tickSize: contract?.tickSize, contextLevels: p.contextOn ? [...s.series[p.context].pivots, ...contextZones.flatMap(x => [{ price: x.low }, { price: x.high }])] : [] }, p);
    s.checklist = { bias, context, box: clone(m.box), sweep: true, retest: true, impulse: true, score, levels, at: c.end,
      action: !p.closure ? 'Schließmodell wählen; noch keine Journalsignale.' : !score.eligible ? 'Score unter 70: abwarten.' : levels.status !== 'bereit' ? levels.reason : 'Hypothetischer Preisplan; Ausführung und Cross-Abstand nicht bestätigt.' };
    if (p.closure && score.eligible && levels.status === 'bereit') {
      const own = po3Signal({ instrument: s.instrument, levels, confirmedAt: c.end, sweep: m.entrySweep, setupSweep: m.setupSweep, zone: m.zone, score, box: m.box,
        source: { ...s.source, origin: fresh ? 'beobachtet' : 'rekonstruiert', observedAt: asOf, priceKnowledge: 'modelliert am Kerzenschluss', dataRevision: s.source.dataRevision, anchors: { ...s.anchors } },
        sizing: po3Size({ ...sizing, levels, quantityStep: contract?.quantityStep }, p), fx }, p);
      if (!records.has(own.id)) { records.set(own.id, own); created.push(own.id); }
    }
    if (contextZones.some(x => x.direction === -d && c.close >= x.low - value.atr && c.close <= x.high + value.atr)) warnings.push('Große Kontext-Gegenzone nahe Entry: Einstieg prüfen.');
    s.mechanical = {};
  }
  if (!s.checklist.at || s.checklist.at < s.lastAt) { const m = s.mechanical; s.checklist = { bias: snapshot(s, p.bias), context: p.contextOn ? snapshot(s, p.context, true) : null,
    box: m.box ?? null, sweep: !!m.setupSweep, retest: !!m.retestAt, impulse: false, action: !m.box ? 'Auf enge Akkumulationsbox warten.' : !m.setupSweep ? 'Auf Sweep mit Rückschluss in die Box warten.' : !m.zone ? 'Auf drei neue Setupkerzen mit FVG warten.' : !m.retestAt ? 'Auf späteren FVG-Retest warten.' : !m.entryStructure ? 'Entry-Struktur noch unvollständig.' : !m.entrySweep ? 'Auf neuen Entry-Sweep warten.' : 'Auf spätere Impulskerze und Strukturbruch warten.' }; }
  const result = [...records.values()];
  if (result.length > PO3_LIMITS.journal || new TextEncoder().encode(JSON.stringify(result)).length > PO3_LIMITS.journalBytes) throw new Error('PO3-Journal voll; erst sichern und bewusst löschen');
  return { stream: s, journal: result, created, warnings: [...new Set(warnings)], chartRows: s.series[p.entry].rows.slice(-80) };
}
export function po3AlarmCandidates(stream, { selected = [stream.config.setup, stream.config.bias] } = {}) {
  const unique = [...new Set(selected)], zones = stream.zones.filter(z => z.alarmEligible && z.filledAt === null), overlap = unique.length >= 2 ? fvgOverlaps(zones, unique) : [];
  const c = stream.series[stream.config.entry].rows.at(-1), atr = stream.series[stream.config.entry].values.at(-1)?.atr;
  if (!c || !(atr > 0)) return [];
  return overlap.filter(z => c.close >= z.low - stream.config.approachATR * atr && c.close <= z.high + stream.config.approachATR * atr).map(z => ({ ...z, stage: 1, at: c.end, price: c.close, instrument: stream.instrument, invalidation: z.direction === 1 ? z.low : z.high }));
}
