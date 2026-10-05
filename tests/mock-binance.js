// Mock für Binance REST + WebSocket-Streams (Tests des Dashboards).
// HTTPS/WSS auf 443 und 9443 (Hosts per --host-resolver-rules auf 127.0.0.1), Steuerung per HTTP auf 8790.
const https = require('https'), http = require('http'), fs = require('fs'), path = require('path'), { WebSocketServer } = require('ws');
const dir = __dirname;
// Test-Zertifikat (selbst signiert, nur lokal): wird beim ersten Start erzeugt und nicht eingecheckt
if (!fs.existsSync(path.join(dir, 'key.pem')) || !fs.existsSync(path.join(dir, 'cert.pem')))
  require('child_process').execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '3650', '-subj', '/CN=localhost', '-keyout', path.join(dir, 'key.pem'), '-out', path.join(dir, 'cert.pem')], { stdio: 'ignore' });
const tls = { key: fs.readFileSync(path.join(dir, 'key.pem')), cert: fs.readFileSync(path.join(dir, 'cert.pem')) };
const IV = { '1s': 1e3, '1m': 6e4, '3m': 18e4, '5m': 3e5, '15m': 9e5, '1h': 36e5, '2h': 72e5, '4h': 144e5, '1d': 864e5, '1w': 6048e5, '1M': 2592e6 };
const SPOT = { BTCUSDT: 64000, ETHUSDT: 2500, XRPUSDT: 1.47, ETCUSDT: 18, BCHUSDT: 330, LTCUSDT: 70, NEARUSDT: 2.4, EURUSDT: 1.164, SOLUSDT: 150, PAXGUSDT: 2650 };
const FUT = { ...SPOT, BSVUSDT: 32 };
delete FUT.EURUSDT; delete FUT.PAXGUSDT; // PAXG: nur Spot (keine Futures, kein Open Interest)
const cfg = { wsPeriod: 1000, futPeriod: 500, walk: true, silent: false, blockWs: false, restFail: false, restDelay: 0, chanNoCors: false, tg429: 0, tgUpdates: true, log: [] }, sent = [];
const price = {}; for (const [s, p] of Object.entries(FUT)) price[s] = p; price.EURUSDT = 1.164;
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const candles = {}; // key sym|iv -> current candle
const bucket = (t, iv) => iv === '1M' ? Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth(), 1) : iv === '1w' ? Math.floor((t - 3 * 864e5) / IV['1w']) * IV['1w'] + 3 * 864e5 : Math.floor(t / IV[iv]) * IV[iv];
function cur(sym, iv, now = Date.now()) {
  const k = sym + '|' + iv, t = bucket(now, iv); let c = candles[k];
  if (!c || c.t !== t) { const p = price[sym]; c = candles[k] = { t, T: t + (IV[iv]) - 1, o: p, h: p, l: p, c: p, v: 0, prev: c || null }; }
  return c;
}
function touch(sym, p) { trade(sym, p); cur(sym, '1m'); price[sym] = p; for (const k of Object.keys(candles)) if (k.startsWith(sym + '|')) { const c = candles[k]; c.c = p; c.h = Math.max(c.h, p); c.l = Math.min(c.l, p); c.v += 1 + rnd(); } }
setInterval(() => { if (!cfg.walk) return; for (const s of Object.keys(price)) touch(s, +(price[s] * (1 + (rnd() - 0.5) * 0.0008)).toPrecision(8)); }, 250);
// Anteil der Taker-Käufe: bei steigender Kerze höher, bei fallender niedriger (deterministisch je Zeitpunkt)
const frac = x => x - Math.floor(x), noise = t => frac(Math.sin(t * 0.000123 + 1.7) * 43758.5453);
const takerShare = (t, o, c) => Math.min(.9, Math.max(.1, .5 + (c >= o ? .12 : -.12) + (noise(t) - .5) * .2));
const krow = (t, o, h, l, c, v, T, n) => [t, String(o), String(h), String(l), String(c), String(v.toFixed(3)), T, String((v * (o + h + l + c) / 4).toFixed(4)), n, String((v * takerShare(t, o, c)).toFixed(3)), '0', '0'];
// Historie je Kürzel/Intervall einmal erzeugen und danach nur noch verlängern: abgeschlossene Kerzen bleiben stabil wie bei Binance
const H = {};
// 4.3: Stundenkerzen für die Volatilität nach Uhrzeit – 2100 statt 1000 (rund 87 Tage), Dochte so breit wie 60 Schritte des
// 1m-Verlaufs (sonst wäre jede Stunde „ungewöhnlich volatil“); Schlusskurse unverändert (Signale, RSI, MACD bleiben gleich).
// volaCfg.mode: normal, pattern (Tagesmuster in UTC: lebhaft 13–17 Uhr, ruhig nachts, Wochenende halb so viel);
// volaCfg.drift: UTC-Stunde, in der jede Stundenkerze rund 1 % steigt (echte Tendenz für den Richtungstest), sonst null
const volaCfg = { mode: 'normal', drift: null };
const volaWick = t => { if (volaCfg.mode !== 'pattern') return 0.02; const d = new Date(t), h = d.getUTCHours() + 0.5, we = d.getUTCDay() === 0 || d.getUTCDay() === 6;
  return 0.02 * (0.35 + 1.25 * Math.exp(-((h - 15) ** 2) / 6)) * (we ? 0.5 : 1); };
function series(sym, iv) {
  const now = Date.now(), last = cur(sym, iv, now), step = IV[iv], k = sym + '|' + iv, n0 = iv === '1h' ? 2100 : iv === '5m' && sym === 'BTCUSDT' ? 10200 : 1000; // 3.24.0 BTC-Puls: 35 Tage 5m-Kerzen
  let s = H[k];
  if (!s || iv === '1M' || iv === '1w') {
    let r = 11 + sym.length * 7 + step % 97; const rr = () => { r = (r * 48271) % 2147483647; return r / 2147483647; };
    const n = n0, closes = new Array(n); let p = last.o;
    for (let i = n - 1; i >= 0; i--) {
      closes[i] = p; const up = iv === '1h' && volaCfg.drift !== null && new Date(last.t - (n - i) * step).getUTCHours() === volaCfg.drift ? 0.01 : 0;
      p = p / (1 + up + (rr() - 0.5) * 0.004);
    }
    s = [];
    for (let i = 0; i < n; i++) {
      const t = last.t - (n - i) * step, o = i === 0 ? p : closes[i - 1], c = closes[i], w = iv === '1h' ? volaWick(t) : 0.002;
      const hi = Math.max(o, c) * (1 + rr() * w), lo = Math.min(o, c) * (1 - rr() * w);
      s.push(krow(t, o, hi, lo, c, Number((100 + rr() * 50).toFixed(3)), t + step - 1, 10));
    }
    H[k] = s;
  }
  // Seit der Erzeugung abgeschlossene Kerzen anhängen (aus der Kette der laufenden Kerzen; Lücken als ruhige Kerzen)
  const done = []; for (let c = last.prev; c && c.t > s.at(-1)[0]; c = c.prev) done.unshift(c);
  for (let t = s.at(-1)[0] + step; t < last.t; t += step) {
    const c = done.find(x => x.t === t), pc = Number(s.at(-1)[4]);
    s.push(c ? krow(t, c.o, c.h, c.l, c.c, c.v, t + step - 1, 5) : krow(t, pc, pc, pc, pc, 0, t + step - 1, 0));
  }
  if (s.length > n0 + 500) s.splice(0, s.length - n0 - 200);
  return { rows: s, last };
}
function hist(sym, iv, limit, startTime, endTime) {
  const { rows, last } = series(sym, iv), n = Math.min(limit || 500, 1000);
  let all = [...rows, krow(last.t, last.o, last.h, last.l, last.c, last.v, last.T, 1)];
  if (endTime) all = all.filter(x => x[0] <= endTime); // 4.3: ältere Seite (Binance: Kerzen mit Beginn bis endTime)
  return startTime ? all.filter(x => x[0] >= startTime || x[6] >= startTime).slice(0, n) : all.slice(-n);
}
const OIP = { '5m': 3e5, '15m': 9e5, '30m': 18e5, '1h': 36e5, '2h': 72e5, '4h': 144e5, '6h': 216e5, '12h': 432e5, '1d': 864e5 };
const oiCfg = { mode: 'wave', ago: 10, amount: 0.06 };
function oiAt(sym, P, k, lastK) {
  const base = 5e9 / FUT[sym], h = sym.length * 1.3 + P / 3e5 * 0.7;
  if (oiCfg.mode === 'flat') return base;
  if (oiCfg.mode === 'spike') return k >= lastK - oiCfg.ago ? base * (1 + oiCfg.amount) : base;
  return base * (1 + .03 * Math.sin(k / 17 + h) + .015 * Math.sin(k / 5.3 + 2 * h) + .006 * (noise(k * 977 + h) - .5));
}
function oiHist(sym, q) {
  const P = OIP[q.period], n = Math.min(Number(q.limit) || 30, 500), lastK = Math.floor((Date.now() - 5000) / P), first = lastK - Math.floor(30 * 864e5 / P);
  let k1 = q.endTime ? Math.min(lastK, Math.floor(Number(q.endTime) / P)) : lastK, k0 = q.startTime ? Math.ceil(Number(q.startTime) / P) : k1 - n + 1;
  if (q.startTime && !q.endTime) k1 = Math.min(lastK, k0 + n - 1);
  k0 = Math.max(k0, k1 - n + 1, first);
  const out = []; for (let k = k0; k <= k1; k++) { const v = oiAt(sym, P, k, lastK); out.push({ symbol: sym, sumOpenInterest: v.toFixed(3), sumOpenInterestValue: (v * price[sym]).toFixed(2), timestamp: k * P }); }
  return out;
}
function json(res, code, body, cors = true) { res.writeHead(code, { 'content-type': 'application/json', ...(cors ? { 'access-control-allow-origin': '*' } : {}), 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); }
// ---------- Telegram Bot API und Discord-Webhooks (Benachrichtigungs-Kanäle) ----------
const tgDocs = {}; let tgMsgId = 500;
// 5.1 (24/7-Dienst): Nachrichten mit Datei je Chat – anheften, getChat (zuletzt angeheftete nach Sendedatum), getFile,
// Datei laden, Beschriftung ändern („not modified“ bei gleichem Text), löschen
const tgMsgs = new Map(), tgFiles = new Map(); let tgFileNo = 0;
function tgFields(body, req, u) {
  const t = req.headers['content-type'] || '', q = Object.fromEntries(u.searchParams);
  if (/multipart/.test(t)) return { ...q, ...multipart(body, t) };
  if (/json/.test(t)) { try { return { ...q, ...JSON.parse(body || '{}') }; } catch { return q; } }
  return { ...q, ...Object.fromEntries(new URLSearchParams(body)) };
}
function tgStoreDoc(bot, chat, id, content, name, caption) {
  const n = ++tgFileNo, file_id = `F${n}x${id}`, m = tgMsgs.get(id) || { message_id: id, from: { id: bot, is_bot: true }, chat: { id: Number(chat) || chat, type: 'private' }, date: Math.floor(Date.now() / 1000), pinnedAt: 0, bot, ck: tgCk(bot, chat) };
  tgFiles.set(file_id, content);
  Object.assign(m, { caption: caption || '', document: { file_id, file_unique_id: `U${n}`, file_name: name || 'datei.json', mime_type: 'application/json' } });
  if (tgMsgs.has(id)) m.edit_date = Math.floor(Date.now() / 1000);
  tgMsgs.set(id, m); return m;
}
const tgPublic = m => m && (({ pinnedAt, ck, bot, ...rest }) => rest)(m);
function tgPinned(ck) { let best = null; for (const m of tgMsgs.values()) if (m.ck === ck && m.pinnedAt && (!best || m.pinnedAt > best.pinnedAt || (m.pinnedAt === best.pinnedAt && m.message_id > best.message_id))) best = m; return best; }
const TG_OK_TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw';
// 3.25.0: zweiter Bot (eigener Sicherungs-Bot). Privatchats sind je Bot getrennt – gleiche Chat-ID (Nutzer-ID), aber zwei Chats;
// Gruppen (negative IDs) teilen sich alle Bots. Bearbeiten und Löschen nur eigener Nachrichten.
const TG_BOTS = { [TG_OK_TOKEN]: { id: 123456789, first_name: 'Kurs-Alarm', username: 'test_kursalarm_bot' }, '555666777:BBQkbXyzSicherungTestToken0123456789': { id: 555666777, first_name: 'Sicherung', username: 'test_sicherung_bot' } };
const tgCk = (bot, chat) => Number(chat) > 0 ? `${bot}:${chat}` : String(chat);
function readBody(req) { return new Promise(r => { const b = []; req.on('data', d => b.push(d)); req.on('end', () => r(Buffer.concat(b).toString('utf8'))); }); }
function multipart(body, type) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/.exec(type || ''); if (!m) return {};
  const out = {}; for (const part of body.split('--' + (m[1] || m[2]))) { const i = part.indexOf('\r\n\r\n'); if (i < 0) continue; const head = part.slice(0, i), name = /name="([^"]+)"/.exec(head), fn = /filename="([^"]*)"/.exec(head); if (name) { out[name[1]] = part.slice(i + 4).replace(/\r\n$/, ''); if (fn) (out.__files || (out.__files = {}))[name[1]] = fn[1]; } }
  return out;
}
async function channel(req, res, host, u) {
  const cors = !cfg.chanNoCors;
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' }); return res.end(); }
  const body = req.method === 'POST' ? await readBody(req) : '';
  if (host === 'api.telegram.org') {
    const fm = /^\/file\/bot([^/]+)\/documents\/([\w]+)\.json$/.exec(u.pathname);
    if (fm) { if (!TG_BOTS[fm[1]] || !tgFiles.has(fm[2])) return json(res, 404, { ok: false, error_code: 404, description: 'Not Found' }, cors); res.writeHead(200, { 'content-type': 'application/octet-stream', ...(cors ? { 'access-control-allow-origin': '*' } : {}) }); return res.end(tgFiles.get(fm[2])); }
    const m = /^\/bot([^/]+)\/(\w+)$/.exec(u.pathname); if (!m) return json(res, 404, { ok: false, error_code: 404, description: 'Not Found' }, cors);
    const [, token, method] = m, B = TG_BOTS[token];
    if (!B) return json(res, 401, { ok: false, error_code: 401, description: 'Unauthorized' }, cors);
    if (method === 'getMe') return json(res, 200, { ok: true, result: { id: B.id, is_bot: true, first_name: B.first_name, username: B.username } }, cors);
    if (method === 'getUpdates' && B.id !== 123456789) return json(res, 200, { ok: true, result: !cfg.tgUpdates ? [] : [{ update_id: 9, message: { message_id: 2, from: { id: 987654321 }, chat: { id: 987654321, type: 'private', first_name: 'Nico' }, date: 3, text: '/start' } }] }, cors);
    if (method === 'getUpdates') return json(res, 200, { ok: true, result: !cfg.tgUpdates ? [] : [{ update_id: 5, message: { message_id: 1, from: { id: 987654321 }, chat: { id: 987654321, type: 'private', first_name: 'Nico' }, date: 1, text: '/start' } },
      // 3.24.0: Gruppe mit Themen (Ablaufplan Schritt 3), nur mit /tgupdates?multi=1
      ...(cfg.tgMulti ? [{ update_id: 6, message: { message_id: 7, message_thread_id: 12, is_topic_message: true, from: { id: 987654321 }, chat: { id: -1001234567890, type: 'supergroup', title: 'Scalp Desk', is_forum: true }, date: 2, text: 'Sicherung hier', reply_to_message: { message_id: 12, forum_topic_created: { name: 'Sicherung' } } } }] : [])] }, cors);
    if (method === 'sendDocument' || method === 'editMessageMedia') {
      const f = multipart(body, req.headers['content-type']), chat = f.chat_id, file = f.document ?? f.file ?? '', ck = tgCk(B.id, chat), docs = tgDocs[ck] || (tgDocs[ck] = new Set());
      if (f.chat_id === '111') return json(res, 400, { ok: false, error_code: 400, description: 'Bad Request: chat not found' }, cors);
      if (cfg.tgDocFail) return json(res, 503, { ok: false, error_code: 503, description: 'Service Unavailable' }, cors); // 3.16.1: Upload scheitert
      if (method === 'editMessageMedia') {
        const id = Number(f.message_id); if (!docs.has(id)) return json(res, 400, { ok: false, error_code: 400, description: 'Bad Request: message to edit not found' }, cors);
        if (tgMsgs.get(id)?.bot !== B.id) return json(res, 400, { ok: false, error_code: 400, description: "Bad Request: message can't be edited" }, cors);
        let media = {}; try { media = JSON.parse(f.media || '{}'); } catch {}
        const att = /^attach:\/\/(\w+)$/.exec(media.media || '')?.[1] || 'file', msg = tgStoreDoc(B.id, chat, id, f[att] ?? file, f.__files?.[att], media.caption);
        sent.push({ at: Date.now(), svc: 'tg', bot: B.id, method, chat_id: chat, message_id: id, caption: media.caption || '', file: f[att] ?? file, name: f.__files?.[att] || '' });
        return json(res, 200, { ok: true, result: tgPublic(msg) }, cors);
      }
      const id = ++tgMsgId; docs.add(id);
      const msg = tgStoreDoc(B.id, chat, id, file, f.__files?.document, f.caption);
      sent.push({ at: Date.now(), svc: 'tg', bot: B.id, method, chat_id: chat, thread: f.message_thread_id || '', message_id: id, caption: f.caption || '', silent: f.disable_notification, file, name: f.__files?.document || '' });
      return json(res, 200, { ok: true, result: tgPublic(msg) }, cors);
    }
    const F = tgFields(body, req, u), chatOf = () => String(F.chat_id ?? ''), ckOf = () => tgCk(B.id, chatOf()), msgOf = () => { const x = tgMsgs.get(Number(F.message_id)); return x && x.ck === ckOf() ? x : null; };
    const bad = d => json(res, 400, { ok: false, error_code: 400, description: 'Bad Request: ' + d }, cors);
    if (method === 'getChat') { if (chatOf() === '111') return bad('chat not found'); const p = tgPinned(ckOf()), grp = Number(chatOf()) < 0; return json(res, 200, { ok: true, result: { id: Number(chatOf()) || chatOf(), ...(grp ? { type: 'supergroup', title: 'Scalp Desk' } : { type: 'private', first_name: 'Nico' }), ...(p ? { pinned_message: tgPublic(p) } : {}) } }, cors); }
    if (method === 'pinChatMessage') { const x = msgOf(); if (!x) return bad('message to pin not found'); x.pinnedAt = Date.now(); sent.push({ at: Date.now(), svc: 'tg', bot: B.id, method, chat_id: chatOf(), message_id: x.message_id, silent: F.disable_notification }); return json(res, 200, { ok: true, result: true }, cors); }
    if (method === 'unpinChatMessage') { const x = F.message_id ? msgOf() : tgPinned(ckOf()); if (x) x.pinnedAt = 0; sent.push({ at: Date.now(), svc: 'tg', bot: B.id, method, chat_id: chatOf(), message_id: x?.message_id }); return json(res, 200, { ok: true, result: true }, cors); }
    if (method === 'deleteMessage') { const x = msgOf(); if (!x) return bad('message to delete not found'); if (x.bot !== B.id) return bad("message can't be deleted"); tgMsgs.delete(x.message_id); for (const s of Object.values(tgDocs)) s.delete(x.message_id); sent.push({ at: Date.now(), svc: 'tg', bot: B.id, method, chat_id: chatOf(), message_id: x.message_id }); return json(res, 200, { ok: true, result: true }, cors); }
    if (method === 'getFile') { if (!tgFiles.has(F.file_id)) return bad('invalid file_id'); const x = [...tgMsgs.values()].find(v => v.document?.file_id === F.file_id); return json(res, 200, { ok: true, result: { file_id: F.file_id, file_unique_id: x?.document.file_unique_id || 'U0', file_size: tgFiles.get(F.file_id).length, file_path: `documents/${F.file_id}.json` } }, cors); }
    if (method === 'editMessageCaption') {
      const x = msgOf(); if (!x) return bad('message to edit not found');
      if ((x.caption || '') === String(F.caption || '')) return bad('message is not modified: specified new message content and reply markup are exactly the same as a current content and reply markup of the message');
      x.caption = String(F.caption || ''); x.edit_date = Math.floor(Date.now() / 1000); sent.push({ at: Date.now(), svc: 'tg', method, chat_id: chatOf(), message_id: x.message_id, caption: x.caption });
      return json(res, 200, { ok: true, result: tgPublic(x) }, cors);
    }
    if (method === 'sendMessage') {
      const f = F; sent.push({ at: Date.now(), svc: 'tg', bot: B.id, mode: req.headers['sec-fetch-mode'] || '', ...f, link_preview_options: typeof f.link_preview_options === 'object' ? JSON.stringify(f.link_preview_options) : f.link_preview_options });
      if (cfg.tg429 > 0) { cfg.tg429--; return json(res, 429, { ok: false, error_code: 429, description: 'Too Many Requests: retry after 1', parameters: { retry_after: 1 } }, cors); }
      // 3.27.0: die nächsten n Versuche mit 502 ablehnen (/chan?tg502=n) oder alle passenden dauerhaft (/chan?tgfail=400&match=…)
      if (cfg.tg502 > 0) { cfg.tg502--; sent.at(-1).failed = 502; return json(res, 502, { ok: false, error_code: 502, description: 'Bad Gateway' }, cors); }
      if (cfg.tgFail && String(f.text || '').includes(cfg.tgFail.match || '')) { sent.at(-1).failed = cfg.tgFail.code; return json(res, cfg.tgFail.code, { ok: false, error_code: cfg.tgFail.code, description: cfg.tgFail.code === 400 ? 'Bad Request: message is too long' : 'Bad Gateway' }, cors); }
      if (f.chat_id === '111') return json(res, 400, { ok: false, error_code: 400, description: 'Bad Request: chat not found' }, cors);
      return json(res, 200, { ok: true, result: { message_id: sent.length, chat: { id: Number(f.chat_id) }, text: f.text } }, cors);
    }
    return json(res, 404, { ok: false, error_code: 404, description: 'Not Found' }, cors);
  }
  const m = /^\/api(?:\/v\d+)?\/webhooks\/(\d+)\/([\w-]+)$/.exec(u.pathname);
  if (!m || m[1].startsWith('404')) return json(res, 404, { message: 'Unknown Webhook', code: 10015 }, cors);
  if (req.method !== 'POST') return json(res, 405, { message: '405: Method Not Allowed', code: 0 }, cors);
  const f = multipart(body, req.headers['content-type']); let p = {}; try { p = JSON.parse(f.payload_json || '{}'); } catch {}
  sent.push({ at: Date.now(), svc: 'dc', mode: req.headers['sec-fetch-mode'] || '', id: m[1], ...p });
  res.writeHead(204, cors ? { 'access-control-allow-origin': '*' } : {}); res.end();
}
// Schritt 4.1 – Wirtschaftskalender: calendar.json wie vom GitHub-Job (Zweig „kalender“ auf raw.githubusercontent.com).
// Termine relativ zu jetzt; calCfg.mode: normal (erster wichtiger USD-Termin in 3 h), soon (USD-Termin mit hoher Bedeutung
// in calCfg.min Minuten, dazu ein zweiter zur selben Zeit), past (vor 5 min veröffentlicht, mit Ist-Wert), stale (Stand vor
// 2 Tagen), missing (404, Job noch nie gelaufen), error (500), empty (keine Termine), broken (kein Kalender)
const calCfg = { mode: 'normal', min: 10, hits: 0 };
function calendarJson(now = Date.now()) {
  const m = 60e3, h = 60 * m, at = x => Math.round((now + x) / m) * m, ev = (t, cur, impact, title, forecast = '', previous = '', actual = '') => ({ t, cur, impact, title, forecast, previous, actual });
  const base = [ev(at(-26 * h), 'USD', 'high', 'ISM Manufacturing PMI', '49.2', '48.7', '49.5'), ev(at(-2 * h), 'EUR', 'medium', 'German Prelim CPI m/m', '0.1%', '-0.1%', '0.2%'),
    ev(at(3 * h), 'USD', 'high', 'JOLTS Job Openings', '7.65M', '7.67M'), ev(at(3 * h), 'USD', 'medium', 'CB Consumer Confidence', '104.5', '103.3'),
    ev(at(5 * h), 'EUR', 'high', 'ECB President Lagarde Speaks'), ev(at(8 * h), 'JPY', 'low', 'Tankan Manufacturing Index', '13', '13'),
    ev(at(27 * h), 'USD', 'high', 'Non-Farm Employment Change', '145K', '142K'), ev(at(27 * h), 'USD', 'high', 'Unemployment Rate', '4.3%', '4.3%'),
    ev(at(50 * h), 'USD', 'holiday', 'Bank Holiday'), ev(at(51 * h), 'GBP', 'high', 'BOE Gov Bailey Speaks'), ev(at(74 * h), 'USD', 'high', 'Federal Funds Rate', '4.25%', '4.50%')];
  if (calCfg.mode === 'soon') base.push(ev(at(calCfg.min * m), 'USD', 'high', 'CPI m/m', '0.3%', '0.2%'), ev(at(calCfg.min * m), 'USD', 'high', 'Core CPI m/m', '0.3%', '0.3%'));
  if (calCfg.mode === 'past') base.push(ev(at(-5 * m), 'USD', 'high', 'CPI m/m', '0.3%', '0.2%', '0.4%'));
  const events = calCfg.mode === 'empty' ? [] : base.sort((a, b) => a.t - b.t);
  return { v: 1, source: 'Forex Factory', fetchedAt: new Date(calCfg.mode === 'stale' ? now - 49 * h : now - 40 * m).toISOString(), lists: 2, events };
}
function calendar(req, res, u) {
  calCfg.hits++;
  if (u.pathname !== '/NicoAHB/wx-widget/kalender/calendar.json' || calCfg.mode === 'missing') { res.writeHead(404, { 'access-control-allow-origin': '*', 'content-type': 'text/plain' }); return void res.end('404: Not Found'); }
  if (calCfg.mode === 'error') return json(res, 500, { error: 'down' });
  if (calCfg.mode === 'broken') return json(res, 200, { hello: 'world' });
  if (calCfg.mode === 'real') return json(res, 200, JSON.parse(fs.readFileSync(path.join(__dirname, 'real-calendar.json'), 'utf8'))); // echte Datei vom Zweig „kalender“
  return json(res, 200, calendarJson());
}
// 3.20.0 – Coin-News: news.json wie vom GitHub-Job (Zweig „news“ auf raw.githubusercontent.com). Einträge relativ zu jetzt;
// newsCfg.mode: normal, stale (Stand vor 5 h), missing (404, Job noch nie gelaufen), error (500), broken (keine
// Nachrichtendatei), empty (keine Einträge)
const newsCfg = { mode: 'normal', hits: 0 };
const NEWS_COINS = ['BTC', 'ETH', 'XRP', 'BCH', 'LTC', 'ETC', 'NEAR', 'SOL', 'BNB', 'DOGE', 'ADA', 'TRX', 'LINK', 'DOT', 'AVAX', 'XLM', 'SHIB', 'TON', 'SUI', 'UNI', 'ATOM', 'APT',
  'ARB', 'HBAR', 'ICP', 'FIL', 'PEPE', 'HYPE', 'WLD', 'AAVE', 'INJ', 'ALGO', 'TAO', 'ENA', 'ONDO', 'POL'];
function newsJson(now = Date.now()) {
  const m = 60e3, h = 60 * m, d = 24 * h, at = x => Math.round((now + x) / m) * m, code = c => c.repeat(32);
  const binance = [
    { code: code('a'), t: at(-20 * h), at: at(5 * h), kind: 'upgrade', imp: 'high', coins: ['XRP'], title: 'Binance Will Support the XRP Ledger (XRP) Network Upgrade & Hard Fork' },
    { code: code('b'), t: at(-2 * d), at: at(3 * d), kind: 'pair', imp: 'high', coins: ['XRP', 'CAT'], pairs: ['XRP/USDT', 'CAT/USDT'], title: 'Notice of Removal of Spot Trading Pairs' },
    { code: code('c'), t: at(-3 * d), at: at(-30 * h), kind: 'futures', imp: 'medium', coins: ['XRP'], title: 'Binance Futures Will Launch USDⓈ-Margined XRPUSDC Perpetual Contract' },
    { code: code('d'), t: at(-1 * d), at: at(2 * h), kind: 'listing', imp: 'high', coins: ['HYPE'], title: 'Binance Will List Hyperliquid (HYPE) with Seed Tag Applied' },
    { code: code('e'), t: at(-5 * h), at: null, kind: 'monitor', imp: 'high', coins: ['NEAR'], title: 'Binance Will Extend the Monitoring Tag to Include NEAR Protocol (NEAR) and Alpaca Finance (ALPACA)' }];
  const g = (hAgo, imp, cat, title, outlet, more = 0) => ({ t: at(-hAgo * h), imp, cat, title, outlet, url: `https://news.google.com/rss/articles/CBMi${Buffer.from(title).toString('base64url').slice(0, 40)}?oc=5`, more });
  const news = {
    XRP: [g(0.1, 'high', 'sicherheit', 'XRP News heute: Bitget-Hack kostet 157 Mio. Dollar in XRP, doch der Kurs hält 1,47 Dollar', 'FinanzNachrichten.de', 2),
      g(2, 'high', 'netz', 'XRP: Batch-Update für 9. Oktober bestätigt', 'CryptoTicker'), g(1, 'medium', 'etf', 'Krypto News: $75 Millionen fließen in XRP-ETFs — warum der Kurs trotzdem nicht steigt', 'Wallstreet Online')],
    BTC: [g(3, 'high', 'recht', 'Krypto News: SEC erlaubt Aktien-Tokenisierung! Bitcoin schießt über 82.000 $ & nimmt 90.000 $ ins Visier', 'XTB.com'),
      g(5, 'medium', 'etf', 'Bitcoin: Spot-ETFs verbuchen Jahreszuflussrekord', 'Finanztrends')],
    NEAR: [g(3, 'high', 'etf', 'Bitwise bringt ersten US-Spot-ETF auf NEAR mit 0,75 % Verwaltungsgebühr', 'Yellow.com'),
      g(27, 'high', 'sicherheit', 'NEAR-Protokoll stoppt $503K an gestohlenen Geldern nach Angriff auf die Rainbow-Bridge-Sicherheitsinfrastrukturkomponente', 'Coinfomania', 1)],
  };
  const empty = newsCfg.mode === 'empty';
  return { v: 1, fetchedAt: new Date(newsCfg.mode === 'stale' ? now - 5 * h : now - 20 * m).toISOString(), covered: NEWS_COINS, state: { binance: 'ok', google: 'ok' }, binance: empty ? [] : binance, news: empty ? {} : news };
}
function newsFile(req, res, u) {
  newsCfg.hits++;
  if (u.pathname !== '/NicoAHB/wx-widget/news/news.json' || newsCfg.mode === 'missing') { res.writeHead(404, { 'access-control-allow-origin': '*', 'content-type': 'text/plain' }); return void res.end('404: Not Found'); }
  if (newsCfg.mode === 'error') return json(res, 500, { error: 'down' });
  if (newsCfg.mode === 'broken') return json(res, 200, { hello: 'world' });
  if (newsCfg.mode === 'real') return json(res, 200, JSON.parse(fs.readFileSync(path.join(__dirname, 'real-news.json'), 'utf8'))); // echte Datei vom Zweig „news“
  return json(res, 200, newsJson());
}
function rest(req, res) {
  const hm = /^\/_h\/([a-z0-9.-]+)(\/[^?]*)?(\?.*)?$/.exec(req.url);
  if (hm) { req.headers.host = hm[1]; req.url = (hm[2] || '/') + (hm[3] || ''); }
  const u = new URL(req.url, 'https://x'), q = Object.fromEntries(u.searchParams), host = (req.headers.host || '').split(':')[0];
  if (host === 'api.telegram.org' || host === 'discord.com') return void channel(req, res, host, u);
  if (host === 'raw.githubusercontent.com') return void (u.pathname.startsWith('/NicoAHB/wx-widget/news/') ? newsFile(req, res, u) : calendar(req, res, u));
  if (cfg.restDelay && !req.delayed) { req.delayed = true; return void setTimeout(() => rest(req, res), cfg.restDelay); }
  cfg.log.push({ at: Date.now(), host, path: u.pathname, q });
  if (cfg.log.length > 2000) cfg.log.splice(0, 1000);
  if (cfg.restFail) return json(res, 503, { code: -1, msg: 'down' });
  // 3.27.0: einzelne Kürzel beim Tickerpreis scheitern lassen oder verzögern (/tick?fail=A,B&delay=C:400)
  if ((u.pathname === '/api/v3/ticker/price' || u.pathname === '/fapi/v1/ticker/price') && q.symbol) {
    if (cfg.tickFail?.[q.symbol]) return json(res, 503, { code: -1, msg: 'Service unavailable ' + q.symbol });
    if (cfg.tickDelay?.[q.symbol] && !req.tdelayed) { req.tdelayed = true; return void setTimeout(() => rest(req, res), cfg.tickDelay[q.symbol]); }
  }
  const fut = host === 'fapi.binance.com', book = fut ? FUT : SPOT, sym = q.symbol;
  const need = () => { if (!sym || !(sym in book)) { json(res, 400, { code: -1121, msg: 'Invalid symbol.' }); return false; } return true; };
  switch (u.pathname) {
    case '/api/v3/ping': return json(res, 200, {});
    case '/api/v3/klines': case '/fapi/v1/klines': if (!need()) return; if (!IV[q.interval]) return json(res, 400, { code: -1120, msg: 'bad interval' }); return json(res, 200, hist(sym, q.interval, Number(q.limit) || 500, Number(q.startTime) || 0, Number(q.endTime) || 0));
    case '/api/v3/ticker/price': case '/fapi/v1/ticker/price': {
      if (q.symbols) { const list = JSON.parse(q.symbols); if (list.some(s => !(s in book))) return json(res, 400, { code: -1121, msg: 'Invalid symbol.' }); return json(res, 200, list.map(s => ({ symbol: s, price: String(price[s]) }))); }
      if (!need()) return; return json(res, 200, { symbol: sym, price: String(price[sym]), time: Date.now() });
    }
    case '/api/v3/ticker/bookTicker': if (sym !== 'EURUSDT') return json(res, 400, { code: -1121, msg: 'Invalid symbol.' }); return json(res, 200, { symbol: 'EURUSDT', bidPrice: String(price.EURUSDT - 0.0001), askPrice: String(price.EURUSDT + 0.0001), bidQty: '100', askQty: '100' });
    case '/api/v3/depth': case '/fapi/v1/depth': if (!need()) return; return json(res, 200, depth(sym, Number(q.limit) || 100));
    case '/fapi/v1/premiumIndex': if (!need()) return; return json(res, 200, { symbol: sym, markPrice: String(price[sym]), indexPrice: String(price[sym]), lastFundingRate: '0.00010000', interestRate: '0.0001', nextFundingTime: Math.ceil(Date.now() / 288e5) * 288e5, time: Date.now() });
    case '/fapi/v1/openInterest': if (!need()) return; return json(res, 200, { symbol: sym, openInterest: oiAt(sym, 3e5, Math.floor((Date.now() - 5000) / 3e5), Math.floor((Date.now() - 5000) / 3e5)).toFixed(3), time: Date.now() });
    case '/futures/data/openInterestHist': if (!need()) return; if (!OIP[q.period]) return json(res, 400, { code: -1130, msg: 'Invalid period.' }); return json(res, 200, oiHist(sym, q));
    default: return json(res, 404, { code: -1, msg: 'not mocked ' + u.pathname });
  }
}
// 3.15.0 – Orderbuch: je Seite `levels` Stufen im Abstand `step` (Anteil vom Kurs) um den aktuellen Kurs, Grundmenge
// 20–38 Tsd. USDT je Stufe (gleichmäßiges Muster, keine Wand); Wände aus /book werden der nächsten Stufe zugeschlagen
const bookCfg = { walls: [], step: 0.0002, levels: 1000 };
function depth(sym, limit) {
  const px = price[sym], n = Math.min(limit || 100, bookCfg.levels), side = dir => {
    const out = [], name = dir < 0 ? 'bid' : 'ask';
    for (let i = 1; i <= n; i++) {
      const p = +(px * (1 + dir * i * bookCfg.step)).toPrecision(8); let usd = 20000 + (i % 7) * 3000;
      for (const w of bookCfg.walls) if (w.sym === sym && w.side === name && Math.abs(w.price / p - 1) <= bookCfg.step / 2) usd += w.usd;
      out.push([String(p), (usd / p).toPrecision(8)]);
    }
    return out;
  };
  return { lastUpdateId: Date.now(), bids: side(-1), asks: side(1) };
}
const conns = new Set();
// Einzel-Trade (aggTrade): Menge q, Seite (sell = Käufer war Maker, also Taker-Verkauf), Handelszeit T (gleich = Teile einer Order)
function trade(sym, p, q = 1, sell = false, T = Date.now()) { const st = sym.toLowerCase() + '@aggTrade', now = Date.now(); for (const c of conns) if (c.streams.has(st) && c.ws.readyState === 1 && !cfg.silent && !c.zombie) c.ws.send(JSON.stringify({ stream: st, data: { e: 'aggTrade', E: now, s: sym, a: 1, p: String(p), q: String(q), f: 1, l: 1, T, m: !!sell } })); }
function attach(server, port) {
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, sock, head) => {
    const host = (req.headers.host || '').split(':')[0];
    if (cfg.blockWs) { sock.write('HTTP/1.1 403 Forbidden\r\n\r\n'); sock.destroy(); return; }
    wss.handleUpgrade(req, sock, head, ws => {
      const u = new URL(req.url, 'wss://x'), fut = host === 'fstream.binance.com';
      if (fut && !u.pathname.startsWith('/market/')) { ws.close(1008, 'use /market'); return; }
      const streams = new Set((u.searchParams.get('streams') || '').split('/').filter(Boolean));
      const c = { ws, host, port, fut, path: u.pathname, streams, received: [], sent: 0, opened: Date.now() };
      conns.add(c); cfg.log.push({ at: Date.now(), ws: 'open', host, port, path: u.pathname, streams: [...streams] });
      ws.on('message', m => { let d; try { d = JSON.parse(String(m)); } catch { return; } c.received.push(d); cfg.log.push({ at: Date.now(), ws: 'msg', host, d, zombie: !!c.zombie });
        if (c.zombie) return;
        if (d.method === 'SUBSCRIBE') d.params.forEach(s => streams.add(s)); if (d.method === 'UNSUBSCRIBE') d.params.forEach(s => streams.delete(s));
        ws.send(JSON.stringify({ result: d.method === 'LIST_SUBSCRIPTIONS' ? [...streams] : null, id: d.id })); });
      ws.on('close', () => { conns.delete(c); cfg.log.push({ at: Date.now(), ws: 'close', host, zombie: !!c.zombie }); });
    });
  });
}
function pushAll(fut) {
  if (cfg.silent) return;
  const now = Date.now();
  for (const c of conns) {
    if (c.fut !== fut || c.ws.readyState !== 1 || c.zombie) continue;
    for (const st of c.streams) {
      const m = /^([a-z0-9]+)@kline_(\w+)$/.exec(st), mp = /^([a-z0-9]+)@markPrice(@1s)?$/.exec(st);
      if (m) {
        const sym = m[1].toUpperCase(), iv = m[2]; if (!(sym in (fut ? FUT : SPOT))) continue;
        const k = cur(sym, iv, now), send = (x, closed) => c.ws.send(JSON.stringify({ stream: st, data: { e: 'kline', E: now, s: sym, k: { t: x.t, T: x.T, s: sym, i: iv, f: 1, L: 2, o: String(x.o), c: String(x.c), h: String(x.h), l: String(x.l), v: String(x.v.toFixed(3)), n: 5, x: closed, q: '0', V: '0', Q: '0', B: '0' } } }));
        const seenKey = '_seen_' + st;
        if (c[seenKey] && c[seenKey] !== k.t && k.prev && k.prev.t === c[seenKey]) send(k.prev, true); // Abschluss der alten Kerze
        c[seenKey] = k.t; send(k, false); c.sent++;
      } else if (mp) {
        const sym = mp[1].toUpperCase(); c.ws.send(JSON.stringify({ stream: st, data: { e: 'markPriceUpdate', E: now, s: sym, p: String(price[sym] || 1), i: String(price[sym] || 1), P: '0', r: '0.0001', T: now + 36e5 } })); c.sent++;
      }
    }
  }
}
let spotTimer = setInterval(() => pushAll(false), cfg.wsPeriod), futTimer = setInterval(() => pushAll(true), cfg.futPeriod);
// „bereit“ erst melden, wenn alle Ports belegt sind – ist einer besetzt (alter Mock läuft noch), beendet sich der Prozess mit Fehler
let listening = 0; const up = () => { if (++listening === 3) console.log('mock ready'); };
for (const port of [443, 9443]) { const s = https.createServer(tls, rest); attach(s, port); s.listen(port, '127.0.0.1', up); }
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), q = Object.fromEntries(u.searchParams);
  const ok = b => json(res, 200, b ?? { ok: true });
  switch (u.pathname) {
    case '/state': return ok({ conns: [...conns].map(c => ({ host: c.host, port: c.port, path: c.path, streams: [...c.streams].sort(), received: c.received, sent: c.sent })), price, cfg: { ...cfg, log: undefined } });
    case '/log': return ok(cfg.log.filter(e => !q.since || e.at >= Number(q.since)));
    case '/set': touch(q.symbol, Number(q.price)); return ok({ price: price[q.symbol] });
    case '/wick': { const back = price[q.symbol]; touch(q.symbol, Number(q.to)); trade(q.symbol, back); price[q.symbol] = back; for (const k of Object.keys(candles)) if (k.startsWith(q.symbol + '|')) candles[k].c = back; return ok({ back }); }
    case '/walk': cfg.walk = q.on === '1'; return ok();
    // Schritt 2.5 – Whale-Alert: eine große Marktorder (usd, side=buy|sell) in parts Teil-Ausführungen mit gleicher Handelszeit,
    // Preis in Order-Richtung weiterlaufend; flat=1: alle zum selben Preis (so sehen verschiedene kleine Orders aus)
    case '/whale': { const sym = q.symbol || 'BTCUSDT', px = price[sym], usd = Number(q.usd) || 150000, parts = Math.max(1, Number(q.parts) || 1), sell = q.side === 'sell', T = Date.now();
      for (let i = 0; i < parts; i++) { const p = q.flat === '1' ? px : +(px * (1 + (sell ? -1 : 1) * i * 0.0002)).toPrecision(8); trade(sym, p, usd / parts / p, sell, T); } return ok({ usd, parts }); } // flat=1: gleicher Preis (verschiedene Orders)
    // 3.15.0 – Orderbuch-Wände: side=bid|ask&price&usd setzt eine Wand, side&remove=Kurs entfernt sie, clear=1 leert alle des
    // Kürzels; step (Stufenabstand als Anteil vom Kurs) und levels (Stufen je Seite) bestimmen, wie weit das Buch reicht
    case '/book': { const sym = q.symbol || 'BTCUSDT';
      if (q.clear === '1') bookCfg.walls = bookCfg.walls.filter(w => w.sym !== sym);
      if (q.remove) bookCfg.walls = bookCfg.walls.filter(w => !(w.sym === sym && w.side === q.side && Math.abs(w.price / Number(q.remove) - 1) < 1e-9));
      if (q.price && q.usd) bookCfg.walls.push({ sym, side: q.side === 'ask' ? 'ask' : 'bid', price: Number(q.price), usd: Number(q.usd) });
      if (q.step) bookCfg.step = Number(q.step); if (q.levels) bookCfg.levels = Number(q.levels);
      return ok({ ...bookCfg }); }
    // Gewöhnlicher Handel: n Käufe und n Verkäufe (je eigene Handelszeit, also keine Order-Gruppen) mit den Summen buy/sell in USDT
    case '/flow': { const sym = q.symbol || 'BTCUSDT', px = price[sym], n = Math.max(1, Number(q.n) || 5), T = Date.now() - 1000;
      for (let i = 0; i < n; i++) { if (Number(q.buy) > 0) trade(sym, px, Number(q.buy) / n / px, false, T + 2 * i); if (Number(q.sell) > 0) trade(sym, px, Number(q.sell) / n / px, true, T + 2 * i + 1); } return ok({ n }); }
    // Testmuster für den RSI-Divergenz-Scanner: bull (tieferes Tief, höheres RSI-Tief), bear (Spiegelbild), none (zweites Tief
    // höher), open (wie bull, aber das Tief ist noch nicht bestätigt). Ersetzt die Historie von Symbol und Intervall.
    case '/shape': {
      const sym = q.symbol, iv = q.interval || '1m', step = IV[iv], last = cur(sym, iv), kind = q.kind || 'bull', base = price[sym];
      const pz = v => +v.toPrecision(8), put = pts => { H[sym + '|' + iv] = pts.map((c, i) => { const t = last.t - (pts.length - i) * step, o = i ? pts[i - 1] : c; return krow(t, pz(o), pz(Math.max(o, c) * 1.0002), pz(Math.min(o, c) * 0.9998), pz(c), 100, t + step - 1, 10); });
        // laufende Kerzen neu beginnen: sonst reicht ihre Spanne vom alten Kurs bis zum Ende des Verlaufs (ein Scheinschwung)
        const lp = pz(pts.at(-1)); for (const k of Object.keys(candles)) if (k.startsWith(sym + '|')) Object.assign(candles[k], { o: lp, h: lp, l: lp, c: lp });
        touch(sym, lp); return ok({ n: pts.length, last: lp }); };
      // Schritt 2.3 – Elliott-Wellen: ew-up (Impuls 1–5 aufwärts, danach A–B–C, alles bestätigt), ew-down (Spiegelbild),
      // ew-open (Impuls, danach nur das noch laufende A), ew-five (Welle 5 läuft), ew-bopen (B läuft),
      // ew-none (Welle 4 reicht in den Bereich von Welle 1: keine Zählung),
      // short (nur n Kerzen Historie, Standard 30)
      // 3.24.0 BTC-Puls: gleichbleibender Kurs (n Kerzen, Standard 60) – keine Zufallsbewegung, die einen Puls auslösen könnte
      if (kind === 'flat') { const n = Math.max(2, Number(q.n) || 60); return put(Array(n).fill(base)); }
      if (kind === 'short') { const n = Math.max(2, Number(q.n) || 30), pts = []; for (let i = 0; i < n; i++) pts.push(base * (1 + Math.sin(i / 3) * 0.004)); return put(pts); }
      if (kind.startsWith('ew-')) {
        let r = 5; const rr = () => { r = (r * 48271) % 2147483647; return r / 2147483647; }, m = kind === 'ew-down' ? v => 2 - v : v => v, pts = [];
        for (let i = 0; i < 300; i++) pts.push(base * (1 + (rr() - 0.5) * 0.002));
        const seg = (to, n) => { const from = pts.at(-1), t = base * m(to); for (let i = 1; i <= n; i++) pts.push(from + (t - from) * i / n); };
        const legs = kind === 'ew-none' ? [[0.90, 10], [0.96, 6], [0.92, 4], [1.06, 12], [0.95, 8], [1.08, 10], [1.04, 4]]
          : [[0.90, 10], [0.96, 6], [0.92, 4], [1.06, 12], [0.99, 6], [1.08, 8], [1.02, 5], [1.055, 4], [0.995, 6], [1.035, 4]];
        // ew-five: Welle 5 läuft noch; ew-open: A läuft; ew-bopen: B läuft
        for (const [to, n] of kind === 'ew-five' ? legs.slice(0, 6) : kind === 'ew-open' ? legs.slice(0, 7) : kind === 'ew-bopen' ? legs.slice(0, 8) : legs) seg(to, n);
        return put(pts);
      }
      let r = 9; const rr = () => { r = (r * 48271) % 2147483647; return r / 2147483647; };
      const s = kind === 'bear' ? -1 : 1, lv = f => base * (1 - s * f), pts = [];
      for (let i = 0; i < 400; i++) pts.push(base * (1 + (rr() - 0.5) * 0.002));
      const seg = (to, n) => { const from = pts.at(-1); for (let i = 1; i <= n; i++) pts.push(from + (to - from) * i / n); };
      seg(lv(0.06), 5); seg(lv(0.02), 10);
      if (kind === 'none') seg(lv(0.04), 8); else { let f = 0.02; for (let i = 0; i < 12; i++) { f += 0.009; pts.push(lv(f)); f -= 0.005; pts.push(lv(f)); } }
      if (kind !== 'open') seg(lv(0.045), 5);
      const px = v => +v.toPrecision(8);
      H[sym + '|' + iv] = pts.map((c, i) => { const t = last.t - (pts.length - i) * step, o = i ? pts[i - 1] : c; return krow(t, px(o), px(Math.max(o, c) * 1.0002), px(Math.min(o, c) * 0.9998), px(c), 100, t + step - 1, 10); });
      // laufende Kerzen neu beginnen (wie bei den Elliott-Verläufen): sonst hinge das Ergebnis vom Minutenwechsel ab
      const lp = px(pts.at(-1)); for (const k of Object.keys(candles)) if (k.startsWith(sym + '|')) Object.assign(candles[k], { o: lp, h: lp, l: lp, c: lp });
      touch(sym, lp); return ok({ n: pts.length, last: lp });
    }
    case '/oi': if (q.mode) oiCfg.mode = q.mode; if (q.ago) oiCfg.ago = Number(q.ago); if (q.amount) oiCfg.amount = Number(q.amount); return ok({ ...oiCfg });
    case '/silent': cfg.silent = q.on === '1'; return ok();
    case '/blockws': cfg.blockWs = q.on === '1'; if (cfg.blockWs) for (const c of conns) c.ws.terminate(); return ok();
    case '/restfail': cfg.restFail = q.on === '1'; return ok();
    case '/tick': cfg.tickFail = Object.fromEntries((q.fail || '').split(',').filter(Boolean).map(x => [x, 1])); cfg.tickDelay = Object.fromEntries((q.delay || '').split(',').filter(Boolean).map(x => x.split(':')).map(([k, ms]) => [k, Number(ms) || 0])); return ok({ fail: cfg.tickFail, delay: cfg.tickDelay });
    case '/drop': for (const c of conns) c.ws.terminate(); return ok({ dropped: true });
    case '/flood': { clearInterval(cfg.flood); cfg.flood = null; if (q.on === '1') { const sym = q.symbol || 'BTCUSDT', per = Math.max(1, Math.round((Number(q.rate) || 1000) / 50)); cfg.flood = setInterval(() => { for (let i = 0; i < per; i++) trade(sym, +(price[sym] * (1 + (rnd() - 0.5) * 0.001)).toPrecision(8)); }, 20); } return ok({ flood: !!cfg.flood }); }
    case '/zombie': { let n = 0; for (const c of conns) if (!q.host || c.host === q.host) { c.zombie = true; n++; } return ok({ zombies: n }); }
    case '/period': clearInterval(spotTimer); clearInterval(futTimer); cfg.wsPeriod = Number(q.spot) || cfg.wsPeriod; cfg.futPeriod = Number(q.fut) || cfg.futPeriod; spotTimer = setInterval(() => pushAll(false), cfg.wsPeriod); futTimer = setInterval(() => pushAll(true), cfg.futPeriod); return ok();
    case '/cal': if (q.mode) calCfg.mode = q.mode; if (q.min) calCfg.min = Number(q.min); return ok({ ...calCfg });
    case '/news': if (q.mode) newsCfg.mode = q.mode; return ok({ ...newsCfg });
    case '/vola': {
      const mode = q.mode || volaCfg.mode, drift = q.drift === undefined ? volaCfg.drift : q.drift === '' ? null : Number(q.drift);
      if (mode !== volaCfg.mode || drift !== volaCfg.drift) { Object.assign(volaCfg, { mode, drift }); for (const k of Object.keys(H)) if (k.endsWith('|1h')) delete H[k]; }
      return ok({ ...volaCfg });
    }
    case '/reset': if (volaCfg.mode !== 'normal' || volaCfg.drift !== null) { Object.assign(volaCfg, { mode: 'normal', drift: null }); for (const k of Object.keys(H)) if (k.endsWith('|1h')) delete H[k]; }
      Object.assign(calCfg, { mode: 'normal', min: 10, hits: 0 }); Object.assign(newsCfg, { mode: 'normal', hits: 0 }); clearInterval(cfg.flood); cfg.flood = null; cfg.log.length = 0; Object.assign(oiCfg, { mode: 'wave', ago: 10, amount: 0.06 }); cfg.walk = true; cfg.silent = false; cfg.blockWs = false; cfg.restFail = false; cfg.restDelay = 0; cfg.chanNoCors = false; cfg.tg429 = 0; cfg.tgDocFail = false; cfg.tgUpdates = true; cfg.tgMulti = false; cfg.tg502 = 0; cfg.tgFail = null; cfg.tickFail = {}; cfg.tickDelay = {}; sent.length = 0; Object.assign(bookCfg, { walls: [], step: 0.0002, levels: 1000 }); return ok();
    case '/restdelay': cfg.restDelay = Number(q.ms) || 0; return ok();
    case '/chan': if ('tg502' in q) cfg.tg502 = Number(q.tg502) || 0; if ('tgfail' in q) cfg.tgFail = q.tgfail ? { code: Number(q.tgfail), match: q.match || '' } : null; if ('nocors' in q) cfg.chanNoCors = q.nocors === '1'; if ('tg429' in q) cfg.tg429 = Number(q.tg429) || 0; if ('docfail' in q) cfg.tgDocFail = q.docfail === '1'; if ('updates' in q) cfg.tgUpdates = q.updates === '1'; return ok();
    case '/sent': return ok(sent);
    case '/tgmsgs': return ok([...tgMsgs.values()].filter(m => !q.chat || String(m.chat.id) === q.chat).map(m => ({ ...m, content: m.document ? tgFiles.get(m.document.file_id) : undefined })));
    case '/tgmulti': cfg.tgMulti = q.on === '1'; return ok();
    case '/tgdelmsg': { const id = Number(q.id), had = tgMsgs.delete(id); for (const s of Object.values(tgDocs)) s.delete(id); return ok({ deleted: had }); } // 3.25.0: Nutzer löscht die Nachricht
    case '/tgreset': tgMsgs.clear(); tgFiles.clear(); for (const k of Object.keys(tgDocs)) delete tgDocs[k]; sent.length = 0; return ok();
    case '/tgpin': { const chat = q.chat || '987654321', bot = Number(q.bot) || 123456789, id = ++tgMsgId, ck = tgCk(bot, chat); (tgDocs[ck] || (tgDocs[ck] = new Set())).add(id); const b = []; req.on('data', d => b.push(d)); req.on('end', () => { const m = tgStoreDoc(bot, chat, id, Buffer.concat(b).toString('utf8'), q.name || 'scalpdesk-247.json', q.caption || ''); if (q.pin !== '0') m.pinnedAt = Date.now(); ok({ message_id: id }); }); return; }
    case '/tgedit': { const m = tgMsgs.get(Number(q.id)); if (!m) return ok({ ok: false }); if ('caption' in q) m.caption = q.caption; if ('edit' in q) m.edit_date = Number(q.edit); return ok(tgPublic(m)); }
    case '/sentreset': sent.length = 0; return ok();
    case '/tgdel': for (const s of Object.values(tgDocs)) s.delete(Number(q.id)); return ok();
    default: return json(res, 404, { error: 'unknown' });
  }
}).listen(8790, '127.0.0.1', up);
