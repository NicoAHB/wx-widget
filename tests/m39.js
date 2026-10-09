// Ablaufplan Schritte 5 und 6 (3.24.0) – Krypto-Kacheln und Detailfeld:
// Kacheln: „1 Min. ±x,xx %“ und „30 Min. ±y,yy %“, Zeile Trend · Kurs · RSI n · MACD mit farbigen Pfeilen in einer Zeile (iPad),
// fehlende Daten neutral, auch für später hinzugefügte Kacheln. Detailfeld: Antippen öffnet, andere Kachel wechselt, dieselbe
// Kachel/„×“/Esc schließt; Gruppen nach der Bewertung der Kachel (dieselbe Grundlage), leere Gruppen verborgen, „Aktuell keine
// Signale“; Info-Symbole per Tippen, Klick und Hover; Tastatur; entfernte Kachel schließt das Feld, neue Kachel ohne falsche
// Auswahl; Antippen lädt den Coin im Chart (3.26.0, kein Knopf „Im Chart öffnen“ mehr); weiches Auf- und Zuklappen; Feld schrumpft bei Live-Änderungen nicht. iPad hoch/quer (Touch),
// Computer (Maus), Handy 390 px. Die Signalzustände setzt der Test über eine Testseite mit Zugriff auf die Kachel-Daten.
// 3.25.0: Kacheln „1 Std. …“ (ohne „30 Min.“), Kopf „Signale der letzten Stunde · Stand HH:MM“, Gesamtbewertung je Zustand,
// Fußzeile „kein Handelssignal mit nachgewiesenem Vorteil“.
// Aufruf: node m39.js
const h = require('./harness'), fs = require('fs');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const REPO = require('path').resolve(__dirname, '..'), DBG = 'weather-widget-v2.debug.html';
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const ready = page => page.waitForFunction(() => [...document.querySelectorAll('#watchlist .wl-tile .wl-sig')].every(s => /^[+−]?\d$/.test(s.textContent) || s.closest('.wl-tile').querySelector('.wl-price').textContent === '—'), null, { timeout: 30000 }).catch(() => {});
const real = errs => errs.filter(e => !/Service Worker registration blocked/.test(e));
// Kachel-Zustand aus dem DOM
const tiles = page => page.evaluate(() => [...document.querySelectorAll('#watchlist .wl-tile')].map(t => {
  const q = s => t.querySelector(s), rules = [...q('.wl-rules').children], R = e => e.getBoundingClientRect();
  return { coin: t.dataset.watch, expanded: t.getAttribute('aria-expanded'), chart: t.getAttribute('aria-current') === 'true', price: q('.wl-price').textContent, c1: q('.wl-chg').textContent, c1cls: q('.wl-chg').className,
    c30: q('.wl-chg30')?.textContent ?? null, rules: rules.map(r => ({ text: r.textContent, dir: r.className.replace('wl-rule', '').trim(), color: getComputedStyle(r.lastChild).color })),
    oneLine: new Set(rules.map(r => Math.round(R(r).top))).size === 1, cut: [q('.wl-rules'), q('.wl-r2')].some(e => e.scrollWidth > e.clientWidth + 1) };
}));
// Detailfeld aus dem DOM
const panel = page => page.evaluate(() => {
  const d = document.getElementById('wl-detail'); if (!d) return null;
  const grp = cls => { const g = d.querySelector(`.wl-d-grp.${cls}`); return { hidden: g.hidden || !g.getClientRects().length, items: [...g.querySelectorAll('li.wl-d-sig')].filter(li => !li.hidden).map(li => ({ k: li.dataset.k, text: li.querySelector('.wl-d-txt').textContent, arrow: li.querySelector('.wl-d-arrow').textContent, color: getComputedStyle(li).color, tip: !!li.querySelector('details.tip summary') })) }; };
  const none = d.querySelector('.wl-d-none'), r = d.getBoundingClientRect();
  return { open: d.dataset.open === '1', height: Math.round(r.height), bottom: Math.round(r.bottom), title: d.querySelector('.wl-d-title').textContent, meta: (() => { const m = d.querySelector('.wl-d-meta').cloneNode(true); m.querySelectorAll('select').forEach(x => x.remove()); return m.textContent; })(),
    verdict: d.querySelector('.wl-d-verdict').hidden ? null : d.querySelector('.wl-d-verdict').textContent, foot: d.querySelector('.wl-d-foot').textContent,
    up: grp('up'), down: grp('down'), none: none.hidden ? '' : none.textContent, chartBtn: !!d.querySelector('.wl-d-chart'),
    visible: getComputedStyle(d.querySelector('.wl-d-clip')).visibility };
});
// Testseite: Zugriff auf die Kachel-Daten (Bewertung setzen) und neu malen
function writeDebugPage() {
  let s = fs.readFileSync(`${REPO}/weather-widget-v2.html`, 'utf8');
  const hook = '\nwindow.__wl = { get c() { return wl.c; }, paint: () => wlPaint(Date.now(), true), get sel() { return wldSel || \'\'; } };\nrender();startLive();';
  if (!s.includes('\nrender();startLive();')) throw new Error('Einstiegspunkt für die Testseite fehlt');
  fs.writeFileSync(`${REPO}/${DBG}`, s.replace('\nrender();startLive();', hook));
}
const rating = (scores, rsiVal = 50) => ({ score: scores.reduce((a, b) => a + b, 0), verdict: 'hold', closeTime: Math.floor(Date.now() / 60e3) * 60e3 - 1,
  rules: [{ label: 'Trend', score: scores[0], detail: '' }, { label: 'Kurs', score: scores[1], detail: '' }, { label: 'RSI ' + rsiVal, score: scores[2], detail: '' }, { label: 'MACD', score: scores[3], detail: '' }] });
const setRating = (page, coin, r) => page.evaluate(([c, r]) => { const e = window.__wl.c.get(c + 'USDT'); e.rating = r; e.vals = null; window.__wl.paint(); }, [coin, r]);

(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); writeDebugPage();
  const browser = await h.launch();
  try {
    // ================= iPad hochkant (Touch) =================
    let ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    // ABC gibt es nicht: fehlende Daten müssen neutral erscheinen
    await ctx.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('scalpdesk.watchlist.v1', JSON.stringify(['BTC', 'ETC', 'BCH', 'LTC', 'XRP', 'NEAR', 'ABC'])); } });
    await page.goto(`${h.URL_BASE}/${DBG}`); await live(page); await ready(page); await page.waitForTimeout(2000);
    let t = await tiles(page);
    const ok6 = t.filter(x => x.coin !== 'ABC'), abc = t.find(x => x.coin === 'ABC');
    check('Kacheln: je „1 Std. ±x,xx %“, kein „1 Min.“/„30 Min.“ mehr (BTC, ETC, BCH, LTC, XRP, NEAR)', ok6.length === 6 && ok6.every(x => /^1 Std\. [+−±]\d+,\d\d %$/.test(x.c1) && x.c30 === null), JSON.stringify(ok6.map(x => [x.coin, x.c1, x.c30])));
    check('Farbe der Veränderung folgt der Richtung (up grün, down rot, flat neutral)', ok6.every(x => /(^| )(up|down|flat)$/.test(x.c1cls) && (x.c1.includes('+') ? /up$/.test(x.c1cls) : x.c1.includes('−') ? /down$/.test(x.c1cls) : /flat$/.test(x.c1cls))), JSON.stringify(ok6.map(x => [x.c1, x.c1cls])));
    check('Zeile Trend · Kurs · RSI (mit Zahl) · MACD mit Pfeilen ▲/▼/–', ok6.every(x => x.rules.map(r => r.text).join(' ').match(/^Trend[▲▼–] Kurs[▲▼–] RSI \d{1,3}[▲▼–] MACD[▲▼–]$/)), JSON.stringify(ok6.map(x => x.rules.map(r => r.text).join(' '))));
    const colors = {}; for (const x of ok6) for (const r of x.rules) (colors[r.dir] ||= new Set()).add(r.color);
    check('Pfeile farbig: ▲ grün, ▼ rot, – neutral (je Bewertung eine eigene Farbe)', [...Object.values(colors)].every(s => s.size === 1) && new Set(Object.values(colors).map(s => [...s][0])).size === Object.keys(colors).length && ok6.every(x => x.rules.every(r => (r.text.endsWith('▲') ? r.dir === 'up' : r.text.endsWith('▼') ? r.dir === 'down' : r.dir === 'flat'))), JSON.stringify(Object.fromEntries(Object.entries(colors).map(([k, v]) => [k, [...v]]))));
    check('iPad hoch: Werte und Zeile vollständig lesbar, die vier Regeln in einer Zeile', t.every(x => x.oneLine && !x.cut), JSON.stringify(t.filter(x => !x.oneLine || x.cut).map(x => x.coin)));
    check('Fehlende Daten neutral: „—“, „1 Std. –“, Regeln „–“ ohne RSI-Zahl', abc && abc.price === '—' && abc.c1 === '1 Std. –' && /flat$/.test(abc.c1cls) && abc.rules.map(r => r.text).join(' ') === 'Trend– Kurs– RSI– MACD–' && abc.rules.every(r => r.dir === 'none'), JSON.stringify(abc));
    // ---- Detailfeld per Tippen ----
    // 3.54.0: BTC besitzt zusätzlich die ausdrücklich gewünschte Pfeilzeile; deren Höhe getrennt messen.
    const chart0 = await page.evaluate(() => { const toolbar = document.querySelector('#chart-sec .chart-toolbar').getBoundingClientRect(); return { chart: Math.round(document.getElementById('chart').getBoundingClientRect().top + scrollY), toolbarTop: Math.round(toolbar.top + scrollY), toolbarHeight: Math.round(toolbar.height) }; });
    let p = await panel(page);
    check('Anfangs zu: Feld zusammengeklappt, keine Kachel aufgeklappt', p && !p.open && p.height === 0 && p.visible === 'hidden' && t.every(x => x.expanded === 'false'), JSON.stringify({ open: p?.open, h: p?.height }));
    await page.evaluate(() => document.querySelector('#watchlist .wl-tile[data-watch="LTC"]').addEventListener('click', () => { window.__m39OpenAt = performance.now(); }, { capture: true, once: true }));
    await page.tap('#watchlist .wl-tile[data-watch="LTC"]'); await page.waitForTimeout(90);
    const openingTime = await page.evaluate(() => ({ elapsed: performance.now() - window.__m39OpenAt, duration: getComputedStyle(document.getElementById('wl-detail')).transitionDuration, animations: document.getElementById('wl-detail').getAnimations().map(a => ({ state: a.playState, currentTime: a.currentTime })) }));
    const hMid = (await panel(page)).height; await page.waitForTimeout(600);
    p = await panel(page); t = await tiles(page);
    const ltc = t.find(x => x.coin === 'LTC'), wantUp = ltc.rules.filter(r => r.dir === 'up').length, wantDown = ltc.rules.filter(r => r.dir === 'down').length;
    check('Tippen auf LTC öffnet das Feld unter den Kacheln, nur LTC aufgeklappt', p.open && p.title === 'LTC' && t.filter(x => x.expanded === 'true').map(x => x.coin).join() === 'LTC' && p.visible === 'visible', JSON.stringify({ title: p.title, exp: t.filter(x => x.expanded === 'true').map(x => x.coin) }));
    check('Weiches Aufklappen: nach 90 ms erst teilweise offen', hMid > 0 && hMid < p.height, `${hMid} → ${p.height} px · ${JSON.stringify(openingTime)}`);
    check('Gruppen wie die Bewertung der Kachel: bullish = ▲-Regeln, bearish = ▼-Regeln, leere Gruppe verborgen', p.up.items.length === wantUp && p.down.items.length === wantDown && p.up.hidden === !wantUp && p.down.hidden === !wantDown && (wantUp || wantDown ? !p.none : p.none === 'Aktuell keine Signale'),
      JSON.stringify({ tile: ltc.rules.map(r => r.text), up: p.up.items.map(i => i.text), down: p.down.items.map(i => i.text), none: p.none }));
    check('Kopf: Coin, „Signale der letzten Stunde · Stand HH:MM“, kein Knopf „Im Chart öffnen“ (3.26.0)', /^Signale der letzten Stunde · Stand \d\d:\d\d$/.test(p.meta) && !p.chartBtn, p.meta);
    check('Gesamtbewertung und Fußzeile „Beschreibt die letzte Stunde – kein Handelssignal mit nachgewiesenem Vorteil.“', /^(▲ Long-Tendenz – [34] von 4 Signalen bullish|▼ Short-Tendenz – [34] von 4 Signalen bearish|Abwarten – Signale widersprechen sich|Abwarten – keine Signale)$/.test(p.verdict) && p.foot === 'Beschreibt die letzte Stunde – kein Handelssignal mit nachgewiesenem Vorteil.', JSON.stringify([p.verdict, p.foot]));
    // Info-Symbol per Tippen
    const firstTip = await page.$('#wl-detail li.wl-d-sig:not([hidden]) details.tip summary');
    if (firstTip) {
      await firstTip.tap(); await page.waitForTimeout(300);
      const tipTxt = await page.evaluate(() => { const d = document.querySelector('#wl-detail li.wl-d-sig details.tip[open]'); if (!d) return null; const b = d.querySelector('.tip-body').getBoundingClientRect(); return { text: d.querySelector('.tip-body').innerText, inView: b.left >= 0 && b.right <= innerWidth && b.width > 100 }; });
      check('Info-Symbol per Tippen: Erklärung der Einstufung mit Werten, im Bild', tipTxt && /^(Bullish|Bearish), weil .*\d/.test(tipTxt.text) && tipTxt.inView, JSON.stringify(tipTxt));
      await page.tap('#pair-label'); await page.waitForTimeout(250);
      check('Tippen daneben schließt die Erklärung, das Feld bleibt offen', await page.evaluate(() => !document.querySelector('#wl-detail details.tip[open]') && document.getElementById('wl-detail').dataset.open === '1'));
    } else check('Info-Symbol per Tippen (kein Signal vorhanden – Zustand wird unten gesetzt)', true);
    // Andere Kachel wechselt den Inhalt
    await page.tap('#watchlist .wl-tile[data-watch="XRP"]'); await page.waitForTimeout(400);
    p = await panel(page); t = await tiles(page);
    check('Andere Kachel (XRP): Inhalt wechselt, weiterhin genau ein Feld und eine Auswahl', p.open && p.title === 'XRP' && t.filter(x => x.expanded === 'true').map(x => x.coin).join() === 'XRP' && await page.$$eval('.wl-detail', d => d.length) === 1, p.title);
    // Dieselbe Kachel schließt
    await page.tap('#watchlist .wl-tile[data-watch="XRP"]'); await page.waitForTimeout(90);
    const hClosing = (await panel(page)).height; await page.waitForTimeout(500);
    p = await panel(page); t = await tiles(page);
    check('Dieselbe Kachel erneut: Feld schließt weich (nach 90 ms noch teilweise offen), keine Auswahl mehr', !p.open && p.height === 0 && hClosing > 0 && p.visible === 'hidden' && t.every(x => x.expanded === 'false'), `${hClosing} → ${p.height} px`);
    const chart1 = await page.evaluate(() => { const toolbar = document.querySelector('#chart-sec .chart-toolbar').getBoundingClientRect(); return { chart: Math.round(document.getElementById('chart').getBoundingClientRect().top + scrollY), toolbarTop: Math.round(toolbar.top + scrollY), toolbarHeight: Math.round(toolbar.height) }; });
    check('Nach dem Schließen steht der Chart wieder an seiner Stelle (BTC-Pfeilzeile getrennt)', chart1.toolbarTop === chart0.toolbarTop && chart1.chart - chart1.toolbarHeight === chart0.chart - chart0.toolbarHeight, JSON.stringify({ before: chart0, after: chart1 }));
    // Schließen-Knopf
    await page.tap('#watchlist .wl-tile[data-watch="BCH"]'); await page.waitForTimeout(500);
    await page.tap('#wl-detail .wl-d-close'); await page.waitForTimeout(500);
    p = await panel(page);
    check('„×“ im Feld schließt es', !p.open && p.height === 0 && (await tiles(page)).every(x => x.expanded === 'false'));
    // Fehlende Daten im Feld
    await page.tap('#watchlist .wl-tile[data-watch="ABC"]'); await page.waitForTimeout(500); p = await panel(page);
    check('Coin ohne Daten: Feld neutral („keine Daten“, keine Gruppen)', p.open && p.up.hidden && p.down.hidden && /^Keine Daten für ABC/.test(p.none) && p.meta === 'Signale der letzten Stunde · keine Daten' && p.verdict === null, JSON.stringify({ none: p.none, meta: p.meta, verdict: p.verdict }));
    // ---- Signalzustände (über die Testseite gesetzt) ----
    await page.tap('#watchlist .wl-tile[data-watch="LTC"]'); await page.waitForTimeout(400);
    await setRating(page, 'LTC', rating([1, 1, 1, 1], 27)); await page.waitForTimeout(150); p = await panel(page); t = await tiles(page);
    check('Nur bullish (4 Signale): grüne Gruppe, bearish verborgen; Kachel zeigt dieselben vier ▲', !p.up.hidden && p.up.items.length === 4 && p.down.hidden && !p.none && p.up.items.map(i => i.k).join() === 'trend,kurs,rsi,macd' && t.find(x => x.coin === 'LTC').rules.every(r => r.dir === 'up'),
      JSON.stringify(p.up.items.map(i => i.text)));
    check('RSI-Signal nennt den Wert: „RSI 27: überverkauft und steigend“', p.up.items.find(i => i.k === 'rsi')?.text === 'RSI 27: überverkauft und steigend');
    check('4 von 4 bullish: „▲ Long-Tendenz – 4 von 4 Signalen bullish“, Kachel kräftig grün', p.verdict === '▲ Long-Tendenz – 4 von 4 Signalen bullish' && await page.$eval('#watchlist .wl-tile[data-watch="LTC"] .wl-sig', s => s.dataset.tone) === 'p3', p.verdict);
    const hFull = p.height;
    await setRating(page, 'LTC', rating([-1, -1, 0, -1], 55)); await page.waitForTimeout(150); p = await panel(page);
    check('Nur bearish: rote Gruppe (Trend, Kurs, MACD), bullish verborgen, RSI neutral nicht gelistet', p.up.hidden && !p.down.hidden && p.down.items.map(i => i.k).join() === 'trend,kurs,macd' && p.down.items.every(i => i.arrow === '▼'), JSON.stringify(p.down.items.map(i => i.text)));
    check('3 von 4 bearish: „▼ Short-Tendenz – 3 von 4 Signalen bearish“', p.verdict === '▼ Short-Tendenz – 3 von 4 Signalen bearish', p.verdict);
    check('Grün und Rot gut unterscheidbar (Farben der Gruppen verschieden)', p.down.items[0].color !== (await (async () => { await setRating(page, 'LTC', rating([1, 0, 0, 0])); await page.waitForTimeout(100); return (await panel(page)).up.items[0].color; })()));
    await setRating(page, 'LTC', rating([1, 0, 0, -1])); await page.waitForTimeout(150); p = await panel(page);
    check('Beide Gruppen: Trend bullish, MACD bearish; Gesamtbewertung „Abwarten – Signale widersprechen sich“', !p.up.hidden && !p.down.hidden && p.up.items.map(i => i.k).join() === 'trend' && p.down.items.map(i => i.k).join() === 'macd' && p.verdict === 'Abwarten – Signale widersprechen sich', p.verdict);
    await setRating(page, 'LTC', rating([0, 0, 0, 0])); await page.waitForTimeout(150); p = await panel(page);
    check('Keine Signale: beide Gruppen verborgen, „Aktuell keine Signale“, „Abwarten – keine Signale“, Hinweis zum Vorteil bleibt', p.up.hidden && p.down.hidden && p.none === 'Aktuell keine Signale' && p.verdict === 'Abwarten – keine Signale' && /kein Handelssignal mit nachgewiesenem Vorteil\.$/.test(p.foot), p.verdict);
    check('Live-Änderung: das Feld schrumpft nicht (Chart darunter springt nicht)', p.height === hFull, `${hFull} → ${p.height} px`);
    await setRating(page, 'LTC', null); await page.waitForTimeout(150); p = await panel(page); t = await tiles(page);
    check('Ohne Bewertung (zu wenige Kerzen): neutraler Hinweis (5-Minuten-Kerzen), keine Gesamtbewertung, Kachel-Regeln neutral', /^Noch keine Daten – die Signale erscheinen, sobald 60 abgeschlossene 5-Minuten-Kerzen vorliegen\.$/.test(p.none) && p.verdict === null && p.up.hidden && p.down.hidden && t.find(x => x.coin === 'LTC').rules.every(r => r.dir === 'none'), p.none);
    // ---- Entfernen und Hinzufügen: keine falsche Auswahl ----
    await page.tap('#watchlist [data-watchedit]'); await page.waitForTimeout(300);
    await page.tap('#watchlist [data-unwatch="LTC"]'); await page.waitForTimeout(500);
    p = await panel(page); t = await tiles(page);
    check('Ausgewählte Kachel (LTC) entfernt: Feld schließt, keine Kachel aufgeklappt', !p.open && !t.some(x => x.coin === 'LTC') && t.every(x => x.expanded === 'false'), t.map(x => x.coin).join());
    await page.tap('#watchlist .wl-tile[data-watch="NEAR"]'); await page.waitForTimeout(400);
    await page.tap('#watchlist [data-unwatch="BCH"]'); await page.waitForTimeout(500);
    p = await panel(page); t = await tiles(page);
    check('Andere Kachel (BCH) entfernt: Feld bleibt bei NEAR, Auswahl stimmt', p.open && p.title === 'NEAR' && t.filter(x => x.expanded === 'true').map(x => x.coin).join() === 'NEAR', `${p.title} · ${t.filter(x => x.expanded === 'true').map(x => x.coin)}`);
    await page.tap('#watchlist [data-watchedit]'); await page.waitForTimeout(300);
    await page.fill('#symbol', 'SOL'); await page.tap('#market-form [type=submit]'); await live(page); await page.waitForTimeout(2500);
    await page.tap('#watchlist [data-addwatch="SOL"]'); await page.waitForTimeout(500);
    await page.waitForFunction(() => /^[+−]?\d$/.test(document.querySelector('#watchlist .wl-tile[data-watch="SOL"] .wl-sig')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
    t = await tiles(page); p = await panel(page); const sol = t.find(x => x.coin === 'SOL');
    check('Neue Kachel (SOL): gleiche Werte und Zeile, nicht fälschlich ausgewählt; Feld weiter bei NEAR', sol && /^1 Std\. [+−±]/.test(sol.c1) && sol.c30 === null && /^Trend[▲▼–] Kurs[▲▼–] RSI \d+[▲▼–] MACD[▲▼–]$/.test(sol.rules.map(r => r.text).join(' ')) && sol.expanded === 'false' && p.title === 'NEAR' && p.open,
      JSON.stringify({ sol, title: p.title }));
    await page.tap('#watchlist .wl-tile[data-watch="SOL"]'); await page.waitForTimeout(400); p = await panel(page);
    check('SOL antippen: Feld zeigt SOL, SOL bleibt im Chart', p.title === 'SOL' && !p.chartBtn && /^SOL/.test(await page.evaluate(() => document.getElementById('pair-label').textContent)), p.title);
    // ABC gibt es absichtlich nicht: dessen Abrufe enden mit 400 (erwartet)
    const errs = real(errors).filter(e => !/status of 400 \(Bad Request\)/.test(e));
    check('iPad hoch: keine Fehler (außer den erwarteten 400 für ABC)', !errs.length, errs.join(' | ')); await ctx.close();

    // ================= iPad quer (Touch): Feld wird ins Bild gerückt, Chart öffnen =================
    ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); page = await ctx.newPage(); errors = []; h.collect(page, errors);
    await page.goto(`${h.URL_BASE}/${DBG}`); await live(page); await ready(page); await page.waitForTimeout(1500);
    t = await tiles(page);
    check('iPad quer: Werte und Zeile vollständig lesbar, die vier Regeln in einer Zeile', t.every(x => x.oneLine && !x.cut), JSON.stringify(t.filter(x => !x.oneLine || x.cut).map(x => x.coin)));
    await page.evaluate(() => { const g = document.querySelector('#watchlist .wl-grid').getBoundingClientRect(); scrollBy(0, g.bottom - innerHeight + 90); }); await page.waitForTimeout(400);
    await page.tap('#watchlist .wl-tile[data-watch="NEAR"]'); await page.waitForTimeout(1200);
    const vis = await page.evaluate(() => { const r = document.getElementById('wl-detail').getBoundingClientRect(), tb = document.getElementById('tabbar'), tbTop = tb && getComputedStyle(tb).display !== 'none' ? tb.getBoundingClientRect().top : innerHeight; return { bottom: Math.round(r.bottom), limit: Math.round(tbTop), top: Math.round(r.top) }; });
    check('Aufgeklappt am unteren Rand: Feld wird ganz ins Bild gerückt (über der Tab-Leiste)', vis.bottom <= vis.limit + 1 && vis.top > 0, JSON.stringify(vis));
    await live(page); await page.waitForTimeout(2500);
    p = await panel(page); t = await tiles(page);
    check('Antippen lädt NEAR im Chart, Kachel als Chart-Coin markiert, Feld bleibt offen', /^NEAR/.test(await page.evaluate(() => document.getElementById('pair-label').textContent)) && t.find(x => x.coin === 'NEAR').chart && p.open && p.title === 'NEAR' && !p.chartBtn, p.title);
    check('iPad quer: keine Fehler', !real(errors).length, real(errors).join(' | ')); await ctx.close();

    // ================= Computer (Maus, Tastatur) =================
    ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); page = await ctx.newPage(); errors = []; h.collect(page, errors);
    await page.goto(`${h.URL_BASE}/${DBG}`); await live(page); await ready(page); await page.waitForTimeout(1500);
    // Tastatur: Enter öffnet, Tab erreicht das Feld, Esc schließt und gibt den Fokus an die Kachel zurück
    await page.focus('#watchlist .wl-tile[data-watch="ETC"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
    p = await panel(page);
    check('Tastatur: Enter auf einer Kachel öffnet das Feld', p.open && p.title === 'ETC');
    let tabs = 0; for (; tabs < 12; tabs++) { await page.keyboard.press('Tab'); if (await page.evaluate(() => document.getElementById('wl-detail').contains(document.activeElement))) break; }
    check('Tastatur: mit Tab ins Feld (Knöpfe erreichbar)', tabs < 12, `${tabs + 1} × Tab → ${await page.evaluate(() => document.activeElement.className)}`);
    await setRating(page, 'ETC', rating([1, -1, 0, 0])); await page.waitForTimeout(150);
    await page.focus('#wl-detail li.wl-d-sig:not([hidden]) details.tip summary'); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
    const kOpen = await page.evaluate(() => !!document.querySelector('#wl-detail details.tip[open]'));
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    const afterEsc1 = await page.evaluate(() => ({ tip: !!document.querySelector('#wl-detail details.tip[open]'), open: document.getElementById('wl-detail').dataset.open }));
    check('Tastatur: Enter auf ⓘ öffnet die Erklärung, erstes Esc schließt nur sie', kOpen && !afterEsc1.tip && afterEsc1.open === '1', JSON.stringify({ kOpen, afterEsc1 }));
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    const afterEsc2 = await page.evaluate(() => ({ open: document.getElementById('wl-detail').dataset.open, focus: document.activeElement?.dataset?.watch || document.activeElement?.className }));
    check('Tastatur: zweites Esc schließt das Feld, Fokus zurück auf der Kachel', afterEsc2.open === '0' && afterEsc2.focus === 'ETC', JSON.stringify(afterEsc2));
    // Maus: Hover zeigt die Erklärung, Wegbewegen schließt sie; Klick heftet sie an
    await page.click('#watchlist .wl-tile[data-watch="ETC"]'); await page.waitForTimeout(500);
    await setRating(page, 'ETC', rating([1, -1, 0, 0])); await page.waitForTimeout(150);
    const sumSel = '#wl-detail li.wl-d-sig[data-k="trend"] details.tip summary';
    await page.hover(sumSel); await page.waitForTimeout(300);
    const hov = await page.evaluate(() => { const d = document.querySelector('#wl-detail li.wl-d-sig[data-k="trend"] details.tip'); return { open: d.open, text: d.querySelector('.tip-body').innerText }; });
    check('Maus: Überfahren von ⓘ zeigt die Erklärung („Bullish, weil …“ mit EMA-Werten)', hov.open && /^Bullish, weil der kurzfristige Durchschnitt \(EMA 20: [\d.,]+\) über dem längerfristigen \(EMA 50: [\d.,]+\)/.test(hov.text), JSON.stringify(hov));
    await page.mouse.move(5, 5); await page.waitForTimeout(300);
    check('Maus: Wegbewegen schließt die Erklärung wieder', await page.evaluate(() => !document.querySelector('#wl-detail details.tip[open]')));
    await page.hover(sumSel); await page.waitForTimeout(200); await page.click(sumSel); await page.mouse.move(5, 5); await page.waitForTimeout(300);
    check('Maus: Klick auf ⓘ heftet die Erklärung an (bleibt nach dem Wegbewegen offen)', await page.evaluate(() => !!document.querySelector('#wl-detail li.wl-d-sig[data-k="trend"] details.tip[open]')));
    await page.click('#pair-label'); await page.waitForTimeout(200);
    const kurs = await page.evaluate(() => { const li = document.querySelector('#wl-detail li.wl-d-sig[data-k="kurs"]'); return { grp: li.closest('.wl-d-grp').className, text: li.querySelector('.wl-d-txt').textContent }; });
    check('Kurs-Signal bearish in der roten Gruppe: „Kurs unter EMA 20“', /down/.test(kurs.grp) && kurs.text === 'Kurs unter EMA 20', JSON.stringify(kurs));
    check('Computer: keine Fehler', !real(errors).length, real(errors).join(' | ')); await ctx.close();

    // ================= Handy 390 px (Touch) =================
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); page = await ctx.newPage(); errors = []; h.collect(page, errors);
    await page.goto(`${h.URL_BASE}/${DBG}`); await live(page); await ready(page); await page.waitForTimeout(1500);
    t = await tiles(page);
    check('Handy: alle Werte lesbar (nichts abgeschnitten), Regeln in zwei Zeilen', t.every(x => !x.cut && /^1 Std\./.test(x.c1)), JSON.stringify(t.filter(x => x.cut).map(x => x.coin)));
    await page.tap('#watchlist .wl-tile[data-watch="BTC"]'); await page.waitForTimeout(600);
    p = await panel(page);
    const hd = await page.evaluate(() => { const R = s => document.querySelector(s).getBoundingClientRect(), box = R('#wl-detail .wl-d-box'); return { closeIn: R('#wl-detail .wl-d-close').right <= box.right + 0.5, sw: document.scrollingElement.scrollWidth - innerWidth }; });
    check('Handy: Feld offen (BTC, schon im Chart), kein Knopf „Im Chart öffnen“, Kopf passt, kein seitliches Scrollen', p.open && p.title === 'BTC' && !p.chartBtn && hd.closeIn && hd.sw <= 0, JSON.stringify(hd));
    check('Handy: keine Fehler', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.teardown(); try { fs.unlinkSync(`${REPO}/${DBG}`); } catch {} }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
