// 3.13.1 – Die beiden oberen Intervall-Leisten (Live-Leiste oben und Signalzeile unter dem Kurs) schalten das Chart-Intervall
// genau wie die Leiste über dem Chart; alle drei markieren dasselbe Intervall. Das Gesamturteil („Kaufsignal →“) führt weiter
// zur Signal-Übersicht. iPad-Breite (beide oberen Leisten sichtbar), Tastatur, Handy hochkant. Aufruf: node m21.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
// Markierung in allen drei Leisten, Kerzen-Anfragen und sichtbarer Intervall-Hinweis
const marks = page => page.evaluate(() => {
  const cur = sel => [...document.querySelectorAll(sel)].filter(b => b.classList.contains('cur') || b.classList.contains('active')).map(b => b.dataset.iv || b.dataset.interval);
  const pressed = sel => [...document.querySelectorAll(sel)].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.iv || b.dataset.interval);
  return { bottom: cur('.intervals [data-interval]'), bottomP: pressed('.intervals [data-interval]'), top: cur('#lb-heat .hc'), topP: pressed('#lb-heat .hc'), mid: cur('#signal-line .hc'), midP: pressed('#signal-line .hc'),
    caption: document.getElementById('chart-caption').textContent, ctx: document.getElementById('indicator-context').textContent, n: document.querySelectorAll('#lb-heat .hc').length + '/' + document.querySelectorAll('#signal-line .hc').length };
});
const same = (m, iv) => [m.bottom, m.bottomP, m.top, m.topP, m.mid, m.midP].every(a => a.length === 1 && a[0] === iv);
const klines = async since => (await h.ctl('/log?since=' + since)).filter(e => /klines$/.test(e.path || '') && e.q.symbol === 'BTCUSDT').map(e => e.q.interval);
const pick = async (page, sel, iv, how = 'click') => { const t0 = Date.now(); await page[how](`${sel} [data-iv="${iv}"]`); await page.waitForFunction(v => document.getElementById('chart-caption').textContent.endsWith('· ' + v), iv, { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(700); return t0; };
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 900 }, hasTouch: true, isMobile: true }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page);
    await page.waitForFunction(() => document.querySelectorAll('#lb-heat .hc').length === 6 && document.querySelectorAll('#signal-line .hc').length === 6, null, { timeout: 20000 }).catch(() => {});
    let m = await marks(page);
    check('Beide oberen Leisten: sechs Zeitraum-Knöpfe, Start 1m überall markiert', m.n === '6/6' && same(m, '1m'), JSON.stringify(m));
    const h0 = await page.evaluate(() => [document.querySelector('.livebar').getBoundingClientRect().height, document.querySelector('#lb-heat .hc').getBoundingClientRect().height].map(Math.round));
    // Live-Leiste oben: 15m
    let t0 = await pick(page, '#lb-heat', '15m'); m = await marks(page); let k = await klines(t0);
    check('Live-Leiste: Klick auf 15m wechselt den Chart (Kerzen neu geladen), alle drei Leisten markieren 15m', same(m, '15m') && k.includes('15m') && /· 15m$/.test(m.caption) && m.ctx.startsWith('15m'), JSON.stringify({ ...m, kerzen: k }));
    // Signalzeile unter dem Kurs: 1h
    t0 = await pick(page, '#signal-line', '1h'); m = await marks(page); k = await klines(t0);
    check('Signalzeile unter dem Kurs: Klick auf 1h wechselt den Chart, alle drei markieren 1h', same(m, '1h') && k.includes('1h') && /· 1h$/.test(m.caption), JSON.stringify({ ...m, kerzen: k }));
    // Untere Leiste: 4h – die oberen folgen
    await page.click('.intervals [data-interval="4h"]'); await page.waitForTimeout(1500); m = await marks(page);
    check('Leiste über dem Chart: 4h – beide oberen Leisten markieren ebenfalls 4h', same(m, '4h'), JSON.stringify(m));
    // 1w gibt es oben nicht: dort ist dann nichts markiert
    await page.click('.intervals [data-interval="1w"]'); await page.waitForTimeout(1500); m = await marks(page);
    check('1w (nur unten vorhanden): unten markiert, oben keine Markierung', m.bottom.join() === '1w' && !m.top.length && !m.mid.length && !m.topP.length && !m.midP.length, JSON.stringify(m));
    // Antippen (Finger) in der Live-Leiste: 1d
    t0 = await pick(page, '#lb-heat', '1d', 'tap'); m = await marks(page);
    check('Antippen in der Live-Leiste: 1d, alle drei markieren 1d', same(m, '1d'), JSON.stringify(m));
    const h1 = await page.evaluate(() => [document.querySelector('.livebar').getBoundingClientRect().height, document.querySelector('#lb-heat .hc').getBoundingClientRect().height].map(Math.round));
    check('Höhe von Live-Leiste und Knöpfen unverändert (26 px wie bisher)', h0.join() === h1.join() && h1[1] === 26, JSON.stringify({ vorher: h0, nachher: h1 }));
    // Tastatur: Fokus auf 5m, Enter
    await page.focus('#signal-line [data-iv="5m"]'); await page.keyboard.press('Enter'); await page.waitForFunction(() => document.getElementById('chart-caption').textContent.endsWith('· 5m'), null, { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(700); m = await marks(page);
    check('Tastatur: Enter auf 5m wechselt ebenfalls', same(m, '5m'), JSON.stringify(m));
    // Gesamturteil führt weiter zur Signal-Übersicht
    await page.evaluate(() => scrollTo(0, 0)); await page.click('#signal-line .hv'); await page.waitForTimeout(1200);
    const sig = await page.evaluate(() => { const r = document.getElementById('signals').getBoundingClientRect(); return { top: Math.round(r.top), h: innerHeight, tab: document.documentElement.dataset.activeTab }; });
    check('„Kaufsignal →“ führt weiter zur Signal-Übersicht, Intervall bleibt', sig.top >= -5 && sig.top < sig.h / 2 && same(await marks(page), '5m'), JSON.stringify(sig));
    check('keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();
    // Handy hochkant: Live-Leiste als Raster, Antippen wechselt, kein seitliches Scrollen
    for (const w of [390, 320]) {
      const pc = await browser.newContext({ viewport: { width: w, height: 800 }, hasTouch: true, isMobile: true }), pp = await pc.newPage(), pe = []; h.collect(pp, pe);
      await pp.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(pp);
      await pp.waitForFunction(() => document.querySelectorAll('#lb-heat .hc').length === 6, null, { timeout: 20000 }).catch(() => {});
      await pick(pp, '#lb-heat', '1h', 'tap'); const pm = await marks(pp);
      const lay = await pp.evaluate(() => { const r = [...document.querySelectorAll('#lb-heat .hc, #lb-heat .hv')].map(e => e.getBoundingClientRect()); return { sw: document.scrollingElement.scrollWidth - innerWidth, row: r.every(x => Math.abs(x.top - r[0].top) < 2), right: Math.max(...r.map(x => x.right)), vw: innerWidth }; });
      check(`Handy ${w} px: Antippen in der Live-Leiste wechselt auf 1h, alle markiert, eine Zeile, kein seitliches Scrollen`, same(pm, '1h') && lay.row && lay.right <= lay.vw && lay.sw <= 0, JSON.stringify({ top: pm.top, bottom: pm.bottom, ...lay }));
      check(`Handy ${w} px: keine Fehler`, !pe.length, pe.join(' | ')); await pc.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.ctl('/walk?on=1').catch(() => {}); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
