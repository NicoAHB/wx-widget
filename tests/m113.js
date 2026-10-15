// 3.71.4: Glocke mit Alarmzahl öffnet die vorhandene Alarmliste – native Bereichsnavigation, Touch und Tastatur.
const h = require('./harness');
const results = [], check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const real = errors => errors.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|net::ERR/.test(e));
(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch({ workspace: 'fresh' });
  try {
    for (const [width, touch] of [[320, true], [390, true], [768, true], [1440, false]]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: touch, isMobile: touch && width < 600 }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
      await ctx.addInitScript(() => { const now = Date.now(); localStorage.setItem('scalpdesk.alarms.v1', JSON.stringify([
        { id: 'active113', symbol: 'BTCUSDT', price: 1e9, dir: 'above', source: 'spot', note: 'Aktiver Testalarm', createdAt: now, armedAt: now, triggeredAt: null },
        { id: 'done113', symbol: 'ETHUSDT', price: 1, dir: 'above', source: 'spot', note: 'Bereits ausgelöst', createdAt: now, armedAt: now, triggeredAt: now, triggerPrice: 1 }
      ])); });
      await page.goto(h.URL_BASE + '/weather-widget-v2.html');
      await page.waitForFunction(() => document.getElementById('lb-alarm').textContent === '🔔 1');
      const before = await page.evaluate(() => ({ tag: document.getElementById('lb-alarm').tagName, label: document.getElementById('lb-alarm').getAttribute('aria-label'), hidden: getComputedStyle(document.getElementById('alarms')).display === 'none', alarms: JSON.stringify(__g05.state.alarms) }));
      check(`${width}px: echte Schaltfläche, aktive Zahl und verständliche Beschriftung`, before.tag === 'BUTTON' && /1 aktiver Kurs-Alarm.*Alarme öffnen/.test(before.label));
      check(`${width}px: Alarme liegen zuerst in einem anderen Bereich`, before.hidden);
      const box = await page.locator('#lb-alarm').boundingBox();
      check(`${width}px: Glocke erreichbar und auf Touch mindestens 44 × 44 px`, box && box.x >= 0 && box.x + box.width <= width + 1 && (!touch || box.width >= 44 && box.height >= 44), JSON.stringify(box));
      if (touch) await page.tap('#lb-alarm'); else { await page.focus('#lb-alarm'); await page.keyboard.press('Enter'); }
      await page.waitForTimeout(900);
      const after = await page.evaluate(() => { const r = document.querySelector('[data-alarm="active113"]').getBoundingClientRect(), bar = document.getElementById('livebar').getBoundingClientRect(); return { visible: getComputedStyle(document.getElementById('alarms')).display !== 'none', top: r.top, bottom: bar.bottom, vh: innerHeight, form: document.getElementById('alarm-form').hidden, alarms: JSON.stringify(__g05.state.alarms), overflow: document.documentElement.scrollWidth > innerWidth + 1 }; });
      check(`${width}px: Antippen/Enter zeigt die eingestellten Alarme im sichtbaren Bereich`, after.visible && after.top >= after.bottom - 1 && after.top < after.vh - 40, JSON.stringify(after));
      check(`${width}px: Navigation ändert keine Alarme und öffnet kein neues Formular`, after.alarms === before.alarms && after.form && !after.overflow);
      if (!touch) {
        await page.click('[data-goto="chart-sec"]'); await page.waitForTimeout(400); await page.focus('#lb-alarm'); await page.keyboard.press('Space'); await page.waitForTimeout(700);
        check('Tastatur: auch Leertaste öffnet die Alarmliste', await page.locator('[data-alarm="active113"]').isVisible());
      }
      await page.locator('[data-alarm="active113"] .x').click();
      await page.waitForFunction(() => document.getElementById('lb-alarm').hidden);
      check(`${width}px: ohne aktiven Alarm verschwindet die Glocke, ausgelöster Alarm bleibt`, await page.locator('[data-alarm="done113"]').count() === 1 && !await page.locator('#lb-alarm').isVisible());
      check(`${width}px: keine JavaScript-Fehler`, !real(errors).length, real(errors).join(' | '));
      await ctx.close();
    }
  } catch (e) { check('Abbruch', false, e.stack || e.message); }
  finally { await browser.close(); await h.ctl('/walk?on=1'); await h.teardown(); }
  const passed = results.filter(Boolean).length; console.log(`\n${passed}/${results.length} bestanden`); process.exitCode = passed === results.length ? 0 : 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
