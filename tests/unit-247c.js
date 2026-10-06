// 24/7-Dienst 2.0 (G05) ohne Netz nach außen: Ziel-Schalter, Aufträge, Ereignis-Freigaben, Episoden und die Steuerung über
// HTTP (echter Server auf 127.0.0.1, Telegram und Binance nachgebaut).
// - Rein: Auftrag mit erwarteter Revision (gemeinsam oder gar nicht, gleiche Auftrags-ID = gleiche Antwort), Epoche und
//   Einschaltzeit, Reservierung (genau einer), Ziel aus → verworfen (auch nach dem Wiedereinschalten), Zustände nur vorwärts,
//   Freigabe ohne Rückmeldung → unbestätigt (nicht weitergegeben), Episoden mit Abklingzeit.
// - HTTP: Gesundheit ohne Schlüssel, sonst 401; CORS nur für die App-Herkunft; Master-Auftrag dauerhaft vor der Antwort
//   (Neustart), zwei konkurrierende Aufträge, Ergebnis eines Auftrags abfragen, zwei Geräte um dieselbe Freigabe.
// - Dienst: sendet nur mit Freigabe (App zuerst → schweigt; Dienst zuerst → App bekommt keine), AUS verwirft wartende Meldungen,
//   AN belebt sie nicht, Epoche vor dem Senden, verlorene Telegram-Antwort → unbestätigt ohne zweiten Versuch, Stop/Ziel mit
//   Hysterese und Abklingzeit, Gewinn/Verlust ohne Wartezeit, Puls/Termine bei AUS nicht, Zustand 1.4 übernehmen, Protokoll ohne
//   Schlüssel und Token, „· HTTPS“ in der Zeile des Dienstes, „--status“ mit Schaltern und Ereignissen.
// Aufruf: node unit-247c.js
process.env.TZ = 'UTC';
const fs = require('fs'), path = require('path'), os = require('os');
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${info ? ' — ' + String(info).slice(0, 400) : ''}`); };
const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', CHAT = '987654321', KEY = 'k'.repeat(20) + 'Zz09_-abcdefghijklmnopq', ORIGIN = 'https://nicoahb.github.io', M = 60e3;
(async () => {
  const W = await import(path.join(__dirname, '..', 'server/scalpdesk-247.mjs'));
  const realFetch = globalThis.fetch, dir = fs.mkdtempSync(path.join(os.tmpdir(), 's247c-'));
  // ================= rein =================
  const T0 = Date.UTC(2026, 9, 6, 10, 0);
  let pol = W.policyNew(T0), cmds = [];
  check('Neuer Stand: drei Ziele (Kursalarm, Sicherung, Trades) an, Revision 0, Epoche 1', pol.rev === 0 && W.TARGETS.every(id => pol.targets[id].on && pol.targets[id].epoch === 1), JSON.stringify(pol));
  let r = W.policyApply(pol, cmds, { commandId: 'cmd-0001', expectedRevision: 0, set: { 'course-alert': false, backup: false, trades: false } }, T0 + 1000);
  check('Master AUS: alle drei gemeinsam, Revision 1, Epoche je Ziel +1, „aus seit“', r.status === 200 && pol.rev === 1 && W.TARGETS.every(id => !pol.targets[id].on && pol.targets[id].epoch === 2 && pol.targets[id].offSince === T0 + 1000) && r.body.changed.length === 3, JSON.stringify(r.body));
  const r2 = W.policyApply(pol, cmds, { commandId: 'cmd-0001', expectedRevision: 0, set: { 'course-alert': true } }, T0 + 2000);
  check('Gleiche Auftrags-ID erneut: dieselbe Antwort („repeat“), nichts geändert', r2.status === 200 && r2.body.repeat && pol.rev === 1 && !pol.targets['course-alert'].on);
  r = W.policyApply(pol, cmds, { commandId: 'cmd-0002', expectedRevision: 0, set: { 'course-alert': true } }, T0 + 3000);
  check('Veraltete erwartete Revision: 409 mit aktuellem Stand, nichts geändert', r.status === 409 && r.body.conflict && r.body.rev === 1 && !pol.targets['course-alert'].on, JSON.stringify(r.body));
  r = W.policyApply(pol, cmds, { commandId: 'cmd-0003', expectedRevision: 1, set: { 'course-alert': true, telefon: true } }, T0 + 4000);
  check('Ein unbekanntes Ziel im Auftrag: ganzer Auftrag abgelehnt (400), auch Kursalarm bleibt aus', r.status === 400 && !pol.targets['course-alert'].on && pol.rev === 1);
  r = W.policyApply(pol, cmds, { commandId: 'cmd-0004', expectedRevision: 1, set: { 'course-alert': true } }, T0 + 5000);
  check('Kursalarm AN: Revision 2, Epoche 3, „an seit“ = Zeit des Auftrags am Dienst', r.status === 200 && pol.rev === 2 && pol.targets['course-alert'].on && pol.targets['course-alert'].epoch === 3 && pol.targets['course-alert'].since === T0 + 5000);
  r = W.policyApply(pol, cmds, { commandId: 'cmd-0005', expectedRevision: 2, set: { 'course-alert': true } }, T0 + 6000);
  check('Auftrag ohne Änderung: angenommen, Revision bleibt', r.status === 200 && pol.rev === 2 && !r.body.changed.length);
  // Freigaben
  const L = {}, E = {};
  let g1 = W.evReserve(L, pol, { eventId: 'al1:abc:price-cross', targetId: 'course-alert', sender: 'app:ipad01', label: 'Kurs-Alarm BTC' }, T0);
  let g2 = W.evReserve(L, pol, { eventId: 'al1:abc:price-cross', targetId: 'course-alert', sender: 'app:iphone1' }, T0 + 10);
  check('Reservieren: erstes Gerät bekommt die Freigabe, das zweite nicht (Inhaber genannt)', g1.body.grant && !g2.body.grant && g2.body.holder === 'app:ipad01' && g2.body.st === 'reserved');
  check('Melden nur durch den Inhaber', W.evReport(L, { eventId: 'al1:abc:price-cross', sender: 'app:iphone1', st: 'confirmed' }, T0).status === 409);
  W.evReport(L, { eventId: 'al1:abc:price-cross', sender: 'app:ipad01', st: 'sending' }, T0 + 20); W.evReport(L, { eventId: 'al1:abc:price-cross', sender: 'app:ipad01', st: 'unconfirmed', why: 'Antwort verloren' }, T0 + 30);
  const back = W.evReport(L, { eventId: 'al1:abc:price-cross', sender: 'app:ipad01', st: 'confirmed' }, T0 + 40);
  check('Zustände nur vorwärts: „unbestätigt“ ist endgültig (kein späteres „zugestellt“)', L['al1:abc:price-cross'].st === 'unconfirmed' && back.body.unchanged);
  W.policyApply(pol, cmds, { commandId: 'cmd-0006', expectedRevision: 2, set: { 'course-alert': false } }, T0 + 50);
  const g3 = W.evReserve(L, pol, { eventId: 'al2:abc:price-cross', targetId: 'course-alert', sender: 'oracle' }, T0 + 60);
  W.policyApply(pol, cmds, { commandId: 'cmd-0007', expectedRevision: 3, set: { 'course-alert': true } }, T0 + 70);
  const g4 = W.evReserve(L, pol, { eventId: 'al2:abc:price-cross', targetId: 'course-alert', sender: 'app:ipad01' }, T0 + 80);
  check('Ziel aus: keine Freigabe, Ereignis „verworfen“; nach dem Wiedereinschalten bleibt es verworfen (nur ab jetzt Neues)', !g3.body.grant && g3.body.reason === 'off' && !g4.body.grant && L['al2:abc:price-cross'].st === 'discarded');
  W.evReserve(L, pol, { eventId: 'al3:abc:price-cross', targetId: 'course-alert', sender: 'app:iphone1' }, T0 + 100);
  W.evSweep(L, E, T0 + 100 + W.GRANT_WAIT - 1000); const notYet = L['al3:abc:price-cross'].st;
  W.evSweep(L, E, T0 + 100 + W.GRANT_WAIT + 1000);
  const g5 = W.evReserve(L, pol, { eventId: 'al3:abc:price-cross', targetId: 'course-alert', sender: 'oracle' }, T0 + W.GRANT_WAIT + 2000);
  check('Freigabe ohne Rückmeldung: nach 5 min „unbestätigt (keine Rückmeldung des Geräts)“, nicht an den Dienst weitergegeben', notYet === 'reserved' && L['al3:abc:price-cross'].st === 'unconfirmed' && /keine Rückmeldung/.test(L['al3:abc:price-cross'].why) && !g5.body.grant && g5.body.holder === 'app:iphone1');
  // Episoden
  const base = 'pos1:xyz:sl';
  check('Episode: ohne Meldung in der aktuellen Episode kein Wechsel', W.epNext(E, L, base, 0, T0) === 0);
  W.evReserve(L, pol, { eventId: `${base}:0`, targetId: 'course-alert', sender: 'oracle' }, T0);
  const e1 = W.epNext(E, L, base, 0, T0 + 60e3), e2 = W.epNext(E, L, base, 0, T0 + W.EP_COOL + 1), e3 = W.epNext(E, L, base, 0, T0 + W.EP_COOL + 2);
  check('Episode: erst nach der Abklingzeit (5 min) – App und Dienst melden dasselbe Verlassen, es zählt einmal (0 → 1)', e1 === 0 && e2 === 1 && e3 === 1 && W.epNext(E, L, base, 1, T0 + W.EP_COOL + 3) === 1, `${e1} ${e2} ${e3}`);
  check('Ereignis-IDs: Alarm + Aktivierung + Art (Aktivierung aus dem Scharfschalten, Basis 36)', W.alarmEvent({ id: 'al9', armedAt: 1791000000000 }) === `al9:${(1791000000000).toString(36)}:price-cross` && W.pnlEvent({ k: 'profit', at: 36 }) === 'pnl:profit:10:threshold' && W.posBase({ id: 'p1', since: 35 }, 'tp') === 'p1:z:tp');

  // ================= Einstellungen =================
  const cf = path.join(dir, 'conf.json'), wc = o => { fs.writeFileSync(cf, JSON.stringify({ token: TOKEN, chat: CHAT, ...o })); return () => W.readServerConfig(cf); };
  let c0 = wc({})(); check('Einstellungen 1.4 (ohne Schlüssel): keine Steuerung, Herkunft der App vorbelegt', c0.key === '' && c0.origins[0] === ORIGIN && c0.listen === '127.0.0.1:8247');
  let bad = 0; for (const o of [{ key: 'kurz' }, { origin: 'http://evil.example' }, { listen: '0.0.0.0:8247' }]) { try { wc(o)(); } catch { bad++; } }
  check('Abgelehnt: zu kurzer Schlüssel, Herkunft ohne HTTPS, Lauschen nach außen (0.0.0.0)', bad === 3, String(bad));

  // ================= Dienst mit HTTP =================
  const k = (t, o, h, l, c) => [t, String(o), String(h), String(l), String(c), '1', t + M - 1];
  const tc = Date.UTC(2026, 9, 6, 12, 0); let now = tc + 5e3, rows = {}, tgLog = [], files = new Map(), pinned = null, tgMode = null, logs = [];
  const reply = (body, status = 200) => ({ ok: status < 300, status, json: async () => body });
  globalThis.fetch = async (url, o = {}) => {
    const u = new URL(url);
    if (u.hostname === '127.0.0.1') return realFetch(url, o);
    const b = o.body ? JSON.parse(o.body) : {};
    if (u.pathname.startsWith(`/file/bot${TOKEN}/`)) return reply(JSON.parse(files.get(u.pathname.split('/').pop())));
    const m = /^\/bot[^/]+\/(\w+)$/.exec(u.pathname);
    if (m) {
      if (m[1] === 'sendMessage' && tgMode) { const mode = tgMode; tgLog.push({ method: m[1], ...b, at: now, failed: mode }); if (mode === 'reset') throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } }); if (mode === 'timeout') throw new DOMException('timed out', 'TimeoutError'); if (mode === 'refused') throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } }); }
      if (!(m[1] === 'sendMessage' && tgMode)) tgLog.push({ method: m[1], ...b, at: now });
      if (m[1] === 'getMe') return reply({ ok: true, result: { id: 123456789, is_bot: true, username: 'kursalarm_bot' } });
      if (m[1] === 'getChat') return reply({ ok: true, result: { id: +CHAT, type: 'private', first_name: 'Nico', ...(pinned ? { pinned_message: pinned } : {}) } });
      if (m[1] === 'getFile') return reply({ ok: true, result: { file_id: b.file_id, file_path: `documents/${b.file_id}` } });
      if (m[1] === 'editMessageCaption') { if (b.caption === pinned?.caption) return reply({ ok: false, error_code: 400, description: 'Bad Request: message is not modified' }, 400); pinned = { ...pinned, caption: b.caption, edit_date: Math.floor(now / 1000) }; return reply({ ok: true, result: pinned }); }
      return reply({ ok: true, result: { message_id: 900 + tgLog.length } });
    }
    if (/klines/.test(u.pathname)) { const s = u.searchParams.get('symbol'); return reply(rows[s] || rows.BTCUSDT); }
    if (/calendar/.test(u.pathname)) return reply({ events: [] });
    return reply({}, 404);
  };
  let fileNo = 0; const pin = data => { const id = `f${++fileNo}`; files.set(id, JSON.stringify({ kind: 'scalpdesk-247', v: 1, on: true, tz: 'UTC', app: '3.33.0', dev: 'Test', ev: { alarm: true, pos: true, news: true, pnl: true, pulse: false }, econ: { warn: 0, cur: 'usd' }, alarms: [], positions: [], ...data }));
    pinned = { message_id: 77, date: Math.floor(now / 1000), from: { id: 123456789 }, document: { file_id: id, file_unique_id: 'u' + id, file_name: 'scalpdesk-247.json' }, caption: '📌 Scalp Desk · 24/7-Dienst\nApp: x · #' + (data.tag || 'ab12') }; };
  const statePath = path.join(dir, 'state.json');
  const make = () => new W.Watcher({ token: TOKEN, chat: CHAT, key: KEY, origins: [ORIGIN], listen: '127.0.0.1:0', host: 'test.sslip.io', statePath, now: () => now, log: (...a) => logs.push(a.join(' ')) });
  let w = make(); const port = await w.listenNow();
  check('Steuerung lauscht (nur 127.0.0.1), Protokoll nennt Adresse und Herkunft, nicht den Schlüssel', port > 0 && logs.some(l => /^Steuerung bereit: lauscht auf 127\.0\.0\.1:\d+ · öffentlich https:\/\/test\.sslip\.io · Herkunft der App https:\/\/nicoahb\.github\.io$/.test(l)) && !logs.join('\n').includes(KEY), logs.at(-1));
  const U = p => `http://127.0.0.1:${port}${p}`, H = (extra = {}) => ({ authorization: `Bearer ${KEY}`, 'content-type': 'application/json', ...extra });
  const call = async (p, { method = 'GET', body, headers = H() } = {}) => { const res = await realFetch(U(p), { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) }); let j = null; try { j = await res.json(); } catch { /* 204 */ } return { status: res.status, j, h: res.headers }; };
  let x = await call('/v1/health', { headers: {} });
  check('GET /v1/health ohne Schlüssel: läuft, Version 2.0.0', x.status === 200 && x.j.ok && x.j.v === '2.0.0');
  check('GET /v1/state ohne bzw. mit falschem Schlüssel: 401', (await call('/v1/state', { headers: {} })).status === 401 && (await call('/v1/state', { headers: { authorization: 'Bearer falsch' } })).status === 401);
  x = await call('/v1/state'); check('GET /v1/state mit Schlüssel: Revision 0, drei Ziele an', x.status === 200 && x.j.rev === 0 && x.j.targets['course-alert'].on && x.j.targets.trades.on, JSON.stringify(x.j).slice(0, 200));
  x = await call('/v1/state', { method: 'OPTIONS', headers: { origin: ORIGIN, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' } });
  check('CORS-Vorabprüfung der App-Herkunft: 204 mit genau dieser Herkunft, Methoden und Kopfzeilen', x.status === 204 && x.h.get('access-control-allow-origin') === ORIGIN && /POST/.test(x.h.get('access-control-allow-methods')) && /authorization/.test(x.h.get('access-control-allow-headers')));
  x = await call('/v1/state', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }); const x2 = await call('/v1/state', { headers: H({ origin: 'https://evil.example' }) });
  check('Fremde Herkunft: 403, keine CORS-Freigabe – auch mit richtigem Schlüssel', x.status === 403 && !x.h.get('access-control-allow-origin') && x2.status === 403 && !x2.h.get('access-control-allow-origin'));
  x = await call('/v1/state', { headers: H({ origin: ORIGIN }) }); check('Anfrage der App-Herkunft: Antwort mit CORS-Freigabe', x.status === 200 && x.h.get('access-control-allow-origin') === ORIGIN);
  // Master-Auftrag, dauerhaft vor der Antwort
  x = await call('/v1/policy', { method: 'POST', body: { commandId: 'm-all-off-1', expectedRevision: 0, set: { 'course-alert': false, backup: false, trades: false } } });
  const disk = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  check('Master AUS über HTTP: 200, Revision 1 – und schon vor der Antwort in der Zustandsdatei', x.status === 200 && x.j.rev === 1 && disk.v === 2 && disk.pol.rev === 1 && !disk.pol.targets.backup.on, JSON.stringify(x.j).slice(0, 160));
  check('Protokoll: „Schalter geändert (Auftrag …, Revision 0 → 1): Kursalarm AUS, Sicherung AUS, Trades AUS“', logs.some(l => l === 'Schalter geändert (Auftrag m-all-off-1, Revision 0 → 1): Kursalarm AUS, Sicherung AUS, Trades AUS'), logs.filter(l => /Schalter/.test(l)).join(' | '));
  const [a1, a2] = await Promise.all([1, 2].map(i => call('/v1/policy', { method: 'POST', body: { commandId: `race-cmd-${i}`, expectedRevision: 1, set: { 'course-alert': true, backup: true, trades: true } } })));
  check('Zwei konkurrierende Aufträge mit derselben erwarteten Revision: einer 200, der andere 409', [a1.status, a2.status].sort().join() === '200,409', `${a1.status} ${a2.status}`);
  const lost = a1.status === 200 ? 'race-cmd-1' : 'race-cmd-2';
  x = await call(`/v1/commands/${lost}`); const unk = await call('/v1/commands/nie-gesendet-1');
  check('Antwort verloren: Ergebnis des Auftrags abfragbar (gefunden, 200, Revision 2); unbekannter Auftrag: nicht gefunden', x.status === 200 && x.j.found && x.j.status === 200 && x.j.result.rev === 2 && unk.status === 404 && unk.j.found === false, JSON.stringify(x.j).slice(0, 160));
  x = await call('/v1/policy', { method: 'POST', body: { commandId: lost, expectedRevision: 1, set: { 'course-alert': true } } });
  check('Derselbe Auftrag erneut gesendet: dieselbe Antwort, keine zweite Änderung', x.status === 200 && x.j.repeat && x.j.rev === 2);
  // Neustart: bestätigter Stand bleibt
  w.server.close(); w = make(); const port2 = await w.listenNow(); const U2 = p => `http://127.0.0.1:${port2}${p}`;
  x = { j: await (await realFetch(U2('/v1/state'), { headers: H() })).json() };
  check('Neustart: Revision 2 und Schalter wie bestätigt (anderes Gerät liest denselben Stand)', x.j.rev === 2 && x.j.targets['course-alert'].on && x.j.targets['course-alert'].epoch === 3, JSON.stringify(x.j.targets));
  const call2 = async (p, body) => { const res = await realFetch(U2(p), { method: body ? 'POST' : 'GET', headers: H(), ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: res.status, j: await res.json() }; };
  // zwei Geräte um dieselbe Freigabe
  const ev = 'alB:k0:price-cross', rs = await Promise.all(['app:iphone1', 'app:ipad001'].map(s => call2('/v1/events/reserve', { eventId: ev, targetId: 'course-alert', sender: s, label: 'Kurs-Alarm BTC' })));
  check('iPhone und iPad gleichzeitig: genau eine Freigabe', rs.filter(r => r.j.grant).length === 1, JSON.stringify(rs.map(r => r.j)));
  const holder = rs.find(r => r.j.grant) ? (rs[0].j.grant ? 'app:iphone1' : 'app:ipad001') : '';
  x = await call2('/v1/events/report', { eventId: ev, sender: holder, st: 'confirmed' });
  check('Inhaber meldet „zugestellt“; Protokoll mit Ereignis, Ziel, Sender, Zustand', x.j.st === 'confirmed' && logs.some(l => l === `Ereignis ${ev} · Ziel course-alert · Sender ${holder} · zugestellt`), logs.filter(l => l.startsWith('Ereignis')).slice(-2).join(' | '));
  check('Sender „oracle“ ist für die App gesperrt', (await call2('/v1/events/report', { eventId: ev, sender: 'oracle', st: 'confirmed' })).status === 400);
  // ---- Dienst erkennt Alarme: nur mit Freigabe ----
  rows.BTCUSDT = [k(tc - M, 100, 100.5, 99.5, 100), k(tc, 100, 100.2, 99.9, 100)];
  const armed = tc - 10 * M;
  pin({ tag: 'ab12', alarms: [{ id: 'al1', symbol: 'BTCUSDT', source: 'spot', dir: 'above', price: 101, armedAt: armed }, { id: 'al2', symbol: 'BTCUSDT', source: 'spot', dir: 'above', price: 102, armedAt: armed }] });
  const step = async (ms = 16e3) => { now += ms; w.next.price = 0; w.next.config = 0; await w.tick(); };
  await step(1000); await step();
  const sentTexts = () => tgLog.filter(m => m.method === 'sendMessage' && !m.failed).map(m => m.text);
  // App reserviert al1 zuerst
  await call2('/v1/events/reserve', { eventId: W.alarmEvent({ id: 'al1', armedAt: armed }), targetId: 'course-alert', sender: 'app:iphone1', label: 'Kurs-Alarm BTC' });
  rows.BTCUSDT = [k(tc, 100, 100.2, 99.9, 100), k(tc + M, 100, 103, 99.9, 102.5)]; const n0 = sentTexts().length; await step();
  const newMsgs = sentTexts().slice(n0);
  check('Kurs über beide Marken: al1 hatte die App schon reserviert → der Dienst schweigt dazu; al2 meldet der Dienst', newMsgs.filter(t => /Kurs-Alarm BTC/.test(t)).length === 1 && /auf\/über 102,00/.test(newMsgs.find(t => /Kurs-Alarm/.test(t)) || '') && logs.some(l => /^Ereignis al1:.*schon von App \(iphone1\) übernommen/.test(l)), newMsgs.join(' || ').slice(0, 300));
  const e2id = W.alarmEvent({ id: 'al2', armedAt: armed }), st2 = w.evs[e2id];
  check('… al2: reserviert vom Dienst, nach dem Senden „zugestellt“', st2?.by === 'oracle' && st2.st === 'confirmed', JSON.stringify(st2));
  x = await call2('/v1/events/reserve', { eventId: e2id, targetId: 'course-alert', sender: 'app:ipad001' });
  check('App kommt danach mit al2: keine Freigabe, Inhaber 24/7-Dienst', !x.j.grant && x.j.holder === 'oracle' && x.j.st === 'confirmed');
  x = await call2('/v1/state'); check('GET /v1/state nennt die Ereignisse (für den Abgleich beim Start der App)', x.j.events.some(e => e.id === e2id && e.by === 'oracle' && e.st === 'confirmed'));
  // ---- AUS verwirft wartende Meldungen, AN belebt sie nicht ----
  tgMode = 'refused'; await w.queue('🔔 wartet', 'UTC', { label: 'Kurs-Alarm W', ev: '' });
  check('Telegram nicht erreichbar (keine Verbindung): Meldung wartet im Ausgang', w.out.length === 1 && w.out[0].tries === 1);
  let rev = (await call2('/v1/state')).j.rev;
  x = await call2('/v1/policy', { commandId: 'off-wait-01', expectedRevision: rev, set: { 'course-alert': false } });
  check('Kursalarm AUS: wartende Meldung sofort verworfen (Protokoll)', x.j.ok && w.out.length === 0 && logs.some(l => l === 'Meldung verworfen (Ziel Kursalarm ausgeschaltet): Kurs-Alarm W'));
  tgMode = null; x = await call2('/v1/policy', { commandId: 'on-again-01', expectedRevision: x.j.rev, set: { 'course-alert': true } }); const nA = sentTexts().length; await step();
  check('Wieder AN: die verworfene Meldung kommt nicht nach', !sentTexts().slice(nA).some(t => /wartet/.test(t)));
  // Epoche: zwischendurch aus und an (Meldung wartet noch, Ziel wieder an) → verworfen
  tgMode = 'refused'; await w.queue('🔔 alte Epoche', 'UTC', { label: 'Kurs-Alarm E' }); const epo = w.out[0]?.epoch;
  w.pol.targets['course-alert'].epoch += 2; tgMode = null; w.out[0].next = 0; await w.deliver();
  check('Vor dem Senden geprüft: andere Epoche (aus- und wieder eingeschaltet) → verworfen, nicht gesendet', epo && w.out.length === 0 && !sentTexts().some(t => /alte Epoche/.test(t)) && logs.some(l => /^Meldung verworfen \(Ziel Kursalarm zwischendurch aus- und wieder eingeschaltet\): Kurs-Alarm E$/.test(l)));
  // ---- verlorene Telegram-Antwort ----
  for (const mode of ['reset', 'timeout']) {
    const id = `lost-${mode}:a:price-cross`; w.reserveOwn(id, 'Kurs-Alarm L'); tgMode = mode; const nT = tgLog.length;
    await w.queue('🔔 verloren', 'UTC', { label: 'Kurs-Alarm L', ev: id }); now += 5 * M; tgMode = null; await w.deliver();
    const tries = tgLog.slice(nT).filter(m => m.method === 'sendMessage').length;
    check(`Antwort verloren (${mode === 'reset' ? 'Verbindung abgerissen' : 'Zeitüberschreitung'}): „Zustellung unbestätigt“, genau ein Sendeversuch, kein zweiter`, tries === 1 && w.out.length === 0 && w.evs[id].st === 'unconfirmed' && logs.some(l => /^Zustellung unbestätigt: Kurs-Alarm L – Telegram antwortet nicht .*kein zweiter Versuch/.test(l)), `${tries} ${w.evs[id]?.st}`);
  }
  // ---- Stop/Ziel: Hysterese und Abklingzeit ----
  rows.SOLUSDT = [k(now - M, 150, 150.2, 149.9, 150), k(now, 150, 150.1, 149.95, 150)];
  const since = now - 20 * M; pin({ tag: 'cd34', alarms: [], positions: [{ id: 'P1', symbol: 'SOLUSDT', source: 'spot', side: 'long', sl: 149, tp: null, since, ack: { sl: false, tp: false } }] });
  await step(); await step();
  const stopMsgs = () => sentTexts().filter(t => /SOL Long: Stop-Loss erreicht/.test(t)).length;
  const sol = (o, h, l, c) => { rows.SOLUSDT = [k(now - M, o, h, l, c), k(now, c, c, c, c)]; };
  sol(150, 150, 148.8, 148.9); await step();
  check('Stop-Loss erreicht: eine Meldung (Episode 0)', stopMsgs() === 1 && w.evs[`${W.posBase({ id: 'P1', since }, 'sl')}:0`]?.st === 'confirmed', String(stopMsgs()));
  sol(149.05, 149.05, 149.05, 149.05); await step(); sol(149.05, 149.05, 148.9, 148.95); await step();
  check('Nur knapp über der Marke (unter 0,1 %): keine neue Episode, keine zweite Meldung', stopMsgs() === 1);
  sol(149.4, 149.4, 149.3, 149.4); await step(); sol(149.3, 149.3, 148.9, 148.95); await step();
  check('0,1 % weg und zurück innerhalb der Abklingzeit: dieselbe Episode, keine zweite Meldung', stopMsgs() === 1 && (w.eps[W.posBase({ id: 'P1', since }, 'sl')]?.n || 0) === 0);
  now += W.EP_COOL; sol(149.4, 149.4, 149.3, 149.4); await step(); sol(149.3, 149.3, 148.9, 148.95); await step();
  check('Nach der Abklingzeit weg und zurück: Episode 1, zweite Meldung', stopMsgs() === 2 && w.eps[W.posBase({ id: 'P1', since }, 'sl')]?.n === 1, String(stopMsgs()));
  // ---- Gewinn/Verlust: ohne Wartezeit, App zuerst ----
  rows.ETHUSDT = [k(now - M, 100, 100, 100, 100), k(now, 100, 100, 100, 100)];
  const pAt = now - M, lim = { k: 'profit', v: 50, at: pAt, w: false }; pin({ tag: 'ef56', pnl: { n: 1, pos: [{ id: 'E1', symbol: 'ETHUSDT', source: 'spot', side: 'long', entry: 100, qty: 10 }], lim: [lim] } });
  await step(); await call2('/v1/events/reserve', { eventId: W.pnlEvent(lim), targetId: 'course-alert', sender: 'app:iphone1', label: 'Gewinn-Alarm' });
  rows.ETHUSDT = [k(now - M, 100, 106, 100, 106), k(now, 106, 106, 106, 106)]; const nP = sentTexts().length; await step();
  check('Gewinn-Alarm: App hatte reserviert → Dienst sendet nicht, wartet auch nicht', !sentTexts().slice(nP).some(t => /Gewinn-Alarm/.test(t)) && w.pnlFired[W.pnlKey(lim)]?.by === 'app' && !Object.keys(w.pnlPend).length);
  // ---- Puls/Termine bei AUS ----
  rev = (await call2('/v1/state')).j.rev; await call2('/v1/policy', { commandId: 'off-pulse-1', expectedRevision: rev, set: { 'course-alert': false } });
  const nQ = sentTexts().length; await w.queue('⚡ BTC-Puls test', 'UTC', { label: 'BTC-Puls' });
  check('Kursalarm aus: auch BTC-Puls/Termine gehen nicht in den Ausgang', sentTexts().length === nQ && w.out.length === 0 && logs.some(l => l === 'Nicht gesendet (Ziel Kursalarm ausgeschaltet): BTC-Puls'));
  rev = (await call2('/v1/state')).j.rev; await call2('/v1/policy', { commandId: 'on-pulse-01', expectedRevision: rev, set: { 'course-alert': true } });
  // ---- Zeile des Dienstes, Geheimnisse, Status ----
  w.next.beat = 0; await w.tick(); const svc = pinned.caption.split('\n').find(l => l.startsWith('Dienst:')) || '';
  check('Zeile des Dienstes: „· v2.0.0 · HTTPS“; die Erkennung der App (3.32) liest sie weiter', /^Dienst: aktiv · .* · v2\.0\.0 · HTTPS( · GV)? · #ef56 übernommen$/.test(svc) && /^Dienst: (aktiv|Störung) · .*? · #([a-z0-9]{2,12}) übernommen(?: · (.*))?$/.test(svc), svc);
  check('Kein Schlüssel und kein Token im Protokoll', !logs.join('\n').includes(KEY) && !logs.join('\n').includes(TOKEN));
  const sl = []; const ws = new W.Watcher({ token: TOKEN, chat: CHAT, key: KEY, listen: `127.0.0.1:${port2}`, host: '', statePath, now: () => now, log: l => sl.push(l) }); ws.saveState = () => {}; ws.saveStateNow = () => {};
  await ws.status();
  check('„--status“: Steuerung lauscht, Ziele mit Revision, letzte Ereignisse mit Ziel, Sender und Zustand', sl.some(l => /^✓ Steuerung lauscht auf 127\.0\.0\.1:\d+ \(Dienst 2\.0\.0\)$/.test(l)) && sl.some(l => /^• Ziele \(Revision \d+\): Kursalarm an seit .* · Sicherung an seit .* · Trades an seit /.test(l)) && sl.some(l => /^• Letzte Ereignisse: .*→ Kursalarm, (24\/7-Dienst|App \(\w+\)), (zugestellt|Zustellung unbestätigt|verworfen)/.test(l)), sl.filter(l => /Steuerung|Ziele|Ereignisse/.test(l)).join(' | ').slice(0, 400));
  // ---- Zustand 1.4 übernehmen ----
  const old = path.join(dir, 'old.json'); fs.writeFileSync(old, JSON.stringify({ v: 1, fired: { 'al:x:1': 1 }, out: [], last: { t: 5, label: 'Kurs-Alarm X' } }));
  const wo = new W.Watcher({ token: TOKEN, chat: CHAT, key: KEY, statePath: old, now: () => now, log: () => {} });
  check('Zustand aus 1.4: übernommen, alle Ziele an, Revision 0; gespeichert als Version 2', wo.fired['al:x:1'] === 1 && wo.last.label === 'Kurs-Alarm X' && wo.pol.rev === 0 && W.TARGETS.every(id => wo.pol.targets[id].on) && (wo.saveStateNow(), JSON.parse(fs.readFileSync(old, 'utf8')).v === 2));
  // falscher Schlüssel: bremsen
  let st429 = 0; for (let i = 0; i < 22; i++) { const res = await realFetch(U2('/v1/state'), { headers: { authorization: 'Bearer falsch' } }); if (res.status === 429) st429++; }
  check('Viele falsche Schlüssel: nach 20 Versuchen je Minute 429', st429 >= 1, String(st429));
  w.server.close(); globalThis.fetch = realFetch;
  console.log(`${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
