// 3.87.1 – NY Open Killzone: frühere Signale bleiben im Chart. Bisher ersetzte mit Beginn der neuen Sitzung die Auswertung des Tages das Signal von gestern; seine Linien
// (Einstieg, Stop, Ziel) verschwanden, obwohl die Kerzen noch im Bild waren. Jetzt zeichnet der Chart die letzten Signale aus dem Journal als blasse Linien mit Datum und Ergebnis,
// solange ihre Kerzen sichtbar sind; die Darstellung des aktuellen Signals bleibt unverändert. Uhr gefälscht (America/New_York), nur lokale Testantworten.
// Aufruf: node m145.js
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
    // 3.97.0: Der Test-Prozess bedient alle Kerzen-Abrufe nacheinander. Je mehr die App gleichzeitig lädt (Vorauswahl ab 3.93.0), desto länger warten die
    // Abrufe der Analyse; eine feste Wartezeit nach jedem Uhrsprung reichte deshalb nicht mehr. Jetzt wird auf Ruhe bei den Abrufen gewartet.
    let inflight = 0, lastReq = Date.now();
    const track = fn => async route => { inflight++; try { return await fn(route); } finally { inflight--; lastReq = Date.now(); } };
    await ctx.route(/\/(?:api|fapi)\/v[13]\/klines\?/, track(async route => {
      const q = new URL(route.request().url()).searchParams, iv = q.get('interval'), ms = ({ '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000, '2h': 7200000, '4h': 14400000, '1d': 86400000 })[iv];
      if (!ms) return route.fallback(); if (iv === '5m' && q.has('endTime') && Number(q.get('startTime')) === at(9, 30)) { fetched5m++; console.log('5m-Abruf:', route.request().url().slice(-160), 'um', new Date(clock()).toISOString()); } // früher holte die Analyse genau dieses 5m-Fenster (09:30–09:35)
      let source = rows(502, ms, (Math.floor(clock() / ms) + 1) * ms).map(c => ({ ...c, open: 100, close: 100, high: 100.04, low: 99.96 }));
      if (iv === '1m') for (const c of sc) { const i = source.findIndex(v => v.time === c.time); if (i >= 0) source[i] = c; }
      if (iv === '1h') { const i = source.findIndex(v => v.time === at(10, 0)); if (i >= 0) source[i] = { ...source[i], open: 100, high: 101.4, low: 99.7, close: 100.4 }; }
      if (q.has('startTime')) source = source.filter(c => c.time >= Number(q.get('startTime'))); if (q.has('endTime')) source = source.filter(c => c.time <= Number(q.get('endTime')));
      const limit = Number(q.get('limit')) || 500; source = q.has('startTime') ? source.slice(0, limit) : source.slice(-limit);
      return route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: source.map(c => [c.time, String(c.open), String(c.high), String(c.low), String(c.close), String(c.volume), c.end - 1, '10000', 5, '50', '5000', '0']) });
    }));
    await p.goto(h.URL_BASE + '/weather-widget-v2.html'); await p.waitForFunction(() => window.__analysis && __g05.state.candles.length);
    await p.click('[data-workspace-target=chart]'); await p.locator('#analysis-panel>summary').click();
    const row = p.locator('[data-analysis="ny-open"]');
    const quiet = async (ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms && (inflight > 0 || Date.now() - lastReq < 900)) await p.waitForTimeout(150); };
    const setTime = async (hh, mm, sec = 0, day = DAY) => { now = at(hh, mm, sec, day); wall = Date.now(); await p.clock.setSystemTime(now); await p.waitForTimeout(1300); await quiet(); };
    const bar = () => p.evaluate(() => [...document.querySelectorAll('[data-analysis="ny-open"] .analysis-range-bar button')].map(b => ({ id: b.dataset.nyRange, text: b.textContent, on: b.getAttribute('aria-pressed') === 'true', disabled: b.disabled, cls: b.className, title: b.title })));
    const reason = () => p.evaluate(() => document.querySelector('[data-analysis="ny-open"] .analysis-current-reason')?.textContent || '');
    const badge = () => p.evaluate(() => document.querySelector('[data-analysis="ny-open"] .analysis-overview-head .analysis-direction')?.textContent || '');
    const step1 = () => p.evaluate(() => document.querySelector('[data-analysis="ny-open"] .analysis-progress li')?.textContent || '');
    const until = async (fn, ms = 15000) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await p.waitForTimeout(250); } };
    const settings = () => p.evaluate(() => __analysis.view.settings.rows['ny-open'].options);
    const shot = async name => { if (process.env.M142_SHOT) await row.screenshot({ path: process.env.M142_SHOT + '/m142-' + name + '.png' }); };
    const click = async id => { await row.locator(`.analysis-range-bar [data-ny-range="${id}"]`).click(); await p.waitForTimeout(500); };

    await until(async () => (await bar()).length === 3);
    const goInterval = async iv => { await p.click(`.chart-toolbar .intervals [data-interval="${iv}"]`); await p.waitForFunction(i => __g05.state.interval === i && !__g05.state.busy, iv, { timeout: 20000 }); await p.waitForTimeout(800); };
    const chart = () => p.evaluate(() => ({ labels: [...document.querySelectorAll('.ny-level-label')].map(n => n.dataset.nyLabel), past: document.querySelectorAll('.ny-past').length, pastLines: [...document.querySelectorAll('.ny-past-level')].map(n => n.dataset.nyPastLevel), pastLabels: [...document.querySelectorAll('.ny-past-label')].map(n => n.textContent), entryMarks: document.querySelectorAll('.ny-past-entry-mark').length, title: document.querySelector('.ny-past title')?.textContent || '', info: document.querySelector('.ny-chart-info')?.getAttribute('aria-label') || '' }));
    await p.locator('#chart').scrollIntoViewIfNeeded();
    await row.locator('.analysis-focus').click(); await p.getByRole('checkbox', { name: 'NY Open Killzone: Im Chart anzeigen', exact: true }).check();
    await goInterval('1h');

    // Freitag: Signal entsteht (09:50), danach bleibt es das aktuelle Signal – nichts doppelt
    for (const [hh, mm, ss] of [[9, 36, 0], [9, 50, 0], [10, 31, 0], [12, 0, 5]]) await setTime(hh, mm, ss);
    await until(async () => (await p.evaluate(() => __analysis.feed.result('BTCUSDT', 'spot', 'ny-open').signal?.direction)) === 1);
    let c = await chart();
    check('Freitag 12:00 (1h): das Signal von heute wird wie bisher gezeichnet (Einstieg, Stop, Ziel) – und nicht zusätzlich als „früheres“ Signal', c.labels.includes('entry') && c.labels.includes('stop') && c.labels.includes('target') && c.past === 0, JSON.stringify(c));
    const journal = await p.evaluate(() => __analysis.feed.result('BTCUSDT', 'spot', 'ny-open').record);
    check('Ergebnis des Freitag-Signals ist im Journal (Einstieg 100,57, Ziel 101,28)', journal?.signal?.entry === 100.57 || Math.abs(journal?.signal?.entry - 100.57) < 1e-9, JSON.stringify(journal?.signal || null).slice(0, 200));

    // Montag
    await setTime(9, 20, 0, NEXT); await p.waitForTimeout(800); c = await chart();
    check('Montag 09:20 (vor der Sitzung, 1h): das letzte Signal erscheint weiter in seiner bisherigen Darstellung, nicht doppelt', c.labels.includes('target') && c.labels.includes('stop') && c.past === 0, JSON.stringify(c));
    await setTime(9, 40, 0, NEXT); await until(async () => !(await chart()).labels.includes('target')); await p.waitForTimeout(600); c = await chart();
    check('Montag 09:40 (neue Sitzung, noch kein Signal): die Marken von heute sind nur Range-Hoch/-Tief', c.labels.sort().join() === 'range-high,range-low', JSON.stringify(c));
    check('… und die Linien des Freitag-Signals bleiben als blasse Linien stehen: Einstieg, Stop, Ziel', c.past === 1 && ['entry', 'stop', 'target'].every(k => c.pastLines.includes(k)), JSON.stringify(c));
    check('… mit Datum (16.10.) und den Preisen an jeder Linie', ['Einstieg', 'Stop', 'Ziel'].every(w => c.pastLabels.some(t => t.startsWith(w) && t.includes('16.10.'))) && c.pastLabels.some(t => /Einstieg 100,57/.test(t)) && c.pastLabels.some(t => /Ziel 2R 101,28/.test(t)), JSON.stringify(c.pastLabels));
    check('… Einstiegspunkt auf der Kerze, Hinweistext beim Darüberfahren nennt Richtung, Preise und Ergebnis', c.entryMarks === 1 && /^16\.10\. · Long · Einstieg 100,57 · Stop [\d,]+ · Ziel 101,28 · .+/.test(c.title), c.title);
    check('Die Erklärung (ⓘ) nennt, dass frühere Signale als blasse Linien stehen bleiben', /Frühere Signale der letzten Tage bleiben als blasse Linien mit Datum stehen/.test(c.info), c.info.slice(0, 120));
    await setTime(10, 40, 0, NEXT); await p.waitForTimeout(500); c = await chart();
    check('Montag 10:40: weiter sichtbar (ein Signal vom Freitag), Marken von heute unverändert', c.past === 1 && c.labels.sort().join() === 'range-high,range-low', JSON.stringify(c));
    await goInterval('15m'); c = await chart();
    check('15m-Chart am Montag: der Freitag liegt außerhalb der 80 Kerzen – keine Linien, keine Beschriftungen', c.past === 0 && c.pastLabels.length === 0, JSON.stringify(c));
    await goInterval('1m'); c = await chart();
    check('1m-Chart am Montag: ebenso nichts', c.past === 0, JSON.stringify(c));
    await goInterval('1h'); c = await chart();
    check('Zurück auf 1h: die Linien sind wieder da', c.past === 1 && c.pastLines.length === 3, JSON.stringify(c));
    // Breite
    for (const width of [320, 390, 1440]) { await p.setViewportSize({ width, height: 900 }); await p.waitForTimeout(700); c = await chart(); check(`${width}px: frühere Signale bleiben sichtbar, kein seitliches Scrollen`, c.past === 1 && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), JSON.stringify(c).slice(0, 200)); }
    check('keine JavaScript-Fehler', errors.length === 0, errors.join(' | '));
  } catch (e) { fail++; console.log('✗ Abbruch', e.stack || e.message); }
  finally { if (browser) await browser.close(); await h.ctl('/walk?on=1').catch(() => {}); await h.teardown(); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})();
