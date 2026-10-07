// G10(b): derselbe Adapter in Node, Browser, Worker; echtes Browser-fetch gegen lokale Antworten.
const path = require('path'), { pathToFileURL } = require('url'), h = require('./harness');
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
(async () => {
  let browser;
  try {
    const f = await import(pathToFileURL(path.join(__dirname, 'fixtures/bitget.mjs'))), expected = await f.bitgetParity();
    await h.setup(); browser = await h.launch(); const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message)); await page.goto(h.URL_BASE + '/tests/fixtures/bitget.mjs');
    const actual = await page.evaluate(async () => (await import('/tests/fixtures/bitget.mjs')).bitgetParity());
    check('Node/Browser: Bitget-Daten, Indikatorzustand und Fortsetzung exakt gleich', JSON.stringify(actual) === JSON.stringify(expected) && actual.resumed.status === 'bereit');
    const worker = await page.evaluate(() => new Promise((resolve, reject) => {
      const w = new Worker('/tests/fixtures/bitget-worker.mjs', { type: 'module' }), timer = setTimeout(() => { w.terminate(); reject(new Error('Bitget-Worker-Zeitüberschreitung')); }, 8000);
      w.onmessage = e => { clearTimeout(timer); w.terminate(); resolve(e.data); }; w.onerror = e => { clearTimeout(timer); w.terminate(); reject(new Error(e.message)); };
    }));
    check('Node/Browser-Worker: tatsächlicher gemeinsamer Adapterimport', JSON.stringify(worker) === JSON.stringify(expected));
    const calls = [];
    await page.route('https://api.bitget.com/**', async route => {
      const req = route.request(); calls.push({ url: req.url(), method: req.method(), headers: req.headers(), body: req.postData() });
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify(f.responseBody(req.url(), Date.now())) });
    });
    const fetched = await page.evaluate(async selection => (await import('/shared/bitget-public.mjs')).createBitgetPublicClient({ spacingMs: 0 }).load({ selection, config: { patternWeight: 0 } }), f.selection());
    check('Browser-fetch mit öffentlichen Bitget-URLs und CORS-Antwort funktioniert', fetched.status === 'bereit' && fetched.data.scope.venue === 'bitget' && fetched.data.funding.intervalHours === 2);
    check('Kein Konto-/Orderpfad, keine Authentifizierung/Cookies/Schreibmethode', calls.length >= 6 && calls.every(x => x.method === 'GET' && !x.body && !x.headers.authorization && !x.headers.cookie && !Object.keys(x.headers).some(k => k.startsWith('access-')) && new URL(x.url).pathname.startsWith('/api/v2/mix/market/')));
    await page.unroute('https://api.bitget.com/**');
    await page.route('https://api.bitget.com/**', route => route.abort());
    const failed = await page.evaluate(async selection => (await import('/shared/bitget-public.mjs')).createBitgetPublicClient({ spacingMs: 0 }).load({ selection }), f.selection());
    check('Netzausfall bleibt nicht bewertbar, kein Ersatz durch vorhandene Binance-Daten', failed.status === 'nicht bewertbar' && failed.data === null);
    await page.unroute('https://api.bitget.com/**');
    await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })); });
    check('Bitget-Adapter im Offline-Cache', await page.evaluate(async () => { const cache = await caches.open((await caches.keys()).find(x => x.startsWith('scalpdesk-'))); return !!(await cache.match('/shared/bitget-public.mjs')); }));
    await page.context().setOffline(true); await page.goto(h.URL_BASE + '/shared/bitget-public.mjs');
    const offline = await page.evaluate(async () => { const b = await import('/shared/bitget-public.mjs'); const result = await b.createBitgetPublicClient({ spacingMs: 0 }).load({ selection: { instrument: 'BTCUSDT', timeframe: '1h', contextTimeframe: '4h', horizon: 'short', maxHoldMs: 3600e3, slippageBps: 0, indicatorAnchors: { base: 0, context: 0 } } }); return { origin: b.BITGET_ORIGIN, result }; });
    check('Frischer Offline-Import funktioniert, API-Ausfall erhält keine Live-Freigabe', offline.origin === 'https://api.bitget.com' && offline.result.status === 'nicht bewertbar' && offline.result.data === null);
    check('Keine JavaScript-Fehler im Browser', errors.length === 0);
  } finally { await browser?.close(); await h.teardown(); }
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
