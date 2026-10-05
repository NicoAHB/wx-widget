// Selbsttest des 24/7-Dienstes ohne Netz und ohne Konten: Telegram und Binance sind hier nachgebaut (fetch). Geprüft wird vor
// allem die Zustellung ab Version 1.3: Eine abgelehnte oder nicht zugestellte Meldung geht nicht verloren, wird wiederholt,
// übersteht einen Neustart, und der Dienst meldet „Störung“ in der angehefteten Nachricht, die die App liest.
// Ab 1.4 außerdem: Bestätigung „hat übernommen“ per Telegram, Hinweis, wenn keine Datei der App angeheftet ist (anderer Bot
// oder andere Chat-ID am Server), und die Fehlersuche „--status“.
// Aufruf (Node.js ab 18), im Ordner server:  node selbsttest.mjs      → „… von … bestanden“, Rückgabewert 0 bei Erfolg
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as W from './scalpdesk-247.mjs';

let pass = 0, fail = 0;
const check = (name, ok, info = '') => { if (ok) pass++; else fail++; console.log(`${ok ? '✓' : '✗'} ${name}${!ok && info ? ' — ' + info : ''}`); };
const TOKEN = '123456789:TEST_ONLY_not_a_real_token_000000000', CHAT = '987654321', M = 60e3; // kein echter Token

// ---- Nachbau von Telegram und Binance ----
const tg = [], files = new Map(); let pinned = null, rows = {}, tgFail = null, delay = {};
const reply = (r, status = 200) => ({ ok: status < 300, status, json: async () => r });
globalThis.fetch = async (url, o = {}) => {
  const u = new URL(url), b = o.body ? JSON.parse(o.body) : {};
  if (u.pathname.includes('/file/bot')) return reply(JSON.parse(files.get(u.pathname.split('/').pop())));
  const m = /^\/bot[^/]+\/(\w+)$/.exec(u.pathname);
  if (m) {
    if (m[1] === 'sendMessage' && tgFail) {
      tg.push({ method: m[1], ...b, failed: true });
      if (tgFail === 'net') throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } });
      return reply({ ok: false, error_code: tgFail.status, description: tgFail.desc }, tgFail.status);
    }
    tg.push({ method: m[1], ...b });
    if (m[1] === 'getMe') return reply({ ok: true, result: { id: 123456789, is_bot: true, username: 'selbsttest_bot' } });
    if (m[1] === 'getChat') return reply({ ok: true, result: { id: +CHAT, type: 'private', ...(pinned ? { pinned_message: pinned } : {}) } });
    if (m[1] === 'getFile') return reply({ ok: true, result: { file_id: b.file_id, file_path: `documents/${b.file_id}` } });
    if (m[1] === 'editMessageCaption') {
      if (b.caption === pinned.caption) return reply({ ok: false, error_code: 400, description: 'Bad Request: message is not modified' }, 400);
      pinned = { ...pinned, caption: b.caption, edit_date: Math.floor(Date.now() / 1000) }; return reply({ ok: true, result: pinned });
    }
    return reply({ ok: true, result: { message_id: 900 } });
  }
  if (/klines/.test(u.pathname)) { const s = u.searchParams.get('symbol'); if (delay[s]) await new Promise(r => setTimeout(r, delay[s])); return reply(rows[s] || []); }
  if (/calendar/.test(String(url))) return reply({ events: [] });
  return reply({}, 404);
};
const INFO = /^(✅ 24\/7-Dienst hat übernommen|⏸ 24\/7-Dienst|⏳ Scalp Desk 24\/7-Dienst)/; // 1.4: Bestätigung und Hinweis sind keine Meldungen
const sent = () => tg.filter(x => x.method === 'sendMessage' && !x.failed && !INFO.test(x.text || '')).map(x => x.text);
const infos = () => tg.filter(x => x.method === 'sendMessage' && !x.failed && INFO.test(x.text || '')).map(x => x.text);
const svcLine = () => (pinned?.caption || '').split('\n').find(l => l.startsWith('Dienst:')) || '';
const candle = (t, c, hi = c) => [t - 30e3, String(c), String(hi), String(c), String(c), '1', t + 30e3 - 1];
let pins = 0;
function pin(conf) { // jede Übergabe ist eine neue Datei (eigene Kennung), wie bei Telegram
  const id = `f${++pins}`; files.set(id, JSON.stringify(conf));
  pinned = { message_id: 701, date: 1, caption: '📌 Scalp Desk · 24/7-Dienst\nApp: …\nDienst: wartet auf Rückmeldung …', document: { file_id: id, file_unique_id: `u${pins}`, file_name: 'scalpdesk-247.json' } };
}

// ---- Dienst mit Alarm „BTC über 105“ ----
const statePath = path.join(os.tmpdir(), `scalpdesk-selbsttest-${process.pid}.json`);
let now = Date.UTC(2026, 8, 30, 15, 0); const logs = [];
const w = new W.Watcher({ token: TOKEN, chat: CHAT, statePath, now: () => now, log: (...a) => logs.push(a.join(' ')) });
const step = async (ms = 16e3) => { now += ms; w.next.price = 0; await w.tick(); };
rows = { BTCUSDT: [candle(now, 100)] };
pin({ kind: 'scalpdesk-247', v: 1, tag: 'st01', at: now, on: true, tz: 'Europe/Berlin', app: 'Selbsttest', dev: 'Selbsttest', ev: { alarm: true, pos: true, news: false }, econ: { warn: 0, cur: 'usd' },
  alarms: [{ id: 'z1', symbol: 'BTCUSDT', source: 'spot', dir: 'above', price: 105, note: '', armedAt: now - M }], positions: [] });
try {
  await w.tick();
  check('1.4: Übernahme per Telegram bestätigt (lautlos, mit dem Alarm), im Protokoll „Übergabe erhalten“ und „Alarme geladen“', infos().length === 1 && infos()[0].includes('✅ 24/7-Dienst hat übernommen') && infos()[0].includes('Kurs-Alarm BTC auf/über 105,00 USDT')
    && tg.find(x => x.method === 'sendMessage' && INFO.test(x.text || ''))?.disable_notification === true && logs.some(l => l.startsWith('Übergabe erhalten: Nachricht #701')) && logs.some(l => l.startsWith('Alarme geladen: 1 Alarm')), infos()[0]);
  check('Datei der App gelesen, „Dienst: aktiv“, darunter „Zustellung: geprüft, noch keine Meldung“', /^Dienst: aktiv · .* · #st01 übernommen$/.test(svcLine()) && /\nZustellung: geprüft, noch keine Meldung$/.test(pinned.caption), pinned.caption);

  // 1. Telegram lehnt ab (HTTP 400)
  tgFail = { status: 400, desc: 'Bad Request: chat not found' }; rows = { BTCUSDT: [candle(now + 16e3, 106)] }; await step();
  check('Telegram lehnt ab: nichts zugestellt, die Meldung bleibt im Ausgang', sent().length === 0 && w.out.length === 1 && w.out[0].tries === 1 && w.out[0].label === 'Kurs-Alarm BTC');
  check('… „Dienst: Störung · … · Telegram-Nachricht nicht zustellbar seit …“', /^Dienst: Störung · .* · Telegram-Nachricht nicht zustellbar seit \d\d:\d\d \(Telegram sendMessage: Bad Request: chat not found\)$/.test(svcLine()), svcLine());
  const next1 = w.out[0].next; await step(5e3);
  check('… kein neuer Versuch vor Ablauf der Pause (15 s)', w.out[0].tries === 1 && next1 - (now - 5e3) === 15e3);
  now = next1; w.next.price = 0; await w.tick();
  check('… danach neuer Versuch, die Pause wächst (30 s)', w.out[0].tries === 2 && w.out[0].next - now === 30e3);

  // 2. Neustart: Ausgang bleibt
  w.saveStateNow();
  const w2 = new W.Watcher({ token: TOKEN, chat: CHAT, statePath, now: () => now, log: () => {} });
  check('Neustart: die nicht zugestellte Meldung bleibt erhalten', w2.out.length === 1 && w2.out[0].label === 'Kurs-Alarm BTC' && w2.sendErr?.code === 400);

  // 3. Telegram wieder in Ordnung
  tgFail = null; now += 3 * M; w.next.price = 0; await w.tick();
  check('Wieder in Ordnung: genau einmal zugestellt, mit der Zeit des Auslösens und dem Vermerk „verspätet … zuerst abgelehnt“', sent().length === 1 && /^🔔 Kurs-Alarm BTC\n.*\n17:00:16 Uhr · 24\/7-Dienst\n\(verspätet zugestellt um \d\d:\d\d Uhr – Telegram hatte sie zuerst abgelehnt\)$/.test(sent()[0]) && w.out.length === 0, sent()[0]);
  check('… Status wieder „aktiv“, darunter „Zustellung: zuletzt … · Kurs-Alarm BTC“', /^Dienst: aktiv · /.test(svcLine()) && /\nZustellung: zuletzt \d\d\.\d\d\. \d\d:\d\d · Kurs-Alarm BTC$/.test(pinned.caption), pinned.caption);

  // 4. Telegram nicht erreichbar (Netz): erst nach über einer Minute „Störung“
  pin({ kind: 'scalpdesk-247', v: 1, tag: 'st02', at: now, on: true, tz: 'Europe/Berlin', app: 'Selbsttest', dev: 'Selbsttest', ev: { alarm: true, pos: true, news: false }, econ: { warn: 0, cur: 'usd' },
    alarms: [{ id: 'z2', symbol: 'BTCUSDT', source: 'spot', dir: 'below', price: 95, note: '', armedAt: now }], positions: [] });
  w.next.config = 0; await w.tick();
  tgFail = 'net'; rows = { BTCUSDT: [candle(now + 16e3, 94)] }; await step();
  check('Netz weg: Meldung im Ausgang, in der ersten Minute noch „aktiv“', w.out.length === 1 && /Telegram nicht erreichbar/.test(w.out[0].err) && /^Dienst: aktiv/.test(svcLine()), svcLine());
  tgFail = null; const before = pinned.caption; tgFail = 'net'; now += 61e3; w.next.price = 0; await w.tick();
  check('… nach über einer Minute: „Störung“', /^Dienst: Störung · .* · Telegram-Nachricht nicht zustellbar seit/.test(svcLine()) && pinned.caption !== before, svcLine());
  now += 25 * 3600e3; w.next.price = 0; await w.tick();
  check('Über 24 Stunden nicht zustellbar: verworfen, mit Zeile im Protokoll', w.out.length === 0 && logs.some(l => /Meldung verworfen \(über 24 Stunden nicht zustellbar\): Kurs-Alarm BTC/.test(l)));
  tgFail = null;

  // 5. Kurse für mehrere Kürzel gleichzeitig
  const wp = new W.Watcher({ token: TOKEN, chat: CHAT, now: () => now, log: () => {} });
  wp.conf = { data: W.parseConfig({ kind: 'scalpdesk-247', v: 1, tag: 'st03', at: now, on: true, tz: 'UTC', ev: { alarm: true, pos: true, news: false }, econ: { warn: 0, cur: 'usd' },
    alarms: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'].map((s, i) => ({ id: 'q' + i, symbol: s, source: 'spot', dir: 'above', price: 1e9, note: '', armedAt: now })), positions: [] }) };
  delay = { BTCUSDT: 400, ETHUSDT: 400, SOLUSDT: 400, XRPUSDT: 400 }; rows = Object.fromEntries(Object.keys(delay).map(s => [s, [candle(now, 100)]]));
  const t0 = performance.now(); await wp.checkPrices(); const ms = performance.now() - t0; delay = {};
  check('4 Kürzel zu je 0,4 s: gleichzeitig abgefragt (unter 1 s statt 1,6 s)', ms < 1000 && wp.lastCheck.size === 4, `${Math.round(ms)} ms`);

  // 6. (ab 1.4) Keine Datei der App im Chat – z. B. am Server ein anderer Bot als in der App: Protokoll, Hinweis, --status
  pinned = null; const hl = [], wh = new W.Watcher({ token: TOKEN, chat: CHAT, now: () => now, log: (...a) => hl.push(a.join(' ')) }); wh.me = { id: 123456789, username: 'selbsttest_bot' };
  const tH = tg.length; await wh.tick(); now += 3 * M + 5e3; wh.next.config = 0; await wh.tick();
  const hints = tg.slice(tH).filter(x => x.method === 'sendMessage' && /^⏳ Scalp Desk 24\/7-Dienst/.test(x.text || ''));
  check('1.4: ohne Datei der App – Protokollzeile mit Bot und Chat-ID, nach 3 Minuten ein Hinweis per Telegram', hl.some(l => l.includes('keine Datei „scalpdesk-247.json“ angeheftet') && l.includes('Bot @selbsttest_bot und Chat-ID 987654321')) && hints.length === 1, hl[0]);
  hl.length = 0; const okS = await wh.status();
  check('1.4: „--status“ zeigt die fehlende Datei mit ✗ und dem Befehl zum Neu-Eingeben', okS === false && hl.some(l => l.startsWith('✗ Keine Datei der App angeheftet')) && hl.some(l => l.includes('--neu')), hl.join(' | ').slice(0, 200));
  check('Kein Token im Protokoll', !logs.some(l => l.includes(TOKEN.split(':')[1])) && !hl.some(l => l.includes(TOKEN.split(':')[1])));
} catch (e) { check('Abbruch', false, e.stack || e.message); }
finally { try { fs.unlinkSync(statePath); } catch { /* schon weg */ } }
console.log(`\n${pass} von ${pass + fail} bestanden`);
process.exit(fail ? 1 : 0);
