// 24/7-Dienst 1.4 ohne Netz: Selbstdiagnose und Bestätigung.
// - Keine Datei der App im Chat (anderer Bot / andere Chat-ID): Protokollzeile mit Bot und Chat (alle 10 min), nach 3 min ein
//   Hinweis per Telegram, höchstens einmal am Tag (auch über einen Neustart), „--status“ mit ✗ und Abhilfe.
// - Datei da: „Übergabe erhalten“, „Alarme geladen“, Bestätigung in der angehefteten Nachricht (mit Version) und lautlos per
//   Telegram („✅ 24/7-Dienst hat übernommen …“, nur Neues, höchstens einmal je Minute, nicht nach Neustart, nicht bei bloßem
//   Entfernen, „⏸“ beim Ausschalten), „Kursprüfung“, „Alarm ausgelöst“, „Telegram gesendet“, Übersicht alle 10 min.
// - Datei von einem anderen Bot (Gruppe): Bestätigen geht nicht, der Dienst prüft trotzdem und sagt es.
// - Die App liest die Zeile des Dienstes 1.4 (mit „· v1.4.0“) wie bisher. Kein Token im Protokoll.
// Aufruf: node unit-247b.js
process.env.TZ = 'UTC';
const fs = require('fs'), path = require('path'), os = require('os');
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${info ? ' — ' + info : ''}`); };
const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', CHAT = '987654321', M = 60e3;
(async () => {
  const W = await import(process.env.S247_FILE || require('path').join(__dirname, '..', 'server/scalpdesk-247.mjs'));
  const k = (t, o, h, l, c) => [t, String(o), String(h), String(l), String(c), '1', t + M - 1];
  const t0 = Date.UTC(2026, 8, 30, 10, 26); let now = t0 + 5e3;
  // ---- nachgebautes Telegram und Binance ----
  const tgLog = [], files = new Map(); let pinned = null, rows = [k(t0 - 2 * M, 100, 100.5, 99.5, 100), k(t0 - M, 100, 100.4, 99.8, 100), k(t0, 100, 100.2, 99.9, 100)], editFails = '';
  const reply = (r, status = 200) => ({ ok: status < 300, status, json: async () => r });
  globalThis.fetch = async (url, o = {}) => {
    const u = new URL(url), b = o.body ? JSON.parse(o.body) : {};
    if (u.pathname.startsWith(`/file/bot${TOKEN}/`)) return reply(JSON.parse(files.get(u.pathname.split('/').pop())));
    const m = /^\/bot[^/]+\/(\w+)$/.exec(u.pathname);
    if (m) {
      tgLog.push({ method: m[1], ...b, at: now });
      if (m[1] === 'getMe') return reply({ ok: true, result: { id: 123456789, is_bot: true, username: 'kursalarm_bot' } });
      if (m[1] === 'getChat') return reply({ ok: true, result: { id: +CHAT, type: 'private', first_name: 'Nico', ...(pinned ? { pinned_message: pinned } : {}) } });
      if (m[1] === 'getFile') return reply({ ok: true, result: { file_id: b.file_id, file_path: `documents/${b.file_id}` } });
      if (m[1] === 'editMessageCaption') {
        if (editFails) return reply({ ok: false, error_code: 400, description: editFails }, 400);
        if (!pinned || b.message_id !== pinned.message_id) return reply({ ok: false, error_code: 400, description: 'Bad Request: message to edit not found' }, 400);
        if (b.caption === pinned.caption) return reply({ ok: false, error_code: 400, description: 'Bad Request: message is not modified' }, 400);
        pinned = { ...pinned, caption: b.caption, edit_date: Math.floor(now / 1000) }; return reply({ ok: true, result: pinned });
      }
      return reply({ ok: true, result: { message_id: 900 + tgLog.length } });
    }
    if (/klines/.test(u.pathname)) return reply(rows);
    return reply({}, 404);
  };
  const base = { kind: 'scalpdesk-247', v: 1, on: true, tz: 'Europe/Berlin', app: '3.28.0', dev: 'Safari, iPhone', ev: { alarm: true, pos: true, news: false }, econ: { warn: 0, cur: 'usd' }, positions: [] };
  const alarm = (id, price, sym = 'BTCUSDT', dir = 'above') => ({ id, symbol: sym, source: 'spot', dir, price, note: '', armedAt: t0 - M });
  let uid = 0;
  const pin = (conf, from = 123456789) => { uid++; files.set('f' + uid, JSON.stringify(conf)); pinned = { message_id: 501, date: Math.floor(t0 / 1000), from: { id: from, is_bot: true, username: from === 123456789 ? 'kursalarm_bot' : 'anderer_bot' },
    caption: `📌 Scalp Desk · 24/7-Dienst\nApp: 30.09. 12:26 · ${conf.alarms.length} Alarm · Safari, iPhone · #${conf.tag}\nDienst: wartet auf Rückmeldung …`, document: { file_id: 'f' + uid, file_unique_id: 'U' + uid, file_name: 'scalpdesk-247.json' } }; };
  const sentMsgs = since => tgLog.filter(x => x.method === 'sendMessage' && x.at >= since);
  const statePath = path.join(os.tmpdir(), `s247b-${process.pid}.json`); try { fs.unlinkSync(statePath); } catch {}
  let logs = [];
  const make = () => { const w = new W.Watcher({ token: TOKEN, chat: CHAT, statePath, now: () => now, log: (...a) => logs.push(a.join(' ')) }); w.me = { id: 123456789, username: 'kursalarm_bot' }; return w; };
  const step = async (w, ms) => { now += ms; await w.tick(); w.saveStateNow(); };

  // ==== Keine Datei der App (anderer Bot oder andere Chat-ID am Server) ====
  let w = make();
  await w.tick();
  const wl = logs.filter(l => l.startsWith('Warte auf die Übergabe der App'));
  check('Ohne Datei: Protokollzeile mit Chat, Bot und Abhilfe', wl.length === 1 && wl[0].includes('Im Chat 987654321 (privat „Nico“) ist für @kursalarm_bot keine Datei „scalpdesk-247.json“ angeheftet (angeheftet: nichts)')
    && wl[0].includes('müssen Bot @kursalarm_bot und Chat-ID 987654321 eingetragen') && wl[0].includes('Sicherungs-Bot'), wl[0]);
  for (let i = 0; i < 6; i++) await step(w, 25e3); // 2,5 min
  check('… vor Ablauf von 3 Minuten kein Hinweis per Telegram und keine Wiederholung im Protokoll', !sentMsgs(0).length && logs.filter(l => l.startsWith('Warte auf die Übergabe')).length === 1);
  await step(w, 40e3); // über 3 min
  let hint = sentMsgs(0);
  check('Nach 3 Minuten ohne Datei: ein Hinweis per Telegram (mit Ton), mit Bot, Chat-ID und Befehl zum Neu-Eingeben', hint.length === 1 && !hint[0].disable_notification && hint[0].text.startsWith('⏳ Scalp Desk 24/7-Dienst (Server ')
    && hint[0].text.includes('dieser Bot (@kursalarm_bot) und die Chat-ID 987654321 (privat „Nico“)') && hint[0].text.includes('install.sh | sudo bash -s -- --neu') && logs.some(l => /^Hinweis an Telegram gesendet: Dienst wartet auf die Übergabe der App \(Bot @kursalarm_bot, Chat 987654321\)/.test(l)), hint[0]?.text.split('\n')[0]);
  for (let i = 0; i < 30; i++) await step(w, 25e3); // weitere 12,5 min
  check('… kein zweiter Hinweis am selben Tag; Protokollzeile alle 10 Minuten wiederholt', sentMsgs(0).length === 1 && logs.filter(l => l.startsWith('Warte auf die Übergabe')).length === 2, String(logs.filter(l => l.startsWith('Warte auf die Übergabe')).length));
  w = make(); now += 3600e3; await w.tick(); for (let i = 0; i < 9; i++) await step(w, 25e3);
  check('… auch nach einem Neustart nicht erneut (Zeitpunkt in der Zustandsdatei)', sentMsgs(0).length === 1);
  now += 24 * 3600e3; await step(w, 1000);
  check('… nach einem Tag erneut, solange die Datei fehlt', sentMsgs(0).length === 2);
  pinned = { message_id: 77, date: 1, text: 'Wichtig: Termin morgen um 9', from: { id: 987654321 } }; logs = []; w.waitLogAt = 0; await step(w, 25e3);
  check('Angeheftet ist eine andere Nachricht: steht so im Protokoll', logs.some(l => l.includes('(angeheftet: eine andere Nachricht („Wichtig: Termin morgen um 9“))')), logs.find(l => l.startsWith('Warte')));
  logs = []; let ok = await w.status();
  check('--status ohne Datei: ✗ mit Grund und Befehl, Ergebnis „siehe ✗“', ok === false && logs.some(l => l.startsWith('✓ Bot @kursalarm_bot (ID 123456789)')) && logs.some(l => l.startsWith('✓ Chat 987654321 (privat „Nico“) erreichbar'))
    && logs.some(l => l.startsWith('✗ Keine Datei der App angeheftet (angeheftet: eine andere Nachricht')) && logs.some(l => l.includes('--neu')) && logs.at(-1) === 'Ergebnis: siehe ✗ oben.', logs.join(' | ').slice(0, 300));

  // ==== Datei da: übernehmen, bestätigen, prüfen, melden ====
  try { fs.unlinkSync(statePath); } catch {}
  logs = []; tgLog.length = 0; now = t0 + 5e3; pinned = null; w = make(); const tA = now;
  pin({ ...base, tag: 'ab12', at: t0, alarms: [alarm('a1', 103.5)] });
  await w.tick(); w.saveStateNow();
  check('Protokoll: „Übergabe erhalten“ mit Nachricht, Zeit der App, Gerät und Kennung', logs.includes('Übergabe erhalten: Nachricht #501 · App 30.09. 12:26 · Safari, iPhone · #ab12'), logs.find(l => l.startsWith('Übergabe')));
  check('Protokoll: „Alarme geladen“ mit den Marken', logs.includes('Alarme geladen: 1 Alarm, 0 Positionen – Kurs-Alarm BTC auf/über 103,50 USDT'), logs.find(l => l.startsWith('Alarme geladen')));
  const svc = (pinned.caption.split('\n').find(l => l.startsWith('Dienst:')) || '');
  check('Angeheftete Nachricht: „Dienst: aktiv · … · v1.4.0 · #ab12 übernommen“; Protokoll „Bestätigung eingetragen“', svc === `Dienst: aktiv · 30.09. 12:26 · v${W.VERSION} · #ab12 übernommen` && logs.some(l => l.startsWith('Bestätigung eingetragen: angeheftete Nachricht zeigt „aktiv · #ab12 übernommen“')), svc);
  let ack = sentMsgs(tA);
  check('Bestätigung per Telegram: lautlos, mit der neuen Marke und dem Hinweis „auch bei geschlossener App“', ack.length === 1 && ack[0].disable_notification === true
    && ack[0].text === '✅ 24/7-Dienst hat übernommen (12:26 Uhr)\n• Kurs-Alarm BTC auf/über 103,50 USDT\nBeobachtet jetzt: 1 Kurs-Alarm, 0 Positionen mit Stop/Ziel – auch bei geschlossener App.'
    && logs.some(l => l.startsWith('Bestätigung an Telegram gesendet: 1 Marke beobachtet, neu: Kurs-Alarm BTC auf/über 103,50 USDT')), ack[0]?.text.replace(/\n/g, ' ⏎ '));
  check('Protokoll: erste Kursprüfung der neuen Marke mit Kurs und Abstand', logs.some(l => l === 'Kursprüfung: Kurs-Alarm BTC auf/über 103,50 – Kurs 100,00, noch 3,50 % entfernt'), logs.find(l => l.startsWith('Kursprüfung')));
  // App liest die Zeile des Dienstes 1.4 wie bisher
  const appSrc = fs.readFileSync(require('path').join(__dirname, '..', 'weather-widget-v2.html'), 'utf8'), fn = /function s247Parse\(pm, now = Date\.now\(\)\) \{[\s\S]*?\n\}/.exec(appSrc)?.[0], lastFn = /function s247Last\(line, now\) \{[\s\S]*?\n\}/.exec(appSrc)?.[0];
  const s247Parse = new Function('S247_MARK', 'S247_FILE', 'S247_STALE', `const s247IsOurs = m => !!m?.document && (m.document.file_name === S247_FILE || String(m.caption || '').startsWith(S247_MARK)); ${lastFn}; ${fn}; return s247Parse;`)('📌 Scalp Desk · 24/7-Dienst', 'scalpdesk-247.json', 20 * M);
  const st = s247Parse(pinned, now);
  check('Die App erkennt die Bestätigung des Dienstes 1.4 (aktiv, Kennung, frisch)', st.svc?.ok === true && st.svc.tag === 'ab12' && st.fresh === true, JSON.stringify(st.svc));
  // Kurs steigt über den Alarm
  logs = []; rows = [k(t0 - M, 100, 100.4, 99.8, 100), k(t0, 100, 100.2, 99.9, 100), k(t0 + M, 100, 103.7, 100, 103.6)]; const tB = now + 16e3;
  await step(w, 16e3); await step(w, 16e3);
  check('Kurs über dem Alarm: „Alarm ausgelöst“, dann „Telegram gesendet“, Meldung mit Ton', logs.some(l => l === 'Alarm ausgelöst: Kurs-Alarm BTC auf/über 103,50 (Kurs 103,60)') && logs.some(l => /^Telegram gesendet: Kurs-Alarm BTC \(Nachricht #\d+\)$/.test(l))
    && sentMsgs(tB).filter(x => /^🔔 Kurs-Alarm BTC/.test(x.text) && !x.disable_notification).length === 1, logs.filter(l => /^(Alarm|Telegram)/.test(l)).join(' | '));
  // zwei neue Übergaben kurz nacheinander: eine Bestätigung mit dem neuesten Stand, nur das Neue
  const tC = now; pin({ ...base, tag: 'cd34', at: now, alarms: [alarm('a1', 103.5), alarm('e1', 2600, 'ETHUSDT')] }); w.next.config = 0; await step(w, 1000);
  pin({ ...base, tag: 'ef56', at: now, alarms: [alarm('a1', 103.5), alarm('e1', 2600, 'ETHUSDT'), alarm('s1', 150, 'SOLUSDT', 'below')] }); w.next.config = 0; await step(w, 5000);
  check('Neue Übergabe innerhalb einer Minute: noch keine zweite Bestätigung', sentMsgs(tC).filter(x => x.text.startsWith('✅')).length === 0);
  for (let i = 0; i < 4; i++) await step(w, 16e3);
  ack = sentMsgs(tC).filter(x => x.text.startsWith('✅'));
  check('… danach eine Bestätigung mit beiden neuen Alarmen (ohne den schon bestätigten)', ack.length === 1 && ack[0].text.includes('• Kurs-Alarm ETH auf/über 2.600,00 USDT\n• Kurs-Alarm SOL auf/unter 150,00 USDT\nBeobachtet jetzt: 3 Kurs-Alarme') && !ack[0].text.includes('BTC'), ack[0]?.text.replace(/\n/g, ' ⏎ '));
  // nur entfernt (z. B. Alarm ausgelöst und aus der App genommen): keine Bestätigung
  const tD = now; pin({ ...base, tag: 'gh78', at: now, alarms: [alarm('e1', 2600, 'ETHUSDT'), alarm('s1', 150, 'SOLUSDT', 'below')] }); w.next.config = 0; for (let i = 0; i < 5; i++) await step(w, 16e3);
  check('Übergabe, die nur etwas entfernt: keine Bestätigung per Telegram (aber in der angehefteten Nachricht bestätigt)', !sentMsgs(tD).some(x => x.text.startsWith('✅')) && / · #gh78 übernommen$/.test(pinned.caption.split('\n').find(l => l.startsWith('Dienst:'))));
  // Neustart mit derselben Datei: keine erneute Bestätigung, Protokoll nennt den gespeicherten Stand
  const tE = now; logs = []; w = make(); w.stopped = true; const realExit = process.exit; process.exit = () => {}; try { await w.start(); } finally { process.exit = realExit; }
  await w.tick(); for (let i = 0; i < 4; i++) await step(w, 16e3);
  check('Neustart mit derselben Datei: Protokoll „gestartet · Bot … · Chat …“ und „Übergabe aus dem gespeicherten Zustand“, keine neue Bestätigung', logs.some(l => /^Scalp Desk 24\/7-Dienst \d+\.\d+\.\d+ gestartet · Bot @kursalarm_bot \(ID 123456789\) · Chat 987654321 · Node .* · prüft die Übergabe alle 20 s, die Kurse alle 15 s$/.test(l))
    && logs.some(l => l.startsWith('Übergabe aus dem gespeicherten Zustand (#gh78): 2 Marken – Kurs-Alarm ETH')) && !sentMsgs(tE).some(x => x.text.startsWith('✅')), logs.slice(0, 3).join(' | '));
  // Übersicht alle 10 Minuten
  logs = []; for (let i = 0; i < 40; i++) await step(w, 16e3);
  const sum = logs.filter(l => l.startsWith('Lebenszeichen:'));
  check('Alle 10 Minuten eine Übersicht: aktiv, Marken, Kursprüfungen, Kurse', sum.length === 1 && /^Lebenszeichen: aktiv · 2 Marken beobachtet · \d+ Kursprüfungen seit der letzten Übersicht · (ETH|SOL) /.test(sum[0]), sum.join(' | '));
  // Übergabe ausgeschaltet
  const tF = now; pin({ ...base, tag: 'ij90', at: now, on: false, alarms: [] }); w.next.config = 0; for (let i = 0; i < 5; i++) await step(w, 16e3);
  check('Übergabe in der App ausgeschaltet: „⏸ … ausgeschaltet“ (lautlos)', sentMsgs(tF).filter(x => x.text.startsWith('⏸ 24/7-Dienst: Übergabe in der App ausgeschaltet') && x.disable_notification).length === 1);
  // --status mit bestätigter Datei
  pin({ ...base, tag: 'kl12', at: now, alarms: [alarm('a1', 103.5)] }); w.next.config = 0; for (let i = 0; i < 2; i++) await step(w, 16e3);
  logs = []; ok = await w.status();
  check('--status mit Datei: ✓ Datei, ✓ vom Dienst bestätigt (mit Version), ✓ beobachtete Marken, Zustand, Binance; Ergebnis in Ordnung', ok === true && logs.some(l => l.startsWith('✓ Datei der App angeheftet (Nachricht #501) – App: '))
    && logs.some(l => l.startsWith(`✓ Vom Dienst bestätigt: „Dienst: aktiv · 30.09. `) && l.includes(`v${W.VERSION} · #kl12 übernommen“`)) && logs.some(l => l === '✓ Beobachtet: Kurs-Alarm BTC auf/über 103,50 USDT')
    && logs.some(l => l.startsWith('• Zustand: zuletzt zugestellt')) && logs.some(l => l.startsWith('✓ Binance Spot erreichbar')) && logs.at(-1) === 'Ergebnis: alles in Ordnung.', logs.join(' | ').slice(0, 400));

  // ==== Datei von einem anderen Bot (Gruppe mit zwei Bots) ====
  try { fs.unlinkSync(statePath); } catch {}
  logs = []; tgLog.length = 0; now = t0 + 5e3; w = make(); rows = [k(t0 - 2 * M, 100, 100.5, 99.5, 100), k(t0 - M, 100, 100.4, 99.8, 100), k(t0, 100, 100.2, 99.9, 100)];
  pin({ ...base, tag: 'xy12', at: t0, alarms: [alarm('a9', 103.5)] }, 555666777); editFails = "Bad Request: message can't be edited";
  await w.tick(); await step(w, 16e3);
  check('Fremder Bot: Protokoll nennt beide Bots; Bestätigen geht nicht, der Dienst prüft trotzdem weiter', w.conf?.data?.tag === 'xy12' && logs.some(l => l.includes('stammt von @anderer_bot, dieser Dienst nutzt @kursalarm_bot'))
    && logs.some(l => l.includes("nicht möglich – die angeheftete Datei hat ein anderer Bot gesendet")), logs.filter(l => /Bot|Bestätigung/.test(l)).join(' | ').slice(0, 300));
  rows = [k(t0 - M, 100, 100.4, 99.8, 100), k(t0, 100, 100.2, 99.9, 100), k(t0 + M, 100, 103.7, 100, 103.6)]; const tG = now;
  await step(w, 16e3); await step(w, 16e3);
  check('… und meldet den Alarm', sentMsgs(tG).some(x => /^🔔 Kurs-Alarm BTC/.test(x.text)));
  editFails = '';
  check('Kein Token im Protokoll', !logs.some(l => l.includes(TOKEN)));
  try { fs.unlinkSync(statePath); } catch {}
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('✗ Abbruch — ' + e.stack); process.exit(1); });
