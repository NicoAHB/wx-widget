// ---------- Schritt 5.1: 24/7-Dienst – Übergabe an einen eigenen Server (3.23.0) ----------
// Ein kleines Programm auf einem Server, der rund um die Uhr läuft (server/scalpdesk-247.mjs, z. B. kostenlos bei Oracle
// Cloud), meldet Kurs-Alarme, Stop-Loss/Take-Profit und Termin-Warnungen per Telegram – auch wenn die App geschlossen ist.
// 3.26.0: ab Dienst 1.2 auch den Gewinn-/Verlust-Alarm. Nur solange dort eine Grenze aktiv ist, übergibt die App dafür
// zusätzlich die offenen Positionen mit Einstieg und Menge (pnlHandover); der Dienst bestätigt mit „· GV“ und vermerkt eine
// gesendete Meldung in der angehefteten Nachricht, die App übernimmt sie als „ausgelöst“ (pnlFromSvc).
// Ausgelöste Kurs-Alarme, die der Dienst melden soll, bleiben noch 3 Minuten in der Übergabe – sonst könnte er die neue
// Datei lesen, bevor er die Berührung bei seiner nächsten Kursprüfung selbst gesehen und gemeldet hat.
// Übergabe über den eigenen Telegram-Chat: Die App legt die aktiven Alarme und die Marken der offenen Positionen (Kürzel,
// Richtung, Stop und Ziel – keine Mengen, Einstiege, Trades oder Notizen zu Positionen) als Datei „scalpdesk-247.json“ in
// den Chat, heftet sie an und ersetzt sie nach jeder Änderung (editMessageMedia: eine Nachricht, immer aktuell). Der Dienst
// liest sie mit demselben Bot und schreibt „Dienst: aktiv · … · #tag übernommen“ in ihre Beschriftung, alle 10 Minuten neu.
// Die App liest das über getChat. Ist die Bestätigung frisch (höchstens 20 Minuten) und gilt sie dem zuletzt übergebenen
// Stand, sendet die App Meldungen, die der Dienst kennt, nicht selbst – keine doppelten Nachrichten. Sonst wie bisher.
// Der Bot-Token verlässt die App dafür nicht: Am Server gibt man ihn selbst ein.
// var statt const/let: persist() und notifyChannels() können schon laufen, bevor dieser Abschnitt ausgewertet ist
var S247_KEY = 'scalpdesk.s247.v1', S247_FILE = 'scalpdesk-247.json', S247_MARK = '📌 Scalp Desk · 24/7-Dienst', S247_STALE = 20 * 60e3, S247_POLL = 2 * 60e3, S247_GRACE = 3 * 60e3;
var s247 = { cfg: null, timer: null, busy: false, error: '', st: null, checking: false, checkAt: 0, checkErr: '', recheck: null, watchUntil: 0, me: null, meTok: '' }; // 3.28.0: watchUntil – bis dann alle 10 s nachfragen; me – Bot dieser App (getMe), zum Vergleich mit dem Server
s247.cfg = loadS247();
function loadS247() {
  const v = store.get(S247_KEY), s = x => (typeof x === 'string' ? x : '');
  return { on: !!v?.on, sentOn: !!v?.sentOn, pulse: !!v?.pulse, gv: !!v?.gv, chat: s(v?.chat), msg: Number(v?.msg) || 0, tag: s(v?.tag), at: Number(v?.at) || 0, sig: s(v?.sig),
    keys: Array.isArray(v?.keys) ? v.keys.filter(k => typeof k === 'string') : [], econ: s(v?.econ),
    hist: Array.isArray(v?.hist) ? v.hist.filter(h => typeof h?.tag === 'string' && Array.isArray(h.keys)).slice(0, 6).map(h => ({ tag: h.tag, keys: h.keys.filter(k => typeof k === 'string') })) : [], n: v?.n && typeof v.n === 'object' ? { a: Number(v.n.a) || 0, p: Number(v.n.p) || 0 } : { a: 0, p: 0 } };
}
function saveS247() { if (store.set(S247_KEY, { ...s247.cfg })) broadcastData([S247_KEY]); }
// „30.09. 12:40“ in Ortszeit – dasselbe Format schreibt der Dienst
function s247Stamp(t) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(t).map(x => [x.type, x.value]));
  return `${p.day}.${p.month}. ${p.hour}:${p.minute}`;
}
// Gerät für die Beschriftung, damit man sieht, woher die Übergabe kommt (nur auf einem Gerät einschalten)
function s247Device() {
  const u = navigator.userAgent, os = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1) ? 'iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac OS X/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : 'Gerät';
  const br = /Edg\//.test(u) ? 'Edge' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\/|CriOS\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'Browser';
  return `${br}, ${os}`;
}
const s247Plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// Was der Dienst braucht – und nur das
function s247Payload() {
  const on = s247.cfg.on && chan.tg.on;
  const alarms = on ? state.alarms.filter(a => !a.triggeredAt || (a.svcAt > 0 && Date.now() - a.svcAt < S247_GRACE)).map(a => ({ id: a.id, symbol: a.symbol, source: a.source, dir: a.dir, price: a.price, note: a.note || '', armedAt: a.armedAt || a.createdAt })) : [];
  const positions = on ? state.positions.filter(p => p.sl > 0 || p.tp > 0).map(p => ({ id: p.id, symbol: p.symbol, source: p.source, side: p.side, tp: p.tp > 0 ? p.tp : null, sl: p.sl > 0 ? p.sl : null,
    since: p.slTpAt || p.openedAt, ack: { tp: !!p.ack?.tp, sl: !!p.ack?.sl } })) : [];
  let tz = 'UTC'; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { /* alter Browser */ }
  return { kind: 'scalpdesk-247', v: 1, on, app: APP_VERSION, dev: s247Device(), tz, ev: { alarm: chan.ev.alarm, pos: chan.ev.pos, news: chan.ev.news, pulse: !!chan.ev.pulse, pnl: !!chan.ev.pnl },
    econ: { warn: ec?.cfg?.warn ?? 0, cur: ec?.cfg?.cur === 'all' ? 'all' : 'usd' }, alarms, positions,
    pulse: on && chan.ev.pulse ? pulseHandover() : null, // 3.24.0: Schwellen des BTC-Pulses je Stunde (UTC), Mindestgrößen, Vorauswahl
    pnl: on && chan.ev.pnl ? pnlHandover() : null }; // 3.26.0: Gewinn-/Verlust-Alarm – nur bei aktiver Grenze, dann mit Einstieg und Menge
}
function s247Sig(p) { const j = JSON.stringify(p); let h = 0; for (let i = 0; i < j.length; i++) h = (h * 31 + j.charCodeAt(i)) | 0; return `${j.length}:${h >>> 0}`; }
// Schlüssel der Meldungen, die der Dienst mit diesem Stand übernimmt – dieselben wie in notifyChannels
function s247Keys(p) { return [...p.alarms.map(a => `al:${a.id}:${a.armedAt}`), ...p.positions.flatMap(x => ['tp', 'sl'].filter(t => x[t] > 0).map(t => `pos:${x.id}:${t}:${x.since}`)), ...(p.pnl?.lim || []).map(l => `pnl:${l.k}:${l.at}`)]; }
function s247Caption(p) {
  return [S247_MARK, `App: ${s247Stamp(p.at)} · ${p.on ? `${s247Plural(p.alarms.length, 'Alarm', 'Alarme')}, ${s247Plural(p.positions.length, 'Position', 'Positionen')}` : 'Übergabe ausgeschaltet'} · ${p.dev} · #${p.tag}`,
    'Dienst: wartet auf Rückmeldung …'].join('\n');
}
const s247Ready = () => typeof tgConfigured === 'function' && tgConfigured() && (s247.cfg.on || s247.cfg.sentOn);
function scheduleS247(delay = 3000) { if (!s247?.cfg || !s247Ready()) return; clearTimeout(s247.timer); s247.timer = setTimeout(() => { s247.timer = null; void sendS247(); }, delay); }
const s247IsOurs = m => !!m?.document && (m.document.file_name === S247_FILE || String(m.caption || '').startsWith(S247_MARK));
// Übergeben: angeheftete Datei ersetzen (auch wenn ein anderer Tab sie angelegt hat), sonst neu senden und anheften.
// leaving: Seite wird verlassen – ohne Rückfrage bei Telegram und ohne Tab-Absprache sofort, mit keepalive
async function sendS247(force = false, leaving = false) {
  if (!s247Ready()) return;
  if (s247.busy) { s247.again = true; return; } // läuft gerade: danach noch einmal
  const p = s247Payload(), sig = s247Sig(p), c = s247.cfg;
  if (!force && sig === c.sig && c.chat === chan.tg.chat && c.msg) return;
  const claimed = !leaving && await store.claim('s247', 20000);
  if (!leaving && !claimed) return;
  s247.busy = true; s247.error = ''; renderS247();
  try {
    let msg = c.chat === chan.tg.chat ? c.msg : 0;
    if (!leaving) { const pm = (await tgApi(chan.tg.token, 'getChat', { chat_id: chan.tg.chat }))?.pinned_message; msg = s247IsOurs(pm) ? pm.message_id : 0; }
    const tag = Math.random().toString(36).slice(2, 6).padEnd(4, '0'), body = { ...p, tag, at: Date.now() }, text = JSON.stringify(body), file = new Blob([text], { type: 'application/json' }), cap = s247Caption(body);
    const keep = leaving && text.length < 60000;
    let done = false;
    if (msg) {
      const fd = new FormData(); fd.append('chat_id', chan.tg.chat); fd.append('message_id', String(msg));
      fd.append('media', JSON.stringify({ type: 'document', media: 'attach://file', caption: cap })); fd.append('file', file, S247_FILE);
      try { await tgPost('editMessageMedia', fd, keep); done = true; } catch (e) { if (e.code !== 400) throw e; } // Nachricht gelöscht: neu senden
    }
    if (!done) {
      const fd = new FormData(); fd.append('chat_id', chan.tg.chat); if (chan.tg.thread) fd.append('message_thread_id', chan.tg.thread); fd.append('caption', cap); fd.append('disable_notification', 'true'); fd.append('document', file, S247_FILE);
      msg = (await tgPost('sendDocument', fd, keep))?.message_id || 0;
      const pin = new FormData(); pin.append('chat_id', chan.tg.chat); pin.append('message_id', String(msg)); pin.append('disable_notification', 'true');
      try { await tgPost('pinChatMessage', pin, keep); }
      catch (e) { throw Object.assign(new Error(`Anheften nicht erlaubt (${e.message}) – bei einer Gruppe braucht der Bot das Recht „Nachrichten anheften“.`), { code: e.code }); }
    }
    s247.cfg = { ...s247.cfg, chat: chan.tg.chat, msg, tag, at: body.at, sig, keys: s247Keys(p), hist: [{ tag, keys: s247Keys(p) }, ...(s247.cfg.hist || []).filter(h => h.tag !== tag)].slice(0, 6), econ: p.on && p.ev.news && p.econ.warn ? `${p.econ.cur}|${p.econ.warn}` : '', pulse: !!(p.on && p.ev.pulse && p.pulse), gv: !!(p.on && p.ev.pnl && p.pnl), sentOn: p.on, n: { a: p.alarms.length, p: p.positions.length } };
    saveS247();
    // Was jetzt angeheftet ist, wissen wir; die Rückmeldung des Dienstes (falls er schon lief) bleibt bis zur nächsten Abfrage
    s247.st = s247.st?.found && s247.st.msg === msg ? { ...s247.st, tag } : { found: true, msg, tag, dev: body.dev, svc: null, beat: 0, fresh: false };
    // Bestätigung des Dienstes abwarten: er liest jede Minute
    // 3.28.0: Der Dienst (ab 1.4) liest alle 20 s – die Bestätigung bald und dann alle 10 s abfragen, bis sie da ist (höchstens 3 min)
    clearTimeout(s247.recheck); s247.watchUntil = Date.now() + 180e3; if (!leaving) s247.recheck = setTimeout(() => void checkS247(), 8e3);
  } catch (e) { s247.error = e?.message || String(e); }
  finally { s247.busy = false; if (claimed) void store.release('s247'); renderS247(); if (s247.again && !leaving) { s247.again = false; scheduleS247(300); } }
}
// 3.27.0 (Dienst ab 1.3): „Zustellung: zuletzt 01.10. 14:32 · Kurs-Alarm BTC“ – Zeit in der Zeitzone der App, Jahr ergänzt.
// Vor der ersten Meldung steht „Zustellung: geprüft, noch keine Meldung“; ein Dienst bis 1.2 schreibt die Zeile nicht.
function s247Last(line, now) {
  const m = /^Zustellung: zuletzt (\d\d)\.(\d\d)\. (\d\d):(\d\d)(?: · (.*))?$/.exec(line || ''); if (!m) return null;
  const y = new Date(now).getFullYear(), at = yy => new Date(yy, +m[2] - 1, +m[1], +m[3], +m[4]).getTime();
  let t = at(y); if (t > now + 864e5) t = at(y - 1);
  return { t, label: (m[5] || '').slice(0, 80) };
}
// Angeheftete Nachricht lesen: Zeile des Dienstes und Zeitpunkt der letzten Änderung (Lebenszeichen)
function s247Parse(pm, now = Date.now()) {
  if (!s247IsOurs(pm)) return { found: false };
  const lines = String(pm.caption || '').replace(/\r/g, '').split('\n'), app = lines.find(l => l.startsWith('App:')) || '', svc = lines.find(l => l.startsWith('Dienst:')) || '', parts = app.split(' · '), zl = lines.find(l => l.startsWith('Zustellung:'));
  const m = /^Dienst: (aktiv|Störung) · .*? · #([a-z0-9]{2,12}) übernommen(?: · (.*))?$/.exec(svc), beat = (pm.edit_date || pm.date || 0) * 1000, flags = svc.split(' · ');
  const gv = lines.map(l => /^GV: .* · @([pl]):(\d{10,15}):(\d{10,15}):(-?\d+(?:\.\d+)?)$/.exec(l)).filter(Boolean).map(x => ({ k: x[1] === 'p' ? 'profit' : 'loss', at: +x[2], t: +x[3], val: +x[4] }));
  return { found: true, msg: pm.message_id, tag: /#([a-z0-9]{2,12})$/.exec(app)?.[1] || '', dev: parts.length >= 4 ? parts.at(-2) : '',
    svc: m ? { ok: m[1] === 'aktiv', tag: m[2], problem: m[3] || '', pulse: flags.includes('Puls'), gv: flags.includes('GV'), zv: !!zl, ver: (flags.find(f => /^v\d+\.\d+\.\d+$/.test(f)) || '').slice(1) } : null, gv, last: s247Last(zl, now), beat, fresh: !!m && now - beat < S247_STALE };
}
async function checkS247() {
  if (!s247?.cfg || typeof tgConfigured !== 'function' || !tgConfigured() || s247.checking) return;
  s247.checking = true; renderS247();
  try {
    const pm = (await tgApi(chan.tg.token, 'getChat', { chat_id: chan.tg.chat }))?.pinned_message;
    s247.st = s247Parse(pm); s247.checkErr = '';
    // 3.28.0: Bot dieser App (einmal je Token) – zum Vergleich mit dem Bot am Server, falls der Dienst nicht bestätigt
    if (s247.meTok !== chan.tg.token) { try { s247.me = await tgApi(chan.tg.token, 'getMe'); s247.meTok = chan.tg.token; } catch { /* nur Anzeige */ } }
    if (s247.cfg.on && s247.st.gv?.length && typeof pnlFromSvc === 'function') pnlFromSvc(s247.st.gv); // vom Dienst gesendeter Gewinn-/Verlust-Alarm
    // Angeheftete Datei fehlt oder ist eine andere (gelöscht, vom Nutzer ersetzt): neu übergeben
    if (s247.cfg.on && (!s247.st.found || (s247.cfg.msg && s247.st.msg !== s247.cfg.msg && s247.st.tag !== s247.cfg.tag))) { s247.cfg = { ...s247.cfg, sig: '' }; scheduleS247(1000); }
  } catch (e) { s247.checkErr = e?.message || String(e); }
  finally {
    s247.checking = false; s247.checkAt = Date.now(); renderS247(); if (typeof pnlCheck === 'function') pnlCheck();
    // 3.28.0: nach einer Übergabe weiter nachfragen, bis der Dienst bestätigt (oder 3 Minuten um sind)
    if (s247.cfg.on && !s247Active() && Date.now() < (s247.watchUntil || 0)) { clearTimeout(s247.recheck); s247.recheck = setTimeout(() => void checkS247(), 10e3); }
  }
}
// Kennt der Dienst diese Meldung und meldet er sich? Dann sendet die App sie nicht selbst (siehe notifyChannels).
function s247Covers(type, key) {
  if (!s247?.cfg?.on || !['alarm', 'pos', 'news', 'pulse'].includes(type)) return false;
  const st = s247.st, c = s247.cfg, now = Date.now();
  if (!st?.found || st.msg !== c.msg || !st.svc?.ok || now - st.beat > S247_STALE || now - s247.checkAt > S247_STALE) return false;
  // 3.26.0: bestätigt ist der neueste Stand – oder ein kürzlich übergebener, der diesen Alarm schon enthielt (die App hat seitdem
  // erneut übergeben, der Dienst liest das erst in bis zu einer Minute; den Alarm meldet er auch mit dem älteren Stand)
  const cur = st.svc.tag === c.tag, seen = cur ? c : (c.hist || []).find(h => h.tag === st.svc.tag);
  if (!seen) return false;
  // BTC-Puls: nur wenn der Dienst ihn kann (ab 1.1 steht „Puls“ in seiner Zeile) und die Schwellen übergeben sind
  return type === 'news' ? cur && !!c.econ : type === 'pulse' ? cur && !!(c.pulse && st.svc.pulse) : seen.keys.includes(key) && c.keys.includes(key);
}
// 3.24.0 BTC-Puls: kommt er vom Dienst? Ein älterer Dienst (1.0) kennt ihn nicht – dann sendet ihn weiter die geöffnete App
function s247PulseText(c, st) {
  if (!chan?.ev?.pulse) return '';
  if (st.svc?.pulse && c.pulse) return ' Der BTC-Puls kommt ebenfalls vom Dienst.';
  if (st.svc?.pulse) return ' Den BTC-Puls übernimmt der Dienst, sobald die Schwellen berechnet und übergeben sind.';
  return ' Den BTC-Puls sendet weiter diese App, solange sie geöffnet ist: Der Dienst kennt ihn erst ab Version 1.1 – am Server den Installationsbefehl erneut ausführen.';
}
// 3.26.0 Gewinn-/Verlust-Alarm: prüft der Dienst mit? Ein älterer Dienst (bis 1.1) kann es nicht – dann nur die geöffnete App
function s247GvText(c, st) {
  if (!chan?.ev?.pnl || typeof pnlActive !== 'function' || !pnlActive()) return '';
  if (st.svc?.gv && c.gv) return ' Den Gewinn-/Verlust-Alarm meldet bei geschlossener App der Dienst, bei geöffneter App diese App selbst.';
  return ' Den Gewinn-/Verlust-Alarm prüft weiter nur diese App, solange sie geöffnet ist: Der Dienst kann ihn erst ab Version 1.2 – am Server den Installationsbefehl erneut ausführen.';
}
// Stand des Dienstes nach dem Öffnen: Erst nach der ersten Abfrage entscheidet die App, ob sie eine Meldung selbst sendet
function s247Settled() {
  if (!s247?.cfg?.on || s247.checkAt) return Promise.resolve();
  return Promise.race([s247.first || Promise.resolve(), new Promise(r => setTimeout(r, 8000))]);
}
// 3.27.0: Wann hat der Dienst zuletzt etwas zugestellt? Ein Dienst bis 1.2 prüft die Zustellung nicht – Hinweis aufs Update
function s247LastText(st) {
  if (!st.svc?.zv) return ' Ob Telegram seine Meldungen annimmt, prüft der Dienst erst ab Version 1.3 – am Server den Installationsbefehl erneut ausführen.';
  const dm = t => new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return st.last ? ` Zuletzt zugestellt: ${dm(st.last.t)}${st.last.label ? ` (${st.last.label})` : ''}.` : ' Zugestellt hat er noch keine Meldung.';
}
// Kurzform für die Übersicht im Hinweis-Menü
function s247SumText() { const st = s247?.st; return s247Active() ? ' · 24/7-Dienst: aktiv' : s247?.cfg?.on && st?.svc && st.fresh && !st.svc.ok ? ' · 24/7-Dienst: Störung' : ''; }
function s247Active() { const st = s247?.st, c = s247?.cfg; return !!(c?.on && st?.found && st.msg === c.msg && st.svc?.ok && st.svc.tag === c.tag && Date.now() - st.beat < S247_STALE); }
function renderS247() {
  if (!s247?.cfg || !$('s247-on')) return;
  const ok = typeof tgConfigured === 'function' && tgConfigured(), c = s247.cfg, st = s247.st, now = Date.now(), hm = t => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  $('s247-on').checked = c.on; $('s247-on').disabled = !ok && !c.on; $('s247-check').disabled = !ok || s247.checking;
  const counts = `${s247Plural(c.n.a, 'Alarm', 'Alarme')}, ${s247Plural(c.n.p, 'Position', 'Positionen')}`, other = st?.dev && st.dev !== s247Device() ? ` Zuletzt übergeben hat „${st.dev}“ – nur auf einem Gerät einschalten.` : '';
  let text, cls = null;
  if (!ok) text = 'Zuerst oben Telegram einrichten (Bot-Token und Chat-ID) – darüber läuft die Übergabe.';
  else if (s247.busy) text = 'Übergebe an den 24/7-Dienst …';
  else if (s247.error) { text = `Fehler: ${s247.error}`; cls = false; }
  else if (!c.on) text = st?.svc && st.fresh ? `Aus. Ein 24/7-Dienst meldet sich im Chat (zuletzt ${hm(st.beat)}) – einschalten, damit er deine Alarme kennt.` : 'Aus – ohne 24/7-Dienst meldet nur die geöffnete App.';
  else if (!c.msg || !st) text = s247.checking ? 'Frage Telegram …' : 'Wird gleich übergeben …';
  else if (s247.checkErr && now - s247.checkAt < 60e3) { text = `Status nicht lesbar: ${s247.checkErr}`; cls = false; }
  else if (!st.found) text = 'Die angeheftete Datei fehlt im Chat – wird neu übergeben …';
  else if (s247Active()) { text = `Übergeben ✓ vom Dienst bestätigt um ${hm(st.beat)} (${counts}${st.svc.ver ? ` · Dienst ${st.svc.ver}` : ''}).${s247LastText(st)} Kurs-Alarme, Stop/Ziel und Termin-Warnungen meldet jetzt der Dienst – auch bei geschlossener App; diese App sendet sie nicht zusätzlich.${s247PulseText(c, st)}${s247GvText(c, st)}${other}`; cls = true; }
  else if (st.svc && st.fresh && !st.svc.ok) { text = `⚠ Der Dienst meldet eine Störung: ${st.svc.problem || 'Kurse nicht abrufbar'}. Die App sendet deshalb selbst.${st.svc.zv ? s247LastText(st) : ''}${other}`; cls = false; }
  else if (st.svc && st.fresh) text = `Übergeben um ${hm(c.at)} (${counts}) – der Dienst übernimmt den neuen Stand in spätestens einer Minute.${other}`;
  else if (st.svc) { text = `⚠ Der Dienst hat sich seit ${hm(st.beat)} nicht gemeldet – die App sendet wieder selbst. Läuft der Server? Am Server: systemctl status scalpdesk-247${other}`; cls = false; }
  else {
    // 3.28.0: nach 90 s ohne Bestätigung die häufigste Ursache nennen – mit Bot und Chat-ID dieser App zum Vergleich mit dem Server
    const late = now - c.at > 90e3, bot = s247.me?.username ? `@${s247.me.username}` : `mit der Bot-ID ${String(chan.tg.token).split(':')[0]}`;
    text = late ? `⚠ Übergeben um ${hm(c.at)} (${counts}), aber der 24/7-Dienst hat nicht bestätigt. Häufigste Ursache: Am Server ist ein anderer Bot oder eine andere Chat-ID eingetragen als hier unter „Kursalarm“ (hier: Bot ${bot}, Chat-ID ${chan.tg.chat}) – zum Beispiel der Sicherungs-Bot. Am Server prüfen: sudo scalpdesk-247 status (ab Dienst 1.4, sonst journalctl -u scalpdesk-247 -n 30). Steht dort ein anderer Bot oder eine andere Chat-ID, am Server Token und Chat-ID von hier neu eingeben (Anleitung oben). Bis dahin sendet diese App selbst, solange sie geöffnet ist.${other}`
      : `Übergeben um ${hm(c.at)} (${counts}) – wartet auf die Bestätigung des 24/7-Dienstes (meist nach 20–30 Sekunden).${other}`;
    cls = late ? false : null;
  }
  const p = $('s247-status'); if (p.textContent !== text) p.textContent = text; p.className = 'chan-status' + (cls === true ? ' ok' : cls === false ? ' err' : '');
  if (typeof renderPnl === 'function') renderPnl();
  if (typeof renderChanSummary === 'function') renderChanSummary();
}
// Sekundentakt: solange eingeschaltet alle 2 Minuten nachsehen, ob der Dienst sich meldet
function s247Tick(now) {
  if (s247?.cfg?.on && !s247.checking && now - s247.checkAt > S247_POLL && typeof tgConfigured === 'function' && tgConfigured() && !document.hidden) void checkS247();
  if (s247?.cfg?.on && s247.cfg.msg && !s247.busy && !s247Active() && now - (s247.renderAt || 0) > 5e3 && $('chan-dialog')?.open) { s247.renderAt = now; renderS247(); } // 3.28.0
}
(function s247Ui() {
  if (!$('s247-on')) return;
  if (!store.get(S247_KEY)) saveS247();
  $('s247-on').addEventListener('change', () => {
    s247.cfg = { ...loadS247(), on: $('s247-on').checked }; saveS247(); s247.error = '';
    if (s247.cfg.on || s247.cfg.sentOn) void sendS247(true); // Ausschalten: einmal „ausgeschaltet“ übergeben, dann meldet der Dienst nichts mehr
    renderS247();
  });
  $('s247-check').addEventListener('click', () => void checkS247());
  // Befehle der Anleitung kopieren (sonst markiert ein Tippen den ganzen Befehl)
  for (const b of document.querySelectorAll('#s247 [data-copy]')) b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Kopiert ✓'; }
    catch { const r = document.createRange(); r.selectNodeContents(b.previousElementSibling); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); b.textContent = 'Markiert'; }
    setTimeout(() => { b.textContent = 'Kopieren'; }, 1800);
  });
  $('chan-open').addEventListener('click', () => { renderS247(); if (s247.cfg.on || tgConfigured()) void checkS247(); });
  // Seite wird verlassen: Wartendes sofort übergeben; zurück: nachholen, falls Telegram einen älteren Stand hat
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (s247.timer) { clearTimeout(s247.timer); s247.timer = null; void sendS247(false, true); } }
    else if (s247.cfg.on) { scheduleS247(2000); if (Date.now() - s247.checkAt > 60e3) void checkS247(); }
  });
  addEventListener('pagehide', () => { if (s247.timer) { clearTimeout(s247.timer); s247.timer = null; void sendS247(false, true); } });
  renderS247();
  if (s247.cfg.on) { scheduleS247(3000); s247.first = checkS247(); }
})();
