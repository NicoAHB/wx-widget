// Chart im Vollbild: Kopfzeile, Werkzeuge standardmäßig eingeklappt, Ein-/Ausklappen, Kurs-Wechsler BTC ↔ vorheriges Paar,
// gedrehtes Querformat am iPhone, schließen per Enter/Esc/Symbol. Aufruf: node m10.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const views = [['Desktop 1440×900', { viewport: { width: 1440, height: 900 } }, 'Enter'], ['iPhone hochkant 390×844', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, 'Symbol'], ['Handy quer 844×390', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }, 'Escape']];
// Lage in Chart-Koordinaten (offset*), damit es auch im gedrehten Vollbild stimmt
const st = page => page.evaluate(() => {
  const sec = document.getElementById('chart-sec'), ch = document.getElementById('chart'), o = s => { const e = document.querySelector(s); return { top: e.offsetTop, h: e.offsetHeight, left: e.offsetLeft, w: e.offsetWidth, vis: getComputedStyle(e).visibility }; };
  return { on: document.documentElement.dataset.chartfull === '1', bar: document.documentElement.dataset.chartbar || '', rot: getComputedStyle(sec).transform !== 'none', secW: sec.offsetWidth, secH: sec.offsetHeight,
    chartH: ch.offsetHeight, chartW: ch.offsetWidth, tools: o('.chart-toolbar'), toggles: o('.overlay-toggles'), chart: o('#chart'), fbar: o('#full-bar'), swap: { ...o('#fb-swap'), hidden: document.getElementById('fb-swap').hidden, sym: document.getElementById('fb-sym').textContent, price: document.getElementById('fb-price').textContent },
    title: document.getElementById('fb-title').textContent, y: Math.round(scrollY), vw: innerWidth, vh: innerHeight, sw: document.scrollingElement.scrollWidth, tabbar: getComputedStyle(document.querySelector('.tabbar') || document.body).display };
});
// 3.62.0: echte Bildschirmränder und verbleibende Charthöhe in der neuen Bereichssicht prüfen.
const fullSize = async page => {
  // Nach dem Einblenden kann eine Live-/Infobox die Höhe nochmals ändern; den echten ResizeObserver-Neuzeichner abwarten.
  await page.waitForFunction(() => {
    const ch = document.getElementById('chart'), svg = ch.querySelector('svg');
    return svg && Math.abs(svg.viewBox.baseVal.width - ch.clientWidth) <= 1 && Math.abs(svg.viewBox.baseVal.height - ch.clientHeight) <= 1;
  }, null, { timeout: 3000 });
  return page.evaluate(() => {
  const sec = document.getElementById('chart-sec'), ch = document.getElementById('chart'), css = getComputedStyle(sec);
  const rect = Element.prototype.getBoundingClientRect.call(sec), svg = ch.querySelector('svg');
  return { on: document.documentElement.dataset.chartfull === '1', display: css.display, rot: css.transform !== 'none',
    viewport: [innerWidth, innerHeight], edges: [rect.left, rect.top, rect.right, rect.bottom],
    chart: [ch.offsetWidth, ch.offsetHeight], remaining: sec.clientHeight - parseFloat(css.paddingBottom) - ch.offsetTop,
    svg: svg ? [svg.viewBox.baseVal.width, svg.viewBox.baseVal.height] : [],
    bar: document.documentElement.dataset.chartbar || '', native: document.documentElement.dataset.fsnative === '1' };
  });
};
const fillsScreen = g => g.on && g.display === 'flex' && g.edges.every((v, i) => Math.abs(v - [0, 0, ...g.viewport][i]) <= 1)
  && Math.abs(g.chart[1] - g.remaining) <= 1 && g.chart[1] >= 160 && g.svg.every((v, i) => Math.abs(v - g.chart[i]) <= 1) && g.svg.length === 2;
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset');
  const browser = await h.launch();
  try {
    for (const [name, view, how] of views) {
      const ctx = await browser.newContext(view), page = await ctx.newPage(), errors = []; h.collect(page, errors);
      const kb = !view.isMobile, wait = ms => page.waitForTimeout(ms);
      await page.goto(h.URL_BASE + '/weather-widget-v2.html');
      await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
      await page.fill('#symbol', 'ETH'); await page.press('#symbol', 'Enter');
      await page.waitForFunction(() => document.getElementById('lb-sym').textContent === 'ETH', null, { timeout: 15000 }).catch(() => {}); await wait(1500);
      await page.evaluate(() => document.getElementById('chart-full').scrollIntoView({ block: 'center' })); await wait(300);
      const g0 = await st(page);
      await page.click('#chart-full'); await wait(900);
      const g1 = await st(page);
      check(`${name}: Vollbild öffnet, Werkzeuge eingeklappt, Chart nutzt die volle Höhe`, g1.on && !g1.bar && g1.tools.vis === 'hidden' && g1.tools.h <= 1 && g1.chartH >= g1.secH * .78 && g1.sw <= g1.vw, JSON.stringify({ chart: `${g1.chartW}×${g1.chartH}`, sec: `${g1.secW}×${g1.secH}`, tools: g1.tools.h, rot: g1.rot }));
      if (view.isMobile && view.viewport.height > view.viewport.width) check(`${name}: automatisch ins Querformat gedreht`, g1.rot && g1.secW > g1.secH && g1.chartW > g1.chartH);
      if (view.isMobile) check(`${name}: untere Tab-Leiste ausgeblendet`, g1.tabbar === 'none', g1.tabbar);
      check(`${name}: oben rechts der BTC-Kurs`, !g1.swap.hidden && g1.swap.sym === 'BTC' && /\d/.test(g1.swap.price) && g1.swap.left + g1.swap.w >= g1.fbar.w - 70 && g1.fbar.top <= 16, JSON.stringify({ sym: g1.swap.sym, price: g1.swap.price, rechts: g1.fbar.w - g1.swap.left - g1.swap.w }));
      // Werkzeuge einblenden: Zeiträume, Zoom, Ebenen und OHLC; Chart wird kleiner
      await page.click('#fb-tools'); await wait(600);
      const g2 = await st(page);
      check(`${name}: Werkzeuge einblenden – Chart schrumpft flüssig mit`, g2.bar === 'open' && g2.tools.vis === 'visible' && g2.tools.h > 20 && g2.chartH < g1.chartH - 30 && g2.tools.top < g2.toggles.top && g2.toggles.top < g2.chart.top, JSON.stringify({ tools: g2.tools.h, chart: g1.chartH + ' → ' + g2.chartH }));
      await page.click('[data-overlay="ema200"]'); await wait(300); const off = await page.getAttribute('[data-overlay="ema200"]', 'aria-pressed');
      await page.click('[data-overlay="ema200"]'); await wait(300); const on = await page.getAttribute('[data-overlay="ema200"]', 'aria-pressed');
      check(`${name}: Ebene EMA 200 im Vollbild aus- und einblenden`, off === 'false' && on === 'true', `${off} → ${on}`);
      if (kb) { await page.focus('#chart'); await page.keyboard.press('t'); } else await page.click('#fb-tools');
      await wait(600); const g3 = await st(page);
      check(`${name}: Werkzeuge wieder ausblenden (${kb ? 'Taste T' : 'Tippen'}) – Chart wieder volle Höhe`, !g3.bar && g3.tools.vis === 'hidden' && Math.abs(g3.chartH - g1.chartH) <= 2, `${g2.chartH} → ${g3.chartH}`);
      // Wechsel zu BTC und zurück
      if (kb) await page.keyboard.press('b'); else await page.click('#fb-swap');
      const toBtc = await page.waitForFunction(() => document.getElementById('fb-title').textContent.startsWith('BTC') && document.getElementById('fb-sym').textContent === 'ETH' && /\d/.test(document.getElementById('fb-price').textContent), null, { timeout: 15000 }).then(() => true, () => false);
      const g4 = await st(page);
      check(`${name}: ${kb ? 'Taste B' : 'Tippen auf BTC'} öffnet den BTC-Chart, oben rechts steht jetzt ETH mit Kurs`, toBtc && g4.on, JSON.stringify({ titel: g4.title, rechts: `${g4.swap.sym} ${g4.swap.price}` }));
      await page.click('#fb-swap');
      const back = await page.waitForFunction(() => document.getElementById('fb-title').textContent.startsWith('ETH') && document.getElementById('fb-sym').textContent === 'BTC', null, { timeout: 15000 }).then(() => true, () => false);
      check(`${name}: Tippen auf ETH führt zurück zum ETH-Chart im Vollbild`, back && (await st(page)).on);
      if (g1.rot) {
        // Zeiger im gedrehten Chart: gleiche Chart-x → gleiche Kerze, andere Chart-x → andere Kerze
        await wait(1200);
        const pick = (fx, fy) => page.evaluate(([fx, fy]) => { const ch = document.getElementById('chart'), R = Element.prototype.getBoundingClientRect.call(ch), t = ch.querySelector('svg') || ch;
          t.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', pointerId: 7, clientX: R.right - fy * ch.offsetHeight, clientY: R.top + fx * ch.offsetWidth }));
          return document.getElementById('ohlc').textContent; }, [fx, fy]);
        const a = await pick(.3, .5), b = await pick(.3, .2), c = await pick(.8, .5);
        check(`${name}: Zeiger im gedrehten Chart treffen die richtige Kerze`, a && a === b && a !== c, JSON.stringify({ a: a.slice(0, 30), c: c.slice(0, 30) }));
      }
      if (how === 'Symbol') await page.click('#fb-exit'); else { await page.focus('#chart'); await page.keyboard.press(how); }
      await wait(700);
      const g5 = await st(page);
      check(`${name}: beenden per ${how === 'Symbol' ? 'Minimieren-Symbol' : how === 'Enter' ? 'Enter' : 'Esc'} – Seite wie vorher`, !g5.on && !g5.rot && Math.abs(g5.chartH - g0.chartH) <= 1 && Math.abs(g5.y - g0.y) <= 2, `Chart ${g5.chartH} px, scrollY ${g0.y} → ${g5.y}`);
      check(`${name}: keine Fehler`, !errors.length, errors.join(' | ')); await ctx.close();
    }
    // iPhone ohne Rotationssperre: die Seite dreht sich selbst quer – die App merkt sich das und dreht nicht zusätzlich
    {
      const name = 'iPhone ohne Rotationssperre', ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
      await page.goto(h.URL_BASE + '/weather-widget-v2.html');
      await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1200);
      const rot = () => page.evaluate(() => ({ on: document.documentElement.dataset.chartfull === '1', rot: getComputedStyle(document.getElementById('chart-sec')).transform !== 'none', native: document.getElementById('fb-rot').getAttribute('aria-pressed') === 'false', btn: getComputedStyle(document.getElementById('fb-rot')).display, pressed: document.getElementById('fb-rot').getAttribute('aria-pressed'), chart: `${document.getElementById('chart').offsetWidth}×${document.getElementById('chart').offsetHeight}` }));
      await page.evaluate(() => document.getElementById('chart-full').scrollIntoView({ block: 'center' })); await page.click('#chart-full'); await page.waitForTimeout(1000);
      const a = await rot();
      check(`${name}: erstes Öffnen hochkant – App dreht ins Querformat`, a.on && a.rot && !a.native && a.btn !== 'none' && a.pressed === 'true', JSON.stringify(a));
      await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(600); const b = await rot();
      check(`${name}: iPhone quer gedreht – iOS dreht selbst, App dreht nicht zusätzlich und merkt es sich`, b.on && !b.rot && b.native, JSON.stringify(b));
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(600); const c = await rot();
      check(`${name}: zurück hochkant – keine erneute App-Drehung`, c.on && !c.rot && c.native && c.pressed === 'false', JSON.stringify(c));
      await page.click('#fb-exit'); await page.waitForTimeout(500); await page.click('#chart-full'); await page.waitForTimeout(1000); const d = await rot();
      check(`${name}: nächstes Öffnen – gemerkt, iOS übernimmt das Drehen`, d.on && !d.rot && d.native, JSON.stringify(d));
      await page.click('#fb-rot'); await page.waitForTimeout(500); const e = await rot();
      check(`${name}: Knopf ⟳ schaltet die App-Drehung wieder ein (für Rotationssperre)`, e.on && e.rot && !e.native && e.pressed === 'true', JSON.stringify(e));
      check(`${name}: keine Fehler`, !errors.length, errors.join(' | ')); await ctx.close();
    }
    // Die alten Fälle prüfen weiter die Gesamtansicht. Hier ausdrücklich die neue Bereichssicht ohne Klickumleitung.
    for (const presentation of ['standard', 'dashboard']) for (const [width, height] of [[320, 780], [390, 844], [768, 1024], [1440, 900]]) {
      const phone = width <= 600, name = `Bereichssicht/${presentation}/${width}×${height}`;
      const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: width < 1000 });
      await ctx.addInitScript(presentation => {
        localStorage.setItem('scalpdesk.workspace.v1', JSON.stringify({ v: 1, mode: 'focus', view: 'chart', folds: {} }));
        localStorage.setItem('scalpdesk.presentation.v1', JSON.stringify(presentation));
      }, presentation);
      const page = await ctx.newPage(), errors = []; h.collect(page, errors);
      await page.goto(h.URL_BASE + '/weather-widget-v2.html');
      await page.waitForFunction(() => window.__g05?.state.candles.length > 100);
      await page.locator('#chart-full').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
      await page.waitForFunction(() => document.querySelector('#chart svg'));
      const before = await st(page); await page.evaluate(() => { window.fullSizeOriginal = document.getElementById('chart'); });
      await page.tap('#chart-full'); await page.waitForTimeout(700); let g = await fullSize(page);
      check(`${name}: Vollbild füllt den Bildschirm samt gezeichnetem Chart`, fillsScreen(g) && g.rot === phone, JSON.stringify(g));
      if (phone) {
        await page.tap('#fb-rot'); await page.waitForTimeout(600); g = await fullSize(page);
        check(`${name}: ungedrehtes Hochformat nutzt die gesamte übrige Höhe`, fillsScreen(g) && !g.rot && g.native && g.chart[1] > g.chart[0], JSON.stringify(g));
      }
      const closedHeight = g.chart[1]; await page.tap('#fb-tools'); await page.waitForTimeout(600); g = await fullSize(page);
      check(`${name}: geöffnete Werkzeuge bleiben erreichbar, Chart endet am unteren Rand`, fillsScreen(g) && g.bar === 'open' && g.chart[1] < closedHeight - 30, JSON.stringify(g));
      await page.tap('#fb-tools'); await page.waitForTimeout(600); g = await fullSize(page);
      check(`${name}: Werkzeuge zu – volle Charthöhe wiederhergestellt`, fillsScreen(g) && !g.bar && Math.abs(g.chart[1] - closedHeight) <= 1, JSON.stringify(g));
      if (phone) {
        await page.setViewportSize({ width: height, height: width }); await page.waitForTimeout(600); g = await fullSize(page);
        check(`${name}: echtes Querformat ohne Abschneiden oder zweite Drehung`, fillsScreen(g) && !g.rot, JSON.stringify(g));
        await page.setViewportSize({ width, height }); await page.waitForTimeout(600); g = await fullSize(page);
        check(`${name}: zurück im Hochformat weiterhin bildschirmfüllend`, fillsScreen(g) && !g.rot && g.native, JSON.stringify(g));
      }
      await page.tap('#fb-exit'); await page.waitForTimeout(600); const after = await st(page);
      check(`${name}: ursprünglicher Chart und Seitenposition nach Beenden erhalten`, !after.on && !after.rot && Math.abs(after.chartH - before.chartH) <= 1 && Math.abs(after.y - before.y) <= 2 && await page.evaluate(() => document.getElementById('chart') === fullSizeOriginal), JSON.stringify({ before, after }));
      if (phone) {
        await page.reload(); await page.waitForFunction(() => window.__g05?.state.candles.length > 100);
        await page.tap('#chart-full'); await page.waitForTimeout(700); g = await fullSize(page);
        check(`${name}: gemerkte Hochformatwahl nach Neuladen weiterhin bildschirmfüllend`, fillsScreen(g) && !g.rot && g.native, JSON.stringify(g));
        await page.tap('#fb-exit');
      }
      check(`${name}: keine Fehler`, !errors.length, errors.join(' | ')); await ctx.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
