// 3.21.3 – Safari (WebKit) verankert nicht mehr selbst. Chromium meldet sich hier als Safari (navigator.vendor „Apple
// Computer, Inc.“ wie Safari und alle iPhone-Browser), ohne weitere Nachstellung: Die App schaltet overflow-anchor ab
// (html[data-anchor=app]) und gleicht selbst aus. Geprüft: Einstellung; Rekorder-Kopfzeile; Termin-Warnung erscheint oberhalb,
// während man unten liest → der Inhalt bleibt stehen (Ausgleich der App); eine Einfügung oberhalb ohne App-Ausgleich verschiebt
// (Beleg: der Browser verankert nicht mehr). Chrome/Android unverändert: eingebaute Verankerung. Aufruf: node m34.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const asSafari = () => { Object.defineProperty(Navigator.prototype, 'vendor', { get: () => 'Apple Computer, Inc.', configurable: true }); };
const settings = page => page.evaluate(() => ({ anchor: document.documentElement.dataset.anchor || null, html: getComputedStyle(document.documentElement).overflowAnchor,
  sec: getComputedStyle(document.getElementById('chart-sec')).overflowAnchor, row: getComputedStyle(document.getElementById('signals')).overflowAnchor, vendor: navigator.vendor }));
// Rekorder kurz an: Kopfzeile lesen, wieder aus
const recHead = async page => {
  await page.click('#view-menu'); await page.waitForTimeout(250); await page.click('#rec-toggle'); await page.waitForTimeout(250);
  await page.click('#rec-copy'); await page.waitForTimeout(250); const head = (await page.evaluate(() => navigator.clipboard.readText())).split('\n')[0];
  await page.click('#rec-toggle'); await page.waitForTimeout(200); await page.click('#view-menu'); await page.waitForTimeout(200);
  return head;
};
// 50 px oberhalb des Bildes einfügen, außerhalb jeder Aktualisierung der App (kein Ausgleich der App): Wie weit rutscht der
// gelesene Inhalt? Mit eingebauter Verankerung gleicht der Browser aus (0), ohne rutscht er um 50 px.
const insertAbove = page => page.evaluate(async () => {
  const s = document.getElementById('signals'), t0 = s.getBoundingClientRect().top, d = document.createElement('div');
  d.id = 'test-einschub'; d.style.height = '50px'; document.getElementById('chart-sec').prepend(d);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const moved = Math.round(s.getBoundingClientRect().top - t0); d.remove(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  return moved;
});
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset');
  const browser = await h.launch();
  try {
    // ---- Safari (WebKit) ----
    await h.ctl('/cal?mode=soon&min=16');
    let ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: h.URL_BASE });
    await ctx.addInitScript(asSafari);
    let page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await page.waitForTimeout(3000);
    let st = await settings(page);
    check('Safari: Verankerung des Browsers aus (html[data-anchor=app], overflow-anchor: none auf Seite und Bereichen)', st.vendor === 'Apple Computer, Inc.' && st.anchor === 'app' && st.html === 'none' && st.sec === 'none' && st.row === 'none', JSON.stringify(st));
    const head = await recHead(page);
    check('Safari: Rekorder-Kopfzeile „Ausgleich durch die App (Safari-Verankerung aus)“', /· Ausgleich durch die App \(Safari-Verankerung aus\) ·/.test(head) && /Sprung-Rekorder \d+\.\d+\.\d+ ·/.test(head), head.slice(0, 40) + ' … ' + (head.match(/Ausgleich[^·]+/) || [''])[0]);
    // Weiter unten lesen (Signal-Übersicht knapp unter der Live-Leiste)
    await page.evaluate(() => { const r = document.getElementById('signals').getBoundingClientRect(); scrollBy(0, r.top - 220); }); await page.waitForTimeout(800);
    const moved = await insertAbove(page);
    check('Safari: Einfügung oberhalb ohne App-Ausgleich verschiebt um 50 px (der Browser verankert nicht mehr)', moved === 50, `${moved} px`);
    // Termin-Warnung erscheint oberhalb (Warnzeile im Kalender, Zeile in der Live-Leiste) – die App gleicht aus
    const track = await page.evaluate(() => new Promise(done => {
      const s = document.getElementById('signals'), w = document.getElementById('econ-warn'), lb = document.getElementById('livebar');
      const top0 = s.getBoundingClientRect().top, lb0 = lb.getBoundingClientRect().height, t0 = Date.now(), samples = []; let seen = 0;
      const id = setInterval(() => {
        samples.push(Math.round(s.getBoundingClientRect().top - top0)); if (!w.hidden && !seen) seen = Date.now();
        if ((seen && Date.now() - seen > 4000) || Date.now() - t0 > 110000) { clearInterval(id); done({ seenAfter: seen ? Math.round((seen - t0) / 1000) : null, maxShift: Math.max(...samples.map(Math.abs)), warnH: Math.round(w.getBoundingClientRect().height), lbGrow: Math.round(lb.getBoundingClientRect().height - lb0) }); }
      }, 200);
    }));
    check('Safari: Termin-Warnung erscheint oberhalb (Kalender und Live-Leiste), der gelesene Inhalt bleibt stehen (höchstens 2 px)', track.seenAfter !== null && track.warnH > 20 && track.lbGrow > 10 && track.maxShift <= 2, JSON.stringify(track));
    check('Safari: keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
    await h.ctl('/cal?mode=normal');

    // ---- Chrome / Android: unverändert ----
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: h.URL_BASE });
    page = await ctx.newPage(); errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await page.waitForTimeout(3000);
    st = await settings(page);
    check('Chrome: eingebaute Verankerung bleibt (kein data-anchor, overflow-anchor: auto)', st.anchor === null && st.html === 'auto' && st.sec === 'auto', JSON.stringify(st));
    const head2 = await recHead(page);
    check('Chrome: Rekorder-Kopfzeile „Ausgleich durch den Browser“', /· Ausgleich durch den Browser ·/.test(head2), (head2.match(/Ausgleich[^·]+/) || [''])[0]);
    await page.evaluate(() => { const r = document.getElementById('signals').getBoundingClientRect(); scrollBy(0, r.top - 220); }); await page.waitForTimeout(800);
    const moved2 = await insertAbove(page);
    check('Chrome: dieselbe Einfügung gleicht der Browser aus (0 px)', Math.abs(moved2) <= 1, `${moved2} px`);
    check('Chrome: keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await h.ctl('/cal?mode=normal').catch(() => {}); await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
