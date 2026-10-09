// 3.26.0 – Gewinn-/Verlust-Alarm auch bei geschlossener App: App und echter 24/7-Dienst 1.2 (eigener Prozess) gegen die
// Telegram-/Binance-Attrappe. Übergabe nur bei aktiver Grenze (dann mit Einstieg und Menge), Dienst bestätigt „· GV“; App
// geschlossen → genau eine Meldung vom Dienst; App wieder offen → „ausgelöst (Meldung vom 24/7-Dienst)“ ohne zweite Meldung;
// App offen → die App meldet sofort selbst, der Dienst schweigt (auch bei einer kurzen Spitze). Ausgelöster Kurs-Alarm bleibt
// 3 Minuten in der Übergabe (der Dienst meldet ihn). Dazu: Kachel antippen lädt den Coin im Chart ohne „Im Chart öffnen“ und
// ohne zum Chart zu springen (Handy, iPad, Tastatur); Menüs „Hinweise“/„Ansicht“ am iPad hochkant mittig, auch nach dem Drehen.
// Aufruf: node m46.js
const h = require('./harness'), { spawn } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', CHAT = '987654321';
const CHAN = { tg: { token: TOKEN, chat: CHAT, on: true }, dc: { url: '', on: true }, ev: { alarm: true, pos: true, day: true, news: true, pnl: true, pulse: false } };
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const mock = p => fetch('http://127.0.0.1:8790' + p).then(r => r.json());
const pinnedMsg = async () => { const m = (await mock(`/tgmsgs?chat=${CHAT}`)).filter(x => x.pinnedAt).sort((a, b) => b.message_id - a.message_id)[0] || null; if (m) m.caption = String(m.caption || '').replace(/\r/g, ''); return m; };
const pinnedFile = async () => { const m = await pinnedMsg(); return m?.content ? { m, b: JSON.parse(m.content) } : null; };
const msgs = async (re, since) => (await h.ctl('/sent')).filter(m => m.svc === 'tg' && re.test(m.text || '') && m.at >= since);
const until = async (fn, ms = 20000, step = 250) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
const PNL_RE = /(Gewinn|Verlust)-Alarm/;
function startService(dir) {
  const env = { ...process.env, SCALPDESK_FAST: '1', NODE_TLS_REJECT_UNAUTHORIZED: '0', SCALPDESK_TG_API: 'https://127.0.0.1/_h/api.telegram.org', SCALPDESK_SPOT_API: 'https://127.0.0.1/_h/data-api.binance.vision',
    SCALPDESK_FUT_API: 'https://127.0.0.1/_h/fapi.binance.com', SCALPDESK_CAL_URL: 'https://127.0.0.1/_h/raw.githubusercontent.com/NicoAHB/wx-widget/kalender/calendar.json', NODE_NO_WARNINGS: '1' };
  for (const k of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']) delete env[k];
  fs.writeFileSync(path.join(dir, 'conf.json'), JSON.stringify({ token: TOKEN, chat: CHAT }));
  const p = spawn('node', [require('path').join(__dirname, '..', 'server/scalpdesk-247.mjs'), '--config', path.join(dir, 'conf.json'), '--state', path.join(dir, 'state.json')], { env });
  p.log = []; p.stdout.on('data', d => p.log.push(String(d).trim())); p.stderr.on('data', d => p.log.push('! ' + String(d).trim()));
  return p;
}
const real = errs => errs.filter(e => !/Service Worker registration blocked/.test(e));
const pnlUi = page => page.evaluate(() => { const $ = id => document.getElementById(id); return { pSt: $('pnl-profit-st').textContent, lSt: $('pnl-loss-st').textContent, svc: $('pnl-svc').hidden ? '' : $('pnl-svc').textContent, badge: $('lb-pos').dataset.pnl || '', open: $('lb-open').textContent }; });
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.pnlalarm.v1') || 'null'));
const okToasts = async page => { for (const b of await page.$$('#toasts .toast button')) await b.click().catch(() => {}); await page.waitForTimeout(200); };
async function s247Status(page) {
  await okToasts(page); await page.click('#notify-menu'); await page.waitForTimeout(250); await page.click('#chan-open'); await page.waitForTimeout(400);
  await page.click('#s247-check'); await page.waitForFunction(() => !document.getElementById('s247-check').disabled, null, { timeout: 10000 }).catch(() => {}); await page.waitForTimeout(400);
  const t = await page.evaluate(() => document.getElementById('s247-status').textContent);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300); return t;
}
async function setLimit(page, kind, v) {
  await page.click('#lb-pos'); await page.waitForTimeout(250); await page.fill(`#pnl-${kind}`, String(v)); await page.click('#pnl-form [type=submit]'); await page.waitForTimeout(300);
  const u = await pnlUi(page); await page.click('#pnl-close'); await page.waitForTimeout(200); return u;
}

(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/tgreset'); await h.ctl('/walk?on=0');
  const P0 = Math.round((await h.ctl('/state')).price.BTCUSDT); await h.ctl(`/set?symbol=BTCUSDT&price=${P0}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm46-')), browser = await h.launch(); let svc = null;
  try {
    // ================= A: Gewinn-/Verlust-Alarm mit dem Dienst (Computer) =================
    const now = Date.now(), pos = [{ id: 'p1', symbol: 'BTCUSDT', side: 'long', mode: 'isolated', entry: P0, leverage: 10, qty: 1, margin: P0 / 10, openedAt: now - 60e3, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false } }];
    const alarms = [{ id: 'al1', symbol: 'BTCUSDT', source: 'spot', dir: 'above', price: P0 + 200, note: 'Test m46', createdAt: now - 60e3, armedAt: now - 60e3, triggeredAt: null, triggerPrice: null }];
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Berlin' });
    await ctx.addInitScript(([c, p, al]) => { if (localStorage.getItem('seeded46')) return; localStorage.setItem('seeded46', '1'); localStorage.setItem('scalpdesk.channels.v1', JSON.stringify(c)); localStorage.setItem('scalpdesk.positions.v1', JSON.stringify(p)); localStorage.setItem('scalpdesk.alarms.v1', JSON.stringify(al)); }, [CHAN, pos, alarms]);
    let page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await page.waitForTimeout(1500);
    await page.click('#notify-menu'); await page.waitForTimeout(250); await page.click('#chan-open'); await page.waitForTimeout(400);
    await page.check('#s247-on'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    let pf = await until(pinnedFile, 20000);
    check('Ohne Gewinn-/Verlust-Grenze: keine Einstiege und Mengen in der Übergabe', pf && pf.b.pnl === null && !/"qty"|"entry"/.test(pf.m.content) && pf.b.ev.pnl === true, pf?.m.content.slice(0, 160));
    await setLimit(page, 'profit', 50);
    pf = await until(async () => { const x = await pinnedFile(); return x?.b.pnl?.lim?.length ? x : null; }, 20000);
    const lim = pf?.b.pnl?.lim?.[0] || {}, pp = pf?.b.pnl?.pos?.[0] || {};
    check('Gewinn-Grenze 50 gespeichert: Übergabe mit Grenze (Zeitpunkt des Scharfschaltens) und der Position (Einstieg, Menge, Markt)', lim.k === 'profit' && lim.v === 50 && lim.at > 0 && lim.w === false && lim.done === false && pf.b.pnl.n === 1 && pp.entry === P0 && pp.qty === 1 && pp.source === 'spot' && pp.side === 'long', JSON.stringify(pf?.b.pnl));
    svc = startService(dir);
    const conf = await until(async () => { const m = await pinnedMsg(); return m && / · GV · #[a-z0-9]+ übernommen/.test(m.caption) ? m : null; }, 25000);
    check('Dienst 1.2 gestartet: bestätigt mit „· GV“', !!conf, conf?.caption.split('\n').at(-1) || svc.log.join(' | '));
    let st = await s247Status(page);
    check('App: „Übergeben ✓ vom Dienst bestätigt“ – den Gewinn-/Verlust-Alarm meldet bei geschlossener App der Dienst', /^Übergeben ✓ vom Dienst bestätigt/.test(st) && /Den Gewinn-\/Verlust-Alarm meldet bei geschlossener App der Dienst, bei geöffneter App diese App selbst\./.test(st), st);
    await page.click('#lb-pos'); await page.waitForTimeout(250); let u = await pnlUi(page); await page.click('#pnl-close');
    check('Gewinn-/Verlust-Feld: „✓ Auch bei geschlossener App …“', u.svc === '✓ Auch bei geschlossener App: Der 24/7-Dienst prüft mit und meldet die Grenze.', u.svc);
    // ---- App geschlossen: Dienst meldet ----
    await page.close(); let t0 = Date.now();
    await h.ctl(`/set?symbol=BTCUSDT&price=${P0 + 60}`);
    let m = await until(async () => { const x = await msgs(PNL_RE, t0); return x.length ? x : null; }, 20000);
    check('App geschlossen, Live-Ergebnis +60 ≥ +50: genau eine Meldung, vom Dienst', m?.length === 1 && /^📈 Gewinn-Alarm\nLive-Ergebnis \+60,00 USDT \(1 offene Position\) · Schwelle ≥ \+50,00 USDT erreicht\n\d\d:\d\d:\d\d Uhr · 24\/7-Dienst$/.test(m[0].text) && m[0].chat_id === CHAT, m?.map(x => x.text.replace(/\n/g, ' ⏎ ')).join(' | '));
    const gvl = await until(async () => (await pinnedMsg())?.caption.split('\n').find(l => l.startsWith('GV: Gewinn-Alarm ausgelöst')), 10000);
    check('… in der angehefteten Nachricht vermerkt', !!gvl && / bei \+60,00 USDT · @p:\d+:\d+:60$/.test(gvl), gvl);
    await h.sleep(4000);
    check('… keine zweite Meldung', (await msgs(PNL_RE, t0)).length === 1);
    // ---- App wieder offen: übernimmt „ausgelöst“, sendet nicht noch einmal ----
    page = await ctx.newPage(); errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page);
    const s1 = await until(async () => { const d = await stored(page); return d?.profit?.state === 'fired' ? d.profit : null; }, 15000);
    await page.waitForTimeout(3000);
    const toast = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent).find(t => /Gewinn-Alarm/.test(t)) || '');
    check('Wieder geöffnet: Grenze als ausgelöst übernommen (Wert und Zeit vom Dienst), Hinweis „vom 24/7-Dienst gemeldet“', s1?.svc === true && s1.firedVal === 60 && /vom 24\/7-Dienst gemeldet um \d\d:\d\d Uhr: Live-Ergebnis \+60,00 USDT/.test(toast), JSON.stringify({ s1, toast }));
    check('… und keine zweite Telegram-Meldung (auch nicht von der App)', (await msgs(PNL_RE, t0)).length === 1, (await msgs(PNL_RE, t0)).map(x => x.text.split('\n').at(-1)).join(' | '));
    await page.click('#lb-pos'); await page.waitForTimeout(250); u = await pnlUi(page);
    check('Feld: „ausgelöst um … bei +60,00 USDT (Meldung vom 24/7-Dienst)“, Punkt gelb, „Wieder aktivieren“', /^ausgelöst um \d\d:\d\d Uhr bei \+60,00 USDT \(Meldung vom 24\/7-Dienst\) – meldet erst nach „Wieder aktivieren“ erneut$/.test(u.pSt) && u.badge === 'fired' && await page.isVisible('#pnl-profit-rearm'), JSON.stringify(u));
    // ---- App offen: Verlust-Grenze – die App meldet sofort selbst, der Dienst schweigt ----
    await page.fill('#pnl-loss', '30'); await page.click('#pnl-form [type=submit]'); await page.waitForTimeout(300); await page.click('#pnl-close');
    await until(async () => { const x = await pinnedFile(); return x?.b.pnl?.lim?.some(l => l.k === 'loss') ? x : null; }, 15000);
    await until(async () => { const mm = await pinnedMsg(); const x = await pinnedFile(); return x && mm.caption.includes(`#${x.b.tag} übernommen`) ? true : null; }, 15000);
    st = await s247Status(page); t0 = Date.now();
    await h.ctl(`/set?symbol=BTCUSDT&price=${P0 - 40}`);
    m = await until(async () => { const x = await msgs(/Verlust-Alarm/, t0); return x.length ? x : null; }, 20000);
    await h.sleep(5000); m = await msgs(/Verlust-Alarm/, t0);
    const toast2 = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent).find(t => /Verlust-Alarm/.test(t)) || '');
    check('App offen, −40 ≤ −30: genau eine Meldung, sofort von der App; der Dienst sendet nicht zusätzlich', m.length === 1 && /^📉 Verlust-Alarm\nLive-Ergebnis −40,00 USDT/.test(m[0].text) && /\n\d\d:\d\d:\d\d Uhr$/.test(m[0].text) && m[0].at - t0 < 3000 && /Verlust-Alarm/.test(toast2), JSON.stringify({ n: m.length, last: m.map(x => x.text.split('\n').at(-1)), ms: m.map(x => x.at - t0), toast2: toast2.slice(0, 60) }));
    const s2 = (await stored(page))?.loss, pfL = await pinnedFile();
    check('… in der App ausgelöst (von der App gemeldet), in der Übergabe als gemeldet vermerkt (done)', s2?.state === 'fired' && s2.svc === false && pfL?.b.pnl?.lim.find(l => l.k === 'loss')?.done === true, JSON.stringify({ s2, lim: pfL?.b.pnl?.lim }));
    // ---- Kurs-Alarm bleibt nach dem Auslösen kurz in der Übergabe; Meldung kommt vom Dienst ----
    t0 = Date.now();
    await h.ctl(`/set?symbol=BTCUSDT&price=${P0 + 210}`);
    const am = await until(async () => { const x = await msgs(/Kurs-Alarm BTC/, t0); return x.length ? x : null; }, 20000);
    await page.waitForTimeout(6000);
    const pf2 = await pinnedFile(), alarmState = await page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.alarms.v1') || '[]')[0]);
    check('Kurs-Alarm ausgelöst (App offen): genau eine Meldung, vom Dienst', (await msgs(/Kurs-Alarm BTC/, t0)).length === 1 && /· 24\/7-Dienst$/.test(am?.[0]?.text || ''), am?.map(x => x.text.split('\n').at(-1)).join(' | '));
    check('… der ausgelöste Alarm bleibt noch in der Übergabe (vom Dienst gemeldet, svcAt gesetzt)', alarmState?.triggeredAt > 0 && alarmState.svcAt > 0 && pf2?.b.alarms.some(a => a.id === 'al1'), JSON.stringify({ trig: alarmState?.triggeredAt, svcAt: alarmState?.svcAt, inFile: pf2?.b.alarms.map(a => a.id) }));
    // ---- App offen, kurze Spitze: die App sieht sie und meldet; der Dienst (prüft nur alle 1,5 s) sieht sie meist nicht ----
    await h.ctl(`/set?symbol=BTCUSDT&price=${P0}`); await page.waitForTimeout(1500);
    await page.click('#lb-pos'); await page.waitForTimeout(250); await page.click('#pnl-profit-rearm'); await page.waitForTimeout(300); await page.click('#pnl-close');
    const atRe = (await stored(page))?.profit?.at;
    const reOk = await until(async () => { const x = await pinnedFile(), mm = await pinnedMsg(); return x?.b.pnl?.lim.some(l => l.k === 'profit' && l.at === atRe && !l.done) && mm.caption.includes(`#${x.b.tag} übernommen`) ? true : null; }, 20000);
    t0 = Date.now(); await h.ctl(`/set?symbol=BTCUSDT&price=${P0 + 60}`);
    const spike = await until(async () => (await stored(page))?.profit?.state === 'fired' ? true : null, 8000, 50);
    await h.ctl(`/set?symbol=BTCUSDT&price=${P0}`); const spikeMs = Date.now() - t0;
    await h.sleep(6000); m = await msgs(/Gewinn-Alarm/, t0);
    check(`App offen, kurze Spitze (+60 für ${spikeMs} ms): genau eine Meldung, von der App; der Dienst meldet nicht zusätzlich`, reOk && spike && m.length === 1 && /\n\d\d:\d\d:\d\d Uhr$/.test(m[0].text), JSON.stringify({ reOk, spike, spikeMs, n: m.length, last: m.map(x => x.text.split('\n').at(-1)) }));
    check('Computer: keine Fehler', !real(errors).length, real(errors).join(' | '));
    await ctx.close();
    svc.kill(); svc = null;

    // ================= B: Kachel antippen lädt den Coin im Chart, ohne Springen =================
    // „Safari“: Verankerung durch die App wie auf iPhone/iPad (navigator.vendor), sonst die eingebaute von Chrome
    for (const [w, hh, mode] of [[390, 844, 'safari'], [390, 844, 'chrome'], [820, 1180, 'safari'], [820, 1180, 'chrome']]) {
      const c2 = await browser.newContext({ viewport: { width: w, height: hh }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      if (mode === 'safari') await c2.addInitScript(() => Object.defineProperty(Navigator.prototype, 'vendor', { get: () => 'Apple Computer, Inc.' }));
      const pg = await c2.newPage(), errs = []; h.collect(pg, errs);
      await pg.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(pg);
      await pg.waitForFunction(() => [...document.querySelectorAll('#watchlist .wl-sig')].every(s => /^[+−]?\d$/.test(s.textContent)), null, { timeout: 30000 }).catch(() => {});
      // Platz für das vollständige Detail reservieren: sonst scrollt wldOpen absichtlich zum sichtbaren Feld.
      await pg.evaluate(() => { const tile = document.querySelector('#watchlist .wl-tile[data-watch="NEAR"]').getBoundingClientRect(); scrollBy(0, tile.top - 180); }); await pg.waitForTimeout(500);
      const before = await pg.evaluate(() => ({ y: Math.round(scrollY), tile: Math.round(document.querySelector('#watchlist .wl-tile[data-watch="NEAR"]').getBoundingClientRect().top), chart: Math.round(document.getElementById('chart').getBoundingClientRect().top) }));
      await pg.tap('#watchlist .wl-tile[data-watch="NEAR"]');
      await pg.waitForFunction(() => /^NEAR/.test(document.getElementById('pair-label').textContent), null, { timeout: 15000 }).catch(() => {}); await live(pg); await pg.waitForTimeout(2500);
      const after = await pg.evaluate(() => ({ anchor: document.documentElement.dataset.anchor || 'browser', y: Math.round(scrollY), tile: Math.round(document.querySelector('#watchlist .wl-tile[data-watch="NEAR"]').getBoundingClientRect().top), pair: document.getElementById('pair-label').textContent, open: document.getElementById('wl-detail').dataset.open, title: document.querySelector('#wl-detail .wl-d-title').textContent, btn: !!document.querySelector('#wl-detail .wl-d-chart, [data-chartwatch]'), current: document.querySelector('#watchlist .wl-tile[data-watch="NEAR"]').getAttribute('aria-current'), chartTop: Math.round(document.getElementById('chart').getBoundingClientRect().top) }));
      check(`${w} px ${mode}: NEAR antippen öffnet das Feld und lädt NEAR im Chart, kein Knopf „Im Chart öffnen“`, after.open === '1' && after.title === 'NEAR' && /^NEAR/.test(after.pair) && !after.btn && after.current === 'true', JSON.stringify(after));
      check(`${w} px ${mode}: die Seite springt nicht zum Chart (Kachel bleibt an ihrer Stelle)`, Math.abs(after.y - before.y) <= 2 && Math.abs(after.tile - before.tile) <= 2 && after.chartTop > hh * 0.5, JSON.stringify({ before, after: { y: after.y, tile: after.tile, chartTop: after.chartTop } }));
      await pg.tap('#watchlist .wl-tile[data-watch="NEAR"]'); await pg.waitForTimeout(600);
      const closed = await pg.evaluate(() => ({ open: document.getElementById('wl-detail').dataset.open, pair: document.getElementById('pair-label').textContent }));
      check(`${w} px ${mode}: dieselbe Kachel erneut schließt das Feld, der Chart bleibt bei NEAR`, closed.open === '0' && /^NEAR/.test(closed.pair), JSON.stringify(closed));
      check(`${w} px ${mode}: keine Fehler`, !real(errs).length, real(errs).join(' | ')); await c2.close();
    }
    // Tastatur (Computer): Enter auf einer Kachel
    {
      const c3 = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), pg = await c3.newPage(), errs = []; h.collect(pg, errs);
      await pg.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(pg); await pg.waitForTimeout(1500);
      const y0 = await pg.evaluate(() => Math.round(scrollY));
      await pg.focus('#watchlist .wl-tile[data-watch="ETC"]'); await pg.keyboard.press('Enter');
      await pg.waitForFunction(() => /^ETC/.test(document.getElementById('pair-label').textContent), null, { timeout: 15000 }).catch(() => {}); await pg.waitForTimeout(1500);
      const k = await pg.evaluate(() => ({ pair: document.getElementById('pair-label').textContent, title: document.querySelector('#wl-detail .wl-d-title').textContent, y: Math.round(scrollY), focus: document.activeElement?.dataset?.watch || '' }));
      check('Tastatur: Enter auf ETC öffnet das Feld und lädt ETC im Chart, ohne Springen, Fokus bleibt', /^ETC/.test(k.pair) && k.title === 'ETC' && Math.abs(k.y - y0) <= 2 && k.focus === 'ETC', JSON.stringify(k));
      check('Tastatur: keine Fehler', !real(errs).length, real(errs).join(' | ')); await c3.close();
    }

    // ================= C: Menüs am iPad hochkant mittig, auch nach dem Drehen =================
    {
      const c4 = await browser.newContext({ viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }), pg = await c4.newPage(), errs = []; h.collect(pg, errs);
      await pg.goto(h.URL_BASE + '/weather-widget-v2.html'); await pg.waitForTimeout(1500);
      const where = id => pg.evaluate(id => { const r = document.getElementById(id).getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), vw: innerWidth, mid: Math.abs((r.left + r.right) / 2 - innerWidth / 2) <= 2 }; }, id);
      await pg.tap('#notify-menu'); await pg.waitForTimeout(300); const n1 = await where('notify-panel');
      check('iPad hochkant: „Hinweise“ öffnet mittig und ganz im Bild', n1.mid && n1.l >= 0 && n1.r <= n1.vw, JSON.stringify(n1));
      await pg.setViewportSize({ width: 1180, height: 820 }); await pg.waitForTimeout(500); const n2 = await where('notify-panel');
      check('… iPad gedreht (quer, Menü offen): ganz im Bild, wieder am Knopf', n2.l >= 0 && n2.r <= n2.vw, JSON.stringify(n2));
      await pg.setViewportSize({ width: 820, height: 1180 }); await pg.waitForTimeout(500); const n3 = await where('notify-panel');
      check('… zurück hochkant: wieder mittig', n3.mid && n3.l >= 0, JSON.stringify(n3));
      await pg.tap('#view-menu'); await pg.waitForTimeout(300); const v1 = await where('view-panel');
      check('iPad hochkant: „Ansicht“ ebenfalls mittig und ganz im Bild', v1.mid && v1.l >= 0 && v1.r <= v1.vw && await pg.evaluate(() => document.getElementById('notify-panel').hidden), JSON.stringify(v1));
      check('iPad: keine Fehler', !real(errs).length, real(errs).join(' | ')); await c4.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n').slice(0, 8).join(' ¦ ')); }
  finally { if (svc) svc.kill(); await browser.close(); await h.teardown(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
