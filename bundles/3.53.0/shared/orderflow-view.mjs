import { ORDERFLOW_PERIODS, ORDERFLOW_LIMITS, restCandle, liveCandle, mergeCandles, visibleCandles, dataQuality, compactVolume } from './orderflow-core.mjs';

// Ein eigener Verbraucher des bestehenden Binance-Workers; kein zweiter Feed, keine Signale/Orders.
export function createOrderflowView({ root, context, now, fetchRows, readPrefs, savePrefs, streamsChanged }) {
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
    'Handlung: Delta allein ist kein Einstieg. Trend, Stop-Loss und Gebühren prüfen. Bei getrenntem Stream, mehr als 5 s alten oder unvollständigen Daten auf neue vollständige Daten warten.',
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
    const section = el('section', 'of-block'), h = el('h4', '', name), quality = el('small', 'of-quality'), legend = el('div', 'of-row of-legend');
    legend.append(el('span', '', 'UTC'), el('span', '', 'Kauf / Verkauf'), el('span', '', 'Delta')); section.dataset.interval = iv; section.append(h, quality, legend);
    const rows = Array.from({ length: 5 }, () => {
      const row = el('div', 'of-row'), time = el('span', 'of-time'), volumes = el('span', 'of-volumes'), fill = el('i', 'of-buy-fill'), buy = el('span', 'of-buy'), sell = el('span', 'of-sell'), delta = el('span', 'of-delta');
      fill.setAttribute('aria-hidden', 'true'); volumes.append(fill, buy, sell); row.append(time, volumes, delta); section.append(row);
      return { row, time, volumes, fill, buy, sell, delta };
    }); blocks[iv] = { section, quality, rows }; root.append(section);
  }
  const prefs = () => { state.unit = readPrefs()?.unit === 'coins' ? 'coins' : 'usdt'; select.value = state.unit; };
  prefs();
  function paint() {
    if (doc.hidden) return;
    const ctx = context(), at = now(), units = state.unit === 'coins' ? 'Coins' : 'USDT';
    text(source, `${state.symbol || '—'} · Binance USDT-Futures · ${units}`);
    root.dataset.symbol = state.symbol; root.dataset.unit = state.unit;
    retry.disabled = !state.symbol || state.paused || pending.size > 0 || Date.now() - Math.max(loadedAt['1m'] || 0, loadedAt['1h'] || 0) < 10000;
    const errors = Object.values(state.errors).filter(Boolean);
    text(notice, errors.length ? errors.join(' · ') : 'Taker-Volumen · keine Einstiegsempfehlung'); notice.dataset.kind = errors.length ? 'warning' : 'neutral';
    for (const iv of Object.keys(blocks)) {
      const b = blocks[iv], q = dataQuality(state.series[iv], iv, { now: at, receivedNow: Date.now(), connected: ctx.connected && !state.unavailable, paused: state.paused, unit: state.unit });
      b.section.dataset.quality = q.kind; text(b.quality, `${q.label}${q.age === null || q.age === undefined ? '' : ` · vor ${Math.floor(q.age / 1000)} s`}`);
      visibleCandles(state.series[iv], iv, at).forEach((slot, i) => {
        const r = b.rows[i], v = slot.candle?.[state.unit]; r.row.dataset.time = String(slot.t); r.row.dataset.running = String(slot.running); r.row.dataset.closed = String(!!slot.candle?.closed);
        r.row.classList.toggle('of-running', slot.running); r.row.classList.toggle('of-missing', !v || !slot.running && !slot.candle.closed);
        text(r.time, slot.running ? 'jetzt' : utc.format(slot.t)); r.time.title = date.format(slot.t) + ' UTC';
        text(r.buy, compactVolume(v?.buy)); text(r.sell, compactVolume(v?.sell)); text(r.delta, compactVolume(v?.delta, true));
        r.delta.dataset.tone = v?.delta > 0 ? 'up' : v?.delta < 0 ? 'down' : 'neutral';
        r.volumes.classList.toggle('of-neutral', !v || v.share === null); r.fill.style.width = v?.share === null || !v ? '0%' : `${v.share * 100}%`;
        r.volumes.title = v ? `Kauf ${v.buy} ${units} · Verkauf ${v.sell} ${units} · ${v.share === null ? 'Kein Umsatz' : `Kaufanteil ${(v.share * 100).toFixed(1).replace('.', ',')} %`}` : 'Volumen nicht verfügbar';
        r.row.title = !slot.candle ? 'Kerze fehlt' : !slot.running && !slot.candle.closed ? 'Abschluss noch nicht bestätigt' : slot.running ? 'Laufende Kerze · Werte vorläufig' : 'Abgeschlossene Kerze';
      });
    }
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
    const symbol = state.symbol, epoch = state.epoch, controller = new AbortController(), startedAt = Date.now(); pending.set(iv, controller); schedule();
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
  return { sync, kline, tick, acceptRest, state };
}
