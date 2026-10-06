// 3.34.0 (G06) – geschlossene Position als genau ein Telegram-Bild (über die Oberfläche, Telegram aus der Attrappe).
// flow:   Long mit Nachkauf und Teilabschluss, Schluss jetzt → genau ein sendPhoto ohne Bildunterschrift, PNG 1080×1440; Netto,
//         Einsatz und Euro wie im Journal; Zustand in der Historie; Neuladen ohne zweites Bild; Vorschau.
// short:  Short mit Nachkauf, Teilabschluss und Schluss „laut Börse“ ohne Ausstiegskurs → „nicht erfasst“ statt erfundenem Kurs.
// nochart: Kerzen nicht abrufbar → trotzdem genau ein Bild („Chartdaten nicht verfügbar“), kein Textbericht.
// off:    Ziel aus → kein Auftrag, keine Kerzen; AUS während des Erstellens → verworfen, nichts gesendet; aus und wieder an →
//         verworfen (Epoche); keine Nachlieferung nach dem Wiedereinschalten oder Neuladen.
// net:    Antwort verloren → „Zustellung unbestätigt“, genau ein Versuch; Telegram lehnt ab → „fehlgeschlagen“, bewusst erneut
//         senden; Neuladen während des Sendens → „unbestätigt“; eingefrorene App → nach dem Auftauen zugestellt, genau ein Bild.
// canvas: Canvas liefert kein Bild → „fehlgeschlagen“, kein Textbericht, „Erneut erstellen“ in der Vorschau.
// more:   offline geschlossen → wartet, beim Wiederverbinden gesendet; zwei Tabs → genau ein Bild, beide zeigen den Zustand;
//         24/7-Dienst eingetragen, aber nicht erreichbar → Schalter dieses Browsers, Bild trotzdem genau einmal.
// manual: Demo nie (kein Bild, kein Knopf); nachgetragener Abschluss nicht automatisch, aber von Hand; älterer Trade von Hand,
//         zweites Senden nur nach Rückfrage; Häkchen „Trade-Bild“ aus → kein automatisches Bild.
// Aufruf: node m55.js [flow|short|nochart|off|net|canvas|more|manual]
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 600) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR/.test(e));
const until = async (fn, ms = 20000, step = 200) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', ALERT = '987654321', BACKUP = '-100555', TRADES = '-100777';
const EV = { alarm: true, pos: true, day: true, news: false, pnl: false, pulse: false, trade: true };
const chanCfg = (o = {}, x = {}) => ({ tg: { token: TOKEN, chat: ALERT, thread: '', bchat: BACKUP, bthread: '', btoken: '', tchat: TRADES, tthread: '', ttoken: '', ...o }, dc: { url: '', on: true }, ev: EV, mig33: true, ...x });
async function openPage(browser, seed = {}, { ctx = null, viewport = { width: 1500, height: 1000 } } = {}) {
  ctx = ctx || await browser.newContext({ viewport, acceptDownloads: true, timezoneId: 'Europe/Berlin' });
  if (!ctx.seeded) { ctx.seeded = true; await ctx.addInitScript(items => { if (localStorage.getItem('seeded55')) return; localStorage.setItem('seeded55', '1'); for (const [k, v] of items) localStorage.setItem(k, JSON.stringify(v)); }, Object.entries(seed)); }
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  page.on('dialog', d => void d.accept());
  await page.goto(`${h.URL_BASE}/weather-widget-v2.html`);
  await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  return { ctx, page, errors };
}
const ls = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);
const jsClick = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); if (!e) throw new Error('fehlt: ' + sel); e.click(); }, sel);
const txt = (page, sel) => page.evaluate(sel => document.querySelector(sel)?.textContent ?? null, sel);
const C = id => `.pos-card[data-id="${id}"]`;
const setIn = (page, id, key, v) => page.evaluate(([sel, key, v]) => { const i = document.querySelector(`${sel} [data-input="${key}"]`); if (!i) throw new Error('fehlt ' + key); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }, [C(id), key, v]);
const localIn = (page, ms) => page.evaluate(ms => { const d = new Date(ms); return new Date(ms - d.getTimezoneOffset() * 60e3).toISOString().slice(0, 16); }, ms);
async function add(page, id, q, p, at = 0) {
  await jsClick(page, `${C(id)} [data-action="add"]`); await page.waitForTimeout(120);
  await setIn(page, id, 'aqty', q); await setIn(page, id, 'aprice', p); if (at) await setIn(page, id, 'awhen', await localIn(page, at));
  await jsClick(page, `${C(id)} [data-action="save-add"]`); await page.waitForTimeout(250);
}
async function close(page, id, f, at = 0) {
  await jsClick(page, `${C(id)} [data-action="realize"]`); await page.waitForTimeout(120);
  for (const [k, v] of Object.entries(f)) await setIn(page, id, k, v);
  if (at) await setIn(page, id, 'when', await localIn(page, at));
  await jsClick(page, `${C(id)} [data-action="save-realize"]`); await page.waitForTimeout(300);
}
const photos = async since => (await h.ctl('/sent')).filter(m => m.svc === 'tg' && m.method === 'sendPhoto' && m.at >= since);
const fmt = (x, d = 2) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }).format(Math.abs(x));
const pos = (id, sym, side, entry, qty, openedAt, extra = {}) => ({ id, symbol: sym, side, mode: 'isolated', entry, leverage: 10, qty, margin: entry * qty / 10, openedAt, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false }, ...extra });

const job = async (page, id) => (await ls(page, 'scalpdesk.tradeimg.v1'))?.jobs?.find(j => j.id === id) || null;
const waitJob = (page, id, test, ms = 25000) => until(async () => { const j = await job(page, id); return j && test(j) ? j : null; }, ms);
const imgReq = async (since, sym) => (await h.ctl('/log')).filter(e => /klines$/.test(e.path || '') && e.q?.symbol === sym && e.q?.startTime && e.q?.endTime && e.at >= since);
const journalNet = async (page, root) => ((await ls(page, 'scalpdesk.history.v1')) || []).filter(t => (t.part?.pos || t.id) === root).reduce((s, t) => s + t.pnl, 0);
const openTgc = async page => { await page.evaluate(() => { if (!document.getElementById('tgc-dialog').open) document.getElementById('tgc-open').click(); }); await page.waitForTimeout(400); };
const chip = (page, id) => page.evaluate(id => document.querySelector(`#history-list [data-trade="${id}"] .timg-st`)?.textContent ?? null, id);
const keep = [];

const tests = {
  async flow(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=SOLUSDT&price=150');
    const now = Date.now(), T0 = now - 3 * 3600e3;
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.channels.v1': chanCfg(), 'scalpdesk.positions.v1': [pos('L1', 'SOLUSDT', 'long', 148, 2, T0)] });
    await add(page, 'L1', '1', '146', now - 2 * 3600e3);
    let t0 = Date.now(); await close(page, 'L1', { qty: '1', exit: '149' }, now - 3600e3);
    await page.waitForTimeout(1500);
    check('Teilabschluss allein: kein Bild, kein Auftrag', !(await photos(t0)).length && !(await job(page, 'L1')));
    t0 = Date.now(); await close(page, 'L1', { qty: '2', exit: '151', fees: '0,2' });
    const j = await waitJob(page, 'L1', x => x.st === 'ok'); await page.waitForTimeout(1500);
    const all = await photos(t0), p = all[0] || {};
    check('Vollständiger Abschluss: genau ein sendPhoto an den Trades-Chat', j && all.length === 1 && String(p.chat_id) === TRADES, JSON.stringify(all.map(x => ({ chat: x.chat_id, bytes: x.bytes }))));
    check('… ohne Bildunterschrift und ohne weitere Felder (nur chat_id und das Foto)', p.caption === null && JSON.stringify(p.fields) === '["chat_id"]' && p.photoName === 'trade.png' && p.photoType === 'image/png', JSON.stringify({ caption: p.caption, fields: p.fields, name: p.photoName, type: p.photoType }));
    check('… PNG 1080×1440, unter 10 MB', p.png && p.w === 1080 && p.h === 1440 && p.bytes > 20000 && p.bytes < 10e6, JSON.stringify({ png: p.png, w: p.w, h: p.h, bytes: p.bytes }));
    check('… keine Textnachricht an Trades und nichts an Kursalarm oder Sicherung (außer Sicherung selbst)', !(await h.ctl('/sent')).some(m => m.svc === 'tg' && m.at >= t0 && (String(m.chat_id) === TRADES ? m.method !== 'sendPhoto' : m.method === 'sendPhoto')));
    check('Auftrag „gesendet“ mit Nachrichten-ID, automatisch, Kerzen für den Haltezeitraum', j?.st === 'ok' && j.msg > 0 && j.by === 'auto' && /^3m · \d+ Kerzen$/.test(j.chart || ''), JSON.stringify(j));
    keep.push(['flow', p.path]);
    const d = await page.evaluate(() => __g06.timgData('L1')), net = await journalNet(page, 'L1');
    check('Bild-Daten = Journal: Netto (Summe der Buchungen), Ø-Einstieg, Ø-Ausstieg, Einsatz, Menge, Haltedauer', Math.abs(d.net - net) < 1e-9 && Math.abs(d.net - 8.8) < 1e-6 && Math.abs(d.entry - 442 / 3) < 1e-6 && Math.abs(d.exit - (149 + 302) / 3) < 1e-6 && Math.abs(d.margin - 44.2) < 1e-6 && d.qty === 3 && d.buys.length === 2 && d.sells.length === 2 && Math.abs(d.openedAt - T0) < 120e3, JSON.stringify({ net: d.net, journal: net, entry: d.entry, exit: d.exit, margin: d.margin, qty: d.qty }));
    const tr = (await ls(page, 'scalpdesk.history.v1')).filter(t => (t.part?.pos || t.id) === 'L1'), eur = tr.reduce((s, t) => s + (t.eur ?? t.pnl / t.fx), 0);
    check('Euro im Bild = Summe der eingefrorenen Euro-Werte je Buchung', tr.every(t => t.fx > 0) && d.eurMiss === 0 && Math.abs(d.eur - eur) < 0.005, JSON.stringify({ d: d.eur, journal: eur, fx: tr.map(t => t.fx) }));
    const c0 = await chip(page, 'L1');
    check('Historie: „📷 gesendet hh:mm“ beim Trade, Knopf 📷', /^📷 gesendet \d\d:\d\d$/.test(c0 || '') && await page.evaluate(() => !!document.querySelector('#history-list [data-trade="L1"] .tools [data-action="trade-img"]')), c0);
    await page.reload(); await page.waitForTimeout(4000);
    check('Neu laden: kein zweites Bild, Zustand bleibt', (await photos(t0)).length === 1 && (await job(page, 'L1'))?.st === 'ok' && /gesendet/.test(await chip(page, 'L1') || ''));
    await page.evaluate(() => { document.getElementById('pos-over').open = true; document.getElementById('history').open = true; });
    await jsClick(page, '#history-list [data-trade="L1"] .tools [data-action="trade-img"]');
    await until(() => page.evaluate(() => !document.getElementById('timg-img').hidden), 10000);
    const v = await page.evaluate(() => ({ open: document.getElementById('timg-dialog').open, w: document.getElementById('timg-img').naturalWidth, h: document.getElementById('timg-img').naturalHeight, st: document.getElementById('timg-status').textContent, send: document.getElementById('timg-send').textContent, dl: document.getElementById('timg-save').download }));
    check('Vorschau: Bild 1080×1440, „An Telegram gesendet um …“, Knopf „Erneut senden …“, „Bild speichern“', v.open && v.w === 1080 && v.h === 1440 && /^An Telegram gesendet um \d\d:\d\d\.$/.test(v.st) && v.send === 'Erneut senden …' && /^trade-SOL-\d{4}-\d\d-\d\d\.png$/.test(v.dl), JSON.stringify(v));
    await page.click('#timg-send'); await page.waitForTimeout(300);
    const ask = await page.evaluate(() => ({ st: document.getElementById('timg-status').textContent, send: document.getElementById('timg-send').textContent }));
    check('Erneut senden: erst Rückfrage (zweites Bild im Chat), noch nichts gesendet', /Noch einmal senden\? Es kommt dann ein zweites Bild in den Chat\./.test(ask.st) && ask.send === 'Ja, noch einmal senden' && (await photos(t0)).length === 1, JSON.stringify(ask));
    await page.click('#timg-close');
    check('keine Fehler (flow)', !real(errors).length, real(errors).join(' | ')); await ctx.close(); await h.ctl('/walk?on=1');
  },

  async short(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=ETHUSDT&price=2500');
    const now = Date.now(), T0 = now - 2 * 3600e3;
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.channels.v1': chanCfg(), 'scalpdesk.positions.v1': [pos('S1', 'ETHUSDT', 'short', 2520, 2, T0)] });
    await add(page, 'S1', '1', '2530', now - 90 * 60e3);
    await close(page, 'S1', { qty: '1', exit: '2490' }, now - 30 * 60e3);
    const t0 = Date.now(); await close(page, 'S1', { qty: '2', exit: '', override: '45' });
    const j = await waitJob(page, 'S1', x => ['ok', 'fail', 'unconf', 'drop'].includes(x.st)); await page.waitForTimeout(800);
    const d = await page.evaluate(() => __g06.timgData('S1')), net = await journalNet(page, 'S1'), all = await photos(t0);
    check('Short mit Nachkauf und Teilabschluss: genau ein Bild', j?.st === 'ok' && all.length === 1 && all[0].caption === null, JSON.stringify(j));
    check('Short: Netto = Journal (Teilabschluss + Schluss laut Börse), Einstieg Ø aus beiden Verkäufen', d.side === 'short' && Math.abs(d.net - net) < 1e-9 && Math.abs(d.entry - (2 * 2520 + 2530) / 3) < 1e-6 && d.exchange, JSON.stringify({ net: d.net, journal: net, entry: d.entry }));
    check('Schluss ohne Ausstiegskurs: nicht erfunden – Ø-Ausstieg nur aus dem erfassten Teilabschluss, 1 von 2 ohne Kurs', d.exit === 2490 && d.exitMiss === 1 && d.sells[1].x === null, JSON.stringify({ exit: d.exit, miss: d.exitMiss, sells: d.sells }));
    keep.push(['short', all[0]?.path]);
    // einfacher Abschluss ohne Ausstiegskurs (ein Kauf, ein Schluss): „exit“ ist nur Platzhalter → „nicht erfasst“
    await page.evaluate(([p]) => { const k = 'scalpdesk.positions.v1', a = JSON.parse(localStorage.getItem(k) || '[]'); a.push(p); localStorage.setItem(k, JSON.stringify(a)); }, [pos('S2', 'ETHUSDT', 'long', 2480, 1, now - 3600e3)]);
    await page.reload(); await page.waitForTimeout(1500); await close(page, 'S2', { qty: '1', exit: '', override: '-12' });
    await waitJob(page, 'S2', x => x.st === 'ok');
    const t2 = (await ls(page, 'scalpdesk.history.v1')).find(t => t.id === 'S2'), d2 = await page.evaluate(() => __g06.timgData('S2'));
    check('Einfacher Schluss „laut Börse“ ohne Kurs: Trade mit exitNA, im Bild Ausstieg „nicht erfasst“ (null)', t2?.exitNA === true && d2.exit === null && d2.exitMiss === 1 && Math.abs(d2.net + 12) < 1e-9, JSON.stringify({ exitNA: t2?.exitNA, exit: d2.exit }));
    check('keine Fehler (short)', !real(errors).length, real(errors).join(' | ')); await ctx.close(); await h.ctl('/walk?on=1');
  },

  async nochart(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=XRPUSDT&price=0.6');
    const now = Date.now();
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.channels.v1': chanCfg(), 'scalpdesk.positions.v1': [pos('N1', 'XRPUSDT', 'long', 0.59, 1000, now - 5 * 3600e3)] });
    await h.ctl('/restfail?on=1'); const t0 = Date.now();
    await close(page, 'N1', { qty: '1000', exit: '0,605' });
    const j = await waitJob(page, 'N1', x => ['ok', 'fail', 'unconf', 'drop'].includes(x.st), 40000); await h.ctl('/restfail?on=0'); await page.waitForTimeout(500);
    const all = await photos(t0);
    check('Kerzen nicht abrufbar: trotzdem genau ein Bild (darin „Chartdaten nicht verfügbar“), kein Textbericht', j?.st === 'ok' && all.length === 1 && /^nicht verfügbar \(/.test(j.chart || '') && !(await h.ctl('/sent')).some(m => m.svc === 'tg' && !m.method && String(m.chat_id) === TRADES && m.at >= t0), JSON.stringify(j));
    keep.push(['nochart', all[0]?.path]);
    check('keine Fehler (nochart)', !real(errors).filter(e => !/503/.test(e)).length, real(errors).join(' | ')); await ctx.close(); await h.ctl('/walk?on=1');
  },

  async off(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=SOLUSDT&price=150');
    const now = Date.now();
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.channels.v1': chanCfg({}, { tgt: { 'course-alert': true, backup: true, trades: false } }), 'scalpdesk.positions.v1': [pos('O1', 'SOLUSDT', 'long', 148, 1, now - 3600e3), pos('O2', 'SOLUSDT', 'long', 149, 1, now - 3600e3), pos('O3', 'SOLUSDT', 'long', 147, 1, now - 3600e3)] });
    let t0 = Date.now(); await close(page, 'O1', { qty: '1', exit: '150' }); await page.waitForTimeout(3000);
    check('Ziel „Trades“ aus: kein Auftrag, kein Bild, nicht einmal Kerzen dafür geladen', !(await job(page, 'O1')) && !(await photos(t0)).length && !(await imgReq(t0, 'SOLUSDT')).length);
    // einschalten, dann AUS während das Bild entsteht (Kerzenabruf verzögert)
    await openTgc(page); await page.click('#tgc-sw-trades'); await page.waitForTimeout(300); await page.evaluate(() => document.getElementById('tgc-dialog').close());
    await h.ctl('/restdelay?ms=5000'); t0 = Date.now(); await close(page, 'O2', { qty: '1', exit: '151' });
    const r = await waitJob(page, 'O2', x => x.st === 'render', 8000);
    await openTgc(page); await page.click('#tgc-sw-trades'); await page.waitForTimeout(300); await page.evaluate(() => document.getElementById('tgc-dialog').close());
    const j2 = await waitJob(page, 'O2', x => x.st === 'drop', 8000); await page.waitForTimeout(6000); await h.ctl('/restdelay?ms=0');
    check('AUS während des Erstellens: verworfen („ausgeschaltet“), nichts gesendet', r && j2 && /ausgeschaltet/.test(j2.why) && !(await photos(t0)).length, JSON.stringify(j2));
    await openTgc(page); await page.click('#tgc-sw-trades'); await page.waitForTimeout(300); await page.evaluate(() => document.getElementById('tgc-dialog').close());
    await page.waitForTimeout(3000); await page.reload(); await page.waitForTimeout(4000);
    check('Wieder an und neu geladen: keine Nachlieferung des verworfenen Bilds', !(await photos(t0)).length && (await job(page, 'O2'))?.st === 'drop' && /verworfen/.test(await chip(page, 'O2') || ''), await chip(page, 'O2'));
    // aus und gleich wieder an, während das Bild entsteht: andere Epoche → verworfen
    await h.ctl('/restdelay?ms=5000'); t0 = Date.now(); await close(page, 'O3', { qty: '1', exit: '152' });
    await waitJob(page, 'O3', x => x.st === 'render', 8000);
    const e0 = await page.evaluate(() => __g06.tgtEpoch('trades'));
    await openTgc(page); await page.click('#tgc-sw-trades'); await page.waitForTimeout(150); await page.click('#tgc-sw-trades'); await page.waitForTimeout(300); await page.evaluate(() => document.getElementById('tgc-dialog').close());
    const j3 = await waitJob(page, 'O3', x => x.st === 'drop', 10000); await page.waitForTimeout(5000); await h.ctl('/restdelay?ms=0');
    check('Aus und wieder an während des Erstellens: verworfen (Epoche), nichts gesendet', j3 && !(await photos(t0)).length && e0 !== await page.evaluate(() => __g06.tgtEpoch('trades')), JSON.stringify({ j3, e0 }));
    check('keine Fehler (off)', !real(errors).length, real(errors).join(' | ')); await ctx.close(); await h.ctl('/walk?on=1');
  },

  async net(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=SOLUSDT&price=150');
    const now = Date.now(), P = ['A', 'B', 'C', 'D'].map((x, i) => pos('W' + x, 'SOLUSDT', 'long', 148 + i * 0.1, 1, now - 3600e3));
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.channels.v1': chanCfg(), 'scalpdesk.positions.v1': P });
    // Antwort verloren
    await h.ctl('/chan?photodrop=1'); let t0 = Date.now(); await close(page, 'WA', { qty: '1', exit: '150' });
    const ja = await waitJob(page, 'WA', x => x.st === 'unconf'); await page.waitForTimeout(6000);
    check('Antwort von Telegram verloren: „Zustellung unbestätigt“, genau ein Versuch, kein zweiter', ja && /kein automatischer zweiter Versuch/.test(ja.why) && (await photos(t0)).length === 1 && (await photos(t0))[0].dropped, JSON.stringify(ja));
    await page.reload(); await page.waitForTimeout(4000);
    check('… auch nach dem Neuladen kein zweiter Versuch; Historie zeigt „📷 Zustellung unbestätigt“', (await photos(t0)).length === 1 && (await chip(page, 'WA')) === '📷 Zustellung unbestätigt', await chip(page, 'WA'));
    // Telegram lehnt ab → fehlgeschlagen → bewusst erneut senden
    await h.ctl('/chan?photofail=502'); t0 = Date.now(); await close(page, 'WB', { qty: '1', exit: '150' });
    const jb = await waitJob(page, 'WB', x => x.st === 'fail'); await h.ctl('/chan?photofail=0');
    check('Telegram lehnt ab: „fehlgeschlagen“ mit Grund, kein Textbericht', jb && /Telegram lehnt ab: Bad Gateway/.test(jb.why) && !(await h.ctl('/sent')).some(m => m.svc === 'tg' && !m.method && m.at >= t0), JSON.stringify(jb));
    await page.evaluate(() => { document.getElementById('pos-over').open = true; document.getElementById('history').open = true; });
    await jsClick(page, '#history-list [data-trade="WB"] .timg-st'); await until(() => page.evaluate(() => !document.getElementById('timg-img').hidden), 10000);
    const st = await txt(page, '#timg-status'); await page.click('#timg-send');
    const jb2 = await waitJob(page, 'WB', x => x.st === 'ok'); await page.click('#timg-close');
    check('Erneut senden (Vorschau aus dem Zustand in der Historie): jetzt zugestellt, insgesamt 2 Versuche', /^Fehlgeschlagen – Telegram lehnt ab/.test(st) && jb2?.by === 'manual' && (await photos(t0)).length === 2, JSON.stringify({ st, jb2 }));
    // Neuladen während des Sendens
    await h.ctl('/chan?photodelay=8000'); t0 = Date.now(); await close(page, 'WC', { qty: '1', exit: '150' });
    await waitJob(page, 'WC', x => x.st === 'send', 15000); await page.reload();
    const jc = await waitJob(page, 'WC', x => x.st !== 'send', 40000); await h.ctl('/chan?photodelay=0'); await page.waitForTimeout(3000);
    check('Neu geladen während des Sendens: „Zustellung unbestätigt“ (Abbruch beim Neuladen oder unterbrochen), genau ein Versuch, kein zweiter', jc?.st === 'unconf' && /unterbrochen|keine Antwort von Telegram/.test(jc.why) && (await photos(t0)).length === 1, JSON.stringify(jc));
    // eingefrorene App (wie iOS im Hintergrund): Senden läuft nach dem Auftauen zu Ende, genau ein Bild
    await h.ctl('/chan?photodelay=3000'); t0 = Date.now(); await close(page, 'WD', { qty: '1', exit: '150' });
    await waitJob(page, 'WD', x => x.st === 'send', 15000);
    const cdp = await ctx.newCDPSession(page); await cdp.send('Page.setWebLifecycleState', { state: 'frozen' }); await h.sleep(9000); await cdp.send('Page.setWebLifecycleState', { state: 'active' });
    const jd = await waitJob(page, 'WD', x => x.st !== 'send', 15000); await h.ctl('/chan?photodelay=0');
    check('Eingefroren während des Sendens: nach dem Auftauen „gesendet“, genau ein Bild', jd?.st === 'ok' && (await photos(t0)).length === 1, JSON.stringify(jd));
    check('keine Fehler (net)', !real(errors).length, real(errors).join(' | ')); await ctx.close(); await h.ctl('/walk?on=1');
  },

  async canvas(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=SOLUSDT&price=150');
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, timezoneId: 'Europe/Berlin' });
    await ctx.addInitScript(() => { HTMLCanvasElement.prototype.toBlob = function (cb) { setTimeout(() => cb(null)); }; });
    const { page, errors } = await openPage(browser, { 'scalpdesk.channels.v1': chanCfg(), 'scalpdesk.positions.v1': [pos('K1', 'SOLUSDT', 'long', 148, 1, Date.now() - 3600e3)] }, { ctx });
    const t0 = Date.now(); await close(page, 'K1', { qty: '1', exit: '150' });
    const j = await waitJob(page, 'K1', x => x.st === 'fail'); await page.waitForTimeout(1000);
    check('Canvas liefert kein Bild: „fehlgeschlagen“ mit Grund, nichts gesendet, kein Textbericht', j && /Bild konnte nicht erstellt werden \(Canvas lieferte kein Bild\)/.test(j.why) && !(await h.ctl('/sent')).some(m => m.svc === 'tg' && m.at >= t0 && String(m.chat_id) === TRADES), JSON.stringify(j));
    check('… Trade bleibt im Journal (Abschluss nicht rückgängig)', (await ls(page, 'scalpdesk.history.v1')).some(t => t.id === 'K1') && !(await ls(page, 'scalpdesk.positions.v1')).some(p => p.id === 'K1'));
    await page.evaluate(() => { document.getElementById('pos-over').open = true; document.getElementById('history').open = true; });
    await jsClick(page, '#history-list [data-trade="K1"] .timg-st'); await page.waitForTimeout(1500);
    const v = await page.evaluate(() => ({ wait: document.getElementById('timg-wait').textContent, retry: !document.getElementById('timg-retry').hidden }));
    check('Vorschau: Fehler und „Erneut erstellen“', /^Bild konnte nicht erstellt werden/.test(v.wait) && v.retry, JSON.stringify(v));
    check('keine Fehler (canvas)', !real(errors).length, real(errors).join(' | ')); await ctx.close(); await h.ctl('/walk?on=1');
  },

  async more(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=SOLUSDT&price=150');
    const now = Date.now();
    let { ctx, page, errors } = await openPage(browser, { 'scalpdesk.channels.v1': chanCfg(), 'scalpdesk.positions.v1': [pos('Q1', 'SOLUSDT', 'long', 148, 1, now - 3600e3), pos('Q2', 'SOLUSDT', 'long', 149, 1, now - 3600e3)] });
    // offline: wartet, wird beim Wiederverbinden gesendet
    let t0 = Date.now(); await ctx.setOffline(true); await close(page, 'Q1', { qty: '1', exit: '150' });
    const q = await waitJob(page, 'Q1', x => x.st === 'queued' && /offline/.test(x.why), 30000);
    check('Offline geschlossen: Auftrag „wartet“ (offline), nichts gesendet', q && !(await photos(t0)).length, JSON.stringify(q));
    await ctx.setOffline(false);
    const q2 = await waitJob(page, 'Q1', x => x.st === 'ok', 30000);
    check('… wieder online: genau einmal gesendet', q2 && (await photos(t0)).length === 1, JSON.stringify(q2));
    // zwei Tabs: einer erstellt und sendet, der andere zeigt den Zustand
    const B = await ctx.newPage(); h.collect(B, errors); await B.goto(`${h.URL_BASE}/weather-widget-v2.html`); await B.waitForTimeout(2500);
    t0 = Date.now(); await close(page, 'Q2', { qty: '1', exit: '151' });
    await waitJob(page, 'Q2', x => x.st === 'ok'); await page.waitForTimeout(3000);
    await B.evaluate(() => { document.getElementById('pos-over').open = true; document.getElementById('history').open = true; }); await B.waitForTimeout(500);
    check('Zwei Tabs: genau ein Bild; der andere Tab zeigt „📷 gesendet …“', (await photos(t0)).length === 1 && /^📷 gesendet/.test(await chip(B, 'Q2') || ''), await chip(B, 'Q2'));
    await B.reload(); await B.waitForTimeout(4000);
    check('… Neuladen des anderen Tabs: kein zweites Bild', (await photos(t0)).length === 1);
    await ctx.close();
    // 24/7-Dienst eingetragen, aber nicht erreichbar (Port zu): Schalter dieses Browsers gelten, Epoche „unbekannt“ blockiert nicht
    ({ ctx, page, errors: errors } = await openPage(browser, { 'scalpdesk.channels.v1': chanCfg(), 'scalpdesk.svc.v1': { url: 'http://127.0.0.1:9', key: 'TestSchluessel_0123456789abcdefghijklmnopq', inst: 'ipad0001' }, 'scalpdesk.positions.v1': [pos('Q3', 'SOLUSDT', 'long', 148, 1, now - 3600e3)] }));
    t0 = Date.now(); await close(page, 'Q3', { qty: '1', exit: '150' });
    const j3 = await waitJob(page, 'Q3', x => ['ok', 'fail', 'drop', 'unconf'].includes(x.st), 30000);
    check('24/7-Dienst nicht erreichbar: Trade-Bild trotzdem genau einmal (nie über den Dienst)', j3?.st === 'ok' && j3.epoch === 's?' && (await photos(t0)).length === 1, JSON.stringify(j3));
    check('keine Fehler (more)', !real(errors).length, real(errors).join(' | ')); await ctx.close(); await h.ctl('/walk?on=1');
  },

  async manual(browser) {
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=SOLUSDT&price=150');
    const now = Date.now(), old = { id: 'H1', symbol: 'BTCUSDT', side: 'long', mode: 'cross', entry: 60000, leverage: 5, qty: 0.01, margin: 120, openedAt: now - 30 * 864e5, source: 'spot', liqExchange: null, preRealized: 0, sl: null, tp: null, ack: { sl: false, tp: false }, exit: 61000, fees: 0.5, pnl: 9.5, pnlSource: 'calc', closedAt: now - 29 * 864e5, note: '', fx: 1.1, fxSrc: 'm1', fxAt: now - 29 * 864e5 - 60e3 };
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.channels.v1': chanCfg(), 'scalpdesk.history.v1': [old], 'scalpdesk.positions.v1': [pos('M1', 'SOLUSDT', 'long', 148, 1, now - 3 * 3600e3)], 'scalpdesk.demopositions.v1': [pos('D1', 'SOLUSDT', 'long', 148, 1, now - 3600e3, { demo: true })] });
    let t0 = Date.now(); await close(page, 'D1', { qty: '1', exit: '150' }); await page.waitForTimeout(3000);
    check('Demo-Abschluss: kein Bild, kein Auftrag, kein Knopf 📷 in der Demo-Historie', !(await photos(t0)).length && !(await job(page, 'D1')) && await page.evaluate(() => !document.querySelector('#demo-history-list [data-action="trade-img"]')));
    t0 = Date.now(); await close(page, 'M1', { qty: '1', exit: '150' }, now - 3600e3); await page.waitForTimeout(3000);
    check('Nachgetragener Abschluss (vor 1 Std.): kein automatisches Bild', !(await photos(t0)).length && !(await job(page, 'M1')));
    await page.evaluate(() => { document.getElementById('pos-over').open = true; document.getElementById('history').open = true; });
    await jsClick(page, '#history-list [data-trade="M1"] [data-action="trade-img"]'); await until(() => page.evaluate(() => !document.getElementById('timg-img').hidden), 10000);
    check('… von Hand: Vorschau „Noch nicht an Telegram gesendet.“', (await txt(page, '#timg-status')) === 'Noch nicht an Telegram gesendet.' && (await txt(page, '#timg-send')) === 'An Telegram senden');
    await page.click('#timg-send'); const jm = await waitJob(page, 'M1', x => x.st === 'ok'); await page.click('#timg-close');
    check('… gesendet (von Hand), genau ein Bild', jm?.by === 'manual' && (await photos(t0)).length === 1, JSON.stringify(jm));
    t0 = Date.now(); await jsClick(page, '#history-list [data-trade="H1"] [data-action="trade-img"]'); await until(() => page.evaluate(() => !document.getElementById('timg-img').hidden), 10000);
    await page.click('#timg-send'); const jh = await waitJob(page, 'H1', x => x.st === 'ok'); await page.click('#timg-close');
    const dh = await page.evaluate(() => __g06.timgData('H1'));
    check('Älterer Trade (vor 29 Tagen, ohne Verlauf): Vorschau und Senden von Hand, Werte aus dem Trade', jh && (await photos(t0)).length === 1 && dh.net === 9.5 && dh.entry === 60000 && dh.exit === 61000 && Math.abs(dh.eur - 9.5 / 1.1) < 0.005, JSON.stringify({ jh, net: dh.net, eur: dh.eur }));
    keep.push(['manual-old', (await photos(t0))[0]?.path]);
    // Häkchen „Trade-Bild“ aus
    await page.evaluate(([p]) => { const k = 'scalpdesk.positions.v1', a = JSON.parse(localStorage.getItem(k) || '[]'); a.push(p); localStorage.setItem(k, JSON.stringify(a)); }, [pos('M2', 'SOLUSDT', 'long', 148, 1, now - 3600e3)]);
    await page.reload(); await page.waitForTimeout(1500);
    await page.evaluate(() => { document.getElementById('chan-open').click(); document.getElementById('chan-ev-trade').checked = false; document.getElementById('chan-ev-trade').dispatchEvent(new Event('change', { bubbles: true })); document.getElementById('chan-dialog').close(); });
    t0 = Date.now(); await close(page, 'M2', { qty: '1', exit: '150' }); await page.waitForTimeout(3000);
    check('Häkchen „Trade-Bild“ aus: kein automatisches Bild', (await ls(page, 'scalpdesk.channels.v1')).ev.trade === false && !(await photos(t0)).length && !(await job(page, 'M2')));
    check('keine Fehler (manual)', !real(errors).length, real(errors).join(' | ')); await ctx.close(); await h.ctl('/walk?on=1');
  },
};

(async () => {
  const only = process.argv[2];
  await h.setup(); await h.ctl('/reset'); const browser = await h.launch();
  try { for (const [name, fn] of Object.entries(tests)) { if (only && only !== name) continue; console.log(`\n▶ ${name}`); await h.ctl('/reset'); try { await fn(browser); } catch (e) { check(`${name}: Abbruch`, false, e.stack || e.message); } } }
  finally { await browser.close(); await h.teardown(); }
  for (const [n, p] of keep) if (p) console.log(`BILD ${n}: ${p}`);
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
