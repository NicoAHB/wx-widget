// Reine Darstellung der bestehenden Modellregeln. Keine zusätzlichen Kerzen, Signale oder Aufträge.
import { WATCH_MODELS, WATCH_PULLBACK, watchClassicDirection } from './watch-model-core.mjs';
const KEYS = ['trend', 'kurs', 'rsi', 'macd', 'volume'];
const formats = new Map();
const number = (v, digits = 2) => {
  if (!Number.isFinite(v)) return '–';
  if (!formats.has(digits)) formats.set(digits, new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits }));
  return formats.get(digits).format(v);
};
const price = v => number(v, Math.abs(v) >= 100 ? 2 : Math.abs(v) >= 1 ? 4 : 6);
const time = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const stamp = v => Number.isFinite(v) && v > 0 ? time.format(v) : '–';
const compare = (a, b, yes, no, equal) => !Number.isFinite(a) || !Number.isFinite(b) ? '–' : a > b ? yes : a < b ? no : equal;
const indicator = v => number(v, Math.abs(v) >= 1 ? 4 : 6);
function rsiChange(previous, current) {
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return 'RSI-Werte fehlen';
  if (previous === current) return `Zuletzt ${number(current)} · unverändert zur vorigen Kerze`;
  const direction = current > previous ? 'gestiegen' : 'gefallen';
  if (number(previous) === number(current)) return `Zuletzt ${number(current)} · minimal ${direction} (gerundet)`;
  return `Vorher ${number(previous)} → zuletzt ${number(current)} · ${direction}`;
}
function ruleHelp({ key, strict, up, ready, passed, interval, values: v, evidence: e, ratio, rsiRule }) {
  const direction = up ? 'Long' : 'Short', over = up ? 'über' : 'unter';
  const frame = strict ? key === 'trend' ? '4h' : '15m' : interval;
  let meaning, rule, measured;
  if (key === 'trend') {
    meaning = 'Ein EMA ist ein geglätteter Durchschnitt der Schlusskurse. Neue Kurse zählen stärker. Die Zahl nennt die Anzahl der Kerzen.';
    rule = strict ? `Für ${direction}: Der 4h-Schlusskurs muss ${over} EMA 200 liegen und EMA 200 muss ${up ? 'steigen' : 'fallen'}.` : `Für ${direction}: EMA 20 muss ${over} EMA 50 liegen. Der Vergleich beschreibt die Trendrichtung.`;
    measured = strict ? `Schlusskurs ${price(e.trend?.close)} · EMA 200 ${price(e.trend?.ema)} · zuvor ${price(e.trend?.previousEma)}.` : `EMA 20 ${price(v.e20)} · EMA 50 ${price(v.e50)}.`;
  }
  if (key === 'kurs') {
    const length = strict ? 200 : 20;
    meaning = `Hier wird der letzte abgeschlossene Kurs mit seinem EMA ${length} verglichen. „Schlusskurs“ ist der Preis am Ende einer Kerze; die laufende Kerze zählt nicht.`;
    rule = `Für ${direction}: Der Schlusskurs muss ${over} EMA ${length} liegen. Damit prüft die Regel die Lage des Kurses zum Durchschnitt.`;
    measured = `Schlusskurs ${price(strict ? e.price?.close : v.last)} · EMA ${length} ${price(strict ? e.price?.ema : v.e20)}.`;
  }
  if (key === 'rsi') {
    meaning = 'Der RSI beschreibt die Stärke der jüngsten Kursbewegungen auf einer Skala von 0 bis 100. „14“ bedeutet 14 Kerzen. „Vorher“ und „zuletzt“ beziehen sich auf die letzten beiden abgeschlossenen Kerzen.';
    rule = strict ? up ? `Für Long: In den ${WATCH_PULLBACK.rsiBars} vorigen Kerzen mindestens einmal RSI ≤ ${WATCH_PULLBACK.longPullback}; zuletzt über 50, unter 70 und weiter steigend.` : `Für Short: In den ${WATCH_PULLBACK.rsiBars} vorigen Kerzen mindestens einmal RSI ≥ ${WATCH_PULLBACK.shortPullback}; zuletzt über 30, unter 50 und weiter fallend.`
      : up ? 'Für Long reicht eine von zwei Bedingungen: RSI unter 30 und steigend ODER ein positiver Anstieg über dem statistischen Normalbereich: ΔRSI > SMA20(ΔRSI) + 2 × σ20 und ΔRSI > 0. Der Momentum-Trigger kann auch bei einem RSI über 30 zählen.' : 'Für Short: Der letzte RSI muss über 70 liegen und gegenüber der vorigen Kerze fallen. Der neue Momentum-Zusatz gilt nur für Long.';
    measured = `Vorher ${number(strict ? e.rsi?.previous : v.rPrev, 4)} · zuletzt ${number(strict ? e.rsi?.current : v.rNow, 4)}. Werte sind gerundet; die Regel wird ungerundet geprüft.`;
    if (!strict && ready) {
      const s = rsiRule?.momentum;
      measured += s?.ready ? ` ΔRSI ${number(s.delta, 4)} · Durchschnitt ${number(s.mean, 4)} · σ ${number(s.sigma, 4)} · Schwelle ${number(s.threshold, 4)}. Momentum ${rsiRule.momentumLong ? 'erfüllt' : 'nicht erfüllt'}${s.exceeds && s.delta <= 0 ? ' (Anstieg muss positiv sein)' : ''}.` : ' Momentum noch nicht auswertbar: 21 gültige RSI-Werte für 20 Veränderungen nötig.';
      measured += ' Mittelwert und σ verwenden die letzten 20 Veränderungen inklusive der aktuellen; σ wird durch 20 geteilt (Population).';
    }
  }
  if (key === 'macd') {
    meaning = 'Der MACD beschreibt den Kursschwung: EMA 12 minus EMA 26. Sein geglätteter 9er-Durchschnitt heißt Signallinie. Im Chart unter „Chart-Ebenen, Whales & Werkzeuge“ MACD einschalten: Der eigene Bereich zeigt die blaue MACD-Linie, die orange Signallinie und die graue Nulllinie. Hier gelten weiterhin die Werte des angegebenen Prüfzeitraums.';
    rule = strict ? `Histogramm bedeutet MACD minus Signallinie. Für ${direction} muss es ${up ? 'positiv sein und gegenüber der vorigen Kerze steigen' : 'negativ sein und gegenüber der vorigen Kerze fallen'}.` : `Für ${direction}: Der MACD muss ${over} seiner Signallinie liegen. Eine neue Kreuzung auf dieser Kerze ist dafür nicht nötig.`;
    measured = strict ? `Histogramm vorher ${indicator(e.macd?.previous)} · zuletzt ${indicator(e.macd?.current)}.` : `MACD ${indicator(v.mLine)} · Signallinie ${indicator(v.mSig)}.`;
  }
  if (key === 'volume') {
    meaning = 'Das Handelsvolumen zeigt, wie viel in einer Kerze gehandelt wurde. Der Vergleich nutzt den Durchschnitt der 20 vorherigen abgeschlossenen 15m-Kerzen; die geprüfte Kerze ist darin nicht enthalten.';
    rule = 'Für Long und Short: mindestens 1,20× dieses Durchschnitts, also mindestens 20 % mehr Volumen. 0,90× bedeutet 10 % weniger als der Durchschnitt.';
    measured = volumeText(ratio) + '.';
  }
  return [meaning, rule, ready ? `${measured} ${direction}-Regel ${passed ? 'erfüllt' : 'nicht erfüllt'}.` : 'Aktuelle Prüfdaten fehlen; daraus wird keine Bestätigung abgeleitet.', `Grundlage: geschlossene ${frame}-Kerzen.`];
}
function volumeText(ratio) {
  if (!Number.isFinite(ratio)) return 'Kein belastbarer Volumenvergleich';
  const n = ratio < WATCH_PULLBACK.volumeMultiple && Math.round(ratio * 100) / 100 >= WATCH_PULLBACK.volumeMultiple ? '< 1,20' : number(ratio);
  return `${n}× Durchschnitt · nötig ≥ 1,20×`;
}

export function signalReasonsModel(input, preferredSide) {
  const { mode, rating: r, values: v = {}, market, interval = '', intervalMs, now, paused, offline, error = '' } = input;
  const strict = mode === 'strict', total = strict ? 5 : 4, threshold = strict ? 5 : 3;
  let issue = paused ? 'Liveprüfung pausiert.' : offline ? 'Offline · aktuelle Prüfung nicht verfügbar.' : error;
  const valid = strict ? r?.ready && r.model === WATCH_MODELS.strict && r.rules?.length === 5 && KEYS.every(k => r.rules.some(x => x.key === k && typeof x.long === 'boolean' && typeof x.short === 'boolean'))
    : r?.rules?.length === 4 && r.rules.every(x => [-1, 0, 1].includes(x.score));
  if (!issue && !valid) issue = strict ? r?.reason || '15m-/4h-Daten werden geladen.' : 'Geschlossene Kerzen werden geladen.';
  if (!issue && strict && (!Number.isFinite(r.expiresAt) || now >= r.expiresAt)) issue = 'Neue 15m-Kerze fehlt · Prüfung veraltet.';
  if (!issue && !strict && Number.isFinite(intervalMs) && now >= r.closeTime + 1 + intervalMs) issue = 'Neue Schlusskerze fehlt · Prüfung veraltet.';
  const ready = !issue, checks = KEYS.slice(0, total).map((key, i) => {
    const x = strict ? r?.rules?.find(x => x.key === key) : r?.rules?.[i];
    return { key, long: ready ? strict ? x.long : x.score > 0 : null, short: ready ? strict ? x.short : x.score < 0 : null };
  });
  const count = side => ready ? checks.filter(x => x[side]).length : null;
  const longCount = count('long'), shortCount = count('short');
  const direction = ready ? strict ? r.direction : watchClassicDirection(r) : 0;
  const automatic = direction === 1 ? 'long' : direction === -1 ? 'short' : (shortCount ?? 0) > (longCount ?? 0) ? 'short'
    : longCount === shortCount && checks[0]?.short ? 'short' : 'long';
  const side = ['long', 'short'].includes(preferredSide) ? preferredSide : automatic, up = side === 'long';
  const evidence = strict ? r?.evidence || {} : {}, top = evidence.trend || {}, lower = evidence.price || {}, rs = evidence.rsi || {}, m = evidence.macd || {};
  const rows = checks.map((x, i) => {
    const passed = x[side], key = x.key;
    let label, detail, requirement;
    if (strict) {
      label = ['4h-Trend', 'Kurs zum EMA 200 · 15m', up ? 'RSI-Erholung' : 'RSI-Abkühlung', 'Kursschwung (MACD)', 'Volumenbestätigung'][i];
      if (key === 'trend') { detail = `${compare(top.close, top.ema, 'Kurs über', 'Kurs unter', 'Kurs auf')} EMA 200 · ${compare(top.ema, top.previousEma, 'EMA steigt', 'EMA fällt', 'EMA unverändert')}`; requirement = `Nötig: Kurs ${up ? 'über' : 'unter'} EMA 200 und EMA ${up ? 'steigend' : 'fallend'}.`; }
      if (key === 'kurs') { detail = `Schlusskurs ${price(lower.close)} ${compare(lower.close, lower.ema, 'über', 'unter', 'auf')} EMA 200 (${price(lower.ema)})`; requirement = `Für ${up ? 'Long' : 'Short'}: 15m-Schluss ${up ? 'über' : 'unter'} EMA 200.`; }
      if (key === 'rsi') { detail = `${rsiChange(rs.previous, rs.current)} · vorheriges ${up ? 'RSI-Tief' : 'RSI-Hoch'} ${number(up ? rs.low : rs.high, 1)}`; requirement = up ? 'Nötig: Rücksetzer ≤45, danach RSI über 50, unter 70 und steigend.' : 'Nötig: Anstieg ≥55, danach RSI über 30, unter 50 und fallend.'; }
      if (key === 'macd') { detail = `Histogramm ${compare(m.current, 0, 'positiv', 'negativ', 'bei null')} · ${compare(m.current, m.previous, 'steigend', 'fallend', 'unverändert')}`; requirement = `Nötig: ${up ? 'positiv und steigend' : 'negativ und fallend'}.`; }
      if (key === 'volume') { detail = volumeText(r?.volumeRatio); requirement = ''; }
    } else {
      label = ['EMA-Trend', 'Kurs zum EMA 20', 'Kursstärke (RSI 14)', 'Kursschwung (MACD)'][i];
      if (key === 'trend') { detail = `EMA 20 (${price(v.e20)}) ${compare(v.e20, v.e50, 'über', 'unter', 'auf')} EMA 50 (${price(v.e50)})`; requirement = `Für ${up ? 'Long' : 'Short'}: EMA 20 ${up ? 'über' : 'unter'} EMA 50.`; }
      if (key === 'kurs') { detail = `Schlusskurs ${price(v.last)} ${compare(v.last, v.e20, 'über', 'unter', 'auf')} EMA 20 (${price(v.e20)})`; requirement = `Für ${up ? 'Long' : 'Short'}: Schlusskurs ${up ? 'über' : 'unter'} EMA 20.`; }
      if (key === 'rsi') { detail = rsiChange(v.rPrev, v.rNow) + (r?.rsiRule?.momentumLong ? ' · Momentum bestätigt' : ''); requirement = up ? 'Für Long: RSI unter 30 und steigend oder positiver Anstieg über Durchschnitt + 2σ.' : 'Für Short: RSI über 70 und fallend.'; }
      if (key === 'macd') { detail = `MACD ${compare(v.mLine, v.mSig, 'über', 'unter', 'auf')} seinem 9er-Durchschnitt (Signallinie)`; requirement = `Für ${up ? 'Long' : 'Short'}: MACD ${up ? 'über' : 'unter'} Signallinie.`; }
    }
    return { key, label, passed, detail: ready ? detail : '–', requirement: ready && passed === false ? requirement : '',
      info: ruleHelp({ key, strict, up, ready, passed, interval, values: v, evidence, ratio: r?.volumeRatio, rsiRule: r?.rsiRule }) };
  });
  const fulfilled = count(side), confirmed = ready && direction === (up ? 1 : -1), missing = rows.filter(x => x.passed === false).map(x => x.label);
  const status = !ready ? paused ? 'Pausiert' : offline ? 'Offline' : 'Prüfung offen' : confirmed ? strict ? `${up ? 'Long' : 'Short'} bestätigt` : `${up ? 'Long' : 'Short'}-Tendenz` : strict ? `Kein ${up ? 'Long' : 'Short'}-Signal` : 'Abwarten';
  const reason = !ready ? issue : confirmed ? strict ? 'Alle fünf Pflichtregeln sind erfüllt.' : `${fulfilled} von vier Regeln zeigen dieselbe Richtung.`
    : strict ? `Es fehlt: ${missing.join(', ')}.` : `${fulfilled}/4 in dieser Richtung · für die bisherige Tendenz sind mindestens 3/4 nötig.`;
  const other = ready && direction && !confirmed ? `Andere Richtung: ${direction === 1 ? 'Long' : 'Short'} ${strict ? 'bestätigt' : 'als Tendenz'} (${direction === 1 ? longCount : shortCount}/${total}).` : '';
  const source = `${market === 'futures' ? 'Binance Futures' : market === 'spot' ? 'Binance Spot' : 'Markt wird geprüft'} · ${strict ? '15m / 4h' : interval + '-Kerzen'}`;
  const stand = ready ? strict ? `15m-Schluss ${stamp(r.closeTime + 1)} · 4h-Schluss ${stamp(top.closeTime + 1)}` : `Kerzenschluss ${stamp(r.closeTime + 1)}` : 'Keine aktuelle Freigabe';
  return { strict, total, threshold, ready, side, fulfilled, longCount, shortCount, rows, status, reason, other, confirmed, source, stand,
    title: strict ? 'Trend-Pullback 5/5 v2' : 'Standard + RSI-Momentum v2 · vier Regeln',
    note: strict ? 'Nur geschlossene Kerzen. 5/5 ist Regelübereinstimmung, keine garantierte Gewinnchance.' : 'Nur geschlossene Kerzen. Die bisherige Tendenz benötigt 3/4 Regeln; kein nachgewiesener Handelsvorteil.' };
}

export function createSignalReasonsView({ root, extra }) {
  const doc = root.ownerDocument, el = (tag, cls, value = '') => { const n = doc.createElement(tag); if (cls) n.className = cls; n.textContent = value; return n; };
  const put = (n, text) => { if (n.textContent !== text) n.textContent = text; };
  root.classList.add('signal-reasons'); root.setAttribute('role', 'region'); root.setAttribute('aria-label', 'Signalgründe');
  const title = el('p', 'wsr-model'), sides = el('div', 'wsr-sides'); sides.setAttribute('role', 'group'); sides.setAttribute('aria-label', 'Long oder Short prüfen');
  const buttons = Object.fromEntries(['long', 'short'].map(side => { const b = el('button', ''); b.type = 'button'; b.dataset.side = side; b.addEventListener('click', () => { selected = side; resetHeight(); render(); }); sides.append(b); return [side, b]; }));
  const head = el('div', 'wsr-head'), count = el('strong', 'wsr-count'), status = el('span', 'wsr-status'); head.append(count, status); status.setAttribute('role', 'status');
  const progress = el('div', 'wsr-progress'); progress.setAttribute('aria-hidden', 'true');
  const source = el('p', 'wsr-source'), stand = el('p', 'wsr-stand'), list = el('ul', 'wsr-rules'), reason = el('p', 'wsr-reason'), other = el('p', 'wsr-other'), note = el('p', 'wsr-note');
  const settings = el('button', 'button ghost wsr-settings', 'Modell und Vergleich öffnen'); settings.type = 'button'; settings.dataset.goto = 'watch-model-settings';
  root.append(title, sides, head, progress, source, stand, list, reason, other);
  if (extra) root.append(extra);
  root.append(note, settings);
  let current = null, selected = null, context = '', previous = '', items = [], maxHeight = 0, width = 0;
  const resetHeight = () => { maxHeight = 0; root.style.minHeight = ''; };
  function render() {
    if (!current) return;
    const model = signalReasonsModel(current, selected), signature = JSON.stringify(model); if (signature === previous) return; previous = signature;
    root.dataset.side = model.side; root.dataset.state = !model.ready ? 'unknown' : model.confirmed ? model.side : 'wait';
    put(title, model.title); put(count, `${model.fulfilled ?? '–'}/${model.total} erfüllt`); put(status, model.status);
    for (const side of ['long', 'short']) { put(buttons[side], `${side === 'long' ? 'Long' : 'Short'} ${model[side + 'Count'] ?? '–'}/${model.total}`); buttons[side].setAttribute('aria-pressed', String(side === model.side)); }
    if (items.length !== model.total) {
      items = model.rows.map(() => {
        const li = el('li', ''), icon = el('span', 'wsr-icon'), sr = el('span', 'sr-only'), body = el('div', 'wsr-rule-copy'), label = el('strong', 'wsr-rule-title'), detail = el('p', 'wsr-reading'), requirement = el('small', '');
        const tip = el('details', 'tip left wsr-tip'), summary = el('summary'), explanation = el('div', 'tip-body');
        tip.dataset.side = 'left'; summary.append(el('span', '', 'i')); tip.append(summary, explanation);
        icon.setAttribute('aria-hidden', 'true'); body.append(label, detail, requirement, tip); li.append(icon, sr, body);
        return { li, icon, sr, label, detail, requirement, summary, explanation };
      });
      list.replaceChildren(...items.map(x => x.li)); progress.replaceChildren(...items.map(() => el('i', '')));
    }
    model.rows.forEach((row, i) => {
      const n = items[i], state = row.passed === null ? 'unknown' : row.passed ? 'pass' : 'fail'; n.li.dataset.state = state; n.li.dataset.rule = row.key; progress.children[i].dataset.state = state;
      put(n.icon, row.passed === null ? '–' : row.passed ? '✓' : '!'); put(n.sr, row.passed === null ? 'Daten fehlen: ' : row.passed ? 'Erfüllt: ' : 'Nicht erfüllt: ');
      put(n.label, row.label); put(n.detail, row.detail); put(n.requirement, row.requirement); n.requirement.hidden = !row.requirement;
      n.summary.setAttribute('aria-label', `Erklärung: ${row.label}`);
      if (n.explanation.textContent !== row.info.join('')) n.explanation.replaceChildren(...row.info.map(p => el('p', '', p)));
    });
    put(source, model.source); put(stand, model.stand); put(reason, model.reason); put(other, model.other); other.hidden = !model.other; put(note, model.note);
    // Live-Wechsel dürfen den folgenden Chart nicht nach oben springen lassen.
    if (root.clientWidth > 0 && !root.querySelector('.wsr-tip[open]')) { const h = Math.ceil(root.getBoundingClientRect().height); if (h > maxHeight) { maxHeight = h; root.style.minHeight = h + 'px'; } }
  }
  return { paint(input) {
    const id = input.symbol + '|' + input.mode, nextWidth = root.clientWidth;
    if (id !== context) { context = id; selected = null; resetHeight(); }
    if (nextWidth > 0 && width !== nextWidth) { width = nextWidth; resetHeight(); previous = ''; }
    current = input; render();
  }, resetHeight, get side() { return selected; } };
}
