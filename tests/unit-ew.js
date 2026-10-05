// Elliott-Wellen-Zählung ohne Browser: Grundregeln einzeln verletzt, Spiegelbild, Korrektur A–B–C, vorläufiger Punkt,
// jüngstes Muster, zu wenige Kerzen, Verlauf wie in der Test-Attrappe, Zufallsdaten. Aufruf: node unit-ew.js
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(process.env.HTML || path.join(__dirname, '..', 'weather-widget-v2.html'), 'utf8');
const grab = name => { const a = html.indexOf(`function ${name}(`); if (a < 0) throw new Error(name); let d = 0, b = a; for (; b < html.length; b++) { if (html[b] === '{') d++; else if (html[b] === '}' && --d === 0) break; } return html.slice(a, b + 1); };
const ewLine = html.match(/var EW = \{[^}]*\}[^\n]*\n/)[0], zzLine = html.match(/var ZZ_KEY = [^\n]*\n/)[0];
const make = pct => new Function(`const state = { symbol: 'TEST', interval: '1h', candles: [] }; const zzPct = () => ${pct};
${zzLine}${ewLine}${['zzStepper', 'zigzag', 'pivotsFor', 'elliottCount', 'elliottWaves', 'elliottForecast'].map(grab).join('\n')}
return { state, elliottCount, elliottWaves, elliottForecast, zigzag };`)();
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${info ? ' — ' + info : ''}`); };
const A = make(3);
// Pivot-Folge aus Kursen; beginnt mit Tief (t='L') oder Hoch, wechselt ab; open = letzter Punkt unbestätigt
const P = (prices, first = 'L', open = false) => prices.map((price, k) => ({ i: k * 10, t: k, price, type: (k % 2 === 0) === (first === 'L') ? 'L' : 'H', ok: !(open && k === prices.length - 1) }));
const lab = r => r ? r.waves.map(w => w.label + (w.ok ? '' : '?')).join(' ') : 'keine';
const imp = [100, 106, 102, 116, 109, 118];
let r = A.elliottCount(P(imp));
check('Aufwärtsimpuls nach allen Regeln: 1 2 3 4 5, Richtung aufwärts, Start am ersten Tief', lab(r) === '1 2 3 4 5' && r.dir === 1 && r.start.price === 100, lab(r));
check('Regel 1 verletzt (Welle 2 unter dem Start von Welle 1): keine Zählung', A.elliottCount(P([100, 106, 99, 116, 109, 118])) === null);
check('Regel 2 verletzt (Welle 3 die kürzeste): keine Zählung', A.elliottCount(P([100, 110, 105, 114, 111, 121])) === null);
check('Regel 3 verletzt (Welle 4 im Bereich von Welle 1): keine Zählung', A.elliottCount(P([100, 106, 102, 116, 105, 118])) === null);
check('Verkürzte Welle 5 (endet unter Welle 3): keine Zählung', A.elliottCount(P([100, 106, 102, 116, 109, 114])) === null);
check('Weniger als sechs Umkehrpunkte: keine Zählung', A.elliottCount(P([100, 106, 102, 116, 109])) === null);
r = A.elliottCount(P([100, 94, 98, 84, 91, 82], 'H'));
check('Abwärtsimpuls (Spiegelbild): 1 2 3 4 5, Richtung abwärts', lab(r) === '1 2 3 4 5' && r.dir === -1 && r.start.type === 'H', lab(r));
r = A.elliottCount(P([...imp, 112, 116, 110]));
check('Korrektur danach: A B C (B unter dem Impulsende, C unter A)', lab(r) === '1 2 3 4 5 A B C' && r.waves.slice(5).every(w => !w.imp), lab(r));
r = A.elliottCount(P([...imp, 112, 119]));
check('B über dem Impulsende: nur A', lab(r) === '1 2 3 4 5 A', lab(r));
r = A.elliottCount(P([...imp, 112, 116, 113]));
check('C nicht unter A: nur A B', lab(r) === '1 2 3 4 5 A B', lab(r));
r = A.elliottCount(P([...imp, 112], 'L', true));
check('Noch laufender Extrempunkt: A vorläufig („A?“)', lab(r) === '1 2 3 4 5 A?', lab(r));
r = A.elliottCount(P(imp, 'L', true));
check('Welle 5 noch nicht bestätigt: „5?“', lab(r) === '1 2 3 4 5?', lab(r));
// zwei Impulse hintereinander: der jüngere zählt
r = A.elliottCount(P([100, 106, 102, 116, 109, 118, 112, 130, 120, 150, 135, 160]));
check('Zwei passende Muster: das jüngste wird beschriftet', r && r.start.price === 112 && lab(r) === '1 2 3 4 5', r && `Start ${r.start.price}: ${lab(r)}`);
// Kerzen: zu wenige, Verlauf wie in der Test-Attrappe (ew-up), Zufallsdaten
const candles = pts => pts.map((c, i) => { const o = i ? pts[i - 1] : c; return { time: 1e12 + i * 36e5, open: o, high: Math.max(o, c) * 1.0002, low: Math.min(o, c) * 0.9998, close: c, volume: 1 }; });
A.state.candles = candles(Array.from({ length: 49 }, (_, i) => 100 + Math.sin(i / 3)));
let d = A.elliottWaves(); check('49 Kerzen: gesperrt mit aktueller Anzahl', d.short && d.have === 49 && !d.count, JSON.stringify({ short: d.short, have: d.have }));
A.state.candles = candles(Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i / 3)));
d = A.elliottWaves(); check('Ab 50 Kerzen verfügbar', !d.short && d.have === 50);
const mock = (legs, base = 100) => { let s = 5; const rr = () => { s = (s * 48271) % 2147483647; return s / 2147483647; }, pts = []; for (let i = 0; i < 300; i++) pts.push(base * (1 + (rr() - .5) * .002));
  for (const [to, n] of legs) { const from = pts.at(-1); for (let i = 1; i <= n; i++) pts.push(from + (base * to - from) * i / n); } pts.push(pts.at(-1)); return candles(pts); };
const LEGS = [[0.90, 10], [0.96, 6], [0.92, 4], [1.06, 12], [0.99, 6], [1.08, 8], [1.02, 5], [1.055, 4], [0.995, 6], [1.035, 4]];
for (const pct of [1, 3]) {
  const B = make(pct); B.state.candles = mock(LEGS); d = B.elliottWaves();
  const got = d.count ? d.count.waves.map(w => `${w.label}@${w.price.toFixed(1)}`).join(' ') : 'keine';
  check(`Attrappen-Verlauf ew-up, ZigZag ${pct} %: 1–5 und A–C an den erwarteten Kursen`, d.count && lab(d.count) === '1 2 3 4 5 A B C' && Math.abs(d.count.start.price - 90) < 0.1 && Math.abs(d.count.waves[4].price - 108) < 0.1 && Math.abs(d.count.waves[7].price - 99.5) < 0.1, got);
}
const B = make(1); B.state.candles = mock([[0.90, 10], [0.96, 6], [0.92, 4], [1.06, 12], [0.95, 8], [1.08, 10], [1.04, 4]]); d = B.elliottWaves();
check('Attrappen-Verlauf ew-none (Welle 4 im Bereich von Welle 1): keine Zählung', d.count === null, lab(d.count));
// Zufallsdaten: jede gefundene Zählung erfüllt alle Regeln
let seed = 17; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; let found = 0, bad = 0;
for (let run = 0; run < 300; run++) {
  const pct = [0.5, 1, 2, 3][run % 4], C = make(pct), pts = [100]; for (let i = 1; i < 500; i++) pts.push(pts.at(-1) * (1 + (rnd() - .5) * 0.02));
  C.state.candles = candles(pts); const res = C.elliottWaves(); if (!res.count) continue; found++;
  const { dir: s, start, waves } = res.count, v = [start, ...waves].map(p => s * p.price), w = [start, ...waves];
  const ok = v[2] > v[0] && !(v[3] - v[2] < v[1] - v[0] && v[3] - v[2] < v[5] - v[4]) && v[4] > v[1] && v[5] > v[3]
    && (waves.length < 7 || v[7] < v[5]) && (waves.length < 8 || v[8] < v[6]) && w.every((p, k) => !k || p.type !== w[k - 1].type && p.i > w[k - 1].i)
    && waves.map(x => x.label).join('') === '12345ABC'.slice(0, waves.length);
  if (!ok) bad++;
}
check('Zufallsdaten (300 Verläufe): jede Zählung hält alle Regeln ein, Beschriftung in Reihenfolge', found > 50 && bad === 0, `${found} Zählungen, ${bad} Regelverstöße`);
// ---------- Elliott-Prognose: Zielpunkte je Zustand ----------
const near = (a, b) => Math.abs(a - b) < 1e-6, fc = (prices, first = 'L', open = true, n = 200) => { const piv = P(prices, first, open); return A.elliottForecast(A.elliottCount(piv), piv, n); };
let f = fc(imp); // Welle 5 läuft (5?)
const lenA = .382 * 18, a5 = 118 - lenA, b5 = a5 + .618 * lenA;
check('Prognose, Welle 5 läuft: A = 38,2 % Rückgang, B = 61,8 % Erholung von A, C so lang wie A', f && f.pts.map(p => p.label).join(' ') === 'A B C' && near(f.pts[0].price, a5) && near(f.pts[1].price, b5) && near(f.pts[2].price, b5 - lenA) && f.inval === null, f && f.pts.map(p => `${p.label} ${p.price.toFixed(2)}`).join(' · '));
check('Zeitpunkte: erster Zielpunkt rechts der letzten Kerze, dann aufsteigend (Dauer aus Welle 2 und 4)', f && f.pts[0].i >= 200 && f.pts[1].i > f.pts[0].i && f.pts[2].i > f.pts[1].i && f.pts[2].i - f.pts[1].i === 10, f && f.pts.map(p => p.i).join(', '));
f = fc([...imp, 112]); // A läuft (A?)
check('A läuft: B = 61,8 % Erholung von A, C so lang wie A, ungültig über dem Ende von Welle 5', f && f.pts.map(p => p.label).join(' ') === 'B C' && near(f.pts[0].price, 112 + .618 * 6) && near(f.pts[1].price, 112 + .618 * 6 - 6) && f.inval === 118, f && f.pts.map(p => `${p.label} ${p.price.toFixed(3)}`).join(' · '));
f = fc([...imp, 112, 116]); // B läuft (B?)
check('B läuft: C so lang wie A (von B aus)', f && f.pts.map(p => p.label).join(' ') === 'C' && near(f.pts[0].price, 110) && f.inval === 118, f && f.pts.map(p => `${p.label} ${p.price}`).join(' · '));
f = fc([...imp, 112, 116, 113]); // B bestätigt, C läuft, noch nicht unter A
check('B bestätigt, C läuft (noch nicht unter A): weiterhin Ziel C', f && f.state === 'B' && f.pts[0].label === 'C' && near(f.pts[0].price, 110), f && `${f.state}: ${f.pts.map(p => p.label + ' ' + p.price).join(' · ')}`);
f = fc([...imp, 112, 116, 110]); // C läuft (C?)
check('C läuft: neuer Impuls „(1)“, 61,8 % des Wegs zurück Richtung Ende von Welle 5', f && f.pts[0].label === '(1)' && near(f.pts[0].price, 110 + .618 * 8), f && f.pts.map(p => `${p.label} ${p.price.toFixed(3)}`).join(' · '));
f = fc([100, 94, 98, 84, 91, 82], 'H'); // Abwärtsimpuls, 5 läuft
check('Abwärtsimpuls: Ziele spiegelbildlich (A über dem Ende von Welle 5)', f && f.dir === -1 && near(f.pts[0].price, 82 + .382 * 18) && f.pts[1].price < f.pts[0].price && f.pts[2].price > f.pts[1].price, f && f.pts.map(p => `${p.label} ${p.price.toFixed(2)}`).join(' · '));
check('Abgeschlossene Zählung (danach schon weitere Umkehrpunkte): keine Prognose', fc([...imp, 112, 119, 111], 'L', true) === null && fc([...imp, 112, 116, 110, 118, 111], 'L', true) === null);
console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
