// Randhinweis für wischbare Zeilen: Zustand aus den Maßen und Pflege von data-scroll-more.
const assert = require('node:assert/strict');
let pass = 0, fail = 0;
const check = (name, test) => Promise.resolve().then(test).then(() => { pass++; console.log('✓ ' + name); }, e => { fail++; console.error('✗ ' + name + ' — ' + e.message); });
(async () => {
  const { scrollHintState, installScrollHint } = await import('../shared/scroll-hint.mjs');
  const dims = (scrollLeft, scrollWidth, clientWidth) => ({ scrollLeft, scrollWidth, clientWidth });
  await check('passt alles hinein: kein Hinweis', () => { assert.equal(scrollHintState(dims(0, 300, 300)), ''); assert.equal(scrollHintState(dims(0, 301, 300)), ''); });
  await check('Anfang einer überlangen Zeile: rechts folgt mehr', () => assert.equal(scrollHintState(dims(0, 383, 336)), 'end'));
  await check('Mitte: beidseitig', () => assert.equal(scrollHintState(dims(20, 383, 336)), 'both'));
  await check('Ende: nur links liegt mehr', () => assert.equal(scrollHintState(dims(47, 383, 336)), 'start'));
  await check('Rundungsfehler von ein bis zwei Pixeln zählen nicht', () => { assert.equal(scrollHintState(dims(46, 383, 336)), 'start'); assert.equal(scrollHintState(dims(1, 383, 336)), 'end'); });
  await check('Sichtbare Inhaltsbreite hat Vorrang vor scrollWidth (überstehendes, unsichtbares Hilfefenster)', () => {
    assert.equal(scrollHintState({ scrollLeft: 0, scrollWidth: 476, clientWidth: 468, contentWidth: 468 }), '');
    assert.equal(scrollHintState({ scrollLeft: 0, scrollWidth: 476, clientWidth: 468 }), 'end');
    assert.equal(scrollHintState({ scrollLeft: 0, scrollWidth: 400, clientWidth: 468, contentWidth: 520 }), 'end');
  });
  await check('fehlende Maße ergeben keinen Hinweis', () => { assert.equal(scrollHintState(), ''); assert.equal(scrollHintState({}), ''); });
  await check('Ohne Element passiert nichts und der Abbau ist aufrufbar', () => { const off = installScrollHint(null); assert.equal(typeof off, 'function'); off(); });

  // Ersatz-Element: Maße veränderbar, Ereignisse von Hand ausgelöst
  const element = (sw, cw) => {
    const listeners = {}, el = { dataset: {}, children: [], scrollLeft: 0, scrollWidth: sw, clientWidth: cw,
      addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); }, removeEventListener: (type, fn) => { listeners[type] = (listeners[type] || []).filter(f => f !== fn); }, listeners };
    return el;
  };
  await check('Beim Einbau steht der Zustand sofort am Element', () => { const el = element(383, 336); installScrollHint(el); assert.equal(el.dataset.scrollMore, 'end'); });
  await check('Wischen aktualisiert den Zustand: Mitte, Ende, zurück zum Anfang', () => {
    const el = element(383, 336); installScrollHint(el);
    el.scrollLeft = 20; el.listeners.scroll.forEach(f => f()); assert.equal(el.dataset.scrollMore, 'both');
    el.scrollLeft = 47; el.listeners.scroll.forEach(f => f()); assert.equal(el.dataset.scrollMore, 'start');
    el.scrollLeft = 0; el.listeners.scroll.forEach(f => f()); assert.equal(el.dataset.scrollMore, 'end');
  });
  await check('Passt die Zeile (breiteres Fenster), wird das Attribut entfernt, kein leeres Attribut', () => {
    const el = element(383, 336); installScrollHint(el);
    el.clientWidth = 400; el.listeners.scroll.forEach(f => f());
    assert.equal('scrollMore' in el.dataset, false);
  });
  await check('Der Abbau entfernt Beobachter und Attribut', () => {
    const el = element(383, 336), off = installScrollHint(el); assert.equal(el.dataset.scrollMore, 'end');
    off(); assert.equal('scrollMore' in el.dataset, false); assert.equal((el.listeners.scroll || []).length, 0);
  });
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})();
