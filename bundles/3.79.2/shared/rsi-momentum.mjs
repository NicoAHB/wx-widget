// Statistik ausschließlich über bereits abgeschlossene RSI-Werte; keine Kurse oder Netzwerkzugriffe.
export const RSI_MOMENTUM = Object.freeze({ periods: 20, deviations: 2, ddof: 0, includeCurrent: true, positiveOnly: true });

export function rsiDeltaStats(values) {
  const count = RSI_MOMENTUM.periods;
  const unavailable = reason => ({ ready: false, delta: null, mean: null, sigma: null, threshold: null, exceeds: false, reason });
  if (!Array.isArray(values) || values.length < count + 1) return unavailable('21 gültige RSI-Werte für 20 Veränderungen erforderlich.');
  const window = Array.from(values.slice(-count - 1)); // auch Lücken in dünn besetzten Arrays prüfen
  if (window.some(v => !Number.isFinite(v) || v < 0 || v > 100)) return unavailable('Die letzten 21 RSI-Werte müssen vollständig und gültig sein.');
  const deltas = window.slice(1).map((v, i) => v - window[i]);
  const mean = deltas.reduce((sum, v) => sum + v, 0) / count;
  // Populations-Standardabweichung: Division durch 20 (ddof=0). Die aktuelle Veränderung zählt mit.
  const sigma = Math.sqrt(deltas.reduce((sum, v) => sum + (v - mean) ** 2, 0) / count);
  const delta = deltas.at(-1), threshold = mean + RSI_MOMENTUM.deviations * sigma;
  return { ready: true, delta, mean, sigma, threshold, exceeds: delta > threshold, reason: '' };
}

// Ein RSI-Punkt: bestehende Erholung unter 30 ODER statistisch ungewöhnlich positiver Anstieg.
// Die bestehende Short-Regel bleibt unverändert; der Zusatz kann bei fallendem RSI nie Long liefern.
export function rsiSignal(values) {
  const current = Array.isArray(values) ? values.at(-1) : null, previous = Array.isArray(values) ? values.at(-2) : null;
  const valid = [current, previous].every(v => Number.isFinite(v) && v >= 0 && v <= 100);
  const momentum = rsiDeltaStats(values);
  const oversoldLong = valid && current < 30 && current > previous;
  const momentumLong = momentum.ready && momentum.delta > 0 && momentum.exceeds;
  const short = valid && current > 70 && current < previous;
  return { score: oversoldLong || momentumLong ? 1 : short ? -1 : 0, current: valid ? current : null, previous: valid ? previous : null, oversoldLong, momentumLong, momentum };
}
