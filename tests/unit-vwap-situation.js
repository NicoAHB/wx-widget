// 3.87.0 – VWAP-Lage (shared/vwap-situation.mjs): Zonen zum Band, Steigung, letzte Schlusskurse, Seitenwechsel, junger Anker, Sätze für jeden Anker,
// Kontext für die KI-Erklärung und Prüfung der Antwort. Aufruf: node unit-vwap-situation.js
const assert = require('assert');
let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); pass++; console.log('✓ ' + name); } catch (e) { fail++; console.log('✗ ' + name + ' — ' + e.message.split('\n')[0]); } };
(async () => {
  const V = await import('../shared/vwap.mjs'), S = await import('../shared/vwap-situation.mjs');
  const MS = 9e5, T0 = Date.UTC(2026, 9, 20, 0, 0);
  // Kerzen: Schlusskurse aus einer Liste, Hoch/Tief ±0,2 %, Volumen 10
  const make = closes => closes.map((c, i) => ({ time: T0 + i * MS, high: c * 1.002, low: c * 0.998, close: c, volume: 10 }));
  const lines = (rows, price) => { const series = V.vwapSeries(rows, T0, { ms: MS, now: T0 + rows.length * MS }); return { series, s: S.vwapSituation({ mode: 'day', series, rows, price, now: T0 + rows.length * MS, interval: '15m' }) }; };
  const flat = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i) * 1.5); // Band etwa ±1 %

  check('Ohne Reihe oder Kurs keine Lage', () => {
    assert.strictEqual(S.vwapSituation({ mode: 'day', series: null, price: 100 }), null);
    const { series } = lines(make(flat), 100); assert.strictEqual(S.vwapSituation({ mode: 'day', series, rows: [], price: NaN }), null);
    assert.deepStrictEqual(S.vwapSituationLines(null), []); assert.strictEqual(S.vwapExplainContext(null, 'BTCUSDT'), null);
  });
  check('Abstand, σ und Zonen: weit darüber, oberer Teil, auf dem VWAP, unterer Teil, weit darunter', () => {
    const { series } = lines(make(flat), 100), v = series.last.vwap, sd = series.last.upper - v, at = p => lines(make(flat), p).s;
    assert.ok(sd > 0);
    assert.strictEqual(at(v + 2 * sd).zone, 'above-band'); assert.strictEqual(at(v + 0.5 * sd).zone, 'upper');
    assert.strictEqual(at(v).zone, 'at'); assert.strictEqual(at(v - 0.5 * sd).zone, 'lower'); assert.strictEqual(at(v - 2 * sd).zone, 'below-band');
    const s = at(v + 2 * sd); assert.ok(Math.abs(s.sigma - 2) < 1e-9 && Math.abs(s.distPct - 2 * sd / v * 100) < 1e-9);
  });
  check('Steigung: steigend, fallend, flach', () => {
    const up = lines(make(Array.from({ length: 40 }, (_, i) => 100 + i * 0.2)), 108).s, down = lines(make(Array.from({ length: 40 }, (_, i) => 108 - i * 0.2)), 100).s, fl = lines(make(Array.from({ length: 40 }, () => 100)), 100).s;
    assert.strictEqual(up.slope, 'rising'); assert.strictEqual(down.slope, 'falling'); assert.strictEqual(fl.slope, 'flat');
    assert.strictEqual(up.slopeBars, S.VWAP_SITUATION.slopeBars);
  });
  check('Letzte Schlusskurse: Anzahl über/unter, Seitenwechsel, Serie am Ende', () => {
    // 12 Kerzen abwechselnd über/unter dem Schnitt, danach 8 Kerzen deutlich darüber
    const closes = [...Array.from({ length: 12 }, (_, i) => (i % 2 ? 99 : 101)), ...Array.from({ length: 8 }, () => 103)], s = lines(make(closes), 103).s;
    assert.strictEqual(s.recent.n, 20); assert.ok(s.recent.above + s.recent.below >= 19, 'die erste Kerze liegt genau auf dem VWAP');
    assert.ok(s.recent.crosses >= 6, 'Seitenwechsel ' + s.recent.crosses); assert.deepStrictEqual(s.recent.streak, { side: 'above', count: 8 });
    const t = S.vwapSituationLines(s, {}).join(' '); assert.ok(/pendelt um den VWAP/.test(t) && /8 in Folge darüber/.test(t), t);
  });
  check('Junger Anker (wenig Kerzen) wird genannt, kein Absturz bei einer Kerze', () => {
    const one = lines(make([100]), 100).s; assert.ok(one.young && one.slope === null && one.candles === 1);
    const t = S.vwapSituationLines(one, {}).join(' '); assert.ok(/Erst 1 Kerze seit dem Anker/.test(t) && !/NaN|undefined/.test(t), t);
  });
  check('Sätze für jeden Anker: Name, Zahlen, Bedeutung, keine NaN/undefined', () => {
    assert.strictEqual(V.VWAP_MODES.length, 16);
    for (const [mode, name] of V.VWAP_MODES) {
      const rows = make(flat), series = V.vwapSeries(rows, T0, { ms: MS, now: T0 + rows.length * MS }), s = S.vwapSituation({ mode, series, rows, price: 100.3, now: T0 + 40 * MS });
      const t = S.vwapSituationLines(s, { price: v => v.toFixed(2), num: (v, d) => v.toFixed(d), date: () => '20.10. 00:00' }).join(' ');
      assert.ok(t.includes('VWAP ' + name + ' '), mode + ' Name'); assert.ok(t.includes(S.vwapMeaning(mode)), mode + ' Bedeutung'); assert.ok(S.vwapMeaning(mode) && (mode === 'day' || S.vwapMeaning(mode) !== S.vwapMeaning('day')), mode + ' eigene Bedeutung');
      assert.ok(!/NaN|undefined|null|Infinity/.test(t), mode + ': ' + t);
    }
  });
  check('Kontext für die KI: nur Zahlen, ISO-Start, gerundet, ohne Kerzen', () => {
    const s = lines(make(flat), 100.2).s, c = S.vwapExplainContext(s, 'BTCUSDT');
    assert.strictEqual(c.model, 'vwap-1'); assert.strictEqual(c.symbol, 'BTCUSDT'); assert.strictEqual(c.mode, 'day'); assert.strictEqual(c.modeName, 'Tag');
    assert.strictEqual(c.start, new Date(T0).toISOString()); assert.ok(S.VWAP_ZONES.includes(c.zone) && S.VWAP_SLOPES.includes(c.slope));
    assert.ok(Number.isFinite(c.price) && Number.isFinite(c.vwap) && Number.isFinite(c.upper) && Number.isFinite(c.lower) && Number.isFinite(c.distPct));
    assert.ok(!('candles' in c && Array.isArray(c.candles)) && !('points' in c) && JSON.stringify(c).length < 1500);
  });
  check('Antwort des Dienstes: nur passender Modus mit Text; Tendenz nur aus der Liste', () => {
    const ctx = { mode: 'week' };
    assert.deepStrictEqual(S.vwapExplainAnswer({ ok: true, mode: 'week', lean: 'wait', text: ' Abwarten ist sinnvoll. ' }, ctx), { lean: 'wait', text: 'Abwarten ist sinnvoll.' });
    assert.strictEqual(S.vwapExplainAnswer({ ok: true, mode: 'day', lean: 'buy', text: 'x' }, ctx), null);
    assert.strictEqual(S.vwapExplainAnswer({ ok: true, mode: 'week', text: '' }, ctx), null);
    assert.strictEqual(S.vwapExplainAnswer({ ok: false, mode: 'week', text: 'x' }, ctx), null);
    assert.strictEqual(S.vwapExplainAnswer({ ok: true, mode: 'week', text: 'x'.repeat(2001) }, ctx), null);
    assert.strictEqual(S.vwapExplainAnswer({ ok: true, mode: 'week', lean: 'moon', text: 'x' }, ctx).lean, null);
    assert.deepStrictEqual(Object.keys(S.VWAP_LEANS), ['buy', 'sell', 'wait']);
  });
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})();
