// Oracle-Musterdienst 1.2.0: Chartmuster als Trading-Karte (PNG) und monatliche Bereinigung gesendeter Nachrichten.
// Karte: Beispielwerte exakt, Abwärts, lange Namen, fehlende Werte, „BEISPIEL“ nur in Vorschauen, Regelgüte nie als
// Wahrscheinlichkeit, PNG 1024 × 1536 (resvg; ohne resvg werden nur die Renderprüfungen übersprungen).
// Versand: sendPhoto mit kurzer Bildunterschrift, Text als Ersatz, Rate-Limit, verlorene Antwort, kein Doppelversand, keine Geheimnisse.
// Bereinigung: Stichtag (Sommer-/Winterzeit), Auswahl am Monatswechsel, Probelauf ohne Inhalte, Wiederaufnahme, Sperren, systemd.
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
let pass = 0, fail = 0, skip = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${!ok && detail !== '' ? ' — ' + String(detail).slice(0, 400) : ''}`); };
(async () => {
  const P = await import('../server/pattern-card.mjs'), RT = await import('../server/pattern-retention.mjs');
  const at = Date.UTC(2026, 9, 13, 19, 5, 5); // 21:05:05 in Berlin (Sommerzeit)
  // ---- Karte: Beispielwerte aus der Vorgabe ----
  const m = P.patternCardModel(P.EXAMPLE_SIGNAL, { at });
  const want = { pair: 'LTC/USDT', market: 'Spot', timeframe: '5 Minuten', direction: 'AUFWÄRTS', pattern: 'Dreifach-Boden', status: 'Ausbruch bestätigt', entry: '62,0700 USD', target: '62,8767 USD', targetPct: '+1,30 %', invalid: '60,6700 USD', invalidPct: '−2,26 %', crv: '0,58 : 1', quality: '83 %', learned: '2/10 Fälle', time: '21:05:05', model: 'pat-1' };
  const diff = Object.entries(want).filter(([k, v]) => m[k] !== v);
  check('Beispielwerte vollständig und unverändert (Paar, Markt, Zeitrahmen, Richtung, Muster, Status, Preise, %, CRV, Regelgüte, Erlernt, Zeit, Modell)', !diff.length, JSON.stringify(diff));
  check('Warnungen: Chance < Risiko und „Zu wenig Daten“; Hinweise Kursrichtung ≠ Zieltreffer und keine Erfolgswahrscheinlichkeit', m.crvWarn && m.learnedWarn && m.hint === 'Kursrichtung ≠ Zieltreffer' && m.qualityNote === 'Keine Erfolgswahrscheinlichkeit');
  const S = P.patternCardSvg(m), Sp = P.patternCardSvg(m, { preview: true }), txt = s => [...s.svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(x => x[1].replace(/&lt;/g, '<').replace(/&amp;/g, '&'));
  const texts = txt(S), all = texts.join(' | ');
  check('Alle Beispielwerte stehen auf der Karte', ['LTC/USDT', 'Dreifach-Boden', 'Ausbruch bestätigt', '62,0700 USD', '62,8767 USD', '+1,30 %', '60,6700 USD', '−2,26 %', '0,58 : 1', '83 %', '2/10 Fälle', 'Zu wenig Daten', 'Kursrichtung ≠ Zieltreffer', 'Keine Erfolgswahrscheinlichkeit', 'AUFWÄRTS', 'EINSTIEG', 'ZIEL', 'UNGÜLTIG BEI', 'Chance / Risiko', 'REGELGÜTE', 'Erlernt'].every(s => texts.includes(s)) && texts.some(s => s.includes('Spot') && s.includes('5 Minuten')) && texts.some(s => s.includes('21:05:05') && s.includes('Modell pat-1')), all);
  check('„BEISPIEL“ nur in der Vorschau', !texts.includes('BEISPIEL') && txt(Sp).includes('BEISPIEL'));
  check('Regelgüte nie als Wahrscheinlichkeit: einziges „Wahrscheinlichkeit“ ist „Keine Erfolgswahrscheinlichkeit“', texts.filter(s => /wahrscheinlich/i.test(s)).join() === 'Keine Erfolgswahrscheinlichkeit' && !/Gewinn/i.test(all));
  check('Richtgröße 1024 × 1536', S.width === 1024 && S.height === 1536);
  check('Farben mit Beschriftung: Ziel grün, Ungültig rot, Warnung gelb, Aufwärts grün', /fill="#4ade80"[^>]*>\+1,30 %/.test(S.svg) && /fill="#f87171"[^>]*>−2,26 %/.test(S.svg) && /fill="#fbbf24"[^>]*>Zu wenig Daten/.test(S.svg) && /fill="#4ade80"[^>]*>AUFWÄRTS/.test(S.svg));
  check('Bildunterschrift: Paar, Zeitrahmen, Status', P.patternCaption(m) === '<b>LTC/USDT</b> · 5 Minuten · Ausbruch bestätigt');
  // ---- Abwärts, lange Namen, Präzision ----
  const bear = P.patternCardModel({ ...P.EXAMPLE_SIGNAL, direction: 'bear', symbol: '1000SATSUSDT', market: 'Futures', timeframe: '4h', pattern: 'Aufsteigender Keil mit Ausbruch nach unten und Bestätigung durch Volumen', entry: 0.000248, target: 0.000231, invalid: 0.000262 }, { at });
  const bs = P.patternCardSvg(bear), lines = txt(bs).filter(s => /Keil|Ausbruch nach|Bestätigung|Volumen/.test(s) && s !== 'Ausbruch bestätigt');
  check('Abwärts: „ABWÄRTS“ rot, Preise mit 8 Nachkommastellen unverändert', bear.direction === 'ABWÄRTS' && /fill="#f87171"[^>]*>ABWÄRTS/.test(bs.svg) && bear.entry === '0,00024800 USD' && bear.target === '0,00023100 USD' && bear.targetPct === '−6,85 %' && bear.timeframe === '4 Stunden');
  check('Langer Mustername: höchstens 3 Zeilen, jede passt in die Breite; Karte wächst statt zu überlappen', lines.length >= 2 && lines.length <= 3 && bs.height >= 1536, JSON.stringify(lines));
  const long = P.wrapText('Aufsteigender Keil mit Ausbruch nach unten und Bestätigung durch Volumen', 76, 800, 928, 3, 54);
  check('… Umbruch rechnet mit den echten Zeichenbreiten', long.lines.every(l => P.textWidth(l, long.size, 800) <= 928));
  // ---- fehlende Werte ----
  const miss = P.patternCardModel({ symbol: 'ETHUSDT' }), ms = P.patternCardSvg(miss), mt = txt(ms).join(' | ');
  check('Fehlende Werte: „Nicht verfügbar“, nichts erfunden (kein NaN/undefined/null, kein Prozent ohne Basis)', ['market', 'timeframe', 'direction', 'pattern', 'status', 'entry', 'target', 'invalid', 'crv', 'quality', 'learned', 'time', 'model'].every(k => miss[k] === P.NA) && miss.targetPct === null && !/NaN|undefined|null|Infinity/.test(ms.svg) && /Modell: Nicht verfügbar/.test(mt), mt);
  check('Lernstand ab 10 Fällen: Treffer/Fälle mit Datenbasis, ohne Warnung', (() => { const x = P.patternCardModel({ ...P.EXAMPLE_SIGNAL, learned: { total: 14, up: 8, down: 4, flat: 2, minimum: 10, source: 'live protokolliert', horizon: 12 } }); return x.learned === '8/14 Fälle' && !x.learnedWarn && x.learnedSub.join('|') === 'Datenbasis: live protokolliert · nach 12 Kerzen|Aufwärts 8 · Abwärts 4 · Seitwärts 2'; })());
  check('Zeitrahmen ausgeschrieben', P.timeframeName('1m') === '1 Minute' && P.timeframeName('1h') === '1 Stunde' && P.timeframeName('1d') === '1 Tag' && P.timeframeName('1w') === '1 Woche' && P.timeframeName('1M') === '1 Monat' && P.timeframeName(null) === null);
  // ---- PNG (resvg) ----
  let Resvg = null; try { Resvg = require('../server/node_modules/@resvg/resvg-js').Resvg; } catch { /* nicht installiert */ }
  if (Resvg) {
    const r = await P.renderPatternCard(P.EXAMPLE_SIGNAL, { at }), png = r.png;
    check('PNG 1024 × 1536 (Kopfdaten der Datei)', png.slice(1, 4).toString() === 'PNG' && png.readUInt32BE(16) === 1024 && png.readUInt32BE(20) === 1536 && png.length > 30000);
    const px = new Resvg(S.svg, { font: { loadSystemFonts: true, defaultFontFamily: 'Inter' } }).render(), get = (x, y) => { const i = (y * px.width + x) * 4; return [px.pixels[i], px.pixels[i + 1], px.pixels[i + 2]]; };
    const navy = get(8, 8), bar = get(500, 1081), track = get(900, 1081);
    check('Dunkelblauer Hintergrund, Regelgüte-Balken bis 83 % grün, Rest dunkel', navy[2] > navy[0] && navy[2] < 70 && bar[1] > 180 && bar[0] < 120 && track[1] < 80, JSON.stringify({ navy, bar, track }));
    const tall = await P.renderPatternCard({ ...P.EXAMPLE_SIGNAL, pattern: 'Aufsteigender Keil mit Ausbruch nach unten und Bestätigung durch Volumen', score: 78, scoreWhy: 'Trend ✔ · Volumen ✔ · R/R 2,6', learned: { total: 14, up: 8, down: 4, flat: 2, minimum: 10, source: 'live protokolliert', horizon: 12 } }, { at });
    check('Mehr Inhalt: Karte höher statt gedrängt', tall.png.readUInt32BE(16) === 1024 && tall.png.readUInt32BE(20) > 1536 && tall.height === tall.png.readUInt32BE(20));
    fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true }); fs.writeFileSync(path.join(__dirname, 'out', 'trading-karte-beispiel.png'), (await P.renderPatternCard(P.EXAMPLE_SIGNAL, { at, preview: true })).png);
  } else { skip++; console.log('– PNG-Prüfungen übersprungen (resvg fehlt: im Ordner server „npm install“)'); }

  // ---- Bereinigung: Stichtag ----
  const nov = RT.monthStart(Date.UTC(2026, 10, 1, 2, 0)), apr = RT.monthStart('2027-04'), edge = RT.monthStart(Date.UTC(2026, 9, 31, 23, 30));
  check('Stichtag Winterzeit: 01.11.2026 00:00 Berlin = 31.10. 23:00 UTC', nov.at === Date.UTC(2026, 9, 31, 23) && nov.label === '01.11.2026, 00:00 Uhr (Europe/Berlin)');
  check('Stichtag Sommerzeit: 01.04.2027 00:00 Berlin = 31.03. 22:00 UTC', apr.at === Date.UTC(2027, 2, 31, 22));
  check('Kurz nach Mitternacht (00:30 Berlin, noch 31.10. UTC): schon der neue Monat', edge.at === nov.at);
  check('Verspäteter Lauf (z. B. am 3.) behält denselben Stichtag', RT.monthStart(Date.UTC(2026, 10, 3, 9)).at === nov.at);
  let bad = false; try { RT.monthStart('2026-13'); } catch { bad = true; } check('Ungültiger Stichtag abgelehnt', bad);

  // ---- Bereinigung: Testdaten am Monatswechsel ----
  const cut = nov.at, D = 864e5, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bereinigung-')), cards = path.join(dir, 'karten'), stateFile = path.join(dir, 'state.json'), logFile = path.join(dir, 'service.log');
  fs.mkdirSync(cards);
  const ev = (st, extra = {}) => ({ st, retryAt: 0, c: { id: 'x', sym: 'LTCUSDT', at: cut - 3 * D }, text: 'GEHEIMER-NACHRICHTENTEXT', data: { pattern: 'Dreifach-Boden' }, ...extra });
  const img = n => n.repeat(32).slice(0, 32) + '.png';
  const state = { v: 1, since: 1, sig: 's', cases: { k1: { id: 'k1' } }, signals: [{ id: 's1' }], sent: [{ at: cut - 3600e3, id: 'A' }, { at: cut + 3600e3, id: 'B' }], events: {
    A: ev('confirmed', { sentAt: cut - 1000, img: img('a') }),     // 31.10. 23:59:59 Berlin → löschen
    B: ev('confirmed', { sentAt: cut + 1000, img: img('b') }),     // 01.11. 00:00:01 → bleibt
    C: ev('queued'), Dd: ev('sending'), E: ev('unconfirmed', { c: { at: cut - 40 * D } }), F: ev('failed', { c: { at: cut - 40 * D } }), G: ev('expired', { c: { at: cut - 40 * D } }),
    H: ev('confirmed', { c: { at: cut - 10 * D } }),                // alt ohne sentAt, sicher vor dem Stichtag → löschen
    I: ev('confirmed', { c: { at: cut - 2 * D } }),                 // alt ohne sentAt, zu nah am Stichtag → bleibt
  } };
  fs.writeFileSync(stateFile, JSON.stringify(state));
  for (const n of ['a', 'b', 'c', 'd']) fs.writeFileSync(path.join(cards, img(n)), 'PNG');
  const old = new Date(cut - 5 * D); fs.utimesSync(path.join(cards, img('c')), old, old); const fresh = new Date(cut + D); fs.utimesSync(path.join(cards, img('d')), fresh, fresh); fs.utimesSync(path.join(cards, img('a')), old, old);
  const iso = t => new Date(t).toISOString();
  fs.writeFileSync(logFile, [`${iso(cut - 2000)} Chartmuster zugestellt: LTCUSDT · 5m`, `${iso(cut - 1500)} Chartmuster gesendet: LTCUSDT · 5m · Dreifach-Boden · Long · Score 80`, `${iso(cut - 1200)} Chartmuster gefiltert: BTCUSDT · 1h – Grund`, `${iso(cut + 2000)} Chartmuster zugestellt: ETHUSDT · 1h`, 'Chartmuster zugestellt: ALT · 1h', `${iso(cut - 9000)} Kerzen/Journal prüfen: BTCUSDT · 1h`].join('\n'));
  fs.writeFileSync(logFile + '.1', `${iso(cut - 4000)} Chartmuster zugestellt: XRPUSDT · 4h\n${iso(cut - 3900)} Dienst gestartet`); // rotierte Kopien
  fs.writeFileSync(logFile + '.2.gz', require('zlib').gzipSync(`${iso(cut - 8 * D)} Chartmuster gesendet: SOLUSDT · 1h · Keil · Short · Score 75\n${iso(cut - 8 * D)} Kerzen/Journal prüfen`));
  const before = fs.readFileSync(stateFile, 'utf8');
  const dry = await RT.purgeSentMessages({ stateFile, cardDir: cards, logFile, cutoff: cut, dryRun: true }), rep = RT.purgeReport(dry, nov.label).join('\n');
  check('Probelauf: 2 Nachrichten, 1 Kartenbild, 1 verwaistes Bild, 1 Anti-Spam-Eintrag, 4 Protokollzeilen (auch rotiert/komprimiert) – nichts verändert', dry.messages === 2 && dry.images === 1 && dry.orphans === 1 && dry.sentMeta === 1 && dry.logLines === 4 && fs.readFileSync(stateFile, 'utf8') === before && fs.existsSync(path.join(cards, img('a'))), JSON.stringify(dry));
  check('Probelauf zeigt Anzahl und Umfang, aber keine Inhalte', /Probelauf – nichts gelöscht/.test(rep) && /2 gesendete Nachrichten \(Text \d+ Byte/.test(rep) && !/GEHEIMER|LTCUSDT|Dreifach|ETHUSDT/.test(rep) && /1 wartend\/Wiederholung, 1 gerade im Versand, 1 unbestätigt, 1 abgelehnt, 1 abgelaufen, 2 aus dem laufenden Monat/.test(rep), rep);
  // Sperren
  fs.writeFileSync(path.join(dir, 'dienst.pid'), String(process.pid)); let refused = '';
  try { await RT.purgeSentMessages({ stateFile, cardDir: cards, logFile, cutoff: cut }); } catch (e) { refused = e.message; }
  check('Läuft der Dienst, wird nichts gelöscht', /Chartmusterdienst läuft/.test(refused) && fs.readFileSync(stateFile, 'utf8') === before, refused);
  fs.rmSync(path.join(dir, 'dienst.pid')); fs.writeFileSync(path.join(dir, 'bereinigung.lock'), String(process.pid)); refused = '';
  try { await RT.purgeSentMessages({ stateFile, cardDir: cards, logFile, cutoff: cut }); } catch (e) { refused = e.message; }
  check('Kein zweiter Lauf parallel (Sperre)', /läuft bereits/.test(refused) && fs.readFileSync(stateFile, 'utf8') === before);
  fs.writeFileSync(path.join(dir, 'bereinigung.lock'), '999999'); // verwaiste Sperre eines abgestürzten Laufs
  fs.writeFileSync(stateFile + '.tmp', 'alte Zwischenkopie');
  const run = await RT.purgeSentMessages({ stateFile, cardDir: cards, logFile, cutoff: cut, now: () => cut + 3 * 3600e3 }), after = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  check('Echter Lauf: genau A und H gelöscht; B, wartende, sendende, unbestätigte, abgelehnte, abgelaufene und I bleiben', !after.events.A && !after.events.H && ['B', 'C', 'Dd', 'E', 'F', 'G', 'I'].every(k => after.events[k]), Object.keys(after.events).join());
  check('Lernbestand, Signal-Journal und Einstellungen unverändert; Anti-Spam nur ab Stichtag', JSON.stringify(after.cases) === JSON.stringify(state.cases) && JSON.stringify(after.signals) === JSON.stringify(state.signals) && after.since === 1 && after.sig === 's' && after.sent.length === 1 && after.sent[0].id === 'B');
  check('Kartenbild von A und verwaistes altes Bild gelöscht; Bild von B und neues verwaistes bleiben', !fs.existsSync(path.join(cards, img('a'))) && !fs.existsSync(path.join(cards, img('c'))) && fs.existsSync(path.join(cards, img('b'))) && fs.existsSync(path.join(cards, img('d'))));
  const logAfter = fs.readFileSync(logFile, 'utf8');
  check('Protokoll: nur Nachrichtenzeilen vor dem Stichtag entfernt (gefiltert, technische, neue und alte ohne Zeit bleiben)', !/LTCUSDT/.test(logAfter) && /gefiltert: BTCUSDT/.test(logAfter) && /ETHUSDT/.test(logAfter) && /^Chartmuster zugestellt: ALT/m.test(logAfter) && /Kerzen\/Journal prüfen/.test(logAfter), logAfter);
  const rot1 = fs.readFileSync(logFile + '.1', 'utf8'), rot2 = require('zlib').gunzipSync(fs.readFileSync(logFile + '.2.gz')).toString();
  check('Rotierte Protokolle (auch .gz) ebenso bereinigt, technische Zeilen bleiben', !/XRPUSDT/.test(rot1) && /Dienst gestartet/.test(rot1) && !/SOLUSDT/.test(rot2) && /Kerzen\/Journal/.test(rot2), rot1 + ' / ' + rot2);
  check('Alte Zwischendatei weg, Sperre frei, keine Löschliste, Ergebnis vermerkt (ohne Inhalte)', !fs.existsSync(stateFile + '.tmp') && !fs.existsSync(path.join(dir, 'bereinigung.lock')) && !fs.existsSync(path.join(dir, 'bereinigung-offen.json')) && after.lastPurge.messages === 2 && !JSON.stringify(after.lastPurge).includes('GEHEIM'));
  const again = await RT.purgeSentMessages({ stateFile, cardDir: cards, logFile, cutoff: cut });
  check('Zweiter Lauf im selben Monat: nichts mehr zu löschen', again.messages === 0 && again.images === 0 && again.logLines === 0);
  // Wiederaufnahme nach teilweise fehlgeschlagener Dateilöschung
  const s2 = JSON.parse(fs.readFileSync(stateFile, 'utf8')); s2.events.J = ev('confirmed', { sentAt: cut - 5000, img: img('e') }); fs.writeFileSync(stateFile, JSON.stringify(s2)); fs.writeFileSync(path.join(cards, img('e')), 'PNG');
  const part = await RT.purgeSentMessages({ stateFile, cardDir: cards, logFile, cutoff: cut, unlink: f => { const e = new Error('EBUSY'); e.code = 'EBUSY'; if (f.endsWith(img('e'))) throw e; fs.unlinkSync(f); } });
  const man = JSON.parse(fs.readFileSync(path.join(dir, 'bereinigung-offen.json'), 'utf8'));
  check('Datei nicht löschbar: Nachricht trotzdem aus dem Zustand, Datei bleibt in der Löschliste (nur Dateiname)', part.failed.length === 1 && !JSON.parse(fs.readFileSync(stateFile, 'utf8')).events.J && man.files.join() === img('e') && RT.purgeReport(part, nov.label)[0].startsWith('Bereinigung teilweise'));
  const resume = await RT.purgeSentMessages({ stateFile, cardDir: cards, logFile, cutoff: cut });
  check('Nächster Lauf setzt fort: Datei gelöscht, Löschliste weg', resume.resumed?.files === 1 && !fs.existsSync(path.join(cards, img('e'))) && !fs.existsSync(path.join(dir, 'bereinigung-offen.json')));
  fs.writeFileSync(path.join(dir, 'kaputt.json'), '{"v":1,"events":[]}'); refused = '';
  try { await RT.purgeSentMessages({ stateFile: path.join(dir, 'kaputt.json'), cutoff: cut }); } catch (e) { refused = e.message; }
  check('Beschädigter Zustand: nichts gelöscht', /beschädigt/.test(refused));
  fs.rmSync(dir, { recursive: true, force: true });
  // ---- systemd ----
  const unit = fs.readFileSync(path.join(__dirname, '../server/scalpdesk-patterns-bereinigung.service'), 'utf8'), timer = fs.readFileSync(path.join(__dirname, '../server/scalpdesk-patterns-bereinigung.timer'), 'utf8');
  check('Timer: 1. des Monats 03:00 Europe/Berlin, nachholen nach Ausfall', /^OnCalendar=\*-\*-01 03:00:00 Europe\/Berlin$/m.test(timer) && /^Persistent=true$/m.test(timer) && /^WantedBy=timers\.target$/m.test(timer));
  check('Einheit: einmalig, eigener Benutzer, Dienst anhalten und nur bei Bedarf wieder starten, Schreibrechte nur Zustand/Protokoll', /^Type=oneshot$/m.test(unit) && /^User=scalpdesk-patterns$/m.test(unit) && /--bereinigen$/m.test(unit) && /ExecStartPre=\+.*systemctl stop scalpdesk-patterns/.test(unit) && /ExecStopPost=\+.*neustart.*systemctl start scalpdesk-patterns/.test(unit) && /^ReadWritePaths=\/var\/lib\/scalpdesk-patterns \/var\/log\/scalpdesk-patterns$/m.test(unit));

  // ---- Versand über den Chartmusterdienst ----
  const M = await import('../server/patterns-247.mjs'), PM = await import('../server/pattern-monitor.mjs'), E = await import('../server/pattern-engine.mjs');
  if (typeof PM.patternMessageData !== 'function') { check('patternMessageData vorhanden', false); }
  else {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'karten-')), destination = { token: '123456789:LOCAL_ONLY_no_real_token_000000', chat: 'LOCAL_CHAT', thread: '' };
    const LENIENT = { preset: 'eigen', minScore: 0, minRR: 0.5, maxAge: 10, maxProgress: 100, minTargetAtr: 0, minFeeMultiple: 0, minVolume24h: 0, maxSpread: 5, cooldownMin: 0, oppositeMin: 0, maxPerHour: 60, counterTrend: true };
    const watch = { kind: 'scalpdesk-patterns-watch', v: 1, model: 'pat-1', gap: false, items: [{ sym: 'BTCUSDT', mkt: 'spot', iv: '1h' }], filter: LENIENT };
    const src = fs.readFileSync(path.join(__dirname, 'm58.js'), 'utf8'), build = vm.runInNewContext(src.slice(src.indexOf('const BUILD = () => {'), src.indexOf('\nconst tests = {')) + '\nBUILD()');
    let k = build.path(build.F.double_bottom).map((c, i) => ({ ...c, v: 200 - i }));
    const hit = E.patEngine().detect(k, { from: 0, step: build.STEP }).hits.find(h => h.id === 'double_bottom' && /^Ausbruch/.test(h.status)); k = k.slice(0, hit.i1 + 1);
    const close = PM.patternEnd(k.at(-1).t, '1h'), rows = k.map(c => [c.t, c.o, c.h, c.l, c.c, c.v, PM.patternEnd(c.t, '1h') - 1]);
    const mk = (name, over = {}) => { let now = close - 1; const photos = [], texts = [], logs = []; const opts = { destination, watch, stateFile: path.join(work, name + '.json'), now: () => now, fetchRows: async () => rows, fetchSpread: async () => null, send: async t => { texts.push(t); return { message_id: 7 }; }, sendPhoto: async (png, caption) => { photos.push({ png, caption }); return { message_id: 8 }; }, log: x => logs.push(x), ...over }; return { svc: new M.PatternsOnlyService(opts), opts, photos, texts, logs, tick: ms => { now += ms; }, set: t => { now = t; } }; };
    // 1. Karte gesendet
    const a = mk('karte'); a.set(close + 2000); await a.svc.scan();
    const ea = Object.values(a.svc.state.events)[0], pngFile = ea && path.join(work, 'karten', ea.img || '-');
    check('Signal → genau eine Karte per sendPhoto, kein Text', a.photos.length === 1 && a.texts.length === 0 && a.photos[0].png.slice(1, 4).toString() === 'PNG', JSON.stringify({ p: a.photos.length, t: a.texts.length }));
    check('… Bildunterschrift: Paar, Zeitrahmen, Status', a.photos[0]?.caption === '<b>BTC/USDT</b> · 1 Stunde · Ausbruch bestätigt', a.photos[0]?.caption);
    check('… erst nach Bestätigung „gesendet“: confirmed mit Zeit, Weg und Nachrichtennummer, Bild gespeichert', ea?.st === 'confirmed' && ea.sentAt === close + 2000 && ea.via === 'karte' && ea.msgId === 8 && fs.existsSync(pngFile), JSON.stringify({ ...ea, text: undefined, c: undefined, data: undefined }));
    const d = ea.data, cm = P.patternCardModel(d, {}), text = ea.text;
    check('Karte und Textmeldung aus denselben Signaldaten (Einstieg, Ziel, Ungültig, Regelgüte)', [cm.entry, cm.target, cm.invalid].every(v => text.includes(v.replace(' USD', ''))) && text.includes('Doppel-Boden') && cm.pattern === 'Doppel-Boden', JSON.stringify({ cm: [cm.entry, cm.target, cm.invalid] }));
    await a.svc.scan(); const again2 = new M.PatternsOnlyService(a.opts); await again2.scan();
    check('Wiederholung und Neustart: kein zweites Bild', a.photos.length === 1);
    // 2. Bilderzeugung scheitert → Text
    const b = mk('ersatz', { renderCard: async () => { throw new Error('Schrift fehlt'); } }); b.set(close + 2000); await b.svc.scan();
    const eb = Object.values(b.svc.state.events)[0];
    check('Bilderzeugung scheitert → bisherige Textmeldung, als Text bestätigt', b.photos.length === 0 && b.texts.length === 1 && /Doppel-Boden/.test(b.texts[0]) && eb.st === 'confirmed' && eb.via === 'text' && b.logs.some(x => /Karte nicht erzeugt/.test(x)));
    // 3. Telegram lehnt das Bild ab (400) → Text
    const c = mk('abgelehnt', { sendPhoto: async () => { throw Object.assign(new Error('Telegram lehnt Bild ab'), { status: 400, description: 'Bad Request: IMAGE_PROCESS_FAILED' }); } }); c.set(close + 2000); await c.svc.scan();
    check('Bild abgelehnt (400) → Text als Ersatz', c.texts.length === 1 && Object.values(c.svc.state.events)[0].via === 'text');
    // 4. Chat falsch (400 chat not found) → kein Text-Ersatz, fehlgeschlagen
    const c2 = mk('chat', { sendPhoto: async () => { throw Object.assign(new Error('x'), { status: 400, description: 'Bad Request: chat not found' }); } }); c2.set(close + 2000); await c2.svc.scan();
    check('Chat nicht gefunden → fehlgeschlagen, kein zweiter Versuch über Text', c2.texts.length === 0 && Object.values(c2.svc.state.events)[0].st === 'failed');
    // 5. Rate-Limit → wartet, dasselbe Bild beim nächsten Versuch
    let n429 = 0; const r = mk('ratelimit'); r.svc.sendPhoto = async (png, caption) => { if (!n429++) throw Object.assign(new Error('Too Many Requests'), { status: 429, retry: 30 }); r.photos.push({ png, caption }); return { message_id: 9 }; };
    r.set(close + 2000); await r.svc.scan(); const er = Object.values(r.svc.state.events)[0], img1 = er.img;
    check('429: wartet mit Retry-After, nicht als gesendet markiert', er.st === 'queued' && er.retryAt === close + 2000 + 30000 && !er.sentAt);
    r.tick(31000); await r.svc.deliver();
    check('… später zugestellt, mit demselben gespeicherten Bild', er.st === 'confirmed' && er.img === img1 && r.photos.length === 1 && n429 === 2);
    // 6. verlorene Antwort → unbestätigt, nie doppelt
    const l = mk('verloren', { sendPhoto: async () => { throw Object.assign(new Error('Telegram-Verbindung unterbrochen'), { lost: true }); } }); l.set(close + 2000); await l.svc.scan();
    check('Antwort verloren → „unbestätigt“, kein Text hinterher', Object.values(l.svc.state.events)[0].st === 'unconfirmed' && l.texts.length === 0);
    const allLogs = [a, b, c, c2, r, l].flatMap(x => x.logs).join('\n');
    check('Keine Zugangsdaten in Protokoll oder Zustand', !allLogs.includes(destination.token) && !allLogs.includes(destination.chat) && !fs.readdirSync(work).filter(f => f.endsWith('.json')).some(f => fs.readFileSync(path.join(work, f), 'utf8').includes(destination.token)));
    // 7. echte Telegram-Anfrage (Attrappe von fetch): multipart sendPhoto an den eingestellten Chat
    const realFetch = globalThis.fetch; let req = null;
    globalThis.fetch = async (url, init) => { req = { url: String(url), body: init.body }; return new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), { status: 200 }); };
    try {
      const t = mk('fetch', { sendPhoto: undefined }); const res = await t.svc.telegramPhoto(Buffer.from('\x89PNG test'), '<b>BTC/USDT</b> · 1 Stunde · Ausbruch bestätigt');
      check('sendPhoto: multipart mit chat_id, Bild, HTML-Bildunterschrift; Token nur in der Adresse', res.message_id === 42 && /\/sendPhoto$/.test(req.url) && req.body.get('chat_id') === 'LOCAL_CHAT' && req.body.get('parse_mode') === 'HTML' && req.body.get('caption').startsWith('<b>BTC/USDT</b>') && req.body.get('photo')?.type === 'image/png');
    } finally { globalThis.fetch = realFetch; }
    fs.rmSync(work, { recursive: true, force: true });
  }
  console.log(`\n${pass}/${pass + fail} bestanden${skip ? ` (${skip} Block übersprungen)` : ''}`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('✗ Abbruch', e); process.exitCode = 1; });
