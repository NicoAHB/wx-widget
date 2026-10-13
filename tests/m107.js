// 3.70.0 (Nutzerwunsch iPad): Beendete Chartmuster (gescheitert, abgelaufen, erfüllt, ungültig) bleiben per Tipp gesperrt, lassen
// sich aber über ⓘ → „Ausgegraut im Chart zeigen“ ansehen – grau und gestrichelt an der damaligen Stelle, Ausschnitt springt hin.
// Ausblenden über denselben Knopf, Tipp auf den grauen Namen oder Coin-/Intervallwechsel. Keine Auswahl, keine Projektion,
// keine Positionen/Alarme/Lernfälle. Echte App mit echter pat-1-Erkennung auf einem aufsteigenden Dreieck (Kerzen wie m94).
// Aufruf: node m107.js
const h = require('./harness'), fs = require('fs'), vm = require('vm');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 600) : ''}`); };

(async () => {
  await h.setup(); const browser = await h.launch();
  try {
    await h.ctl('/walk?on=0'); await h.ctl('/silent?on=1');
    const I = await import('../shared/market-intervals.mjs'), D = await import('../shared/chart-detail.mjs'), src = fs.readFileSync(__dirname + '/m58.js', 'utf8');
    const B = vm.runInNewContext(src.slice(src.indexOf('const BUILD = () => {'), src.indexOf('\nconst tests = {')) + '\nBUILD()'), shape = B.path(B.F.asc_triangle), testTime = Date.now();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }), page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.clock.setFixedTime(new Date(testTime));
    await ctx.route(/https:\/\/(?:data-api\.binance\.vision|api\.binance\.com|fapi\.binance\.com)\/.*klines\?/, route => {
      const u = new URL(route.request().url()), q = u.searchParams, iv = q.get('interval'), sym = q.get('symbol'); if (sym !== 'BTCUSDT' || !I.INTERVAL_MS[iv] || iv === '1M') return route.continue();
      const ms = I.INTERVAL_MS[iv], start = D.candleStart(testTime, iv) - 499 * ms;
      const rows = [...Array.from({ length: 499 - shape.length }, () => ({ o: 85, h: 85.1, l: 84.9, c: 85, v: 100 })), ...shape, { o: 97, h: 97.1, l: 96.9, c: 97, v: 1 }];
      return route.fulfill({ json: rows.map((c, i) => [start + i * ms, c.o, c.h, c.l, c.c, c.v, I.intervalEnd(start + i * ms, iv) - 1]), headers: { 'access-control-allow-origin': '*' } });
    });
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => window.__g09 && __g05.state.candles.length > 200);
    await page.evaluate(() => __intervals.setMarket('BTCUSDT', '1h')); await page.locator('#chart').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => !__g05.state.busy && __g09.chipRows().some(r => !r.disabled && r.hit.kind === 'form' && (r.hit.lines || []).length >= 2), null, { timeout: 30000 });
    const snap = await page.evaluate(() => ({ positions: JSON.stringify(__g05.state.positions), alarms: JSON.stringify(__g05.state.alarms), learned: localStorage.getItem('scalpdesk.patknow.v1') }));
    const row = await page.evaluate(() => { const r = __g09.chipRows().find(r => !r.disabled && r.hit.kind === 'form' && (r.hit.lines || []).length >= 2); return { key: r.key, status: r.hit.status, lines: r.hit.lines.length, name: r.hit.id }; });
    const tile = page.locator(`button[data-pattern-key="${row.key}"]`), info = page.locator(`button[data-pattern-info-key="${row.key}"]`), zoom = page.locator('#pat-info-zoom');
    const state = () => page.evaluate(() => ({ ghost: __g09.ghost?.key || null, sel: __g09.pat.sel, on: __g09.pat.on, chips: document.querySelectorAll('.pat-chip-drawing').length, g: document.querySelectorAll('#chart .pat-ghost').length, lines: document.querySelectorAll('#chart .pat-ghost-line').length, tag: document.querySelector('#chart .pat-ghost-label')?.textContent || '', toast: [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent).join(' | ') }));

    // aktives Muster: unverändert normal zoomen
    await info.click(); await page.waitForSelector('#pat-info[open]');
    check('Aktives Muster: Knopf heißt weiter „Im Chart zeigen“', (await zoom.innerText()).trim() === 'Im Chart zeigen' && await zoom.isEnabled());
    await page.click('#pat-info-x');

    // beendet (ungültig): Tipp gesperrt, ⓘ bietet „Ausgegraut im Chart zeigen“
    await page.evaluate(key => { const r = __g09.chipRows().find(r => r.key === key); r.hit.status = 'ungültig'; __g09.chipPaint(); }, row.key);
    check('Beendetes Muster: Kachel per Tipp gesperrt, keine Zeichnung', await tile.isDisabled() && (await state()).chips === 0);
    await info.click(); await page.waitForSelector('#pat-info[open]');
    check('ⓘ öffnet die Erklärung; Knopf „Ausgegraut im Chart zeigen“ ist aktiv', (await zoom.innerText()).trim() === 'Ausgegraut im Chart zeigen' && await zoom.isEnabled() && /ungültig/i.test(await zoom.getAttribute('title')) && /Status: ungültig/.test(await page.locator('#pat-info-body').innerText()));
    await page.evaluate(() => { __g05.state.count = 300; __g05.scheduleDraw?.(); }); // weiter Ausschnitt: der Sprung zum Muster muss sichtbar werden
    await zoom.click(); await page.waitForTimeout(500);
    let s = await state();
    check('Antippen: Erklärung zu, Muster grau im Chart mit allen Linien und Namen „… · ungültig · ausgegraut ✕“', !(await page.locator('#pat-info').evaluate(d => d.open)) && s.ghost === row.key && s.g === 1 && s.lines === row.lines && /· ungültig · ausgegraut ✕$/.test(s.tag), JSON.stringify(s));
    check('Rückmeldung: nur zur Ansicht, kein aktives Muster', /ausgegraut im Chart – nur zur Ansicht, kein aktives Muster/.test(s.toast), s.toast);
    const look = await page.evaluate(() => {
      const muted = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim(), ls = [...document.querySelectorAll('#chart .pat-ghost-line')];
      const hl = document.querySelector('#chart .pat-ghost-hl'), plot = document.querySelector('#chart svg').getBoundingClientRect(), r = hl.getBoundingClientRect();
      return { grey: ls.every(l => l.getAttribute('stroke') === muted && l.getAttribute('stroke-dasharray')), muted, inPlot: r.right > plot.left && r.left < plot.right && r.width > 4, count: __g05.state.count };
    });
    check('Grau und gestrichelt (Farbe = gedämpfte Schrift), Ausschnitt springt zum Muster', look.grey && look.inPlot && look.count < 300, JSON.stringify(look));
    check('Keine Auswahl, keine Projektion, KI-Muster bleiben aus', s.sel === null && s.on === false && s.chips === 0 && await page.evaluate(key => ![...document.querySelectorAll('#chart .pat-projection')].length && __g09.chipRows().find(r => r.key === key).disabled, row.key), JSON.stringify(s));

    // derselbe Knopf blendet aus
    await info.click(); await page.waitForSelector('#pat-info[open]');
    check('Erneut ⓘ: Knopf heißt jetzt „Ausgegraut ausblenden“', (await zoom.innerText()).trim() === 'Ausgegraut ausblenden');
    await zoom.click(); await page.waitForTimeout(400); s = await state();
    check('„Ausgegraut ausblenden“ entfernt die graue Zeichnung', s.ghost === null && s.g === 0 && /Ausgegrautes Muster ausgeblendet/.test(s.toast), JSON.stringify(s));

    // Tipp auf den grauen Namen blendet aus
    await info.click(); await page.waitForSelector('#pat-info[open]'); await zoom.click(); await page.waitForTimeout(400);
    await page.locator('#chart .pat-ghost-tag').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    const tag = await page.locator('#chart .pat-ghost-tag rect').boundingBox();
    check('Grauer Name ist gut antippbar (mindestens 18 px hoch)', tag && tag.height >= 17.5 && tag.width >= 80, JSON.stringify(tag));
    await page.touchscreen.tap(tag.x + tag.width / 2, tag.y + tag.height / 2); await page.waitForTimeout(400); s = await state();
    check('Tipp auf den grauen Namen blendet aus', s.ghost === null && s.g === 0, JSON.stringify(s));

    // Vollbild: dieselbe Anzeige
    await info.click(); await page.waitForSelector('#pat-info[open]'); await zoom.click(); await page.waitForTimeout(300);
    await page.click('#chart-full'); await page.waitForTimeout(600); s = await state();
    check('Vollbild zeigt das ausgegraute Muster weiter', s.g === 1 && s.lines === row.lines, JSON.stringify(s));
    await page.click('#fb-exit'); await page.waitForTimeout(300);

    // Intervallwechsel blendet aus
    await page.evaluate(() => __intervals.setMarket('BTCUSDT', '4h')); await page.waitForFunction(() => !__g05.state.busy && __g05.state.interval === '4h'); await page.waitForTimeout(500); s = await state();
    check('Intervallwechsel: ausgegrautes Muster verschwindet', s.ghost === null && s.g === 0, JSON.stringify(s));

    check('Keine Positionen, Alarme oder Lernfälle verändert', await page.evaluate(b => JSON.stringify(__g05.state.positions) === b.positions && JSON.stringify(__g05.state.alarms) === b.alarms && localStorage.getItem('scalpdesk.patknow.v1') === b.learned, snap));
    check('Keine Laufzeitfehler', !errors.length, errors.join(' | '));
    await ctx.close();
  } catch (e) { check('Abbruch', false, e.stack || e.message); }
  finally { await browser.close(); await h.ctl('/walk?on=1'); await h.ctl('/silent?on=0'); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
