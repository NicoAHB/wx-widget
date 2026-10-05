// Schritt 4.3 – Volatilität und Richtung nach Uhrzeit ohne Browser (js/vola.js): Anteile (Quantile), Student-t-Schranke,
// Uhrzeit und Tagesart in Ortszeit, Statistik je Stunde (Median, 90/95/99 %, Richtung nur nach Gebühren gesichert),
// Spanne der letzten 60 Minuten, Warnstufen mit Rückschaltschwelle, Stream-Kerzen, Laden (erst alles, dann nur Neues),
// Zwischenspeicher (höchstens 8 Coins) und der Sekundentakt. Aufruf: node unit-vola.js
process.env.TZ = 'Europe/Berlin';
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(process.env.SRC || path.join(__dirname, 'js', 'vola.js'), 'utf8');
const html = fs.readFileSync(path.join(require('path').resolve(__dirname, '..'), 'weather-widget-v2.html'), 'utf8');
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${info ? ' — ' + info : ''}`); };
const normalizeKlines = new Function(`${html.match(/function normalizeKlines\(rows\) \{[\s\S]*?\n\}\n/)[0]}\nreturn normalizeKlines;`)();
const NUM = new Map(), number = (x, d = 2) => { if (x === null || !Number.isFinite(x)) return '—'; let f = NUM.get(d); if (!f) NUM.set(d, f = new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d })); return f.format(x); };
const ecTime = t => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
// Kleine IndexedDB-Attrappe: ein Objektspeicher „series“, Anfragen und Transaktionsende asynchron wie im Browser
function fakeDb() {
  const data = new Map(), db = { data, transaction() {
    let open = 0; const tx = { oncomplete: null, onerror: null, onabort: null };
    const done = () => { if (--open === 0) setTimeout(() => tx.oncomplete?.(), 0); };
    const req = fn => { open++; const r = { onsuccess: null, onerror: null, result: undefined }; setTimeout(() => { r.result = fn(); r.onsuccess?.(); done(); }, 0); return r; };
    tx.objectStore = () => ({ get: k => req(() => structuredClone(data.get(k))), put: (v, k) => { data.set(k, structuredClone(v)); return {}; }, delete: k => { data.delete(k); return {}; } });
    return tx;
  } };
  return db;
}
let db = null, calls = [], answer = null, m1Answer = null, calm = 0;
const state = { symbol: 'BTCUSDT', loadedSymbol: 'BTCUSDT', paused: false, risk: { feePct: 0.06 } };
let market = 'spot';
const api = { get: async (base, p, params) => { calls.push({ base, path: p, params }); return answer(params); } };
const spotGet = async (p, params) => { calls.push({ base: 'spot', path: p, params }); return answer(params); };
const cachedKlines = async (sym, iv, limit) => { calls.push({ m1: [sym, iv, limit] }); if (m1Answer instanceof Error) throw m1Answer; return m1Answer; };
const lbChip = { hidden: true }; let domOn = false; // volaUi() soll beim Laden des Abschnitts nichts finden (keine Seite)
const A = new Function('state', 'number', 'ecTime', 'coin', '$', 'el', 'document', 'store', 'calmDo', 'chartMarket', 'api', 'FUTURES', 'spotGet', 'normalizeKlines', 'cachedKlines', 'kcOpen',
  `${src}\nreturn { get vola() { return vola; }, volaRow, volaSlot, volaQ, volaT, volaStats, volaRange60, volaLevel, volaDirText, volaPct, volaDbGet, volaDbPut, volaFetch, volaLoadM1, volaKline, volaStatsNow, volaTick, VOLA_KEEP };`)(
  state, number, ecTime, s => s.slice(0, -4), id => (!domOn ? null : id === 'vola' ? {} : id === 'lb-vola' ? lbChip : null), () => ({}), { hidden: false },
  { get: () => null, set: () => true }, () => { calm++; }, () => market, api, 'https://fapi.binance.com', spotGet, normalizeKlines, cachedKlines, async () => db);
const V = A.vola; V.cfg = { warn: 95 }; domOn = true; // wie nach volaUi()
const H = 3600e3, tick = () => new Promise(r => setTimeout(r, 5));

// ---- Anteile und Student-t-Schranke ----
check('Anteil (linear): Median, 90 %, Rand, leer', A.volaQ([1, 2, 3, 4, 5], 0.5) === 3 && Math.abs(A.volaQ([1, 2, 3, 4, 5], 0.9) - 4.6) < 1e-12 && A.volaQ([1, 2, 3, 4, 5], 0) === 1 && A.volaQ([1, 2, 3, 4, 5], 1) === 5 && A.volaQ([], 0.5) === null);
const t19 = A.volaT(19), t58 = A.volaT(58), tInf = A.volaT(1e7);
check('t-Schranke (48 Tests, gemeinsam 95 %): 19 Freiheitsgrade ≈ 3,87, 58 ≈ 3,45, sehr viele ≈ 3,28', Math.abs(t19 - 3.866) < 0.02 && Math.abs(t58 - 3.453) < 0.01 && Math.abs(tInf - 3.279) < 0.001, `${t19.toFixed(3)} / ${t58.toFixed(3)} / ${tInf.toFixed(3)}`);

// ---- Uhrzeit und Tagesart in Ortszeit (Europe/Berlin) ----
const s1 = A.volaSlot(Date.UTC(2026, 8, 30, 13, 30)), s2 = A.volaSlot(Date.UTC(2026, 9, 3, 22, 30)), s3 = A.volaSlot(Date.UTC(2026, 9, 4, 22, 30)), s4 = A.volaSlot(Date.UTC(2026, 9, 26, 13, 30));
check('Ortszeit: Mi 13:30 UTC = 15 Uhr Werktag; Sa 22:30 UTC = So 0 Uhr Wochenende; So 22:30 UTC = Mo 0 Uhr Werktag; nach der Zeitumstellung 14 Uhr',
  s1.h === 15 && !s1.we && s2.h === 0 && s2.we && s3.h === 0 && !s3.we && s4.h === 14 && !s4.we, JSON.stringify([s1, s2, s3, s4]));
const row = A.volaRow({ time: 5, open: 100, high: 103, low: 99, close: 101.5 });
check('Stundenkerze → Spanne 4 % und Bewegung +1,5 %', row[0] === 5 && row[1] === 4 && row[2] === 1.5, JSON.stringify(row));

// ---- Statistik: Muster mit bekannter Antwort ----
let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const gauss = () => { let s = 0; for (let i = 0; i < 12; i++) s += rnd(); return s - 6; };
const T_END = Date.UTC(2026, 8, 30, 10, 0), rowsOf = (n, f) => Array.from({ length: n }, (_, i) => { const t = T_END - (n - i) * H, s = A.volaSlot(t); return [t, ...f(s, t)]; });
// Spanne: lebhaft um 17 Uhr (dreifach), sonst ruhig; Bewegung: um 10 Uhr +1 %, um 4 Uhr −1 %, sonst Zufall um 0
const rows = rowsOf(2000, s => [(s.h === 17 ? 3 : 1) * (0.5 + rnd()), (s.h === 10 ? 1 : s.h === 4 ? -1 : 0) + 0.3 * gauss()]);
const st = A.volaStats(rows, 0.06), wd = st.wd, we = st.we;
check('Statistik: 2.000 Stunden, rund 83 Tage, Werktage und Wochenende getrennt', st.n === 2000 && Math.round((st.to - st.from) / 864e5) === 83 && wd[12].n > 50 && we[12].n >= 20 && wd[12].n + we[12].n === rows.filter(r => A.volaSlot(r[0]).h === 12).length, `wd ${wd[12].n}, we ${we[12].n}`);
check('Median: lebhafte Stunde (17 Uhr) rund dreimal so hoch wie eine ruhige', wd[17].med / wd[3].med > 2.4 && wd[17].med / wd[3].med < 3.6 && we[17].med > 2 * we[3].med, `${wd[17].med.toFixed(2)} zu ${wd[3].med.toFixed(2)}`);
check('Schwellen aufsteigend (Median ≤ 90 % ≤ 95 % ≤ 99 %) in allen 48 Zellen', [...wd, ...we].every(b => b.med <= b.p90 * 1.3 && b.p90 <= b.p95 && b.p95 <= b.p99));
check('Schwellen aus der Stunde und ihren Nachbarn (gleiche Tagesart)', wd[5].np === wd[4].n + wd[5].n + wd[6].n && we[0].np === we[23].n + we[0].n + we[1].n);
const tends = k => st[k].map((b, h) => b.tend ? `${h}:${b.tend}` : null).filter(Boolean).join(' ');
check('Richtung: nur die echten Muster (10 Uhr ▲, 4 Uhr ▼) – Werktage und Wochenende', tends('wd') === '4:down 10:up' && tends('we') === '4:down 10:up', `Mo–Fr ${tends('wd')} · Sa–So ${tends('we')}`);
check('Richtung ▲: ganzer Vertrauensbereich über der doppelten Gebühr', wd[10].lo > 0.12 && wd[10].mean > 0.9, `Bereich ${wd[10].lo.toFixed(3)} … ${wd[10].hi.toFixed(3)}`);
// 1.000 Datensätze reiner Zufall (keine Tendenz), ohne Gebühren: gemeinsam 95 % für alle 48 Zellen → in rund 5 % der Datensätze
// irgendwo ein falsches ▲/▼ (ohne Korrektur wären es fast alle, nur über 24 Zellen korrigiert rund 10 %)
let falsePos = 0, cells = 0;
for (let k = 0; k < 1000; k++) { const r = rowsOf(2000, () => [1 + rnd(), 0.5 * gauss()]), s = A.volaStats(r, 0), n = [...s.wd, ...s.we].filter(b => b.tend).length; falsePos += n ? 1 : 0; cells += n; }
check('Reiner Zufall, sogar ohne Gebühren: höchstens rund 5 % der Datensätze mit irgendeinem ▲/▼ (Bonferroni, t)', falsePos <= 65, `${falsePos} von 1.000 Datensätzen (${(falsePos / 10).toFixed(1)} %), ${cells} von 48.000 Zellen`);
// Kleine, aber sehr regelmäßige Bewegung: statistisch sicher, aber kleiner als die Gebühren
const small = rowsOf(2000, s => [1, (s.h === 12 ? 0.1 : 0) + 0.01 * gauss()]);
check('+0,10 % je Stunde, sehr regelmäßig: bei 0,06 bzw. 0,05 % Gebühr je Seite keine Tendenz (0,12/0,10 % hin und zurück), bei 0,04 % und ohne Gebühr ▲',
  A.volaStats(small, 0.06).wd[12].tend === null && A.volaStats(small, 0.05).wd[12].tend === null && A.volaStats(small, 0.04).wd[12].tend === 'up' && A.volaStats(small, 0).wd[12].tend === 'up',
  `Bereich ${A.volaStats(small, 0).wd[12].lo.toFixed(4)} … ${A.volaStats(small, 0).wd[12].hi.toFixed(4)}`);
const few = rowsOf(300, s => [1, (s.h === 12 ? 2 : 0) + 0.01 * gauss()]), sf = A.volaStats(few, 0.06);
check('Unter 20 Stunden je Zelle: keine Richtung, auch bei großer Bewegung', sf.wd[12].n < 20 && sf.wd[12].tend === null && sf.wd[12].mean > 1.9, `n=${sf.wd[12].n}`);
check('Richtungstexte: gesichert mit Zahl, sonst ohne Zahl', /^▲ steigt im Schnitt um \d,\d\d % – auch nach Gebühren gesichert$/.test(A.volaDirText(wd[10])) && /^▼ fällt im Schnitt um/.test(A.volaDirText(wd[4]))
  && A.volaDirText(wd[12]) === 'keine nachweisbare Tendenz' && A.volaDirText(sf.wd[12]) === 'zu wenige Stunden für eine Aussage' && !/\d/.test(A.volaDirText(wd[12])), A.volaDirText(wd[10]));

// ---- Spanne der letzten 60 Minuten ----
const mkM1 = end => Array.from({ length: 75 }, (_, i) => { const t = Math.floor(end / 60e3) * 60e3 - (74 - i) * 60e3; return { time: t, open: 100, high: i === 70 ? 103 : 100.5, low: i === 5 ? 90 : 99.5, close: 100 }; });
const NOW = Date.UTC(2026, 8, 30, 12, 30, 20), m1 = mkM1(NOW);
check('60 Minuten: Hoch bis Tief der letzten 61 Kerzen zum Kurs am Anfang; ältere Ausreißer zählen nicht', Math.abs(A.volaRange60(m1, NOW) - 3.5) < 1e-9, String(A.volaRange60(m1, NOW)));
check('60 Minuten: unter 45 Minuten Daten keine Angabe', A.volaRange60(m1.slice(-44), NOW) === null && A.volaRange60(m1.slice(-46), NOW) !== null);

// ---- Warnstufen ----
const b = { np: 100, p90: 1, p95: 1.5, p99: 2 }, L = A.volaLevel;
check('Warnstufe (stärkste 5 %): 1,2 → 0, 1,6 → erhöht, 2,1 → stark erhöht', L(1.2, b, 95) === 0 && L(1.6, b, 95) === 1 && L(2.1, b, 95) === 2);
check('Rückschaltschwelle: an bleibt an bis unter 90 % der Schwelle (1,35), aus bleibt aus', L(1.4, b, 95, 1) === 1 && L(1.3, b, 95, 1) === 0 && L(1.4, b, 95, 0) === 0 && L(1.85, b, 99, 2) === 2 && L(1.75, b, 99, 2) === 0);
check('Keine Warnung: aus, keine aktuelle Spanne, zu wenige vergleichbare Stunden', L(5, b, 0) === 0 && L(null, b, 95) === 0 && L(5, { ...b, np: 29 }, 95) === 0 && L(5, null, 95) === 0);
check('Stärkste 10 % / 1 %: 1,1 → erhöht bzw. nichts; 2,0 bei 1 % → stark erhöht', L(1.1, b, 90) === 1 && L(1.1, b, 99) === 0 && L(2, b, 99) === 2);

// ---- Stream-Kerzen ----
V.m1 = m1.map(c => ({ ...c })); V.m1sym = 'BTCUSDT'; V.m1market = 'spot';
const last = V.m1.at(-1), k = (t, h, x = {}) => ({ t: 'k', i: '1m', s: 'BTCUSDT', m: 'spot', k: { t, o: 100, h, l: 99, c: 100 }, ...x });
A.volaKline(k(last.time, 104)); check('Stream: laufende Kerze wird ersetzt', V.m1.length === 75 && V.m1.at(-1).high === 104);
A.volaKline(k(last.time + 60e3, 101)); check('Stream: neue Minute wird angehängt', V.m1.length === 76 && V.m1.at(-1).time === last.time + 60e3);
A.volaKline(k(last.time + 120e3, 101, { s: 'ETHUSDT' })); A.volaKline(k(last.time + 120e3, 101, { m: 'futures' })); A.volaKline(k(last.time + 120e3, 101, { i: '5m' }));
check('Stream: anderer Coin, anderer Markt, anderes Intervall werden ignoriert', V.m1.length === 76);
for (let i = 2; i < 20; i++) A.volaKline(k(last.time + i * 60e3, 101));
check('Stream: höchstens 90 Kerzen', V.m1.length === 90 && V.m1.at(-1).time === last.time + 19 * 60e3);
A.volaKline(k(last.time + 25 * 60e3, 101)); check('Stream: Lücke → Reihe verworfen (wird neu geladen)', V.m1.length === 0 && V.m1sym === '');

// ---- Laden: erst alles (zwei Abrufe), dann nur Neues ----
const kl = (t, o = 100, c = 100.5) => [t, String(o), String(Math.max(o, c) + 1), String(Math.min(o, c) - 1), String(c), '1', t + H - 1];
const nowH = Math.floor(Date.now() / H) * H, series = n => Array.from({ length: n }, (_, i) => kl(nowH - (n - 1 - i) * H)); // letzte = laufende Stunde
const all = series(2100);
answer = p => { const xs = p.endTime ? all.filter(r => r[0] <= p.endTime) : p.startTime ? all.filter(r => r[0] >= p.startTime) : all; return p.startTime ? xs.slice(0, p.limit) : xs.slice(-p.limit); };
(async () => {
  db = fakeDb(); market = 'spot';
  Object.assign(V, { sym: 'BTCUSDT', rows: null, market: '', at: 0, error: '', retryAt: 0 });
  calls = []; await A.volaFetch('BTCUSDT', 'spot'); await tick();
  const saved = db.data.get('vola|BTCUSDT');
  check('Erstes Laden: zwei Abrufe, der zweite endet vor der ältesten Kerze des ersten', calls.length === 2 && !calls[0].params.endTime && calls[1].params.endTime === Number(all.at(-1000)[0]) - 1 && calls.every(c => c.params.interval === '1h' && c.params.limit === 1000 && c.base === 'spot'),
    JSON.stringify(calls.map(c => c.params)));
  check('Erstes Laden: 1.999 abgeschlossene Stunden (laufende weggelassen), aufsteigend, ohne Doppelte', V.rows.length === 1999 && V.rows.at(-1)[0] === nowH - H && V.rows.every((r, i) => !i || r[0] - V.rows[i - 1][0] === H) && V.market === 'spot' && !V.error && !V.busy);
  check('Zwischenspeicher: Markt, Zeitpunkt und Reihen gespeichert, Index geführt', saved?.m === 'spot' && saved.rows.length === 1999 && saved.at === V.at && db.data.get('vola|__index')?.BTCUSDT === V.at);
  // Nachladen: nur die neuen Stunden (hier: die laufende Stunde von vorhin ist inzwischen abgeschlossen)
  V.rows = V.rows.slice(0, -5); calls = []; await A.volaFetch('BTCUSDT', 'spot'); await tick();
  check('Nachladen: ein Abruf ab der Stunde nach der letzten gespeicherten', calls.length === 1 && calls[0].params.startTime === nowH - 5 * H && !calls[0].params.endTime, JSON.stringify(calls[0]?.params));
  check('Nachladen: fehlende Stunden ergänzt, höchstens 2.000', V.rows.length === 1999 && V.rows.at(-1)[0] === nowH - H);
  // Futures und Wechsel des Markts: alles neu
  calls = []; await A.volaFetch('BTCUSDT', 'futures'); await tick();
  check('Anderer Markt (Futures): alles neu über die Futures-Adresse', calls.length === 2 && calls.every(c => c.base === 'https://fapi.binance.com' && c.path === '/fapi/v1/klines') && V.market === 'futures' && db.data.get('vola|BTCUSDT').m === 'futures');
  // Neuer Coin mit wenig Geschichte: ein Abruf genügt
  const short = series(300); answer = p => short.slice(-p.limit); V.sym = 'NEWUSDT'; V.rows = null; V.market = ''; calls = [];
  await A.volaFetch('NEWUSDT', 'spot'); await tick();
  check('Coin mit 300 Stunden: ein Abruf, 299 Stunden', calls.length === 1 && V.rows.length === 299);
  // Fehler: Hinweis, erneuter Versuch in 5 Minuten, vorhandene Daten bleiben
  answer = () => { throw new Error('Binance nicht erreichbar'); }; const t0 = Date.now();
  await A.volaFetch('NEWUSDT', 'spot');
  check('Fehler: Hinweis, nächster Versuch in 5 Minuten, Daten bleiben', V.error === 'Binance nicht erreichbar' && V.retryAt >= t0 + 299e3 && V.retryAt <= Date.now() + 300e3 && V.rows.length === 299 && !V.busy);
  // Coin gewechselt, während geladen wird: das Ergebnis landet nur im Zwischenspeicher
  answer = p => short.slice(-p.limit); V.error = ''; const p = A.volaFetch('NEWUSDT', 'spot'); V.sym = 'XRPUSDT'; V.rows = null; await p; await tick();
  check('Coin während des Ladens gewechselt: Anzeige unberührt, Zwischenspeicher aktualisiert', V.rows === null && db.data.get('vola|NEWUSDT')?.rows.length === 299);
  // Zwischenspeicher: höchstens 8 Coins, die zuletzt geladenen bleiben
  db = fakeDb();
  for (let i = 0; i < 11; i++) { await A.volaDbPut(`C${i}USDT`, { m: 'spot', at: 1000 + i, rows: [[1, 2, 3]] }); }
  const keys = [...db.data.keys()].filter(x => x !== 'vola|__index').sort(), idx = db.data.get('vola|__index');
  check('Zwischenspeicher: höchstens 8 Coins, die 3 ältesten gelöscht', keys.length === A.VOLA_KEEP && !keys.includes('vola|C0USDT') && !keys.includes('vola|C2USDT') && keys.includes('vola|C10USDT') && Object.keys(idx).length === 8, keys.join(' '));
  db.data.set('vola|BADUSDT', { m: 'spot', at: 1, rows: [[1, NaN, 3]] }); db.data.set('vola|BAD2USDT', { m: 'x', at: 1, rows: [] });
  check('Zwischenspeicher lesen: gültig → Reihe, beschädigt oder fremd → nichts', (await A.volaDbGet('C10USDT'))?.rows.length === 1 && await A.volaDbGet('BADUSDT') === null && await A.volaDbGet('BAD2USDT') === null && await A.volaDbGet('NONEUSDT') === null);

  // ---- Statistik zwischengespeichert, neu bei neuer Gebühr ----
  V.sym = 'BTCUSDT'; V.rows = rows; V.at = 5; V.statsKey = '';
  const a1 = A.volaStatsNow(), a2 = A.volaStatsNow(); state.risk.feePct = 0.02; const a3 = A.volaStatsNow(); state.risk.feePct = 0.06;
  check('Statistik nur neu, wenn sich Daten oder Gebühr ändern', a1 === a2 && a3 !== a1 && a3.fee === 0.02 && a1.fee === 0.06);

  // ---- Sekundentakt ----
  db = fakeDb(); db.data.set('vola|ETHUSDT', { m: 'spot', at: Date.now() - 3600e3, rows: rows.slice(-1500) });
  state.symbol = 'ETHUSDT'; state.loadedSymbol = 'BTCUSDT'; calls = []; calm = 0;
  m1Answer = { candles: mkM1(Date.now()).map(c => ({ ...c, volume: 1, closeTime: c.time + 59999 })), source: 'spot' };
  A.volaTick(Date.now());
  check('Coinwechsel: Zustand zurückgesetzt, Zwischenspeicher wird gelesen', V.sym === 'ETHUSDT' && V.rows === null && !V.loaded && V.sel === null && V.level === 0);
  await tick(); await tick();
  check('Zwischenspeicher gelesen: Reihen da, Markt und Stand übernommen', V.loaded && V.rows.length === 1500 && V.market === 'spot' && V.at > 0);
  A.volaTick(Date.now()); await tick();
  check('Chart des neuen Coins noch nicht geladen: kein Abruf', calls.length === 0);
  state.loadedSymbol = 'ETHUSDT'; A.volaTick(Date.now()); await tick(); await tick();
  check('Zwischenspeicher jünger als 6 Stunden: keine Stundenkerzen, nur die 1m-Kerzen', calls.length === 1 && calls[0].m1?.join() === 'ETHUSDT,1m,75' && V.m1.length === 75 && V.m1sym === 'ETHUSDT' && V.m1market === 'spot');
  V.at = Date.now() - 7 * 3600e3; answer = p => all.slice(-p.limit); calls = []; A.volaTick(Date.now()); await tick(); await tick();
  check('Älter als 6 Stunden: Stundenkerzen nachladen', calls.some(c => c.params?.interval === '1h'));
  // 1m-Reihe steht (kein Stream): nach 3 Minuten neu laden
  V.m1 = V.m1.map(c => ({ ...c, time: c.time - 10 * 60e3 })); calls = []; A.volaTick(Date.now()); await tick(); await tick();
  check('1m-Reihe seit über 3 Minuten ohne neue Kerze: neu geladen', calls.some(c => c.m1));
  state.paused = true; calls = []; lbChip.hidden = false; calm = 0; V.at = 0; A.volaTick(Date.now()); await tick();
  check('Pause: kein Abruf, sichtbare Warnung wird ausgeblendet (Neuzeichnen)', calls.length === 0 && calm === 1);
  state.paused = false; lbChip.hidden = true;
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('✗ Abbruch — ' + e.stack); process.exit(1); });
