// 3.84.0 – Kalibrierung der Lern-Prozente (shared/calibration.mjs, calibration-view.mjs) und die Probenfunktionen der Lernstände.
// Aufruf: node unit-calibration.js
const assert = require('node:assert/strict');
let pass = 0, fail = 0;
const check = async (name, fn) => { try { await fn(); pass++; console.log('✓ ' + name); } catch (e) { fail++; console.log('✗ ' + name + ' — ' + (e.stack || e.message)); } };
// Mini-DOM: genug für createElement/append/replaceChildren/textContent/dataset/hidden/setAttribute
class Node { constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.className = ''; this.hidden = false; this.attrs = {}; this._text = ''; this.open = false; } append(...k) { this.children.push(...k); } replaceChildren(...k) { this.children = [...k]; } setAttribute(k, v) { this.attrs[k] = v; } addEventListener() {} showModal() { this.open = true; } set textContent(v) { this._text = String(v); this.children = []; } get textContent() { return this._text + this.children.map(c => c.textContent).join(''); } }
const doc = { createElement: t => new Node(t), body: new Node('body') };
const findAll = (n, cls) => (String(n.className).split(' ').includes(cls) ? [n] : []).concat(...n.children.map(c => findAll(c, cls)));
const seeded = (n, pFor, yFor, live = () => true) => Array.from({ length: n }, (_, i) => ({ p: pFor(i), y: yFor(i), live: live(i) }));
(async () => {
  const C = await import('../shared/calibration.mjs'), V = await import('../shared/calibration-view.mjs');
  await check('Zu wenige Proben → Urteil „few“ mit Zählung, keine Stufen', () => {
    const r = C.calibrationReport(seeded(19, () => .6, i => i % 2)); assert.equal(r.verdict, 'few'); assert.equal(r.n, 19); assert.deepEqual(r.bins, []); assert.match(r.text, /19\/20/);
  });
  // Modell mit zwei Stufen: 80 % genannt (80 % erreicht) und 40 % genannt (40 % erreicht) → im Schnitt 60 %, tatsächlich 60 %, trennt klar
  const twoLevel = n => Array.from({ length: n }, (_, i) => (i % 2 ? { p: .4, y: (i >> 1) % 5 < 2 ? 1 : 0 } : { p: .8, y: (i >> 1) % 5 < 4 ? 1 : 0 }));
  await check('Gut kalibriert: genannt Ø 60 %, erreicht 60 %, klare Trennschärfe → „ok“', () => {
    const r = C.calibrationReport(twoLevel(100)); assert.equal(r.verdict, 'ok'); assert.ok(Math.abs(r.meanP - .6) < 1e-12 && Math.abs(r.rate - .6) < 1e-12 && Math.abs(r.gap) < 1e-12);
    assert.ok(r.auc > .65 && r.auc < .75, 'AUC ' + r.auc); assert.match(r.text, /60 %.*60 %.*Trennschärfe 0,7\d/);
  });
  await check('Trennschärfe (AUC): perfekt 1, Zufall/feste Zahl 0,5, umgekehrt 0; gleiche Werte werden gemittelt', () => {
    assert.equal(C.auc([{ p: .1, y: 0 }, { p: .2, y: 0 }, { p: .8, y: 1 }, { p: .9, y: 1 }]).value, 1); assert.equal(C.auc([{ p: .9, y: 0 }, { p: .8, y: 0 }, { p: .2, y: 1 }, { p: .1, y: 1 }]).value, 0);
    assert.equal(C.auc(seeded(10, () => .5, i => i % 2)).value, .5); assert.equal(C.auc(seeded(5, () => .5, () => 1)), null);
    assert.equal(C.auc([{ p: .3, y: 1 }, { p: .3, y: 0 }, { p: .9, y: 1 }, { p: .1, y: 0 }]).value, (1 + .5 + 1 + 1) / 4, 'gebundene Werte zählen halb');
  });
  await check('Zu optimistisch: genannt 70 %, erreicht 45 % (n=100) → „optimistic“; umgekehrt „cautious“', () => {
    const o = C.calibrationReport(seeded(100, () => .7, i => (i % 100 < 45 ? 1 : 0))); assert.equal(o.verdict, 'optimistic'); assert.match(o.text, /Zu optimistisch.*70 %.*45 %/);
    const c = C.calibrationReport(seeded(100, () => .4, i => (i % 100 < 65 ? 1 : 0))); assert.equal(c.verdict, 'cautious'); assert.match(c.text, /Zu vorsichtig/);
  });
  await check('Kleine Abweichung innerhalb der Schwankung bleibt „ok“; dieselbe Abweichung in einer großen Probe wird auffällig', () => {
    // je Stufe die Trefferquote über gleichmäßig verteilte Fälle: 80 % genannt → 70 % erreicht, 40 % genannt → 30 % erreicht (Ø 60 % gegen 50 %)
    const lv = (n, hit8, hit4) => { const m = n / 2; return Array.from({ length: n }, (_, i) => { const share = ((i >> 1) + .5) / m * 100; return i % 2 ? { p: .4, y: share < hit4 ? 1 : 0 } : { p: .8, y: share < hit8 ? 1 : 0 }; }); };
    const small = C.calibrationReport(lv(30, 70, 30)); assert.equal(small.verdict, 'ok', '10 Punkte Abstand bei 30 Signalen liegen innerhalb der Schwankungsgrenze (2·SE ≈ 18 Punkte)');
    const big = C.calibrationReport(lv(2000, 70, 30)); assert.equal(big.verdict, 'optimistic', 'dieselben 10 Punkte bei 2000 Signalen sind keine Schwankung mehr');
    assert.equal(C.calibrationReport(lv(2000, 78, 38)).verdict, 'ok', 'unter 8 Punkten Abstand gilt es auch bei großer Probe als passend (praktisch unerheblich)');
  });
  await check('Feste Prozentzahl (trennt nichts) ist trotz passendem Mittelwert „no-skill“ – kein Fehlalarm durch den Brier-Vergleich', () => {
    const r = C.calibrationReport(seeded(100, () => .6, i => (i % 10 < 6 ? 1 : 0))); assert.equal(r.verdict, 'no-skill'); assert.equal(r.auc, .5);
  });
  await check('Im Schnitt passend, aber die Prozentzahlen sind umgekehrt verteilt (Trennschärfe unter 0,5) → „no-skill“', () => {
    // jeder zweite Fall 90 % und jeder zweite 30 %, doch die Treffer sind genau umgekehrt verteilt: Ø 60 % genannt, 60 % erreicht
    const rows = Array.from({ length: 100 }, (_, i) => (i % 2 ? { p: .3, y: i % 10 < 3 ? 0 : 1 } : { p: .9, y: i % 10 < 4 ? 1 : 0 })), r = C.calibrationReport(rows);
    assert.ok(Math.abs(r.gap) < .08, 'Mittelwert passt'); assert.ok(r.auc < .5); assert.equal(r.verdict, 'no-skill'); assert.match(r.text, /nicht erkennbar besser als der Zufall/);
  });
  await check('Stufen: 10-%-Breite, nur belegte, p=1 landet in der obersten, dünne Stufen markiert', () => {
    const rows = [...seeded(30, () => .55, i => i % 2), ...seeded(3, () => 1, () => 1), ...seeded(20, () => .05, () => 0)], r = C.calibrationReport(rows);
    assert.deepEqual(r.bins.map(b => [Math.round(b.from * 100), Math.round(b.to * 100), b.n, b.thin]), [[0, 10, 20, false], [50, 60, 30, false], [90, 100, 3, true]]);
    assert.equal(r.bins[0].rate, 0); assert.equal(r.bins[2].rate, 1);
  });
  await check('Ungültige Proben werden ausgesiebt (calibrationSamples)', () => {
    const rows = [{ signal: { probability: .5 }, y: 1, source: 'live' }, { signal: { probability: null }, y: 1 }, { signal: { probability: 1.2 }, y: 1 }, { signal: { probability: .4 }, y: 2 }, { signal: { probability: .4 }, y: 0, source: 'backtest' }];
    const s = C.calibrationSamples(rows, { label: r => r.y }); assert.deepEqual(s, [{ p: .5, y: 1, live: true }, { p: .4, y: 0, live: false }]);
  });
  await check('Live gegen Rücktest: deutlicher Unterschied warnt; ähnliche Quoten oder zu wenige Proben nicht', () => {
    const mk = (nl, rl, nb, rb) => [...seeded(nl, () => .5, i => (i < nl * rl ? 1 : 0), () => true), ...seeded(nb, () => .5, i => (i < nb * rb ? 1 : 0), () => false)];
    const w = C.liveVsBacktest(mk(60, .35, 200, .58)); assert.equal(w.warn, true); assert.match(w.text, /Live 35 %.*Rücktest 58 %.*schlechter/);
    const b = C.liveVsBacktest(mk(60, .75, 200, .52)); assert.equal(b.warn, true); assert.match(b.text, /besser/);
    const ok = C.liveVsBacktest(mk(60, .55, 200, .58)); assert.equal(ok.warn, false); assert.match(ok.text, /kein auffälliger Unterschied/);
    const few = C.liveVsBacktest(mk(10, .1, 200, .9)); assert.equal(few.warn, false); assert.equal(few.text, ''); assert.equal(few.live.n, 10);
  });
  await check('Anzeige: Satz mit Urteil, Tabelle der Stufen, Vergleich; ohne Stufen eingeklappt und ausgeblendet', () => {
    const box = V.createCalibrationBox(doc); const find = (n, cls) => (n.className === cls ? [n] : []).concat(...n.children.map(c => find(c, cls)));
    const rows = seeded(100, i => (i % 2 ? .3 : .8), i => (i % 2 ? (i % 6 === 1 ? 1 : 0) : (i % 4 === 0 ? 1 : 0))), rep = C.calibrationReport(rows);
    box.update(rep, C.liveVsBacktest(rows)); const line = find(box.box, 'calibration-line')[0], bins = find(box.box, 'calibration-bins')[0], table = find(box.box, 'calibration-table')[0];
    assert.equal(line.dataset.verdict, rep.verdict); assert.equal(line.textContent, rep.text); assert.equal(bins.hidden, false); assert.equal(table.children.length, rep.bins.length + 1);
    assert.equal(table.children[0].children.map(c => c.textContent).join('|'), 'Genannt|Signale|Ø genannt|Erreicht'); assert.match(table.children[1].children[0].textContent, /^\d+ %–\d+ %$/);
    box.update(C.calibrationReport([]), null); assert.equal(bins.hidden, true); assert.equal(find(box.box, 'calibration-drift')[0].hidden, true); assert.match(line.textContent, /0\/20/);
  });
  await check('Lernstände liefern Proben: Top-Down/NY (Ziel 1 = 1) und Rücksetzer (Ziel 1 oder 2 = 1) nur mit gespeicherter Wahrscheinlichkeit', async () => {
    const L = await import('../shared/analysis-learning.mjs'), P = await import('../shared/trend-pullback-learning.mjs'), core = await import('../shared/trend-pullback-core.mjs');
    const rec = (p, status, source = 'live') => ({ source, signal: { probability: p, learningFeatures: { a: 1 }, version: core.PULLBACK.version, at: 1, symbol: 'BTCUSDT' }, outcome: { complete: true, status, first: { status, at: 5, grossR: status.startsWith('target') ? 1 : -1 } } });
    const a = L.learningCalibrationSamples([rec(.6, 'target1'), rec(.4, 'stop', 'backtest'), rec(null, 'stop'), rec(.7, 'gap')]);
    assert.deepEqual(a, [{ p: .6, y: 1, live: true }, { p: .4, y: 0, live: false }]);
    const b = P.pullbackCalibrationSamples([rec(.6, 'target2'), rec(.3, 'stop', 'backtest'), rec(undefined, 'target1')]); assert.deepEqual(b, [{ p: .6, y: 1, live: true }, { p: .3, y: 0, live: false }]);
  });
  await check('Lernstand-Ansicht (Top-Down): Kalibrierung mit Urteil, Stufen und Vergleich Live gegen Rücktest; Rücksetzer-Ansicht ebenso', async () => {
    const L = await import('../shared/analysis-learning.mjs'), W = await import('../shared/analysis-learning-view.mjs'), PV = await import('../shared/trend-pullback-view.mjs'), PC = await import('../shared/trend-pullback-core.mjs');
    const version = L.learningVersion('top-down', {}), records = {};
    // 60 Live-Signale mit 70 % genannt, aber nur 40 % erreicht; 60 Rücktest-Signale mit 70 % genannt und 70 % erreicht
    for (let i = 0; i < 120; i++) { const live = i < 60, hit = live ? i % 10 < 4 : i % 10 < 7; records['k' + i] = { source: live ? 'live' : 'backtest', updatedAt: i, signal: { analysisId: 'top-down', symbol: 'BTCUSDT', market: 'spot', direction: 1, at: 1e12 + i * 9e5, entry: 100, stop: 99, learningVersion: version, learningFeatures: { a: 1 }, probability: .7, probabilityText: '70 %' }, outcome: { complete: true, status: hit ? 'target' : 'stop', first: { status: hit ? 'target1' : 'stop', at: 1e12 + i * 9e5 + 1, grossR: hit ? 2 : -1, exit: hit ? 102 : 99 } } }; }
    const data = { version: 1, analyses: { 'top-down': { records, models: {} } } };
    const tools = W.createAnalysisLearningTools({ root: { ownerDocument: doc }, id: 'top-down', name: 'Top-Down', getOptions: () => ({}), services: { read: () => data, available: () => true } });
    tools.openLearning(); const line = findAll(tools.dialog, 'calibration-line')[0], drift = findAll(tools.dialog, 'calibration-drift')[0], bins = findAll(tools.dialog, 'calibration-bins')[0];
    assert.equal(line.dataset.verdict, 'optimistic'); assert.match(line.textContent, /Zu optimistisch.*70 %.*55 %/); assert.equal(bins.hidden, false); assert.equal(findAll(tools.dialog, 'calibration-table')[0].children.length, 2, 'Kopf und eine belegte Stufe (70–80 %)');
    assert.equal(drift.hidden, false); assert.match(drift.textContent, /Live 40 %.*Rücktest 70 %.*schlechter/); assert.equal(drift.dataset.verdict, 'warn');
    // Rücksetzer
    const prec = {}; for (let i = 0; i < 30; i++) { const hit = i % 2; prec['p' + i] = { source: 'live', signal: { version: PC.PULLBACK.version, symbol: 'ETHUSDT', market: 'spot', direction: 1, at: 1e12 + i, probability: .6, entry: 100, stop: 99 }, outcome: { complete: true, status: hit ? 'target1' : 'stop', first: { status: hit ? 'target1' : 'stop', at: 1e12 + i + 1, grossR: hit ? 1.5 : -1, exit: 100 } } }; }
    const pt = PV.createPullbackTools({ root: { ownerDocument: doc }, getOptions: () => ({}), setOptions() {}, services: { read: k => (String(k).includes('data') ? { version: 1, records: prec } : null), available: () => true } });
    (pt.openLearning || pt.paint)?.call(pt); pt.dialog.open = true; pt.paint?.();
    const pl = findAll(pt.dialog, 'calibration-line')[0]; assert.ok(pl, 'Kalibrierfeld in der Rücksetzer-Ansicht vorhanden'); assert.match(pl.textContent, /60 %.*50 %|30 Signale/);
  });
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})();
