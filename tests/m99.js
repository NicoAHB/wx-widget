// 3.68.1: Starke Zonen – Backtest ohne Look-Ahead (Schritt 2) und Ein-/Ausstiegssignale (Schritt 3) im nativen Chart.
const h = require('./harness');
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + String(detail).slice(0, 300) : ''}`); };
(async () => {
  await h.setup(); await h.ctl('/reset'); const browser = await h.launch({ workspace: 'fresh' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => window.__g05?.state.candles.length > 100 && window.__zs);
    await page.evaluate(() => __intervals.setMarket(__g05.state.symbol, '15m')); await page.waitForFunction(() => __g05.state.interval === '15m' && !__g05.state.busy && __g05.state.candles.length > 300);
    // ---- Schritt 2: Backtest ----
    const panel = await page.evaluate(() => { const d = document.getElementById('zone-lab'); return { exists: !!d, closed: !d.open, inChart: !!d.closest('#chart-sec'), lev: document.getElementById('zs-leverage').value, text: d.textContent }; });
    check('Klappfläche „Starke Zonen · Signale & Backtest“ im Chartbereich, anfangs zu, Hebel 5×', panel.exists && panel.closed && panel.inChart && panel.lev === '5' && /Entscheidungshilfe, keine Garantie/.test(panel.text) && !/sichere Zone/i.test(panel.text));
    await page.evaluate(() => { const d = document.getElementById('zone-lab'); d.open = true; d.scrollIntoView(); });
    await page.fill('#zs-leverage', '10'); await page.dispatchEvent('#zs-leverage', 'change');
    check('Hebel einstellbar und gespeichert, Liquidationsabstand erklärt', await page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.zonesig.v1')).leverage === 10 && /Hebel 10×: Liquidation etwa 9,5 %/.test(document.getElementById('zs-lev-note').textContent)));
    await page.click('#zs-bt-run'); await page.waitForFunction(() => !__zs.state.busy && window.__zoneBacktest, null, { timeout: 120000 });
    const bt = await page.evaluate(() => ({ rows: [...document.querySelectorAll('#zs-bt-table tbody tr')].map(tr => [...tr.cells].map(c => c.textContent)), head: [...document.querySelectorAll('#zs-bt-table thead th')].map(t => t.textContent), status: document.getElementById('zs-bt-status').textContent, tests: __zoneBacktest.tests.length, lev: __zoneBacktest.leverage }));
    check('Tabelle je Score-Stufe <50 / 50–69 / 70–84 / ≥85 mit gehalten, Trefferquote, Ø Ergebnis, Ø CRV, max. Drawdown', bt.rows.map(r => r[0]).join() === '<50,50–69,70–84,≥85' && bt.head.length === 8 && /gehalten/.test(bt.head.join()) && /Drawdown/.test(bt.head.join()) && bt.tests > 0, JSON.stringify(bt.rows));
    check('Status nennt Zeitraum, Kerzen, Hebel und „keine Garantie“', /Kerzen \(/.test(bt.status) && /Hebel 10×/.test(bt.status) && /keine Garantie/.test(bt.status) && bt.lev === 10, bt.status.slice(0, 200));
    // Kein Look-Ahead: dieselben Regeln auf eine um 40 Kerzen gekürzte Reihe – alles bis zum Schnitt muss gleich bleiben
    await page.click('#pause');
    const causal = await page.evaluate(async () => {
      const all = __g05.state.candles.slice(), full = await __zs.walk({ leverage: 10 }); __g05.state.candles = all.slice(0, all.length - 40);
      try { const cut = await __zs.walk({ leverage: 10 }), last = __g05.state.candles.filter(c => c.closeTime < Date.now()).at(-1).time, key = s => [s.time, s.dir, s.entry, s.stop, s.target, s.score].join('|');
        const a = full.signals.filter(s => s.time <= last).map(key), b = cut.signals.map(key);
        return { signalsEqual: JSON.stringify(a) === JSON.stringify(b), n: b.length, testsPrefix: cut.tests.every((t, i) => t.score === full.tests[i].score && t.strong === full.tests[i].strong), tests: cut.tests.length };
      } finally { __g05.state.candles = all; } });
    check('Kein Look-Ahead: Signale bis zum Schnitt identisch, Zonen-Scores vor der Berührung identisch', causal.signalsEqual && causal.testsPrefix && causal.tests > 0, JSON.stringify(causal));
    await page.click('#pause');
    check('Backtest im Hauptthread in Teilschritten: Abbrechen möglich', await page.evaluate(async () => { const c = new AbortController(); const p = __zs.walk({ signal: c.signal }); c.abort(); try { await p; return false; } catch (e) { return e.name === 'AbortError'; } }));
    // ---- Schritt 3: Ein-/Ausstiegssignale im Chart ----
    await page.locator('#chart').scrollIntoViewIfNeeded(); await page.waitForFunction(() => document.querySelector('#chart svg'));
    const btn = await page.evaluate(() => { const b = document.getElementById('zsig-btn'); return { text: b.textContent, pressed: b.getAttribute('aria-pressed'), afterZones: document.getElementById('zones-btn').nextElementSibling === b, marks: document.querySelectorAll('#chart .zsig-mark').length }; });
    check('Eigener Knopf „Signale“ neben „Zonen“, anfangs aus, keine Marker', btn.text === 'Signale' && btn.pressed === 'false' && btn.afterZones && btn.marks === 0, JSON.stringify(btn));
    await page.evaluate(() => __kiz.set('off')); await page.evaluate(() => document.querySelector('.chart-toolbar .zoom-controls').scrollLeft = 999); await page.tap('#zsig-btn');
    await page.waitForFunction(() => __zs.state.walk?.result, null, { timeout: 60000 }); await page.waitForTimeout(400);
    check('3.69.0: Antippen gibt sichtbare Rückmeldung (Knopf grün, Hinweis „Signale an …“)', await page.evaluate(() => document.getElementById('zsig-btn').getAttribute('aria-pressed') === 'true' && /Signale an/.test(document.getElementById('toasts').textContent)), await page.evaluate(() => document.getElementById('toasts').textContent.slice(0, 160)));
    const sig = await page.evaluate(() => { const r = __zs.state.walk.result, inView = t => __g05.state.candles.some(c => c.time === t); return { stored: JSON.parse(localStorage.getItem('scalpdesk.zonesig.v1')).on, up: [...document.querySelectorAll('#chart .zsig-mark')].filter(t => t.textContent === '▲').map(t => t.getAttribute('fill')), down: [...document.querySelectorAll('#chart .zsig-mark')].filter(t => t.textContent === '▼').map(t => t.getAttribute('fill')), entries: [...r.trades, ...(r.open ? [r.open] : [])].length, exits: r.trades.length, lines: document.querySelectorAll('#chart .zsig-line').length, labels: [...document.querySelectorAll('#chart .zsig-label')].map(t => t.textContent), open: r.open, info: document.getElementById('zs-signal-now').textContent, zones: document.querySelectorAll('#chart .kiz-zone').length, up_c: getComputedStyle(document.documentElement).getPropertyValue('--c-up').trim(), down_c: getComputedStyle(document.documentElement).getPropertyValue('--c-down').trim(), allValid: [...r.trades, ...(r.open ? [r.open] : [])].every(s => s.crv >= 1.5 && s.triggers.length > 0 && s.zone.strength.strong && s.dir * (s.entry - s.stop) > 0 && s.dir * (s.target - s.entry) > 0) }; });
    check('Signale unabhängig vom Zonen-Knopf (Zonen aus): grüne ▲ je Einstieg, rote ▼ je Ausstieg', sig.stored === true && sig.zones === 0 && sig.up.length >= 1 && sig.up.every(c => c === sig.up_c) && sig.down.every(c => c === sig.down_c) && sig.up.length <= sig.entries && sig.down.length <= sig.exits, JSON.stringify({ up: sig.up.length, down: sig.down.length, entries: sig.entries, exits: sig.exits }));
    check('Jedes Signal: starke Zone, Auslöser, Stop hinter Einstieg, Ziel davor, CRV ≥ 1,5', sig.allValid);
    check('Offenes Signal: Stop-, Ziel- und Einstiegslinie mit Beschriftung, Stand im Panel', !sig.open || (sig.lines === 3 && sig.labels.some(t => /^Stop /.test(t)) && sig.labels.some(t => /^Ziel .*\((Gegenzone|POC|Liquidationscluster)\)/.test(t)) && /Offenes Signal: (Long|Short)/.test(sig.info)), JSON.stringify(sig.labels));
    await page.evaluate(() => document.getElementById('toasts').replaceChildren()); await page.waitForTimeout(200);
    const mb = await page.evaluate(() => { const r = document.querySelector('#chart .zsig-mark').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); await page.touchscreen.tap(mb.x, mb.y);
    await page.waitForFunction(() => /CRV/.test(document.getElementById('toasts').textContent)); const toast = await page.evaluate(() => document.getElementById('toasts').textContent);
    check('Marker antippen: Einstieg, Stop, Ziel, CRV, Auslöser, Hebel/Liquidation, „keine Garantie“', /Einstieg/.test(toast) && /Stop/.test(toast) && /Ziel/.test(toast) && /Auslöser:/.test(toast) && /Liquidation/.test(toast) && /keine Garantie/.test(toast) && !/sicher/i.test(toast), toast.slice(0, 220));
    await page.tap('#zsig-btn'); await page.waitForTimeout(200);
    check('3.69.0: Ausschalten wird bestätigt („Signale ausgeblendet“)', await page.evaluate(() => /Signale ausgeblendet/.test(document.getElementById('toasts').textContent)));
    check('Signale ausblenden: keine Marker und Linien, Zustand gespeichert', await page.evaluate(() => document.querySelectorAll('#chart .zsig-mark, #chart .zsig-line').length === 0 && JSON.parse(localStorage.getItem('scalpdesk.zonesig.v1')).on === false));
    check('Leiste mit „Zonen ausblenden“ und „Signale“ ohne Seitenüberlauf', await page.evaluate(() => { __kiz.set('strong'); const z = document.querySelector('.chart-toolbar .zoom-controls'), tb = document.querySelector('.chart-toolbar'); return z.getBoundingClientRect().right <= tb.getBoundingClientRect().right + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }));
    check('kein Seitenüberlauf, keine JavaScript-Fehler', errors.length === 0 && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), errors.join(' | '));
    await ctx.close();
  } finally { await browser.close(); await h.teardown(); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
