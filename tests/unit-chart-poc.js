// Sichtbarer POC-Zeitraum: echte Kerzenabdeckung statt einer Verwechslung mit dem Kerzenintervall.
const assert = require('node:assert/strict');
const { pocWindow } = require('../shared/chart-poc.mjs');
const { intervalEnd } = require('../shared/market-intervals.mjs');
let pass = 0, fail = 0;
const check = (name, test) => { try { test(); pass++; console.log('✓ ' + name); } catch (e) { fail++; console.error('✗ ' + name + ' — ' + e.message); } };
const begin = Date.UTC(2026, 9, 23);
const rows = (n, iv, start = begin) => {
  const out = [];
  for (let i = 0, time = start; i < n; i++) {
    const end = intervalEnd(time, iv);
    out.push({ time, closeTime: end - 1 });
    time = end;
  }
  return out;
};
for (const [n, iv, label] of [[60, '1m', '1 Std.'], [80, '1m', '1 Std. 20 Min.'], [24, '1h', '1 Tag'], [7, '1d', '1 Woche'], [80, '1h', '3 Tage 8 Std.'], [80, '1d', '80 Tage'], [80, '1w', '80 Wochen']]) {
  check(`${n} × ${iv}: ${label}`, () => assert.equal(pocWindow(rows(n, iv), iv).label, label));
}
check('Die letzte sichtbare Kerze zählt genau einmal, einschließlich laufender Kerzen', () => {
  const r = rows(80, '1m'), p = pocWindow(r, '1m');
  assert.equal(p.minutes, 80);
  assert.equal(p.start, r[0].time);
  assert.equal(p.end, r.at(-1).closeTime + 1);
});
check('Zurückgeblätterter Ausschnitt verwendet seine eigenen Grenzen', () => {
  const r = rows(150, '1h').slice(10, 34), p = pocWindow(r, '1h');
  assert.equal(p.label, '1 Tag');
  assert.equal(p.start, begin + 10 * 36e5);
});
check('Feinere Detail-Kerzen: 24 Stunden bleiben ein Tag, nicht eine Stunde', () => assert.equal(pocWindow(rows(288, '5m'), '5m').label, '1 Tag'));
check('Monatsgrenzen folgen dem Kalender, nicht einem festen 30-Tage-Wert', () => {
  assert.equal(pocWindow(rows(1, '1M', Date.UTC(2024, 1, 1)), '1M').label, '29 Tage');
  assert.equal(pocWindow([{ time: Date.UTC(2026, 1, 1) }], '1M').label, '4 Wochen');
});
check('Zeitumstellung verändert die UTC-Kerzenabdeckung nicht', () => assert.equal(pocWindow(rows(24, '1h', Date.UTC(2026, 9, 25)), '1h').label, '1 Tag'));
check('Leere oder ungültige Kerzen liefern keine erfundenen Zeitwerte', () => {
  for (const r of [[], null, [{ time: NaN }], [{ time: begin }, { time: begin - 36e5, closeTime: begin - 1 }]]) assert.equal(pocWindow(r, 'unbekannt'), null);
});
check('Vorhandene Börsen-Schlusszeit hat Vorrang vor dem nominellen Intervall', () => assert.equal(pocWindow(rows(12, '5m'), '1d').label, '1 Std.'));
check('Kerzen und Schlusszeiten bleiben unverändert', () => {
  const r = rows(80, '1m'), copy = structuredClone(r);
  pocWindow(r, '1m'); assert.deepEqual(r, copy);
});
console.log(`${pass}/${pass + fail} bestanden`);
process.exitCode = fail ? 1 : 0;
