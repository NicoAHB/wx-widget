// G10(a): derselbe ES-Modulkern in Node, Browser und echtem Browser-Worker.
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');
const { setup, teardown, launch, URL_BASE } = require('./harness');
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
(async () => {
  let browser;
  try {
    const { parityFixture } = await import(pathToFileURL(path.join(__dirname, 'fixtures/confluence.mjs'))), expected = parityFixture();
    await setup(); browser = await launch(); const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // Keine App starten; dieser Schritt prüft ausschließlich den reinen Kern.
    await page.goto(URL_BASE + '/tests/fixtures/confluence.mjs');
    const actual = await page.evaluate(async () => (await import('/tests/fixtures/confluence.mjs')).parityFixture());
    check('Node und Browser: Indikatoren/Score/Levels/Kosten exakt gleich', JSON.stringify(actual) === JSON.stringify(expected));
    const worker = await page.evaluate(() => new Promise((resolve, reject) => {
      const w = new Worker('/tests/fixtures/confluence-worker.mjs', { type: 'module' });
      const timer = setTimeout(() => { w.terminate(); reject(new Error('Worker-Zeitüberschreitung')); }, 5000);
      w.onmessage = e => { clearTimeout(timer); w.terminate(); resolve(e.data); };
      w.onerror = e => { clearTimeout(timer); w.terminate(); reject(new Error(e.message)); };
    }));
    check('Node und Browser-Worker: derselbe Kern, keine Rechenkopie', JSON.stringify(worker) === JSON.stringify(expected));
    check('MACD-Signal/Histogramm ohne Nullauffüllung in allen drei Laufzeiten', expected.macd.signal.slice(0, 33).every(x => x === null) && actual.macd.signal[33] === worker.macd.signal[33]);
    check('Parameterrevision und Startanker bleiben beim gespeicherten Fortsetzen gleich', actual.signal.parametersKey === expected.signal.parametersKey && actual.state.anchor === expected.state.anchor && worker.state.count === 240);
    const html = fs.readFileSync(path.join(__dirname, '../weather-widget-v2.html'), 'utf8'), sw = fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8');
    check('App und Service Worker haben denselben Versionsstand', html.match(/const APP_VERSION = '([^']+)'/)[1] === sw.match(/const VERSION = '([^']+)'/)[1]);
    await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })); });
    check('Alle drei Fachmodule vom Service Worker vorab gespeichert', await page.evaluate(async () => { const cache = await caches.open((await caches.keys()).find(x => x.startsWith('scalpdesk-'))); return (await Promise.all(['confluence-core', 'indicators', 'pattern-score'].map(x => cache.match('/shared/' + x + '.mjs')))).every(Boolean); }));
    await page.context().setOffline(true);
    // Neue Dokumentinstanz, damit der Modulcache des ersten Tests keinen fehlenden Offline-Import verdeckt.
    await page.goto(URL_BASE + '/shared/indicators.mjs');
    const offline = await page.evaluate(async () => { const c = await import('/shared/confluence-core.mjs'); return { ema: c.ema([1, 2, 3, 7], 3), cross: c.crossStatus() }; });
    check('Neuer Offline-Import einschließlich beider Abhängigkeiten funktioniert', JSON.stringify(offline.ema) === JSON.stringify([null, null, 2, 4.5]) && offline.cross.liquidationPrice === null);
    check('Kein JavaScript-Fehler im Browser', errors.length === 0);
  } finally { await browser?.close(); await teardown(); }
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
