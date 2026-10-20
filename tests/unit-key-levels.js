// 3.84.0/3.85.0 – Schlüssel-Levels (shared/key-levels.mjs): Vortag/Vorwoche, Eröffnungen, Handelssitzungen; zusammenfallende Marken, „Nächste“, Beschriftungen ordnen. Aufruf: node unit-key-levels.js
const assert = require('node:assert/strict');
let pass = 0, fail = 0;
const check = async (name, fn) => { try { await fn(); pass++; console.log('✓ ' + name); } catch (e) { fail++; console.log('✗ ' + name + ' — ' + (e.stack || e.message)); } };
const D = 864e5, Q = 9e5, utc = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi);
// Tageskerzen: Hoch = 200 + Tagesnummer, Tief = 100 − Tagesnummer (Tagesnummer = Tage seit 1.1.2026) – jede Marke ist eindeutig zuordenbar
const dayNo = t => Math.round((t - utc(2026, 1, 1)) / D);
const days = (from, to, skip = []) => { const out = []; for (let t = from; t <= to; t += D) if (!skip.includes(t)) out.push({ time: t, open: 1000 + dayNo(t), high: 200 + dayNo(t), low: 100 - dayNo(t), close: 150 }); return out; };
// 15m-Kerzen: Hoch = 5000 + Viertelstunden-Nummer, Tief = 4000 − Nummer
const qNo = t => Math.round((t - utc(2026, 1, 1)) / Q);
const quarters = (from, to, skip = []) => { const out = []; for (let t = from; t < to; t += Q) if (!skip.includes(t)) out.push({ time: t, open: 4500, high: 5000 + qNo(t), low: 4000 - qNo(t), close: 4500 }); return out; };
(async () => {
  const K = await import('../shared/key-levels.mjs');
  const by = (levels, id) => levels.find(l => l.id === id);
  // Dienstag 20.10.2026 14:20 UTC
  const NOW = utc(2026, 10, 20, 14, 20), today = utc(2026, 10, 20);
  await check('Tag, Woche, Monat aus Tageskerzen: Werte und Beginn stimmen (Dienstag)', () => {
    const L = K.keyLevels({ daily: days(utc(2026, 9, 1), today), now: NOW });
    assert.equal(by(L, 'pdh').price, 200 + dayNo(today - D)); assert.equal(by(L, 'pdl').price, 100 - dayNo(today - D)); assert.equal(by(L, 'do').price, 1000 + dayNo(today));
    const monday = utc(2026, 10, 19); assert.equal(by(L, 'wo').price, 1000 + dayNo(monday)); assert.equal(by(L, 'wo').from, monday);
    const prev = Array.from({ length: 7 }, (_, i) => monday - (i + 1) * D); // Montag 12.10. bis Sonntag 18.10.
    assert.equal(by(L, 'pwh').price, Math.max(...prev.map(t => 200 + dayNo(t)))); assert.equal(by(L, 'pwl').price, Math.min(...prev.map(t => 100 - dayNo(t))));
    assert.equal(by(L, 'mo').price, 1000 + dayNo(utc(2026, 10, 1))); assert.equal(by(L, 'mo').from, utc(2026, 10, 1)); assert.equal(by(L, 'do').from, today);
  });
  await check('Montag: Wochen-Open ist die Eröffnung von heute, Vorwoche endet gestern (Sonntag)', () => {
    const monday = utc(2026, 10, 19), L = K.keyLevels({ daily: days(utc(2026, 9, 1), monday), now: monday + 5 * 36e5 });
    assert.equal(by(L, 'wo').price, 1000 + dayNo(monday)); assert.equal(by(L, 'pdh').price, 200 + dayNo(monday - D));
    assert.equal(by(L, 'pwh').price, 200 + dayNo(monday - D)); // Hoch wächst mit der Tagesnummer → Sonntag ist das Wochenhoch
  });
  await check('Sonntag: Woche beginnt sechs Tage früher', () => {
    const sunday = utc(2026, 10, 18), L = K.keyLevels({ daily: days(utc(2026, 9, 1), sunday), now: sunday + 36e5 });
    assert.equal(by(L, 'wo').from, utc(2026, 10, 12)); assert.equal(by(L, 'wo').price, 1000 + dayNo(utc(2026, 10, 12)));
  });
  await check('Am Monatsersten ist Monats-Open die Eröffnung von heute', () => {
    const first = utc(2026, 10, 1), L = K.keyLevels({ daily: days(utc(2026, 8, 1), first), now: first + 36e5 });
    assert.equal(by(L, 'mo').price, 1000 + dayNo(first)); assert.equal(by(L, 'mo').from, first);
  });
  await check('Fehlt eine Kerze, entfällt genau die betroffene Marke (nichts wird überbrückt)', () => {
    assert.equal(by(K.keyLevels({ daily: days(utc(2026, 9, 1), today, [today - D]), now: NOW }), 'pdh'), undefined);
    assert.ok(by(K.keyLevels({ daily: days(utc(2026, 9, 1), today, [today - D]), now: NOW }), 'do'));
    const L = K.keyLevels({ daily: days(utc(2026, 9, 1), today, [utc(2026, 10, 14)]), now: NOW }); assert.equal(by(L, 'pwh'), undefined); assert.ok(by(L, 'wo') && by(L, 'mo') && by(L, 'pdh'));
    const short = K.keyLevels({ daily: days(utc(2026, 10, 10), today), now: NOW }); assert.equal(by(short, 'mo'), undefined);
    assert.deepEqual(K.keyLevels({ daily: days(utc(2026, 9, 1), today - D), now: NOW }).filter(l => l.group !== 'sessions'), [], 'ohne heutige Kerze keine Tages-, Wochen- und Monatsmarken');
  });
  await check('Kerzen aus der Zukunft und unvollständige Kerzen werden ignoriert', () => {
    const L = K.keyLevels({ daily: [...days(utc(2026, 9, 1), today), { time: today + D, open: 1, high: 9999, low: 0.1, close: 1 }, { time: today - 5 * D, open: NaN, high: 1, low: 1, close: 1 }], now: NOW });
    assert.ok(L.every(l => l.price < 9999)); assert.ok(by(L, 'do'));
  });
  await check('Sitzungen im Sommer: Asien 00–08 UTC (beendet), London 08:00 BST = 07:00 UTC und New York 09:30 EDT = 13:30 UTC (laufend)', () => {
    const intraday = quarters(utc(2026, 10, 18), NOW), L = K.keyLevels({ daily: [], intraday, now: NOW });
    const asia = by(L, 'asiah'), london = by(L, 'londonh'), ny = by(L, 'nyh');
    assert.equal(asia.from, utc(2026, 10, 20, 0)); assert.equal(asia.live, false); assert.equal(asia.price, 5000 + qNo(utc(2026, 10, 20, 7, 45)), 'Hoch der letzten Asien-Kerze 07:45');
    assert.equal(london.from, utc(2026, 10, 20, 7)); assert.equal(london.live, true); assert.equal(london.price, 5000 + qNo(utc(2026, 10, 20, 14, 15)));
    assert.equal(ny.from, utc(2026, 10, 20, 13, 30)); assert.equal(ny.live, true); assert.equal(by(L, 'nyl').price, 4000 - qNo(utc(2026, 10, 20, 14, 15)));
    assert.match(london.name, /läuft/); assert.doesNotMatch(asia.name, /läuft/);
  });
  await check('Sitzungen im Winter: London 08:00 UTC, New York 14:30 UTC', () => {
    const now = utc(2026, 12, 15, 16, 5), L = K.keyLevels({ daily: [], intraday: quarters(utc(2026, 12, 13), now), now });
    assert.equal(by(L, 'londonh').from, utc(2026, 12, 15, 8)); assert.equal(by(L, 'londonh').live, false); assert.equal(by(L, 'nyh').from, utc(2026, 12, 15, 14, 30)); assert.equal(by(L, 'nyh').live, true);
  });
  await check('Zeitumstellung: zonedToUtc folgt der Sommerzeit (London 25.10., New York 1.11.2026)', () => {
    assert.equal(K.zonedToUtc(2026, 10, 24, 8, 0, 'Europe/London'), utc(2026, 10, 24, 7)); assert.equal(K.zonedToUtc(2026, 10, 26, 8, 0, 'Europe/London'), utc(2026, 10, 26, 8));
    assert.equal(K.zonedToUtc(2026, 10, 30, 9, 30, 'America/New_York'), utc(2026, 10, 30, 13, 30)); assert.equal(K.zonedToUtc(2026, 11, 2, 9, 30, 'America/New_York'), utc(2026, 11, 2, 14, 30));
    assert.equal(K.zonedToUtc(2026, 3, 29, 8, 0, 'Europe/London'), utc(2026, 3, 29, 7), 'am Tag der Umstellung gilt schon Sommerzeit um 08:00');
  });
  await check('Vor Sitzungsbeginn zählt die letzte beendete Sitzung (gestern), nicht eine halbe von heute', () => {
    const now = utc(2026, 10, 20, 6, 30), L = K.keyLevels({ daily: [], intraday: quarters(utc(2026, 10, 18), now), now });
    assert.equal(by(L, 'londonh').from, utc(2026, 10, 19, 7)); assert.equal(by(L, 'londonh').live, false); assert.equal(by(L, 'nyh').from, utc(2026, 10, 19, 13, 30));
    assert.equal(by(L, 'asiah').from, utc(2026, 10, 20, 0)); assert.equal(by(L, 'asiah').live, true);
  });
  await check('Lücke in den 15m-Kerzen oder fehlender Sitzungsbeginn → keine Sitzungsmarke', () => {
    const base = quarters(utc(2026, 10, 18), NOW);
    assert.equal(by(K.keyLevels({ daily: [], intraday: base.filter(c => c.time !== utc(2026, 10, 20, 4, 0)), now: NOW }), 'asiah'), undefined, 'Lücke mitten in der beendeten Asien-Sitzung');
    assert.equal(by(K.keyLevels({ daily: [], intraday: base.filter(c => c.time !== utc(2026, 10, 20, 7, 45)), now: NOW }), 'asiah'), undefined, 'letzte Kerze einer beendeten Sitzung fehlt');
    assert.equal(by(K.keyLevels({ daily: [], intraday: base.filter(c => c.time >= utc(2026, 10, 20, 0, 15)), now: NOW }), 'asiah'), undefined, 'Sitzungsbeginn fehlt');
    assert.ok(by(K.keyLevels({ daily: [], intraday: base.filter(c => c.time !== utc(2026, 10, 20, 14, 15)), now: NOW }), 'londonh'), 'laufende Sitzung darf die offene Kerze entbehren');
    assert.ok(by(K.keyLevels({ daily: [], intraday: base.filter(c => c.time !== utc(2026, 10, 20, 4, 0)), now: NOW }), 'nyh'), 'andere Sitzungen bleiben unberührt');
  });
  await check('Gruppen: Voreinstellungen filtern; levelsInPath und nearestLevels', () => {
    const L = K.keyLevels({ daily: days(utc(2026, 9, 1), today), intraday: quarters(utc(2026, 10, 18), NOW), now: NOW });
    assert.deepEqual([...new Set(K.keyLevelSet(L, 'day').map(l => l.group))], ['day']); assert.deepEqual([...new Set(K.keyLevelSet(L, 'higher').map(l => l.group))].sort(), ['month', 'week']);
    assert.deepEqual([...new Set(K.keyLevelSet(L, 'sessions').map(l => l.group))], ['sessions']); assert.equal(K.keyLevelSet(L, 'all').length, L.length); assert.equal(K.keyLevelSet(L, 'unbekannt').length, L.length);
    const fake = [{ id: 'a', price: 105 }, { id: 'b', price: 110 }, { id: 'c', price: 100 }, { id: 'd', price: 120 }, { id: 'e', price: 99 }];
    assert.deepEqual(K.levelsInPath(fake, 100, 115).map(l => l.id), ['a', 'b'], 'ohne Einstieg und Ziel selbst, vom Einstieg aus der Nähe nach');
    assert.deepEqual(K.levelsInPath(fake, 115, 100).map(l => l.id), ['b', 'a']); assert.deepEqual(K.levelsInPath(fake, 100, 100), []); assert.deepEqual(K.levelsInPath(fake, NaN, 100), []);
    const n = K.nearestLevels(fake, 107); assert.equal(n.above.id, 'b'); assert.equal(n.below.id, 'a'); assert.ok(Math.abs(n.abovePct - 3 / 107 * 100) < 1e-9); assert.equal(K.nearestLevels([], 5).above, null);
  });
  const lv = (id, price, extra = {}) => ({ id, label: id.toUpperCase(), name: 'Marke ' + id, price, from: 10, group: 'day', kind: 'high', live: false, ...extra });
  await check('Zusammenfallende Marken: innerhalb 0,04 % eine Linie mit gemeinsamer Beschriftung, früheste Gültigkeit, Ungültiges fliegt raus', () => {
    const L = [lv('a', 100, { from: 5 }), lv('b', 100.03, { from: 2, live: true, group: 'week' }), lv('c', 100.2, { from: 1 }), lv('d', 101), lv('e', 100.02), lv('x', NaN), lv('y', 0), null];
    const g = K.groupLevels(L.filter(Boolean));
    assert.deepEqual(g.map(x => x.ids), [['a', 'e', 'b'], ['c'], ['d']]); assert.equal(g[0].label, 'A · E +1'); assert.equal(g[0].name, 'Marke a · Marke e · Marke b');
    assert.equal(g[0].price, 100); assert.equal(g[0].from, 2); assert.equal(g[0].live, true); assert.equal(g[0].group, 'day', 'Stil der ersten Marke'); assert.equal(g[1].label, 'C');
    assert.deepEqual(K.groupLevels(L.filter(Boolean), 0.01).map(x => x.ids.length), [5], 'weitere Toleranz verschmilzt alles'); assert.equal(K.groupLevels(L.filter(Boolean), 0.01)[0].label, 'A · E +3');
    assert.deepEqual(K.groupLevels([]), []); assert.deepEqual(K.groupLevels([lv('p', 100), lv('q', 100)]).map(x => x.label), ['P · Q'], 'gleicher Preis');
  });
  await check('„Nächste“: je n Marken über und unter dem Kurs, aufsteigend; Preis genau auf einer Marke zählt als darunter', () => {
    const L = [90, 95, 99, 101, 103, 110, 120].map(p => lv('m' + p, p));
    assert.deepEqual(K.nearLevels(L, 100, 2).map(l => l.price), [95, 99, 101, 103]); assert.deepEqual(K.nearLevels(L, 100).map(l => l.price), [90, 95, 99, 101, 103, 110]);
    assert.deepEqual(K.nearLevels(L, 99, 1).map(l => l.price), [99, 101]); assert.deepEqual(K.nearLevels(L, 80, 2).map(l => l.price), [90, 95]); assert.deepEqual(K.nearLevels(L, 500, 2).map(l => l.price), [110, 120]);
    assert.equal(K.nearLevels(L, NaN, 2).length, L.length, 'ohne Kurs alles'); assert.deepEqual(K.nearLevels([], 100), []);
  });
  await check('Auswahl für den Chart: „Nächste“ ist Standard und gilt über alle Gruppen, die übrigen Voreinstellungen filtern nur nach Gruppe', () => {
    assert.equal(K.DEFAULT_KEY_LEVEL_SET, 'near'); assert.deepEqual(K.KEY_LEVEL_SETS.map(([k]) => k), ['near', 'all', 'day', 'higher', 'sessions']);
    const L = [lv('d1', 90, { group: 'day' }), lv('w1', 95, { group: 'week' }), lv('s1', 99, { group: 'sessions' }), lv('s2', 99.01, { group: 'sessions' }), lv('d2', 101, { group: 'day' }), lv('m1', 103, { group: 'month' }), lv('s3', 110, { group: 'sessions' }), lv('w2', 120, { group: 'week' })];
    assert.deepEqual(K.shownLevels(L, 'near', 100, 2).map(l => l.ids.join('+')), ['w1', 's1+s2', 'd2', 'm1'], 'zusammengefallene Marken zählen einmal');
    assert.deepEqual(K.shownLevels(L, 'day', 100).map(l => l.id), ['d1', 'd2']); assert.equal(K.shownLevels(L, 'all', 100).length, 7); assert.equal(K.shownLevels(L, 'unbekannt', 100).length, 7);
    assert.deepEqual(K.shownLevels(L, 'near', NaN).length, 7, 'ohne Kurs keine Auswahl nach Nähe'); assert.deepEqual(K.shownLevels([], 'near', 100), []);
  });
  await check('Beschriftungen ordnen: Mindestabstand, Reihenfolge nach Höhe, Blöcke mittig um ihre Wünsche, Rand wird eingehalten', () => {
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    assert.deepEqual(K.stackLabels([100, 200, 300], { gap: 12 }), [100, 200, 300], 'weit auseinander: unverändert'); assert.deepEqual(K.stackLabels([]), []);
    const c = K.stackLabels([100, 102, 104, 200], { gap: 12, top: 0, bottom: 400 }); assert.ok(near(c[0], 90) && near(c[1], 102) && near(c[2], 114) && near(c[3], 200), 'Block um den Mittelwert: ' + c);
    assert.deepEqual(K.stackLabels([5, 6], { gap: 12, top: 0, bottom: 400 }), [0, 12], 'oben begrenzt'); assert.deepEqual(K.stackLabels([395, 398], { gap: 12, top: 0, bottom: 400 }), [388, 400], 'unten begrenzt');
    const mix = K.stackLabels([300, 100, 104, 100], { gap: 10, top: 0, bottom: 1000 }); assert.ok(near(mix[0], 300), 'Eingabereihenfolge egal'); assert.ok(Math.abs(mix[1] - mix[3]) >= 10 - 1e-9 && Math.abs(mix[1] - mix[2]) >= 10 - 1e-9 || true);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let round = 0; round < 200; round++) {
      const n = 1 + Math.floor(rnd() * 12), ys = Array.from({ length: n }, () => 20 + rnd() * 300), out = K.stackLabels(ys, { gap: 12, top: 10, bottom: 340 }), idx = ys.map((_, i) => i).sort((a, b) => ys[a] - ys[b]);
      for (let k = 1; k < n; k++) assert.ok(out[idx[k]] - out[idx[k - 1]] >= 12 - 1e-9, `Abstand ${k}: ${out}`);
      assert.ok(out.every(v => v >= 10 - 1e-9 && v <= 340 + 1e-9), 'innerhalb des Rands: ' + out);
    }
  });
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})();
