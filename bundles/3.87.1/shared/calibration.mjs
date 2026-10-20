// Kalibrierung der Lern-Prozente (3.84.0): stimmen die Wahrscheinlichkeiten, die ein Lernmodell beim Signal genannt hat, mit dem überein,
// was danach tatsächlich passiert ist? Reiner Rechenkern. Proben sind {p: genannte Wahrscheinlichkeit 0..1, y: 1 = Ziel erreicht, 0 = nicht,
// live: Signal kam aus dem laufenden Betrieb (sonst aus dem Rücktest)}. Die Wahrscheinlichkeit steht seit dem Signal unverändert im
// Protokoll (sie wurde nur aus Daten VOR dem Signal berechnet), die Prüfung ist also frei von nachträglicher Anpassung.
export const CALIBRATION = Object.freeze({ minSamples: 20, binWidth: .1, thinBin: 5, tolerance: .08, driftTolerance: .1 });
const finite = Number.isFinite, mean = a => a.reduce((n, v) => n + v, 0) / a.length;
// Trennschärfe (AUC): Wahrscheinlichkeit, dass ein zufälliges Signal mit Treffer eine höhere genannte Wahrscheinlichkeit hatte als eines ohne.
// 0,5 = Zufall (auch jede feste Prozentzahl), 1 = perfekt. Rangsumme mit gemittelten Rängen bei gleichen Werten.
export function auc(samples) {
  const n1 = samples.filter(s => s.y === 1).length, n0 = samples.length - n1; if (!n1 || !n0) return null;
  const order = samples.map((s, i) => i).sort((a, b) => samples[a].p - samples[b].p), rank = new Array(samples.length);
  for (let i = 0; i < order.length;) { let j = i; while (j + 1 < order.length && samples[order[j + 1]].p === samples[order[i]].p) j++; for (let k = i; k <= j; k++) rank[order[k]] = (i + j) / 2 + 1; i = j + 1; }
  const sum = samples.reduce((t, s, i) => t + (s.y === 1 ? rank[i] : 0), 0);
  return { value: (sum - n1 * (n1 + 1) / 2) / (n1 * n0), se: Math.sqrt((n1 + n0 + 1) / (12 * n1 * n0)) };
}
const pct = v => `${Math.round(v * 100)} %`;
export function calibrationSamples(rows, { probability = r => r.signal?.probability, label, live = r => r.source === 'live' } = {}) {
  return rows.map(r => ({ p: probability(r), y: label(r), live: !!live(r) })).filter(s => finite(s.p) && s.p >= 0 && s.p <= 1 && (s.y === 0 || s.y === 1));
}
// Zuverlässigkeitsdiagramm in 10-%-Stufen (nur belegte Stufen), Brier-Wert gegen den einer festen Trefferquote, Urteil
export function calibrationReport(samples) {
  const n = samples.length, C = CALIBRATION;
  if (n < C.minSamples) return { n, verdict: 'few', bins: [], text: `Zu wenige abgeschlossene Signale mit gespeicherter Wahrscheinlichkeit (${n}/${C.minSamples}) für eine Kalibrierung.` };
  const meanP = mean(samples.map(s => s.p)), rate = mean(samples.map(s => s.y)), gap = meanP - rate;
  const brier = mean(samples.map(s => (s.p - s.y) ** 2)), a = auc(samples);
  const bins = [], per = Math.round(1 / C.binWidth);
  for (let b = 0; b < per; b++) {
    const part = samples.filter(s => Math.min(per - 1, Math.floor(s.p * per)) === b);
    if (part.length) bins.push({ from: b / per, to: (b + 1) / per, n: part.length, meanP: mean(part.map(s => s.p)), rate: mean(part.map(s => s.y)), thin: part.length < C.thinBin });
  }
  const se = Math.sqrt(Math.max(rate * (1 - rate), .05 * .95) / n), limit = Math.max(C.tolerance, 2 * se);
  const sharp = a ? ` Trennschärfe ${a.value.toFixed(2).replace('.', ',')} (0,50 = Zufall).` : '';
  let verdict = 'ok', text = `Genannt Ø ${pct(meanP)}, tatsächlich erreicht ${pct(rate)} (${n} Signale) – passt innerhalb der Schwankung.${sharp}`;
  if (gap > limit) { verdict = 'optimistic'; text = `Zu optimistisch: Das Modell nannte im Schnitt ${pct(meanP)}, tatsächlich erreicht wurden ${pct(rate)} (${n} Signale). Die Prozentzahlen am Signal eher nach unten lesen.`; }
  else if (gap < -limit) { verdict = 'cautious'; text = `Zu vorsichtig: Das Modell nannte im Schnitt ${pct(meanP)}, tatsächlich erreicht wurden ${pct(rate)} (${n} Signale).`; }
  else if (a && a.value < .5 + a.se) { verdict = 'no-skill'; text = `Im Schnitt passend (Ø ${pct(meanP)} genannt, ${pct(rate)} erreicht), aber die einzelnen Prozentzahlen trennen gute von schlechten Signalen nicht erkennbar besser als der Zufall (Trennschärfe ${a.value.toFixed(2).replace('.', ',')}; 0,50 = Zufall).`; }
  return { n, verdict, meanP, rate, gap, brier, auc: a ? a.value : null, bins, text };
}
// Live gegen Rücktest: weicht die tatsächliche Trefferquote im laufenden Betrieb deutlich von der im Rücktest ab?
export function liveVsBacktest(samples) {
  const live = samples.filter(s => s.live), back = samples.filter(s => !s.live), C = CALIBRATION;
  const rate = a => (a.length ? mean(a.map(s => s.y)) : null);
  if (live.length < C.minSamples || back.length < C.minSamples) return { warn: false, live: { n: live.length, rate: rate(live) }, back: { n: back.length, rate: rate(back) }, text: '' };
  const rl = rate(live), rb = rate(back), se = Math.sqrt(Math.max(rl * (1 - rl), .05 * .95) / live.length + Math.max(rb * (1 - rb), .05 * .95) / back.length), diff = rl - rb, warn = Math.abs(diff) > Math.max(C.driftTolerance, 2 * se);
  return { warn, live: { n: live.length, rate: rl }, back: { n: back.length, rate: rb }, diff, text: warn ? `Live ${pct(rl)} (${live.length} Signale) weicht deutlich vom Rücktest ${pct(rb)} (${back.length}) ab, ${diff < 0 ? 'schlechter' : 'besser'} als dort – der Rücktest bildet den laufenden Betrieb nicht verlässlich ab.` : `Live ${pct(rl)} (${live.length} Signale), Rücktest ${pct(rb)} (${back.length}) – kein auffälliger Unterschied.` };
}
