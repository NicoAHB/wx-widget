// 3.90.0 – AMD-Anzeige (shared/amd-view.mjs, Karte in analysis-card.mjs): Status je Phase, Einstellungen, Chart-Kästen und Farben, Telegram-Bild.
// Aufruf: node unit-amd-view.js
const assert = require('assert');
let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); pass++; console.log('✓ ' + name); } catch (e) { fail++; console.log('✗ ' + name + ' — ' + e.message.split('\n')[0]); } };
(async () => {
  const Core = await import('../shared/amd-core.mjs'), V = await import('../shared/amd-view.mjs'), Card = await import('../shared/analysis-card.mjs'), Cfg = await import('../shared/analysis-config.mjs'), Ov = await import('../shared/analysis-overview.mjs');
  const Q = 900000, M = 60000, T0 = Date.UTC(2026, 0, 5), tj = T0 + 30 * Q;
  const bar = (time, ms, o, h, l, c) => ({ time, closeTime: time + ms - 1, open: o, high: h, low: l, close: c });
  const warm = () => Array.from({ length: 30 }, (_, i) => bar(T0 + i * Q, Q, 100, 101, 99, 100));
  const path = [[99.55, 99.6, 99.45, 99.5], [99.5, 99.65, 99.4, 99.6], [99.6, 99.7, 99.4, 99.45], [99.45, 99.55, 99.2, 99.25], [99.25, 99.5, 99.0, 99.05], [99.05, 99.15, 98.8, 98.85], [98.85, 99.0, 98.7, 98.75], [98.75, 98.95, 98.72, 98.9], [98.9, 99.1, 98.85, 99.05], [99.05, 99.25, 99.0, 99.2], [99.2, 99.4, 99.15, 99.35], [99.35, 99.6, 99.3, 99.55], [99.55, 99.75, 99.5, 99.72], [99.72, 99.8, 99.6, 99.65], [99.65, 99.7, 99.1, 99.2]];
  const minutes = path.map((x, i) => bar(tj + i * M, M, ...x)), brk = () => bar(tj, Q, 99.55, 99.8, 98.7, 99.2);
  const fmt = { price: v => v.toFixed(2).replace('.', ','), number: (v, d = 2) => v.toLocaleString('de-DE', { maximumFractionDigits: d }), time: v => new Date(v).toISOString().slice(11, 16) };
  const evaluate = (candles, mins = [], extra = {}, now = tj + Q + 5000) => Core.evaluateAmd({ candles, minutes: mins, symbol: 'ETHUSDT', market: 'futures', now, options: extra });
  const signalResult = evaluate([...warm(), brk()], minutes), accumulation = evaluate(warm(), [], {}, tj + 5000), manipulation = evaluate([...warm(), brk()], []), none = evaluate(warm().map((c, i) => bar(c.time, Q, 100, 101 + (i % 2) * 3, 99 - (i % 3), 100)), [], { maxHeightAtr: 0.5 }, tj + 5000);

  check('Katalog: AMD-Zeile mit Telegram-Schalter und Chart-Haken wie die anderen; scannt alle Coins; ohne Indikatoren; Zeitrahmen-Standard 15m', () => {
    const d = Cfg.ANALYSES.find(x => x.id === 'amd'); assert.ok(d); assert.strictEqual(d.name, 'AMD'); assert.strictEqual(d.observe, true); assert.deepStrictEqual([...d.indicators], []); assert.strictEqual(d.defaultInterval, '15m');
    assert.ok(d.createRuntime && d.draw && d.status && d.tools && d.normalizeOptions); assert.ok(!d.information);
    const s = Cfg.analysisSettings(); assert.strictEqual(s.rows.amd.telegram, false); assert.strictEqual(s.rows.amd.chart, false); assert.deepStrictEqual(s.rows.amd.options, { interval: '15m', maxHeightAtr: 1.5, minRR: 2 });
    assert.strictEqual(Cfg.analysisSettings({ rows: { amd: { telegram: true, options: { interval: '4h' } } } }).rows.amd.options.interval, '4h');
  });
  check('Status ohne Range: Stufe 0, Badge „Keine Range“, drei Stufen als Gerüst', () => {
    const s = V.amdStatus(none, fmt); assert.strictEqual(s.stage, 0); assert.strictEqual(s.badge, 'Keine Range'); assert.deepStrictEqual(s.shortLabels, ['Accumulation', 'Manipulation', 'Distribution']); assert.strictEqual(s.steps.length, 3);
  });
  check('Status Accumulation: Stufe 1, Range-Hoch/-Tief, Höhe in ATR', () => {
    const s = V.amdStatus(accumulation, fmt); assert.strictEqual(s.stage, 1); assert.strictEqual(s.badge, 'Range läuft'); assert.match(s.steps[0].text, /30 Kerzen · 99,00–101,00 · Höhe 1 × ATR/); assert.deepStrictEqual(s.levels.map(l => l[0]), ['Range-Hoch', 'Range-Tief']);
  });
  check('Status Manipulation: Stufe 1 (Manipulation ist die laufende Stufe), nennt beide offenen Bedingungen', () => {
    const s = V.amdStatus(manipulation, fmt), o = Ov.analysisOverview({ id: 'amd', detail: s, reason: manipulation.reason });
    assert.strictEqual(s.badge, 'Manipulation'); assert.match(s.steps[1].text, /Durchbruch nach unten bis 98,70/); assert.match(s.steps[1].text, /Schluss in der Range: ja · 1m-Strukturbruch: nein/);
    assert.strictEqual(o.steps[1].current, true); assert.strictEqual(o.steps[0].done, true); assert.strictEqual(o.steps[1].done, false); assert.strictEqual(o.tone, 'neutral');
  });
  check('Status bestätigt: Long bestätigt, drei Stufen erledigt, Einstieg/Stop/Ziel/CRV', () => {
    const s = V.amdStatus(signalResult, fmt), o = Ov.analysisOverview({ id: 'amd', detail: s });
    assert.strictEqual(s.stage, 3); assert.strictEqual(s.badge, 'Long bestätigt'); assert.strictEqual(o.tone, 'long'); assert.ok(o.steps.every(x => x.done));
    assert.deepStrictEqual(s.levels, [['Einstieg', '99,20'], ['Stop', '98,50'], ['Ziel · Gegenseite', '101,00'], ['CRV', '1:2,57']]);
    assert.match(s.steps[2].text, /Stop 98,50 \(hinter dem Extrem\) · Ziel 101,00 \(Gegenseite der Range\) · CRV 1:2,57/); assert.match(s.steps[1].text, /Schluss über 99,70/);
  });
  check('Status gefiltert/ungültig: kein Signal, Grund sichtbar, Badge neutral', () => {
    const f = V.amdStatus(evaluate([...warm(), brk()], minutes, { minRR: 3 }), fmt); assert.strictEqual(f.badge, 'CRV zu niedrig'); assert.strictEqual(f.direction, 0); assert.match(f.steps[2].text, /CRV 1:2,57 liegt unter 1:3/); assert.strictEqual(f.stage, 2);
    const out = [0, 1, 2].map(i => bar(tj + i * Q, Q, 98.8 - i * .1, 98.9 - i * .1, 98.4 - i * .1, 98.5 - i * .1)), bad = V.amdStatus(evaluate([...warm(), ...out], [], {}, tj + 3 * Q + 5000), fmt);
    assert.strictEqual(bad.badge, 'Ungültig'); assert.match(bad.steps[1].text, /echter Ausbruch/); assert.strictEqual(bad.direction, 0); assert.match(bad.counter, /Ungültig/);
  });
  check('Einstellungen: Zeitrahmen 5m–1M (ohne 1m), Wahl speichert und schaltet den Chart; Zahlenfelder werden begrenzt', () => {
    const { El, doc } = domStub(); const root = new El('div'); let options = { interval: '15m', maxHeightAtr: 1.5, minRR: 2 }, shown = [];
    const tools = V.createAmdTools({ root, getOptions: () => options, setOptions: v => { options = Core.amdOptions(v); }, services: { showInterval: iv => shown.push(iv) } });
    const buttons = root.querySelectorAll('[data-amd-interval]'); assert.deepStrictEqual(buttons.map(b => b.dataset.amdInterval), ['5m', '15m', '1h', '2h', '4h', '1d', '1w', '1M']);
    buttons[4].listeners.click[0](); tools.paint(); assert.strictEqual(options.interval, '4h'); assert.deepStrictEqual(shown, ['4h']); assert.ok(buttons[4].className.includes('active') && !buttons[1].className.includes('active'));
    const inputs = root.querySelectorAll('[data-amd-option]'); inputs[0].value = '9'; inputs[0].listeners.change[0](); assert.strictEqual(options.maxHeightAtr, 4); inputs[1].value = '2,5'; inputs[1].listeners.change[0](); assert.strictEqual(options.minRR, 2.5);
    assert.ok(root.textContent.includes('Fehlausbruch') && root.textContent.includes('Strukturbruch'));
  });
  check('Chart: drei Kästen mit den vorgegebenen Farben (blau, rot, grün), Beschriftung, Range-Linien nach rechts bis zum Rand', () => {
    const g = draw(signalResult), kinds = g.rects.map(r => r['data-amd-box']);
    assert.deepStrictEqual(kinds.sort(), ['accumulation', 'distribution', 'manipulation']);
    const by = k => g.rects.find(r => r['data-amd-box'] === k); assert.strictEqual(by('accumulation').fill, '#4aa8ff'); assert.strictEqual(by('manipulation').fill, '#ff5b6e'); assert.strictEqual(by('distribution').fill, '#3ddc84');
    assert.deepStrictEqual(g.labels.filter(t => /^(Accumulation|Manipulation|Distribution)/.test(t)).map(t => t.split(' ·')[0]).sort(), ['Accumulation', 'Distribution', 'Manipulation']);
    const lines = g.lines.filter(l => /range/.test(l['data-amd-line'])); assert.strictEqual(lines.length, 2); assert.ok(lines.every(l => l.x2 === 760 && l.x1 < 700));
  });
  check('Chart: Short bekommt eine rote Distribution-Box; ungültiger Ablauf ist komplett grau; ohne Daten nur die Statuszeile', () => {
    const mirror = c => ({ ...c, open: 200 - c.open, high: 200 - c.low, low: 200 - c.high, close: 200 - c.close });
    const short = evaluate([...warm(), brk()].map(mirror), minutes.map(mirror)); const gs = draw(short);
    assert.strictEqual(gs.rects.find(r => r['data-amd-box'] === 'distribution').fill, '#ff5b6e');
    const out = [0, 1, 2].map(i => bar(tj + i * Q, Q, 98.8 - i * .1, 98.9 - i * .1, 98.4 - i * .1, 98.5 - i * .1)), gi = draw(evaluate([...warm(), ...out], [], {}, tj + 3 * Q + 5000));
    assert.ok(gi.rects.length >= 2 && gi.rects.every(r => r.fill === '#8a93a3'), JSON.stringify(gi.rects.map(r => r.fill)));
    const empty = draw({ ready: false, reason: 'Kerzendaten werden geladen.' }); assert.strictEqual(empty.rects.length, 0); assert.ok(empty.buttons.some(b => /Daten fehlen/.test(b)));
  });
  check('Chart: die Statuszeile erklärt per Tipp die Regeln; Manipulation sofort sichtbar (laufende Kerze), ohne Telegram', () => {
    const g = draw(signalResult); assert.ok(g.buttons[0].includes('AMD · 15m · Long bestätigt')); assert.match(g.explanations[0], /Accumulation.*Manipulation.*Distribution/s);
    const rows = warm(), live = Core.evaluateAmd({ candles: rows, forming: bar(tj, Q, 100, 100.4, 98.6, 99.0), symbol: 'X', market: 'spot', now: tj + 4 * M, options: {} });
    assert.strictEqual(live.phase, 'manipulation'); assert.strictEqual(live.signal, null); assert.strictEqual(live.current.provisional, true); const gl = draw(live); assert.ok(gl.rects.some(r => r['data-amd-box'] === 'manipulation' && r.fill === '#ff5b6e'));
    assert.strictEqual(Core.evaluateAmd({ candles: rows, forming: bar(tj, Q, 100, 100.4, 99.4, 99.9), symbol: 'X', market: 'spot', now: tj + 4 * M, options: {} }).phase, 'accumulation');
  });
  check('Telegram-Karte: Name AMD, drei Stufen, drei Kästen in Blau/Rot/Grün, CRV und Werte', () => {
    const c = Card.analysisCard(signalResult.signal), svg = c.svg;
    for (const t of ['>AMD<', 'Accumulation', 'Manipulation', 'Distribution', 'CRV 1:2,57', 'ZIEL · GEGENSEITE DER RANGE', 'EINSTIEG', 'STOP-LOSS', 'Scalp Desk · Analyse-Signale_111', 'AMD · 15m → 1m']) assert.ok(svg.includes(t), t);
    assert.ok(/ETH\/USDT · Long · Einstieg 99,20/.test(c.caption), c.caption);
    const boxes = [...svg.matchAll(/<rect x="[\d.]+" y="[\d.-]+" width="[\d.]+" height="[\d.]+" fill="(#[0-9a-f]{3,6})" fill-opacity="\.16"/gi)].map(m => m[1].toLowerCase()); assert.strictEqual(boxes.length, 3, boxes.join());
  });
  check('Testkarte (Knopf in den Telegram-Einstellungen) liefert dieselbe Karte ohne Daten aus dem Netz', () => {
    const t = Card.analysisTestSignal(Date.now(), 'amd'), c = Card.analysisCard(t); assert.strictEqual(t.analysisId, 'amd'); assert.ok(t.test && t.rr >= 2 && t.boxes.manipulation && t.boxes.distribution); assert.ok(c.svg.includes('TEST · ANALYSE') && c.svg.includes('Distribution'));
  });
  check('Short-Karte: Stop oben, Ziel unten, Kasten-Farbe der Distribution rot', () => {
    const mirror = c => ({ ...c, open: 200 - c.open, high: 200 - c.low, low: 200 - c.high, close: 200 - c.close }), r = evaluate([...warm(), brk()].map(mirror), minutes.map(mirror)), svg = Card.analysisCard(r.signal).svg;
    assert.ok(svg.includes('Short') && /ETH\/USDT · Short/.test(svg)); assert.ok(r.signal.stop > r.signal.entry && r.signal.target < r.signal.entry);
  });

  function draw(result) {
    const rects = [], lines = [], labels = [], buttons = [], explanations = [];
    const node = (tag, attrs = {}, text) => { const n = { tag, attrs, children: [], dataset: {}, append(...c) { n.children.push(...c); }, addEventListener() {}, text }; if (tag === 'rect') rects.push(attrs); if (tag === 'line') lines.push(attrs); if (tag === 'text') labels.push(text); return n; };
    const left = 20, pw = 740, top = 10, bottom = 300, min = 90, max = 110, step = 10, t0 = T0, x = i => left + (i + .5) * step, timeX = t => x((t - t0) / Q), y = v => top + (max - v) / (max - min) * (bottom - top);
    const svg = { append(n) { if (n.attrs?.class?.includes('amd-chart-info')) { buttons.push(n.children.find(c => c.tag === 'text').text); explanations.push(n.__analysisExplanation); } } }, store = () => ({ append() {} });
    V.drawAmdChart({ node, svg, under: store(), over: store(), result, geometry: { left, pw, top, bottom, min, max, timeX, y, x }, palette: { up: '#3ddc84', down: '#ff5b6e', muted: '#8a93a3', zero: '#888' }, price: fmt.price, explain() {} });
    // Kinder der Gruppen einsammeln: rects/lines wurden bereits beim Erzeugen erfasst
    return { rects: rects.filter(r => r['data-amd-box']).map(r => ({ ...r, fill: r.fill })), lines, labels, buttons, explanations };
  }
  function domStub() {
    class El { constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.attrs = {}; this.className = ''; this._text = ''; this.listeners = {}; this.value = ''; }
      set textContent(v) { this._text = String(v); if (!v) this.children = []; } get textContent() { return this._text || this.children.map(c => c.textContent).join(''); } get ownerDocument() { return doc; }
      get classList() { const s = this; return { toggle(c, on) { const set = new Set(s.className.split(/\s+/).filter(Boolean)); if (on) set.add(c); else set.delete(c); s.className = [...set].join(' '); } }; }
      append(...n) { this.children.push(...n); } setAttribute(k, v) { this.attrs[k] = String(v); } addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
      querySelectorAll(sel) { const out = [], key = /^\[data-([a-z-]+)\]$/.exec(sel)?.[1].replace(/-(\w)/g, (_, c) => c.toUpperCase()); const walk = n => { for (const c of n.children) { if (key in c.dataset) out.push(c); walk(c); } }; walk(this); return out; } }
    const doc = { createElement: t => new El(t), activeElement: null }; return { El, doc };
  }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
})();
