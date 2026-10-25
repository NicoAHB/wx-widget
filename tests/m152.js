// 3.97.0 – Randhinweis für die wischbaren Chart-Zeilen (Zeitrahmen, Werkzeuge): Wo mehr folgt, blendet ein Verlauf den Rand aus;
// wo alles passt (Tablet, PC), gibt es keinen. Echte Chrome-Messung mit Touch und mehreren Breiten, nur lokale Testantworten.
// Aufruf: node m152.js
const h = require('./harness');
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${!ok && detail !== '' ? ' — ' + JSON.stringify(detail).slice(0, 500) : ''}`); };
const ROWS = ['.chart-toolbar .intervals', '.chart-toolbar .zoom-controls'];
const read = (page, selector) => page.locator(selector).evaluate(el => {
  const cs = getComputedStyle(el), box = el.getBoundingClientRect(), last = [...el.children].filter(c => c.getBoundingClientRect().width > 0).at(-1).getBoundingClientRect();
  return { more: el.dataset.scrollMore ?? null, mask: cs.webkitMaskImage || cs.maskImage || 'none', over: el.scrollWidth - el.clientWidth, left: el.scrollLeft, lastRight: Math.round(last.right), boxRight: Math.round(box.right) };
});
const settle = (page, ms = 200) => page.waitForTimeout(ms);

(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch({ workspace: 'fresh' });
  try {
    const errors = [];
    for (const [width, touch] of [[320, true], [390, true]]) {
      const ctx = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: touch, isMobile: true }), page = await ctx.newPage(); h.collect(page, errors);
      await page.goto(h.URL_BASE + '/weather-widget-v2.html');
      await page.waitForFunction(() => window.__g05?.state.candles.length > 100 && !__g05.state.busy);
      await page.locator('#chart').scrollIntoViewIfNeeded(); await settle(page, 400);
      for (const row of ROWS) {
        const r = await read(page, row);
        check(`${width}px ${row.split(' ').pop()}: Zeile läuft über, Hinweis „end“ und Verlauf aktiv`, r.over > 2 && r.more === 'end' && r.mask !== 'none' && /gradient/.test(r.mask), r);
      }
      // Wischen bis zum Ende: Hinweis wechselt auf „start“, letzte Taste liegt vollständig im Feld
      for (const row of ROWS) {
        await page.locator(row).evaluate(el => { el.scrollLeft = el.scrollWidth; }); await settle(page);
        const r = await read(page, row);
        check(`${width}px ${row.split(' ').pop()}: am Ende „start“, letzte Taste vollständig sichtbar`, r.more === 'start' && r.lastRight <= r.boxRight + 1, r);
      }
      await page.locator(ROWS[0]).evaluate(el => { el.scrollLeft = Math.floor((el.scrollWidth - el.clientWidth) / 2); }); await settle(page);
      const mid = await read(page, ROWS[0]);
      check(`${width}px Zeitrahmen: in der Mitte beidseitig „both“`, mid.more === 'both' && /gradient/.test(mid.mask), mid);
      await page.locator(ROWS[0]).evaluate(el => { el.scrollLeft = 0; }); await settle(page);
      const back = await read(page, ROWS[0]);
      check(`${width}px Zeitrahmen: zurück am Anfang wieder „end“`, back.more === 'end', back);
      // Bedienung bleibt: eine Taste im ausgeblendeten Randbereich lässt sich nach dem Wischen antippen (1M)
      await page.locator(ROWS[0]).evaluate(el => { el.scrollLeft = el.scrollWidth; }); await settle(page);
      await page.locator('[data-interval="1M"]').tap(); await page.waitForFunction(() => __g05.state.interval === '1M' && !__g05.state.busy, null, { timeout: 15000 }).catch(() => {});
      check(`${width}px: nach dem Wischen ist „1M“ antippbar (Verlauf blockiert nichts)`, await page.evaluate(() => __g05.state.interval) === '1M');
      await ctx.close();
    }
    for (const width of [820, 1440]) {
      const ctx = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: width < 1000 }), page = await ctx.newPage(); h.collect(page, errors);
      await page.goto(h.URL_BASE + '/weather-widget-v2.html');
      await page.waitForFunction(() => window.__g05?.state.candles.length > 100 && !__g05.state.busy);
      await page.locator('#chart').scrollIntoViewIfNeeded(); await settle(page, 400);
      for (const row of ROWS) {
        const r = await read(page, row), overflowing = r.lastRight > r.boxRight + 2;
        check(`${width}px ${row.split(' ').pop()}: Hinweis genau dann, wenn die letzte sichtbare Taste über den Rand ragt (${overflowing ? 'läuft über' : 'passt'})`, overflowing ? r.more === 'end' && /gradient/.test(r.mask) : r.more === null && !/gradient/.test(r.mask), r);
      }
      if (width === 1440) { const z = await read(page, ROWS[1]); check('1440px: Werkzeugzeile ohne Hinweis, obwohl das geschlossene Hilfefenster über den Rand ragt', z.more === null && z.over > 0, z); }
      await ctx.close();
    }
    const real = errors.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|net::ERR/.test(e));
    check('keine JavaScript-Fehler', real.length === 0, real);
  } catch (e) { fail++; console.log('✗ Abbruch', e.stack || e.message); }
  finally { await browser.close(); await h.ctl('/walk?on=1').catch(() => {}); await h.teardown(); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})();
