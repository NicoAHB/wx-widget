// 3.23.0 – Schritt 5.1: 24/7-Dienst. App und echter Dienst (server/scalpdesk-247.mjs als eigener Prozess) gegen die
// Attrappe von Telegram und Binance. Geprüft: Übergabe als angeheftete Datei (Inhalt ohne Token, Mengen, Einstiege), Status
// in der App (wartet → Übergeben ✓ vom Dienst bestätigt), Alarm kommt genau einmal – vom Dienst, die App sendet ihn nicht zusätzlich; Dienst
// schweigt zu lange → App sendet wieder selbst; Ausschalten übergibt „ausgeschaltet“; Anleitung mit Kopier-Knöpfen,
// Handy ohne seitliches Scrollen. Aufruf: node m36.js
const h = require('./harness'), { spawn } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', CHAT = '987654321';
const CHAN = { tg: { token: TOKEN, chat: CHAT, on: true }, dc: { url: '', on: true }, ev: { alarm: true, pos: true, day: true, news: true } };
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const openChan = async page => { await page.click('#notify-menu'); await page.waitForTimeout(250); await page.click('#chan-open'); await page.waitForTimeout(500); };
const mock = p => fetch('http://127.0.0.1:8790' + p).then(r => r.json());
const tgMsgs = () => mock(`/tgmsgs?chat=${CHAT}`);
const pinnedMsg = async () => { const m = (await tgMsgs()).filter(x => x.pinnedAt).sort((a, b) => b.message_id - a.message_id)[0] || null; if (m) m.caption = String(m.caption || '').replace(/\r/g, ''); return m; };
const texts = async () => (await h.ctl('/sent')).filter(m => m.svc === 'tg' && m.text).map(m => m.text);
const until = async (fn, ms = 20000, step = 250) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
function startService(dir) {
  const env = { ...process.env, SCALPDESK_FAST: '1', NODE_TLS_REJECT_UNAUTHORIZED: '0', SCALPDESK_TG_API: 'https://127.0.0.1/_h/api.telegram.org', SCALPDESK_SPOT_API: 'https://127.0.0.1/_h/data-api.binance.vision',
    SCALPDESK_FUT_API: 'https://127.0.0.1/_h/fapi.binance.com', SCALPDESK_CAL_URL: 'https://127.0.0.1/_h/raw.githubusercontent.com/NicoAHB/wx-widget/kalender/calendar.json', NODE_NO_WARNINGS: '1' };
  for (const k of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']) delete env[k];
  fs.writeFileSync(path.join(dir, 'conf.json'), JSON.stringify({ token: TOKEN, chat: CHAT }));
  const p = spawn('node', [require('path').join(__dirname, '..', 'server/scalpdesk-247.mjs'), '--config', path.join(dir, 'conf.json'), '--state', path.join(dir, 'state.json')], { env });
  p.log = []; p.stdout.on('data', d => p.log.push(String(d).trim())); p.stderr.on('data', d => p.log.push('! ' + String(d).trim()));
  return p;
}
(async () => {
  await h.setup(); await h.sleep(300); await h.ctl('/reset'); await h.ctl('/tgreset'); await h.ctl('/walk?on=0');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm36-')), browser = await h.launch(); let svc = null;
  try {
    const p0 = (await h.ctl('/state')).price.BTCUSDT, now = Date.now(), up = +(p0 * 1.01).toFixed(2), down = +(p0 * 0.99).toFixed(2);
    const ALARMS = [{ id: 'up1', symbol: 'BTCUSDT', dir: 'above', price: up, note: 'Test 24/7', source: 'spot', createdAt: now, triggeredAt: null, triggerPrice: null },
      { id: 'dn1', symbol: 'BTCUSDT', dir: 'below', price: down, note: '', source: 'spot', createdAt: now, triggeredAt: null, triggerPrice: null }];
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Europe/Berlin' });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: h.URL_BASE });
    await ctx.addInitScript(([c, a]) => { if (!localStorage.getItem('scalpdesk.channels.v1')) { localStorage.setItem('scalpdesk.channels.v1', JSON.stringify(c)); localStorage.setItem('scalpdesk.alarms.v1', JSON.stringify(a)); } }, [CHAN, ALARMS]);
    const page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page); await page.waitForTimeout(1500);
    await openChan(page);
    const st = () => page.evaluate(() => ({ on: document.getElementById('s247-on').checked, text: document.getElementById('s247-status').textContent, cls: document.getElementById('s247-status').className, sum: document.getElementById('chan-summary').textContent }));
    let s = await st();
    check('Fenster „Alarme aufs Smartphone“: Abschnitt 24/7-Dienst, aus', !s.on && /^Aus/.test(s.text), s.text);
    // ---- Einschalten: Datei senden und anheften ----
    await page.check('#s247-on');
    const pin1 = await until(async () => { const m = await pinnedMsg(); return m && /^📌 Scalp Desk · 24\/7-Dienst\n/.test(m.caption) ? m : null; }, 15000);
    const body = pin1 ? JSON.parse(pin1.content) : {};
    check('Einschalten: Datei scalpdesk-247.json gesendet und angeheftet, Beschriftung „wartet auf Rückmeldung“', pin1 && pin1.document.file_name === 'scalpdesk-247.json' && /\nDienst: wartet auf Rückmeldung …$/.test(pin1.caption), pin1?.caption.replace(/\n/g, ' ⏎ '));
    check('Inhalt: 2 aktive Alarme, Zeitzone, Termin-Warnung; ohne Token und Chat-ID', body.kind === 'scalpdesk-247' && body.on === true && body.alarms?.length === 2 && body.tz === 'Europe/Berlin' && body.econ?.warn === 15
      && !pin1.content.includes(TOKEN) && !pin1.content.includes(CHAT) && /^[a-z0-9]{4}$/.test(body.tag), JSON.stringify({ n: body.alarms?.length, tz: body.tz, econ: body.econ, tag: body.tag }));
    const pinSends = (await h.ctl('/sent')).filter(m => m.method === 'pinChatMessage');
    check('Anheften ohne Ton (disable_notification)', pinSends.length === 1 && String(pinSends[0].silent) === 'true', JSON.stringify(pinSends));
    s = await until(async () => { const x = await st(); return /wartet auf den 24\/7-Dienst/.test(x.text) ? x : null; }, 8000) || await st();
    check('Status: übergeben, wartet auf die Bestätigung des Dienstes', /Übergeben um \d\d:\d\d \(2 Alarme, 0 Positionen\) – wartet auf die Bestätigung des 24\/7-Dienstes/.test(s.text), s.text);
    // ---- Dienst starten: liest die Datei, bestätigt ----
    svc = startService(dir);
    const conf1 = await until(async () => { const m = await pinnedMsg(); return m && new RegExp(`\\nDienst: aktiv · .* · #${body.tag} übernommen(\\n|$)`).test(m.caption) ? m : null; }, 15000);
    check('Dienst liest die angeheftete Datei und bestätigt in der Beschriftung', !!conf1, (conf1 || await pinnedMsg())?.caption.split('\n').at(-1));
    await page.click('#s247-check');
    s = await until(async () => { const x = await st(); return /^Übergeben ✓ vom Dienst bestätigt/.test(x.text) ? x : null; }, 8000) || await st();
    check('App: „Übergeben ✓ vom Dienst bestätigt um … (2 Alarme, 0 Positionen · Dienst 1.4.0)“, Übersicht „24/7-Dienst: aktiv“', /^Übergeben ✓ vom Dienst bestätigt um \d\d:\d\d \(2 Alarme, 0 Positionen · Dienst \d+\.\d+\.\d+\)/.test(s.text) && /ok/.test(s.cls) && /24\/7-Dienst: aktiv/.test(s.sum), s.text.slice(0, 90));
    // ---- Alarm: genau eine Nachricht, vom Dienst ----
    const before = (await texts()).length;
    await h.ctl(`/wick?symbol=BTCUSDT&to=${(up * 1.002).toFixed(2)}`);
    await until(async () => (await texts()).slice(before).some(t => /Kurs-Alarm BTC/.test(t)), 15000); await h.sleep(4000);
    const al = (await texts()).slice(before).filter(t => /Kurs-Alarm BTC/.test(t));
    const appSaw = await page.evaluate(() => [...document.querySelectorAll('.toast')].some(t => /Kurs-Alarm|auf\/über/.test(t.textContent)) || /ausgelöst|erreicht/.test(document.getElementById('alarms')?.textContent || ''));
    check('Alarm erreicht: genau eine Telegram-Nachricht, vom 24/7-Dienst; die App zeigt ihn, sendet ihn aber nicht zusätzlich', al.length === 1 && /· 24\/7-Dienst$/.test(al[0]) && appSaw, `${al.length} Nachricht(en): ${al.map(t => t.split('\n').at(-1)).join(' | ')}`);
    // 3.26.0: Der ausgelöste Alarm bleibt noch 3 Minuten in der Übergabe (der Dienst prüft die Kurse nur alle 15 s – so meldet er
    // ihn sicher, auch wenn die App ihn zuerst sieht); danach übergibt die App den neuen Stand (1 Alarm), der Dienst bestätigt ihn
    const t2 = Date.now(), still = await pinnedMsg(), stillB = still?.content ? JSON.parse(still.content) : null;
    check('Ausgelöster Alarm (vom Dienst gemeldet): bleibt zunächst in der Übergabe', stillB?.alarms.length === 2, JSON.stringify(stillB?.alarms.map(x => x.id)));
    const pin2 = await until(async () => { const m = await pinnedMsg(); if (!m?.content) return null; const b = JSON.parse(m.content); return b.alarms.length === 1 && b.tag !== body.tag && new RegExp(`#${b.tag} übernommen(\\n|$)`).test(m.caption) ? m : null; }, 200000, 1000);
    check('… nach etwa 3 Minuten neuer Stand übergeben (1 Alarm) und vom Dienst bestätigt; dieselbe Nachricht ersetzt', !!pin2 && pin2.message_id === pin1.message_id && Date.now() - t2 > 150e3, `${Math.round((Date.now() - t2) / 1000)} s · ${(pin2 || await pinnedMsg())?.caption.replace(/\n/g, ' ⏎ ')}`);
    // ---- Dienst fällt aus (Lebenszeichen alt) → App sendet wieder selbst ----
    svc.kill('SIGTERM'); await h.sleep(800);
    const pm = await pinnedMsg(); await h.ctl(`/tgedit?id=${pm.message_id}&edit=${Math.floor((Date.now() - 25 * 60e3) / 1000)}`);
    await page.click('#s247-check');
    s = await until(async () => { const x = await st(); return /nicht gemeldet/.test(x.text) ? x : null; }, 8000) || await st();
    check('Lebenszeichen älter als 20 Minuten: „⚠ Der Dienst hat sich seit … nicht gemeldet – die App sendet wieder selbst“', /^⚠ Der Dienst hat sich seit \d\d:\d\d nicht gemeldet – die App sendet wieder selbst/.test(s.text) && !/24\/7-Dienst: aktiv/.test(s.sum), s.text.slice(0, 90));
    const before2 = (await texts()).length;
    await h.ctl(`/wick?symbol=BTCUSDT&to=${(down * 0.998).toFixed(2)}`);
    const own = await until(async () => (await texts()).slice(before2).find(t => /Kurs-Alarm BTC/.test(t)), 15000);
    check('Zweiter Alarm ohne Dienst: die App sendet ihn selbst', !!own && !/24\/7-Dienst/.test(own), own?.split('\n')[0]);
    // ---- Ausschalten: „ausgeschaltet“ übergeben ----
    await page.uncheck('#s247-on');
    const off = await until(async () => { const m = await pinnedMsg(); if (!m?.content) return null; const b = JSON.parse(m.content); return b.on === false ? { m, b } : null; }, 15000);
    s = await st();
    check('Ausschalten: Stand „Übergabe ausgeschaltet“ ohne Alarme übergeben, Status „Aus“', off && off.b.alarms.length === 0 && /· Übergabe ausgeschaltet · /.test(off.m.caption) && /^Aus/.test(s.text), off?.m.caption.split('\n')[1]);
    // ---- Anleitung ----
    await page.click('#s247-guide summary'); await page.waitForTimeout(300);
    const guide = await page.evaluate(() => { const g = document.getElementById('s247-guide'); return { open: g.open, steps: g.querySelectorAll('ol > li').length, text: g.textContent }; });
    check('Anleitung: 5 Schritte (Konto Frankfurt, Server, Cloud Shell, Installieren, Übergeben) und Tipps', guide.open && guide.steps === 5 && /Germany Central \(Frankfurt\)/.test(guide.text) && /install\.sh \| sudo bash/.test(guide.text) && /Pay As You Go/.test(guide.text), `${guide.steps} Schritte`);
    await page.click('#s247-guide [data-copy*="install.sh"]'); await page.waitForTimeout(300);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    check('„Kopieren“ legt den Installationsbefehl in die Zwischenablage', clip === 'curl -fsSL https://raw.githubusercontent.com/NicoAHB/wx-widget/main/server/install.sh | sudo bash', clip);
    check('Computer: keine Fehler', !errors.length, errors.join(' | '));
    await ctx.close();
    // ---- Handy: Fenster ohne seitliches Scrollen ----
    for (const w of [390, 320]) {
      const c2 = await browser.newContext({ viewport: { width: w, height: 700 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, timezoneId: 'Europe/Berlin' });
      await c2.addInitScript(c => localStorage.setItem('scalpdesk.channels.v1', JSON.stringify(c)), CHAN);
      const p2 = await c2.newPage(), e2 = []; h.collect(p2, e2);
      await p2.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(p2); await p2.waitForTimeout(800);
      await openChan(p2);
      await p2.evaluate(() => { document.getElementById('s247-guide').open = true; document.getElementById('s247').scrollIntoView(); }); await p2.waitForTimeout(400);
      const m = await p2.evaluate(() => { const d = document.querySelector('#chan-dialog .sheet-body'), R = e => e.getBoundingClientRect(), box = R(document.getElementById('s247'));
        const out = [...document.querySelectorAll('#s247 *')].filter(e => e.checkVisibility() && R(e).width && (R(e).right > box.right + 1 || R(e).left < box.left - 1)).map(e => e.tagName + '.' + e.className);
        return { sw: d.scrollWidth - d.clientWidth, out, btn: R(document.querySelector('#s247 [data-copy]')).height }; });
      check(`Handy ${w} px: Abschnitt und Anleitung passen, Kopier-Knopf groß genug`, m.sw <= 0 && !m.out.length && m.btn >= 43, JSON.stringify(m));
      check(`Handy ${w} px: keine Fehler`, !e2.length, e2.join(' | ')); await c2.close();
    }
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally {
    if (svc && svc.exitCode === null) svc.kill('SIGTERM');
    if (svc?.log.some(l => l.includes(TOKEN))) check('Dienst-Protokoll ohne Token', false);
    await h.ctl('/reset').catch(() => {}); await browser.close(); await h.teardown(); fs.rmSync(dir, { recursive: true, force: true });
  }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
