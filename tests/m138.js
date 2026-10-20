// 3.83.1 – Vorauswahl-Listenansicht: Kurse und Änderungen erscheinen beim Start sofort in normaler Größe.
// Fehler seit 3.82.2: wlFitText las die Spaltenbreite, solange noch der Platzhalter „…“ in der Zelle stand; die Kursspalte der Liste
// ist nur so breit wie ihr Inhalt – der Kurs wurde auf ~5 px verkleinert und blieb so, bis er sich änderte (live bis ~10 s, bei
// ruhigem Markt länger). Prüfung: Größe direkt nach dem Laden = Größe nach einer erzwungenen Neuberechnung (Größenwechsel), bei
// 390 px kein Kurs unter 90 % der normalen Schrift; bei 320 px (echte Enge) ebenfalls stabil.
// Aufruf: node m138.js
const h = require('./harness');
const results = [], check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + String(detail).slice(0, 600) : ''}`); };
const sizes = page => page.evaluate(() => [...document.querySelectorAll('#watchlist .wl-list-item .wl-price, #watchlist .wl-list-item .wl-list-change')].map(n => {
  const inline = n.style.fontSize, now = parseFloat(getComputedStyle(n).fontSize); n.style.fontSize = ''; const base = parseFloat(getComputedStyle(n).fontSize); n.style.fontSize = inline;
  return { text: n.textContent, cls: n.className.split(' ')[0], now, base };
}));
const show = list => list.map(x => `${x.text} ${x.now.toFixed(1)}/${x.base.toFixed(1)}`).join(' · ');
(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0');   // ruhiger Markt: Kurse ändern sich nicht von selbst
  const browser = await h.launch({ workspace: 'fresh' });
  try {
    for (const width of [390, 320]) {
      const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true }), page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await ctx.addInitScript(() => localStorage.setItem('scalpdesk.wlview.v1', JSON.stringify('list')));
      await page.goto(`${h.URL_BASE}/weather-widget-v2.html`);
      await page.waitForFunction(() => window.__g09 && __g09.wl.c.size === 6 && [...__g09.wl.c.values()].every(e => e.rating && !e.loading && !e.tfLoading) && [...document.querySelectorAll('#watchlist .wl-list-item .wl-list-change')].every(x => /\d/.test(x.textContent)), null, { timeout: 45000 });
      await page.waitForTimeout(400);
      const first = await sizes(page);
      // erzwungene Neuberechnung wie bei jedem Größenwechsel (ResizeObserver → wlFitNumbers)
      await page.setViewportSize({ width: width + 1, height: 844 }); await page.waitForTimeout(250); await page.setViewportSize({ width, height: 844 }); await page.waitForTimeout(400);
      const again = await sizes(page);
      const same = first.length === again.length && first.every((x, i) => x.text === again[i].text && Math.abs(x.now - again[i].now) < 0.15);
      check(`${width}px: Größe direkt nach dem Start = Größe nach Neuberechnung (${first.length} Felder)`, first.length >= 12 && same, `Start: ${show(first)} | neu: ${show(again)}`);
      if (width === 390) check('390px: kein Kurs und keine Änderung unter 90 % der normalen Schrift', first.every(x => x.now >= 0.9 * x.base), show(first.filter(x => x.now < 0.9 * x.base)));
      check(`${width}px: keine Laufzeitfehler`, !errors.length, errors.join(' | '));
      await ctx.close();
    }
  } catch (e) { check('Abbruch', false, e.stack || e.message); }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
