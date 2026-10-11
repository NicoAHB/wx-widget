// 3.63.0: Tatsächliche Eingabe/Persistenz, getrennte Bots/Chats, leere Felder und Tab-Abgleich.
// Alle Bot-Tokens sind lokale Attrappen. Keine echten Nachrichten/Zugangsdaten.
const h = require('./harness');
const results = [], check = (name, ok) => { results.push(!!ok); console.log(`${ok ? '  ✓' : '  ✗'} ${name}`); };
const tokens = ['123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', '555666777:BBQkbXyzSicherungTestToken0123456789', '777888999:CCTradesTestToken0123456789abcdefgh', '888999000:DDPatternTestToken0123456789abcdefg'];
const fields = ['token', 'chat', 'thread', 'btoken', 'bchat', 'bthread', 'ttoken', 'tchat', 'tthread', 'ptoken', 'pchat', 'pthread'];
const snapshot = page => page.evaluate(() => ({ saved: __g05.chan.tg, inputs: Object.fromEntries([...document.querySelectorAll('#chan-dialog input[id^="tg-"]')].map(x => [x.id.slice(3), x.value])) }));
const ready = page => page.waitForFunction(() => !!window.__g05);
const open = page => page.evaluate(() => document.getElementById('chan-open').click());
async function fill(page, values) { for (const [k, v] of Object.entries(values)) await page.fill('#tg-' + k, v); }
async function send(page, id) {
  const before = Date.now(); await page.click(`[data-tg-test-target="${id}"]`);
  await page.waitForFunction(id => !document.querySelector(`[data-tg-test-target="${id}"]`).disabled, id);
  return (await h.ctl('/sent')).filter(x => x.svc === 'tg' && !x.method && x.at >= before && /Test|TEST/.test(x.text || ''));
}
(async () => {
  await h.setup(); const browser = await h.launch();
  try {
    let ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'Europe/Berlin' });
    await ctx.addInitScript(token => { if (!localStorage.getItem('seeded87')) { localStorage.setItem('seeded87', '1'); localStorage.setItem('scalpdesk.channels.v1', JSON.stringify({ tg: { token, chat: '1001' }, ev: { news: false, pulse: false } })); } }, tokens[0]);
    let page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await ready(page); await open(page);
    let s = await snapshot(page);
    check('Alte Einrichtung: leerer Sicherungschat bleibt leer; keine automatische Kursalarm-Kopie', s.saved.bchat === '' && s.inputs.bchat === '');
    const values = Object.fromEntries(['', 'b', 't', 'p'].flatMap((p, i) => [[p + 'token', tokens[i]], [p + 'chat', String(1001 + i)], [p + 'thread', String(11 + i)]]));
    await fill(page, values); s = await snapshot(page);
    check('Alle zwölf Eingaben sofort gespeichert, auch ohne Fokuswechsel der letzten Eingabe', fields.every(k => s.saved[k] === values[k]));
    await page.evaluate(() => document.getElementById('chan-dialog').close()); await page.reload(); await ready(page); await open(page); s = await snapshot(page);
    check('Schließen und Neuladen: vier getrennte Bots, Chats und Themen unverändert', fields.every(k => s.saved[k] === values[k] && s.inputs[k] === values[k]));
    for (const [i, id] of ['course-alert', 'backup', 'trades', 'patterns'].entries()) {
      const sent = await send(page, id);
      check(`Test ${id}: genau einmal an den eigenen Bot, Chat und das eigene Thema`, sent.length === 1 && sent[0].bot === [123456789, 555666777, 777888999, 888999000][i] && String(sent[0].chat_id) === String(1001 + i) && String(sent[0].message_thread_id) === String(11 + i));
    }
    await fill(page, { bchat: '1001', tchat: '1001', pchat: '1001' });
    for (const [i, id] of ['backup', 'trades', 'patterns'].entries()) {
      const sent = await send(page, id);
      check(`Identische private Chat-ID erlaubt: ${id} bleibt beim eigenen Bot`, sent.length === 1 && sent[0].bot === [555666777, 777888999, 888999000][i] && String(sent[0].chat_id) === '1001');
    }
    await fill(page, { ttoken: '', ptoken: '' }); s = await snapshot(page);
    check('Leere optionale Tokens bleiben leer in Eingabe und Speicherung', s.saved.ttoken === '' && s.saved.ptoken === '' && s.inputs.ttoken === '' && s.inputs.ptoken === '');
    let sent = await send(page, 'trades'); check('Trades: leerer Token verwendet beim Senden den Sicherungs-Bot', sent.length === 1 && sent[0].bot === 555666777);
    sent = await send(page, 'patterns'); check('Chartmuster: leerer Token verwendet beim Senden den Kursalarm-Bot', sent.length === 1 && sent[0].bot === 123456789);
    await fill(page, { btoken: '' }); sent = await send(page, 'trades'); check('Trades: ohne eigenen und Sicherungs-Token verwendet der Sender den Kursalarm-Bot', sent.length === 1 && sent[0].bot === 123456789);
    await fill(page, { bchat: '' }); sent = await send(page, 'backup'); s = await snapshot(page);
    check('Sicherung ohne Chat-ID: keine Nachricht und kein Rückfall; Feld und Zustand leer', !sent.length && s.saved.bchat === '' && s.inputs.bchat === '');
    await fill(page, { ptoken: tokens[3], token: '' }); sent = await send(page, 'patterns');
    check('Eigener Chartmuster-Bot unabhängig vom leeren Kursalarm-Token prüfbar', sent.length === 1 && sent[0].bot === 888999000);
    await fill(page, { token: tokens[0], bchat: '9002', btoken: tokens[1] });
    const stale = await page.evaluate(() => JSON.parse(JSON.stringify(__g05.chan)));
    await page.fill('#tg-tchat', '9003'); await page.reload(); await ready(page); await open(page); s = await snapshot(page);
    check('Neuladen während der Eingabe ohne Blur: neuer Trades-Chat bleibt', s.saved.tchat === '9003' && s.inputs.tchat === '9003');
    const second = await ctx.newPage(); await second.goto(h.URL_BASE + '/weather-widget-v2.html'); await ready(second);
    await page.fill('#tg-bchat', '9012');
    await second.evaluate(stale => { const c = new BroadcastChannel('scalpdesk'); c.postMessage({ t: 'data', from: 'alter-tab-87', items: [['scalpdesk.channels.v1', stale]] }); setTimeout(() => c.close(), 50); }, stale);
    await page.waitForTimeout(200); s = await snapshot(page);
    check('Alter Tab-Abgleich während Bearbeitung löscht keine neuere Eingabe', s.saved.bchat === '9012' && s.inputs.bchat === '9012' && s.saved.tchat === '9003');
    await second.evaluate(() => { __g05.chan.tgt['course-alert'] = false; __g05.saveChannels(); });
    await page.waitForFunction(() => __g05.chan.tgt['course-alert'] === false); s = await snapshot(page);
    check('Tab-Schalter wird abgeglichen, neue Zugangsfelder bleiben erhalten', s.saved.bchat === '9012' && s.saved.tchat === '9003');
    await page.fill('#tg-pchat', ' 9004 '); s = await snapshot(page);
    check('Eingabe wird exakt gespeichert, Leerzeichen nicht in das Feld zurücknormalisiert', s.saved.pchat === ' 9004 ' && s.inputs.pchat === ' 9004 ');
    const state = await ctx.storageState(); await ctx.close(); ctx = await browser.newContext({ storageState: state }); page = await ctx.newPage();
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await ready(page); await open(page); s = await snapshot(page);
    check('App-Neustart mit gespeichertem Browserzustand erhält eigene Felder und leere Rückfallfelder', s.saved.bchat === '9012' && s.saved.tchat === '9003' && s.saved.pchat === ' 9004 ' && s.saved.ttoken === '');
    check('Keine Laufzeitfehler beim Eingeben, Testen und Abgleichen', !errors.length); await ctx.close();
  } finally { await browser.close(); await h.teardown(); }
  console.log(`\n${results.filter(Boolean).length}/${results.length} bestanden`); process.exitCode = results.every(Boolean) ? 0 : 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
