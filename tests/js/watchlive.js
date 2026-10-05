// ---------- Vorauswahl (Mini-Watchlist): Live-Kacheln mit der Tendenz eines wählbaren Zeitraums ----------
// Je Coin der Vorauswahl: Live-Kurs, Veränderung und Verlauf über den Zeitraum und die Tendenz – dieselben vier Regeln wie die
// Signal-Übersicht (Trend, Kurs, RSI, MACD) auf abgeschlossenen Kerzen, −4 bis +4.
// 3.25.0: Die Bewertung läuft über einen wählbaren Zeitraum, Standard die letzte Stunde: 5-Minuten-Kerzen (12 im Zeitraum) mit
// Vorlauf, damit EMA 50 und MACD eingeschwungen sind (260 geladen, die letzten 199 gerechnet). Neu gerechnet wird bei jedem Schluss
// einer Kerze, der Kurs läuft über die laufende Kerze live weiter. Die Zeitraum-Knöpfe des Charts ändern daran nichts. Zeiträume
// (je etwa 12 Kerzen): 1 Minute (1m-Kerzen, wie bis 3.24.0), 30 Minuten (3m), 1 Stunde (5m), 4 Stunden (15m), 1 Tag (2h).
// Startwerte aus dem Kerzen-Zwischenspeicher bzw. per REST (nacheinander), danach laufen die Kerzen aller Vorauswahl-Coins über
// den Live-Stream mit. Gemalt wird höchstens einmal pro Sekunde und nur, solange die Kacheln im Bild sind und nicht gescrollt
// wird; alle Felder haben feste Größen. Die Kacheln selbst baut renderWatchlist() (r-watch.js).
// var statt const/let: wlKline/wlTick können über Stream und Sekundentakt schon laufen, bevor dieser Abschnitt ausgewertet ist
var WL_LIMIT = 260, WL_WINDOW = 199, WL_RETRY = 60e3, WL_SPAN_KEY = 'scalpdesk.wlspan.v1', WL_TARGET = 1;
// Die Zeiträume als Funktion: Sie stehen auch bereit, wenn renderWatchlist() schon vor diesem Abschnitt läuft (eine var wäre dann
// noch leer)
function wlSpans() {
  return wlSpans.t || (wlSpans.t = {
    '1m': { iv: '1m', n: 1, ms: 60e3, label: '1 Min.', of: 'der letzten Minute', the: 'die letzte Minute', name: '1 Minute', ivName: '1-Minuten' },
    '30m': { iv: '3m', n: 10, ms: 18e5, label: '30 Min.', of: 'der letzten 30 Minuten', the: 'die letzten 30 Minuten', name: '30 Minuten', ivName: '3-Minuten' },
    '1h': { iv: '5m', n: 12, ms: 36e5, label: '1 Std.', of: 'der letzten Stunde', the: 'die letzte Stunde', name: '1 Stunde', ivName: '5-Minuten' },
    '4h': { iv: '15m', n: 16, ms: 144e5, label: '4 Std.', of: 'der letzten 4 Stunden', the: 'die letzten 4 Stunden', name: '4 Stunden', ivName: '15-Minuten' },
    '1d': { iv: '2h', n: 12, ms: 864e5, label: '1 Tag', of: 'des letzten Tages', the: 'den letzten Tag', name: '1 Tag', ivName: '2-Stunden' }
  });
}
function wlSpanKey() { const v = store.get(WL_SPAN_KEY); return wlSpans()[v] ? v : '1h'; }
var wl = { c: new Map(), vis: true, loadAt: 0, span: '' };
// gewählter Zeitraum – beim ersten Zugriff aus dem Speicher (Standard: 1 Stunde)
function wlSpan() { if (wl && !wl.span) wl.span = wlSpanKey(); const T = wlSpans(); return T[wl?.span] || T['1h']; }
var wlSym = coin => `${coin}USDT`;
// Zeitraum wechseln (Auswahl im Detailfeld): gespeichert; alle Reihen im neuen Kerzen-Intervall neu laden, Streams umstellen
function wlSetSpan(k) {
  if (!wlSpans()[k] || !wl) return;
  wlSpan(); if (k === wl.span) return;
  wl.span = k; store.set(WL_SPAN_KEY, k);
  wl.c.clear(); wl.loadAt = 0;
  syncStreams(); renderWatchlist(); wlTick(Date.now());
}
// Kerze aus dem Stream (Format des Workers) ins Format der REST-Kerzen
var wlCandle = k => ({ time: k.t, open: k.o, high: k.h, low: k.l, close: k.c, volume: k.v, closeTime: k.T });
// Neue Stream-Kerze einordnen: abgeschlossen → an die Reihe (höchstens WL_LIMIT) und neu bewerten, laufend → als aktuelle
// Kerze (Live-Kurs). Fehlt dazwischen eine Kerze (Handy gesperrt, Verbindung weg), wird die Reihe neu geladen.
function wlAdd(e, k, now) {
  const c = wlCandle(k), last = e.closed.at(-1);
  if (last && c.time <= last.time) return;
  if (last && c.time > last.closeTime + 1) { e.gap = true; return; }
  if (k.x) { e.closed.push(c); if (e.closed.length > WL_LIMIT) e.closed.splice(0, e.closed.length - WL_LIMIT); e.run = null; e.rating = signalRating(e.closed.slice(-WL_WINDOW)); }
  else e.run = c;
  // Kursverlauf für die Veränderung der letzten Minute: höchstens ein Wert je Sekunde, 3 Minuten lang
  const h = e.hist, p = c.close;
  if (!h.length || now - h.at(-1)[0] >= 1000) h.push([now, p]); else h.at(-1)[1] = p;
  while (h.length && now - h[0][0] > 180e3) h.shift();
}
// Aus dem Live-Stream (onKline): nur Kerzen des Zeitraum-Intervalls der Vorauswahl
function wlKline(m, now) {
  if (!wl || m.i !== wlSpan().iv) return;
  const e = wl.c.get(m.s);
  if (e && !e.loading && e.market === m.m && e.iv === m.i) wlAdd(e, m.k, now);
}
// Kurs zu Beginn des Zeitraums: für 1 Minute aus dem mitgeschriebenen Verlauf (kurz nach dem Laden der Schluss der Kerze, die
// damals lief), sonst der Schluss der letzten Kerze, die vor Beginn des Zeitraums abgeschlossen war (auf ein Intervall genau)
function wlRef(e, now) {
  const S = wlSpan(), t = now - S.ms, minute = S.ms <= 120e3, at = minute ? 'time' : 'closeTime';
  if (minute) for (let i = e.hist.length - 1; i >= 0; i--) if (e.hist[i][0] <= t) return e.hist[i][1];
  for (let i = e.closed.length - 1; i >= 0; i--) if (e.closed[i][at] <= t) return e.closed[i].close;
  return null;
}
function wlPrice(e) { return e.run?.close ?? e.hist.at(-1)?.[1] ?? e.closed.at(-1)?.close ?? null; }
// Verlauf des Zeitraums (mindestens 12 Kerzen) als Linie in einem Feld w × h (oben = höchster Kurs)
function wlSpark(e, w = 44, h = 16) {
  const vals = [...e.closed.slice(-Math.max(wlSpan().n, 12)).map(c => c.close), wlPrice(e)].filter(v => v > 0);
  if (vals.length < 2) return '';
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1, step = w / (vals.length - 1);
  return vals.map((v, i) => `${(i * step).toFixed(1)},${(h - 1 - ((v - lo) / span) * (h - 2)).toFixed(1)}`).join(' ');
}
// Die vier Regeln für Kachel und Detailfeld – dieselbe Grundlage (e.rating aus signalRating): ▲ bullish, ▼ bearish, – neutral;
// ohne Bewertung (Coin lädt, zu wenige Kerzen, Fehler) alle vier neutral und der RSI ohne Zahl (3.24.0)
function wlRules(r) {
  return [['trend', 'Trend'], ['kurs', 'Kurs'], ['rsi', 'RSI'], ['macd', 'MACD']].map(([k, name], i) => {
    const x = r?.rules[i], s = x ? x.score : 0;
    return { k, label: x ? x.label : name, arrow: s > 0 ? '▲' : s < 0 ? '▼' : '–', dir: s > 0 ? 'up' : s < 0 ? 'down' : x ? 'flat' : 'none', score: s };
  });
}
// 3.25.0 Gesamtbewertung: Long- bzw. Short-Tendenz nur, wenn mindestens 3 der 4 Signale in dieselbe Richtung zeigen
function wlVerdict(r) {
  if (!r) return null;
  const bull = r.rules.filter(x => x.score > 0).length, bear = r.rules.filter(x => x.score < 0).length;
  return { bull, bear, dir: bull >= 3 ? 'long' : bear >= 3 ? 'short' : 'wait' };
}
// Farbe des Tendenz-Kästchens: kräftig nur bei Long-/Short-Tendenz, sonst hell (Richtung der Summe) oder neutral
function wlTone(r) { const v = wlVerdict(r); return !v ? 'none' : v.dir === 'long' ? 'p3' : v.dir === 'short' ? 'm3' : r.score > 0 ? 'p1' : r.score < 0 ? 'm1' : '0'; }
// 3.25.0 Filter: Bewegung im Zeitraum. ATR = mittlere wahre Spanne je Kerze über die Kerzen des Zeitraums (bei 1 Minute die
// üblichen 14); über den Zeitraum bewegt sich der Kurs typischerweise etwa ATR × √Anzahl der Kerzen (Faustregel für einen
// Zufallspfad). Liegt das unter 1 %, ist ein Ziel von 1 % gerade unrealistisch → „Zu wenig Bewegung“. Einmal je Kerzenschluss.
function wlMove(e) {
  const S = wlSpan(), c = e.closed, len = S.n >= 10 ? S.n : 14, t = c.at(-1)?.closeTime;
  if (e.move && e.move.t === t && e.move.span === wl.span) return e.move.v;
  let v = null;
  if (c.length > len) {
    let sum = 0; for (let i = c.length - len; i < c.length; i++) { const k = c[i], pc = c[i - 1].close; sum += Math.max(k.high - k.low, Math.abs(k.high - pc), Math.abs(k.low - pc)); }
    const last = c.at(-1).close, atrPct = sum / len / last * 100, movePct = atrPct * Math.sqrt(S.n);
    if (Number.isFinite(atrPct) && last > 0) v = { atrPct, movePct, low: movePct < WL_TARGET, len };
  }
  e.move = { t, span: wl.span, v }; return v;
}
// Anzeige-Werte einer Kachel (auch für die Tests): Kurs, Veränderung über den Zeitraum – beschriftet wie „1 Std. +0,54 %“,
// fehlende Werte neutral „–“ –, Tendenz, die vier Regeln, Gesamtbewertung und Bewegung
function wlView(e, now) {
  const S = wlSpan(), price = wlPrice(e), ref = wlRef(e, now), chg = price > 0 && ref > 0 ? (price / ref - 1) * 100 : null;
  const dir = v => (v == null || Math.abs(v) < 0.005 ? 'flat' : v > 0 ? 'up' : 'down'), pctOf = v => v == null ? '–' : dir(v) === 'flat' ? '±0,00 %' : `${signed(v)} %`;
  return {
    price, chg, rating: e.rating, span: S,
    priceText: price > 0 ? priceText(price) : e.error ? '—' : '…',
    chgText: `${S.label} ${pctOf(chg)}`, chgDir: dir(chg), sparkDir: dir(chg),
    sigText: e.rating ? scoreText(e.rating.score) : e.error ? '' : '·', tone: wlTone(e.rating), rules: wlRules(e.rating),
    verdict: wlVerdict(e.rating), move: e.rating ? wlMove(e) : null
  };
}
// Werte in die bestehenden Felder schreiben (nur was sich geändert hat)
function wlSet(node, prop, v) { if (node && node[prop] !== v) node[prop] = v; }
function wlPaint(now = Date.now(), force = false) {
  const box = $('watchlist');
  if (!box || !wl || (!force && (!wl.vis || document.hidden || userScrolling()))) return;
  for (const tile of box.querySelectorAll('.wl-tile')) {
    const coin = tile.dataset.watch, e = wl.c.get(wlSym(coin));
    if (!e) continue;
    const v = wlView(e, now), q = s => tile.querySelector(s);
    wlSet(q('.wl-price'), 'textContent', v.priceText);
    const chg = q('.wl-chg'); wlSet(chg, 'textContent', v.chgText); wlSet(chg, 'className', `wl-chg ${v.chgDir}`);
    const rs = q('.wl-rules'); if (rs) v.rules.forEach((x, i) => { const n = rs.children[i]; if (!n) return; wlSet(n.firstChild, 'textContent', x.label); wlSet(n.lastChild, 'textContent', x.arrow); wlSet(n, 'className', `wl-rule ${x.dir}`); });
    const sig = q('.wl-sig'); wlSet(sig, 'textContent', v.sigText); if (sig && sig.dataset.tone !== v.tone) sig.dataset.tone = v.tone;
    const svg = q('.wl-spark'), pts = wlSpark(e); svg?.setAttribute('class', `wl-spark ${v.sparkDir}`);
    const line = svg?.firstChild; if (line && line.getAttribute('points') !== pts) line.setAttribute('points', pts);
    const r = v.rating, vd = v.verdict, title = e.error ? `${coin}: ${e.error}`
      : `${coin}/USDT${e.market === 'futures' ? ' (Futures)' : ''}: ${v.priceText} USDT · ${v.chgText}`
        + ` · Tendenz ${v.span.of} ${r ? `${scoreText(r.score)}/4 (${v.rules.map(x => `${x.label} ${x.arrow}`).join(', ')}) · ${vd.dir === 'long' ? 'Long-Tendenz' : vd.dir === 'short' ? 'Short-Tendenz' : 'Abwarten'}${v.move?.low ? ' · zu wenig Bewegung' : ''}` : 'noch keine (mindestens 60 Kerzen)'} · antippen zeigt die Signale und lädt den Coin im Chart`;
    wlSet(tile, 'title', title);
  }
  wldPaint(now, force); // Detailfeld (Schritt 6) im selben Takt
}
// Reihe laden (Zwischenspeicher, sonst REST; ohne Spot-Paar die USDT-Futures) – im Intervall des gewählten Zeitraums
async function wlLoad(e) {
  e.loading = true;
  try {
    const r = await cachedKlines(e.sym, e.iv, WL_LIMIT), now = Date.now();
    e.closed = r.candles.filter(c => c.closeTime < now).slice(-WL_LIMIT);
    const last = r.candles.at(-1); e.run = last && last.closeTime >= now ? last : null;
    e.market = r.source === 'futures' ? 'futures' : 'spot'; e.rating = signalRating(e.closed.slice(-WL_WINDOW));
    e.error = ''; e.gap = false; e.at = now;
  } catch (err) {
    e.error = err?.message || String(err); e.retryAt = Date.now() + WL_RETRY;
  } finally { e.loading = false; wlPaint(Date.now(), true); syncStreams(); }
}
// Streams für syncStreams: Kerzen des Zeitraum-Intervalls aller Vorauswahl-Coins (Markt wie geladen; ohne Spot-Paar die Futures)
function wlStreams() {
  if (!wl) return [];
  const iv = wlSpan().iv;
  return state.watch.map(coin => { const s = wlSym(coin), e = wl.c.get(s); return e?.error ? null : { m: e?.market === 'futures' ? 'futures' : 'spot', s: `${s.toLowerCase()}@kline_${iv}` }; }).filter(Boolean);
}
// Sekundentakt: Einträge anlegen und aufräumen, fehlende Reihen nacheinander laden (höchstens eine gleichzeitig), malen
function wlTick(now) {
  if (!wl || state.paused) return;
  const want = new Set(state.watch.map(wlSym)), iv = wlSpan().iv;
  for (const s of wl.c.keys()) if (!want.has(s)) wl.c.delete(s);
  for (const s of want) if (!wl.c.has(s)) wl.c.set(s, { sym: s, iv, closed: [], run: null, hist: [], rating: null, market: 'spot', loading: false, error: '', retryAt: 0, gap: false, at: 0 });
  const busy = [...wl.c.values()].some(e => e.loading);
  if (!busy && now - wl.loadAt > 300) {
    const next = [...wl.c.values()].find(e => (!e.at && !e.error) || e.gap || (e.error && now >= e.retryAt) || (e.at && !e.run && e.closed.length && now - e.closed.at(-1).closeTime > 150e3));
    if (next) { wl.loadAt = now; void wlLoad(next); }
  }
  wlPaint(now);
}
if ('IntersectionObserver' in window) new IntersectionObserver(es => { for (const e of es) { wl.vis = e.isIntersecting; if (wl.vis) wlPaint(Date.now(), true); } }).observe($('watchlist'));
