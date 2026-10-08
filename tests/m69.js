// G13: tatsächliche Archiv-IDB, alter SW -> geprüftes Bündel, Abbruch/Retry, Offline und Quelle/Serverparität.
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto'), os = require('os'), h = require('./harness');
const root = path.resolve(__dirname, '..'), version = /APP_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(root, 'weather-widget-v2.html'), 'utf8'))[1], nextVersion = version.replace(/\d+$/, n => String(Number(n) + 1)); let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + String(detail).slice(0, 300) : ''}`); };
const digest = x => crypto.createHash('sha256').update(x).digest('hex');
(async () => { let browser, server, watcher, tmp;
  try {
    await h.setup(); browser = await h.launch(); const fixture = await (await import('./fixtures/model-archive.mjs')).modelArchiveFixture();
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
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }), errors = []; await ctx.route('https://api.bitget.com/**', route => route.fulfill({ status: 429, headers: { 'retry-after': '60' }, contentType: 'application/json', body: JSON.stringify({ code: '429', msg: 'öffentliche Testdrossel' }) }));
    await ctx.addInitScript(() => { if (localStorage.getItem('g13-seeded')) return; localStorage.setItem('g13-seeded', '1'); localStorage.setItem('scalpdesk.positions.v1', JSON.stringify([{ id: 'G13_SIMULIERTE_POSITION', symbol: 'BTCUSDT', side: 'short', mode: 'cross', source: 'spot', entry: 60000, qty: .01, leverage: 20, openedAt: Date.now(), updatedAt: Date.now(), ack: { sl: false, tp: false } }])); });
    await ctx.addInitScript(({ version, nextVersion }) => { window.g13CurrentVersion = version; window.g13NextVersion = nextVersion; }, { version, nextVersion });
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => void d.accept()); await page.goto(base + '/weather-widget-v2.html'); await page.waitForFunction(() => !!window.__g13 && __g12.view.state.confirmed);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })); });
    check('Vorhandener 3.45-Service-Worker tatsächlich installiert', await page.evaluate(async () => (await caches.keys()).includes('scalpdesk-3.45.0')));
    const savedPersonal = await page.evaluate(() => { __g05.persist(); return JSON.stringify(__g05.backupPayload().positions); });
    serving = 'current'; await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
    // Playwright prüft ein Promise selbst als wahr; deshalb asynchrones Ergebnis hier ausdrücklich abwarten und erneut prüfen.
    await page.evaluate(async () => { const end = Date.now() + 20000;
      while (Date.now() < end) {
        const ready = await new Promise(resolve => { const ch = new MessageChannel(); const timer = setTimeout(() => { ch.port1.close(); resolve(false); }, 200); ch.port1.onmessage = async e => { clearTimeout(timer); ch.port1.close(); const r = await navigator.serviceWorker.getRegistration(); resolve(e.data.version === g13CurrentVersion && navigator.serviceWorker.controller?.state === 'activated' && r.active?.state === 'activated'); }; navigator.serviceWorker.controller?.postMessage({ type: 'bundle-status' }, [ch.port2]); });
        if (ready) return; await new Promise(resolve => setTimeout(resolve, 50));
      } throw new Error('Bestätigtes, aktiviertes Bündel fehlt.');
    });
    const firstCache = await page.evaluate(async () => { const keys = await caches.keys(), name = keys.find(x => x.startsWith('scalpdesk-' + g13CurrentVersion + '-')), cache = await caches.open(name); return { keys, complete: !!await cache.match('/__bundle_complete__'), marker: (await cache.keys()).map(r => r.url).filter(x => x.includes('bundle_complete')), state: (await navigator.serviceWorker.getRegistration()).active.state, origin: location.origin }; });
    check(`3.45 -> ${version}: vollständiges bestätigtes Bündel und alter Rückfallcache erhalten`, firstCache.keys.includes('scalpdesk-3.45.0') && firstCache.complete, JSON.stringify(firstCache));
    await page.evaluate(async data => { await __g13.importModelArchive(data, { includeBot: true }); await __g12.view.refresh(); }, fixture);
    const exported = await page.evaluate(() => __g13.exportModelArchive());
    check('Archive in tatsächlicher IDB: Konfluenz/PO3-IDs und Quellen/Anker erhalten', exported.observations[0].id === fixture.observations[0].id && exported.po3Journal[0].id === fixture.po3Journal[0].id && exported.po3Journal[0].source.anchors['1m'] === fixture.po3Journal[0].source.anchors['1m']);
    check('Bot-Restore deaktiviert, Gewinnsperre/Laufbasis/Commands erhalten', !exported.bot.enabled && exported.bot.run.stops.gain && exported.bot.run.referenceUSDT === '1000' && exported.bot.commands.length === 3 && !exported.bot.run.automaticTrading);
    check('Persönliche Positionen/Sicherung durch separaten Import unverändert', await page.evaluate(saved => JSON.stringify(__g05.backupPayload().positions) === saved && __g05.backupPayload().version === 8, savedPersonal));
    await page.evaluate(data => __g13.importModelArchive(data), fixture); const twice = await page.evaluate(() => __g13.exportModelArchive());
    check('Wiederholter Originalimport ohne Dubletten und ohne Bot-Reaktivierung', twice.observations.length === 1 && twice.po3Journal.length === 1 && !twice.bot.enabled);
    const downloadPromise = page.waitForEvent('download'); await page.evaluate(() => document.getElementById('model-archive-save').click()); const downloaded = JSON.parse(fs.readFileSync(await (await downloadPromise).path(), 'utf8'));
    check('Tatsächlicher Archiv-Download enthält native Originale und eingefrorenen Bot-Lauf', downloaded.observations.length === 1 && downloaded.po3Journal.length === 1 && downloaded.bot.run.stops.gain);
    await page.locator('#model-archive-file').setInputFiles({ name: 'g13-simulation.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
    await page.waitForFunction(() => document.getElementById('model-archive-status').textContent.startsWith('Bestätigt:'));
    check('Tatsächlicher Dateiimport/Bestätigungsdialog und Worker-Neulesen, kein Bot-Neustart', /PO3-Journal/.test(await page.textContent('#model-archive-status')) && (await page.evaluate(() => __g13.exportModelArchive())).bot.enabled === false);
    const refused = await page.evaluate(async data => { try { await __g13.importModelArchive(data, { includeBot: true }); return false; } catch { return true; } }, fixture);
    check('Bestehenden Bot-Lauf nicht durch Datei überschreiben', refused && (await page.evaluate(() => __g13.exportModelArchive())).bot.run.id === fixture.bot.run.id);
    const conflict = structuredClone(fixture); conflict.observations[0].data.base.price++;
    check('Originalkonflikt vor Änderung aller Archive abgelehnt', await page.evaluate(async data => { const before = JSON.stringify(await __g13.exportModelArchive()); try { await __g13.importModelArchive(data); return false; } catch { const after = await __g13.exportModelArchive(), previous = JSON.parse(before); return JSON.stringify(after.observations) === JSON.stringify(previous.observations) && JSON.stringify(after.po3Journal) === JSON.stringify(previous.po3Journal); } }, conflict));
    check('Speicherfehler nach erster Phase: bestätigte Teilphase sichtbar, Originale erhalten', await page.evaluate(async data => { const transaction = IDBDatabase.prototype.transaction; IDBDatabase.prototype.transaction = function(...args) { if (this.name === 'scalpdesk-po3' && args[1] === 'readwrite') throw new Error('Test: Speicherfehler'); return transaction.apply(this, args); }; try { await __g13.importModelArchive(data); return false; } catch (e) { return e.message.includes('Bereits bestätigt: Konfluenz-Originale'); } finally { IDBDatabase.prototype.transaction = transaction; } }, fixture) && (await page.evaluate(() => __g13.exportModelArchive())).po3Journal.length === 1);
    serving = 'next'; damage = true;
    await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); await new Promise((resolve, reject) => { const worker = r.installing; if (!worker) return reject(new Error('Updateprüfung nicht gestartet')); const timer = setTimeout(() => reject(new Error('Updateabbruch fehlt: ' + worker.state)), 15000); const test = () => { if (worker.state === 'redundant') { clearTimeout(timer); resolve(); } }; worker.addEventListener('statechange', test); test(); }); });
    check('Fehlerhaftes Folgemodul: keine Aktivierung/kein Teilcache, alte Daten bleiben', await page.evaluate(async () => !(await caches.keys()).some(x => x.startsWith('scalpdesk-' + g13NextVersion + '-'))) && await page.evaluate(saved => JSON.stringify(__g05.backupPayload().positions) === saved, savedPersonal));
    damage = false; await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r.update(); });
    await page.evaluate(async () => { const end = Date.now() + 20000; while (Date.now() < end) {
      if (navigator.serviceWorker.controller?.state === 'activated' && (await navigator.serviceWorker.getRegistration()).active?.state === 'activated' && (await caches.keys()).some(x => x.startsWith('scalpdesk-' + g13NextVersion + '-')) && document.getElementById('app-update-note')?.textContent.includes(g13NextVersion)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    } throw new Error('Vollständiges Folgeupdate fehlt.'); });
    check('Folgestand vollständig: bewusster Reload-Hinweis, aktuelle/geöffnete Modulversion getrennt', /gesichert|sichern/i.test(await page.textContent('#app-update-note')) && exported.appVersion === version);
    const cachesAfter = await page.evaluate(async () => (await caches.keys()).filter(x => x.startsWith('scalpdesk-')));
    check('Programmcache begrenzt auf aktuellen und vorherigen Stand', cachesAfter.length === 2, JSON.stringify(cachesAfter));
    await ctx.setOffline(true); const offline = await ctx.newPage(); offline.on('pageerror', e => errors.push(e.message)); await offline.goto(base + '/weather-widget-v2.html'); await offline.waitForFunction(() => !!window.__g13 && __g12.view.state.confirmed?.run);
    const offlineArchive = await offline.evaluate(() => __g13.exportModelArchive());
    check('Frischer Offline-Appstart lädt vollständiges neues Modulnetz, Originale/Stopps erhalten', offlineArchive.appVersion === nextVersion && offlineArchive.observations.length === 1 && offlineArchive.po3Journal.length === 1 && !offlineArchive.bot.enabled && offlineArchive.bot.run.stops.gain);
    check('Native persönliche Daten über Update/Offline unverändert', await offline.evaluate(saved => JSON.stringify(__g05.backupPayload().positions) === saved, savedPersonal)); await ctx.setOffline(false);
    const W = await import('../server/scalpdesk-247.mjs'); tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'm69-')); fs.writeFileSync(path.join(tmp, 'bot-simulation.json'), JSON.stringify(fixture.bot));
    watcher = new W.Watcher({ token: '123456789:TEST_ONLY_NOT_A_REAL_TOKEN_000000000', chat: '-100777', key: 'k'.repeat(43), statePath: path.join(tmp, 'state.json'), log: () => {} });
    check('App/Server benutzen gleichen Bot-Grenzkern und Originalzustand', watcher.botSimulation.view().run.netUSDT === offlineArchive.bot.run.netUSDT && !!watcher.botSimulation.view().run.stops.gain && !watcher.botSimulation.view().actions.privateOrders);
    watcher.botSimulation.stop(); watcher.po3.stop(); watcher.ki.stop(); fs.writeFileSync(path.join(tmp, 'bot-simulation.json'), '{beschädigt');
    watcher = new W.Watcher({ token: '123456789:TEST_ONLY_NOT_A_REAL_TOKEN_000000000', chat: '-100777', key: 'k'.repeat(43), statePath: path.join(tmp, 'state.json'), log: () => {} });
    check('Beschädigter Bot-Zustand stoppt nur Simulation, Originaldatei bleibt', watcher.botSimulation.stopped && !watcher.ki.stopped && fs.readFileSync(path.join(tmp, 'bot-simulation.json'), 'utf8') === '{beschädigt');
    check('Keine JavaScript-Fehler bei Update/Archiv/Offline', !errors.length, errors.join('; '));
  } finally { await browser?.close(); if (watcher) { watcher.botSimulation.stop(); watcher.po3.stop(); watcher.ki.stop(); clearTimeout(watcher.saveTimer); } if (server) { server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); } await h.teardown(); if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
