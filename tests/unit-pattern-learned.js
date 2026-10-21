// 3.92.0 / Dienst 2.17.0 – Meldungsdaten des Dienstes (server/pattern-monitor.mjs): „Erlernt“ je Muster über alle Coins, Zufallsvergleich aus den Kerzen.
// Aufruf: node unit-pattern-learned.js
const assert = require('assert');
let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); pass++; console.log('✓ ' + name); } catch (e) { fail++; console.log('✗ ' + name + ' — ' + e.message.split('\n')[0]); } };
(async () => {
  const M = await import('../server/pattern-monitor.mjs');
  const H = 3600000, T0 = Date.UTC(2026, 8, 1);
  const kase = (i, o = {}) => ({ mkt: i % 2 ? 'futures' : 'spot', sym: `C${i % 6}USDT`, iv: '1h', pat: 'double_bottom', dir: 'bull', model: 'pat-1', profile: 'H12-e0.10', src: 'live', tc: T0 + i * 5 * H, res: { out: i < 20 ? 'auf' : 'ab' }, ...o });
  const archive = Array.from({ length: 36 }, (_, i) => kase(i));
  const c = { mkt: 'futures', sym: 'C0USDT', iv: '1h', pat: 'double_bottom', dir: 'bull', model: 'pat-1', profile: 'H12-e0.10', p0: 100, q: 90, tc: T0 + 500 * H, t0: T0 + 480 * H, t1: T0 + 499 * H, at: T0 + 500 * H };
  const h = { levels: { tgt: 105, inv: 95 }, status: 'Ausbruch bestätigt', lines: [] };
  const candles = Array.from({ length: 300 }, (_, i) => ({ t: T0 + i * H, o: 100, h: 101, l: 99, c: 100 * 1.0004 ** i, v: 10 }));

  check('Dienst zählt je Muster über alle Coins und Märkte (36 Fälle, 20 in Musterrichtung), nicht je Coin', () => {
    const d = M.patternMessageData(c, h, archive); assert.strictEqual(d.learned.n, 36); assert.strictEqual(d.learned.yes, 20); assert.strictEqual(d.learned.coins, 6); assert.strictEqual(d.learned.source, 'live protokolliert'); assert.strictEqual(d.learned.minimum, 30);
  });
  check('Meldungstext: Hauptzeile mit Anteil und „alle Coins“, darunter Bereich; ohne Kerzen kein Zufallsvergleich, Coin-Zahl erst ab 30 eigenen Fällen', () => {
    const t = M.patternText(c, h, archive); assert.match(t, /📚 Erlernt: 20\/36 Fälle in Musterrichtung \(56 %\) · alle Coins · live protokolliert/); assert.match(t, /↳ Bereich \d+–\d+ % \(36 Zeitpunkte, 6 Coins\)/); assert.ok(!/Dieser Coin|Ohne Muster/.test(t), t);
  });
  check('Mit Kerzen: Zufallsvergleich der letzten 250 Kerzen (steigender Coin → 100 % aufwärts)', () => {
    const d = M.patternMessageData(c, h, archive, null, candles); assert.deepStrictEqual(d.learned.base, { n: 250, yes: 250, rate: 1 }); assert.match(M.patternText(c, h, archive, null, candles), /↳ Ohne Muster: 100 % \(letzte 250 Kerzen\)/);
  });
  check('Unter 30 Fällen: „noch nicht bewertet (x/30 Fälle dieses Musters)“; Fälle anderer Coins zählen mit', () => {
    const t = M.patternText(c, h, archive.slice(0, 12)); assert.match(t, /📚 Erlernt: noch nicht bewertet \(12\/30 Fälle dieses Musters\)/); assert.ok(!/↳/.test(t));
  });
  check('Eigener Coin ab 30 eigenen Fällen: „Dieser Coin: x/n“', () => {
    const own = Array.from({ length: 32 }, (_, i) => kase(i, { sym: 'C0USDT', tc: T0 + i * 7 * H, res: { out: i < 8 ? 'auf' : 'ab' } })), t = M.patternText(c, h, own);
    assert.match(t, /↳ Dieser Coin: 8\/32/);
  });
  check('Andere Richtung/anderes Intervall im Archiv verfälschen die Zahl nicht', () => {
    const noise = Array.from({ length: 40 }, (_, i) => kase(i, { dir: i % 2 ? 'bear' : 'bull', iv: i % 3 ? '15m' : '1h', pat: i % 5 ? 'double_top' : 'double_bottom', tc: T0 + (900 + i) * H }));
    const d = M.patternMessageData(c, h, [...archive, ...noise.filter(n => n.pat !== 'double_bottom' || n.iv !== '1h' || n.dir !== 'bull')]); assert.strictEqual(d.learned.n, 36);
  });
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
})();
