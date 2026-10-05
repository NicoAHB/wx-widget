// 3.20.0 – Ganz wichtige News und Termine zum geöffneten Coin: Bereich unter dem Wirtschaftskalender (vor der
// Signal-Übersicht), nur Einträge des geöffneten Coins; Termine (Binance) zuerst mit Countdown, dann Meldungen mit Alter,
// Kategorie und Medium; Links in neuem Tab ohne Referrer; „auch wichtig“ mit „Alle anzeigen“ (gespeichert); Coinwechsel;
// veraltet, noch keine Daten (404), kaputte Datei, Quelle aus mit gespeichertem Stand; Handy 390/320 px und Tablet.
// Aufruf: node m30.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const quiet = e => !/Failed to load resource: the server responded with a status of (404|500)/.test(e); // erwartete Antworten der Attrappe
const info = page => page.evaluate(() => {
  const q = s => document.querySelector(s), y = e => { const r = e.getBoundingClientRect(); return { t: Math.round(r.top + scrollY), b: Math.round(r.bottom + scrollY) }; };
  const rows = [...document.querySelectorAll('#cnews .cn-row')].map(r => ({ cls: r.className, meta: r.querySelector('.cn-meta').textContent, title: r.querySelector('.cn-title').textContent,
    href: r.querySelector('.cn-title').href, target: r.querySelector('.cn-title').target, rel: r.querySelector('.cn-title').rel, note: r.querySelector('.cn-note')?.textContent || '' }));
  return { coin: q('#cnews-coin').textContent, h2: q('#cnews-title').textContent, rows, heads: [...document.querySelectorAll('#cnews .ec-day')].map(d => d.textContent), empty: q('#cnews .ec-empty')?.textContent || '',
    src: q('#cnews-src').textContent, srcErr: q('#cnews-src').classList.contains('err'), more: q('#cnews-more').hidden ? null : q('#cnews-more').textContent, imp: q('#cnews-imp').value,
    order: { chart: y(q('#chart-sec')), econ: y(q('#econ')), cnews: y(q('#cnews')), signals: y(q('#signals')) }, sw: document.scrollingElement.scrollWidth - innerWidth };
});
const coin = async (page, sym) => { await page.evaluate(s => { document.getElementById('symbol').value = s; document.getElementById('market-form').requestSubmit(); }, sym); await page.waitForTimeout(1600); };
const staleSaved = page => page.evaluate(() => new Promise(res => { const r = indexedDB.open('scalpdesk', 1); r.onsuccess = () => { const tx = r.result.transaction('kv', 'readwrite'), st = tx.objectStore('kv'), g = st.get('scalpdesk.idb.cnewsdata'); g.onsuccess = () => { st.put({ ...g.result, at: 1 }, 'scalpdesk.idb.cnewsdata'); }; tx.oncomplete = () => res(); }; }));
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset');
  const browser = await h.launch();
  const open = async (mode, view = { viewport: { width: 1440, height: 1000 } }) => {
    await h.ctl(`/news?mode=${mode}`);
    const ctx = await browser.newContext(view), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await page.waitForTimeout(2500);
    return { ctx, page, errors };
  };
  try {
    // ---- Computer: BTC (Standard) ----
    let { ctx, page, errors } = await open('normal'), d = await info(page);
    const o = d.order;
    check('Bereich unter dem Wirtschaftskalender, vor der Signal-Übersicht', o.cnews.t >= o.econ.b - 1 && o.signals.t >= o.cnews.b - 1 && o.econ.t >= o.chart.b - 1, JSON.stringify(o));
    check('BTC: „News & Termine · BTC“, eine sehr wichtige Meldung (Recht), ETF-Zuflüsse ausgeblendet', d.h2 === 'News & Termine · BTC' && d.rows.length === 1 && /^vor [23] h · Recht · XTB\.com$/.test(d.rows[0].meta) && /^Krypto News: SEC erlaubt/.test(d.rows[0].title) && !d.heads.length && d.more === null,
      JSON.stringify(d.rows.map(r => r.meta)));
    check('Stand: „Binance · Google News · Stand … · stündlich“', /^Binance · Google News · Stand \d\d:\d\d · stündlich$/.test(d.src) && !d.srcErr, d.src);
    // ---- XRP ----
    await coin(page, 'XRP'); d = await info(page);
    const [r0, r1, r2, r3] = d.rows;
    check('XRP: Termine zuerst, dann Meldungen (4 Einträge)', d.coin === 'XRP' && d.heads.join() === 'Termine,Meldungen' && d.rows.length === 4, JSON.stringify({ heads: d.heads, n: d.rows.length }));
    check('Termin in 5 h: hervorgehoben, Zeit mit Countdown, „Netzwerk-Upgrade · Binance“, Erklärung', /\bsoon\b/.test(r0.cls) && /^(Heute|Morgen) \d\d:\d\d · in (5 h( 1 min)?|4 h 59 min) · Netzwerk-Upgrade · Binance$/.test(r0.meta) && /^Ein- und Auszahlungen bei Binance ruhen/.test(r0.note), r0.meta);
    check('Entferntes Handelspaar: in 3 Tagen, nennt XRP/USDT', !/\bsoon\b/.test(r1.cls) && /Handelspaar entfällt · Binance$/.test(r1.meta) && r1.note === 'Binance entfernt das Handelspaar XRP/USDT.', `${r1.meta} | ${r1.note}`);
    check('Meldungen: Alter, Kategorie, Medium, weitere Medien; neueste zuerst', /^vor [5-7] min · Sicherheit · FinanzNachrichten\.de und 2 weitere Medien$/.test(r2.meta) && /^vor [12] h · Netzwerk · CryptoTicker$/.test(r3.meta), `${r2.meta} | ${r3.meta}`);
    check('Links: Binance-Ankündigung und Google News, neuer Tab, ohne Referrer', r0.href === `https://www.binance.com/de/support/announcement/detail/${'a'.repeat(32)}` && /^https:\/\/news\.google\.com\/rss\/articles\//.test(r2.href) && d.rows.every(r => r.target === '_blank' && r.rel === 'noopener noreferrer'),
      JSON.stringify([r0.href, r2.href]));
    // auch wichtig, alle anzeigen
    await page.selectOption('#cnews-imp', 'medium'); await page.waitForTimeout(400); d = await info(page);
    check('„auch wichtig“: 5 von 6 Einträgen, „Alle anzeigen (6)“', d.rows.length === 5 && d.more === 'Alle anzeigen (6)' && d.rows.some(r => /· ETF · Wallstreet Online$/.test(r.meta)), JSON.stringify({ n: d.rows.length, more: d.more }));
    await page.click('#cnews-more'); await page.waitForTimeout(300); d = await info(page);
    const fut = d.rows.at(-1);
    // Der Futures-Start liegt 30 h zurück: ab 6 Uhr „Gestern“, davor vorgestern mit Datum (z. B. „Mo. 28.09.“)
    const futDay = await page.evaluate(() => { const e = new Date(Date.now() - 30 * 3600e3), y = new Date(); y.setDate(y.getDate() - 1); return e.toDateString() === y.toDateString() ? 'Gestern' : e.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace(',', ''); });
    check(`„Alle anzeigen“: auch der vergangene Futures-Start (wichtig, orange, „${futDay}“), danach „Weniger anzeigen“`, d.rows.length === 6 && /\bmedium\b/.test(fut.cls) && fut.meta.startsWith(futDay + ' ') && / \d\d:\d\d · Futures-Start · Binance$/.test(fut.meta) && d.more === 'Weniger anzeigen', `${fut.meta} ${d.more}`);
    await page.reload(); await live(page); await page.waitForTimeout(2000); d = await info(page);
    check('Nach dem Neuladen: „auch wichtig“ gespeichert, wieder eingeklappt', d.imp === 'medium' && (d.coin !== 'XRP' || d.rows.length === 5), `${d.imp} ${d.coin} ${d.rows.length}`);
    // NEAR: Beobachtungsliste ohne Termin, lange Schlagzeile
    await coin(page, 'NEAR'); d = await info(page);
    const mon = d.rows.find(r => /Beobachtungsliste/.test(r.meta));
    check('NEAR: Beobachtungsliste (ohne Termin, nach Alter), Erklärung zum Risiko', d.coin === 'NEAR' && !d.heads.length && mon && /^vor [45] h · Beobachtungsliste · Binance$/.test(mon.meta) && /erhöhten Risikos; ein Delisting ist möglich\.$/.test(mon.note), JSON.stringify(d.rows.map(r => r.meta)));
    // ETC: nichts
    await coin(page, 'ETC'); d = await info(page);
    check('ETC: „Keine wichtigen Meldungen oder Termine zu ETC.“', d.coin === 'ETC' && !d.rows.length && d.empty === 'Keine wichtigen Meldungen oder Termine zu ETC.' && d.more === null, d.empty);
    await page.selectOption('#cnews-imp', 'high');
    check('Computer: keine Fehler', !errors.length, errors.join(' | ')); await ctx.close();

    // ---- veraltet ----
    ({ ctx, page, errors } = await open('stale')); d = await info(page);
    check('Stand älter als 4 h: „veraltet, GitHub-Job prüfen“ rot', / – veraltet, GitHub-Job prüfen$/.test(d.src) && d.srcErr && d.rows.length === 1, d.src);
    await ctx.close();
    // ---- noch keine Daten ----
    ({ ctx, page, errors } = await open('missing')); d = await info(page);
    check('Noch keine Datei (404): Hinweis auf den GitHub-Job', !d.rows.length && d.empty === 'Noch keine Meldungen – der GitHub-Job legt sie nach der Veröffentlichung an.' && !d.src, d.empty);
    check('404: keine weiteren Fehler', !errors.filter(quiet).length, errors.filter(quiet).join(' | ')); await ctx.close();
    // ---- kaputte Datei ----
    ({ ctx, page, errors } = await open('broken')); d = await info(page);
    check('Kaputte Datei: „Nachrichtendatei ungültig“, keine Fehler', !d.rows.length && d.empty === 'Nachrichtendatei ungültig' && !errors.filter(quiet).length, `${d.empty} ${errors.join(' | ')}`); await ctx.close();
    // ---- Quelle aus, gespeicherter Stand bleibt ----
    ({ ctx, page, errors } = await open('normal')); await staleSaved(page);
    await h.ctl('/news?mode=error'); await page.reload(); await live(page); await page.waitForTimeout(2500); d = await info(page);
    check('Quelle nicht erreichbar: letzter Stand bleibt, „gerade nicht erreichbar“', d.rows.length === 1 && / · gerade nicht erreichbar$/.test(d.src) && d.srcErr, d.src);
    check('Quelle aus: keine weiteren Fehler', !errors.filter(quiet).length, errors.filter(quiet).join(' | ')); await ctx.close();

    // ---- Handy und Tablet ----
    for (const [w, ht] of [[390, 844], [320, 700], [820, 1180]]) {
      ({ ctx, page, errors } = await open('normal', { viewport: { width: w, height: ht }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }));
      await coin(page, w === 320 ? 'NEAR' : 'XRP'); d = await info(page);
      const ord = d.order, m = await page.evaluate(() => {
        const R = e => e.getBoundingClientRect(), panel = R(document.getElementById('cnews'));
        return { cut: [...document.querySelectorAll('#cnews *')].filter(e => { const r = R(e); return e.checkVisibility() && r.width && (r.right > panel.right + 1 || r.left < panel.left - 1); }).map(e => e.className || e.tagName).slice(0, 4), layout: document.documentElement.dataset.layout || '' };
      });
      check(`${w} px: unter Chart und Kalender, vor der Signal-Übersicht`, ord.econ.t >= ord.chart.b - 1 && ord.cnews.t >= ord.econ.b - 1 && ord.signals.t >= ord.cnews.b - 1, JSON.stringify({ ...ord, layout: m.layout }));
      check(`${w} px: ${d.rows.length} Einträge, nichts ragt heraus, kein seitliches Scrollen`, d.rows.length >= 3 && !m.cut.length && d.sw <= 0, JSON.stringify({ n: d.rows.length, cut: m.cut, sw: d.sw }));
      await page.evaluate(() => document.getElementById('cnews').scrollIntoView({ block: 'start' })); await page.click('#cnews .tip summary'); await page.waitForTimeout(400);
      const tip = await page.evaluate(() => { const r = document.querySelector('#cnews .tip-body').getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), vw: innerWidth, vis: document.querySelector('#cnews .tip-body').checkVisibility() }; });
      check(`${w} px: Info öffnet ganz im Fenster`, tip.vis && tip.l >= 0 && tip.r <= tip.vw, JSON.stringify(tip));
      check(`${w} px: keine Fehler`, !errors.length, errors.join(' | ')); await ctx.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await h.ctl('/news?mode=normal').catch(() => {}); await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
