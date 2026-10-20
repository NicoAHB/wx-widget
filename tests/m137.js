// 3.83.0 – Sekündliche Analyse-Runde mit vollen Lernspeichern (je 20 000 Einträge Strategie-Protokoll, Rücksetzer-Daten und Analyse-Lernstand).
// Vorher durchsuchten die Strategie- und Rücksetzer-Feeds bei jeder Abfrage alle Einträge, mehrmals je Coin und Sekunde
// (gemessen ~150 ms je Runde, Spitzen über 400 ms); jetzt Verzeichnis je gespeichertem Stand (~6 ms). Grenze großzügig: 50 ms Median.
// Dazu der Arbeitsspeicher mit allen drei Lernspeichern (3.84.0).
// Aufruf: node m137.js
const h = require('./harness');
const results = [], check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + String(detail).slice(0, 500) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR/.test(e));
(async () => {
  await h.setup(); await h.ctl('/reset');
  const browser = await h.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(`${h.URL_BASE}/weather-widget-v2.html`); await page.waitForFunction(() => window.__analysis?.tick, null, { timeout: 30000 });
    await page.evaluate(async N => {
      const now = Date.now(), rec = i => ({ source: 'live', updatedAt: now - i * 60000, signal: { analysisId: 'range-return', analysisName: 'Range', symbol: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'][i % 3], market: 'spot', side: 'Long', direction: 1, at: now - (i + 10) * 900000, expiresAt: now - (i + 9) * 900000, entry: 100, stop: 99, target1: 102, reason: 'Beispieltext zur Größe', learningVersion: 'v', learningFeatures: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8 } },
        outcome: { complete: true, status: 'target1', first: { status: 'target1', at: now - (i + 9) * 900000, grossR: 1 } } });
      const records = {}; for (let i = 0; i < N; i++) records['k' + i] = rec(i);
      const db = await new Promise((res, rej) => { const r = indexedDB.open('scalpdesk', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      await new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'), st = tx.objectStore('kv'); st.put({ version: 1, records }, 'scalpdesk.idb.market-strategies.v1'); st.put({ version: 1, records }, 'scalpdesk.idb.trend-pullback.data.v1'); st.put({ version: 1, analyses: { 'top-down': { records, models: {} }, 'ny-open': { records, models: {} } } }, 'scalpdesk.idb.analysis-learning.v1'); st.put(Date.now() + 60000, 'scalpdesk.savedat.v1'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
      db.close();
    }, 20000);
    await page.reload(); await page.waitForFunction(() => window.__analysis?.tick, null, { timeout: 30000 }); await page.waitForTimeout(3000);
    const t = await page.evaluate(async () => { const t = []; for (let i = 0; i < 40; i++) { const a = performance.now(); __analysis.tick(); t.push(performance.now() - a); await new Promise(r => setTimeout(r, 20)); } return t.sort((a, b) => a - b); });
    const median = t[20], p90 = t[36];
    check('Analyse-Runde mit vollen Lernspeichern (3 × 20 000 Einträge): Median unter 50 ms', median < 50, `Median ${median.toFixed(1)} ms, 90 % ${p90.toFixed(1)} ms`);
    // 3.84.0: Speicherschicht hält ein Merkmal statt des Volltexts je Wert. Gemessen in diesem Aufbau: 78 MB mit Textkopien, 42 MB ohne; Grenze dazwischen
    const cdp = await ctx.newCDPSession(page); await cdp.send('HeapProfiler.collectGarbage'); const heap = (await cdp.send('Runtime.getHeapUsage')).usedSize / 1048576;
    check('Arbeitsspeicher mit vollen Lernspeichern unter 60 MB (keine Textkopien aller Speicher)', heap < 60, `${heap.toFixed(0)} MB`);
    check('Gespeicherter Stand vollständig sichtbar (Strategie-Protokoll 20 000 Einträge)', await page.evaluate(() => __analysis.feed.runtime('range-return').records().length) === 20000);
    check('keine Fehler', !real(errors).length, real(errors).join(' | '));
    await ctx.close();
  } catch (e) { check('Abbruch', false, e.stack || e.message); }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
