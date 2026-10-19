// 3.73.1 / Dienst 2.15.1: Gewinn/Verlust ausschließlich als Foto, keine separate Übergabebestätigung.
// Alle Telegram-Aufrufe sind Attrappen. Echte Senderlogik, Konfigurationsübernahme und PNG-Renderer.
const fs = require('fs'), os = require('os'), path = require('path');
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
(async () => {
  globalThis.fetch = async () => { throw new Error('Unerwarteter Netzwerkzugriff im Test'); };
  const W = await import('../server/scalpdesk-247.mjs'), P = await import('../server/pattern-card.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pnl-photo-'));
  let now = Date.UTC(2026, 9, 15, 18, 44), uid = 0;
  const alarm = { id: 'a1', symbol: 'BTCUSDT', source: 'spot', dir: 'above', price: 200, armedAt: now - 60000 };
  const base = { kind: 'scalpdesk-247', v: 1, tag: 'pp01', on: true, tz: 'Europe/Berlin', ev: { alarm: true, pos: true, pnl: true, news: false }, alarms: [alarm], positions: [] };
  const config = (k = 'loss', extra = {}) => W.parseConfig({ ...base, pnl: { n: 1, pos: [{ id: 'p1', symbol: 'BTCUSDT', source: 'spot', side: 'long', qty: 2, entry: 100 }], lim: [{ k, v: 5, at: now, ...extra }] } });
  const make = (c, key = '') => {
    const statePath = path.join(dir, `${++uid}.json`), sent = [], w = new W.Watcher({ token: 'mock-token', chat: 'mock-chat', key, statePath, now: () => now, log: () => {} });
    let conf = c, rev = 0;
    const update = c => { conf = c; rev++; };
    w.readFile = async () => conf;
    w.eurRate = async () => 1.1185;
    w.tg = async (method, data) => {
      if (method === 'getChat') return { pinned_message: { message_id: uid, document: { file_name: 'scalpdesk-247.json', file_unique_id: String(rev) } } };
      sent.push({ method, ...data }); return { message_id: sent.length };
    };
    return { w, sent, update, statePath };
  };
  try {
    for (const key of ['', 'test-coordinator-key']) for (const k of ['profit', 'loss']) {
      const c = config(k), { w, sent, update, statePath } = make(c, key), label = `${key ? 'HTTPS' : 'Datei'} / ${k}`;
      // Eine bereits bestätigte Kursmarke plus neue Gewinn-/Verlust-Grenze: genau der zusätzliche Text aus dem Screenshot.
      w.ackKeys = W.handoverItems(c).map(x => x.key); w.ackOn = true;
      await w.syncConfig(); await w.sendAck();
      check(`${label}: neue Grenze still übernommen, Kurs-Alarm weiter beobachtet`, !w.ackPend && sent.length === 0 && W.watchItems(c).length === 2);
      await w.checkPnl(c, new Map([['spot:BTCUSDT', 100]]));
      await w.checkPnl(c, new Map([['spot:BTCUSDT', k === 'profit' ? 103 : 97]]));
      if (!key) { now += W.EVERY.pnlHold + 1; await w.flushPnl(); }
      await w.sendAck(); await w.deliver();
      const photo = sent.filter(m => m.method === 'sendPhoto');
      check(`${label}: genau ein echtes PNG, keine Textnachricht`, photo.length === 1 && sent.length === 1 && photo[0].photo.slice(1, 4).toString() === 'PNG' && photo[0].photo.readUInt32BE(16) === 1080);
      check(`${label}: passende Bildunterschrift in derselben Nachricht`, photo[0]?.caption === `${k === 'profit' ? 'Gewinn' : 'Verlust'}-Alarm · ${k === 'profit' ? '+' : '−'}6,00 USD`);
      await w.checkPnl(c, new Map([['spot:BTCUSDT', k === 'profit' ? 104 : 96]]));
      w.saveStateNow();
      const restarted = new W.Watcher({ token: 'mock-token', chat: 'mock-chat', statePath, now: () => now, log: () => {} });
      check(`${label}: kein Duplikat, Auslösung und stille Bestätigung überstehen Neustart`, sent.length === 1 && Object.keys(restarted.pnlFired).length === 1 && restarted.ackKeys.every(x => !x.startsWith('pnl:')));
      clearTimeout(restarted.saveTimer);
      const done = structuredClone(c); done.pnl.lim[0].done = true; update(done); await w.syncConfig(); await w.sendAck();
      const rearmed = structuredClone(c); rearmed.pnl.lim[0].at = ++now; update(rearmed); await w.syncConfig(); await w.sendAck();
      check(`${label}: Quittieren und Wiederaktivieren erzeugen keinen Text`, sent.length === 1 && !w.ackPend);
      clearTimeout(w.saveTimer);
    }
    const only = config(); only.alarms = [];
    const q = make(only); await q.w.syncConfig(); await q.w.sendAck();
    check('Erster Start nur mit Gewinn/Verlust: keine zusätzliche Begrüßung/Bestätigung', !q.w.ackPend && q.sent.length === 0 && q.w.ackOn === true);
    q.w.ackKeys = W.watchItems(only).map(x => x.key); // Zustand aus 2.15.0
    q.update(only); await q.w.syncConfig(); await q.w.sendAck();
    check('Bestehende 2.15.0-Bestätigung wird ohne neue Telegram-Nachricht migriert', q.sent.length === 0 && q.w.ackKeys.length === 0);
    const mixed = config(); q.update(mixed); await q.w.syncConfig(); await q.w.sendAck();
    check('Auch neuer Kurs-Alarm wird still übernommen und weiterhin beobachtet', q.sent.length === 0 && !q.w.ackPend && W.watchItems(q.w.conf.data).some(x=>x.key.startsWith('al:')));
    clearTimeout(q.w.saveTimer);

    // Fehlerfall: nur Bilder erneut versuchen; bei verlorener Telegram-Antwort keinen zweiten POST.
    const card = { profit: false, pnl: -6, level: 5, positions: [{ symbol: 'BTCUSDT', side: 'long', pnl: -6 }], at: now };
    for (const mode of ['renderer', 'rejected', 'lost', 'empty']) {
      const r = make(config()), originalTg = r.w.tg;
      if (mode === 'renderer') r.w.pnlCardImage = async () => { throw new Error('Renderer fehlt'); };
      else r.w.tg = async (method, data) => { if (method === 'sendPhoto') { r.sent.push({ method }); if (mode === 'empty') return null; throw Object.assign(new Error('Testantwort'), mode === 'lost' ? { lost: true } : { code: 400 }); } return originalTg(method, data); };
      await r.w.queue('Kein Ersatztext', 'Europe/Berlin', { label: 'Verlust-Alarm', pnlCard: card });
      check(`${mode}: kein sendMessage als Ersatz`, !r.sent.some(m => m.method === 'sendMessage'));
      const unclear = mode === 'lost' || mode === 'empty';
      check(`${mode}: ${unclear ? 'keine Wiederholung bei unklarer Zustellung' : 'Bild bleibt im Ausgang'}`, unclear ? r.w.out.length === 0 : r.w.out.length === 1 && r.w.out[0].tries === 1);
      if (!unclear) {
        r.w.pnlCardImage = W.Watcher.prototype.pnlCardImage.bind(r.w); r.w.tg = originalTg; now += 16000; await r.w.deliver();
        check(`${mode}: nach Erholung nur das Bild, Ausgang leer`, r.w.out.length === 0 && r.sent.filter(m => m.photo).length === 1 && !r.sent.some(m => m.method === 'sendMessage'));
      }
      clearTimeout(r.w.saveTimer);
    }

    // Originalfunktion aus dem App-Modul, isolierte Telegram-/Canvas-Grenzen.
    const html = fs.readFileSync(path.join(__dirname, '../weather-widget-v2.html'), 'utf8');
    const source = html.slice(html.indexOf('async function chanSendCard('), html.indexOf('\nfunction chanError(', html.indexOf('async function chanSendCard(')));
    for (const mode of ['ok', 'renderer', 'rejected', 'lost', 'missing']) {
      const posts = [], statuses = {}, env = { CARD_KINDS: { pnl: [P.pnlAlarmCard, 'gewinn-verlust.png'], alarm: [P.pnlAlarmCard, 'alarm.png'] },
        tgTarget: () => ({ token: 'mock', chat: 'mock' }), tgBotName: async () => 'Test', PAT_TZ: 'Europe/Berlin',
        svgPngBlob: async () => { if (mode === 'renderer') throw new Error('Canvas fehlt'); return Buffer.from('PNG'); },
        patPostCard: async () => { posts.push('photo'); return mode === 'lost' ? { ok: false, lost: true } : mode === 'rejected' ? { ok: false, code: 400 } : { ok: true }; },
        chanSend: async () => { posts.push('text'); return { ok: true }; }, chanState: statuses, renderChanStatus: () => {}, renderChanSummary: () => {},
        store: { set: () => {}, get: () => ({}) }, CHANLAST_KEY: 'last', chanLabel: () => 'Verlust', chanError: () => 'Testfehler', self: { navigator: { onLine: true } }, navigator: { onLine: true } };
      const run = new Function('env', `with(env) { ${source}; return chanSendCard; }`)(env);
      const result = await run('tg', 'Kein Ersatztext', false, 'pnl', mode === 'missing' ? {} : { card });
      check(`App ${mode}: nur Foto bei Erfolg, kein Text bei Bildfehler`, !posts.includes('text') && (mode === 'ok' ? posts.length === 1 && result.ok : !result.ok));
      if (mode === 'renderer') { await run('tg', 'Kurs-Ersatz', false, 'alarm', { card }); check('Kurs-Alarme behalten ihren bisherigen Text-Ersatz', posts.includes('text')); }
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
