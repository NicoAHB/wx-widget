// 3.84.0 – Schlüssel-Levels (shared/key-levels.mjs): Vortag/Vorwoche, Eröffnungen, Handelssitzungen. Aufruf: node unit-key-levels.js
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
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})();
