// 3.86.0 – NY Open Killzone: umschaltbare Range-Länge (5m | 15m | 1h) in der Modellkarte.
// Prüft im echten Browser mit gesetzter Uhr (America/New_York): Leiste im Stil der Zeitrahmen-Knöpfe, Freischaltung nacheinander (15m ab 09:35,
// 1h ab 09:45), Stufentitel und Wartetexte mit Länge und Zeitfenster, „Range wird gebildet“, Range-Linien im Chart je Länge, Signal bleibt beim Umschalten
// (ein Signal je Coin und Tag), Rückkehr auf kürzere Länge, Auswahl gespeichert, neuer Handelstag = wieder 5m, Handy-Breiten.
// Nur lokale Börsen-Testantworten, keine echten Nachrichten. Aufruf: node m142.js
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
    await ctx.route(/\/(?:api|fapi)\/v[13]\/klines\?/, async route => {
      const q = new URL(route.request().url()).searchParams, iv = q.get('interval'), ms = ({ '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000, '2h': 7200000, '4h': 14400000, '1d': 86400000 })[iv];
      if (!ms) return route.fallback(); if (iv === '5m' && q.has('endTime') && Number(q.get('startTime')) === at(9, 30)) { fetched5m++; console.log('5m-Abruf:', route.request().url().slice(-160), 'um', new Date(clock()).toISOString()); } // früher holte die Analyse genau dieses 5m-Fenster (09:30–09:35)
      let source = rows(502, ms, (Math.floor(clock() / ms) + 1) * ms).map(c => ({ ...c, open: 100, close: 100, high: 100.04, low: 99.96 }));
      if (iv === '1m') for (const c of sc) { const i = source.findIndex(v => v.time === c.time); if (i >= 0) source[i] = c; }
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

    // 09:20 · vor 09:30
    await until(async () => (await bar()).length === 3);
    let b = await bar();
    check('09:20: Leiste 5m | 15m | 1h in der Karte, im Stil der Zeitrahmen-Knöpfe, Standard 5m', b.map(x => x.text).join('|') === '5m|15m|1h' && b[0].on && !b[1].on && !b[2].on && await p.locator('[data-analysis="ny-open"] .analysis-range-bar').evaluate(n => n.classList.contains('intervals') && n.getAttribute('role') === 'group'), JSON.stringify(b));
    check('09:20: 15m und 1h sind ausgegraut (nicht freigeschaltet), 5m wählbar; Hinweis, ab wann', !b[0].disabled && b[1].disabled && b[2].disabled && /ab 09:35/.test(b[1].title) && /ab 09:45/.test(b[2].title), JSON.stringify(b));
    check('09:20: „Nächste Range: 5m Range, 09:30–09:35 New York.“ und Stufentitel mit Länge und Zeitfenster', await reason() === 'Nächste Range: 5m Range, 09:30–09:35 New York.' && (await step1()).includes('5m Range, 09:30–09:35'), (await reason()) + ' | ' + (await step1()));
    check('09:20: ausgegraute Knöpfe lassen sich nicht anklicken (Auswahl bleibt 5m)', await row.locator('[data-ny-range="15m"]').click({ force: true, timeout: 3000 }).then(() => true, () => true) && (await settings()).rangeLength === undefined);
    await shot('0920');
    // 09:32 · Range läuft
    await setTime(9, 32, 10);
    check('09:32: Stufe 1 „Range wird gebildet“ (Plakette und Text), 15m noch gesperrt', await until(async () => /Range wird gebildet: 5m Range, 09:30–09:35\./.test(await reason())) && await badge() === 'Range wird gebildet' && (await bar())[1].disabled, (await reason()) + ' | ' + (await badge()));
    // 09:36 · 5m fertig: 15m frei
    await setTime(9, 36, 5);
    await until(async () => !(await bar())[1].disabled);
    b = await bar();
    check('09:36: 15m wählbar, 1h noch ausgegraut; Stufe 1 „Range steht“', !b[1].disabled && b[2].disabled && await until(async () => await badge() === 'Range steht'), JSON.stringify(b) + await badge());
    await click('15m');
    b = await bar();
    check('09:36: 15m gewählt: Leiste, Titel „15m Range, 09:30–09:45“, „Range wird gebildet“; Stufe 2 startet erst nach 09:45', b[1].on && !b[0].on && await until(async () => await reason() === 'Range wird gebildet: 15m Range, 09:30–09:45.') && (await step1()).includes('15m Range, 09:30–09:45') && await badge() === 'Range wird gebildet', (await reason()) + ' | ' + (await step1()));
    await shot('0936-15m');
    const saved = await settings();
    check('Auswahl gespeichert (Länge und NY-Tag), Schalter unverändert', saved.rangeLength === '15m' && saved.rangeDay === DAY && saved.biasFilter === false && saved.skipHolidays === true, JSON.stringify(saved));
    await click('5m');
    check('Zurück auf die kürzere Range jederzeit: 5m wieder aktiv, „Range steht“', (await bar())[0].on && await until(async () => await badge() === 'Range steht'));
    // 09:50 · Signal der 5m-Range (09:43) ist protokolliert; 15m/1h frei
    await setTime(9, 50, 5);
    await until(async () => (await bar())[2].disabled === false);
    check('09:50: 1h wählbar (15m-Range abgeschlossen); 5m-Signal bestätigt (3/3, Long)', !(await bar())[2].disabled && await until(async () => /3\/3 Stufen/.test(await p.locator('[data-analysis="ny-open"] .analysis-overview-head').textContent()) && /Long/.test(await badge())), await badge());
    await click('1h');
    await row.locator('.analysis-inspection > summary').click();
    check('09:50: 1h gewählt – ein protokolliertes Signal bleibt (ein Signal je Coin und Tag), Hinweis auf dessen Länge im Prüftext', await until(async () => /Signal der 5m Range/.test(await p.evaluate(() => document.querySelector('[data-analysis="ny-open"] [data-analysis-stage="ny-break"]')?.textContent || ''))) && /3\/3 Stufen/.test(await p.locator('[data-analysis="ny-open"] .analysis-overview-head').textContent()), await p.evaluate(() => document.querySelector('[data-analysis="ny-open"] [data-analysis-stage="ny-break"]')?.textContent || 'kein Stufentext'));
    check('Titel der Stufe 1 bei 1h: „1h Range, 09:30–10:30“', (await step1()).includes('1h Range, 09:30–10:30') && /1h Range, 09:30–10:30/.test(await p.evaluate(() => document.querySelector('[data-analysis="ny-open"] [data-analysis-stage="ny-range"]')?.textContent || '')));
    await shot('0950-1h-signal5m');
    // Chart-Linien je Länge
    await row.locator('.analysis-focus').click(); await p.getByRole('checkbox', { name: 'NY Open Killzone: Im Chart anzeigen', exact: true }).check(); await p.locator('#chart').scrollIntoViewIfNeeded();
    // 10:31 · 1h-Range fertig, Fenster bis 11:30
    await setTime(10, 31, 5);
    await until(async () => /Gespeichert/.test(await p.evaluate(() => document.querySelector('[data-analysis="ny-open"] [data-analysis-stage="ny-range"]')?.textContent || '')));
    const lineText = id => p.evaluate(sel => document.querySelector(sel)?.textContent || '', `.ny-level-label[data-ny-label="${id}"]`);
    check('10:31 (1h): Range steht, Linien zeigen Hoch/Tief der 1h-Range (100,95 / 99,8)', await until(async () => /100[.,]95/.test(await lineText('range-high'))) && /99[.,]8/.test(await lineText('range-low')), (await lineText('range-high')) + ' / ' + (await lineText('range-low')));
    check('10:31 (1h): Erklärung im Chart nennt Range 09:30–10:30 und Signale bis 11:30', await p.evaluate(() => (document.querySelector('.ny-chart-info')?.__analysisExplanation || '').includes('09:30–10:30 America/New_York definiert Hoch/Tief; neue Signale 10:30–11:30.')));
    await click('15m');
    check('10:31 (15m): Linien wechseln auf die 15m-Range (100,6 / 99,8)', await until(async () => /100[.,]60/.test(await lineText('range-high')) && !/100[.,]95/.test(await lineText('range-high'))) && /99[.,]8/.test(await lineText('range-low')), await lineText('range-high'));
    await click('5m');
    check('10:31 (5m): Linien zeigen die 5m-Range (100,2 / 99,8), das frühere Signal bleibt im Chart (Einstieg/Stop/Ziel)', await until(async () => /100[.,]20/.test(await lineText('range-high'))) && await p.locator('.ny-entry-mark').count() === 1 && await p.locator('.ny-level-label').count() === 5, await lineText('range-high'));
    // nach der Killzone
    await setTime(12, 0, 5);
    b = await bar();
    check('Nach der Killzone (12:00): alle drei Längen wählbar, Auswahl bleibt am selben Tag; Linien der gewählten Länge', b.every(x => !x.disabled) && b[0].on, JSON.stringify(b));
    await click('1h');
    check('Nach der Killzone: 1h zeigt Linien 100,95 / 99,8', await until(async () => /100[.,]95/.test(await lineText('range-high'))), await lineText('range-high'));
    // Neustart: Auswahl am selben Tag erhalten
    await p.reload(); await p.waitForFunction(() => window.__analysis && __g05.state.candles.length); await p.click('[data-workspace-target=chart]'); await p.locator('#analysis-panel>summary').click();
    await until(async () => (await bar()).length === 3); await p.waitForTimeout(800);
    check('Nach Neustart am selben Tag: Auswahl 1h erhalten', (await bar())[2].on, JSON.stringify(await bar()));
    // neuer Handelstag
    await setTime(9, 20, 0, NEXT);
    await until(async () => (await bar())[0].on);
    b = await bar();
    check('Neuer Handelstag (Montag 09:20): Auswahl springt auf 5m zurück, 15m/1h wieder gesperrt', b[0].on && !b[1].on && !b[2].on && b[1].disabled && b[2].disabled && await until(async () => await reason() === 'Nächste Range: 5m Range, 09:30–09:35 New York.'), JSON.stringify(b) + (await reason()));
    check('Gespeicherte Wahl von gestern bleibt unverändert gespeichert, wirkt aber nicht mehr', (await settings()).rangeDay === DAY && (await settings()).rangeLength === '1h');
    check('Die Analyse ruft keine 5m-Kerzen mehr ab (Range aus den 1m-Kerzen)', fetched5m === 0, String(fetched5m));
    // Handy-Breiten
    for (const width of [320, 390, 430, 768, 1440]) {
      await p.setViewportSize({ width, height: 1100 }); await row.scrollIntoViewIfNeeded();
      const m = await p.evaluate(() => { const r = document.querySelector('[data-analysis="ny-open"]'), bar = r.querySelector('.analysis-range-bar'), bs = [...bar.querySelectorAll('button')].map(x => x.getBoundingClientRect()); return { overflow: r.scrollWidth > r.clientWidth + 1 || document.scrollingElement.scrollWidth > innerWidth + 1, minH: Math.min(...bs.map(x => x.height)), minW: Math.min(...bs.map(x => x.width)), right: Math.max(...bs.map(x => x.right)), vw: innerWidth, oneRow: new Set(bs.map(x => Math.round(x.top))).size === 1 }; });
      check(`${width}px: Leiste ohne Überlauf, in einer Zeile, Knöpfe mindestens 38 px hoch`, !m.overflow && m.oneRow && m.minH >= 38 && m.right <= m.vw, JSON.stringify(m));
    }
    check('keine Laufzeitfehler', !errors.length, errors.join(' | '));
  } catch (e) { check('Abbruch', false, e.stack || e.message); }
  finally { await browser?.close(); await h.teardown(); }
  console.log(`${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
})();
