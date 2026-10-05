// 3.31.0 (G03) – Rechenkern Kontostand, Kontrollstände, Euro je Buchung, Auswertung je Position, ohne Browser. Lädt die Blöcke
// „G02-Kern“ und „G03-Kern“ aus der App und prüft das Beispiel der Übergabe (1.000 + 20, Kontrollstand 1.050, Nachträge +30 / +12,
// danach −10), mehrere Anker, unbekannten Vorstand, Nullstand, gleiche Zeiten, Zeiträume, Euro auf Cent und die Gruppierung je Position.
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'weather-widget-v2.html'), 'utf8');
const block = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b); if (i < 0 || j < 0) throw new Error(a + ' nicht gefunden'); return html.slice(i, j); };
const src = block('// ==== G02-Kern Anfang', '// ==== G02-Kern Ende') + block('// ==== G03-Kern Anfang', '// ==== G03-Kern Ende');
const K = new Function(src + '\nreturn { acctU, acctBookings, acctProject, acctAt, acctPeriod, eurOf, eurSum, fxFits, fxFromKlines, posResults, unitsDec, FX_MAX_AGE };')();
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + detail : ''}`); };
const D = u => u === null ? 'null' : K.unitsDec(u, 8);
const T0 = Date.UTC(2026, 9, 1, 8), H = 3600e3;
const trade = (id, at, pnl, more = {}) => ({ id, closedAt: at, openedAt: at - H, pnl, symbol: 'SOLUSDT', side: 'long', ...more });
const anchor = (id, at, amount, more = {}) => ({ id, type: 'cp', at, amount, createdAt: at, ...more });
const start = (id, at, amount) => anchor(id, at, amount, { type: 'start' });
const proj = (anchors, trades, mv = []) => K.acctProject(anchors, K.acctBookings(trades, mv));

// ---- Beispiel der Übergabe ----
const A = [start('s', T0, '1000'), anchor('k', T0 + 2 * H, '1050')];
let P = proj(A, [trade('t1', T0 + H, 20)]);
check('1.000 + 20 = 1.020; Kontrollstand 1.050 → Korrektur +30, Stand 1.050', D(P.anchors[1].before) === '1020' && D(P.anchors[1].corr) === '30' && D(P.booked) === '1050', `${D(P.anchors[1].before)} → ${D(P.anchors[1].corr)} → ${D(P.booked)}`);
P = proj(A, [trade('t1', T0 + H, 20), trade('t0', T0 + 1.5 * H, 30)]);
check('Vergessenen früheren Trade +30 nachgetragen: Stand bleibt 1.050, Korrektur wird 0', D(P.booked) === '1050' && D(P.anchors[1].corr) === '0');
P = proj(A, [trade('t1', T0 + H, 20), trade('t0', T0 + 1.5 * H, 12)]);
check('Nachtrag nur +12: Korrektur bleibt +18', D(P.anchors[1].corr) === '18' && D(P.booked) === '1050');
P = proj(A, [trade('t1', T0 + H, 20), trade('t0', T0 + 1.5 * H, 12), trade('t3', T0 + 3 * H, -10)]);
check('Danach neuer Trade −10: 1.040', D(P.booked) === '1040');
check('Korrektur ist keine Buchung: nur 3 Trades als Schritte, der Kontrollstand als Anker', P.steps.filter(s => s.b).length === 3 && P.steps.filter(s => s.anchor).length === 2);

// ---- Start: frühere Buchungen sind enthalten ----
P = proj([start('s', T0, '500')], [trade('a', T0 - H, 99), trade('b', T0, 7), trade('c', T0 + H, 5)]);
check('Startwert gilt nach allen bis dahin gebuchten Trades (auch zur selben Zeit): 500 + 5', D(P.booked) === '505' && P.pre.length === 2, D(P.booked));
P = proj([], [trade('a', T0, 10)]);
check('Ohne Startwert kein Kontostand (null), nichts erfunden', P.booked === null && P.first === null);

// ---- Buchung genau zum Kontrollzeitpunkt kommt vorher ----
P = proj([start('s', T0, '1000'), anchor('k', T0 + H, '1000')], [trade('a', T0 + H, 40)]);
check('Buchung genau zum Kontrollzeitpunkt zählt vor dem Anker: Korrektur −40, Stand 1.000', D(P.anchors[1].corr) === '-40' && D(P.booked) === '1000');

// ---- Mehrere Anker chronologisch, unabhängig von der Eingabereihenfolge ----
P = proj([anchor('k2', T0 + 4 * H, '1200', { createdAt: T0 }), start('s', T0, '1000'), anchor('k1', T0 + 2 * H, '1100', { createdAt: T0 + 9 * H })], [trade('a', T0 + H, 50), trade('b', T0 + 3 * H, 30), trade('c', T0 + 5 * H, -20)]);
check('Mehrere Kontrollstände chronologisch: +50 → Korrektur +50; +30 → Korrektur +70; −20 → 1.180', D(P.anchors[1].corr) === '50' && D(P.anchors[2].corr) === '70' && D(P.booked) === '1180', P.anchors.map(a => D(a.corr)).join(' / '));

// ---- Unbekannter Vorstand ----
P = proj([start('s', T0, '1000'), anchor('k', T0 + 2 * H, '700', { prior: 'unknown' })], [trade('a', T0 + H, 20), trade('b', T0 + 3 * H, 5)]);
check('Vorstand unbekannt: Zielwert gilt als neuer Anker, Differenz nicht bestimmbar (null)', P.anchors[1].st === 'unknown' && P.anchors[1].corr === null && D(P.booked) === '705');
let Q = K.acctPeriod(P, T0 + 0.5 * H, T0 + 4 * H);
check('Zeitraum über einen Anker mit unbekanntem Vorstand: keine Änderung, keine Prozentzahl', Q.change === null && Q.pct === null && Q.unknown === 1 && D(Q.trade) === '25');

// ---- Null ist erlaubt ----
P = proj([start('s', T0, '0'), anchor('k', T0 + 2 * H, '0')], [trade('a', T0 + H, 15)]);
check('Startwert 0 und Kontrollstand 0 sind gültig (Korrektur −15)', D(P.anchors[0].target) === '0' && D(P.anchors[1].corr) === '-15' && D(P.booked) === '0');
Q = K.acctPeriod(P, T0, T0 + 1.5 * H);
check('Anfangsstand 0: Änderung +15, aber keine Prozentzahl', D(Q.change) === '15' && Q.pct === null);

// ---- Gleiche Zeit ----
P = proj([start('s', T0, '1000'), anchor('k1', T0 + H, '1100', { createdAt: 1 }), anchor('k2', T0 + H, '1100', { createdAt: 2 })], []);
check('Gleiche Zeit, gleicher Zielstand: wirkt einmal (dup)', P.anchors[2].st === 'dup' && D(P.booked) === '1100');
P = proj([start('s', T0, '1000'), anchor('k1', T0 + H, '1100', { createdAt: 1 }), anchor('k2', T0 + H, '1300', { createdAt: 2 })], []);
check('Gleiche Zeit, anderer Zielstand: widersprüchlich (clash), der zuerst erfasste wirkt', P.anchors[2].st === 'clash' && P.anchors[2].with === 'k1' && D(P.booked) === '1100');

// ---- Zurückgenommen ----
P = proj([start('s', T0, '1000'), anchor('k', T0 + 2 * H, '1050', { off: { at: T0 + 5 * H } })], [trade('a', T0 + H, 20)]);
check('Zurückgenommener Kontrollstand wirkt nicht mehr (1.020)', D(P.booked) === '1020' && P.anchors.length === 1);

// ---- Geldbewegungen ----
P = K.acctProject([start('s', T0, '1000')], K.acctBookings([], [
  { id: 'd', type: 'deposit', amount: 100, currency: 'USDT', date: T0 + H }, { id: 'p', type: 'payout', amount: 50, currency: 'EUR', fx: 1.2, date: T0 + 2 * H },
  { id: 'x', type: 'tax', amount: 10, currency: 'USDT', date: T0 + 3 * H }, { id: 'k', type: 'keep', amount: 999, currency: 'USDT', date: T0 + 3 * H }]));
check('Einzahlung +100, Auszahlung 50 € × 1,2 = −60, Steuer-Rücklage −10, „im Guthaben gelassen“ ohne Wirkung: 1.030', D(P.booked) === '1030', D(P.booked));
P = K.acctProject([start('s', T0, '1000')], K.acctBookings([], [{ id: 'd', type: 'deposit', amount: 100, currency: 'EUR', fx: null, date: T0 + H }], null));
check('Einzahlung in EUR ohne jeden Kurs: Betrag unbekannt – Stand unvollständig (gap), Änderung nicht bestimmbar', P.gap === 1 && K.acctPeriod(P, T0 - H, T0 + 2 * H).change === null);
P = K.acctProject([start('s', T0, '1000')], K.acctBookings([], [{ id: 'd', type: 'deposit', amount: 100, currency: 'EUR', fx: null, date: T0 + H }], 1.1));
check('Einzahlung in EUR ohne eigenen Kurs, mit aktuellem Kurs: gerechnet, aber als Näherung markiert', D(P.booked) === '1110' && P.steps[1].b.approx === true);

// ---- Zeitraum ----
P = proj([start('s', T0, '1000')], [trade('a', T0 + H, 50), trade('b', T0 + 3 * H, -20)], [{ id: 'd', type: 'deposit', amount: 200, currency: 'USDT', date: T0 + 2 * H }]);
Q = K.acctPeriod(P, T0 + 0.5 * H, T0 + 4 * H);
check('Zeitraum: Anfang 1.000, Ende 1.230, Änderung +230 = Handel +30 + Einzahlung +200; +23 %', D(Q.start) === '1000' && D(Q.end) === '1230' && D(Q.change) === '230' && D(Q.trade) === '30' && D(Q.dep) === '200' && Q.pct === 23, `${D(Q.change)} · ${Q.pct} %`);
Q = K.acctPeriod(P, T0 - 5 * H, T0 + 4 * H);
check('Zeitraum beginnt vor dem Startwert: Historie unvollständig, keine Änderung und keine Prozentzahl', Q.start === null && Q.change === null && Q.pct === null);
Q = K.acctPeriod(P, T0 + H, T0 + H);
check('Grenzen einschließlich: Buchung genau am Anfang und am Ende zählt', D(Q.trade) === '50' && D(Q.change) === '50');
P = proj([start('s', T0, '1000'), anchor('k', T0 + 2 * H, '1100')], [trade('a', T0 + H, 20), trade('b', T0 + 3 * H, 10)]);
Q = K.acctPeriod(P, T0 + 0.5 * H, T0 + 4 * H);
check('Korrekturen getrennt vom Handelsergebnis: Handel +30, Korrektur +80, Änderung +110', D(Q.trade) === '30' && D(Q.corr) === '80' && D(Q.change) === '110');

// ---- Genauigkeit ----
P = proj([start('s', T0, '0.1')], [trade('a', T0 + H, 0.2)]);
check('0,1 + 0,2 = 0,3 genau (ohne Fließkomma-Rest)', D(P.booked) === '0.3');

// ---- Euro je Buchung ----
check('10 USDT bei 1,17 USDT je EUR = 8,55 € (8,547 → Cent)', K.eurOf(10, 1.17) === 8.55);
check('Half-even auf Cent: 0,05 USDT / 10 = 0,005 € → 0,00; 0,15 / 10 = 0,015 € → 0,02', K.eurOf(0.05, 10) === 0 && K.eurOf(0.15, 10) === 0.02);
check('Negativ: −12,34 USDT bei 1,2 = −10,28 €', K.eurOf(-12.34, 1.2) === -10.28, K.eurOf(-12.34, 1.2));
check('Ohne gültigen Kurs kein Eurobetrag (null statt 0)', K.eurOf(10, null) === null && K.eurOf(10, 0) === null && K.eurOf(10, -1) === null);
check('EUR-Gesamt einer Position = Summe der eingefrorenen Buchungen (Teilabschluss bei 1,10, Schluss bei 1,25)', K.eurSum([K.eurOf(11, 1.1), K.eurOf(25, 1.25)]) === 30 && K.eurSum([0.1, 0.2]) === 0.3);
check('Gleiche Summe nach späterem Kursanstieg: eingefroren (nicht 36 USDT / 1,25 = 28,80)', K.eurSum([10, 20]) === 30 && K.eurOf(36, 1.25) === 28.8);

// ---- Gültigkeit eines Kurses ----
check('Kurs höchstens 5 Minuten vor dem Ereignis gilt', K.fxFits(T0 - 299e3, T0) && K.fxFits(T0, T0));
check('Kurs älter als 5 Minuten oder nach dem Ereignis (zukünftig) gilt nicht', !K.fxFits(T0 - 301e3, T0) && !K.fxFits(T0 + 1, T0) && !K.fxFits(NaN, T0));
const kl = [[T0 - 3 * 60e3, '1', '1', '1', '1.1700'], [T0 - 2 * 60e3, '1', '1', '1', '1.1710'], [T0 - 60e3, '1', '1', '1', '1.1720'], [T0, '1', '1', '1', '1.1730']];
let f = K.fxFromKlines(kl, T0 + 30e3);
check('1-Minuten-Kerze: die letzte vor dem Ereignis geschlossene (nicht die laufende)', f && f.fx === 1.172 && f.at === T0, JSON.stringify(f));
f = K.fxFromKlines(kl, T0 + 60e3);
check('Ereignis genau am Kerzenende: diese Kerze gilt', f && f.fx === 1.173);
check('Alle Kerzen älter als 5 Minuten: kein Kurs', K.fxFromKlines(kl, T0 + 10 * 60e3) === null);

// ---- Auswertung je Position ----
const part = (pid, sid, at, pnl, n) => trade(`${pid}~${sid}`, at, pnl, { part: { pos: pid, sell: sid, n, rest: 1 } });
const fin = (pid, at, pnl, n) => trade(pid, at, pnl, { part: { pos: pid, sell: 'z', n, final: true } });
let R = K.posResults([part('p', 's1', T0 + H, 10, 1), fin('p', T0 + 3 * H, -5, 2), trade('q', T0 + 2 * H, 7), part('o', 's1', T0 + H, 4, 1), part('g', 's1', T0 + H, 3, 1)], id => id === 'o');
const pr = R.done.find(x => x.id === 'p');
check('Position mit +10 im Teilabschluss und −5 beim Schluss zählt als ein Gewinn +5', pr && pr.pnl === 5 && pr.n === 2 && pr.closedAt === T0 + 3 * H);
check('Einfacher Trade bleibt ein Ergebnis; Teilabschluss einer offenen Position nicht gezählt (open)', R.done.some(x => x.id === 'q' && x.pnl === 7) && R.open.length === 1 && R.open[0].id === 'o');
check('Gelöschte Position ohne Schluss: mit ihrem letzten Teilabschluss abgeschlossen', R.done.some(x => x.id === 'g' && x.pnl === 3));
R = K.posResults([part('p', 'a', T0, 0.1, 1), part('p', 'b', T0 + H, 0.2, 2), fin('p', T0 + 2 * H, 0.4, 3)]);
check('Summe der Buchungen genau: 0,1 + 0,2 + 0,4 = 0,7', R.done[0].pnl === 0.7);

const ok = results.filter(r => r.ok).length;
console.log(`\n${ok}/${results.length} bestanden`);
process.exit(ok === results.length ? 0 : 1);
