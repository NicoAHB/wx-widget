// 3.90.0 – AMD-Laufzeit (shared/amd-feed.mjs): alle Vorauswahl-Coins im Hintergrund, 1m nur bei Bedarf, ein Versand je Setup, Pausen, Fehler.
// Aufruf: node unit-amd-feed.js
const assert = require('assert');
let pass = 0, fail = 0;
const check = async (name, fn) => { try { await fn(); pass++; console.log('✓ ' + name); } catch (e) { fail++; console.log('✗ ' + name + ' — ' + e.message.split('\n')[0]); } };
(async () => {
  const { createAmdRuntime } = await import('../shared/amd-feed.mjs');
  const Q = 900000, M = 60000, T0 = Date.UTC(2026, 0, 5), tj = T0 + 30 * Q;
  const bar = (time, ms, o, h, l, c) => ({ time, closeTime: time + ms - 1, open: o, high: h, low: l, close: c, volume: 1 });
  const warm = Array.from({ length: 30 }, (_, i) => bar(T0 + i * Q, Q, 100, 101, 99, 100));
  const path = [[99.55, 99.6, 99.45, 99.5], [99.5, 99.65, 99.4, 99.6], [99.6, 99.7, 99.4, 99.45], [99.45, 99.55, 99.2, 99.25], [99.25, 99.5, 99.0, 99.05], [99.05, 99.15, 98.8, 98.85], [98.85, 99.0, 98.7, 98.75],
    [98.75, 98.95, 98.72, 98.9], [98.9, 99.1, 98.85, 99.05], [99.05, 99.25, 99.0, 99.2], [99.2, 99.4, 99.15, 99.35], [99.35, 99.6, 99.3, 99.55], [99.55, 99.75, 99.5, 99.72], [99.72, 99.8, 99.6, 99.65], [99.65, 99.7, 99.1, 99.2]];
  // tolerate 60 earlier minutes for the swing search
  const minutes = [...Array.from({ length: 60 }, (_, i) => bar(tj - (60 - i) * M, M, 100, 100.2, 99.8, 100)), ...path.map((x, i) => bar(tj + i * M, M, ...x))];
  const longSetup = [...warm, bar(tj, Q, 99.55, 99.8, 98.7, 99.2)], quiet = [...warm, bar(tj, Q, 100, 100.6, 99.4, 100.2)];
  let clock = tj + Q + 5000;
  const calls = [], sent = [], logs = [];
  const data = { ETHUSDT: { candles: longSetup }, SOLUSDT: { candles: quiet }, BADUSDT: { candles: quiet, source: 'spot' } };
  const ctx = { symbols: [{ symbol: 'ETHUSDT', market: 'futures', analyses: ['amd'] }, { symbol: 'SOLUSDT', market: 'futures', analyses: ['amd'] }, { symbol: 'XRPUSDT', market: 'futures', analyses: ['top-down'] }], options: { amd: { interval: '15m' } }, paused: false, hidden: false, online: true };
  let signalResult = true;
  const make = () => createAmdRuntime({ context: () => ctx, now: () => clock, changed() {}, log: e => logs.push(e), signal: async s => { sent.push(s); return signalResult; },
    fetchRows: async (symbol, interval) => { calls.push(symbol + '|' + interval); if (interval === '1m') return { candles: minutes, source: 'futures' }; const d = data[symbol]; return { candles: d.candles, source: d.source || 'futures' }; } });
  const run = async (rt, n = 6) => { for (let i = 0; i < n; i++) { await rt.tick(); await new Promise(r => setTimeout(r, 5)); clock += 1000; } };

  await check('Prüft alle Coins mit AMD im Hintergrund; Coins ohne AMD bleiben unberührt', async () => {
    const rt = make(); await run(rt);
    assert.ok(rt.result('ETHUSDT', 'futures').ready && rt.result('SOLUSDT', 'futures').ready);
    assert.ok(!calls.some(c => c.startsWith('XRPUSDT')), calls.join()); assert.deepStrictEqual([...rt.state.entries.keys()].sort(), ['ETHUSDT|futures', 'SOLUSDT|futures']);
  });
  await check('Nur der Coin mit Durchbruch lädt 1m-Kerzen; der ruhige Coin zeigt nur die Accumulation (kein Signal)', async () => {
    assert.ok(calls.includes('ETHUSDT|1m')); assert.ok(!calls.includes('SOLUSDT|1m'), calls.join());
  });
  await check('Ruhiger Coin: Phase Accumulation, Stufe 1, kein Signal', async () => {
    const rt = make(); await run(rt, 4); const r = rt.result('SOLUSDT', 'futures'); assert.strictEqual(r.phase, 'accumulation'); assert.strictEqual(r.stage, 1); assert.strictEqual(r.signal, null);
  });
  await check('Bestätigter Coin: genau ein Versand mit allen Angaben, auch bei weiteren Durchläufen', async () => {
    sent.length = 0; const rt = make(); await run(rt, 10);
    const r = rt.result('ETHUSDT', 'futures'); assert.strictEqual(r.phase, 'signal');
    assert.strictEqual(sent.length, 1, 'Versand ' + sent.length); const s = sent[0];
    assert.strictEqual(s.analysisId, 'amd'); assert.strictEqual(s.symbol, 'ETHUSDT'); assert.strictEqual(s.side, 'long'); assert.ok(s.entry && s.stop && s.target && s.rr >= 2 && s.chart.length > 10 && s.boxes.distribution);
    await rt.dispatch(); await run(rt, 4); assert.strictEqual(sent.length, 1, 'kein zweiter Versand');
    assert.ok(logs.some(l => l.kind === 'signal' && /AMD · ETHUSDT Long bestätigt/.test(l.text)));
  });
  await check('Telegram aus (Zustellung lehnt ab): kein Verlust des Setups – nach dem Einschalten innerhalb der Gültigkeit wird gesendet, danach nie doppelt', async () => {
    sent.length = 0; signalResult = false; const rt = make(); await run(rt, 6); const before = sent.length; assert.ok(before >= 1);
    signalResult = true; await rt.dispatch(); const after = sent.length; assert.ok(after > before); await rt.dispatch(); await run(rt, 3); assert.strictEqual(sent.length, after);
  });
  await check('Nach Ablauf der Gültigkeit (15 Minuten) wird nicht mehr gesendet', async () => {
    sent.length = 0; signalResult = true; const rt = make(); const t = clock; clock = tj + Q + 16 * 60000; await run(rt, 6);
    assert.strictEqual(sent.length, 0); assert.strictEqual(rt.result('ETHUSDT', 'futures').signal, null); clock = t + 20000;
  });
  await check('Pause/offline: kein Abruf, Ergebnis nicht bereit mit Hinweis', async () => {
    const rt = make(); await run(rt, 3); calls.length = 0; ctx.paused = true; await run(rt, 3);
    assert.strictEqual(calls.length, 0); const r = rt.result('ETHUSDT', 'futures'); assert.strictEqual(r.ready, false); assert.match(r.reason, /pausiert/); ctx.paused = false;
  });
  await check('Falscher Börsenmarkt: Coin übersprungen mit Fehlertext, andere Coins laufen weiter', async () => {
    ctx.symbols.push({ symbol: 'BADUSDT', market: 'futures', analyses: ['amd'] }); const rt = make(); await run(rt, 10);
    const bad = rt.result('BADUSDT', 'futures'); assert.strictEqual(bad.ready, false); assert.match(bad.reason, /Börsenmarkt/); assert.ok(rt.result('SOLUSDT', 'futures').ready); ctx.symbols.pop();
  });
  await check('Zeitrahmen wechseln lädt neu (Optionen im Schlüssel); ungültiger Wert fällt auf 15m', async () => {
    const rt = make(); await run(rt, 4); calls.length = 0; ctx.options.amd.interval = '1h'; await run(rt, 4); assert.ok(calls.some(c => c.endsWith('|1h')), calls.join());
    ctx.options.amd.interval = 'abc'; await run(rt, 4); assert.ok(calls.some(c => c.endsWith('|15m')), calls.join()); ctx.options.amd.interval = '15m';
  });
  await check('Neue Kerzen werden erst zum Schluss geholt: ohne laufende Range/Durchbruch kein Abruf in derselben Kerze', async () => {
    const rt = make(); ctx.symbols = ctx.symbols.filter(s => s.symbol === 'SOLUSDT'); data.SOLUSDT.candles = quiet.map((c, i) => i < 19 ? c : bar(c.time, Q, 100, 106, 94, 100)); await run(rt, 3);
    // Range steht nicht (zu hohe Kerzen am Ende) → nicht „live“: nach dem ersten Lauf kein weiterer Abruf bis zum nächsten Schluss
    calls.length = 0; clock += 120000; await run(rt, 4); assert.strictEqual(calls.filter(c => c.endsWith('|15m')).length, 0, calls.join());
  });
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
})();
