// 3.72.0: unveränderte Baseline, fünf Pflichtregeln und kausaler gepaarter Vergleich.
const fs = require('fs'), assert = require('assert/strict');
let passed = 0, failed = 0;
function check(name, fn) { try { fn(); passed++; console.log('✓ ' + name); } catch (e) { failed++; console.log('✗ ' + name + ' — ' + e.message); } }
const END = Date.UTC(2026, 9, 15, 12), M = 900000, H = 14400000;
const candles = (prices, step = M, end = END) => prices.map((close, i) => ({ time: end - (prices.length - i) * step, end: end - (prices.length - i - 1) * step, open: close, high: close + .1, low: close - .1, close, volume: 100 }));
const range = (n, a, b) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
const mirror = rows => rows.map(c => ({ ...c, open: 400 - c.open, high: 400 - c.low, low: 400 - c.high, close: 400 - c.close }));
(async () => {
  const a = await import('../shared/watch-model-core.mjs');
  const html = fs.readFileSync(require('path').join(__dirname, '../weather-widget-v2.html'), 'utf8');
  const { rsiSignal } = await import('../shared/rsi-momentum.mjs');
  const { neutralMacdSignal } = await import('../shared/indicators.mjs');
  const IND = await import('../shared/indicators.mjs'); // 3.84.0: rsi/ema/macd stammen aus shared/indicators.mjs
  const original = new Function('rsiSignal', 'rsi', 'ema', 'macd', html.slice(html.indexOf('function signalRating('), html.indexOf('\nfunction overallRating(')) + '\nreturn signalRating;')(rsiSignal, IND.rsi, IND.ema, IND.macd);
  for (const [name, prices] of [['aufwärts', range(700, 100, 200)], ['abwärts', range(700, 200, 100)], ['neutral', Array(700).fill(100)], ['wechselnd', Array.from({ length: 700 }, (_, i) => 100 + Math.sin(i / 5) * 6 + Math.cos(i / 11))]]) {
    check('Live-Anzeige und Backtest verwenden dieselbe neue RSI-Regel: ' + name, () => assert.deepEqual(a.watchClassicRating(candles(prices).slice(-199)), original(candles(prices).slice(-199))));
  }
  const higher = candles(range(500, 80, 180), H); let lower, strict;
  outer: for (const count of [8, 12, 16, 20, 25, 30]) for (const slope of [.2, .4, .6, 1]) for (const bounce of [1, 2, 3, 5, 8, 12]) {
    const prices = [...range(499 - count, 100, 200), ...Array.from({ length: count }, (_, i) => 200 - (i + 1) * slope), 200 - count * slope + bounce];
    const rows = candles(prices); rows.at(-1).volume = 250;
    const result = a.watchStrictRating({ lower: rows, higher, now: END });
    if (result.direction === 1) { lower = rows; strict = result; break outer; }
  }
  check('Echte OHLCV-Reihe erfüllt alle fünf Long-Regeln', () => { assert.ok(lower); assert.equal(strict.longCount, 5); assert.equal(strict.direction, 1); });
  if (!lower) throw new Error('Long-Testfixture fehlt');
  check('Spiegelbild erfüllt fünf Short-Regeln', () => { const r = a.watchStrictRating({ lower: mirror(lower), higher: mirror(higher), now: END }); assert.equal(r.shortCount, 5); assert.equal(r.direction, -1); });
  for (const direction of [1, -1]) for (let rule = 0; rule < 5; rule++) {
    check(`Richtung ${direction}: jede einzelne fehlende Regel ${rule + 1} sperrt 5/5`, () => {
      const l = a.watchFeatures(direction === 1 ? lower : mirror(lower)), h = a.watchFeatures(direction === 1 ? higher : mirror(higher));
      if (rule === 0) h.at(-1).close = h.at(-1).ema;
      if (rule === 1) l.at(-1).close = l.at(-1).ema;
      if (rule === 2) l.at(-1).rsi = direction === 1 ? 30 : 70;
      if (rule === 3) l.at(-1).macd = l.at(-1).signal;
      if (rule === 4) l.at(-1).volume = 119;
      const g = a.watchStrictGates(l, h), chosen = direction === 1 ? g.long : g.short;
      assert.equal(chosen.filter(Boolean).length, 4);
    });
  }
  for (const [name, change] of [
    ['zu wenig Vorlauf', x => x.splice(0, 250)], ['Lücke', x => x.splice(10, 1)], ['Duplikat', x => x[10] = { ...x[9] }],
    ['NaN', x => x[10].close = NaN], ['negatives Volumen', x => x[10].volume = -1], ['falsches Hoch', x => x[10].high = 1], ['falsche Zeit', x => x[10].time++]
  ]) check(name + ' verhindert ein Signal', () => { const l = structuredClone(lower); change(l); assert.equal(a.watchStrictRating({ lower: l, higher, now: END }).ready, false); });
  check('Veraltete 15m-Kerze verhindert Signal', () => assert.equal(a.watchStrictRating({ lower, higher, now: END + M }).ready, false));
  check('Veraltete 4h-Kerze verhindert Signal', () => assert.equal(a.watchStrictRating({ lower, higher: higher.slice(0, -1), now: END }).ready, false));
  check('Zukünftige und laufende Kerzen ändern die Entscheidung nicht', () => {
    const l = [...lower, ...candles([1], M, END + M)], h = [...higher, ...candles([1], H, END + H)];
    assert.deepEqual(a.watchStrictRating({ lower: l, higher: h, now: END }), strict);
  });
  check('Später bekannt gewordene Kerze kann nicht früher verwendet werden', () => { const h = structuredClone(higher); h.at(-1).knownAt = END + 1; assert.equal(a.watchStrictRating({ lower, higher: h, now: END }).ready, false); });
  check('Volumenbasis schließt Kandidatenkerze aus; genau 1,2× genügt', () => { const l = structuredClone(lower); l.at(-1).volume = 120; const r = a.watchStrictRating({ lower: l, higher, now: END }); assert.equal(r.volumeRatio, 1.2); assert.equal(r.direction, 1); });
  check('Neue feste Modellversion und Volumenfaktor sind eindeutig', () => { assert.equal(a.WATCH_MODELS.strict, 'watch-strict-2'); assert.equal(a.WATCH_PULLBACK.volumeMultiple, 1.2); });
  for (const direction of [1, -1]) {
    const get = () => ({ low: a.watchFeatures(direction === 1 ? lower : mirror(lower)), high: a.watchFeatures(direction === 1 ? higher : mirror(higher)) }), key = direction === 1 ? 'long' : 'short';
    check(`Richtung ${direction}: MACD bestätigt auch ohne Kreuzung auf derselben Kerze`, () => { const { low, high } = get(), c = low.at(-1), p = low.at(-2); c.macd = direction * .4; c.signal = 0; p.macd = direction * .2; p.signal = 0; assert.equal(a.watchStrictGates(low, high)[key].filter(Boolean).length, 5); });
    check(`Richtung ${direction}: nachlassendes MACD-Histogramm sperrt die Freigabe`, () => { const { low, high } = get(), c = low.at(-1), p = low.at(-2); c.macd = direction * .2; c.signal = 0; p.macd = direction * .4; p.signal = 0; assert.equal(a.watchStrictGates(low, high)[key][3], false); });
    check(`Richtung ${direction}: RSI muss einen vorherigen Rücksetzer enthalten`, () => { const { low, high } = get(); for (const c of low.slice(-9, -1)) c.rsi = 49 + (direction === -1 ? 2 : 0); assert.equal(a.watchStrictGates(low, high)[key][2], false); });
    check(`Richtung ${direction}: genau acht vorherige RSI-Kerzen, ältere zählen nicht`, () => { const { low, high } = get(); for (const c of low.slice(-9, -1)) c.rsi = direction === 1 ? 49 : 51; low.at(-1).rsi = direction === 1 ? 55 : 45; low.at(-9).rsi = direction === 1 ? 45 : 55; assert.equal(a.watchStrictGates(low, high)[key][2], true); low.at(-10).rsi = low.at(-9).rsi; low.at(-9).rsi = direction === 1 ? 49 : 51; assert.equal(a.watchStrictGates(low, high)[key][2], false); });
    for (const boundary of [50, direction === 1 ? 70 : 30]) check(`Richtung ${direction}: RSI-Grenze ${boundary} bleibt gesperrt`, () => { const { low, high } = get(); low.at(-1).rsi = boundary; assert.equal(a.watchStrictGates(low, high)[key][2], false); });
    check(`Richtung ${direction}: RSI muss sich aktuell weiter erholen`, () => { const { low, high } = get(); low.at(-2).rsi = low.at(-1).rsi; assert.equal(a.watchStrictGates(low, high)[key][2], false); });
  }
  check('Volumen knapp unter 1,2× reicht weiterhin nicht', () => { const l = structuredClone(lower); l.at(-1).volume = 119.999; assert.equal(a.watchStrictRating({ lower: l, higher, now: END }).direction, 0); });
  for (const direction of [1, -1]) {
    const config = a.watchCompareSettings(), plan = a.watchExecution(100, direction, 1, config), pos = { ...plan, symbol: 'BTCUSDT', direction, entryIndex: 1 };
    check(`Kostenrichtung ${direction}: modellierter Stop ist netto genau −1 R`, () => {
      const b = { time: 0, end: M, open: 100, low: 90, high: 110, close: 100 }, t = a.watchTradeStep(pos, b, 1, config); assert.equal(t.reason, 'Stop'); assert.ok(Math.abs(t.netR + 1) < 1e-12);
    });
    check(`Kostenrichtung ${direction}: ungünstige Kurslücke kann mehr als 1 R verlieren`, () => {
      const open = direction === 1 ? 90 : 110, b = { time: 0, end: M, open, low: open - 1, high: open + 1, close: open }, t = a.watchTradeStep(pos, b, 2, config); assert.ok(t.netR < -1);
    });
  }
  check('Zeitablauf zählt erst nach festgelegten Kerzen', () => { const s = a.watchCompareSettings({ holdBars: 2 }), p = { ...a.watchExecution(100, 1, 1, s), direction: 1, entryIndex: 10 }, b = { open: 100, high: 100, low: 100, close: 100, end: END }; assert.equal(a.watchTradeStep(p, b, 10, s), null); assert.equal(a.watchTradeStep(p, b, 11, s).reason, 'Zeitablauf'); });
  check('Ungültige Vergleichseinstellungen werden abgewiesen', () => { assert.throws(() => a.watchCompareSettings({ feePct: NaN })); assert.throws(() => a.watchCompareSettings({ days: 91 })); assert.throws(() => a.watchCompareSettings({ holdBars: 2.2 })); assert.throws(() => a.watchCompareSettings({ fake: 1 })); });
  const future = Array.from({ length: 24 }, (_, i) => { const close = lower.at(-1).close + Math.sin(i) * .2; return { time: END + i * M, end: END + (i + 1) * M, open: close, high: close + .3, low: close - .3, close, volume: 100 }; });
  const l = [...lower, ...future], hh = [...higher, ...candles([180.1], H, END + H)];
  const result = await a.compareWatchModels({ lower: l, higher: hh, symbol: 'BTCUSDT', from: END, asOf: END + 24 * M, settings: { holdBars: 4 } });
  check('Vergleich: jedes Modell separat, gleicher Zeitraum und Ausführung', () => { assert.ok(result.models.classic); assert.ok(result.models.strict); assert.equal(result.from, END); assert.equal(result.asOf, END + 24 * M); });
  check('Vergleich: bestätigtes Signal wird erst an nächster Öffnung eingestiegen', () => { const t = result.models.strict.trades[0]; assert.equal(t.signalAt, END); assert.equal(t.entryAt, END); assert.equal(t.entry, future[0].open * 1.0002); });
  check('Vergleich: keine nachträgliche Gewinnbuchung offener Fälle', () => { for (const book of Object.values(result.models)) { assert.equal(book.stats.trades, book.trades.length); assert.ok(book.trades.every(t => t.entryAt < t.exitAt && t.exitAt <= result.asOf)); } });
  const same = await a.compareWatchModels({ lower: [...l, ...candles([1], M, END + 25 * M)], higher: [...hh, ...candles([1], H, END + 2 * H)], symbol: 'BTCUSDT', from: END, asOf: END + 24 * M, settings: { holdBars: 4 } });
  check('Vergleich ist unverändert bei später angehängten Kerzen', () => assert.deepEqual(same, result));
  let aborted = false;
  try { await a.compareWatchModels({ lower: l, higher: hh, symbol: 'BTCUSDT', from: END, asOf: END + 24 * M, cancelled: () => true }); } catch { aborted = true; }
  check('Vergleich kann abgebrochen werden', () => assert.ok(aborted));
  check('Statistik enthält offene/wartende Fälle separat', () => { const s = a.watchComparisonStats([{ symbol: 'BTCUSDT', exitAt: 1, netR: 2 }, { symbol: 'BTCUSDT', exitAt: 2, netR: -1 }], { open: 1, pending: 2 }); assert.equal(s.averageR, .5); assert.equal(s.profitFactor, 2); assert.equal(s.realizedDrawdownR, 1); assert.equal(s.open, 1); assert.equal(s.pending, 2); });
  check('Keine Trefferquote oder unendlicher Profitfaktor bei null Trades', () => { const s = a.watchComparisonStats([]); assert.equal(s.winRate, null); assert.equal(s.averageR, null); assert.equal(s.profitFactor, null); });
  check('Filterdiagnose zählt Einzelregeln und vollständige Signal-Kerzen', () => { const d = result.diagnostics; assert.equal(d.bars, 25); assert.equal(d.rules.length, 5); assert.equal(d.allLong + d.allShort, result.models.strict.stats.signals); assert.ok(d.rules.every(r => r.longPass <= d.bars && r.shortPass <= d.bars)); });
  check('Filterdiagnose lässt sich über dieselben Coins korrekt summieren', () => { const d = a.summarizeWatchDiagnostics([result, result]); assert.equal(d.bars, 2 * result.diagnostics.bars); assert.equal(d.allLong, 2 * result.diagnostics.allLong); assert.equal(d.rules[0].longPass, 2 * result.diagnostics.rules[0].longPass); });
  check('Alte oder beschädigte Filterdiagnosen werden sicher ausgelassen', () => { assert.equal(a.summarizeWatchDiagnostics([{ ...result, diagnostics: undefined }]), null); const c = structuredClone(result); c.diagnostics.rules[0].longPass = NaN; assert.equal(a.summarizeWatchDiagnostics([c]), null); });
  if (process.env.WATCH_MODEL_FIXTURE) fs.writeFileSync(process.env.WATCH_MODEL_FIXTURE, JSON.stringify({ lower, higher }));
  console.log(`\n${passed}/${passed + failed} bestanden`); process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
