// 3.59.0: verlustfreie Safari-Kompression und kompakte persönliche Sicherung. 3.67.0: QR-Übertragung entfernt, Datei im eigenen Dialog.
// Tatsächlicher App-Code, native Download-/Datei-/Textimporte, AES-GCM, Grenzen und Safari-Teilgeste simuliert.
const h = require('./harness'), fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib');
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const root = path.resolve(__dirname, '..'), debug = 'weather-widget-v2.debug83.html';
const click = (page, id) => page.evaluate(id => document.getElementById(id).click(), id);
const text = (page, id) => page.locator('#' + id).textContent();
const hasPreview = page => page.waitForFunction(() => !document.getElementById('sync-preview').hidden);
const fixture = {
  'scalpdesk.history.v1': Array.from({ length: 40 }, (_, i) => ({ id: 'QR59-' + i, symbol: i % 2 ? 'BTCUSDT' : 'ETHUSDT', side: 'long', mode: 'isolated', entry: 100, exit: 101, leverage: 10, qty: 1, margin: 10, openedAt: Date.UTC(2025, 0, 1) + i * 3600000, closedAt: Date.UTC(2025, 0, 1, 1) + i * 3600000, source: 'spot', sl: null, tp: null, ack: { sl: false, tp: false }, preRealized: 0, fees: 0, pnl: 1, pnlSource: 'calc', fx: .92, note: 'Vollständig sichern · äöü 💾 · ' + 'Seitwärtsphase '.repeat(12) + i })),
  'scalpdesk.theme.v1': 'light',
  'scalpdesk.rlearn.v1': { v: 1, t: { 'R-QR59': { at: Date.UTC(2025, 0, 1), o: Date.UTC(2024, 11, 31, 23), s: 'BTCUSDT', d: 'long', g: ['RSI'], p: 1, k: 1 } } },
};
const fromCode = code => new Uint8Array(Buffer.from(code.slice(5, code.indexOf('.', 5)), 'base64'));
async function open(browser, { mode = 'normal', seed = {}, share = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, acceptDownloads: true, timezoneId: 'Europe/Berlin' });
  await ctx.addInitScript(({ mode, seed, share }) => {
    if (!localStorage.getItem('m83seed')) { localStorage.setItem('m83seed', '1'); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, JSON.stringify(v)); }
    window.m83CapabilityCalls = [];
    for (const key of ['CompressionStream', 'DecompressionStream']) {
      const Native = window[key];
      if (mode === 'none') window[key] = undefined;
      else if (mode === 'safari') window[key] = class { constructor(format) { window.m83CapabilityCalls.push(key + ':' + format); if (format === 'deflate-raw') throw new TypeError('Älteres Safari (Test): kein deflate-raw'); return new Native(format); } };
    }
    if (share) {
      window.m83Share = { mode: 'ok', calls: [] };
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: v => v.files?.length === 1 });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async ({ files }) => {
        const actual = navigator.userActivation.isActive;
        if (window.m83Share.mode === 'abort') throw new DOMException('Abbruch (Test)', 'AbortError');
        if (window.m83Share.mode === 'deny' || !actual) throw new DOMException('Keine Tippgeste (Test)', 'NotAllowedError');
        window.m83Share.calls.push({ name: files[0].name, type: files[0].type, text: await files[0].text(), actual });
      } });
    }
  }, { mode, seed, share });
  const page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(h.URL_BASE + '/' + debug); await page.waitForFunction(() => window.__qr83 && window.__g05);
  return { ctx, page, errors };
}
async function openTransfer(page) { await page.evaluate(() => { if (document.getElementById('data-panel').hidden) document.getElementById('data-toggle').click(); }); await click(page, 'backup-compact'); await page.waitForFunction(() => /Vollständige Sicherung/.test(document.getElementById('transfer-info').textContent)); }
async function prepare(page, password = '') {
  await page.fill('#transfer-pass', password); await click(page, 'transfer-file-make');
  await page.waitForFunction(() => !document.getElementById('transfer-file-ready').hidden);
}
async function save(page, id = 'transfer-file-save') {
  const promise = page.waitForEvent('download'); await click(page, id); const dl = await promise, file = path.join(os.tmpdir(), 'm83-' + dl.suggestedFilename()); await dl.saveAs(file);
  return { file, name: dl.suggestedFilename(), text: fs.readFileSync(file, 'utf8') };
}
async function importFile(page, file) { await page.setInputFiles('#backup-file', file); await page.waitForFunction(() => !document.getElementById('sync-preview').hidden || !document.getElementById('decrypt-row').hidden || /Prüfsumme|beschädigt|zu groß|Nichts Neues/.test(document.getElementById('history-status').textContent)); }
(async () => { let browser; const contexts = [];
  try {
    const source = fs.readFileSync(path.join(root, 'weather-widget-v2.html'), 'utf8'), anchor = '\nrender();startLive();'; if (!source.includes(anchor)) throw new Error('Testanker fehlt');
    fs.writeFileSync(path.join(root, debug), source.replace(anchor, '\nwindow.__qr83={packBackup,unpackBackup,backupPayload,compactTransfer,resetTransfer};' + anchor));
    await h.setup(); await h.ctl('/walk?on=0'); browser = await h.launch();
    const A = await open(browser, { seed: fixture, share: true }); contexts.push(A.ctx); await openTransfer(A.page);
    check('Direkter Dateieinstieg in Datensicherung, keine QR-Funktion mehr', await text(A.page, 'transfer-title') === 'Kompakte Sicherung übertragen' && await A.page.locator('#transfer-file-make').isVisible() && await A.page.evaluate(() => !document.getElementById('qr-dialog') && !document.getElementById('qr-export') && !document.getElementById('qr-scan') && !window.jsQR));
    const payload = await A.page.evaluate(() => __qr83.backupPayload());
    const sample = await A.page.evaluate(async payload => { const bytes = await __qr83.packBackup(payload); return { bytes: [...bytes], plain: new TextEncoder().encode(JSON.stringify(payload)).length, restored: (await __qr83.unpackBackup(bytes)).payload }; }, payload);
    check('Bisheriges Format 1 unverändert komprimiert und vollständig rücklesbar', sample.bytes[2] === 1 && sample.bytes[3] === 1 && JSON.stringify(sample.restored) === JSON.stringify(payload));
    check('Kompression reduziert die echte vollständige Sicherung deutlich', sample.bytes.length < sample.plain * .5, `${sample.plain} → ${sample.bytes.length} Byte`);
    const S = await open(browser, { mode: 'safari', seed: fixture }); contexts.push(S.ctx);
    const legacy = await S.page.evaluate(async bytes => (await __qr83.unpackBackup(new Uint8Array(bytes))).payload, sample.bytes);
    check('Safari ohne deflate-raw liest alte Format-1-Codes über Gzip-Rahmen', JSON.stringify(legacy) === JSON.stringify(payload));
    const compat = await S.page.evaluate(async payload => { const bytes = await __qr83.packBackup(payload); return { bytes: [...bytes], restored: (await __qr83.unpackBackup(bytes)).payload, calls: m83CapabilityCalls }; }, payload);
    check('Safari verwendet kompatibles Deflate mit explizitem Format 2', compat.bytes[2] === 2 && compat.bytes[3] === 1 && compat.calls.includes('CompressionStream:deflate'));
    check('Safari-Ersatz vollständig identisch, nur sechs zusätzliche Rahmenbytes', JSON.stringify(compat.restored) === JSON.stringify(payload) && compat.bytes.length === sample.bytes.length + 6, `${compat.bytes.length} Byte`);
    check('Neuer Deflate-Code auch auf normalem Browser vollständig lesbar', await A.page.evaluate(async ({ bytes, payload }) => JSON.stringify((await __qr83.unpackBackup(new Uint8Array(bytes))).payload) === JSON.stringify(payload), { bytes: compat.bytes, payload }));
    const N = await open(browser, { mode: 'none' }); contexts.push(N.ctx);
    const plain = await N.page.evaluate(async payload => { const bytes = await __qr83.packBackup(payload); return { bytes: [...bytes], same: JSON.stringify((await __qr83.unpackBackup(bytes)).payload) === JSON.stringify(payload) }; }, payload);
    check('Ohne Browserkompression bleibt vollständiges Format 1 lesbar', plain.bytes[2] === 1 && plain.bytes[3] === 0 && plain.same && plain.bytes.length === sample.plain + 16);
    check('Safari-Ersatz deutlich kleiner als ungepackte Daten', compat.bytes.length < plain.bytes.length * .5, `${plain.bytes.length} → ${compat.bytes.length} Byte (gleicher Inhalt)`);
    await openTransfer(N.page); await prepare(N.page); check('Ohne Kompression klarer Hinweis, Datei bleibt vollständig verfügbar', /Browserkompression nicht verfügbar/.test(await text(N.page, 'transfer-file-status')) && await N.page.locator('#transfer-file-save').isVisible());
    const round = await S.page.evaluate(async payload => { const bytes = await __qr83.packBackup(payload, 'Testpass83'); const errors = []; for (const pass of ['', 'falsch83']) { try { await __qr83.unpackBackup(bytes, pass); } catch (e) { errors.push({ need: !!e.needPass, bad: !!e.badPass }); } } return { bytes: [...bytes], errors, same: JSON.stringify((await __qr83.unpackBackup(bytes, 'Testpass83')).payload) === JSON.stringify(payload) }; }, payload);
    check('Safari-Deflate weiterhin AES-GCM-verschlüsselt und verlustfrei', round.bytes[2] === 2 && round.bytes[3] === 3 && round.same);
    check('Fehlendes und falsches Passwort werden getrennt abgewiesen', round.errors[0]?.need && round.errors[1]?.bad);
    const oldEncrypted = await A.page.evaluate(async payload => [...await __qr83.packBackup(payload, 'Testpass83')], payload);
    check('Safari liest auch ältere verschlüsselte Format-1-Codes vollständig', await S.page.evaluate(async ({ bytes, payload }) => JSON.stringify((await __qr83.unpackBackup(new Uint8Array(bytes), 'Testpass83')).payload) === JSON.stringify(payload), { bytes: oldEncrypted, payload }));
    const tamper = await A.page.evaluate(async bytes => { const b = new Uint8Array(bytes); b[2] = 1; try { await __qr83.unpackBackup(b, 'Testpass83'); return false; } catch (e) { return !!e.badPass; } }, round.bytes);
    check('AES-GCM schützt auch die Wahl des Kompressionsformats im Kopf', tamper);
    const invalid = await A.page.evaluate(async bytes => { const result = []; for (const change of [b => b[2] = 9, b => b[3] |= 4, b => b[15] = 1, b => b[7] = 255, b => b[b.length - 1] ^= 1]) { const b = new Uint8Array(bytes); change(b); try { await __qr83.unpackBackup(b); result.push('akzeptiert'); } catch (e) { result.push(e.message); } } return result; }, compat.bytes);
    check('Unbekanntes Format, Merker, reservierter Kopf, Übergröße und Schaden abgewiesen', invalid.length === 5 && invalid.every(x => x !== 'akzeptiert'), invalid.join(' | '));
    // Tatsächliches Deflate-Format-2 mit falscher entpackter Länge: Grenze bleibt vor JSON/Import wirksam.
    const bomb = Buffer.from(compat.bytes.slice(0, 16)); bomb.writeUInt32BE(100, 7); const huge = Buffer.concat([bomb, zlib.deflateSync(Buffer.alloc(2e6, 32))]);
    const tooBig = await S.page.evaluate(async bytes => { try { await __qr83.unpackBackup(new Uint8Array(bytes)); return ''; } catch (e) { return e.message; } }, [...huge]);
    check('Kompatibler Deflate-Weg behält begrenztes Entpacken', /Entpackt größer als angegeben/.test(tooBig), tooBig);
    await prepare(A.page, 'Testpass83'); check('Bloßes Vorbereiten zählt noch nicht als gespeicherte Sicherung', await A.page.evaluate(() => !localStorage.getItem('scalpdesk.lastbackup.v1'))); const encrypted = await save(A.page);
    const exported = await A.page.evaluate(async code => (await __qr83.unpackBackup(new Uint8Array(Uint8Array.from(atob(code.slice(5, code.indexOf('.', 5))), c => c.charCodeAt(0))), 'Testpass83')).payload, encrypted.text);
    check('Kompakte Datei ist vorhandenes SDB1-Textdateiformat mit Passwort', encrypted.name.endsWith('-verschluesselt.txt') && /^SDB1:[A-Za-z0-9+/=]+\.\n$/.test(encrypted.text) && (fromCode(encrypted.text)[3] & 2));
    check('Datei enthält sämtliche 40 Trades aller Jahre und Lernen/Präferenzen', exported.history.length === 40 && exported.history.some(t => t.closedAt < Date.UTC(2026, 0, 1)) && !!exported.rlearn.t['R-QR59'] && JSON.stringify(exported.rlearn) === JSON.stringify(payload.rlearn) && exported.prefs['scalpdesk.theme.v1'] === 'light');
    check('Gespeicherte Datei deutlich kleiner als dieselbe lesbare JSON-Sicherung', Buffer.byteLength(encrypted.text) < Buffer.byteLength(JSON.stringify(exported)) * .5);
    await A.page.tap('#transfer-file-share'); await A.page.waitForFunction(() => m83Share.calls.length === 1);
    const share = await A.page.evaluate(() => m83Share.calls[0]); check('iPhone-Teilen beim echten Tippen: vollständige verschlüsselte Datei, kein await vor der Geste', share.actual && share.type === 'text/plain' && share.text === encrypted.text && share.name === encrypted.name);
    await A.page.evaluate(() => m83Share.mode = 'abort'); await A.page.tap('#transfer-file-share'); await A.page.waitForFunction(() => /abgebrochen/.test(document.getElementById('transfer-file-status').textContent));
    check('Abgebrochenes Teilen erhält Datei und zeigt ehrlichen Status', await A.page.locator('#transfer-file-save').isVisible() && (await A.page.evaluate(() => m83Share.calls.length)) === 1);
    await A.page.evaluate(() => m83Share.mode = 'deny'); await A.page.tap('#transfer-file-share'); await A.page.waitForFunction(() => /Teilen nicht möglich/.test(document.getElementById('transfer-file-status').textContent));
    check('Fehlende Teilfreigabe bietet Download, meldet keinen Erfolg', /Datei herunterladen/.test(await text(A.page, 'transfer-file-status')) && (await A.page.evaluate(() => m83Share.calls.length)) === 1);
    await A.page.fill('#transfer-pass', 'Anders83'); check('Passwortänderung verwirft zuvor vorbereitete Datei', await A.page.evaluate(() => __qr83.compactTransfer.ready === null && document.getElementById('transfer-file-ready').hidden));
    await A.page.fill('#transfer-pass', 'kurz'); await click(A.page, 'transfer-file-make'); check('Zu kurzes Passwort erzeugt keine unverschlüsselte Ersatzdatei', /mindestens 6 Zeichen/.test(await text(A.page, 'transfer-error')) && await A.page.evaluate(() => __qr83.compactTransfer.ready === null));
    await prepare(A.page); const readableStatus = await text(A.page, 'transfer-file-status'), unencrypted = await save(A.page); const unencryptedPayload = await A.page.evaluate(async text => (await __qr83.unpackBackup(Uint8Array.from(atob(text.slice(5, text.indexOf('.', 5))), c => c.charCodeAt(0)))).payload, unencrypted.text);
    check('Ohne Passwort kompakte vollständige Datei und ausdrücklicher Lesbarkeitshinweis', /ohne Passwort lesbar/.test(readableStatus) && !(fromCode(unencrypted.text)[3] & 2) && unencryptedPayload.history.length === 40 && !unencrypted.name.includes('verschluesselt'));
    await A.page.evaluate(() => { __g05.state.trades[0].note = 'Änderung nach der vorbereiteten Datei'; __g05.persist(); });
    const older = await save(A.page);
    check('Alte vorbereitete Datei markiert neuere Änderungen nicht als gesichert', older.text === unencrypted.text && /Neuere Änderungen sind noch nicht gesichert/.test(await text(A.page, 'transfer-file-status')) && await A.page.evaluate(() => +localStorage.getItem('scalpdesk.changes.v1') > 0));
    await A.page.evaluate(old => { __g05.state.trades[0].note = old; __g05.persist(); }, unencryptedPayload.history[0].note);
    for (const layout of ['standard', 'dashboard']) for (const width of [320, 390, 768]) {
      await A.page.setViewportSize({ width, height: 1000 }); await h.presentationFixture(A.page, layout);
      check(`${layout}/${width}px: Dateibox und Tasten ohne rechten Überlauf`, await A.page.evaluate(() => { const nodes = [...document.querySelectorAll('.transfer-box,.transfer-box .sheet-actions,.transfer-box .button,.transfer-box small')].filter(n => n.getClientRects().length); return nodes.every(n => n.scrollWidth <= n.clientWidth + 1) && nodes.filter(n => n.classList.contains('button')).every(n => n.getBoundingClientRect().height >= 44); }));
    }
    await A.page.locator('.transfer-box').screenshot({ path: '/tmp/scalpdesk-367-kompakte-datei.png' });
    const R = await open(browser); contexts.push(R.ctx); await R.page.click('#tabbar [data-tab="pos"]'); await click(R.page, 'data-toggle'); await importFile(R.page, encrypted.file);
    check('Kompakte verschlüsselte Datei nutzt bestehende Passwortabfrage, übernimmt noch nichts', await R.page.locator('#decrypt-row').isVisible() && await R.page.evaluate(() => !__g05.state.trades.length));
    await R.page.fill('#backup-pass', 'falsch83'); await click(R.page, 'backup-decrypt'); await R.page.waitForFunction(() => /Passwort falsch/.test(document.getElementById('history-status').textContent));
    check('Falsches Dateipasswort erhält den bisherigen Stand', await R.page.evaluate(() => !__g05.state.trades.length && document.getElementById('sync-preview').hidden));
    await R.page.fill('#backup-pass', 'Testpass83'); await click(R.page, 'backup-decrypt'); await hasPreview(R.page);
    check('Richtiges Passwort zeigt vollständige Vorschau vor Übernahme', /40 Trades/.test(await text(R.page, 'sync-preview')) && await R.page.evaluate(() => !__g05.state.trades.length));
    await R.page.locator('#sync-preview .sp-actions .button.primary-lite').click(); await R.page.waitForFunction(() => __g05.state.trades.length === 40);
    check('Dateiimport erhält alle Handelsfelder/Notizen exakt und bietet Rückgängig', await R.page.evaluate(expected => expected.every(t => JSON.stringify(__g05.state.trades.find(x => x.id === t.id)) === JSON.stringify(t)) && !document.getElementById('undo-row').hidden, exported.history));
    await importFile(R.page, encrypted.file); await click(R.page, 'backup-decrypt'); await R.page.waitForFunction(() => /Nichts Neues/.test(document.getElementById('history-status').textContent));
    check('Wiederholter kompakter Dateiimport ist idempotent', await R.page.evaluate(() => __g05.state.trades.length === 40));
    const damaged = path.join(os.tmpdir(), 'm83-defekt.txt'), bytes = fromCode(unencrypted.text); bytes[11] ^= 1; fs.writeFileSync(damaged, 'SDB1:' + Buffer.from(bytes).toString('base64') + '.');
    await importFile(R.page, damaged); check('Beschädigte Datei abgewiesen, vorhandene 40 Trades erhalten', /Prüfsumme/.test(await text(R.page, 'history-status')) && await R.page.evaluate(() => __g05.state.trades.length === 40));
    await openTransfer(S.page); await prepare(S.page, 'Testpass83'); const safariFile = await save(S.page);
    const V = await open(browser); contexts.push(V.ctx); await V.page.click('#tabbar [data-tab="pos"]'); await click(V.page, 'data-toggle'); await importFile(V.page, safariFile.file);
    await V.page.fill('#backup-pass', 'Testpass83'); await click(V.page, 'backup-decrypt'); await hasPreview(V.page);
    check('Nativ auf Safari-Ersatz erzeugte Format-2-Datei zeigt am Empfänger alle 40 Trades', fromCode(safariFile.text)[2] === 2 && /40 Trades/.test(await text(V.page, 'sync-preview')) && await V.page.evaluate(() => !__g05.state.trades.length));
    await V.page.locator('#sync-preview .sp-actions .button.primary-lite').click(); await V.page.waitForFunction(() => __g05.state.trades.length === 40);
    check('Format-2-Dateiimport übernimmt auch den ursprünglichen Lernbestand', await V.page.evaluate(() => !!JSON.parse(localStorage.getItem('scalpdesk.rlearn.v1'))?.t['R-QR59']));
    await click(A.page, 'transfer-close'); await openTransfer(A.page);
    check('Neuöffnen enthält keine alte vorbereitete Datei', await A.page.evaluate(() => __qr83.compactTransfer.ready === null && document.getElementById('transfer-file-ready').hidden));
    await A.page.evaluate(() => { const original = crypto.subtle.encrypt.bind(crypto.subtle); window.m83Encrypt = original; crypto.subtle.encrypt = async (...args) => { await new Promise(resolve => setTimeout(resolve, 600)); return original(...args); }; });
    await A.page.fill('#transfer-pass', 'Testpass83'); await click(A.page, 'transfer-file-make'); await A.page.waitForFunction(() => document.getElementById('transfer-file-make').disabled);
    await click(A.page, 'transfer-close'); await openTransfer(A.page); await A.page.waitForTimeout(900);
    check('Späte Verschlüsselung nach Schließen erscheint nicht im neu geöffneten Dialog', await A.page.evaluate(() => !__qr83.compactTransfer.ready && document.getElementById('transfer-file-ready').hidden && !document.getElementById('transfer-file-make').disabled));
    await A.page.evaluate(() => crypto.subtle.encrypt = m83Encrypt);
    // Vollständige große Sicherung: die kompakte Datei hat keine Teilegrenze und bleibt mit Passwort vollständig.
    await A.page.evaluate(() => { const a = __g05.state.trades[0]; __g05.state.trades = Array.from({ length: 160 }, (_, i) => ({ ...a, id: 'GROSS-' + i, note: Array.from({ length: 200 }, (_, n) => ((i * 101 + n * 89 + n * n * 13) % 997).toString(36)).join('') })); });
    await prepare(A.page, 'Grosspass83'); const big = await save(A.page);
    check('Große Sicherung (160 Trades) vollständig als verschlüsselte kompakte Datei', (fromCode(big.text)[3] & 2) && await A.page.evaluate(async text => (await __qr83.unpackBackup(Uint8Array.from(atob(text.slice(5, text.indexOf('.', 5))), c => c.charCodeAt(0)), 'Grosspass83')).payload.history.length === 160, big.text));
    const verified = [A, S, N, R, V];
    // Lokale Aufgabenserie: noch kein neues PWA-Bündel. Der normale Release-Lauf
    // behält die Offline-Prüfung; "online" prüft nur den aktuellen Online-Code.
    if (!process.argv.includes('online')) {
    const O = await open(browser, { seed: fixture }); contexts.push(O.ctx); await O.page.evaluate(() => navigator.serviceWorker.ready); await O.page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await O.ctx.setOffline(true); await O.page.goto(h.URL_BASE + '/weather-widget-v2.html'); await O.page.waitForFunction(() => !!window.__g05);
    await O.page.click('#tabbar [data-tab="pos"]'); await openTransfer(O.page); await prepare(O.page, 'Offline83'); const offline = await save(O.page);
    check('Kompakte verschlüsselte Sicherung wird auch vollständig offline erzeugt', (fromCode(offline.text)[3] & 2) && offline.text.length > 100 && /verschluesselt\.txt$/.test(offline.name));
    verified.push(O);
    }
    check('Keine JavaScript-Laufzeitfehler in allen Browserfähigkeiten', verified.every(v => !v.errors.length), verified.flatMap(v => v.errors).join(' | '));
  } catch (e) { check('Abbruch', false, String(e.stack)); }
  finally { for (const ctx of contexts) await ctx.close(); if (browser) await browser.close(); await h.teardown(); try { fs.unlinkSync(path.join(root, debug)); } catch {} }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})();
