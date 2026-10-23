// AMD (3.90.0): Anzeige – Statuskarte, Einstellungen und Chart-Zeichnung. Keine Handels- oder Signalregel (siehe amd-core.mjs).
import { AMD, AMD_INTERVALS, AMD_STAGE_NAMES, amdOptions } from './amd-core.mjs';
import { AMD_REVIEW, runAmdReview } from './amd-review.mjs';

const BLUE = '#4aa8ff', GREY = '#8a93a3', INK = '#10151c';
const de = (v, digits = 2) => Number.isFinite(v) ? v.toLocaleString('de-DE', { maximumFractionDigits: digits }) : '–';
const BADGES = { none: 'Keine Range', data: 'Zu wenig Daten', accumulation: 'Range läuft', manipulation: 'Manipulation', target: 'Ziel erreicht', stop: 'Stop erreicht', expired: 'Abgelaufen', filtered: 'CRV zu niedrig', invalid: 'Ungültig', unchecked: 'Nicht prüfbar' };

export const AMD_RULES = `Ablauf: 1) Accumulation – mindestens ${AMD.minCandles} Kerzen seitwärts, Höhe höchstens ${de(AMD.maxHeightAtr, 1)} × ATR (einstellbar). 2) Manipulation – eine Kerze durchbricht Hoch oder Tief der Range um mindestens ${de(AMD.minBreakAtr, 1)} ATR. 3) Bestätigung – eine Kerze schließt zurück in der Range UND im 1m-Chart folgt ein Strukturbruch in Gegenrichtung (Schluss über dem letzten 1m-Swing-Hoch nach einem Fehlausbruch nach unten = Long; umgekehrt Short). Bleibt der Preis außerhalb (${AMD.maxOutsideCloses} Schlüsse in Folge) oder fehlt der Strukturbruch ${AMD.maxWaitCandles} Kerzen lang, ist das Setup ungültig und wird grau. 4) Distribution – Einstieg zum Bestätigungskurs, Stop ${de(AMD.stopBufferAtr, 1)} ATR hinter dem Manipulations-Extrem, Ziel ist die Gegenseite der Range; nur CRV ab 1:${de(AMD.minRR, 1)} (einstellbar) wird gemeldet. Nur normale, geschlossene Kerzen; die laufende Kerze zeigt einen Durchbruch nur vorläufig. Bei Tages-, Wochen- und Monatskerzen prüft der 1m-Chart die letzten rund 16 Stunden. Modellhinweise, keine Orderausführung.`;

export function describeAmd(r, { price = String } = {}) {
  const e = r.current;
  return [r.reason, e?.range ? `Range ${price(e.range.low)}–${price(e.range.high)} · ${r.interval}` : null].filter(Boolean).join(' ');
}

export function amdStatus(r, { price = String, number = de, time = v => new Date(v).toISOString() } = {}) {
  const e = r.current, o = r.options || amdOptions(), iv = r.interval, phase = r.phase, side = e?.direction === 1 ? 'Long' : 'Short';
  const sideText = e?.direction === 1 ? 'nach unten' : 'nach oben', reached = !!e && e.direction !== 0;
  const confirmed = e?.status === 'confirmed', filtered = e?.status === 'filtered', dead = e?.status === 'invalid' || e?.status === 'unchecked';
  const tone = e?.direction === 1 ? 'long' : 'short';
  const step = (id, label, state, t, text) => ({ id, label, state, tone: t, text });
  const bars = e ? e.range.end - e.range.start + 1 : 0;
  const accumulation = e
    ? step('amd-accumulation', `Accumulation · ${iv}`, e.status === 'accumulating' ? 'Range läuft' : 'Range stand', 'neutral', `${bars} Kerzen · ${price(e.range.low)}–${price(e.range.high)} · Höhe ${number(e.range.height / e.range.atr, 2)} × ATR (erlaubt ${number(o.maxHeightAtr, 1)}) · seit ${time(e.range.startTime)}`)
    : step('amd-accumulation', `Accumulation · ${iv}`, 'Wartet', 'neutral', r.reason || `Gesucht: mindestens ${AMD.minCandles} ${iv}-Kerzen seitwärts, Höhe höchstens ${number(o.maxHeightAtr, 1)} × ATR.`);
  let manipulation;
  if (!reached) manipulation = step('amd-manipulation', 'Manipulation', 'Wartet', 'neutral', `Eine Kerze durchbricht Hoch oder Tief der Range um mindestens ${number(AMD.minBreakAtr, 1)} ATR. Fehlausbruch nach unten ergibt Long, nach oben Short.`);
  else {
    const base = `Durchbruch ${sideText} bis ${price(e.extreme)} · ab ${time(e.breakAt)}`;
    if (e.status === 'manipulating') manipulation = step('amd-manipulation', 'Manipulation', 'Läuft', 'neutral', e.provisional ? `${base} · die Kerze läuft noch; bestätigt wird erst nach ihrem Schluss.` : `${base} · Schluss in der Range: ${e.inside ? 'ja' : 'nein'} · 1m-Strukturbruch: ${e.bosAt ? 'ja' : 'nein'} (beides nötig, Wartezeit ${AMD.maxWaitCandles} Kerzen).`);
    else if (confirmed || filtered) manipulation = step('amd-manipulation', 'Manipulation', 'Bestätigt', tone, `${base} · Schluss in der Range und 1m-Strukturbruch (Schluss ${e.direction === 1 ? 'über' : 'unter'} ${price(e.bosLevel)}) um ${time(e.confirmedAt)}.`);
    else manipulation = step('amd-manipulation', 'Manipulation', e.status === 'unchecked' ? 'Nicht prüfbar' : 'Ungültig', 'neutral', `${base} · ${e.reason}`);
  }
  let distribution;
  if (confirmed) {
    const state = e.outcome.status === 'target' ? 'Ziel erreicht' : e.outcome.status === 'stop' ? 'Stop erreicht' : phase === 'expired' ? 'Hinweis abgelaufen' : 'Offen';
    distribution = step('amd-distribution', 'Distribution · Ziel', state, e.outcome.status === 'target' ? 'long' : e.outcome.status === 'stop' ? 'short' : tone,
      `${side} · Einstieg ${price(e.entry)} · Stop ${price(e.stop)} (hinter dem Extrem) · Ziel ${price(e.target)} (Gegenseite der Range) · CRV 1:${number(e.rr, 2)}. Modellbeobachtung, keine Order.`);
  } else if (filtered) distribution = step('amd-distribution', 'Distribution · Ziel', 'Kein Signal', 'neutral', `${e.reason} Gemeldet wird nur ab CRV 1:${number(o.minRR, 1)}.`);
  else distribution = step('amd-distribution', 'Distribution · Ziel', 'Wartet', 'neutral', `Erst nach der Bestätigung: Einstieg, Stop hinter dem Manipulations-Extrem, Ziel = Gegenseite der Range. Gemeldet wird nur ab CRV 1:${number(o.minRR, 1)}.`);
  const levels = confirmed || filtered && Number.isFinite(e.rr)
    ? [['Einstieg', price(e.entry)], ['Stop', price(e.stop)], ['Ziel · Gegenseite', price(e.target)], ['CRV', `1:${number(e.rr, 2)}`]]
    : e?.range ? [['Range-Hoch', price(e.range.high)], ['Range-Tief', price(e.range.low)]] : [];
  return {
    stage: r.stage || 0, shortLabels: [...AMD_STAGE_NAMES], badge: phase === 'signal' ? `${side} bestätigt` : BADGES[phase] || 'AMD', reason: r.reason,
    direction: phase === 'signal' ? e.direction : 0, counter: dead ? `${r.stage || 0}/3 · ${BADGES[phase]}` : undefined,
    steps: [accumulation, manipulation, distribution], levels
  };
}

const make = (d, tag, cls, text) => { const n = d.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
// Einstellungen im Aufklappbereich der AMD-Zeile: Zeitrahmen (5 Minuten bis 1 Monat), maximale Rangehöhe, Mindest-CRV
export function createAmdTools({ root, getOptions, setOptions, services = {} }) {
  const d = root.ownerDocument, box = make(d, 'details', 'amd-tools'), summary = make(d, 'summary', '', 'AMD-Einstellungen & Regeln'); box.append(summary); root.append(box);
  const bar = make(d, 'div', 'amd-intervals'); bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'AMD-Zeitrahmen');
  const buttons = new Map();
  for (const id of AMD_INTERVALS) {
    const b = make(d, 'button', '', id); b.type = 'button'; b.dataset.amdInterval = id; b.title = `AMD auf ${id}-Kerzen prüfen`;
    b.addEventListener('click', () => { setOptions({ ...getOptions(), interval: id }); services.showInterval?.(id); });
    bar.append(b); buttons.set(id, b);
  }
  const fields = make(d, 'div', 'amd-fields'), inputs = new Map();
  for (const [key, label, min, max, step] of [['maxHeightAtr', 'Maximale Rangehöhe · × ATR', 0.5, 4, 0.1], ['minRR', 'Mindest-CRV · 1 : x', 1, 5, 0.5]]) {
    const row = make(d, 'label'), input = make(d, 'input'); input.type = 'number'; input.min = min; input.max = max; input.step = step; input.inputMode = 'decimal'; input.dataset.amdOption = key;
    input.addEventListener('change', () => { setOptions({ ...getOptions(), [key]: Number(String(input.value).replace(',', '.')) }); paint(); });
    row.append(make(d, 'span', '', label), input); fields.append(row); inputs.set(key, input);
  }
  // Rückblick: zählt für die Vorauswahl-Coins, wie oft in den letzten 30 Tagen eine Range, ein Durchbruch und eine Bestätigung vorkamen
  const actions = make(d, 'div', 'amd-review-actions'), start = make(d, 'button', 'button ghost', `Rückblick · letzte ${AMD_REVIEW.days} Tage`), cancel = make(d, 'button', 'button ghost', 'Abbrechen'), note = make(d, 'p', 'analysis-hint'), report = make(d, 'div', 'amd-review-report');
  start.type = cancel.type = 'button'; start.dataset.amdReview = ''; cancel.hidden = true; note.setAttribute('role', 'status'); note.textContent = 'Der Rückblick zählt für alle Coins der Vorauswahl, wie oft die Regeln im letzten Monat angeschlagen hätten – bei mehreren Rangehöhen nebeneinander. Er sendet nichts.'; actions.append(start, cancel);
  box.append(make(d, 'p', 'analysis-hint', 'Zeitrahmen der Analyse (gilt für alle Coins der Vorauswahl):'), bar, fields, actions, note, report, make(d, 'p', 'analysis-hint amd-rules', AMD_RULES));
  let controller = null, last = null, shownFor = null;
  const sum = (c, key) => c[key] ?? 0, plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  function line(c) { return `${plural(sum(c, 'accumulations'), 'Accumulation', 'Accumulationen')} · ${plural(sum(c, 'manipulations'), 'Manipulation', 'Manipulationen')} · ${sum(c, 'closedInside')} mit Schluss in der Range · ${sum(c, 'confirmed')} bestätigt · ${sum(c, 'reported')} gemeldet${sum(c, 'filtered') ? ` (${sum(c, 'filtered')} mit CRV unter dem Mindestwert)` : ''}`; }
  function paintReport() {
    report.replaceChildren(); if (!last) return;
    const o = amdOptions(getOptions()); shownFor = o.maxHeightAtr;
    report.append(make(d, 'p', 'analysis-hint', `Letzte ${last.days} Tage · ${last.interval} · ${last.checked}/${last.coins} Coins${last.minuteCheck ? ` · ${last.windows} Minutenfenster für den 1m-Strukturbruch` : ' · ohne 1m-Prüfung (Zeitrahmen zu groß): bestätigt wird hier nicht gezählt'} · gemeldet = CRV ab 1:${(last.minRR).toLocaleString('de-DE')}`));
    for (const level of last.levels) {
      const current = level === o.maxHeightAtr, card = make(d, 'div', 'amd-review-level'), c = last.total[level], head = make(d, 'strong', '', `Rangehöhe bis ${level.toLocaleString('de-DE')} × ATR${current ? ' · eingestellt' : ''}`);
      card.dataset.amdLevel = String(level); card.dataset.current = String(current); card.append(head, make(d, 'span', '', line(c)));
      if (!current) { const adopt = make(d, 'button', 'chip-tool', 'Übernehmen'); adopt.type = 'button'; adopt.dataset.amdAdopt = String(level); adopt.addEventListener('click', () => { setOptions({ ...getOptions(), maxHeightAtr: level }); paint(); paintReport(); }); card.append(adopt); }
      report.append(card);
    }
    const now = last.total[o.maxHeightAtr];
    if (now && !now.manipulations) report.append(make(d, 'p', 'analysis-hint', 'Mit der eingestellten Rangehöhe gab es im Rückblick keinen einzigen Durchbruch: Sie ist zu streng. Eine Stufe mit Treffern lässt sich mit „Übernehmen“ einstellen.'));
    const per = make(d, 'details', 'amd-review-coins'); per.append(make(d, 'summary', '', 'Je Coin (eingestellte Rangehöhe)'));
    for (const coin of last.perCoin) per.append(make(d, 'p', 'analysis-hint', `${coin.symbol.replace(/USDT$/, '')}: ${line(coin.cells[o.maxHeightAtr] || coin.cells[last.levels[0]] || {})}`));
    report.append(per);
    if (last.errors.length) { const bad = make(d, 'details', 'amd-review-errors'); bad.append(make(d, 'summary', '', `${last.errors.length} Datenfehler`)); for (const e of last.errors.slice(0, 30)) bad.append(make(d, 'p', 'analysis-hint', `${e.symbol}: ${e.text}`)); report.append(bad); }
  }
  cancel.addEventListener('click', () => controller?.abort());
  start.addEventListener('click', async () => {
    if (controller) return;
    if (!services.available?.() || !services.history || !services.symbols) { note.textContent = 'Für den Rückblick die App aktiv, online und ungepaust lassen.'; return; }
    const o = amdOptions(getOptions()); controller = new AbortController(); start.disabled = true; cancel.hidden = false; note.textContent = 'Kerzen der letzten 30 Tage werden geladen …';
    try {
      last = await runAmdReview({ symbols: services.symbols(), history: services.history, now: services.now(), interval: o.interval, thresholds: [...AMD_REVIEW.thresholds, o.maxHeightAtr], minRR: o.minRR, signal: controller.signal, progress: p => { note.textContent = `${p.checked}/${p.total} Coins · ${p.symbol.replace(/USDT$/, '')} · ${p.step === '1m' ? '1m-Fenster' : 'Kerzen'} …`; } });
      note.textContent = `Rückblick fertig: ${last.checked}/${last.coins} Coins geprüft. Nichts wurde gesendet oder gespeichert.`; paintReport();
    } catch (error) { note.textContent = controller.signal.aborted ? 'Rückblick abgebrochen.' : error.message; } finally { controller = null; start.disabled = false; cancel.hidden = true; }
  });
  function paint() {
    const o = amdOptions(getOptions());
    for (const [id, b] of buttons) { b.classList.toggle('active', id === o.interval); b.setAttribute('aria-pressed', String(id === o.interval)); }
    for (const [key, input] of inputs) if (d.activeElement !== input) input.value = String(o[key]);
    if (last && shownFor !== o.maxHeightAtr) paintReport();
  }
  paint();
  return { paint };
}

// Zeichnung im Hauptchart: blaue Accumulation, rote Manipulation, grüne/rote Distribution; ungültige Abläufe grau
export function drawAmdChart({ node, svg, under, over, result: r, geometry: g, palette: p, price, explain }) {
  const { left, pw, top, bottom, min, max, timeX, y, x } = g, right = left + pw, labelRight = Math.min(right - 4, (Number.isFinite(g.rx) ? g.rx : right) - 2), half = Number.isFinite(x(1) - x(0)) ? Math.abs(x(1) - x(0)) / 2 : 0;
  const back = node('g', { class: 'analysis-chart amd-chart' }), front = node('g', { class: 'analysis-chart amd-chart' }); under.append(back); over.append(front);
  const e0 = r?.current, iv = r?.interval || AMD.defaultInterval, o = r?.options || amdOptions();
  const state = r?.phase === 'signal' ? `${r.direction === 1 ? 'Long' : 'Short'} bestätigt` : r?.ready ? BADGES[r.phase] || 'AMD' : 'Daten fehlen';
  const why = `AMD · ${iv} · ${r?.reason || 'Warten auf Kerzen.'} ${AMD_RULES} ${e0?.range ? `Aktuelle Range ${price(e0.range.low)}–${price(e0.range.high)}.` : ''} ${r?.lastSignal && r.phase === 'signal' ? `${r.lastSignal.side === 'long' ? 'Long' : 'Short'} · Einstieg ${price(r.lastSignal.entry)} · Stop ${price(r.lastSignal.stop)} · Ziel ${price(r.lastSignal.target)} · CRV 1:${de(r.lastSignal.rr)}.` : ''} Mindest-CRV 1:${de(o.minRR, 1)}, maximale Rangehöhe ${de(o.maxHeightAtr, 1)} × ATR.`;
  const color = r?.phase === 'signal' ? (r.direction === 1 ? p.up : p.down) : ['invalid', 'unchecked', 'none', 'data', 'expired'].includes(r?.phase) ? GREY : BLUE;
  function button(xx0, yy, text, col, width = 250) {
    const w = Math.min(width, pw - 8), xx = Math.max(left + 4, Math.min(right - w - 4, xx0)), cy = Math.max(top + 22, Math.min(bottom - 22, yy)), b = node('g', { class: 'analysis-chart-button amd-chart-info', role: 'button', tabindex: 0, 'aria-label': why });
    b.__analysisExplanation = why;
    b.append(node('rect', { x: xx, y: cy - 22, width: w, height: 44, fill: 'transparent' }), node('rect', { x: xx, y: cy - 11, width: w, height: 24, rx: 5, fill: INK, opacity: .95, stroke: col, 'stroke-width': .6 }), node('text', { x: xx + 6, y: cy + 5, fill: col, 'font-size': 10, 'font-weight': 700 }, text));
    b.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); explain(why); } });
    svg.append(b); return b;
  }
  button(left + 4, top + 22, `AMD · ${iv} · ${state} ⓘ`, color, Math.min(300, pw - 8)).dataset.amdChartStatus = '';
  const xOf = t => timeX(t) - half, yClamp = v => Math.max(top, Math.min(bottom, y(v)));
  const text = (xx, yy, value, col, cls, anchor = 'start', size = 9) => front.append(node('text', { x: xx, y: yy, fill: col, 'font-size': size, 'font-weight': 700, 'text-anchor': anchor, stroke: INK, 'stroke-width': 2.5, 'paint-order': 'stroke', 'pointer-events': 'none', class: cls }, value));
  function rect(parent, kind, box, col, opacity, x0, x1, label, labelBelow = false) {
    if (!box || !(x1 - x0 >= 1) || box.high < min && box.low < min || box.low > max && box.high > max) return null;
    const y0 = yClamp(box.high), y1 = yClamp(box.low), h = Math.max(2, y1 - y0);
    parent.append(node('rect', { x: x0, y: y0, width: x1 - x0, height: h, fill: col, 'fill-opacity': opacity, stroke: col, 'stroke-opacity': .65, 'stroke-width': 1, 'pointer-events': 'none', class: `amd-box amd-box-${kind}`, 'data-amd-box': kind }));
    // die Statuszeile belegt links oben die ersten 44 px: die Beschriftung der Range rutscht darunter; die der Manipulation steht links neben ihrem Kasten
    if (label && labelBelow && x0 - left >= 90) text(x0 - 4, Math.min(bottom - 3, y0 + h / 2 + 3), label, col, `amd-label amd-label-${kind}`, 'end');
    else if (label) text(Math.max(left + 3, x0 + 3), labelBelow ? Math.min(bottom - 3, y0 + h + 10) : Math.min(bottom - 3, Math.max(y0 + 10, kind === 'accumulation' ? top + 56 : 0)), label, col, `amd-label amd-label-${kind}`);
    return { y0, y1, h };
  }
  function line(value, x0, x1, col, kind, label, dash = '6 4') {
    if (!(x1 - x0 >= 1) || value > max || value < min) return;
    const yy = y(value); front.append(node('line', { x1: x0, x2: x1, y1: yy, y2: yy, stroke: col, 'stroke-width': 1.1, 'stroke-dasharray': dash, 'stroke-opacity': .85, 'pointer-events': 'none', class: 'amd-line', 'data-amd-line': kind }));
    if (label) text(Math.min(labelRight, x1 - 2), yy - 3, `${label} ${price(value)}`, col, 'amd-line-label', 'end', 9);   // links vom Preisband und der Kurs-Marke
  }
  const episodes = r?.episodes || [];
  for (const e of episodes) {
    const latest = e === e0, dead = e.status === 'invalid' || e.status === 'unchecked', b = e.boxes || {}, open = latest && (e.status === 'accumulating' || e.status === 'manipulating' || e.status === 'confirmed' && e.outcome?.status === 'open');
    const end = open ? right : Math.min(right, xOf(e.outcome?.at ?? e.endAt ?? b.accumulation.to)), dim = latest ? 1 : .6;
    const acc = dead ? GREY : BLUE, man = dead ? GREY : p.down, dist = e.status === 'filtered' ? GREY : e.direction === 1 ? p.up : p.down;
    const a = b.accumulation, ax0 = Math.max(left, xOf(a.from)), ax1 = Math.min(right, xOf(a.to));
    const g1 = node('g', { class: 'amd-episode', 'data-amd-status': e.status, 'data-amd-latest': String(latest), opacity: dim });
    back.append(g1);
    rect(g1, 'accumulation', a, acc, .14, ax0, ax1, 'Accumulation');
    // Hoch und Tief der Range laufen nach rechts weiter (bis zum Ende des Ablaufs, beim laufenden Ablauf bis zum Rand)
    const targetSide = b.distribution ? (e.direction === 1 ? 'high' : 'low') : '';      // dort steht schon „Ziel“
    line(a.high, ax1, end, acc, 'range-high', latest && targetSide !== 'high' ? 'Range-Hoch' : '');
    line(a.low, ax1, end, acc, 'range-low', latest && targetSide !== 'low' ? 'Range-Tief' : '');
    if (b.manipulation) {
      const mx0 = Math.max(left, xOf(b.manipulation.from)), mx1 = Math.min(right, Math.max(xOf(b.manipulation.to), mx0 + 3));
      rect(g1, 'manipulation', b.manipulation, man, .2, mx0, mx1, 'Manipulation', e.direction === 1);
      if (latest) line(e.extreme, mx0, right, man, 'extreme', e.status === 'manipulating' ? 'Extrem' : '', '2 4');
    }
    if (b.distribution) {
      const dx0 = Math.max(left, xOf(b.distribution.from)), dx1 = b.distribution.to ? Math.min(right, xOf(b.distribution.to)) : right;
      const crv = `CRV 1:${de(e.rr)}${e.status === 'filtered' ? ` (unter 1:${de(o.minRR, 1)})` : ''}`;
      rect(g1, 'distribution', b.distribution, dist, e.status === 'filtered' ? .08 : .16, dx0, dx1, 'Distribution');
      line(e.entry, dx0, dx1, e.status === 'filtered' ? GREY : BLUE, 'entry', latest ? `${crv} · Einstieg` : '', '3 3');
      if (latest) { line(e.target, dx0, dx1, dist, 'target', 'Ziel', '6 4'); line(e.stop, dx0, dx1, p.down, 'stop', 'Stop', '6 4'); }
      const mark = timeX(e.confirmedAt), yy = y(e.entry);
      if (mark >= left && mark <= right && yy >= top && yy <= bottom) front.append(node('circle', { cx: mark, cy: yy, r: 3.5, fill: dist, stroke: INK, 'stroke-width': 1.2, 'pointer-events': 'none', class: 'amd-entry-mark' }));
    }
  }
}
