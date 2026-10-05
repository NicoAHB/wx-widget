// BTC-Puls mit dem 24/7-Dienst (3.24.0, Dienst 1.1): App und echter Dienst (eigener Prozess) gegen die Telegram-/Binance-
// Attrappe. Die App legt die Schwellen je Uhrzeit in die angeheftete Datei, der Dienst bestätigt mit „· Puls“ und meldet eine
// starke BTC-Bewegung (nachts lautlos, mit Vorauswahl) – die App sendet dann nicht zusätzlich. Meldet sich der Dienst nicht
// mehr, sendet die App den Puls wieder selbst. Aufruf: node m43.js
const h = require('./harness'), { spawn } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond, detail }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`); };
const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', CHAT = '987654321';
const CHAN = { tg: { token: TOKEN, chat: CHAT, on: true }, dc: { url: '', on: true }, ev: { alarm: true, pos: true, day: true, news: true, pnl: true, pulse: true } };
const live = page => page.waitForFunction(() => document.getElementById('status').dataset.feed === 'live', null, { timeout: 20000 }).catch(() => {});
const mock = p => fetch('http://127.0.0.1:8790' + p).then(r => r.json());
const pinnedMsg = async () => { const m = (await mock(`/tgmsgs?chat=${CHAT}`)).filter(x => x.pinnedAt).sort((a, b) => b.message_id - a.message_id)[0] || null; if (m) m.caption = String(m.caption || '').replace(/\r/g, ''); return m; };
const pulses = async since => (await h.ctl('/sent')).filter(m => m.svc === 'tg' && /^⚡ BTC-Puls/.test(m.text || '') && m.at >= since);
const until = async (fn, ms = 20000, step = 250) => { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) return null; await h.sleep(step); } };
const tzAt = hour => { const off = (hour - new Date().getUTCHours() + 24) % 24, o = off > 12 ? off - 24 : off; return o === 0 ? 'Etc/GMT' : o > 0 ? `Etc/GMT-${o}` : `Etc/GMT+${-o}`; };
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
  await h.ctl('/shape?symbol=BTCUSDT&interval=1m&kind=flat&n=60'); const P0 = (await h.ctl('/state')).price.BTCUSDT;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm43-')), browser = await h.launch(); let svc = null;
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: tzAt(23) });
    await ctx.addInitScript(c => { if (!localStorage.getItem('scalpdesk.channels.v1')) localStorage.setItem('scalpdesk.channels.v1', JSON.stringify(c)); }, CHAN);
    const page = await ctx.newPage(), errors = []; h.collect(page, errors);
    await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await live(page);
    await page.waitForFunction(() => [...document.querySelectorAll('#watchlist .wl-sig')].every(s => /^[+−]?\d$/.test(s.textContent)), null, { timeout: 30000 }).catch(() => {});
    await page.click('#notify-menu'); await page.waitForTimeout(250); await page.click('#chan-open'); await page.waitForTimeout(500);
    await page.check('#s247-on');
    // Übergabe mit den Schwellen des BTC-Pulses (sobald berechnet)
    const pin = await until(async () => { const m = await pinnedMsg(); if (!m?.content) return null; const b = JSON.parse(m.content); return b.pulse ? { m, b } : null; }, 30000);
    const b = pin?.b || {};
    check('Übergabe: Datei enthält die Puls-Schwellen (24 Stunden × Werktag/Wochenende, 5/15 Min.), Mindestgrößen, Vorauswahl ohne BTC', b.ev?.pulse === true && b.pulse?.thr?.wd?.length === 24 && b.pulse.thr.we.length === 24 && b.pulse.thr.wd.every(x => x.length === 2)
      && JSON.stringify(b.pulse.floor) === '[0.5,0.8]' && b.pulse.watch.join() === 'ETC,BCH,LTC,XRP,NEAR' && !JSON.stringify(b).includes(TOKEN), JSON.stringify({ floor: b.pulse?.floor, watch: b.pulse?.watch, wd0: b.pulse?.thr?.wd?.[0] }));
    svc = startService(dir);
    const conf = await until(async () => { const m = await pinnedMsg(); if (!m?.content) return null; const bb = JSON.parse(m.content); return new RegExp(`\\nDienst: aktiv · .* · Puls · #${bb.tag} übernommen(\\n|$)`).test(m.caption) ? m : null; }, 20000);
    check('Dienst 1.1 bestätigt mit „· Puls“', !!conf, (conf || await pinnedMsg())?.caption.split('\n').at(-1));
    await page.click('#s247-check');
    await until(async () => /^Übergeben ✓ vom Dienst bestätigt/.test(await page.textContent('#s247-status')), 15000);
    check('App: „Übergeben ✓ vom Dienst bestätigt“', /^Übergeben ✓ vom Dienst bestätigt/.test(await page.textContent('#s247-status')), (await page.textContent('#s247-status')).slice(0, 80));
    // Starke Bewegung: genau eine Nachricht, vom Dienst
    await page.waitForTimeout(1500); let t0 = Date.now();
    await h.ctl(`/set?symbol=BTCUSDT&price=${P0 * 0.97}`);
    await until(async () => (await pulses(t0)).length, 15000); await h.sleep(5000);
    let m = await pulses(t0);
    const toast = await page.evaluate(() => [...document.querySelectorAll('#toasts .toast')].some(t => /BTC-Puls/.test(t.textContent)));
    check('BTC −3 %: genau eine Nachricht – vom 24/7-Dienst; die App zeigt den Hinweis, sendet aber nicht zusätzlich', m.length === 1 && /· 24\/7-Dienst$/.test(m[0].text) && toast, m.map(x => x.text.split('\n').at(-1)).join(' | '));
    check('Dienst: Inhalt wie in der App, nachts lautlos, mit Vorauswahl', /^⚡ BTC-Puls: BTC −3,00 % in 5 Min\. \([\d.,]+ USDT\) – ungewöhnlich stark für 23 Uhr \(Schwelle 0,50 %\)\nVorauswahl im selben Zeitraum: ETC [+−]?\d+,\d\d % · BCH .* · NEAR [+−]?\d+,\d\d %\n\d\d:\d\d:\d\d Uhr · 24\/7-Dienst$/.test(m[0]?.text || '') && m[0]?.disable_notification === true,
      `${m[0]?.disable_notification} · ${m[0]?.text.replace(/\n/g, ' ⏎ ')}`);
    // Dienst fällt aus → App sendet den Puls wieder selbst
    svc.kill('SIGTERM'); await h.sleep(800); svc = null;
    const pm = await pinnedMsg(); await h.ctl(`/tgedit?id=${pm.message_id}&edit=${Math.floor((Date.now() - 25 * 60e3) / 1000)}`);
    await page.click('#s247-check'); await until(async () => /nicht gemeldet/.test(await page.textContent('#s247-status')), 8000);
    t0 = Date.now(); await h.ctl(`/set?symbol=BTCUSDT&price=${P0 * 0.95}`);
    const own = await until(async () => { const x = await pulses(t0); return x.length ? x : null; }, 15000);
    check('Dienst meldet sich nicht mehr: die App sendet den Puls selbst („legt weiter zu“, lautlos)', own?.length === 1 && !/24\/7-Dienst/.test(own[0].text) && /BTC −5,00 % in 5 Min\. .* – Bewegung legt weiter zu/.test(own[0].text) && own[0].disable_notification === 'true', own?.[0]?.text.split('\n')[0]);
    check('Keine Fehler', !errors.length, errors.join(' | '));
    await ctx.close();
  } catch (e) { check('Abbruch', false, e.message.split('\n')[0]); }
  finally { if (svc) svc.kill('SIGTERM'); await browser.close(); await h.teardown(); fs.rmSync(dir, { recursive: true, force: true }); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
