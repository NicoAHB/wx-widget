// 3.68.0: KI-Zonen im nativen Chart – Knopf „Zonen“, Speicherung, Zeichnung hinter den Kerzen, Details, Zwischenspeicher je Zeitrahmen.
// 3.68.1: drei Zustände (Zonen → Starke Zonen → Zonen ausblenden), starke Zonen mit Konfluenz-Score, Faktoren beim Antippen.
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
      const on = await page.evaluate(() => { const svg = document.querySelector('#chart svg'), zone = svg.querySelector('.kiz-zone'), group = zone.parentNode, kids = [...svg.children], candle = kids.find((n, i) => i > kids.indexOf(group) && n.tagName === 'rect'); const res = __kiz.now(); return { label: document.getElementById('zones-btn').textContent, mode: document.getElementById('zones-btn').dataset.mode, pressed: document.getElementById('zones-btn').getAttribute('aria-pressed'), stored: JSON.parse(localStorage.getItem('scalpdesk.kizones.v1')), zones: document.querySelectorAll('#chart .kiz-zone').length, labels: [...document.querySelectorAll('#chart .kiz-label text')].map(t => t.textContent), behind: kids.indexOf(group) >= 0 && !!candle, max3: res.buy.length <= 3 && res.sell.length <= 3, colors: [...document.querySelectorAll('#chart .kiz-zone')].map(r => r.dataset.side + ':' + r.dataset.broken) }; });
      check(`${width}px: 1. Klick: alle Zonen wie bisher, Knopf heißt „Starke Zonen“ (grün), Zustand gespeichert, höchstens 3 je Seite`, on.pressed === 'true' && on.stored?.mode === 'all' && on.label === 'Starke Zonen' && on.mode === 'all' && on.zones > 0 && on.zones <= 6 && on.max3, JSON.stringify(on.colors));
      check(`${width}px: Zonen liegen hinter den Kerzen (eigene Ebene vor den Kerzenkörpern)`, on.behind);
      check(`${width}px: Beschriftung mit Preisbereich und Score`, on.labels.length === on.zones && on.labels.every(t => /^(Kauf|Verk\.|Verkauf) [\d.,]+–[\d.,]+ · \d{1,3}/.test(t)), on.labels.join(' | '));
      const geometry = await page.evaluate(() => { const svg = document.querySelector('#chart svg'), clip = svg.querySelector('#plot-clip rect'), right = +clip.getAttribute('x') + +clip.getAttribute('width'); return [...svg.querySelectorAll('.kiz-zone')].every(r => Math.abs(+r.getAttribute('x') + +r.getAttribute('width') - right) < 1.5); });
      check(`${width}px: Zonen reichen bis zum rechten Chartrand`, geometry);
      const label = page.locator('#chart .kiz-label').first(), box = await label.boundingBox();
      if (width < 800) await page.touchscreen.tap(box.x + box.width - 12, box.y + box.height / 2); else await page.mouse.click(box.x + box.width - 12, box.y + box.height / 2);
      await page.waitForFunction(() => /KI-(Kauf|Verkaufs)zone/.test(document.getElementById('toasts').textContent));
      const toast = await page.evaluate(() => document.getElementById('toasts').textContent);
      check(`${width}px: Antippen zeigt Details (Berührungen, Volumen, Score)`, /Berührung/.test(toast) && /Score \d+\/100/.test(toast) && /Volumen/.test(toast), toast.slice(0, 200));
      // 2. Klick: nur starke Zonen (Konfluenz-Score), Hinweis; 3. Klick: aus; alles ohne Neuberechnung der Zonen
      const runs = await page.evaluate(() => { document.getElementById('toasts').replaceChildren(); return __kiz.state.runs; }); await page.click('#zones-btn'); await page.waitForTimeout(200);
      const strong = await page.evaluate(() => { const b = document.getElementById('zones-btn'), expected = __kiz.strong(__kiz.now()).length; return { label: b.textContent, mode: b.dataset.mode, bg: getComputedStyle(b).backgroundColor, stored: JSON.parse(localStorage.getItem('scalpdesk.kizones.v1')), toast: document.getElementById('toasts').textContent, drawn: document.querySelectorAll('#chart .kiz-zone.kiz-strong').length, plain: document.querySelectorAll('#chart .kiz-zone:not(.kiz-strong)').length, expected, labels: [...document.querySelectorAll('#chart .kiz-label text')].map(t => t.textContent), nowrap: b.scrollHeight <= b.clientHeight + 2 && getComputedStyle(b).whiteSpace === 'nowrap' }; });
      check(`${width}px: 2. Klick: nur starke Zonen, Knopf heißt „Zonen ausblenden“ (kräftiges Grün), ohne Zeilenumbruch`, strong.label === 'Zonen ausblenden' && strong.mode === 'strong' && strong.stored.mode === 'strong' && strong.plain === 0 && strong.nowrap && strong.bg !== on.bg, JSON.stringify({ bg: strong.bg, plain: strong.plain }));
      check(`${width}px: Hinweis beim Wechsel auf starke Zonen (mehrere unabhängige Faktoren, Score ≥ 70, keine Garantie)`, /mehrere unabhängige Faktoren/.test(strong.toast) && /Score ≥ 70/.test(strong.toast) && /Entscheidungshilfe, keine Garantie/.test(strong.toast) && !/sicher/i.test(strong.toast), strong.toast.slice(0, 160));
      check(`${width}px: starke Zonen = Regel-Ergebnis (Score ≥ Schwelle, ≥ 3 Gruppen), Label mit ★ und Score`, strong.drawn <= strong.expected && strong.labels.every(t => /^★ (Kauf|Verk\.|Verkauf) [\d.,]+–[\d.,]+ · \d{2,3}/.test(t)), JSON.stringify(strong.labels));
      if (strong.drawn) {
        await page.waitForTimeout(300); const lb = await page.evaluate(() => { document.getElementById('toasts').replaceChildren(); const r = document.querySelector('#chart .kiz-label').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
        if (width < 800) await page.touchscreen.tap(lb.x + lb.width - 12, lb.y + lb.height / 2); else await page.mouse.click(lb.x + lb.width - 12, lb.y + lb.height / 2);
        await page.waitForFunction(() => /Starke (Kauf|Verkaufs)zone/.test(document.getElementById('toasts').textContent)); const t = await page.evaluate(() => document.getElementById('toasts').textContent);
        check(`${width}px: Antippen einer starken Zone listet die erfüllten Faktoren`, /Score \d+\/100 aus [3-5] Faktorgruppen/.test(t) && / \+ /.test(t) && /Entscheidungshilfe, keine Garantie/.test(t) && !/sichere/i.test(t), t.slice(0, 200));
      } else check(`${width}px: keine starke Zone in den Testdaten – Hinweis sagt das ehrlich`, /Gerade keine starke Zone/.test(strong.toast), strong.toast.slice(0, 120));
      await page.click('#zones-btn'); await page.waitForTimeout(150);
      const off = await page.evaluate(() => ({ zones: document.querySelectorAll('#chart .kiz-zone').length, label: document.getElementById('zones-btn').textContent, pressed: document.getElementById('zones-btn').getAttribute('aria-pressed'), stored: JSON.parse(localStorage.getItem('scalpdesk.kizones.v1')) }));
      await page.click('#zones-btn'); await page.waitForTimeout(150);
      check(`${width}px: 3. Klick blendet aus („Zonen“), Zyklus ohne Neuberechnung`, off.zones === 0 && off.label === 'Zonen' && off.pressed === 'false' && off.stored.mode === 'off' && await page.evaluate(r => __kiz.state.runs === r && __kiz.state.mode === 'all' && document.querySelectorAll('#chart .kiz-zone').length > 0, runs));
      await page.evaluate(() => __intervals.setMarket(__g05.state.symbol, '1h')); await page.waitForFunction(() => __g05.state.interval === '1h' && !__g05.state.busy && document.querySelectorAll('#chart .kiz-zone').length > 0);
      const afterTf = await page.evaluate(r => __kiz.state.runs - r, runs);
      await page.evaluate(() => __intervals.setMarket(__g05.state.symbol, '15m')); await page.waitForFunction(() => __g05.state.interval === '15m' && !__g05.state.busy);
      await page.waitForTimeout(300);
      const back = await page.evaluate(r => ({ delta: __kiz.state.runs - r, size: __kiz.state.cache.size, keys: [...__kiz.state.cache.keys()] }), runs);
      check(`${width}px: Zeitrahmenwechsel rechnet neu, Rückkehr nutzt den Zwischenspeicher`, afterTf >= 1 && back.delta === afterTf && back.size >= 2, JSON.stringify({ afterTf, back }));
      await page.evaluate(() => __intervals.setMarket(__g05.state.symbol, '1m')); await page.waitForFunction(() => __g05.state.interval === '1m' && !__g05.state.busy);
      check(`${width}px: 1m außerhalb 5m–1d: keine Zonen, kein Fehler`, await page.evaluate(() => document.querySelectorAll('#chart .kiz-zone').length === 0));
      await page.reload(); await page.waitForFunction(() => window.__kiz && window.__g05?.state.candles.length > 100);
      check(`${width}px: Zustand „alle“ übersteht Neustart`, await page.evaluate(() => __kiz.state.mode === 'all' && document.getElementById('zones-btn').textContent === 'Starke Zonen'));
      await page.evaluate(() => localStorage.setItem('scalpdesk.kizones.v1', JSON.stringify({ on: true }))); await page.reload(); await page.waitForFunction(() => window.__kiz);
      check(`${width}px: gespeichertes „an“ aus 3.68.0 wird zu „alle Zonen“`, await page.evaluate(() => __kiz.state.mode === 'all'));
      check(`${width}px: kein Seitenüberlauf, keine JavaScript-Fehler`, errors.length === 0 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), errors.join(' | '));
      await ctx.close();
    }
  } finally { await browser.close(); await h.teardown(); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
