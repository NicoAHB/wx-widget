// 3.25.0: Telegram-Sicherung – landet im Sicherungschat und ersetzt immer dieselbe Datei. Gemeldet: Die Sicherung kam im
// Kursalarm-Chat an, und statt die letzte Datei zu ersetzen, lag jedes Mal eine weitere im Chat. Geprüft gegen die
// Telegram-Attrappe (zwei Bots, Privatchats je Bot getrennt, Gruppe mit Themen):
// 1 Update aus 3.23.1 (altes Speicherformat) ersetzt die vorhandene Datei, 2 Kursalarm umstellen → Sicherung bleibt im
// bisherigen Chat, 3 eigener Sicherungs-Bot, 4 zwei Geräte ersetzen dieselbe Datei, 5 Datei gelöscht → genau eine neue,
// 6 24/7-Dienst im selben Chat: dessen Datei bleibt angeheftet, 7 Haupt-Bot wechseln → Sicherung bleibt beim alten Bot.
// Aufruf: node m44.js
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const T1 = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', T2 = '555666777:BBQkbXyzSicherungTestToken0123456789', B1 = 123456789, B2 = 555666777;
const CHAT = '987654321', GROUP = '-1001234567890', FILE = 'scalpdesk-sicherung.json';
const EV = { alarm: true, pos: true, day: true, news: true, pnl: true, pulse: true };
const tgc = o => ({ tg: { token: T1, chat: CHAT, thread: '', bchat: '', bthread: '', btoken: '', on: true, ...o }, dc: { url: '', on: true }, ev: EV });
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const until = async (fn, ms = 20000, step = 250) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
const sent = async since => (await h.ctl('/sent')).filter(m => m.svc === 'tg' && m.at >= since);
const backups = async since => (await sent(since)).filter(m => (m.method === 'sendDocument' || m.method === 'editMessageMedia') && m.name === FILE);
const docs = async (chat, bot) => (await h.ctl(`/tgmsgs?chat=${chat}`)).filter(m => m.document?.file_name === FILE && (!bot || m.bot === bot));
const pinned = async (chat, bot) => (await h.ctl(`/tgmsgs?chat=${chat}`)).filter(m => m.pinnedAt && (Number(chat) < 0 || m.bot === bot)).sort((a, b) => b.pinnedAt - a.pinnedAt)[0] || null;
const openChan = async page => { await page.click('#notify-menu'); await page.waitForTimeout(250); await page.click('#chan-open'); await page.waitForTimeout(500); };
const info = page => page.evaluate(() => ({ text: document.getElementById('tgb-info').textContent, setup: !document.getElementById('tgb-setup').hidden, label: document.getElementById('tgb-setup').textContent }));
async function open(browser, chan, extra = []) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Berlin' });
  await ctx.addInitScript(([c, x]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('scalpdesk.channels.v1', JSON.stringify(c)); for (const [k, v] of x) localStorage.setItem(k, JSON.stringify(v)); }, [chan, extra]);
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page);
  return { ctx, page, errors };
}
const sendNow = async page => { const t0 = Date.now(); await page.evaluate(() => document.getElementById('tgb-now').click()); return until(async () => { const b = await backups(t0); return b.length ? b : null; }, 15000); };
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/tgreset'); await h.ctl('/walk?on=0');
  const browser = await h.launch();
  try {
    // 1. Update aus 3.23.1: gemerkt ist nur „Chat“ (altes Format) – die vorhandene Datei wird ersetzt, keine zweite gesendet
    const old = (await h.ctl(`/tgpin?chat=${CHAT}&bot=${B1}&pin=0&name=${FILE}&caption=${encodeURIComponent('💾 Scalp-Desk-Sicherung · alt')}`)).message_id;
    let t0 = Date.now(), { ctx, page, errors } = await open(browser, tgc({}), [['scalpdesk.tgbackup.v1', { on: true, chat: CHAT, msg: old, at: Date.now() - 864e5, sig: '' }]]);
    let b = await until(async () => { const x = await backups(t0); return x.length ? x : null; }, 15000);
    let d = await docs(CHAT, B1), p = await until(async () => { const x = await pinned(CHAT, B1); return x?.message_id === old ? x : null; }, 5000);
    check('Update aus 3.23.1 (altes Speicherformat): die vorhandene Datei wird ersetzt, keine zweite gesendet', b?.length === 1 && b[0].method === 'editMessageMedia' && b[0].message_id === old && d.length === 1,
      JSON.stringify({ sent: b?.map(x => `${x.method}#${x.message_id}`), docs: d.map(x => x.message_id) }));
    check('… und für die anderen Geräte angeheftet (kein 24/7-Dienst in diesem Chat)', p?.message_id === old, `angeheftet: ${p?.message_id}`);
    let i = await info(page);
    check('Anzeige: Ziel Kursalarm-Chat ohne eigenen Sicherungschat, Knopf „💾 Sicherungschat festlegen …“', /Ziel: Kursalarm-Chat .*kein eigener Sicherungschat eingetragen/.test(i.text) && i.setup && /Sicherungschat festlegen/.test(i.label), `${i.text.split(' · ').slice(-1)[0]} | ${i.label}`);
    // 2. Kursalarm auf ein Gruppen-Thema umstellen: die Sicherung bleibt, wo ihre Datei liegt (als Sicherungschat eingetragen)
    await h.ctl('/tgmulti?on=1'); await openChan(page); await page.click('#tg-detect');
    await page.waitForFunction(() => document.querySelectorAll('#tg-found .tg-found-row').length === 2, null, { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => [...document.querySelectorAll('#tg-found .tg-found-row')].find(r => /Sicherung · ID/.test(r.textContent)).querySelector('button').click());
    await page.waitForTimeout(400);
    const st = await page.evaluate(() => ({ msg: document.getElementById('tg-status').textContent, tg: JSON.parse(localStorage.getItem('scalpdesk.channels.v1')).tg }));
    check('„→ Kursalarm“ auf ein Gruppen-Thema: die Sicherung bleibt im bisherigen Chat, dort als Sicherungschat eingetragen (mit Hinweis)', st.tg.chat === GROUP && st.tg.thread === '12' && st.tg.bchat === CHAT && st.tg.bthread === '' && !st.tg.btoken && /Datensicherung bleibt im bisherigen Chat/.test(st.msg),
      JSON.stringify({ chat: st.tg.chat, thread: st.tg.thread, bchat: st.tg.bchat, msg: st.msg }));
    await page.click('#chan-done'); await h.ctl('/tgmulti?on=0');
    b = await sendNow(page); d = await docs(CHAT, B1);
    check('Nächste Sicherung: wieder dieselbe Datei im bisherigen Chat, nichts im Kursalarm-Thema', b?.length === 1 && b[0].method === 'editMessageMedia' && b[0].message_id === old && d.length === 1 && !(await docs(GROUP)).length,
      JSON.stringify({ sent: b?.map(x => `${x.method}#${x.message_id}@${x.chat_id}`), docs: d.length }));
    i = await info(page);
    check('Anzeige jetzt: „Ziel: Sicherungschat“, kein Einrichtungs-Knopf', /Ziel: Sicherungschat/.test(i.text) && !i.setup, i.text.split(' · ').slice(-1)[0]);
    check('Keine Fehler (1–2)', !errors.length, errors.join(' | ')); await ctx.close();

    // 3. Eigener Sicherungs-Bot: Sicherung über Bot 2 (eigener Privatchat), Alarme über Bot 1
    await h.ctl('/tgreset'); t0 = Date.now();
    ({ ctx, page, errors } = await open(browser, tgc({ btoken: T2 }), [['scalpdesk.tgbackup.v1', { on: true }]]));
    b = await until(async () => { const x = await backups(t0); return x.length ? x : null; }, 15000);
    p = await pinned(CHAT, B2);
    check('Eigener Sicherungs-Bot: die Datei geht über Bot 2 in dessen Chat und wird dort angeheftet; im Kursalarm-Chat (Bot 1) keine', b?.length === 1 && b[0].bot === B2 && b[0].method === 'sendDocument' && p?.message_id === b[0].message_id && !(await docs(CHAT, B1)).length,
      JSON.stringify({ sent: b?.map(x => `${x.method}·Bot ${x.bot}`), pinned: p?.message_id }));
    await openChan(page); t0 = Date.now(); await page.click('#tg-test');
    const test = await until(async () => (await sent(t0)).find(m => !m.method && m.text), 8000);
    check('… „Test senden“ (Kursalarm) geht weiter über Bot 1', test?.bot === B1 && test.chat_id === CHAT, `${test?.bot}`);
    await page.click('#tg-detect'); await page.waitForTimeout(1500);
    const rows = await page.evaluate(() => [...document.querySelectorAll('#tg-found .tg-found-row')].map(r => ({ t: r.querySelector('.tg-found-name').textContent, n: r.querySelectorAll('button').length })));
    check('„Chat-ID ermitteln“ listet auch den Chat des Sicherungs-Bots – nur mit „→ Sicherungschat“', rows.some(r => /über @test_sicherung_bot/.test(r.t) && r.n === 1) && rows.some(r => !/über @/.test(r.t) && r.n === 2), JSON.stringify(rows));
    const sum = await page.evaluate(() => document.getElementById('chan-summary').textContent);
    check('Übersicht: „Sicherung: eigener Bot“', /Sicherung: eigener Bot/.test(sum), sum);
    check('Keine Fehler (3)', !errors.length, errors.join(' | ')); await ctx.close();

    // 4. Zwei Geräte (getrennter Speicher), Sicherungschat = Gruppen-Thema: beide ersetzen dieselbe Datei
    await h.ctl('/tgreset'); t0 = Date.now();
    const both = tgc({ bchat: GROUP, bthread: '12' });
    const A = await open(browser, both, [['scalpdesk.tgbackup.v1', { on: true }]]);
    b = await until(async () => { const x = await backups(t0); return x.length ? x : null; }, 15000);
    const first = b?.[0]?.message_id; p = await pinned(GROUP);
    check('Gerät A: erste Sicherung im Thema „Sicherung“ der Gruppe, angeheftet', b?.length === 1 && b[0].method === 'sendDocument' && b[0].chat_id === GROUP && b[0].thread === '12' && p?.message_id === first, JSON.stringify(b?.map(x => `${x.method}#${x.message_id} Thema ${x.thread}`)));
    t0 = Date.now();
    const Bd = await open(browser, both, [['scalpdesk.tgbackup.v1', { on: true }]]);
    b = await until(async () => { const x = await backups(t0); return x.length ? x : null; }, 15000);
    d = await docs(GROUP);
    check('Gerät B (kennt keine Nachricht): ersetzt die angeheftete Datei von A – weiterhin genau eine Datei', b?.length === 1 && b[0].method === 'editMessageMedia' && b[0].message_id === first && d.length === 1, JSON.stringify({ sent: b?.map(x => `${x.method}#${x.message_id}`), docs: d.length }));
    b = await sendNow(A.page); d = await docs(GROUP);
    check('Gerät A wieder: dieselbe Datei, genau eine im Chat', b?.length === 1 && b[0].message_id === first && d.length === 1, JSON.stringify({ sent: b?.map(x => `${x.method}#${x.message_id}`), docs: d.length }));
    // 5. Nutzer löscht die Datei in Telegram: genau eine neue, wieder angeheftet
    await h.ctl(`/tgdelmsg?id=${first}`);
    b = await sendNow(Bd.page); d = await docs(GROUP); p = await pinned(GROUP);
    const fresh = b?.find(x => x.method === 'sendDocument')?.message_id;
    check('Datei gelöscht: genau eine neue Datei, angeheftet', !!fresh && fresh !== first && d.length === 1 && d[0].message_id === fresh && p?.message_id === fresh, JSON.stringify({ sent: b?.map(x => `${x.method}#${x.message_id}`), docs: d.map(x => x.message_id), pinned: p?.message_id }));
    b = await sendNow(A.page); d = await docs(GROUP);
    check('… danach ersetzt auch Gerät A diese neue Datei (über die angeheftete Nachricht), alte gemerkte Nachricht ohne Folgen', b?.some(x => x.method === 'editMessageMedia' && x.message_id === fresh) && !b.some(x => x.method === 'sendDocument') && d.length === 1, JSON.stringify(b?.map(x => `${x.method}#${x.message_id}`)));
    // gewollt: Telegram antwortet auf die gelöschte Nachricht mit 400 – der Browser meldet das als Ladefehler
    const all45 = [...A.errors, ...Bd.errors], expected400 = all45.filter(e => /status of 400 \(Bad Request\)/.test(e)), other45 = all45.filter(e => !expected400.includes(e));
    check('Keine Fehler (4–5) außer den gewollten 400-Antworten zur gelöschten Datei', !other45.length && expected400.length <= 2, `${expected400.length}× 400${other45.length ? ' | ' + other45.join(' | ') : ''}`); await A.ctx.close(); await Bd.ctx.close();

    // 6. 24/7-Dienst aktiv und Sicherung ohne eigenen Chat: Sicherung nicht anheften – dort hängt die Datei des Dienstes
    await h.ctl('/tgreset'); t0 = Date.now();
    ({ ctx, page, errors } = await open(browser, tgc({}), [['scalpdesk.tgbackup.v1', { on: true }], ['scalpdesk.s247.v1', { on: true }]]));
    b = await until(async () => { const x = await backups(t0); return x.length ? x : null; }, 15000);
    await until(async () => (await pinned(CHAT, B1))?.document?.file_name === 'scalpdesk-247.json', 15000);
    await page.waitForTimeout(1500);
    p = await pinned(CHAT, B1);
    const pinsOfBackup = (await sent(t0)).filter(m => m.method === 'pinChatMessage' && (b || []).some(x => x.message_id === m.message_id));
    check('24/7-Dienst im selben Chat: Sicherung gesendet, aber nicht angeheftet; angeheftet bleibt die Datei des Dienstes', b?.length >= 1 && !pinsOfBackup.length && p?.document?.file_name === 'scalpdesk-247.json', JSON.stringify({ backup: b?.map(x => `${x.method}#${x.message_id}`), pinned: p?.document?.file_name }));
    check('Keine Fehler (6)', !errors.length, errors.join(' | ')); await ctx.close();

    // 7. Haupt-Bot wechseln (bisher lief alles über Bot 2): die Sicherung bleibt beim alten Bot und ersetzt seine Datei
    await h.ctl('/tgreset'); t0 = Date.now();
    ({ ctx, page, errors } = await open(browser, tgc({ token: T2 }), [['scalpdesk.tgbackup.v1', { on: true }]]));
    b = await until(async () => { const x = await backups(t0); return x.length ? x : null; }, 15000);
    const viaB2 = b?.[0]?.message_id;
    await openChan(page); await page.fill('#tg-token', T1); await page.locator('#tg-token').blur(); await page.waitForTimeout(400);
    const st7 = await page.evaluate(() => JSON.parse(localStorage.getItem('scalpdesk.channels.v1')).tg);
    check('Haupt-Token gewechselt: der bisherige Bot wird als eigener Sicherungs-Bot eingetragen', st7.token.startsWith('123456789:') && st7.btoken.startsWith('555666777:') && st7.bchat === CHAT, JSON.stringify({ token: st7.token.slice(0, 9), btoken: st7.btoken.slice(0, 9), bchat: st7.bchat }));
    await page.click('#chan-done');
    b = await sendNow(page);
    check('… die nächste Sicherung ersetzt die Datei beim alten Bot – keine neue im Chat des neuen Bots', b?.length === 1 && b[0].method === 'editMessageMedia' && b[0].message_id === viaB2 && b[0].bot === B2 && !(await docs(CHAT, B1)).length && (await docs(CHAT, B2)).length === 1,
      JSON.stringify(b?.map(x => `${x.method}#${x.message_id}·Bot ${x.bot}`)));
    check('Keine Fehler (7)', !errors.length, errors.join(' | ')); await ctx.close();
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { await browser.close(); await h.teardown(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
