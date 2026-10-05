// Ablaufplan Schritt 3 (3.24.0): Telegram-Ziele zentral – Datensicherung → Sicherungschat, alle Alarme und News → Kursalarm.
// Geprüft gegen die Telegram-Attrappe: Testnachricht je Nachrichtenart, echte Auslöser (Kurs-Alarm, Stop-Loss, News-Termin,
// Sicherung), Themen in Gruppen, „Chat-ID ermitteln“ mit Zuordnung, frühere Einrichtung mit nur einer Chat-ID.
// Aufruf: node m38.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', ALERT = '987654321', BACKUP = '-1001234567890';
const EV = { alarm: true, pos: true, day: true, news: true, pnl: true, pulse: true };
const CHAN = { tg: { token: TOKEN, chat: ALERT, thread: '', bchat: BACKUP, bthread: '12', on: true }, dc: { url: '', on: true }, ev: EV };
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const openChan = async page => { await page.click('#notify-menu'); await page.waitForTimeout(250); await page.click('#chan-open'); await page.waitForTimeout(500); };
const tg = async () => (await h.ctl('/sent')).filter(m => m.svc === 'tg');
const until = async (fn, ms = 20000, step = 250) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
async function open(browser, chan, extra = []) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Berlin' });
  await ctx.addInitScript(([c, x]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('scalpdesk.channels.v1', JSON.stringify(c)); for (const [k, v] of x) localStorage.setItem(k, JSON.stringify(v)); }, [chan, extra]);
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await page.waitForTimeout(1500);
  return { ctx, page, errors };
}
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/tgreset'); await h.ctl('/walk?on=0');
  const browser = await h.launch();
  try {
    // 1. Test je Nachrichtenart: sechs Arten zu Kursalarm, die Sicherung in den Sicherungschat (Thema 12)
    let { ctx, page, errors } = await open(browser, CHAN);
    await openChan(page);
    const form = await page.evaluate(() => ({ chat: document.getElementById('tg-chat').value, thread: document.getElementById('tg-thread').value, bchat: document.getElementById('tg-bchat').value, bthread: document.getElementById('tg-bthread').value }));
    check('Dialog zeigt beide Ziele (Kursalarm und Sicherungschat mit Thema)', form.chat === ALERT && form.bchat === BACKUP && form.bthread === '12' && form.thread === '', JSON.stringify(form));
    await h.ctl('/tgreset');
    await page.click('#tg-testall');
    const tests = await until(async () => { const t = (await tg()).filter(m => /^🧪 Test „/.test(m.text || '')); return t.length >= 7 ? t : null; }, 20000);
    await page.waitForTimeout(1500);
    const st = await page.textContent('#tg-status'), byKind = (tests || []).map(m => ({ name: /„(.+?)“/.exec(m.text)[1], chat: m.chat_id, thread: m.message_thread_id || '' }));
    const toAlert = byKind.filter(x => x.chat === ALERT && !x.thread).map(x => x.name), toBackup = byKind.filter(x => x.chat === BACKUP && x.thread === '12').map(x => x.name);
    check('Test je Nachrichtenart: Kurs-Alarm, Stop/Ziel, Tagesgrenze, News, Gewinn/Verlust, BTC-Puls → Kursalarm', toAlert.length === 6 && ['Kurs-Alarm', 'Stop-Loss/Take-Profit', 'Tages-Verlustlimit', 'News-Alarm (Wirtschaftstermin)', 'Gewinn-/Verlust-Alarm', 'BTC-Puls'].every(n => toAlert.includes(n)), toAlert.join(', '));
    check('Test je Nachrichtenart: Datensicherung → nur Sicherungschat (Thema 12)', toBackup.length === 1 && toBackup[0] === 'Datensicherung' && byKind.length === 7, JSON.stringify(byKind.filter(x => x.chat === BACKUP)));
    check('Meldung nach dem Test: 7 von 7, 6 an Kursalarm, 1 an den Sicherungschat', /^7 von 7 Testnachrichten zugestellt: 6 an Kursalarm, 1 an den Sicherungschat\.$/.test(st), st);
    const sum = await page.textContent('#chan-summary');
    check('Übersicht nennt den eigenen Sicherungschat', /Sicherung: eigener Chat/.test(sum), sum);
    await page.click('#chan-done'); await page.waitForTimeout(200);
    // 2. Echte Auslöser: Telegram-Sicherung (Datei) → Sicherungschat; Kurs-Alarm und Stop-Loss → Kursalarm
    await h.ctl('/tgreset');
    await page.evaluate(() => { if (document.getElementById('data-panel').hidden) document.getElementById('data-toggle').click(); });
    await page.click('#tgb-now');
    const doc = await until(async () => (await tg()).find(m => m.method === 'sendDocument'), 15000);
    check('Datensicherung (Datei) → nur Sicherungschat, Thema 12, lautlos', doc && doc.chat_id === BACKUP && doc.thread === '12' && doc.silent === 'true' && !(await tg()).some(m => m.method === 'sendDocument' && m.chat_id === ALERT), doc && JSON.stringify({ chat: doc.chat_id, thema: doc.thread, lautlos: doc.silent }));
    check('keine Fehler (Test je Art, Sicherung)', !errors.length, errors.join(' | ')); await ctx.close();
    const p0 = (await h.ctl('/state')).price.BTCUSDT, now = Date.now();
    const ALARMS = [{ id: 'a38', symbol: 'BTCUSDT', dir: 'above', price: +(p0 * 1.005).toFixed(2), note: 'Test Zuordnung', source: 'spot', createdAt: now, triggeredAt: null, triggerPrice: null }];
    const POS = [{ id: 'p38', symbol: 'BTCUSDT', side: 'long', mode: 'isolated', entry: p0, leverage: 5, qty: 0.01, margin: p0 * 0.01 / 5, openedAt: now - 60e3, source: 'spot', liqExchange: null, preRealized: 0, sl: +(p0 * 0.99).toFixed(2), tp: null, ack: { sl: false, tp: false } }];
    await h.ctl('/tgreset');
    ({ ctx, page, errors } = await open(browser, CHAN, [['scalpdesk.alarms.v1', ALARMS], ['scalpdesk.positions.v1', POS]]));
    await h.ctl(`/set?symbol=BTCUSDT&price=${(p0 * 1.006).toFixed(2)}`);
    const al = await until(async () => (await tg()).find(m => /Test Zuordnung/.test(m.text || '')), 15000);
    check('Kurs-Alarm → nur Kursalarm', al && al.chat_id === ALERT && !al.message_thread_id && !(await tg()).some(m => m.chat_id === BACKUP && /Test Zuordnung/.test(m.text || '')), al && al.chat_id);
    await h.ctl(`/set?symbol=BTCUSDT&price=${(p0 * 0.985).toFixed(2)}`);
    const sl = await until(async () => (await tg()).find(m => /Stop-Loss/.test(m.text || '') && /BTC/.test(m.text || '')), 15000);
    check('Stop-Loss einer Position → nur Kursalarm', sl && sl.chat_id === ALERT && !(await tg()).some(m => m.chat_id === BACKUP && /Stop-Loss/.test(m.text || '')), sl && `${sl.chat_id}: ${sl.text.split('\n')[0]}`);
    check('keine Fehler (Alarm, Stop)', !errors.length, errors.join(' | ')); await ctx.close();
    // 3. News-Alarm (wichtiger Wirtschaftstermin in 10 Minuten) → Kursalarm, nicht in den Sicherungschat
    await h.ctl('/tgreset'); await h.ctl('/cal?mode=soon&min=10');
    ({ ctx, page, errors } = await open(browser, CHAN));
    const news = await until(async () => (await tg()).find(m => /^⚠ Wirtschaftstermin in \d+ min/.test(m.text || '')), 20000);
    check('News-Alarm (Wirtschaftstermin) → nur Kursalarm', news && news.chat_id === ALERT && !(await tg()).some(m => m.chat_id === BACKUP && m.text), news && `${news.chat_id}: ${news.text.split('\n')[0]}`);
    check('keine Fehler (News)', !errors.length, errors.join(' | ')); await ctx.close(); await h.ctl('/reset'); await h.ctl('/walk?on=0');
    // 4. „Chat-ID ermitteln“: Privatchat und Gruppen-Thema werden gelistet und lassen sich zuordnen
    await h.ctl('/tgmulti?on=1');
    ({ ctx, page, errors } = await open(browser, { tg: { token: TOKEN, chat: '', on: true }, dc: { url: '', on: true }, ev: EV }));
    await openChan(page); await page.click('#tg-detect'); await page.waitForTimeout(1200);
    const found = await page.evaluate(() => [...document.querySelectorAll('#tg-found .tg-found-row')].map(r => r.querySelector('.tg-found-name').textContent));
    const chat0 = await page.inputValue('#tg-chat');
    check('Chat-ID ermitteln: Privatchat und Gruppen-Thema gelistet, Privatchat als Kursalarm vorgeschlagen', found.length === 2 && found.some(t => /^Nico · ID 987654321$/.test(t)) && found.some(t => /^Scalp Desk › Sicherung · ID -1001234567890 · Thema 12$/.test(t)) && chat0 === ALERT, found.join(' | '));
    await page.evaluate(() => [...document.querySelectorAll('#tg-found .tg-found-row')].find(r => /Sicherung/.test(r.textContent)).querySelectorAll('button')[1].click());
    await page.waitForTimeout(300);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.channels.v1')).tg);
    check('„→ Sicherungschat“ übernimmt Chat und Thema und speichert', saved.bchat === BACKUP && saved.bthread === '12' && saved.chat === ALERT, JSON.stringify({ chat: saved.chat, bchat: saved.bchat, bthread: saved.bthread }));
    check('keine Fehler (ermitteln)', !errors.length, errors.join(' | ')); await ctx.close(); await h.ctl('/tgmulti?on=0');
    // 5. Frühere Einrichtung (nur eine Chat-ID): Sicherung geht weiter dorthin – nichts bricht; Übersicht sagt „wie Kursalarm“
    await h.ctl('/tgreset');
    ({ ctx, page, errors } = await open(browser, { tg: { token: TOKEN, chat: ALERT, on: true }, dc: { url: '', on: true }, ev: { alarm: true, pos: true, day: true, news: true } }));
    await page.evaluate(() => { if (document.getElementById('data-panel').hidden) document.getElementById('data-toggle').click(); });
    await page.click('#tgb-now');
    const doc2 = await until(async () => (await tg()).find(m => m.method === 'sendDocument'), 15000), sum2 = await page.textContent('#chan-summary');
    check('Nur eine Chat-ID (alte Einrichtung): Sicherung weiter in diesen Chat, Übersicht „Sicherung: wie Kursalarm“', doc2 && doc2.chat_id === ALERT && !doc2.thread && /Sicherung: wie Kursalarm/.test(sum2), `${doc2?.chat_id} · ${sum2}`);
    const ev = await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('scalpdesk.channels.v1')); return c.ev; });
    check('Neue Nachrichtenarten (Gewinn/Verlust, BTC-Puls) sind bei alter Einrichtung eingeschaltet', ev.pnl !== false && ev.pulse !== false, JSON.stringify(ev));
    check('keine Fehler (alte Einrichtung)', !errors.length, errors.join(' | ')); await ctx.close();
    // 6. Ungültiges Thema: Telegram gilt als unvollständig, nichts wird an falsche Stellen gesendet
    ({ ctx, page, errors } = await open(browser, { tg: { token: TOKEN, chat: ALERT, thread: 'abc', on: true }, dc: { url: '', on: true }, ev: EV }));
    const line = await page.textContent('#chan-summary');
    check('Ungültiges Thema: als unvollständig gemeldet', /unvollständig/.test(line), line);
    await ctx.close();
  } finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
