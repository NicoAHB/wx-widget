// 3.28.0 / 24/7-Dienst 1.4 – „liefert keine Alarme bei geschlossener App“. Die App übergibt wie in der Bedienung (Schalter im
// Fenster „Telegram / Discord einrichten“), der Dienst läuft als eigener Prozess gegen die Telegram-/Binance-Attrappe.
// gleich: derselbe Bot wie in der App – „Übergeben ✓ vom Dienst bestätigt“ ohne Tippen, Bestätigung „✅ … hat übernommen“
//   (lautlos) in Telegram, Protokoll Übergabe erhalten → Alarme geladen → Kursprüfung → Bestätigung; App schließen, Kurs über
//   den Alarm knapp neben dem Kurs → Telegram-Nachricht vom Dienst (Alarm ausgelöst → Telegram gesendet), genau einmal.
// anders: am Server der Sicherungs-Bot (gleiche Chat-ID) – die App bleibt bei „wartet“, nach 90 s nennt sie Bot und Chat-ID
//   zum Vergleich; der Dienst schreibt „Warte auf die Übergabe …“ ins Protokoll und schickt in SEINEM Chat einen Hinweis.
// status: „--status“ (sudo scalpdesk-247 status) in beiden Fällen. Aufruf: node m49.js [gleich|anders|status]
const h = require('./harness'), { spawn, execFileSync } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const KURS = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', SICH = '555666777:BBQkbXyzSicherungTestToken0123456789', CHAT = '987654321';
const CHAN = { tg: { token: KURS, chat: CHAT, on: true }, dc: { url: '', on: true }, ev: { alarm: true, pos: true, day: true, news: false, pnl: true, pulse: false } };
const until = async (fn, ms = 20000, step = 250) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
const real = errs => errs.filter(e => !/Service Worker registration blocked/.test(e));
const SVC_ENV = () => { const env = { ...process.env, SCALPDESK_FAST: '1', NODE_TLS_REJECT_UNAUTHORIZED: '0', SCALPDESK_TG_API: 'https://127.0.0.1/_h/api.telegram.org', SCALPDESK_SPOT_API: 'https://127.0.0.1/_h/data-api.binance.vision',
  SCALPDESK_FUT_API: 'https://127.0.0.1/_h/fapi.binance.com', SCALPDESK_CAL_URL: 'https://127.0.0.1/_h/raw.githubusercontent.com/NicoAHB/wx-widget/kalender/calendar.json', NODE_NO_WARNINGS: '1' };
  for (const k of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']) delete env[k]; return env; };
function startService(dir, token) {
  fs.writeFileSync(path.join(dir, 'conf.json'), JSON.stringify({ token, chat: CHAT }));
  const p = spawn('node', [require('path').join(__dirname, '..', 'server/scalpdesk-247.mjs'), '--config', path.join(dir, 'conf.json'), '--state', path.join(dir, 'state.json')], { env: SVC_ENV() });
  p.log = []; p.stdout.on('data', d => p.log.push(...String(d).trim().split('\n'))); p.stderr.on('data', d => p.log.push('! ' + String(d).trim()));
  return p;
}
const statusRun = dir => { try { return { code: 0, out: execFileSync('node', [require('path').join(__dirname, '..', 'server/scalpdesk-247.mjs'), '--config', path.join(dir, 'conf.json'), '--state', path.join(dir, 'state.json'), '--status'], { env: SVC_ENV(), encoding: 'utf8', timeout: 30000 }) }; } catch (e) { return { code: e.status, out: String(e.stdout || '') }; } };
async function openApp(browser, P0) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Berlin' }), now = Date.now();
  await ctx.addInitScript(([c, a]) => { if (localStorage.getItem('m49')) return; localStorage.setItem('m49', '1'); localStorage.setItem('scalpdesk.channels.v1', JSON.stringify(c)); localStorage.setItem('scalpdesk.alarms.v1', JSON.stringify(a)); },
    [CHAN, [{ id: 'A1', symbol: 'BTCUSDT', source: 'spot', dir: 'above', price: P0 + 50, note: 'knapp über dem Kurs', createdAt: now - 5000, armedAt: now - 5000, triggeredAt: null, triggerPrice: null }]]);
  const page = await ctx.newPage(), errors = []; h.collect(page, errors);
  await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForTimeout(2500);
  await page.click('#notify-menu'); await page.waitForTimeout(250); await page.click('#chan-open'); await page.waitForTimeout(400);
  await page.check('#s247-on'); // wie in der Bedienung: „An den 24/7-Dienst übergeben“ einschalten
  return { ctx, page, errors };
}
const sentTg = async since => (await h.ctl('/sent')).filter(m => m.svc === 'tg' && !m.method && m.at >= since);

const tests = {
  async gleich(browser) {
    await h.ctl('/reset'); await h.ctl('/tgreset'); await h.ctl('/walk?on=0');
    const P0 = Math.round((await h.ctl('/state')).price.BTCUSDT); await h.ctl(`/set?symbol=BTCUSDT&price=${P0}`);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm49-')); let svc = null;
    try {
      svc = startService(dir, KURS); await h.sleep(1000);
      const t0 = Date.now(), { ctx, page, errors } = await openApp(browser, P0);
      const st = await until(async () => { const t = await page.textContent('#s247-status'); return /^Übergeben ✓ vom Dienst bestätigt/.test(t) ? t : null; }, 40000, 500);
      check('App zeigt ohne Tippen „Übergeben ✓ vom Dienst bestätigt um … (1 Alarm, 0 Positionen · Dienst x.y.z)“', !!st && /^Übergeben ✓ vom Dienst bestätigt um \d\d:\d\d \(1 Alarm, 0 Positionen · Dienst \d+\.\d+\.\d+\)\./.test(st) && /auch bei geschlossener App/.test(st), (st || await page.textContent('#s247-status')).slice(0, 140));
      check('… innerhalb von 30 Sekunden nach dem Einschalten', !!st && Date.now() - t0 < 30000, `${Math.round((Date.now() - t0) / 1000)} s`);
      const ack = (await sentTg(t0)).filter(m => /^✅ 24\/7-Dienst hat übernommen/.test(m.text || ''));
      check('Telegram: Bestätigung „✅ 24/7-Dienst hat übernommen“ mit dem Alarm, lautlos, vom Bot der App', ack.length === 1 && ack[0].disable_notification === true && ack[0].bot === 123456789 && ack[0].text.includes(`• Kurs-Alarm BTC auf/über ${(P0 + 50).toLocaleString('de-DE', { minimumFractionDigits: 2 })} USDT`) && /auch bei geschlossener App\.$/.test(ack[0].text), ack[0]?.text.replace(/\n/g, ' ⏎ '));
      const L = () => svc.log.join('\n');
      check('Protokoll: gestartet · Bot · Chat, Übergabe erhalten, Alarme geladen, Kursprüfung, Bestätigung eingetragen und gesendet',
        / \d+\.\d+\.\d+ gestartet · Bot @test_kursalarm_bot \(ID 123456789\) · Chat 987654321/.test(L()) && /\nÜbergabe erhalten: Nachricht #\d+ · App /.test(L()) && /\nAlarme geladen: 1 Alarm, 0 Positionen – Kurs-Alarm BTC auf\/über /.test(L())
        && /\nKursprüfung: Kurs-Alarm BTC auf\/über .* – Kurs .*, noch 0,0\d % entfernt/.test(L()) && /\nBestätigung eingetragen: /.test(L()) && /\nBestätigung an Telegram gesendet: 1 Marke beobachtet/.test(L()), svc.log.slice(0, 8).join(' | ').slice(0, 400));
      check('keine Fehler (App)', !real(errors).length, real(errors).join(' | ').slice(0, 200));
      // App schließen, dann erreicht der Kurs den Alarm
      await ctx.close(); await h.sleep(500);
      const t1 = Date.now(); await h.ctl(`/set?symbol=BTCUSDT&price=${P0 + 80}`);
      const al = await until(async () => { const x = (await sentTg(t1)).filter(m => /^🔔 Kurs-Alarm BTC/.test(m.text || '')); return x.length ? x : null; }, 20000);
      check('App geschlossen, Kurs über dem Alarm: Telegram-Nachricht vom Dienst (mit Ton, Kennzeichen „24/7-Dienst“)', !!al && al[0].bot === 123456789 && !al[0].disable_notification && /24\/7-Dienst/.test(al[0].text), al ? al[0].text.replace(/\n/g, ' ⏎ ').slice(0, 160) : 'keine Nachricht');
      check('… in unter 10 Sekunden (Dienst prüft hier alle 1,5 s statt 15 s)', !!al && al[0].at - t1 < 10000, al ? `${((al[0].at - t1) / 1000).toFixed(1)} s` : '');
      await h.sleep(4000);
      check('… genau einmal', (await sentTg(t1)).filter(m => /^🔔 Kurs-Alarm BTC/.test(m.text || '')).length === 1);
      check('Protokoll: „Alarm ausgelöst“ und „Telegram gesendet“', /\nAlarm ausgelöst: Kurs-Alarm BTC auf\/über .* \(Kurs .*\)/.test(L()) && /\nTelegram gesendet: Kurs-Alarm BTC \(Nachricht #\d+\)/.test(L()), svc.log.filter(l => /^(Alarm|Telegram)/.test(l)).join(' | '));
      const sr = statusRun(dir);
      check('--status (sudo scalpdesk-247 status): Bot, Chat, Datei, Bestätigung, beobachtete Marken, „alles in Ordnung“', sr.code === 0 && /✓ Bot @test_kursalarm_bot \(ID 123456789\)/.test(sr.out) && /✓ Datei der App angeheftet/.test(sr.out)
        && /✓ Vom Dienst bestätigt: „Dienst: aktiv · .* · v\d+\.\d+\.\d+ · #\w+ übernommen“/.test(sr.out) && /• Zustand: zuletzt zugestellt .* \(Kurs-Alarm BTC\)/.test(sr.out) && /Ergebnis: alles in Ordnung\./.test(sr.out), sr.out.split('\n').slice(0, 9).join(' | ').slice(0, 500));
      check('Kein Token im Protokoll und in der Ausgabe von --status', !L().includes(KURS.split(':')[1]) && !sr.out.includes(KURS.split(':')[1]));
    } finally { svc?.kill(); }
  },
  async anders(browser) {
    await h.ctl('/reset'); await h.ctl('/tgreset'); await h.ctl('/walk?on=0');
    const P0 = Math.round((await h.ctl('/state')).price.BTCUSDT); await h.ctl(`/set?symbol=BTCUSDT&price=${P0}`);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm49-')); let svc = null;
    try {
      svc = startService(dir, SICH); await h.sleep(1000);
      const t0 = Date.now(), { ctx, page, errors } = await openApp(browser, P0);
      await page.waitForTimeout(15000);
      let st = await page.textContent('#s247-status');
      check('Falscher Bot am Server: App wartet („wartet auf die Bestätigung … meist nach 20–30 Sekunden“)', /^Übergeben um \d\d:\d\d \(1 Alarm, 0 Positionen\) – wartet auf die Bestätigung des 24\/7-Dienstes/.test(st), st);
      const hint = (await sentTg(t0)).filter(m => /^⏳ Scalp Desk 24\/7-Dienst/.test(m.text || ''));
      check('Dienst: Hinweis in SEINEM Chat (Sicherungs-Bot), mit seinem Bot, der Chat-ID und dem Befehl --neu', hint.length >= 1 && hint[0].bot === 555666777 && hint[0].text.includes('dieser Bot (@test_sicherung_bot) und die Chat-ID 987654321') && hint[0].text.includes('--neu'), hint[0]?.text.replace(/\n/g, ' ⏎ ').slice(0, 200));
      check('Dienst: Protokoll „Warte auf die Übergabe der App …“ mit Bot und Chat-ID', svc.log.some(l => l.startsWith('Warte auf die Übergabe der App: Im Chat 987654321 (privat „Nico“) ist für @test_sicherung_bot keine Datei')), svc.log[1]);
      st = await until(async () => { const t = await page.textContent('#s247-status'); return /^⚠ Übergeben um/.test(t) ? t : null; }, 100000, 1000);
      check('App nach 90 s: „⚠ … hat nicht bestätigt“ mit Bot und Chat-ID dieser App und dem Prüfbefehl', !!st && st.includes('(hier: Bot @test_kursalarm_bot, Chat-ID 987654321)') && st.includes('sudo scalpdesk-247 status') && st.includes('Sicherungs-Bot'), (st || '').slice(0, 260));
      const sr = statusRun(dir);
      check('--status mit falschem Bot: ✗ keine Datei, Bot des Dienstes genannt, Befehl --neu', sr.code === 1 && /✓ Bot @test_sicherung_bot \(ID 555666777\)/.test(sr.out) && /✗ Keine Datei der App angeheftet \(angeheftet: nichts\)/.test(sr.out) && /--neu/.test(sr.out), sr.out.split('\n').slice(0, 5).join(' | ').slice(0, 400));
      // App schließen: Ohne passenden Bot kann der Dienst nichts melden – genau das zeigen Hinweis und Status
      await ctx.close(); const t1 = Date.now(); await h.ctl(`/set?symbol=BTCUSDT&price=${P0 + 80}`); await h.sleep(6000);
      check('… bei geschlossener App kommt (erwartungsgemäß) keine Alarm-Nachricht – Ursache steht im Hinweis', !(await sentTg(t1)).some(m => /^🔔 Kurs-Alarm/.test(m.text || '')));
      check('keine Fehler (App)', !real(errors).length, real(errors).join(' | ').slice(0, 200));
    } finally { svc?.kill(); }
  },
};
(async () => {
  const only = process.argv[2];
  await h.setup(); const browser = await h.launch();
  try { for (const [name, fn] of Object.entries(tests)) { if (only && only !== name) continue; console.log(`\n▶ ${name}`); try { await fn(browser); } catch (e) { check(`${name}: Abbruch`, false, e.stack?.split('\n').slice(0, 3).join(' ')); } } }
  finally { await browser.close(); await h.teardown(); }
  const ok = results.filter(r => r.ok).length; console.log(`\n${ok}/${results.length} bestanden`); process.exit(ok === results.length ? 0 : 1);
})();
