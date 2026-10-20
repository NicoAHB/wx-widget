// 3.87.2 – NY Open Killzone: Solange es heute kein Signal gibt, steht der Grund kurz im Chart-Feld (unter „NY Open · …“), z. B. „Kein Signal: Ausbruchskörper < 60 %“.
// Der ganze Text bleibt in der Erklärung (ⓘ) und in der Karte. Uhr gefälscht (America/New_York), nur lokale Testantworten. Aufruf: node m146.js
const h = require('./harness'), fs = require('fs');
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log((ok ? '✓ ' : '✗ ') + name + (!ok && detail !== '' ? ' — ' + String(detail).slice(0, 500) : '')); };
(async () => {
  let browser;
  try {
    const T = await import('../shared/ny-open-time.mjs'), { rows } = require('./analysis-fixture');
    const DAY = '2026-10-16', NEXT = '2026-10-19', M = 60000;
    const at = (hh, mm, sec = 0, day = DAY) => T.nyTime(day, hh, mm) + sec * 1000;
    // Szenario wie in unit-ny-open.js (Minute k ab 09:30): 5m-Range 99,8–100,2, Ausschlag 100,6 bei k=9, 5m-Ausbruch k=11, 15m-Ausbruch k=20
    const scenario = () => { const out = []; for (let t = at(9, 5); t < at(11, 40); t += M) { const k = (t - at(9, 30)) / M; out.push({ time: t, end: t + M, open: 100, close: 100, high: 100.04, low: 99.96, volume: 100, ...(k === 0 ? { high: 100.2, low: 99.8 } : k === 9 ? { open: 100, close: 100.1, high: 100.6, low: 99.95 } : k === 11 ? { open: 100.25, close: 100.55, high: 100.58, low: 100.23 } : k === 12 ? { open: 100.55, close: 100.57, high: 100.6, low: 100.45 } : k >= 13 && k < 20 ? { open: 100.55, close: 100.55, high: 100.58, low: 100.52 } : k === 20 ? { open: 100.62, close: 100.9, high: 100.93, low: 100.6 } : k === 21 ? { open: 100.9, close: 100.92, high: 100.95, low: 100.8 } : k > 21 ? { open: 100.92, close: 100.92, high: 100.95, low: 100.9 } : {}) }); } return out; };
    const sc = scenario();
    // Dienstag (weiter): Range 99,8–100,2 (0,4 %), um 09:36 schließt eine Kerze über der Range mit langen Dochten (Körper 0,03 von 0,7 = 4 % < 60 %) – kein gültiger Ausbruch
    const WEAK = '2026-10-20', weak = []; for (let t = at(9, 5, 0, WEAK); t < at(11, 40, 0, WEAK); t += M) { const k = (t - at(9, 30, 0, WEAK)) / M; weak.push({ time: t, end: t + M, open: 100, close: 100, high: 100.04, low: 99.96, volume: 100, ...(k === 0 ? { high: 100.2, low: 99.8 } : k === 6 ? { open: 100.19, close: 100.22, high: 100.6, low: 99.9 } : {}) }); }
    let now = at(9, 20), wall = Date.now(), fetched5m = 0;
    const clock = () => now + Date.now() - wall;
    await h.setup(); await h.ctl('/walk?on=0');
    browser = await h.launch({ workspace: 'fresh' });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, timezoneId: 'America/New_York' }), p = await ctx.newPage(), errors = [];
    p.on('pageerror', e => { errors.push(e.message); console.log('APP ERROR:', e.message); });
    await ctx.addInitScript(() => {
      if (!localStorage.getItem('m142-seeded')) { localStorage.setItem('m142-seeded', '1'); localStorage.setItem('scalpdesk.fsrotate.v1', '"native"'); localStorage.setItem('scalpdesk.watchlist.v1', '["BTC","ETC"]'); localStorage.setItem('scalpdesk.analysis.v1', JSON.stringify({ rows: { 'ny-open': { options: { biasFilter: false } } } })); }
      const NativeWorker = window.Worker; window.Worker = new Proxy(NativeWorker, { construct(Target, args) { if (String(args[0]).startsWith('blob:')) throw Error('Isolierte Live-Testdaten'); return Reflect.construct(Target, args); } });
    });
    await p.clock.setSystemTime(now);
    await ctx.routeWebSocket('**/*', socket => socket.onMessage(() => {}));
    await ctx.route('**/api/v3/time*', r => r.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { serverTime: clock() } }));
    await ctx.route(/\/(?:api|fapi)\/v[13]\/klines\?/, async route => {
      const q = new URL(route.request().url()).searchParams, iv = q.get('interval'), ms = ({ '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000, '2h': 7200000, '4h': 14400000, '1d': 86400000 })[iv];
      if (!ms) return route.fallback(); if (iv === '5m' && q.has('endTime') && Number(q.get('startTime')) === at(9, 30)) { fetched5m++; console.log('5m-Abruf:', route.request().url().slice(-160), 'um', new Date(clock()).toISOString()); } // früher holte die Analyse genau dieses 5m-Fenster (09:30–09:35)
      let source = rows(502, ms, (Math.floor(clock() / ms) + 1) * ms).map(c => ({ ...c, open: 100, close: 100, high: 100.04, low: 99.96 }));
      if (iv === '1m') for (const c of [...sc, ...weak]) { const i = source.findIndex(v => v.time === c.time); if (i >= 0) source[i] = c; }
      if (q.has('startTime')) source = source.filter(c => c.time >= Number(q.get('startTime'))); if (q.has('endTime')) source = source.filter(c => c.time <= Number(q.get('endTime')));
      const limit = Number(q.get('limit')) || 500; source = q.has('startTime') ? source.slice(0, limit) : source.slice(-limit);
      return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: source.map(c => [c.time, String(c.open), String(c.high), String(c.low), String(c.close), String(c.volume), c.end - 1, '10000', 5, '50', '5000', '0']) });
    });
    await p.goto(h.URL_BASE + '/weather-widget-v2.html'); await p.waitForFunction(() => window.__analysis && __g05.state.candles.length);
    await p.click('[data-workspace-target=chart]'); await p.locator('#analysis-panel>summary').click();
    const row = p.locator('[data-analysis="ny-open"]');
    const setTime = async (hh, mm, sec = 0, day = DAY) => { now = at(hh, mm, sec, day); wall = Date.now(); await p.clock.setSystemTime(now); await p.waitForTimeout(1300); };
    const bar = () => p.evaluate(() => [...document.querySelectorAll('[data-analysis="ny-open"] .analysis-range-bar button')].map(b => ({ id: b.dataset.nyRange, text: b.textContent, on: b.getAttribute('aria-pressed') === 'true', disabled: b.disabled, cls: b.className, title: b.title })));
    const reason = () => p.evaluate(() => document.querySelector('[data-analysis="ny-open"] .analysis-current-reason')?.textContent || '');
    const badge = () => p.evaluate(() => document.querySelector('[data-analysis="ny-open"] .analysis-overview-head .analysis-direction')?.textContent || '');
    const step1 = () => p.evaluate(() => document.querySelector('[data-analysis="ny-open"] .analysis-progress li')?.textContent || '');
    const until = async (fn, ms = 15000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await p.waitForTimeout(250); } };
    const settings = () => p.evaluate(() => __analysis.view.settings.rows['ny-open'].options);
    const shot = async name => { if (process.env.M142_SHOT) await row.screenshot({ path: process.env.M142_SHOT + '/m142-' + name + '.png' }); };
    const click = async id => { await row.locator(`.analysis-range-bar [data-ny-range="${id}"]`).click(); await p.waitForTimeout(500); };

    await until(async () => (await bar()).length === 3);
    await p.locator('#chart').scrollIntoViewIfNeeded();
    await row.locator('.analysis-focus').click(); await p.getByRole('checkbox', { name: 'NY Open Killzone: Im Chart anzeigen', exact: true }).check();
    const note = () => p.evaluate(() => { const g = document.querySelector('[data-ny-chart-reason]'); return { n: document.querySelectorAll('[data-ny-chart-reason]').length, text: g?.querySelector('text')?.textContent || '', label: g?.getAttribute('aria-label') || '' }; });
    const noteIs = async text => !!(await until(async () => (await note()).text === text));

    await setTime(9, 32, 0);
    check('Freitag 09:32: „Range wird gebildet ⓘ“ unter dem Statusfeld', await noteIs('Range wird gebildet ⓘ'), JSON.stringify(await note()));
    await setTime(9, 36, 0);
    check('Freitag 09:36: „Noch kein Signal · wartet auf Ausbruch ⓘ“', await noteIs('Noch kein Signal · wartet auf Ausbruch ⓘ'), JSON.stringify(await note()));
    await setTime(9, 50, 0); await until(async () => (await p.evaluate(() => __analysis.feed.result('ETCUSDT', 'spot', 'ny-open').signal?.direction)) !== undefined);
    await until(async () => (await p.evaluate(() => __analysis.feed.result('BTCUSDT', 'spot', 'ny-open').signal?.direction)) === 1);
    check('Freitag 09:50 (Signal da): kein Hinweis mehr – Einstieg, Stop und Ziel stehen im Chart', await until(async () => (await note()).n === 0) && await p.locator('.ny-level-label').count() >= 3, JSON.stringify(await note()));
    await setTime(12, 0, 5); check('Freitag 12:00: weiter kein Hinweis (das Signal von heute gilt)', (await note()).n === 0, JSON.stringify(await note()));
    // das Ergebnis des Freitag-Signals muss feststehen, bevor die Uhr springt (sonst holt die App am Montag noch Freitags-Kerzen, die die Attrappe dann nicht mehr liefert)
    const settled = await until(async () => ['target', 'stop', 'breakeven', 'expired', 'open_2h'].includes(await p.evaluate(() => __analysis.feed.result('BTCUSDT', 'spot', 'ny-open').record?.outcome?.status)), 45000);
    check('Das Ergebnis des Freitag-Signals steht fest (Voraussetzung für die Tage danach)', !!settled);

    await setTime(9, 40, 0, NEXT);
    check('Montag 09:40 (Range 0,08 %): „Kein Signal: Range < 0,15 % ⓘ“; Erklärung nennt die Mindestbreite', await noteIs('Kein Signal: Range < 0,15 % ⓘ') && /Mindestbreite 0\.15 %/.test((await note()).label), JSON.stringify(await note()));
    await setTime(9, 40, 0, WEAK);
    check('Dienstag 09:40 (Ausbruchskerze mit langen Dochten): „Kein Signal: Ausbruchskörper < 60 % ⓘ“', await noteIs('Kein Signal: Ausbruchskörper < 60 % ⓘ'), JSON.stringify(await note()));
    const card = await p.evaluate(() => document.querySelector('[data-analysis="ny-open"] .analysis-current-reason')?.textContent || '');
    check('… die Erklärung (ⓘ) und die Karte nennen denselben Grund ausführlich', /Ausbruchskörper kleiner als 60 % der Kerzenlänge/.test((await note()).label) && /Ausbruchskörper kleiner als 60 % der Kerzenlänge/.test(card), card + ' | ' + (await note()).label.slice(0, 120));
    await setTime(10, 45, 0, WEAK);
    check('Dienstag 10:45 (Fenster vorbei): „Heute kein Signal · Fenster beendet ⓘ“', await noteIs('Heute kein Signal · Fenster beendet ⓘ'), JSON.stringify(await note()));
    await setTime(9, 40, 0, WEAK);
    for (const width of [1440, 390, 320]) {
      await p.setViewportSize({ width, height: 900 }); await p.waitForTimeout(700); await noteIs('Kein Signal: Ausbruchskörper < 60 % ⓘ');
      const g = await p.evaluate(() => { const grp = document.querySelector('[data-ny-chart-reason]'), svg = grp.closest('svg').getBoundingClientRect(), rect = grp.querySelectorAll('rect')[1].getBoundingClientRect(), txt = grp.querySelector('text').getBoundingClientRect(), st = document.querySelector('[data-ny-chart-status]').querySelectorAll('rect')[1].getBoundingClientRect(); return { rectL: Math.round(rect.left - svg.left), rectR: Math.round(svg.right - rect.right), textFits: txt.width <= rect.width - 6, below: Math.round(rect.top - st.bottom), noOverflow: document.documentElement.scrollWidth <= innerWidth + 1 }; });
      if (process.env.M146_SHOT) await p.locator('#chart').screenshot({ path: `${process.env.M146_SHOT}/m146-${width}.png` });
      check(`${width}px: das Hinweisfeld liegt im Chart, der Text passt hinein, die sichtbaren Felder überdecken sich nicht`, g.rectL >= 0 && g.rectR >= 0 && g.textFits && g.below >= 2 && g.noOverflow, JSON.stringify(g));
    }
    check('keine JavaScript-Fehler', errors.length === 0, errors.join(' | '));
  } catch (e) { fail++; console.log('✗ Abbruch', e.stack || e.message); }
  finally { if (browser) await browser.close(); await h.ctl('/walk?on=1').catch(() => {}); await h.teardown(); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})();
