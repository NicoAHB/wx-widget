// 3.94.0 – Start-Gerüst: Ab dem ersten Zeichnen steht ein Platzhalter in der Größe der Vorauswahl (statt leerem Hintergrund bzw. halbfertigem Aufbau);
// er verschwindet, sobald die App aufgebaut ist. Nur im Bereich „Chart“ und bis 1400 px Breite; Notbremse nach 6 s, falls die App nicht anläuft.
// Aufruf: node m150.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 400) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR|Failed to fetch dynamically imported|error loading dynamically imported|Importing a module script failed/.test(e));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const box = e => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top + scrollY), Math.round(b.width), Math.round(b.height)]; };
const shot = page => page.evaluate(() => { const s = document.getElementById('boot-skel'), dash = document.getElementById('dash'), lb = document.getElementById('livebar'), fold = s?.querySelector('.bs-fold');
  const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top + scrollY), Math.round(b.width), Math.round(b.height)]; };
  return { boot: document.documentElement.hasAttribute('data-boot'), has: !!s, display: s ? getComputedStyle(s).display : null, dashVis: getComputedStyle(dash).visibility, tiles: s ? s.querySelectorAll('.bs-grid > .bs-tile').length : 0, shimmer: s ? s.querySelectorAll('.bs-grid > .skel').length : 0,
    panelTop: fold ? r(fold)[1] : null, lbBottom: Math.round(lb.getBoundingClientRect().bottom + scrollY), skelH: fold ? r(fold)[3] : 0, wlTiles: document.querySelectorAll('#watchlist .wl-tile').length,
    g: s ? { tabs: r(s.querySelector('.bs-tabs')), fold: r(fold), tile: r(s.querySelector('.bs-grid > .bs-tile')), add: r(s.querySelector('.bs-add')), chips: r(s.querySelector('.bs-chips')), cols: getComputedStyle(s.querySelector('.bs-grid')).gridTemplateColumns.split(' ').length }
        : { tabs: r(document.querySelector('.workspace-tabs')), fold: r(document.getElementById('workspace-watch')), tile: r(document.querySelector('#watchlist .wl-item')), add: r(document.querySelector('#watchlist .wl-add-item')), chips: r(document.querySelector('#watchlist .wl-filter')), cols: getComputedStyle(document.querySelector('#watchlist .wl-grid')).gridTemplateColumns.split(' ').length } }; });

(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch({ workspace: 'fresh' });   // echte Oberfläche (nicht die Testfixture der älteren Widgettests)
  try {
    // ---- 1) Tablet hochkant: Gerüst steht, solange der Aufbau läuft; dann echte Vorauswahl ohne Sprung ----
    const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true }), page = await ctx.newPage(), errors = [];
    h.collect(page, errors);
    let release; const gate = new Promise(r => { release = r; });
    await page.route('**/shared/display-time.mjs', async route => { await gate; await route.continue(); });   // Aufbau künstlich aufhalten
    page.goto(`${h.URL_BASE}/weather-widget-v2.html`).catch(() => {});
    await page.waitForFunction(() => document.getElementById('boot-skel') && document.readyState !== 'loading', null, { timeout: 15000 });
    await sleep(500);
    const early = await shot(page);
    check('Während des Aufbaus: Start-Gerüst sichtbar, Aufbau darunter unsichtbar', early.boot && early.has && early.display === 'block' && early.dashVis === 'hidden', JSON.stringify(early));
    check('Gerüst: sechs Kacheln mit Schimmer plus „+ Coin“-Feld unter der Live-Leiste', early.tiles === 7 && early.shimmer >= 6 && early.panelTop >= early.lbBottom && early.skelH > 500, `Kacheln ${early.tiles}, Schimmer ${early.shimmer}, oben ${early.panelTop} (Leiste unten ${early.lbBottom}), Höhe ${early.skelH}`);
    check('Noch keine echten Kacheln', early.wlTiles === 0);
    release();
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-boot') && document.querySelectorAll('#watchlist .wl-tile').length >= 6, null, { timeout: 30000 });
    const late = await shot(page);
    check('Nach dem Aufbau: Gerüst entfernt, Aufbau sichtbar, sechs echte Kacheln', !late.boot && !late.has && late.dashVis === 'visible' && late.wlTiles === 6, JSON.stringify(late));
    await sleep(600);
    const fin = await shot(page);
    const near = (a, b, t = 4) => a && b && a.every((v, i) => Math.abs(v - b[i]) <= t);
    check('Kein Sprung (Tablet hochkant): Reiter, Rahmen, erste Kachel und Spalten des Gerüsts liegen auf der echten Vorauswahl', near(early.g.tabs, fin.g.tabs) && near(early.g.fold, fin.g.fold, 6) && near(early.g.tile.slice(0, 3), fin.g.tile.slice(0, 3)) && early.g.cols === fin.g.cols && Math.abs(early.g.tile[3] - fin.g.tile[3]) <= 4, JSON.stringify({ gerüst: early.g, echt: fin.g }));
    check('Keine Skriptfehler (Tablet)', real(errors).length === 0, real(errors).join(' | '));
    await ctx.close();

    // ---- 2) anderer Bereich gespeichert („Positionen“): kein Gerüst ----
    const ctx2 = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true }), page2 = await ctx2.newPage();
    await page2.addInitScript(() => { try { localStorage.setItem('scalpdesk.workspace.v1', JSON.stringify({ v: 1, mode: 'focus', view: 'pos', folds: {} })); } catch {} });
    await page2.route('**/shared/display-time.mjs', async route => { await sleep(1500); await route.continue(); });
    page2.goto(`${h.URL_BASE}/weather-widget-v2.html`).catch(() => {});
    await page2.waitForFunction(() => document.readyState !== 'loading', null, { timeout: 15000 }); await sleep(300);
    const other = await shot(page2);
    check('Gespeicherter Bereich „Positionen“: kein Start-Gerüst, nichts verdeckt', !other.boot && other.display === 'none' && other.dashVis === 'visible', JSON.stringify(other));
    await ctx2.close();

    // ---- 2b) iPad quer / 12,9 Zoll quer (breite Ansicht ab 1100 px): Gerüst liegt auf der echten Vorauswahl ----
    for (const [w, hh] of [[1180, 820], [1366, 1024]]) {
      const c = await browser.newContext({ viewport: { width: w, height: hh }, hasTouch: true, isMobile: true }), pg = await c.newPage();
      await pg.route('**/shared/display-time.mjs', async route => { await sleep(1500); await route.continue(); });
      pg.goto(`${h.URL_BASE}/weather-widget-v2.html`).catch(() => {});
      await pg.waitForFunction(() => document.getElementById('boot-skel') && document.readyState !== 'loading', null, { timeout: 15000 }); await sleep(400);
      const e = await shot(pg);
      await pg.waitForFunction(() => !document.documentElement.hasAttribute('data-boot') && document.querySelectorAll('#watchlist .wl-tile').length >= 6, null, { timeout: 30000 }); await sleep(600);
      const f = await shot(pg), nr = (a, b, t = 6) => a && b && a.every((v, i) => Math.abs(v - b[i]) <= t);
      check(`${w} × ${hh}: Reiter, Rahmen, erste Kachel und Spaltenzahl des Gerüsts liegen auf der echten Vorauswahl`, nr(e.g.tabs, f.g.tabs) && nr(e.g.fold.slice(0, 3), f.g.fold.slice(0, 3)) && nr(e.g.tile, f.g.tile) && e.g.cols === f.g.cols, JSON.stringify({ gerüst: e.g, echt: f.g }));
      await c.close();
    }

    // ---- 3) sehr breit (Computer): kein Gerüst ----
    const ctx3 = await browser.newContext({ viewport: { width: 1600, height: 900 } }), page3 = await ctx3.newPage();
    await page3.route('**/shared/display-time.mjs', async route => { await sleep(1500); await route.continue(); });
    page3.goto(`${h.URL_BASE}/weather-widget-v2.html`).catch(() => {});
    await page3.waitForFunction(() => document.readyState !== 'loading', null, { timeout: 15000 }); await sleep(300);
    const wide = await shot(page3);
    check('Breiter als 1400 px: Gerüst bleibt aus, Seite unverändert sichtbar', wide.display === 'none' && wide.dashVis === 'visible', JSON.stringify(wide));
    await ctx3.close();

    // ---- 4) Handy: zwei Spalten ----
    const ctx4 = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), page4 = await ctx4.newPage();
    await page4.route('**/shared/display-time.mjs', async route => { await sleep(1500); await route.continue(); });
    page4.goto(`${h.URL_BASE}/weather-widget-v2.html`).catch(() => {});
    await page4.waitForFunction(() => document.getElementById('boot-skel') && document.readyState !== 'loading', null, { timeout: 15000 }); await sleep(400);
    const e4 = await shot(page4);
    await page4.waitForFunction(() => !document.documentElement.hasAttribute('data-boot') && document.querySelectorAll('#watchlist .wl-tile').length >= 6, null, { timeout: 30000 }); await sleep(600);
    const f4 = await shot(page4);
    const near4 = (a, b, t = 5) => a && b && a.every((v, i) => Math.abs(v - b[i]) <= t);
    check('Handy: zwei Spalten; Reiter, Rahmen und erste Kachel liegen auf der echten Vorauswahl', e4.g.cols === 2 && f4.g.cols === 2 && near4(e4.g.tabs, f4.g.tabs) && near4(e4.g.fold.slice(0, 3), f4.g.fold.slice(0, 3)) && near4(e4.g.tile, f4.g.tile), JSON.stringify({ gerüst: e4.g, echt: f4.g }));
    await ctx4.close();

    // ---- 5) Notbremse: läuft die App nicht an, wird die Seite nach 6 s trotzdem frei ----
    const ctx5 = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true }), page5 = await ctx5.newPage();
    await page5.route('**/shared/display-time.mjs', route => route.abort());   // Modul fehlt → Hauptskript startet nie
    page5.goto(`${h.URL_BASE}/weather-widget-v2.html`).catch(() => {});
    await page5.waitForFunction(() => document.readyState !== 'loading', null, { timeout: 15000 }); await sleep(800);
    const stuck = await shot(page5);
    await page5.waitForFunction(() => !document.documentElement.hasAttribute('data-boot'), null, { timeout: 9000 }).catch(() => {});
    const freed = await shot(page5);
    check('Notbremse: App startet nicht → Gerüst erst da, nach 6 s Seite wieder sichtbar', stuck.boot && !freed.boot && freed.dashVis === 'visible', `vorher ${stuck.boot}, nachher ${freed.boot}/${freed.dashVis}`);
    await ctx5.close();
  } finally { await browser.close(); await h.teardown?.(); }
  const bad = results.filter(r => !r.ok).length; console.log(`\n${results.length - bad}/${results.length} bestanden`); process.exit(bad ? 1 : 0);
})().catch(e => { console.error('Abbruch:', e); process.exit(1); });
