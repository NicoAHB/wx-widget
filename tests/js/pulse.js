// ---------- BTC-Puls (3.24.0): Nachricht bei ungewöhnlich starker Bitcoin-Bewegung ----------
// Nur BTC: Bewegt sich Bitcoin stark, laufen die meisten Altcoins mit – eine Nachricht statt vieler. Auslöser: Die Bewegung der
// letzten 5 bzw. 15 Minuten (Spot, Kurs jetzt gegen den Schluss der 1m-Kerze vor 5 bzw. 15 Minuten) ist größer als 99 % der
// Bewegungen, die zu dieser Uhrzeit üblich sind, und mindestens 0,5 % bzw. 0,8 % (Mindestgröße). „Üblich“ kommt aus den
// 5m-Kerzen der letzten 35 Tage: je Stunde (UTC) und Tagesart (Mo–Fr, Sa–So), zusammen mit den beiden Nachbarstunden –
// wie die Statistik aus Schritt 4.3 –, einmal am Tag neu. Keine festen Prozente: die wären zur US-Eröffnung zu empfindlich
// und nachts zu träge. Höchstens eine Nachricht je Richtung in 30 Minuten, außer die Bewegung legt deutlich weiter zu
// (mindestens das 1,5-Fache der gemeldeten; auch dann höchstens eine weitere). Inhalt nur Fakten: Richtung, Größe, Fenster,
// Kurs, „ungewöhnlich stark für 14 Uhr“ mit der Schwelle und die Bewegung der Vorauswahl-Coins im selben Fenster – keine
// Prognose. Nachts (22–7 Uhr Ortszeit) kommt sie lautlos. Ziel: Telegram „Kursalarm“ (bzw. Discord). Mit dem 24/7-Dienst ab
// Version 1.1 übernimmt dieser die Meldung, auch bei geschlossener App: Die Schwellen reisen in der angehefteten Datei mit,
// und die App sendet dann nicht zusätzlich (s247Covers).
// var statt const/let: pulseKline und syncStreams können über Stream und Sekundentakt schon laufen, bevor dieser Abschnitt ausgewertet ist
var PULSE_WIN = [5, 15], PULSE_FLOOR = { 5: 0.5, 15: 0.8 }, PULSE_DAYS = 35, PULSE_EVERY = 24 * 3600e3, PULSE_RETRY = 15 * 60e3;
var PULSE_GAP = 30 * 60e3, PULSE_MORE = 1.5, PULSE_MIN_N = 90, PULSE_KEY = 'scalpdesk.pulse.v1', PULSE_DB = 'pulse|BTCUSDT';
var pulse = { rows: null, at: 0, busy: false, error: '', retryAt: 0, thr: null, m1: [], run: null, m1busy: false, m1at: 0, loaded: false };
// Nur mit Kanal (Telegram oder Discord) und eingeschalteter Meldung – sonst keine Abrufe
function pulseOn() { return !!chan?.ev?.pulse && ['tg', 'dc'].some(chanReady); }
function pulseWants() { return !!pulse && pulseOn(); }
// Stunde (UTC) und Tagesart eines Fensters, das zum Zeitpunkt t endet
function pulseSlot(t) { const d = new Date(t - 1), wd = d.getUTCDay(); return { h: d.getUTCHours(), we: wd === 0 || wd === 6 }; }
// Schwellen aus 5m-Schlusskursen [[Beginn, Schluss], …]: je Tagesart und Stunde der 99-%-Wert der Beträge der 5- und
// 15-Minuten-Bewegungen (in %), aus der Stunde und ihren beiden Nachbarn; zu wenige Fälle: beide Tagesarten zusammen, sonst null
function pulseStats(rows) {
  const b = { wd: [], we: [] }; for (const k of ['wd', 'we']) for (let h = 0; h < 24; h++) b[k].push({ 5: [], 15: [] });
  for (let i = 1; i < rows.length; i++) {
    const [t, c] = rows[i], end = t + 3e5, s = pulseSlot(end), x = b[s.we ? 'we' : 'wd'][s.h];
    if (t - rows[i - 1][0] === 3e5) x[5].push(Math.abs(c / rows[i - 1][1] - 1) * 100);
    if (i >= 3 && t - rows[i - 3][0] === 9e5) x[15].push(Math.abs(c / rows[i - 3][1] - 1) * 100);
  }
  const asc = (p, q) => p - q, pool = (k, h, w) => [-1, 0, 1].flatMap(d => b[k][(h + d + 24) % 24][w]);
  const out = { wd: [], we: [], n: rows.length, from: rows[0]?.[0] ?? null, to: rows.at(-1)?.[0] ?? null };
  for (const k of ['wd', 'we']) for (let h = 0; h < 24; h++) {
    out[k].push(PULSE_WIN.map(w => {
      let xs = pool(k, h, w); if (xs.length < PULSE_MIN_N) xs = [...pool('wd', h, w), ...pool('we', h, w)];
      return xs.length < PULSE_MIN_N ? null : +volaQ(xs.sort(asc), 0.99).toFixed(3);
    }));
  }
  return out;
}
// Schwelle für ein Fenster, das jetzt endet: 99-%-Wert der Uhrzeit, mindestens die Mindestgröße
function pulseLimit(thr, w, now) { const s = pulseSlot(now), v = thr?.[s.we ? 'we' : 'wd']?.[s.h]?.[PULSE_WIN.indexOf(w)]; return Math.max(v > 0 ? v : 0, PULSE_FLOOR[w]); }
// Bewegung über w Minuten aus 1m-Kerzen: Kurs jetzt gegen den Schluss der Kerze, die vor w Minuten lief; nur ohne Lücke
function pulseMove(closed, price, w) {
  const ref = closed.at(-w), last = closed.at(-1);
  if (!ref || !last || !(price > 0) || last.time - ref.time !== (w - 1) * 6e4) return null;
  return (price / ref.close - 1) * 100;
}
// Entscheidung (auch für die Tests): Welches Fenster ist am ungewöhnlichsten? Darf gemeldet werden (Sperre je Richtung)?
// last: { up|down: { t, mag, more } } – zuletzt gemeldete Bewegung je Richtung
function pulseDecide(moves, thr, now, last = {}) {
  let best = null;
  for (const w of PULSE_WIN) { const mv = moves[w]; if (mv == null) continue; const lim = pulseLimit(thr, w, now), r = Math.abs(mv) / lim; if (r >= 1 && (!best || r > best.r)) best = { w, mv, lim, r }; }
  if (!best) return null;
  const d = best.mv > 0 ? 'up' : 'down', l = last[d], mag = Math.abs(best.mv);
  if (l && now - l.t < PULSE_GAP) { if (l.more || mag < l.mag * PULSE_MORE) return null; return { ...best, d, mag, more: true }; }
  return { ...best, d, mag, more: false };
}
// Nachrichtentext: nur Fakten
function pulseText(p, price, hourLocal, others) {
  const pc = v => `${signed(v)} %`;
  return `⚡ BTC-Puls: BTC ${pc(p.mv)} in ${p.w} Min. (${priceText(price)} USDT)${p.more ? ' – Bewegung legt weiter zu' : ''} – ungewöhnlich stark für ${hourLocal} Uhr (Schwelle ${number(p.lim)} %)`
    + (others.length ? `\nVorauswahl im selben Zeitraum: ${others.map(([c, v]) => `${c} ${pc(v)}`).join(' · ')}` : '');
}
// ---- Daten ----
async function pulseDbGet() {
  const db = await kcOpen(); if (!db) return null;
  const v = await new Promise(res => { try { const q = db.transaction('series').objectStore('series').get(PULSE_DB); q.onsuccess = () => res(q.result); q.onerror = () => res(null); } catch { res(null); } });
  return v && Array.isArray(v.rows) && v.rows.every(r => Array.isArray(r) && r.length === 2 && r.every(Number.isFinite)) ? v : null;
}
async function pulseDbPut(v) { const db = await kcOpen(); if (!db) return; try { const tx = db.transaction('series', 'readwrite'); tx.objectStore('series').put(v, PULSE_DB); await new Promise(res => { tx.oncomplete = tx.onerror = tx.onabort = res; }); } catch { /* nur eine Beschleunigung */ } }
// 5m-Kerzen der letzten 35 Tage: beim ersten Mal rückwärts in Schritten zu 1000, danach nur Neues
async function pulseFetch() {
  pulse.busy = true;
  try {
    const now = Date.now(), from = now - PULSE_DAYS * 864e5, get = async p => { const r = await spotGet('/api/v3/klines', { symbol: 'BTCUSDT', interval: '5m', limit: 1000, ...p }); return Array.isArray(r) && r.length ? normalizeKlines(r) : []; };
    if (!pulse.loaded) { const v = await pulseDbGet(); pulse.loaded = true; if (v && !pulse.rows) { pulse.rows = v.rows; pulse.at = v.at || 0; } }
    const have = (pulse.rows || []).filter(r => r[0] >= from), lastT = have.at(-1)?.[0], add = [];
    if (lastT && now - lastT < 3 * 864e5) {
      let start = lastT + 3e5;
      for (let i = 0; i < 4 && start < now - 3e5; i++) { const a = await get({ startTime: start }); if (!a.length) break; add.push(...a); start = a.at(-1).time + 3e5; }
    } else {
      let end = now;
      for (let i = 0; i < 12; i++) { const a = await get({ endTime: end }); if (!a.length) break; add.unshift(...a); if (a[0].time <= from) break; end = a[0].time - 1; }
    }
    const seen = new Set(), rows = [...have, ...add.filter(c => c.closeTime < now && c.close > 0).map(c => [c.time, c.close])]
      .filter(r => r[0] >= from && !seen.has(r[0]) && seen.add(r[0])).sort((p, q) => p[0] - q[0]);
    if (rows.length < 1000) throw new Error('Zu wenige BTC-Kerzen für die Schwellen.');
    Object.assign(pulse, { rows, at: Date.now(), thr: pulseStats(rows), error: '', retryAt: 0 });
    void pulseDbPut({ at: pulse.at, rows });
    if (typeof scheduleS247 === 'function') scheduleS247(); // neue Schwellen an den 24/7-Dienst
  } catch (e) { pulse.error = e?.message || 'BTC-Kerzen nicht erreichbar.'; pulse.retryAt = Date.now() + PULSE_RETRY; }
  finally { pulse.busy = false; renderPulseInfo(); }
}
// Live: 1m-Kerzen von BTC (Spot) – Startwerte per REST, danach aus dem Stream
async function pulseLoadM1() {
  pulse.m1busy = true;
  try { const r = await spotGet('/api/v3/klines', { symbol: 'BTCUSDT', interval: '1m', limit: 20 }), cs = Array.isArray(r) ? normalizeKlines(r) : [], now = Date.now(); pulse.m1 = cs.filter(c => c.closeTime < now); pulse.run = cs.at(-1)?.closeTime >= now ? cs.at(-1) : null; pulse.m1at = now; }
  catch { pulse.m1at = Date.now() - 50e3; } // in 10 s erneut
  finally { pulse.m1busy = false; }
}
function pulseKline(m, now = Date.now()) {
  if (!pulse || m.i !== '1m' || m.s !== 'BTCUSDT' || m.m !== 'spot' || !pulse.m1at) return;
  const c = { time: m.k.t, open: m.k.o, high: m.k.h, low: m.k.l, close: m.k.c, closeTime: m.k.T }, last = pulse.m1.at(-1);
  if (last && c.time <= last.time) return;
  if (last && c.time > last.closeTime + 1) { pulse.m1 = []; pulse.m1at = 0; return; } // Lücke: neu laden
  if (m.k.x) { pulse.m1.push(c); if (pulse.m1.length > 30) pulse.m1.splice(0, pulse.m1.length - 30); pulse.run = null; } else pulse.run = c;
  pulseCheck(now);
}
// ---- Prüfen und melden ----
function pulseLast() { const v = store.get(PULSE_KEY, null) || {}, one = x => x && Number.isFinite(x.t) && x.mag > 0 ? { t: x.t, mag: x.mag, more: !!x.more } : null; return { up: one(v.up), down: one(v.down) }; }
function pulseCheck(now = Date.now()) {
  if (!pulseOn() || !pulse.thr) return;
  const price = pulse.run?.close ?? pulse.m1.at(-1)?.close, moves = Object.fromEntries(PULSE_WIN.map(w => [w, pulseMove(pulse.m1, price, w)]));
  const last = pulseLast(), p = pulseDecide(moves, pulse.thr, now, last); if (!p) return;
  store.set(PULSE_KEY, { ...last, [p.d]: { t: now, mag: p.more ? Math.max(p.mag, last[p.d]?.mag || 0) : p.mag, more: p.more } }); broadcastData([PULSE_KEY]);
  void pulseSend(p, price, now);
}
// Vorauswahl im selben Fenster – ohne BTC selbst, nur mit lückenlosen 1m-Kerzen. Seit 3.25.0 laufen die Kacheln im Intervall
// ihres Zeitraums (Standard 5m): Dann holt die App die wenigen 1m-Kerzen je Coin per REST – selten, höchstens ein Puls je
// Richtung und halbe Stunde – und wartet darauf höchstens 2,5 s; was bis dahin fehlt, bleibt in der Nachricht weg.
async function pulseOthers(w, now) {
  const one = async c => {
    const e = wl?.c.get(wlSym(c)); if (!e || e.error) return null;
    let closed = e.closed;
    if (e.iv !== '1m') { const q = { symbol: e.sym, interval: '1m', limit: w + 2 }; closed = normalizeKlines(await (e.market === 'futures' ? api.get(FUTURES, '/fapi/v1/klines', q) : spotGet('/api/v3/klines', q))).filter(k => k.closeTime < now); }
    const v = pulseMove(closed, wlPrice(e), w); return v == null ? null : [c, v];
  };
  const late = new Promise(r => setTimeout(() => r(null), 2500)); // gemeinsame Frist für alle Coins
  return (await Promise.all(state.watch.filter(c => c !== 'BTC').map(c => Promise.race([one(c).catch(() => null), late])))).filter(Boolean);
}
async function pulseSend(p, price, now) {
  const others = await pulseOthers(p.w, now);
  const hLocal = new Date(now).getHours(), text = pulseText(p, price, String(hLocal).padStart(2, '0'), others), silent = hLocal >= 22 || hLocal < 7;
  simpleToast('pulse:' + p.d, 'alarm ' + p.d, text.split('\n')[0], null, p.d === 'up' ? 'green' : 'orange');
  desktopNotify(`⚡ BTC ${signed(p.mv)} % in ${p.w} Min.`, text.replace(/\n/g, ' – '), 'pulse');
  // je Richtung höchstens eine Nachricht in 30 Minuten (auch über Tabs hinweg), dazu höchstens eine „legt weiter zu“
  void notifyChannels('pulse', `pulse:${p.d}${p.more ? ':more' : ''}`, text, PULSE_GAP, { silent });
}
// Sekundentakt: Schwellen einmal am Tag (bei Fehler nach 15 min erneut), 1m-Startwerte, Prüfen auch ohne neue Stream-Nachricht
function pulseTick(now) {
  if (!pulse || state.paused || !pulseOn()) return;
  if (!pulse.busy && (!pulse.thr || now - pulse.at > PULSE_EVERY) && now >= pulse.retryAt) void pulseFetch();
  if (!pulse.m1busy && !pulse.m1at) void pulseLoadM1();
  else if (!pulse.m1busy && now - pulse.m1at > 60e3 && !pulse.run && (!pulse.m1.length || now - pulse.m1.at(-1).closeTime > 150e3)) void pulseLoadM1();
}
// Für den 24/7-Dienst: Schwellen je Stunde (UTC) und Tagesart, Mindestgrößen, Vorauswahl
function pulseHandover() { return pulse?.thr ? { thr: { wd: pulse.thr.wd, we: pulse.thr.we }, floor: [PULSE_FLOOR[5], PULSE_FLOOR[15]], watch: state.watch.filter(c => c !== 'BTC').slice(0, 12) } : null; }
// Anzeige im Einrichtungsfenster (unter „BTC-Puls“)
function renderPulseInfo() {
  if (!$('pulse-info')) return;
  const now = Date.now(), t = pulse?.thr;
  put('pulse-info', !chan?.ev?.pulse ? 'aus' : !['tg', 'dc'].some(chanReady) ? 'wartet auf Telegram oder Discord' : t
    ? `jetzt (${String(new Date(now).getHours()).padStart(2, '0')} Uhr) ab ${number(pulseLimit(t, 5, now))} % in 5 Min. oder ${number(pulseLimit(t, 15, now))} % in 15 Min. · aus ${Math.round((t.to - t.from) / 864e5)} Tagen BTC-Kerzen`
    : pulse?.error ? `Schwellen noch nicht berechnet: ${pulse.error}` : 'Schwellen werden berechnet …');
}
