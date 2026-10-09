// G10(a): reine Indikatoren mit festem Startanker und fortsetzbarem Zustand.
const finite = Number.isFinite;
const validTime = x => Number.isSafeInteger(x) && x >= 0;

function emaState(period) { return { period, count: 0, sum: 0, value: null }; }
function emaNext(s, value) {
  if (!finite(value)) return null; // fehlende Eingänge werden nie mit 0 aufgefüllt
  if (s.value === null) {
    s.sum += value; s.count++;
    if (s.count === s.period) s.value = s.sum / s.period;
  } else s.value += 2 / (s.period + 1) * (value - s.value);
  return s.value;
}

export function ema(values, period) {
  if (!Array.isArray(values) || !Number.isInteger(period) || period < 1) throw new Error('Ungültige EMA-Eingänge');
  const s = emaState(period);
  return values.map(x => emaNext(s, x));
}

export function macd(values) {
  const fast = ema(values, 12), slow = ema(values, 26);
  const line = values.map((_, i) => fast[i] === null || slow[i] === null ? null : fast[i] - slow[i]);
  const signal = ema(line, 9);
  return { line, signal, histogram: line.map((x, i) => x === null || signal[i] === null ? null : x - signal[i]) };
}

export function macdInDirection(histogram, direction) {
  if (![1, -1].includes(direction) || !Array.isArray(histogram) || histogram.length < 5 || !histogram.slice(-5).every(finite)) return null;
  const end = histogram.length - 1, now = histogram[end], slope = now - histogram[end - 1];
  for (let i = end - 2; i <= end; i++) {
    const h = histogram[i], prev = histogram[i - 1], delta = h - prev, previousDelta = prev - histogram[i - 2];
    if (direction * prev <= 0 && direction * h > 0 && direction * now > 0) return true;
    if (direction * delta > 0 && direction * previousDelta <= 0 && direction * slope > 0) return true;
  }
  return false;
}

export function createIndicatorState({ time, periodMs }) {
  if (!validTime(time) || !Number.isSafeInteger(periodMs) || periodMs <= 0) throw new Error('Startanker/Intervall fehlen');
  return { version: 1, anchor: time, periodMs, nextTime: time, count: 0, previousClose: null,
    ema12: emaState(12), ema26: emaState(26), ema50: emaState(50), ema200: emaState(200), signal: emaState(9),
    gains: 0, losses: 0, averageGain: null, averageLoss: null, trSum: 0, atr: null };
}

// end ist exklusiv; knownAt ist die tatsächliche oder im historischen Modell festgelegte Kenntniszeit.
export function closedCandles(candles, asOf, periodMs) {
  if (!Array.isArray(candles) || !validTime(asOf) || !Number.isSafeInteger(periodMs) || periodMs <= 0) throw new Error('Kerzenkontext fehlt');
  const rows = [];
  for (const c of candles) {
    if (!c || !validTime(c.time) || !validTime(c.end) || !validTime(c.knownAt) || c.end !== c.time + periodMs || c.knownAt < c.end) throw new Error('Ungültige Kerzenzeit');
    if (c.end > asOf || c.knownAt > asOf) continue;
    if (![c.open, c.high, c.low, c.close, c.volume].every(finite) || Math.min(c.open, c.low, c.close) <= 0 || c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close) || c.high < c.low || c.volume < 0) throw new Error('Ungültige OHLCV-Kerze');
    if (rows.length && c.time !== rows.at(-1).end) throw new Error('Kerzenlücke oder doppelte/unsortierte Kerze');
    rows.push({ ...c });
  }
  return rows;
}

export function advanceIndicators(saved, candles, asOf) {
  if (!saved || saved.version !== 1 || !validTime(saved.anchor) || !validTime(saved.nextTime) || !Number.isSafeInteger(saved.count) || saved.count < 0 || saved.nextTime !== saved.anchor + saved.count * saved.periodMs) throw new Error('Ungültiger Indikatorzustand');
  for (const [name, period] of [['ema12', 12], ['ema26', 26], ['ema50', 50], ['ema200', 200], ['signal', 9]]) {
    const x = saved[name];
    const expectedCount = Math.min(period, name === 'signal' ? Math.max(0, saved.count - 25) : saved.count);
    if (!x || x.period !== period || x.count !== expectedCount || !finite(x.sum) || (x.value !== null && !finite(x.value)) || (x.count < period) !== (x.value === null)) throw new Error('Beschädigter EMA-Zustand');
  }
  if (![saved.gains, saved.losses, saved.trSum].every(x => finite(x) && x >= 0) || ![saved.averageGain, saved.averageLoss, saved.atr].every(x => x === null || (finite(x) && x >= 0)) || (saved.count === 0 ? saved.previousClose !== null : !finite(saved.previousClose))) throw new Error('Beschädigter Wilder-Zustand');
  if ((saved.count < 14) !== (saved.atr === null) || (saved.count < 15) !== (saved.averageGain === null) || (saved.count < 15) !== (saved.averageLoss === null)) throw new Error('Wilder-Warm-up passt nicht zum gespeicherten Zustand');
  const s = JSON.parse(JSON.stringify(saved)), rows = closedCandles(candles, asOf, s.periodMs), values = [];
  for (const c of rows) {
    if (c.time !== s.nextTime) throw new Error('Fortsetzung passt nicht zum gespeicherten Startanker');
    const fast = emaNext(s.ema12, c.close), slow = emaNext(s.ema26, c.close), ema50 = emaNext(s.ema50, c.close), ema200 = emaNext(s.ema200, c.close);
    const line = fast === null || slow === null ? null : fast - slow, signal = emaNext(s.signal, line);
    const tr = s.previousClose === null ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - s.previousClose), Math.abs(c.low - s.previousClose));
    if (s.count < 14) { s.trSum += tr; if (s.count === 13) s.atr = s.trSum / 14; }
    else s.atr = (s.atr * 13 + tr) / 14;
    if (s.previousClose !== null) {
      const gain = Math.max(0, c.close - s.previousClose), loss = Math.max(0, s.previousClose - c.close);
      if (s.count <= 14) { s.gains += gain; s.losses += loss; if (s.count === 14) { s.averageGain = s.gains / 14; s.averageLoss = s.losses / 14; } }
      else { s.averageGain = (s.averageGain * 13 + gain) / 14; s.averageLoss = (s.averageLoss * 13 + loss) / 14; }
    }
    const rsi = s.averageGain === null ? null : s.averageLoss === 0 ? (s.averageGain === 0 ? 50 : 100) : 100 - 100 / (1 + s.averageGain / s.averageLoss);
    values.push({ time: c.time, end: c.end, knownAt: c.knownAt, ema50, ema200, rsi, atr: s.atr, macd: line, signal, histogram: line === null || signal === null ? null : line - signal });
    s.previousClose = c.close; s.count++; s.nextTime = c.end;
  }
  return { state: s, values };
}

// Strikte Extrema: gleiche Hochs/Tiefs bilden keinen eindeutigen Strukturpivot.
export function confirmedPivots(candles, asOf, periodMs) {
  const rows = closedCandles(candles, asOf, periodMs), pivots = [];
  for (let i = 2; i < rows.length - 2; i++) {
    const c = rows[i], neighbours = [rows[i - 2], rows[i - 1], rows[i + 1], rows[i + 2]];
    const knownAt = Math.max(...rows.slice(i - 2, i + 3).map(x => x.knownAt));
    for (const [type, field, d] of [['low', 'low', -1], ['high', 'high', 1]]) {
      if (neighbours.every(n => d * c[field] > d * n[field])) pivots.push({ type, index: i, time: c.time, price: c[field], confirmedIndex: i + 2, knownAt });
    }
  }
  return pivots;
}

export function fib618(from, to, direction, asOf) {
  if (![1, -1].includes(direction) || !from || !to || !validTime(asOf) || ![from.price, to.price].every(finite) || ![from.knownAt, to.knownAt, from.time, to.time].every(validTime) || Math.max(from.knownAt, to.knownAt) > asOf || to.time <= from.time || from.type !== (direction === 1 ? 'low' : 'high') || to.type !== (direction === 1 ? 'high' : 'low') || direction * (to.price - from.price) <= 0) return null;
  return { price: to.price - .618 * (to.price - from.price), knownAt: Math.max(from.knownAt, to.knownAt), from: from.time, to: to.time };
}

// Nutzerentscheidung: Alter ab der zweiten Nachbarkerze, nicht ab dem Pivot selbst.
export function divergenceInDirection(pivots, rsiValues, direction, lastIndex, asOf, maxAge = 3) {
  if (!Array.isArray(pivots) || !Array.isArray(rsiValues) || ![1, -1].includes(direction) || !Number.isInteger(lastIndex) || lastIndex < 0 || !validTime(asOf) || !Number.isInteger(maxAge) || maxAge < 0) return null;
  if (pivots.some(p => !p || !validTime(p.knownAt) || !Number.isInteger(p.index) || p.index < 2 || p.confirmedIndex !== p.index + 2 || !finite(p.price))) return null;
  const relevant = pivots.filter(p => p.type === (direction === 1 ? 'low' : 'high') && p.knownAt <= asOf && p.confirmedIndex <= lastIndex).sort((a, b) => a.index - b.index);
  if (relevant.length < 2) return false;
  const [a, b] = relevant.slice(-2);
  if (lastIndex - b.confirmedIndex >= maxAge) return false;
  const ra = rsiValues[a.index], rb = rsiValues[b.index];
  if (![ra, rb].every(x => finite(x) && x >= 0 && x <= 100)) return null;
  return direction * (b.price - a.price) < 0 && direction * (rb - ra) > 0;
}

export function divergenceInfo({ confirmedAt, asOf, periodMs, maxAge = 3 }) {
  if (!validTime(confirmedAt) || !validTime(asOf) || !Number.isSafeInteger(periodMs) || periodMs <= 0 || !Number.isInteger(maxAge) || maxAge < 0 || confirmedAt > asOf) return { status: 'nicht verfügbar', tone: 'muted', action: 'Bestätigung abwarten.' };
  const expiresAt = confirmedAt + maxAge * periodMs, remainingMs = Math.max(0, expiresAt - asOf), active = asOf < expiresAt;
  return { status: active ? 'frisch' : 'abgelaufen', tone: active ? remainingMs <= periodMs ? 'warning' : 'positive' : 'muted', confirmedAt, expiresAt, remainingMs,
    explanation: 'Zwei geschlossene Nachbarkerzen bestätigen den Pivot. Ab dann zählt das Alterslimit; bestätigt bedeutet keine Kursgarantie.',
    action: active ? 'Trend, Setup und Kosten prüfen; ein Divergenz-Hinweis allein reicht nicht zum Einstieg.' : 'Keine Divergenz-Zusatzpunkte mehr. Neue Bestätigung abwarten.' };
}
