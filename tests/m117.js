// 3.74.0: nativer Marktradar, echte vorhandene Feeds, iPhone-Touch, Datenalter, Coinwechsel und lokale Beobachtung.
const h = require('./harness'), fs = require('fs'), path = require('path');
const out = path.join(__dirname, 'out', 'marktradar'); fs.mkdirSync(out, { recursive: true });
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${!ok ? ' — ' + JSON.stringify(detail).slice(0, 700) : ''}`); };
(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0'); await h.ctl('/tgreset');
  const browser = await h.launch({ workspace: 'fresh' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, timezoneId: 'Europe/Berlin', acceptDownloads: true });
    const page = await ctx.newPage(), errors = [], requests = []; page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (/news.json|calendar.json|premiumIndex|openInterest/.test(r.url()) || /fapi.*klines/.test(r.url()) && new URL(r.url()).searchParams.get('symbol') === 'BTCUSDT') requests.push(r.url()); });
    await page.route('**/NicoAHB/wx-widget/news/news.json', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ v: 1, fetchedAt: new Date().toISOString(), covered: ['BTC', 'LTC'], binance: [], news: {
      BTC: [{ t: Date.now() - 2 * 3600000, imp: 'high', cat: 'netz', title: 'Bitcoin: Liquidität und Netzwerkentwicklung im Fokus', outlet: 'Marktquelle', url: 'https://news.google.com/articles/radar-btc' }],
      LTC: [{ t: Date.now() - 2 * 3600000, imp: 'high', cat: 'netz', title: 'Litecoin: Aktueller Marktüberblick', outlet: 'Marktquelle', url: 'https://news.google.com/articles/radar-ltc' }]
    } }) }));
    await page.route('**/NicoAHB/wx-widget/kalender/calendar.json', route => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ fetchedAt: new Date().toISOString(), source: 'Forex Factory', events: [{ t: Date.now() + 9 * 60000, cur: 'USD', impact: 'high', title: 'US-Inflation (CPI)', forecast: '0.3%', previous: '0.2%' }] }) }));
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => window.__marketRadar?.view.model.live, null, { timeout: 25000 });
    await page.waitForFunction(() => __marketRadar.view.model.context.eventRisk && __marketRadar.view.model.context.items.length > 0, null, { timeout: 15000 });
    check('Start: eigener kompakter Radar zugeklappt, vor dem vorhandenen Orderflow', await page.evaluate(() => { const r = document.getElementById('market-radar'), o = document.getElementById('workspace-orderflow'); return !r.open && r.parentElement === o.parentElement && !!(r.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_FOLLOWING); }));
    check('Default: Beobachtungen aus, keine Handelsdaten oder Telegram-Nachrichten erzeugt', await page.evaluate(() => !document.getElementById('market-radar-track').checked && __g05.state.positions.length === 0 && __g05.state.trades.length === 0) && !(await h.ctl('/sent')).length);
    await page.locator('#market-radar > summary').scrollIntoViewIfNeeded(); await page.locator('#market-radar > summary').tap();
    await page.waitForFunction(() => document.getElementById('market-radar').open);
    check('Touch: Radar öffnet drei Faktenkarten mit Quellen und passendem Coin', await page.evaluate(() => document.querySelectorAll('#market-radar .mr-card').length === 3 && document.querySelector('#market-radar .mr-meta').textContent.includes('BTC/USDT') && document.querySelectorAll('#market-radar .mr-source').length === 4));
    check('USD-Termin: Risikobadge mit Ursache und Terminzeit, keine Kauf-/Verkaufsempfehlung', await page.evaluate(() => document.getElementById('market-radar').dataset.state === 'risk' && document.querySelector('.mr-lead').textContent.includes('USD-Termin') && document.querySelector('.mr-event').textContent === 'US-Inflation (CPI)'));
    check('News: echte Quelle und Veröffentlichungszeit, gesicherter externer Link', await page.evaluate(() => { const a = document.querySelector('#market-radar .mr-headline a'); return a?.href === 'https://news.google.com/articles/radar-btc' && a.target === '_blank' && /noopener/.test(a.rel) && a.parentElement.querySelector('small').textContent.includes('Marktquelle'); }));
    const geometry = async width => {
      await page.setViewportSize({ width, height: 1000 });
      return page.evaluate(() => { const root = document.getElementById('market-radar'), r = root.getBoundingClientRect(), sum = root.querySelector('summary').getBoundingClientRect(), cards = [...root.querySelectorAll('.mr-card')].map(e => e.getBoundingClientRect());
        const buttons = [...root.querySelectorAll('.mr-actions button')].map(e => e.getBoundingClientRect());
        return { width: innerWidth, root: [r.left, r.right], summaryHeight: sum.height, bodyOverflow: root.scrollWidth - root.clientWidth, pageOverflow: document.documentElement.scrollWidth - innerWidth,
          cardsInside: cards.every(c => c.left >= r.left && c.right <= r.right), buttons: buttons.length === 3 && buttons.every(b => b.height >= 44 && b.width >= 44), sameButtonLine: buttons.every(b => Math.abs(b.top - buttons[0].top) < 1),
          summaryInside: [...root.querySelector('summary').children].every(e => { const b = e.getBoundingClientRect(); return b.left >= r.left && b.right <= r.right; }) };
      });
    };
    for (const width of [320, 390, 430, 768, 1440]) {
      const g = await geometry(width);
      check(`${width}px: Karten, Status und drei 44px-Aktionen passen vollständig`, g.cardsInside && g.buttons && g.sameButtonLine && g.summaryInside && g.bodyOverflow <= 1 && g.pageOverflow <= 1, g);
      if ([390, 1440].includes(width)) { await page.locator('#market-radar').screenshot({ path: path.join(out, `radar-${width}-dark.png`) }); }
    }
    await page.evaluate(() => document.documentElement.dataset.theme = 'light'); const light = await geometry(390);
    check('Helles Design: bestehende Farbvariablen und vollständige Geometrie', light.cardsInside && light.summaryInside && light.bodyOverflow <= 1 && await page.evaluate(() => getComputedStyle(document.querySelector('.market-radar')).backgroundColor === getComputedStyle(document.querySelector('.market-radar')).getPropertyValue('--surface').trim() || document.documentElement.dataset.theme === 'light'), light);
    await page.locator('#market-radar').screenshot({ path: path.join(out, 'radar-390-light.png') });
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; document.getElementById('market-radar').style.fontFamily = 'monospace'; }); const fallback = await geometry(320);
    check('Breite Ersatzschrift: Header und Inhalt laufen nicht über', fallback.summaryInside && fallback.bodyOverflow <= 1, fallback);
    await page.evaluate(() => document.getElementById('market-radar').style.fontFamily = '');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    check('Reduzierte Bewegung: kein animierter Chevron', await page.locator('.mr-chevron').evaluate(e => getComputedStyle(e).transitionDuration === '0s'));
    await geometry(390); await page.locator('#market-radar > summary').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.getElementById('market-radar').open); await page.keyboard.press('Space'); await page.waitForFunction(() => document.getElementById('market-radar').open);
    check('Tastatur: Enter schließt, Leertaste öffnet, Fokus bleibt erhalten', await page.evaluate(() => document.activeElement.id === 'market-radar-summary'));
    await page.waitForTimeout(1000); const before = requests.length;
    for (let i = 0; i < 4; i++) await page.locator('#market-radar > summary').tap();
    await page.waitForTimeout(300);
    check('Auf-/Zuklappen erzeugt keine zusätzlichen API-Anfragen', requests.length === before, requests.slice(before));
    await page.locator('.mr-journal > summary').click(); await page.check('#market-radar-track');
    await page.waitForFunction(() => (JSON.parse(localStorage.getItem('scalpdesk.market-radar.v1') || '{}').observations || []).length > 0, null, { timeout: 8000 });
    check('Optionales Merken: aktuelle Beobachtung ohne erfundene Folgekurse', await page.evaluate(() => { const b = JSON.parse(localStorage.getItem('scalpdesk.market-radar.v1')); return b.track && b.open && b.observations.every(r => r.model === 'market-radar-1' && r.symbol === 'BTCUSDT' && r.price > 0 && !r.after15 && !r.after60); }));
    const downloaded = page.waitForEvent('download'); await page.locator('.mr-journal-body > button').click(); const download = await downloaded; await download.saveAs(path.join(out, 'beobachtungen.json'));
    const exported = JSON.parse(fs.readFileSync(path.join(out, 'beobachtungen.json')));
    check('Export: versionierte Beobachtung mit Originalkurs und Zeitstempel, ohne Zugangsdaten', exported.model === 'market-radar-1' && exported.observations.length > 0 && !/token|chat_id|password/i.test(JSON.stringify(exported)));
    await page.reload(); await page.waitForFunction(() => window.__marketRadar?.view.model.live, null, { timeout: 25000 });
    check('Neuladen: Klappzustand, Merken und Beobachtungen wiederhergestellt', await page.evaluate(() => document.getElementById('market-radar').open && document.getElementById('market-radar-track').checked && JSON.parse(localStorage.getItem('scalpdesk.market-radar.v1')).observations.length > 0));
    await page.locator('#pause').click(); await page.waitForFunction(() => document.getElementById('market-radar').dataset.state === 'paused');
    check('Pause: neutraler Pausenstatus, kein aktueller Futures-Kurs vorgetäuscht', await page.evaluate(() => !__marketRadar.view.model.live && !__marketRadar.view.model.flags.length && document.querySelector('.mr-badge').textContent === 'Pausiert'));
    await page.locator('#pause').click(); await page.waitForFunction(() => __marketRadar.view.model.live, null, { timeout: 15000 });
    await ctx.setOffline(true); await page.waitForFunction(() => document.getElementById('market-radar').dataset.state === 'offline');
    check('Offline: eigener Status statt alter grüner Freigabe', await page.evaluate(() => !__marketRadar.view.model.live && document.querySelector('.mr-badge').textContent === 'Offline'));
    await ctx.setOffline(false); await page.waitForFunction(() => __marketRadar.view.model.live, null, { timeout: 20000 });
    await page.evaluate(() => { void __intervals.setMarket('LTCUSDT'); });
    check('Coinwechsel sofort: neuer Header, keine alte BTC-Nachricht oder alter BTC-Kurs', await page.evaluate(() => __marketRadar.view.model.symbol === 'LTCUSDT' && !__marketRadar.view.model.quote && !document.querySelector('.mr-headlines').textContent.includes('Bitcoin')));
    await page.waitForFunction(() => __marketRadar.view.model.live && __marketRadar.view.model.context.items.some(x => x.title.includes('Litecoin')), null, { timeout: 25000 });
    check('Coinwechsel fertig: echte LTC-Quellen und neue Live-Kurse', await page.evaluate(() => __marketRadar.view.model.symbol === 'LTCUSDT' && __marketRadar.view.model.positioning.fundingReady && !__marketRadar.view.model.context.items.some(x => x.title.includes('Bitcoin'))));
    await page.locator('#market-radar .mr-actions button').nth(1).click();
    check('News-Aktion öffnet den bestehenden Analysebereich und behält Radarzustand', await page.evaluate(() => document.documentElement.dataset.workspaceView === 'ind' && document.getElementById('market-radar').open));
    await page.click('[data-workspace-target="chart"]'); await page.locator('#chart-full').click();
    check('Chart-Vollbild blendet Radar und Orderflow aus', !await page.locator('#market-radar').isVisible());
    await page.locator('#fb-exit').tap();
    check('Vollbild verlassen: Radar und gespeicherter Klappzustand wieder erreichbar', await page.locator('#market-radar').isVisible() && await page.locator('#market-radar').evaluate(e => e.open));
    check('Keine JavaScript-Fehler oder Telegram-Nachrichten', errors.length === 0 && !(await h.ctl('/sent')).length, errors);
    await ctx.close();
  } catch (e) { check('Abbruch', false, e.stack || e.message); }
  finally { await browser.close(); await h.teardown(); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})();
