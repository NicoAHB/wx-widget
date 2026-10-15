// 3.74.0: Darstellung auf Handy/iPad, CSS-only-Regler, statischer Hintergrund, deckender Chart, Speicherung und Reset.
const h = require('./harness'), path = require('path'), fs = require('fs');
const out = path.join(__dirname, 'out', 'darstellung'); fs.mkdirSync(out, { recursive: true });
let pass = 0, fail = 0;
const check = (name, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${!ok ? ' — ' + JSON.stringify(info).slice(0, 600) : ''}`); };
(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0'); await h.ctl('/tgreset');
  const browser = await h.launch({ workspace: 'fresh' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => window.__panelAppearance && window.__marketRadar && __g05.state.candles.length > 100, null, { timeout: 25000 });
    check('Standardwerte: aktiv, 40 % Transparenz, 12px Blur, 12 % Rand, beide Dekorationen an', await page.evaluate(() => { const s = __panelAppearance.state; return s.enabled && s.transparency === 40 && s.blur === 12 && s.border === 12 && s.circles && s.lines && s.background === 'current'; }));
    check('Eine feste SVG-Ebene hinter den Inhalten, ohne Pointer-Eingriff oder Animation', await page.evaluate(() => { const n = document.getElementById('display-backdrop'), c = getComputedStyle(n); return document.querySelectorAll('#display-backdrop').length === 1 && n.getAttribute('preserveAspectRatio') === 'xMidYMid slice' && c.position === 'fixed' && c.zIndex === '-1' && c.pointerEvents === 'none' && c.animationName === 'none' && n.querySelectorAll('circle').length === 3 && n.querySelector('polyline').getAttribute('stroke-width') === '4'; }));
    check('Große Panels bekommen Glas, jede Coin-Karte bleibt ohne eigenen Blur', await page.evaluate(() => document.querySelectorAll('.appearance-panel').length >= 6 && [...document.querySelectorAll('.wl-tile')].every(n => getComputedStyle(n).backdropFilter === 'none') && getComputedStyle(document.getElementById('workspace-watch')).backgroundColor === 'rgba(0, 0, 0, 0.6)'));
    check('Großer Chart bleibt deckend, filterfrei und außerhalb der Glasmarkierung', await page.evaluate(() => { const n = document.getElementById('chart-sec'), c = getComputedStyle(n); return !n.classList.contains('appearance-panel') && !n.querySelector('.appearance-panel') && c.backdropFilter === 'none' && /^rgb\(/.test(c.backgroundColor) && !n.contains(document.getElementById('display-backdrop')); }));
    check('Globale Darstellung schließt auch Anleitungen, Verbindung und GitHub-Fenster ein', await page.evaluate(() => ['doc-viewer', 'connection-info', 'github-sync-dialog'].every(id => document.getElementById(id).classList.contains('appearance-panel'))));
    check('Auch später erzeugte Chart-Informationsfenster übernehmen die globale Darstellung', await page.evaluate(() => ['positioning-dialog', 'pat-overview-info'].every(id => { const n = document.getElementById(id), c = getComputedStyle(n); return c.backgroundColor === 'rgba(0, 0, 0, 0.6)' && c.backdropFilter === 'blur(12px)'; })));
    check('Grüne Auswahlumrandung bleibt erhalten, neutrale Coin-Ränder fein mit 8 %', await page.evaluate(() => { const normal = document.querySelector('.wl-tile:not([aria-current=true])'), active = document.querySelector('.wl-tile[aria-current=true]'); return getComputedStyle(normal).borderTopColor === 'rgba(255, 255, 255, 0.08)' && getComputedStyle(active).borderTopColor !== getComputedStyle(normal).borderTopColor; }));
    const controls = await page.evaluate(() => Object.fromEntries(['pause', 'symbol', 'lb-alarm'].map(id => { const e = document.getElementById(id), c = getComputedStyle(e); return [id, [c.color, c.backgroundColor, c.borderTopColor, c.padding, c.fontSize]]; })));
    await page.click('[data-workspace-target="settings"]'); await page.locator('#workspace-appearance > summary').tap();
    check('Zu finden unter Einstellungen → Darstellung & App → Darstellung', await page.locator('#panel-appearance-settings').isVisible());
    const set = async (key, value) => { await page.locator('#panel-style-' + key).evaluate((n, value) => { n.value = String(value); n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); }, value); await page.waitForTimeout(60); };
    await set('transparency', 70);
    check('70 % Transparenz wirkt sofort als Alpha 0,3 mit aktuellem Wert daneben', await page.evaluate(() => getComputedStyle(document.getElementById('workspace-settings')).backgroundColor === 'rgba(0, 0, 0, 0.3)' && document.querySelector('#panel-style-transparency').previousElementSibling.querySelector('output').value === '70 %'));
    await set('transparency', 0);
    check('0 % Transparenz ergibt vollständig deckende Panels', await page.evaluate(() => getComputedStyle(document.getElementById('workspace-settings')).backgroundColor === 'rgb(0, 0, 0)'));
    await set('transparency', 40); await set('blur', 0);
    check('0px Blur ist wirklich aus, kein leerer Blur-Layer', await page.evaluate(() => getComputedStyle(document.getElementById('workspace-settings')).backdropFilter === 'none' && document.documentElement.style.getPropertyValue('--panel-backdrop') === 'none'));
    await set('blur', 24);
    check('24px Blur sowie iPhone-Präfix sind im Stylesheet vorgesehen', await page.evaluate(() => getComputedStyle(document.getElementById('workspace-settings')).backdropFilter === 'blur(24px)' && [...document.querySelectorAll('style')].some(s => s.textContent.includes('-webkit-backdrop-filter:var(--panel-backdrop)'))));
    const before = await page.locator('#workspace-settings').boundingBox(); await set('border', 0); const after = await page.locator('#workspace-settings').boundingBox();
    check('0 % Rand bleibt 1px breit, unsichtbar und ohne Größenänderung', await page.evaluate(() => { const c = getComputedStyle(document.getElementById('workspace-settings')); return c.borderTopWidth === '1px' && c.borderTopColor === 'rgba(255, 255, 255, 0)'; }) && before.width === after.width && before.height === after.height, { before, after });
    await set('border', 40);
    check('40 % Rand entspricht rgba Weiß mit Alpha 0,4', await page.evaluate(() => getComputedStyle(document.getElementById('workspace-settings')).borderTopColor === 'rgba(255, 255, 255, 0.4)'));
    const range = page.locator('#panel-style-transparency'); await range.scrollIntoViewIfNeeded(); const box = await range.boundingBox(); await range.tap({ position: { x: box.width - 12, y: box.height / 2 } });
    check('Echte Touch-Bedienung des Reglers mit 5er-Schritten und sofortigem Output', await range.evaluate(n => Number(n.value) >= 60 && Number(n.value) % 5 === 0 && n.previousElementSibling.querySelector('output').value === n.value + ' %'));
    await page.uncheck('#panel-style-circles');
    check('Kreise aus lässt nur die Linie sichtbar', await page.evaluate(() => getComputedStyle(document.getElementById('display-circles')).display === 'none' && getComputedStyle(document.getElementById('display-lines')).display !== 'none'));
    await page.uncheck('#panel-style-lines');
    check('Beide aus: ausschließlich einfarbiger SVG-Hintergrund', await page.evaluate(() => getComputedStyle(document.getElementById('display-circles')).display === 'none' && getComputedStyle(document.getElementById('display-lines')).display === 'none'));
    for (const color of ['#5a2d52', '#1f3a6b', '#0f5560', '#6b1f35']) { await page.selectOption('#panel-style-background', color); check(`Hintergrund ${color} sofort übernommen`, await page.evaluate(color => document.documentElement.style.getPropertyValue('--display-bg') === color, color)); }
    await page.selectOption('#panel-style-background', 'custom'); await page.locator('#panel-style-custom').evaluate(n => { n.value = '#123456'; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); });
    check('Eigene Farbe funktioniert ohne Änderung des bisherigen Grunddesigns', await page.evaluate(() => __panelAppearance.state.background === '#123456' && document.documentElement.dataset.theme === 'dark'));
    await page.check('#panel-style-circles'); await page.check('#panel-style-lines');
    await page.uncheck('#panel-style-enabled');
    check('Hauptschalter aus: ursprüngliche Flächen, kein Blur, keine Dekorationen; Werte bleiben gespeichert', await page.evaluate(() => document.documentElement.dataset.panelStyle === 'original' && getComputedStyle(document.getElementById('display-backdrop')).display === 'none' && getComputedStyle(document.getElementById('workspace-settings')).backdropFilter === 'none' && __panelAppearance.state.blur === 24 && __panelAppearance.state.background === '#123456'));
    await page.check('#panel-style-enabled');
    check('Hauptschalter an: alle bisherigen Einstellungen wieder aktiv, Chart weiterhin deckend', await page.evaluate(() => document.documentElement.dataset.panelStyle === 'glass' && getComputedStyle(document.getElementById('workspace-settings')).backdropFilter === 'blur(24px)' && getComputedStyle(document.getElementById('chart-sec')).backdropFilter === 'none' && /^rgb\(/.test(getComputedStyle(document.getElementById('chart-sec')).backgroundColor)));
    const afterControls = await page.evaluate(() => Object.fromEntries(['pause', 'symbol', 'lb-alarm'].map(id => { const e = document.getElementById(id), c = getComputedStyle(e); return [id, [c.color, c.backgroundColor, c.borderTopColor, c.padding, c.fontSize]]; })));
    check('Vorhandene Buttons und Eingabefelder bleiben unverändert', JSON.stringify(controls) === JSON.stringify(afterControls), { controls, afterControls });
    await page.click('[data-theme-set=light]');
    check('Helles Grunddesign: Glas-Beschriftungen und Werte bleiben hell, deckende Felder behalten dunkle Schrift', await page.evaluate(() => {
      const colors = ['.pa-range output', '.pa-color-label', '.pa-switch', '#panel-style-reset'].map(s => getComputedStyle(document.querySelector(s)).color);
      return colors.every(c => /^rgb\((?:255, 255, 255|224, 230, 237)\)$/.test(c)) && getComputedStyle(document.getElementById('panel-style-background')).color === getComputedStyle(document.documentElement).getPropertyValue('--pa-theme-text').trim().replace('#121a23', 'rgb(18, 26, 35)');
    }));
    check('Anleitung im hellen Grunddesign: deckender Kopf bleibt mit dunkler Schrift lesbar', await page.evaluate(() => { const n = document.querySelector('#doc-viewer .sheet-head'); return getComputedStyle(n).backgroundColor === 'rgb(255, 255, 255)' && getComputedStyle(n.querySelector('h2')).color === 'rgb(18, 26, 35)'; }));
    await page.click('[data-theme-set=dark]');
    check('Darstellung enthält den gewünschten Glas-Hinweis und drei Regler', await page.evaluate(() => document.getElementById('panel-appearance-settings').textContent.includes('Der Glas-Effekt ist nur sichtbar, wenn etwas hinter dem Panel liegt (Kreise, Linien oder Chart).') && document.querySelectorAll('#panel-appearance-settings input[type=range]').length === 3));
    for (const width of [320, 390, 768, 820]) {
      await page.setViewportSize({ width, height: width >= 768 ? 1180 : 900 });
      const g = await page.locator('#panel-appearance-settings').evaluate(n => { const r = n.getBoundingClientRect(), fields = [...n.querySelectorAll('input[type=range],select,button,.pa-switch,.pa-own-color')].filter(e => getComputedStyle(e).display !== 'none').map(e => e.getBoundingClientRect()); return { width: innerWidth, overflow: document.documentElement.scrollWidth - innerWidth, inner: n.scrollWidth - n.clientWidth, inside: fields.every(b => b.left >= r.left - 1 && b.right <= r.right + 1), touch: fields.every(b => b.height >= 44) }; });
      check(`${width}px Hochformat: alle Regler/Schalter ≥44px und ohne Überlauf`, g.inside && g.touch && g.inner <= 1 && g.overflow <= 1, g);
      if ([390, 768].includes(width)) await page.locator('#panel-appearance-settings').screenshot({ path: path.join(out, `darstellung-${width}.png`) });
    }
    await page.reload(); await page.waitForFunction(() => window.__panelAppearance);
    check('Neustart stellt alle Werte und Dekorationen aus localStorage wieder her', await page.evaluate(() => { const s = __panelAppearance.state; return s.enabled && s.blur === 24 && s.border === 40 && s.circles && s.lines && s.background === '#123456' && document.documentElement.style.getPropertyValue('--panel-blur') === '24px'; }));
    const remote = await ctx.newPage(); await remote.goto(h.URL_BASE + '/status-check.html'); await remote.evaluate(() => localStorage.setItem('scalpdesk.panel-style.v1', JSON.stringify({ enabled: false, transparency: 55, blur: 2, border: 8, circles: false, lines: false, background: '#1f3a6b' })));
    await page.waitForFunction(() => __panelAppearance.state.transparency === 55 && !__panelAppearance.state.enabled && document.documentElement.dataset.panelStyle === 'original');
    check('Zweiter Tab übernimmt Darstellung ohne Neuzeichnen der Live-Daten', await page.evaluate(() => document.documentElement.dataset.panelStyle === 'original' && __panelAppearance.state.background === '#1f3a6b')); await remote.close();
    await page.locator('#workspace-appearance > summary').evaluate(n => { if (!n.parentElement.open) n.click(); });
    await page.locator('#panel-style-reset').tap();
    check('Zurücksetzen stellt exakt alle Standards samt Hauptschalter und Aktuell her', await page.evaluate(() => JSON.stringify(__panelAppearance.state) === JSON.stringify({ v: 1, enabled: true, transparency: 40, blur: 12, border: 12, circles: true, lines: true, background: 'current' })));
    check('Sicherung enthält Darstellung ohne Zugangsdaten', await page.evaluate(() => __g05.backupPayload().prefs['scalpdesk.panel-style.v1']?.transparency === 40));
    await page.click('[data-workspace-target="chart"]'); await page.locator('#chart-sec').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(out, 'chart-ohne-dekoration.png') });
    check('Live-Chart, Markt und Kontodaten weiterhin vorhanden, keine Telegram-Testnachricht', await page.evaluate(() => __g05.state.symbol === 'BTCUSDT' && __g05.state.candles.length > 100 && !__g05.state.positions.length && !__g05.state.trades.length) && !(await h.ctl('/sent')).length);
    check('Keine JavaScript-Fehler', !errors.length, errors); await ctx.close();
  } catch (e) { check('Abbruch', false, e.stack || e.message); }
  finally { await browser.close(); await h.teardown(); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})();
