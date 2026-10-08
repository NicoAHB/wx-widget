import { ORDERFLOW_PERIODS, ORDERFLOW_LIMITS, ORDERFLOW_FRESH_MS, restCandle, liveCandle, mergeCandles, visibleCandles, dataQuality, compactVolume, candleGlyph, candleCountdown, candleAssessment } from './orderflow-core.mjs';
import { createOrderflowDemo } from './orderflow-demo.mjs';
import { createWidgetBoundary } from './widget-state.mjs';

// Verbraucher des bestehenden Binance-Workers; kein zweiter Worker/keine doppelten Futures-Abos, keine Signale/Orders.
export function createOrderflowView({ root, context, now, fetchRows, readPrefs, savePrefs, streamsChanged, formatPrice = String, readDemo = () => null, saveDemo = () => {} }) {
  const doc = root.ownerDocument, state = { symbol: '', paused: false, unit: 'usdt', series: { '1m': [], '1h': [] }, errors: {}, unavailable: false, epoch: 0, since: 0 };
  const blocks = {}, pending = new Map(), attempted = new Set(), loadedAt = {}, repaired = {};
  let paintTimer = null, initialTimer = null, lastConnected = false, lastTick = 0;
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const text = (n, value) => { if (n.textContent !== value) n.textContent = value; };
  const head = el('div', 'of-head'), title = el('h3', '', 'Kauf-/Verkaufsvolumen'), info = el('details', 'of-info'), summary = el('summary', '', 'i');
  summary.setAttribute('aria-label', 'Kauf-/Verkaufsvolumen erklären'); info.append(summary);
  const explanation = el('div', 'of-explanation');
  for (const p of [
    'Kauf = aggressiver Käufer (Taker), Verkauf = aggressiver Verkäufer. Jeder Trade hat beide Seiten; hier zählt, wer die Market-Order ausgelöst hat.',
    'Grüner Balkenanteil = Kauf ÷ Gesamtvolumen. Delta = Kauf − Verkauf: + Käuferüberhang, − Verkäuferüberhang. Vier geschlossene Kerzen und die laufende Kerze „jetzt“, Zeiten UTC.',
    'Die waagerechte Kerze zeigt Tief links und Hoch rechts; der Körper liegt zwischen Öffnung und Schluss. Grün = Schluss über Öffnung, Rot = darunter, Grau = gleich. O = Öffnung, H = Hoch, T = Tief, S = Schluss (bei „jetzt“ aktueller Kurs). Alle fünf Kerzen je Block verwenden denselben Preismaßstab. Rest = Zeit bis zum nächsten UTC-Kerzenschluss.',
    'Handlung: Delta allein ist kein Einstieg. Trend, Stop-Loss und Gebühren prüfen. Fehlende Werte erscheinen als Strich. Demo-Einstieg und -Ausstieg sind nur mit aktuellem Live-Kurs möglich.',
    'Kerzenbild: regelbasierte Kurzbewertung der sichtbaren Kerze. Körper bis 10 % der Spanne = neutral; sonst Schluss über Öffnung = bullisch, darunter = bärisch. „Vorläufig“ gilt bis zum Abschluss. Kein eigener Modellscore und keine zusätzliche KI-Abfrage je Tick.',
    'Quelle: Binance USDT-Futures, auch wenn der Hauptchart Spot zeigt. Coins und USDT stammen jeweils aus den gelieferten Taker-Feldern; fehlende Werte werden nicht geschätzt. Diese Volumenwerte sind keine Einstiegsempfehlung.'
  ]) explanation.append(el('p', '', p));
  info.append(explanation); head.append(title, info);
  const source = el('p', 'of-source'), settings = el('div', 'of-settings'), label = el('label', '', 'Einheit '), select = el('select'); select.id = 'of-unit';
  for (const [value, name] of [['usdt', 'USDT'], ['coins', 'Coins']]) { const option = el('option', '', name); option.value = value; select.append(option); }
  label.append(select); const retry = el('button', 'button ghost', 'Neu laden'); retry.type = 'button'; retry.id = 'of-retry'; settings.append(label, retry);
  const notice = el('p', 'of-notice'); notice.id = 'of-status'; notice.setAttribute('role', 'status');
  root.append(head, source, settings, notice);
  const utc = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' });
  const date = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  for (const [iv, name] of [['1m', '1-Minuten-Kerzen'], ['1h', '1-Stunden-Kerzen']]) {
    const section = el('section', 'of-block'), heading = el('div', 'of-block-head'), h = el('h4', '', name), countdown = el('span', 'of-countdown'), quality = el('small', 'of-quality'), legend = el('div', 'of-row of-legend');
    quality.hidden = true; heading.append(h, countdown);
    legend.append(el('span', '', 'UTC'), el('span', '', 'Kerze · Kauf / Verkauf'), el('span', '', 'Delta')); section.dataset.interval = iv; section.append(heading, quality, legend);
    const rows = Array.from({ length: 5 }, () => {
      const row = el('div', 'of-row'), time = el('span', 'of-time'), volumes = el('span', 'of-volumes'), fill = el('i', 'of-buy-fill'), buy = el('span', 'of-buy'), sell = el('span', 'of-sell'), delta = el('span', 'of-delta');
      const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'), wick = doc.createElementNS(svg.namespaceURI, 'line'), body = doc.createElementNS(svg.namespaceURI, 'rect'), empty = el('span', 'of-candle-empty', '—'), glyph = el('span', 'of-candle'), values = el('div', 'of-prices'), main = el('div', 'of-values');
      const group = doc.createElementNS(svg.namespaceURI, 'g'); group.setAttribute('transform', 'translate(42 0) rotate(90)');
      svg.classList.add('of-candle-svg'); svg.setAttribute('viewBox', '0 0 42 28'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true'); wick.setAttribute('x1', '14'); wick.setAttribute('x2', '14'); body.setAttribute('x', '8'); body.setAttribute('width', '12'); wick.setAttribute('vector-effect', 'non-scaling-stroke'); body.setAttribute('vector-effect', 'non-scaling-stroke'); group.append(wick, body); svg.append(group); glyph.append(svg, empty);
      const prices = Object.fromEntries([['o', 'O'], ['h', 'H'], ['l', 'T'], ['c', 'S']].map(([key, name]) => { const n = el(iv === '1m' ? 'button' : 'span'), label = el('b', '', name), value = el('span', 'of-price-value', '—'); if (iv === '1m') { n.type = 'button'; n.dataset.priceKey = { o: 'open', h: 'high', l: 'low', c: 'close' }[key]; n.title = name + ' als Einstieg vorbelegen'; } n.append(label, value); values.append(n); return [key, value]; }));
      const assessment = el('span', 'of-candle-assessment'); values.append(assessment);
      fill.setAttribute('aria-hidden', 'true'); volumes.append(fill, buy, sell); main.append(glyph, volumes); row.append(time, main, delta, values); section.append(row);
      return { row, time, volumes, fill, buy, sell, delta, glyph, svg, wick, body, empty, prices, assessment };
    }); blocks[iv] = { section, quality, countdown, rows }; root.append(section);
  }
  function quote() {
    const c = state.series['1m'].filter(c => c.source === 'ws').at(-1), at = now();
    return c ? { price: c.c, fresh: !boundary.failed && !state.paused && !state.unavailable && context().connected && Math.max(Date.now() - c.seenAt, at - c.eventAt, 0) <= ORDERFLOW_FRESH_MS } : null;
  }
  const demo = createOrderflowDemo({ root, quote, symbol: () => state.symbol, now, read: readDemo, save: saveDemo, formatPrice });
  const boundary = createWidgetBoundary(root, 'Kauf-/Verkaufsvolumen', () => { sync(); paint(); });
  const prefs = () => { state.unit = readPrefs()?.unit === 'coins' ? 'coins' : 'usdt'; select.value = state.unit; };
  prefs();
  function paint() { const value = boundary.run(paintContent); if (boundary.failed) for (const id of ['of-demo-price', 'of-demo-close']) { const button = root.querySelector('#' + id); if (button) button.disabled = true; } return value; }
  function paintContent() {
    if (doc.hidden) return;
    const ctx = context(), at = now(), units = state.unit === 'coins' ? 'Coins' : 'USDT';
    text(source, `${state.symbol || '—'} · Binance USDT-Futures · ${units}`);
    root.dataset.symbol = state.symbol; root.dataset.unit = state.unit;
    retry.disabled = !state.symbol || state.paused || pending.size > 0 || Date.now() - Math.max(loadedAt['1m'] || 0, loadedAt['1h'] || 0) < 10000;
    const errors = Object.values(state.errors).filter(Boolean);
    text(notice, errors.length ? errors.join(' · ') : 'Taker-Volumen · keine Einstiegsempfehlung'); notice.dataset.kind = errors.length ? 'warning' : 'neutral';
    for (const iv of Object.keys(blocks)) {
      const b = blocks[iv], q = dataQuality(state.series[iv], iv, { now: at, receivedNow: Date.now(), connected: ctx.connected && !state.unavailable, paused: state.paused, unit: state.unit });
      // Nutzerwunsch: keine Datenalter-/Sekundenzeile. Frische bleibt als interne Handelssperre erhalten.
      b.section.dataset.quality = q.kind; text(b.quality, ''); text(b.countdown, `Rest ${candleCountdown(iv, at)}`); b.countdown.title = 'Zeit bis zum nächsten Kerzenschluss (UTC)';
      const slots = visibleCandles(state.series[iv], iv, at), known = slots.filter(s => s.candle).map(s => s.candle), low = Math.min(...known.map(c => c.l)), high = Math.max(...known.map(c => c.h));
      slots.forEach((slot, i) => {
        const r = b.rows[i], v = slot.candle?.[state.unit]; r.row.dataset.time = String(slot.t); r.row.dataset.running = String(slot.running); r.row.dataset.closed = String(!!slot.candle?.closed);
        r.row.classList.toggle('of-running', slot.running); r.row.classList.toggle('of-missing', !v || !slot.running && !slot.candle.closed);
        text(r.time, slot.running ? 'jetzt' : utc.format(slot.t)); r.time.title = date.format(slot.t) + ' UTC';
        text(r.buy, compactVolume(v?.buy)); text(r.sell, compactVolume(v?.sell)); text(r.delta, compactVolume(v?.delta, true));
        r.delta.dataset.tone = v?.delta > 0 ? 'up' : v?.delta < 0 ? 'down' : 'neutral';
        r.volumes.classList.toggle('of-neutral', !v || v.share === null); r.fill.style.width = v?.share === null || !v ? '0%' : `${v.share * 100}%`;
        r.volumes.title = v ? `Kauf ${v.buy} ${units} · Verkauf ${v.sell} ${units} · ${v.share === null ? 'Kein Umsatz' : `Kaufanteil ${(v.share * 100).toFixed(1).replace('.', ',')} %`}` : 'Volumen nicht verfügbar';
        r.row.title = !slot.candle ? 'Kerze fehlt' : !slot.running && !slot.candle.closed ? 'Abschluss noch nicht bestätigt' : slot.running ? 'Laufende Kerze · Werte vorläufig' : 'Abgeschlossene Kerze';
        const c = slot.candle, g = candleGlyph(c, low, high); r.svg.toggleAttribute('hidden', !g); r.empty.hidden = !!g;
        if (g) { r.glyph.dataset.tone = g.tone; r.wick.setAttribute('y1', String(g.high)); r.wick.setAttribute('y2', String(g.low)); r.body.setAttribute('y', String(g.top)); r.body.setAttribute('height', String(g.height)); }
        for (const key of ['o', 'h', 'l', 'c']) text(r.prices[key], c ? formatPrice(c[key]) : '—');
        r.glyph.title = c ? `Öffnung ${formatPrice(c.o)} · Hoch ${formatPrice(c.h)} · Tief ${formatPrice(c.l)} · ${slot.running ? 'Aktuell' : 'Schluss'} ${formatPrice(c.c)}` : 'Kerze nicht verfügbar';
        const opinion = candleAssessment(c); text(r.assessment, opinion.text + (c && slot.running ? ' · vorläufig' : '')); r.assessment.dataset.tone = opinion.tone;
      });
    }
    demo.render();
  }
  function schedule() { if (!paintTimer) paintTimer = setTimeout(() => { paintTimer = null; paint(); }, 250); }
  function acceptRest({ symbol, interval, rows, startedAt }) {
    if (symbol !== state.symbol || state.paused || state.unavailable || startedAt < state.since || !ORDERFLOW_PERIODS[interval] || !Array.isArray(rows)) return;
    const incoming = rows.slice(-ORDERFLOW_LIMITS[interval]).map(row => restCandle(row, interval, { now: now(), seenAt: Date.now(), startedAt }));
    if (!incoming.some(Boolean)) return false;
    state.series[interval] = mergeCandles(state.series[interval], incoming, interval); state.errors[interval] = ''; schedule();
    return true;
  }
  async function load(iv, force = false) {
    if (state.paused || state.unavailable || !state.symbol || pending.has(iv) || !force && attempted.has(iv)) return;
    if (Date.now() - (loadedAt[iv] || 0) < 10000) return;
    attempted.add(iv); loadedAt[iv] = Date.now();
    const symbol = state.symbol, epoch = state.epoch, controller = new AbortController(), startedAt = Date.now(); pending.set(iv, controller); retry.disabled = true; schedule();
    try { const rows = await fetchRows(symbol, iv, ORDERFLOW_LIMITS[iv], controller.signal);
      if (epoch === state.epoch && !acceptRest({ symbol, interval: iv, rows, startedAt })) throw new Error('Keine gültigen Futures-Kerzen geliefert.');
    } catch (e) {
      if (epoch !== state.epoch || controller.signal.aborted) return;
      state.errors[iv] = `${iv}: ${e.message}`;
      if (e.code === -1121) { state.unavailable = true; streamsChanged(); }
    } finally { if (pending.get(iv) === controller) pending.delete(iv); schedule(); }
  }
  function sync() {
    const ctx = context(), changed = ctx.symbol !== state.symbol, resumed = state.paused && !ctx.paused;
    if (changed || ctx.paused !== state.paused) {
      state.epoch++; state.since = Date.now(); for (const c of pending.values()) c.abort(); pending.clear(); clearTimeout(initialTimer);
      state.symbol = ctx.symbol; state.paused = ctx.paused; attempted.clear();
      if (changed) { state.series = { '1m': [], '1h': [] }; state.errors = {}; state.unavailable = false; for (const iv of Object.keys(blocks)) { loadedAt[iv] = 0; repaired[iv] = ''; } }
      if (resumed) for (const iv of Object.keys(blocks)) loadedAt[iv] = 0;
      if (!state.paused) initialTimer = setTimeout(() => { for (const iv of Object.keys(blocks)) {
        const history = visibleCandles(state.series[iv], iv, now()).slice(0, 4);
        if (history.some(r => !r.candle?.closed || !r.candle.coins || !r.candle.usdt)) void load(iv);
      } }, 300);
      paint();
    }
    prefs();
    return !state.paused && !state.unavailable && !!state.symbol;
  }
  function kline(m) {
    sync(); if (state.paused || state.unavailable || m.m !== 'futures' || m.s !== state.symbol || !ORDERFLOW_PERIODS[m.i]) return;
    const c = liveCandle({ ...m.k, v: m.k.ofV, x: m.k.ofX }, m.i, { now: now(), seenAt: Date.now(), eventAt: m.E }); if (!c) return;
    state.series[m.i] = mergeCandles(state.series[m.i], [c], m.i); schedule();
  }
  function tick() {
    sync(); const ctx = context(), at = Date.now(), gap = lastTick && at - lastTick > 5000, reconnected = ctx.connected && !lastConnected;
    lastConnected = ctx.connected; lastTick = at;
    if (!state.paused && !state.unavailable) for (const iv of Object.keys(blocks)) {
      const missing = visibleCandles(state.series[iv], iv, now()).slice(0, 4).filter(r => !r.candle?.closed || !r.candle.coins || !r.candle.usdt), key = missing.map(r => r.t).join('/');
      if ((gap || reconnected || key && repaired[iv] !== key) && !pending.has(iv) && at - (loadedAt[iv] || 0) >= 10000) { repaired[iv] = key; void load(iv, true); }
    }
    paint();
  }
  select.addEventListener('change', () => { state.unit = select.value; savePrefs({ v: 1, unit: state.unit }); paint(); });
  retry.addEventListener('click', () => { state.unavailable = false; state.errors = {}; streamsChanged(); for (const iv of Object.keys(blocks)) void load(iv, true); });
  return { sync, kline, tick, acceptRest, state, quote, boundary };
}
