// BTC-Puls (3.24.0) ohne Browser: Schwellen je Uhrzeit aus 5m-Kerzen (js/pulse.js), Bewegung über 5/15 Minuten, Mindestgröße,
// Sperre je Richtung (30 min, „legt weiter zu“ ab dem 1,5-Fachen), Nachrichtentext – und derselbe Ablauf im 24/7-Dienst
// (server/scalpdesk-247.mjs, ab 1.1): Datei der App prüfen, „· Puls“ in der Bestätigung, App erkennt das, Dienst meldet
// nachts lautlos, nicht doppelt (auch nach einem Neustart), mit der Vorauswahl. Aufruf: node unit-pulse.js
process.env.TZ = 'Europe/Berlin';
const fs = require('fs'), path = require('path'), os = require('os');
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${info ? ' — ' + info : ''}`); };
const TOKEN = '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw', CHAT = '987654321', M = 60e3, JS = path.join(__dirname, 'js');
(async () => {
  const W = await import(require('path').join(__dirname, '..', 'server/scalpdesk-247.mjs'));
  const volaQ = new Function(`${/function volaQ\(sorted, q\) \{[\s\S]*?\n\}/.exec(fs.readFileSync(path.join(JS, 'vola.js'), 'utf8'))[0]}\nreturn volaQ;`)();
  const signed = (x, d = 2) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${W.number(Math.abs(x), d)}`;
  const A = new Function('volaQ', 'signed', 'number', 'priceText', `${fs.readFileSync(path.join(JS, 'pulse.js'), 'utf8')}\nreturn { pulseSlot, pulseStats, pulseLimit, pulseMove, pulseDecide, pulseText, PULSE_FLOOR, PULSE_WIN };`)(volaQ, signed, W.number, W.priceText);

  // ---- Uhrzeit und Tagesart (UTC; das Fenster endet zum Zeitpunkt t) ----
  const s1 = A.pulseSlot(Date.UTC(2026, 8, 26, 14, 0)), s2 = A.pulseSlot(Date.UTC(2026, 8, 28, 0, 0)), s3 = A.pulseSlot(Date.UTC(2026, 8, 29, 9, 30));
  check('Fenster bis Sa 14:00 UTC → Stunde 13, Wochenende; bis Mo 00:00 → So 23 Uhr; Di 9:30 → Werktag 9 Uhr', s1.h === 13 && s1.we && s2.h === 23 && s2.we && s3.h === 9 && !s3.we, JSON.stringify([s1, s2, s3]));

  // ---- Schwellen aus 35 Tagen 5m-Kerzen: werktags 14 Uhr UTC unruhig (±1 %), sonst ruhig (±0,1 %) ----
  const D0 = Date.UTC(2026, 7, 24), rows = []; let c = 60000;
  for (let t = D0; t < D0 + 35 * 864e5; t += 3e5) {
    const d = new Date(t), busy = d.getUTCHours() === 14 && d.getUTCDay() !== 0 && d.getUTCDay() !== 6, i = rows.length;
    c *= 1 + (i % 2 ? -1 : 1) * (busy ? 0.01 : 0.001); rows.push([t, c]);
  }
  const st = A.pulseStats(rows);
  check('Statistik: 35 Tage, je Tagesart 24 Stunden mit 5- und 15-Minuten-Wert', st.wd.length === 24 && st.we.length === 24 && st.wd.every(h => h.length === 2) && Math.round((st.to - st.from) / 864e5) === 35);
  check('Werktag 14 Uhr (mit Nachbarstunden): 99-%-Wert der 5-Minuten-Bewegung ≈ 1 %', Math.abs(st.wd[14][0] - 1) < 0.02 && Math.abs(st.wd[15][0] - 1) < 0.02, JSON.stringify(st.wd[14]));
  check('Ruhige Stunden und Wochenende: ≈ 0,1 %', Math.abs(st.wd[3][0] - 0.1) < 0.005 && Math.abs(st.we[14][0] - 0.1) < 0.005, `${st.wd[3][0]} / ${st.we[14][0]}`);
  check('15-Minuten-Wert: unruhige Stunde deutlich über ruhiger', st.wd[14][1] > 0.9 && st.wd[3][1] < 0.2, `${st.wd[14][1]} / ${st.wd[3][1]}`);
  const few = A.pulseStats(rows.slice(0, 288));
  check('Zu wenige Fälle (1 Tag): keine Schwelle (null) – dann gilt nur die Mindestgröße', few.wd[3][0] === null && few.we[3][0] === null);
  // Lücke: Bewegung über die Lücke hinweg zählt nicht
  const gap = rows.slice(0, 4000).concat(rows.slice(4012).map(([t, v]) => [t, v * 1.3]));
  check('Lücke in den Kerzen (+30 % dahinter): keine Scheinbewegung in der Statistik', Math.max(...A.pulseStats(gap).wd.flat().filter(v => v !== null)) < 1.1);

  // ---- Schwelle und Mindestgröße ----
  const wd1405 = Date.UTC(2026, 8, 29, 14, 5), wd0205 = Date.UTC(2026, 8, 29, 2, 5);
  check('Schwelle: unruhige Stunde → 99-%-Wert (≈ 1 %), ruhige → Mindestgröße 0,5 % / 0,8 %', Math.abs(A.pulseLimit(st, 5, wd1405) - 1) < 0.02 && A.pulseLimit(st, 5, wd0205) === 0.5 && A.pulseLimit(st, 15, wd0205) === 0.8 && A.pulseLimit(null, 15, wd0205) === 0.8,
    [A.pulseLimit(st, 5, wd1405), A.pulseLimit(st, 5, wd0205), A.pulseLimit(st, 15, wd0205)].join(' / '));

  // ---- Bewegung aus 1m-Kerzen ----
  const T1 = Date.UTC(2026, 8, 29, 21, 30), m1 = Array.from({ length: 16 }, (_, i) => ({ time: T1 - (16 - i) * M, close: 60000 + i * 10 })); // abgeschlossen bis T1
  check('Bewegung über 5 Minuten: Kurs gegen den Schluss der Kerze vor 5 Minuten', Math.abs(A.pulseMove(m1, 59000, 5) - (59000 / 60110 - 1) * 100) < 1e-9 && Math.abs(A.pulseMove(m1, 59000, 15) - (59000 / 60010 - 1) * 100) < 1e-9);
  check('Zu wenige Kerzen oder Lücke: keine Aussage', A.pulseMove(m1.slice(-4), 59000, 5) === null && A.pulseMove([...m1.slice(0, 13), ...m1.slice(14)], 59000, 5) === null && A.pulseMove(m1, 0, 5) === null);

  // ---- Entscheidung und Sperre ----
  const n = wd1405, lim15 = A.pulseLimit(st, 15, n);
  check('Unter der Schwelle: nichts', A.pulseDecide({ 5: -0.8, 15: -0.9 * lim15 }, st, n) === null);
  let p = A.pulseDecide({ 5: -1.2, 15: -1.6 * lim15 }, st, n);
  check('Beide Fenster darüber: das ungewöhnlichere (15 Min.), Richtung abwärts', p && p.w === 15 && p.d === 'down' && !p.more && Math.abs(p.mag - 1.6 * lim15) < 1e-9, JSON.stringify(p));
  p = A.pulseDecide({ 5: 0.6, 15: null }, st, wd0205);
  check('Ruhige Stunde: 0,6 % in 5 Min. über der Mindestgröße 0,5 % → aufwärts', p && p.w === 5 && p.d === 'up' && p.lim === 0.5);
  const last = { down: { t: n - 10 * M, mag: 2, more: false } };
  check('Sperre: dieselbe Richtung innerhalb 30 min, nicht deutlich mehr (2,9 < 3) → nichts', A.pulseDecide({ 5: -2.9, 15: null }, st, n, last) === null);
  p = A.pulseDecide({ 5: -3.1, 15: null }, st, n, last);
  check('… legt deutlich zu (≥ 1,5-fach) → eine weitere („more“)', p && p.more && p.d === 'down');
  check('… danach innerhalb 30 min keine mehr, egal wie stark', A.pulseDecide({ 5: -9, 15: null }, st, n, { down: { t: n - 5 * M, mag: 3.1, more: true } }) === null);
  check('Andere Richtung und nach 30 min: wieder frei', A.pulseDecide({ 5: 2.5, 15: null }, st, n, last)?.d === 'up' && A.pulseDecide({ 5: -2.1, 15: null }, st, n + 21 * M, last)?.more === false);

  // ---- Text ----
  const txt = A.pulseText({ w: 15, mv: -2.1, lim: 1.2, more: false }, 61230.5, '14', [['ETC', -2.8], ['XRP', -2.4]]);
  check('Text: Richtung, Größe, Fenster, Kurs, Uhrzeit mit Schwelle, Vorauswahl – keine Prognose', txt === '⚡ BTC-Puls: BTC −2,10 % in 15 Min. (61.230,50 USDT) – ungewöhnlich stark für 14 Uhr (Schwelle 1,20 %)\nVorauswahl im selben Zeitraum: ETC −2,80 % · XRP −2,40 %', txt);
  check('Text „legt weiter zu“, ohne Vorauswahl einzeilig', A.pulseText({ w: 5, mv: 3.3, lim: 0.5, more: true }, 60000, '03', []) === '⚡ BTC-Puls: BTC +3,30 % in 5 Min. (60.000,00 USDT) – Bewegung legt weiter zu – ungewöhnlich stark für 03 Uhr (Schwelle 0,50 %)');

  // ---- 3.25.0: Vorauswahl-Zeile – die Kacheln haben die Kerzen ihres Zeitraums (Standard 5m): 1m-Kerzen per REST, Frist 2,5 s ----
  {
    const NOW = Date.UTC(2026, 9, 1, 10, 0) + 30e3, base = Math.floor(NOW / M) * M, calls = [];
    const m1s = closes => [...closes.map((c, i) => ({ time: base - (closes.length - i) * M, close: c, closeTime: base - (closes.length - i) * M + M - 1 })), { time: base, close: closes.at(-1), closeTime: base + M - 1 }];
    let slow = '', fail = '';
    const answer = (sym, q) => new Promise((res, rej) => { calls.push(`${sym}:${q.interval}:${q.limit}`); if (sym === fail) return rej(new Error('400')); setTimeout(() => res(m1s(Array.from({ length: 16 }, (_, i) => 90 + i))), sym === slow ? 5000 : 5); });
    const wlc = new Map([
      ['ETCUSDT', { sym: 'ETCUSDT', iv: '5m', market: 'spot', closed: [], run: { close: 105 } }],
      ['XRPUSDT', { sym: 'XRPUSDT', iv: '5m', market: 'futures', closed: [], run: { close: 99 } }],
      ['NEARUSDT', { sym: 'NEARUSDT', iv: '5m', market: 'spot', closed: [], error: 'gibt es nicht' }]
    ]);
    const P = new Function('volaQ', 'signed', 'number', 'priceText', 'wl', 'wlSym', 'wlPrice', 'state', 'api', 'FUTURES', 'spotGet', 'normalizeKlines',
      `${fs.readFileSync(path.join(JS, 'pulse.js'), 'utf8')}\nreturn { pulseOthers };`)(volaQ, signed, W.number, x => W.number(x, 2), { c: wlc }, c => `${c}USDT`, e => e.run?.close ?? null,
      { watch: ['BTC', 'ETC', 'XRP', 'NEAR'] }, { get: (base, p, q) => answer(q.symbol, q) }, 'FUT', (p, q) => answer(q.symbol, q), rows => rows);
    let o = await P.pulseOthers(5, NOW);
    check('Vorauswahl-Zeile (Kacheln auf 5m): 1m-Kerzen je Coin per REST (Spot bzw. Futures), Veränderung über 5 Minuten, ohne BTC und fehlerhafte', JSON.stringify(o) === JSON.stringify([['ETC', (105 / 101 - 1) * 100], ['XRP', (99 / 101 - 1) * 100]]) && calls.join() === 'ETCUSDT:1m:7,XRPUSDT:1m:7', JSON.stringify({ o, calls }));
    calls.length = 0; wlc.get('ETCUSDT').iv = '1m'; wlc.get('ETCUSDT').closed = m1s([200, 201, 202, 203, 204, 204]).slice(0, -1);
    o = await P.pulseOthers(5, NOW);
    check('Zeitraum 1 Minute: ETC aus den eigenen 1m-Kerzen der Kachel (kein Abruf), XRP per REST', o[0][0] === 'ETC' && Math.abs(o[0][1] - (105 / 201 - 1) * 100) < 1e-9 && calls.join() === 'XRPUSDT:1m:7', JSON.stringify({ o, calls }));
    wlc.get('ETCUSDT').iv = '5m'; calls.length = 0; o = await P.pulseOthers(15, NOW);
    check('15-Minuten-Fenster: 17 Kerzen je Coin abgefragt, Veränderung über 15 Minuten', JSON.stringify(o) === JSON.stringify([['ETC', (105 / 91 - 1) * 100], ['XRP', (99 / 91 - 1) * 100]]) && calls.join() === 'ETCUSDT:1m:17,XRPUSDT:1m:17', JSON.stringify({ o, calls }));
    calls.length = 0; slow = 'XRPUSDT'; const t0 = Date.now();
    o = await P.pulseOthers(5, NOW); const took = Date.now() - t0;
    check('Ein Coin antwortet nicht: nach 2,5 s ohne ihn, ETC bleibt in der Zeile', JSON.stringify(o) === JSON.stringify([['ETC', (105 / 101 - 1) * 100]]) && took >= 2400 && took < 4000, JSON.stringify({ o, took }));
    slow = ''; fail = 'ETCUSDT'; o = await P.pulseOthers(5, NOW);
    check('Abruf scheitert: dieser Coin fehlt, XRP bleibt', JSON.stringify(o.map(x => x[0])) === '["XRP"]', JSON.stringify(o));
  }

  // ---- App und Dienst entscheiden gleich ----
  const pc = { thr: { wd: st.wd, we: st.we }, floor: { 5: 0.5, 15: 0.8 } }, grid = [];
  for (const t of [wd1405, wd0205, Date.UTC(2026, 8, 26, 14, 5)]) for (const m5 of [-2, -0.7, 0.3, 0.55, 1.4]) for (const m15 of [null, -1.9, 0.85]) for (const l of [{}, last, { up: { t: t - 40 * M, mag: 1, more: false } }]) {
    const a = A.pulseDecide({ 5: m5, 15: m15 }, st, t, l), s = W.pulseDecide({ 5: m5, 15: m15 }, pc, t, l);
    grid.push(JSON.stringify(a) === JSON.stringify(s) && (!a || A.pulseText(a, 60000, '14', [['ETC', 1]]) === W.pulseText(s, 60000, '14', [['ETC', 1]])));
  }
  check(`App und Dienst: gleiche Entscheidung und gleicher Text (${grid.length} Fälle)`, grid.every(Boolean), `${grid.filter(x => !x).length} abweichend`);
  const sm1 = m1.map(x => ({ t: x.time, c: x.close }));
  check('App und Dienst: gleiche Bewegung aus denselben Kerzen', A.pulseMove(m1, 59000, 15) === W.pulseMove(sm1, 59000, 15) && W.pulseMove(sm1.slice(-4), 59000, 5) === null);

  // ---- Datei der App im Dienst ----
  const hours = v => Array.from({ length: 24 }, () => [v, v * 1.6]), goodPulse = { thr: { wd: hours(0.4), we: hours(0.3) }, floor: [0.5, 0.8], watch: ['ETC', 'BTC', 'xrp', 'XYZ'] };
  const pp = W.parsePulse(goodPulse);
  check('Dienst: Schwellen übernommen, Vorauswahl ohne BTC und ungültige Kürzel', pp && pp.floor[5] === 0.5 && pp.floor[15] === 0.8 && Math.abs(pp.thr.wd[7][1] - 0.64) < 1e-9 && pp.watch.join() === 'ETC,XYZ', JSON.stringify(pp?.watch));
  check('Dienst: gespeicherte Form wird wieder erkannt (Neustart)', JSON.stringify(W.parsePulse(pp)) === JSON.stringify(pp));
  check('Dienst: unvollständige oder unplausible Schwellen → kein Puls', W.parsePulse({ ...goodPulse, thr: { wd: hours(0.4).slice(1), we: hours(0.3) } }) === null && W.parsePulse({ ...goodPulse, floor: [0, 0.8] }) === null
    && W.parsePulse({ ...goodPulse, thr: { wd: hours(NaN), we: hours(0.3) } }) === null && W.parsePulse(null) === null);
  const T = Date.UTC(2026, 8, 29, 21, 0), base = { kind: 'scalpdesk-247', v: 1, tag: 'pu01', at: T, on: true, tz: 'Europe/Berlin', app: '3.24.0', dev: 'Safari, iPad', ev: { alarm: true, pos: true, news: true, pulse: true }, econ: { warn: 0, cur: 'usd' }, alarms: [], positions: [] };
  const cfgP = W.parseConfig({ ...base, pulse: goodPulse }), cfgOld = W.parseConfig({ ...base, ev: { alarm: true, pos: true, news: true } , pulse: goodPulse }), cfgNo = W.parseConfig(base);
  check('Dienst: Puls nur mit eingeschalteter Meldung und gültigen Schwellen (ältere App-Datei ohne ev.pulse → aus)', W.pulseOn(cfgP) && !W.pulseOn(cfgOld) && !W.pulseOn(cfgNo));
  const capP = W.caption(cfgP, W.statusLine({ ok: true, now: T, c: cfgP })), capN = W.caption(cfgNo, W.statusLine({ ok: true, now: T, c: cfgNo }));
  check('Bestätigung: „Dienst: aktiv · … · Puls · #pu01 übernommen“', /\nDienst: aktiv · 29\.09\. 23:00 · v[\d.]+ · Puls · #pu01 übernommen$/.test(capP) && !/Puls/.test(capN), capP.split('\n').at(-1));
  // App liest „Puls“ und überlässt ihn dem Dienst nur dann
  const src = fs.readFileSync(path.join(JS, 's247.js'), 'utf8');
  const S = new Function('store', 'navigator', '$', 'broadcastData', 'state', 'chan', 'APP_VERSION', 'ec', 'tgApi', 'tgPost', 'tgConfigured', 'document', 'addEventListener', 'renderChanSummary', 'pulseHandover',
    `${src}\nreturn { s247, s247Parse, s247Covers, s247Payload };`)({ get: () => null, set: () => true, claim: async () => true, release: async () => {} }, { userAgent: 'Mozilla/5.0 (iPad) Safari/605.1.15', maxTouchPoints: 5 }, () => null, () => {},
    { alarms: [], positions: [], watch: ['BTC', 'ETC'] }, { tg: { on: true }, ev: { alarm: true, pos: true, news: true, pulse: true } }, '3.24.0', { cfg: { warn: 0, cur: 'usd' } }, null, null, () => true, { hidden: false, addEventListener() {} }, () => {}, () => {}, () => goodPulse);
  const pm = cap => ({ message_id: 700, date: Math.floor(Date.now() / 1000), caption: cap, document: { file_name: 'scalpdesk-247.json' } });
  S.s247.cfg.on = true; const PL = S.s247Payload();
  check('App übergibt die Schwellen (ev.pulse, pulse) – der Dienst übernimmt sie', PL.ev.pulse === true && JSON.stringify(PL.pulse) === JSON.stringify(goodPulse) && W.pulseOn(W.parseConfig({ ...PL, tag: 'pu01', at: T })));
  Object.assign(S.s247.cfg, { on: true, msg: 700, tag: 'pu01', keys: [], econ: '', pulse: true }); S.s247.checkAt = Date.now();
  S.s247.st = S.s247Parse(pm(capP.replace('29.09. 23:00', '29.09. 23:01')), Date.now());
  check('App: Dienst mit „Puls“ → BTC-Puls kommt vom Dienst (App sendet nicht zusätzlich)', S.s247.st.svc.pulse && S.s247Covers('pulse', 'pulse:down'));
  S.s247.st = S.s247Parse(pm(capP.replace(' · Puls', '')), Date.now());
  check('App: älterer Dienst (1.0, ohne „Puls“) → die App sendet den Puls selbst', !S.s247.st.svc.pulse && !S.s247Covers('pulse', 'pulse:down') && S.s247.st.svc.ok);
  S.s247.st = S.s247Parse(pm(capP), Date.now()); S.s247.cfg.pulse = false;
  check('App: Schwellen nicht übergeben → die App sendet selbst', !S.s247Covers('pulse', 'pulse:down'));

  // ---- Der Dienst meldet: nachts lautlos, nicht doppelt, auch nach Neustart ----
  const tgLog = [], files = new Map(); let pinned = null, now2 = Date.UTC(2026, 8, 29, 21, 30, 10); // 23:30 Uhr in Berlin
  const k1 = (t, cl) => [t, String(cl), String(cl), String(cl), String(cl), '1', t + M - 1];
  // BTC: 15 Minuten lang 60.000, jetzt −3 % (laufende Kerze); ETC −4 %, XRP ohne Spot-Paar
  const series = { BTCUSDT: 60000, ETCUSDT: 20 }, drop = { BTCUSDT: 0.97, ETCUSDT: 0.96 };
  const klinesFor = sym => { const t0 = Math.floor(now2 / M) * M; return Array.from({ length: 17 }, (_, i) => { const t = t0 - (16 - i) * M; return k1(t, i === 16 ? series[sym] * drop[sym] : series[sym]); }); };
  const reply = (r, status = 200) => ({ ok: status < 300, status, json: async () => r });
  globalThis.fetch = async (url, o = {}) => {
    const u = new URL(url), b = o.body ? JSON.parse(o.body) : {};
    if (u.pathname.startsWith(`/file/bot${TOKEN}/`)) return reply(JSON.parse(files.get(u.pathname.split('/').pop())));
    const m = /^\/bot[^/]+\/(\w+)$/.exec(u.pathname);
    if (m) {
      tgLog.push({ method: m[1], ...b });
      if (m[1] === 'getChat') return reply({ ok: true, result: { id: +CHAT, type: 'private', ...(pinned ? { pinned_message: pinned } : {}) } });
      if (m[1] === 'getFile') return reply({ ok: true, result: { file_id: b.file_id, file_path: `documents/${b.file_id}` } });
      if (m[1] === 'editMessageCaption') { pinned.caption = b.caption; return reply({ ok: true, result: pinned }); }
      return reply({ ok: true, result: m[1] === 'getMe' ? { username: 'test_bot' } : { message_id: 900 } });
    }
    if (/klines/.test(u.pathname)) { const s = u.searchParams.get('symbol'); return series[s] ? reply(klinesFor(s)) : reply({ code: -1121, msg: 'Invalid symbol.' }, 400); }
    return reply({}, 404);
  };
  files.set('fP', JSON.stringify({ ...base, pulse: { ...goodPulse, watch: ['ETC', 'XRP'] } }));
  pinned = { message_id: 701, date: 1, caption: '📌 Scalp Desk · 24/7-Dienst\nApp: …\nDienst: wartet auf Rückmeldung …', document: { file_id: 'fP', file_unique_id: 'UP', file_name: 'scalpdesk-247.json' } };
  const statePath = path.join(os.tmpdir(), `pulse-state-${process.pid}.json`); try { fs.unlinkSync(statePath); } catch {}
  const logs = [], mk = () => new W.Watcher({ token: TOKEN, chat: CHAT, statePath, now: () => now2, log: (...a) => logs.push(a.join(' ')) });
  let w = mk(); const INFO = /^(✅ 24\/7-Dienst hat übernommen|⏸ 24\/7-Dienst|⏳ Scalp Desk 24\/7-Dienst)/; // 1.4: Bestätigung und Hinweis sind keine Meldungen
  const msgs = () => tgLog.filter(x => x.method === 'sendMessage' && /BTC-Puls/.test(x.text) && !INFO.test(x.text || ''));
  await w.tick();
  const dLine = () => (pinned?.caption || '').split('\n').find(l => l.startsWith('Dienst:')) || ''; // 1.3: darunter folgt „Zustellung: …“
  check('Dienst: Datei mit Schwellen übernommen, Bestätigung mit „Puls“', W.pulseOn(w.conf?.data) && / · Puls · #pu01 übernommen$/.test(dLine()), dLine());
  check('Dienst: BTC −3 % in 5 Min. um 23:30 Uhr → Nachricht, lautlos, mit ETC (XRP ohne Paar weggelassen)', msgs().length === 1 && msgs()[0].disable_notification === true
    && /^⚡ BTC-Puls: BTC −3,00 % in 5 Min\. \(58\.200,00 USDT\) – ungewöhnlich stark für 23 Uhr \(Schwelle 0,50 %\)\nVorauswahl im selben Zeitraum: ETC −4,00 %\n23:30:10 Uhr · 24\/7-Dienst$/.test(msgs()[0].text), msgs()[0]?.text);
  now2 += 20e3; w.next.price = 0; await w.tick();
  check('Dienst: gleiche Bewegung 20 s später → keine zweite Nachricht', msgs().length === 1);
  w.saveStateNow(); w = mk(); await w.tick(); now2 += 20e3; w.next.price = 0; await w.tick();
  check('Dienst nach Neustart: Sperre bleibt (Zustand gespeichert), keine Doppelmeldung', msgs().length === 1 && w.pulseLast.down?.mag > 2.9);
  drop.BTCUSDT = 0.96; now2 += 20e3; w.next.price = 0; await w.tick();
  check('Dienst: etwas mehr (−4 % < 1,5 × 3 %) → noch keine weitere', msgs().length === 1, String(msgs().length));
  drop.BTCUSDT = 0.95; now2 += 20e3; w.next.price = 0; await w.tick();
  check('Dienst: Bewegung legt deutlich zu (−5 % ≥ 1,5 × 3 %) → eine weitere Nachricht', msgs().length === 2 && /−5,00 % in 5 Min\. .* – Bewegung legt weiter zu/.test(msgs()[1].text), `${msgs().length} · ${msgs()[1]?.text.split('\n')[0]}`);
  drop.BTCUSDT = 0.9; now2 += 20e3; w.next.price = 0; await w.tick();
  check('Dienst: danach innerhalb 30 min keine weitere', msgs().length === 2, String(msgs().length));
  // tagsüber mit Ton; Aufwärts unabhängig
  now2 = Date.UTC(2026, 8, 30, 10, 0, 10); drop.BTCUSDT = 1.02; w.next.price = 0; await w.tick();
  check('Dienst: tagsüber (12 Uhr) aufwärts +2 % → Nachricht mit Ton', msgs().length === 3 && msgs()[2].disable_notification === undefined && /BTC \+2,00 % in 5 Min\./.test(msgs()[2].text), `${msgs().length} · ${msgs()[2]?.text.split('\n')[0]} · ${JSON.stringify(logs.slice(-3))}`);
  // Meldung in der App ausgeschaltet → Dienst prüft nicht mehr
  files.set('fQ', JSON.stringify({ ...base, tag: 'pu02', ev: { alarm: true, pos: true, news: true, pulse: false }, pulse: goodPulse }));
  pinned = { ...pinned, message_id: 702, document: { file_id: 'fQ', file_unique_id: 'UQ', file_name: 'scalpdesk-247.json' } };
  w.next.config = 0; now2 += 40 * M; drop.BTCUSDT = 0.9; w.next.price = 0; await w.tick(); w.next.beat = 0; await w.tick();
  check('Dienst: BTC-Puls in der App aus → keine Nachricht, Bestätigung ohne „Puls“', msgs().length === 3 && / · #pu02 übernommen$/.test(dLine()) && !/Puls/.test(dLine()), dLine());
  try { fs.unlinkSync(statePath); } catch {}
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
})().catch(err => { console.log('✗ Abbruch — ' + err.stack); process.exit(1); });
