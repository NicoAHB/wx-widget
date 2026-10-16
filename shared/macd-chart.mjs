// MACD-Darstellung: verwendet die vorhandenen 12/26/9-Werte, verändert keine Handelsregeln.
const finite = Number.isFinite;
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

export function macdPaneLayout(height, enabled) {
  const bottom = height - 77;
  if (!enabled) return { priceBottom: bottom, height: 0 };
  const size = Math.min(146, Math.max(72, height * .24));
  return { priceBottom: bottom - size - 14, top: bottom - size, bottom, plotTop: bottom - size + 23, plotBottom: bottom - 5, height: size };
}

// Derselbe SVG- und Kerzen-X-Maßstab wie der Kurschart: Zoom und Pan bleiben synchron.
export function drawMacdPane(svg, { node, series, offset, stop, x, step, left, width, layout }) {
  if (!layout.height) return;
  const line = series.line.slice(offset, stop), signal = series.signal.slice(offset, stop), histogram = line.map((v, i) => finite(v) && finite(signal[i]) ? v - signal[i] : null);
  const values = [...line, ...signal, ...histogram].filter(finite), span = Math.max(...values.map(Math.abs), 1e-12) * 1.12;
  const y = v => layout.plotTop + (span - v) / (2 * span) * (layout.plotBottom - layout.plotTop), zero = y(0);
  const frame = node('g', { class: 'macd-frame' });
  frame.append(node('line', { x1: left, x2: left + width, y1: layout.top, y2: layout.top, class: 'macd-separator' }), node('text', { x: left + 2, y: layout.top + 14, class: 'macd-caption' }, 'MACD 12/26/9'));
  for (const [label, cls, dx] of [['MACD', 'macd-line', 114], ['Signal', 'macd-signal', 188]]) {
    frame.append(node('line', { x1: left + dx, x2: left + dx + 13, y1: layout.top + 10, y2: layout.top + 10, class: cls }), node('text', { x: left + dx + 18, y: layout.top + 14, class: 'macd-caption' }, label));
  }
  frame.append(node('line', { x1: left, x2: left + width, y1: zero, y2: zero, class: 'macd-zero' }), node('text', { x: left + width - 3, y: zero - 4, 'text-anchor': 'end', class: 'macd-caption macd-zero-label' }, '0'));
  svg.append(frame);
  const defs = svg.querySelector('defs'), clip = node('clipPath', { id: 'macd-clip' });
  clip.append(node('rect', { x: left, y: layout.plotTop, width, height: layout.plotBottom - layout.plotTop })); defs.append(clip);
  const group = node('g', { class: 'macd-series', 'clip-path': 'url(#macd-clip)' });
  histogram.forEach((v, i) => { if (finite(v)) group.append(node('rect', { x: x(i) - Math.max(.6, step * .6) / 2, y: Math.min(y(v), zero), width: Math.max(.6, step * .6), height: Math.abs(y(v) - zero), class: 'macd-hist ' + (v >= 0 ? 'up' : 'down') })); });
  for (const [arr, cls] of [[line, 'macd-line'], [signal, 'macd-signal']]) {
    let d = '', pen = false;
    arr.forEach((v, i) => { if (finite(v)) { d += `${pen ? 'L' : 'M'}${x(i).toFixed(2)} ${y(v).toFixed(2)}`; pen = true; } else pen = false; });
    group.append(node('path', { d, class: cls, 'vector-effect': 'non-scaling-stroke' }));
  }
  svg.append(group);
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
  body.append(context, el('p', '', 'Die blaue MACD-Linie ist EMA 12 minus EMA 26. Die orange Signallinie ist ihr EMA über 9 Kerzen. Grau gestrichelt: null. Die Balken zeigen MACD minus Signallinie, grün über null und rot darunter.'), status, values);
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
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
  return { update, dialog };
}
