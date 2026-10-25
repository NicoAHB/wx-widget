// 3.78.2: erklärt vorhandene Top-Down-Ergebnisse, ohne einen Signalfilter zu verändern.
const cache = new WeakMap();
const finite = Number.isFinite;
const compare = (a, b) => finite(a) && finite(b) ? a > b ? 1 : a < b ? -1 : 0 : null;
const side = n => n === 1 ? 'Long' : n === -1 ? 'Short' : n === null ? 'Daten fehlen' : 'Neutral';
const tone = n => n === 1 ? 'long' : n === -1 ? 'short' : 'neutral';

// Kleine echte EMA-Änderungen dürfen nicht als identisch gerundete Werte erscheinen.
export function analysisComparison(a, b, price) {
  if (![a, b].every(finite)) return ['–', '–'];
  let pair = [price(a), price(b)];
  if (a !== b && pair[0] === pair[1]) {
    const digits = Math.max(0, Math.min(12, Math.ceil(-Math.log10(Math.abs(a - b))) + 1));
    pair = [a, b].map(v => v.toLocaleString('de-DE', { maximumFractionDigits: digits }));
    if (pair[0] === pair[1]) pair = [a, b].map(v => v.toLocaleString('de-DE', { maximumSignificantDigits: 17 }));
  }
  return pair;
}

function biasChecks(b, price) {
  const d = b.diagnostics || {}, highs = b.highs || [], lows = b.lows || [], enough = highs.length >= 2 && lows.length >= 2;
  const pair = (a, b) => analysisComparison(a, b, price), hs = enough ? pair(highs.at(-2).price, highs.at(-1).price) : [], ls = enough ? pair(lows.at(-2).price, lows.at(-1).price) : [];
  const em = pair(b.ema50, b.ema200), e50 = pair(d.ema50Before, b.ema50), e200 = pair(d.ema200Before, b.ema200), close = pair(d.close, b.ema200);
  const hours = finite(d.slopeBars) ? d.slopeBars * 4 : null;
  const slope = (before, current, values) => {
    const dir = compare(current, before);
    return { direction: dir, value: dir === null ? 'Vergleichswerte noch nicht verfügbar.' : `Vor ${hours ?? '–'} Stunden ${values[0]} → jetzt ${values[1]} · ${dir === 1 ? 'gestiegen' : dir === -1 ? 'gefallen' : 'unverändert'}` };
  };
  return [
    { id: 'structure', label: 'Marktstruktur', direction: enough ? b.structure : null, state: enough ? null : 'Noch unklar',
      value: enough ? `Hoch ${highs.at(-1).price > highs.at(-2).price ? 'steigt' : highs.at(-1).price < highs.at(-2).price ? 'fällt' : 'gleich'}: ${hs[0]} → ${hs[1]} · Tief ${lows.at(-1).price > lows.at(-2).price ? 'steigt' : lows.at(-1).price < lows.at(-2).price ? 'fällt' : 'gleich'}: ${ls[0]} → ${ls[1]}` : 'Noch keine zwei bestätigten Hochs und zwei bestätigten Tiefs vorhanden.' },
    { id: 'ema-order', label: 'EMA 50 zu EMA 200', direction: compare(b.ema50, b.ema200),
      value: [b.ema50, b.ema200].every(finite) ? `EMA 50 ${em[0]} ${b.ema50 > b.ema200 ? 'über' : b.ema50 < b.ema200 ? 'unter' : 'gleich'} EMA 200 ${em[1]}` : 'EMA-Werte fehlen.' },
    { id: 'ema50-slope', label: 'Richtung EMA 50', ...slope(d.ema50Before, b.ema50, e50) },
    { id: 'ema200-slope', label: 'Richtung EMA 200', ...slope(d.ema200Before, b.ema200, e200) },
    { id: 'price', label: 'Schlusskurs zu EMA 200', direction: compare(d.close, b.ema200),
      value: [d.close, b.ema200].every(finite) ? `Schluss ${close[0]} ${d.close > b.ema200 ? 'über' : d.close < b.ema200 ? 'unter' : 'gleich'} EMA 200 ${close[1]}` : 'Schlusskurs oder EMA 200 fehlt.' }
  ].map(c => ({ ...c, state: c.state || side(c.direction), tone: tone(c.direction) }));
}

function biasReason(checks, direction) {
  if (direction) return `Alle fünf 4h-Prüfungen zeigen ${side(direction)}.`;
  const long = checks.find(c => c.direction === 1), short = checks.find(c => c.direction === -1), unclear = checks.filter(c => c.direction === 0 || c.direction === null);
  const conflict = long && short ? `Widerspruch: „${long.label}“ zeigt Long, „${short.label}“ zeigt Short.` : '';
  const missing = unclear.length ? `Keine eindeutige Richtung bei: ${unclear.map(c => c.label).join(', ')}.` : '';
  return [conflict, missing].filter(Boolean).join(' ') || 'Die 4h-Prüfungen geben noch keine gemeinsame Richtung frei.';
}

export const TOP_DOWN_CHECK_HELP = 'Alle fünf Prüfungen müssen dieselbe Richtung zeigen. Long: die letzten zwei bestätigten Hochs und Tiefs steigen; EMA 50 liegt über EMA 200; beide EMAs sind höher als vor 12 Stunden; der Schlusskurs liegt über EMA 200. Für Short gilt alles umgekehrt. Bestätigte Hochs/Tiefs sind abgeschlossene Wendepunkte, nicht jedes kurze Auf und Ab. EMA 50 und EMA 200 sind geglättete Kursdurchschnitte mit 50 bzw. 200 Perioden im 4h-Chart; EMA 50 reagiert schneller. „200“ ist die Periodeneinstellung. Eine neutrale oder entgegengesetzte Prüfung verhindert die Freigabe. Die Farben zeigen die Richtung einzelner Prüfungen; ein Einstieg braucht zusätzlich das 1h-Setup und die 15m-Bestätigung.';

export function topDownStatus(r, { price, number, time } = {}) {
  const old = cache.get(r);
  if (old && old.price === price && old.number === number && old.time === time) return old.value;
  const b = r.bias || {}, direction = b.direction || 0, checks = biasChecks(b, price), zone = r.stage >= 2 ? r.signal?.zone || r.setupZone : null;
  const zoneText = zone ? `${(zone.labels || []).join(' + ')} · ${price(zone.low)}–${price(zone.high)}` : '';
  const steps = [
    { id: '4h', label: '4h · Richtung', state: side(direction), tone: tone(direction), text: biasReason(checks, direction) },
    { id: '1h', label: '1h · Setup', state: !direction ? 'Noch nicht geprüft' : r.stage >= 2 ? 'Gültige Zone berührt' : r.zones?.length ? 'Zonenberührung fehlt' : 'Keine Konfluenzzone', tone: r.stage >= 2 ? tone(direction) : 'neutral',
      text: !direction ? 'Zuerst muss die 4h-Prüfung eine eindeutige Richtung freigeben.' : r.stage >= 2 ? zoneText || 'Eine 1h-Zone mit mindestens zwei Bausteinarten wurde berührt.' : r.zones?.length ? 'Konfluenzzonen vorhanden. Der Kurs muss eine gültige 1h-Zone in 4h-Richtung berühren.' : 'Noch keine 1h-Konfluenzzone mit mindestens zwei unterschiedlichen Bausteinarten vorhanden.' },
    { id: '15m', label: '15m · Einstieg', state: r.stage < 2 ? 'Noch nicht geprüft' : r.stage >= 3 ? 'Bestätigt' : 'Noch kein Einstieg', tone: r.stage >= 3 ? tone(direction) : 'neutral',
      text: !direction ? 'Zuerst 4h-Richtung und danach 1h-Setup abwarten.' : r.stage < 2 ? 'Zuerst muss ein gültiges 1h-Setup vorliegen.' : r.stage >= 3 ? '15m-Umkehr und Schlussbruch bestätigt.' : 'Noch kein bestätigtes Einstiegssignal. Erforderlich: Umkehr, anschließender Schlussbruch und zwei passende Ziel-Levels.' }
  ];
  const s = r.signal, levels = s ? [ ['Einstieg', price(s.entry)], ['Stop', price(s.stop)], ['Ziel 1', price(s.target1)], ['Ziel 2', price(s.target2)], ['CRV', number(s.rr, 2) + ' / ' + number(s.rr2, 2)] ] : [];
  const value = { stage: r.stage, direction, steps, checks, levels, help: TOP_DOWN_CHECK_HELP,
    basis: `Nur geschlossene 4h-Kerzen${finite(b.at) && time ? ' · letzter verwendeter Schluss ' + time(b.at) : ''}. Steigung: Vergleich über 12 Stunden.`, openChecks: !direction };
  cache.set(r, { price, number, time, value }); return value;
}

export function topDownStatusText(value, includeLevels = true) {
  const [bias, hour, entry] = value.steps;
  return `${value.stage}/3 Stufen\n${bias.label}: ${bias.state}\n${bias.text}\n${value.checks.map(c => `${c.label}: ${c.state} · ${c.value}`).join('\n')}\n${hour.label}: ${hour.state}\n${hour.text}\n${entry.label}: ${entry.state}\n${entry.text}${includeLevels && value.levels.length ? '\n' + value.levels.map(([k, v]) => k + ' ' + v).join(' · ') : ''}`;
}

export const describeTopDown = (r, format) => topDownStatusText(topDownStatus(r, format));
