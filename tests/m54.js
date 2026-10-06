// 3.33.0 (G05) – Telegram-Chats, Schalter, Steuerung über den 24/7-Dienst, Sendefreigabe (über die Oberfläche, mit echtem Dienst).
// Der Test startet den 24/7-Dienst (server/scalpdesk-247.mjs) selbst auf 127.0.0.1 mit Zugangsschlüssel und Herkunft dieser
// Testseite; Telegram und Binance kommen aus der Attrappe. Kein Dienst-Takt: Erkennen des Dienstes wird durch direkte
// Reservierung nachgestellt.
// local: ohne Dienst – Schalter je Ziel, Sammelschalter (indeterminate), Zählung, nicht eingerichtet, alter Schalter „Aktiv“.
// route: kein Ausweichen – frühere Einrichtung ohne Sicherungschat ausdrücklich übernommen, ohne Sicherungschat keine Sicherung,
//   Alarm nie in den Sicherungschat, „Jetzt senden“ beachtet AUS, Trades-Ziel.
// ctl: mit Dienst – bestätigter Stand, Laden bis zur Bestätigung, Sammelaktion atomar, zweites Gerät, Konflikt, verlorene
//   Antwort (angekommen / nicht angekommen), offline nur Entwurf, kein altes AN nach bestätigtem AUS, Neustart des Dienstes.
// send: Freigabe – App sendet mit Freigabe, Dienst hatte es schon, zwei Geräte, Ziel aus, verlorene Telegram-Antwort, Start nach
//   Auslösung durch den Dienst, Dienst nicht erreichbar (nach 60 s sendet die App mit Vermerk), ohne Dienst strikt.
// Aufruf: node m54.js [local|route|ctl|send]
const path = require('path');
const h = require('./harness');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 500) : ''}`); };
const real = errs => errs.filter(e => !/Service Worker registration blocked|Failed to load resource|ERR_CONNECTION_REFUSED|ERR_EMPTY_RESPONSE|net::ERR/.test(e));
const until = async (fn, ms = 20000, step = 200) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', ALERT = '987654321', BACKUP = '-100555', KEY = 'TestSchluessel_0123456789abcdefghijklmnopq', NOW = Date.now();
const EV = { alarm: true, pos: true, day: true, news: false, pnl: true, pulse: false };
const chanCfg = (o = {}) => ({ tg: { token: TOKEN, chat: ALERT, thread: '', bchat: BACKUP, bthread: '', btoken: '', ...o }, dc: { url: '', on: true }, ev: EV, mig33: true });
async function openPage(browser, seed = {}, { ctx = null, viewport = { width: 1400, height: 1000 } } = {}) {
  ctx = ctx || await browser.newContext({ viewport, acceptDownloads: true, timezoneId: 'Europe/Berlin' });
  if (!ctx.seeded) { ctx.seeded = true; await ctx.addInitScript(items => { if (localStorage.getItem('seeded54')) return; localStorage.setItem('seeded54', '1'); for (const [k, v] of items) localStorage.setItem(k, JSON.stringify(v)); }, Object.entries(seed)); }
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  page.on('dialog', d => void d.accept());
  await page.goto(`${h.URL_BASE}/weather-widget-v2.html`);
  await page.waitForFunction(() => document.getElementById('price').textContent.trim() !== '—', null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  return { ctx, page, errors };
}
const ls = (page, k) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);
const txt = (page, sel) => page.evaluate(sel => document.querySelector(sel)?.textContent ?? null, sel);
const jsClick = (page, sel) => page.evaluate(sel => { const e = document.querySelector(sel); if (!e) throw new Error('fehlt: ' + sel); e.click(); }, sel);
const openTgc = async page => { await page.evaluate(() => { if (!document.getElementById('tgc-dialog').open) document.getElementById('tgc-open').click(); }); await page.waitForTimeout(600); };
const rows = page => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.tgc-row')].map(r => [r.dataset.tgt, { st: r.dataset.state, on: r.querySelector('input').checked, dis: r.querySelector('input').disabled, busy: r.querySelector('input').getAttribute('aria-busy') === 'true', text: r.querySelector('.tgc-st').textContent }])));
const master = page => page.evaluate(() => { const a = document.getElementById('tgc-all'); return { checked: a.checked, ind: a.indeterminate, dis: a.disabled, count: document.getElementById('tgc-count').textContent }; });
const tgSent = async (since, re = /./) => (await h.ctl('/sent')).filter(m => m.svc === 'tg' && !m.method && m.at >= since && re.test(m.text || ''));
const docs = async since => (await h.ctl('/sent')).filter(m => m.svc === 'tg' && /Document|Media/.test(m.method || '') && m.at >= since);

const tests = {
  // ================= ohne Dienst =================
  async local(browser) {
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.channels.v1': chanCfg() });
    await openTgc(page); let r = await rows(page), m = await master(page);
    check('Telegram-Chats: Sicherung, Kursalarm, Trades; Trades „nicht eingerichtet“ (zählt nicht als aktiv)', r.backup.st === 'on' && r['course-alert'].st === 'on' && r.trades.st === 'na' && r.trades.dis && /nicht eingerichtet/.test(r.trades.text), JSON.stringify(r));
    check('„2 von 3 aktiv · 1 nicht eingerichtet“, Sammelschalter an', m.count === '2 von 3 aktiv · 1 nicht eingerichtet' && m.checked && !m.ind, JSON.stringify(m));
    check('Ohne Dienst: „Nur dieses Gerät“, Zeilen „an · nur dieses Gerät“', /^Nur dieses Gerät/.test(await txt(page, '#tgc-mode')) && /nur dieses Gerät/.test(r.backup.text));
    check('Große Schalter sind echte Schalter (role=switch, beschriftet), der Sammelschalter ein Kästchen', await page.evaluate(() => { const i = document.getElementById('tgc-sw-course-alert'); return i.getAttribute('role') === 'switch' && document.getElementById(i.getAttribute('aria-labelledby')).textContent.includes('Kursalarm') && !document.getElementById('tgc-all').hasAttribute('role'); }));
    await page.click('#tgc-sw-course-alert'); await page.waitForTimeout(250); m = await master(page); r = await rows(page);
    check('Kursalarm aus: gemischt → Sammelschalter „indeterminate“, „1 von 3 aktiv“', !r['course-alert'].on && m.ind && !m.checked && m.count.startsWith('1 von 3 aktiv'), JSON.stringify(m));
    await page.click('#tgc-all'); await page.waitForTimeout(250); m = await master(page); r = await rows(page);
    check('Sammelschalter bei gemischt: alle eingerichteten an', r.backup.on && r['course-alert'].on && m.checked && !m.ind);
    await page.click('#tgc-all'); await page.waitForTimeout(250); m = await master(page); const st = (await ls(page, 'scalpdesk.channels.v1')).tgt;
    check('Sammelschalter bei alle an: alle aus (gespeichert), Trades unverändert', !m.checked && !m.ind && m.count.startsWith('0 von 3') && st['course-alert'] === false && st.backup === false && st.trades === true, JSON.stringify(st));
    // Ziel aus: Alarm geht nicht raus
    await page.evaluate(() => document.getElementById('tgc-dialog').close());
    const t0 = Date.now(); const P = (await h.ctl('/state')).price.ETHUSDT;
    await page.evaluate(([p]) => { __g05.state.alarms.push({ id: 'LX1', symbol: 'ETHUSDT', source: 'spot', dir: 'above', price: +(p * 1.0005).toFixed(2), note: '', createdAt: Date.now(), armedAt: Date.now(), triggeredAt: null, triggerPrice: null }); __g05.persist(); __g05.renderAlarms(); __g05.syncStreams(); }, [P]);
    await page.waitForTimeout(1500); await h.ctl(`/set?symbol=ETHUSDT&price=${(P * 1.003).toFixed(2)}`);
    await until(() => page.evaluate(() => !!__g05.state.alarms.find(a => a.id === 'LX1')?.triggeredAt), 15000); await page.waitForTimeout(2000);
    check('Kursalarm aus: Alarm in der App ausgelöst, aber nichts an Telegram', await page.evaluate(() => !!__g05.state.alarms.find(a => a.id === 'LX1')?.triggeredAt) && !(await tgSent(t0, /Kurs-Alarm ETH/)).length);
    // alter Schalter „Aktiv“ aus → alle Ziele aus
    const o = await openPage(browser, { 'scalpdesk.channels.v1': { tg: { token: TOKEN, chat: ALERT, on: false }, dc: { url: '', on: true }, ev: EV } });
    await openTgc(o.page); const m2 = await master(o.page);
    check('Frühere Einrichtung mit Telegram „Aktiv“ aus: alle Ziele aus (0 von 3)', m2.count.startsWith('0 von 3') && !m2.checked, JSON.stringify(m2));
    check('keine Fehler (lokal)', !real(errors).length && !real(o.errors).length, [...real(errors), ...real(o.errors)].join(' | ')); await ctx.close(); await o.ctx.close();
  },

  // ================= kein Ausweichen =================
  async route(browser) {
    const { ctx, page, errors } = await openPage(browser, { 'scalpdesk.channels.v1': { tg: { token: TOKEN, chat: ALERT, thread: '', on: true }, dc: { url: '', on: true }, ev: EV } });
    await page.evaluate(() => { document.getElementById('chan-open').click(); }); await page.waitForTimeout(400);
    const f = await page.evaluate(() => ({ bchat: document.getElementById('tg-bchat').value, sum: document.getElementById('chan-summary').textContent }));
    check('Frühere Einrichtung ohne Sicherungschat: Kursalarm-Chat jetzt ausdrücklich als Sicherungschat eingetragen (sichtbar)', f.bchat === ALERT && /Sicherung: wie Kursalarm \(eingetragen\)/.test(f.sum), JSON.stringify(f));
    await page.evaluate(() => { document.getElementById('tg-bchat').value = ''; document.getElementById('tg-bchat').dispatchEvent(new Event('change', { bubbles: true })); __g05.readChanForm(); document.getElementById('chan-dialog').close(); });
    let t0 = Date.now(); await page.evaluate(() => __g05.sendTgBackup(true)); await page.waitForTimeout(1500);
    check('Sicherungschat geleert: „Jetzt senden“ sendet nichts – kein Ausweichen in den Kursalarm-Chat', !(await docs(t0)).length && /Kein Sicherungschat eingetragen/.test(await txt(page, '#tgb-info')), await txt(page, '#tgb-info'));
    await openTgc(page); let r = await rows(page);
    check('… in Telegram-Chats: Sicherung „nicht eingerichtet“', r.backup.st === 'na');
    await page.evaluate(() => document.getElementById('tgc-dialog').close());
    // Kursalarm ohne Chat, Sicherung eingerichtet: ein Alarm geht nicht in den Sicherungschat
    await page.evaluate(([b]) => { __g05.chan.tg.chat = ''; __g05.chan.tg.bchat = b; __g05.saveChannels(); }, [BACKUP]);
    t0 = Date.now(); await page.evaluate(() => __g05.notifyChannels('alarm', 'al:test:1', '🔔 Kurs-Alarm TEST', 60e3, { ev: 'test:1:price-cross' })); await page.waitForTimeout(1500);
    check('Kursalarm nicht eingerichtet: Alarm geht nirgendwohin (nicht in den Sicherungschat)', !(await tgSent(t0)).length);
    // Sicherung eingerichtet, Ziel aus: „Jetzt senden“ beachtet AUS
    await page.evaluate(([a]) => { __g05.chan.tg.chat = a; __g05.chan.tgt.backup = false; __g05.saveChannels(); }, [ALERT]);
    t0 = Date.now(); await page.evaluate(() => __g05.sendTgBackup(true)); await page.waitForTimeout(1500);
    check('Ziel „Sicherung“ aus: „Jetzt senden“ sendet nicht, Grund steht da', !(await docs(t0)).length && /Ziel „Sicherung“ ist ausgeschaltet/.test(await txt(page, '#tgb-info')), await txt(page, '#tgb-info'));
    await page.evaluate(() => { __g05.chan.tgt.backup = true; __g05.saveChannels(); }); t0 = Date.now(); await page.evaluate(() => __g05.sendTgBackup(true));
    const d = await until(async () => (await docs(t0)).length ? await docs(t0) : null, 10000);
    check('Ziel wieder an: Sicherung geht in den eingetragenen Sicherungschat', d && String(d[0].chat_id) === BACKUP, JSON.stringify(d?.map(x => x.chat_id)));
    // Trades
    await page.evaluate(() => { document.getElementById('chan-open').click(); document.getElementById('tg-tchat').value = '-100777'; __g05.readChanForm(); document.getElementById('chan-dialog').close(); });
    await openTgc(page); r = await rows(page);
    check('Trades-Chat eingetragen: Ziel eingerichtet (Bot der Sicherung), „3 von 3 aktiv“', r.trades.st === 'on' && /Chat -100777/.test(await page.evaluate(() => document.querySelector('.tgc-row[data-tgt="trades"] .tgc-dest').textContent)) && (await master(page)).count === '3 von 3 aktiv');
    check('Routen: Trades → nur Trades-Chat, Sicherung → nur Sicherungschat, Alarme → nur Kursalarm', await page.evaluate(() => __g05.tgTarget('trade').chat === '-100777' && __g05.tgTarget('backup').chat === '-100555' && __g05.tgTarget('alarm').chat === '987654321' && __g05.tgTarget('unbekannt') === null));
    check('keine Fehler (Routen)', !real(errors).length, real(errors).join(' | ')); await ctx.close();
  },

  // ================= mit Dienst: Schalter =================
  async ctl(browser) {
    const { svc, W } = await startSvc(), url = `http://127.0.0.1:${svc.port}`;
    const seed = id => ({ 'scalpdesk.channels.v1': chanCfg(), 'scalpdesk.svc.v1': { url, key: KEY, inst: id } });
    const A = await openPage(browser, seed('ipad0001')); await openTgc(A.page); await until(() => A.page.evaluate(() => /Revision 0/.test(document.getElementById('tgc-mode').textContent)), 8000);
    let r = await rows(A.page);
    check('Mit Dienst: „Gesteuert über den 24/7-Dienst 2.0.0 · bestätigter Stand … · Revision 0 · gilt auf allen Geräten“', /^Gesteuert über den 24\/7-Dienst 2\.0\.0 · bestätigter Stand .* · Revision 0 · gilt auf allen Geräten\.$/.test(await txt(A.page, '#tgc-mode')), await txt(A.page, '#tgc-mode'));
    check('Zeilen mit „an seit … · bestätigt vom 24/7-Dienst“', /^an seit .* · bestätigt vom 24\/7-Dienst$/.test(r['course-alert'].text) && r.trades.st === 'na', r['course-alert'].text);
    // Laden bis zur Bestätigung
    svc.delay = 1500; await A.page.click('#tgc-sw-course-alert'); await A.page.waitForTimeout(400); const mid = await rows(A.page), mm = await master(A.page);
    check('Umschalten: „wird geschaltet …“, Schalter belegt und gesperrt, zeigt den bestätigten Stand (noch an), Sammelschalter gesperrt', mid['course-alert'].st === 'busy' && mid['course-alert'].busy && mid['course-alert'].on && mid['course-alert'].dis && /^wird geschaltet …/.test(mid['course-alert'].text) && mm.dis, JSON.stringify(mid['course-alert']));
    await until(() => A.page.evaluate(() => document.querySelector('.tgc-row[data-tgt="course-alert"]').dataset.state === 'off'), 6000); svc.delay = 0; r = await rows(A.page);
    check('Nach der Bestätigung: aus, „aus seit …“, Revision 1 am Dienst', !r['course-alert'].on && /^aus seit/.test(r['course-alert'].text) && svc.w.pol.rev === 1 && !svc.w.pol.targets['course-alert'].on, JSON.stringify(r['course-alert']));
    // Sammelaktion atomar
    const rev0 = svc.w.pol.rev; await A.page.click('#tgc-all'); await until(() => A.page.evaluate(() => document.getElementById('tgc-all').checked), 5000);
    check('Sammelschalter (gemischt): ein Auftrag, beide eingerichteten Ziele gemeinsam an (Revision +1)', svc.w.pol.rev === rev0 + 1 && svc.w.pol.targets.backup.on && svc.w.pol.targets['course-alert'].on && svc.logs.filter(l => /^Schalter geändert/.test(l)).at(-1).includes('Kursalarm AN'), svc.logs.filter(l => /^Schalter geändert/.test(l)).at(-1));
    await A.page.click('#tgc-all'); await until(() => A.page.evaluate(() => !document.getElementById('tgc-all').checked && !document.getElementById('tgc-all').indeterminate), 5000);
    check('Sammelschalter (alle an): ein Auftrag, Sicherung und Kursalarm gemeinsam aus, Trades (hier nicht eingerichtet) unberührt', svc.w.pol.rev === rev0 + 2 && !svc.w.pol.targets.backup.on && !svc.w.pol.targets['course-alert'].on && svc.w.pol.targets.trades.on && /Sicherung AUS, Kursalarm AUS|Kursalarm AUS, Sicherung AUS/.test(svc.logs.filter(l => /^Schalter geändert/.test(l)).at(-1)), svc.logs.filter(l => /^Schalter geändert/.test(l)).at(-1));
    // zweites Gerät
    const B = await openPage(browser, seed('iphone01')); await openTgc(B.page); await until(() => B.page.evaluate(() => /Revision/.test(document.getElementById('tgc-mode').textContent)), 8000);
    const rb = await rows(B.page);
    check('Zweites Gerät (iPhone): derselbe bestätigte Stand (beide aus, Revision 3)', !rb.backup.on && !rb['course-alert'].on && /Revision 3/.test(await txt(B.page, '#tgc-mode')));
    // Konflikt: A schaltet über den Dienst, B hat noch Revision 3
    await A.page.click('#tgc-sw-course-alert'); await until(() => Promise.resolve(svc.w.pol.rev === 4), 5000);
    await B.page.click('#tgc-sw-backup'); await B.page.waitForTimeout(800);
    check('Konflikt: B (veraltete Revision) wird abgelehnt, sieht den neuen Stand (Kursalarm an) und den Hinweis', /Ein anderes Gerät hat inzwischen geschaltet/.test(await txt(B.page, '#tgc-status')) && (await rows(B.page))['course-alert'].on && !svc.w.pol.targets.backup.on && svc.w.pol.rev === 4, await txt(B.page, '#tgc-status'));
    // verlorene Antwort – Auftrag angekommen
    svc.mode = 'drop-after'; await B.page.click('#tgc-sw-backup'); await until(() => B.page.evaluate(() => document.querySelector('.tgc-row[data-tgt="backup"]').dataset.state === 'unconf'), 8000); let rr = await rows(B.page); svc.mode = '';
    check('Antwort verloren: „Status unbestätigt – zuletzt bestätigt: aus“, Hinweis', rr.backup.st === 'unconf' && /^Status unbestätigt – zuletzt bestätigt: aus/.test(rr.backup.text) && /Status unbestätigt/.test(await txt(B.page, '#tgc-status')), JSON.stringify(rr.backup));
    await until(() => B.page.evaluate(() => document.querySelector('.tgc-row[data-tgt="backup"]').dataset.state === 'on'), 20000); rr = await rows(B.page);
    check('Nachgefragt: Auftrag war angekommen → bestätigt „an seit …“ (kein erfundenes Zurücksetzen)', rr.backup.on && svc.w.pol.targets.backup.on && /war angekommen/.test(await txt(B.page, '#tgc-status')), await txt(B.page, '#tgc-status'));
    // verlorene Anfrage – Auftrag nie angekommen → Entwurf
    svc.mode = 'drop-before'; await B.page.click('#tgc-sw-backup'); await until(() => B.page.evaluate(() => document.querySelector('.tgc-row[data-tgt="backup"]').dataset.state === 'unconf'), 8000); svc.mode = '';
    await until(() => B.page.evaluate(() => !document.getElementById('tgc-draft').hidden), 20000);
    check('Auftrag nicht angekommen: wird Entwurf (nicht wirksam), Dienst unverändert an', svc.w.pol.targets.backup.on && /nicht beim Dienst angekommen/.test(await txt(B.page, '#tgc-status')) && /Entwurf .* \(nicht wirksam\): Sicherung AUS/.test(await txt(B.page, '#tgc-draft')), await txt(B.page, '#tgc-draft'));
    await jsClick(B.page, '#tgc-draft-drop'); await B.page.waitForTimeout(300);
    // offline: nur Entwurf. Fall der Übergabe: B (zuletzt bestätigt AUS) schaltet offline AN; inzwischen schaltet A AN und wieder
    // AUS (bestätigt). Nach dem Wiederverbinden darf das alte Offline-AN nicht von selbst nachgespielt werden.
    await A.page.evaluate(() => __g05.svcRefresh(true)); if ((await rows(A.page))['course-alert'].on) { await A.page.click('#tgc-sw-course-alert'); await until(() => Promise.resolve(!svc.w.pol.targets['course-alert'].on), 5000); }
    await B.page.evaluate(() => __g05.svcRefresh(true)); await svc.stop(); await B.page.evaluate(() => __g05.svcRefresh(true)); await B.page.waitForTimeout(300);
    await B.page.click('#tgc-sw-course-alert'); await B.page.waitForTimeout(400); rr = await rows(B.page);
    check('Offline: AN nur als Entwurf, deutlich „nicht wirksam“, Schalter zeigt den bestätigten Stand (aus)', !svc.running && rr['course-alert'].st === 'draft' && !rr['course-alert'].on && /^Entwurf: AN – nicht wirksam/.test(rr['course-alert'].text) && /als Entwurf gespeichert/.test(await txt(B.page, '#tgc-status')) && /⚠ 24\/7-Dienst nicht erreichbar/.test(await txt(B.page, '#tgc-mode')), JSON.stringify(rr['course-alert']));
    await B.page.click('#tgc-sw-course-alert'); await B.page.waitForTimeout(300);
    check('Zweiter Tipp nimmt den Entwurf zurück', await B.page.evaluate(() => document.getElementById('tgc-draft').hidden) && (await rows(B.page))['course-alert'].st === 'off');
    await B.page.click('#tgc-sw-course-alert'); await B.page.waitForTimeout(300); // wieder Entwurf AN
    await svc.start(); await A.page.evaluate(() => __g05.svcRefresh(true));
    await A.page.click('#tgc-sw-course-alert'); await until(() => Promise.resolve(svc.w.pol.targets['course-alert'].on), 5000);
    await A.page.click('#tgc-sw-course-alert'); await until(() => Promise.resolve(!svc.w.pol.targets['course-alert'].on), 5000);
    await B.page.evaluate(() => __g05.svcRefresh(true)); await B.page.waitForTimeout(1500);
    const dr = await txt(B.page, '#tgc-draft');
    check('Wieder verbunden: altes Offline-AN NICHT von selbst ausgeführt – Kursalarm bleibt am Dienst AUS (von A bestätigt)', !svc.w.pol.targets['course-alert'].on && !(await rows(B.page))['course-alert'].on, JSON.stringify(svc.w.pol.targets['course-alert']));
    check('… Entwurf zeigt den aktuellen Stand und dass er sich geändert hat (Revision … → …)', /Entwurf .* \(nicht wirksam\): Kursalarm AN/.test(dr) && /Aktuell bestätigt am Dienst \(Revision \d+\): .*Kursalarm aus/.test(dr) && /Seit dem Entwurf hat sich der Stand am Dienst geändert/.test(dr), dr);
    await jsClick(B.page, '#tgc-draft-apply'); await until(() => Promise.resolve(svc.w.pol.targets['course-alert'].on), 6000);
    check('Bewusst angewendet: jetzt erst wirksam (Kursalarm AN, Entwurf weg)', svc.w.pol.targets['course-alert'].on && await B.page.evaluate(() => document.getElementById('tgc-draft').hidden));
    // Neustart des Dienstes
    const revBefore = svc.w.pol.rev; await svc.stop(); await svc.start(); await A.page.evaluate(() => __g05.svcRefresh(true)); await A.page.waitForTimeout(300);
    check('Neustart des Dienstes: bestätigter Stand und Revision erhalten', svc.w.pol.rev === revBefore && new RegExp(`Revision ${revBefore}`).test(await txt(A.page, '#tgc-mode')));
    // Status im Einrichtungsdialog
    await A.page.evaluate(() => { document.getElementById('tgc-dialog').close(); document.getElementById('chan-open').click(); }); await A.page.waitForTimeout(300); await jsClick(A.page, '#svc-check'); await A.page.waitForTimeout(800);
    check('Einrichtung: „✓ Verbunden · Dienst 2.0.0 · … · Gerät ipad0001“', /^✓ Verbunden · Dienst 2\.0\.0 · bestätigter Stand .* · Gerät ipad0001$/.test(await txt(A.page, '#svc-status')), await txt(A.page, '#svc-status'));
    await A.page.evaluate(() => { document.getElementById('svc-key').value = 'falsch_falsch_falsch_falsch_falsch_x'; }); await jsClick(A.page, '#svc-check'); await A.page.waitForTimeout(800);
    check('Falscher Schlüssel: „✗ Zugangsschlüssel falsch …“', /^✗ Zugangsschlüssel falsch/.test(await txt(A.page, '#svc-status')), await txt(A.page, '#svc-status'));
    const sv = await ls(A.page, 'scalpdesk.svc.v1'), bk = await A.page.evaluate(() => JSON.stringify(__g05.backupPayload()));
    check('Zugang bleibt lokal: steht nicht in der Sicherung', !bk.includes(KEY) && !bk.includes('falsch_falsch') && sv.inst === 'ipad0001');
    check('keine Fehler (Steuerung)', !real(A.errors).length && !real(B.errors).length, [...real(A.errors), ...real(B.errors)].join(' | '));
    await A.ctx.close(); await B.ctx.close(); await svc.stop();
  },

  // ================= Sendefreigabe =================
  async send(browser) {
    const { svc, W } = await startSvc(), url = `http://127.0.0.1:${svc.port}`;
    const P = () => h.ctl('/state').then(s => s.price.SOLUSDT);
    const alarm = (id, price, at) => ({ id, symbol: 'SOLUSDT', source: 'spot', dir: 'above', price, note: '', createdAt: at, armedAt: at, triggeredAt: null, triggerPrice: null });
    const raise = async p0 => { await h.ctl(`/set?symbol=SOLUSDT&price=${(p0 * 1.004).toFixed(3)}`); };
    await h.ctl('/walk?on=0'); await h.ctl('/set?symbol=SOLUSDT&price=150');
    // 1) App sendet mit Freigabe
    let at = Date.now() - 60e3, a1 = alarm('S1', 150.3, at);
    const A = await openPage(browser, { 'scalpdesk.channels.v1': chanCfg(), 'scalpdesk.svc.v1': { url, key: KEY, inst: 'ipad0001' }, 'scalpdesk.alarms.v1': [a1] });
    await until(() => A.page.evaluate(() => __g05.svc.reach === true), 8000);
    let t0 = Date.now(); await raise(150);
    let got = await until(async () => (await tgSent(t0, /Kurs-Alarm SOL/)).length ? await tgSent(t0, /Kurs-Alarm SOL/) : null, 15000); await A.page.waitForTimeout(1500);
    let e = svc.w.evs[W.alarmEvent({ id: 'S1', armedAt: at })];
    check('App erkennt den Alarm: holt die Freigabe und sendet genau einmal; am Dienst „zugestellt“ von dieser App', got?.length === 1 && e?.by === 'app:ipad0001' && e.st === 'confirmed', JSON.stringify({ n: got?.length, e }));
    check('Protokoll des Dienstes: Ereignis-ID, Ziel, Sender, Zustand', svc.logs.some(l => l === `Ereignis ${W.alarmEvent({ id: 'S1', armedAt: at })} · Ziel course-alert · Sender app:ipad0001 · zugestellt`));
    // 2) Dienst hatte es schon
    await h.ctl('/set?symbol=SOLUSDT&price=150'); await A.page.waitForTimeout(1200); at = Date.now() - 30e3;
    await A.page.evaluate(([a]) => { __g05.state.alarms.push(a); __g05.persist(); __g05.renderAlarms(); }, [alarm('S2', 150.3, at)]);
    svc.w.reserveOwn(W.alarmEvent({ id: 'S2', armedAt: at }), 'Kurs-Alarm SOL'); svc.w.evSet(W.alarmEvent({ id: 'S2', armedAt: at }), 'confirmed');
    t0 = Date.now(); await raise(150); await until(() => A.page.evaluate(() => !!__g05.state.alarms.find(x => x.id === 'S2')?.triggeredAt), 10000); await A.page.waitForTimeout(2500);
    check('Dienst hatte das Ereignis schon: App sendet nicht (keine Freigabe), „Letzte Meldungen“ nennt den Dienst', !(await tgSent(t0, /Kurs-Alarm SOL/)).length && await A.page.evaluate(() => __g05.svcLog.some(x => /der 24\/7-Dienst hat es schon/.test(x.what))), JSON.stringify(await A.page.evaluate(() => __g05.svcLog.slice(0, 2))));
    // 3) zwei Geräte
    await h.ctl('/set?symbol=SOLUSDT&price=150'); at = Date.now() - 20e3; const a3 = alarm('S3', 150.3, at);
    for (const pg of [A.page]) await pg.evaluate(([a]) => { __g05.state.alarms.push(a); __g05.persist(); __g05.renderAlarms(); }, [a3]);
    const B = await openPage(browser, { 'scalpdesk.channels.v1': chanCfg(), 'scalpdesk.svc.v1': { url, key: KEY, inst: 'iphone01' }, 'scalpdesk.alarms.v1': [a3] });
    await until(() => B.page.evaluate(() => __g05.svc.reach === true), 8000); await B.page.waitForTimeout(1000);
    t0 = Date.now(); await raise(150);
    await until(() => Promise.all([A.page, B.page].map(p => p.evaluate(() => !!__g05.state.alarms.find(x => x.id === 'S3')?.triggeredAt))).then(v => v.every(Boolean)), 15000); await A.page.waitForTimeout(3000);
    e = svc.w.evs[W.alarmEvent(a3)];
    check('iPad und iPhone offen: genau eine Telegram-Nachricht, Freigabe für eines der Geräte', (await tgSent(t0, /Kurs-Alarm SOL/)).length === 1 && /^app:(ipad0001|iphone01)$/.test(e?.by || '') && e.st === 'confirmed', JSON.stringify({ n: (await tgSent(t0, /Kurs-Alarm SOL/)).length, by: e?.by }));
    await B.ctx.close();
    // 4) Ziel am Dienst aus
    await h.ctl('/set?symbol=SOLUSDT&price=150'); W.policyApply(svc.w.pol, svc.w.cmds, { commandId: 'test-off-01', expectedRevision: svc.w.pol.rev, set: { 'course-alert': false } }, Date.now()); svc.w.saveStateNow();
    await A.page.evaluate(() => __g05.svcRefresh(true)); at = Date.now() - 10e3; await A.page.evaluate(([a]) => { __g05.state.alarms.push(a); __g05.persist(); __g05.renderAlarms(); }, [alarm('S4', 150.3, at)]);
    t0 = Date.now(); await raise(150); await until(() => A.page.evaluate(() => !!__g05.state.alarms.find(x => x.id === 'S4')?.triggeredAt), 10000); await A.page.waitForTimeout(2500);
    check('Kursalarm am Dienst aus: kein Versand', !(await tgSent(t0, /Kurs-Alarm SOL/)).length);
    W.policyApply(svc.w.pol, svc.w.cmds, { commandId: 'test-on-001', expectedRevision: svc.w.pol.rev, set: { 'course-alert': true } }, Date.now()); svc.w.saveStateNow(); await A.page.evaluate(() => __g05.svcRefresh(true));
    // 5) verlorene Telegram-Antwort
    await h.ctl('/set?symbol=SOLUSDT&price=150'); at = Date.now() - 5e3; await A.page.evaluate(([a]) => { __g05.state.alarms.push(a); __g05.persist(); __g05.renderAlarms(); }, [alarm('S5', 150.3, at)]);
    await h.ctl('/chan?tgdrop=1'); t0 = Date.now(); await raise(150);
    await until(async () => svc.w.evs[W.alarmEvent({ id: 'S5', armedAt: at })]?.st === 'unconfirmed', 15000); await A.page.waitForTimeout(12000);
    const s5 = await tgSent(t0, /Kurs-Alarm SOL/);
    check('Telegram-Antwort verloren: am Dienst „Zustellung unbestätigt“, genau ein Sendeversuch (kein zweiter, kein no-cors)', s5.length === 1 && s5[0].dropped && s5[0].mode !== 'no-cors' && svc.w.evs[W.alarmEvent({ id: 'S5', armedAt: at })].st === 'unconfirmed', JSON.stringify(s5.map(x => ({ d: x.dropped, mode: x.mode }))));
    await A.ctx.close();
    // 6) Start nach Auslösung durch den Dienst
    at = Date.now() - 600e3; const a6 = alarm('S6', 150.3, at); const id6 = W.alarmEvent(a6); svc.w.reserveOwn(id6, 'Kurs-Alarm SOL'); svc.w.evSet(id6, 'confirmed');
    t0 = Date.now(); const C = await openPage(browser, { 'scalpdesk.channels.v1': chanCfg(), 'scalpdesk.svc.v1': { url, key: KEY, inst: 'pc000001' }, 'scalpdesk.alarms.v1': [a6] });
    await until(() => C.page.evaluate(() => !!__g05.state.alarms.find(x => x.id === 'S6')?.triggeredAt), 10000);
    check('Start nach Auslösung durch den Dienst: Alarm gilt als ausgelöst „… und gemeldet vom 24/7-Dienst“, App sendet nichts', /und gemeldet vom 24\/7-Dienst/.test(await C.page.evaluate(() => __g05.alarmSub(__g05.state.alarms.find(x => x.id === 'S6')))) && !(await tgSent(t0, /Kurs-Alarm SOL/)).length, await C.page.evaluate(() => __g05.alarmSub(__g05.state.alarms.find(x => x.id === 'S6'))));
    // 7) Dienst nicht erreichbar: nach 60 s sendet die App mit Vermerk
    await h.ctl('/set?symbol=SOLUSDT&price=150'); await svc.stop(); at = Date.now() - 5e3; await C.page.evaluate(([a]) => { __g05.state.alarms.push(a); __g05.persist(); __g05.renderAlarms(); }, [alarm('S7', 150.3, at)]);
    t0 = Date.now(); await C.page.waitForTimeout(1200); await raise(150);
    await C.page.waitForTimeout(20000); const early = (await tgSent(t0, /Kurs-Alarm SOL/)).length;
    const late = await until(async () => (await tgSent(t0, /Kurs-Alarm SOL/)).length ? await tgSent(t0, /Kurs-Alarm SOL/) : null, 75000, 1000);
    check('Dienst nicht erreichbar: erst nach etwa 60 s sendet die App selbst – mit Vermerk', early === 0 && late?.length === 1 && /von der App gesendet – 24\/7-Dienst nicht erreichbar/.test(late[0].text) && late[0].at - t0 >= 55e3, JSON.stringify({ early, n: late?.length, s: late ? Math.round((late[0].at - t0) / 1000) : null }));
    await C.ctx.close();
    // 8) ohne Dienst: strikte Zustellung (verlorene Antwort → kein zweiter Versuch)
    await h.ctl('/set?symbol=SOLUSDT&price=150'); at = Date.now() - 5e3;
    const D = await openPage(browser, { 'scalpdesk.channels.v1': chanCfg(), 'scalpdesk.alarms.v1': [alarm('S8', 150.3, at)] });
    await D.page.waitForTimeout(1000); await h.ctl('/chan?tgdrop=1'); t0 = Date.now(); await raise(150);
    await until(() => D.page.evaluate(() => !!__g05.state.alarms.find(x => x.id === 'S8')?.triggeredAt), 10000); await D.page.waitForTimeout(15000);
    const s8 = await tgSent(t0, /Kurs-Alarm SOL/);
    check('Ohne Dienst: verlorene Antwort → genau ein Versuch, Kanalstatus „Zustellung unbestätigt“', s8.length === 1 && await D.page.evaluate(() => /Zustellung unbestätigt/.test(__g05.chanState.tg?.text || '')), JSON.stringify({ n: s8.length, st: await D.page.evaluate(() => __g05.chanState.tg?.text) }));
    check('keine Fehler (Freigabe)', !real(A.errors).length && !real(C.errors).length && !real(D.errors).length, [...real(A.errors), ...real(C.errors), ...real(D.errors)].join(' | '));
    await D.ctx.close(); await h.ctl('/walk?on=1');
  },
};

// echter 24/7-Dienst (nur die Steuerung), mit Verzögerung und verlorenen Antworten zum Testen
async function startSvc() {
  const W = await import(path.join(__dirname, '..', 'server/scalpdesk-247.mjs')), fs = require('fs'), os = require('os');
  const statePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'm54-')), 'state.json');
  const svc = { logs: [], delay: 0, mode: '', running: false, port: 0, w: null };
  const make = port => { const w = new W.Watcher({ token: TOKEN, chat: ALERT, key: KEY, origins: [h.URL_BASE], listen: `127.0.0.1:${port}`, statePath, log: (...a) => svc.logs.push(a.join(' ')) });
    const orig = w.handle.bind(w);
    w.handle = async (req, res) => {
      if (svc.delay) await h.sleep(svc.delay);
      // verlorene Antworten: so lange, bis der Test die Störung aufhebt (Chrome wiederholt eine auf einer wiederverwendeten
      // Verbindung abgebrochene Anfrage selbst einmal – mit derselben Auftrags-ID, die der Dienst wiedererkennt)
      if (req.method === 'POST' && req.url === '/v1/policy' && svc.mode === 'drop-before') { res.socket.destroy(); return; }
      if (req.method === 'POST' && req.url === '/v1/policy' && svc.mode === 'drop-after') return orig(req, { writeHead() {}, end() { res.socket.destroy(); } });
      return orig(req, res);
    };
    return w; };
  svc.start = async () => { svc.w = make(svc.port || 0); svc.port = await svc.w.listenNow(); svc.running = true; };
  svc.stop = async () => { if (!svc.running) return; svc.running = false; svc.w.saveStateNow(); await new Promise(r => { svc.w.server.closeAllConnections?.(); svc.w.server.close(() => r()); }); };
  await svc.start();
  return { svc, W };
}

(async () => {
  const only = process.argv[2];
  await h.setup(); await h.ctl('/reset'); const browser = await h.launch();
  try { for (const [name, fn] of Object.entries(tests)) { if (only && only !== name) continue; console.log(`\n▶ ${name}`); try { await fn(browser); } catch (e) { check(`${name}: Abbruch`, false, e.stack || e.message); } } }
  finally { await browser.close(); await h.teardown(); }
  const ok = results.filter(r => r.ok).length; console.log(`\n${ok}/${results.length} bestanden`); process.exit(ok === results.length ? 0 : 1);
})();
