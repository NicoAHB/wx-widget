// 3.78.1: reine Darstellung vorhandener Analyse-Ergebnisse. Keine neue Signal- oder Handelslogik.
import { topDownStatus, topDownStatusText } from './analysis-status.mjs';
import { analysisSignalKey } from './analysis-delivery.mjs';
const QUARTER = 900000;
export function compactAnalysisSignal(s) {
  const { analysisId, analysisName, version, symbol, market, direction, side, at, expiresAt, setupId, bias,
    entry, stop, target1, target2, rr, rr2, setup, confirmationLevel } = s;
  return { analysisId, analysisName, version, symbol, market, direction, side, at, expiresAt, setupId, bias,
    entry, stop, target1, target2, rr, rr2, setup, confirmationLevel,
    zone: s.zone && { id: s.zone.id, low: s.zone.low, high: s.zone.high, knownAt: s.zone.knownAt, labels: s.zone.labels, kinds: s.zone.kinds },
    learningVersion:s.learningVersion,probability:s.probability,probabilityText:s.probabilityText,expectedMinutes:s.expectedMinutes,
    reversal: s.reversal && { at: s.reversal.at, reasons: s.reversal.reasons } };
}

export function analysisChartModel({ result, ledger = {}, symbol, market, id, now }) {
  const r = result || {}, belongs = s => s?.symbol === symbol && s.market === market && s.analysisId === id && s.at <= now;
  const events = (ledger.events || []).filter(e => e.symbol === symbol && e.market === market && e.analysisId === id && e.at <= now);
  const active = (ledger.active || []).filter(p => belongs(p.signal)).map(p => p.signal);
  const previous = [...active, ...events.map(e => e.signal).filter(belongs)].sort((a, b) => b.at - a.at)[0];
  const ready = r.ready === true && now < r.expiresAt;
  const signal = ready && belongs(r.signal) ? r.signal : previous;
  const key = signal && analysisSignalKey(signal), history = key ? events.filter(e => e.id.startsWith(key + '|')) : [];
  const exit = history.find(e => ['stop', 'target2', 'gap'].includes(e.type));
  // Maximal zwei verschiedene Konfluenzzonen; keine unabhängig zugeschalteten allgemeinen Overlay-Flächen.
  const zones = [];
  if (ready && r.direction) for (const z of [r.signal?.zone, ...(r.zones || [])]) {
    if (!z || z.knownAt > r.at || ![z.low, z.high].every(Number.isFinite) || z.high < z.low) continue;
    if (zones.some(a => Math.max(a.low, z.low) <= Math.min(a.high, z.high))) continue;
    zones.push(z); if (zones.length === 2) break;
  }
  return { result: r, ready, direction: ready ? r.direction : 0, stage: ready ? r.stage : 0,
    reason: r.reason || 'Analyse-Daten werden geladen.', zones, signal, events: history,
    current: ready && r.signal === signal, exit, trend: ready ? r.trend : {}, bias: r.bias };
}

export function analysisChartExplanation(model, price, number, time) {
  const { signal: s } = model, dir = model.direction === 1 ? 'Long' : model.direction === -1 ? 'Short' : 'neutral';
  let text = model.ready && model.result ? 'Top-Down · ' + topDownStatusText(topDownStatus(model.result, { price, number, time }), false) : `Top-Down · ${model.ready ? model.stage + '/3 Stufen · 4h-Bias ' + dir : 'Daten nicht aktuell'}. ${model.reason}`;
  text += ' Nur normale, geschlossene Kerzen. 4h: Struktur, Trend und EMA 200. 1h: mindestens zwei Bausteinarten in derselben Zone. 15m: Umkehr und anschließender Schlussbruch.';
  if (s) text += ` ${model.current ? 'Bestätigter Einstieg' : 'Zuletzt bestätigtes Signal (Historie)'} ${s.direction === 1 ? 'Long' : 'Short'} ${price(s.entry)} · Stop ${price(s.stop)} · Ziel 1 ${price(s.target1)} · Ziel 2 ${price(s.target2)} · CRV ${number(s.rr, 2)} / ${number(s.rr2, 2)}. Auslöser: ${(s.reversal?.reasons || []).join(' + ')} und Schluss ${s.direction === 1 ? 'über' : 'unter'} ${price(s.confirmationLevel)}. ${model.exit?.reason || 'Stop-/Zielmarken sind Hinweise, keine ausgeführten Orders.'}`;
  if(s?.learningVersion)text+=` Ziel 1 vor Stop: ${s.probabilityText||'Lernphase'}. ${s.expectedMinutes?'Median bis Ziel: '+Math.round(s.expectedMinutes)+' Minuten.':''} Feste Handelsmarken bleiben unverändert.`;
  return text;
}

// SVG wird in die vorhandenen Chart-Gruppen eingefügt; Geometrie und Zeitzuordnung kommen aus dem Hauptchart.
export function drawAnalysisChart({ node, svg, under, over, model, geometry: g, palette, price, explain }) {
  const { timeX, y, left, pw, top, bottom, min, max, data } = g, right = left + pw, col = model.direction === -1 ? palette.down : palette.up;
  const back = node('g', { class: 'analysis-chart' }), front = node('g', { class: 'analysis-chart' });
  under.append(back); over.append(front);
  const button = (parent, x, yy, text, color, explanation, cls = '', width = 210) => {
    const w = Math.min(width, pw - 8), xx = Math.max(left + 4, Math.min(right - w - 4, x)), cy = Math.max(top + 22, Math.min(bottom - 22, yy));
    const b = node('g', { class: 'analysis-chart-button ' + cls, role: 'button', tabindex: '0', 'aria-label': explanation });
    b.__analysisExplanation = explanation;
    b.append(node('rect', { x: xx, y: cy - 22, width: w, height: 44, fill: 'transparent' }),
      node('rect', { x: xx, y: cy - 10, width: w, height: 22, rx: 5, fill: '#10151c', opacity: .94, stroke: color, 'stroke-width': .6 }),
      node('text', { x: xx + 6, y: cy + 4, fill: color, 'font-size': 10, 'font-weight': 700 }, text));
    b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); explain(explanation); } });
    parent.append(b); return b;
  };
  // Uneingeschränkter Zugang zur Erklärung auch bei neutralem Bias, ohne Zone oder in Vollbild.
  const status = model.ready ? `${model.direction === 1 ? 'Long' : model.direction === -1 ? 'Short' : 'Neutral'} · ${model.stage}/3` : 'Daten fehlen';
  button(svg, left + 4, top + 22, `Top-Down · ${status} ⓘ`, model.direction ? col : palette.zero, g.explanation, 'analysis-chart-info', 190);
  for (const z of model.zones) {
    if (z.high < min || z.low > max) continue;
    const x0 = Math.max(left, timeX(z.knownAt)), y0 = Math.max(top, y(z.high)), y1 = Math.min(bottom, y(z.low));
    if (x0 >= right || y1 < y0) continue;
    const title = `1h ${model.direction === 1 ? 'Kaufzone' : 'Verkaufszone'}`;
    const why = `${title} ${price(z.low)}–${price(z.high)}. Konfluenz: ${(z.labels || []).join(' + ')}. ${model.current ? '15m-Einstieg bestätigt.' : 'Zone ist ein Suchbereich; Einstieg erst nach 15m-Umkehr und bestätigendem Schlussbruch.'} ${g.explanation}`;
    back.append(node('rect', { x: x0, y: y0, width: right - x0, height: Math.max(2, y1 - y0), fill: col, 'fill-opacity': .12, stroke: col, 'stroke-opacity': .6, class: 'analysis-zone', 'data-analysis-symbol': g.symbol }));
    button(front, right - 136, Math.max(top + 70, Math.min(bottom - 24, (y0 + y1) / 2)), `${title} ⓘ`, col, why, 'analysis-zone-info', 128);
  }
  const s = model.signal;
  if (!s || ![s.entry, s.stop, s.target1, s.target2].every(Number.isFinite)) return;
  const firstTime = data[0].time, lastTime = data.at(-1).end ?? data.at(-1).closeTime + 1;
  if (s.at > lastTime || (model.exit && model.exit.at < firstTime)) return;
  const x0 = Math.max(left, timeX(s.at - QUARTER)), x1 = model.exit ? Math.min(right, timeX(model.exit.at - QUARTER)) : right;
  if (x0 > right || x1 < left) return;
  // Historische Linien enden beim beobachteten Ausstieg. Kein altes Signal als neuen Einstieg darstellen.
  const levels = [[s.entry, 'Einstieg', s.direction === 1 ? palette.up : palette.down, 'entry'], [s.stop, 'Stop', palette.down, 'stop'], [s.target1, 'Ziel 1', palette.up, 'target1'], [s.target2, 'Ziel 2', palette.up, 'target2']].sort((a, b) => y(a[0]) - y(b[0]));
  const labelTop = top + 78, labelBottom = bottom - 22, gap = Math.max(0, Math.min(44, (labelBottom - labelTop) / (levels.length - 1)));
  let previousY = labelTop - gap;
  for (const [i, [v, text, color, kind]] of levels.entries()) {
    const outside = v > max ? ' ↑' : v < min ? ' ↓' : '', yy = Math.max(top, Math.min(bottom, y(v)));
    front.append(node('line', { x1: x0, y1: yy, x2: x1, y2: yy, stroke: color, 'stroke-dasharray': kind === 'entry' ? '6 3' : '3 3', opacity: model.current ? .95 : .6, class: 'analysis-signal-line', 'data-analysis-level': kind }));
    // Beschriftungen müssen dieselbe Reihenfolge wie ihre Kursniveaus behalten, auch bei nahen Zielen.
    const ly = Math.min(labelBottom - (levels.length - i - 1) * gap, Math.max(labelTop, previousY + gap, yy)); previousY = ly;
    // Verbindung hält den Bezug auch dann sichtbar, wenn Beschriftungen wegen Platzmangel ausweichen.
    front.append(node('line', { x1: left + 8, y1: yy, x2: left + 8, y2: ly, stroke: color, opacity: .5 }));
    button(front, left + 4, ly, `${model.current ? '' : 'Hist. '}${text} ${price(v)}${outside} ⓘ`, color, g.explanation, 'analysis-level-info', 174);
  }
  function marker(at, v, text, color, why, kind) {
    // Zeitstempel bezeichnet Schlusszeit, der Punkt gehört zur abgeschlossenen 15m-Kerze davor.
    const xx = timeX(at - QUARTER); if (xx < left || xx > right || v < min || v > max) return;
    const mark = node('g', { class: 'analysis-event-marker', 'data-analysis-event': kind, 'data-analysis-at': at, 'data-analysis-price': v, role: 'button', tabindex: '0', 'aria-label': why });
    mark.__analysisExplanation = why;
    mark.append(node('rect', { x: xx - 22, y: y(v) - 22, width: 44, height: 44, fill: 'transparent' }), node('circle', { cx: xx, cy: y(v), r: 5, fill: color, stroke: '#080b10', 'stroke-width': 1.5 }), node('text', { x: xx, y: y(v) - 9, fill: color, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 700 }, text));
    mark.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); explain(why); } }); front.append(mark);
  }
  marker(s.at, s.entry, s.direction === 1 ? '▲ E' : '▼ E', s.direction === 1 ? palette.up : palette.down, g.explanation, 'entry');
  for (const e of model.events) if (['stop', 'target1', 'target2'].includes(e.type)) {
    const v = e.type === 'stop' ? s.stop : e.type === 'target1' ? s.target1 : s.target2;
    marker(e.at, v, e.type === 'stop' ? '× SL' : e.type === 'target1' ? '✓ Z1' : '✓ Z2', e.type === 'stop' ? palette.down : palette.up, e.reason + ' ' + g.explanation, e.type);
  }
}

// Nur ein echter kurzer Tipp öffnet die Erklärung. Schwenken und Pinch laufen unverändert weiter.
export function installAnalysisChartTap(root, explain) {
  const doc = root.ownerDocument, pointers = new Set(); let tap = null, touchTap = null;
  const targetText = e => e.target.closest?.('.analysis-chart-button,.analysis-event-marker')?.__analysisExplanation;
  root.addEventListener('pointerdown', e => {
    pointers.add(e.pointerId); const target = e.target.closest?.('.analysis-chart-button,.analysis-event-marker');
    tap = pointers.size === 1 && target ? { id: e.pointerId, x: e.clientX, y: e.clientY, at: Date.now(), text: target.__analysisExplanation } : null;
  }, true);
  doc.addEventListener('pointermove', e => { if (tap?.id === e.pointerId && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > 8) tap = null; }, true);
  doc.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); tap = null; }, true);
  doc.addEventListener('pointerup', e => {
    const t = tap; pointers.delete(e.pointerId); tap = null;
    if (t?.id === e.pointerId && Math.hypot(e.clientX - t.x, e.clientY - t.y) <= 8 && Date.now() - t.at < 800) { touchTap = null; explain(t.text); }
  }, true);
  // Safari kann beim Ersetzen des Live-SVG pointercancel auslösen, obwohl der Finger nur tippt.
  // Touch-Ende bleibt gültig; echte Bewegung, ein zweiter Finger oder touchcancel verwerfen es.
  root.addEventListener('touchstart', e => {
    const t = e.touches[0], text = targetText(e);
    touchTap = e.touches.length === 1 && text ? { id: t.identifier, x: t.clientX, y: t.clientY, at: Date.now(), text } : null;
  }, { capture: true, passive: true });
  doc.addEventListener('touchmove', e => {
    const t = [...e.touches].find(t => t.identifier === touchTap?.id);
    if (!t || e.touches.length !== 1 || Math.hypot(t.clientX - touchTap.x, t.clientY - touchTap.y) > 8) touchTap = null;
  }, { capture: true, passive: true });
  doc.addEventListener('touchcancel', () => { touchTap = null; }, { capture: true, passive: true });
  doc.addEventListener('touchend', e => {
    const q = touchTap, t = [...e.changedTouches].find(t => t.identifier === q?.id); touchTap = null;
    if (t && !e.touches.length && Math.hypot(t.clientX - q.x, t.clientY - q.y) <= 8 && Date.now() - q.at < 800) { tap = null; explain(q.text); }
  }, { capture: true, passive: true });
}

export function createAnalysisChartHelp(doc) {
  const dialog = doc.createElement('dialog'); dialog.id = 'analysis-chart-help'; dialog.className = 'sheet analysis-chart-help';
  dialog.setAttribute('aria-labelledby', 'analysis-chart-help-title');
  const title = doc.createElement('h3'); title.id = 'analysis-chart-help-title'; title.textContent = 'Top-Down · Erklärung';
  const content = doc.createElement('p'), close = doc.createElement('button'); close.type = 'button'; close.textContent = 'Schließen';
  dialog.addEventListener('keydown', e => e.stopPropagation()); // Escape schließt nur die Erklärung, nicht den Vollbild-Chart.
  close.addEventListener('click', () => dialog.close()); dialog.append(title, content, close); doc.body.append(dialog);
  return text => { title.textContent=(['Trendfolge-Rücksetzer','Range-Rückkehr','Ausbruch mit Rücktest','Relative Stärke','AMD'].find(name=>text.startsWith(name))||'Top-Down')+' · Erklärung';content.textContent = text; if (!dialog.open) dialog.showModal(); dialog.scrollTop = 0; };
}
