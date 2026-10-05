// Ablaufplan Schritt 2 (3.24.0): gelernte Chartmuster dauerhaft – Startbestand für neue Nutzer, Neuladen, normaler Reset,
// Wiederherstellen aus der Sicherung, Startweg für einen neuen Nutzer, Musterbestand exportieren/einspielen.
// Aufruf: node m37.js
const h = require('./harness'), fs = require('fs'), path = require('path');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const START = JSON.parse(fs.readFileSync(require('path').join(__dirname, '..', 'data/muster-start.json'), 'utf8'));
// Der Test sperrt den Service Worker (sonst liefe der Startbestand an der Test-Umleitung vorbei) – die Warnung dazu zählt nicht
const real = errs => errs.filter(e => !/Service Worker registration blocked by Playwright/.test(e));
const desk = { viewport: { width: 1440, height: 900 }, acceptDownloads: true, serviceWorkers: 'block' };
const pat = page => page.evaluate(() => { const v = JSON.parse(localStorage.getItem('scalpdesk.zzpatterns.v1') || 'null'); const s = v?.s || {};
  const sum = pre => Object.keys(s).filter(k => k.startsWith(pre)).reduce((a, k) => a + s[k][0], 0);
  return { v: v?.v, base: v?.base || '', rev: v?.rev || 0, at: v?.at || 0, keys: Object.keys(s).length, n1m: sum('1m|0.25|'), n1h: sum('1h|3|'), series: !!v?.r?.['BTCUSDT|1m|0.25'], info: document.getElementById('zzp-info')?.textContent || '' }; });
async function open(browser, { start = START, init = [] } = {}) {
  const ctx = await browser.newContext(desk);
  await ctx.route('**/data/muster-start.json', r => start ? r.fulfill({ body: JSON.stringify(start), contentType: 'application/json' }) : r.fulfill({ status: 404, body: 'nf' }));
  for (const [fn, arg] of init) await ctx.addInitScript(fn, arg);
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  await page.goto(h.URL_BASE + '/weather-widget-v2.html');
  await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2500);
  return { ctx, page, errors };
}
const zzOn = [() => { if (sessionStorage.getItem('zz')) return; sessionStorage.setItem('zz', '1'); localStorage.setItem('scalpdesk.zigzag.v1', JSON.stringify({ pct: 0.25, fc: true })); localStorage.setItem('scalpdesk.overlays.v1', JSON.stringify({ vp: true, ema200: true, bb: true, liq: true, zz: true })); }, null];
const openData = page => page.evaluate(() => { if (document.getElementById('data-panel').hidden) document.getElementById('data-toggle').click(); });
const download = async (page, fn) => { const [dl] = await Promise.all([page.waitForEvent('download'), fn()]); const f = await dl.path(); return { name: dl.suggestedFilename(), text: fs.readFileSync(f, 'utf8') }; };
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset');
  const browser = await h.launch();
  try {
    // 1. Neuer Nutzer: Startbestand geladen, keine persönlichen Daten
    let { ctx, page, errors } = await open(browser);
    let p = await pat(page); await openData(page); await page.waitForTimeout(300); p = await pat(page);
    const personal = await page.evaluate(() => ['scalpdesk.positions.v1', 'scalpdesk.history.v1', 'scalpdesk.alarms.v1'].map(k => JSON.parse(localStorage.getItem(k) || '[]').length));
    check('Neuer Nutzer: Startbestand (Version 1) beim Start geladen', p.base === '1' && p.n1h > 100 && p.keys >= Object.keys(START.s).length, JSON.stringify({ base: p.base, muster: p.keys, fälle1h3: p.n1h }));
    check('Neuer Nutzer: keine persönlichen Daten übernommen', personal.every(n => n === 0), JSON.stringify(personal));
    check('Datensicherung zeigt den Musterbestand mit Startbestand-Version', /Fälle in \d+ Mustern · Startbestand Version 1 eingespielt/.test(p.info), p.info);
    check('keine Fehler (neuer Nutzer)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
    // 2. Neu gelerntes Testmuster (ZigZag-Prognose, 1m, 0,25 %) übersteht Neuladen
    ({ ctx, page, errors } = await open(browser, { init: [zzOn] }));
    const learned = await pat(page);
    check('Testmuster gelernt und sofort gespeichert (mit Versionsstand)', learned.n1m >= 10 && learned.series && learned.rev >= 2 && learned.at > 0, JSON.stringify({ fälle1m: learned.n1m, rev: learned.rev }));
    await page.reload(); await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(2000);
    const afterReload = await pat(page);
    check('Neuladen: Testmuster bleibt (mindestens so viele Fälle)', afterReload.n1m >= learned.n1m && afterReload.base === '1', `${learned.n1m} → ${afterReload.n1m}`);
    // 3. Normaler Reset: Handelsdaten weg, Muster bleiben; Sicherung davor als Datei
    await page.evaluate(() => { const now = Date.now(); localStorage.setItem('scalpdesk.positions.v1', JSON.stringify([{ id: 'p-test', symbol: 'BTCUSDT', side: 'long', mode: 'isolated', entry: 60000, leverage: 10, qty: 0.01, margin: 60, openedAt: now, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false } }])); });
    await page.reload(); await page.waitForTimeout(2500); await openData(page); await page.waitForTimeout(300);
    const before = await pat(page), posBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.positions.v1') || '[]').length);
    await page.click('#reset-open'); await page.waitForTimeout(300);
    const dlg = await page.evaluate(() => ({ open: document.getElementById('reset-dialog').open, text: document.getElementById('reset-dialog').textContent.replace(/\s+/g, ' ') }));
    check('Reset-Dialog nennt, was gelöscht wird und was bleibt', dlg.open && /Gelöscht werden: offene Positionen, Trades, Demo-Positionen und Demo-Historie, Geldbewegungen, Kurs-Alarme/.test(dlg.text) && /Erhalten bleiben: die gelernten Chartmuster/.test(dlg.text), dlg.text.slice(0, 120));
    const pre = await download(page, () => page.click('#reset-go')); await page.waitForTimeout(800);
    const afterReset = await pat(page), posAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.positions.v1') || '[]').length), msg = await page.textContent('#history-status');
    const preFile = JSON.parse(pre.text);
    check('Reset: vorher Sicherungsdatei mit Position und Mustern', /^backup-vor-zuruecksetzen-\d{4}-\d\d-\d\d\.json$/.test(pre.name) && preFile.positions.length === 1 && (preFile.patterns?.s ? Object.keys(preFile.patterns.s).some(k => k.startsWith('1m|0.25|')) : false), pre.name);
    check('Reset: Positionen gelöscht, gelernte Muster erhalten', posBefore === 1 && posAfter === 0 && afterReset.n1m >= before.n1m && afterReset.base === '1', JSON.stringify({ positionen: [posBefore, posAfter], fälle1m: [before.n1m, afterReset.n1m] }));
    check('Reset: Meldung nennt die Sicherungsdatei', /Handelsdaten zurückgesetzt/.test(msg) && /backup-vor-zuruecksetzen/.test(msg), msg);
    // 4. Musterbestand exportieren: nur Muster, keine persönlichen Daten
    const exp = await download(page, () => page.click('#zzp-export')), ex = JSON.parse(exp.text);
    check('Musterbestand exportieren: nur Muster (mit Version), keine Positionen oder Zugänge', /^muster-\d{4}-\d\d-\d\d\.json$/.test(exp.name) && ex.kind === 'scalpdesk-patterns' && ex.v === 1 && ex.version && Object.keys(ex.s).some(k => k.startsWith('1m|0.25|')) && !('positions' in ex) && !/token|chat_id|webhook/i.test(exp.text), JSON.stringify({ name: exp.name, version: ex.version, muster: Object.keys(ex.s).length }));
    check('keine Fehler (Lernen, Neuladen, Reset)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
    // 5. Frischer Browser-Speicher: Startbestand kommt wieder, eigenes Wissen aus der Sicherung
    ({ ctx, page, errors } = await open(browser));
    const fresh = await pat(page);
    const tmp = path.join(__dirname, 'm37-backup.json'); fs.writeFileSync(tmp, pre.text);
    await page.setInputFiles('#backup-file', tmp); await page.waitForTimeout(600);
    await page.evaluate(() => document.querySelector('#sync-preview .sp-actions .button.primary-lite')?.click()); await page.waitForTimeout(500); // 3.27.0: Vorschau → „Übernehmen“
    const restored = await pat(page), posR = await page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.positions.v1') || '[]').length);
    check('Geleerter Speicher: Startbestand sofort wieder da, eigenes Testmuster noch nicht', fresh.base === '1' && fresh.n1h > 100 && fresh.n1m === 0, JSON.stringify({ base: fresh.base, fälle1m: fresh.n1m }));
    check('Wiederherstellen aus der Sicherung: Testmuster und Position zurück', restored.n1m >= before.n1m && posR === 1, JSON.stringify({ fälle1m: restored.n1m, positionen: posR }));
    // 6. Musterbestand-Datei einspielen (ohne Sicherung drumherum)
    const tmp2 = path.join(__dirname, 'm37-muster.json'); fs.writeFileSync(tmp2, exp.text);
    await page.setInputFiles('#backup-file', tmp2); await page.waitForTimeout(500);
    const m6msg = await page.textContent('#history-status');
    check('Musterbestand-Datei einspielen: klare Meldung, nichts doppelt', /^Musterbestand: nichts Neues|^Musterbestand übernommen/.test(m6msg) && (await pat(page)).n1m === restored.n1m, m6msg);
    check('keine Fehler (Wiederherstellen)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
    // 7. Startweg für neue Nutzer: der exportierte Bestand als neuer Startbestand (Version 2) im GitHub-Projekt
    const v2 = { ...ex, version: '2' };
    ({ ctx, page, errors } = await open(browser, { start: v2 }));
    const nu = await pat(page);
    check('Neuer Nutzer über den Startweg: gelerntes Testmuster verfügbar (Startbestand Version 2)', nu.base === '2' && nu.n1m >= before.n1m, JSON.stringify({ base: nu.base, fälle1m: nu.n1m }));
    // Neue Version auf einem Gerät mit älterem Stand: je Muster die Fassung mit mehr Fällen, nichts doppelt
    await page.reload(); await page.waitForTimeout(2500); const again = await pat(page);
    check('Gleiche Version erneut geladen: nichts doppelt gezählt', again.n1m === nu.n1m && again.n1h === nu.n1h, `${nu.n1m}/${nu.n1h} → ${again.n1m}/${again.n1h}`);
    check('keine Fehler (Startweg)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
    // 8. Ohne Startbestand (Datei fehlt oder offline): App läuft normal, nichts geht verloren
    ({ ctx, page, errors } = await open(browser, { start: null }));
    const none = await pat(page);
    check('Startbestand nicht erreichbar: kein Fehler, App läuft', none.base === '' && !real(errors).filter(e => !/404/.test(e)).length, JSON.stringify({ base: none.base, fehler: real(errors) }));
    await ctx.close();
    // 9. „Kerzen-Zwischenspeicher leeren“ lässt die Muster in Ruhe
    ({ ctx, page, errors } = await open(browser));
    const k0 = await pat(page); await page.evaluate(() => document.getElementById('kc-clear').click()); await page.waitForTimeout(500); const k1 = await pat(page);
    check('Kerzen-Zwischenspeicher leeren: Muster bleiben', k1.keys === k0.keys && k1.n1h === k0.n1h, `${k0.keys} → ${k1.keys}`);
    check('keine Fehler (Zwischenspeicher)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  } finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
