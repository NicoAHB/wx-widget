// ZigZag-Pivot-Erkennung ohne Browser: bekannte Verläufe und Eigenschaften auf Zufallsdaten. Aufruf: node unit-zz.js
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'weather-widget-v2.html'), 'utf8');
const grab = name => { const a = html.indexOf(`function ${name}(`); let d = 0, b = a; for (; b < html.length; b++) { if (html[b] === '{') d++; else if (html[b] === '}' && --d === 0) break; } return html.slice(a, b + 1); };
const { zigzag, zzForecast, zzLearn } = new Function(`${grab('zzStepper')}\n${grab('zigzag')}\n${grab('zzForecast')}\n${grab('zzLearn')}\nreturn { zigzag, zzForecast, zzLearn };`)();
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${info ? ' — ' + info : ''}`); };
const C = vs => vs.map((v, i) => ({ time: i, high: v, low: v }));
const fmt = p => p.map(x => `${x.type}${x.i}@${x.price}${x.ok ? '' : '?'}`).join(' ');
let p = zigzag(C([100, 102, 104, 106, 108, 110, 108, 106, 104.5, 106, 108, 109.7]), 3);
check('3 %: Tief, Hoch, Tief bestätigt, letzter Hochpunkt offen', fmt(p) === 'L0@100 H5@110 L8@104.5 H11@109.7?', fmt(p));
p = zigzag(C([100, 102, 104, 106, 108, 110, 108, 106, 104.5, 106, 108, 109.7]), 6);
check('6 %: der Rückgang um 5 % reicht nicht – nur Tief bestätigt, Hoch offen', fmt(p) === 'L0@100 H5@110?', fmt(p));
p = zigzag(C([100, 98, 96, 97, 99, 101]), 3);
check('Erst Rückgang: Hoch, Tief, offener Hochpunkt', fmt(p) === 'H0@100 L2@96 H5@101?', fmt(p));
check('Seitwärts ohne Mindestbewegung: keine Pivots', zigzag(C(Array(50).fill(100)), 1).length === 0);
check('Ungültige Mindestbewegung: keine Pivots', zigzag(C([1, 2, 3]), 0).length === 0 && zigzag([], 3).length === 0);
// Dochte: Hochs am Kerzenhoch, Tiefs am Kerzentief (nicht am Schlusskurs)
p = zigzag([{ time: 0, high: 100.5, low: 99.5 }, { time: 1, high: 106, low: 101 }, { time: 2, high: 104, low: 97.9 }, { time: 3, high: 103, low: 99 }], 3);
check('Pivots an Hoch/Tief der Kerze (Docht)', fmt(p) === 'L0@99.5 H1@106 L2@97.9 H3@103?', fmt(p));
// Zufallsdaten: Wechsel H/L, Mindestgröße jedes bestätigten Schenkels, Pivot = Extrem zwischen den Nachbarn
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const K = []; let px = 100; for (let i = 0; i < 600; i++) { const o = px; px *= 1 + (rnd() - .5) * .012; K.push({ time: i, high: Math.max(o, px) * (1 + rnd() * .003), low: Math.min(o, px) * (1 - rnd() * .003) }); }
for (const pct of [0.5, 1, 3]) {
  const q = zigzag(K, pct), conf = q.filter(x => x.ok);
  const alt = q.every((x, i) => !i || x.type !== q[i - 1].type), inc = q.every((x, i) => !i || x.i > q[i - 1].i), lastOnly = q.every((x, i) => x.ok || i === q.length - 1);
  const legs = conf.slice(1).map((x, i) => Math.abs(x.price / conf[i].price - 1) * 100), minLeg = Math.min(...legs);
  // Zusicherung: jeder bestätigte Pivot ist das Extrem seines Schenkels – vom vorigen Pivot bis zur Kerze, die ihn bestätigt
  let ext = true; for (let k = 1; k < q.length; k++) { const x = q[k]; if (!x.ok) continue; const f = pct / 100;
    let r = x.i + 1; while (r < K.length && !(x.type === 'H' ? K[r].low <= x.price * (1 - f) : K[r].high >= x.price * (1 + f))) r++;
    const seg = K.slice(q[k - 1].i + 1, r), v = x.type === 'H' ? Math.max(...seg.map(c => c.high)) : Math.min(...seg.map(c => c.low)); if (v !== x.price) ext = false; }
  check(`Zufallsdaten ${pct} %: ${q.length} Pivots wechseln sich ab, zeitlich geordnet, nur der letzte offen`, q.length > 2 && alt && inc && lastOnly);
  check(`Zufallsdaten ${pct} %: jeder bestätigte Schenkel ≥ ${pct} %`, legs.length > 0 && minLeg >= pct - 1e-9, `kleinster ${minLeg.toFixed(3)} %`);
  check(`Zufallsdaten ${pct} %: jeder Pivot ist das Extrem seines Schenkels bis zur Bestätigung`, ext);
}
const n1 = zigzag(K, 0.5).length, n3 = zigzag(K, 3).length;
check('Größere Mindestbewegung ergibt weniger Pivots', n3 < n1, `${n1} → ${n3}`);
// Prognose: Median/Band der Schwünge in Gegenrichtung zum laufenden, Ziel in der Zukunft
const P = (i, price, type, ok = true) => ({ i, t: i, price, type, ok });
let piv = [P(0, 100, 'L'), P(5, 102, 'H'), P(8, 101, 'L'), P(12, 104.03, 'H'), P(15, 102, 'L'), P(20, 106.08, 'H'), P(23, 104, 'L', false)];
let fc = zzForecast(piv, 25), near = (a, b) => Math.abs(a - b) < 0.02;
check('Prognose nach offenem Tief: aufwärts, Median der Aufwärtsschwünge (+3 %)', fc && fc.up && near(fc.pct, 3) && fc.n === 3 && near(fc.to.price, 107.12), fc && JSON.stringify({ up: fc.up, pct: fc.pct.toFixed(2), ziel: fc.to.price.toFixed(2) }));
check('Prognose: Band 25–75 % (+2,5 bis +3,5 %), Dauer Median 5 Kerzen, Ziel in der Zukunft', fc && near(fc.p25, 2.5) && near(fc.p75, 3.5) && fc.bars === 5 && fc.to.i === 28, fc && JSON.stringify({ p25: fc.p25.toFixed(2), p75: fc.p75.toFixed(2), bars: fc.bars, i: fc.to.i }));
fc = zzForecast([...piv.slice(0, 6).map(p => ({ ...p })), P(23, 108, 'H', false)].map((p, k) => k === 5 ? { ...p, type: 'H' } : p).filter((p, k) => k !== 5), 25);
const pivDown = [P(0, 100, 'L'), P(5, 102, 'H'), P(8, 101, 'L'), P(12, 104.03, 'H'), P(15, 102, 'L'), P(20, 106.08, 'H'), P(24, 104, 'L'), P(27, 107, 'H', false)];
fc = zzForecast(pivDown, 28);
check('Prognose nach offenem Hoch: abwärts, Median der Abwärtsschwünge', fc && !fc.up && fc.n === 3 && fc.to.price < 107, fc && JSON.stringify({ up: fc.up, pct: fc.pct.toFixed(2), n: fc.n }));
check('Zu wenige Schwünge in der Richtung: keine Prognose', zzForecast(piv.slice(2), 25) === null);
check('Letzter Pivot bestätigt (kein offener): keine Prognose', zzForecast(piv.slice(0, 6), 25) === null);
// Lernen: Schwünge werden kleiner als bisher → Lernfaktor < 1, korrigierte Prognose trifft öfter als die unkorrigierte
const LC = []; let lp = 100, lt = 0; const leg = (pctMove, bars) => { const to = lp * (1 + pctMove / 100); for (let b = 1; b <= bars; b++) { const v = lp + (to - lp) * b / bars; LC.push({ time: lt++, high: v * 1.0004, low: v * 0.9996 }); } lp = to; };
for (let r = 0; r < 12; r++) { leg(4, 6); leg(-1.5, 4); } for (let r = 0; r < 14; r++) { leg(2, 5); leg(-1.5, 4); } LC.push({ time: lt++, high: lp, low: lp });
const LR = zzLearn(LC, 1);
check('Lernen: Aufwärtsschwünge zuletzt kleiner → Lernfaktor unter 1', LR.corr.up < 0.85 && Math.abs(LR.corr.down - 1) < 0.2, JSON.stringify(LR.corr));
check('Lernen: korrigierte Prognose trifft öfter als ohne Lernfaktor', LR.n >= 20 && LR.hits > LR.plain, `${LR.hits}/${LR.n} mit, ${LR.plain}/${LR.n} ohne`);
const RR = zzLearn(K, 1);
check('Zufallsdaten: Trefferquote zwischen 0 und 100 %, genügend Stichproben', RR.n >= 20 && RR.hits >= 0 && RR.hits <= RR.n, `${RR.hits}/${RR.n}`);
check('Lernfaktor bewährt sich (typische Abweichung mit < ohne) → angewendet', LR.use && LR.k >= 6 && LR.dev.c < LR.dev.p, JSON.stringify({ use: LR.use, k: LR.k, mit: LR.dev.c.toFixed(3), ohne: LR.dev.p.toFixed(3) }));
// Zufallsdaten: nichts zu lernen – der Lernfaktor darf nur angewendet werden, wenn er die Schätzung bisher verbessert hat
const rs = []; for (const sd of [3, 11, 47, 555, 777, 999]) { let q = sd; const r = () => (q = (q * 16807) % 2147483647) / 2147483647, Z = []; let v = 100;
  for (let i = 0; i < 500; i++) { const o = v; v *= 1 + (r() - .5) * .01; Z.push({ time: i, high: Math.max(o, v) * (1 + r() * .002), low: Math.min(o, v) * (1 - r() * .002) }); }
  for (const pc of [0.5, 1]) rs.push(zzLearn(Z, pc)); }
check('Zufallsdaten: Lernfaktor nur bei nachweislich besserer Schätzung, sonst ×1', rs.every(r => r.use ? r.dev.c < r.dev.p : r.corr.up === 1 && r.corr.down === 1),
  rs.map(r => (r.use ? 'an' : 'aus') + ` ${(r.dev.c * 100).toFixed(0)}/${(r.dev.p * 100).toFixed(0)} %`).join(', '));
check('Zufallsdaten: meistens nicht angewendet (Korrektur wäre nur Rauschen)', rs.filter(r => !r.use).length >= rs.length * .75, `${rs.filter(r => !r.use).length} von ${rs.length} aus`);
check('Zu wenige Kerzen: keine Auswertung', zzLearn(K.slice(0, 30), 1).n === 0);
console.log(`${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
