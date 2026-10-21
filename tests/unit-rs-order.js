// 3.90.0 – Relative Stärke: die Liste steht in der Reihenfolge der Stärke zu BTC (stärkster oben), Anzeige und Reihenfolge nutzen dieselbe Zahl.
// Aufruf: node unit-rs-order.js
const assert = require('assert'), fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); pass++; console.log('✓ ' + name); } catch (e) { fail++; console.log('✗ ' + name + ' — ' + e.message.split('\n')[0]); } };
(async () => {
  const { createAnalysisView } = await import('../shared/analysis-view.mjs');
  // kleine DOM-Attrappe
  class El { constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.attrs = {}; this.className = ''; this._text = ''; this.listeners = {}; this.hidden = false; this.parent = null; }
    set textContent(v) { this._text = String(v); if (!v) this.children = []; } get textContent() { return this._text || this.children.map(c => c.textContent).join(''); }
    get ownerDocument() { return doc; } get classList() { const self = this; return { add: c => { self.className += ' ' + c; }, contains: c => self.className.split(/\s+/).includes(c), toggle() {} }; }
    append(...n) { for (const c of n) { c.parent = this; this.children.push(c); } } prepend(...n) { for (const c of n) c.parent = this; this.children.unshift(...n); }
    before() {} after() {} insertBefore(n, ref) { this.children = this.children.filter(c => c !== n); const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(n); else this.children.splice(i, 0, n); n.parent = this; }
    replaceChildren(...n) { this.children = []; this.append(...n); } insertBeforeFirst() {}
    setAttribute(k, v) { this.attrs[k] = String(v); } removeAttribute(k) { delete this.attrs[k]; } getAttribute(k) { return this.attrs[k]; }
    addEventListener(t, f) { (this.listeners[t] ||= []).push(f); } querySelector(sel) { const find = n => { for (const c of n.children) { if (match(c, sel)) return c; const r = find(c); if (r) return r; } return null; }; return find(this); }
    querySelectorAll(sel) { const out = []; const walk = n => { for (const c of n.children) { if (match(c, sel)) out.push(c); walk(c); } }; walk(this); return out; }
    get lastElementChild() { return this.children.at(-1); } get nextSibling() { return undefined; } closest() { return null; } focus() {} }
  const match = (n, sel) => sel.startsWith('.') ? (' ' + n.className + ' ').includes(' ' + sel.slice(1) + ' ') : sel === 'input' ? n.tag === 'input' : sel === 'small' ? n.tag === 'small' : sel === 'label span' ? n.tag === 'span' && n.parent?.tag === 'label' : false;
  const doc = { createElement: t => new El(t), activeElement: null, body: new El('body'), addEventListener() {}, defaultView: { addEventListener() {} } };
  const root = new El('details'); root.open = false;
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT'];
  const view = createAnalysisView({ root, read: () => null, save() {}, getOverlays: () => ({}), setOverlays() {}, coins: () => symbols, selectedCoin: () => 'BTCUSDT', openCoin() {}, changed() {} });
  const row = [...root.querySelectorAll('.analysis-row')].find(r => r.dataset.analysis === 'relative-strength') || root.children[1].children[0].children.find(r => r.dataset.analysis === 'relative-strength');
  const item = (symbol, score, changes, stretched = false) => ({ symbol, score, changes, stretched, market: 'spot', rank: 0, total: 5 });
  const ranking = [item('ETHUSDT', 0.8, [0.1, 0.4, 0.7]), item('SOLUSDT', 2.4, [0.6, 1.2, 3.1], true), item('XRPUSDT', -1.7, [-0.2, -0.8, -2.5]), item('BTCUSDT', 0, [0, 0, 0])];
  view.paintResult('', [], [{ id: 'relative-strength', ranking }]);
  const list = row.querySelector('.analysis-coin-list'), order = () => list.children.map(c => c.dataset.coin), hints = () => list.children.map(c => c.querySelector('small').textContent);
  check('Stärkster Coin oben, schwächster unten; Coin ohne Daten ganz unten', () => assert.deepStrictEqual(order(), ['SOLUSDT', 'ETHUSDT', 'BTCUSDT', 'XRPUSDT', 'DOGEUSDT']));
  check('Nummerierung folgt der Reihenfolge (1., 2., 3., 4.); BTC ist die Vergleichsbasis in der Mitte', () => {
    const h = hints(); assert.ok(h[0].startsWith('1. · Stärke +2,4 · 1h +0,6 % · 4h +1,2 % · 24h +3,1 % zu BTC · weit gelaufen'), h[0]);
    assert.ok(h[1].startsWith('2. · Stärke +0,8'), h[1]); assert.strictEqual(h[2], '3. · Vergleichsbasis (Stärke 0)'); assert.ok(h[3].startsWith('4. · Stärke −1,7 · 1h −0,2 % · 4h −0,8 % · 24h −2,5 % zu BTC'), h[3]); assert.strictEqual(h[4], '– · BTC-Vergleich wird geladen');
  });
  check('Die angezeigte Stärke fällt von oben nach unten (Anzeige und Reihenfolge nutzen dieselbe Zahl)', () => {
    const values = hints().slice(0, 4).map(t => /Stärke ([+−]?[\d,]+)/.exec(t)?.[1]).map(v => v === undefined ? 0 : Number(v.replace('−', '-').replace(',', '.')));
    assert.deepStrictEqual(values, [...values].sort((a, b) => b - a));
  });
  check('Neue Werte ordnen die Liste um (SOL fällt, XRP steigt)', () => {
    view.paintResult('', [], [{ id: 'relative-strength', ranking: [item('ETHUSDT', 0.8, [0, 0, 0]), item('SOLUSDT', -3, [0, 0, 0]), item('XRPUSDT', 5, [0, 0, 0]), item('BTCUSDT', 0, [0, 0, 0])] }]);
    assert.deepStrictEqual(order(), ['XRPUSDT', 'ETHUSDT', 'BTCUSDT', 'SOLUSDT', 'DOGEUSDT']);
  });
  check('Erklärzeile oben nennt die Richtung der Liste und die Gewichtung', () => {
    const note = row.querySelector('.analysis-rank-note'); assert.ok(note && /stärkster Coin oben, schwächster unten/i.test(note.textContent) && /20 %.*30 %.*50 %/.test(note.textContent));
  });
  check('Ein ausgeschalteter Coin steht unten und zählt nicht mit', () => {
    view.settings.rows['relative-strength'].coins.ETHUSDT = false; view.paint();
    const h = hints(), o = order(), ranked = o.filter((c, i) => /^\d+\. ·/.test(h[i]));
    assert.deepStrictEqual(ranked, ['XRPUSDT', 'BTCUSDT', 'SOLUSDT']); assert.deepStrictEqual(h.slice(0, 3).map(t => t[0]), ['1', '2', '3']);
    assert.strictEqual(h[o.indexOf('ETHUSDT')], 'Aus Auswahlhilfe ausgeblendet'); assert.ok(o.indexOf('ETHUSDT') >= 3);
  });
  check('Winzige Werte erscheinen als 0 – nie als „−0“ oder „+0“', () => {
    view.settings.rows['relative-strength'].coins.ETHUSDT = true;
    view.paintResult('', [], [{ id: 'relative-strength', ranking: [item('ETHUSDT', -0.004, [-0.002, 0.004, -0.001]), item('BTCUSDT', 0, [0, 0, 0])] }]);
    const h = hints().find(t => t.includes('1h')); assert.ok(/Stärke 0 · 1h 0 % · 4h 0 % · 24h 0 %/.test(h), h);
  });
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
})();
