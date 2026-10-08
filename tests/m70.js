// G14: tatsächliche Layout-/Farbwahl, DOM-/Daten-/Fokuserhalt und Speicherung.
const h = require('./harness'); let pass = 0, fail = 0;
const check = (name, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${info ? ' — ' + String(info).slice(0, 300) : ''}`); };
(async () => { let browser;
  try {
    await h.setup(); browser = await h.launch(); const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage(), errors = [];
    await context.addInitScript(() => {
      window.g14Resources = { intervals: 0, workers: 0, sockets: 0 };
      const interval = window.setInterval; window.setInterval = function(...args) { g14Resources.intervals++; return interval.apply(this, args); };
      const W = window.Worker, S = window.WebSocket;
      window.Worker = class extends W { constructor(...args) { super(...args); g14Resources.workers++; } };
      window.WebSocket = class extends S { constructor(...args) { super(...args); g14Resources.sockets++; } };
    });
    page.on('pageerror', e => errors.push(e.message)); await page.goto(h.URL_BASE + '/weather-widget-v2.html');
    await page.waitForFunction(() => !!window.__g05 && __g05.state.candles.length > 100 && !!window.__g12?.view.state.confirmed);
    check('Ohne Präferenz echtes Standardlayout mit bestehendem AMOLED', await page.evaluate(() => document.documentElement.dataset.presentation === 'standard' && getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)'));
    await page.click('#pause'); await page.click('#view-menu');
    await page.evaluate(() => {
      window.g14Nodes = ['dash', 'chart', 'pos-form', 'pos-note', 'ki-price-panel', 'ki-signal-panel', 'bot-simulation-panel'].map(id => document.getElementById(id));
      document.getElementById('pos-note').value = 'Noch nicht gespeicherter G14-Test';
      window.g14Data = JSON.stringify([__g05.state.positions, __g05.state.trades, __g05.state.alarms, __g12.view.state.confirmed]);
      window.g14ResourcesBefore = JSON.stringify(g14Resources);
    });
    await page.click('[data-presentation-set=dashboard]');
    check('Dashboard wirklich anders angeordnet: Kontospalte links, Chart rechts', await page.evaluate(() => document.getElementById('acct').getBoundingClientRect().left < document.getElementById('chart-sec').getBoundingClientRect().left));
    check('Wechsel erhält DOM, Entwurf, Fokus und fachliche Originaldaten', await page.evaluate(() => g14Nodes.every(n => n === document.getElementById(n.id)) && document.getElementById('pos-note').value === 'Noch nicht gespeicherter G14-Test' && document.activeElement.dataset.presentationSet === 'dashboard' && g14Data === JSON.stringify([__g05.state.positions, __g05.state.trades, __g05.state.alarms, __g12.view.state.confirmed])));
    check('Keine zusätzlichen Intervalle/Worker/Kurs-Abos durch Layoutwechsel', await page.evaluate(() => g14ResourcesBefore === JSON.stringify(g14Resources)));
    await page.click('[data-theme-set=custom]');
    check('Eigene Farbe: acht Vorschläge, 48px-Schalter, klare zugängliche Auswahl', await page.evaluate(() => document.querySelectorAll('[data-background-color]').length === 8 && [...document.querySelectorAll('.appearance-toggle button,[data-background-color]')].every(b => b.getBoundingClientRect().height >= 48 && b.hasAttribute('aria-pressed'))));
    for (const layout of ['standard', 'dashboard']) {
      await page.click(`[data-presentation-set=${layout}]`);
      for (const mode of ['light', 'dark']) {
        await page.click(`[data-theme-set=${mode}]`);
        check(layout + ' / ' + mode + ': bisherige Oberfläche und Kontrast erhalten', await page.evaluate(mode => document.documentElement.dataset.theme === mode && !document.documentElement.dataset.background && __sdAppearance.contrast(getComputedStyle(document.documentElement).getPropertyValue('--text').trim(), mode === 'light' ? '#eef1f5' : '#000000') >= 4.5, mode));
      }
      await page.click('[data-theme-set=custom]');
      for (const { name, color } of await page.evaluate(() => __sdAppearance.palette)) {
        await page.click(`[data-background-color="${color}"]`);
        check(layout + ' / ' + name + ': tatsächliche Root-/Karten-/Statuskontraste', await page.evaluate(color => {
          const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue('--' + n).trim(), a = __sdAppearance;
          return v('bg') === color && a.contrast(v('text'), color) >= 4.5 && ['surface', 'surface-2', 'field', 'hover', 'up-bg', 'down-bg', 'warn-bg'].every(bg => ['text', 'muted', 'up-text', 'down-text', 'warn-text'].every(fg => a.contrast(v(fg), v(bg)) >= 4.5)) && ['mint', 'buy', 'sell'].every(bg => a.contrast(v(bg), v(bg + '-ink')) >= 4.5);
        }, color));
      }
    }
    const before = await page.evaluate(() => [document.documentElement.style.cssText, localStorage.getItem('scalpdesk.background.v1')]);
    await page.fill('#own-color-hex', '#777777'); await page.click('#own-color-apply');
    check('Kontrastfehler abgewiesen: weder Darstellung noch gespeicherte Farbe geändert', JSON.stringify(before) === JSON.stringify(await page.evaluate(() => [document.documentElement.style.cssText, localStorage.getItem('scalpdesk.background.v1')])) && /Nicht übernommen.*4,5:1/.test(await page.textContent('#own-color-note')));
    check('Lesbare Alternative sichtbar, keine stille Übernahme', await page.isVisible('#own-color-suggest') && await page.getAttribute('#own-color-hex', 'aria-invalid') === 'true');
    await page.click('#own-color-suggest');
    check('Vorschlag erst nach eigenem Klick übernommen und Fehler zurückgesetzt', await page.evaluate(() => __sdAppearance.evaluate(document.getElementById('own-color-hex').value).ok && !document.getElementById('own-color-hex').hasAttribute('aria-invalid') && document.getElementById('own-color-suggest').hidden));
    await page.fill('#own-color-hex', '#gggggg'); await page.keyboard.press('Enter');
    check('Ungültiger Hexcode erklärt, kein Vorschlag/keine Übernahme', /#RRGGBB/.test(await page.textContent('#own-color-note')) && !await page.isVisible('#own-color-suggest'));
    for (const color of ['#ffffff', '#000000']) {
      await page.fill('#own-color-hex', color); await page.keyboard.press('Enter');
      check(color + ': sehr hell/dunkel lesbar, automatische gegensätzliche Schrift', await page.evaluate(color => document.documentElement.dataset.theme === (color === '#ffffff' ? 'light' : 'dark') && getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() === color, color));
    }
    const pickerBefore = await page.evaluate(() => localStorage.getItem('scalpdesk.background.v1'));
    await page.locator('#own-color-picker').evaluate(e => { e.value = '#10251f'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    check('Freier Farbwähler wartet auf Übernehmen und synchronisiert den Hexcode', await page.inputValue('#own-color-hex') === '#10251f' && await page.evaluate(v => localStorage.getItem('scalpdesk.background.v1') === v, pickerBefore));
    await page.click('#own-color-apply'); await page.click('[data-theme-set=light]'); await page.click('[data-theme-set=custom]');
    check('Hell/Dunkel löschen die gemerkte eigene Farbe nicht', await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() === '#10251f'));
    await page.fill('#own-color-hex', '#000000'); await page.click('#own-color-apply');
    const savedColor = await page.evaluate(() => localStorage.getItem('scalpdesk.background.v1'));
    await page.click('[data-presentation-set=standard]'); await page.click('[data-presentation-set=dashboard]');
    check('Hintergrund unabhängig von Layout gespeichert; beide Präferenzen im Backup', await page.evaluate(saved => localStorage.getItem('scalpdesk.background.v1') === saved && __g05.backupPayload().prefs['scalpdesk.presentation.v1'] === 'dashboard' && __g05.backupPayload().prefs['scalpdesk.background.v1'].color === '#000000', savedColor));
    await page.reload(); await page.waitForFunction(() => !!window.__g05);
    check('Neustart stellt Layout/Farbe wieder her, eigene Farbe markiert', await page.evaluate(() => document.documentElement.dataset.presentation === 'dashboard' && document.documentElement.dataset.background === 'custom' && document.querySelector('[data-theme-set=custom]').getAttribute('aria-pressed') === 'true'));
    const p2 = await context.newPage(); await p2.goto(h.URL_BASE + '/weather-widget-v2.html'); await p2.waitForFunction(() => !!window.__g05);
    await page.click('#view-menu'); await page.click('[data-background-color="#e7eef6"]'); await page.click('[data-presentation-set=standard]');
    await p2.waitForFunction(() => document.documentElement.dataset.presentation === 'standard' && getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() === '#e7eef6');
    check('Zweiter Tab übernimmt dieselbe Wahl ohne Rückkopplung und hält lokalen Store aktuell', await p2.evaluate(() => __g05.backupPayload().prefs['scalpdesk.presentation.v1'] === 'standard' && __g05.backupPayload().prefs['scalpdesk.background.v1'].color === '#e7eef6')); await p2.close();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const layout of ['standard', 'dashboard']) {
        await page.click(`[data-presentation-set=${layout}]`);
        check(width + 'px / ' + layout + ': Menü und Seite ohne Überlauf', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.getElementById('view-panel').scrollWidth <= document.getElementById('view-panel').clientWidth + 1));
      }
    }
    await page.focus('[data-presentation-set=standard]'); await page.keyboard.press('Enter');
    check('Layout per Tastatur umschaltbar, Fokus bleibt am Schalter', await page.evaluate(() => document.documentElement.dataset.presentation === 'standard' && document.activeElement.dataset.presentationSet === 'standard'));
    await page.setViewportSize({ width: 320, height: 844 });
    for (const layout of ['standard', 'dashboard']) {
      await page.click(`[data-presentation-set=${layout}]`); await page.click('#view-menu');
      for (const tab of ['chart', 'calc', 'pos', 'ind']) {
        await page.click(`#tabbar [data-tab=${tab}]`);
        check('320px / ' + layout + ' / ' + tab + ': vorhandener Reiter erreichbar, kein Überlauf', await page.evaluate(tab => document.documentElement.dataset.activeTab === tab && document.documentElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll('[data-tabs]')].some(e => e.dataset.tabs.split(' ').includes(tab) && e.getBoundingClientRect().height > 0), tab));
      }
      await page.click('#tabbar [data-tab=chart]'); await page.click('#view-menu');
    }
    await context.close(); const invalid = await browser.newContext(); await invalid.addInitScript(() => { localStorage.setItem('scalpdesk.presentation.v1', '"unbekannt"'); localStorage.setItem('scalpdesk.background.v1', JSON.stringify({ mode: 'custom', color: '#777777' })); });
    const bad = await invalid.newPage(); await bad.goto(h.URL_BASE + '/weather-widget-v2.html'); await bad.waitForFunction(() => !!window.__g05);
    check('Ungültige gespeicherte Präferenzen fallen sicher auf Standard/Dunkel zurück', await bad.evaluate(() => document.documentElement.dataset.presentation === 'standard' && !document.documentElement.dataset.background && document.documentElement.dataset.theme === 'dark'));
    // Tatsächlicher alter Schema-8-Dateiimport: ausdrückliche Anzeigeübernahme bleibt gültig.
    for (const [theme, take] of [['light', true], ['dark', true], ['light', false]]) {
      const legacyContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), legacy = await legacyContext.newPage();
      legacy.on('pageerror', e => errors.push(e.message)); await legacy.goto(h.URL_BASE + '/weather-widget-v2.html'); await legacy.waitForFunction(() => !!window.__g05);
      await legacy.click('#view-menu'); await legacy.click('[data-theme-set=custom]'); await legacy.click('[data-background-color="#f5eddf"]'); await legacy.click('#view-menu');
      const payload = await legacy.evaluate(theme => {
        const p = __g05.backupPayload(); p.appVersion = '3.50.0'; p.prefs = { 'scalpdesk.theme.v1': theme };
        p.positions = [{ id: 'G14_ALTE_SICHERUNG_TEST', symbol: 'BTCUSDT', side: 'long', mode: 'cross', source: 'spot', entry: 60000, qty: .01, leverage: 20, openedAt: Date.now(), updatedAt: Date.now(), ack: { sl: false, tp: false } }]; return p;
      }, theme);
      await legacy.evaluate(() => { if (document.getElementById('data-panel').hidden) document.getElementById('data-toggle').click(); });
      await legacy.locator('#backup-file').setInputFiles({ name: 'g14-alte-sicherung.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)) });
      await legacy.waitForFunction(() => !document.getElementById('sync-preview').hidden);
      check('Alte ' + theme + '-Sicherung: Anzeigeübernahme sichtbar und nicht vorausgewählt', await legacy.locator('#sync-preview .sp-restore input').count() === 1 && !await legacy.locator('#sync-preview .sp-restore input').isChecked());
      if (take) await legacy.check('#sync-preview .sp-restore input');
      await legacy.click('#sync-preview .sp-actions .button.primary-lite');
      if (take) await legacy.waitForFunction(theme => document.documentElement.dataset.theme === theme && !document.documentElement.dataset.background, theme);
      else await legacy.waitForFunction(() => document.getElementById('sync-preview').hidden);
      check('Alte ' + theme + '-Wahl ' + (take ? 'ausdrücklich übernommen' : 'nicht übernommen') + ': Farbe/Position wie gewählt, eigene Farbe gemerkt', await legacy.evaluate(([theme, take]) => __g05.state.positions.length === 1 && (take ? !document.documentElement.dataset.background && document.documentElement.dataset.theme === theme : document.documentElement.dataset.background === 'custom') && __g05.backupPayload().prefs['scalpdesk.background.v1'].color === '#f5eddf', [theme, take]));
      await legacyContext.close();
    }
    check('Keine JavaScript-Fehler im bestehenden Programm', !errors.length, errors.join('; '));
  } finally { await browser?.close(); await h.teardown(); }
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
