// 3.60.0: echte frische Startansicht und Arbeitsbereiche, zusätzlich zur bisherigen Gesamtansicht.
// Keine Klickautomatik im Harness: sämtliche Wege werden hier am tatsächlichen UI bedient.
const h = require('./harness'); let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + JSON.stringify(detail).slice(0, 550) : ''}`); };
const visible = (p, id) => p.locator('#' + id).isVisible();
const select = async (p, key) => { await p.click(`[data-workspace-target="${key}"]`); await p.waitForFunction(key => document.documentElement.dataset.workspaceView === key, key); };
(async () => { let browser;
 try {
  await h.setup(); await h.ctl('/walk?on=0'); browser = await h.launch({ workspace: 'fresh' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }), p = await ctx.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await ctx.addInitScript(() => {
   if (!localStorage.getItem('ui84seed')) { const at = Date.now()-86400000; localStorage.setItem('ui84seed','1'); const pos = { id:'UI84-OFFEN',symbol:'BTCUSDT',side:'long',mode:'isolated',entry:60000,leverage:5,qty:.01,margin:120,openedAt:at,source:'spot',liqExchange:null,preRealized:0,sl:50000,tp:80000,ack:{sl:false,tp:false} }; const trade = {...pos,id:'UI84-GESCHLOSSEN',entry:59000,exit:60000,closedAt:at+3600000,fees:1,pnl:9,pnlSource:'calc'}; localStorage.setItem('scalpdesk.positions.v1',JSON.stringify([pos]));localStorage.setItem('scalpdesk.history.v1',JSON.stringify([trade])); }
   window.ui84Resources = { workers: 0, intervals: 0 };
   const W = Worker, interval = setInterval;
   window.Worker = class extends W { constructor(...args) { super(...args); ui84Resources.workers++; } };
   window.setInterval = function(...args) { ui84Resources.intervals++; return interval.apply(this, args); };
  });
  await ctx.route('https://raw.githubusercontent.com/NicoAHB/wx-widget/kalender/calendar.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ v: 1, source: 'Forex Factory', fetchedAt: new Date().toISOString(), lists: 1, events: Array.from({length:6},(_,i)=>({ t: Date.now()+(i+1)*3600000, cur:'USD',impact:'high',title:'Zinsentscheid '+i,forecast:'',previous:'',actual:'' })) }) }));
  await ctx.route('https://raw.githubusercontent.com/NicoAHB/wx-widget/news/news.json', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ v:1, fetchedAt:new Date().toISOString(), covered:['BTC'], binance:[], news:{BTC:Array.from({length:6},(_,i)=>({t:Date.now()-(i+1)*3600000,imp:'high',cat:'recht',title:'Bitcoin ETF Meldung '+i,outlet:'Testmedium',url:'https://news.google.com/rss/articles/ui84-'+i,more:0}))} }) }));
  await p.goto(h.URL_BASE + '/weather-widget-v2.html');
  await p.waitForFunction(() => window.__g05?.state.candles.length > 100 && !!window.__g12?.view.state.confirmed);
  check('Frischer Start ohne Testpräferenz: Arbeitsbereich Chart, Standardlayout erhalten', await p.evaluate(() => document.documentElement.dataset.workspace === 'focus' && document.documentElement.dataset.workspaceView === 'chart' && document.documentElement.dataset.presentation === 'standard'));
  check('Chart und echte Signalübersicht sichtbar, sekundäre Bereiche verborgen', await visible(p, 'chart-sec') && await visible(p, 'signals') && !await visible(p, 'positions') && !await visible(p, 'alarms') && !await visible(p, 'econ') && !await visible(p, 'calc-sec'));
  const chart = await p.locator('#chart-sec').boundingBox(), sig = await p.locator('#signals').boundingBox();
  check('Desktop: zwei Spalten, Chart breiter und neben Signalen', chart.width > sig.width * 1.8 && sig.x >= chart.x + chart.width - 1 && Math.abs(chart.y - sig.y) < 1, { chart, sig });
  check('Wichtige Vorauswahl oben sichtbar; Orderflow und Ebenen zunächst eingeklappt', await p.evaluate(() => document.getElementById('workspace-watch').open && document.getElementById('watchlist').getBoundingClientRect().top < document.getElementById('chart-sec').getBoundingClientRect().top && ['workspace-orderflow', 'workspace-chart-tools'].every(id => !document.getElementById(id).open)));
  check('Vier klare Navigationsnamen und genau ein aktiver Bereich', await p.evaluate(() => [...document.querySelectorAll('[data-workspace-target]')].map(n => n.textContent).join('|') === 'Chart|Analysen|Positionen|Einstellungen' && document.querySelectorAll('[data-workspace-target][aria-current]').length === 1));
  check('Tatsächlich vorhandene offene Position und geschlossener Trade für Datenerhalt', await p.evaluate(() => __g05.state.positions.length===1 && __g05.state.trades.length===1));
  await p.click('#pause');
  const order = await p.evaluate(() => [...__g05.state.watch]); await p.locator('#watchlist .wl-tile').first().focus(); await p.keyboard.press('Alt+ArrowRight');
  check('Bestehende Vorauswahl-Umsortierung per Tastatur im neuen oberen Bereich', await p.evaluate(before => __g05.state.watch[0]===before[1] && __g05.state.watch[1]===before[0] && __g05.state.watch.slice(2).join()===before.slice(2).join(), order));
  await p.evaluate(() => { window.ui84Nodes = ['chart', 'market-form', 'pos-form', 'pos-note', 'view-panel', 'notify-panel', 'data-panel', 'model-settings', 'ki-signal-panel', 'bot-simulation-panel', 'orderflow-panel'].map(id => document.getElementById(id)); document.getElementById('pos-note').value = 'Nicht gespeicherter Entwurf – 84'; window.ui84Books = JSON.stringify([__g05.state.positions, __g05.state.trades, __g05.state.alarms]); window.ui84ResourcesBefore = JSON.stringify(ui84Resources); });
  await select(p, 'ind');
  check('Analysen öffnen KI, Kurszonen und Umfeld ohne Kontospalte', await visible(p, 'alarms') && await visible(p, 'ki-signal-panel') && await visible(p, 'zones-sec') && await visible(p, 'econ') && !await visible(p, 'chart-sec') && !await visible(p, 'positions'));
  await p.waitForFunction(() => document.getElementById('econ-src').textContent && document.getElementById('cnews-src').textContent);
  check('Kalender und Coin-News: drei wichtige Einträge statt langer Listen', await p.locator('#econ .ec-row').count() === 3 && await p.locator('#cnews .cn-row').count() === 3);
  await p.click('#econ-more'); await p.click('#cnews-more');
  check('Mehr anzeigen erhält alle sechs Ereignisse und Nachrichten', await p.locator('#econ .ec-row').count() === 6 && await p.locator('#cnews .cn-row').count() === 6);
  await p.click('#econ-more'); await p.click('#cnews-more');
  check('KI-Einrichtung ohne Textwand zunächst zugeklappt', await p.evaluate(() => !document.getElementById('ki-setup').open && !document.getElementById('ki-settings').open));
  await p.click('#ki-bot-tab'); check('Bot weiterhin erreichbar und unverändert standardmäßig aus', await visible(p, 'bot-simulation-panel') && await p.evaluate(() => !__g12.view.state.confirmed.enabled));
  await p.click('#ki-price-tab'); check('Preisalarme innerhalb der Analyse weiterhin erreichbar', await visible(p, 'ki-price-panel') && !await visible(p, 'bot-simulation-panel'));
  await select(p, 'pos');
  check('Positionen, Konto, Journal und Rechner zusammen, Marktumfeld verborgen', await visible(p, 'positions') && await visible(p, 'acct') && await visible(p, 'journal') && await visible(p, 'calc-sec') && !await visible(p, 'econ') && !await visible(p, 'alarms'));
  await select(p, 'settings');
  check('Einstellungen enthalten dieselbe Datensicherung und Modellannahmen', await p.evaluate(() => document.getElementById('data-panel').closest('#workspace-settings') && document.getElementById('model-settings').closest('#workspace-settings')));
  check('Erklärung und Einrichtung standardmäßig geschlossen', await p.evaluate(() => !document.getElementById('workspace-appearance').open && !document.getElementById('workspace-notifications').open && document.getElementById('data-panel').hidden));
  await p.click('#view-menu'); check('Header-Ansicht öffnet Darstellung im Einstellungsbereich', await visible(p, 'view-panel') && await p.evaluate(() => document.documentElement.dataset.workspaceView === 'settings' && document.getElementById('workspace-appearance').open && getComputedStyle(document.getElementById('view-panel')).position === 'static'));
  await p.click('[data-theme-set="light"]'); check('Bestehender Hellmodus im neuen Bereich bedienbar', await p.evaluate(() => document.documentElement.dataset.theme === 'light'));
  await p.click('#notify-menu'); check('Header-Hinweise öffnen Hinweise und Telegram im eigenen Bereich', await visible(p, 'notify-panel') && await p.evaluate(() => document.getElementById('workspace-notifications').open));
  await p.click('#tgc-open'); check('Telegram-Chats öffnen weiterhin den bestehenden Dialog', await p.evaluate(() => document.getElementById('tgc-dialog').open));
  await p.evaluate(() => document.getElementById('tgc-dialog').close());
  await p.click('#ki-open'); check('KI-Verknüpfung aus Einstellungen wechselt zum sichtbaren Modellbereich', await visible(p, 'ki-signal-panel') && await p.evaluate(() => document.documentElement.dataset.workspaceView === 'ind'));
  await select(p, 'settings'); await p.click('#workspace-notifications > summary'); await p.click('#workspace-notifications > summary');
  check('Hinweise bleiben nach KI-Verknüpfung erneut aufklappbar', await visible(p, 'notify-panel'));
  await p.click('#backup-badge'); check('Sicherungs-Shortcut öffnet vollständige Sicherung direkt in Einstellungen', await visible(p, 'data-panel') && await p.evaluate(() => document.documentElement.dataset.workspaceView === 'settings'));
  const download = p.waitForEvent('download'); await p.click('#backup-save'); const d = await download;
  check('Unveränderter tatsächlicher JSON-Sicherungsdownload bleibt erreichbar', /^backup-.*\.json$/.test(d.suggestedFilename()));
  await select(p, 'chart');
  for (const id of ['workspace-orderflow', 'workspace-chart-tools']) { if (!await p.locator('#' + id).evaluate(n => n.open)) await p.click('#' + id + ' > summary'); check(`${id}: tatsächlicher Inhalt nach Aufklappen sichtbar`, await p.evaluate(id => { const d = document.getElementById(id); return d.open && [...d.children].some(n => n.tagName !== 'SUMMARY' && n.getBoundingClientRect().height > 0); }, id)); }
  check('Alle existierenden UI-Knoten, Entwurf und Bücher über Navigation erhalten', await p.evaluate(() => ui84Nodes.every(n => n === document.getElementById(n.id)) && document.getElementById('pos-note').value === 'Nicht gespeicherter Entwurf – 84' && JSON.stringify([__g05.state.positions, __g05.state.trades, __g05.state.alarms]) === ui84Books));
  check('Navigation erzeugt keine zusätzlichen Worker oder Sekundentimer', await p.evaluate(() => JSON.stringify(ui84Resources) === ui84ResourcesBefore), await p.evaluate(() => ui84Resources));
  await p.click('#workspace-all');
  check('Gesamtansicht behält vorhandene drei Desktopspalten', await p.evaluate(() => document.documentElement.dataset.workspace === 'all' && getComputedStyle(document.getElementById('dash')).gridTemplateColumns.split(' ').length === 3));
  check('Gesamtansicht stellt Sicherung/Menüs an ihre ursprünglichen Stellen zurück', await p.evaluate(() => document.getElementById('data-panel').parentElement.id === 'pos-over' && document.getElementById('view-panel').parentElement.classList.contains('menu-wrap') && document.getElementById('model-settings').parentElement.classList.contains('calc-side')));
  await p.click('#view-menu'); await p.click('[data-workspace-mode="focus"]');
  check('Arbeitsbereiche aus Ansicht zurück erreichbar, Knoten und Entwurf erhalten', await p.evaluate(() => document.documentElement.dataset.workspace === 'focus' && ui84Nodes.every(n => n === document.getElementById(n.id)) && document.getElementById('pos-note').value === 'Nicht gespeicherter Entwurf – 84'));
  check('Zuvor geöffnete Details über Gesamtansicht-Wechsel erhalten', await p.evaluate(() => ['workspace-orderflow', 'workspace-chart-tools'].every(id => document.getElementById(id).open)));
  await select(p, 'settings'); await p.reload(); await p.waitForFunction(() => window.__g05 && document.documentElement.dataset.workspaceView === 'settings');
  check('Arbeitsbereich und Hintergrund nach Öffnen wiederhergestellt', await p.evaluate(() => document.documentElement.dataset.workspace === 'focus' && document.documentElement.dataset.theme === 'light' && document.documentElement.dataset.workspaceView === 'settings'));
  await select(p, 'chart'); check('Klappauswahl nach Neuladen wiederhergestellt', await p.evaluate(() => ['workspace-orderflow', 'workspace-chart-tools'].every(id => document.getElementById(id).open)));
  for (const id of ['workspace-orderflow', 'workspace-chart-tools']) await p.click('#' + id + ' > summary');
  // Beide Darstellungen und die drei Hintergründe mit echter Navigation bei schmalen Breiten.
  for (const width of [320, 390, 768, 1024, 1440]) {
   await p.setViewportSize({ width, height: 1000 });
   for (const view of ['chart', 'ind', 'pos', 'settings']) {
    await select(p, view); await p.waitForTimeout(150);
    const layout = await p.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth, buttons: [...document.querySelectorAll('[data-workspace-target]')].map(n => ({ w: n.offsetWidth, h: n.offsetHeight })), nav: document.getElementById('workspace-nav').getBoundingClientRect().toJSON() }));
    check(`${width}px/${view}: Vorauswahl nutzt volle Breite, ihre Kacheln bleiben lesbar`, await p.evaluate(() => { const w = document.getElementById('watchlist').getBoundingClientRect().width, tiles=[...document.querySelectorAll('#watchlist .wl-tile')]; return w>=innerWidth-60 && tiles.every(n=>n.getBoundingClientRect().width>=115); }));
    check(`${width}px/${view}: ohne horizontalen Überlauf und Navigation ≥ 44px`, layout.overflow <= 1 && layout.buttons.every(n => n.w >= 44 && n.h >= 44), layout);
   }
  }
  await p.setViewportSize({ width: 390, height: 844 });
  for (const presentation of ['standard', 'dashboard']) {
   await select(p, 'settings'); await p.click('#view-menu'); await p.click(`[data-presentation-set="${presentation}"]`);
   for (const theme of ['light', 'dark', 'custom']) {
    await p.click(`[data-theme-set="${theme}"]`); if (theme === 'custom') await p.click('[data-background-color="#f5eddf"]');
    check(`${presentation}/${theme}: Einstellungen ohne Überlauf, Farben weiter lesbar`, await p.evaluate(() => { const s = getComputedStyle(document.documentElement), v = k => s.getPropertyValue('--' + k).trim(); return document.documentElement.scrollWidth <= innerWidth + 1 && ['text', 'muted', 'up-text', 'down-text'].every(k => __sdAppearance.contrast(v(k), v('surface-2')) >= 4.5); }));
   }
   await select(p, 'chart');
   check(`${presentation}: Vorauswahl weiterhin vollständig oberhalb des Charts`, await p.evaluate(() => document.getElementById('watchlist').getBoundingClientRect().top < document.getElementById('chart-sec').getBoundingClientRect().top && document.querySelectorAll('#watchlist .wl-tile').length === __g05.state.watch.length));
   await p.screenshot({ path: `/tmp/scalpdesk-360-${presentation}-phone.png` });
  }
  await p.click('#chart-full'); check('Vollbild weiterhin erreichbar, Navigation verdeckt Chart nicht', await p.evaluate(() => document.documentElement.dataset.chartfull === '1') && !await visible(p, 'workspace-nav'));
  await p.click('#fb-tools'); check('Vollbild-Werkzeuge trotz eingeklappter Ebenen bedienbar', await visible(p, 'ov-all'));
  await p.click('#fb-exit'); check('Vollbild zurück zur selben Chartansicht', await visible(p, 'workspace-nav') && await visible(p, 'chart-sec'));
  await p.setViewportSize({ width: 1440, height: 1000 }); await select(p, 'settings'); await p.click('#view-menu'); await p.click('[data-presentation-set="dashboard"]'); await select(p, 'chart');
  check('Alternative Desktopdarstellung: breiter Chart rechts, gleiche Signale links', await p.evaluate(() => { const c = document.getElementById('chart-sec').getBoundingClientRect(), s = document.getElementById('signals').getBoundingClientRect(); return c.left > s.left && c.width > s.width * 1.8; }));
  await p.screenshot({ path: '/tmp/scalpdesk-360-dashboard-desktop.png' });
  await select(p, 'settings'); await p.click('#view-menu'); await p.click('[data-presentation-set="standard"]'); await select(p, 'chart'); await p.screenshot({ path: '/tmp/scalpdesk-360-standard-desktop.png' });
  // Frischer echter Offline-Aufruf erhält den gewählten Arbeitsbereich und das komplette PWA-Bündel.
  await select(p, 'settings'); await p.waitForFunction(() => !!navigator.serviceWorker.controller); await ctx.setOffline(true);
  const off = await ctx.newPage(); off.on('pageerror', e => errors.push(e.message)); await off.goto(h.URL_BASE + '/weather-widget-v2.html'); await off.waitForFunction(() => !!window.__g05 && document.documentElement.dataset.workspaceView === 'settings');
  check('Frischer Offline-Start stellt Navigation und vollständige Sicherung bereit', await visible(off, 'workspace-settings') && await off.evaluate(() => document.getElementById('data-panel').closest('#workspace-settings') && document.getElementById('backup-compact')));
  await ctx.setOffline(false); await off.close();
  check('Keine JavaScript-Fehler beim Neuordnen, Wechseln, Sichern oder Offline-Start', errors.length === 0, errors);
  await ctx.close();
  for (const width of [320, 390]) {
   const touch = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true }), phone = await touch.newPage(); phone.on('pageerror', e => errors.push(e.message));
   await phone.goto(h.URL_BASE + '/weather-widget-v2.html'); await phone.waitForFunction(() => window.__pdf1 && __g05.state.candles.length > 100);
   check(`${width}px echte Touch-Konfiguration: Chart-Bereich, vollständige Vorauswahl ganz oben, kein Überlauf`, await phone.evaluate(() => document.documentElement.dataset.workspaceView === 'chart' && document.documentElement.dataset.layout === 'tablet' && document.getElementById('workspace-watch').open && document.getElementById('watchlist').getBoundingClientRect().top < document.getElementById('chart-sec').getBoundingClientRect().top && document.querySelectorAll('#watchlist .wl-tile').length === __g05.state.watch.length && document.documentElement.scrollWidth <= innerWidth));
   check(`${width}px Touch: Vorauswahlkacheln und Kurse haben volle nutzbare Breite`, await phone.evaluate(() => document.getElementById('watchlist').getBoundingClientRect().width>=innerWidth-60 && [...document.querySelectorAll('#watchlist .wl-tile')].every(n=>n.getBoundingClientRect().width>=115)));
   await phone.locator('#chart').scrollIntoViewIfNeeded(); await phone.waitForFunction(() => document.querySelector('#chart svg')); check(`${width}px Touch: vorhandener Chart zeichnet beim Hineinscrollen`, await phone.locator('#chart svg').count() > 0);
   const chosen = await phone.locator('#watchlist .wl-tile').nth(1).getAttribute('data-watch'); await phone.locator('#watchlist .wl-tile').nth(1).tap(); await phone.waitForFunction(symbol => __g05.state.symbol === symbol && __g05.state.loadedSymbol === symbol, chosen + 'USDT');
   check(`${width}px Touch: ursprüngliche Vorauswahl lädt denselben Coin in Chart und Analyse`, await phone.evaluate(symbol => __g05.state.symbol === symbol && document.getElementById('pair-label').textContent.includes(symbol.slice(0,-4)), chosen + 'USDT'));
   await phone.tap('[data-workspace-target="settings"]'); check(`${width}px Touch: wichtige Vorauswahl auch in Einstellungen weiter oben erreichbar`, await visible(phone, 'watchlist')); await phone.tap('#backup-badge');
   check(`${width}px Touch: Sicherung durch echte Tippgeste erreichbar`, await visible(phone, 'data-panel'));
   await phone.tap('#backup-compact'); check(`${width}px Touch: kompakter vollständiger Übertragungsdialog erreichbar`, await phone.evaluate(() => document.getElementById('qr-dialog').open) && await visible(phone, 'qr-file-make'));
   await phone.evaluate(() => document.getElementById('qr-dialog').close());
   await phone.tap('[data-workspace-target="chart"]'); await phone.tap('#workspace-orderflow > summary');
   check(`${width}px Touch: bestehendes Orderflow-Signal und alle zehn Kerzen erreichbar`, await visible(phone, 'of-signal') && await phone.locator('.of-row:not(.of-legend)').count() === 10);
   await phone.tap('#workspace-price-alarms'); check(`${width}px Touch: Preisalarme direkt aus Chart erreichbar`, await visible(phone, 'ki-price-panel') && await phone.evaluate(() => document.documentElement.dataset.workspaceView === 'ind'));
   await phone.tap('[data-workspace-target="settings"]'); await phone.tap('#view-menu'); await phone.tap('[data-workspace-mode="all"]');
   await phone.reload(); await phone.waitForFunction(() => window.__g05 && document.documentElement.dataset.workspace === 'all');
   check(`${width}px Touch: Gesamtansicht dauerhaft gespeichert, ursprüngliche Tab-Leiste erhalten`, await visible(phone, 'tabbar') && !await visible(phone, 'workspace-nav'));
   await touch.close();
  }
  check('Auch echte Touch-Wege ohne JavaScript-Fehler', errors.length === 0, errors);
 } finally { await browser?.close(); await h.teardown(); }
 console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
