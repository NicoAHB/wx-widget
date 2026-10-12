// Direkte Mustererklärung: echte Touch-Gesten, Maus/Tastatur und weiterhin unabhängige Zeichnungsauswahl.
const h = require('./harness'), fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${!ok && extra ? ' ' + JSON.stringify(extra) : ''}`); };
(async () => {
  await h.setup(); const browser = await h.launch();
  try {
    await h.ctl('/walk?on=0'); await h.ctl('/silent?on=1');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const src = fs.readFileSync(__dirname + '/m58.js', 'utf8'), B = vm.runInNewContext(src.slice(src.indexOf('const BUILD = () => {'), src.indexOf('\nconst tests = {')) + '\nBUILD()');
    const shape = B.path(B.F.asc_triangle), ms = 3600000, base = Math.floor(Date.now() / ms) * ms - 500 * ms;
    const k = [...Array.from({ length: 500 - shape.length }, () => ({ o: 85, h: 85.1, l: 84.9, c: 85, v: 100 })), ...shape, { o: 97, h: 97.1, l: 96.9, c: 97, v: 1 }];
    const fixture = k.map((c, i) => [base + i * ms, c.o, c.h, c.l, c.c, c.v, base + (i + 1) * ms - 1]);
    await ctx.route(/https:\/\/(?:data-api\.binance\.vision|api\.binance\.com)\/.*klines\?/, route => {
      const q = new URL(route.request().url()).searchParams;
      return ['BTCUSDT', 'LTCUSDT'].includes(q.get('symbol')) && q.get('interval') === '1h' && !q.has('startTime') && !q.has('endTime')
        ? route.fulfill({ json: fixture, headers: { 'access-control-allow-origin': '*' } }) : route.continue();
    });
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => window.__g09 && __g05.state.candles.length > 200);
    const load = async () => {
      await page.evaluate(() => __intervals.setMarket('BTCUSDT', '1h'));
      await page.locator('#chart').scrollIntoViewIfNeeded(); // Passive Musteranalyse läuft nur im sichtbaren Chart.
      try { await page.waitForFunction(() => __g05.state.loadedSymbol === 'BTCUSDT' && !__g05.state.busy && __g09.chipRows().filter(r => !r.disabled).length >= 2); }
      catch (e) { console.log('Muster-Ladebefund', await page.evaluate(() => ({ symbol: __g05.state.symbol, loaded: __g05.state.loadedSymbol, interval: __g05.state.interval, source: __g05.state.source, busy: __g05.state.busy, candles: __g05.state.candles.slice(-4), pattern: { key: __g09.pat.res?.key, hits: __g09.pat.res?.hits?.map(h => ({ id: h.id, t1: h.t1, q: h.q })), busy: __g09.pat.busy }, chips: __g09.chipRows().map(r => ({ key: r.key, disabled: r.disabled, status: r.status })) })), errors); throw e; }
    };
    await load();
    const row = await page.evaluate(() => { const r = __g09.chipRows().find(r => !r.disabled); return { key: r.key, id: r.hit.id, title: document.querySelector(`button[data-pattern-info-key="${r.key}"]`).getAttribute('aria-label'), status: r.hit.status }; });
    const tile = page.locator(`button[data-pattern-key="${row.key}"]`), info = page.locator(`button[data-pattern-info-key="${row.key}"]`), dialog = page.locator('#pat-info');
    const selection = () => page.evaluate(() => JSON.stringify(__g09.chipSelection()));
    const shown = () => page.evaluate(() => document.getElementById('pat-info').open);
    const close = async () => { await page.click('#pat-info-x'); await page.waitForFunction(() => !document.getElementById('pat-info').open); };
    const touch = await ctx.newCDPSession(page);
    const point = async () => { await tile.scrollIntoViewIfNeeded(); const r = await tile.boundingBox(); return { x: r.x + Math.min(r.width / 2, 80), y: r.y + r.height / 2 }; };
    const start = async () => { const p = await point(); await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }); return p; };
    const end = () => touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const snapshot = await page.evaluate(() => ({ positions: JSON.stringify(__g05.state.positions), alarms: JSON.stringify(__g05.state.alarms), learned: localStorage.getItem('scalpdesk.patknow.v1') }));

    check('Jede Musterkachel hat genau einen sichtbaren, beschrifteten Info-Knopf', await page.locator('.chart-pattern-info').count() === await page.locator('.chart-pattern-chip').count() && row.title.startsWith('Erklärung zu '));
    let before = await selection(); await info.click();
    check('Info-Knopf öffnet vorhandene Erklärung ohne Zeichnungsauswahl', await shown() && before === await selection());
    check('Erklärung enthält Kerzenzeichnung, Regeln, Messwerte und Bestätigung', await page.locator('#pat-info-body svg').count() === 1 && (await page.locator('#pat-info-body').innerText()).includes('Gemessen') && (await page.locator('#pat-info-body').innerText()).includes('Bestätigung') && await page.locator('#pat-info-body .pat-why li').count() > 0);
    const title = await page.locator('#pat-info-title').innerText(); await dialog.screenshot({ path: '/tmp/scalpdesk-3641-muster-info.png' }); await close();
    const refresh=await page.evaluate(()=>{__g09.chipRows();__g09.pat.res={...__g09.pat.res,hits:__g09.pat.res.hits.map(h=>({...h}))};__g09.chipPaint();return __g09.chipRows().map(r=>({key:r.key,index:__g09.pat.res.hits.indexOf(r.hit)}));});await info.click();
    check('Neue Engineobjekte mit identischen Werten behalten Erklärung und aktuelle Referenzen',await shown()&&refresh.every(r=>r.index>=0),refresh);
    if(!await shown())throw Error('Identisch neu berechnetes Muster öffnet keine Erklärung.');
    await page.locator('.pat-why summary').click();const update=await page.evaluate(key=>{const p=__g09.pat,old=p.res.hits,body=document.getElementById('pat-info-body'),scroll=body.scrollTop;p.res={...p.res,hits:p.res.hits.map(h=>h.id+'|'+h.t0===key?{...h,q:72,rules:h.rules.map((r,i)=>i===0?{...r,v:'neuer Messstand'}:r)}:h)};__g09.chipPaint();const answer={fresh:body.textContent.includes('Regelgüte 72 %')&&body.textContent.includes('neuer Messstand'),open:body.querySelector('.pat-why').open,scroll:body.scrollTop===scroll};p.res={...p.res,hits:old};__g09.chipPaint();return answer;},row.key);
    check('Neue Messwerte aktualisieren geöffnete Erklärung und erhalten ihren Klapp-/Scrollstand',update.fresh&&update.open&&update.scroll,update);await close();
    await start(); await page.waitForTimeout(250);
    check('Kurzer Druck öffnet noch keine Erklärung', !await shown());
    await end(); await page.waitForTimeout(100);
    check('Kurzer Touch zeichnet genau einmal', await page.evaluate(key => __g09.chipSelection().length === 1 && __g09.chipSelection()[0] === key, row.key));
    before = await selection(); await start(); await page.waitForFunction(() => document.getElementById('pat-info').open);
    check('Langer echter Touch öffnet dieselbe Mustererklärung', await page.locator('#pat-info-title').innerText() === title);
    await end(); await page.waitForTimeout(150);
    check('Loslassen nach langem Druck ändert Zeichnung nicht und schließt Erklärung nicht', await shown() && before === await selection()); await close();
    const p = await point(); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(100);
    check('Nächster normaler Touch funktioniert sofort und blendet Zeichnung aus', await selection() === '[]' && !await shown());

    let from = await start(); await page.waitForTimeout(70);
    const scrollBefore = await page.locator('#chart-pattern-chips').evaluate(n => n.scrollLeft);
    for (const dx of [30, 60, 100, 140]) { await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x - dx, y: from.y }] }); await page.waitForTimeout(50); }
    await end(); await page.waitForTimeout(650);
    check('Horizontales Wischen scrollt die Liste, ohne Erklärung oder Auswahl', !await shown() && await selection() === '[]' && await page.locator('#chart-pattern-chips').evaluate(n => n.scrollLeft) > scrollBefore);
    await start(); await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await page.waitForTimeout(650);
    check('Abgebrochener Touch öffnet nichts und zeichnet nichts', !await shown() && await selection() === '[]');
    await start(); await page.evaluate(() => {__g09.pat.res={...__g09.pat.res,hits:__g09.pat.res.hits.map(h=>({...h}))};__g09.chipPaint();}); await page.waitForFunction(() => document.getElementById('pat-info').open); await end();
    check('Live-Neuzeichnung erhält den gedrückten Chip und seine Erklärung', await page.locator('#pat-info-title').innerText() === title && await selection() === '[]'); await close();
    await start(); await page.evaluate(() => { __g09.pat.minQ = 101; __g09.chipPaint(); }); await page.waitForTimeout(650); await end();
    check('Während Druck herausgefiltertes Muster öffnet keine alte Erklärung; Info-Knoten entfernt', !await shown() && await page.locator('.chart-pattern-info').count() === 0);
    await page.evaluate(() => { __g09.pat.minQ = 60; __g09.chipPaint(); });
    await start(); await page.evaluate(() => __intervals.setMarket('LTCUSDT', '1h')); await page.waitForTimeout(650); await end();
    check('Coinwechsel bricht laufenden Druck ab und öffnet kein BTC-Muster', !await shown() && !await page.locator('#pat-overview-info').isVisible() && await selection() === '[]'); await load();

    await page.evaluate(() => { window.__m93Trace=[];for(const name of ['pointerdown','pointermove','pointerup','scroll','blur'])document.addEventListener(name,e=>{const b=document.querySelector('.chart-pattern-chip'),r=b?.getBoundingClientRect();__m93Trace.push({name,target:e.target.id||e.target.className,x:e.clientX,y:e.clientY,isPrimary:e.isPrimary,pointerType:e.pointerType,button:e.button,scrollY,top:r?.top,left:r?.left,disabled:b?.disabled,caption:document.getElementById('chart-pattern-overview')?.textContent});if(__m93Trace.length>35)__m93Trace.shift();},{capture:true,passive:true}); });
    await tile.scrollIntoViewIfNeeded(); const mouse = await point(); await page.mouse.move(mouse.x, mouse.y); await page.mouse.down();
    try { await page.waitForFunction(() => document.getElementById('pat-info').open); }
    catch(e) { console.log('Maus-Haltebefund',await page.evaluate(({mouse,key})=>({trace:__m93Trace,hit:document.elementFromPoint(mouse.x,mouse.y)?.outerHTML.slice(0,1000),wanted:document.querySelector(`button[data-pattern-key="${key}"]`)?.getBoundingClientRect().toJSON(),rows:__g09.chipRows().map(r=>({id:r.hit.id,key:r.key,status:r.status,score:r.score,disabled:r.disabled})),overview:document.getElementById('chart-pattern-overview')?.textContent}),{mouse,key:row.key}));throw e; }
    await page.mouse.up();
    check('Langer Mausklick erklärt ohne Zeichnungsklick', await shown() && await selection() === '[]'); await close();
    await tile.click({ button: 'right' });
    check('Rechtsklick öffnet Erklärung anstelle des Browser-Kontextmenüs', await shown() && await selection() === '[]'); await close();
    await info.focus(); await page.keyboard.press('Enter');
    check('Info-Knopf per Tastatur erreichbar', await shown() && await selection() === '[]'); await page.keyboard.press('Escape');
    check('Escape schließt Erklärung', !await shown());
    await tile.focus(); await page.keyboard.press('Enter');
    check('Tastatur am Muster schaltet weiterhin die Zeichnung', await selection() !== '[]' && !await shown()); await tile.click();

    await page.evaluate(key => { const r = __g09.chipRows().find(r => r.key === key); r.hit.status = 'ungültig'; __g09.chipPaint(); }, row.key);
    await info.click();
    check('Ungültiges Muster bleibt über Info erklärbar, Zeichnung und Zoom gesperrt', await shown() && await tile.isDisabled() && await page.locator('#pat-info-zoom').isDisabled() && await selection() === '[]' && (await page.locator('#pat-info-body').innerText()).includes('Status: ungültig')); await close();
    // Der aktive Info-Knopf muss auch an einer abgegrauten, gesperrten Kachel lesbar bleiben.
    const infoContrast = () => page.evaluate(key => {
      const button = document.querySelector(`button[data-pattern-info-key="${key}"]`), tile = button.parentElement;
      const rgb = text => text.match(/[\d.]+/g).slice(0, 3).map(Number), hex = values => '#' + values.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
      let alpha = 1; for (let n = button; n; n = n.parentElement) alpha *= Number(getComputedStyle(n).opacity);
      let backdrop = tile.parentElement; while (backdrop.parentElement && getComputedStyle(backdrop).backgroundColor === 'rgba(0, 0, 0, 0)') backdrop = backdrop.parentElement;
      const base = rgb(getComputedStyle(backdrop).backgroundColor), mix = values => values.map((v, i) => alpha * v + (1 - alpha) * base[i]);
      return { opacity: alpha, contrast: __sdAppearance.contrast(hex(mix(rgb(getComputedStyle(button).color))), hex(mix(rgb(getComputedStyle(tile).backgroundColor)))) };
    }, row.key);
    await page.click('#view-menu');
    for (const mode of ['light', 'dark']) {
      await page.click(`[data-theme-set=${mode}]`); const result = await infoContrast();
      check(mode + ': aktiver Info-Knopf an ungültigem Muster mit mindestens 4,5:1', result.contrast >= 4.5, result);
    }
    await page.click('[data-theme-set=custom]');
    for (const { name, color } of await page.evaluate(() => __sdAppearance.palette)) {
      await page.click(`[data-background-color="${color}"]`); const result = await infoContrast();
      check(name + ': aktiver Info-Knopf an ungültigem Muster mit mindestens 4,5:1', result.contrast >= 4.5, result);
    }
    await page.click('[data-theme-set=dark]'); await page.click('#view-menu');
    await page.evaluate(({ key, status }) => { __g09.chipRows().find(r => r.key === key).hit.status = status; __g09.chipPaint(); }, row);

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await info.scrollIntoViewIfNeeded();
      const rect = await info.boundingBox();
      check(width + 'px: Info mit mindestens 44×44px, kein Seitenüberlauf', rect.width >= 44 && rect.height >= 44 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), rect);
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.click('#chart-full'); await page.click('#fb-tools'); await info.click();
    check('Erklärung auch aus den Vollbild-Werkzeugen erreichbar', await shown() && await page.locator('#pat-info-x').isVisible()); await close(); await page.click('#fb-exit');
    await info.click(); await page.evaluate(async () => { await __intervals.setMarket('LTCUSDT', '1h'); __g09.run('Test'); });
    await page.waitForFunction(key => __g09.pat.res?.key.startsWith('LTCUSDT|') && __g09.chipRows().some(r => r.key === key), row.key);
    await page.click('#pat-info-zoom');
    check('Nach Coinwechsel zoomt alte Erklärung trotz identischer Muster-ID nicht in den neuen Coin', await page.evaluate(() => __g05.state.symbol === 'LTCUSDT' && !__g09.pat.on && __g09.pat.sel === null)); await load();
    await info.click(); await page.evaluate(() => __g09.pat.res.hits.reverse()); await page.click('#pat-info-zoom');
    check('Im Chart zeigen findet nach neuer Ergebnissortierung dasselbe Muster', await page.evaluate(key => { const s = __g09.pat; return s.on && s.res.hits[s.sel] && s.res.hits[s.sel].id + '|' + s.res.hits[s.sel].t0 === key; }, row.key));
    check('Erklärungszugriffe verändern keine Positionen, Alarme oder Lernfälle', await page.evaluate(b => JSON.stringify(__g05.state.positions) === b.positions && JSON.stringify(__g05.state.alarms) === b.alarms && localStorage.getItem('scalpdesk.patknow.v1') === b.learned, snapshot));
    if (errors.length) console.log('Laufzeitfehler', errors); check('Keine JavaScript-Laufzeitfehler', errors.length === 0);
    await ctx.close();
  } finally { await browser.close(); await h.teardown(); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
