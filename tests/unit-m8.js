// Verbindungs-Wächter (liveFeed) ohne Browser: simulierte Uhr, simulierte WebSockets und Binance-Gegenstelle.
// Prüft Takt, Erkennungszeit toter Verbindungen, hartes Schließen, sofortiges Neuverbinden, Standby-Erkennung und Backoff.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'weather-widget-v2.html'), 'utf8');
const a = html.indexOf('function liveFeed(port) {'), b = html.indexOf('\nconst live = { post:', a);
if (a < 0 || b < 0) throw new Error('liveFeed nicht gefunden');
const SRC = html.slice(a, b);

let pass = 0, fail = 0;
const check = (name, ok, info = '') => { if (ok) pass++; else fail++; console.log(`${ok ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

function world() {
  let now = 1_800_000_000_000, tid = 0;
  const timers = [], sockets = [], posted = [];
  const add = (f, ms, every) => { const id = ++tid; timers.push({ id, at: now + Math.max(0, ms || 0), f, every }); return id; };
  const clear = id => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); };
  function run(ms) {
    const end = now + ms;
    for (;;) {
      timers.sort((x, y) => x.at - y.at || x.id - y.id);
      const t = timers[0]; if (!t || t.at > end) break;
      now = t.at; if (t.every) t.at += t.every; else timers.shift();
      t.f();
    }
    now = end;
  }
  // Standby: die Uhr läuft weiter, Timer stehen still und feuern danach je einmal (keine Nachhol-Serie)
  function freeze(ms) { now += ms; for (const t of timers) if (t.at < now) t.at = now; }
  class FakeWS {
    constructor(url) { this.url = url; this.readyState = 0; this.sent = []; this.closed = null; this.mode = 'alive'; this.born = now; sockets.push(this); }
    send(d) {
      if (this.readyState !== 1) throw new Error('InvalidStateError');
      const m = JSON.parse(d); this.sent.push({ at: now, m });
      if (this.mode !== 'zombie') add(() => this.deliver({ result: m.method === 'LIST_SUBSCRIPTIONS' ? [] : null, id: m.id }), 40, 0);
    }
    close(code) { this.closed = { at: now, code }; this.readyState = 2; } // tote Leitung: kein onclose
    open() { this.readyState = 1; this.onopen?.(); }
    deliver(o) { if (this.readyState === 1 && this.onmessage) this.onmessage({ data: JSON.stringify(o) }); }
  }
  // Gegenstelle: jede Sekunde eine 1m-Kerze auf jedem offenen, lebenden Socket
  add(() => { for (const s of sockets) if (s.mode === 'alive' && s.readyState === 1) s.deliver({ stream: 'btcusdt@kline_1m', data: { e: 'kline', E: now, s: 'BTCUSDT', k: { t: now - (now % 60000), T: now - (now % 60000) + 59999, o: '1', h: '1', l: '1', c: '1', v: '1', i: '1m', x: false } } }); }, 1000, 1000);
  let handler = null;
  const ctx = vm.createContext({
    Date: { now: () => now }, Math: Object.create(Math, { random: { value: () => 0.5 } }), JSON, Set, Object, String, Number, Array, Error, Promise, URLSearchParams,
    setTimeout: (f, ms) => add(f, ms, 0), setInterval: (f, ms) => add(f, ms, ms), clearTimeout: clear, clearInterval: clear,
    WebSocket: FakeWS, fetch: () => Promise.reject(new Error('offline')), FormData: class {},
  });
  vm.runInContext(`${SRC}\nliveFeed(port);`, Object.assign(ctx, { port: { post: m => posted.push({ ...m, at: now }), on: f => { handler = f; } } }));
  const send = m => handler(m);
  return { get now() { return now; }, run, freeze, sockets, posted, send, last: () => sockets.at(-1), sts: () => posted.filter(p => p.t === 'st') };
}
const probes = s => s.sent.filter(x => x.m.method === 'LIST_SUBSCRIPTIONS');

// 1) Normalbetrieb: Daten jede Sekunde – keine Kontrollanfragen, kein Neuaufbau
{
  const w = world(); w.send({ t: 'want', m: 'spot', streams: ['ethusdt@kline_1m'] }); w.run(200);
  check('Start: ein Socket mit Lebenszeichen-Stream', w.sockets.length === 1 && /btcusdt@kline_1m/.test(w.last().url) && /ethusdt@kline_1m/.test(w.last().url), w.last()?.url);
  w.last().open(); w.run(60000);
  check('60 s Normalbetrieb: kein Neuaufbau', w.sockets.length === 1);
  check('… und keine Kontrollanfrage nötig (Daten kommen jede Sekunde)', probes(w.last()).length === 0, `${probes(w.last()).length} Anfragen`);
  const ticks = w.posted.filter(p => p.t === 'tick');
  check('Takt für die Oberfläche jede Sekunde', ticks.length >= 59 && ticks.length <= 61, `${ticks.length} Takte`);
}
// 2) Tote Verbindung (Standby/WLAN-Wechsel, halboffen): Kontrollanfrage, dann hart schließen und sofort neu verbinden
{
  const w = world(); w.send({ t: 'want', m: 'spot', streams: ['ethusdt@kline_1m'] }); w.run(200); w.last().open(); w.run(10000);
  const old = w.last(), t0 = w.now; old.mode = 'zombie';
  let tNew = null; for (let i = 0; i < 200 && w.sockets.length === 1; i++) w.run(100); tNew = w.now;
  const pr = probes(old), dt = tNew - t0;
  check('Tote Verbindung: Kontrollanfrage (LIST_SUBSCRIPTIONS) nach kurzer Funkstille', pr.length === 1 && pr[0].at - t0 >= 1500 && pr[0].at - t0 <= 4600, pr.map(p => p.at - t0 + ' ms').join());
  check('Erkannt und ersetzt nach 4,5–7,6 s (statt ~30 s Browser-Timeout)', w.sockets.length === 2 && dt >= 4500 && dt <= 7600, `${dt} ms`);
  check('Alter Socket hart geschlossen, ohne auf onclose zu warten', !!old.closed && old.closed.at === tNew && old.onmessage === null && old.onclose === null);
  const st = w.sts().filter(s => s.at >= t0).map(s => s.st + (s.detail ? ' (' + s.detail + ')' : ''));
  check('Status: getrennt mit Grund, sofort neu verbinden', /^retry \(keine Antwort seit \d s · verbinde sofort neu\)$/.test(st[0] || '') && st[1] === 'connecting', st.join(' → '));
  w.last().open(); w.run(30000);
  check('Neue Verbindung läuft stabil weiter', w.sockets.length === 2 && w.sts().at(-1).st === 'live');
  // Spätes onclose der alten Leitung stört die neue nicht
  old.onclose?.({ code: 1006 }); w.run(5000);
  check('Spätes Schließen der alten Leitung ändert nichts', w.sockets.length === 2 && w.sts().at(-1).st === 'live');
}
// 3) Leitung lebt, liefert aber keine Kursdaten: Kontrollanfragen werden beantwortet – erst nach 20 s ohne Daten neu
{
  const w = world(); w.send({ t: 'want', m: 'spot', streams: ['ethusdt@kline_1m'] }); w.run(200); w.last().open(); w.run(5000);
  const s = w.last(), t0 = w.now; s.mode = 'quiet';
  w.run(15000);
  check('Stille, aber Antworten kommen: kein vorschneller Neuaufbau', w.sockets.length === 1, `${probes(s).length} Anfragen in 15 s`);
  check('Höchstens eine Kontrollanfrage je 3 s', probes(s).length <= 5 && probes(s).every((p, i, arr) => i === 0 || p.at - arr[i - 1].at >= 3000));
  for (let i = 0; i < 100 && w.sockets.length === 1; i++) w.run(100);
  const dt = w.now - t0, why = w.sts().find(x => x.at >= t0 && x.st === 'retry')?.detail || '';
  check('Nach 20 s ohne Daten: neu verbunden', w.sockets.length === 2 && dt >= 20000 && dt <= 24000 && /keine Daten seit 20 s/.test(why), `${dt} ms · ${why}`);
}
// 4) Verbindungsaufbau hängt: nach 9 s (+ bis zu 3 s bis zur Prüfung) abbrechen und neu versuchen
{
  const w = world(); w.send({ t: 'want', m: 'spot', streams: ['ethusdt@kline_1m'] }); w.run(200);
  const t0 = w.last().born; for (let i = 0; i < 200 && w.sockets.length === 1; i++) w.run(100);
  const dt = w.now - t0;
  check('Hängender Aufbau: nach 9–12 s abgebrochen und neu versucht', w.sockets.length === 2 && dt > 9000 && dt <= 12100 && !!w.sockets[0].closed, `${dt} ms`);
  for (let i = 0; i < 300 && w.sockets.length === 2; i++) w.run(100);
  check('Zweiter Fehlschlag: Ersatzadresse', /stream\.binance\.com:9443/.test(w.last().url), w.last().url);
}
// 5) Standby erkannt: die Timer standen still – sofort neu verbinden, nicht erst nach der Kontrollanfrage
{
  const w = world(); w.send({ t: 'want', m: 'spot', streams: ['ethusdt@kline_1m'] }); w.run(200); w.last().open(); w.run(8000);
  w.last().mode = 'zombie'; w.freeze(120000); const t0 = w.now; w.run(1100);
  check('Nach 2 min Standby: neuer Socket binnen gut 1 s nach dem Aufwachen', w.sockets.length === 2 && !!w.sockets[0].closed && w.sockets[1].born - t0 <= 1100, `${w.sockets[1] ? w.sockets[1].born - t0 : '–'} ms`);
}
// 6) Aufwachen/online aus der Oberfläche ('wake'): tote Leitung sofort ersetzen, lebende in Ruhe lassen
{
  const w = world(); w.send({ t: 'want', m: 'spot', streams: ['ethusdt@kline_1m'] }); w.run(200); w.last().open(); w.run(8000);
  w.send({ t: 'wake' }); w.run(50);
  check('Wake bei lebender Verbindung: nichts passiert', w.sockets.length === 1);
  w.last().mode = 'zombie'; w.run(3400); const n = w.sockets.length; w.send({ t: 'wake' });
  check('Wake nach über 3 s Funkstille: sofort neuer Socket', n === 1 && w.sockets.length === 2 && w.sockets[1].born === w.now);
}
// 7) Gesperrtes Netz: sofortiger erster Versuch, danach wachsende Abstände (kein Dauerfeuer)
{
  const w = world(); w.send({ t: 'want', m: 'spot', streams: ['ethusdt@kline_1m'] }); w.run(200); w.last().open(); w.run(15000);
  const births = [], closes = [];
  for (let i = 0; i < 6; i++) { const s = w.last(); s.readyState = 3; closes.push(w.now); s.onclose?.({ code: 1006 }); w.run(0); for (let k = 0; k < 400 && w.last() === s; k++) w.run(100); births.push(w.last().born); }
  const gaps = births.map((x, i) => x - closes[i]);
  check('Abbruch einer laufenden Verbindung: erster neuer Versuch sofort', gaps[0] === 0, `${gaps[0]} ms`);
  check('Weitere Fehlschläge: Abstände wachsen (2 → 4 → 8 → 16 → 30 s)', gaps.slice(1).every((g, i, arr) => i === 0 || g > arr[i - 1]) && gaps[1] >= 1600 && gaps.at(-1) >= 24000, gaps.map(g => Math.round(g / 100) / 10 + ' s').join(', '));
}
// 8) Futures: Lebenszeichen im 1-s-Takt
{
  const w = world(); w.send({ t: 'want', m: 'futures', streams: ['ethusdt@kline_1m'] }); w.run(200);
  check('Futures-Lebenszeichen: btcusdt@markPrice@1s', /btcusdt@markPrice@1s/.test(w.last().url), w.last().url);
}
// 9) Speicher: 10.000 Ticks in 2 s werden alle 200 ms zu einem Paket (Tief/Hoch/Letzter) zusammengefasst, nichts bleibt liegen
{
  const w = world(); w.send({ t: 'want', m: 'spot', streams: ['ethusdt@aggTrade'] }); w.run(200); w.last().open(); w.run(1000);
  const t0 = w.now; let lo = Infinity, hi = 0, last = 0;
  for (let i = 0; i < 100; i++) { for (let k = 0; k < 100; k++) { const p = 2500 + Math.sin(i * 100 + k) * 5; lo = Math.min(lo, p); hi = Math.max(hi, p); last = p; w.last().deliver({ stream: 'ethusdt@aggTrade', data: { e: 'aggTrade', s: 'ETHUSDT', p: String(p), q: '1', T: w.now } }); } w.run(20); }
  w.run(400);
  const packs = w.posted.filter(p => p.t === 'a' && p.at >= t0);
  check('10.000 Ticks → höchstens ein Paket je 200 ms an die Oberfläche', packs.length >= 9 && packs.length <= 12, `${packs.length} Pakete`);
  check('Pakete tragen Tief, Hoch und letzten Kurs vollständig', Math.min(...packs.map(p => p.lo)) === lo && Math.max(...packs.map(p => p.hi)) === hi && packs.at(-1).last === last);
  w.run(2000);
  check('Danach keine Reste: ohne neue Ticks keine weiteren Pakete', w.posted.filter(p => p.t === 'a' && p.at > t0 + 2600).length === 0);
}
console.log(`${pass}/${pass + fail} bestanden`);
process.exit(fail ? 1 : 0);
