// G08 der Übergabe (3.36.0): Bitcoin-Entkopplung aus den allgemeinen Top 100.
// Rangliste CoinLore, Stablecoins über die versionierte Liste entfernt (nicht aufgefüllt), Binance-Spot-Statistik im rollierenden
// Fenster, C/B/D in Prozentpunkten, Lücken mit Grund, Klick lädt den Coin in den vorhandenen Chart, ein Scheduler mit Abbruch,
// Bremsen und Backoff. Alles gegen den Test-Server (mock-binance.js, /dec).
// Aufruf: node m57.js [abschnitt ...]   Abschnitte: unit, list, faults, corr, click, sched, errors
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 600) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR|status of (429|500|503)/.test(e));
const until = async (fn, ms = 20000, step = 200) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
async function openPage(browser, { seed = {}, viewport = { width: 1500, height: 1000 }, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport, timezoneId: 'Europe/Berlin', ...(mobile ? { hasTouch: true, isMobile: true } : {}) });
  await ctx.addInitScript(items => { if (localStorage.getItem('seeded57')) return; localStorage.setItem('seeded57', '1'); for (const [k, v] of items) localStorage.setItem(k, JSON.stringify(v)); }, Object.entries(seed));
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  await page.goto(`${h.URL_BASE}/weather-widget-v2.html`);
  await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  return { ctx, page, errors };
}
const decLog = async () => (await h.ctl('/dec')).log;
const openDec = async page => { await page.evaluate(() => { const d = document.getElementById('dec-sec'); d.scrollIntoView({ block: 'start' }); if (!d.open) d.querySelector('summary').click(); }); };
const decReady = page => until(() => page.evaluate(() => !__g08.dec.running && (!!__g08.dec.res || !!__g08.dec.err)), 20000);
const rows = page => page.evaluate(() => [...document.querySelectorAll('#dec-list button.dec-row')].map(b => ({ pair: b.dataset.pair, st: b.classList.contains('bull') ? 'bull' : 'bear', cells: [...b.children].map(c => c.textContent), d: b.querySelector('.dec-d')?.textContent, title: b.title, cur: b.classList.contains('cur') })));
const txt = (page, sel) => page.evaluate(sel => document.querySelector(sel)?.textContent ?? null, sel);

const tests = {
  async unit(browser) {
    const { ctx, page, errors } = await openPage(browser);
    const r = await page.evaluate(() => {
      const g = __g08, cfg = { coin: 2, btc: 0.5 }, sig = (c, b) => { const s = g.decSignal(c, b, cfg); return s.st + (s.D != null ? ':' + +s.D.toFixed(6) : ''); };
      const W = '4h', now = Date.now(), T = (o, c, extra = {}) => ({ openPrice: String(o), lastPrice: String(c), openTime: now - 144e5 - 3e4, closeTime: now, count: 10, ...extra });
      const k = (n, f, step = 6e4, skip = -1) => Array.from({ length: n }, (_, i) => [i * step, f(i)]).filter((_, i) => i !== skip);
      return {
        ex: [sig(3, -1), sig(1, -5), sig(2, 0.4), sig(2, 0.5), sig(-2, 0.5), sig(-2, -0.5), sig(2, -0.5), sig(2, 0), sig(-2, 0), sig(2, null)],
        tick: [g.decTick(T(0, 1), W, now).why, g.decTick(T(-1, 1), W, now).why, g.decTick(T(1, 1.1, { openTime: now - 36e5 }), W, now).why, g.decTick(T(1, 1.1, { closeTime: now - 4e5, openTime: now - 4e5 - 144e5 }), W, now).why, g.decTick(T(1, 1.1, { count: 0 }), W, now).why, +g.decTick(T(100, 103), W, now).chg.toFixed(9)],
        rho: [g.decPearson(k(61, i => 100 * Math.exp(Math.sin(i) / 50)), k(61, i => 50 * Math.exp(Math.sin(i) / 50)), 6e4), g.decPearson(k(21, i => 100 + i), k(21, i => 100 + i), 6e4), g.decPearson(k(61, () => 100), k(61, i => 100 + i), 6e4), g.decPearson(k(40, i => 100 * Math.exp(Math.sin(i) / 50), 6e4, 20), k(40, i => 100 * Math.exp(Math.sin(i) / 50)), 6e4)],
        cls: [g.decClassify({ sym: 'USDT', name: 'Tether', nameid: 'tether' }), g.decClassify({ sym: 'PAXG', name: 'PAX Gold', nameid: 'pax-gold' }), g.decClassify({ sym: 'USDZ', name: 'Some USD Token', nameid: 'some-usd' }), g.decClassify({ sym: 'BTC', name: 'Bitcoin', nameid: 'bitcoin' }), g.decClassify({ sym: 'UNI', name: 'Unicorn Dust', nameid: 'unicorn-dust' }), g.decClassify({ sym: 'SOL', name: 'Solana', nameid: 'solana' })],
        parse: [g.decLoreParse({ data: 'x' }), g.decLoreParse({ data: [{ id: 1, symbol: 'A', name: 'A' }] }), g.decLoreParse({ data: [{ id: 2, symbol: 'b', name: 'B', rank: 2, price_usd: '1' }, { id: 1, symbol: 'a', name: 'A', rank: 1, price_usd: '0' }] })],
      };
    });
    check('Beispiele der Übergabe: +3/−1 bullish +4 Pp.; +1/−5 kein Treffer; +2/+0,4 bullish; +2/+0,5 kein Treffer (BTC steigt)', JSON.stringify(r.ex.slice(0, 4)) === JSON.stringify(['bull:4', 'none:6', 'bull:1.6', 'none:1.5']), r.ex.join(' | '));
    check('Schwelle genau: −0,5 zählt als fallend, B = 0 als seitwärts; Bearish nur bei BTC steigt/seitwärts; ohne BTC kein Vergleich', JSON.stringify(r.ex.slice(4)) === JSON.stringify(['bear:-2.5', 'none:-1.5', 'bull:2.5', 'bull:2', 'bear:-2', 'na']), r.ex.slice(4).join(' | '));
    check('Statistik geprüft: Ausgangspreis 0 und negativ, zu kurzes Fenster, veraltet, keine Trades – je mit Grund; +3 % aus 100 → 103', /0 bzw\. negativ/.test(r.tick[0]) && /0 bzw\. negativ/.test(r.tick[1]) && /Zeitfenster/.test(r.tick[2]) && /veraltet/.test(r.tick[3]) && /keine Trades/.test(r.tick[4]) && Math.abs(r.tick[5] - 3) < 1e-6, JSON.stringify(r.tick));
    check('Pearson: gleiche Renditen ρ = 1; unter 30 Paaren und Varianz 0 → kein Wert mit Grund; fehlende Kerze nicht mit 0 gefüllt', Math.abs(r.rho[0].rho - 1) < 1e-9 && r.rho[1].rho === null && /zu wenige/.test(r.rho[1].why) && r.rho[2].rho === null && /Varianz 0/.test(r.rho[2].why) && r.rho[3].n === 37, JSON.stringify(r.rho.map(x => [x.rho, x.n, x.why])));
    check('Klassifikation über Liste (Kürzel + Anbieter-ID): Tether und PAX Gold Stablecoin, „USDZ“ trotz „USD“ ungeprüft, gleichnamiges UNI ungeprüft', JSON.stringify(r.cls) === JSON.stringify(['stable', 'stable', 'unreviewed', 'ok', 'unreviewed', 'ok']), r.cls.join(','));
    check('Rangliste geprüft: falsches Format → null; nach Rang sortiert, Preis 0 → unbekannt (null)', r.parse[0] === null && r.parse[1] === null && r.parse[2]?.[0].sym === 'A' && r.parse[2][0].price === null && r.parse[2][1].price === 1, JSON.stringify(r.parse[2]));
    check('keine Fehler (unit)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  async list(browser) {
    const { ctx, page, errors } = await openPage(browser);
    await h.ctl('/dec?clear=1');
    check('Bereich anfangs zu: keine Abfrage an CoinLore oder die Statistik', (await decLog()).length === 0 && !(await page.evaluate(() => document.getElementById('dec-sec').open)));
    await openDec(page); await decReady(page);
    const lg = await decLog(), rs = await rows(page);
    check('Geöffnet: eine Rangliste (CoinLore) und eine gebündelte 4h-Abfrage für BTC + 8 Paare', lg.filter(x => x.src === 'lore').length === 1 && lg.filter(x => x.src === 'bin').length === 1 && lg.find(x => x.src === 'bin')?.n === 9 && lg.find(x => x.src === 'bin')?.ws === '4h', JSON.stringify(lg));
    check('4h (BTC −1 %): SOL +4 Pp., LTC +4 Pp. (Gleichstand → Rang), XRP +3,5 Pp.; BCH −2,2 bei fallendem BTC kein Treffer', rs.map(r => r.pair).join() === 'SOLUSDT,LTCUSDT,XRPUSDT' && rs.every(r => r.st === 'bull'), JSON.stringify(rs.map(r => [r.pair, r.d])));
    const c = rs[0]?.cells || [], cap = await txt(page, '#dec-list .dec-cap');
    check('Zeile (Optimierung 3): nur Kürzel, Rang und Abweichung zu BTC; Name, Preis, Coin-/BTC-% und Datenzeit im Tooltip; BTC-Wert einmal oben', JSON.stringify(c) === JSON.stringify(['SOL#5', '+4,00 %']) && /^Solana \(SOL\/USDT, Binance Spot\): Coin \+3,00 %, BTC −1,00 % → \+4,00 Prozentpunkte Abweichung · Preis 1[45]\d,\d+ USDT · Daten \d\d:\d\d UTC/.test(rs[0].title) && /^BTC 4h: −1,00 % · rechts: Abweichung des Coins zu BTC in Prozentpunkten/.test(cap), JSON.stringify({ c, t: rs[0]?.title, cap }));
    const cov = await txt(page, '#dec-cov'), gaps = await page.evaluate(() => document.querySelector('#dec-gaps ul')?.textContent || '');
    check('Abdeckung aus echten Daten: „7 von 13 … auswertbar“, 3 Stablecoins (USDT, USDC, PAXG) entfernt und nicht aufgefüllt, BTC Referenz', /^7 von 13 grundsätzlich geeigneten Coins auswertbar · 3 Stablecoins entfernt/.test(cov) && /BTC ist Referenz/.test(cov), cov);
    check('Lücken mit Grund statt Nicht-Treffer: DOGE (Paar BREAK) und LEO nicht bei Binance, KAS Preis passt nicht, UNI mehrdeutig, XNEW und Unicorn ungeprüft', /nicht bei Binance Spot \(USDT\) \(2\): DOGE, LEO/.test(gaps) && /Zuordnung zweifelhaft\) \(1\): KAS/.test(gaps) && /Kürzel mehrdeutig in der Rangliste \(1\): UNI/.test(gaps) && /ungeprüft \(nicht in der Klassifikationsliste\) \(2\): XNEW, UNI/.test(gaps), gaps);
    check('Quelle genannt: Rangliste CoinLore mit Stand, Binance Spot rollierendes 4h-Fenster, nur Signale', /^Rangliste: CoinLore, Stand \d\d\.\d\d\.\d{4}, \d\d:\d\d UTC · Kurse: Binance Spot, rollierendes 4h-Fenster bis \d\d:\d\d:\d\d UTC · nur Signale, keine Kaufempfehlung/.test(await txt(page, '#dec-foot')), await txt(page, '#dec-foot'));
    await page.click('[data-dfil="bear"]'); await page.waitForTimeout(150);
    check('Filter Bearish: leerer Trefferbestand als eigener Zustand (nicht als Fehler)', !(await rows(page)).length && /^Keine Treffer bei diesen Schwellen \(4h: Coin ab ±2,0 %, BTC seitwärts unter ±0,5 %\)\.$/.test(await txt(page, '#dec-status')), await txt(page, '#dec-status'));
    await page.click('[data-dfil="all"]'); await page.click('[data-dwin="1h"]'); await decReady(page); await until(async () => (await rows(page)).length && (await page.evaluate(() => __g08.dec.res?.win)) === '1h', 8000);
    const r1 = await rows(page);
    check('1h (BTC −0,2 % seitwärts): SOL bullish +2,7 Pp., BCH bearish −2,3 Pp.', r1.map(r => `${r.pair}:${r.st}:${r.d}`).join() === 'SOLUSDT:bull:+2,70 %,BCHUSDT:bear:−2,30 %', JSON.stringify(r1.map(r => [r.pair, r.st, r.d])));
    await page.click('[data-dwin="24h"]'); await decReady(page); await until(async () => (await page.evaluate(() => __g08.dec.res?.win)) === '24h', 8000);
    const r24 = await rows(page), lg24 = (await decLog()).filter(x => x.src === 'bin').at(-1);
    check('24h (Parameter 1d, BTC +0,6 % steigt): nur XRP bearish −3,6 Pp.; SOL +5 % bei steigendem BTC kein Treffer', lg24?.ws === '1d' && r24.map(r => `${r.pair}:${r.st}:${r.d}`).join() === 'XRPUSDT:bear:−3,60 %', JSON.stringify({ ws: lg24?.ws, r: r24.map(r => [r.pair, r.cells[4]]) }));
    await page.click('[data-dwin="4h"]'); await page.fill('#dec-coin', '2,1'); await page.press('#dec-coin', 'Enter'); await page.fill('#dec-btc', '1,5'); await page.press('#dec-btc', 'Enter'); await page.waitForTimeout(400);
    const rt = await rows(page);
    check('Schwellen einstellbar (mit Komma): Coin ab ±2,1 % und BTC seitwärts unter ±1,5 % → SOL, LTC, XRP und jetzt BCH bearish −1,2 Pp. (BTC −1 % gilt als seitwärts)', rt.map(r => r.pair).join() === 'SOLUSDT,LTCUSDT,XRPUSDT,BCHUSDT' && rt[3].st === 'bear' && rt[3].d === '−1,20 %' && (await page.inputValue('#dec-coin')) === '2,1', JSON.stringify(rt.map(r => [r.pair, r.st, r.d])));
    await page.reload(); await page.waitForTimeout(1500);
    const kept = await page.evaluate(() => ({ cfg: __g08.dec.cfg, open: document.getElementById('dec-sec').open }));
    check('Einstellungen bleiben nach Neuladen (und stehen in der Sicherung), der Bereich bleibt offen', kept.cfg.coin === 2.1 && kept.cfg.btc === 1.5 && kept.cfg.win === '4h' && kept.open, JSON.stringify(kept));
    check('keine Fehler (list)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  async faults(browser) {
    const { ctx, page, errors } = await openPage(browser);
    await h.ctl('/dec?zero=ETCUSDT&inactive=NEARUSDT&stale=LTCUSDT');
    await openDec(page); await decReady(page);
    const gaps = await page.evaluate(() => document.querySelector('#dec-gaps ul')?.textContent || ''), cov = await txt(page, '#dec-cov'), rs = await rows(page);
    check('Ausgangspreis 0 (ETC), keine Trades (NEAR) und veraltetes Fenster (LTC) als Lücken mit Grund, nicht als Nicht-Treffer; LTC kein Treffer mehr', /0 bzw\. negativ \(1\): ETC/.test(gaps) && /Markt inaktiv\) \(1\): NEAR/.test(gaps) && /Daten veraltet \(1\): LTC/.test(gaps) && /^4 von 13/.test(cov) && rs.map(r => r.pair).join() === 'SOLUSDT,XRPUSDT', JSON.stringify({ gaps, cov, rs: rs.map(r => r.pair) }));
    await h.ctl('/dec?zero=&inactive=&stale=&nobtc=1'); await page.evaluate(() => __g08.kick()); await page.waitForTimeout(300); await decReady(page);
    check('BTC fehlt: Vergleich gesperrt mit Grund, keine Treffer, „0 von 13 auswertbar“', /^BTC fehlt – Vergleich gesperrt \(keine Kursdaten\)\.$/.test(await txt(page, '#dec-status')) && !(await rows(page)).length && /^0 von 13/.test(await txt(page, '#dec-cov')), await txt(page, '#dec-status'));
    check('keine Fehler (faults)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  async corr(browser) {
    // Korrelation optional, anfangs aus; eingeschaltet nur für angezeigte Treffer, BTC-Reihe einmal geteilt
    const { ctx, page, errors } = await openPage(browser);
    const t0 = Date.now(); await openDec(page); await decReady(page);
    const HITS = ['SOLUSDT', 'LTCUSDT', 'XRPUSDT'], kl = async () => (await h.ctl(`/log?since=${t0}`)).filter(e => e.path === '/api/v3/klines' && e.q.interval === '5m' && HITS.includes(e.q.symbol));   // BTC-5m lädt die App auch für ihre Signale
    check('Korrelation anfangs aus: keine Kerzen für die Korrelation geladen, keine Spalte', !(await page.evaluate(() => __g08.dec.cfg.corr)) && !(await kl()).length && !(await page.evaluate(() => document.querySelector('#dec-list .dec-r'))));
    await page.check('#dec-corr'); await until(() => page.evaluate(() => [...document.querySelectorAll('#dec-list button .dec-r')].length && [...document.querySelectorAll('#dec-list button .dec-r')].every(e => e.textContent !== 'Korr. …')), 15000);
    const r = await page.evaluate(() => [...document.querySelectorAll('#dec-list button.dec-row')].map(b => [b.dataset.pair, b.querySelector('.dec-r')?.textContent, b.querySelector('.dec-r')?.title || ''])), k = await kl();
    check('Eingeschaltet: „Korr. x,xx“ je Treffer aus 5m-Renditen (oder „Korr. —“ mit Grund), Kerzen je Treffer genau einmal (BTC geteilt), Hinweis „keine Erfolgswahrscheinlichkeit“', r.length === 3 && r.every(x => /^Korr\. (−?\d,\d\d|—)$/.test(x[1]) && x[2]) && k.length === 3 && new Set(k.map(e => e.q.symbol)).size === 3 && /keine Erfolgswahrscheinlichkeit/.test(await txt(page, '#dec-foot')), JSON.stringify({ r, k: k.map(e => e.q.symbol) }));
    check('keine Fehler (corr)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  async click(browser) {
    const { ctx, page, errors } = await openPage(browser, { viewport: { width: 820, height: 1180 }, mobile: true });
    await page.click('#tabbar [data-tab="ind"]'); await page.waitForTimeout(400);
    await openDec(page); await decReady(page); await page.waitForTimeout(300);
    const before = await page.evaluate(() => ({ y: Math.round(scrollY), tab: document.documentElement.dataset.activeTab, sym: __g05.state.symbol, charts: document.querySelectorAll('#chart svg').length }));
    await page.click('#dec-list button.dec-row[data-pair="SOLUSDT"]');
    const toast = await until(() => page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent).find(t => /Im Chart geladen/.test(t)) || null), 3000);
    await until(() => page.evaluate(() => __g05.state.loadedSymbol === 'SOLUSDT'), 10000);
    const curs = (await rows(page)).filter(r => r.cur).map(r => r.pair);
    check('Angetippter Coin (gerade im Chart) behält den farbigen Rahmen, nur er', JSON.stringify(curs) === '["SOLUSDT"]', JSON.stringify(curs));
    const after = await page.evaluate(() => ({ y: Math.round(scrollY), tab: document.documentElement.dataset.activeTab, sym: __g05.state.symbol, src: __g05.state.source, charts: document.querySelectorAll('#chart svg').length }));
    check('Klick lädt SOL in den vorhandenen Chart (Binance Spot): Reiter bleibt, kein Scrollsprung, „Im Chart geladen“, keine zweite Chart-Instanz', after.sym === 'SOLUSDT' && after.src === 'spot' && after.tab === before.tab && Math.abs(after.y - before.y) <= 2 && toast === 'Im Chart geladen: SOL/USDT (Binance Spot)' && after.charts <= 1, JSON.stringify({ before, after, toast }));
    await page.click('#dec-list button.dec-row[data-pair="XRPUSDT"]'); await page.click('#dec-list button.dec-row[data-pair="LTCUSDT"]');
    await until(() => page.evaluate(() => __g05.state.loadedSymbol === 'LTCUSDT'), 10000); await page.waitForTimeout(1200);
    const ab = await page.evaluate(() => ({ sym: __g05.state.symbol, loaded: __g05.state.loadedSymbol, field: document.getElementById('symbol').value }));
    check('Schnell XRP → LTC: nur LTC wird zuletzt sichtbar', ab.sym === 'LTCUSDT' && ab.loaded === 'LTCUSDT' && ab.field === 'LTC', JSON.stringify(ab));
    // Handy: Zeilen passen in die Breite, Werte mit Beschriftung
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500);
    const fit = await page.evaluate(() => { const l = document.getElementById('dec-list').getBoundingClientRect(); return [...document.querySelectorAll('#dec-list button.dec-row')].every(b => b.getBoundingClientRect().right <= l.right + 1 && b.scrollWidth <= b.clientWidth + 1 && b.getBoundingClientRect().height < 60 && getComputedStyle(b).borderTopStyle === 'solid'); });
    check('Handy (390 px): jede Zeile eine umrahmte Karte, einzeilig, ohne Überlauf', fit);
    check('keine Fehler (click)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  async sched(browser) {
    const { ctx, page, errors } = await openPage(browser);
    await page.evaluate(() => __g08.setEvery(1500)); await h.ctl('/dec?delay=2000&clear=1');
    await openDec(page); await page.waitForTimeout(9000);
    let bin = (await decLog()).filter(x => x.src === 'bin');
    const gaps = bin.slice(1).map((x, i) => x.at - bin[i].at);
    check('Etwa alle 1,5 s (Test), aber nie überlappend: bei 2 s Antwortzeit beginnt jede Abfrage erst nach der vorigen', bin.length >= 2 && bin.length <= 4 && gaps.every(g => g >= 3400), JSON.stringify({ n: bin.length, gaps }));
    await h.ctl('/dec?delay=0'); await decReady(page);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await h.ctl('/dec?clear=1'); await page.waitForTimeout(5000);
    check('Im Hintergrund: keine Abfragen', (await decLog()).filter(x => x.src === 'bin').length === 0);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(700); bin = (await decLog()).filter(x => x.src === 'bin');
    check('Zurück: genau ein fälliger Lauf sofort, keine angesammelten Timer', bin.length === 1, bin.length);
    await page.evaluate(() => document.querySelector('#dec-sec > summary').click()); await page.waitForTimeout(300); await h.ctl('/dec?clear=1'); await page.waitForTimeout(4000);
    check('Bereich zu: keine weiteren Abfragen, kein Timer', (await decLog()).filter(x => x.src === 'bin').length === 0 && (await page.evaluate(() => !__g08.dec.timer && !__g08.dec.running)));
    check('keine Fehler (sched)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  async errors(browser) {
    // Binance bremst (429 mit Retry-After 30 s): keine Abfrage vor Ablauf, Bestand bleibt „veraltet“
    let { ctx, page, errors } = await openPage(browser);
    await page.evaluate(() => __g08.setEvery(1500)); await openDec(page); await decReady(page);
    await h.ctl('/dec?bin=429&ra=30&clear=1'); await page.evaluate(() => __g08.kick()); await page.waitForTimeout(400); await decReady(page);
    const s429 = await txt(page, '#dec-status'), wait = await page.evaluate(() => __g08.dec.blockUntil - Date.now()); await page.waitForTimeout(4000);
    const n429 = (await decLog()).filter(x => x.src === 'bin').length;
    check('429 mit Retry-After 30 s: „Rate-Limit (429)“ mit nächstem Versuch, alte Treffer „veraltet“ sichtbar, keine weitere Abfrage', /^Veraltet – Stand \d\d:\d\d:\d\d UTC · Binance: Rate-Limit \(429\) · nächster Versuch ab/.test(s429) && wait > 20000 && n429 === 1 && (await rows(page)).length === 3 && await page.evaluate(() => document.getElementById('dec-list').classList.contains('stale')), JSON.stringify({ s429, wait, n429 }));
    await ctx.close();
    // CoinLore nicht erreichbar (Netz/CORS), ohne Bestand: verständlich „nicht verfügbar“, keine Liste
    await h.ctl('/dec?reset=1&lore=down'); ({ ctx, page, errors } = await openPage(browser)); await openDec(page); await decReady(page);
    const sNet = await txt(page, '#dec-status');
    check('CoinLore nicht erreichbar (Netz oder CORS), ohne Bestand: „Nicht verfügbar – CoinLore: Netz- oder CORS-Fehler …“ mit nächstem Versuch', /^Nicht verfügbar – CoinLore: Netz- oder CORS-Fehler – keine Verbindung oder vom Browser blockiert · nächster Versuch ab/.test(sNet) && !(await rows(page)).length, sNet);
    await h.ctl('/dec?lore=invalid'); await page.evaluate(() => { __g08.dec.blockUntil = 0; __g08.dec.rankRetryAt = 0; __g08.kick(); }); await page.waitForTimeout(400); await decReady(page);
    check('Ungültige Rangliste: eigener Grund („unerwartetes Format“)', /CoinLore: Rangliste in unerwartetem Format/.test(await txt(page, '#dec-status')), await txt(page, '#dec-status'));
    await ctx.close();
    // Rangliste älter als 30 min und CoinLore gestört: alte Rangliste weiter genutzt, als veraltet gekennzeichnet
    await h.ctl('/dec?reset=1&lore=fail');
    const old = { at: Date.now() - 31 * 60000, ver: 1, list: [[1, 'BTC', 'Bitcoin', 'bitcoin', 64000], [2, 'SOL', 'Solana', 'solana', 150], [3, 'XRP', 'XRP', 'ripple', 1.47]].map(([rank, sym, name, nameid, price]) => ({ id: String(rank), sym, name, nameid, rank, price })) };
    ({ ctx, page, errors } = await openPage(browser, { seed: { 'scalpdesk.decrank.v1': old } })); await openDec(page); await decReady(page);
    const foot = await txt(page, '#dec-foot'), cov = await txt(page, '#dec-cov');
    check('Alte Rangliste bei CoinLore-Fehler: weiter genutzt („2 von 2“), im Quellenhinweis „veraltet – CoinLore: Fehler 500“', /^2 von 2/.test(cov) && /\(veraltet – CoinLore: Fehler 500\)/.test(foot) && (await rows(page)).length === 2, JSON.stringify({ cov, foot }));
    check('keine Fehler (errors)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },
};

(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(tests);
  await h.setup(); await h.ctl('/reset');
  const browser = await h.launch();
  try { for (const n of names) { console.log(`▶ ${n}`); await h.ctl('/reset'); try { await tests[n](browser); } catch (e) { check(`${n}: Abbruch`, false, e.message.split('\n')[0]); } } }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
