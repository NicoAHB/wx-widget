// 3.84.0 – Gesamtmarkt-Lage (shared/market-context.mjs, .github/markt/build.mjs). Aufruf: node unit-market-context.js
const assert = require('node:assert/strict'), fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
let pass = 0, fail = 0;
const check = async (name, fn) => { try { await fn(); pass++; console.log('✓ ' + name); } catch (e) { fail++; console.log('✗ ' + name + ' — ' + (e.stack || e.message)); } };
const H = 36e5, D = 864e5, NOW = Date.UTC(2026, 9, 20, 12, 0);
const raw = (over = {}) => ({ data: { market_cap_percentage: { btc: 54.321, eth: 12.4, usdt: 4.1, usdc: 1.2 }, total_market_cap: { usd: 3.2e12 }, market_cap_change_percentage_24h_usd: 1.234, updated_at: Math.floor(NOW / 1000) - 60, ...over } });
const point = (t, btc, stable = 5.3) => ({ t, btc, eth: 12, stable, total: 3e12, chg24: 0 });
const days = (n, f) => Array.from({ length: n }, (_, i) => ({ time: Date.UTC(2026, 9, 20) - (n - 1 - i) * D, close: f(i) }));
(async () => {
  const M = await import('../shared/market-context.mjs');
  await check('Messpunkt aus der CoinGecko-Antwort: Anteile, Stablecoins = USDT + USDC, Gesamtwert, Zeit aus der Antwort', () => {
    const s = M.snapshotFromGlobal(raw(), NOW); assert.deepEqual(s, { t: (Math.floor(NOW / 1000) - 60) * 1000, btc: 54.321, eth: 12.4, stable: 5.3, total: 3.2e12, chg24: 1.234 });
  });
  await check('Unplausible Antworten ergeben keinen Messpunkt (Dominanz außerhalb, fehlende Felder, zu kleiner Gesamtwert)', () => {
    for (const bad of [raw({ market_cap_percentage: { btc: 5, eth: 12 } }), raw({ market_cap_percentage: { btc: 95, eth: 1 } }), raw({ market_cap_percentage: { eth: 12 } }), raw({ total_market_cap: { usd: 5e9 } }), raw({ total_market_cap: {} }), {}, null, { data: null }]) assert.equal(M.snapshotFromGlobal(bad, NOW), null);
    assert.equal(M.snapshotFromGlobal(raw({ updated_at: 1 }), NOW).t, NOW, 'veralteter Zeitstempel → jetzt'); assert.equal(M.snapshotFromGlobal(raw({ market_cap_change_percentage_24h_usd: undefined }), NOW).chg24, null);
  });
  await check('Verlauf: neuer Punkt nach mindestens 50 Minuten, sonst nicht; ältere Zeitstempel und kaputte Punkte fliegen raus; höchstens 336', () => {
    let h = M.mergeHistory(null, point(NOW, 54), NOW); assert.equal(h.history.length, 1); assert.equal(h.v, 1);
    assert.equal(M.mergeHistory(h, point(NOW + 10 * 60000, 54.1), NOW).history.length, 1, 'zu dicht'); assert.equal(M.mergeHistory(h, point(NOW - H, 54.1), NOW).history.length, 1, 'älter als der letzte');
    h = M.mergeHistory(h, point(NOW + H, 54.2), NOW + H); assert.deepEqual(h.history.map(p => p.btc), [54, 54.2]);
    assert.equal(M.mergeHistory({ history: [{ t: 1 }, point(NOW, 54), null] }, point(NOW + H, 54.2), NOW).history.length, 2, 'kaputte Punkte entfernt');
    let big = { history: Array.from({ length: 336 }, (_, i) => point(NOW - (400 - i) * H, 50)) }; big = M.mergeHistory(big, point(NOW, 55), NOW); assert.equal(big.history.length, 336); assert.equal(big.history.at(-1).btc, 55); assert.equal(big.history[0].t, NOW - 399 * H);
    assert.equal(M.mergeHistory(h, null, NOW).history.length, 2);
  });
  await check('Datei prüfen: Format, leer, sortiert', () => {
    assert.throws(() => M.parseMarketContext({ v: 2, history: [] }), /unbekanntes Format/); assert.throws(() => M.parseMarketContext(null), /unbekanntes Format/); assert.throws(() => M.parseMarketContext({ v: 1, history: [{ t: 1 }] }), /noch keine Messpunkte/);
    const p = M.parseMarketContext({ v: 1, updated: new Date(NOW).toISOString(), history: [point(NOW, 54), point(NOW - H, 53)] }); assert.deepEqual(p.history.map(x => x.btc), [53, 54]); assert.equal(p.updated, NOW);
  });
  await check('Veränderung über 24 h und 7 Tage: nahester Punkt im Toleranzfenster, sonst null', () => {
    const hist = Array.from({ length: 24 * 8 }, (_, i) => point(NOW - (24 * 8 - 1 - i) * H, 50 + i * .01)); // stündlich, steigend 0,01 pp je Stunde
    assert.ok(Math.abs(M.historyChange(hist, 'btc', D) - .24) < 1e-9); assert.ok(Math.abs(M.historyChange(hist, 'btc', 7 * D) - 1.68) < 1e-9);
    assert.equal(M.historyChange(hist.filter(p => NOW - p.t < 20 * H), 'btc', D), null, 'kein Punkt rund um „vor 24 h“'); assert.equal(M.historyChange([], 'btc', D), null); assert.equal(M.historyChange([point(NOW, 50)], 'btc', D), null);
  });
  await check('ETH/BTC aus Tageskerzen: Prozent gegenüber dem Schluss vor n Tagen; nur bei lückenlosen Tagen', () => {
    const r = days(10, i => 0.03 * (1 + i * .01)); assert.ok(Math.abs(M.ethBtcChange(r, 1) - ((1.09 / 1.08) - 1) * 100) < 1e-9); assert.ok(Math.abs(M.ethBtcChange(r, 7) - ((1.09 / 1.02) - 1) * 100) < 1e-9);
    assert.equal(M.ethBtcChange(r.slice(-5), 7), null, 'zu wenige Tage'); assert.equal(M.ethBtcChange([...r.slice(0, 4), ...r.slice(5)], 7), null, 'Tag fehlt'); assert.equal(M.ethBtcChange([], 1), null); assert.equal(M.ethBtcChange(null, 1), null);
  });
  await check('Urteil: sinkende Dominanz und steigendes ETH/BTC → Altcoins; steigende Dominanz und fallendes ETH/BTC → Bitcoin; gemischt → neutral', () => {
    const hist = (d7) => Array.from({ length: 24 * 8 }, (_, i) => point(NOW - (24 * 8 - 1 - i) * H, 54 + d7 * (i / (24 * 8 - 1)) * (8 / 7)));
    const alt = M.marketContext({ history: hist(-1), ethbtc: days(10, i => 0.03 * (1 + i * .004)), now: NOW }); assert.equal(alt.status, 'alt'); assert.match(alt.headline, /Altcoins laufen.*besser/); assert.ok(alt.dom7 < -.5 && alt.ethBtc.d7 > 1.5);
    const btc = M.marketContext({ history: hist(1), ethbtc: days(10, i => 0.03 * (1 - i * .004)), now: NOW }); assert.equal(btc.status, 'btc'); assert.match(btc.headline, /Bitcoin läuft.*besser/);
    const mixed = M.marketContext({ history: hist(-1), ethbtc: days(10, i => 0.03 * (1 - i * .004)), now: NOW }); assert.equal(mixed.status, 'neutral'); assert.equal(mixed.score, 0);
    const only = M.marketContext({ history: hist(-1), ethbtc: [], now: NOW }); assert.equal(only.status, 'alt', 'auch mit nur einer Größe'); assert.equal(only.known, 1);
    const none = M.marketContext({ history: [point(NOW, 54)], ethbtc: [], now: NOW }); assert.equal(none.status, 'unknown'); assert.match(none.headline, /zu wenig Verlauf/);
  });
  await check('veraltet nach 6 Stunden ohne neuen Punkt; Stablecoin-Hinweis bei ±0,3 Punkten über 7 Tage', () => {
    const hist = Array.from({ length: 24 * 8 }, (_, i) => point(NOW - (24 * 8 - 1 - i) * H, 54, 5 + i * .004));
    assert.equal(M.marketContext({ history: hist, now: NOW }).stale, false); assert.equal(M.marketContext({ history: hist, now: NOW + 7 * H }).stale, true); assert.equal(M.marketContext({ history: [], now: NOW }).stale, true);
    assert.match(M.marketContext({ history: hist, now: NOW }).hint, /Stablecoin-Anteil steigt/); const down = hist.map((p, i) => ({ ...p, stable: 7 - i * .004 })); assert.match(M.marketContext({ history: down, now: NOW }).hint, /sinkt: mehr Risikobereitschaft/);
    assert.equal(M.marketContext({ history: hist.map(p => ({ ...p, stable: 5 })), now: NOW }).hint, '');
  });
  await check('Ablauf-Skript: schreibt Verlauf aus einer Antwortdatei fort; unplausible Antwort → Ausgang 3 ohne Datei', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'markt-')), script = path.join(__dirname, '../.github/markt/build.mjs'), run = (...a) => cp.spawnSync(process.execPath, [script, ...a], { encoding: 'utf8' });
    const g = path.join(dir, 'global.json'), prev = path.join(dir, 'prev.json'), out = path.join(dir, 'out.json'), now = Date.now();
    fs.writeFileSync(g, JSON.stringify(raw({ updated_at: Math.floor(now / 1000) })));
    let r = run(path.join(dir, 'fehlt.json'), out, '--global', g); assert.equal(r.status, 0, r.stderr); let o = JSON.parse(fs.readFileSync(out, 'utf8')); assert.equal(o.history.length, 1); assert.equal(o.history[0].btc, 54.321); assert.match(r.stdout, /1 Messpunkte.*54.321/);
    fs.writeFileSync(prev, JSON.stringify({ v: 1, history: [point(now - 2 * H, 53.9)] })); r = run(prev, out, '--global', g); assert.equal(r.status, 0); o = JSON.parse(fs.readFileSync(out, 'utf8')); assert.deepEqual(o.history.map(p => p.btc), [53.9, 54.321]);
    fs.rmSync(out); fs.writeFileSync(g, JSON.stringify(raw({ market_cap_percentage: { btc: 5, eth: 1 } }))); r = run(prev, out, '--global', g); assert.equal(r.status, 3); assert.match(r.stderr, /unplausibel/); assert.equal(fs.existsSync(out), false);
    assert.equal(run().status, 2); fs.rmSync(dir, { recursive: true });
  });
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})();
