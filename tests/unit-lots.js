// 3.30.0 (G02) – Rechenkern Lose/Nachkauf/Teilabschluss, ohne Browser. Lädt den Block zwischen „G02-Kern Anfang“ und
// „G02-Kern Ende“ aus der App (oder, mit --core, aus der Arbeitsdatei) und prüft die Rechenprobe der Übergabe, die Restverteilung,
// den unveränderten Durchschnitt, die Rundung ohne Zusatzgewinn, Gebühren genau einmal, Börsen-Netto und die Prüfung gespeicherter Verläufe.
const fs = require('fs'), path = require('path');
const src = process.argv.includes('--core') ? fs.readFileSync(path.join(__dirname, '../g02/lots-core.js'), 'utf8') : (() => {
  const s = fs.readFileSync(require('path').join(__dirname, '..', 'weather-widget-v2.html'), 'utf8'), a = s.indexOf('// ==== G02-Kern Anfang'), b = s.indexOf('// ==== G02-Kern Ende');
  if (a < 0 || b < 0) throw new Error('G02-Kern nicht gefunden'); return s.slice(a, b);
})();
const K = new Function(src + '\nreturn { decStr, decUnits, decRound, unitsDec, numDec, rq, rAdd, rSub, rMul, rRound, rNum, qNum, mNum, pNum, lotEvents, lotShares, lotReplay, lotCheck, evOrder, LOT_BASE };')();
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + detail : ''}`); };
const U = s => String(K.decUnits(s, 8)); // Menge als Einheiten-Text
const T0 = Date.UTC(2026, 9, 1, 10), H = 3600e3;
const buy = (id, at, q, p, f) => ({ id, t: 'b', at, q: U(q), p, ...(f ? { f } : {}) });
const sell = (id, at, k, x, more = {}) => ({ id, t: 's', at, k: U(k), x, ...more });
const pos = (side, ev, extra = {}) => ({ side, openedAt: ev[0].at, ev, ...extra });
const usd = u => K.unitsDec(u, 8), price = r => r === null ? null : K.unitsDec(K.rRound(K.rMul(r, K.rq(10n ** 8n, 10n ** 12n))), 8); // Preis auf 8 Stellen

// ---- Rechenprobe der Übergabe ----
let p = pos('long', [buy('a', T0, '2', '100'), buy('b', T0 + H, '1', '130')]), r = K.lotReplay(p);
check('2 Stück zu 100 + 1 zu 130 = 3 zu 110', r.Q === 300000000n && price(r.E) === '110', `${K.qNum(r.Q)} zu ${price(r.E)}`);
p.ev.push(sell('s1', T0 + 2 * H, '1', '120')); r = K.lotReplay(p);
check('Long: 1 Stück bei 120 geschlossen = +10 brutto; 2 Stück zu 110 bleiben', usd(r.sells[0].gross) === '10' && r.Q === 200000000n && price(r.E) === '110', `${usd(r.sells[0].gross)} · ${K.qNum(r.Q)} zu ${price(r.E)}`);
const ps = pos('short', [buy('a', T0, '2', '100'), buy('b', T0 + H, '1', '130'), sell('s1', T0 + 2 * H, '1', '100')]), rs = K.lotReplay(ps);
check('Short: 1 Stück bei 100 zurückgekauft = +10 brutto; 2 Stück zu 110 bleiben', usd(rs.sells[0].gross) === '10' && rs.Q === 200000000n && price(rs.E) === '110', usd(rs.sells[0].gross));
p.ev.push(buy('c', T0 + 3 * H, '1', '80')); r = K.lotReplay(p);
check('Eine weitere Einheit zu 80 ergibt 3 Stück zu 100', r.Q === 300000000n && price(r.E) === '100', `${K.qNum(r.Q)} zu ${price(r.E)}`);
const openPnl = (rr, px) => K.rMul(K.rq(rr.side), K.rSub(K.rq(rr.Q * K.decUnits(px, 12)), rr.C)); // offener Brutto-G/V (Einheiten 10⁻²⁰)
check('Bereits realisierte +10 stecken nicht im neuen offenen G/V (bei 110: +30 statt +40)', K.unitsDec(K.rRound(K.rMul(openPnl(r, '110'), K.rq(1n, K.LOT_BASE))), 8) === '30' && usd(r.realized) === '10');
check('Long und Short spiegelbildlich: gleicher Betrag, Gegenvorzeichen bei gleichem Ausstieg', (() => {
  const a = K.lotReplay(pos('long', [buy('a', T0, '3', '110'), sell('s', T0 + H, '1', '125')])), b = K.lotReplay(pos('short', [buy('a', T0, '3', '110'), sell('s', T0 + H, '1', '125')]));
  return a.sells[0].gross === -b.sells[0].gross && usd(a.sells[0].gross) === '15'; })());
check('Kein Hebel auf dem mengenbasierten Ergebnis (Hebel 50 ändert nichts)', usd(K.lotReplay({ ...pos('long', [buy('a', T0, '1', '100'), sell('s', T0 + H, '1', '110')]), leverage: 50 }).sells[0].gross) === '10');

// ---- Restverteilung ----
const L = (id, at, q) => ({ id, at, q: BigInt(q) });
let ks = K.lotShares([L('a', 1, 2), L('b', 2, 1)], 1n);
check('Rest an das neueste Los: 1 aus 2+1 → (0, 1)', ks.join() === '0,1', ks.join());
ks = K.lotShares([L('b', 5, 1), L('a', 5, 1), L('c', 5, 1)], 2n);
check('Gleiche Zeit: Los-ID aufsteigend → a und b je 1, c 0', ks.join() === '1,1,0', ks.join()); // Reihenfolge der Eingabe: b, a, c
ks = K.lotShares([L('a', 1, 1000), L('b', 2, 3)], 500n);
check('Kleinstes neues Los: höchstens eine Zusatzeinheit, nie über das Los hinaus (1000+3, K=500 → 498+2)', ks.join() === '498,2' && ks.every((k, i) => k <= [1000n, 3n][i]), ks.join());
ks = K.lotShares([L('a', 1, 7), L('b', 2, 5), L('c', 3, 1)], 13n);
check('Vollabschluss nimmt alle Einheiten', ks.join() === '7,5,1');
let fuzzOk = true, fuzzWhy = '';
for (let n = 0; n < 4000 && fuzzOk; n++) {
  const m = 1 + (n % 6), lots = Array.from({ length: m }, (_, i) => L('l' + ((i * 7 + n) % m), (i * 13 + n) % 4, 1 + ((n * 31 + i * 17) % 97))), Q = lots.reduce((s, l) => s + l.q, 0n), k = 1n + BigInt(n * 7919) % Q;
  const s = K.lotShares(lots, k), sum = s.reduce((a, b) => a + b, 0n);
  if (sum !== k || s.some((x, i) => x < 0n || x > lots[i].q || x - k * lots[i].q / Q > 1n)) { fuzzOk = false; fuzzWhy = `n=${n} ${s.join()} K=${k}`; }
}
check('4.000 zufällige Fälle: Σk_i = K, 0 ≤ k_i ≤ q_i, höchstens eine Zusatzeinheit je Los', fuzzOk, fuzzWhy);

// ---- Wiederholte Teilabschlüsse: Durchschnitt exakt unverändert, Lose konsistent, Q = 0 am Ende ----
p = pos('long', [buy('a', T0, '0.00000007', '61234.567891'), buy('b', T0 + 1, '0.00000005', '60111.000000000001'), buy('c', T0 + 1, '0.00000001', '62000')]);
r = K.lotReplay(p); const E0 = r.E;
let same = true; for (let i = 1; i <= 12; i++) { p.ev.push(sell('x' + i, T0 + 10 + i, '0.00000001', '61000')); const ri = K.lotReplay(p); if (ri.Q > 0n && (ri.E.n !== E0.n || ri.E.d !== E0.d)) same = false; r = ri; }
check('12 Teilabschlüsse zu je 1 Einheit: Ø-Einstieg als Bruch exakt gleich (keine Neuberechnung aus gerundeten Losen)', same && r.Q === 1n);
check('Lose: offen + geschlossen = ursprünglich, Summe offen = Q', r.lots.every(l => l.q >= 0n && l.q <= l.q0) && r.lots.reduce((s, l) => s + l.q, 0n) === r.Q);
p.ev.push(sell('end', T0 + 100, '0.00000001', '61000')); r = K.lotReplay(p);
check('Vollabschluss: Q = 0, alle Lose 0, Kostenpool 0', r.Q === 0n && r.lots.every(l => l.q === 0n) && r.C.n === 0n && r.E === null && r.sells.at(-1).final);

// ---- Rundung: der Rest läuft über die Summe, nie zusätzlicher Gewinn ----
// Brutto je Abschluss genau 0,000000005 USDT (eine halbe Einheit): einzeln gerundet wäre es 0+0+0 (half-even), über die Summe 0+1+1 = round(1,5) = 2
p = pos('long', [buy('a', T0, '3', '1')]); for (let i = 1; i <= 3; i++) p.ev.push(sell('h' + i, T0 + i, '1', '1.000000005'));
r = K.lotReplay(p);
check('Gebuchtes Brutto über die Summe gerundet: 0 / 1 / 1 Einheiten = gerundete Gesamtsumme', r.sells.map(s => String(s.gross)).join() === '0,1,1' && r.sells.reduce((a, s) => a + s.gross, 0n) === 2n);
p = pos('long', [buy('a', T0, '3', '100')]); p.ev.push(sell('t1', T0 + 1, '1', '100.000000001'), sell('t2', T0 + 2, '1', '100.000000001'), sell('t3', T0 + 3, '1', '100.000000001'));
r = K.lotReplay(p);
check('Drei Drittel: Summe der Buchungen = gerundetes Gesamtergebnis (3 × 0,000000001 → 0,00000000)', r.sells.reduce((a, s) => a + s.gross, 0n) === K.rRound(K.rq(3n * 100000000n * 1000n, K.LOT_BASE)));

// ---- Gebühren genau einmal, Funding getrennt ----
p = pos('long', [buy('a', T0, '2', '100', '1'), buy('b', T0 + H, '1', '130', '0.5'), sell('s1', T0 + 2 * H, '1', '120', { f: '0.2' })]); r = K.lotReplay(p);
check('Teilabschluss bucht Einstiegsgebühren bis dahin (1 + 0,5) und die eigene (0,2): Netto 10 − 1,7 = 8,3', usd(r.sells[0].fees) === '1.7' && usd(r.sells[0].net) === '8.3', `${usd(r.sells[0].fees)} · ${usd(r.sells[0].net)}`);
p.ev.push(sell('s2', T0 + 3 * H, '2', '110', { f: '0.3', fu: '-0.25' })); r = K.lotReplay(p);
check('Schlussabschluss: nur seine eigene Gebühr (0,3), Funding −0,25 getrennt; Einstiegsgebühren nicht noch einmal', usd(r.sells[1].fees) === '0.3' && usd(r.sells[1].fu) === '-0.25' && usd(r.sells[1].net) === '-0.55' && usd(r.realized) === '7.75', `${usd(r.sells[1].fees)} · ${usd(r.sells[1].net)} · gesamt ${usd(r.realized)}`);

// ---- Ergebnis laut Börse: nur dieser Abschluss oder die gesamte Position ----
p = pos('long', [buy('a', T0, '2', '100'), sell('s1', T0 + H, '1', '110'), sell('s2', T0 + 2 * H, '1', '', { net: '25', scope: 'pos' })]); r = K.lotReplay(p);
check('Gesamtergebnis der Position 25 laut Börse: gebucht wird nur die Differenz zu den schon gebuchten +10 → +15', usd(r.sells[1].net) === '15' && usd(r.realized) === '25');
p = pos('long', [buy('a', T0, '2', '100'), sell('s1', T0 + H, '1', '110'), sell('s2', T0 + 2 * H, '1', '', { net: '-4.5' })]); r = K.lotReplay(p);
check('Ergebnis laut Börse nur für diesen Abschluss (−4,5): ersetzt nur seine Rechnung', usd(r.sells[1].net) === '-4.5' && usd(r.realized) === '5.5');

// ---- Übernommener Bestand (ohne Verlauf) ----
const old = { side: 'long', qty: 0.30000000000000004, entry: 60123.4500000001, openedAt: T0 };
const ev0 = K.lotEvents(old);
check('Alte Position: ein übernommener Bestand (keine erfundene Losfolge), Menge auf 10⁻⁸, Preis ohne Binär-Rauschen', ev0.length === 1 && ev0[0].mig && ev0[0].q === '30000000' && ev0[0].p === '60123.4500000001', JSON.stringify(ev0));

// ---- Prüfung gespeicherter Verläufe ----
const ok = K.lotCheck(pos('long', [buy('a', T0, '2', '100'), sell('s', T0 + H, '1', '120')]));
check('Gültiger Verlauf: offen 1 zu 100', ok.ok && ok.qty === 1 && ok.entry === 100);
check('Abschluss vor dem Kauf → abgelehnt', !K.lotCheck(pos('long', [sell('s', T0, '1', '120'), buy('a', T0 + H, '1', '100')])).ok);
check('Abschluss größer als die offene Menge → abgelehnt', !K.lotCheck(pos('long', [buy('a', T0, '1', '100'), sell('s', T0 + H, '2', '120')])).ok);
check('Doppelte Kennung → abgelehnt', !K.lotCheck(pos('long', [buy('a', T0, '1', '100'), buy('a', T0 + H, '1', '100')])).ok);
check('Abschluss ohne Preis und ohne Ergebnis → abgelehnt', !K.lotCheck(pos('long', [buy('a', T0, '2', '100'), sell('s', T0 + H, '1', '')])).ok);
check('Trade: Verlauf muss bei Menge 0 enden', K.lotCheck(pos('long', [buy('a', T0, '1', '100'), sell('s', T0 + H, '1', '120')]), false).ok && !K.lotCheck(pos('long', [buy('a', T0, '2', '100'), sell('s', T0 + H, '1', '120')]), false).ok);
const del = pos('long', [buy('a', T0, '2', '100'), buy('b', T0 + H, '1', '130')], { evDel: ['b'] });
check('Zurückgenommener Schritt (evDel) zählt nicht: 2 zu 100', K.lotCheck(del).qty === 2 && K.lotCheck(del).entry === 100);
check('Eingaben: „1.234,5“ → 1234.5, „0,10“ → 0.1, „−3“ nur mit Vorzeichen erlaubt', K.decStr('1.234,5') === '1234.5' && K.decStr('0,10') === '0.1' && K.decStr('−3') === null && K.decStr('−3', true) === '-3');
check('Mehr als 8 Nachkommastellen bei der Menge → ungültig (keine stille Rundung)', K.decUnits('0.123456789', 8) === null && K.decUnits('0.12345678', 8) === 12345678n);

const bad = results.filter(x => !x.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
