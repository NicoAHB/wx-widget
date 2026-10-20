// 3.90.0 – AMD (shared/amd-core.mjs): Range, Manipulation, Bestätigung (Schluss in der Range + 1m-Strukturbruch), CRV-Filter, Short gespiegelt.
// Aufruf: node unit-amd-core.js
const assert = require('assert');
let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); pass++; console.log('✓ ' + name); } catch (e) { fail++; console.log('✗ ' + name + ' — ' + e.message.split('\n')[0]); } };
(async () => {
  const A = await import('../shared/amd-core.mjs');
  const Q = 900000, M = 60000, T0 = Date.UTC(2026, 0, 5, 0, 0, 0);
  const bar = (time, ms, o, h, l, c) => ({ time, closeTime: time + ms - 1, open: o, high: h, low: l, close: c });
  // 30 ruhige Kerzen (Höhe 2, ATR 2) → Range 99–101
  const warm = () => Array.from({ length: 30 }, (_, i) => bar(T0 + i * Q, Q, 100, 101, 99, 100));
  const tj = T0 + 30 * Q;
  // Minutenkerzen der Durchbruchkerze: Swing-Hoch 99,7 (Minute 2), Extrem 98,7 (Minute 6), Schluss 99,72 in Minute 12 = Strukturbruch
  const path = [[99.55, 99.6, 99.45, 99.5], [99.5, 99.65, 99.4, 99.6], [99.6, 99.7, 99.4, 99.45], [99.45, 99.55, 99.2, 99.25], [99.25, 99.5, 99.0, 99.05], [99.05, 99.15, 98.8, 98.85], [98.85, 99.0, 98.7, 98.75],
    [98.75, 98.95, 98.72, 98.9], [98.9, 99.1, 98.85, 99.05], [99.05, 99.25, 99.0, 99.2], [99.2, 99.4, 99.15, 99.35], [99.35, 99.6, 99.3, 99.55], [99.55, 99.75, 99.5, 99.72], [99.72, 99.8, 99.6, 99.65], [99.65, 99.7, 99.1, 99.2]];
  const minutes = (p = path, start = tj) => p.map((x, i) => bar(start + i * M, M, ...x));
  const breakCandle = () => bar(tj, Q, 99.55, 99.8, 98.7, 99.2);
  const now0 = tj + Q + 5000;
  const run = (candles, mins, extra = {}) => A.evaluateAmd({ candles, minutes: mins, symbol: 'ETHUSDT', market: 'futures', now: now0, options: { interval: '15m', ...extra } });
  const mirrorBar = c => ({ ...c, open: 200 - c.open, high: 200 - c.low, low: 200 - c.high, close: 200 - c.close });

  check('Intervalle: 5m bis 1M, ohne 1m; Standard 15m', () => {
    assert.deepStrictEqual([...A.AMD_INTERVALS], ['5m', '15m', '1h', '2h', '4h', '1d', '1w', '1M']);
    assert.strictEqual(A.amdOptions().interval, '15m'); assert.strictEqual(A.amdOptions({ interval: '1m' }).interval, '15m'); assert.strictEqual(A.amdOptions({ interval: '1M' }).interval, '1M');
  });
  check('Optionen: Höhe 0,5–4 × ATR, CRV 1–5 in halben Schritten, Schrott fällt auf den Standard', () => {
    assert.deepStrictEqual(A.amdOptions({ maxHeightAtr: 9, minRR: 0 }), { interval: '15m', maxHeightAtr: 4, minRR: 1 });
    assert.deepStrictEqual(A.amdOptions({ maxHeightAtr: 'x', minRR: null }), { interval: '15m', maxHeightAtr: 1.5, minRR: 2 });
    assert.strictEqual(A.amdOptions({ minRR: 2.3 }).minRR, 2.5); assert.strictEqual(A.amdOptions(null).maxHeightAtr, 1.5);
  });
  check('Nur geschlossene, gültige Kerzen; sortiert, ohne Doppelte', () => {
    const rows = A.amdClosed([bar(T0 + Q, Q, 1, 2, 1, 2), bar(T0, Q, 1, 2, 1, 2), bar(T0, Q, 1, 3, 1, 2), bar(T0 + 2 * Q, Q, 1, 2, 1, 2), bar(T0 + 3 * Q, Q, 2, 1, 1, 2)], T0 + 3 * Q);
    assert.deepStrictEqual(rows.map(c => c.time), [T0, T0 + Q, T0 + 2 * Q]); assert.strictEqual(rows[0].high, 3);
  });
  check('ATR (Wilder 14): konstante Kerzen → ATR = Kerzenhöhe, erster Wert an Index 14', () => {
    const atr = A.amdAtr(A.amdClosed(warm(), T0 + 40 * Q));
    assert.strictEqual(atr[13], null); assert.strictEqual(atr[14], 2); assert.strictEqual(atr[29], 2);
  });
  check('Accumulation: Seitwärtsrange ab 12 Kerzen, Höhe ≤ 1,5 × ATR; blaue Box-Daten', () => {
    const r = A.evaluateAmd({ candles: warm(), symbol: 'ETHUSDT', market: 'futures', now: T0 + 30 * Q + 5000, options: {} });
    assert.strictEqual(r.ready, true); assert.strictEqual(r.phase, 'accumulation'); assert.strictEqual(r.stage, 1); assert.strictEqual(r.signal, null);
    assert.strictEqual(r.current.range.high, 101); assert.strictEqual(r.current.range.low, 99); assert.strictEqual(r.current.boxes.accumulation.high, 101);
  });
  check('Zu hohe Range (> 1,5 × ATR) ist keine Accumulation; mit 4 × ATR schon', () => {
    const tall = warm().map((c, i) => i % 2 ? bar(c.time, Q, 100, 101, 98, 100) : bar(c.time, Q, 100, 102, 99, 100));
    const strict = A.evaluateAmd({ candles: tall, symbol: 'X', market: 'spot', now: T0 + 30 * Q + 5000, options: { maxHeightAtr: 1 } });
    assert.strictEqual(strict.phase, 'none'); assert.strictEqual(strict.stage, 0); assert.strictEqual(strict.current, null);
    const loose = A.evaluateAmd({ candles: tall, symbol: 'X', market: 'spot', now: T0 + 30 * Q + 5000, options: { maxHeightAtr: 4 } });
    assert.strictEqual(loose.phase, 'accumulation');
  });
  check('Weniger als 12 Kerzen in der Range: keine Accumulation', () => {
    const rows = warm().map((c, i) => i < 19 ? bar(c.time, Q, 100, 106, 94, 100) : c);   // nur die letzten 11 Kerzen ruhig
    const r = A.evaluateAmd({ candles: rows, symbol: 'X', market: 'spot', now: T0 + 30 * Q + 5000, options: {} });
    assert.ok(r.phase === 'none' || r.current.range.end - r.current.range.start + 1 >= 12, r.phase);
  });
  check('Manipulation ohne Minutenkerzen: läuft (rot), 1m-Daten werden angefordert, kein Signal', () => {
    const r = run([...warm(), breakCandle()], []);
    assert.strictEqual(r.phase, 'manipulation'); assert.strictEqual(r.stage, 1); assert.strictEqual(r.direction, 1); assert.strictEqual(r.signal, null);
    assert.ok(r.needsMinutes && r.needsMinutes.from === tj, JSON.stringify(r.needsMinutes));
    assert.strictEqual(r.current.boxes.manipulation.low, 98.7); assert.strictEqual(r.current.boxes.manipulation.high, 99); assert.ok(!r.current.boxes.distribution);
  });
  check('Bestätigung Long: Schluss in der Range + 1m-Strukturbruch → Einstieg, Stop hinter Extrem, Ziel Range-Hoch, CRV', () => {
    const r = run([...warm(), breakCandle()], minutes());
    assert.strictEqual(r.phase, 'signal'); assert.strictEqual(r.stage, 3); assert.strictEqual(r.direction, 1); assert.strictEqual(r.needsMinutes, null);
    const s = r.signal; assert.ok(s, 'Signal'); assert.strictEqual(s.side, 'long'); assert.strictEqual(s.at, tj + Q); assert.strictEqual(s.entry, 99.2);
    assert.ok(Math.abs(s.stop - (98.7 - 0.2)) < 1e-9, 'Stop ' + s.stop); assert.strictEqual(s.target, 101);
    assert.ok(Math.abs(s.rr - (101 - 99.2) / (99.2 - 98.5)) < 1e-9 && s.rr >= 2, 'CRV ' + s.rr);
    assert.ok(s.setupId.startsWith('15m|') && s.stageNames.join() === 'Accumulation,Manipulation,Distribution' && s.chart.length >= 2);
    assert.deepStrictEqual(Object.keys(s.boxes), ['accumulation', 'manipulation', 'distribution']);
    assert.strictEqual(s.boxes.distribution.high, 101); assert.ok(Math.abs(s.boxes.distribution.low - 98.5) < 1e-9);
  });
  check('Ohne Strukturbruch (Minuten bleiben unter dem Swing-Hoch) keine Bestätigung', () => {
    const weak = path.map((x, i) => i === 12 ? [99.55, 99.65, 99.5, 99.6] : x);
    const r = run([...warm(), breakCandle()], minutes(weak));
    assert.strictEqual(r.signal, null); assert.strictEqual(r.phase, 'manipulation'); assert.ok(!r.current.boxes.distribution);
  });
  check('Strukturbruch ohne Schluss in der Range (Kerze schließt unter dem Range-Tief): keine Bestätigung', () => {
    const outside = bar(tj, Q, 99.55, 99.8, 98.7, 98.9);
    const r = run([...warm(), outside], minutes(path.map((x, i) => i === 14 ? [99.65, 99.7, 98.85, 98.9] : x)));
    assert.strictEqual(r.signal, null); assert.strictEqual(r.phase, 'manipulation');
  });
  check('Echter Ausbruch: drei Schlüsse in Folge außerhalb → ungültig (grau), kein Signal', () => {
    const out = [0, 1, 2].map(i => bar(tj + i * Q, Q, 98.8 - i * .1, 98.9 - i * .1, 98.4 - i * .1, 98.5 - i * .1));
    const r = A.evaluateAmd({ candles: [...warm(), ...out], symbol: 'X', market: 'spot', now: tj + 3 * Q + 5000, options: {} });
    assert.strictEqual(r.current.status, 'invalid'); assert.strictEqual(r.phase, 'invalid'); assert.strictEqual(r.signal, null); assert.ok(/echter Ausbruch/.test(r.reason), r.reason);
    assert.strictEqual(r.needsMinutes, null);
  });
  check('Durchbruch auf beiden Seiten in einer Kerze: kein Ablauf', () => {
    const r = A.evaluateAmd({ candles: [...warm(), bar(tj, Q, 100, 104, 96, 100)], symbol: 'X', market: 'spot', now: tj + Q + 5000, options: {} });
    assert.ok(!r.current || r.current.status !== 'manipulating', r.phase);
  });
  check('Gegenseite der Range vor der Bestätigung erreicht → ungültig', () => {
    const weak = path.map((x, i) => i === 12 ? [99.55, 99.65, 99.5, 99.6] : x);       // Kerze schließt in der Range, aber ohne Strukturbruch
    const up = bar(tj + Q, Q, 99.2, 101.5, 99.1, 101.3);                              // dann bis über das Range-Hoch
    const r = A.evaluateAmd({ candles: [...warm(), breakCandle(), up], minutes: [...minutes(weak), ...minutes([[99.2, 101.5, 99.1, 101.3]], tj + Q)], symbol: 'X', market: 'spot', now: tj + 2 * Q + 5000, options: {} });
    assert.strictEqual(r.current.status, 'invalid'); assert.strictEqual(r.signal, null); assert.ok(/Gegenseite/.test(r.reason), r.reason);
  });
  check('CRV-Filter: unter 1:2 bleibt es ohne Signal (grüne Box nur als gefiltert); mit CRV 1:1 wird es gesendet', () => {
    const strict = run([...warm(), breakCandle()], minutes(), { minRR: 3 });
    assert.strictEqual(strict.signal, null); assert.strictEqual(strict.phase, 'filtered'); assert.strictEqual(strict.stage, 2); assert.ok(/CRV 1:2,57 liegt unter 1:3/.test(strict.reason), strict.reason);
    assert.ok(strict.current.boxes.distribution);
    const loose = run([...warm(), breakCandle()], minutes(), { minRR: 1 }); assert.ok(loose.signal);
  });
  check('Short: Fehlausbruch nach oben, Spiegelbild des Long-Falls (Einstieg, Stop, Ziel, CRV)', () => {
    const long = run([...warm(), breakCandle()], minutes()), short = run([...warm(), breakCandle()].map(mirrorBar).map((c, i) => c), minutes(path).map(mirrorBar));
    assert.strictEqual(short.direction, -1); const s = short.signal; assert.ok(s, short.reason); assert.strictEqual(s.side, 'short');
    assert.ok(Math.abs(s.entry - (200 - long.signal.entry)) < 1e-9 && Math.abs(s.stop - (200 - long.signal.stop)) < 1e-9 && Math.abs(s.target - (200 - long.signal.target)) < 1e-9 && Math.abs(s.rr - long.signal.rr) < 1e-9);
    assert.ok(s.boxes.distribution.low === s.target && s.boxes.distribution.high === s.stop);
  });
  check('Kein Blick in die Zukunft: weitere Kerzen ändern Bestätigungszeit, Einstieg und Stop nicht', () => {
    const a = run([...warm(), breakCandle()], minutes());
    const later = [...warm(), breakCandle(), bar(tj + Q, Q, 99.2, 99.6, 99.1, 99.5), bar(tj + 2 * Q, Q, 99.5, 99.9, 99.4, 99.8)];
    const b = A.evaluateAmd({ candles: later, minutes: [...minutes(), ...minutes([[99.2, 99.3, 99.1, 99.25]], tj + Q)], symbol: 'ETHUSDT', market: 'futures', now: tj + 3 * Q + 5000, options: { interval: '15m' } });
    const ea = a.current, eb = b.episodes.find(e => e.id === ea.id);
    assert.ok(eb, 'gleicher Ablauf'); assert.strictEqual(eb.confirmedAt, ea.confirmedAt); assert.strictEqual(eb.entry, ea.entry); assert.strictEqual(eb.stop, ea.stop);
  });
  // Durchbruchkerze schließt außerhalb (98,9 < 99), die nächste in der Range; Minuten der zweiten Kerze frei wählbar
  const outsideThenInside = (second, closeInside = 99.3) => {
    const first = path.map((x, i) => i === 14 ? [99.65, 99.7, 98.85, 98.9] : x);
    const candles = [...warm(), bar(tj, Q, 99.55, 99.8, 98.7, 98.9), bar(tj + Q, Q, 98.9, Math.max(99.4, closeInside), Math.min(98.85, ...second.map(x => x[2])), closeInside)];
    return A.evaluateAmd({ candles, minutes: [...minutes(first), ...minutes(second, tj + Q)], symbol: 'ETHUSDT', market: 'futures', now: tj + 2 * Q + 5000, options: { interval: '15m' } });
  };
  const calm = Array.from({ length: 15 }, (_, i) => [99.0 + i * .02, 99.1 + i * .02, 98.9 + i * .02, 99.05 + i * .02]).map((x, i, a) => i === 14 ? [x[0], 99.35, x[2], 99.3] : x);
  check('Durchbruchkerze schließt außerhalb, die nächste in der Range; der Strukturbruch lag davor: Bestätigung zum Schluss der zweiten Kerze', () => {
    const r = outsideThenInside(calm); assert.strictEqual(r.phase, 'signal', r.reason); assert.strictEqual(r.signal.at, tj + 2 * Q); assert.strictEqual(r.signal.entry, 99.3);
    assert.ok(Math.abs(r.signal.stop - 98.5) < 1e-9 && r.signal.rr >= 2, JSON.stringify([r.signal.stop, r.signal.rr]));
  });
  check('Ein neues Extrem nach dem Strukturbruch setzt die Prüfung zurück: ohne neuen Strukturbruch keine Bestätigung', () => {
    const deeper = calm.map((x, i) => i === 0 ? [98.9, 98.95, 98.4, 98.5] : x);
    const r = outsideThenInside(deeper); assert.strictEqual(r.signal, null); assert.strictEqual(r.phase, 'manipulation'); assert.ok(Math.abs(r.current.extreme - 98.4) < 1e-9, r.current.extreme);
  });
  check('Ergebnis: Ziel erreicht → kein Signal mehr; Stop erreicht → kein Signal mehr', () => {
    const hit = (hi, lo, close = Math.min(hi, 99.3)) => A.evaluateAmd({ candles: [...warm(), breakCandle(), bar(tj + Q, Q, 99.2, hi, lo, close)], minutes: [...minutes(), ...minutes([[99.2, hi, lo, close]], tj + Q)], symbol: 'ETHUSDT', market: 'futures', now: tj + 2 * Q + 5000, options: { interval: '15m' } });
    const win = hit(101.2, 99.2), lose = hit(99.4, 98.4);
    assert.strictEqual(win.phase, 'target'); assert.strictEqual(win.signal, null); assert.strictEqual(win.current.outcome.status, 'target');
    assert.strictEqual(lose.phase, 'stop'); assert.strictEqual(lose.signal, null);
    assert.strictEqual(hit(101.2, 98.4).current.outcome.status, 'stop');      // beides in einer Minute: Stop zuerst
  });
  check('Hinweis nach Ablauf der Gültigkeit wird nicht mehr gesendet (signal null, lastSignal bleibt)', () => {
    const r = A.evaluateAmd({ candles: [...warm(), breakCandle()], minutes: minutes(), symbol: 'ETHUSDT', market: 'futures', now: tj + Q + 3 * 3600000, options: { interval: '15m' } });
    assert.strictEqual(r.signal, null); assert.ok(r.lastSignal); assert.strictEqual(r.phase, 'expired');
  });
  check('Gültigkeit nach der Bestätigung: 10 Minuten (5m) bis höchstens 15 Minuten, kein Nachzügler-Versand', () => {
    const r = run([...warm(), breakCandle()], minutes());
    assert.strictEqual(r.signal.expiresAt - r.signal.at, 15 * M);
    const ms = A.AMD; assert.strictEqual(ms.validMinMs, 10 * M); assert.strictEqual(ms.validMaxMs, 15 * M);
  });
  check('Zu wenige Kerzen → nicht bereit mit Begründung', () => {
    const r = A.evaluateAmd({ candles: warm().slice(0, 10), symbol: 'X', market: 'spot', now: T0 + 30 * Q, options: {} });
    assert.strictEqual(r.ready, false); assert.ok(/mindestens 26/.test(r.reason), r.reason);
  });
  check('Ohne 1m-Kerzen läuft die Wartezeit nach 12 Kerzen ab: „nicht prüfbar“ statt einer erfundenen Bestätigung', () => {
    const after = Array.from({ length: 13 }, (_, i) => bar(tj + (i + 1) * Q, Q, 99.2, 99.6, 99.1, 99.3));
    const r = A.evaluateAmd({ candles: [...warm(), breakCandle(), ...after], symbol: 'X', market: 'spot', now: tj + 15 * Q, options: {} });
    assert.strictEqual(r.current.status, 'unchecked'); assert.strictEqual(r.signal, null); assert.ok(r.needsMinutes, 'fordert 1m an');
  });
  check('Monatskerzen: Schlusszeit der Börse zählt (kein festes Raster)', () => {
    const d = (y, m) => Date.UTC(y, m, 1), rows = A.amdClosed([{ time: d(2026, 0), closeTime: d(2026, 1) - 1, open: 1, high: 2, low: 1, close: 2 }, { time: d(2026, 1), closeTime: d(2026, 2) - 1, open: 1, high: 2, low: 1, close: 2 }], d(2026, 2));
    assert.strictEqual(rows.length, 2); assert.strictEqual(rows[1].end, d(2026, 2));
    assert.strictEqual(A.amdClosed([{ time: d(2026, 1), closeTime: d(2026, 2) - 1, open: 1, high: 2, low: 1, close: 2 }], d(2026, 1) + 86400000).length, 0);
  });
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
})();
