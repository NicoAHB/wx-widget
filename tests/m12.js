// Handy hochkant: Chart bis an den rechten Rand, Kurse auf Schildchen im Chart statt in einer eigenen Spalte.
// Desktop, Tablet und das gedrehte Vollbild behalten die Kursspalte. Seit 3.17.0 (Schritt 3.3) entfällt der Kurs einer
// Rasterlinie, die das Kurs-Schild mit dem Countdown verdecken würde (höchstens einer). Aufruf: node m12.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const num = t => Number(String(t).replace(/\./g, '').replace(',', '.'));
const geo = page => page.evaluate(() => {
  const svg = document.querySelector('#chart svg'), vb = svg.viewBox.baseVal, w = vb.width;
  const tags = [...svg.querySelectorAll('rect.axis-tag')].map(r => ({ x: +r.getAttribute('x'), w: +r.getAttribute('width'), y: +r.getAttribute('y') }));
  const labs = [...svg.querySelectorAll('text.axis-label')].filter(t => /^[\d.]+,\d+$/.test(t.textContent)).map(t => ({ t: t.textContent, x: +t.getAttribute('x'), y: +t.getAttribute('y'), anchor: t.getAttribute('text-anchor') || 'start', inner: t.classList.contains('axis-in') }));
  const candles = [...svg.querySelectorAll('rect')].filter(r => r.getAttribute('rx') === '0.4').map(r => +r.getAttribute('x') + +r.getAttribute('width'));
  const grid = [...svg.querySelectorAll('line.grid-line')].map(l => +l.getAttribute('x2'));
  // Rasterlinien (von unten nach oben), deren Kurs das Kurs-Schild verdeckt – dieselbe Regel wie in der App (±10 px)
  const tr = svg.querySelector('.last-tag rect'), tag = tr && { y: +tr.getAttribute('y'), h: +tr.getAttribute('height') }, gy = [...svg.querySelectorAll('line.grid-line')].map(l => +l.getAttribute('y1'));
  const hid = yy => !!tag && yy > tag.y - 10 && yy < tag.y + tag.h + 10;
  const R = svg.getBoundingClientRect();
  return { w, h: vb.height, tags, labs, lastCandle: Math.max(...candles), gridRight: Math.min(...grid), skipInner: gy.slice(1, -1).filter(hid).length, skipAll: gy.filter(hid).length, sw: document.scrollingElement.scrollWidth, vw: innerWidth, rot: getComputedStyle(document.getElementById('chart-sec')).transform !== 'none', svgRight: Math.round(R.right) };
});
const phone = (w, hh) => ({ viewport: { width: w, height: hh }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset');
  const browser = await h.launch();
  try {
    const open = async view => { const ctx = await browser.newContext(view), page = await ctx.newPage(), errors = []; h.collect(page, errors);
      await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
      await page.evaluate(() => document.getElementById('chart').scrollIntoView({ block: 'center' })); await page.waitForTimeout(900); return { ctx, page, errors }; };
    const inChart = (g, n) => g.skipAll <= 1 && g.tags.length === n - g.skipInner && g.labs.length === n - g.skipInner && g.labs.every(l => l.inner && l.anchor === 'end' && l.x <= g.w && l.x >= g.w - 12) && g.tags.every(t => t.x + t.w <= g.w && t.x >= g.w - 110);
    const descending = g => g.labs.every((l, i) => !i || (l.y > g.labs[i - 1].y) === (num(l.t) < num(g.labs[i - 1].t)));
    for (const [name, view] of [['iPhone 390 px', phone(390, 844)], ['Handy 320 px', phone(320, 700)]]) {
      const { ctx, page, errors } = await open(view), g = await geo(page);
      check(`${name}: Chart reicht bis an den rechten Rand (keine leere Kursspalte)`, g.lastCandle >= g.w - 8 && g.gridRight >= g.w - 1, JSON.stringify({ breite: g.w, letzteKerze: Math.round(g.lastCandle), raster: g.gridRight }));
      check(`${name}: Kurse auf Schildchen im Chart, rechtsbündig am Rand, 3 innere Linien (ohne die vom Kurs-Schild verdeckte)`, inChart(g, 3) && descending(g), JSON.stringify({ kurse: g.labs.map(l => l.t), verdeckt: g.skipInner }));
      check(`${name}: kein seitliches Scrollen`, g.sw <= g.vw, `${g.sw} / ${g.vw}`);
      // Magnet-Preisschild: im Chart am rechten Rand statt in der (nicht mehr vorhandenen) Spalte
      const mg = await page.evaluate(() => { const ch = document.getElementById('chart'), t = ch.querySelector('svg') || ch, R = ch.getBoundingClientRect();
        t.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', pointerId: 5, clientX: R.left + R.width * .7, clientY: R.top + R.height * .35 }));
        const svg = ch.querySelector('svg'), r = svg.querySelector('.magnet-g rect'), p = svg.querySelector('.magnet-price'), vb = svg.viewBox.baseVal;
        return r ? { x: +r.getAttribute('x'), w: +r.getAttribute('width'), price: p.textContent, vw: vb.width } : null; });
      check(`${name}: Magnet-Preisschild im Chart am rechten Rand, Preis vollständig`, mg && mg.x + mg.w <= mg.vw && mg.x > mg.vw * .5 && mg.w >= mg.price.length * 6.5, JSON.stringify(mg));
      if (name === 'iPhone 390 px') {
        // Vollbild hochkant (App-Drehung aus, wie bei eingeschalteter Ausrichtungssperre in iOS abgeschaltet)
        await page.click('#chart-full'); await page.waitForTimeout(900);
        const rotated = await geo(page);
        check('iPhone Vollbild gedreht (quer): Kursspalte wie bisher', rotated.rot && rotated.tags.length === 0 && rotated.skipAll <= 1 && rotated.labs.length === 5 - rotated.skipAll && rotated.labs.every(l => l.anchor === 'start' && l.x > rotated.w - 82), JSON.stringify({ gedreht: rotated.rot, schildchen: rotated.tags.length, kurse: rotated.labs.length, verdeckt: rotated.skipAll }));
        await page.click('#fb-rot'); await page.waitForTimeout(900);
        const g2 = await geo(page);
        check('iPhone Vollbild hochkant: Chart bis an den Rand, 5 Kurse im Chart (hoher Chart, mehr Linien)', !g2.rot && g2.lastCandle >= g2.w - 8 && inChart(g2, 5) && descending(g2), JSON.stringify({ breite: g2.w, höhe: g2.h, letzteKerze: Math.round(g2.lastCandle), kurse: g2.labs.map(l => l.t) }));
        await page.screenshot({ path: __dirname + '/shots/m12-vollbild-hochkant.png' });
        await page.click('#fb-exit'); await page.waitForTimeout(600);
        const g3 = await geo(page);
        check('Nach dem Vollbild: normale Handy-Ansicht wieder mit 3 Kursen im Chart (ohne die vom Kurs-Schild verdeckte)', !g3.rot && inChart(g3, 3), JSON.stringify({ kurse: g3.labs.map(l => l.t), verdeckt: g3.skipInner }));
      }
      check(`${name}: keine Fehler`, !errors.length, errors.join(' | ')); await ctx.close();
    }
    // Desktop und Tablet: Kursspalte rechts unverändert
    for (const [name, view] of [['Desktop 1440', { viewport: { width: 1440, height: 900 } }], ['iPad hochkant 820', { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true }]]) {
      const { ctx, page, errors } = await open(view), g = await geo(page);
      check(`${name}: Kursspalte rechts wie bisher (5 Kurse ohne den vom Kurs-Schild verdeckten, keine Schildchen)`, g.tags.length === 0 && g.skipAll <= 1 && g.labs.length === 5 - g.skipAll && g.labs.every(l => l.anchor === 'start' && !l.inner && l.x === g.w - 72) && g.lastCandle <= g.w - 70, JSON.stringify({ breite: g.w, x: g.labs[0]?.x, letzteKerze: Math.round(g.lastCandle), kurse: g.labs.length, verdeckt: g.skipAll }));
      check(`${name}: keine Fehler`, !errors.length, errors.join(' | ')); await ctx.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
