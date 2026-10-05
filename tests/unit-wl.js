// Schritt 4.2 / 3.25.0 – Mini-Watchlist ohne Browser (js/watchlive.js): Zeiträume (Standard 1 Stunde auf 5-Minuten-Kerzen,
// gespeichert, nach dem Neuladen wieder da), Stream-Kerzen einordnen (laufend, abgeschlossen, Lücke), Kurs zu Beginn des
// Zeitraums, Linie, Anzeige-Werte („1 Std. …“, vier Regeln mit Pfeil, fehlende Daten neutral), Gesamtbewertung (3 von 4),
// Farbe, Bewegungsfilter (ATR), Streams je Markt und Intervall, Laden nacheinander und bei Bedarf erneut, Zeitraum wechseln.
// Aufruf: node unit-wl.js
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(process.env.SRC || path.join(__dirname, 'js', 'watchlive.js'), 'utf8');
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${info ? ' — ' + info : ''}`); };
const state = { watch: ['BTC', 'XRP', 'NEAR'], paused: false };
let loads = [], klineAnswer = null, syncs = 0, renders = 0, ratedLen = 0;
const mem = new Map(), store = { get: (key, fb) => (mem.has(key) ? mem.get(key) : fb), set: (key, v) => { mem.set(key, v); return true; } };
const cachedKlines = async (sym, iv, limit) => { loads.push([sym, iv, limit]); if (klineAnswer instanceof Error) throw klineAnswer; return klineAnswer(sym, iv); };
const signalRating = closed => { ratedLen = closed.length; return closed.length >= 60 ? { score: closed.at(-1).close > closed[0].close ? 2 : -1, verdict: 'x', rules: [{ label: 'Trend', score: 1 }, { label: 'Kurs', score: -1 }] } : null; };
const number = (x, d) => x.toFixed(d).replace('.', ',');
const signed = (x, d = 2) => (x > 0 ? '+' : x < 0 ? '−' : '') + number(Math.abs(x), d);
// eine Instanz der App (zweiter Aufruf = App neu geladen, derselbe Speicher)
const load = () => new Function('state', 'store', 'cachedKlines', 'signalRating', 'priceText', 'number', 'scoreText', '$', 'userScrolling', 'syncStreams', 'renderWatchlist', 'wldPaint', 'window', 'document', 'signed',
  `${src}\nreturn { wl, WL_SPANS: wlSpans(), WL_SPAN_KEY, WL_LIMIT, WL_WINDOW, wlSpanKey, wlSpan, wlSetSpan, wlAdd, wlKline, wlRef, wlPrice, wlSpark, wlView, wlRules, wlVerdict, wlTone, wlMove, wlStreams, wlTick, wlLoad, wlCandle };`)(
  state, store, cachedKlines, signalRating, p => number(p, 2), number, s => (s > 0 ? '+' : s < 0 ? '−' : '') + Math.abs(s),
  () => null, () => false, () => { syncs++; }, () => { renders++; }, () => {}, {}, { hidden: false }, signed);
const A = load();
const M = 60e3, I = 5 * M, T0 = Date.UTC(2026, 8, 29, 20, 0);
const IVMS = { '1m': M, '3m': 3 * M, '5m': I, '15m': 15 * M, '2h': 120 * M }, IVN = Object.fromEntries(Object.entries(IVMS).map(([n, ms]) => [ms, n]));
const mk = (i, c, iv = I) => ({ time: T0 + i * iv, open: c, high: c + 1, low: c - 1, close: c, volume: 1, closeTime: T0 + i * iv + iv - 1 });
const k = (i, c, x = false, iv = I) => ({ t: T0 + i * iv, T: T0 + i * iv + iv - 1, o: c, h: c + 1, l: c - 1, c, v: 1, x });
const entry = (n, iv = I) => ({ sym: 'XRPUSDT', iv: IVN[iv], closed: Array.from({ length: n }, (_, i) => mk(i, 100 + i, iv)), run: null, hist: [], rating: null, market: 'spot', loading: false, error: '', retryAt: 0, gap: false, at: 1 });
const near = (a, b) => Math.abs(a - b) < 1e-9;

// ---- Zeiträume ----
const SP = Object.entries(A.WL_SPANS);
check('Fünf Zeiträume: 1 Minute, 30 Minuten, 1 Stunde, 4 Stunden, 1 Tag', SP.map(([key, S]) => `${key}:${S.label}`).join() === '1m:1 Min.,30m:30 Min.,1h:1 Std.,4h:4 Std.,1d:1 Tag', SP.map(([key, S]) => `${key}:${S.label}`).join());
check('… auf 1-, 3-, 5-, 15-Minuten- und 2-Stunden-Kerzen; die Kerzen füllen genau den Zeitraum (1 Stunde = 12 × 5 Minuten)', SP.map(([, S]) => `${S.iv}×${S.n}`).join() === '1m×1,3m×10,5m×12,15m×16,2h×12' && SP.every(([, S]) => S.n * IVMS[S.iv] === S.ms), SP.map(([, S]) => `${S.iv}×${S.n}`).join());
check('Standard ohne Einstellung: 1 Stunde auf 5-Minuten-Kerzen', A.wlSpanKey() === '1h' && A.wlSpan().iv === '5m' && A.wlSpan().n === 12 && A.wlSpan().of === 'der letzten Stunde' && A.wlSpan().ivName === '5-Minuten');
mem.set(A.WL_SPAN_KEY, 'xyz'); const bad0 = A.wlSpanKey(); mem.set(A.WL_SPAN_KEY, '4h'); const kept0 = A.wlSpanKey(); mem.clear();
check('Gespeicherte Einstellung wird gelesen, eine ungültige ergibt wieder 1 Stunde', kept0 === '4h' && bad0 === '1h', `${kept0}/${bad0}`);
check('Vorlauf: 260 Kerzen geladen, die letzten 199 bewertet (EMA 50 und MACD eingeschwungen)', A.WL_LIMIT === 260 && A.WL_WINDOW === 199);

// renderWatchlist() kann vor diesem Abschnitt laufen: Zeitraum und Regeln müssen dann schon gehen (Variablen noch leer)
let early = null;
try { early = new Function('state', 'store', `const S = wlSpan(), R = wlRules(null), T = Object.keys(wlSpans()); return { S, R, T };\n${src}`)(state, store); } catch (err) { early = { err: err.message }; }
check('Früher Aufruf (vor dem Abschnitt): Zeitraum 1 Stunde und neutrale Regeln, kein Fehler', early?.S?.iv === '5m' && early.R.length === 4 && early.T.length === 5, JSON.stringify(early?.err || early?.S?.label));

// ---- Stream-Kerzen einordnen (5-Minuten-Kerzen) ----
let e = entry(60), now = T0 + 60 * I + 5000;
A.wlAdd(e, k(60, 160.5), now);
check('Laufende Kerze: wird aktuelle Kerze, Kurs = ihr Schluss (Kurs läuft live weiter)', e.run?.close === 160.5 && e.closed.length === 60 && A.wlPrice(e) === 160.5);
A.wlAdd(e, k(60, 161, true), now + 290e3);
check('Geschlossene 5-Minuten-Kerze: an die Reihe, Tendenz aus den letzten 199 neu berechnet, keine laufende mehr', e.closed.length === 61 && e.closed.at(-1).close === 161 && e.run === null && e.rating?.score === 2 && ratedLen === 61);
A.wlAdd(e, k(59, 99), now + 291e3);
check('Ältere Kerze wird ignoriert', e.closed.length === 61 && e.run === null);
A.wlAdd(e, k(63, 170), now + 3 * I);
check('Lücke (fehlende Kerzen): zum Neuladen markiert, nichts übernommen', e.gap === true && e.closed.length === 61 && e.run === null);
const big = entry(260); A.wlAdd(big, k(260, 400, true), T0 + 261 * I);
check('Höchstens 260 abgeschlossene Kerzen, bewertet werden die letzten 199', big.closed.length === 260 && big.closed.at(-1).close === 400 && big.closed[0].time === T0 + I && ratedLen === 199);
// Verlauf: höchstens ein Wert je Sekunde, 3 Minuten lang
e = entry(60); let t = T0 + 60 * I;
for (let i = 0; i < 400; i++) A.wlAdd(e, k(60, 150 + i / 100, false), t + i * 500); // 200 s lang alle 0,5 s eine Meldung
check('Kursverlauf: ein Wert je Sekunde, nur die letzten 3 Minuten', e.hist.length >= 179 && e.hist.length <= 182 && e.hist.at(-1)[0] - e.hist[0][0] <= 180e3, `${e.hist.length} Werte`);

// ---- Kurs zu Beginn des Zeitraums ----
e = entry(60); now = T0 + 60 * I + 30e3;
check('1 Stunde: Schluss der letzten 5-Minuten-Kerze, die vor 60 Minuten schon abgeschlossen war', A.wlRef(e, now) === 147, String(A.wlRef(e, now)));
e.hist = [[now - 61 * M, 1], [now - 30e3, 2]];
check('… der Kursverlauf der letzten Minuten zählt dabei nicht', A.wlRef(e, now) === 147);
const young = { ...entry(0), closed: Array.from({ length: 5 }, (_, i) => mk(55 + i, 200 + i)) };
check('… weniger als eine Stunde Kerzen oder gar keine: kein Wert', A.wlRef(young, now) === null && A.wlRef(entry(0), now) === null);
const refOf = (span, iv) => { A.wl.span = span; const r = A.wlRef(entry(60, iv), T0 + 60 * iv + 30e3); return r; };
const refs = [refOf('30m', 3 * M), refOf('4h', 15 * M), refOf('1d', 120 * M)];
check('30 Minuten (3m), 4 Stunden (15m), 1 Tag (2h): jeweils die Kerze vor Beginn des Zeitraums', refs.join() === '149,143,147', refs.join());
A.wl.span = '1m'; e = entry(60, M); now = T0 + 60 * M + 30e3;
check('1 Minute ohne Verlauf: Schluss der 1m-Kerze, die damals lief', A.wlRef(e, now) === 159, String(A.wlRef(e, now)));
e.hist = [[now - 90e3, 150], [now - 61e3, 151], [now - 30e3, 152], [now - 1e3, 153]];
check('1 Minute mit Verlauf: der letzte Wert, der mindestens 60 s alt ist', A.wlRef(e, now) === 151);
A.wl.span = '1h';

// ---- Anzeige ----
const R = (...s) => ({ score: s.reduce((a, b) => a + b, 0), verdict: 'x', rules: s.map((x, i) => ({ label: ['Trend', 'Kurs', 'RSI 50', 'MACD'][i], score: x })) });
e = entry(60); e.run = mk(60, 147 * 1.0054); now = T0 + 60 * I + 30e3; e.rating = R(1, 1, 0, 0);
let v = A.wlView(e, now);
check('Anzeige: Kurs, „1 Std.“ mit Vorzeichen, Richtung (auch der Linie), Tendenz', v.priceText === '147,79' && v.chgText === '1 Std. +0,54 %' && v.chgDir === 'up' && v.sparkDir === 'up' && v.sigText === '+2' && v.tone === 'p1', JSON.stringify({ ...v, rules: 0, span: 0 }));
e.run = mk(60, 147 * 0.9990); v = A.wlView(e, now);
check('Gefallen: „1 Std. −0,10 %“ und „down“', v.chgText === '1 Std. −0,10 %' && v.chgDir === 'down' && v.sparkDir === 'down', v.chgText);
e.run = mk(60, 147.000001); v = A.wlView(e, now);
check('Kaum Bewegung (unter 0,005 %): „±0,00 %“ und „flat“', v.chgText === '1 Std. ±0,00 %' && v.chgDir === 'flat', v.chgText);
const lab = (span, iv, f, ref) => { A.wl.span = span; const x = entry(60, iv); x.run = mk(60, ref * f, iv); return A.wlView(x, T0 + 60 * iv + 30e3).chgText; };
const labs = [lab('1m', M, 1.0005, 159), lab('30m', 3 * M, 1.01, 149), lab('4h', 15 * M, 1.02, 143), lab('1d', 120 * M, 0.97, 147)];
A.wl.span = '1h';
check('Beschriftung je Zeitraum: „1 Min.“, „30 Min.“, „4 Std.“, „1 Tag“', labs.join(' | ') === '1 Min. +0,05 % | 30 Min. +1,00 % | 4 Std. +2,00 % | 1 Tag −3,00 %', labs.join(' | '));
const empty = A.wlView({ ...entry(0), error: '' }, now), bad = A.wlView({ ...entry(0), error: 'XYZ gibt es nicht' }, now);
check('Noch keine Daten: „…“, „·“, neutral „1 Std. –“, keine Gesamtbewertung; Fehler: „—“ ohne Tendenz', empty.priceText === '…' && empty.sigText === '·' && empty.chgText === '1 Std. –' && empty.chgDir === 'flat' && empty.verdict === null && empty.move === null && bad.priceText === '—' && bad.sigText === '' && bad.tone === 'none');

// ---- Die vier Regeln (Kachel und Detailfeld aus derselben Bewertung) ----
const rt = { score: 1, rules: [{ label: 'Trend', score: 1 }, { label: 'Kurs', score: -1 }, { label: 'RSI 27', score: 1 }, { label: 'MACD', score: 0 }] };
const R4 = A.wlRules(rt);
check('Regeln: Reihenfolge Trend, Kurs, RSI (mit Wert), MACD; ▲ bullish, ▼ bearish, – neutral', R4.map(x => `${x.k}:${x.label}${x.arrow}:${x.dir}`).join() === 'trend:Trend▲:up,kurs:Kurs▼:down,rsi:RSI 27▲:up,macd:MACD–:flat', JSON.stringify(R4));
const R0 = A.wlRules(null);
check('Ohne Bewertung: alle vier neutral („–“, Richtung „none“), RSI ohne Zahl', R0.map(x => `${x.label}${x.arrow}:${x.dir}`).join() === 'Trend–:none,Kurs–:none,RSI–:none,MACD–:none', JSON.stringify(R0));
check('wlView liefert dieselben Regeln wie wlRules(e.rating)', JSON.stringify(A.wlView({ ...entry(60), rating: rt }, now).rules) === JSON.stringify(R4));

// ---- Gesamtbewertung: Long-/Short-Tendenz nur ab 3 von 4 Signalen in dieselbe Richtung ----
const VD = s => { const r = R(...s), d = A.wlVerdict(r); return `${d.dir}/${d.bull}/${d.bear}/${A.wlTone(r)}`; };
check('Long-Tendenz ab 3 von 4 bullish (auch mit einem bearish), Kästchen kräftig grün', VD([1, 1, 1, 1]) === 'long/4/0/p3' && VD([1, 1, 1, 0]) === 'long/3/0/p3' && VD([1, -1, 1, 1]) === 'long/3/1/p3', [VD([1, 1, 1, 1]), VD([1, 1, 1, 0]), VD([1, -1, 1, 1])].join());
check('Short-Tendenz ab 3 von 4 bearish, Kästchen kräftig rot', VD([-1, -1, -1, -1]) === 'short/0/4/m3' && VD([0, -1, -1, -1]) === 'short/0/3/m3' && VD([-1, -1, 1, -1]) === 'short/1/3/m3');
check('Sonst Abwarten (2 : 2, 2 : 0, 1 : 1, 0 : 0), Kästchen nur hell in Richtung der Summe oder neutral', VD([1, 1, -1, -1]) === 'wait/2/2/0' && VD([1, 1, 0, 0]) === 'wait/2/0/p1' && VD([-1, 0, 0, 0]) === 'wait/0/1/m1' && VD([1, -1, 0, 0]) === 'wait/1/1/0' && VD([0, 0, 0, 0]) === 'wait/0/0/0', [VD([1, 1, -1, -1]), VD([1, 1, 0, 0]), VD([-1, 0, 0, 0])].join());
check('Ohne Bewertung: keine Gesamtbewertung, Kästchen ohne Farbe', A.wlVerdict(null) === null && A.wlTone(null) === 'none');
check('wlView: Gesamtbewertung und Farbe aus derselben Bewertung', A.wlView({ ...entry(60), rating: R(-1, -1, 0, -1) }, now).verdict.dir === 'short' && A.wlView({ ...entry(60), rating: R(-1, -1, 0, -1) }, now).tone === 'm3');

// ---- Bewegung (ATR) – „Zu wenig Bewegung“, wenn 1 % im Zeitraum unrealistisch ist ----
const flat = (n, c, r, iv = I) => ({ ...entry(0, iv), closed: Array.from({ length: n }, (_, i) => ({ ...mk(i, c, iv), high: c + r, low: c - r })) });
let mv = A.wlMove(entry(60));
check('1 Stunde: ATR über die 12 Kerzen der Stunde, übliche Bewegung = ATR × √12', mv.len === 12 && near(mv.atrPct, 2 / 159 * 100) && near(mv.movePct, 2 / 159 * 100 * Math.sqrt(12)) && mv.low === false, JSON.stringify(mv));
mv = A.wlMove(flat(60, 100, 0.05));
check('Kaum Schwankung (0,1 % je Kerze ≈ 0,35 % in der Stunde): zu wenig Bewegung für 1 %', mv.low === true && near(mv.movePct, 0.1 * Math.sqrt(12)), JSON.stringify(mv));
const lowAt = r => A.wlMove(flat(60, 100, r)).low;
check('Grenze 1 %: 0,30 % je Kerze (≈ 1,04 % je Stunde) reicht, 0,28 % (≈ 0,97 %) nicht', lowAt(0.15) === false && lowAt(0.14) === true);
check('Zu wenige Kerzen (höchstens 12): kein Wert, ab 13 gerechnet', A.wlMove(entry(12)) === null && A.wlMove(entry(13))?.len === 12);
e = entry(60); const m1 = A.wlMove(e); e.closed.at(-1).high = 1000;
check('Einmal je Kerzenschluss: gleiche letzte Kerze → gemerkter Wert', A.wlMove(e) === m1);
A.wlAdd(e, k(60, 160, true), T0 + 61 * I);
check('… neue geschlossene Kerze → neu gerechnet', A.wlMove(e) !== m1 && A.wlMove(e).atrPct > m1.atrPct);
A.wl.span = '1m'; const m1m = A.wlMove(e);
check('Anderer Zeitraum (1 Minute): neu gerechnet mit ATR 14 und ohne Hochrechnung', m1m.len === 14 && near(m1m.movePct, m1m.atrPct) && A.wlMove(flat(60, 100, 0.4, M)).low === true);
A.wl.span = '4h'; const m4 = A.wlMove(entry(60, 15 * M));
A.wl.span = '30m'; const m30 = A.wlMove(entry(60, 3 * M));
A.wl.span = '1h';
check('4 Stunden: ATR über 16 Kerzen × 4; 30 Minuten: über 10 Kerzen × √10', m4.len === 16 && near(m4.movePct, m4.atrPct * 4) && m30.len === 10 && near(m30.movePct, m30.atrPct * Math.sqrt(10)));
check('wlView: Bewegung nur mit Bewertung', A.wlView({ ...flat(60, 100, 0.05), rating: R(1, 1, 1, 0) }, now).move?.low === true && A.wlView(flat(60, 100, 0.05), now).move === null);

// ---- Linie des Zeitraums ----
e = entry(60); e.run = mk(60, 200);
const pts = A.wlSpark(e).split(' ').map(p => p.split(',').map(Number));
check('Linie: die 12 Schlusskurse der Stunde und der aktuelle Kurs, links nach rechts, höchster Kurs oben', pts.length === 13 && pts[0][0] === 0 && pts.at(-1)[0] === 44 && pts.at(-1)[1] === 1 && pts[0][1] === 15, JSON.stringify([pts.length, pts[0], pts.at(-1)]));
A.wl.span = '4h'; e = entry(60, 15 * M); e.run = mk(60, 200, 15 * M); const n4 = A.wlSpark(e).split(' ').length;
A.wl.span = '1m'; e = entry(60, M); e.run = mk(60, 200, M); const n1 = A.wlSpark(e).split(' ').length;
A.wl.span = '1h';
check('… 4 Stunden: 16 Kerzen; 1 Minute: mindestens 12 Kerzen', n4 === 17 && n1 === 13, `${n4}/${n1}`);
check('Linie ohne Daten: leer', A.wlSpark(entry(0)) === '');

// ---- Streams je Markt und Intervall ----
A.wl.c.clear();
A.wl.c.set('XRPUSDT', { ...entry(10), market: 'futures' }); A.wl.c.set('NEARUSDT', { ...entry(0), error: 'gibt es nicht' });
check('Streams: 5-Minuten-Kerzen je Vorauswahl-Coin, Spot als Standard, Futures wie geladen, ohne fehlerhafte', JSON.stringify(A.wlStreams()) === JSON.stringify([{ m: 'spot', s: 'btcusdt@kline_5m' }, { m: 'futures', s: 'xrpusdt@kline_5m' }]), JSON.stringify(A.wlStreams()));
const x = A.wl.c.get('XRPUSDT'), before = x.closed.length;
A.wlKline({ i: '1m', s: 'XRPUSDT', m: 'futures', k: k(10, 5, true) }, T0 + 11 * I); A.wlKline({ i: '5m', s: 'XRPUSDT', m: 'spot', k: k(10, 5, true) }, T0 + 11 * I);
check('Stream: 1m-Kerzen oder falscher Markt zählen nicht', x.closed.length === before);
A.wlKline({ i: '5m', s: 'XRPUSDT', m: 'futures', k: k(10, 5, true) }, T0 + 11 * I);
check('… passender Markt und 5m: übernommen', x.closed.length === before + 1);
const old = { ...entry(10, M), market: 'futures' }; A.wl.c.set('XRPUSDT', old);
A.wlKline({ i: '5m', s: 'XRPUSDT', m: 'futures', k: k(10, 5, true, M) }, T0 + 11 * M);
check('… eine Reihe aus dem vorigen Zeitraum (1m) nimmt keine 5m-Kerzen', old.closed.length === 10);

(async () => {
  const tick = () => new Promise(r => setTimeout(r, 0));
  // ---- Laden: nacheinander, mit Spot/Futures, Fehler und neuer Versuch ----
  A.wl.c.clear(); loads = []; state.watch = ['BTC', 'XRP', 'NEAR'];
  const nowR = Date.now(), m0 = Math.floor(nowR / I) * I;
  const series = (ivMs, source) => { const b = Math.floor(nowR / ivMs) * ivMs; return { candles: [...Array.from({ length: 259 }, (_, i) => ({ ...mk(0, 100 + i), time: b - (259 - i) * ivMs, closeTime: b - (259 - i) * ivMs + ivMs - 1 })), { ...mk(0, 400), time: b, closeTime: b + ivMs - 1 }], source }; };
  klineAnswer = (sym, iv) => series(IVMS[iv], sym === 'XRPUSDT' ? 'futures' : 'spot');
  A.wlTick(nowR);
  check('Takt: Einträge für alle Vorauswahl-Coins, genau ein Abruf gestartet: 260 Kerzen zu 5 Minuten', A.wl.c.size === 3 && loads.length === 1 && loads[0].join() === 'BTCUSDT,5m,260' && [...A.wl.c.values()].every(y => y.iv === '5m'), JSON.stringify(loads));
  A.wlTick(nowR + 10);
  check('Während ein Abruf läuft, startet kein zweiter', loads.length === 1);
  await tick();
  const b = A.wl.c.get('BTCUSDT');
  check('Geladen: abgeschlossene Kerzen, laufende Kerze, Tendenz aus den letzten 199, Streams neu abgestimmt', b.closed.length === 259 && b.run?.close === 400 && b.rating && ratedLen === 199 && !b.loading && b.at > 0 && syncs >= 1, JSON.stringify({ n: b.closed.length, run: b.run?.close, ratedLen, syncs }));
  A.wlTick(nowR + 400); await tick(); A.wlTick(nowR + 800); await tick();
  check('Nacheinander: danach XRP (Futures) und NEAR', loads.map(l => l[0]).join() === 'BTCUSDT,XRPUSDT,NEARUSDT' && A.wl.c.get('XRPUSDT').market === 'futures', loads.map(l => l[0]).join());
  // Coin entfernt: Eintrag weg
  state.watch = ['BTC', 'NEAR']; A.wlTick(nowR + 1200);
  check('Aus der Vorauswahl entfernt: Eintrag gelöscht, kein neuer Abruf', !A.wl.c.has('XRPUSDT') && loads.length === 3);
  // Fehler und neuer Versuch nach einer Minute
  state.watch = ['BTC', 'NEAR', 'ABC']; klineAnswer = new Error('ABCUSDT ist bei Binance weder als Spot- noch als Futures-Paar verfügbar.');
  A.wlTick(nowR + 1600); await tick();
  const abc = A.wl.c.get('ABCUSDT');
  check('Unbekannter Coin: Fehler gemerkt, kein Stream', /weder als Spot/.test(abc.error) && !A.wlStreams().some(s => s.s.startsWith('abcusdt')));
  A.wlTick(nowR + 2000);
  check('… kein neuer Versuch vor Ablauf einer Minute', loads.length === 4);
  A.wlTick(abc.retryAt + 1); await tick();
  check('… nach einer Minute erneut', loads.length === 5 && loads.at(-1)[0] === 'ABCUSDT');
  // Lücke → neu laden
  klineAnswer = () => ({ candles: [{ ...mk(0, 1), time: m0 - I, closeTime: m0 - 1 }], source: 'spot' }); A.wl.c.get('NEARUSDT').gap = true;
  A.wlTick(nowR + 70e3 + 100); await tick();
  check('Lücke im Stream: Reihe wird neu geladen', loads.at(-1)[0] === 'NEARUSDT' && A.wl.c.get('NEARUSDT').gap === false);
  // Pause: nichts laden
  state.paused = true; const n0 = loads.length; A.wl.c.get('BTCUSDT').gap = true; A.wlTick(nowR + 80e3);
  check('Pause: kein Abruf', loads.length === n0); state.paused = false;

  // ---- Zeitraum wechseln (Auswahl im Detailfeld) ----
  state.watch = ['BTC', 'XRP']; klineAnswer = (sym, iv) => series(IVMS[iv], sym === 'XRPUSDT' ? 'futures' : 'spot');
  const r0 = renders, s0 = syncs, l0 = loads.length;
  A.wlSetSpan('4h');
  check('4 Stunden gewählt: gespeichert, alte Reihen verworfen, sofort neu geladen (15-Minuten-Kerzen), Kacheln und Streams neu', mem.get(A.WL_SPAN_KEY) === '4h' && A.wlSpan().iv === '15m' && loads.length === l0 + 1 && loads.at(-1).join() === 'BTCUSDT,15m,260' && renders === r0 + 1 && syncs > s0 && A.wl.c.size === 2 && [...A.wl.c.values()].every(y => y.iv === '15m'), JSON.stringify({ span: mem.get(A.WL_SPAN_KEY), loads: loads.slice(l0), renders: renders - r0 }));
  await tick();
  const bb = A.wl.c.get('BTCUSDT'), nb = bb.closed.length;
  check('… Streams mit 15-Minuten-Kerzen', A.wlStreams().every(s => s.s.endsWith('@kline_15m')) && nb === 259, JSON.stringify(A.wlStreams()));
  const b15 = Math.floor(nowR / (15 * M)) * 15 * M, kx = { t: b15, T: b15 + 15 * M - 1, o: 400, h: 402, l: 399, c: 401, v: 1, x: true };
  A.wlKline({ i: '5m', s: 'BTCUSDT', m: 'spot', k: kx }, b15 + 15 * M);
  check('… 5-Minuten-Kerzen zählen nicht mehr', bb.closed.length === nb);
  A.wlKline({ i: '15m', s: 'BTCUSDT', m: 'spot', k: kx }, b15 + 15 * M);
  check('… eine geschlossene 15-Minuten-Kerze wird übernommen und neu bewertet', bb.closed.length === nb + 1 && bb.closed.at(-1).close === 401 && ratedLen === 199);
  const l1 = loads.length; A.wlSetSpan('4h'); A.wlSetSpan('2w');
  check('Derselbe Zeitraum noch einmal oder ein unbekannter: nichts neu geladen, Einstellung bleibt', loads.length === l1 && A.wl.c.get('BTCUSDT') === bb && mem.get(A.WL_SPAN_KEY) === '4h' && A.wlSpan().iv === '15m');
  const B = load();
  check('Nach dem Neuladen der App: wieder 4 Stunden', B.wlSpanKey() === '4h' && B.wlSpan().iv === '15m' && B.wlSpan().label === '4 Std.');
  const seen = [];
  for (const [key, iv] of [['1m', '1m'], ['30m', '3m'], ['1d', '2h'], ['1h', '5m']]) {
    A.wlSetSpan(key); seen.push(`${key}:${A.wlSpan().iv}:${loads.at(-1)[1]}:${A.wlStreams().every(s => s.s.endsWith('@kline_' + iv))}`); await tick();
  }
  check('Alle Zeiträume: 1 Minute → 1m, 30 Minuten → 3m, 1 Tag → 2h, zurück auf 1 Stunde → 5m (Laden und Streams)', seen.join() === '1m:1m:1m:true,30m:3m:3m:true,1d:2h:2h:true,1h:5m:5m:true' && mem.get(A.WL_SPAN_KEY) === '1h', seen.join());
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
})().catch(err => { console.log('✗ Abbruch — ' + err.stack); process.exit(1); });
