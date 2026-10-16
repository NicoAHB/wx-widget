// MACD-Darstellung: verwendet die vorhandenen 12/26/9-Werte, verändert keine Handelsregeln.
const finite = Number.isFinite;
// NEU 3.77.2: ausschließlich Darstellungsfilter für Kreuzungsmarker.
export const MACD_CROSS_MIN_FRACTION = .02; // 2 % des größten sichtbaren |Histogramms|
export const MACD_CROSS_MIN_BARS = 2;       // Kreuzungskerze + mindestens eine Folgekerze, beide geschlossen
export const MACD_CROSS_RADIUS = 2.3;       // vorher 3.3: rund 30 % kleiner
export const MACD_CHART = Object.freeze({ fast: 12, slow: 26, signal: 9, minBars: 35, freshBars: 3, pivotStrength: 2, pivotLookback: 60 });

// Nur geschlossene Kerzen prüfen. Ein Ereignis bleibt höchstens drei Schlusskerzen
// hervorgehoben und verfällt früher, wenn seine Richtung bereits widersprochen wird.
export function macdFindings(rows, series, { now = Date.now(), expiresAt = Infinity, issue = '' } = {}) {
  const empty = reason => ({ ready: false, reason, events: {}, current: null });
  if (issue) return empty(issue);
  if (!Array.isArray(rows) || series?.line?.length !== rows.length || series?.signal?.length !== rows.length) return empty('MACD-Daten fehlen.');
  const last = rows.findLastIndex(c => finite(c?.closeTime) && c.closeTime < now);
  if (last < MACD_CHART.minBars - 1) return empty('Mindestens 35 abgeschlossene Kerzen werden benötigt.');
  if (now >= expiresAt) return empty('Neue Schlusskerze fehlt · Prüfung veraltet.');
  for (let i = 0; i <= last; i++) {
    const c = rows[i];
    if (![c?.time, c?.closeTime, c?.close, c?.high, c?.low].every(finite) || c.time > c.closeTime || c.closeTime >= now || c.low <= 0 || c.high < c.low || i > 0 && c.time !== rows[i - 1].closeTime + 1) return empty('Kerzendaten fehlen oder enthalten eine Lücke.');
  }
  const { line, signal } = series, histogram = i => finite(line[i]) && finite(signal[i]) ? line[i] - signal[i] : null;
  if (![line[last], line[last - 1], signal[last], signal[last - 1]].every(finite)) return empty('MACD-Vorlauf fehlt.');
  const events = {}, start = Math.max(1, last - MACD_CHART.freshBars + 1);
  const note = (kind, direction, index, extra = {}) => { events[kind] = { direction, index, age: last - index, confirmedAt: rows[index].closeTime + 1, ...extra }; };
  for (let i = start; i <= last; i++) {
    const before = histogram(i - 1), current = histogram(i);
    if (finite(before) && finite(current)) {
      if (before <= 0 && current > 0) note('signal', 1, i);
      if (before >= 0 && current < 0) note('signal', -1, i);
    }
    if (finite(line[i - 1]) && finite(line[i])) {
      if (line[i - 1] <= 0 && line[i] > 0) note('zero', 1, i);
      if (line[i - 1] >= 0 && line[i] < 0) note('zero', -1, i);
    }
  }
  if (events.signal && events.signal.direction * histogram(last) <= 0) delete events.signal;
  if (events.zero && events.zero.direction * line[last] <= 0) delete events.zero;
  const strength = MACD_CHART.pivotStrength;
  for (const [field, direction] of [['low', 1], ['high', -1]]) {
    let previous = null;
    // Preis-Pivots zuerst bestätigen; MACD an genau denselben Kerzen vergleichen.
    // Die zwei rechten Nachbarn müssen ebenfalls bereits geschlossen sein.
    for (let i = Math.max(strength, last - MACD_CHART.pivotLookback + 1); i <= last - strength; i++) {
      const price = rows[i][field];
      let pivot = true;
      for (let j = i - strength; j <= i + strength; j++) if (j !== i && direction * (rows[j][field] - price) <= 0) pivot = false;
      if (!pivot) continue;
      const a = previous; previous = i;
      if (a === null || i + strength < start || ![line[a], line[i]].every(finite)) continue;
      if (direction * (price - rows[a][field]) >= 0 || direction * (line[i] - line[a]) <= 0) continue;
      if (rows.slice(i + 1, last + 1).some(c => direction * (c[field] - price) < 0)) continue;
      const found = { direction, index: i + strength, age: last - i - strength, confirmedAt: rows[i + strength].closeTime + 1, first: a, second: i, firstPrice: rows[a][field], secondPrice: price, firstMacd: line[a], secondMacd: line[i] };
      if (!events.divergence || found.index > events.divergence.index) events.divergence = found;
      else if (found.index === events.divergence.index && found.direction !== events.divergence.direction) delete events.divergence; // kein bevorzugtes Vorzeichen bei gleichzeitigen Gegenbefunden
    }
  }
  return { ready: true, reason: '', events, current: { index: last, time: rows[last].time, closeTime: rows[last].closeTime, line: line[last], signal: signal[last], histogram: histogram(last) } };
}

// NEU 3.77.1: gemeinsame Flächen für Preis / MACD / Volumen, ohne feste Pixel-Kappen.
export function macdPaneLayout(height, enabled, { expanded = false, width = 390 } = {}) {
  if (!enabled) return { priceBottom: height - 77, height: 0, volumeTop: height - 63, volumeBottom: height - 31, volumeHeight: 32 };
  const top = 18, gap = 8, volumeBottom = height - 30, available = Math.max(0, volumeBottom - top - 2 * gap);
  const priceBottom = top + available * (expanded ? .4 : .6), size = available * (expanded ? .45 : .25);
  const paneTop = priceBottom + gap, bottom = paneTop + size, volumeTop = bottom + gap;
  const inline = width >= 620 || size < 80, header = inline ? 24 : 36;
  return { priceBottom, top: paneTop, bottom, plotTop: paneTop + header, plotBottom: bottom - 4, height: size, volumeTop, volumeBottom, volumeHeight: volumeBottom - volumeTop, inline, expanded };
}

// NEU: vier Histogramm-Farben; die erste sichtbare Kerze vergleicht sich mit
// ihrem wirklichen Vorgänger außerhalb des Ausschnitts, nicht mit einem Ersatzwert.
export function macdHistogramTone(current, previous) {
  if (!finite(current)) return null;
  const sign = current >= 0 ? 'up' : 'down';
  return sign + ' ' + (!finite(previous) || current === previous ? 'flat' : current > previous ? 'rising' : 'falling');
}
export function macdScale(series, offset, stop) {
  // GEÄNDERT 3.77.2: null gehört auch bei rein positiven/negativen Werten zum Bereich.
  let min = 0, max = 0;
  for (let i = offset; i < stop; i++) {
    const m = series.line[i], s = series.signal[i];
    for (const value of [m, s, finite(m) && finite(s) ? m - s : null]) {
      if (finite(value)) { min = Math.min(min, value); max = Math.max(max, value); }
    }
  }
  if (min === max) return { min: -1, max: 1 }; // nur leere oder exakt nullwertige Reihen
  const padding = (max - min) * .08;
  return { min: min - padding, max: max + padding };
}
export function macdCrossings(series, offset, stop, { candles, now = Date.now() } = {}) {
  // GEÄNDERT 3.77.2: erst ausreichenden Abstand UND anhaltende Richtung bestätigen.
  if (!candles) return [];
  const histogram = i => finite(series.line[i]) && finite(series.signal[i]) ? series.line[i] - series.signal[i] : null;
  let peak = 0;
  for (let i = offset; i < stop; i++) if (finite(histogram(i))) peak = Math.max(peak, Math.abs(histogram(i)));
  const threshold = peak * MACD_CROSS_MIN_FRACTION;
  const found = [];
  for (let i = Math.max(1, offset); i < stop; i++) {
    const a = series.line[i - 1], b = series.signal[i - 1], c = series.line[i], d = series.signal[i];
    if (![a, b, c, d].every(finite)) continue;
    const before = a - b, after = c - d;
    const direction = before <= 0 && after > 0 ? 1 : before >= 0 && after < 0 ? -1 : 0;
    if (!direction) continue;
    const fraction = before === 0 ? 0 : -before / (after - before);
    const index = i - 1 + fraction;
    if (index < offset || index > stop - 1) continue;
    const previous = candles[i - 1];
    if (!finite(previous?.closeTime) || previous.closeTime >= now) continue;
    let magnitude = 0;
    for (let j = i; j < Math.min(series.line.length, series.signal.length, candles.length); j++) {
      const bar = candles[j], value = histogram(j);
      if (!finite(bar?.time) || !finite(bar?.closeTime) || bar.time > bar.closeTime || bar.closeTime >= now || bar.time !== candles[j - 1].closeTime + 1 || !finite(value) || direction * value <= 0) break;
      magnitude = Math.max(magnitude, direction * value);
      if (j - i + 1 >= MACD_CROSS_MIN_BARS && magnitude >= threshold) {
        found.push({ index, candle: i, fraction, direction, value: a + (c - a) * fraction, confirmedIndex: j });
        break;
      }
    }
  }
  return found;
}
export function macdValue(value) {
  if (!finite(value)) return '–';
  const v = Math.abs(value);
  return value.toLocaleString('de-DE', v > 0 && (v < .001 || v >= 1e6)
    ? { notation: 'scientific', maximumSignificantDigits: 4 }
    : { maximumSignificantDigits: 5 });
}

// NEU: Nulllinie im festen Achsenrand, sichtbare Kreuzungen und ein Readout,
// dessen Textknoten bei Fingerbewegungen lediglich aktualisiert werden.
export function drawMacdPane(svg, { node, series, candles, offset, stop, x, step, left, width, layout, now = Date.now() }) {
  if (!layout.height) return null;
  // GEÄNDERT 3.77.2: bei jedem Zeichnen aus dem aktuellen Ausschnitt berechnen.
  const scale = macdScale(series, offset, stop), span = scale.max - scale.min;
  const y = v => layout.plotTop + (scale.max - v) / span * (layout.plotBottom - layout.plotTop), zero = y(0);
  const frame = node('g', { class: 'macd-frame' });
  frame.append(node('line', { x1: left, x2: left + width, y1: layout.top, y2: layout.top, class: 'macd-separator' }), node('line', { x1: left, x2: left + width, y1: layout.volumeTop - 4, y2: layout.volumeTop - 4, class: 'macd-separator macd-volume-separator' }));
  const readout = node('g', { class: 'macd-readout', 'data-selected': 'false' }), tip = node('title', {}, 'MACD 12/26/9');
  const fields = [];
  for (const [index, label, cls] of [[0, 'MACD 12/26/9', 'macd-readout-line'], [1, 'Signal', 'macd-readout-signal'], [2, 'Histogramm', 'macd-readout-hist']]) {
    const field = node('text', { x: left + 2 + width * index / 3, y: layout.top + (layout.inline ? 16 : 12), class: 'macd-caption ' + cls });
    const name = node('tspan', {}, layout.inline && width < 600 ? ['M ', 'S ', 'H '][index] : label + (layout.inline ? ' ' : ''));
    const value = node('tspan', { class: 'macd-readout-value', ...(layout.inline ? {} : { x: left + 2 + width * index / 3, dy: 16 }) }, '–');
    field.append(name, value); readout.append(field); fields.push(value);
  }
  readout.append(tip); frame.append(readout);
  frame.append(node('line', { x1: left, x2: left + width, y1: zero, y2: zero, class: 'macd-zero' }), node('rect', { x: left + width + 3, y: zero - 9, width: 17, height: 18, rx: 3, class: 'macd-zero-tag' }), node('text', { x: left + width + 11.5, y: zero + 4, 'text-anchor': 'middle', class: 'macd-caption macd-zero-label' }, '0'));
  svg.append(frame);
  const defs = svg.querySelector('defs'), clip = node('clipPath', { id: 'macd-clip' });
  clip.append(node('rect', { x: left, y: layout.plotTop, width, height: Math.max(0, layout.plotBottom - layout.plotTop) })); defs.append(clip);
  const group = node('g', { class: 'macd-series', 'clip-path': 'url(#macd-clip)', 'data-span': span, 'data-min': scale.min, 'data-max': scale.max });
  const histogram = i => finite(series.line[i]) && finite(series.signal[i]) ? series.line[i] - series.signal[i] : null;
  for (let i = offset; i < stop; i++) {
    const v = histogram(i); if (!finite(v)) continue;
    const bar = node('rect', { x: x(i - offset) - Math.max(.6, step * .7) / 2, y: Math.min(y(v), zero), width: Math.max(.6, step * .7), height: Math.abs(y(v) - zero), class: 'macd-hist ' + macdHistogramTone(v, histogram(i - 1)) });
    group.append(bar);
  }
  for (const [arr, cls] of [[series.line, 'macd-line'], [series.signal, 'macd-signal']]) {
    let d = '', pen = false;
    for (let i = offset; i < stop; i++) { const v = arr[i]; if (finite(v)) { d += `${pen ? 'L' : 'M'}${x(i - offset).toFixed(2)} ${y(v).toFixed(2)}`; pen = true; } else pen = false; }
    group.append(node('path', { d, class: cls, 'vector-effect': 'non-scaling-stroke' }));
  }
  // GEÄNDERT 3.77.2: kleinere Punkte, ausschließlich nach Filterbestätigung.
  for (const hit of macdCrossings(series, offset, stop, { candles, now })) {
    const dot = node('circle', { cx: x(hit.index - offset), cy: y(hit.value), r: MACD_CROSS_RADIUS, class: 'macd-cross ' + (hit.direction > 0 ? 'bull' : 'bear'), 'data-candle': hit.candle, 'data-fraction': hit.fraction, 'data-confirmed': 'true', 'data-confirmed-index': hit.confirmedIndex, 'vector-effect': 'non-scaling-stroke' });
    dot.append(node('title', {}, `${hit.direction > 0 ? 'Bullishe' : 'Bearishe'} MACD-Kreuzung · Richtung mindestens ${MACD_CROSS_MIN_BARS} Schlusskerzen bestätigt · Abstand mindestens ${MACD_CROSS_MIN_FRACTION * 100} % des sichtbaren Histogramm-Maximums`)); group.append(dot);
  }
  svg.append(group);
  let previousIndex = -1, previousSelected = null;
  function select(index, selected = true) {
    index = Math.max(0, Math.min(stop - offset - 1, index));
    if (index === previousIndex && selected === previousSelected) return;
    previousIndex = index; previousSelected = selected;
    const i = offset + index, values = [series.line[i], series.signal[i], histogram(i)];
    fields.forEach((n, j) => { n.textContent = macdValue(values[j]); });
    readout.dataset.index = String(i); readout.dataset.time = String(candles?.[i]?.time ?? ''); readout.dataset.selected = String(selected);
    for (const [j, key] of ['macd', 'signal', 'histogram'].entries()) readout.dataset[key] = finite(values[j]) ? String(values[j]) : '';
    tip.textContent = `MACD 12/26/9 · ${candles?.[i] ? utc(candles[i].time) : ''} · MACD ${macdValue(values[0])} · Signal ${macdValue(values[1])} · Histogramm ${macdValue(values[2])}${selected ? '' : ' · jüngste Kerze'}`;
  }
  select(stop - offset - 1, false);
  return { select, clear: () => select(stop - offset - 1, false) };
}

const STRATEGIES = [
  ['signal', 'Signallinien-Kreuzung',
    'Die MACD-Linie kreuzt ihren geglätteten 9er-Durchschnitt von unten nach oben. Das Histogramm (MACD minus Signal) wird positiv und grün. Das ist eine bullishe Momentum-Wende; der MACD selbst kann dabei noch unter null liegen.',
    'Die MACD-Linie kreuzt ihren geglätteten 9er-Durchschnitt von oben nach unten. Das Histogramm wird negativ und rot. Das ist eine bearishe Momentum-Wende; der MACD selbst kann dabei noch über null liegen.'],
  ['zero', 'Nulllinien-Kreuzung',
    'Der MACD kreuzt die Nulllinie nach oben: EMA 12 liegt wieder über EMA 26. Das bestätigt eine aufwärts gerichtete Trendphase. Es beweist weder einen starken Trend noch einen profitablen Einstieg.',
    'Der MACD kreuzt die Nulllinie nach unten: EMA 12 liegt wieder unter EMA 26. Das bestätigt eine abwärts gerichtete Trendphase. Es beweist weder einen starken Trend noch einen profitablen Einstieg.'],
  ['divergence', 'Divergenz zwischen Kurs und MACD',
    'Der Kurs bildet ein tieferes Tief, die MACD-Linie an denselben beiden Kurs-Tiefs jedoch ein höheres Tief. Das deutet auf nachlassenden Verkaufsdruck hin. Erst eine weitere Kursbestätigung macht daraus eine mögliche Umkehr.',
    'Der Kurs bildet ein höheres Hoch, die MACD-Linie an denselben beiden Kurs-Hochs jedoch ein niedrigeres Hoch. Das deutet auf nachlassenden Kaufdruck hin. Eine Korrektur kann folgen, ist damit aber nicht bestätigt.']
];
const number = v => finite(v) ? v.toLocaleString('de-DE', { maximumSignificantDigits: 6 }) : '–';
const utc = time => new Date(time).toLocaleString('de-DE', { timeZone: 'UTC', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' UTC';
export function createMacdHelp({ document, button, read }) {
  const el = (tag, cls = '', text = '') => { const n = document.createElement(tag); n.className = cls; n.textContent = text; return n; };
  const dialog = el('dialog', 'sheet macd-help'), head = el('div', 'sheet-head'), title = el('h2', '', 'MACD verstehen'), close = el('button', 'button ghost icon', '×'), body = el('div', 'sheet-body macd-help-body');
  dialog.id = 'macd-help'; title.id = 'macd-help-title'; dialog.setAttribute('aria-labelledby', title.id); close.type = 'button'; close.setAttribute('aria-label', 'MACD-Erklärung schließen'); head.append(title, close); dialog.append(head, body); document.body.append(dialog);
  const context = el('p', 'macd-context'), status = el('p', 'macd-status'), values = el('p', 'macd-values');
  body.append(context, el('p', '', 'Die blaue MACD-Linie ist EMA 12 minus EMA 26. Die orange Signallinie ist ihr EMA über 9 Kerzen. Grau gestrichelt: null. Die Balken zeigen MACD minus Signallinie: hellgrün positiv steigend, dunkelgrün positiv fallend, hellrot negativ fallend und dunkelrot negativ steigend. Bei unveränderten Werten bleibt der Balken dunkel. Grüne/rote Kreuzungspunkte erscheinen erst nach bestätigter Richtung und ausreichendem Histogramm-Abstand. Die Mindestdauer und Schwelle sind im Code einstellbar. Im MACD ziehen: Fadenkreuz und Werte verschieben. Doppeltippen: MACD vorübergehend vergrößern oder zurückstellen.'), status, values);
  const cards = [];
  for (const [key, name, bull, bear] of STRATEGIES) {
    const fold = el('details', 'macd-strategy'), summary = el('summary'), heading = el('strong', '', name), state = el('span', 'macd-strategy-state'), grid = el('div', 'macd-directions'); summary.append(heading, state); fold.dataset.strategy = key; fold.append(summary, grid);
    const pair = [];
    for (const [direction, label, text] of [[1, 'Bullish', bull], [-1, 'Bearish', bear]]) {
      const card = el('section', 'macd-direction'), cap = el('h3', '', label), detail = el('p', '', text), found = el('p', 'macd-found'); card.dataset.direction = String(direction); card.append(cap, detail, found); grid.append(card); pair.push({ direction, card, found });
    }
    body.append(fold); cards.push({ key, fold, state, pair });
  }
  body.append(el('p', 'macd-method', 'Hervorhebung: Ereignis innerhalb der letzten 3 abgeschlossenen Kerzen, solange kein Widerspruch vorliegt. Divergenzen vergleichen die letzten bestätigten Kurs-Pivots innerhalb von 60 Kerzen; je 2 abgeschlossene Nachbarkerzen links und rechts sind nötig. Die laufende Kerze ist in den Linien sichtbar, zählt aber nie als Bestätigung.'), el('p', 'macd-caution', 'Seitwärtsphasen können viele Fehlsignale durch wiederholte Kreuzungen erzeugen. Trend und Risiko zusätzlich prüfen. Die Anzeige ergänzt die Orientierung; sie ändert weder Vorauswahl-Modelle noch Alarme und eröffnet keine Trades.'));
  function update(opening = false) {
    if (!dialog.open && !opening) return;
    const c = read(), result = c.findings;
    context.textContent = `${c.symbol.replace(/USDT$/, '/USDT')} · ${c.interval}-Kerzen · ${c.source === 'futures' ? 'Binance Futures' : 'Binance Spot'} · normale Schlusskurse${c.analysisInterval !== c.interval ? ' · Hauptanalyse ' + c.analysisInterval : ''}`;
    status.textContent = result.ready ? `${c.enabled ? 'MACD im Chart an' : 'MACD im Chart aus'} · letzte Schlusskerze ${utc(result.current.closeTime + 1)}` : result.reason;
    values.textContent = result.current ? `Geschlossen: MACD ${number(result.current.line)} · Signal ${number(result.current.signal)} · Histogramm ${number(result.current.histogram)}` : '';
    for (const { key, fold, state, pair } of cards) {
      const event = result.events[key]; fold.dataset.tone = event ? event.direction > 0 ? 'bull' : 'bear' : 'neutral';
      state.textContent = event ? `${event.direction > 0 ? 'Bullish' : 'Bearish'} · ${event.age === 0 ? 'zuletzt bestätigt' : 'vor ' + event.age + (event.age === 1 ? ' Kerze' : ' Kerzen')}` : result.ready ? 'Kein frischer Befund' : 'Nicht aktuell geprüft';
      if (opening) fold.open = key === 'signal' || !!event;
      for (const { direction, card, found } of pair) {
        const active = event?.direction === direction; card.classList.toggle('is-active', active);
        found.textContent = active ? `Erkannt · ${utc(event.confirmedAt)}${key === 'divergence' ? ` · Kurs ${number(event.firstPrice)} → ${number(event.secondPrice)} · MACD ${number(event.firstMacd)} → ${number(event.secondMacd)}` : ''}` : 'Aktuell nicht bestätigt.';
      }
    }
  }
  button.addEventListener('click', () => { if (!dialog.open) dialog.showModal(); update(true); });
  close.addEventListener('click', () => dialog.close());
  // Native Dialogtasten (z. B. Esc) dürfen nicht gleichzeitig den Vollbild-Chart bedienen.
  dialog.addEventListener('keydown', e => e.stopPropagation());
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
  return { update, dialog };
}
