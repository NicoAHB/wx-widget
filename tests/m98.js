// 3.68.0: KI-Zonen im nativen Chart – Knopf „Zonen“, Speicherung, Zeichnung hinter den Kerzen, Details, Zwischenspeicher je Zeitrahmen.
const h = require('./harness');
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + String(detail).slice(0, 300) : ''}`); };
(async () => {
  await h.setup(); await h.ctl('/reset'); const browser = await h.launch({ workspace: 'fresh' });
  try {
    for (const [width, height] of [[390, 844], [1440, 900]]) {
      const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 800, hasTouch: width < 800 }), page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => window.__g05?.state.candles.length > 100 && window.__kiz);
      await page.locator('#chart').scrollIntoViewIfNeeded(); await page.waitForFunction(() => document.querySelector('#chart svg'));
      await page.evaluate(() => __intervals.setMarket(__g05.state.symbol, '15m')); await page.waitForFunction(() => __g05.state.interval === '15m' && !__g05.state.busy && __g05.state.loadedSymbol === __g05.state.symbol);
      const button = await page.evaluate(() => { const b = document.getElementById('zones-btn'), m = document.getElementById('magnet'), k = document.getElementById('pat-btn'); return { text: b.textContent, pressed: b.getAttribute('aria-pressed'), afterMagnet: m.nextElementSibling === b, sameBar: k.parentElement === b.parentElement, zones: document.querySelectorAll('#chart .kiz-zone').length, h: b.getBoundingClientRect().height }; });
      check(`${width}px: Knopf „Zonen“ neben KI und Magnet, standardmäßig aus (grau), keine Zonen`, button.text === 'Zonen' && button.pressed === 'false' && button.afterMagnet && button.sameBar && button.zones === 0, JSON.stringify(button));
      await page.click('#zones-btn'); await page.waitForFunction(() => document.querySelectorAll('#chart .kiz-zone').length > 0);
      const on = await page.evaluate(() => { const svg = document.querySelector('#chart svg'), zone = svg.querySelector('.kiz-zone'), group = zone.parentNode, kids = [...svg.children], candle = kids.find((n, i) => i > kids.indexOf(group) && n.tagName === 'rect'); const res = __kiz.now(); return { pressed: document.getElementById('zones-btn').getAttribute('aria-pressed'), stored: JSON.parse(localStorage.getItem('scalpdesk.kizones.v1')), zones: document.querySelectorAll('#chart .kiz-zone').length, labels: [...document.querySelectorAll('#chart .kiz-label text')].map(t => t.textContent), behind: kids.indexOf(group) >= 0 && !!candle, max3: res.buy.length <= 3 && res.sell.length <= 3, colors: [...document.querySelectorAll('#chart .kiz-zone')].map(r => r.dataset.side + ':' + r.dataset.broken) }; });
      check(`${width}px: Einschalten grün, Zustand gespeichert, höchstens 3 Kauf- und 3 Verkaufszonen`, on.pressed === 'true' && on.stored?.on === true && on.zones > 0 && on.zones <= 6 && on.max3, JSON.stringify(on.colors));
      check(`${width}px: Zonen liegen hinter den Kerzen (eigene Ebene vor den Kerzenkörpern)`, on.behind);
      check(`${width}px: Beschriftung mit Preisbereich und Score`, on.labels.length === on.zones && on.labels.every(t => /^(Kauf|Verk\.|Verkauf) [\d.,]+–[\d.,]+ · \d{1,3}/.test(t)), on.labels.join(' | '));
      const geometry = await page.evaluate(() => { const svg = document.querySelector('#chart svg'), clip = svg.querySelector('#plot-clip rect'), right = +clip.getAttribute('x') + +clip.getAttribute('width'); return [...svg.querySelectorAll('.kiz-zone')].every(r => Math.abs(+r.getAttribute('x') + +r.getAttribute('width') - right) < 1.5); });
      check(`${width}px: Zonen reichen bis zum rechten Chartrand`, geometry);
      const label = page.locator('#chart .kiz-label').first(), box = await label.boundingBox();
      if (width < 800) await page.touchscreen.tap(box.x + box.width - 12, box.y + box.height / 2); else await page.mouse.click(box.x + box.width - 12, box.y + box.height / 2);
      await page.waitForFunction(() => /KI-(Kauf|Verkaufs)zone/.test(document.getElementById('toasts').textContent));
      const toast = await page.evaluate(() => document.getElementById('toasts').textContent);
      check(`${width}px: Antippen zeigt Details (Berührungen, Volumen, Score)`, /Berührung/.test(toast) && /Score \d+\/100/.test(toast) && /Volumen/.test(toast), toast.slice(0, 200));
      const runs = await page.evaluate(() => __kiz.state.runs); await page.click('#zones-btn'); await page.waitForTimeout(150);
      const off = await page.evaluate(() => ({ zones: document.querySelectorAll('#chart .kiz-zone').length, pressed: document.getElementById('zones-btn').getAttribute('aria-pressed'), stored: JSON.parse(localStorage.getItem('scalpdesk.kizones.v1')) }));
      await page.click('#zones-btn'); await page.waitForTimeout(150);
      check(`${width}px: Aus/Ein sofort ohne Neuberechnung`, off.zones === 0 && off.pressed === 'false' && off.stored.on === false && await page.evaluate(r => __kiz.state.runs === r && document.querySelectorAll('#chart .kiz-zone').length > 0, runs));
      await page.evaluate(() => __intervals.setMarket(__g05.state.symbol, '1h')); await page.waitForFunction(() => __g05.state.interval === '1h' && !__g05.state.busy && document.querySelectorAll('#chart .kiz-zone').length > 0);
      const afterTf = await page.evaluate(r => __kiz.state.runs - r, runs);
      await page.evaluate(() => __intervals.setMarket(__g05.state.symbol, '15m')); await page.waitForFunction(() => __g05.state.interval === '15m' && !__g05.state.busy);
      await page.waitForTimeout(300);
      const back = await page.evaluate(r => ({ delta: __kiz.state.runs - r, size: __kiz.state.cache.size, keys: [...__kiz.state.cache.keys()] }), runs);
      check(`${width}px: Zeitrahmenwechsel rechnet neu, Rückkehr nutzt den Zwischenspeicher`, afterTf >= 1 && back.delta === afterTf && back.size >= 2, JSON.stringify({ afterTf, back }));
      await page.evaluate(() => __intervals.setMarket(__g05.state.symbol, '1m')); await page.waitForFunction(() => __g05.state.interval === '1m' && !__g05.state.busy);
      check(`${width}px: 1m außerhalb 5m–1d: keine Zonen, kein Fehler`, await page.evaluate(() => document.querySelectorAll('#chart .kiz-zone').length === 0));
      await page.reload(); await page.waitForFunction(() => window.__kiz && window.__g05?.state.candles.length > 100);
      check(`${width}px: Zustand „an“ übersteht Neustart`, await page.evaluate(() => __kiz.state.on && document.getElementById('zones-btn').getAttribute('aria-pressed') === 'true'));
      check(`${width}px: kein Seitenüberlauf, keine JavaScript-Fehler`, errors.length === 0 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), errors.join(' | '));
      await ctx.close();
    }
  } finally { await browser.close(); await h.teardown(); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
