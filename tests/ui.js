// Oberfläche, Backup, QR-Abgleich, PWA. Aufruf: node ui.js [testname ...]
const h = require('./harness');
const fs = require('fs'), path = require('path');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const text = (page, sel) => page.$eval(sel, e => e.textContent).catch(() => '');
const visible = (page, sel) => page.$eval(sel, e => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length)).catch(() => false);
async function waitText(page, sel, re, timeout = 10000) { try { await page.waitForFunction(([s, r]) => { const e = document.querySelector(s); return e && new RegExp(r).test(e.textContent); }, [sel, re.source], { timeout }); return true; } catch { return false; } }
async function open(browser, opts = {}) {
  const ctx = opts.ctx || await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true, ...(opts.context || {}) });
  for (const s of opts.init || []) await ctx.addInitScript(s.fn, s.arg);
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  await page.goto(h.URL_BASE + '/weather-widget-v2.html');
  await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 15000 });
  return { ctx, page, errors };
}
const now = Date.now();
const mkPos = (id, sym, entry, extra = {}) => ({ id, symbol: sym, side: 'long', mode: 'cross', entry, leverage: 10, qty: 100, margin: entry * 10, openedAt: now - 3600e3, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false }, ...extra });
const seedLs = ({ items }) => { if (localStorage.getItem('scalpdesk.savedat.v1')) return; for (const [k, v] of items) localStorage.setItem(k, JSON.stringify(v)); };
const tests = {
  async theme(browser) {
    const { ctx, page, errors } = await open(browser);
    await page.click('#view-menu'); await page.click('[data-theme-set="light"]');
    const st = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, bg: getComputedStyle(document.body).backgroundColor, fills: [...new Set([...document.querySelectorAll('#chart svg rect')].map(r => r.getAttribute('fill')).filter(Boolean))].slice(0, 6), meta: document.querySelector('meta[name=theme-color]').content }));
    check('Hell-Modus aktiv', st.theme === 'light' && st.bg === 'rgb(238, 241, 245)' && st.meta === '#eef1f5', JSON.stringify(st));
    check('Chart nutzt helle Kerzenfarben', st.fills.includes('#0e9f6e') || st.fills.includes('#e0485f'), st.fills.join());
    await page.reload(); await page.waitForTimeout(800);
    check('Nach Neuladen weiter hell', await page.evaluate(() => document.documentElement.dataset.theme) === 'light');
    await page.click('#view-menu'); await page.click('[data-theme-set="dark"]');
    check('Zurück auf dunkel', await page.evaluate(() => document.documentElement.dataset.theme) === 'dark');
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async layout(browser) {
    const { ctx, page, errors } = await open(browser);
    check('Desktop: drei Spalten', await page.evaluate(() => getComputedStyle(document.getElementById('dash')).gridTemplateColumns.split(' ').length) === 3);
    check('Desktop: Tab-Leiste verborgen', !(await visible(page, '#tabbar')));
    await page.click('#view-menu'); await page.click('[data-layout-set="tablet"]'); await page.click('body', { position: { x: 5, y: 500 } });
    check('iPad-Layout per Schalter', await page.evaluate(() => document.documentElement.dataset.layout) === 'tablet' && await visible(page, '#tabbar'));
    await page.click('#tabbar [data-tab="pos"]');
    check('Tab Positionen zeigt Positionen, verbirgt Chart und Rechner', await visible(page, '#positions') && !(await visible(page, '#chart-sec')) && !(await visible(page, '#calc-sec')));
    await page.click('#tabbar [data-tab="calc"]');
    check('Tab Rechner zeigt nur den Rechner', await visible(page, '#calc-sec') && !(await visible(page, '#positions')) && !(await visible(page, '#chart-sec')));
    check('Aktiver Tab markiert', await page.evaluate(() => document.querySelector('#tabbar [aria-current="page"]')?.dataset.tab) === 'calc');
    await page.click('.lb-market');
    check('Live-Leiste springt zum Chart-Tab', await page.evaluate(() => document.documentElement.dataset.activeTab) === 'chart' && await visible(page, '#chart-sec'));
    await page.waitForTimeout(400);
    check('Chart nach Tabwechsel gezeichnet', await page.evaluate(() => document.querySelectorAll('#chart svg rect').length > 50));
    await page.click('#tabbar [data-tab="ind"]');
    check('Indikatoren im iPad-Layout zugeklappt', await page.evaluate(() => !document.getElementById('zones-sec').open && !document.getElementById('ind-sec').open));
    await page.click('#zones-sec > summary'); await page.waitForTimeout(300);
    await page.reload(); await page.waitForTimeout(800);
    check('Tab und aufgeklappter Bereich werden gemerkt', await page.evaluate(() => document.documentElement.dataset.activeTab === 'ind' && document.getElementById('zones-sec').open));
    await page.click('#view-menu'); await page.click('[data-layout-set="auto"]');
    check('Automatisch → Desktop bei Maus und breitem Fenster', await page.evaluate(() => document.documentElement.dataset.layout) === 'desktop');
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async touchauto(browser) {
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const { page, errors } = await open(browser, { ctx });
    await page.click('#tabbar [data-tab="calc"]');
    const lev = await page.evaluate(() => document.querySelector('#calc-sec [data-lev]')?.getBoundingClientRect().height);
    await page.click('#tabbar [data-tab="pos"]');
    const st = await page.evaluate(lev => ({ layout: document.documentElement.dataset.layout, chip: document.querySelector('#watchlist .chip')?.getBoundingClientRect().height || 44, lev, add: document.getElementById('pos-add-toggle').getBoundingClientRect().height, tab: Math.min(...[...document.querySelectorAll('#tabbar button')].map(b => b.getBoundingClientRect().height)) }), lev);
    check('iPad (Touch, 1180 px) startet automatisch im iPad-Layout', st.layout === 'tablet', JSON.stringify(st));
    check('Touch-Ziele mindestens 44 px', st.chip >= 44 && st.lev >= 44 && st.add >= 48 && st.tab >= 48, JSON.stringify(st));
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async tips(browser) {
    const { ctx, page, errors } = await open(browser);
    const tip = '#signals .tip';
    await page.click(`${tip} > summary`);
    check('Info öffnet sich', await page.evaluate(s => document.querySelector(s).open, tip));
    const box = await page.$eval(`${tip} .tip-body`, e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth }; });
    check('Info passt ins Fenster', box.l >= 0 && box.r <= box.w, JSON.stringify(box));
    await page.click('#price');
    check('Klick daneben schließt', !(await page.evaluate(s => document.querySelector(s).open, tip)));
    await page.click('#calc-sec .tip > summary'); await page.keyboard.press('Escape');
    check('Escape schließt', !(await page.evaluate(() => document.querySelector('#calc-sec .tip').open)));
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async presets(browser) {
    const { ctx, page, errors } = await open(browser);
    await page.click('[data-lev-for="leverage"] [data-lev="50"]');
    check('Hebel 50× gesetzt, Rechner aktualisiert', await page.inputValue('#leverage') === '50' && /^2\.500,00 USDT/.test(await text(page, '#notional')), await text(page, '#notional'));
    check('Schieberegler folgt', await page.inputValue('#leverage-range') === String(Math.round(Math.log(50) / Math.log(125) * 1000)));
    await page.$eval('#leverage-range', r => { r.value = '477'; r.dispatchEvent(new Event('input', { bubbles: true })); });
    check('Schieberegler setzt Hebel (log. Skala)', await page.inputValue('#leverage') === '10', await page.inputValue('#leverage'));
    await page.click('[data-stake-pct="25"]');
    check('Einsatz 25 % des Guthabens', await page.inputValue('#stake') === '250' && await page.$eval('[data-stake-pct="25"]', b => b.getAttribute('aria-pressed')) === 'true');
    await page.click('[data-move="1"]');
    check('Zielbewegung +1 %', await page.inputValue('#move') === '1' && /Bei \+1,00 %/.test(await text(page, '#pnl-note')));
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async backup(browser) {
    const items = [['scalpdesk.positions.v1', [mkPos('p1', 'XRPUSDT', 1.4), mkPos('p2', 'ETHUSDT', 2500)]]];
    const { ctx, page, errors } = await open(browser, { init: [{ fn: seedLs, arg: { items } }] });
    await page.waitForTimeout(800);
    check('Backup fällig angezeigt', /FÄLLIG|NEU/.test(await text(page, '#backup-count')), await text(page, '#backup-count'));
    await page.click('#backup-badge');
    check('Datenpanel öffnet sich', await visible(page, '#data-panel'));
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#backup-save')]);
    const file = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    check('Backup-Datei korrekt (Schema 8, vollständig, mit Prüfsumme)', file.app === 'scalp-desk' && file.version === 8 && file.positions.length === 2 && /^[0-9A-F]{8}$/.test(file.integrity?.crc32 || ''), `${dl.suggestedFilename()}`);
    await page.waitForTimeout(300);
    check('Zähler zurückgesetzt', /✓/.test(await text(page, '#backup-count')), await text(page, '#backup-count'));
    // Abgleich: p1 auf dem anderen Gerät anders (Datei ohne Abstammung → Konflikt, 3.29.0), p2 dort geschlossen, p3 neu
    const sync = { app: 'scalp-desk', version: 6, positions: [mkPos('p1', 'XRPUSDT', 1.45, { updatedAt: now }), mkPos('p3', 'LTCUSDT', 70)], history: [{ ...mkPos('p2', 'ETHUSDT', 2500), exit: 2550, fees: 0, pnl: 5, pnlSource: 'calc', closedAt: now - 1000, fx: 1.16, note: '' }], movements: [], alarms: [] };
    const tmp = path.join(__dirname, 'sync-test.json'); fs.writeFileSync(tmp, JSON.stringify(sync));
    await page.setInputFiles('#backup-file', tmp); await page.waitForTimeout(400);
    const prev = await page.evaluate(() => { const b = document.getElementById('sync-preview'); return b.hidden ? '' : b.innerText; });
    check('Vorschau vor dem Abgleich (neu, Konflikt, geschlossen)', /Neu: 1 Position/.test(prev) && /⚖ Konflikte: 1/.test(prev) && /Auf dem anderen Gerät geschlossen: 1 Position/.test(prev), prev.replace(/\n/g, ' ⏎ '));
    await page.click('#sync-preview .sp-actions .button.primary-lite'); await page.waitForTimeout(600);
    const msg = await text(page, '#history-status');
    check('Einspielen als Abgleich (1 Konflikt wartet)', /1 Position neu/.test(msg) && /1 als geschlossen übernommen/.test(msg) && /1 Konflikt wartet auf deine Entscheidung/.test(msg), msg);
    check('„Änderungen vergleichen“ zeigt den Einstieg 1,4000 gegen 1,4500', await visible(page, '#conf-dialog') && /Einstieg1,40001,4500/.test((await text(page, '#conf-table')).replace(/\s+/g, '')), await text(page, '#conf-table'));
    await page.click('#conf-take'); await page.waitForTimeout(400);
    const cards = await page.evaluate(() => [...document.querySelectorAll('.pos-card')].map(c => c.querySelector('.pos-head strong').textContent + ':' + c.querySelector('[data-f="entry"]').textContent.split(' ')[0]).join());
    check('Positionen nach Abgleich', cards === 'XRP:1,4500,LTC:70,0000', cards);
    page.on('dialog', d => { page._bu = d.type(); d.dismiss().catch(() => {}); });
    await page.click('#positions h2'); // Nutzeraktivierung für beforeunload
    await page.close({ runBeforeUnload: true }); await h.sleep(500);
    check('Warnung beim Schließen mit ungesicherten Änderungen', page._bu === 'beforeunload', String(page._bu));
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async autobackup(browser) {
    // Dateiauswahl simulieren (im Headless-Browser gibt es keinen Dialog)
    const fake = () => { class W { constructor(f) { this.f = f; this.buf = ''; } async write(d) { this.buf += d; } async close() { this.f.writes++; this.f.data = this.buf; window.__ab = { writes: this.f.writes, data: this.f.data }; } }
      class H { constructor() { this.name = 'scalpdesk-auto-backup.json'; this.kind = 'file'; this.writes = 0; } async createWritable() { return new W(this); } async queryPermission() { return 'granted'; } async requestPermission() { return 'granted'; } }
      window.showSaveFilePicker = async () => new H(); };
    const { ctx, page, errors } = await open(browser, { init: [{ fn: fake }] });
    await page.click('#backup-badge');
    check('Auto-Backup angeboten (Chrome/Edge)', await visible(page, '#autobackup-setup'));
    await page.click('#autobackup-setup'); await page.waitForTimeout(600);
    const ab = await page.evaluate(() => window.__ab);
    check('Erste Sicherung geschrieben', ab?.writes === 1 && JSON.parse(ab.data).app === 'scalp-desk');
    check('Status aktiv', /Automatisches Backup aktiv/.test(await text(page, '#autobackup-info')) && /AUTO/.test(await text(page, '#backup-count')), await text(page, '#autobackup-info'));
    await page.click('#pos-add-toggle'); await page.fill('#pos-symbol', 'XRP'); await page.fill('#pos-lev', '5'); await page.fill('#pos-qty', '10'); await page.fill('#pos-entry', '1,5'); await page.click('#pos-save');
    await page.waitForFunction(() => window.__ab?.writes >= 2, null, { timeout: 6000 }).catch(() => {});
    const ab2 = await page.evaluate(() => window.__ab);
    check('Nach Änderung automatisch gesichert', ab2?.writes >= 2 && JSON.parse(ab2.data).positions.length === 1, `writes=${ab2?.writes}`);
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  },
  async qr(browser) {
    const trades = Array.from({ length: 45 }, (_, i) => ({ ...mkPos('t' + i, 'BTCUSDT', 60000 + i), exit: 60100 + i, fees: 0.5, pnl: 10 + i, pnlSource: 'calc', closedAt: now - i * 3600e3, fx: 1.16, note: 'Test-Trade Nummer ' + i }));
    const items = [['scalpdesk.positions.v1', [mkPos('q1', 'XRPUSDT', 1.4, { sl: 1.3, tp: 1.6 })]], ['scalpdesk.history.v1', trades], ['scalpdesk.alarms.v1', [{ id: 'qa', symbol: 'ETHUSDT', dir: 'above', price: 2600, note: 'QR', source: 'spot', createdAt: now, triggeredAt: null, triggerPrice: null }]]];
    const A = await open(browser, { init: [{ fn: seedLs, arg: { items } }] });
    await A.page.click('#backup-badge'); await A.page.click('#qr-export');
    check('Keine Umfangswahl mehr – immer die vollständige Sicherung', !(await A.page.$('input[name="qr-scope"]')) && await waitText(A.page, '#qr-calc', /Vollständige Sicherung: 1 Position, 45 Trades, 1 Kurs-Alarm/, 8000), await text(A.page, '#qr-calc'));
    await A.page.fill('#qr-pass', 'geheim12'); await A.page.click('#qr-make');
    await A.page.waitForSelector('#qr-out:not([hidden])', { timeout: 20000 });
    const meta = await text(A.page, '#qr-size'); const n = Number((/(\d+) Teile?/.exec(meta) || [])[1] || 1);
    check('QR-Codes erzeugt (verschlüsselt, mehrteilig)', n >= 2 && /verschlüsselt/.test(meta), meta);
    await A.page.click('#qr-pause');
    const shots = new Map();
    for (let t = 0; t < n + 2 && shots.size < n; t++) { const lab = await text(A.page, '#qr-part'), i = Number((/Teil (\d+)/.exec(lab) || [0, 1])[1]); if (!shots.has(i)) shots.set(i, await A.page.$eval('#qr-canvas', c => c.toDataURL('image/png'))); await A.page.click('#qr-next'); }
    check('Alle Teile abgegriffen', shots.size === n, `${shots.size}/${n}`);
    await A.ctx.close();
    // Zweites Gerät: leerer Speicher, Foto-Scan jedes Teils
    const B = await open(browser, { context: { viewport: { width: 820, height: 1180 }, hasTouch: true } });
    await B.page.click('#backup-badge'); await B.page.click('#qr-scan');
    for (const [i, url] of [...shots.entries()].sort((a, b) => b[0] - a[0])) { const f = path.join(__dirname, `qr-part-${i}.png`); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); await B.page.setInputFiles('#qr-photo', f); await h.sleep(400); }
    check('Alle Teile gescannt (jsQR), verschlüsselt → Passwort', await B.page.waitForSelector('#qr-unlock:not([hidden])', { timeout: 10000 }).then(() => true, () => false), await text(B.page, '#qr-scan-status') + ' ' + await text(B.page, '#qr-scan-error'));
    await B.page.fill('#qr-scan-pass', 'falsch1'); await B.page.click('#qr-apply');
    check('Falsches Passwort abgewiesen', await waitText(B.page, '#qr-scan-error', /Passwort falsch/, 8000));
    await B.page.fill('#qr-scan-pass', 'geheim12'); await B.page.click('#qr-apply');
    check('QR: erst Vorschau („Entschlüsseln & prüfen“)', await B.page.waitForSelector('#qr-preview:not([hidden]) .sp-actions .button.primary-lite', { timeout: 10000 }).then(() => true, () => false), await text(B.page, '#qr-scan-status'));
    await B.page.click('#qr-preview .sp-actions .button.primary-lite');
    check('Daten übernommen', await waitText(B.page, '#qr-scan-status', /Übernommen: 1 Position neu, 45 Trades, 1 Kurs-Alarm/, 10000), await text(B.page, '#qr-scan-status'));
    await B.page.click('#qr-apply');
    check('Position und Alarm auf dem zweiten Gerät', await B.page.evaluate(() => document.querySelectorAll('.pos-card').length === 1 && document.querySelectorAll('.al-row').length === 1));
    check('keine Fehler', ![...A.errors, ...B.errors].length, [...A.errors, ...B.errors].join(' | ')); await B.ctx.close();
  },
  async camera(browser) {
    const b2 = await h.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
    try {
      const ctx = await b2.newContext({ viewport: { width: 820, height: 1180 }, permissions: ['camera'] });
      const { page, errors } = await open(b2, { ctx });
      await page.click('#backup-badge'); await page.click('#qr-scan');
      check('Kamera läuft, Scanner sucht', await waitText(page, '#qr-scan-status', /Suche QR-Code/, 8000), await text(page, '#qr-scan-status') + await text(page, '#qr-scan-error'));
      await page.waitForTimeout(1500); await page.click('#qr-close');
      check('Kamera nach Schließen gestoppt', await page.evaluate(() => !document.getElementById('qr-video').srcObject));
      check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
    } finally { await b2.close(); }
  },
  async pwa(browser) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const { page, errors } = await open(browser, { ctx });
    const man = await page.evaluate(async () => { const r = await fetch('manifest.webmanifest'); const m = await r.json(); const icons = await Promise.all(m.icons.map(i => fetch(i.src).then(x => x.status))); return { ok: r.ok, start: m.start_url, display: m.display, icons }; });
    check('Manifest und Icons erreichbar', man.ok && man.display === 'standalone' && man.icons.every(s => s === 200), JSON.stringify(man));
    const sw = await page.evaluate(() => Promise.race([navigator.serviceWorker.ready.then(r => !!r.active), new Promise(r => setTimeout(() => r(false), 8000))]));
    check('Service Worker aktiv', sw);
    await page.reload(); await page.waitForTimeout(1500);
    check('Seite unter Kontrolle des Service Workers', await page.evaluate(() => !!navigator.serviceWorker.controller));
    await ctx.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2500);
    const off = await page.evaluate(() => ({ title: document.title, brand: !!document.querySelector('.brand'), status: document.getElementById('status')?.textContent }));
    check('Startet ohne Netz aus dem Speicher', off.brand, JSON.stringify(off));
    await ctx.setOffline(false);
    check('keine Skriptfehler', !errors.filter(e => !/net::|Failed to fetch|ERR_INTERNET|WebSocket/.test(e)).length, errors.join(' | ')); await ctx.close();
  },
};
(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(tests);
  await h.setup(); await h.ctl('/reset');
  const browser = await h.launch();
  try { for (const n of names) { console.log(`▶ ${n}`); await h.ctl('/reset'); try { await tests[n](browser); } catch (e) { check(n + ' (Abbruch)', false, e.message.split('\n')[0]); } } }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
