// 3.83.0 – Tab-Abgleich über die zentrale Liste der Speicherschlüssel: Marktradar-Beobachtungen und die BTC-Puls-Sperre kommen im
// anderen Tab an (vorher still verworfen; ein Tab mit altem Stand überschrieb beim nächsten Eintrag die Beobachtungen des anderen).
// Zusammenführen: Beobachtungen beider Tabs bleiben, bereits gemessene Ergebnisse (nach 15/60 Minuten) gehen nicht verloren.
// Aufruf: node m136.js
const h = require('./harness');
const results = [], check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + String(detail).slice(0, 500) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR/.test(e));
(async () => {
  await h.setup(); await h.ctl('/reset');
  const browser = await h.launch();
  try {
    const T = Date.UTC(2026, 9, 20, 9, 0), M = 60000, RK = 'scalpdesk.market-radar.v1';
    const obs = (symbol, at, extra = {}) => ({ model: 'market-radar-1', symbol, at, price: 100, flags: ['volume'], after15: null, after60: null, ...extra });
    const own = obs('ETCUSDT', T, { after15: { at: T + 15 * M + 5000, price: 101 } });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }), errors = [];
    await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem('m136')) { sessionStorage.setItem('m136', '1'); localStorage.setItem(k, JSON.stringify(v)); } }, [RK, { v: 1, open: true, track: false, observations: [own] }]);
    const a = await ctx.newPage(), b = await ctx.newPage(); h.collect(a, errors); h.collect(b, errors);
    for (const p of [a, b]) { await p.goto(`${h.URL_BASE}/weather-widget-v2.html`); await p.waitForFunction(() => window.__g05 && typeof __g05.backupPayload === 'function', null, { timeout: 30000 }); }
    const radar = p => p.evaluate(k => (__g05.backupPayload().prefs[k]?.observations || []).map(r => `${r.symbol}@${r.at}${r.after15 ? '+15' : ''}`).sort().join(' '), RK);
    check('Ausgangslage: beide Tabs kennen die eigene Beobachtung (ETC, mit 15-Minuten-Ergebnis)', (await radar(a)).includes('ETCUSDT') && (await radar(b)).includes('+15'), `${await radar(a)} | ${await radar(b)}`);
    // Tab A meldet eine neue Beobachtung (wie die App per broadcastData) – ohne das bereits gemessene Ergebnis von ETC
    await a.evaluate(([k, v]) => { const c = new BroadcastChannel('scalpdesk'); c.postMessage({ t: 'data', from: 'm136', items: [[k, v]] }); c.close(); }, [RK, { v: 1, open: true, track: true, observations: [obs('ETCUSDT', T), obs('XRPUSDT', T + 20 * M)] }]);
    await b.waitForTimeout(600);
    const rb = await radar(b);
    check('Anderer Tab übernimmt die neue Beobachtung (XRP) und behält ETC samt gemessenem Ergebnis', rb.includes('XRPUSDT') && rb.includes(`ETCUSDT@${T}+15`), rb);
    check('… und den neueren Schalterstand „Beobachten“', await b.evaluate(k => __g05.backupPayload().prefs[k]?.track === true, RK));
    // BTC-Puls-Sperre: der andere Tab übernimmt sie (sonst hätte er denselben Puls ein zweites Mal gemeldet)
    const pulse = { up: { t: T, mag: 0.8, more: false } };
    await a.evaluate(v => { const c = new BroadcastChannel('scalpdesk'); c.postMessage({ t: 'data', from: 'm136', items: [['scalpdesk.pulse.v1', v]] }); c.close(); }, pulse);
    await b.waitForTimeout(400);
    check('BTC-Puls-Sperre kommt im anderen Tab an (er meldet denselben Puls nicht noch einmal)', await b.evaluate(() => __g05.pulseLast().up?.t) === T, JSON.stringify(await b.evaluate(() => __g05.pulseLast())));
    check('keine Fehler', !real(errors).length, real(errors).join(' | '));
    await ctx.close();
  } catch (e) { check('Abbruch', false, e.stack || e.message); }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
