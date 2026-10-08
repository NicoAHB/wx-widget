// Funktionstests gegen den Binance-Mock. Aufruf: node functional.js [testname ...]
const h = require('./harness');
const fs = require('fs');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const idbGet = (page, key) => page.evaluate(k => new Promise(r => { const q = indexedDB.open('scalpdesk'); q.onsuccess = () => { const g = q.result.transaction('kv').objectStore('kv').get(k); g.onsuccess = () => r(g.result ?? null); g.onerror = () => r('ERR'); }; q.onerror = () => r('ERR'); }), key);
const text = (page, sel) => page.$eval(sel, e => e.textContent).catch(() => '');
async function waitText(page, sel, re, timeout = 10000) { try { await page.waitForFunction(([s, r]) => { const e = document.querySelector(s); return e && new RegExp(r).test(e.textContent); }, [sel, re.source], { timeout }); return true; } catch { return false; } }
async function open(browser, opts = {}) {
  const ctx = opts.ctx || await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true, ...(opts.context || {}) });
  if (opts.init) await ctx.addInitScript(opts.init.fn, opts.init.arg);
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  await page.goto(h.URL_BASE + '/weather-widget-v2.html');
  await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 15000 });
  return { ctx, page, errors };
}
const waitLive = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 15000 }).then(() => true, () => false);
async function addAlarmUi(page, sym, price) {
  await page.click('#alarm-toggle'); await page.fill('#al-symbol', sym); await page.fill('#al-price', String(price).replace('.', ','));
  await page.click('#al-save'); await page.waitForFunction(() => document.getElementById('alarm-form').hidden, null, { timeout: 8000 });
}
const tests = {
  async migration(browser) {
    const now = Date.now();
    const seed = ({ now }) => {
      if (localStorage.getItem('scalpdesk.savedat.v1')) return;
      const pos = { id: 'p1', symbol: 'XRPUSDT', side: 'long', mode: 'cross', entry: 1.4, leverage: 10, qty: 100, margin: 14, openedAt: now - 3600e3, source: 'spot', liqExchange: null, preRealized: 0, sl: 1.3, tp: 1.6, ack: { sl: false, tp: false } };
      localStorage.setItem('scalpdesk.positions.v1', JSON.stringify([pos]));
      localStorage.setItem('scalpdesk.history.v1', JSON.stringify([{ ...pos, id: 't1', exit: 1.45, fees: 0.1, pnl: 4.9, pnlSource: 'calc', closedAt: now - 7200e3, fx: 1.16, note: 'alt' }]));
      localStorage.setItem('scalpdesk.alarms.v1', JSON.stringify([{ id: 'a1', symbol: 'ETHUSDT', dir: 'above', price: 2600, note: '', source: 'spot', createdAt: now - 600e3, triggeredAt: null, triggerPrice: null }]));
      localStorage.setItem('scalpdesk.sound.v1', '1'); localStorage.setItem('scalpdesk.taxrate.v1', '25'); localStorage.setItem('scalpdesk.daylimit.v1', '30');
      localStorage.setItem('scalpdesk.daylimitnote.v1', '2026-9-24'); localStorage.setItem('scalpdesk.watchlist.v1', JSON.stringify(['BTC', 'XRP', 'SOL']));
    };
    const { ctx, page, errors } = await open(browser, { init: { fn: seed, arg: { now } } });
    await h.sleep(1500);
    const st = await page.evaluate(() => ({ cards: document.querySelectorAll('.pos-card').length, sound: document.getElementById('sound-toggle').textContent, tax: document.getElementById('tax-rate').value, lim: document.getElementById('day-limit').value, alarms: document.querySelectorAll('.al-row').length, hist: document.getElementById('history-count').textContent, chips: [...document.querySelectorAll('#watchlist [data-watch]')].map(c => c.dataset.watch).join() }));
    check('Altdaten: Position übernommen', st.cards === 1, JSON.stringify(st));
    check('Altdaten: Trade, Alarm, Einstellungen', /1/.test(st.hist) && st.alarms === 1 && /an/.test(st.sound) && st.tax === '25' && st.lim === '30' && st.chips === 'BTC,XRP,SOL');
    const idbPos = await idbGet(page, 'scalpdesk.positions.v1');
    check('IndexedDB enthält die Positionen', Array.isArray(idbPos) && idbPos[0]?.id === 'p1');
    // IndexedDB ist maßgeblich: localStorage-Spiegel leeren, neu laden → Daten aus IndexedDB
    await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('scalpdesk.') && k !== 'scalpdesk.savedat.v1') localStorage.removeItem(k); });
    await page.reload(); await page.waitForFunction(() => document.querySelectorAll('.pos-card').length === 1, null, { timeout: 10000 }).catch(() => {});
    check('Nach Löschen des Spiegels: Daten aus IndexedDB', await page.evaluate(() => document.querySelectorAll('.pos-card').length) === 1);
    check('Spiegel wieder aufgebaut', await page.evaluate(() => !!localStorage.getItem('scalpdesk.positions.v1')));
    check('keine Fehler', !errors.length, errors.join(' | '));
    await ctx.close();
  },
  async crosstab(browser) {
    const { ctx, page: a, errors } = await open(browser);
    const b = await ctx.newPage(); h.collect(b, errors); await b.goto(h.URL_BASE + '/weather-widget-v2.html'); await b.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—');
    await addAlarmUi(a, 'ETH', 2700);
    check('Alarm in Tab A gespeichert', await a.evaluate(() => document.querySelectorAll('.al-row').length) === 1);
    check('Tab B übernimmt den Alarm', await waitText(b, '#alarm-list', /ETH steigt auf\/über 2\.700/, 5000), await text(b, '#alarm-list'));
    await b.click('.al-row [data-action="al-delete"]');
    check('Löschen in B erreicht A', await a.waitForFunction(() => !document.querySelector('.al-row'), null, { timeout: 5000 }).then(() => true, () => false));
    check('keine Fehler', !errors.length, errors.join(' | '));
    await ctx.close();
  },
  async wick(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=XRPUSDT&price=1.5');
    const { ctx, page, errors } = await open(browser); await waitLive(page);
    await addAlarmUi(page, 'XRP', 1.52);
    const subscribed = await page.waitForFunction(async () => true, null).then(async () => { for (let i = 0; i < 20; i++) { const s = await (await fetch('http://127.0.0.1:8790/state')).json().catch(() => null); if (s?.conns.some(c => c.streams.includes('xrpusdt@kline_1m'))) return true; await new Promise(r => setTimeout(r, 300)); } return false; }).catch(() => false);
    check('XRP-Stream abonniert (live SUBSCRIBE)', subscribed);
    await h.sleep(2500); // mindestens eine Meldung nach dem Scharfschalten
    await h.ctl('/wick?symbol=XRPUSDT&to=1.53');
    const hit = await waitText(page, '#toasts', /per Docht erreicht \(bis 1,5300\)/, 6000);
    check('Docht löst Kurs-Alarm aus, obwohl der Kurs zurück ist', hit, await text(page, '#toasts'));
    check('Alarmliste zeigt Docht', /Docht bis 1,5300/.test(await text(page, '#alarm-list')));
    check('keine Fehler', !errors.length, errors.join(' | '));
    await ctx.close(); await h.ctl('/walk?on=1');
  },
  async stoploss(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=XRPUSDT&price=1.5');
    const { ctx, page, errors } = await open(browser); await waitLive(page);
    await page.click('#pos-add-toggle'); await page.fill('#pos-symbol', 'XRP'); await page.click('[data-lev-for="pos-lev"] [data-lev="10"]');
    check('Hebel-Schnellwahl setzt 10', await page.inputValue('#pos-lev') === '10');
    await page.fill('#pos-qty', '100'); await page.fill('#pos-entry', '1,5'); await page.fill('#pos-sl', '1,49'); await page.fill('#pos-tp', '1,6');
    await page.click('#pos-save'); await page.waitForSelector('.pos-card', { timeout: 8000 });
    await h.sleep(2500);
    await h.ctl('/set?symbol=XRPUSDT&price=1.48');
    check('Stop-Loss meldet sich', await waitText(page, '#toasts', /Stop-Loss 1,4900 erreicht/, 6000), await text(page, '#toasts'));
    check('Karte zeigt Hinweis', await waitText(page, '.pos-alert', /Stop-Loss/, 3000));
    const before = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.className + ': ' + t.textContent));
    if (before.length !== 1) console.log('    [diag] Toasts vor OK:', JSON.stringify(before));
    await page.click('#toasts .toast button');
    await h.ctl('/set?symbol=XRPUSDT&price=1.5'); await h.sleep(3000);
    const rearmState = await page.evaluate(() => ({ toasts: [...document.querySelectorAll('#toasts .toast')].map(t => t.className + ': ' + t.textContent), alert: document.querySelector('.pos-alert').hidden, alertText: document.querySelector('.pos-alert').textContent, t: new Date().toISOString() }));
    check('Nach Bestätigen und Rückkehr wieder scharf', !rearmState.toasts.length && rearmState.alert, JSON.stringify(rearmState));
    const agg = await (await fetch('http://127.0.0.1:8790/state')).json().then(st => st.conns.some(c => c.streams.includes('xrpusdt@aggTrade')));
    check('Nahe der Marke: Einzel-Trades abonniert', agg);
    await h.ctl('/wick?symbol=XRPUSDT&to=1.48');
    // Je nachdem, ob beide Einzel-Trades im selben 200-ms-Bündel ankommen, meldet sich der Stop als Docht oder als direkter Treffer
    check('Zweiter Docht in derselben Minute meldet sich (Einzel-Trades)', await waitText(page, '#toasts', /Stop-Loss 1,4900 (kurz per Docht )?erreicht/, 6000), await text(page, '#toasts'));
    const counter = await text(page, '#backup-count');
    check('Backup-Zähler zeigt neue Änderung', /NEU/.test(counter), counter);
    check('keine Fehler', !errors.length, errors.join(' | '));
    await ctx.close(); await h.ctl('/walk?on=1');
  },
  async fallback(browser) {
    await h.ctl('/blockws?on=1');
    const { ctx, page, errors } = await open(browser);
    await h.sleep(4000);
    const st = await page.evaluate(() => ({ feed: document.getElementById('status').dataset.feed, text: document.getElementById('status').textContent, title: document.getElementById('status').title }));
    check('Ohne WebSocket: REST-Abruf alle 15 s', st.feed === 'rest' && /^Auto · \d+ s$/.test(st.text), JSON.stringify(st));
    const p1 = await text(page, '#price'); await h.sleep(16000); const p2 = await text(page, '#price');
    check('Kurs aktualisiert sich per REST', p1 !== p2, `${p1} → ${p2}`);
    await h.ctl('/blockws?on=0');
    check('Stream verbindet sich wieder', await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 45000 }).then(() => true, () => false));
    check('keine Fehler', !errors.filter(e => !/WebSocket|ERR_|403/.test(e)).length, errors.join(' | '));
    await ctx.close();
  },
  async reconnect(browser) {
    const { ctx, page, errors } = await open(browser); check('live', await waitLive(page));
    await h.ctl('/drop'); await h.sleep(300);
    const mid = await page.evaluate(() => document.getElementById('status').title);
    check('Abbruch erkannt', /getrennt|verbindet|live/.test(mid), mid);
    check('Nach Abbruch wieder live', await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 10000 }).then(() => true, () => false));
    // Der Wächter verbindet ohne Wartezeit neu – der Zwischenzustand im Tooltip ist dann nur Millisekunden sichtbar.
    // Deshalb die Neuverbindung im Protokoll der Attrappe nachweisen: Kontrollanfragen werden beantwortet, also erst nach 20 s ohne Daten.
    const market = await page.evaluate(() => __g05.state.source), watchedHost = (await h.ctl('/state')).conns.find(c => /fstream/.test(c.host) === (market === 'futures'))?.host;
    const tS = Date.now(); await h.ctl('/silent?on=1');
    let re = null; for (const end = Date.now() + 30000; !re && Date.now() < end; await h.sleep(250)) re = (await h.ctl('/log?since=' + tS)).find(x => x.ws === 'open' && x.host === watchedHost);
    check('Wächter erkennt stumme Verbindung (keine Kursdaten, aber Antworten): nach 20 s neu verbunden', !!re && re.at - tS >= 19000, re ? `neu verbunden nach ${re.at - tS} ms` : await page.evaluate(() => document.getElementById('status').title));
    await h.ctl('/silent?on=0');
    check('danach wieder live', await page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).then(() => true, () => false));
    check('keine Fehler', !errors.length, errors.join(' | '));
    await ctx.close();
  },
  async catchup(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=LTCUSDT&price=70');
    await h.ctl('/set?symbol=LTCUSDT&price=71.5'); await h.ctl('/set?symbol=LTCUSDT&price=70'); // Spitze, während die Seite zu ist
    const now = Date.now();
    const seed = ({ now }) => { if (localStorage.getItem('scalpdesk.savedat.v1')) return;
      localStorage.setItem('scalpdesk.alarms.v1', JSON.stringify([{ id: 'a2', symbol: 'LTCUSDT', dir: 'above', price: 71, note: 'Test', source: 'spot', createdAt: now - 20 * 60e3, triggeredAt: null, triggerPrice: null }]));
      localStorage.setItem('scalpdesk.lastseen.v1', JSON.stringify({ LTCUSDT: now - 3 * 60e3 })); };
    const { ctx, page, errors } = await open(browser, { init: { fn: seed, arg: { now } } });
    check('Verpasster Alarm wird nach dem Laden erkannt', await waitText(page, '#toasts', /während die Seite nicht aktiv war/, 10000), await text(page, '#toasts'));
    check('Liste: nachträglich erkannt', /nachträglich erkannt/.test(await text(page, '#alarm-list')));
    check('keine Fehler', !errors.length, errors.join(' | '));
    await ctx.close(); await h.ctl('/walk?on=1');
  },
};
(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(tests);
  await h.setup(); await h.ctl('/reset');
  const browser = await h.launch();
  try { for (const n of names) { console.log(`▶ ${n}`); await h.ctl('/reset'); try { await tests[n](browser); } catch (e) { check(n + ' (Abbruch)', false, e.message.split('\n')[0]); } } }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
