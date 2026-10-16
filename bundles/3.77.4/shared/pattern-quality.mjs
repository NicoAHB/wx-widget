// 3.69.0 / Dienst 2.13.0: Qualitätsfilter für Chartmuster-Meldungen an Telegram – gemeinsam für App und Oracle-Dienste.
// Sitzt zwischen Mustererkennung (pat-1-Engine) und Telegram-Versand. Reine Rechenlogik ohne Netzwerk: Die Aufrufer liefern
// Kerzen, Kerzen des nächsthöheren Zeitrahmens, BTC-Kerzen und Liquiditätswerte. Kursalarme, Trades und Sicherung berührt
// das Modul nicht. Ein Signal geht nur raus, wenn alle K.O.-Kriterien erfüllt sind, der Signalscore die Mindestgrenze
// erreicht und die Anti-Spam-Regeln es zulassen. Jedes Signal (gesendet oder gefiltert) wird mit Grund protokolliert.

import { intervalEnd, INTERVAL_MS } from './market-intervals.mjs';

// ---- Einstellungen ----
export const PATTERN_FILTER_VERSION = 1;
// 3.71.0: Signalkarte – Gesamturteil nach Score (unter weakBelow „Schwach“, ab strongFrom „Stark“, dazwischen „Mittel“), Einstieg
// verpasst ab missedPct % hinter dem Einstieg, Einstieg gültig validCandles Kerzen nach dem Bestätigungsschluss. Schwache Signale
// gehen nur mit sendWeak an Telegram. Gelten in jedem Preset (wie der Gegentrend-Schalter) und gehen mit dem Filter an die Dienste.
export const PATTERN_CARD_DEFAULTS = Object.freeze({ weakBelow: 40, strongFrom: 70, missedPct: 0.3, validCandles: 6, sendWeak: false });
export const PATTERN_CARD_FIELDS = Object.freeze([
  { key: 'weakBelow', label: 'Schwaches Signal unter Score', unit: '/100', min: 1, max: 99, step: 1 },
  { key: 'strongFrom', label: 'Starkes Signal ab Score', unit: '/100', min: 2, max: 100, step: 1 },
  { key: 'missedPct', label: 'Einstieg verpasst, wenn der Kurs mehr als … hinter dem Einstieg liegt', unit: '%', min: 0.05, max: 5, step: 0.05 },
  { key: 'validCandles', label: 'Einstieg gültig für', unit: 'Kerzen des Intervalls', min: 1, max: 48, step: 1 }
]);
export function patternCardSettings(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}, out = {};
  for (const f of PATTERN_CARD_FIELDS) { const v = Number(r[f.key] ?? PATTERN_CARD_DEFAULTS[f.key]); out[f.key] = Number.isFinite(v) ? Math.min(f.max, Math.max(f.min, v)) : PATTERN_CARD_DEFAULTS[f.key]; }
  out.weakBelow = Math.round(out.weakBelow); out.validCandles = Math.round(out.validCandles); out.strongFrom = Math.round(out.strongFrom);
  if (out.strongFrom <= out.weakBelow) out.strongFrom = Math.min(100, out.weakBelow + 1);
  out.sendWeak = r.sendWeak === true;
  return out;
}
// Ende des Einstiegsfensters: Schluss der Bestätigungskerze (Beginn tc) plus n Kerzen des Intervalls (Kalendermonate genau)
export function patternValidUntil(tc, iv, n = PATTERN_CARD_DEFAULTS.validCandles) {
  if (!Number.isFinite(tc) || !INTERVAL_MS[iv]) return null;
  let e = intervalEnd(tc, iv); for (let i = 0; i < n; i++) e = intervalEnd(e, iv);
  return e;
}
// 3.70.2: Schwellen gesenkt – im Betrieb lag Chance/Risiko bestätigter pat-1-Muster meist bei 0,2–1,6 und der Score bei 20–60;
// mit R/R ≥ 2 (Normal) bzw. ≥ 1,8 (Locker) kam praktisch keine Meldung mehr an.
export const PATTERN_FILTER_PRESETS = Object.freeze({
  streng: Object.freeze({ minScore: 70, minRR: 1.5, maxAge: 2, maxProgress: 35, minTargetAtr: 3, minFeeMultiple: 4, minVolume24h: 20, maxSpread: 0.05, counterTrend: false, cooldownMin: 90, oppositeMin: 120, maxPerHour: 2, feeSpot: 0.1, feeFutures: 0.05 }),
  normal: Object.freeze({ minScore: 55, minRR: 1.2, maxAge: 3, maxProgress: 50, minTargetAtr: 2.5, minFeeMultiple: 3, minVolume24h: 5, maxSpread: 0.1, counterTrend: false, cooldownMin: 60, oppositeMin: 60, maxPerHour: 3, feeSpot: 0.1, feeFutures: 0.05 }),
  locker: Object.freeze({ minScore: 40, minRR: 0.8, maxAge: 4, maxProgress: 65, minTargetAtr: 1.5, minFeeMultiple: 2, minVolume24h: 1, maxSpread: 0.2, counterTrend: false, cooldownMin: 30, oppositeMin: 30, maxPerHour: 5, feeSpot: 0.1, feeFutures: 0.05 })
});
export const PATTERN_FILTER_PRESET_NAMES = Object.freeze({ streng: 'Streng', normal: 'Normal', locker: 'Locker', eigen: 'Eigene Werte' });
// Felder für den Einstellungsdialog (Bereich, Schritt, Einheit) – dieselben Grenzen prüft patternFilterSettings.
export const PATTERN_FILTER_FIELDS = Object.freeze([
  { key: 'minScore', label: 'Mindest-Signalscore', unit: '/100', min: 0, max: 100, step: 1 },
  { key: 'minRR', label: 'Chance/Risiko mindestens', unit: ': 1', min: 0.5, max: 10, step: 0.1 },
  { key: 'maxAge', label: 'Signal höchstens … Kerzen alt', unit: 'Kerzen', min: 0, max: 10, step: 1 },
  { key: 'maxProgress', label: 'Weg zum Ziel höchstens gelaufen', unit: '%', min: 0, max: 100, step: 5 },
  { key: 'minTargetAtr', label: 'Zielabstand mindestens', unit: '× ATR(14)', min: 0, max: 10, step: 0.1 },
  { key: 'minFeeMultiple', label: 'Ziel mindestens … × Gebühren + Spread', unit: '×', min: 0, max: 20, step: 0.5 },
  { key: 'minVolume24h', label: 'Mindest-24h-Volumen', unit: 'Mio. USDT', min: 0, max: 100000, step: 1 },
  { key: 'maxSpread', label: 'Maximaler Spread', unit: '%', min: 0.001, max: 5, step: 0.01 },
  { key: 'cooldownMin', label: 'Je Coin und Zeitrahmen höchstens 1 Meldung je', unit: 'Min.', min: 0, max: 1440, step: 5 },
  { key: 'oppositeMin', label: 'Gegensätzliche Signale sperren für', unit: 'Min.', min: 0, max: 1440, step: 5 },
  { key: 'maxPerHour', label: 'Höchstens Meldungen je Stunde', unit: 'insgesamt', min: 1, max: 60, step: 1 },
  { key: 'feeSpot', label: 'Gebühr Spot je Seite', unit: '%', min: 0, max: 1, step: 0.005 },
  { key: 'feeFutures', label: 'Gebühr Futures je Seite', unit: '%', min: 0, max: 1, step: 0.005 }
]);
export function patternFilterSettings(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}, preset = Object.hasOwn(PATTERN_FILTER_PRESETS, r.preset) ? r.preset : r.preset === 'eigen' ? 'eigen' : 'normal';
  const base = PATTERN_FILTER_PRESETS[preset === 'eigen' ? 'normal' : preset], out = { preset };
  const src = preset === 'eigen' ? r : base;   // ein benanntes Preset gilt vollständig; eigene Werte nur unter „eigen“
  for (const f of PATTERN_FILTER_FIELDS) { const v = Number(src[f.key] ?? base[f.key]); out[f.key] = Number.isFinite(v) ? Math.min(f.max, Math.max(f.min, v)) : base[f.key]; }
  out.counterTrend = r.counterTrend === true;   // Gegentrend-Signale standardmäßig aus – eigener Schalter in jedem Preset
  return Object.assign(out, patternCardSettings(r));   // 3.71.0: Signalkarte, unabhängig vom Preset
}
// Der Gegentrend-Schalter gilt in jedem Preset; eigene Werte entstehen, sobald ein Feld vom Preset abweicht.
export function patternFilterFromForm(values, preset) {
  const p = Object.hasOwn(PATTERN_FILTER_PRESETS, preset) ? preset : 'eigen', base = PATTERN_FILTER_PRESETS[p === 'eigen' ? 'normal' : p];
  const differs = PATTERN_FILTER_FIELDS.some(f => values[f.key] !== undefined && Math.abs(Number(values[f.key]) - base[f.key]) > 1e-9);
  return patternFilterSettings({ ...values, preset: differs ? 'eigen' : p, counterTrend: values.counterTrend === true });   // Kartenwerte (weakBelow …) laufen mit
}

// ---- Zeitrahmen ----
// Nächsthöherer Zeitrahmen für den Trendfilter (Vorgabe: 5m→1h, 15m→1h, 1h→4h; übrige sinngemäß).
export const HIGHER_TIMEFRAME = Object.freeze({ '1m': '15m', '3m': '1h', '5m': '1h', '15m': '1h', '30m': '4h', '1h': '4h', '2h': '1d', '4h': '1d', '1d': '1w', '1w': '1M' });
const STEP_MS = { '1m': 6e4, '3m': 18e4, '5m': 3e5, '15m': 9e5, '30m': 18e5, '1h': 36e5, '2h': 72e5, '4h': 144e5, '1d': 864e5, '1w': 6048e5, '1M': 2592e6 };
// Dreiecke, Keile, Wimpel und Rechtecke: Marktphase über Bollinger-Squeeze vor dem Ausbruch; alle übrigen über ADX > 20.
export const SQUEEZE_PATTERNS = Object.freeze(['asc_triangle', 'desc_triangle', 'sym_triangle', 'rising_wedge', 'falling_wedge', 'pennant_bull', 'pennant_bear', 'rectangle']);

// ---- Indikatoren (unabhängig von der App, damit der Dienst dieselben Werte rechnet) ----
const fin = Number.isFinite;
export function emaSeries(values, n) {
  const out = new Array(values.length).fill(NaN); if (values.length < n) return out;
  let s = 0; for (let i = 0; i < n; i++) s += values[i]; let e = s / n; out[n - 1] = e; const a = 2 / (n + 1);
  for (let i = n; i < values.length; i++) { e = values[i] * a + e * (1 - a); out[i] = e; }
  return out;
}
export function atrSeries(k, n = 14) {
  const out = new Array(k.length).fill(NaN); if (k.length <= n) return out;
  const tr = k.map((x, i) => i ? Math.max(x.h - x.l, Math.abs(x.h - k[i - 1].c), Math.abs(x.l - k[i - 1].c)) : x.h - x.l);
  let a = tr.slice(1, n + 1).reduce((s, v) => s + v, 0) / n; out[n] = a;
  for (let i = n + 1; i < k.length; i++) { a = (a * (n - 1) + tr[i]) / n; out[i] = a; }
  return out;
}
export function adxSeries(k, n = 14) {
  const out = new Array(k.length).fill(NaN); if (k.length < 2 * n + 1) return out;
  let tr = 0, pdm = 0, ndm = 0; const dx = [];
  for (let i = 1; i < k.length; i++) {
    const up = k[i].h - k[i - 1].h, dn = k[i - 1].l - k[i].l, t = Math.max(k[i].h - k[i].l, Math.abs(k[i].h - k[i - 1].c), Math.abs(k[i].l - k[i - 1].c));
    const p = up > dn && up > 0 ? up : 0, m = dn > up && dn > 0 ? dn : 0;
    if (i <= n) { tr += t; pdm += p; ndm += m; if (i < n) continue; } else { tr = tr - tr / n + t; pdm = pdm - pdm / n + p; ndm = ndm - ndm / n + m; }
    const pdi = tr ? 100 * pdm / tr : 0, ndi = tr ? 100 * ndm / tr : 0; dx[i] = pdi + ndi ? 100 * Math.abs(pdi - ndi) / (pdi + ndi) : 0;
    if (i === 2 * n - 1) out[i] = dx.slice(n, 2 * n).reduce((s, v) => s + v, 0) / n;
    else if (i >= 2 * n) out[i] = (out[i - 1] * (n - 1) + dx[i]) / n;
  }
  return out;
}
export function bbWidthSeries(closes, n = 20, mult = 2) {
  const out = new Array(closes.length).fill(NaN);
  for (let i = n - 1; i < closes.length; i++) { const w = closes.slice(i - n + 1, i + 1), m = w.reduce((s, v) => s + v, 0) / n, sd = Math.sqrt(w.reduce((s, v) => s + (v - m) ** 2, 0) / n); out[i] = m ? 2 * mult * sd / m : NaN; }
  return out;
}
// Trend eines Zeitrahmens: Kurs zur EMA 200 und Steigung der EMA 50 (über 5 Kerzen). dir +1/−1 nur, wenn beides zusammenpasst.
export function trendOf(k) {
  if (!Array.isArray(k) || k.length < 205) return null;
  const c = k.map(x => x.c), e200 = emaSeries(c, 200), e50 = emaSeries(c, 50), i = c.length - 1;
  const above = c[i] > e200[i] ? 1 : c[i] < e200[i] ? -1 : 0, slope = (e50[i] - e50[i - 5]) / e50[i - 5], rising = slope > 0 ? 1 : slope < 0 ? -1 : 0;
  return { dir: above === rising ? above : 0, above, rising, price: c[i], ema200: e200[i], ema50: e50[i], slope };
}
const agree = (t, sign) => t ? (t.above === sign) + (t.rising === sign) : null;   // 0, 1 oder 2 Kriterien passen
// 24h-Volumen in USDT aus den Kerzen (Basisvolumen × Schlusskurs); längere Zeitrahmen anteilig.
export function volume24hFromCandles(k, iv) {
  const step = STEP_MS[iv]; if (!k?.length || !step) return NaN;
  if (step >= 864e5) { const x = k.at(-1); return x.v * x.c * 864e5 / step; }
  return k.slice(-Math.round(864e5 / step)).reduce((s, x) => s + x.v * x.c, 0);
}
const de = (v, d = 1) => fin(v) ? v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---- Bewertung eines Signals: K.O.-Kriterien und Signalscore 0–100 ----
// c: Musterfall (sym, mkt, iv, pat, dir, p0, q, tc), h: Treffer der Engine (levels brk/tgt/inv, status, i1), k: abgeschlossene
// Kerzen des Signal-Zeitrahmens {t,o,h,l,c,v}, i1: Index der Ausbruchskerze in k, price: aktueller Kurs (sonst letzter Schluss),
// higher/btc: Kerzen des nächsthöheren Zeitrahmens (Coin bzw. BTC), liquidity: { volume24h (USDT), spreadPct }, hits: { n, wins }
// abgeschlossene Fälle dieses Musters im Zeitrahmen.
export function evaluatePatternSignal({ c, h, k, i1 = h?.i1, price = null, higher = null, btc = null, liquidity = {}, hits = null, settings = null }) {
  const s = patternFilterSettings(settings), sign = c.dir === 'bull' ? 1 : -1, lv = h?.levels || {}, last = k.length - 1;
  const entry = fin(c.p0) ? c.p0 : k[i1]?.c, target = lv.tgt, invalid = lv.inv, brk = lv.brk, px = fin(price) ? price : k[last]?.c;
  const risk = sign * (entry - invalid), reward = sign * (target - entry), rr = risk > 0 && reward > 0 ? reward / risk : 0;
  const atr = atrSeries(k, 14)[i1], age = last - i1, progress = reward > 0 ? sign * (px - entry) / reward : 1;
  const fee = c.mkt === 'spot' ? s.feeSpot : s.feeFutures, spread = fin(liquidity.spreadPct) ? liquidity.spreadPct : null, costs = 2 * fee + (spread ?? 0), targetPct = reward > 0 ? reward / entry * 100 : 0;
  const volume24h = fin(liquidity.volume24h) ? liquidity.volume24h : volume24hFromCandles(k.slice(0, last + 1), c.iv);
  const htf = HIGHER_TIMEFRAME[c.iv] || null, ht = trendOf(higher), isBtc = /^BTC/.test(c.sym), bt = isBtc ? null : trendOf(btc);
  const ko = [], add = (key, text) => ko.push({ key, text });
  // 1) K.O.-Kriterien
  if (!(rr >= s.minRR)) add('rr', `Chance/Risiko ${de(rr, 2)} : 1 unter ${de(s.minRR, 1)} : 1`);
  const confirmed = /^Ausbruch/.test(h?.status || '') && fin(brk) && fin(k[i1]?.c) && sign * (k[i1].c - brk) > 0;
  if (!confirmed) add('breakout', 'Ausbruch nicht per Schlusskurs außerhalb der Musterlinie bestätigt');
  if (age > s.maxAge) add('age', `Signal ${age} Kerzen alt (höchstens ${s.maxAge})`);
  if (progress * 100 > s.maxProgress) add('progress', `Kurs schon ${de(progress * 100, 0)} % des Wegs zum Ziel gelaufen (höchstens ${de(s.maxProgress, 0)} %)`);
  if (!(fin(atr) && reward >= s.minTargetAtr * atr)) add('atr', `Zielabstand ${fin(atr) && atr > 0 ? de(reward / atr, 1) : '–'} × ATR(14) unter ${de(s.minTargetAtr, 1)} ×`);
  if (!(targetPct >= s.minFeeMultiple * costs)) add('fees', `Ziel ${de(targetPct, 2)} % unter ${de(s.minFeeMultiple, 1)} × Gebühren + Spread (${de(costs, 3)} %)`);
  if (fin(volume24h) && volume24h < s.minVolume24h * 1e6) add('volume24h', `24h-Volumen ${de(volume24h / 1e6, 1)} Mio. USDT unter ${de(s.minVolume24h, 0)} Mio.`);   // ohne Volumenangabe: nicht bewertet (wie ein fehlender Spread)
  if (spread !== null && spread > s.maxSpread) add('spread', `Spread ${de(spread, 3)} % über ${de(s.maxSpread, 3)} %`);
  const counter = !!ht && ht.dir === -sign;
  if (counter && !s.counterTrend) add('trend', `Gegentrend zum ${htf} (Kurs ${ht.above > 0 ? 'über' : 'unter'} EMA 200, EMA 50 ${ht.rising > 0 ? 'steigt' : 'fällt'})`);
  // 2) Signalscore
  const pRR = clamp((rr - 1) * 10, 0, 20);
  const a1 = agree(ht, sign), a2 = agree(bt, sign), htPts = a1 === null ? 7 : a1 * 7, btPts = isBtc ? 0 : a2 === null ? 3 : a2 * 3;
  const pTrend = isBtc ? Math.round(htPts * 20 / 14) : htPts + btPts;
  const prev = k.slice(Math.max(0, i1 - 20), i1).map(x => x.v), avg = prev.length ? prev.reduce((t, v) => t + v, 0) / prev.length : 0, vr = avg > 0 ? k[i1].v / avg : null;
  const pVol = vr === null ? 0 : vr >= 2.5 ? 20 : vr >= 1.5 ? 12 + (vr - 1.5) * 8 : vr > 1 ? (vr - 1) * 16 : 0;
  let pPhase = 0, phaseText = '';
  if (SQUEEZE_PATTERNS.includes(c.pat)) {
    const w = bbWidthSeries(k.slice(0, i1 + 1).map(x => x.c)), ref = w.slice(Math.max(20, i1 - 120), i1).filter(fin), cur = Math.min(...w.slice(Math.max(0, i1 - 5), i1).filter(fin));
    const rank = ref.length >= 20 && fin(cur) ? ref.filter(v => v <= cur).length / ref.length : null;
    pPhase = rank === null ? 0 : rank <= .2 ? 15 : rank <= .35 ? 8 : 0; phaseText = rank === null ? 'Squeeze ?' : `Squeeze ${pPhase >= 15 ? '✔' : pPhase ? '~' : '✖'}`;
  } else {
    const adx = adxSeries(k.slice(0, i1 + 1))[i1];
    pPhase = !fin(adx) ? 0 : adx >= 25 ? 15 : adx >= 20 ? 10 + (adx - 20) : Math.max(0, (adx - 10) / 2); phaseText = fin(adx) ? `ADX ${de(adx, 0)}` : 'ADX ?';
  }
  const pQ = clamp((Number(c.q) - 85) / 15 * 10, 0, 10);   // Regelgüte liegt fast immer bei 88–100 % → gestreckt: 85 % = 0, 100 % = 10
  const hn = hits?.n || 0, rate = hn ? hits.wins / hn : null, pHist = hn >= 10 ? clamp((rate - .3) / .3 * 15, 0, 15) : 7;
  const parts = { rr: pRR, trend: pTrend, volume: pVol, phase: pPhase, quality: pQ, history: pHist };
  const score = Math.round(Object.values(parts).reduce((t, v) => t + v, 0));
  const trendMark = a1 === null ? '?' : counter ? '✖' : a1 === 2 ? '✔' : '~', volMark = vr !== null && vr >= 1.5 ? '✔' : '✖';
  const summary = `Trend ${trendMark} · Volumen ${volMark} · R/R ${de(rr, 1)}`;
  const criteria = [
    `Chance/Risiko ${de(rr, 2)} : 1 → ${de(pRR, 0)}/20`,
    `Trend ${htf || '–'} ${a1 === null ? 'unbekannt' : `${a1}/2 passend`}${isBtc ? '' : ` · BTC ${a2 === null ? 'unbekannt' : `${a2}/2`}`} → ${de(pTrend, 0)}/20`,
    `Ausbruchsvolumen ${vr === null ? '–' : de(vr, 2) + ' ×'} Ø20 → ${de(pVol, 0)}/20`,
    `Marktphase ${phaseText} → ${de(pPhase, 0)}/15`,
    `Regelgüte ${de(Number(c.q), 0)} % → ${de(pQ, 1)}/10`,
    `Trefferquote ${hn >= 10 ? `${hits.wins}/${hn}` : `neutral (${hn}/10 abgeschlossen)`} → ${de(pHist, 0)}/15`
  ];
  const pass = !ko.length && score >= s.minScore, reason = ko.length ? ko[0].text : score < s.minScore ? `Signalscore ${score} unter ${s.minScore}` : '';
  // 3.71.0: marks und price nur für die Anzeige (Banner „Trend ✔/✖ · Volumen ✔/✖“, Zeile „Jetzt“) – Rechnung unverändert
  return { pass, score, parts, ko, reason, summary, criteria, rr, entry, target, invalid, atr, age, progress, targetPct, costs, volume24h, spread, volumeRatio: vr, higherTf: htf, trend: ht?.dir ?? null, btcTrend: bt?.dir ?? null, counter, settings: s,
    marks: { trend: trendMark, volume: volMark }, price: fin(px) ? px : null };
}

// ---- Anti-Spam: Auswahl der zu sendenden Signale ----
// candidates: [{ id, sym, iv, dir, tc, eval }] aus einem Prüflauf; sent: bisher gesendete [{ at, sym, iv, dir, id }].
// Reihenfolge: höchster Score zuerst. Regeln: gleiche Richtung, gleicher Coin, gleiche Kerze → nur das beste; gegensätzliche
// Signale (im Lauf oder gegen eine Meldung der letzten oppositeMin) → keins; je Coin+Zeitrahmen 1 Meldung je cooldownMin;
// insgesamt höchstens maxPerHour je 60 Minuten.
export function selectPatternSignals(candidates, sent, settings, now) {
  const s = patternFilterSettings(settings), min = 6e4, out = new Map(), recent = (sent || []).filter(x => now - x.at < 24 * 36e5);
  const ok = candidates.filter(x => x.eval?.pass).sort((a, b) => b.eval.score - a.eval.score || a.id.localeCompare(b.id));
  for (const x of candidates) if (!x.eval?.pass) out.set(x.id, { send: false, reason: x.eval?.reason || 'nicht bewertet' });
  const conflicted = new Set(ok.filter(x => ok.some(y => y.sym === x.sym && y.dir !== x.dir && Math.abs(y.tc - x.tc) < s.oppositeMin * min)).map(x => x.sym));
  const accepted = [], bestOf = new Map();
  for (const x of ok) {
    // 3.71.0: schwache Signale (Score unter weakBelow) nur in der App/im Journal, an Telegram nur mit „Schwache Signale auch senden“
    if (!s.sendWeak && x.eval.score < s.weakBelow) { out.set(x.id, { send: false, weak: true, reason: `Schwaches Signal (Score ${x.eval.score} unter ${s.weakBelow}) – nur in der App; „Schwache Signale auch senden“ ist aus` }); continue; }
    const group = `${x.sym}|${x.tc}|${x.dir}`, best = bestOf.get(group);
    if (best) { out.set(x.id, { send: false, reason: `Gleiche Richtung in derselben Kerze – nur das stärkste Muster (Score ${best.eval.score}) wird gemeldet` }); continue; }
    bestOf.set(group, x);
    if (conflicted.has(x.sym)) { out.set(x.id, { send: false, reason: 'Gegensätzliche Signale auf demselben Coin – keins wird gemeldet' }); continue; }
    if (recent.some(y => y.sym === x.sym && y.dir !== x.dir && now - y.at < s.oppositeMin * min)) { out.set(x.id, { send: false, reason: `Gegensätzliches Signal auf ${x.sym} innerhalb von ${s.oppositeMin} Min. gemeldet` }); continue; }
    if ([...recent, ...accepted].some(y => y.sym === x.sym && y.iv === x.iv && now - y.at < s.cooldownMin * min)) { out.set(x.id, { send: false, reason: `Je Coin und Zeitrahmen höchstens 1 Meldung je ${s.cooldownMin} Min.` }); continue; }
    if ([...recent, ...accepted].filter(y => now - y.at < 60 * min).length >= s.maxPerHour) { out.set(x.id, { send: false, reason: `Stundenlimit erreicht (höchstens ${s.maxPerHour} Chartmuster-Meldungen je Stunde)` }); continue; }
    accepted.push({ at: now, sym: x.sym, iv: x.iv, dir: x.dir, id: x.id }); out.set(x.id, { send: true, reason: '' });
  }
  return out;
}

// ---- Ergebnis-Tracking ----
export const PATTERN_TRACK_HORIZON = 48;
export function patternJournalEntry(c, ev, decision, now) {
  // 3.71.0: Felder der Signalkarte (Musterqualität, ATR, Chance/Risiko, Trend/Volumen, Kurs, Ende des Einstiegsfensters, schwach)
  const s = patternCardSettings(ev.settings), r = v => Number.isFinite(v) ? +v.toPrecision(8) : null;
  return { id: c.id, at: now, sym: c.sym, mkt: c.mkt, iv: c.iv, pat: c.pat, dir: c.dir, tc: c.tc, entry: ev.entry, target: ev.target, invalid: ev.invalid, score: ev.score,
    parts: Object.fromEntries(Object.entries(ev.parts).map(([k, v]) => [k, Math.round(v * 10) / 10])), summary: ev.summary, criteria: ev.criteria, ko: ev.ko.map(x => x.text), sent: !!decision.send, reason: decision.send ? '' : decision.reason || ev.reason, res: null,
    q: Number.isFinite(c.q) ? c.q : null, atr: r(ev.atr), rr: r(ev.rr), marks: ev.marks || null, price: r(ev.price), until: patternValidUntil(c.tc, c.iv, s.validCandles),
    grade: ev.score >= s.strongFrom ? 'strong' : ev.score >= s.weakBelow ? 'medium' : 'weak', ...(decision.weak ? { weak: true } : {}) };   // Gesamturteil zur Signalzeit
}
export function addPatternJournal(journal, entry, max = 2000) {
  const list = Array.isArray(journal) ? journal.filter(x => x.id !== entry.id) : []; list.push(entry);
  return list.length > max ? list.slice(-max) : list;
}
// Ziel erreicht / Ungültig erreicht / Timeout nach 48 Kerzen. Berühren Ziel und Ungültig dieselbe Kerze, zählt Ungültig.
export function resolvePatternJournal(journal, market, k, now, horizon = PATTERN_TRACK_HORIZON) {
  let n = 0; const idx = new Map(k.map((x, i) => [x.t, i]));
  for (const e of journal || []) {
    if (e.res || e.mkt !== market.mkt || e.sym !== market.sym || e.iv !== market.iv) continue;
    const i = idx.get(e.tc); if (i === undefined) continue;
    const sign = e.dir === 'bull' ? 1 : -1; let res = null;
    for (let j = i + 1; j < k.length && j <= i + horizon; j++) {
      const lo = sign > 0 ? k[j].l : -k[j].h, hi = sign > 0 ? k[j].h : -k[j].l;
      if (lo <= sign * e.invalid) { res = { out: 'ungueltig', bars: j - i, price: e.invalid }; break; }
      if (hi >= sign * e.target) { res = { out: 'ziel', bars: j - i, price: e.target }; break; }
    }
    if (!res && k.length - 1 >= i + horizon) res = { out: 'timeout', bars: horizon, price: k[i + horizon].c };
    if (res) { e.res = { ...res, at: now }; n++; }
  }
  return n;
}
export const PATTERN_OUTCOME_NAMES = Object.freeze({ ziel: 'Ziel erreicht', ungueltig: 'Ungültig erreicht', timeout: 'Timeout (48 Kerzen)' });
// Abgeschlossene Fälle je Muster+Zeitrahmen (für den Score) – gesendete und gefilterte Signale zählen gleich.
export function patternHitStats(journal, pat, iv) {
  const done = (journal || []).filter(e => e.res && e.pat === pat && e.iv === iv);
  return { n: done.length, wins: done.filter(e => e.res.out === 'ziel').length };
}
export function patternJournalStats(journal, by) {
  const rows = new Map();
  for (const e of journal || []) {
    const key = by === 'pat' ? e.pat : by === 'iv' ? e.iv : by === 'sym' ? e.sym : `${e.pat}|${e.iv}`;
    const r = rows.get(key) || { key, signals: 0, sent: 0, filtered: 0, n: 0, ziel: 0, ungueltig: 0, timeout: 0, open: 0 };
    r.signals++; e.sent ? r.sent++ : r.filtered++;
    if (e.res) { r.n++; r[e.res.out]++; } else r.open++;
    rows.set(key, r);
  }
  return [...rows.values()].map(r => ({ ...r, rate: r.n ? r.ziel / r.n : null })).sort((a, b) => b.signals - a.signals || a.key.localeCompare(b.key));
}

// ---- Backtest zum Kalibrieren der Schwellen ----
// Walk-forward über historische Kerzen: Je Kerze t erkennt detect(k[..t]) Muster nur mit Daten bis t; ein Ausbruch genau auf t
// wird wie live bewertet (höherer Zeitrahmen nur bis zur Zeit von t), das Ergebnis kommt aus den Folgekerzen.
export async function backtestPatternFilter({ k, iv, sym, mkt = 'futures', detect, higher = null, btc = null, settings = null, from = 250, window = 500, yieldEvery = 15, signal = null, progress = () => {} }) {
  const step = STEP_MS[iv], journal = [], seen = new Set(); let lastYield = Date.now();
  const upTo = (series, t) => series ? series.filter(x => x.t + (STEP_MS[HIGHER_TIMEFRAME[iv]] || 0) <= t + step) : null;
  for (let t = Math.max(from, 60); t < k.length; t++) {
    if (Date.now() - lastYield > yieldEvery) { progress(t / k.length); await new Promise(r => setTimeout(r, 0)); lastYield = Date.now(); if (signal?.aborted) throw Object.assign(new Error('Abgebrochen'), { name: 'AbortError' }); }
    const off = Math.max(0, t + 1 - window), part = k.slice(off, t + 1);
    for (const h of detect(part)) {
      if (h.kind !== 'form' || h.prelim || h.dir === 'neutral' || !/^Ausbruch/.test(h.status) || h.i1 !== part.length - 1 || h.q < 80) continue;
      const c = { sym, mkt, iv, pat: h.id, dir: h.dir, p0: part[h.i1].c, q: h.q, tc: part[h.i1].t, t0: h.t0, id: `${sym}|${iv}|${h.id}|${h.t0}` };
      if (seen.has(c.id)) continue; seen.add(c.id);
      // Trefferquote nur aus Fällen, deren Ergebnis zur Signalzeit schon feststand (kein Blick in die Zukunft)
      const ev = evaluatePatternSignal({ c, h, k: part, higher: upTo(higher, part[h.i1].t), btc: upTo(btc, part[h.i1].t), hits: patternHitStats(journal.filter(e => e.res && e.res.at <= c.tc), c.pat, iv), settings });
      const e = patternJournalEntry(c, ev, { send: ev.pass, reason: ev.reason }, c.tc);
      resolvePatternJournal([e], { mkt, sym, iv }, k, e.tc); if (e.res) e.res.at = e.tc + e.res.bars * step;
      journal.push(e);
    }
  }
  progress(1);
  const band = s => s < 50 ? '<50' : s < 70 ? '50–69' : s < 85 ? '70–84' : '≥85';
  const rows = ['<50', '50–69', '70–84', '≥85'].map(b => { const a = journal.filter(e => band(e.score) === b && e.res); return { band: b, n: a.length, ziel: a.filter(e => e.res.out === 'ziel').length, ungueltig: a.filter(e => e.res.out === 'ungueltig').length, timeout: a.filter(e => e.res.out === 'timeout').length }; });
  const group = flag => { const a = journal.filter(e => e.sent === flag && e.res); return { n: a.length, ziel: a.filter(e => e.res.out === 'ziel').length }; };
  const reasons = {}; for (const e of journal) if (!e.sent) { const r = e.ko[0] ? e.ko[0].replace(/[\d.,]+/g, '#') : e.reason.replace(/\d+/g, '#'); reasons[r] = (reasons[r] || 0) + 1; }
  return { journal, rows, passed: group(true), filtered: group(false), reasons, candles: k.length - from, from: k[from]?.t, to: k.at(-1)?.t };
}
