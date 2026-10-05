// Gelernte Muster der ZigZag-Prognose ohne Browser: Merkmale, Momente, Lernen ohne Doppelzählung, Gate, Fortsetzung,
// Zusammenführen beim Einspielen. Aufruf: node unit-zzp.js
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'weather-widget-v2.html'), 'utf8');
const grab = name => { const a = html.indexOf(`function ${name}(`); if (a < 0) throw new Error(name); let d = 0, b = a; for (; b < html.length; b++) { if (html[b] === '{') d++; else if (html[b] === '}' && --d === 0) break; } return html.slice(a, b + 1); };
const zzpLine = html.match(/var ZZP = \{[^}]*\}[^\n]*\n/)[0];
const make = (fee = 0.06) => new Function(`const mem = {}, sent = []; const store = { get: k => mem[k], set: (k, v) => { mem[k] = JSON.parse(JSON.stringify(v)); return true; } }; const ZZP_KEY = 'zzp';
const broadcastData = k => sent.push(...k); let tgb = null, zzpStartSet = null; const scheduleTgBackup = () => {}, renderZzpInfo = () => {}; const state = { symbol: 'BTCUSDT', interval: '1m', risk: { feePct: ${fee} } };
${zzpLine}${['zzStepper', 'zigzag', 'zzForecast', 'rsi', 'ema', 'macd', 'wilsonLow', 'zzpIndicators', 'zzpKey', 'zzMoments', 'zzpData', 'zzpApply', 'zzpVerdict', 'zzpSave', 'zzpBackup', 'zzpImport'].map(grab).join('\n')}
return { mem, sent, state, zigzag, zzForecast, zzMoments, zzpData, zzpApply, zzpVerdict, zzpBackup, zzpImport, wilsonLow, reset: () => { zzpMem = null; } };`)();
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${info ? ' — ' + info : ''}`); };
let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const K = []; let px = 100; for (let i = 0; i < 700; i++) { const o = px; px *= 1 + (rnd() - .5) * .01; K.push({ time: 1e12 + i * 60e3, open: o, high: Math.max(o, px) * (1 + rnd() * .002), low: Math.min(o, px) * (1 - rnd() * .002), close: px, volume: 1 }); }
// Momente
let A = make(); const ms = A.zzMoments(K.slice(0, 500), 0.5);
check('Momente ab Kerze 250, zeitlich aufsteigend, Muster im Format T±S±0R±0', ms.length > 50 && ms.every((m, i) => (!i || m.time > ms[i - 1].time) && /^T[+-]S[+0-]R[+0-]$/.test(m.key) && m.time >= K[250].time), `${ms.length} Momente, z. B. ${ms[0]?.key}`);
check('Ergebnis je Moment: getroffen, verfehlt, unentschieden oder noch offen – die letzten sind offen', ms.every(m => [true, false, null, undefined].includes(m.hit)) && ms.at(-1).hit === undefined && ms.filter(m => m.hit !== undefined).length > 20, `${ms.filter(m => m.hit === true).length} / ${ms.filter(m => m.hit === false).length} / ${ms.filter(m => m.hit === null).length} / ${ms.filter(m => m.hit === undefined).length}`);
// Kein Blick in die Zukunft: Momente bis t hängen nicht von späteren Kerzen ab (außer ihrem Ergebnis)
const ms2 = A.zzMoments(K.slice(0, 600), 0.5), same = ms.filter(m => m.hit !== undefined).every(m => { const q = ms2.find(x => x.time === m.time); return q && q.key === m.key && q.ext === m.ext && q.hit === m.hit; });
check('Mehr Kerzen ändern frühere Momente nicht (Muster, Extrempunkt, Ergebnis)', same);
// Lernen: jeder Moment genau einmal, eine Stichprobe je Muster und Extrempunkt
let P = A.zzpData(); A.zzpApply(P, ms, 'BTCUSDT|1m|0.5', '1m|0.5');
const n1 = Object.values(P.s).reduce((a, s) => a + s[0], 0), until1 = P.r['BTCUSDT|1m|0.5'][0];
A.zzpApply(P, ms, 'BTCUSDT|1m|0.5', '1m|0.5'); const n1b = Object.values(P.s).reduce((a, s) => a + s[0], 0);
check('Zweimal dieselben Kerzen lernen zählt nichts doppelt', n1 > 5 && n1b === n1, `${n1} → ${n1b}`);
const distinct = new Set(ms.filter(m => m.hit !== undefined && m.hit !== null && m.time <= until1).map(m => m.key + '|' + m.ext)).size;
check('Eine Stichprobe je Muster und Extrempunkt, gestoppt am ersten offenen Moment', n1 === distinct && until1 < ms.find(m => m.hit === undefined).time, `${n1} Stichproben, ${distinct} Paare`);
A.zzpApply(P, A.zzMoments(K.slice(100, 700), 0.5), 'BTCUSDT|1m|0.5', '1m|0.5'); const n2 = Object.values(P.s).reduce((a, s) => a + s[0], 0);
// Referenz: alles in einem Durchgang über 700 Kerzen (Fenster ab 0) – nahezu gleich viele Stichproben
const B2 = make(), P2 = B2.zzpData(); B2.zzpApply(P2, B2.zzMoments(K, 0.5), 'BTCUSDT|1m|0.5', '1m|0.5'); const nRef = Object.values(P2.s).reduce((a, s) => a + s[0], 0);
check('Späteres Fenster (neu geladener Chart) lernt nur die neuen Momente dazu', n2 > n1 && Math.abs(n2 - nRef) <= Math.max(3, nRef * .1), `${n1} → ${n2} (in einem Durchgang: ${nRef})`);
// Gate
const seedAll = (A, pref, n, h) => { const P = A.zzpData(); for (const T of '+-') for (const S of '+0-') for (const R of '+0-') P.s[`${pref}|T${T}S${S}R${R}`] = [n, h]; };
const C = K.slice(0, 500), live = { ...C.at(-1), time: C.at(-1).time + 60e3 }, cc = [...C, live], fc = A.zzForecast(A.zigzag(cc, 1), cc.length);
A = make(); A.state.interval = '1m'; seedAll(A, '1m|1', 300, 230);
let V = A.zzpVerdict(fc.up, 1, cc);
check('Starkes Muster (230 von 300 in Prognoserichtung): Zahl = untere 99-%-Grenze, Erwartung positiv', V?.ok && V.sign === 1 && Math.abs(V.p - A.wilsonLow(230, 300, 2.33)) < 1e-9 && V.p < A.wilsonLow(230, 300, 1.645) && V.ev > 0, V && JSON.stringify({ ok: V.ok, p: V.p.toFixed(3), be: V.be.toFixed(3), ev: V.ev.toFixed(3) }));
A = make(); seedAll(A, '1m|1', 300, 70); V = A.zzpVerdict(fc.up, 1, cc);
check('Umgekehrt (70 von 300): Fortsetzung statt Umkehr', V?.ok && V.sign === -1 && V.h === 230, V && `Richtung ${V.sign}`);
A = make(); seedAll(A, '1m|1', 90, 85); V = A.zzpVerdict(fc.up, 1, cc);
check('Unter 100 Fällen: keine Zahl, auch wenn es gut aussieht (85 von 90)', V && !V.ok && V.n === 90);
A = make(); seedAll(A, '1m|1', 300, 165); V = A.zzpVerdict(fc.up, 1, cc);
check('55 % bei Gewinnschwelle 56 % (1 %, 0,06 % je Seite): keine Zahl', V && !V.ok && Math.abs(V.be - .56) < 1e-9, V && `Schwelle ${V.be}`);
A = make(); seedAll(A, '1m|0.25', 300, 230); V = A.zzpVerdict(fc.up, 0.25, cc);
check('0,25 % Mindestbewegung: Schwelle 74 % – selbst 77 % Treffer reichen nicht', V && !V.ok && Math.abs(V.be - .74) < 1e-9);
A = make(0); seedAll(A, '1m|1', 300, 175); V = A.zzpVerdict(fc.up, 1, cc);
check('Ohne Gebühren (Schwelle 50 %): 58 % mit 300 Fällen reicht, angezeigte Zahl bleibt über 50 %', V?.ok && V.be === .5 && V.p > .5, V && V.p.toFixed(3));
A = make(); seedAll(A, '1h|1', 300, 230); V = A.zzpVerdict(fc.up, 1, cc);
check('Statistik eines anderen Intervalls zählt nicht', V && !V.ok && V.n === 0);
// Sicherung
A = make(); const L = A.zzpData(); L.s['1m|1|T+S0R0'] = [10, 6]; L.s['1m|1|T-S0R0'] = [30, 20]; L.r['BTCUSDT|1m|1'] = [500, 400, 'T+S0R0'];
A.zzpImport({ v: 1, s: { '1m|1|T+S0R0': [20, 9], '1m|1|T-S0R0': [15, 7], '1h|2|T+S+R+': [5, 3], 'bad1': [3, 5], 'bad2': [-1, 0], 'bad3': [2.5, 1] }, r: { 'BTCUSDT|1m|1': [300, 1, ''], 'ETHUSDT|1m|1': [900, 800, 'T-S0R0'] } });
const M = A.mem.zzp;
check('Einspielen: je Muster die Fassung mit mehr Fällen, Ungültiges verworfen', M && M.s['1m|1|T+S0R0'][0] === 20 && M.s['1m|1|T-S0R0'][0] === 30 && M.s['1h|2|T+S+R+'][0] === 5 && !M.s.bad1 && !M.s.bad2 && !M.s.bad3, JSON.stringify(M?.s));
check('Einspielen: je Reihe der spätere Lernstand, Tabs werden informiert', M.r['BTCUSDT|1m|1'][0] === 500 && M.r['ETHUSDT|1m|1'][0] === 900 && A.sent.includes('zzp'));
A.zzpImport(null); A.zzpImport({ v: 2, s: {}, r: {} }); A.zzpImport({ v: 1, s: 'x', r: {} });
check('Einspielen ohne oder mit fremden Mustern: nichts passiert, kein Fehler', A.mem.zzp.s['1m|1|T+S0R0'][0] === 20);
check('Sicherung enthält die Muster (ohne Startbestand: dasselbe Objekt wie gespeichert)', JSON.stringify(A.zzpBackup()) === JSON.stringify(A.mem.zzp));
console.log(`${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
