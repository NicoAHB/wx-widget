// 3.84.0 – Speicherschicht (store in weather-widget-v2.html): „unverändert?“-Erkennung mit Merkmal statt Volltext.
// Der Code wird direkt aus der App gezogen und mit einem Ersatz für localStorage ohne IndexedDB ausgeführt.
// Aufruf: node unit-store.js
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
let pass = 0, fail = 0;
const check = async (name, fn) => { try { await fn(); pass++; console.log('✓ ' + name); } catch (e) { fail++; console.log('✗ ' + name + ' — ' + (e.stack || e.message)); } };
const html = fs.readFileSync(path.join(__dirname, '../weather-widget-v2.html'), 'utf8');
const a = html.indexOf("const SAVED_KEY = 'scalpdesk.savedat.v1'"), b = html.indexOf('\nconst flag = (k, dflt)', a);
const f0 = html.indexOf('function fp(s) {'), f1 = html.indexOf('\nconst CRC_T', f0);
assert.ok(a > 0 && b > a && f0 > 0 && f1 > f0, 'Speicherschicht in der App gefunden');
const source = html.slice(a, b) + '\n' + html.slice(f0, f1) + '\nreturn store;';
function make(seed = {}) {
  const ls = new Map(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]));
  const localStorage = { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => void ls.set(k, String(v)), removeItem: k => void ls.delete(k), get length() { return ls.size; }, key: i => [...ls.keys()][i] };
  const store = new Function('localStorage', 'indexedDB', 'navigator', 'document', 'location', source)(localStorage, undefined, {}, { documentElement: {} }, { search: '' });
  return { store, ls };
}
(async () => {
  await check('Neu → true, gleicher Wert → false, geänderter Wert → true, force → true', () => {
    const { store } = make(); assert.equal(store.set('scalpdesk.t.v1', { a: 1 }), true); assert.equal(store.set('scalpdesk.t.v1', { a: 1 }), false);
    assert.equal(store.set('scalpdesk.t.v1', { a: 2 }), true); assert.equal(store.set('scalpdesk.t.v1', { a: 2 }, { force: true }), true);
  });
  await check('Gleich lange, aber verschiedene Texte werden unterschieden', () => {
    const { store } = make(); store.set('scalpdesk.t.v1', { a: 'x' }); assert.equal(store.set('scalpdesk.t.v1', { a: 'y' }), true); assert.equal(store.set('scalpdesk.t.v1', { a: 'x' }), true);
  });
  await check('Änderung am selben Objekt vor dem nächsten set() wird erkannt (häufiges Muster: get → ändern → set)', () => {
    const { store } = make(); const v = { events: [{ id: 1, ack: false }] }; store.set('scalpdesk.t.v1', v);
    const again = store.get('scalpdesk.t.v1'); again.events[0].ack = true; assert.equal(store.set('scalpdesk.t.v1', again), true); assert.equal(store.set('scalpdesk.t.v1', again), false);
  });
  await check('Beim Start gelesener Wert: gleicher Wert → false, geänderter → true', async () => {
    const { store } = make({ 'scalpdesk.t.v1': { n: [1, 2, 3] } }); await store.init();
    assert.deepEqual(store.get('scalpdesk.t.v1'), { n: [1, 2, 3] }); assert.equal(store.set('scalpdesk.t.v1', { n: [1, 2, 3] }), false); assert.equal(store.set('scalpdesk.t.v1', { n: [1, 2, 4] }), true);
  });
  await check('adopt (Wert aus anderem Tab) merkt sich den Stand; del vergisst ihn', () => {
    const { store } = make(); store.adopt('scalpdesk.t.v1', { a: 1 }); assert.equal(store.set('scalpdesk.t.v1', { a: 1 }), false); assert.equal(store.set('scalpdesk.t.v1', { a: 3 }), true);
    store.del('scalpdesk.t.v1'); assert.equal(store.get('scalpdesk.t.v1'), undefined); assert.equal(store.set('scalpdesk.t.v1', { a: 3 }), true);
  });
  await check('Schlüssel mit scalpdesk.idb. gehen nie in localStorage, andere schon', () => {
    const { store, ls } = make(); store.set('scalpdesk.idb.big.v1', { a: 1 }); store.set('scalpdesk.t.v1', { a: 1 });
    assert.equal(ls.has('scalpdesk.idb.big.v1'), false); assert.equal(ls.get('scalpdesk.t.v1'), '{"a":1}');
  });
  await check('Großer Lernspeicher (20 000 Einträge): eine einzige geänderte Stelle wird erkannt, unverändert nicht', () => {
    const { store } = make(); const records = {}; for (let i = 0; i < 20000; i++) records['k' + i] = { at: i, outcome: { status: 'target1', grossR: 1 } };
    store.set('scalpdesk.idb.big.v1', { version: 1, records }); assert.equal(store.set('scalpdesk.idb.big.v1', { version: 1, records: { ...records } }), false);
    const changed = { version: 1, records: { ...records, k19999: { at: 19999, outcome: { status: 'stop', grossR: -1 } } } }; assert.equal(store.set('scalpdesk.idb.big.v1', changed), true);
  });
  await check('undefined und nicht serialisierbare Werte verhalten sich wie bisher', () => {
    const { store } = make(); const cyc = {}; cyc.self = cyc; assert.doesNotThrow(() => store.set('scalpdesk.t.v1', cyc)); assert.equal(store.get('scalpdesk.t.v1'), cyc);
  });
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})();
