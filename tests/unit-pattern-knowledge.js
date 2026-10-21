// 3.92.0 – Chartmuster-Wissen (shared/pattern-knowledge.mjs): Trefferzählung je Muster statt je Coin.
// Aufruf: node unit-pattern-knowledge.js
const assert = require('assert');
let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); pass++; console.log('✓ ' + name); } catch (e) { fail++; console.log('✗ ' + name + ' — ' + e.message.split('\n')[0]); } };
(async () => {
  const K = await import('../shared/pattern-knowledge.mjs');
  const H = 3600000, T0 = Date.UTC(2026, 8, 1);
  let id = 0;
  const mk = (o = {}) => { const base = { mkt: 'futures', sym: 'ETHUSDT', iv: '1h', pat: 'bullflag', dir: 'bull', model: 'pat-1', profile: 'H12-e0.10', src: 'live', tc: T0 + (id++) * H * 5, res: { out: 'auf' } }; return { ...base, ...o, res: o.res === null ? null : { ...base.res, ...(o.res || {}) } }; };
  const many = (n, wins, extra = {}) => Array.from({ length: n }, (_, i) => mk({ ...extra, sym: extra.sym ?? `C${i % 12}USDT`, res: { out: i < wins ? 'auf' : i % 3 ? 'ab' : 'seitwärts' } }));
  const sel = { pat: 'bullflag', iv: '1h', dir: 'bull', sym: 'ETHUSDT', mkt: 'futures' };

  check('Zählung über alle Coins: Anzahl, Treffer in Musterrichtung, Coins, Zeitraum', () => {
    const L = K.patternLearned(many(40, 14), sel); assert.strictEqual(L.n, 40); assert.strictEqual(L.yes, 14); assert.strictEqual(L.up, 14); assert.strictEqual(L.coins, 12); assert.strictEqual(L.source, 'live protokolliert'); assert.strictEqual(L.scope, 'alle Coins');
    assert.ok(Math.abs(L.rate - .35) < 1e-9); assert.ok(L.from < L.to); assert.strictEqual(L.minimum, 30); assert.strictEqual(L.horizon, 12);
  });
  check('Unter 30 Fällen: nicht bewertet, mit Zähler (nicht je Coin: Fälle anderer Coins zählen mit)', () => {
    const L = K.patternLearned(many(21, 5), sel); assert.deepStrictEqual(L, { available: 21, minimum: 30 });
    assert.deepStrictEqual(K.patternLearned([], sel), { available: 0, minimum: 30 });
  });
  check('Anderes Muster, anderes Intervall, andere Richtung, anderes Modell/Profil zählen nicht', () => {
    const cases = [...many(30, 10), ...many(20, 20, { pat: 'bearflag' }), ...many(20, 20, { iv: '15m' }), ...many(20, 20, { dir: 'bear' }), ...many(20, 20, { model: 'pat-2' }), ...many(20, 20, { profile: 'H6-e0.05' })];
    const L = K.patternLearned(cases, sel); assert.strictEqual(L.n, 30); assert.strictEqual(L.yes, 10);
  });
  check('Richtung Short zählt „ab“ als Treffer', () => {
    const cases = many(35, 0, { pat: 'bearflag', dir: 'bear' }).map((c, i) => ({ ...c, res: { out: i < 20 ? 'ab' : 'auf' } }));
    const L = K.patternLearned(cases, { ...sel, pat: 'bearflag', dir: 'bear' }); assert.strictEqual(L.yes, 20); assert.strictEqual(L.down, 20);
  });
  check('Spot und Futures zusammen; derselbe Coin zur selben Bestätigungskerze zählt nur einmal', () => {
    const a = many(30, 12, { mkt: 'futures' }), dup = a.map(c => ({ ...c, mkt: 'spot', res: { out: c.res.out === 'auf' ? 'ab' : 'auf' } }));
    const L = K.patternLearned([...a, ...dup], sel); assert.strictEqual(L.n, 30, 'keine Doppelzählung'); assert.strictEqual(L.yes, 12, 'bei gleichem Ereignis zählt der gewählte Markt (Futures)');
    const L2 = K.patternLearned([...a, ...dup], { ...sel, mkt: 'spot' }); assert.strictEqual(L2.yes, 18, 'gewählter Markt Spot hat Vorrang');
    const spotOnly = K.patternLearned(many(32, 8, { mkt: 'spot' }), sel); assert.strictEqual(spotOnly.n, 32);
  });
  check('Live vor rekonstruiert: erst ab 30 Live-Fällen, sonst rekonstruiert; getrennt, nie gemischt', () => {
    const live = many(12, 6, { src: 'live' }), rek = many(40, 10, { src: 'rekonstruiert' });
    const L = K.patternLearned([...live, ...rek], sel); assert.strictEqual(L.source, 'rekonstruiert'); assert.strictEqual(L.n, 40);
    const L2 = K.patternLearned([...many(31, 15, { src: 'live' }), ...rek], sel); assert.strictEqual(L2.source, 'live protokolliert'); assert.strictEqual(L2.n, 31);
  });
  check('Offene Fälle (ohne Ergebnis) und ungültige Ergebnisse zählen nicht', () => {
    const cases = [...many(30, 9), mk({ res: null }), mk({ res: { out: 'kaputt' } }), { ...mk(), tc: NaN }];
    assert.strictEqual(K.patternLearned(cases, sel).n, 30);
  });
  check('Zeitpunkte: Fälle derselben Stunde sind ein Zeitpunkt; der Bereich rechnet damit (breiter als bei unabhängigen Fällen)', () => {
    const t = T0, spread = Array.from({ length: 40 }, (_, i) => mk({ sym: `C${i}USDT`, tc: t + i * 5 * H, res: { out: i < 18 ? 'auf' : 'ab' } })), burst = Array.from({ length: 40 }, (_, i) => mk({ sym: `C${i}USDT`, tc: t + (i % 4) * 5 * H + i * 60000, res: { out: i < 18 ? 'auf' : 'ab' } }));
    const a = K.patternLearned(spread, sel), b = K.patternLearned(burst, sel);
    assert.strictEqual(a.moments, 40); assert.strictEqual(b.moments, 4); assert.strictEqual(a.n, b.n); assert.strictEqual(a.yes, b.yes);
    assert.ok(b.hi - b.lo > a.hi - a.lo, `${b.lo}-${b.hi} gegenüber ${a.lo}-${a.hi}`); assert.ok(a.lo < a.rate && a.rate < a.hi);
  });
  check('Zeitpunkt-Fenster: mindestens eine Stunde, bei 1d ein Tag', () => {
    const day = Array.from({ length: 35 }, (_, i) => mk({ iv: '1d', sym: `C${i}USDT`, tc: T0 + Math.floor(i / 7) * 86400000 + (i % 7) * H, res: { out: 'auf' } }));
    assert.strictEqual(K.patternLearned(day, { ...sel, iv: '1d' }).moments, 5);
  });
  check('Coin-Zahl nur ab 30 eigenen Fällen; sonst fehlt sie, die Zahl der eigenen Fälle bleibt sichtbar', () => {
    const own = Array.from({ length: 12 }, (_, i) => mk({ sym: 'ETHUSDT', res: { out: i < 2 ? 'auf' : 'ab' } })), L = K.patternLearned([...many(40, 14), ...own], sel);
    assert.strictEqual(L.coin, null); assert.strictEqual(L.coinAvailable, 12 + many(40, 14).filter(c => c.sym === 'ETHUSDT').length);
    const heavy = Array.from({ length: 32 }, (_, i) => mk({ sym: 'ETHUSDT', res: { out: i < 8 ? 'auf' : 'ab' } })), L2 = K.patternLearned(heavy, sel);
    assert.deepStrictEqual(L2.coin, { n: 32, yes: 8, rate: .25 });
  });
  check('Wilson-Bereich: 0/10, 1/10 und 40/100 wie von Hand gerechnet', () => {
    const r = (y, n) => { const w = K.wilson(y, n); return [w.lo, w.hi].map(v => Math.round(v * 100)); };
    assert.deepStrictEqual(r(0, 10), [0, 28]); assert.deepStrictEqual(r(1, 10), [2, 40]); assert.deepStrictEqual(r(40, 100), [31, 50]); assert.strictEqual(K.wilson(1, 0), null);
  });
  check('Zufallsvergleich aus den letzten 250 Kerzen: Anteil auf/ab/seitwärts nach 12 Kerzen; zu kurze Reihen liefern nichts', () => {
    const up = Array.from({ length: 300 }, (_, i) => ({ t: i, c: 100 * 1.001 ** i })), b = K.patternBaseline(up);
    assert.strictEqual(b.n, 250); assert.strictEqual(b.auf, 250); assert.strictEqual(b.ab, 0);
    const flat = K.patternBaseline(Array.from({ length: 120 }, (_, i) => ({ t: i, c: 100 + (i % 2) * 0.01 }))); assert.strictEqual(flat.sw, flat.n);
    assert.strictEqual(K.patternBaseline(Array.from({ length: 40 }, (_, i) => ({ t: i, c: 100 + i }))), null); assert.strictEqual(K.patternBaseline(null), null);
  });
  check('Vergleich im Erlernt-Objekt: Richtung beachtet (Short zählt „ab“); ohne Kerzen fehlt er', () => {
    const base = { n: 250, auf: 100, ab: 140, sw: 10 }, bull = K.patternLearned(many(35, 12), sel, { baseline: base }), bear = K.patternLearned(many(35, 12, { dir: 'bear', pat: 'bearflag' }), { ...sel, dir: 'bear', pat: 'bearflag' }, { baseline: base });
    assert.deepStrictEqual(bull.base, { n: 250, yes: 100, rate: .4 }); assert.deepStrictEqual(bear.base, { n: 250, yes: 140, rate: .56 }); assert.strictEqual(K.patternLearned(many(35, 12), sel).base, null);
  });
  check('Eingaben werden nicht verändert; leere/fehlende Listen brechen nicht ab', () => {
    const cases = many(31, 10), copy = JSON.stringify(cases); K.patternLearned(cases, sel); assert.strictEqual(JSON.stringify(cases), copy);
    assert.deepStrictEqual(K.patternLearned(undefined, sel), { available: 0, minimum: 30 });
  });
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
})();
