// 3.84.0/3.85.0 – VWAP (shared/vwap.mjs): Rechenwerte, Anker, vorgeschlagene Ankerpunkte, Lücken, Perioden. Aufruf: node unit-vwap.js
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
    assert.equal(V.vwapMode('week'), 'week'); assert.equal(V.vwapMode('x'), 'day'); assert.equal(V.vwapMode(undefined), 'day'); assert.equal(V.modeName('low'), 'ab Swing-Tief'); assert.equal(V.VWAP_MODES.length, 16);
    for (const [k] of V.VWAP_MODES) assert.equal(V.vwapMode(k), k, k); assert.equal(V.vwapMode('pdh'), 'pdh'); assert.equal(V.modeName('ny'), 'ab NY-Open'); assert.equal(V.modeName('unbekannt'), 'Tag');
    assert.deepEqual(V.VWAP_MODE_GROUPS.map(([g]) => g), ['Perioden', 'Handelssitzungen', 'Wendepunkte', 'Auffälligkeiten', 'Eigener Punkt']);
  });
  await check('Quellen: jeder Modus mit Quelle hat eine; Swing und Anker rechnen aus den Kerzen des Charts', () => {
    for (const m of ['day', 'asia', 'london', 'ny', 'pdl', 'pdh']) assert.equal(V.vwapSource(m)[0], '15m', m);
    for (const m of ['week', 'wl', 'wh', 'vol']) assert.equal(V.vwapSource(m)[0], '1h', m); for (const m of ['month', 'pwl', 'pwh']) assert.equal(V.vwapSource(m)[0], '4h', m);
    for (const m of ['low', 'high', 'anchor', 'unbekannt']) assert.equal(V.vwapSource(m), null, m);
  });
  await check('Anker-Vorschläge: Sitzungen, Vortag, Woche, Vorwoche und Volumenspitze – jeweils aus den Kerzen ihrer Quelle', () => {
    // Mittwoch 21.10.2026, 11:00 UTC. London ist noch in Sommerzeit (bis 25.10.), New York bis 1.11.
    const now = utc(2026, 10, 21, 11, 0), D = 864e5, mk = (ms, from, to, f) => { const out = []; for (let t = from; t < to; t += ms) out.push({ time: t, open: 95, high: 100, low: 90, close: 95, volume: 10, ...f(t) }); return out; };
    const rows15 = mk(Q, now - 400 * Q, now, t => (t === utc(2026, 10, 20, 14, 30) ? { high: 150 } : t === utc(2026, 10, 20, 9, 15) ? { low: 50 } : t === utc(2026, 10, 21, 3, 0) ? { high: 160, low: 40 } : {}));
    const rows1h = mk(H, now - 300 * H, now + H, t => (t === utc(2026, 10, 20, 14, 0) ? { high: 150 } : t === utc(2026, 10, 19, 9, 0) ? { low: 40 } : t === utc(2026, 10, 16, 5, 0) ? { high: 999, low: 1 } : t === utc(2026, 10, 17, 12, 0) ? { volume: 500 } : t === utc(2026, 10, 10, 6, 0) ? { volume: 900 } : t === now ? { volume: 700 } : {}));
    const rows4h = mk(4 * H, Math.floor(now / (4 * H)) * 4 * H - 249 * 4 * H, now, t => (t === utc(2026, 10, 14, 8, 0) ? { high: 300 } : t === utc(2026, 10, 16, 20, 0) ? { low: 5 } : t === utc(2026, 10, 19, 4, 0) ? { high: 800, low: 1 } : {}));
    const at = (mode, rows) => V.anchorStart(mode, rows, now);
    assert.equal(at('day', rows15).start, utc(2026, 10, 21)); assert.equal(at('week', rows1h).start, utc(2026, 10, 19)); assert.equal(at('month', rows4h).start, utc(2026, 10, 1));
    assert.equal(at('asia', rows15).start, utc(2026, 10, 21, 0, 0)); assert.equal(at('london', rows15).start, utc(2026, 10, 21, 7, 0), '08:00 Londoner Sommerzeit = 07:00 UTC');
    assert.equal(at('ny', rows15).start, utc(2026, 10, 20, 13, 30), 'NY hat heute (11:00 UTC) noch nicht begonnen: die zuletzt begonnene Sitzung (gestern, 09:30 EDT = 13:30 UTC)');
    assert.equal(at('pdh', rows15).start, utc(2026, 10, 20, 14, 30), 'nur gestern zählt, nicht das höhere Hoch von heute'); assert.equal(at('pdl', rows15).start, utc(2026, 10, 20, 9, 15));
    assert.equal(at('wh', rows1h).start, utc(2026, 10, 20, 14, 0), 'seit Montag; das Hoch der Vorwoche zählt nicht'); assert.equal(at('wl', rows1h).start, utc(2026, 10, 19, 9, 0));
    assert.equal(at('pwh', rows4h).start, utc(2026, 10, 14, 8, 0), 'Vorwoche Mo–So; das höhere Hoch der laufenden Woche zählt nicht'); assert.equal(at('pwl', rows4h).start, utc(2026, 10, 16, 20, 0));
    assert.equal(at('vol', rows1h).start, utc(2026, 10, 17, 12, 0), 'größtes Volumen der letzten 7 Tage; außerhalb (10.10.) und die noch laufende Stunde zählen nicht');
    // Gleichstand: die früheste Kerze
    const tie = mk(Q, now - 400 * Q, now, t => (t === utc(2026, 10, 20, 8, 0) || t === utc(2026, 10, 20, 16, 0) ? { high: 150 } : {})); assert.equal(at('pdh', tie).start, utc(2026, 10, 20, 8, 0));
    // Der Anker passt zur Reihe: aus genau diesen Kerzen entsteht ab dem Anker ein VWAP
    const s = V.vwapSeries(rows15, at('pdh', rows15).start, { ms: Q, now }); assert.ok(s && s.points[0].time === utc(2026, 10, 20, 14, 30));
  });
  await check('Anker-Vorschläge ohne ausreichende Kerzen: kein Anker, mit Grund – nichts wird geschätzt', () => {
    const now = utc(2026, 10, 21, 11, 0), mk = (ms, from, to, skip = []) => { const out = []; for (let t = from; t < to; t += ms) if (!skip.includes(t)) out.push({ time: t, open: 95, high: 100, low: 90, close: 95, volume: 10 }); return out; };
    const hole = mk(Q, now - 400 * Q, now, [utc(2026, 10, 20, 12, 0)]); let r = V.anchorStart('pdh', hole, now); assert.equal(r.start, null); assert.match(r.why, /Vortag-Hoch.*lückenlose 15m-Kerzen von gestern/);
    assert.equal(V.anchorStart('pdl', mk(Q, now - 20 * Q, now), now).start, null, 'gestern fehlt ganz');
    assert.equal(V.anchorStart('pwh', mk(4 * H, now - 3 * 4 * H, now), now).start, null); assert.match(V.anchorStart('pwl', [], now).why, /lückenlose 4h-Kerzen der Vorwoche/);
    assert.equal(V.anchorStart('wh', [], now).start, null); assert.match(V.anchorStart('wh', mk(H, now - 5 * 864e5, utc(2026, 10, 19)), now).why, /dieser Woche/);
    assert.equal(V.anchorStart('vol', [], now).start, null); assert.match(V.anchorStart('vol', [], now).why, /letzten 7 Tage/);
    for (const m of ['low', 'high', 'anchor', 'unbekannt']) assert.deepEqual(V.anchorStart(m, [], now), { start: null, why: '' }, m);
    assert.equal(V.anchorStart('day', null, now).start, utc(2026, 10, 21), 'Perioden brauchen keine Kerzen für den Beginn'); assert.equal(V.anchorStart('ny', null, now).start, utc(2026, 10, 20, 13, 30), 'Sitzungsbeginn auch ohne Kerzen');
    assert.equal(V.anchorStart('pdh', [{ time: 'x' }, null], now).start, null, 'Unbrauchbares wird ignoriert');
  });
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})();
