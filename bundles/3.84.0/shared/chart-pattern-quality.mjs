// 3.77.5: Anzeige-Modell cpq-2 mit Rücktests. pat-1, Regelgüte, Alarme und Handelsmodelle unverändert.
import { patternChipState } from './chart-pattern-chips.mjs';
import { patternIsConfirmed, confirmedPatternLifecycle } from './pattern-lifecycle.mjs';
export { patternIsConfirmed } from './pattern-lifecycle.mjs';

export const PATTERN_QUALITY_CONFIG = Object.freeze({
  weights: Object.freeze({ form: 25, timeframe: 20, trend: 15, status: 15, volume: 10, location: 10, rewardRisk: 5 }),
  timeframes: Object.freeze({ '1m': .2, '5m': .3, '15m': .4, '1h': .55, '2h': .65, '4h': .75, '1d': .9, '1w': 1, '1M': 1 }),
  trendIntervals: Object.freeze(['5m', '15m', '1h', '4h', '1d']),
  overviewIntervals: Object.freeze(['5m', '15m', '1h', '2h', '4h', '1d', '1w']),
  status: Object.freeze({ aktiv: .5, bestätigt: 1, rücktest: 1, gescheitert: 0, erfüllt: 0, abgelaufen: 0, ungültig: 0 }),
  maxAge: 10, failedMultiplier: .3, fullRewardRisk: 3, levelDistanceAtr: 2,
  volumeDecline: .75, volumeIncrease: 1.25, fullBreakoutVolume: 2,
  conflictMinimumScore: 60, conflictShare: .65
});
const finite = Number.isFinite, positive = n => finite(n) && n > 0;
const clamp = n => Math.max(0, Math.min(1, n));
const decimal = n => n.toFixed(2).replace('.', ',');
const mean = rows => rows.length && rows.every(c => positive(c.volume)) ? rows.reduce((s, c) => s + c.volume, 0) / rows.length : null;
const direction = h => h.dir === 'bull' ? 1 : h.dir === 'bear' ? -1 : 0;

// Chips, Score und Projektionen teilen denselben kausalen Lebenszyklus.
export function patternLifecycle(hit, candles, { now = Date.now(), maxAge = PATTERN_QUALITY_CONFIG.maxAge, ageOffset = 0 } = {}) {
  const old = confirmedPatternLifecycle(hit, candles, { now, maxAge: maxAge - ageOffset, liveOffset: ageOffset }) || patternChipState(hit, candles, now, maxAge - ageOffset), confirmed = patternIsConfirmed(hit);
  old.age += ageOffset; // Hintergrundcache enthält nur geschlossene Kerzen; aktuelle Kerze mitzählen.
  return { ...old, confirmed };
}

function volumeFactor(hit, closed, confirmed, cfg) {
  const formation = closed.filter(c => c.time >= hit.t0 && c.time < hit.t1), half = Math.floor(formation.length / 2);
  const first = half >= 2 ? mean(formation.slice(0, half)) : null, second = half >= 2 ? mean(formation.slice(half)) : null;
  const decline = positive(first) && positive(second) ? clamp((cfg.volumeIncrease - second / first) / (cfg.volumeIncrease - cfg.volumeDecline)) : null;
  const i = closed.findIndex(c => c.time === hit.t1), avg = i >= 20 ? mean(closed.slice(i - 20, i)) : null;
  const breakout = confirmed && positive(avg) && positive(closed[i]?.volume)
    ? clamp((closed[i].volume / avg - cfg.volumeDecline) / (cfg.fullBreakoutVolume - cfg.volumeDecline)) : null;
  // Fehlende Hälfte erhält keine Punkte, nicht heimlich das Gewicht der anderen Hälfte.
  return { value: confirmed ? decline === null && breakout === null ? null : ((decline ?? 0) + (breakout ?? 0)) / 2 : decline,
    known: confirmed ? (Number(decline !== null) + Number(breakout !== null)) / 2 : Number(decline !== null),
    note: confirmed ? `Volumen: Formation ${decline === null ? 'fehlt' : second < first ? 'abnehmend' : 'nicht abnehmend'} · Ausbruch ${breakout === null ? 'fehlt' : decimal(closed[i].volume / avg) + '× Mittel der 20 Vorgänger'}` : `Formation: ${decline === null ? 'Volumen fehlt' : second < first ? 'Volumen abnehmend' : 'Volumen nicht abnehmend'}` };
}

// Fehlende Daten: null im Faktor, 0 Punkte, keine Umgewichtung; Abdeckung separat.
// Trendwerte sind exakt die vorhandenen Kauf-/Verkauf-/Halten-Chips, keine neue Trendregel.
export function chartPatternQuality(hit, candles, { interval, trends = {}, levels = {}, atr = null, now = Date.now(), ageOffset = 0, config = PATTERN_QUALITY_CONFIG } = {}) {
  const life = patternLifecycle(hit, candles, { now, maxAge: config.maxAge, ageOffset }), dir = direction(hit);
  const closed = candles.filter(c => c.closeTime < now), current = closed.at(-1)?.close;
  const entry = closed.find(c => c.time === hit.t1)?.close, inv = hit.levels?.inv, target = hit.levels?.tgt;
  const factors = [], add = (key, label, value, note, known = Number(value !== null)) => {
    const weight = config.weights[key]; factors.push({ key, label, value: value === null ? null : clamp(value), weight, points: (value === null ? 0 : clamp(value)) * weight, known, note });
  };
  add('form', 'Regelgüte · Form', finite(hit.q) ? hit.q / 100 : null, finite(hit.q) ? `${hit.q} % unverändert` : 'Regelgüte fehlt');
  add('timeframe', 'Zeitebene', config.timeframes[interval] ?? null, interval || 'Zeitebene fehlt');
  const votes = config.trendIntervals.map(iv => trends[iv]).filter(v => ['buy', 'sell', 'hold'].includes(v));
  const agreement = dir && votes.length ? votes.reduce((s, v) => s + (v === 'hold' ? .5 : (v === 'buy' ? 1 : -1) === dir ? 1 : 0), 0) / config.trendIntervals.length : null;
  add('trend', 'Trendübereinstimmung', agreement, dir ? `${votes.length}/${config.trendIntervals.length} Trend-Chips verfügbar · gleicher Trend 1, Halten ½, Gegentrend 0` : 'Neutrales Muster: keine Richtung bewertbar', dir ? votes.length / config.trendIntervals.length : 0);
  add('status', 'Zustand', config.status[life.status] ?? null, life.trap || life.status);
  const volume = volumeFactor(hit, closed, life.confirmed, config);
  add('volume', 'Volumen', volume.value, volume.note, volume.known);
  const level = dir > 0 ? levels.support : dir < 0 ? levels.resistance : null;
  const location = dir && positive(inv) && positive(level) && positive(atr) ? clamp(1 - Math.abs(inv - level) / (config.levelDistanceAtr * atr)) : null;
  add('location', 'Support / Widerstand', location, location === null ? 'Passendes Kurslevel oder ATR fehlt (ATR = typische Kerzenspanne)' : `Musterrand zum ${dir > 0 ? 'Support' : 'Widerstand'}: ${decimal(Math.abs(inv - level) / atr)} ATR · ATR = typische Kerzenspanne`);
  const reward = (target - current) * dir, risk = (current - inv) * dir;
  const rr = dir && positive(current) && positive(target) && positive(inv) && risk > 0 && reward > 0 ? reward / risk : null;
  add('rewardRisk', 'Chance / Risiko', rr === null ? null : rr / config.fullRewardRisk, rr === null ? 'Ziel / Gegenseite nicht sinnvoll bewertbar' : `Restziel / Musterrand: ${decimal(rr)} : 1 · volle Punkte ab ${config.fullRewardRisk} : 1`);
  const base = factors.reduce((s, f) => s + f.points, 0);
  // Bereits zurückgelegte Zielstrecke verliert Gewicht, auch bei langen Zeitebenen.
  // Referenz ist der tatsächliche Bestätigungsschluss, keine hypothetische Order.
  const distance = (target - entry) * dir;
  const remaining = life.confirmed && positive(current) && positive(entry) && positive(target) && distance > 0 ? clamp((target - current) * dir / distance) : null;
  const multiplier = life.status === 'gescheitert' ? config.failedMultiplier
    : ['erfüllt', 'ungültig', 'abgelaufen'].includes(life.status) ? 0 : remaining ?? 1;
  return { ...life, score: Math.round(base * multiplier), base, multiplier, remaining, rewardRisk: rr, factors,
    coverage: Math.round(factors.reduce((s, f) => s + f.weight * f.known, 0)), model: 'cpq-2', entry: positive(entry) ? entry : null, price: positive(current) ? current : null, live:false, targetPending:false, breakoutPending:false };
}

// Preisabhängige Teile billig aktualisieren; keine erneute Muster-/Volumen-/Trend-
// erkennung auf einem Tick. Live-Zielberührung wird bis zum Schluss kenntlich gemacht.
// Der bestätigte/terminale Status kommt ausschließlich aus patternLifecycle.
export function repricePatternQuality(q, hit, price, config = PATTERN_QUALITY_CONFIG, fresh = true) {
  if(!positive(price))return q;
  const dir=direction(hit),target=hit.levels?.tgt,inv=hit.levels?.inv;
  const reward=(target-price)*dir,risk=(price-inv)*dir,rr=dir&&positive(target)&&positive(inv)&&risk>0&&reward>0?reward/risk:null;
  const label=fresh?'Aktueller Kurs':'Letzter Chartkurs';
  const factors=q.factors.map(f=>f.key!=='rewardRisk'?f:{...f,value:rr===null?null:clamp(rr/config.fullRewardRisk),points:rr===null?0:clamp(rr/config.fullRewardRisk)*f.weight,known:Number(rr!==null),note:rr===null?`${label}: Ziel / Gegenseite nicht sinnvoll bewertbar`:`${label}: Restziel / Musterrand ${decimal(rr)} : 1 · volle Punkte ab ${config.fullRewardRisk} : 1`});
  const base=factors.reduce((s,f)=>s+f.points,0),distance=(target-q.entry)*dir;
  const remaining=q.confirmed&&positive(q.entry)&&positive(target)&&distance>0?clamp((target-price)*dir/distance):null;
  const multiplier=q.status==='gescheitert'?config.failedMultiplier:['erfüllt','ungültig','abgelaufen'].includes(q.status)?0:remaining??1;
  return {...q,score:Math.round(base*multiplier),base,multiplier,remaining,rewardRisk:rr,factors,coverage:Math.round(factors.reduce((s,f)=>s+f.weight*f.known,0)),price,live:true,priceFresh:fresh,
    targetPending:!q.disabled&&q.confirmed&&dir!==0&&positive(target)&&(price-target)*dir>=0,
    breakoutPending:!q.disabled&&q.confirmed&&dir!==0&&positive(q.breakoutBoundary)&&(price-q.breakoutBoundary)*dir<0};
}

export function sortPatternQuality(rows) {
  return [...rows].sort((a, b) => Number(a.disabled) - Number(b.disabled) || b.score - a.score || b.hit.q - a.hit.q || b.hit.t1 - a.hit.t1 || a.key.localeCompare(b.key));
}

// Prozentanteile der Score-Gewichte, ausdrücklich keine Zieltreffer-Wahrscheinlichkeit.
export function patternOverview(entries, config = PATTERN_QUALITY_CONFIG) {
  const unique = new Map();
  for (const e of entries) if (config.overviewIntervals.includes(e.interval) && !e.disabled && ['aktiv', 'bestätigt', 'rücktest'].includes(e.status) && ['bull', 'bear'].includes(e.hit.dir) && positive(e.score)) {
    const key = `${e.interval}|${e.hit.id}|${e.hit.t0}`; if (!unique.has(key) || unique.get(key).hit.t1 < e.hit.t1) unique.set(key, e);
  }
  const rows = [...unique.values()], sum = (arr, dir) => arr.filter(e => e.hit.dir === dir).reduce((s, e) => s + e.score, 0);
  const bull = sum(rows, 'bull'), bear = sum(rows, 'bear'), total = bull + bear;
  const side = arr => { const b = sum(arr, 'bull'), s = sum(arr, 'bear'), n = b + s; return n && b / n >= config.conflictShare ? 'bull' : n && s / n >= config.conflictShare ? 'bear' : null; };
  const strong = rows.filter(e => e.score >= config.conflictMinimumScore), high = side(strong.filter(e => ['1d', '1w'].includes(e.interval))), low = side(strong.filter(e => !['1d', '1w'].includes(e.interval)));
  return { bull: total ? Math.round(bull / total * 100) : null, bear: total ? 100 - Math.round(bull / total * 100) : null, count: rows.length, conflict: !!high && !!low && high !== low, high, low };
}
