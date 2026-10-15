// 3.71.5: Alarmglocke als Abstecher – native Bereiche, echte Scrollwege und schnelles Zurücktippen.
const h = require('./harness');
const results = [], check = (name, ok, detail = '') => { results.push(!!ok); console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const real = errors => errors.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|net::ERR/.test(e));
const snapshot = page => page.evaluate(() => ({
  view: document.documentElement.dataset.workspaceView, tab: document.documentElement.dataset.activeTab,
  x: scrollX, y: scrollY, watch: document.getElementById('workspace-watch').open,
  columns: [...document.querySelectorAll('.col-input, .col-control, .col-side')].map(e => [e.scrollLeft, e.scrollTop]),
  alarms: JSON.stringify(__g05.state.alarms), pressed: document.getElementById('lb-alarm').getAttribute('aria-pressed'),
  label: document.getElementById('lb-alarm').getAttribute('aria-label')
}));
const same = (a, b) => a.view === b.view && a.tab === b.tab && a.watch === b.watch && Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1 && a.columns.every((v, i) => v.every((n, j) => Math.abs(n - b.columns[i][j]) <= 1));
(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch({ workspace: 'fresh' });
  try {
    for (const [width, touch] of [[320, true], [390, true], [768, true], [1440, false]]) {
      const ctx = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: touch, isMobile: touch && width < 600 }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
      await ctx.addInitScript(() => { const now = Date.now(); localStorage.setItem('scalpdesk.alarms.v1', JSON.stringify([
        { id: 'return114', symbol: 'BTCUSDT', price: 1e9, dir: 'above', source: 'spot', note: 'Rücksprungtest', createdAt: now, armedAt: now, triggeredAt: null }
      ])); });
      await page.goto(h.URL_BASE + '/weather-widget-v2.html');
      await page.waitForFunction(() => document.getElementById('lb-alarm').textContent === '🔔 1');
      const tap = async () => {
        // Locator.tap()/focus() scrollt im Test selbst zum ursprünglichen Platz des Sticky-Buttons.
        // Echten Fingertipp an seiner sichtbaren Stelle verwenden; Tastaturfokus ohne Test-Scroll.
        if (touch) { const b = await page.locator('#lb-alarm').boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); }
        else { await page.evaluate(() => document.getElementById('lb-alarm').focus({ preventScroll: true })); await page.keyboard.press('Enter'); }
      };
      for (const view of ['chart', 'pos', 'settings', 'ind']) {
        await page.click(`[data-workspace-target="${view}"]`); await page.waitForTimeout(500);
        await page.evaluate(view => {
          // Abweichende Klappzustände: Chart-Vorauswahl zu, Analysen-Vorauswahl offen.
          document.getElementById('workspace-watch').open = view === 'ind';
          if (view === 'chart') document.getElementById('workspace-chart-tools').open = true;
          if (view === 'pos') for (const d of document.querySelectorAll('details.acct, details.history, details.pos-over')) d.open = true;
          if (view === 'settings') document.getElementById('workspace-appearance').open = true;
        }, view);
        await page.waitForTimeout(400);
        await page.evaluate(() => { for (const e of document.querySelectorAll('.col-input, .col-control, .col-side')) e.scrollTop = 120; window.scrollTo({ top: 347, behavior: 'instant' }); });
        await page.waitForTimeout(300);
        const before = await snapshot(page), tag = `${width}px ${view}`;
        check(`${tag}: Ausgangsansicht ist gescrollt`, before.view === view && before.y > 100, JSON.stringify(before));
        await tap(); await page.waitForTimeout(700);
        const opened = await snapshot(page);
        check(`${tag}: erster Tipp öffnet Alarme mit Rücksprung-Beschriftung`, opened.view === 'ind' && opened.pressed === 'true' && /Zur vorherigen Ansicht zurück/.test(opened.label) && await page.locator('[data-alarm="return114"]').isVisible());
        await page.evaluate(() => window.scrollBy({ top: 123, behavior: 'instant' })); await page.waitForTimeout(300);
        await tap(); await page.waitForTimeout(500);
        const after = await snapshot(page);
        check(`${tag}: zweiter Tipp stellt Ansicht, Klappzustand und Scrollposition wieder her`, same(before, after), JSON.stringify({ before, after }));
        check(`${tag}: Rücksprung beendet, keine Alarme oder Formulare geändert`, after.pressed === 'false' && /Alarme öffnen/.test(after.label) && before.alarms === after.alarms && await page.locator('#alarm-form').isHidden());
        // Zwei Klicks noch vor dem ersten Scroll-Frame; keine nachlaufende Alarm-Animation.
        await page.evaluate(() => { const b = document.getElementById('lb-alarm'); b.click(); b.click(); });
        await page.waitForTimeout(600);
        check(`${tag}: auch schnelles zweimaliges Tippen bleibt an der Ausgangsstelle`, same(after, await snapshot(page)));
      }
      await tap(); await page.waitForTimeout(500);
      await page.click('[data-goto="chart-sec"]'); await page.waitForTimeout(600);
      check(`${width}px: bewusste andere Navigation verwirft den alten Rücksprung`, (await snapshot(page)).pressed === 'false');
      const latest = await snapshot(page);
      await tap(); await page.waitForTimeout(600);
      // Leertaste muss denselben Rückweg wie Touch und Enter auslösen.
      await page.evaluate(() => document.getElementById('lb-alarm').focus({ preventScroll: true })); await page.keyboard.press('Space'); await page.waitForTimeout(500);
      check(`${width}px: neuer Abstecher kehrt per Leertaste zur zuletzt gewählten Ansicht zurück`, same(latest, await snapshot(page)));
      check(`${width}px: keine JavaScript-Fehler oder seitlicher Überlauf`, !real(errors).length && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), real(errors).join(' | '));
      await ctx.close();
    }
  } catch (e) { check('Abbruch', false, e.stack || e.message); }
  finally { await browser.close(); await h.ctl('/walk?on=1'); await h.teardown(); }
  const passed = results.filter(Boolean).length; console.log(`\n${passed}/${results.length} bestanden`); process.exitCode = passed === results.length ? 0 : 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
