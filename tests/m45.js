// 3.25.0 – Signalbewertung der Vorauswahl über einen wählbaren Zeitraum (Standard: die letzte Stunde aus 5-Minuten-Kerzen):
// Laden (260 Kerzen im Intervall des Zeitraums) und Live-Streams, Überschrift „Signale der letzten Stunde · Stand HH:MM“ mit
// Auswahl (1 Minute, 30 Minuten, 1 Stunde, 4 Stunden, 1 Tag), Veränderung über den Zeitraum in den Kacheln, Gesamtbewertung und
// Hinweis „Zu wenig Bewegung“ passend zu den Kerzen (unabhängig nachgerechnet), Einstellung bleibt nach dem Neuladen, die
// Chart-Knöpfe ändern den Zeitraum nicht (und umgekehrt), Tastatur behält den Fokus, Handy 390/320 px ohne Zoom und Überlauf.
// 3.26.0: Antippen lädt den Coin auch im Chart – dessen Chart-Stream zählt nicht zur Vorauswahl.
// Aufruf: node m45.js
const h = require('./harness'), fs = require('fs');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const REPO = require('path').resolve(__dirname, '..'), DBG = 'weather-widget-v2.debug45.html';
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const SP = { '1m': { iv: '1m', ms: 60e3, n: 1, label: '1 Min.', of: 'der letzten Minute', the: 'die letzte Minute', name: '1 Minute', ivName: '1-Minuten' },
  '30m': { iv: '3m', ms: 18e5, n: 10, label: '30 Min.', of: 'der letzten 30 Minuten', the: 'die letzten 30 Minuten', name: '30 Minuten', ivName: '3-Minuten' },
  '1h': { iv: '5m', ms: 36e5, n: 12, label: '1 Std.', of: 'der letzten Stunde', the: 'die letzte Stunde', name: '1 Stunde', ivName: '5-Minuten' },
  '4h': { iv: '15m', ms: 144e5, n: 16, label: '4 Std.', of: 'der letzten 4 Stunden', the: 'die letzten 4 Stunden', name: '4 Stunden', ivName: '15-Minuten' },
  '1d': { iv: '2h', ms: 864e5, n: 12, label: '1 Tag', of: 'des letzten Tages', the: 'den letzten Tag', name: '1 Tag', ivName: '2-Stunden' } };
const IVMS = { '1m': 6e4, '3m': 18e4, '5m': 3e5, '15m': 9e5, '2h': 72e5 };
const COINS = ['BTC', 'ETC', 'BCH', 'LTC', 'XRP', 'NEAR'];
// alle Kacheln bewertet, und zwar im Intervall des gewählten Zeitraums
const ready = (page, iv) => page.waitForFunction(iv => [...document.querySelectorAll('#watchlist .wl-tile')].every(t => { const e = window.__wl.c.get(t.dataset.watch + 'USDT'); return e && e.iv === iv && e.rating && /^[+−]?\d$/.test(t.querySelector('.wl-sig').textContent); }), iv, { timeout: 40000 }).then(() => true).catch(() => false);
const real = errs => errs.filter(e => !/Service Worker registration blocked/.test(e));
const tiles = page => page.evaluate(() => [...document.querySelectorAll('#watchlist .wl-tile')].map(t => {
  const q = s => t.querySelector(s), r = t.getBoundingClientRect();
  return { coin: t.dataset.watch, chg: q('.wl-chg').textContent, cut: [q('.wl-chg'), q('.wl-r2'), q('.wl-rules')].some(e => e.scrollWidth > e.clientWidth + 1), title: t.title, tone: q('.wl-sig').dataset.tone,
    inside: [...t.querySelectorAll('*')].filter(c => { const b = c.getBoundingClientRect(); return b.width && b.height && !c.classList.contains('sr-only'); }).every(c => { const b = c.getBoundingClientRect(); return b.left >= r.left - 0.5 && b.right <= r.right + 0.5 && b.top >= r.top - 0.5 && b.bottom <= r.bottom + 0.5; }) };
}));
const panel = page => page.evaluate(() => {
  const d = document.getElementById('wl-detail'), q = s => d.querySelector(s), sel = q('select.wl-d-span');
  const m = q('.wl-d-meta').cloneNode(true); m.querySelectorAll('select').forEach(x => x.remove());
  return { open: d.dataset.open === '1', title: q('.wl-d-title').textContent, meta: m.textContent, value: sel.value, shown: q('.wl-d-pickv').textContent, label: sel.getAttribute('aria-label'),
    options: [...sel.options].map(o => `${o.value}:${o.textContent}`).join(), verdict: q('.wl-d-verdict').hidden ? null : q('.wl-d-verdict').textContent, vcls: q('.wl-d-verdict').className,
    move: q('.wl-d-move').hidden ? null : q('.wl-d-movetxt').textContent, moveTip: q('.wl-d-move .tip-body').textContent, foot: q('.wl-d-foot').textContent };
});
// Erwartung, unabhängig aus den Kerzen der Kachel nachgerechnet: Veränderung seit Beginn des Zeitraums, Zählung der Signale,
// übliche Bewegung (ATR × √n), Stand = Ende der letzten bewerteten Kerze
const expect = (page, coin, S) => page.evaluate(([coin, S]) => {
  const e = window.__wl.c.get(coin + 'USDT'); if (!e || !e.rating) return null;
  const now = Date.now(), c = e.closed, price = e.run?.close ?? c.at(-1).close, num = (x, d) => x.toFixed(d).replace('.', ',');
  let ref = null; if (S.ms > 120e3) for (let i = c.length - 1; i >= 0; i--) if (c[i].closeTime <= now - S.ms) { ref = c[i].close; break; }
  const chg = ref ? (price / ref - 1) * 100 : null, pct = v => (Math.abs(v) < 0.005 ? '±0,00' : (v > 0 ? '+' : '−') + num(Math.abs(v), 2)) + ' %';
  const len = S.n >= 10 ? S.n : 14; let sum = 0; for (let i = c.length - len; i < c.length; i++) { const k = c[i], pc = c[i - 1].close; sum += Math.max(k.high - k.low, Math.abs(k.high - pc), Math.abs(k.low - pc)); }
  const atrPct = sum / len / c.at(-1).close * 100, movePct = atrPct * Math.sqrt(S.n), r = e.rating;
  const bull = r.rules.filter(x => x.score > 0).length, bear = r.rules.filter(x => x.score < 0).length;
  const verdict = bull >= 3 ? `▲ Long-Tendenz – ${bull} von 4 Signalen bullish` : bear >= 3 ? `▼ Short-Tendenz – ${bear} von 4 Signalen bearish` : bull + bear ? 'Abwarten – Signale widersprechen sich' : 'Abwarten – keine Signale';
  return { chgText: chg == null ? null : `${S.label} ${pct(chg)}`, atr: num(atrPct, 2), move: num(movePct, 2), low: movePct < 1, verdict, dir: bull >= 3 ? 'long' : bear >= 3 ? 'short' : 'wait',
    rated: r.closeTime + 1, age: now - (r.closeTime + 1), lastClosed: c.at(-1).closeTime + 1, stand: new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(r.closeTime + 1), iv: e.iv, n: c.length };
}, [coin, S]);
// Stream des Charts (Coin im Chart, Chart-Intervall)
const chartStream = page => page.evaluate(() => `${document.getElementById('pair-label').textContent.split(' ')[0].toLowerCase()}usdt@kline_${document.querySelector('.intervals .active').dataset.interval}`);
// Reihe der Kachel: Länge und lückenlos ohne doppelte Kerzen (jede beginnt direkt nach dem Schluss der vorigen). 259 abgeschlossene
// nach eigenem Laden; 260, wenn der Zwischenspeicher mehr hatte (3.26.0: Coin auch im Chart geladen)
const series = (page, sym) => page.evaluate(sym => { const c = window.__wl.c.get(sym).closed; let ok = c.length > 0; for (let i = 1; i < c.length; i++) if (c[i].time !== c[i - 1].closeTime + 1) ok = false; return { n: c.length, ok }; }, sym);
const streams = async () => { const st = await h.ctl('/state'); return new Set(st.conns.flatMap(c => c.streams)); };
const klineLog = async (since, sym) => (await h.ctl(`/log?since=${since}`)).filter(e => /\/klines$/.test(e.path || '') && e.q?.symbol === sym).map(e => `${e.q.interval}:${e.q.limit}`);
function writeDebugPage() {
  const s = fs.readFileSync(`${REPO}/weather-widget-v2.html`, 'utf8');
  const hook = '\nwindow.__wl = { get c() { return wl.c; }, paint: () => wlPaint(Date.now(), true), get span() { return wl.span; } };\nrender();startLive();';
  if (!s.includes('\nrender();startLive();')) throw new Error('Einstiegspunkt für die Testseite fehlt');
  fs.writeFileSync(`${REPO}/${DBG}`, s.replace('\nrender();startLive();', hook));
}
// Prüft für einen Zeitraum: Kacheln, Kopf, Stand, Gesamtbewertung, Bewegung, Fußzeile, Streams – mit angehaltenem Kurs
async function verifySpan(page, key, tag) {
  const S = SP[key];
  await h.ctl('/walk?on=0'); await page.waitForTimeout(1300); await page.evaluate(() => window.__wl.paint());
  const t = await tiles(page), p = await panel(page), x = await expect(page, p.title, S), st = await streams();
  const want = await Promise.all(COINS.map(c => expect(page, c, S)));
  await h.ctl('/walk?on=1');
  const chgOk = S.ms > 120e3 ? t.every((y, i) => y.chg === want[i]?.chgText) : t.every(y => new RegExp(`^${S.label.replace('.', '\\.')} [+−±]\\d+,\\d\\d %$`).test(y.chg));
  check(`${tag}: Kacheln „${S.label} …“ = Veränderung seit Beginn des Zeitraums (nachgerechnet)`, chgOk, JSON.stringify(t.map((y, i) => [y.coin, y.chg, want[i]?.chgText])));
  check(`${tag}: Kopf „Signale ${S.of} · Stand ${x?.stand}“, Stand = Schluss der letzten ${S.ivName}-Kerze`, x && p.meta === `Signale ${S.of} · Stand ${x.stand}` && p.value === key && p.shown === S.of && x.iv === S.iv && x.rated % IVMS[S.iv] === 0 && x.age < 2 * IVMS[S.iv] && x.rated === x.lastClosed,
    JSON.stringify({ meta: p.meta, value: p.value, iv: x?.iv, age: x?.age }));
  check(`${tag}: Gesamtbewertung passt zur Zählung der Signale (${x?.verdict})`, x && p.verdict === x.verdict && p.vcls === `wl-d-verdict ${x.dir}`, JSON.stringify([p.verdict, x?.verdict]));
  const moveTxt = `⚠ Zu wenig Bewegung – über ${S.name} etwa ${x?.move} %, ein Ziel von 1 % ist unrealistisch`;
  check(`${tag}: „Zu wenig Bewegung“ genau dann, wenn ATR × √${S.n} unter 1 % liegt (hier ${x?.move} %)`, x && (x.low ? p.move === moveTxt && p.moveTip.includes(`ATR (mittlere wahre Spanne) der letzten ${S.n >= 10 ? S.n : 14} ${S.ivName}-Kerzen: ${x.atr} % je Kerze.`) : p.move === null), JSON.stringify({ move: p.move, low: x?.low }));
  check(`${tag}: Fußzeile „Beschreibt ${S.the} – kein Handelssignal mit nachgewiesenem Vorteil.“`, p.foot === `Beschreibt ${S.the} – kein Handelssignal mit nachgewiesenem Vorteil.`, p.foot);
  const wl = COINS.map(c => `${c.toLowerCase()}usdt@kline_${S.iv}`);
  const chart = await chartStream(page), stale = [...st].filter(s => /@kline_/.test(s) && !/^btcusdt@/.test(s) && s !== chart && !s.endsWith('@kline_' + S.iv));
  check(`${tag}: Live-Streams der sechs Coins mit ${S.iv}-Kerzen, keine anderen Kerzen-Streams für die Vorauswahl`, wl.every(s => st.has(s)) && !stale.length, JSON.stringify({ missing: wl.filter(s => !st.has(s)), stale }));
  const toneOk = t.every((y, i) => !want[i] || (want[i].dir === 'long' ? y.tone === 'p3' : want[i].dir === 'short' ? y.tone === 'm3' : !['p3', 'm3'].includes(y.tone)));
  check(`${tag}: Kachel kräftig grün/rot nur bei Long-/Short-Tendenz (3 von 4)`, toneOk, JSON.stringify(t.map((y, i) => [y.coin, y.tone, want[i]?.dir])));
}

(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); writeDebugPage();
  const browser = await h.launch();
  try {
    // ================= Computer =================
    let ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await ctx.newPage(), errors = []; h.collect(page, errors);
    let since = Date.now();
    await page.goto(`${h.URL_BASE}/${DBG}`); await live(page);
    check('Standard: alle sechs Kacheln aus 5-Minuten-Kerzen bewertet', await ready(page, '5m'));
    let log = await klineLog(since, 'ETCUSDT');
    check('Geladen: 260 Kerzen zu 5 Minuten (Vorlauf für EMA 50 und MACD), keine 1-Minuten-Kerzen mehr', log.includes('5m:260') && !log.some(l => l.startsWith('1m:')), log.join(' '));
    const t0 = await tiles(page);
    check('Kacheln: „1 Std. ±x,xx %“, kein „1 Min.“/„30 Min.“ mehr', t0.every(x => /^1 Std\. [+−±]\d+,\d\d %$/.test(x.chg)) && !(await page.$('#watchlist .wl-chg30')), JSON.stringify(t0.map(x => x.chg)));
    await page.click('#watchlist .wl-tile[data-watch="ETC"]'); await page.waitForTimeout(500);
    let p = await panel(page);
    check('Detailfeld: Auswahl in der Überschrift mit 1 Minute, 30 Minuten, 1 Stunde (gewählt), 4 Stunden, 1 Tag', p.open && p.options === '1m:der letzten Minute,30m:der letzten 30 Minuten,1h:der letzten Stunde,4h:der letzten 4 Stunden,1d:des letzten Tages' && p.value === '1h' && p.label === 'Zeitraum der Signalbewertung', JSON.stringify({ options: p.options, value: p.value }));
    const chartIv0 = await page.$eval('.intervals .active', b => b.dataset.interval);
    await verifySpan(page, '1h', '1 Stunde');
    // ---- Zeitraum wechseln: 4 Stunden ----
    since = Date.now();
    await page.selectOption('#wl-detail select.wl-d-span', '4h'); await page.waitForTimeout(150);
    p = await panel(page); let t = await tiles(page);
    check('4 Stunden gewählt: Überschrift sofort „Signale der letzten 4 Stunden …“, Kacheln „4 Std. …“', p.value === '4h' && /^Signale der letzten 4 Stunden · /.test(p.meta) && t.every(x => /^4 Std\. /.test(x.chg)), JSON.stringify({ meta: p.meta, chg: t.map(x => x.chg) }));
    check('… alle Kacheln aus 15-Minuten-Kerzen neu bewertet', await ready(page, '15m'));
    log = await klineLog(since, 'ETCUSDT');
    // 3.26.0: ETC ist nach dem Antippen auch im Chart – dessen Leisten haben die 15-Minuten-Kerzen evtl. schon geholt, dann
    // ergänzt die Vorauswahl nur die fehlenden aus dem Zwischenspeicher
    const s15 = await series(page, 'ETCUSDT');
    check('… 260 Kerzen zu 15 Minuten geladen oder aus dem Zwischenspeicher ergänzt (259–260 abgeschlossene, lückenlos, keine doppelt)', log.some(l => l.startsWith('15m:')) && s15.n >= 259 && s15.n <= 260 && s15.ok, `${log.join(' ')} · ${JSON.stringify(s15)}`);
    await verifySpan(page, '4h', '4 Stunden');
    check('Gespeichert (nur auf diesem Gerät): scalpdesk.wlspan.v1 = 4h', await page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.wlspan.v1'))) === '4h');
    check('Der Zeitraum ändert das Chart-Intervall nicht', await page.$eval('.intervals .active', b => b.dataset.interval) === chartIv0, chartIv0);
    // ---- Chart-Knöpfe steuern nur den Chart ----
    await page.click('.intervals [data-interval="1h"]'); await live(page); await page.waitForTimeout(2500);
    p = await panel(page); t = await tiles(page); let st = await streams();
    check('Chart auf 1h (ETC, per Antippen geladen): Chart-Stream 1h, die Bewertung bleibt bei 4 Stunden (15-Minuten-Kerzen)', st.has('etcusdt@kline_1h') && await chartStream(page) === 'etcusdt@kline_1h' && p.value === '4h' && p.shown === 'der letzten 4 Stunden' && t.every(x => /^4 Std\. /.test(x.chg)) && st.has('etcusdt@kline_15m') && await page.evaluate(() => window.__wl.c.get('ETCUSDT').iv) === '15m', JSON.stringify({ value: p.value, chg: t[1].chg }));
    await page.click('.intervals [data-interval="15m"]'); await live(page); await page.waitForTimeout(2000);
    p = await panel(page);
    check('Chart auf 15m: Bewertung unverändert (4 Stunden)', p.value === '4h' && /^Signale der letzten 4 Stunden · Stand /.test(p.meta), p.meta);
    await page.click(`.intervals [data-interval="${chartIv0}"]`); await live(page); await page.waitForTimeout(1000);
    // ---- Neu laden: Einstellung bleibt ----
    await page.reload(); await live(page);
    check('Nach dem Neuladen: wieder 4 Stunden, Kacheln aus 15-Minuten-Kerzen', await ready(page, '15m') && (await tiles(page)).every(x => /^4 Std\. /.test(x.chg)));
    await page.click('#watchlist .wl-tile[data-watch="ETC"]'); await page.waitForTimeout(500); p = await panel(page);
    check('… Auswahl im Detailfeld steht auf 4 Stunden', p.value === '4h' && p.shown === 'der letzten 4 Stunden', JSON.stringify([p.value, p.shown]));
    // ---- Tastatur: Pfeiltaste wechselt, der Fokus bleibt auf der Auswahl ----
    await page.focus('#wl-detail select.wl-d-span'); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(400);
    const kb = await page.evaluate(() => ({ value: document.querySelector('#wl-detail select.wl-d-span').value, focus: document.activeElement?.classList.contains('wl-d-span'), span: window.__wl.span }));
    check('Tastatur: Pfeil ↓ wechselt auf 1 Tag, der Fokus bleibt auf der Auswahl', kb.value === '1d' && kb.span === '1d' && kb.focus, JSON.stringify(kb));
    await page.keyboard.press('ArrowUp'); await page.waitForTimeout(400);
    check('… Pfeil ↑ zurück auf 4 Stunden, Fokus weiter auf der Auswahl', await page.evaluate(() => document.querySelector('#wl-detail select.wl-d-span').value === '4h' && document.activeElement?.classList.contains('wl-d-span') && window.__wl.span === '4h'));
    // ---- Alle übrigen Zeiträume ----
    for (const key of ['1m', '30m', '1d', '1h']) {
      since = Date.now();
      await page.selectOption('#wl-detail select.wl-d-span', key);
      const S = SP[key], ok = await ready(page, S.iv); log = await klineLog(since, 'ETCUSDT');
      const ser = await series(page, 'ETCUSDT');
      // schon einmal geladen (Tastatur-Test, Start): nur die fehlenden Kerzen aus dem Zwischenspeicher nachgeladen
      check(`${S.name}: alle Kacheln aus ${S.ivName}-Kerzen bewertet, Reihe mit Vorlauf (259–260 abgeschlossene, lückenlos, keine doppelt; 260 geladen oder nachgeladen)`, ok && ser.n >= 259 && ser.n <= 260 && ser.ok && log.some(l => l.startsWith(S.iv + ':')) && log.every(l => l.startsWith(S.iv + ':')), `${log.join(' ')} · ${JSON.stringify(ser)}`);
      await verifySpan(page, key, S.name);
    }
    // ---- Bewegung erzwingen: ruhige und bewegte Kerzen (1 Stunde) ----
    const force = r => page.evaluate(r => { const e = window.__wl.c.get('ETCUSDT'), c = e.closed, p0 = c.at(-1).close; for (const k of c.slice(-20)) { k.close = p0; k.open = p0; k.high = p0 * (1 + r); k.low = p0 * (1 - r); } e.move = null; window.__wl.paint(); }, r);
    await h.ctl('/walk?on=0'); await force(0.0002); await page.waitForTimeout(300);
    p = await panel(page); let x = await expect(page, 'ETC', SP['1h']);
    const etcTitle = await page.$eval('#watchlist .wl-tile[data-watch="ETC"]', el => el.title);
    check('Kaum Bewegung (Spanne 0,04 % je 5 Minuten): „⚠ Zu wenig Bewegung – über 1 Stunde etwa 0,14 % …“, auch im Kachel-Hinweis', p.move === `⚠ Zu wenig Bewegung – über 1 Stunde etwa ${x.move} %, ein Ziel von 1 % ist unrealistisch` && x.move === '0,14' && / · zu wenig Bewegung · /.test(etcTitle), JSON.stringify({ move: p.move, title: etcTitle }));
    check('Erklärung: ATR der 12 Kerzen und Faustregel ATR × √12', /^ATR \(mittlere wahre Spanne\) der letzten 12 5-Minuten-Kerzen: 0,04 % je Kerze\.Über 1 Stunde bewegt sich der Kurs damit typischerweise etwa 0,14 % \(Faustregel: ATR × √12, 12 Kerzen im Zeitraum\)\. Das reicht nicht für ein Ziel von 1 %\.$/.test(p.moveTip), p.moveTip);
    const hLow = await page.$eval('#wl-detail', d => d.getBoundingClientRect().height);
    await force(0.01); await page.waitForTimeout(300); p = await panel(page);
    const hHigh = await page.$eval('#wl-detail', d => d.getBoundingClientRect().height);
    check('Viel Bewegung (Spanne 2 % je 5 Minuten): kein Hinweis; das Feld schrumpft dabei nicht', p.move === null && hHigh === hLow, JSON.stringify({ move: p.move, hLow, hHigh }));
    await h.ctl('/walk?on=1');
    check('Computer: keine Fehler', !real(errors).length, real(errors).join(' | ')); await ctx.close();

    // ================= Handy (Touch): kein Zoom, nichts abgeschnitten =================
    for (const [w, hh] of [[390, 844], [320, 700]]) {
      ctx = await browser.newContext({ viewport: { width: w, height: hh }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 }); page = await ctx.newPage(); errors = []; h.collect(page, errors);
      await page.goto(`${h.URL_BASE}/${DBG}`); await live(page);
      check(`Handy ${w} px: Standard 1 Stunde (frisches Gerät), Kacheln bewertet`, await ready(page, '5m'));
      await page.tap('#watchlist .wl-tile[data-watch="ETC"]'); await page.waitForTimeout(600);
      const g = await page.evaluate(() => {
        const sel = document.querySelector('#wl-detail select.wl-d-span'), v = document.querySelector('#wl-detail .wl-d-pickv').getBoundingClientRect(), cs = getComputedStyle(sel);
        const hit = document.elementFromPoint(v.left + v.width / 2, v.top + v.height / 2), box = document.querySelector('#wl-detail .wl-d-box').getBoundingClientRect(), pk = document.querySelector('#wl-detail .wl-d-pick').getBoundingClientRect(), meta = document.querySelector('#wl-detail .wl-d-meta');
        return { font: cs.fontSize, opacity: cs.opacity, hit: hit === sel, inBox: pk.left >= box.left && pk.right <= box.right, metaFits: meta.scrollWidth <= meta.clientWidth + 1, sw: document.scrollingElement.scrollWidth - innerWidth };
      });
      check(`Handy ${w} px: Auswahl 16 px (Safari zoomt nicht), unsichtbar über dem Text – Antippen des Texts öffnet sie`, g.font === '16px' && g.opacity === '0' && g.hit, JSON.stringify(g));
      check(`Handy ${w} px: Überschrift passt ins Feld, kein seitliches Scrollen`, g.inBox && g.metaFits && g.sw <= 0, JSON.stringify(g));
      const cut = [];
      for (const key of ['30m', '1d', '4h', '1m', '1h']) {
        await page.selectOption('#wl-detail select.wl-d-span', key); await ready(page, SP[key].iv); await page.waitForTimeout(300);
        const tt = await tiles(page), pp = await panel(page), m = await page.evaluate(() => { const e = document.querySelector('#wl-detail .wl-d-meta'); return e.scrollWidth <= e.clientWidth + 1 && document.scrollingElement.scrollWidth <= innerWidth; });
        if (!tt.every(y => !y.cut && y.inside && y.chg.startsWith(SP[key].label)) || !m || pp.value !== key) cut.push(`${key}: ${JSON.stringify(tt.filter(y => y.cut || !y.inside).map(y => [y.coin, y.chg]))} meta ${m}`);
      }
      check(`Handy ${w} px: alle fünf Zeiträume – Kacheln und Überschrift vollständig lesbar`, !cut.length, cut.join(' | '));
      check(`Handy ${w} px: keine Fehler`, !real(errors).length, real(errors).join(' | ')); await ctx.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.teardown(); try { fs.unlinkSync(`${REPO}/${DBG}`); } catch {} }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
