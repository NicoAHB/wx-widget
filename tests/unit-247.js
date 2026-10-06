// Schritt 5.1 – 24/7-Dienst ohne Netz (server/scalpdesk-247.mjs): Anzeige wie in der App, Datei der App prüfen, gehandelte
// Spanne seit der letzten Prüfung (auch Dochte der laufenden Kerze nach dem Scharfschalten), Alarme, Stop/Ziel mit erneutem
// Scharfschalten, Termine, Beschriftung der angehefteten Nachricht – und ob die App (js/s247.js) sie richtig liest.
// 3.26.0 (Dienst 1.2): Gewinn-/Verlust-Alarm – Datei, Rechnung, Text, einmal je Scharfschalten, Warten, von der App gesendet,
// fehlender Kurs, Neustart, Zeile in der angehefteten Nachricht und wie die App sie liest (ausgelöst, „· GV“, nicht doppelt);
// erreicht → erst nach einer Wartezeit melden, vorher die Datei neu lesen (hat die geöffnete App schon gemeldet: schweigen).
// Telegram und Binance sind hier ein nachgebautes fetch. Aufruf: node unit-247.js
process.env.TZ = 'UTC';
const fs = require('fs'), path = require('path'), os = require('os');
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${info ? ' — ' + info : ''}`); };
const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', CHAT = '987654321', M = 60e3;
(async () => {
  const W = await import(process.env.S247_FILE || path.join(require('path').join(__dirname, '..', 'server/scalpdesk-247.mjs'))); // S247_FILE: andere Fassung prüfen
  // ---- Anzeige wie in der App ----
  check('Preise wie in der App (2 Stellen ab 100, 4 unter 100, 4 signifikante unter 1)', W.priceText(64614.15) === '64.614,15' && W.priceText(1.4712) === '1,4712' && W.priceText(0.012345) === '0,01235' && W.priceText(0.5) === '0,5000',
    [W.priceText(64614.15), W.priceText(1.4712), W.priceText(0.012345), W.priceText(0.5)].join(' / '));
  const T = Date.UTC(2026, 8, 30, 10, 26, 5);
  check('Zeit und Stempel in der Zeitzone der App', W.timeText(T, 'Europe/Berlin', true) === '12:26:05' && W.stamp(T, 'Europe/Berlin') === '30.09. 12:26' && W.stamp(T, 'America/New_York') === '30.09. 06:26');
  check('Unbekannte Zeitzone → UTC', W.validTz('Mars/Olympus') === 'UTC' && W.validTz('Europe/Berlin') === 'Europe/Berlin');

  // ---- Datei der App ----
  const base = { kind: 'scalpdesk-247', v: 1, tag: 'ab12', at: T, on: true, tz: 'Europe/Berlin', app: '3.23.0', dev: 'Chrome, Windows', ev: { alarm: true, pos: true, news: true }, econ: { warn: 15, cur: 'usd' },
    alarms: [{ id: 'a1', symbol: 'BTCUSDT', source: 'spot', dir: 'above', price: 65000, note: 'Ausbruch', armedAt: T - 5 * M }, { id: 'x', symbol: 'btc', dir: 'above', price: 1, armedAt: 1 }, { id: 'y', symbol: 'ETHUSDT', dir: 'sideways', price: 1, armedAt: 1 }],
    positions: [{ id: 'p1', symbol: 'ETHUSDT', source: 'futures', side: 'long', tp: 2600, sl: 2450, since: T - 60 * M, ack: { tp: false, sl: true } }, { id: 'p2', symbol: 'XRPUSDT', side: 'long', tp: null, sl: null, since: 1 }] };
  const c = W.parseConfig(base);
  check('Datei: gültige Einträge übernommen, ungültige verworfen (Kürzel, Richtung, Position ohne Marken)', c.alarms.length === 1 && c.positions.length === 1 && c.positions[0].ack.sl === true && c.positions[0].source === 'futures' && c.tag === 'ab12' && c.econ.warn === 15);
  let err = ''; try { W.parseConfig({ kind: 'etwas', v: 1 }); } catch (e) { err = e.message; }
  check('Datei: fremde Datei abgelehnt', /keine Scalp-Desk-Datei/.test(err));
  const c2 = W.parseConfig({ ...base, econ: { warn: 7, cur: 'x' }, ev: { news: false }, tz: 'Nirgendwo', on: false });
  check('Datei: unbekannte Termin-Minuten → aus, Zeitzone → UTC, Übergabe aus', c2.econ.warn === 0 && c2.econ.cur === 'usd' && c2.ev.news === false && c2.ev.alarm === true && c2.tz === 'UTC' && c2.on === false);
  check('Erkennt die angeheftete Datei (Dateiname oder Beschriftung)', W.isConfigMessage({ document: { file_name: 'scalpdesk-247.json' } }) && W.isConfigMessage({ document: { file_name: 'x.json' }, caption: '📌 Scalp Desk · 24/7-Dienst\n…' }) && !W.isConfigMessage({ document: { file_name: 'scalpdesk-sicherung.json' }, caption: '💾 Sicherung' }) && !W.isConfigMessage({ text: 'hallo' }));

  // ---- Gehandelte Spanne seit der letzten Prüfung ----
  const k = (t, o, h, l, c) => [t, String(o), String(h), String(l), String(c), '1', t + M - 1];
  const t0 = Date.UTC(2026, 8, 30, 10, 0), rows = [k(t0, 100, 101, 99, 100), k(t0 + M, 100, 104, 98, 102), k(t0 + 2 * M, 102, 103, 101, 102.5)];
  let v = W.rangeView(rows, t0 + 2 * M + 10e3, t0 + 2 * M + 10e3);
  check('Erste Prüfung nach dem Scharfschalten: nur der aktuelle Kurs (laufende Kerze begann davor)', v.price === 102.5 && v.hi === 102.5 && v.lo === 102.5, JSON.stringify(v));
  v = W.rangeView(rows, t0 + M + 30e3, t0 + M);
  check('Kerzen ab dem Scharfschalten zählen mit Hoch und Tief, ältere nicht', v.hi === 104 && v.lo === 98, JSON.stringify(v));
  v = W.rangeView(rows, t0 + 2 * M + 40e3, t0 + 2 * M + 10e3, { t: t0 + 2 * M, h: 102.8, l: 101.5, at: t0 + 2 * M + 20e3 });
  check('Laufende Kerze: was sie nach der letzten Prüfung darüber hinaus erreicht hat, zählt (hier Hoch 103 und Tief 101)', v.hi === 103 && v.lo === 101, JSON.stringify(v));
  v = W.rangeView(rows, t0 + 2 * M + 40e3, t0 + 2 * M + 30e3, { t: t0 + 2 * M, h: 102.8, l: 101.5, at: t0 + 2 * M + 20e3 });
  check('… aber nicht, wenn die letzte Prüfung vor dem Scharfschalten war', v.hi === 102.5 && v.lo === 102.5, JSON.stringify(v));
  check('Marke per Docht / direkt / nicht', JSON.stringify(W.touched(103.5, false, { price: 102, hi: 104, lo: 101 })) === '{"wick":true,"extreme":104}' && W.touched(101.5, true, { price: 101, hi: 102, lo: 101 }).wick === false && W.touched(105, false, { price: 102, hi: 104, lo: 101 }) === null);
  check('Texte wie in der App', W.alarmText(c.alarms[0], 64990, { wick: true, extreme: 65020 }) === '🔔 Kurs-Alarm BTC\nBTC auf/über 65.000,00 USDT kurz per Docht erreicht (bis 65.020,00) · Kurs 64.990,00\nNotiz: Ausbruch'
    && W.posText(c.positions[0], 'tp', 2601, { wick: false }) === '🎯 ETH Long: Take-Profit erreicht\nETH Long: Take-Profit 2.600,00 erreicht · Kurs 2.601,00', W.posText(c.positions[0], 'tp', 2601, { wick: false }).replace(/\n/g, ' ⏎ '));

  // ---- Termine ----
  const now = Date.UTC(2026, 8, 30, 12, 20), ev = [{ t: now + 10 * M, cur: 'USD', impact: 'high', title: 'CPI m/m', forecast: '0.3%', previous: '0.2%' }, { t: now + 10 * M, cur: 'USD', impact: 'high', title: 'Core CPI m/m', forecast: '0.3%', previous: '' },
    { t: now + 5 * M, cur: 'EUR', impact: 'high', title: 'ECB Press Conference' }, { t: now + 8 * M, cur: 'USD', impact: 'medium', title: 'Crude Oil Inventories' }, { t: now - M, cur: 'USD', impact: 'high', title: 'Schon vorbei' }, { t: now + 40 * M, cur: 'USD', impact: 'high', title: 'Später' }];
  const due = W.econDue(ev, now, { warn: 15, cur: 'usd' }), dueAll = W.econDue(ev, now, { warn: 15, cur: 'all' });
  check('Termine: hohe Bedeutung, gewählte Währung, im Warnfenster, noch nicht vorbei; gleiche Zeit als einer', due.length === 1 && due[0].list.length === 2 && dueAll.length === 2 && W.econDue(ev, now, { warn: 0, cur: 'all' }).length === 0);
  check('Termin-Text wie in der App', W.econText(due[0], now, 'Europe/Berlin') === '⚠ Wirtschaftstermin in 10 min (14:30 Uhr)\nUSD CPI m/m, Core CPI m/m – hohe Bedeutung, starke Kursausschläge möglich.\nPrognose 0,3 %, vorher 0,2 % · Prognose 0,3 %',
    W.econText(due[0], now, 'Europe/Berlin').replace(/\n/g, ' ⏎ '));

  // ---- Beschriftung der angehefteten Nachricht, von der App gelesen ----
  const capOk = W.caption(c, W.statusLine({ ok: true, now: T, c })), capBad = W.caption(c, W.statusLine({ ok: false, now: T, c, problem: 'Kurse nicht abrufbar seit 12:10 (BTC: Binance nicht erreichbar)' }));
  check('Beschriftung: Kennung, Zeile der App, Zeile des Dienstes', capOk === `📌 Scalp Desk · 24/7-Dienst\nApp: 30.09. 12:26 · 1 Alarm, 1 Position · Chrome, Windows · #ab12\nDienst: aktiv · 30.09. 12:26 · v${W.VERSION} · #ab12 übernommen`, capOk.replace(/\n/g, ' ⏎ '));
  const src = fs.readFileSync(path.join(__dirname, 'js', 's247.js'), 'utf8');
  const A = new Function('store', 'navigator', '$', 'broadcastData', 'state', 'chan', 'APP_VERSION', 'ec', 'tgApi', 'tgPost', 'tgConfigured', 'document', 'addEventListener', 'renderChanSummary',
    `${src}\nreturn { s247, s247Parse, s247Covers, s247Caption, s247Payload, s247Keys, s247Stamp };`)(
    { get: () => null, set: () => true, claim: async () => true, release: async () => {} }, { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36', maxTouchPoints: 0 }, () => null, () => {},
    { alarms: [{ id: 'a1', symbol: 'BTCUSDT', source: 'spot', dir: 'above', price: 65000, note: 'Ausbruch', createdAt: T - 5 * M, triggeredAt: null }, { id: 'a2', symbol: 'ETHUSDT', source: 'spot', dir: 'below', price: 2000, note: '', createdAt: 1, armedAt: 2, triggeredAt: 5 }],
      positions: [{ id: 'p1', symbol: 'ETHUSDT', source: 'futures', side: 'long', tp: 2600, sl: 2450, openedAt: T - 60 * M, ack: { tp: false, sl: true }, qty: 3, entry: 2500 }] },
    { tg: { on: true }, ev: { alarm: true, pos: true, news: true } }, '3.23.0', { cfg: { warn: 15, cur: 'usd' } }, null, null, () => true, { hidden: false, addEventListener() {} }, () => {}, () => {});
  const pm = (caption, edit) => ({ message_id: 501, date: Math.floor(T / 1000) - 3600, edit_date: edit, caption, document: { file_name: 'scalpdesk-247.json' } });
  let st = A.s247Parse(pm(capOk, Math.floor(T / 1000)), T + 60e3);
  check('App liest die Zeile des Dienstes: aktiv, Stand #ab12, frisch, Gerät', st.found && st.svc.ok && st.svc.tag === 'ab12' && st.tag === 'ab12' && st.fresh && st.dev === 'Chrome, Windows' && st.beat === Math.floor(T / 1000) * 1000, JSON.stringify(st));
  st = A.s247Parse(pm(capBad, Math.floor(T / 1000)), T + 60e3);
  check('App liest eine Störung samt Grund', st.svc && !st.svc.ok && /Kurse nicht abrufbar seit 12:10/.test(st.svc.problem), JSON.stringify(st.svc));
  st = A.s247Parse(pm(capOk, Math.floor(T / 1000)), T + 21 * M);
  check('Lebenszeichen älter als 20 Minuten: nicht frisch', st.svc.ok && !st.fresh);
  st = A.s247Parse(pm('📌 Scalp Desk · 24/7-Dienst\nApp: 30.09. 12:26 · 1 Alarm, 1 Position · Chrome, Windows · #ab12\nDienst: wartet auf Rückmeldung …', Math.floor(T / 1000)), T);
  check('Noch keine Rückmeldung des Dienstes: keine Bestätigung', st.found && st.svc === null && !st.fresh);
  // Datei der App: was der Dienst bekommt, Schlüssel wie in notifyChannels und im Dienst
  A.s247.cfg.on = true;
  const P = A.s247Payload(), keys = A.s247Keys(P);
  check('Übergabe: nur aktive Alarme, Marken der Positionen ohne Menge und Einstieg', P.alarms.length === 1 && P.alarms[0].armedAt === T - 5 * M && P.positions.length === 1 && !('qty' in P.positions[0]) && !('entry' in P.positions[0]) && P.positions[0].since === T - 60 * M && P.dev === 'Chrome, Windows');
  const W2 = W.parseConfig({ ...P, tag: 'zz99', at: T });
  check('Schlüssel der App = Schlüssel des Dienstes', JSON.stringify(keys) === JSON.stringify([...W2.alarms.map(W.alarmKey), ...W2.positions.flatMap(p => ['tp', 'sl'].map(t => W.posKey(p, t)))]), keys.join(' '));
  check('Beschriftung der App im selben Format wie beim Dienst', A.s247Caption({ ...P, tag: 'ab12', at: T }).split('\n')[1] === W.appLine(W.parseConfig({ ...P, tag: 'ab12', at: T })), A.s247Caption({ ...P, tag: 'ab12', at: T }).split('\n')[1]);
  // Nicht doppelt senden: nur wenn bestätigt, frisch, aktueller Stand und Meldung darin
  Object.assign(A.s247.cfg, { on: true, msg: 501, tag: 'ab12', keys, econ: 'usd|15' });
  A.s247.st = A.s247Parse(pm(capOk, Math.floor(Date.now() / 1000)), Date.now()); A.s247.checkAt = Date.now();
  const cov = (t, key) => A.s247Covers(t, key);
  check('Dienst aktiv und auf Stand: Alarm, Stop/Ziel und Termine kommen vom Dienst', cov('alarm', `al:a1:${T - 5 * M}`) && cov('pos', `pos:p1:tp:${T - 60 * M}`) && cov('news', 'econ-chan:123'));
  check('… nicht: unbekannter Alarm, Tages-Verlustlimit', !cov('alarm', 'al:neu:1') && !cov('day', 'day:x'));
  A.s247.st = A.s247Parse(pm(capOk.replace('#ab12 übernommen', '#old1 übernommen'), Math.floor(Date.now() / 1000)), Date.now());
  check('… nicht: Dienst hat einen älteren Stand', !cov('alarm', `al:a1:${T - 5 * M}`));
  // 3.26.0: kurz nach einer erneuten Übergabe zählt ein kürzlich übergebener, vom Dienst bestätigter Stand
  A.s247.cfg.hist = [{ tag: 'ab12', keys }, { tag: 'old1', keys: [`al:a1:${T - 5 * M}`] }];
  check('… doch: der bestätigte ältere Stand enthielt den Alarm schon (App hat gerade erneut übergeben); Stop/Ziel dort nicht, Termine nur mit neuestem Stand', cov('alarm', `al:a1:${T - 5 * M}`) && !cov('pos', `pos:p1:tp:${T - 60 * M}`) && !cov('news', 'econ-chan:123'));
  A.s247.cfg.hist = [{ tag: 'old1', keys: ['al:a1:1'] }];
  check('… nicht: im älteren Stand war der Alarm anders scharf geschaltet', !cov('alarm', `al:a1:${T - 5 * M}`));
  A.s247.cfg.hist = [];
  A.s247.st = A.s247Parse(pm(capBad, Math.floor(Date.now() / 1000)), Date.now());
  check('… nicht: Dienst meldet Störung', !cov('alarm', `al:a1:${T - 5 * M}`));
  A.s247.st = A.s247Parse(pm(capOk, Math.floor((Date.now() - 25 * M) / 1000)), Date.now());
  check('… nicht: Lebenszeichen zu alt', !cov('alarm', `al:a1:${T - 5 * M}`));
  A.s247.st = A.s247Parse(pm(capOk, Math.floor(Date.now() / 1000)), Date.now()); A.s247.cfg.on = false;
  check('… nicht: Übergabe in dieser App aus', !cov('alarm', `al:a1:${T - 5 * M}`));

  // ---- Der Dienst mit nachgebautem Telegram und Binance ----
  const tgLog = [], files = new Map(); let pinned = null, klineRows = rows, calJson = { events: [] }, now2 = t0 + 2 * M + 5e3, binanceDown = false, symRows = {}, failSym = '';
  let tgFail = null, symDelay = {}; const dcLog = []; // 3.27.0: Telegram lehnt sendMessage ab ({ status, desc }) oder ist nicht erreichbar ('net'); Discord; langsame Kürzel
  const reply = (r, status = 200) => ({ ok: status < 300, status, json: async () => r });
  globalThis.fetch = async (url, o = {}) => {
    const u = new URL(url), b = o.body ? JSON.parse(o.body) : {};
    if (u.pathname.startsWith(`/file/bot${TOKEN}/`)) return reply(JSON.parse(files.get(u.pathname.split('/').pop())));
    if (/discord/.test(u.hostname)) { dcLog.push(b.content); return { ok: true, status: 204, json: async () => ({}) }; }
    const m = /^\/bot[^/]+\/(\w+)$/.exec(u.pathname);
    if (m && m[1] === 'sendMessage' && tgFail) { tgLog.push({ method: m[1], ...b, failed: true }); if (tgFail === 'net') throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } }); /* 2.0: keine Verbindung – kam nie an (abgerissene Verbindung: unit-247c) */ return reply({ ok: false, error_code: tgFail.status, description: tgFail.desc }, tgFail.status); }
    if (m) {
      tgLog.push({ method: m[1], ...b });
      if (m[1] === 'getChat') return reply({ ok: true, result: { id: +CHAT, type: 'private', ...(pinned ? { pinned_message: pinned } : {}) } });
      if (m[1] === 'getFile') return reply({ ok: true, result: { file_id: b.file_id, file_path: `documents/${b.file_id}` } });
      if (m[1] === 'editMessageCaption') { if (!pinned || b.message_id !== pinned.message_id) return reply({ ok: false, error_code: 400, description: 'Bad Request: message to edit not found' }, 400); if (b.caption === pinned.caption) return reply({ ok: false, error_code: 400, description: 'Bad Request: message is not modified' }, 400); pinned.caption = b.caption; return reply({ ok: true, result: pinned }); }
      return reply({ ok: true, result: m[1] === 'getMe' ? { username: 'test_bot' } : { message_id: 900 } });
    }
    if (/klines/.test(u.pathname)) { const sy = u.searchParams.get('symbol'); if (symDelay[sy]) await new Promise(r => setTimeout(r, symDelay[sy])); return binanceDown || sy === failSym ? reply({ code: -1, msg: 'down' }, 503) : reply(symRows[sy] || klineRows); }
    if (/calendar/.test(url)) return reply(calJson);
    return reply({}, 404);
  };
  const pin = (conf, id = 501, uid = 'U1') => { files.set('f' + uid, JSON.stringify(conf)); pinned = { message_id: id, date: 1, caption: '📌 Scalp Desk · 24/7-Dienst\nApp: …\nDienst: wartet auf Rückmeldung …', document: { file_id: 'f' + uid, file_unique_id: uid, file_name: 'scalpdesk-247.json' } }; };
  const statePath = path.join(os.tmpdir(), `s247-state-${process.pid}.json`); try { fs.unlinkSync(statePath); } catch {}
  const logs = [], w = new W.Watcher({ token: TOKEN, chat: CHAT, statePath, now: () => now2, log: (...a) => logs.push(a.join(' ')) });
  const INFO = /^(✅ 24\/7-Dienst hat übernommen|⏸ 24\/7-Dienst|⏳ Scalp Desk 24\/7-Dienst)/; // 1.4: Bestätigung und Hinweis sind keine Meldungen
  const sent = () => tgLog.filter(x => x.method === 'sendMessage' && !x.failed && !INFO.test(x.text || '')).map(x => x.text);
  const infos = () => tgLog.filter(x => x.method === 'sendMessage' && !x.failed && INFO.test(x.text || '')).map(x => x.text);
  const svcLine = () => (pinned?.caption || '').split('\n').find(l => l.startsWith('Dienst:')) || ''; // 1.3: darunter folgt „Zustellung: …“
  pin({ ...base, alarms: [{ id: 'a1', symbol: 'BTCUSDT', source: 'spot', dir: 'above', price: 103.5, note: '', armedAt: t0 }], positions: [{ id: 'p1', symbol: 'BTCUSDT', source: 'spot', side: 'long', tp: 104.5, sl: 97, since: t0, ack: { tp: false, sl: false } }] });
  await w.tick();
  check('Dienst: Datei gelesen, Stand bestätigt („Dienst: aktiv … #ab12 übernommen“)', w.conf?.data.alarms.length === 1 && /^Dienst: aktiv · .* · #ab12 übernommen$/.test(svcLine()) && /\nZustellung: geprüft, noch keine Meldung$/.test(pinned.caption), pinned.caption.split('\n').slice(-2).join(' ⏎ '));
  const st0 = A.s247Parse({ message_id: 700, date: 1, edit_date: Math.floor(Date.now() / 1000), caption: pinned.caption, document: { file_name: 'scalpdesk-247.json' } }, Date.now());
  check('… die App erkennt den Dienst ab 1.3 (Zeile „Zustellung:“), noch ohne Zustellung', st0.svc?.zv === true && st0.last === null, JSON.stringify({ zv: st0.svc?.zv, last: st0.last }));
  check('Erste Prüfung: nichts ausgelöst (laufende Kerze begann vor dem Scharfschalten)', sent().length === 0);
  // laufende Kerze steigt nach der ersten Prüfung auf 103.6 → Alarm (Docht)
  now2 += 16e3; klineRows = [rows[0], rows[1], k(t0 + 2 * M, 102, 103.6, 101, 102.5)]; w.next.price = 0; await w.tick();
  check('Alarm per Docht der laufenden Kerze nach dem Scharfschalten: gemeldet', sent().length === 1 && /^🔔 Kurs-Alarm BTC\nBTC auf\/über 103,50 USDT kurz per Docht erreicht \(bis 103,60\) · Kurs 102,50\n\d\d:\d\d:\d\d Uhr · 24\/7-Dienst$/.test(sent()[0]), sent()[0]?.replace(/\n/g, ' ⏎ '));
  now2 += 16e3; w.next.price = 0; await w.tick();
  check('Alarm nur einmal', sent().length === 1);
  // Ziel 104.5: neue Kerze erreicht 104.6 → gemeldet; Kurs bleibt dort → nicht erneut; weg (unter 104.5) und wieder hin → erneut
  now2 = t0 + 3 * M + 5e3; klineRows = [rows[1], k(t0 + 2 * M, 102, 103.6, 101, 102.5), k(t0 + 3 * M, 102.5, 104.6, 102.4, 104.55)]; w.next.price = 0; await w.tick();
  check('Take-Profit erreicht: gemeldet', sent().length === 2 && /^🎯 BTC Long: Take-Profit erreicht/.test(sent()[1]), sent()[1]?.split('\n')[0]);
  now2 += 16e3; w.next.price = 0; await w.tick();
  check('Kurs bleibt am Ziel: keine zweite Meldung', sent().length === 2);
  now2 = t0 + 4 * M + 5e3; klineRows = [k(t0 + 2 * M, 102, 103.6, 101, 102.5), k(t0 + 3 * M, 102.5, 104.6, 102.4, 104.2), k(t0 + 4 * M, 104.2, 104.3, 104, 104.1)]; w.next.price = 0; await w.tick();
  check('Kurs wieder weg vom Ziel: wieder scharf', sent().length === 2 && !Object.keys(w.fired).some(x => x.includes(':tp:')));
  now2 = t0 + 5 * M + 5e3; klineRows = [k(t0 + 3 * M, 102.5, 104.6, 102.4, 104.2), k(t0 + 4 * M, 104.2, 104.3, 104, 104.1), k(t0 + 5 * M, 104.1, 104.7, 104, 104.6)]; w.next.price = 0; await w.tick();
  check('Nächste Berührung: erneut gemeldet', sent().length === 3 && /Take-Profit/.test(sent()[2]));
  // Gleiche Datei: nicht neu laden; quittiert (ack) in der App: keine Meldung; Meldung aus: nichts
  const reads = tgLog.filter(x => x.method === 'getFile').length; w.next.config = 0; await w.tick();
  check('Unveränderte Datei wird nicht erneut geladen', tgLog.filter(x => x.method === 'getFile').length === reads);
  pin({ ...base, tag: 'cd34', ev: { alarm: false, pos: true, news: true }, alarms: [{ id: 'a9', symbol: 'BTCUSDT', source: 'spot', dir: 'above', price: 100.5, note: '', armedAt: t0 }], positions: [{ id: 'p2', symbol: 'BTCUSDT', source: 'spot', side: 'short', tp: 100, sl: 104.65, since: t0, ack: { tp: false, sl: true } }] }, 501, 'U2');
  w.next.config = 0; await w.tick(); now2 += 20e3; klineRows = [k(t0 + 5 * M, 104.1, 104.9, 104, 104.8)]; w.next.price = 0; await w.tick(); now2 += 16e3; w.next.price = 0; await w.tick();
  check('Neue Datei (#cd34): übernommen und bestätigt; Kurs-Alarme aus → keine; Stop quittiert → keine', /#cd34 übernommen$/.test(svcLine()) && sent().length === 3, svcLine());
  // Kurse nicht abrufbar → nach der Frist „Störung“ in der Beschriftung, sofort (nicht erst nach 10 min)
  binanceDown = true; const tStart = now2; for (let i = 0; i < 16; i++) { now2 += 16e3; w.next.price = 0; await w.tick(); }
  check('Binance über 3 Minuten nicht abrufbar: „Dienst: Störung … Kurse nicht abrufbar seit …“', /^Dienst: Störung · .* · #cd34 übernommen · Kurse nicht abrufbar seit \d\d:\d\d \(BTC: Binance meldet Fehler -1: down\)$/.test(svcLine()), svcLine());
  binanceDown = false; now2 += 16e3; w.next.price = 0; await w.tick(); w.next.price = 0; await w.tick();
  check('Wieder erreichbar: sofort wieder „aktiv“', /\nDienst: aktiv · /.test(pinned.caption), `${Math.round((now2 - tStart) / 1000)} s`);
  check('Protokoll: Ausfall einmal gemeldet (nicht bei jeder Prüfung), Erholung einmal', logs.filter(l => /^Kurse: BTC: Binance meldet Fehler/.test(l)).length === 1 && logs.filter(l => l === 'Kurse: wieder in Ordnung').length === 1,
    logs.filter(l => /^Kurse/.test(l)).join(' | '));
  // Termine: 10 min vorher gemeldet, einmal
  pin({ ...base, tag: 'ef56', alarms: [], positions: [] }, 501, 'U3'); calJson = { events: [{ t: now2 + 10 * M, cur: 'USD', impact: 'high', title: 'CPI m/m', forecast: '0.3%', previous: '0.2%' }] };
  w.next.config = 0; w.next.cal = 0; w.next.econ = 0; await w.tick(); w.next.econ = 0; await w.tick();
  check('Wichtiger Termin in 10 min: einmal gemeldet', sent().length === 4 && /^⚠ Wirtschaftstermin in 10 min/.test(sent()[3]) && sent().filter(x => /Wirtschaftstermin/.test(x)).length === 1, sent()[3]?.split('\n')[0]);
  // Angeheftete Nachricht weg → nichts mehr melden; Zustand übersteht Neustart
  w.saveStateNow(); const w2 = new W.Watcher({ token: TOKEN, chat: CHAT, statePath, now: () => now2, log: () => {} });
  check('Zustand übersteht einen Neustart (Datei, gemeldete Termine)', w2.conf?.data.tag === 'ef56' && Object.keys(w2.fired).some(x => x.startsWith('econ-chan:')));
  pinned = null; w.next.config = 0; await w.tick();
  check('Angeheftete Datei entfernt: Dienst meldet nichts mehr', w.conf === null && logs.some(l => /Keine angepinnte Datei/.test(l)));
  check('Kein Token in den Protokollzeilen', !logs.some(l => l.includes(TOKEN)));
  try { fs.unlinkSync(statePath); } catch {}

  // ==== 3.27.0 (Dienst 1.3): Zustellung prüfen, wiederholen, Störung melden ====
  const stateD = path.join(os.tmpdir(), `s247-out-${process.pid}.json`); try { fs.unlinkSync(stateD); } catch {}
  let nowD = Date.UTC(2026, 8, 30, 15, 0); const logsD = [];
  const wd = new W.Watcher({ token: TOKEN, chat: CHAT, statePath: stateD, now: () => nowD, log: (...a) => logsD.push(a.join(' ')) });
  const kD = c => [nowD - 30e3, String(c), String(c), String(c), String(c), '1', nowD + 30e3 - 1];
  const nD = sent().length, newD = () => sent().slice(nD), parseCap = () => A.s247Parse({ message_id: 701, date: 1, edit_date: Math.floor(Date.now() / 1000), caption: pinned.caption, document: { file_name: 'scalpdesk-247.json' } }, Date.now());
  const stepD = async (ms = 16e3) => { nowD += ms; wd.next.price = 0; await wd.tick(); };
  symRows = { BTCUSDT: [kD(100)] };
  pin({ ...base, tag: 'zu01', alarms: [{ id: 'z1', symbol: 'BTCUSDT', source: 'spot', dir: 'above', price: 105, note: '', armedAt: nowD - 60e3 }, { id: 'z2', symbol: 'BTCUSDT', source: 'spot', dir: 'below', price: 95, note: '', armedAt: nowD - 60e3 }], positions: [] }, 701, 'Z1');
  wd.next.config = 0; await wd.tick();
  tgFail = { status: 400, desc: 'Bad Request: chat not found' }; symRows = { BTCUSDT: [kD(106)] }; await stepD();
  check('Zustellung: Telegram lehnt ab (400) – nichts zugestellt, die Meldung bleibt im Ausgang und geht nicht verloren', newD().length === 0 && wd.out.length === 1 && wd.out[0].tries === 1 && /chat not found/.test(wd.out[0].err) && wd.out[0].label === 'Kurs-Alarm BTC' && !!wd.fired[`al:z1:${nowD - 16e3 - 60e3}`], JSON.stringify(wd.out.map(m => [m.label, m.tries, m.err])));
  check('… der Dienst meldet sofort „Störung · Telegram-Nachricht nicht zustellbar seit …“', /^Dienst: Störung · .* · #zu01 übernommen · Telegram-Nachricht nicht zustellbar seit \d\d:\d\d \(Telegram sendMessage: Bad Request: chat not found\)$/.test(svcLine()), svcLine());
  let stD = parseCap();
  check('… die App liest „Störung“ – Kurs-Alarme gelten dann nicht als abgedeckt, die geöffnete App meldet selbst', stD.svc && !stD.svc.ok && /nicht zustellbar/.test(stD.svc.problem));
  const t1 = wd.out[0].next; await stepD(5e3);
  check('… kein neuer Versuch vor Ablauf der Pause (15 s)', wd.out[0].tries === 1 && t1 - (nowD - 5e3) === 15e3, String(t1 - (nowD - 5e3)));
  nowD = t1; wd.next.price = 0; await wd.tick();
  check('… danach erneuter Versuch; die Pause wächst (30 s)', wd.out[0].tries === 2 && wd.out[0].next - nowD === 30e3, String(wd.out[0].next - nowD));
  wd.saveStateNow();
  const wd2 = new W.Watcher({ token: TOKEN, chat: CHAT, statePath: stateD, now: () => nowD, log: () => {} });
  check('Neustart: die nicht zugestellte Meldung und der Sendefehler bleiben erhalten', wd2.out.length === 1 && wd2.out[0].label === 'Kurs-Alarm BTC' && wd2.out[0].tries === 2 && wd2.sendErr?.code === 400, JSON.stringify(wd2.out.map(m => m.label)));
  tgFail = null; nowD += 3 * 60e3; wd.next.price = 0; await wd.tick();
  check('Telegram wieder in Ordnung: zugestellt, mit der Zeit des Auslösens und „(verspätet zugestellt um … – Telegram hatte sie zuerst abgelehnt)“', newD().length === 1 && /^🔔 Kurs-Alarm BTC\n[^\n]+\n17:00:16 Uhr · 24\/7-Dienst\n\(verspätet zugestellt um \d\d:\d\d Uhr – Telegram hatte sie zuerst abgelehnt\)$/.test(newD()[0]) && wd.out.length === 0 && wd.sendErr === null, newD()[0]?.replace(/\n/g, ' ⏎ '));
  check('… Status wieder „aktiv“, darunter „Zustellung: zuletzt … · Kurs-Alarm BTC“', /^Dienst: aktiv · /.test(svcLine()) && /\nZustellung: zuletzt \d\d\.\d\d\. \d\d:\d\d · Kurs-Alarm BTC(\n|$)/.test(pinned.caption) && logsD.some(l => /Zustellung wieder in Ordnung/.test(l)), pinned.caption.replace(/\n/g, ' ⏎ '));
  stD = parseCap();
  check('… die App liest die letzte Zustellung (Zeit und Art)', stD.svc?.ok && stD.last?.label === 'Kurs-Alarm BTC' && stD.last.t > 0, JSON.stringify(stD.last));
  tgFail = 'net'; symRows = { BTCUSDT: [kD(94)] }; await stepD();
  check('Telegram nicht erreichbar (Netz): Meldung im Ausgang, in der ersten Minute noch „aktiv“', wd.out.length === 1 && /Telegram nicht erreichbar/.test(wd.out[0].err) && /^Dienst: aktiv/.test(svcLine()), JSON.stringify({ err: wd.out[0]?.err, line: svcLine() }));
  tgFail = null; const capBefore = pinned.caption; tgFail = 'net'; nowD += 61e3; wd.next.price = 0; await wd.tick();
  check('… nach über einer Minute: „Störung“ (sofern die Nachricht noch bearbeitet werden kann)', /^Dienst: Störung · .* · Telegram-Nachricht nicht zustellbar seit/.test(svcLine()) && pinned.caption !== capBefore, svcLine());
  nowD += 25 * 3600e3; wd.next.price = 0; await wd.tick();
  check('Über 24 Stunden nicht zustellbar: verworfen, mit Protokollzeile', wd.out.length === 0 && logsD.some(l => /Meldung verworfen \(über 24 Stunden nicht zustellbar\): Kurs-Alarm BTC/.test(l)));
  tgFail = null;
  // Discord einmal, gleich beim ersten Versuch – auch wenn Telegram noch wiederholt
  const stateDc = path.join(os.tmpdir(), `s247-dc-${process.pid}.json`); try { fs.unlinkSync(stateDc); } catch {}
  const wdc = new W.Watcher({ token: TOKEN, chat: CHAT, discord: 'https://discord.com/api/webhooks/1/abc', statePath: stateDc, now: () => nowD, log: () => {} });
  tgFail = { status: 502, desc: 'Bad Gateway' }; await wdc.queue('⚡ Test', 'UTC', { label: 'BTC-Puls' }); nowD += 20e3; await wdc.deliver();
  check('Discord: einmal beim ersten Versuch, Telegram wiederholt (Fehler 502)', dcLog.length === 1 && /^⚡ Test\n/.test(dcLog[0]) && wdc.out.length === 1 && wdc.out[0].tries === 2, JSON.stringify({ dc: dcLog.length, tries: wdc.out[0]?.tries }));
  tgFail = null; nowD += 60e3; await wdc.deliver();
  check('… Telegram später zugestellt, Discord nicht noch einmal', wdc.out.length === 0 && dcLog.length === 1);
  // Grund im Verspätet-Vermerk: Netz → „nicht erreichbar“
  const nNet = sent().length; tgFail = 'net'; await wdc.queue('🔔 Netz', 'UTC', { label: 'Kurs-Alarm X' }); nowD += 3 * 60e3; tgFail = null; await wdc.deliver();
  const netMsg = sent().slice(nNet).at(-1) || '';
  check('Verspätet nach Netzausfall: Vermerk „Telegram war nicht erreichbar“', /\n\(verspätet zugestellt um \d\d:\d\d Uhr – Telegram war nicht erreichbar\)$/.test(netMsg) && wdc.out.length === 0, netMsg.replace(/\n/g, ' ⏎ '));
  try { fs.unlinkSync(stateDc); fs.unlinkSync(stateD); } catch {}
  // Kerzen gleichzeitig: ein langsames Kürzel (0,4 s) hält die anderen nicht auf
  const wpar = new W.Watcher({ token: TOKEN, chat: CHAT, now: () => nowD, log: () => {} });
  wpar.conf = { data: W.parseConfig({ ...base, tag: 'pa01', alarms: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'].map((sy, i) => ({ id: 'q' + i, symbol: sy, source: 'spot', dir: 'above', price: 1e9, note: '', armedAt: nowD })), positions: [] }) };
  symDelay = { BTCUSDT: 400, ETHUSDT: 400, SOLUSDT: 400, XRPUSDT: 400 }; symRows = {};
  const tPar = performance.now(); await wpar.checkPrices(); const msPar = performance.now() - tPar; symDelay = {};
  check('Kursabfragen gleichzeitig (höchstens 4): 4 Kürzel zu je 0,4 s in unter 1 s statt 1,6 s', msPar < 1000 && wpar.lastCheck.size === 4, `${Math.round(msPar)} ms`);
  const r8 = await W.mapLimit([1, 2, 3, 4, 5, 6, 7, 8], 4, async x => { if (x === 3) throw new Error('drei'); return x * 2; });
  check('… Fehler je Kürzel: die übrigen kommen an', r8.filter(x => x.ok).length === 7 && !r8[2].ok && r8[2].error.message === 'drei' && r8[7].value === 16);

  // ==== 3.26.0: Gewinn-/Verlust-Alarm im Dienst (ab 1.2) ====
  const A1 = T - 30 * M, A2 = T - 20 * M, POS = [{ id: 'q1', symbol: 'BTCUSDT', source: 'spot', side: 'long', entry: 100, qty: 2 }, { id: 'q2', symbol: 'ETHUSDT', source: 'futures', side: 'short', entry: 50, qty: 4 }];
  const lims = (o = {}) => [{ k: 'profit', v: 5, at: A1, w: false, done: false, ...(o.profit || {}) }, { k: 'loss', v: 3, at: A2, w: true, done: false, ...(o.loss || {}) }];
  const pp = W.parsePnl({ n: 2, pos: [...POS, { id: 'x', symbol: 'eth', side: 'long', entry: 1, qty: 1 }, { id: 'y', symbol: 'SOLUSDT', side: 'long', entry: 0, qty: 1 }], lim: [...lims(), { k: 'profit', v: 9, at: 1 }, { k: 'sideways', v: 1, at: 1 }, { k: 'loss', v: -2, at: 1 }] });
  check('Gewinn/Verlust – Datei: gültige Positionen (Einstieg, Menge, Markt) und je Art eine Grenze, Ungültiges verworfen', pp.n === 2 && pp.pos.length === 2 && pp.pos[1].source === 'futures' && pp.lim.length === 2 && pp.lim[0].v === 5 && pp.lim[1].w === true, JSON.stringify(pp));
  check('… ohne aktive Grenze: nichts (dann auch keine Einstiege und Mengen nötig)', W.parsePnl({ n: 1, pos: POS, lim: [] }) === null && W.parsePnl(null) === null && W.parseConfig(base).pnl === null);
  const prices = (b, e) => new Map([['spot:BTCUSDT', b], ['futures:ETHUSDT', e]]);
  check('Live-Ergebnis wie in der App: Menge × (Kurs − Einstieg) × Richtung, Summe, auf Cent gerundet', W.pnlTotal(pp, prices(103.004, 50.001)) === 6 && W.pnlTotal(pp, prices(99, 50.5)) === -4 && W.pnlTotal(pp, prices(100.123, 50)) === 0.25, String(W.pnlTotal(pp, prices(103.004, 50.001))));
  check('… fehlt ein Kurs oder eine Position: keine Prüfung', W.pnlTotal(pp, new Map([['spot:BTCUSDT', 103]])) === null && W.pnlTotal({ ...pp, n: 3 }, prices(103, 50)) === null && W.pnlTotal({ ...pp, pos: [] , n: 0 }, prices(103, 50)) === null);
  check('Grenzen wie in der App: Gewinn ≥ +v, Verlust ≤ −v', W.pnlMet('profit', 5, 5) && !W.pnlMet('profit', 5, 4.99) && W.pnlMet('loss', 3, -3) && !W.pnlMet('loss', 3, -2.99) && !W.pnlMet('loss', 3, null));
  check('Text wie in der App', W.pnlText(pp.lim[0], 6, 2) === '📈 Gewinn-Alarm\nLive-Ergebnis +6,00 USDT (2 offene Positionen) · Schwelle ≥ +5,00 USDT erreicht' && W.pnlText(pp.lim[1], -4, 1) === '📉 Verlust-Alarm\nLive-Ergebnis −4,00 USDT (1 offene Position) · Schwelle ≤ −3,00 USDT erreicht', W.pnlText(pp.lim[0], 6, 2).replace(/\n/g, ' ⏎ '));
  const cP = W.parseConfig({ ...base, ev: { ...base.ev, pulse: true, pnl: true }, pulse: null, pnl: { n: 2, pos: POS, lim: lims() } }), lineP = W.statusLine({ ok: true, now: T, c: { ...cP, pulse: { thr: 1 } } });
  check('Zeile des Dienstes: „· GV“ vor „· Puls“ – ältere Apps erkennen „· Puls · #“ weiter', lineP === `Dienst: aktiv · 30.09. 12:26 · v${W.VERSION} · GV · Puls · #ab12 übernommen` && / · Puls · #/.test(lineP), lineP);
  check('… ohne Grenze oder Meldungsart aus: kein „GV“', !/GV/.test(W.statusLine({ ok: true, now: T, c })) && !W.pnlOn(W.parseConfig({ ...base, ev: { ...base.ev, pnl: false }, pnl: { n: 2, pos: POS, lim: lims() } })));
  // ---- Dienst mit nachgebautem Telegram/Binance ----
  const stateP = path.join(os.tmpdir(), `s247-pnl-${process.pid}.json`); try { fs.unlinkSync(stateP); } catch {}
  let nowP = Date.UTC(2026, 8, 30, 14, 0); const logsP = [], wp = new W.Watcher({ token: TOKEN, chat: CHAT, statePath: stateP, now: () => nowP, log: (...a) => logsP.push(a.join(' ')) });
  const kRow = c => [nowP - 30e3, String(c), String(c), String(c), String(c), '1', nowP + 30e3 - 1];
  const setP = (b, e) => { symRows = { BTCUSDT: [kRow(b)], ETHUSDT: [kRow(e)] }; };
  const step = async () => { nowP += 16e3; wp.next.price = 0; await wp.tick(); };
  const n0 = sent().length, newSent = () => sent().slice(n0);
  setP(101, 50.5); pin({ ...base, tag: 'gv01', ev: { ...base.ev, pnl: true }, alarms: [], positions: [], pnl: { n: 2, pos: POS, lim: lims() } }, 601, 'G1');
  wp.next.config = 0; await wp.tick();
  check('Dienst: Grenzen übernommen, bestätigt mit „· GV“; Live-Ergebnis 0 – nichts gemeldet', /^Dienst: aktiv · .* · GV · #gv01 übernommen$/.test(svcLine()) && newSent().length === 0 && wp.pnlSt[`pnl:profit:${A1}`] === 'armed', pinned.caption.split('\n').at(-1));
  check('… Verlust-Grenze war beim Scharfschalten schon erreicht (w): wartet, bis das Ergebnis darüber liegt – hier sofort (0 > −3)', wp.pnlSt[`pnl:loss:${A2}`] === 'armed');
  setP(103, 50); await step(); const tDet = nowP;
  check('Gewinn-Grenze erreicht (+6,00 ≥ +5): wartet erst auf die App (noch keine Meldung, Datei gleich neu lesen)', newSent().length === 0 && wp.pnlPend[`pnl:profit:${A1}`]?.val === 6 && wp.next.config === 0 && logsP.some(l => /Gewinn-Alarm: Live-Ergebnis 6 USDT .* meldet in 8 s, falls die App es nicht schon tut/.test(l)), JSON.stringify(wp.pnlPend));
  setP(102, 50); await step();
  check('… nach der Wartezeit, App hat nicht gemeldet: genau eine Meldung mit dem erreichten Wert (+6,00, auch wenn es inzwischen weniger ist)', newSent().length === 1 && /^📈 Gewinn-Alarm\nLive-Ergebnis \+6,00 USDT \(2 offene Positionen\) · Schwelle ≥ \+5,00 USDT erreicht\n\d\d:\d\d:\d\d Uhr · 24\/7-Dienst$/.test(newSent()[0]) && !Object.keys(wp.pnlPend).length, newSent()[0]?.replace(/\n/g, ' ⏎ '));
  const gvLine = pinned.caption.split('\n').find(l => l.startsWith('GV:'));
  check('… in der angehefteten Nachricht vermerkt (Art, Scharfschalten, Zeitpunkt des Erreichens, Wert)', new RegExp(`^GV: Gewinn-Alarm ausgelöst \\d\\d\\.\\d\\d\\. \\d\\d:\\d\\d bei \\+6,00 USDT · @p:${A1}:${tDet}:6$`).test(gvLine || ''), gvLine);
  setP(104, 50); await step(); await step();
  check('… bleibt erreicht oder steigt weiter: keine zweite Meldung', newSent().length === 1);
  setP(99, 50.5); await step(); await step();
  check('Verlust-Grenze erreicht (−4,00 ≤ −3): nach der Wartezeit eine Meldung; beide stehen in der Nachricht', newSent().length === 2 && /^📉 Verlust-Alarm\nLive-Ergebnis −4,00 USDT \(2 offene Positionen\) · Schwelle ≤ −3,00 USDT erreicht/.test(newSent()[1]) && pinned.caption.split('\n').filter(l => l.startsWith('GV:')).length === 2, newSent()[1]?.split('\n')[1]);
  // App liest das: ausgelöst übernehmen; Merkmale „GV“ und „Puls“
  const stP = A.s247Parse({ message_id: 601, date: 1, edit_date: Math.floor(Date.now() / 1000), caption: pinned.caption, document: { file_name: 'scalpdesk-247.json' } }, Date.now());
  check('App liest „· GV“ und die gesendeten Meldungen (Art, Scharfschalten, Zeitpunkt, Wert)', stP.svc?.gv === true && stP.svc.pulse === false && stP.gv.length === 2 && stP.gv[0].k === 'profit' && stP.gv[0].at === A1 && stP.gv[0].val === 6 && stP.gv[1].k === 'loss' && stP.gv[1].val === -4, JSON.stringify(stP.gv));
  const stOld = A.s247Parse({ message_id: 601, date: 1, edit_date: Math.floor(Date.now() / 1000), caption: capOk.replace('· #ab12 übernommen', '· Puls · #ab12 übernommen'), document: { file_name: 'scalpdesk-247.json' } }, Date.now());
  check('… Dienst 1.1 (nur „· Puls“): kein GV, Puls erkannt', stOld.svc.gv === false && stOld.svc.pulse === true && stOld.gv.length === 0);
  // Fehlender Kurs: keine Prüfung; Neustart: nichts doppelt
  pin({ ...base, tag: 'gv02', ev: { ...base.ev, pnl: true }, alarms: [], positions: [], pnl: { n: 2, pos: POS, lim: lims({ profit: { at: A1 + 1 } }) } }, 601, 'G2');
  wp.next.config = 0; failSym = 'ETHUSDT'; setP(110, 50); await step();
  check('Neu scharf geschaltet (anderer Zeitpunkt), aber ein Kurs fehlt: keine Prüfung, keine Meldung', newSent().length === 2 && !wp.pnlFired[`pnl:profit:${A1 + 1}`] && !wp.pnlFired[`pnl:profit:${A1}`], Object.keys(wp.pnlFired).join());
  failSym = ''; wp.saveStateNow();
  const wp2 = new W.Watcher({ token: TOKEN, chat: CHAT, statePath: stateP, now: () => nowP, log: () => {} });
  check('Zustand übersteht einen Neustart (gesendete Verlust-Meldung, Zustand der neuen Gewinn-Grenze)', !!wp2.pnlFired[`pnl:loss:${A2}`] && wp2.pnlSt[`pnl:profit:${A1 + 1}`] === 'armed', JSON.stringify({ fired: Object.keys(wp2.pnlFired), st: wp2.pnlSt }));
  await step(); await step();
  check('Neue Gewinn-Grenze (neu scharf) wird gemeldet, die Verlust-Meldung nicht noch einmal', newSent().length === 3 && /^📈 Gewinn-Alarm\nLive-Ergebnis \+20,00 USDT/.test(newSent()[2]), newSent()[2]?.split('\n')[1]);
  // Von der App selbst gesendet (done): nicht noch einmal; beim Scharfschalten erreicht (w): erst wieder darunter
  pin({ ...base, tag: 'gv03', ev: { ...base.ev, pnl: true }, alarms: [], positions: [], pnl: { n: 2, pos: POS, lim: lims({ profit: { at: A1 + 2, done: true }, loss: { at: A2 + 2, w: true } }) } }, 601, 'G3');
  wp.next.config = 0; setP(97, 50.5); await step();
  check('Von der App selbst gesendet (done): keine Meldung, keine Zeile; Verlust beim Scharfschalten erreicht: wartet', newSent().length === 3 && wp.pnlFired[`pnl:profit:${A1 + 2}`]?.by === 'app' && wp.pnlSt[`pnl:loss:${A2 + 2}`] === 'wait' && !pinned.caption.includes('GV: Gewinn'), JSON.stringify(wp.pnlSt));
  setP(100, 50); await step(); setP(98, 50.5); await step(); await step();
  check('… erst darüber (0), dann wieder darunter (−6): jetzt gemeldet', newSent().length === 4 && /^📉 Verlust-Alarm\nLive-Ergebnis −6,00 USDT/.test(newSent()[3]), newSent()[3]?.split('\n')[1]);
  // Meldungsart aus: nichts; mehr Positionen in der App als in der Datei: nichts
  pin({ ...base, tag: 'gv04', ev: { ...base.ev, pnl: false }, alarms: [], positions: [], pnl: { n: 2, pos: POS, lim: lims({ profit: { at: A1 + 3 }, loss: { at: A2 + 3, w: false } }) } }, 601, 'G4');
  wp.next.config = 0; setP(120, 50); await step();
  pin({ ...base, tag: 'gv05', ev: { ...base.ev, pnl: true }, alarms: [], positions: [], pnl: { n: 3, pos: POS, lim: lims({ profit: { at: A1 + 4 }, loss: { at: A2 + 4, w: false } }) } }, 601, 'G5');
  wp.next.config = 0; await step();
  check('Meldungsart Gewinn/Verlust aus oder eine Position fehlt in der Datei: keine Meldung, kein „GV“ bei ausgeschalteter Art', newSent().length === 4, newSent().slice(4).join(' | '));
  // Die geöffnete App meldet selbst und vermerkt das (done), während der Dienst noch wartet: Dienst schweigt
  pin({ ...base, tag: 'gv06', ev: { ...base.ev, pnl: true }, alarms: [], positions: [], pnl: { n: 2, pos: POS, lim: lims({ profit: { at: A1 + 5 }, loss: { at: A2 + 5, w: false } }) } }, 601, 'G6');
  wp.next.config = 0; setP(100, 50); await step(); setP(103, 50); await step();
  const kP6 = `pnl:profit:${A1 + 5}`; wp.saveStateNow();
  const wp3 = new W.Watcher({ token: TOKEN, chat: CHAT, statePath: stateP, now: () => nowP, log: () => {} });
  check('Erreicht und wartend: der Wartezustand übersteht einen Neustart', wp.pnlPend[kP6]?.val === 6 && wp3.pnlPend[kP6]?.val === 6, JSON.stringify(wp3.pnlPend));
  pin({ ...base, tag: 'gv07', ev: { ...base.ev, pnl: true }, alarms: [], positions: [], pnl: { n: 2, pos: POS, lim: lims({ profit: { at: A1 + 5, done: true }, loss: { at: A2 + 5, w: false } }) } }, 601, 'G7');
  await step();
  check('App hat in der Wartezeit selbst gemeldet (done): Dienst sendet nicht, keine GV-Zeile', newSent().length === 4 && wp.pnlFired[kP6]?.by === 'app' && !wp.pnlPend[kP6] && !pinned.caption.includes(`@p:${A1 + 5}:`) && logsP.some(l => /Gewinn-Alarm: die App hat selbst gemeldet/.test(l)), JSON.stringify({ n: newSent().length, f: wp.pnlFired[kP6] }));
  setP(104, 50); await step(); await step();
  check('… auch danach nicht (Grenze bleibt erreicht)', newSent().length === 4);
  // App: Schlüssel; der Gewinn-/Verlust-Alarm ist nie „abgedeckt“ – die geöffnete App meldet selbst
  const A2app = new Function('store', 'navigator', '$', 'broadcastData', 'state', 'chan', 'APP_VERSION', 'ec', 'tgApi', 'tgPost', 'tgConfigured', 'document', 'addEventListener', 'renderChanSummary', 'pnlHandover',
    `${src}\nreturn { s247, s247Parse, s247Covers, s247Payload, s247Keys };`)(
    { get: () => null, set: () => true, claim: async () => true, release: async () => {} }, { userAgent: 'Chrome', maxTouchPoints: 0 }, () => null, () => {}, { alarms: [], positions: [] },
    { tg: { on: true }, ev: { alarm: true, pos: true, news: true, pnl: true } }, '3.26.0', { cfg: { warn: 0, cur: 'usd' } }, null, null, () => true, { hidden: false, addEventListener() {} }, () => {}, () => {},
    () => ({ n: 2, pos: POS, lim: lims() }));
  A2app.s247.cfg.on = true; const PP = A2app.s247Payload(), kk = A2app.s247Keys(PP);
  check('App übergibt Grenzen und Positionen; Schlüssel wie im Dienst', PP.ev.pnl === true && PP.pnl.lim.length === 2 && kk.includes(`pnl:profit:${A1}`) && kk.includes(`pnl:loss:${A2}`) && W.parseConfig({ ...PP, tag: 'kk01', at: T }).pnl.lim.map(W.pnlKey).every(x => kk.includes(x)), kk.join(' '));
  Object.assign(A2app.s247.cfg, { on: true, msg: 601, tag: 'gv01', keys: kk, gv: true });
  const capGv = W.caption(cP, W.statusLine({ ok: true, now: Date.now(), c: { ...cP, tag: 'gv01' } }));
  A2app.s247.st = A2app.s247Parse({ message_id: 601, date: 1, edit_date: Math.floor(Date.now() / 1000), caption: capGv, document: { file_name: 'scalpdesk-247.json' } }, Date.now()); A2app.s247.checkAt = Date.now();
  check('Dienst bestätigt „GV“: die geöffnete App meldet den Gewinn-/Verlust-Alarm trotzdem selbst (nie „abgedeckt“), Kurs-Alarme wie bisher nicht', !A2app.s247Covers('pnl', `pnl:profit:${A1}`) && A2app.s247.st.svc?.gv === true);
  A2app.s247.st = A2app.s247Parse({ message_id: 601, date: 1, edit_date: Math.floor(Date.now() / 1000), caption: capGv.replace(' · GV', ''), document: { file_name: 'scalpdesk-247.json' } }, Date.now());
  check('… älterer Dienst ohne „GV“: die App sendet selbst', !A2app.s247Covers('pnl', `pnl:profit:${A1}`));
  check('Kein Token im Protokoll (Gewinn/Verlust)', !logsP.some(l => l.includes(TOKEN)) && logsP.some(l => /Gewinn-\/Verlust-Alarm \(≥ \+5 USDT, ≤ −3 USDT, 2 offene Positionen\)/.test(l)), logsP.find(l => /Datei der App übernommen \(#gv01\)/.test(l)));
  try { fs.unlinkSync(stateP); } catch {}
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('✗ Abbruch — ' + e.stack); process.exit(1); });
