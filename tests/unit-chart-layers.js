// 3.89.0 – Chart-Ebenen (shared/chart-layers.mjs): Gruppen, Ansichten, Auswahl-Erkennung – und dass die Schalter im HTML genau zu diesen Gruppen passen.
// Aufruf: node unit-chart-layers.js
const assert = require('assert'), fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); pass++; console.log('✓ ' + name); } catch (e) { fail++; console.log('✗ ' + name + ' — ' + e.message.split('\n')[0]); } };
(async () => {
  const L = await import('../shared/chart-layers.mjs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'weather-widget-v2.html'), 'utf8');
  const defaults = JSON.parse(html.match(/function loadOverlays\(\) \{\s*const d = (\{[^}]*\})/)[1].replace(/(\w+):/g, '"$1":'));
  const toggles = html.slice(html.indexOf('<span class="overlay-toggles"'), html.indexOf('<p class="ov-note"'));
  const decode = t => t.replace(/&amp;/g, '&');

  check('Vier Gruppen, jeder Schalter genau einmal, 18 Schalter (17 Ebenen + ZigZag-Prognose)', () => {
    assert.deepStrictEqual(L.OV_GROUPS.map(g => g.id), ['levels', 'trend', 'waves', 'flow']);
    const keys = L.OV_GROUPS.flatMap(g => g.keys);
    assert.strictEqual(new Set(keys).size, keys.length);
    assert.strictEqual(L.OV_TOTAL, 18); assert.strictEqual(L.OV_KEYS.length, 17); assert.ok(!L.OV_KEYS.includes('zzfc'));
  });
  check('Die Ebenen der Gruppen sind genau die gespeicherten Ebenen der App (loadOverlays)', () => {
    assert.deepStrictEqual([...L.OV_KEYS].sort(), Object.keys(defaults).sort());
  });
  check('HTML: Gruppen in dieser Reihenfolge mit diesen Überschriften', () => {
    const heads = [...toggles.matchAll(/<span class="ov-group-h" id="ovg-(\w+)">([^<]*)<\/span>/g)].map(m => [m[1], decode(m[2])]);
    assert.deepStrictEqual(heads, L.OV_GROUPS.map(g => [g.id, g.title]));
  });
  check('HTML: jeder Schalter steht in der Gruppe, die das Modul nennt, und in derselben Reihenfolge', () => {
    const parts = toggles.split('<span class="ov-group" role="group"').slice(1);
    assert.strictEqual(parts.length, L.OV_GROUPS.length);
    parts.forEach((part, i) => {
      const found = [...part.matchAll(/data-overlay="(\w+)"|id="(zz-fc)"/g)].map(m => m[1] || 'zzfc');
      assert.deepStrictEqual(found, L.OV_GROUPS[i].keys, L.OV_GROUPS[i].id);
    });
  });
  check('HTML: jeder Schalter hat eine Erklärung (title) – Grundlage der Liste „Was zeigt welche Ebene?“', () => {
    for (const m of toggles.matchAll(/<button type="button"([^>]*?(?:data-overlay="(\w+)"|id="(zz-fc)")[^>]*)>/g)) assert.ok(/ title="[^"]{20,}"/.test(m[1]), m[2] || m[3]);
  });
  check('HTML: „Alle ausblenden“ und die Auswahl „Ansicht“ stehen oben, Ansichten wie im Modul', () => {
    assert.ok(toggles.indexOf('id="ov-all"') < toggles.indexOf('ovg-levels') && toggles.indexOf('id="ov-view"') < toggles.indexOf('ovg-levels'));
    const opts = [...toggles.match(/<select id="ov-view"[^>]*>(.*?)<\/select>/)[1].matchAll(/<option value="(\w+)"[^>]*>([^<]*)<\/option>/g)].map(m => [m[1], m[2]]);
    assert.deepStrictEqual(opts, [['custom', 'Eigene Auswahl'], ...L.OV_VIEWS.map(v => [v.id, v.title])]);
  });
  check('Ansichten: nur bekannte Ebenen, eindeutige Kennungen, „Nur Kerzen“ ist leer', () => {
    assert.strictEqual(new Set(L.OV_VIEWS.map(v => v.id)).size, L.OV_VIEWS.length);
    for (const v of L.OV_VIEWS) for (const k of v.keys) assert.ok(L.OV_KEYS.includes(k), v.id + ':' + k);
    assert.deepStrictEqual(L.OV_VIEWS.find(v => v.id === 'none').keys, []);
  });
  check('ovApplyView: genau die Ebenen der Ansicht an, alle anderen aus, Eingabe unverändert', () => {
    const before = { ...defaults, extra: 'bleibt' }, copy = JSON.stringify(before);
    for (const v of L.OV_VIEWS) {
      const next = L.ovApplyView(before, v.id);
      assert.deepStrictEqual(L.ovOn(next), L.OV_KEYS.filter(k => v.keys.includes(k)), v.id);
      assert.strictEqual(next.extra, 'bleibt');
    }
    assert.strictEqual(JSON.stringify(before), copy);
    assert.strictEqual(L.ovApplyView(before, 'gibt-es-nicht'), null); assert.strictEqual(L.ovApplyView(before, 'custom'), null);
  });
  check('ovViewId: erkennt jede Ansicht genau, sonst „custom“; Reihenfolge und Zusatzschlüssel egal', () => {
    for (const v of L.OV_VIEWS) assert.strictEqual(L.ovViewId(L.ovApplyView(defaults, v.id)), v.id, v.id);
    assert.strictEqual(L.ovViewId(defaults), 'custom');
    const trend = L.ovApplyView(defaults, 'trend'); assert.strictEqual(L.ovViewId({ ...trend, ewfc: true }), 'custom'); assert.strictEqual(L.ovViewId({ ...trend, bb: false }), 'custom');
    assert.strictEqual(L.ovViewId({}), 'none'); assert.strictEqual(L.ovViewId(null), 'none'); assert.strictEqual(L.ovViewId({ vp: 'ja' }), 'none');
  });
  check('ovOn: nur echte true-Werte, feste Reihenfolge', () => {
    assert.deepStrictEqual(L.ovOn({ whale: true, vp: true, ema200: 1, bb: false }), ['vp', 'whale']);
    assert.deepStrictEqual(L.ovOn(undefined), []);
  });
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
})();
