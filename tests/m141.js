// 3.84.0 – Markt-Lage: Feld „Markt-Lage · BTC-Dominanz & ETH/BTC“ unter den Krypto-Terminen; Dominanz, ETH- und Stablecoin-Anteil aus der Datei
// des GitHub-Ablaufs (Zweig markt-lage), ETH/BTC aus Binance-Tageskerzen; Urteil, Fehlerfälle, Handy.
// Aufruf: node m141.js
const h = require('./harness');
const results = [], check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 600) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR|status of 404/.test(e));
const until = async (fn, ms = 20000, step = 200) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
const text = (page, sel) => page.evaluate(s => document.querySelector(s)?.textContent || '', sel);
(async () => {
  await h.setup(); await h.ctl('/reset'); await h.ctl('/walk?on=0');
  const browser = await h.launch({ workspace: 'fresh' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(`${h.URL_BASE}/weather-widget-v2.html`);
    await until(() => page.evaluate(() => window.__marketContext && document.getElementById('market-context')));
    await page.click('[data-workspace-target="ind"]'); await page.waitForTimeout(400);
    const closed = await page.evaluate(() => { const r = document.getElementById('market-context'); return { open: r.open, summary: r.querySelector('summary').textContent, inEcon: !!document.querySelector('#econ #market-context'), head: document.querySelector('.mkt-headline').textContent }; });
    check('Feld unter den Terminen, anfangs zu; Überschrift sagt ehrlich „zu wenig Verlauf“', !closed.open && closed.inEcon && /Markt-Lage · BTC-Dominanz & ETH\/BTC/.test(closed.summary) && /zu wenig Verlauf/.test(closed.head), JSON.stringify(closed));
    check('Geschlossen wird nichts geladen', await page.evaluate(() => __marketContext.state.at === 0 && !__marketContext.state.busy));
    const eth = await page.evaluate(async () => (await (await fetch('https://data-api.binance.vision/api/v3/klines?symbol=ETHBTC&interval=1d&limit=14')).json()).map(r => ({ time: r[0], close: +r[4] })));
    const pct = n => { const last = eth.at(-1), before = eth.at(-1 - n); return last.time - before.time === n * 864e5 ? (last.close / before.close - 1) * 100 : null; };
    await page.click('#market-context > summary');
    await until(() => page.evaluate(() => __marketContext.state.at > 0));
    await page.waitForTimeout(300);
    const rows = await page.evaluate(() => [...document.querySelectorAll('#market-context .mkt-list > div')].map(d => [...d.children].map(c => c.textContent)));
    const by = k => rows.find(r => r[0] === k);
    check('Werte aus der Datei: BTC-Dominanz 53,4 % (24 h −0,2 · 7 T −1,4 Pkt.), ETH-Anteil, Stablecoins 5,5 %, Gesamtmarkt', by('BTC-Dominanz')?.[1] === '53,4 %' && /24 h −0,2 Pkt\. · 7 T −1,4 Pkt\./.test(by('BTC-Dominanz')?.[2]) && by('ETH-Anteil')?.[1] === '12,4 %' && by('Stablecoins (USDT + USDC)')?.[1] === '5,5 %' && /7 T \+0,4 Pkt\./.test(by('Stablecoins (USDT + USDC)')?.[2]) && by('Gesamtmarkt')?.[1] === '3,20 Bio. $' && /24 h \+1,2 %/.test(by('Gesamtmarkt')?.[2]), JSON.stringify(rows));
    const fmt = v => (v === null ? '–' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`);
    check('ETH/BTC aus den Binance-Tageskerzen: Stand, 24 h und 7 Tage stimmen mit einer unabhängigen Rechnung überein', by('ETH/BTC') && by('ETH/BTC')[1] === eth.at(-1).close.toLocaleString('de-DE', { minimumFractionDigits: 5, maximumFractionDigits: 5 }) && by('ETH/BTC')[2] === `24 h ${fmt(pct(1))} · 7 T ${fmt(pct(7))}`, JSON.stringify([by('ETH/BTC'), fmt(pct(1)), fmt(pct(7))]));
    const d7 = pct(7), expected = d7 === null ? 'alt' : d7 >= 1.5 ? 'alt' : d7 <= -1.5 ? 'neutral' : 'alt';   // Dominanz −1,4 Pkt. → Stimme „Altcoins“; ETH/BTC: ≥ +1,5 % Altcoins, ≤ −1,5 % hebt auf
    const head = await page.evaluate(() => ({ status: document.querySelector('.mkt-headline').dataset.status, text: document.querySelector('.mkt-headline').textContent }));
    check('Urteil folgt der Regel (fallende Dominanz zählt für Altcoins; ETH/BTC kann es bestätigen oder aufheben)', head.status === expected, JSON.stringify({ head, d7, expected }));
    check('Hinweis zum steigenden Stablecoin-Anteil und Stand-Zeile ohne Warnung', /Stablecoin-Anteil steigt/.test(await text(page, '#market-context .crypto-calendar-note:not(.err)')) && /^Stand \d{2}\.\d{2}\.\d{4}.* MEZ\/MESZ\.$/.test(await text(page, '#market-context-status')), await text(page, '#market-context-status'));
    await page.click('#market-context-info > summary'); await page.waitForTimeout(250);
    const info = await text(page, '#market-context-info .explain-body');
    check('„Quelle & Grenzen“ nennt CoinGecko, Binance, die Schwellen, keine Kursprognose und kein Handelssignal', /CoinGecko/.test(info) && /Binance/.test(info) && /0,5 Punkte/.test(info) && /1,5 %/.test(info) && /keine Kursprognose und kein Handelssignal/.test(info));
    // Fehlerfälle
    await h.ctl('/markt?mode=alt'); await page.click('#market-context-refresh'); await until(() => page.evaluate(() => !__marketContext.state.busy)); await page.waitForTimeout(300);
    const stale = await page.evaluate(() => ({ s: document.getElementById('market-context-status').textContent, err: document.getElementById('market-context-status').classList.contains('err') }));
    check('Datei älter als 6 Stunden: Stand-Zeile warnt (rot)', /älter als 6 Stunden/.test(stale.s) && stale.err, JSON.stringify(stale));
    await h.ctl('/markt?mode=fehlt'); await page.click('#market-context-refresh'); await until(() => page.evaluate(() => !__marketContext.state.busy)); await page.waitForTimeout(300);
    const missing = await text(page, '#market-context-status');
    check('Datei noch nicht veröffentlicht (404): verständliche Meldung, letzter Stand bleibt sichtbar', /noch nicht veröffentlicht.*Markt-Lage/.test(missing) && (await page.evaluate(() => document.querySelectorAll('#market-context .mkt-list > div').length)) >= 4, missing);
    await h.ctl('/markt?mode=kaputt'); await page.click('#market-context-refresh'); await until(() => page.evaluate(() => !__marketContext.state.busy)); await page.waitForTimeout(300);
    check('Kaputtes Format: Meldung „unbekanntes Format“, App läuft weiter', /unbekanntes Format/.test(await text(page, '#market-context-status')));
    await h.ctl('/markt?mode=ok'); await page.click('#market-context-refresh'); await until(() => page.evaluate(() => !__marketContext.state.busy)); await page.waitForTimeout(300);
    check('Nach Behebung: Meldung weg, Werte wieder frisch', !(await page.evaluate(() => document.getElementById('market-context-status').classList.contains('err'))) && by('BTC-Dominanz') !== undefined);
    // gespeichert / Neustart
    await page.reload(); await until(() => page.evaluate(() => window.__marketContext && document.getElementById('market-context')));
    await page.click('[data-workspace-target="ind"]'); await page.waitForTimeout(300);
    check('Nach Neustart steht der letzte Stand sofort da (ohne Abruf, Feld zu)', await page.evaluate(() => __marketContext.state.history.length > 100 && __marketContext.state.at > 0 && document.querySelectorAll('#market-context .mkt-list > div').length >= 4 && !document.getElementById('market-context').open));
    // Handy
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), mp = await mctx.newPage(); h.collect(mp, errors);
    await mp.goto(`${h.URL_BASE}/weather-widget-v2.html`); await until(() => mp.evaluate(() => window.__marketContext && document.getElementById('market-context')));
    await mp.click('[data-workspace-target="ind"]'); await mp.waitForTimeout(300); await mp.click('#market-context > summary'); await until(() => mp.evaluate(() => __marketContext.state.at > 0)); await mp.waitForTimeout(300);
    const mobile = await mp.evaluate(() => { const r = document.getElementById('market-context').getBoundingClientRect(); return { right: r.right, vw: innerWidth, doc: document.documentElement.scrollWidth, btn: document.getElementById('market-context-refresh').getBoundingClientRect().height }; });
    check('Handy 390 px: Feld ohne seitliches Überlaufen, „Aktualisieren“ mindestens 44 px hoch', mobile.right <= mobile.vw + 1 && mobile.doc <= mobile.vw + 1 && mobile.btn >= 44, JSON.stringify(mobile));
    await mctx.close();
    check('keine Laufzeitfehler', !real(errors).length, real(errors).join(' | '));
    await ctx.close();
  } catch (e) { check('Abbruch', false, e.stack || e.message); }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
