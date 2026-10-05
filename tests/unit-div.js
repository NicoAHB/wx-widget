// RSI-Divergenz-Scanner ohne Browser: konstruierte Verläufe mit und ohne Divergenz. Aufruf: node unit-div.js
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'weather-widget-v2.html'), 'utf8');
const grab = name => { const a = html.indexOf(`function ${name}(`); if (a < 0) throw new Error(name); let d = 0, b = a; for (; b < html.length; b++) { if (html[b] === '{') d++; else if (html[b] === '}' && --d === 0) break; } return html.slice(a, b + 1); };
const divLine = html.match(/var DIV = \{[^}]*\}[^\n]*\n/)[0];
const make = () => new Function(`const state = { symbol: 'TEST', interval: '1m', candles: [] }; const zzPct = () => 1;
${divLine}${['zzStepper', 'zigzag', 'rsi', 'rsiDivergences'].map(grab).join('\n')}
return { state, rsiDivergences, zigzag, rsi };`)();
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${info ? ' — ' + info : ''}`); };
// Verlauf aus Schlusskursen bauen (kleine Dochte), die letzte Kerze ist die laufende
function candles(closes) { let seed = 3; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return closes.map((c, i) => { const o = i ? closes[i - 1] : c; return { time: 1e12 + i * 60e3, open: o, high: Math.max(o, c) * (1 + r() * .0004), low: Math.min(o, c) * (1 - r() * .0004), close: c, volume: 1 }; }); }
// Muster: ruhige Phase, steiler Rückgang (RSI sehr tief), Erholung, zweiter Rückgang in Wellen auf ein tieferes Tief (RSI höher),
// optional Erholung (bestätigt das Tief). mirror = Spiegelbild (bärisch).
function shape({ mirror = false, second = 'wavy', confirm = true, tailQuiet = 0 } = {}) {
  let seed = 9; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647, base = 100, s = mirror ? -1 : 1, lv = f => base * (1 - s * f), pts = [];
  for (let i = 0; i < 300; i++) pts.push(base * (1 + (r() - .5) * .002));
  const seg = (to, n) => { const from = pts.at(-1); for (let i = 1; i <= n; i++) pts.push(from + (to - from) * i / n); };
  seg(lv(.06), 5); seg(lv(.02), 10);
  if (second === 'wavy') { let f = .02; for (let i = 0; i < 12; i++) { f += .009; pts.push(lv(f)); f -= .005; pts.push(lv(f)); } } // −0,4 % je zwei Kerzen bis −6,8 %
  else if (second === 'higher') seg(lv(.04), 8); // Tief bleibt über dem ersten: kein tieferes Tief
  if (confirm) seg(lv(.045), 5);
  for (let i = 0; i < tailQuiet; i++) pts.push(pts.at(-1) * (1 + (r() - .5) * .0005));
  pts.push(pts.at(-1)); // laufende Kerze
  return candles(pts);
}
let A = make(), C = shape(); A.state.candles = C; let D = A.rsiDivergences();
check('Tieferes Tief im Kurs, höheres Tief im RSI → bullische Divergenz, bestätigt', D.length === 1 && D[0].kind === 'bull' && D[0].final && D[0].b.price < D[0].a.price && D[0].rb - D[0].ra >= 2, D.map(d => `${d.kind} RSI ${d.ra.toFixed(1)}→${d.rb.toFixed(1)} Kurs ${d.a.price.toFixed(2)}→${d.b.price.toFixed(2)} ${d.final ? 'bestätigt' : 'vorläufig'}`).join('; '));
check('Pivots und RSI-Stellen wie im ZigZag (dieselben Umkehrpunkte)', D[0] && A.zigzag(C.slice(0, -1), 1).some(p => p.i === D[0].a.i && p.type === 'L') && A.zigzag(C.slice(0, -1), 1).some(p => p.i === D[0].b.i && p.type === 'L'));
A = make(); A.state.candles = shape({ mirror: true }); D = A.rsiDivergences();
check('Spiegelbild: höheres Hoch, tieferes RSI-Hoch → bärische Divergenz', D.length === 1 && D[0].kind === 'bear' && D[0].b.price > D[0].a.price && D[0].ra - D[0].rb >= 2, D.map(d => `${d.kind} RSI ${d.ra.toFixed(1)}→${d.rb.toFixed(1)}`).join('; '));
A = make(); A.state.candles = shape({ second: 'higher' }); D = A.rsiDivergences();
check('Zweites Tief höher als das erste: keine Divergenz', D.length === 0, JSON.stringify(D.map(d => d.kind)));
A = make(); A.state.candles = shape({ confirm: false }); D = A.rsiDivergences();
check('Jüngstes Tief noch offen: Divergenz „vorläufig“', D.length === 1 && D[0].kind === 'bull' && !D[0].final);
A = make(); A.state.candles = shape({ tailQuiet: 45 }); D = A.rsiDivergences();
check('Jüngstes Tief älter als 40 abgeschlossene Kerzen: keine Divergenz', D.length === 0, JSON.stringify(D.map(d => [d.kind, d.b.i])));
A = make(); A.state.candles = shape({ tailQuiet: 25 }); D = A.rsiDivergences();
check('Jüngstes Tief innerhalb der 40 Kerzen (25 Kerzen danach ruhig): Divergenz bleibt', D.length === 1 && D[0].kind === 'bull');
// Die laufende Kerze zählt nicht: ein neues Tief nur in ihr ändert nichts
A = make(); C = shape(); C[C.length - 1] = { ...C.at(-1), low: C.at(-1).low * 0.9, close: C.at(-1).close * 0.95 }; A.state.candles = C; D = A.rsiDivergences();
check('Neues Tief nur in der laufenden Kerze: Ergebnis unverändert (nur abgeschlossene Kerzen)', D.length === 1 && D[0].kind === 'bull' && D[0].final);
// Zufallsverlauf: Ergebnis plausibel (höchstens eine je Art, jüngster Punkt in den letzten 40 Kerzen)
let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, Z = []; let px = 100;
for (let i = 0; i < 500; i++) { px *= 1 + (rnd() - .5) * .01; Z.push(px); }
let all = 0; for (let end = 200; end <= 500; end += 5) { A = make(); A.state.candles = candles(Z.slice(0, end)); const R = A.rsiDivergences(); all += R.length;
  if (!(R.length <= 2 && new Set(R.map(d => d.kind)).size === R.length && R.every(d => d.b.i >= end - 1 - 40 && d.a.ok && (d.kind === 'bull' ? d.b.price < d.a.price && d.rb > d.ra : d.b.price > d.a.price && d.rb < d.ra)))) { check('Zufallsverlauf: Regeln eingehalten', false, `Ende ${end}`); all = -1; break; } }
check('Zufallsverlauf (61 Zeitpunkte): höchstens eine Divergenz je Art, Regeln immer eingehalten, mindestens eine gefunden', all > 0, `${all} Divergenzen`);
check('Zu wenige Kerzen: keine Auswertung', (() => { const B = make(); B.state.candles = candles(Z.slice(0, 20)); return B.rsiDivergences().length === 0; })());
console.log(`${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
