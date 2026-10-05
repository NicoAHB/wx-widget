// Schritt 2.2 – RSI-Divergenz-Scanner: Anzeige im Chart, Schalter (auch im Vollbild), bullisch, bärisch, vorläufig, keine,
// Handy-Ansicht. Die Attrappe liefert per /shape gezielte Verläufe. Aufruf: node m13.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const div = page => page.evaluate(() => { const g = [...document.querySelectorAll('#chart svg .rsi-div')];
  return { pressed: document.querySelector('[data-overlay="div"]')?.getAttribute('aria-pressed'), n: g.length, items: g.map(e => { const l = e.querySelector('.rsi-div-line'), t = e.querySelector('.rsi-div-label');
    return { cls: e.getAttribute('class'), label: t?.textContent || '', tip: e.querySelector('title')?.textContent || '', x1: +l.getAttribute('x1'), x2: +l.getAttribute('x2'), dash: getComputedStyle(l).strokeDasharray, stroke: getComputedStyle(l).stroke }; }) }; });
const settle = page => page.waitForTimeout(900);
const load = async (page, sym) => { await page.fill('#symbol', sym); await page.press('#symbol', 'Enter'); await page.waitForFunction(s => document.getElementById('lb-sym').textContent === s, sym, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(1500); };
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  for (const [sym, kind] of [['XRPUSDT', 'bull'], ['SOLUSDT', 'bear'], ['ETCUSDT', 'none'], ['LTCUSDT', 'open']]) await h.ctl(`/shape?symbol=${sym}&interval=1m&kind=${kind}`);
  const browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html');
    await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
    await page.selectOption('#zz-pct', '1'); await load(page, 'XRP');
    let d = await div(page), it = d.items[0];
    check('Schalter „RSI-Div.“ bei den Chart-Ebenen, standardmäßig an', d.pressed === 'true', d.pressed);
    check('Bullische Divergenz: grüne Linie zwischen zwei Tiefs, Beschriftung mit RSI-Werten', d.n === 1 && /\bbull\b/.test(it.cls) && !/tentative/.test(it.cls) && /^▲ Bull\. Divergenz · RSI \d+→\d+$/.test(it.label) && it.x2 > it.x1 && it.dash === 'none' && /rgb/.test(it.stroke), JSON.stringify({ n: d.n, cls: it?.cls, label: it?.label, stroke: it?.stroke }));
    const rsi = it && it.label.match(/RSI (\d+)→(\d+)/);
    check('RSI-Tief höher als vorher (mind. 2 Punkte), Kurs-Tief tiefer', rsi && +rsi[2] - +rsi[1] >= 2 && /tieferes Tief/.test(it.tip) && /höheres Tief/.test(it.tip), rsi && rsi.slice(1).join(' → '));
    check('Tooltip: Grundlage (ZigZag 1 %, letzte 40 Kerzen) und ehrlicher Hinweis „kein Handelssignal“', /ZigZag-Umkehrpunkte ab 1 % Mindestbewegung/.test(it.tip) && /letzten 40 abgeschlossenen Kerzen/.test(it.tip) && /Hinweis, kein Handelssignal/.test(it.tip), it.tip.slice(0, 160));
    await page.click('[data-overlay="div"]'); await settle(page); const off = await div(page);
    await page.click('[data-overlay="div"]'); await settle(page); const on = await div(page);
    check('Ausblenden und wieder einblenden', off.pressed === 'false' && off.n === 0 && on.pressed === 'true' && on.n === 1, JSON.stringify({ aus: [off.pressed, off.n], an: [on.pressed, on.n] }));
    await page.click('[data-overlay="div"]'); await settle(page);
    await page.reload(); await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1500);
    const re = await div(page); check('Nach dem Neuladen bleibt der Schalter aus', re.pressed === 'false' && re.n === 0, JSON.stringify(re));
    await page.click('[data-overlay="div"]'); await settle(page);
    await load(page, 'SOL'); d = await div(page); it = d.items[0];
    check('Bärische Divergenz (Spiegelbild): rote Linie zwischen zwei Hochs', d.n === 1 && /\bbear\b/.test(it.cls) && /^▼ Bär\. Divergenz · RSI \d+→\d+$/.test(it.label) && /höheres Hoch/.test(it.tip) && /tieferes Hoch/.test(it.tip), JSON.stringify({ n: d.n, cls: it?.cls, label: it?.label }));
    await load(page, 'ETC'); d = await div(page);
    check('Zweites Tief höher: keine Divergenz', d.n === 0, JSON.stringify(d.items.map(x => x.label)));
    await load(page, 'LTC'); d = await div(page); it = d.items[0];
    check('Tief noch nicht bestätigt: „vorläufig“, gestrichelt', d.n === 1 && /tentative/.test(it.cls) && /vorläufig$/.test(it.label) && it.dash !== 'none' && /noch nicht bestätigt/.test(it.tip), JSON.stringify({ label: it?.label, dash: it?.dash }));
    // Vollbild: Schalter in der Werkzeugzeile
    await load(page, 'XRP');
    await page.click('#chart-full'); await page.waitForTimeout(800); await page.click('#fb-tools'); await page.waitForTimeout(600);
    const vis = await page.evaluate(() => { const b = document.querySelector('[data-overlay="div"]'), r = b.getBoundingClientRect(); return { vis: getComputedStyle(b).visibility, w: Math.round(r.width) }; });
    const f1 = await div(page); await page.click('[data-overlay="div"]'); await settle(page); const f2 = await div(page); await page.click('[data-overlay="div"]'); await settle(page); const f3 = await div(page);
    check('Vollbild: Divergenz sichtbar, Schalter in der Werkzeugzeile blendet aus und ein', vis.vis === 'visible' && vis.w > 40 && f1.n === 1 && f2.n === 0 && f3.n === 1, JSON.stringify({ vis, an: f1.n, aus: f2.n, wieder: f3.n }));
    await page.click('#fb-exit'); await page.waitForTimeout(400);
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
    // Handy 320 px: Schalter ohne seitliches Scrollen, Beschriftung im Chart und nicht unter den Kurs-Schildchen
    const pc = await browser.newContext({ viewport: { width: 320, height: 700 }, hasTouch: true, isMobile: true }); await pc.addInitScript(() => { localStorage.setItem('scalpdesk.zigzag.v1', JSON.stringify({ pct: 1 })); });
    const pp = await pc.newPage(), pe = []; h.collect(pp, pe); await pp.goto(h.URL_BASE + '/weather-widget-v2.html');
    await pp.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {}); await load(pp, 'XRP');
    await pp.evaluate(() => document.getElementById('chart').scrollIntoView({ block: 'center' })); await pp.waitForTimeout(800);
    const m = await pp.evaluate(() => { const b = document.querySelector('[data-overlay="div"]').getBoundingClientRect(), t = document.querySelector('#chart .rsi-div-label'), R = document.querySelector('#chart svg').getBoundingClientRect(); if (!t) return { btn: Math.round(b.right), vw: innerWidth };
      const r = t.getBoundingClientRect(), hit = [...document.querySelectorAll('#chart svg rect.axis-tag')].map(a => a.getBoundingClientRect()).some(a => a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top);
      return { btn: Math.round(b.right), vw: innerWidth, sw: document.scrollingElement.scrollWidth, label: t.textContent, l: Math.round(r.left - R.left), r: Math.round(R.right - r.right), overlap: hit }; });
    check('Handy 320 px: Schalter im Bild, kein seitliches Scrollen, Beschriftung (Kurzform) im Chart, nicht unter den Kurs-Schildchen', m.label && m.btn <= m.vw && m.sw <= m.vw && m.l >= 0 && m.r >= 0 && !m.overlap && /^▲ (Bull\. Divergenz|Div\.) /.test(m.label), JSON.stringify(m));
    check('Handy: keine Fehler', !pe.length, pe.join(' | ')); await pc.close();
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.ctl('/walk?on=1').catch(() => {}); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
