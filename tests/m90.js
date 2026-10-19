// Privater GitHub-Sync in zwei getrennten Browserprofilen; keine echten Token oder Uploads.
const h = require('./harness');
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
(async () => {
  await h.setup(); const browser = await h.launch({ workspace: 'fresh' }); let remote = null, sha = 0, puts = [], reads = [], errors = [], contexts = [];
  const phrase = 'Lokales Geräte-Testpasswort äö€', cfg = { owner: 'nicoahb', repo: 'wx-widget-daten', branch: 'main', path: 'backup.json', token: 'LOCAL_GITHUB_TEST_TOKEN', device: 'iPhone A' };
  async function profile(name, watch, withData) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); contexts.push(ctx);
    await ctx.route('https://api.github.com/**', async route => {
      const req = route.request(); if (req.method() === 'OPTIONS') return route.fulfill({ status: 204 });
      const u = new URL(req.url()); let status = 200, data;
      if (req.method() === 'PUT') { const body = req.postDataJSON(); puts.push(body); remote = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')); sha++; data = { content: { sha: String(sha) } }; }
      else if (u.pathname.includes('/contents/')) { reads.push(u); status = remote ? 200 : 404; data = remote ? { type: 'file', sha: String(sha), size: JSON.stringify(remote).length, encoding: 'base64', content: Buffer.from(JSON.stringify(remote)).toString('base64') } : {}; }
      else data = { private: true };
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await ctx.addInitScript(({ cfg, watch, withData }) => {
      if (localStorage.getItem('seeded-github-90')) return; localStorage.setItem('seeded-github-90', '1');
      localStorage.setItem('scalpdesk-github-device.v1', JSON.stringify(cfg)); localStorage.setItem('scalpdesk.watchlist.v1', JSON.stringify(watch));
      localStorage.setItem('scalpdesk.watch-model.v1', JSON.stringify(withData ? 'strict' : 'classic'));
      localStorage.setItem('scalpdesk.muster.settings.v1', JSON.stringify({ capital: withData ? 1234 : 456 }));
      localStorage.setItem('scalpdesk.channels.v1', JSON.stringify({ tg: { token: '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', chat: '987654321' }, dc: { url: 'https://discord.com/api/webhooks/123456789012345678/LOCAL_DISCORD_SECRET_123456789012', on: true }, ev: { pulse: false, news: false } }));
      if (withData) localStorage.setItem('scalpdesk.history.v1', JSON.stringify([{ id: 'gh-personal-90', symbol: 'BTCUSDT', side: 'long', mode: 'isolated', entry: 64000, leverage: 1, qty: .01, margin: 640, openedAt: Date.now() - 7200000, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false }, exit: 65000, fees: 0, pnl: 10, pnlSource: 'calc', closedAt: Date.now() - 3600000, fx: 1.16, note: 'Persönlicher äö€-Trade' }]));
    }, { cfg: { ...cfg, device: name }, watch, withData });
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => !!window.__githubSync && !!window.__g05);
    await page.click('[data-workspace-target="settings"]'); await page.evaluate(() => document.getElementById('data-panel').hidden = false); return { ctx, page };
  }
  try {
    const a = await profile('iPhone A', ['BTC', 'ETH'], true), page = a.page;
    check('Zwei große mobile Sync-Tasten erreichbar', await page.locator('#github-sync-save').isVisible() && await page.locator('#github-sync-load').isVisible() && await page.locator('#github-sync-save').evaluate(e => e.getBoundingClientRect().height >= 48));
    check('Discord vollständig aus der Oberfläche und lokalen Kanal-Einrichtung entfernt', await page.locator('#dc-url,#dc-test').count() === 0 && await page.evaluate(() => !__g05.chan.dc && !JSON.parse(localStorage.getItem('scalpdesk.channels.v1')).dc));
    const collected = await page.evaluate(() => __githubSync.collect());
    check('Vollständiger persönlicher Stand samt neuer Muster-Einstellung gesammelt', collected.backup.history.some(t => t.id === 'gh-personal-90') && collected.preferences.find(p => p.key === 'scalpdesk.muster.settings.v1').value.capital === 1234 && collected.models.bot === null);
    check('Modellauswahl wird in der persönlichen Sicherung mitgeführt', collected.preferences.find(p => p.key === 'scalpdesk.watch-model.v1')?.value === 'strict');
    check('3.83.0: Einstellungen und Lernstände nur einmal in der Datei (preferences, nicht zusätzlich backup.prefs)', !('prefs' in collected.backup) && collected.preferences.length > 40);
    check('Token, Demo-Bücher, Dienst- und andere Zugangsdaten fehlen in der Nutzlast', !/LOCAL_GITHUB_TEST_TOKEN|AAHdqTcv|LOCAL_DISCORD_SECRET|scalpdesk\.channels|scalpdesk\.s247|scalpdesk\.github-emergency/.test(JSON.stringify(collected)) && collected.backup.demoPositions.length === 0 && collected.backup.demoHistory.length === 0);
    await page.click('#github-sync-save'); await page.waitForSelector('#github-sync-dialog[open]'); await page.fill('#github-sync-passphrase', phrase); await page.click('#github-sync-confirm');
    await page.waitForFunction(() => document.getElementById('github-sync-status').textContent.includes('auf GitHub gespeichert'));
    check('Upload enthält Ciphertext und lesbare Metadaten, keine persönlichen Klartextdaten', puts.length === 1 && !puts[0].sha && remote.device === 'iPhone A' && !!remote.data && !JSON.stringify(remote).includes('gh-personal-90'));
    check('Passphrase nach Abschluss aus dem Dialog und gespeichertem App-Stand entfernt', await page.inputValue('#github-sync-passphrase') === '' && await page.evaluate(phrase => !Object.values(localStorage).some(v => v.includes(phrase)), phrase));
    const b = await profile('iPad B', ['LTC'], false), p2 = b.page;
    await p2.waitForSelector('#github-sync-hint:not([hidden])');
    check('Zweites Gerät zeigt neueren Stand, überschreibt aber nichts', (await p2.locator('#github-sync-hint').innerText()).includes('Neuerer Stand verfügbar') && await p2.evaluate(() => __g05.state.watch.join(',') === 'LTC'));
    await p2.click('#github-sync-load'); await p2.waitForSelector('#github-sync-dialog[open]');
    check('Laden verlangt ausdrückliche Bestätigung mit Datum und Quellgerät', (await p2.locator('#github-sync-confirm-info').innerText()).includes('iPhone A') && await p2.evaluate(() => __g05.state.trades.length === 0));
    await p2.fill('#github-sync-passphrase', 'Falsches Passwort'); await p2.click('#github-sync-confirm'); await p2.waitForFunction(() => /Falsche Passphrase/.test(document.getElementById('github-sync-status').textContent));
    check('Falsche Passphrase verändert weder persönliche Daten noch Übungseinstellungen', await p2.evaluate(() => __g05.state.trades.length === 0 && JSON.parse(localStorage.getItem('scalpdesk.muster.settings.v1')).capital === 456));
    await p2.click('#github-sync-load'); await p2.waitForSelector('#github-sync-dialog[open]'); await p2.fill('#github-sync-passphrase', phrase); await p2.click('#github-sync-confirm');
    await p2.waitForFunction(() => __g05.state.trades.some(t => t.id === 'gh-personal-90')); await p2.waitForTimeout(2300); await p2.waitForFunction(() => !!window.__githubSync);
    await p2.click('[data-workspace-target="settings"]'); await p2.evaluate(() => document.getElementById('data-panel').hidden = false);
    check('Persönlicher Trade und neue Einstellungen nach Neuladen übernommen', await p2.evaluate(() => __g05.state.trades.some(t => t.id === 'gh-personal-90') && JSON.parse(localStorage.getItem('scalpdesk.muster.settings.v1')).capital === 1234));
    check('Geladene Modellauswahl ist nach Neustart wirklich aktiv', await p2.evaluate(() => __watchModels.mode === 'strict'));
    check('Gerät behält eigenen Namen/Token und bietet die lokale Notfallkopie an', (await p2.locator('#github-sync-last').innerText()).includes('iPad B') && await p2.locator('#github-sync-undo').isVisible());
    await p2.click('#github-sync-undo'); await p2.waitForTimeout(1700); await p2.waitForFunction(() => !!window.__githubSync);
    check('Rückgängig stellt den vollständigen früheren lokalen Stand wieder her', await p2.evaluate(() => __g05.state.trades.length === 0 && __g05.state.watch.join(',') === 'LTC' && JSON.parse(localStorage.getItem('scalpdesk.muster.settings.v1')).capital === 456));
    check('Rückgängig stellt auch die frühere Modellauswahl wieder her', await p2.evaluate(() => __watchModels.mode === 'classic'));
    await page.click('#github-sync-save'); await page.waitForSelector('#github-sync-dialog[open]'); await page.fill('#github-sync-passphrase', phrase); await page.click('#github-sync-confirm'); await page.waitForFunction(() => document.getElementById('github-sync-status').textContent.includes('auf GitHub gespeichert'));
    check('Zweiter Upload verwendet SHA der bestehenden Datei', puts.length === 2 && puts[1].sha === '1');
    await page.click('#github-sync-load'); await page.waitForSelector('#github-sync-dialog[open]'); await page.locator('#github-sync-dialog button').filter({ hasText: 'Abbrechen' }).click();
    check('Abbrechen beendet Laden ohne Änderung oder offenes Passwort', await page.inputValue('#github-sync-passphrase') === '' && await page.evaluate(() => __g05.state.trades.some(t => t.id === 'gh-personal-90')));
    for (const width of [320, 390, 768]) { await page.setViewportSize({ width, height: 844 }); check(`Sync ohne rechten Überlauf bei ${width}px`, await page.evaluate(() => { const r = document.getElementById('github-sync').getBoundingClientRect(); return r.right <= innerWidth + 1 && [...document.querySelectorAll('#github-sync input')].every(e => e.getBoundingClientRect().right <= r.right + 1); })); }
    // Ältere Sicherungen kennen die beiden neuen Schlüssel nicht. Sie bleiben vollständig ladbar.
    const old = structuredClone(collected); old.preferences = old.preferences.filter(p => !['scalpdesk.watch-model.v1', 'scalpdesk.watch-compare.v1'].includes(p.key));
    remote = await page.evaluate(async ({ data, phrase }) => { const { encryptGithubBackup } = await import('./shared/github-sync.mjs'); return encryptGithubBackup(data, phrase, 'Altgerät'); }, { data: old, phrase }); sha++;
    await p2.click('[data-workspace-target="settings"]'); await p2.click('#watch-model-toggle'); await p2.waitForFunction(() => __watchModels.mode === 'strict' && !document.getElementById('watch-model-toggle').disabled);
    await p2.evaluate(() => document.getElementById('data-panel').hidden = false); await p2.click('#github-sync-load'); await p2.waitForSelector('#github-sync-dialog[open]'); await p2.fill('#github-sync-passphrase', phrase); await p2.click('#github-sync-confirm');
    await p2.waitForFunction(() => __g05.state.trades.some(t => t.id === 'gh-personal-90')); await p2.waitForTimeout(2300); await p2.waitForFunction(() => window.__watchModels);
    check('Alte GitHub-Sicherung ohne Modellschlüssel bleibt ladbar und setzt auf Bisherig zurück', await p2.evaluate(() => __watchModels.mode === 'classic' && __g05.state.trades.some(t => t.id === 'gh-personal-90')));
    check('Abrufe ausdrücklich ohne Cache-Kennung und keine Laufzeitfehler', reads.every(u => u.searchParams.has('_') && u.searchParams.get('ref') === 'main') && errors.length === 0);
  } finally { for (const ctx of contexts) await ctx.close(); await browser.close(); await h.teardown(); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
