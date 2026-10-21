// 3.91.0 – AMD-Rückblick (shared/amd-review.mjs): zählt Accumulationen, Manipulationen, Schluss in der Range und Bestätigungen für mehrere Empfindlichkeiten.
// Aufruf: node unit-amd-review.js
const assert = require('assert');
let pass = 0, fail = 0;
const check = async (name, fn) => { try { await fn(); pass++; console.log('✓ ' + name); } catch (e) { fail++; console.log('✗ ' + name + ' — ' + e.message.split('\n')[0]); } };
(async () => {
  const R = await import('../shared/amd-review.mjs'), A = await import('../shared/amd-core.mjs');
  const Q = 900000, M = 60000, DAY = 86400000, NOW = Date.UTC(2026, 9, 21, 12, 0, 0), END = Math.floor(NOW / Q) * Q;
  const bar = (time, ms, o, h, l, c) => ({ time, end: time + ms, closeTime: time + ms - 1, open: o, high: h, low: l, close: c, volume: 1 });
  const path = [[99.55, 99.6, 99.45, 99.5], [99.5, 99.65, 99.4, 99.6], [99.6, 99.7, 99.4, 99.45], [99.45, 99.55, 99.2, 99.25], [99.25, 99.5, 99.0, 99.05], [99.05, 99.15, 98.8, 98.85], [98.85, 99.0, 98.7, 98.75],
    [98.75, 98.95, 98.72, 98.9], [98.9, 99.1, 98.85, 99.05], [99.05, 99.25, 99.0, 99.2], [99.2, 99.4, 99.15, 99.35], [99.35, 99.6, 99.3, 99.55], [99.55, 99.75, 99.5, 99.72], [99.72, 99.8, 99.6, 99.65], [99.65, 99.7, 99.1, 99.2]];
  // 40 Tage ruhige Kerzen (Dochte 99–101, ATR 2); am Tag −20 ein bestätigter Long, am Tag −10 ein echter Ausbruch (3 Schlüsse außerhalb)
  const FIRST = END - 40 * DAY, longAt = END - 20 * DAY, outAt = END - 10 * DAY, N = 40 * 96;
  const base = Array.from({ length: N }, (_, i) => { const t = FIRST + i * Q, o = 99.6 + (i * 7 % 9) * .1, c = 99.6 + (i * 5 % 9) * .1; return bar(t, Q, o, 101, 99, c); });
  const at = t => (t - FIRST) / Q;
  base[at(longAt)] = bar(longAt, Q, 99.55, 99.8, 98.7, 99.2);
  [[98.8, 98.9, 98.4, 98.5], [98.5, 98.6, 98.1, 98.2], [98.2, 98.3, 97.8, 97.9]].forEach((x, i) => { base[at(outAt) + i] = bar(outAt + i * Q, Q, ...x); });
  const minutesOf = t => t >= longAt && t < longAt + Q ? path[(t - longAt) / M] : [100, 100.1, 99.9, 100];
  const calls = []; let failMinutes = false;
  const history = async q => {
    calls.push(q.symbol + '|' + q.timeframe);
    if (q.symbol === 'BADUSDT') throw new Error('Datenquelle in dieser Region nicht erreichbar');
    const ms = q.timeframe === '1m' ? M : Q, from = Math.floor(q.from / ms) * ms, to = Math.floor(q.to / ms) * ms;
    if (q.timeframe === '1m' && failMinutes) throw new Error('unvollständiges Datenfenster');
    const rows = []; for (let t = from; t < to; t += ms) rows.push(ms === M ? bar(t, M, ...minutesOf(t)) : base[at(t)] || bar(t, Q, 100, 101, 99, 100));
    return rows;
  };
  const coins = [{ symbol: 'ETHUSDT', market: 'futures' }, { symbol: 'SOLUSDT', market: 'futures' }];
  const run = (extra = {}) => R.runAmdReview({ symbols: coins, history, now: NOW, interval: '15m', days: 30, thresholds: [1.5, 3], ...extra });

  await check('Zählung eines Ablaufs: Accumulation, Manipulation, Schluss in der Range, bestätigt (1m geprüft), echter Ausbruch ungültig', async () => {
    const r = await run(); const t = r.total['1.5'];
    // Tag −20 liegt im 30-Tage-Fenster, Tag −10 ebenfalls; je Coin ein bestätigter Long und ein echter Ausbruch
    assert.strictEqual(t.manipulations, 4, JSON.stringify(t)); assert.strictEqual(t.closedInside, 2); assert.strictEqual(t.confirmed, 2); assert.strictEqual(t.reported, 2); assert.strictEqual(t.invalid, 2);
    assert.ok(t.accumulations >= 4, JSON.stringify(t)); assert.strictEqual(r.coins, 2); assert.strictEqual(r.checked, 2); assert.deepStrictEqual(r.errors, []);
  });
  await check('Mehrere Empfindlichkeiten nebeneinander; die Summe steht je Stufe, je Coin die Einzelwerte', async () => {
    const r = await run(); assert.deepStrictEqual(r.levels, [1.5, 3]); assert.deepStrictEqual(Object.keys(r.total).sort(), ['1.5', '3']); assert.strictEqual(r.perCoin.length, 2);
    assert.strictEqual(r.perCoin[0].cells['1.5'].confirmed, 1); assert.strictEqual(r.perCoin[0].symbol, 'ETHUSDT');
  });
  await check('Nur das Fenster zählt: Vorlauf und alte Abläufe außerhalb der 30 Tage werden nicht mitgezählt', async () => {
    const r = await run({ days: 15 }); assert.strictEqual(r.total['1.5'].manipulations, 2, JSON.stringify(r.total['1.5'])); assert.strictEqual(r.total['1.5'].confirmed, 0);
  });
  await check('Minutenkerzen nur für Abläufe mit Schluss zurück in der Range (ein Fenster je Ablauf und Coin)', async () => {
    calls.length = 0; await run(); const minutes = calls.filter(c => c.endsWith('|1m'));
    assert.strictEqual(minutes.length, 2, minutes.join()); assert.ok(calls.filter(c => c.endsWith('|15m')).length >= 8);
  });
  await check('Mindest-CRV wirkt: bei 1:5 ist derselbe Ablauf bestätigt, aber nicht gemeldet', async () => {
    const r = await run({ minRR: 5 }); const t = r.total['1.5']; assert.strictEqual(t.confirmed, 2); assert.strictEqual(t.reported, 0); assert.strictEqual(t.filtered, 2);
  });
  await check('Ein Datenfehler überspringt nur den Coin; Meldung nennt ihn', async () => {
    const r = await run({ symbols: [...coins, { symbol: 'BADUSDT', market: 'spot' }] }); assert.strictEqual(r.errors.length, 1); assert.strictEqual(r.errors[0].symbol, 'BADUSDT'); assert.match(r.errors[0].text, /Region/);
    assert.strictEqual(r.total['1.5'].confirmed, 2); assert.strictEqual(r.checked, 3);
  });
  await check('Ausfall eines Minutenfensters: Ablauf bleibt „nicht prüfbar“ statt Absturz, Fehler wird gemeldet', async () => {
    failMinutes = true; const r = await run(); failMinutes = false;
    assert.strictEqual(r.total['1.5'].confirmed, 0); assert.ok(r.total['1.5'].unchecked >= 2 || r.total['1.5'].invalid >= 2, JSON.stringify(r.total['1.5'])); assert.ok(r.errors.some(e => /1m-Fenster/.test(e.text)), JSON.stringify(r.errors));
  });
  await check('Nicht unterstützte Zeitrahmen (1d, 1w, 1M) und Coins ohne Börsenmarkt', async () => {
    for (const interval of ['1d', '1w', '1M']) await assert.rejects(() => run({ interval }), /Rückblick läuft für 5m, 15m, 1h, 4h/);
    const r = await run({ symbols: [{ symbol: 'ETHUSDT', market: null }, ...coins] }); assert.strictEqual(r.coins, 2);
  });
  await check('Abbruch durch den Nutzer wirft einen Abbruch statt eines Teilergebnisses', async () => {
    const c = new AbortController(); const p = run({ signal: c.signal, symbols: coins }); c.abort(); await assert.rejects(() => p);
  });
  await check('Fortschritt wird je Coin gemeldet', async () => {
    const seen = []; await run({ progress: p => seen.push(p.symbol + ':' + p.step) }); assert.ok(seen.includes('ETHUSDT:Kerzen') && seen.includes('SOLUSDT:Kerzen') && seen.includes('ETHUSDT:1m'), seen.join());
  });
  await check('Zeitrahmen 4h: Kerzen ja, 1m-Prüfung nein (Fenster zu lang) – Ergebnis nennt es', async () => {
    calls.length = 0; const r = await run({ interval: '4h' }); assert.strictEqual(r.minuteCheck, false); assert.ok(!calls.some(c => c.endsWith('|1m')));
  });
  await check('amdCount: gleiche Zählregeln auf fertigen Abläufen', () => {
    const range = { endTime: 5 }, ep = (status, extra = {}) => ({ range, direction: 1, breakAt: 10, closedInside: false, status, ...extra });
    const c = R.amdCount([{ range: { endTime: 1 } }, ep('invalid'), ep('unchecked', { closedInside: true }), ep('confirmed', { closedInside: true }), ep('filtered', { closedInside: true }), ep('manipulating'), ep('invalid', { breakAt: 1 })], 5);
    assert.deepStrictEqual(c, { accumulations: 6, manipulations: 5, closedInside: 3, confirmed: 2, reported: 1, filtered: 1, invalid: 1, unchecked: 1, open: 1 });
  });
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
})();
