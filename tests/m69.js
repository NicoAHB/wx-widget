// G13: alter SW -> geprüftes Bündel, Abbruch/Retry, Offline. 3.68.0: Modellarchiv-/Bot-Teil mit KI-Signalen/Trading-Bot entfernt.
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto'), os = require('os'), h = require('./harness');
const root = path.resolve(__dirname, '..'), version = /APP_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(root, 'weather-widget-v2.html'), 'utf8'))[1], nextVersion = version.replace(/\d+$/, n => String(Number(n) + 1)); let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + String(detail).slice(0, 300) : ''}`); };
const digest = x => crypto.createHash('sha256').update(x).digest('hex');
(async () => { let browser, server, tmp;
  try {
    await h.setup(); browser = await h.launch();
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), oldSw = fs.readFileSync(path.join(__dirname, 'fixtures/sw-3.45.js'), 'utf8');
    const html = fs.readFileSync(path.join(root, 'weather-widget-v2.html'), 'utf8'), manifest = JSON.parse(fs.readFileSync(path.join(root, `bundles/${version}/manifest.json`), 'utf8'));
    let serving = 'legacy', damage = false;
    const nextHtml = html.replaceAll(version, nextVersion), nextManifest = structuredClone(manifest); nextManifest.version = nextVersion;
    for (const f of nextManifest.files) { f.path = f.path.replace(version, nextVersion); if (f.path === './weather-widget-v2.html') { f.bytes = Buffer.byteLength(nextHtml); f.sha256 = digest(nextHtml); } }
    const nextText = JSON.stringify(nextManifest, null, 2) + '\n', nextSw = sw.replace(`VERSION = '${version}'`, `VERSION = '${nextVersion}'`).replace(/BUILD_ID = '[^']+'/ , "BUILD_ID = '" + digest(nextText).slice(0, 16) + "'");
    server = http.createServer((req, res) => { const url = new URL(req.url, 'http://x'), name = decodeURIComponent(url.pathname).slice(1); let data, mime = 'application/octet-stream';
      if (name === 'sw.js') { data = serving === 'legacy' ? oldSw : serving === 'next' ? nextSw : sw; mime = 'text/javascript'; }
      else if (name === 'weather-widget-v2.html') { data = serving === 'next' ? nextHtml : html; mime = 'text/html'; }
      else if (name === `bundles/${nextVersion}/manifest.json`) { data = nextText; mime = 'application/json'; }
      else { const relative = name.replace(`bundles/${nextVersion}/`, `bundles/${version}/`), file = path.join(root, relative); if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('nf'); }
        data = fs.readFileSync(file); if (damage && name === `bundles/${nextVersion}/shared/bot-limits.mjs`) data = Buffer.concat([data, Buffer.from('\n// fehlerhaftes Lieferteil')]);
        mime = name.endsWith('.mjs') || name.endsWith('.js') ? 'text/javascript' : name.endsWith('.html') ? 'text/html' : name.endsWith('.json') ? 'application/json' : name.endsWith('.png') ? 'image/png' : name.endsWith('.webmanifest') ? 'application/manifest+json' : mime; }
      res.writeHead(200, { 'content-type': mime, 'cache-control': 'no-store', 'service-worker-allowed': '/' }); res.end(data);
    }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const base = 'http://127.0.0.1:' + server.address().port;
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), errors = [];
    await ctx.addInitScript(() => { if (localStorage.getItem('g13-seeded')) return; localStorage.setItem('g13-seeded', '1'); localStorage.setItem('scalpdesk.positions.v1', JSON.stringify([{ id: 'G13_SIMULIERTE_POSITION', symbol: 'BTCUSDT', side: 'short', mode: 'cross', source: 'spot', entry: 60000, qty: .01, leverage: 20, openedAt: Date.now(), updatedAt: Date.now(), ack: { sl: false, tp: false } }])); });
    await ctx.addInitScript(({ version, nextVersion }) => { window.g13CurrentVersion = version; window.g13NextVersion = nextVersion; }, { version, nextVersion });
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => void d.accept()); await page.goto(base + '/weather-widget-v2.html'); await page.waitForFunction(() => !!window.__g05 && !!document.getElementById('app-version'));
    await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })); });
    check('Vorhandener 3.45-Service-Worker tatsächlich installiert', await page.evaluate(async () => (await caches.keys()).includes('scalpdesk-3.45.0')));
    const savedPersonal = await page.evaluate(() => { __g05.persist(); return JSON.stringify(__g05.backupPayload().positions); });
    serving = 'current'; await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
    // Playwright prüft ein Promise selbst als wahr; deshalb asynchrones Ergebnis hier ausdrücklich abwarten und erneut prüfen.
    await page.evaluate(async () => { const end = Date.now() + 20000; let lastReply = null;
      while (Date.now() < end) {
        const ready = await new Promise(resolve => { const ch = new MessageChannel(); const timer = setTimeout(() => { ch.port1.close(); resolve(false); }, 200); ch.port1.onmessage = async e => { lastReply = e.data; clearTimeout(timer); ch.port1.close(); const r = await navigator.serviceWorker.getRegistration(); resolve(e.data.version === g13CurrentVersion && navigator.serviceWorker.controller?.state === 'activated' && r.active?.state === 'activated'); }; navigator.serviceWorker.controller?.postMessage({ type: 'bundle-status' }, [ch.port2]); });
        if (ready) return; await new Promise(resolve => setTimeout(resolve, 50));
      } const r = await navigator.serviceWorker.getRegistration(); throw new Error('Bestätigtes, aktiviertes Bündel fehlt: ' + JSON.stringify({ lastReply, active: r.active?.state, installing: r.installing?.state, waiting: r.waiting?.state, controller: navigator.serviceWorker.controller?.state, keys: await caches.keys() }));
    });
    const firstCache = await page.evaluate(async () => { const keys = await caches.keys(), name = keys.find(x => x.startsWith('scalpdesk-' + g13CurrentVersion + '-')), cache = await caches.open(name); return { keys, complete: !!await cache.match('/__bundle_complete__'), marker: (await cache.keys()).map(r => r.url).filter(x => x.includes('bundle_complete')), state: (await navigator.serviceWorker.getRegistration()).active.state, origin: location.origin }; });
    check(`3.45 -> ${version}: vollständiges bestätigtes Bündel und alter Rückfallcache erhalten`, firstCache.keys.includes('scalpdesk-3.45.0') && firstCache.complete, JSON.stringify(firstCache));
    serving = 'next'; damage = true;
    await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); await new Promise((resolve, reject) => { const worker = r.installing; if (!worker) return reject(new Error('Updateprüfung nicht gestartet')); const timer = setTimeout(() => reject(new Error('Updateabbruch fehlt: ' + worker.state)), 15000); const test = () => { if (worker.state === 'redundant') { clearTimeout(timer); resolve(); } }; worker.addEventListener('statechange', test); test(); }); });
    check('Fehlerhaftes Folgemodul: keine Aktivierung/kein Teilcache, alte Daten bleiben', await page.evaluate(async () => !(await caches.keys()).some(x => x.startsWith('scalpdesk-' + g13NextVersion + '-'))) && await page.evaluate(saved => JSON.stringify(__g05.backupPayload().positions) === saved, savedPersonal));
    damage = false; await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
    await page.evaluate(async () => { const end = Date.now() + 20000; while (Date.now() < end) {
      if (navigator.serviceWorker.controller?.state === 'activated' && (await navigator.serviceWorker.getRegistration()).active?.state === 'activated' && (await caches.keys()).some(x => x.startsWith('scalpdesk-' + g13NextVersion + '-')) && document.getElementById('app-update-note')?.textContent.includes(g13NextVersion)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    } throw new Error('Vollständiges Folgeupdate fehlt.'); });
    check('Folgestand vollständig: bewusster Reload-Hinweis, aktuelle/geöffnete Modulversion getrennt', /gesichert|sichern/i.test(await page.textContent('#app-update-note')) );
    const cachesAfter = await page.evaluate(async () => (await caches.keys()).filter(x => x.startsWith('scalpdesk-')));
    check('Programmcache begrenzt auf aktuellen und vorherigen Stand', cachesAfter.length === 2, JSON.stringify(cachesAfter));
    await ctx.setOffline(true); const offline = await ctx.newPage(); offline.on('pageerror', e => errors.push(e.message)); await offline.goto(base + '/weather-widget-v2.html'); await offline.waitForFunction(() => !!window.__g05 && !!document.getElementById('app-version'));
    check('Frischer Offline-Appstart lädt vollständiges neues Modulnetz', await offline.evaluate(v => document.getElementById('app-version').textContent.includes(v), nextVersion));
    check('Native persönliche Daten über Update/Offline unverändert', await offline.evaluate(saved => JSON.stringify(__g05.backupPayload().positions) === saved, savedPersonal)); await ctx.setOffline(false);
    check('Keine JavaScript-Fehler bei Update/Offline', !errors.length, errors.join('; '));
  } finally { await browser?.close(); if (server) { server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); } await h.teardown(); if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
