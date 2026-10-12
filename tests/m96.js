// Native Geräteansichten: kein Sammelraster der älteren isolierten Widgettests.
const h = require('./harness'); let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${!ok && detail ? ' ' + JSON.stringify(detail) : ''}`); };
const iphoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const ipadUA = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const macUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
const pcUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36';
const profiles = [
  { name: 'iPhone 390', width: 390, height: 844, sw: 390, sh: 844, touch: true, ua: iphoneUA, platform: 'iPhone', expected: 'standard', resize: { width: 844, height: 390 } },
  { name: 'iPhone 320', width: 320, height: 568, sw: 320, sh: 568, touch: true, ua: iphoneUA, platform: 'iPhone', expected: 'standard', resize: { width: 568, height: 320 } },
  { name: 'iPad', width: 768, height: 1024, sw: 768, sh: 1024, touch: true, ua: ipadUA, platform: 'iPad', expected: 'dashboard', resize: { width: 1024, height: 768 } },
  { name: 'iPad Desktopkennung/Split View', width: 390, height: 844, sw: 1024, sh: 1366, touch: true, ua: macUA, platform: 'MacIntel', expected: 'dashboard', resize: { width: 1194, height: 834 } },
  { name: 'PC', width: 1440, height: 1000, sw: 1920, sh: 1080, touch: false, ua: pcUA, platform: 'Win32', expected: 'dashboard', resize: { width: 390, height: 844 } },
  { name: 'PC mit Touch', width: 1280, height: 900, sw: 1920, sh: 1080, touch: true, ua: pcUA, platform: 'Win32', expected: 'dashboard', resize: { width: 390, height: 844 } }
];
(async () => { let browser;
  try {
    await h.setup(); await h.ctl('/walk?on=0'); browser = await h.launch({ workspace: 'fresh' });
    const sent = (await h.ctl('/sent')).length;
    for (const profile of profiles) {
      const ctx = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, screen: { width: profile.sw, height: profile.sh }, userAgent: profile.ua, hasTouch: profile.touch, isMobile: profile.touch && profile.platform !== 'Win32', serviceWorkers: 'block' });
      await ctx.addInitScript(p => {
        Object.defineProperty(navigator, 'platform', { value: p.platform }); Object.defineProperty(navigator, 'maxTouchPoints', { value: p.touch ? 5 : 0 });
        if (localStorage.getItem('device-fixture-seeded')) return;
        localStorage.setItem('device-fixture-seeded', '1');
        localStorage.setItem('scalpdesk.presentation.v1', JSON.stringify(p.expected === 'standard' ? 'dashboard' : 'standard'));
        localStorage.setItem('scalpdesk.layout.v1', JSON.stringify(p.touch ? 'desktop' : 'tablet'));
        localStorage.setItem('scalpdesk.workspace.v1', JSON.stringify({ v: 1, mode: 'all', view: 'pos', folds: { 'workspace-orderflow': true, 'workspace-chart-tools': true } }));
        localStorage.setItem('scalpdesk.background.v1', JSON.stringify({ mode: 'custom', color: '#102133' }));
        localStorage.setItem('scalpdesk.theme.v1', '"dark"');
      }, profile);
      const page = await ctx.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => !!window.__g05 && !!document.querySelector('[data-workspace-target]'));
      const prefix = profile.name + ': ';
      check(prefix + 'richtige Geräteansicht trotz gegenteiliger Altpräferenz', await page.evaluate(p => document.documentElement.dataset.workspace === 'focus' && document.documentElement.dataset.presentation === p.expected, profile));
      check(prefix + 'alter Bereich und Klappzustände erhalten; Gesamtansicht ersetzt', await page.evaluate(() => document.documentElement.dataset.workspaceView === 'pos' && ['workspace-orderflow', 'workspace-chart-tools'].every(id => document.getElementById(id).open) && JSON.parse(localStorage.getItem('scalpdesk.workspace.v1')).mode === 'focus'));
      check(prefix + 'gespeicherte eigene Hintergrundfarbe erhalten', await page.evaluate(() => document.documentElement.dataset.background === 'custom' && getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() === '#102133'));
      check(prefix + 'nur vier Arbeitsbereiche, keine überholten Layout-Schalter', await page.evaluate(() => document.querySelectorAll('[data-workspace-target]').length === 4 && !document.querySelector('#workspace-all,[data-workspace-mode],[data-layout-set],[data-presentation-set]') && !document.getElementById('tabbar').getBoundingClientRect().height));
      await page.evaluate(() => { window.deviceBooks = JSON.stringify([__g05.state.positions, __g05.state.trades, __g05.state.alarms]); window.deviceNodes = ['chart', 'pos-form', 'ki-price-panel', 'watchlist'] /* 3.68.0: KI-Signale entfernt */.map(id => document.getElementById(id)); document.getElementById('pos-note').value = 'Entwurf Geräteansicht'; });
      const select = async view => { await page.click(`[data-workspace-target="${view}"]`); await page.waitForFunction(view => document.documentElement.dataset.workspaceView === view, view); };
      for (const view of ['chart', 'ind', 'pos', 'settings']) {
        await select(view);
        check(prefix + view + ' erreichbar, kein Textüberlauf', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll('[data-workspace-target]')].every(n => { const b = n.getBoundingClientRect(), r = document.createRange(); r.selectNodeContents(n); const t = r.getBoundingClientRect(); return b.height >= 44 && t.left >= b.left && t.right <= b.right; })));
        check(prefix + view + ' korrekte Vorauswahl', await page.evaluate(view => { const d = document.getElementById('workspace-watch'); return view === 'chart' ? d.open && d.getBoundingClientRect().height > 0 : view === 'ind' ? !d.open && d.getBoundingClientRect().height > 0 : !d.getBoundingClientRect().height; }, view));
      }
      await page.click('#view-menu');
      check(prefix + 'Ansicht erklärt Gerätezuordnung statt weiterer Auswahl', await page.evaluate(p => document.getElementById('device-view-name').textContent === (p.expected === 'standard' ? 'Arbeitsbereich Standard' : 'Arbeitsbereich Dashboard'), profile));
      for (const mode of ['light', 'dark', 'custom']) {
        await page.click(`[data-theme-set="${mode}"]`);
        check(prefix + mode + ' Hintergrund weiterhin bedienbar und kontrastreich', await page.evaluate(mode => { const d = document.documentElement, s = getComputedStyle(d), v = k => s.getPropertyValue('--' + k).trim(); return (mode === 'custom' ? d.dataset.background === 'custom' : d.dataset.theme === mode && !d.dataset.background) && __sdAppearance.contrast(v('text'), v('bg')) >= 4.5; }, mode));
      }
      await select('chart'); await page.setViewportSize(profile.resize);
      check(prefix + 'Drehung/Fensterwechsel behält Geräteansicht', await page.evaluate(p => document.documentElement.dataset.presentation === p.expected && document.documentElement.scrollWidth <= innerWidth + 1, profile));
      if (profile.resize.width >= 1100) check(prefix + 'Dashboard hat wirklich breiten Chart rechts und Signale links', await page.evaluate(() => { const c = document.getElementById('chart-sec').getBoundingClientRect(), s = document.getElementById('signals').getBoundingClientRect(); return c.left > s.left && c.width > s.width; }));
      check(prefix + 'Knoten, Entwurf und Originalbücher bleiben unverändert', await page.evaluate(() => deviceNodes.every(n => n === document.getElementById(n.id)) && document.getElementById('pos-note').value === 'Entwurf Geräteansicht' && deviceBooks === JSON.stringify([__g05.state.positions, __g05.state.trades, __g05.state.alarms])));
      // Das Init-Script darf beim Neustart nicht die Test-Altwerte erneut schreiben.
      await page.evaluate(() => localStorage.setItem('scalpdesk.background.v1', JSON.stringify({ mode: 'custom', color: '#102133' })));
      await page.reload(); await page.waitForFunction(() => !!window.__g05 && !!document.querySelector('[data-workspace-target]'));
      check(prefix + 'Neustart bleibt im passenden Arbeitsbereich', await page.evaluate(p => document.documentElement.dataset.presentation === p.expected && document.documentElement.dataset.workspace === 'focus' && document.documentElement.dataset.background === 'custom', profile));
      check(prefix + 'keine JavaScript-Fehler', errors.length === 0, errors);
      await ctx.close();
    }
    check('Keine Nachricht oder neue Handelsaktion durch Gerätezuordnung', (await h.ctl('/sent')).length === sent);
  } finally { await browser?.close(); await h.teardown(); }
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
