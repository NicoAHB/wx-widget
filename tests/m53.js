// 3.32.0 (G04) – Mobile Bedienung, Vorauswahl und Datenzustände (über die Oberfläche).
// ov: Chart-Ebenen mit zu wenigen Kerzen gesperrt (Grund, vorhanden/benötigt), Klick und Tastatur blockiert, Wunsch bleibt, auch bei
//   verdecktem Chart berechnet, Freigabe bei genug Kerzen. h24: 24h-Tief/Hoch im Detailfeld (Spot/Futures getrennt, Prüfung, Cache,
//   überholte Antworten). coin: Kryptowährungsfeld (markieren, leer, Esc, Verlassen, unbekannt, nicht prüfbar, Futures, Reihenfolge).
// font: Eingabefelder am Touch-Gerät ≥ 16 px, keine verkleinernde Transformation, Zoom erlaubt. zoom: Standardansicht des Charts.
// bar: untere Leiste beim Coinwechsel ohne Aus-/Einblenden. fresh: Frischegrenze 60 s, Teilsumme, Alarme nur auf aktuellen Kursen,
//   Quellzeit, manuelle Trades. sort: Vorauswahl umsortieren (Maus, Touch, Abbruch, Bearbeiten, Tastatur, Tabs, Sicherung).
// Aufruf: node m53.js [ov|h24|coin|font|zoom|bar|fresh|sort]
const fs = require('fs');
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 500) : ''}`); };
// Netzwerk-Meldungen des Browsers (z. B. 400 für ein Paar, das es nur als Futures gibt) sind keine Skriptfehler
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource: the server responded with a status of (400|503)/.test(e));
const until = async (fn, ms = 20000, step = 200) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
async function openPage(browser, seed = {}, { ctx = null, viewport = { width: 1500, height: 1000 }, mobile = false } = {}) {
  ctx = ctx || await browser.newContext({ viewport, acceptDownloads: true, timezoneId: 'Europe/Berlin', ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  if (!ctx.seeded) { ctx.seeded = true; await ctx.addInitScript(items => { if (localStorage.getItem('seeded53')) return; localStorage.setItem('seeded53', '1'); for (const [k, v] of items) localStorage.setItem(k, JSON.stringify(v)); }, Object.entries(seed)); }
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  page.on('dialog', d => void d.accept());
  await page.goto(`${h.URL_BASE}/weather-widget-v2.html`);
  await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);
  return { ctx, page, errors };
}
const ls = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);
const jsClick = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); if (!e) throw new Error('fehlt: ' + sel); e.click(); }, sel);
const txt = (page, sel) => page.evaluate(sel => document.querySelector(sel)?.textContent ?? null, sel);
const num = s => +String(s).replace(/\./g, '').replace(',', '.').replace('−', '-');
const sym = page => txt(page, '#lb-sym');
const load = async (page, s) => { await page.fill('#symbol', s); await page.press('#symbol', 'Enter'); await until(async () => await sym(page) === s, 15000); await page.waitForTimeout(1200); };
const toastText = page => page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent).join(' | '));
const clearToasts = page => page.evaluate(() => document.querySelectorAll('#toasts .toast').forEach(t => t.remove()));
const order = page => page.evaluate(() => [...document.querySelectorAll('#watchlist .wl-grid > .wl-item .wl-tile')].map(t => t.dataset.watch).join(','));
const center = (page, sel) => page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
const download = async (page, fn) => { const [dl] = await Promise.all([page.waitForEvent('download'), fn()]); const f = await dl.path(); return { name: dl.suggestedFilename(), text: fs.readFileSync(f, 'utf8') }; };
const H = 3600e3, NOW = Date.now();
const position = (id, s, entry, qty, extra = {}) => ({ id, symbol: s, side: 'long', mode: 'isolated', entry, leverage: 10, qty, margin: entry * qty / 10, openedAt: NOW - H, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false }, ...extra });
const ovState = page => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-overlay]')].map(b => [b.dataset.overlay, { pressed: b.getAttribute('aria-pressed'), dis: b.getAttribute('aria-disabled'), na: b.classList.contains('na'), need: b.querySelector('.ov-need')?.textContent || '', title: b.title, border: getComputedStyle(b).borderTopStyle }])));
// untere Leiste: in jedem Frame mitschreiben, ob sie unsichtbar ist
const barWatch = page => page.evaluate(() => { const tb = document.getElementById('tabbar'); window.__hid = 0; window.__on = true; const f = () => { const cs = getComputedStyle(tb); if (cs.display === 'none' || cs.visibility === 'hidden') window.__hid++; if (window.__on) requestAnimationFrame(f); }; requestAnimationFrame(f); });
const barStop = page => page.evaluate(() => { window.__on = false; return window.__hid; });

const tests = {
  // ================= Chart-Ebenen sperren =================
  async ov(browser) {
    await h.ctl('/shape?symbol=NEARUSDT&interval=1m&kind=short&n=15');
    const { ctx, page, errors } = await openPage(browser);
    const cap0 = await txt(page, '#chart-caption');
    // Chart aus dem Bild: die Sperren werden trotzdem berechnet (vorher nur beim Zeichnen der Elliott-Ebene)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(700);
    await page.evaluate(() => { document.getElementById('symbol').value = 'NEAR'; document.getElementById('market-form').requestSubmit(); });
    await until(() => page.evaluate(() => document.getElementById('lb-sym').textContent === 'NEAR' && document.querySelector('[data-overlay="ema200"]').getAttribute('aria-disabled') === 'true'), 15000);
    await page.waitForTimeout(500);
    let o = await ovState(page); const have = +(o.bb.need.match(/^ (\d+)\/20$/)?.[1] || -1);
    check('Chart außer Sicht: Sperren trotzdem berechnet – EMA 200, Bollinger, RSI-Div., Elliott gesperrt mit „vorhanden/benötigt“',
      have > 10 && have < 20 && o.ema200.need === ` ${have}/200` && o.div.need === ` ${have}/31` && o.ew.need === ` ${have}/50` && ['ema200', 'bb', 'div', 'ew'].every(k => o[k].dis === 'true' && o[k].na), JSON.stringify({ have, ema: o.ema200, bb: o.bb.need, div: o.div.need, ew: o.ew.need }));
    check('… Volumenprofil, ZigZag, Hoch/Tief, Liquidation, Whales frei', ['vp', 'zz', 'hilo', 'liq', 'whale'].every(k => o[k].dis !== 'true' && !o[k].na && o[k].need === ''), JSON.stringify(Object.fromEntries(['vp', 'zz', 'hilo', 'liq', 'whale'].map(k => [k, o[k].dis + o[k].need]))));
    check('… ohne dass der Chart neu gezeichnet wurde (Beschriftung noch vom vorigen Coin)', await txt(page, '#chart-caption') === cap0, `${cap0} → ${await txt(page, '#chart-caption')}`);
    check('Grund im Tooltip mit tatsächlichem Bedarf', new RegExp(`^EMA 200 braucht 200 Kerzen – dieser Chart hat erst ${have}\\.`).test(o.ema200.title), o.ema200.title);
    check('Gesperrt sichtbar: gestrichelt; der gespeicherte Wunsch bleibt (gedrückt)', o.ema200.border === 'dashed' && o.ema200.pressed === 'true' && o.vp.border === 'solid', JSON.stringify({ ema: o.ema200.border, vp: o.vp.border }));
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(900);
    check('Wieder im Bild: Chart zeichnet NEAR', /^\d+ \/ \d+ Kerzen/.test(await txt(page, '#chart-caption')) && await txt(page, '#chart-caption') !== cap0, await txt(page, '#chart-caption'));
    await clearToasts(page);
    await page.click('[data-overlay="ema200"]', { force: true }); await page.waitForTimeout(400);
    let tt = await toastText(page), st = await ls(page, 'scalpdesk.overlays.v1'); o = await ovState(page);
    check('Klick: nur der Grund als Hinweis, Schalter und gespeicherter Wunsch unverändert', new RegExp(`EMA 200 braucht 200 Kerzen – dieser Chart hat erst ${have}`).test(tt) && o.ema200.pressed === 'true' && st?.ema200 !== false, tt.slice(0, 100));
    await clearToasts(page);
    await page.focus('[data-overlay="bb"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(250); await page.keyboard.press('Space'); await page.waitForTimeout(400);
    tt = await toastText(page); st = await ls(page, 'scalpdesk.overlays.v1'); o = await ovState(page);
    check('Tastatur (Enter, Leertaste): ebenfalls blockiert, Grund angesagt', /Bollinger braucht 20 Kerzen/.test(tt) && o.bb.pressed === 'true' && st?.bb !== false, tt.slice(0, 100));
    // Wunsch „aus“ bleibt ebenso erhalten: auf einem Coin mit genug Kerzen ausschalten, dann gesperrt und zurück
    await load(page, 'XRP'); o = await ovState(page);
    check('Genug Kerzen: automatisch frei, Anzeige ohne Bedarf, Ebene gezeichnet', ['ema200', 'bb', 'div', 'ew'].every(k => o[k].dis === 'false' && !o[k].na && o[k].need === '') && o.ema200.pressed === 'true' && await page.evaluate(() => !!document.querySelector('#chart svg path[stroke-width="1.7"]')), JSON.stringify(Object.fromEntries(['ema200', 'bb', 'div', 'ew'].map(k => [k, o[k].dis]))));
    await page.click('[data-overlay="bb"]'); await page.waitForTimeout(300);
    await load(page, 'NEAR'); o = await ovState(page);
    check('Ausgeschaltet und gesperrt: bleibt aus (nicht gedrückt), gesperrt', o.bb.pressed === 'false' && o.bb.dis === 'true', JSON.stringify(o.bb));
    await load(page, 'XRP'); o = await ovState(page);
    check('Wieder frei: Wunsch „aus“ erhalten', o.bb.pressed === 'false' && o.bb.dis === 'false', JSON.stringify(o.bb));
    await page.click('[data-overlay="bb"]'); await page.waitForTimeout(200);
    // Beim Coinwechsel kein Aufblinken: während XRP → BTC lädt, wird nichts gesperrt
    await page.evaluate(() => { window.__lk = 0; window.__lon = true; const f = () => { if (document.querySelector('[data-overlay="ema200"]').getAttribute('aria-disabled') === 'true') window.__lk++; if (window.__lon) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    await load(page, 'BTC'); const lk = await page.evaluate(() => { window.__lon = false; return window.__lk; });
    check('Coinwechsel zwischen zwei Coins mit genug Kerzen: Schalter blinken nicht gesperrt auf', lk === 0, `gesperrte Frames: ${lk}`);
    check('keine Fehler (Ebenen)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  // ================= 24h-Tief / 24h-Hoch =================
  async h24(browser) {
    await h.ctl('/t24?mode=ok'); await h.ctl('/restdelay?ms=0');
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.watchlist.v1': ['BTC', 'ETH', 'BSV', 'ETC', 'LTC', 'XRP', 'BCH', 'NEAR'], 'scalpdesk.watchclean.v1': 1 });
    await until(() => page.evaluate(() => [...document.querySelectorAll('#watchlist .wl-price')].filter(p => /\d/.test(p.textContent)).length >= 7), 30000);
    const row = () => txt(page, '#wl-detail .wl-d-24v');
    const rowFor = async (re, ms = 15000) => until(async () => { const t = await row(); return re.test(t) ? t : null; }, ms);
    const api = (host, path) => page.evaluate(async u => (await fetch(u)).json(), `https://${host}${path}`);
    let t0 = Date.now();
    await jsClick(page, '#watchlist .wl-tile[data-watch="BTC"]');
    let r = await rowFor(/^Tief [\d.,]+ · Hoch [\d.,]+ · Spot$/);
    let a = await api('data-api.binance.vision', '/api/v3/ticker/24hr?symbol=BTCUSDT'), m = r?.match(/Tief ([\d.,]+) · Hoch ([\d.,]+)/) || [];
    check('BTC (Spot): Zeile „24h  Tief … · Hoch … · Spot“ mit den Werten der 24h-Statistik', r && Math.abs(num(m[1]) / +a.lowPrice - 1) < 0.003 && Math.abs(num(m[2]) / +a.highPrice - 1) < 0.003 && num(m[1]) <= num(m[2]), `${r} · API ${a.lowPrice}/${a.highPrice}`);
    let log = await h.ctl(`/log?since=${t0}`);
    check('Abruf über /api/v3/ticker/24hr (Spot), nicht über die Futures', log.some(e => e.path === '/api/v3/ticker/24hr' && e.q.symbol === 'BTCUSDT') && !log.some(e => e.path === '/fapi/v1/ticker/24hr' && e.q.symbol === 'BTCUSDT'), JSON.stringify(log.filter(e => /24hr/.test(e.path)).map(e => e.host + e.path)));
    const tip = await page.evaluate(() => document.querySelector('#wl-detail .wl-d-24h').title);
    check('Erklärung: rollierend, unabhängig vom Chart', /letzten 24 Stunden \(rollierend, Spot\)/.test(tip) && /unabhängig vom Chart/.test(tip), tip);
    // unabhängig vom Chart-Intervall, aus dem Zwischenspeicher
    t0 = Date.now(); await page.click('.chart-toolbar [data-interval="1h"]'); await page.waitForTimeout(1500);
    check('Chart-Intervall gewechselt: Zeile unverändert, kein neuer Abruf (60 s Zwischenspeicher)', await row() === r && !(await h.ctl(`/log?since=${t0}`)).some(e => /ticker\/24hr/.test(e.path)), await row());
    await page.click('.chart-toolbar [data-interval="1m"]');
    // Futures-Kachel (BSV hat kein Spot-Paar): nur der Futures-Weg
    t0 = Date.now(); await jsClick(page, '#watchlist .wl-tile[data-watch="BSV"]');
    r = await rowFor(/· Futures$/); a = await api('fapi.binance.com', '/fapi/v1/ticker/24hr?symbol=BSVUSDT'); m = r?.match(/Tief ([\d.,]+) · Hoch ([\d.,]+)/) || [];
    log = await h.ctl(`/log?since=${t0}`);
    check('BSV (nur Futures): „· Futures“ mit den Futures-Werten', r && Math.abs(num(m[1]) / +a.lowPrice - 1) < 0.003 && Math.abs(num(m[2]) / +a.highPrice - 1) < 0.003, `${r} · API ${a.lowPrice}/${a.highPrice}`);
    check('… abgerufen über /fapi/v1/ticker/24hr, kein Spot-Ersatz', log.some(e => e.path === '/fapi/v1/ticker/24hr' && e.q.symbol === 'BSVUSDT') && !log.some(e => e.path === '/api/v3/ticker/24hr' && e.q.symbol === 'BSVUSDT'), JSON.stringify(log.filter(e => /24hr/.test(e.path)).map(e => `${e.host}${e.path}?${e.q.symbol}`)));
    // überholte Antwort: LTC antippen, gleich darauf XRP – angezeigt wird XRP
    await h.ctl('/restdelay?ms=1500');
    await jsClick(page, '#watchlist .wl-tile[data-watch="LTC"]'); await page.waitForTimeout(150); await jsClick(page, '#watchlist .wl-tile[data-watch="XRP"]');
    check('Während des Ladens: Platzhalter statt alter Werte', /wird geladen/.test(await row()), await row());
    r = await rowFor(/^Tief [\d.,]+ · Hoch/, 20000); await h.ctl('/restdelay?ms=0'); await page.waitForTimeout(2000); // LTC-Antwort kommt erst danach
    a = await api('data-api.binance.vision', '/api/v3/ticker/24hr?symbol=XRPUSDT'); r = await row(); m = r?.match(/Tief ([\d.,]+) · Hoch ([\d.,]+)/) || [];
    check('Schneller Kachelwechsel: die Zeile zeigt den zuletzt gewählten Coin (XRP), nicht die spätere Antwort für LTC', await txt(page, '#wl-detail .wl-d-title') === 'XRP' && Math.abs(num(m[2]) / +a.highPrice - 1) < 0.003, `${r} · XRP ${a.lowPrice}/${a.highPrice}`);
    // Prüfung der Antwort
    for (const [mode, coin, re, name] of [['fail', 'ETC', /^nicht verfügbar – Binance antwortet mit Fehler/, 'Server-Fehler'], ['bad', 'ETH', /^nicht verfügbar – Unplausible 24h-Werte erhalten\.$/, 'Hoch unter Tief'],
      ['stale', 'BCH', /^nicht verfügbar – Die 24h-Statistik ist veraltet \(Stand \d\d:\d\d\)\.$/, 'veraltete Statistik'], ['wrong', 'NEAR', /^nicht verfügbar – Binance lieferte die 24h-Statistik eines anderen Paars\.$/, 'anderes Paar']]) {
      await h.ctl(`/t24?mode=${mode}`); await jsClick(page, `#watchlist .wl-tile[data-watch="${coin}"]`);
      r = await rowFor(re, 12000); check(`Ungültige Antwort (${name}): keine Werte, Grund genannt`, !!r, await row());
    }
    await h.ctl('/t24?mode=ok');
    check('keine Fehler (24h)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  // ================= Kryptowährungsfeld =================
  async coin(browser) {
    await h.ctl('/restdelay?ms=0'); await h.ctl('/restfail?on=0');
    const { ctx, page, errors } = await openPage(browser);
    const val = () => page.evaluate(() => document.getElementById('symbol').value);
    const focused = () => page.evaluate(() => document.activeElement?.id === 'symbol');
    const notice = () => page.evaluate(() => { const n = document.getElementById('market-error'); return n.hidden ? '' : n.textContent; });
    await page.click('#symbol'); await page.waitForTimeout(200);
    const sel = await page.evaluate(() => { const f = document.getElementById('symbol'); return [f.selectionStart, f.selectionEnd, f.value]; });
    check('Antippen markiert den ganzen Inhalt', sel[0] === 0 && sel[1] === 3 && sel[2] === 'BTC', JSON.stringify(sel));
    await page.keyboard.type('ETH');
    check('Tippen ersetzt den Inhalt', await val() === 'ETH', await val());
    await page.keyboard.press('Enter'); await until(async () => await sym(page) === 'ETH', 15000); await page.waitForTimeout(800);
    check('Bestätigt: ETH geladen, das Feld gibt den Fokus ab (Tastatur zu)', await sym(page) === 'ETH' && !(await focused()), String(await focused()));
    // bewusst leer
    await page.click('#symbol'); await page.keyboard.press('Backspace'); await page.waitForTimeout(600);
    check('Leer gelassen (Fokus im Feld): bleibt leer, kein Marktwechsel', await val() === '' && await sym(page) === 'ETH', `"${await val()}"`);
    await page.keyboard.press('Enter'); await page.waitForTimeout(800);
    check('Leer bestätigt: kein Marktwechsel, kein Fehler, ETH wieder im Feld', await sym(page) === 'ETH' && await val() === 'ETH' && !(await notice()), `${await val()} · ${await notice()}`);
    // Esc
    await page.click('#symbol'); await page.keyboard.type('XRP'); await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
    check('Esc: Eingabe verworfen, ETH bleibt (Feld und Chart)', await val() === 'ETH' && await sym(page) === 'ETH' && !(await focused()), `${await val()} · ${await sym(page)}`);
    // leeres Feld verlassen
    await page.click('#symbol'); await page.keyboard.press('Backspace'); await page.click('#pair-label'); await page.waitForTimeout(500);
    check('Leeres Feld verlassen: ETH wieder im Feld, kein Marktwechsel', await val() === 'ETH' && await sym(page) === 'ETH', `"${await val()}"`);
    // Text eingegeben, aber nicht bestätigt
    await page.click('#symbol'); await page.keyboard.type('LTC'); await page.click('#pair-label'); await page.waitForTimeout(1500);
    check('Eingabe ohne Bestätigung verlassen: kein Marktwechsel', await sym(page) === 'ETH', await sym(page));
    // unbekannt
    await page.fill('#symbol', 'FOOBAR'); await page.press('#symbol', 'Enter');
    const nf = await until(async () => { const n = await notice(); return /FOOBAR/.test(n) ? n : null; }, 10000);
    check('Unbekannter Coin: ETH bleibt geladen, Hinweis „weder als Spot- noch als Futures-Paar“', /^FOOBAR gibt es bei Binance weder als Spot- noch als Futures-Paar gegen USDT – ETH bleibt geladen\.$/.test(nf || '') && await sym(page) === 'ETH', nf);
    await page.waitForTimeout(2500);
    check('… Chart und Kurs unverändert, Hinweis bleibt stehen (nicht vom nächsten Neuzeichnen gelöscht)', await sym(page) === 'ETH' && /^\d/.test(await txt(page, '#price')) && /FOOBAR/.test(await notice()), `${await txt(page, '#price')} · ${await notice()}`);
    await page.fill('#symbol', 'B$'); await page.press('#symbol', 'Enter'); await page.waitForTimeout(400);
    check('Ungültige Zeichen: Hinweis, ETH bleibt', /gültiges Kürzel.*ETH bleibt geladen/.test(await notice()) && await sym(page) === 'ETH', await notice());
    // nicht prüfbar (Binance-REST gestört): kein Wechsel ins Ungewisse
    await h.ctl('/restfail?on=1'); await page.fill('#symbol', 'SOL'); await page.press('#symbol', 'Enter');
    const nc = await until(async () => { const n = await notice(); return /SOL ließ sich nicht prüfen/.test(n) ? n : null; }, 15000); await h.ctl('/restfail?on=0');
    check('Prüfung nicht möglich: Hinweis, ETH bleibt geladen', !!nc && /ETH bleibt geladen/.test(nc) && await sym(page) === 'ETH', nc || await notice());
    await load(page, 'BSV');
    check('Nur als Futures vorhanden (BSV): wird geladen', await sym(page) === 'BSV' && await txt(page, '#market-badge') === 'FUTURES' && !(await notice()), `${await sym(page)} ${await txt(page, '#market-badge')}`);
    // überholte Prüfung: SOL (wird geprüft, langsam), gleich danach XRP (bekannt) – es bleibt XRP
    await h.ctl('/restdelay?ms=900');
    await page.fill('#symbol', 'SOL'); await page.press('#symbol', 'Enter'); await page.waitForTimeout(100); await page.fill('#symbol', 'XRP'); await page.press('#symbol', 'Enter');
    await page.waitForTimeout(4000); await h.ctl('/restdelay?ms=0');
    check('Zwei schnelle Eingaben: die letzte gilt (XRP), die spätere Antwort der ersten Prüfung wechselt nicht', await sym(page) === 'XRP', await sym(page));
    check('keine Fehler (Kryptowährungsfeld)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  // ================= Schriftgröße am Touch-Gerät =================
  async font(browser) {
    const { ctx, page, errors } = await openPage(browser, {}, { viewport: { width: 390, height: 844 }, mobile: true });
    const r = await page.evaluate(() => {
      const f = [...document.querySelectorAll('input, select, textarea')].filter(e => !/^(checkbox|radio|range|hidden|file|color)$/i.test(e.type));
      const small = f.filter(e => parseFloat(getComputedStyle(e).fontSize) < 16).map(e => `${e.tagName}#${e.id || e.className}:${getComputedStyle(e).fontSize}`);
      // verkleinernde Transformation an einem Vorfahren
      const shrink = []; for (const e of f) for (let p = e.parentElement; p; p = p.parentElement) { const t = getComputedStyle(p).transform; if (t && t !== 'none') { const m = new DOMMatrix(t); if (Math.hypot(m.a, m.b) < 0.999 || Math.hypot(m.c, m.d) < 0.999) { shrink.push(e.id || e.tagName); break; } } }
      return { n: f.length, small, shrink, vp: document.querySelector('meta[name=viewport]').content, layout: document.documentElement.dataset.layout };
    });
    check(`Touch-Gerät: alle ${r.n} Eingabefelder, Auswahllisten und Textfelder mindestens 16 px (kein Fokus-Zoom in Safari)`, r.n > 60 && !r.small.length && r.layout === 'tablet', JSON.stringify(r.small));
    check('Keine verkleinernde Transformation über einem Feld', !r.shrink.length, JSON.stringify(r.shrink));
    check('Fingerzoom bleibt erlaubt (kein user-scalable=no, kein maximum-scale)', !/user-scalable\s*=\s*no|maximum-scale/i.test(r.vp), r.vp);
    const d = await openPage(browser, {}, { viewport: { width: 1500, height: 1000 } });
    const dk = await d.page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('symbol')).fontSize));
    check('Computer (Maus): bisherige Schriftgröße bleibt', dk < 16, String(dk));
    check('keine Fehler (Schrift)', !real(errors).length && !real(d.errors).length, [...real(errors), ...real(d.errors)].join(' | ')); await ctx.close(); await d.ctx.close();
  },

  // ================= Chart-Zoom: Standardansicht =================
  async zoom(browser) {
    const { ctx, page, errors } = await openPage(browser);
    const cnt = async () => { const c = await txt(page, '#chart-caption'); const m = c.match(/^(\d+) \/ \d+ Kerzen/) || c.match(/^Kerzen (\d+)–(\d+) von/); return m ? (m[2] ? +m[2] - +m[1] + 1 : +m[1]) : -1; };
    const rs = () => page.evaluate(() => document.getElementById('zoom-reset').hidden);
    check('Start: Standardansicht mit 80 Kerzen, Knopf ⟲ verborgen', await cnt() === 80 && await rs(), await txt(page, '#chart-caption'));
    await page.click('#zoom-in'); await page.click('#zoom-in'); await page.waitForTimeout(300);
    const z = await cnt();
    check('Hineingezoomt: weniger Kerzen, Knopf ⟲ „Standardansicht“ erscheint', z < 60 && !(await rs()) && await page.getAttribute('#zoom-reset', 'aria-label') === 'Standardansicht: 80 Kerzen bis zur aktuellen Kerze', `${z}`);
    await page.click('#zoom-reset'); await page.waitForTimeout(300);
    check('⟲: zurück auf 80 Kerzen bis jetzt, Knopf wieder verborgen', await cnt() === 80 && await rs() && /^\d+ \/ \d+ Kerzen/.test(await txt(page, '#chart-caption')), await txt(page, '#chart-caption'));
    await page.click('#zoom-in'); await page.click('#pan-back'); await page.waitForTimeout(300);
    await page.click('.chart-toolbar [data-interval="5m"]'); await page.waitForTimeout(1500);
    const iv = await cnt();
    check('Intervallwechsel: Zoom bleibt (nur der Coinwechsel setzt zurück)', iv === 56, `${iv} · ${await txt(page, '#chart-caption')}`);
    await load(page, 'ETH');
    check('Coinwechsel: neuer Coin in der Standardansicht (80 Kerzen, aktuelle Kerze)', await cnt() === 80 && await rs() && await page.evaluate(() => document.getElementById('pan-now').hidden), await txt(page, '#chart-caption'));
    await page.click('.chart-toolbar [data-interval="1m"]'); await page.waitForTimeout(800);
    // iPad/Handy: Bereichswechsel behält den Zoom
    const p = await openPage(browser, {}, { viewport: { width: 390, height: 844 }, mobile: true });
    const pc = async () => +((await txt(p.page, '#chart-caption')).match(/^(\d+) \//)?.[1] || -1);
    await p.page.tap('#zoom-in'); await p.page.waitForTimeout(300); const before = await pc();
    await p.page.tap('#tabbar [data-tab="pos"]'); await p.page.waitForTimeout(400); await p.page.tap('#tabbar [data-tab="chart"]'); await p.page.waitForTimeout(800);
    check('Handy: Wechsel über die untere Leiste behält den Chart-Zoom', before === 56 && await pc() === 56, `${before} → ${await pc()}`);
    check('keine Fehler (Zoom)', !real(errors).length && !real(p.errors).length, [...real(errors), ...real(p.errors)].join(' | ')); await ctx.close(); await p.ctx.close();
  },

  // ================= Untere Leiste =================
  async bar(browser) {
    const { ctx, page, errors } = await openPage(browser, {}, { viewport: { width: 390, height: 844 }, mobile: true });
    await page.evaluate(() => { document.getElementById('tabbar').__mark = 53; });
    const geo = await page.evaluate(() => { const tb = document.getElementById('tabbar'), d = document.querySelector('.dash'); return { pad: parseFloat(getComputedStyle(d).paddingBottom), h: tb.offsetHeight, bottom: Math.round(tb.getBoundingClientRect().bottom), vh: innerHeight }; });
    check('Feste Platzreserve unten (Inhalt endet über der Leiste), Leiste fest am unteren Rand', geo.pad >= geo.h && Math.abs(geo.bottom - geo.vh) <= 1, JSON.stringify(geo));
    await until(() => page.evaluate(() => [...document.querySelectorAll('#watchlist .wl-price')].some(p => /\d/.test(p.textContent))), 20000);
    // Auswahlliste (am iPad ein Popover): keine Leiste weg, auch nicht kurz
    await page.tap('#watchlist .wl-tile[data-watch="LTC"]'); await page.waitForTimeout(900);
    await barWatch(page); await page.focus('#wl-detail select'); await page.waitForTimeout(1000); await page.evaluate(() => document.activeElement.blur()); await page.waitForTimeout(300);
    let hid = await barStop(page);
    check('Auswahlliste antippen: Leiste bleibt (kein Vorab-Ausblenden)', hid === 0, `unsichtbare Frames: ${hid}`);
    // Coinwechsel über eine Kachel
    await barWatch(page); await page.tap('#watchlist .wl-tile[data-watch="ETC"]'); await until(async () => await sym(page) === 'ETC', 15000); await page.waitForTimeout(1500);
    hid = await barStop(page);
    check('Coinwechsel per Kachel: Leiste kein einziges Frame ausgeblendet, derselbe DOM-Knoten', hid === 0 && await page.evaluate(() => document.getElementById('tabbar').__mark === 53), `unsichtbare Frames: ${hid}`);
    // Hardware-Tastatur (sichtbarer Bereich bleibt groß): erstes Antippen erkennt sie, danach kein Ausblenden mehr
    await page.tap('#symbol'); await page.waitForTimeout(1000); const shown1 = await page.evaluate(() => getComputedStyle(document.getElementById('tabbar')).visibility === 'visible' && !document.documentElement.dataset.kbd);
    await page.evaluate(() => document.activeElement.blur()); await page.waitForTimeout(400);
    await barWatch(page); await page.tap('#symbol'); await page.waitForTimeout(300); await page.keyboard.type('XRP'); await page.keyboard.press('Enter');
    await until(async () => await sym(page) === 'XRP', 15000); await page.waitForTimeout(1500); hid = await barStop(page);
    check('Hardware-Tastatur: nach dem ersten Feld bleibt die Leiste – auch beim Coinwechsel über das Feld', shown1 && hid === 0 && await page.evaluate(() => document.getElementById('tabbar').__mark === 53), `erstes Feld sichtbar: ${shown1}, unsichtbare Frames danach: ${hid}`);
    // Vollbild darf sie ausblenden
    await page.tap('#chart-full'); await page.waitForTimeout(700);
    const full = await page.evaluate(() => getComputedStyle(document.getElementById('tabbar')).display);
    await page.evaluate(() => document.getElementById('chart-full').click()); await page.waitForTimeout(700);
    check('Vollbild-Chart blendet die Leiste aus, danach ist sie wieder da (derselbe Knoten)', full === 'none' && await page.evaluate(() => getComputedStyle(document.getElementById('tabbar')).display !== 'none' && document.getElementById('tabbar').__mark === 53), full);
    check('keine Fehler (Leiste)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  // ================= Frischegrenze der Kurse =================
  async fresh(browser) {
    await h.ctl('/silent?on=0'); await h.ctl('/tick'); await h.ctl('/restfail?on=0'); await h.ctl('/walk?on=1');
    const P = (await h.ctl('/state')).price;
    const seed = {
      'scalpdesk.positions.v1': [position('PB', 'BTCUSDT', +(P.BTCUSDT - 10000).toFixed(2), 0.01), position('PE', 'ETHUSDT', +(P.ETHUSDT + 90).toFixed(2), 1, { source: 'futures' }), position('PS', 'BSVUSDT', P.BSVUSDT, 1, { source: 'futures' })],
      'scalpdesk.pnlalarm.v1': { profit: { on: true, value: 50, state: 'armed', at: NOW }, loss: { on: false, value: null, state: 'armed', at: 0 }, u: NOW },
    };
    const { ctx, page, errors } = await openPage(browser, seed);
    const C = id => `.pos-card[data-id="${id}"]`, at = id => txt(page, `${C(id)} [data-f="price-at"]`);
    await until(async () => (await Promise.all(['PB', 'PE', 'PS'].map(at))).every(t => /^Live /.test(t)), 20000);
    const tot = async () => num((await txt(page, '#open-total')).replace(' USDT', '').replace('+', ''));
    check('Alle Kurse aktuell: „Live hh:mm:ss“, vollständige Summe („Offen, nicht realisiert“)', await txt(page, '#open-total-label') === 'Offen, nicht realisiert' && Math.abs(await tot() - 10) < 40 && await txt(page, '#lb-open-label') === 'Offen', `${await txt(page, '#open-total')} · ${await at('PB')}`);
    check('G/V-Alarm „Gewinn ≥ 50“ nicht ausgelöst (Gesamt ≈ +10)', (await ls(page, 'scalpdesk.pnlalarm.v1')).profit.state === 'armed');
    // Stream still, ETH-Abruf scheitert, BSV-Abruf gelingt mit altem Zeitstempel (5 min)
    const t0 = Date.now();
    await h.ctl('/silent?on=1'); await h.ctl('/tick?fail=ETHUSDT&old=BSVUSDT:300000');
    const ok = await until(async () => /veraltet/.test(await at('PE')) && /veraltet/.test(await at('PS')) && /^Kurszeit /.test(await at('PB')), 70000, 500);
    const tE = await at('PE'), tS = await at('PS'), tB = await at('PB');
    check(`Ohne Stream: BTC per Abruf aktuell („Kurszeit …“), ETH (Abruf scheitert) „veraltet“ (nach ${Math.round((Date.now() - t0) / 1000)} s)`, !!ok && !/veraltet/.test(tB) && /^Kurszeit \d\d:\d\d:\d\d · veraltet$/.test(tE), `${tB} · ${tE}`);
    // Uhrzeiten der Seite (Europe/Berlin) untereinander vergleichen: BSV-Kurszeit etwa 5 min vor der BTC-Kurszeit (beide per Abruf)
    const secs = t => { const m = t.match(/(\d\d):(\d\d):(\d\d)/); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : NaN; }, ago = ((secs(tB) - secs(tS)) % 86400 + 86400) % 86400;
    check('Erfolgreiche Antwort mit altem Zeitstempel (BSV): Kurszeit der Quelle (vor 5 min), „veraltet“ – nicht die Zeit des Abrufs', /· veraltet$/.test(tS) && Math.abs(ago - 300) < 25, `${tS} vs BTC ${tB} (${ago} s davor)`);
    const pb = num((await txt(page, `${C('PB')} [data-f="pnl"]`)).replace(' USDT', '').replace('+', ''));
    check('Gesamtsumme heißt „Offen – Teilsumme“ und enthält nur die aktuellen Kurse (BTC)', await txt(page, '#open-total-label') === 'Offen – Teilsumme' && Math.abs(await tot() - pb) < 0.02, `${await txt(page, '#open-total')} vs BTC ${pb}`);
    check('… mit den fehlenden Coins und Grund', /ohne ETH \(Kurs veraltet\), BSV \(Kurs veraltet\)/.test(await txt(page, '#open-total-eur')), await txt(page, '#open-total-eur'));
    check('Live-Leiste: „Teilsumme“ und ⚠ vor dem Betrag', await txt(page, '#lb-open-label') === 'Teilsumme' && /^⚠ [+−]/.test(await txt(page, '#lb-open')), `${await txt(page, '#lb-open-label')} ${await txt(page, '#lb-open')}`);
    check('Veraltete Karten gedimmt', await page.evaluate(() => document.querySelector('.pos-card[data-id="PE"]').classList.contains('stale') && !document.querySelector('.pos-card[data-id="PB"]').classList.contains('stale')));
    await page.waitForTimeout(1500);
    check('G/V-Alarm prüft keine Teilsumme: BTC allein ≈ +100 ≥ 50, trotzdem nicht ausgelöst', (await ls(page, 'scalpdesk.pnlalarm.v1')).profit.state === 'armed' && !/Gewinn-Alarm/.test(await toastText(page)), (await ls(page, 'scalpdesk.pnlalarm.v1')).profit.state);
    // Kurs-Alarm auf veraltetem Kurs: wird gespeichert, löst aber nicht aus
    await jsClick(page, '#alarm-toggle'); await page.waitForTimeout(200);
    await page.fill('#al-symbol', 'ETH'); await page.fill('#al-price', '99999'); await jsClick(page, '[data-al-dir="below"]'); await jsClick(page, '#al-save');
    await until(async () => ((await ls(page, 'scalpdesk.alarms.v1')) || []).some(a => a.symbol === 'ETHUSDT'), 15000); await page.waitForTimeout(2500);
    let al = ((await ls(page, 'scalpdesk.alarms.v1')) || []).find(a => a.symbol === 'ETHUSDT');
    check('Kurs-Alarm ETH „fällt auf/unter 99.999“ bei veraltetem Kurs: gespeichert, nicht ausgelöst', !!al && !al.triggeredAt, JSON.stringify(al));
    // manueller Abschluss trotz veraltetem Kurs
    await jsClick(page, `${C('PS')} [data-action="realize"]`); await page.waitForTimeout(150);
    await page.evaluate(sel => { for (const [k, v] of [['qty', '1'], ['exit', '33']]) { const i = document.querySelector(`${sel} [data-input="${k}"]`); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); } }, C('PS'));
    await page.waitForTimeout(300); await jsClick(page, `${C('PS')} [data-action="save-realize"]`); await page.waitForTimeout(600);
    const hist = (await ls(page, 'scalpdesk.history.v1')) || [];
    check('Echter Trade trotz veraltetem Kurs erfassbar (BSV zu 33 geschlossen)', hist.some(t => t.symbol === 'BSVUSDT' && t.exit === 33) && !(await page.$(C('PS'))), JSON.stringify(hist.map(t => [t.symbol, t.exit])));
    // ETH wieder erreichbar: Alarm löst jetzt aus, Summe vollständig
    await h.ctl('/tick');
    const back = await until(async () => !/veraltet/.test(await at('PE')) && await txt(page, '#open-total-label') === 'Offen, nicht realisiert', 70000, 500);
    al = ((await ls(page, 'scalpdesk.alarms.v1')) || []).find(a => a.symbol === 'ETHUSDT');
    check('Kurs wieder aktuell: Summe vollständig, der Kurs-Alarm löst jetzt aus', !!back && !!al?.triggeredAt, `${await at('PE')} · ${JSON.stringify(al)}`);
    check('G/V-Alarm weiterhin nicht ausgelöst (vollständige Summe < 50)', (await ls(page, 'scalpdesk.pnlalarm.v1')).profit.state === 'armed');
    // ohne Fehler, nur gealtert: pausiert → nach 60 s veraltet, keine Summe
    await jsClick(page, '#pause'); const tp = Date.now();
    const aged = await until(async () => /veraltet/.test(await at('PB')) && /veraltet/.test(await at('PE')), 80000, 1000);
    check(`Pausiert: nach der Frischegrenze (60 s) alle Kurse „veraltet“ (nach ${Math.round((Date.now() - tp) / 1000)} s)`, !!aged && Date.now() - tp >= 45e3, `${await at('PB')}`);
    check('… keine Summe mehr („—“, „kein aktueller Kurs“), Live-Leiste „—“', await txt(page, '#open-total') === '—' && /^kein aktueller Kurs/.test(await txt(page, '#open-total-eur')) && await txt(page, '#lb-open') === '—', `${await txt(page, '#open-total')} · ${await txt(page, '#open-total-eur')} · ${await txt(page, '#lb-open')}`);
    await jsClick(page, '#pause'); await h.ctl('/silent?on=0');
    const rec = await until(async () => /^Live /.test(await at('PB')) && await txt(page, '#open-total-label') === 'Offen, nicht realisiert', 40000, 500);
    check('Fortgesetzt: wieder live und vollständig', !!rec, await at('PB'));
    check('keine Fehler (Frische)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  // ================= Vorauswahl umsortieren =================
  async sort(browser) {
    await h.ctl('/silent?on=0'); await h.ctl('/tick');
    const { ctx, page, errors } = await openPage(browser);
    await until(() => page.evaluate(() => [...document.querySelectorAll('#watchlist .wl-price')].filter(p => /\d/.test(p.textContent)).length >= 5), 30000);
    const T = c => `#watchlist .wl-tile[data-watch="${c}"]`;
    check('Start: Standard-Reihenfolge', await order(page) === 'BTC,ETC,BCH,LTC,XRP,NEAR', await order(page));
    await page.evaluate(() => document.querySelectorAll('#watchlist .wl-item').forEach(i => { i.__m = i.querySelector('.wl-tile').dataset.watch; }));
    const p0 = await page.evaluate(() => [...document.querySelectorAll('#watchlist .wl-price')].map(p => p.textContent).join()); await page.waitForTimeout(3500);
    const live = await page.evaluate(p0 => ({ same: [...document.querySelectorAll('#watchlist .wl-item')].every(i => i.__m === i.querySelector('.wl-tile').dataset.watch), changed: [...document.querySelectorAll('#watchlist .wl-price')].map(p => p.textContent).join() !== p0 }), p0);
    check('Live-Kurse ändern sich, ohne das Raster neu zu bauen (dieselben Kacheln)', live.same && live.changed, JSON.stringify(live));
    // Maus: lang drücken und ziehen
    const drag = async (from, to, { hold = 600, steps = 12, esc = false, resize = false } = {}) => {
      // Nach dem Detailfeld kann noch sanftes Nachscrollen laufen. Erst die echte
      // Kachel erreichbar/stabil anfahren, dann die Koordinaten für die Geste lesen.
      await page.locator(T(from)).hover();
      const a = await center(page, T(from)), b = await center(page, T(to));
      const hit = await page.evaluate(a => ({ target: document.elementFromPoint(a.x,a.y)?.outerHTML.slice(0,180), scroll: scrollY }), a);
      await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.waitForTimeout(hold);
      for (let i = 1; i <= steps; i++) { await page.mouse.move(a.x + (b.x - a.x) * i / steps, a.y + (b.y - a.y) * i / steps); await page.waitForTimeout(30); }
      const mid = await page.evaluate(() => ({ ghost: !!document.querySelector('.wl-ghost'), ph: !!document.querySelector('#watchlist .wl-ph'), drag: document.documentElement.dataset.wldrag || '' }));
      if (esc) Object.assign(mid, {from, to, a, b, hit});
      if (esc) await page.keyboard.press('Escape');
      if (resize) { await page.setViewportSize({ width: 1300, height: 1000 }); await page.waitForTimeout(300); }
      await page.mouse.up(); await page.waitForTimeout(500); return mid;
    };
    let mid = await drag('ETC', 'XRP');
    let st = await page.evaluate(() => ({ ghost: !!document.querySelector('.wl-ghost'), ph: !!document.querySelector('#watchlist .wl-ph'), open: !!document.querySelector('#watchlist .wl-tile[aria-expanded="true"]'), same: [...document.querySelectorAll('#watchlist .wl-item')].every(i => i.__m === i.querySelector('.wl-tile').dataset.watch) }));
    check('Lang drücken (Maus): Kachel angehoben, Platzhalter sichtbar', mid.ghost && mid.ph && mid.drag === 'hold', JSON.stringify(mid));
    check('Ziehen auf XRP: ETC steht danach hinter XRP, gespeichert', await order(page) === 'BTC,BCH,LTC,XRP,ETC,NEAR' && (await ls(page, 'scalpdesk.watchlist.v1')).join() === 'BTC,BCH,LTC,XRP,ETC,NEAR', await order(page));
    check('Nach dem Ziehen: kein zusätzlicher Tipp (Detailfeld zu, Chart weiter BTC), Kacheln verschoben statt neu gebaut', !st.ghost && !st.ph && !st.open && await sym(page) === 'BTC' && st.same, JSON.stringify(st));
    await page.click(T('LTC')); await page.waitForTimeout(800);
    check('Kurzer Klick öffnet wie bisher das Detailfeld und lädt den Coin', await page.getAttribute(T('LTC'), 'aria-expanded') === 'true' && await sym(page) === 'LTC');
    await page.click(T('LTC')); await page.waitForTimeout(400);
    // vor dem Anheben bewegt: kein Ziehen
    const a = await center(page, T('BTC')); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x, a.y + 30, { steps: 3 }); await page.waitForTimeout(650);
    const early = await page.evaluate(() => !!document.querySelector('.wl-ghost')); await page.mouse.up(); await page.waitForTimeout(300);
    check('Bewegung über 8 px vor 450 ms: kein Anheben (Scrollen), Reihenfolge gleich', !early && await order(page) === 'BTC,BCH,LTC,XRP,ETC,NEAR', String(early));
    await page.evaluate(() => { const t = document.querySelector('#watchlist .wl-tile[aria-expanded="true"]'); if (t) t.click(); });
    // Abbruch mit Esc und durch Größenänderung
    const s0 = await sym(page); mid = await drag('BCH', 'NEAR', { esc: true });
    const escAfter = await page.evaluate(() => ({ ghost: !!document.querySelector('.wl-ghost'), ph: !!document.querySelector('#watchlist .wl-ph'), open: document.querySelector('#watchlist .wl-tile[aria-expanded="true"]')?.dataset.watch || null, drag: document.documentElement.dataset.wldrag || '', scroll: scrollY }));
    check('Esc während des Ziehens: alte Reihenfolge, nichts angehoben, kein Tipp', mid.ghost && await order(page) === 'BTC,BCH,LTC,XRP,ETC,NEAR' && !(await page.$('.wl-ghost')) && !(await page.$('#watchlist .wl-ph')) && await sym(page) === s0 && !(await page.$('#watchlist .wl-tile[aria-expanded="true"]')), JSON.stringify({ mid, after: escAfter, order: await order(page), before: s0, symbol: await sym(page) }));
    mid = await drag('BCH', 'NEAR', { resize: true });
    check('Breite ändert sich während des Ziehens (Drehen): Abbruch, keine Kachel verloren', mid.ghost && await order(page) === 'BTC,BCH,LTC,XRP,ETC,NEAR' && await page.evaluate(() => document.querySelectorAll('#watchlist .wl-grid > .wl-item').length) === 6 && !(await page.$('.wl-ghost')), await order(page));
    await page.setViewportSize({ width: 1500, height: 1000 }); await page.waitForTimeout(400);
    // Tastatur: Alt + Pfeil auf einer Kachel, zweiter Tab übernimmt ohne Neubau
    const B = await openPage(browser, {}, { ctx });
    await B.page.evaluate(() => document.querySelectorAll('#watchlist .wl-item').forEach(i => { i.__m = i.querySelector('.wl-tile').dataset.watch; }));
    await page.focus(T('BTC')); await page.keyboard.press('Alt+ArrowRight'); await page.waitForTimeout(300);
    check('Alt + Pfeil rechts auf BTC: eine Stelle nach hinten, Fokus bleibt auf BTC, Ansage', await order(page) === 'BCH,BTC,LTC,XRP,ETC,NEAR' && await page.evaluate(() => document.activeElement?.dataset.watch === 'BTC') && /BTC: Platz 2 von 6/.test(await txt(page, '#wl-live')), `${await order(page)} · ${await txt(page, '#wl-live')}`);
    await until(async () => await order(B.page) === 'BCH,BTC,LTC,XRP,ETC,NEAR', 5000);
    check('Zweiter Tab: neue Reihenfolge übernommen, Kacheln verschoben statt neu gebaut', await order(B.page) === 'BCH,BTC,LTC,XRP,ETC,NEAR' && await B.page.evaluate(() => [...document.querySelectorAll('#watchlist .wl-item')].every(i => i.__m === i.querySelector('.wl-tile').dataset.watch)), await order(B.page));
    await B.page.close();
    // Bearbeiten: ◀ ▶ und Griff
    await jsClick(page, '#watchlist [data-watchedit]'); await page.waitForTimeout(300);
    const ed = await page.evaluate(() => { const it = [...document.querySelectorAll('#watchlist .wl-grid > .wl-item')]; return { bars: it.filter(i => i.querySelector('.wl-sort')).length, firstPrev: it[0].querySelector('[data-wlmove="-1"]').disabled, lastNext: it.at(-1).querySelector('[data-wlmove="1"]').disabled, mid: it[2].querySelector('[data-wlmove="1"]').disabled, grip: it[1].querySelector('.wl-grip').getAttribute('aria-label') }; });
    check('Bearbeiten: je Kachel ◀ ⠿ ▶; ganz vorn ◀ und ganz hinten ▶ gesperrt; Griff mit Platzangabe', ed.bars === 6 && ed.firstPrev && ed.lastNext && !ed.mid && ed.grip === 'BTC verschieben, Platz 2 von 6 – ziehen oder Pfeiltasten', JSON.stringify(ed));
    await page.focus('#watchlist [data-wlmove="1"][data-coin="LTC"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    check('▶ bei LTC (Tastatur): eine Stelle nach hinten, Fokus bleibt auf diesem Knopf', await order(page) === 'BCH,BTC,XRP,LTC,ETC,NEAR' && await page.evaluate(() => document.activeElement?.dataset.coin === 'LTC' && document.activeElement?.dataset.wlmove === '1'), await order(page));
    await page.focus('#watchlist .wl-grip[data-coin="NEAR"]'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(300);
    check('Griff + Pfeiltasten: NEAR zwei Stellen nach vorn', await order(page) === 'BCH,BTC,XRP,NEAR,LTC,ETC' && await page.evaluate(() => document.activeElement?.dataset.coin === 'NEAR'), await order(page));
    // Griff mit der Maus: sofort ziehen, ohne langes Drücken
    const g = await center(page, '#watchlist .wl-grip[data-coin="ETC"]'), f = await center(page, T('BCH'));
    await page.mouse.move(g.x, g.y); await page.mouse.down(); for (let i = 1; i <= 10; i++) { await page.mouse.move(g.x + (f.x - g.x) * i / 10, g.y + (f.y - g.y) * i / 10); await page.waitForTimeout(25); } await page.mouse.up(); await page.waitForTimeout(550);
    check('Griff ⠿ ziehen (ohne Halten): ETC ganz nach vorn', await order(page) === 'ETC,BCH,BTC,XRP,NEAR,LTC', await order(page));
    // Erst nach der bestehenden 450-ms-Sperre klicken; Chromium erzeugt beim Griffziehen nicht immer einen Loslass-Klick,
    // der die Sperre vorzeitig aufhebt. Sonst wird dieser echte Klick verschluckt und vier Folgeprüfungen scheitern.
    await page.click('#watchlist [data-unwatch="BTC"]'); await page.waitForTimeout(300);
    check('Entfernen: Rest behält seine Reihenfolge', await order(page) === 'ETC,BCH,XRP,NEAR,LTC', await order(page));
    await jsClick(page, '#watchlist [data-watchedit]'); await page.waitForTimeout(200);
    await load(page, 'SOL'); await jsClick(page, '#watchlist [data-addwatch="SOL"]'); await page.waitForTimeout(300);
    check('Neuzugang am Ende', await order(page) === 'ETC,BCH,XRP,NEAR,LTC,SOL', await order(page));
    await page.reload(); await page.waitForTimeout(2000);
    check('Neu laden: Reihenfolge bleibt', await order(page) === 'ETC,BCH,XRP,NEAR,LTC,SOL', await order(page));
    const bk = await download(page, () => jsClick(page, '#backup-save')), bj = JSON.parse(bk.text);
    check('Sicherung enthält die Reihenfolge (watchlist)', (bj.watchlist || bj.data?.watchlist || []).join() === 'ETC,BCH,XRP,NEAR,LTC,SOL', JSON.stringify(bj.watchlist || bj.data?.watchlist));
    check('keine Fehler (Umsortieren, Maus)', !real(errors).length && !real(B.errors).length, [...real(errors), ...real(B.errors)].join(' | ')); await ctx.close();
    // Touch (Handy): lang drücken und ziehen, Scrollen, Tippen
    const ph = await openPage(browser, {}, { viewport: { width: 390, height: 844 }, mobile: true }), pg = ph.page, cdp = await ph.ctx.newCDPSession(pg);
    await until(() => pg.evaluate(() => [...document.querySelectorAll('#watchlist .wl-price')].filter(p => /\d/.test(p.textContent)).length >= 5), 30000);
    await pg.evaluate(() => document.getElementById('watchlist').scrollIntoView({ block: 'start' })); await pg.waitForTimeout(400);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y]) => ({ x: Math.round(x), y: Math.round(y), id: 1 })) });
    const tdrag = async (from, to, hold) => { const s = await center(pg, T(from)), e = await center(pg, T(to)); await touch('touchStart', [[s.x, s.y]]); await pg.waitForTimeout(hold); for (let i = 1; i <= 10; i++) { await touch('touchMove', [[s.x + (e.x - s.x) * i / 10, s.y + (e.y - s.y) * i / 10]]); await pg.waitForTimeout(30); } const g2 = await pg.evaluate(() => !!document.querySelector('.wl-ghost')); await touch('touchEnd', []); await pg.waitForTimeout(600); return g2; };
    const y0 = await pg.evaluate(() => scrollY);
    const lifted = await tdrag('BTC', 'LTC', 650);
    check('Touch: lang drücken und ziehen – BTC hinter LTC, die Seite scrollt dabei nicht', lifted && await order(pg) === 'ETC,BCH,LTC,BTC,XRP,NEAR' && Math.abs(await pg.evaluate(() => scrollY) - y0) < 2, `${await order(pg)} · scroll ${y0}→${await pg.evaluate(() => scrollY)}`);
    check('Touch: nach dem Ziehen kein Tipp (kein Detailfeld, Chart weiter BTC)', !(await pg.$('#watchlist .wl-tile[aria-expanded="true"]')) && await sym(pg) === 'BTC', await sym(pg));
    const sc = await tdrag('ETC', 'NEAR', 60);
    check('Touch: sofort bewegt (Wischen) – kein Anheben, Reihenfolge gleich', !sc && await order(pg) === 'ETC,BCH,LTC,BTC,XRP,NEAR', await order(pg));
    await pg.evaluate(() => { const t = document.querySelector('#watchlist .wl-tile[aria-expanded="true"]'); if (t) t.click(); }); await pg.waitForTimeout(300);
    await pg.tap(T('XRP')); await pg.waitForTimeout(900);
    check('Touch: kurzer Tipp öffnet das Detailfeld und lädt den Coin', await pg.getAttribute(T('XRP'), 'aria-expanded') === 'true' && await sym(pg) === 'XRP', await sym(pg));
    check('Lang drücken öffnet kein Kontextmenü/Textauswahl (CSS)', await pg.evaluate(() => { const s = getComputedStyle(document.querySelector('#watchlist .wl-tile')); return (s.webkitUserSelect || s.userSelect) === 'none'; }));
    check('keine Fehler (Umsortieren, Touch)', !real(ph.errors).length, real(ph.errors).join(' | ')); await ph.ctx.close();
  },
};

(async () => {
  const only = process.argv[2];
  await h.setup(); const browser = await h.launch();
  try { for (const [name, fn] of Object.entries(tests)) { if (only && only !== name) continue; console.log(`\n▶ ${name}`); try { await fn(browser); } catch (e) { check(`${name}: Abbruch`, false, e.stack || e.message); } } }
  finally { await browser.close(); await h.teardown(); }
  const ok = results.filter(r => r.ok).length; console.log(`\n${ok}/${results.length} bestanden`); process.exit(ok === results.length ? 0 : 1);
})();
