// Schritt 3.3 – Countdown ohne Browser: Formate der Restzeit; Binance-Zeit aus den Stream-Zeitstempeln, auch wenn die
// Geräteuhr 20 s nach- oder vorgeht (mit zufälliger Laufzeit 50–300 ms); veraltete Ausreißer fallen nach 30 Werten heraus.
// Lage des Kurs-Schilds: am Handy über bzw. unter der Linie, ohne den Körper der laufenden Kerze zu verdecken – auch bei
// neuem Hoch oder Tief (Geometrie wie im Chart am iPhone: 356 × 300 px, Kursbereich 18–223 px, mindestens 18 px Rand).
// Aufruf: node unit-cd.js (liest js/countdown.js aus dem Scratchpad)
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(process.env.SRC || path.join(__dirname, 'js', 'countdown.js'), 'utf8');
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${info ? ' — ' + info : ''}`); };
// App-Umgebung nachbilden: Geräteuhr mit Abweichung skew, dazu state mit laufender Kerze
const env = (skew = 0) => { let real = 1790700000000; const FakeDate = { now: () => real + skew };
  const state = { symbol: 'BTCUSDT', loadedSymbol: 'BTCUSDT', candles: [] }, clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const api = new Function('Date', 'state', 'clamp', 'priceText', 'node', src + '\nreturn { clockSample, serverNow, cdText, candleLeft, lastTagBox, get clk() { return clk; } };')(FakeDate, state, clamp, x => String(x), () => ({}));
  return { api, state, tick: ms => { real += ms; }, real: () => real };
};
const { api: A } = env();
const fmt = [[0, '0:00'], [999, '0:00'], [42000, '0:42'], [59999, '0:59'], [60000, '1:00'], [3599000, '59:59'], [3600000, '1:00:00'], [3723000, '1:02:03'], [86399000, '23:59:59'], [86400000, '1T 00:00'], [277920000, '3T 05:12'], [-5000, '0:00']];
check('Formate: m:ss / h:mm:ss / „3T 05:12“, negativ = 0:00', fmt.every(([ms, t]) => A.cdText(ms) === t), fmt.map(([ms]) => A.cdText(ms)).join(' '));
check('Ohne Stream-Zeitstempel: Geräteuhr (Abweichung 0)', A.clk.off === 0, String(A.clk.off));
for (const skew of [-20000, 20000]) {
  const E = env(skew);
  for (let i = 0; i < 40; i++) { E.tick(1000); const lat = 50 + Math.random() * 250; E.api.clockSample(E.real() - lat); } // Ereignis entsteht bei Binance, kommt lat ms später an
  const err = E.api.serverNow() - E.real();
  check(`Geräteuhr ${skew > 0 ? 'geht 20 s vor' : 'geht 20 s nach'}: Binance-Zeit auf < 0,3 s genau`, Math.abs(err) < 300, `${err.toFixed(0)} ms`);
  E.state.candles = [{ time: E.real() - 20000, closeTime: E.real() + 39999, open: 1, close: 2 }];
  const left = E.api.candleLeft();
  check(`Geräteuhr ${skew > 0 ? 'vor' : 'nach'}: Restzeit der Kerze stimmt (40 s)`, Math.abs(left - 40000) < 300 && ['0:40', '0:39'].includes(E.api.cdText(left)), `${E.api.cdText(left)} (${left.toFixed(0)} ms)`);
}
const G = env(0); G.api.clockSample(G.real() + 60000); // einzelner Ausreißer (z. B. falscher Zeitstempel)
const spike = G.api.clk.off; for (let i = 0; i < 30; i++) { G.tick(1000); G.api.clockSample(G.real() - 100); }
check('Ausreißer fällt nach 30 Werten heraus', spike > 59000 && Math.abs(G.api.clk.off + 100) < 5, `${spike} → ${G.api.clk.off}`);
G.api.clockSample(undefined); G.api.clockSample(NaN);
check('Fehlende Zeitstempel werden ignoriert', Math.abs(G.api.clk.off + 100) < 5 && G.api.clk.s.length === 30, `${G.api.clk.off} / ${G.api.clk.s.length}`);
G.state.loadedSymbol = 'ETHUSDT'; G.state.candles = [{ time: 0, closeTime: 1, open: 1, close: 1 }];
check('Kerzen eines anderen Kürzels: keine Restzeit', G.api.candleLeft() === null);
// ---- Lage des Kurs-Schilds ----
// Chart wie in renderChart: 80 Kerzen, Rand 12 % des Bereichs, am Handy mindestens 18 px
const chart = (cs, axisIn = true, w = 356) => {
  const h = 300, left = 15, right = axisIn ? 4 : 82, top = 18, bottom = h - 77, pw = w - left - right, step = pw / cs.length;
  let min = Math.min(...cs.map(c => c.low)), max = Math.max(...cs.map(c => c.high)); const span0 = max - min;
  const padding = Math.max(span0 * .12, axisIn ? span0 * 18 / (bottom - top - 36) : 0); min -= padding; max += padding;
  const y = v => top + (max - v) / (max - min) * (bottom - top), x = i => left + (i + .5) * step;
  return { y, x, min, max, top, bottom, w, axisIn, data: cs, step };
};
// Kerzen: Verlauf aus Schlusskursen (Dochte ±0,2), die letzte bestimmt der Fall
const series = (closes, last) => [...closes.map((c, i) => { const o = i ? closes[i - 1] : c; return { open: o, close: c, high: Math.max(o, c) + .2, low: Math.min(o, c) - .2 }; }), last];
const ramp = (a, b, n = 79) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
const body = (g, c) => [g.y(Math.max(c.open, c.close)), Math.max(g.y(Math.min(c.open, c.close)), g.y(Math.max(c.open, c.close)) + 1)];
const place = (g, t, c) => { const [b0, b1] = body(g, c), py = g.y(c.close); return { rel: t.y + t.h <= py - .5 ? 'über' : t.y >= py + .5 ? 'unter' : 'auf', cover: Math.max(0, Math.min(t.y + t.h, b1) - Math.max(t.y, b0)), top: +t.y.toFixed(1), py: +py.toFixed(1) }; };
const cases = [
  ['neues Hoch, grüne Kerze schließt am Hoch', series(ramp(90, 99), { open: 99, close: 100, high: 100, low: 98.8 }), 'über'],
  ['neues Tief, rote Kerze schließt am Tief', series(ramp(110, 101), { open: 101, close: 100, high: 101.2, low: 100 }), 'unter'],
  ['rote Kerze mitten im Bereich, darunter dichte Kerzen', series([...ramp(90, 110, 40), ...ramp(110, 96, 39)], { open: 101, close: 99.5, high: 101.3, low: 99.3 }), 'unter'],
  ['grüne Kerze mitten im Bereich, darüber dichte Kerzen', series([...ramp(110, 90, 40), ...ramp(90, 104, 39)], { open: 99, close: 100.5, high: 100.7, low: 98.8 }), 'über'],
];
for (const [name, cs, want] of cases) {
  const g = chart(cs), last = cs.at(-1), t = A.lastTagBox(last.close, g), p = t && place(g, t, last);
  check(`Handy, ${name}: Schild ${want} der Linie, Körper frei, im Chart`, p && p.rel === want && p.cover === 0 && t.y >= 2 && t.y + t.h <= g.bottom + 14 && t.h === 31, JSON.stringify(p));
}
{ const cs = cases[0][1], g = chart(cs, false, 1000), last = cs.at(-1), t = A.lastTagBox(last.close, g);
  check('Desktop (Kursspalte): Kurs steht auf der Linie', t && Math.abs(t.y + 9 - g.y(last.close)) < .01, JSON.stringify(t)); }
{ const cs = cases[0][1], g = chart(cs), t = A.lastTagBox(g.max + 1, g);
  check('Kurs außerhalb des sichtbaren Bereichs: kein Schild', t === null); }
{ const cs = cases[0][1], g = { ...chart(cs), step: 2, x: i => 15 + (i + .5) * 2 }, last = cs.at(-1), t = A.lastTagBox(last.close, g); // Kerzen enden weit vor dem Schild (Prognose-Platz)
  check('Handy, keine Kerze unter dem Schild: Kurs steht auf der Linie', t && Math.abs(t.y + 9 - g.y(last.close)) < .01, JSON.stringify(t && { y: t.y, py: t.py })); }
console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
