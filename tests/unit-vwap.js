// 3.84.0 – VWAP (shared/vwap.mjs): Rechenwerte, Anker, Lücken, Perioden. Aufruf: node unit-vwap.js
const assert = require('node:assert/strict');
let pass = 0, fail = 0;
const check = async (name, fn) => { try { await fn(); pass++; console.log('✓ ' + name); } catch (e) { fail++; console.log('✗ ' + name + ' — ' + (e.stack || e.message)); } };
const utc = (y, m, d, h = 0, mi = 0) => Date.UTC(y, m - 1, d, h, mi), H = 36e5, Q = 9e5, near = (a, b, e = 1e-9) => Math.abs(a - b) <= e * Math.max(1, Math.abs(b));
const bar = (time, high, low, close, volume) => ({ time, open: close, high, low, close, volume });
(async () => {
  const V = await import('../shared/vwap.mjs');
  await check('Rechnung: Preis (H+T+S)/3 gewichtet mit dem Volumen, kumuliert ab dem Anker', () => {
    const t0 = utc(2026, 10, 20), rows = [bar(t0, 12, 8, 10, 100), bar(t0 + H, 22, 18, 20, 300), bar(t0 + 2 * H, 32, 28, 30, 100)];
    const s = V.vwapSeries(rows, t0, { ms: H, now: t0 + 3 * H }); assert.equal(s.points.length, 3);
    assert.ok(near(s.points[0].vwap, 10) && near(s.points[1].vwap, (10 * 100 + 20 * 300) / 400) && near(s.points[2].vwap, (10 * 100 + 20 * 300 + 30 * 100) / 500));
    const v2 = (10 * 100 + 20 * 300) / 400, var2 = (100 * 100 + 400 * 300) / 400 - v2 * v2; assert.ok(near(s.points[1].upper, v2 + Math.sqrt(var2)) && near(s.points[1].lower, v2 - Math.sqrt(var2)));
    assert.ok(near(s.points[0].upper, 10) && near(s.points[0].lower, 10), 'eine Kerze: Band ohne Breite'); assert.equal(s.last, s.points[2]);
  });
  await check('Kerzen vor dem Anker zählen nicht; Kerzen nach „jetzt“ ebenso nicht', () => {
    const t0 = utc(2026, 10, 20), rows = [bar(t0 - H, 999, 1, 500, 1e6), bar(t0, 11, 9, 10, 10), bar(t0 + H, 11, 9, 10, 10), bar(t0 + 2 * H, 5000, 4000, 4500, 1e6)];
    const s = V.vwapSeries(rows, t0, { ms: H, now: t0 + 90 * 6e4 }); assert.equal(s.points.length, 2); assert.ok(near(s.last.vwap, 10));
  });
  await check('Ohne Kerze genau am Anker oder mit Lücke → null (kein halber VWAP)', () => {
    const t0 = utc(2026, 10, 20), rows = [bar(t0 + H, 11, 9, 10, 10), bar(t0 + 2 * H, 11, 9, 10, 10)];
    assert.equal(V.vwapSeries(rows, t0, { ms: H, now: t0 + 5 * H }), null, 'Reihe beginnt nach dem Anker');
    assert.equal(V.vwapSeries([bar(t0, 11, 9, 10, 1), bar(t0 + 2 * H, 11, 9, 10, 1)], t0, { ms: H, now: t0 + 5 * H }), null, 'Lücke');
    assert.equal(V.vwapSeries([], t0, { ms: H }), null); assert.equal(V.vwapSeries(null, t0, { ms: H }), null); assert.equal(V.vwapSeries(rows, NaN, { ms: H }), null); assert.equal(V.vwapSeries(rows, t0, { ms: 0 }), null);
    assert.equal(V.vwapSeries([bar(t0, 11, 9, 10, NaN)], t0, { ms: H, now: t0 + H }), null, 'ungültiges Volumen');
  });
  await check('Volumen null am Anfang: erste Punkte entfallen, danach läuft der VWAP', () => {
    const t0 = utc(2026, 10, 20), rows = [bar(t0, 11, 9, 10, 0), bar(t0 + H, 21, 19, 20, 50)], s = V.vwapSeries(rows, t0, { ms: H, now: t0 + 3 * H });
    assert.equal(s.points.length, 1); assert.equal(s.points[0].time, t0 + H); assert.ok(near(s.last.vwap, 20));
  });
  await check('Perioden: Tag 00:00 UTC, Woche ab Montag, Monat ab dem Ersten', () => {
    const now = utc(2026, 10, 21, 15, 30); // Mittwoch
    assert.equal(V.periodStart('day', now), utc(2026, 10, 21)); assert.equal(V.periodStart('week', now), utc(2026, 10, 19)); assert.equal(V.periodStart('month', now), utc(2026, 10, 1));
    assert.equal(V.periodStart('week', utc(2026, 10, 25, 23, 59)), utc(2026, 10, 19), 'Sonntag gehört zur Woche ab Montag'); assert.equal(V.periodStart('week', utc(2026, 10, 19)), utc(2026, 10, 19));
    assert.equal(V.periodStart('month', utc(2026, 11, 1)), utc(2026, 11, 1)); assert.equal(V.periodStart('unbekannt', now), utc(2026, 10, 21));
  });
  await check('Quellen: Tag aus 15m, Woche aus 1h, Monat aus 4h – decken die Periode ab', () => {
    const [iv, ms, limit] = V.VWAP.sources.day; assert.equal(iv, '15m'); assert.ok(ms * limit >= 4 * 864e5);
    const [iw, msw, lw] = V.VWAP.sources.week; assert.equal(iw, '1h'); assert.ok(msw * lw >= 8 * 864e5);
    const [im, msm, lm] = V.VWAP.sources.month; assert.equal(im, '4h'); assert.ok(msm * lm >= 32 * 864e5);
  });
  await check('Tag-VWAP über einen vollen Tag aus 15m-Kerzen (96 Kerzen) ist lückenlos berechenbar', () => {
    const t0 = utc(2026, 10, 20), rows = Array.from({ length: 96 }, (_, i) => bar(t0 + i * Q, 101 + i, 99 + i, 100 + i, 10)), s = V.vwapSeries(rows, t0, { ms: Q, now: t0 + 24 * H });
    assert.equal(s.points.length, 96); assert.ok(near(s.last.vwap, 100 + 47.5)); assert.ok(s.last.upper > s.last.vwap && s.last.lower < s.last.vwap);
  });
  await check('Anker aus ZigZag: letzter bestätigter Umkehrpunkt der Art; unbestätigter und fremde Art zählen nicht', () => {
    const piv = [{ t: 1, type: 'L', ok: true }, { t: 2, type: 'H', ok: true }, { t: 3, type: 'L', ok: true }, { t: 4, type: 'H', ok: false }];
    assert.equal(V.anchorFromPivots(piv, 'L'), 3); assert.equal(V.anchorFromPivots(piv, 'H'), 2); assert.equal(V.anchorFromPivots([], 'L'), null); assert.equal(V.anchorFromPivots(null, 'L'), null);
    assert.equal(V.anchorFromPivots([{ t: 5, type: 'L', ok: false }], 'L'), null);
  });
  await check('Modus-Namen: bekannte Werte bleiben, Unbekanntes wird „Tag“', () => {
    assert.equal(V.vwapMode('week'), 'week'); assert.equal(V.vwapMode('x'), 'day'); assert.equal(V.vwapMode(undefined), 'day'); assert.equal(V.modeName('low'), 'ab Swing-Tief'); assert.equal(V.VWAP_MODES.length, 6);
  });
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})();
