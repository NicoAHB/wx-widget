// Fibonacci-Retracement ohne Browser: letzter abgeschlossener Schwung, Marken auf- und abwärts, zu wenige Umkehrpunkte,
// laufender Extrempunkt zählt nicht. Aufruf: node unit-fib.js
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(process.env.HTML || path.join(__dirname, '..', 'weather-widget-v2.html'), 'utf8');
const grab = name => { const a = html.indexOf(`function ${name}(`); if (a < 0) throw new Error(name); let d = 0, b = a; for (; b < html.length; b++) { if (html[b] === '{') d++; else if (html[b] === '}' && --d === 0) break; } return html.slice(a, b + 1); };
const fibLine = html.match(/var FIB = [^\n]*\n/)[0];
const A = new Function(`${fibLine}${grab('fibSwing')}\nreturn { fibSwing };`)();
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${info ? ' — ' + info : ''}`); };
const P = (prices, first = 'L', open = true) => prices.map((price, k) => ({ i: k * 10, price, type: (k % 2 === 0) === (first === 'L') ? 'L' : 'H', ok: !(open && k === prices.length - 1) }));
const near = (a, b) => Math.abs(a - b) < 1e-9, lv = f => f.levels.map(l => `${l.t}:${l.price.toFixed(3)}`).join(' ');
let f = A.fibSwing(P([100, 110, 104, 120, 115])); // letzter abgeschlossener Schwung 104 → 120 (aufwärts), 115 läuft noch
check('Letzter abgeschlossener Schwung: zwischen den beiden jüngsten bestätigten Umkehrpunkten (laufender zählt nicht)', f && f.a.price === 104 && f.b.price === 120 && f.up, f && `${f.a.price} → ${f.b.price}`);
check('Aufwärts-Schwung: Marken = Hoch − Anteil × Schwung (23,6 % nah am Hoch, 78,6 % nah am Tief)', f && near(f.levels[0].price, 120 - .236 * 16) && near(f.levels[1].price, 120 - .382 * 16) && near(f.levels[2].price, 112) && near(f.levels[3].price, 120 - .618 * 16) && near(f.levels[4].price, 120 - .786 * 16), f && lv(f));
f = A.fibSwing(P([120, 100, 110, 95, 99], 'H')); // 110 → 95 abwärts
check('Abwärts-Schwung: Marken = Tief + Anteil × Schwung', f && !f.up && near(f.levels[0].price, 95 + .236 * 15) && near(f.levels[2].price, 102.5) && near(f.levels[4].price, 95 + .786 * 15), f && lv(f));
check('Marken in der Reihenfolge 23,6 / 38,2 / 50 / 61,8 / 78,6', f && f.levels.map(l => l.t).join(' ') === '23,6 38,2 50 61,8 78,6');
check('Weniger als zwei bestätigte Umkehrpunkte: kein Retracement', A.fibSwing(P([100, 110])) === null && A.fibSwing(P([100])) === null && A.fibSwing([]) === null);
f = A.fibSwing(P([100, 110, 104], 'L', false)); // alle bestätigt: letzter Schwung 110 → 104
check('Sind alle Punkte bestätigt, zählt der jüngste Schwung', f && f.a.price === 110 && f.b.price === 104 && !f.up, f && `${f.a.price} → ${f.b.price}`);
console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
