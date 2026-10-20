// 3.84.0 – VWAP im Chart: Knopf „VWAP“ mit Auswahl (Tag/Woche/Monat/ab Swing-Tief/ab Swing-Hoch/ab Anker), ⚓-Anker und ⓘ-Erklärung;
// Werte unabhängig aus denselben Kerzen berechnet, die die Attrappe liefert (Tag aus 15m, Woche aus 1h, Monat aus 4h).
// Aufruf: node m140.js
const h = require('./harness');
const results = [], check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 600) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR/.test(e));
const until = async (fn, ms = 20000, step = 200) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch({ workspace: 'fresh' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(`${h.URL_BASE}/weather-widget-v2.html`);
    await until(() => page.evaluate(() => window.__vw && document.querySelectorAll('#chart svg').length > 0)); await page.waitForTimeout(1200);
    await page.evaluate(() => { const t = document.querySelector('.overlay-toggles'); const d = t.closest('details'); if (d) d.open = true; t.scrollIntoView({ block: 'center' }); });
    const btn = await page.evaluate(() => { const b = document.querySelector('.overlay-toggles [data-overlay="vwap"]'), sel = document.getElementById('vw-mode'), a = document.getElementById('vw-anchor'); return b && { text: b.textContent.trim(), pressed: b.getAttribute('aria-pressed'), vis: b.getBoundingClientRect().width > 0 && sel.getBoundingClientRect().width > 0 && a.getBoundingClientRect().width > 0, opts: [...sel.options].map(o => o.textContent).join('|'), val: sel.value, tip: !!document.getElementById('vw-tip') }; });
    check('Knopf „VWAP“ mit Auswahl, ⚓ und ⓘ; anfangs aus („Tag“), keine Linie', btn?.text === 'VWAP' && btn.pressed === 'false' && btn.vis && btn.opts === 'Tag|Woche|Monat|ab Swing-Tief|ab Swing-Hoch|ab Anker' && btn.val === 'day' && btn.tip && await page.evaluate(() => !document.querySelector('.vw-line')), JSON.stringify(btn));
    // erwartete Werte unabhängig aus den Kerzen der Attrappe
    const rowsOf = (iv, n) => page.evaluate(async ([iv, n]) => (await (await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=${iv}&limit=${n}`)).json()).map(r => ({ time: r[0], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] })), [iv, n]);
    const vwapOf = (rows, start) => { const part = rows.filter(r => r.time >= start); let sv = 0, spv = 0, spp = 0; for (const r of part) { const p = (r.high + r.low + r.close) / 3; sv += r.volume; spv += p * r.volume; spp += p * p * r.volume; } const v = spv / sv, sd = Math.sqrt(Math.max(0, spp / sv - v * v)); return { v, lo: v - sd, hi: v + sd, n: part.length, first: part[0]?.time }; };
    const now = await page.evaluate(() => Date.now()), D = 864e5, day0 = Math.floor(now / D) * D, monday = day0 - ((new Date(day0).getUTCDay() + 6) % 7) * D, month0 = Date.UTC(new Date(day0).getUTCFullYear(), new Date(day0).getUTCMonth(), 1);
    await page.click('[data-overlay="vwap"]');
    const toast = await until(() => page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent).find(t => /VWAP Tag an/.test(t))));
    check('Einschalten: Rückmeldung mit Wert, Band und Lage des Kurses', /VWAP Tag an: [\d.,]+ \(Band [\d.,]+ – [\d.,]+\)\. Der Kurs liegt [\d,]+ % (über|unter) dem VWAP\. Orientierung, kein Handelssignal\./.test(toast || ''), toast);
    let c = await until(() => page.evaluate(() => { const r = __vw.compute(); return r.series ? { v: r.series.last.vwap, lo: r.series.last.lower, hi: r.series.last.upper, n: r.series.points.length, start: r.series.start } : null; }));
    const cases = [['Tag', 'day', '15m', 400, day0], ['Woche', 'week', '1h', 300, monday], ['Monat', 'month', '4h', 250, month0]];
    for (const [name, mode, iv, n, start] of cases) {
      if (mode !== 'day') { await page.selectOption('#vw-mode', mode); c = await until(() => page.evaluate(m => { const r = __vw.compute(); return __vw.mode === m && r.series ? { v: r.series.last.vwap, lo: r.series.last.lower, hi: r.series.last.upper, n: r.series.points.length, start: r.series.start } : null; }, mode)); }
      const rows = await rowsOf(iv, n), e = vwapOf(rows, start);
      check(`${name}-VWAP: Wert, Band und Beginn stimmen mit den ${iv}-Kerzen überein`, c && e.first === start && near(c.v, e.v) && near(c.lo, e.lo) && near(c.hi, e.hi) && c.start === start && c.n === e.n, JSON.stringify({ app: c, erwartet: e }));
    }
    await page.selectOption('#vw-mode', 'day'); await until(() => page.evaluate(() => __vw.compute().series)); await page.waitForTimeout(300);
    // Zeichnen: Tageschart, damit der ganze Verlauf im Bild liegt
    await page.click('.chart-toolbar .intervals [data-interval="1h"]'); await page.waitForFunction(() => __g05.state.interval === '1h' && !__g05.state.busy, null, { timeout: 20000 }); await page.waitForTimeout(900);
    const draw = () => page.evaluate(() => ({ line: !!document.querySelector('#chart .vw-line'), upper: !!document.querySelector('#chart .vw-upper'), lower: !!document.querySelector('#chart .vw-lower'), band: !!document.querySelector('#chart .vw-band'), label: document.querySelector('#chart .vw-label')?.textContent, title: document.querySelector('#chart .vw-line title')?.textContent, pts: __vw.drawn }));
    let d = await draw();
    check('Linie, Band (oben, unten, Fläche) und Beschriftung „VWAP Tag …“ im Chart; Erklärung beim Darüberfahren', d.line && d.upper && d.lower && d.band && /^VWAP Tag [\d.,]+$/.test(d.label || '') && /Band .+ ab /.test(d.title || '') && d.pts > 1, JSON.stringify(d));
    // Swing-Punkte: ZigZag fein einstellen, damit es bestätigte Umkehrpunkte gibt
    await page.selectOption('#zz-pct', '0.25'); await page.waitForTimeout(500);
    for (const [mode, name, type] of [['low', 'ab Swing-Tief', 'L'], ['high', 'ab Swing-Hoch', 'H']]) {
      await page.selectOption('#vw-mode', mode); await page.waitForTimeout(700);
      const alt = await page.evaluate(([t]) => { const c = __vw.compute(); return { exp: __vw.pivot(t), start: c.series?.start, why: c.why, label: document.querySelector('#chart .vw-label')?.textContent }; }, [type]);
      check(`${name}: beginnt am letzten bestätigten Umkehrpunkt (oder nennt den Grund)`, (alt.start && alt.start === alt.exp && new RegExp('^VWAP ' + name).test(alt.label || '')) || (!alt.start && /Umkehrpunkt|vor den geladenen/.test(alt.why || '')), JSON.stringify(alt));
    }
    // Anker: Kerze antippen, dann ⚓
    await page.selectOption('#vw-mode', 'day'); await page.waitForTimeout(300);
    await page.evaluate(() => { document.querySelectorAll('#toasts .toast').forEach(t => t.remove()); });
    await page.click('#vw-anchor');
    const noSel = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent).join('|'));
    check('⚓ ohne angetippte Kerze: erklärt, was zu tun ist; Modus bleibt', /Erst im Chart eine Kerze antippen oder anklicken/.test(noSel) && await page.evaluate(() => __vw.mode) === 'day', noSel);
    const box = await page.evaluate(() => { document.getElementById('chart').scrollIntoView({ block: 'center' }); const r = document.querySelector('#chart svg').getBoundingClientRect(); return { x: r.left + r.width * 0.55, y: r.top + r.height * 0.45 }; });
    await page.waitForTimeout(300);
    await page.mouse.click(box.x, box.y); await page.waitForTimeout(400);
    await page.mouse.move(5, 5); await page.waitForTimeout(300); // Maus verlässt den Chart: die Auswahl endet, die angeklickte Kerze bleibt gemerkt
    const sel = await page.evaluate(() => __g05.state.pickedTime), gone = await page.evaluate(() => __g05.state.selectedTime);
    check('Voraussetzung: ein Klick im Chart merkt die Kerze, auch wenn die Auswahl beim Verlassen des Charts endet', Number.isFinite(sel) && !Number.isFinite(gone), JSON.stringify({ sel, gone }));
    await page.click('#vw-anchor'); await page.waitForTimeout(900);
    const an = await page.evaluate(() => { const c = __vw.compute(); return { mode: __vw.mode, anchor: __vw.anchor, start: c.series?.start, why: c.why, label: document.querySelector('#chart .vw-label')?.textContent, val: document.getElementById('vw-mode').value, saved: JSON.parse(localStorage.getItem('scalpdesk.vwap.v1')) }; });
    check('⚓ mit gewählter Kerze: Modus „ab Anker“, VWAP beginnt an genau dieser Kerze, gespeichert je Coin', an.mode === 'anchor' && an.val === 'anchor' && an.anchor === sel && an.start === sel && /^VWAP ab Anker /.test(an.label || '') && an.saved?.anchor?.time === sel && an.saved.anchor.symbol === 'BTCUSDT', JSON.stringify(an));
    const wrong = await page.evaluate(() => { const c = __vw.compute(); const p = c.series.points; return { first: p[0].time, n: p.length }; });
    const rows1h = await rowsOf('1h', 300); const e1 = vwapOf(rows1h, sel);
    check('Anker-VWAP stimmt mit den 1h-Kerzen ab der angetippten Kerze überein', e1.first === sel && near(await page.evaluate(() => __vw.compute().series.last.vwap), e1.v), JSON.stringify({ sel, e1, wrong }));
    await page.click('#vw-tip > summary'); await page.waitForTimeout(300);
    const tip = await page.evaluate(() => { const b = document.querySelector('#vw-tip .tip-body'); return { open: document.getElementById('vw-tip').open, vis: b.getBoundingClientRect().height > 0, text: b.textContent }; });
    check('ⓘ erklärt: Formel, Band, Zeiträume, Swing und Anker, nichts wird geschätzt, kein Handelssignal', tip.open && tip.vis && /\(Hoch \+ Tief \+ Schluss\) ÷ 3/.test(tip.text) && /±1 volumengewichtete Standardabweichung/.test(tip.text) && /15m-, 1h- bzw\. 4h-Kerzen/.test(tip.text) && /⚓/.test(tip.text) && /nichts geschätzt/.test(tip.text) && /kein Handelssignal/.test(tip.text));
    await page.click('#vw-tip > summary');
    await page.reload(); await until(() => page.evaluate(() => window.__vw && document.querySelectorAll('#chart svg').length > 0)); await page.waitForTimeout(1500);
    check('Nach Neustart: Schalter an, Modus „ab Anker“ und Anker erhalten', await page.evaluate(sel => document.querySelector('[data-overlay="vwap"]').getAttribute('aria-pressed') === 'true' && document.getElementById('vw-mode').value === 'anchor' && __vw.anchor === sel, sel));
    await page.evaluate(() => { const t = document.querySelector('.overlay-toggles'); const d = t.closest('details'); if (d) d.open = true; });
    await page.click('#ov-all'); await page.waitForTimeout(600);
    check('„Alle ausblenden“ nimmt auch den VWAP weg', await page.evaluate(() => document.querySelector('[data-overlay="vwap"]').getAttribute('aria-pressed') === 'false' && !document.querySelector('#chart .vw-line')));
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), mp = await mctx.newPage(); h.collect(mp, errors);
    await mp.goto(`${h.URL_BASE}/weather-widget-v2.html`); await until(() => mp.evaluate(() => window.__vw && document.querySelectorAll('#chart svg').length > 0));
    const mobile = await mp.evaluate(() => { const t = document.querySelector('.overlay-toggles'); const d = t.closest('details'); if (d) d.open = true; const r = ['[data-overlay="vwap"]', '#vw-mode', '#vw-anchor'].map(q => document.querySelector(q).getBoundingClientRect()); return { right: Math.max(...r.map(x => x.right)), vw: innerWidth, minH: Math.min(...r.map(x => x.height)), doc: document.documentElement.scrollWidth }; });
    check('Handy 390 px: Knopf, Auswahl und ⚓ ohne seitliches Überlaufen, mindestens 34 px hoch', mobile.right <= mobile.vw + 1 && mobile.doc <= mobile.vw + 1 && mobile.minH >= 34, JSON.stringify(mobile));
    await mctx.close();
    check('keine Laufzeitfehler', !real(errors).length, real(errors).join(' | '));
    await ctx.close();
  } catch (e) { check('Abbruch', false, e.stack || e.message); }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
