// POC-Preis, tatsächliche sichtbare Spanne und unabhängiges Ausblenden bis zur nächsten Minute.
const h = require('./harness');
const fs = require('node:fs');
const { volumeProfile } = require('../shared/volume-profile.mjs');
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + JSON.stringify(detail).slice(0, 400) : ''}`); };
const state = page => page.evaluate(() => {
  const tag = document.querySelector('#chart .poc-tag'), line = document.querySelector('#chart .poc-line'), G = __chartDetail.geometry;
  return { text: tag?.querySelector('.poc-price')?.textContent, period: tag?.querySelector('.poc-period')?.textContent, minutes: Number(tag?.dataset.minutes), price: Number(tag?.dataset.price), line: !!line, lineY: line && Number(line.getAttribute('y1')), last: !!document.querySelector('#chart .last-tag'), title: tag?.querySelector('title')?.textContent, data: G?.data, min: G?.min, max: G?.max, alarms: __g05.state.alarms.length, selected: __g05.state.selected };
});
const pause = async page => { if (!await page.evaluate(() => __g05.state.paused)) await page.click('#pause'); await page.locator('#chart').scrollIntoViewIfNeeded(); };
const ready = async page => { await page.locator('#chart').scrollIntoViewIfNeeded(); await page.waitForSelector('#chart .poc-tag'); };
const point = async (page, selector = '.poc-price') => page.locator('#chart ' + selector).evaluate(e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });

(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch({ workspace: 'fresh' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), page = await ctx.newPage(), errors = [];
    h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html');
    await page.waitForFunction(() => window.__g05?.state.candles.length > 100 && !__g05.state.busy);
    await ready(page); await pause(page);
    const initial = await state(page), expected = volumeProfile(initial.data), nf = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    check('POC-Beschriftung enthält den tatsächlich berechneten Preis mit USDT', Math.abs(initial.price - expected.poc) < 1e-9 && initial.text === `POC ${nf.format(expected.poc)} USDT`, initial.text);
    const span = Math.round((initial.data.at(-1).closeTime + 1 - initial.data[0].time) / 60000);
    check('Bezugszeitraum entspricht allen sichtbaren Kerzen, nicht nur dem Kerzenintervall', initial.minutes === span && initial.period === 'Sichtbar: 1 Std. 20 Min.', initial.period);
    check('Erklärung nennt konkrete Zeitgrenzen, Näherung und Ausblenden', /\d{2}\.\d{2}\.\d{4}/.test(initial.title) && initial.title.includes('Näherung') && initial.title.includes('nächsten Minute'));

    const fixed = Date.now(); await page.clock.setFixedTime(new Date(fixed));
    const p = await point(page); await page.touchscreen.tap(p.x, p.y);
    await page.waitForFunction(() => !document.querySelector('#chart .poc-tag'));
    const hidden = await state(page);
    check('Antippen blendet POC-Preis und Zeitraum aus, die POC-Linie bleibt', !hidden.text && hidden.line && hidden.lineY === initial.lineY);
    check('Live-Kursschild, Preisachse und Alarme bleiben unverändert', hidden.last === initial.last && hidden.min === initial.min && hidden.max === initial.max && hidden.alarms === initial.alarms);
    check('Antippen öffnet keinen Alarm und wählt keine Kerze aus', !await page.locator('#qa-dialog').evaluate(e => e.open) && hidden.selected === initial.selected);
    await page.click('#zoom-out'); await page.locator('#chart').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    check('Auch nach Zoomen und Neuzeichnen bleibt die Beschriftung in derselben Minute aus', !await page.locator('#chart .poc-tag').count() && await page.locator('#chart .poc-line').count() === 1);
    await page.clock.setFixedTime(new Date(fixed + 60000));
    await page.waitForSelector('#chart .poc-tag', { timeout: 4000 });
    const after = await state(page);
    check('Nächste Minute: Beschriftung kommt mit dem neuen sichtbaren Zeitraum zurück', !!after.text && after.minutes > initial.minutes);
    await page.locator('#chart .poc-tag').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.querySelector('#chart .poc-tag'));
    check('Beschriftung lässt sich auch per Tastatur ausblenden', !await page.locator('#chart .poc-tag').count());
    await page.clock.setFixedTime(new Date(fixed + 120000)); await ready(page);

    fs.mkdirSync(__dirname + '/out', { recursive: true });
    for (const width of [320, 390, 820, 1440]) {
      await page.setViewportSize({ width, height: width >= 820 ? 1100 : 844 });
      await page.locator('#chart').scrollIntoViewIfNeeded(); await page.waitForTimeout(350); await ready(page);
      const fit = await page.locator('#chart .poc-tag').evaluate(el => {
        const b = el.getBoundingClientRect(), r = document.getElementById('chart').getBoundingClientRect();
        return { x: b.x, y: b.y, width: b.width, height: b.height, fits: b.x >= r.x - 1 && b.right <= r.right + 1 && b.y >= r.y - 1 && b.bottom <= r.bottom + 1 };
      });
      check(`${width}px: Preis und Zeitraum bleiben innerhalb des Charts, Tippfläche mindestens 44px`, fit.fits && fit.height >= 43.5, fit);
      await page.locator('#chart').screenshot({ path: `${__dirname}/out/poc-${width}.png` });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    // Die echten Markt-/Detail-Wechsel laufen wieder mit der tatsächlichen Uhr und aktiven Abrufen.
    await page.clock.setFixedTime(new Date());
    await page.click('#pause');
    await page.click('#zoom-reset');
    await page.evaluate(() => __intervals.setMarket('BTCUSDT', '1h'));
    await page.waitForFunction(() => __g05.state.interval === '1h' && !__g05.state.busy && __g05.state.loadedSymbol === 'BTCUSDT' && __g05.state.candles.length > 100);
    await ready(page); await page.waitForSelector('#chart .poc-tag[data-interval="1h"]');
    let s = await state(page);
    check('Stundenchart nennt die gesamte sichtbare Spanne statt fälschlich „letzte Stunde“', s.minutes === 80 * 60 && s.period === 'Sichtbar: 3 Tage 8 Std.', s.period);
    await page.selectOption('#chart-detail-resolution', '5m');
    await page.waitForFunction(() => __chartDetail.state.iv === '5m' && !__chartDetail.state.busy && !!document.querySelector('#chart .detail-candles canvas'));
    await ready(page); await pause(page); s = await state(page);
    const detailSpan = Math.round((s.data.at(-1).closeTime + 1 - s.data[0].time) / 60000), detailProfile = volumeProfile(s.data);
    check('Detail-Kerzen: Preis und Zeitspanne stammen aus derselben angezeigten Reihe', s.minutes === detailSpan && Math.abs(s.price - detailProfile.poc) < 1e-9, s.period);
    // Ausblenden bleibt vom Live-Kursschild getrennt und gilt nicht für einen anderen Zeitrahmen.
    const q = await point(page); await page.touchscreen.tap(q.x, q.y); await page.waitForFunction(() => !document.querySelector('#chart .poc-tag'));
    await page.selectOption('#chart-detail-resolution', ''); await ready(page);
    check('Wechsel der Kerzen-Auflösung zeigt den POC des neuen Ausschnitts sofort', !!(await state(page)).text);
    // Wischen beginnt ausdrücklich auf der Beschriftung: daraus darf kein Ausblenden und keine blockierte Geste werden.
    const drag = await point(page), panBefore = await page.evaluate(() => __g05.state.pan), cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: drag.x, y: drag.y, id: 1 }] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: drag.x + i * 12, y: drag.y, id: 1 }] });
      await page.waitForTimeout(20);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(900);
    check('Wischen ab der POC-Beschriftung blättert normal und blendet sie nicht aus', await page.evaluate(p => __g05.state.pan > p && !!document.querySelector('#chart .poc-tag'), panBefore));
    check('Keine Skriptfehler', errors.length === 0, errors);
    await ctx.close();
  } finally { await browser.close(); await h.teardown(); }
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('Abbruch:', e); process.exitCode = 1; });
