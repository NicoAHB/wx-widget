// Oracle-Musterdienst 1.2.0: Chartmuster als Trading-Karte (PNG) und monatliche Bereinigung gesendeter Nachrichten.
// 3.71.0 / Musterdienst 1.3.0: Signalkarte nach Vorlage – Gesamturteil (Schwellen einstellbar), Musterqualität (blau, keine
// Wahrscheinlichkeit, Erlernt ab 10 Fällen), Jetzt (gültig/verpasst/abgelaufen), Stop mit ATR-Hinweis, Mini-Chart, kompakter Fuß
// mit Datum, Kurztext in derselben Reihenfolge; PNG 1024 breit (resvg; ohne resvg werden nur die Renderprüfungen übersprungen).
// Versand: sendPhoto mit kurzer Bildunterschrift, Text als Ersatz, Rate-Limit, verlorene Antwort, kein Doppelversand, keine Geheimnisse.
// Bereinigung: Stichtag (Sommer-/Winterzeit), Auswahl am Monatswechsel, Probelauf ohne Inhalte, Wiederaufnahme, Sperren, systemd.
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
let pass = 0, fail = 0, skip = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${!ok && detail !== '' ? ' — ' + String(detail).slice(0, 400) : ''}`); };
(async () => {
  const P = await import('../server/pattern-card.mjs'), RT = await import('../server/pattern-retention.mjs');
  // ---- 3.71.0: Signalkarte nach Vorlage des Nutzers (DOT/USDT, symmetrisches Dreieck, 5m, 14.10.2026 20:55:09 Berlin) ----
  const EX = P.EXAMPLE_SIGNAL, at = EX.at, m = P.patternCardModel(EX, { at });
  const want = { pair: 'DOT/USDT', market: 'Spot', timeframe: '5 Min', timeframeUpper: '5 MIN', direction: 'AUFWÄRTS', pattern: 'Symmetrisches Dreieck', status: 'Ausbruch bestätigt', entry: '1,1370 USD', target: '1,1598 USD', targetPct: '+2,01 %', stop: '1,1294 USD', stopPct: '−0,67 %', rr: '2,99 : 1', quality: '88 %', learned: 'noch nicht bewertet (0/10 Fälle)', time: '14.10.2026 · 20:55:09', model: 'pat-1', score: '44/100' };
  const diff = Object.entries(want).filter(([k, v]) => m[k] !== v);
  check('Beispielwerte vollständig und unverändert (Paar, Markt, Zeitrahmen, Richtung, Muster, Status, Preise, %, Chance/Risiko, Musterqualität, Erlernt, Datum + Zeit, Modell, Score)', !diff.length, JSON.stringify(diff));
  check('1) Gesamturteil 44 → „Mittleres Signal“ (gelb) mit Trend ✖, Volumen ✖, Chance/Risiko ✔', m.grade?.label === 'Mittleres Signal' && m.grade.color === '#facc15' && m.trend === false && m.volume === false && m.rrOk === true);
  const G = (score, st) => P.patternCardModel({ ...EX, score }, { at, settings: st }).grade?.label;
  check('… Schwellen: 0–39 „Schwach“ (orange), 40–69 „Mittel“, 70–100 „Stark“ (grün)', G(0) === 'Schwaches Signal' && G(39) === 'Schwaches Signal' && G(40) === 'Mittleres Signal' && G(69) === 'Mittleres Signal' && G(70) === 'Starkes Signal' && G(100) === 'Starkes Signal' && P.patternCardModel({ ...EX, score: 12 }, { at }).grade.color === '#fb923c' && P.patternCardModel({ ...EX, score: 88 }, { at }).grade.color === '#4ade80');
  check('… Schwellen einstellbar (schwach unter 50, stark ab 80)', G(49, { weakBelow: 50, strongFrom: 80 }) === 'Schwaches Signal' && G(50, { weakBelow: 50, strongFrom: 80 }) === 'Mittleres Signal' && G(80, { weakBelow: 50, strongFrom: 80 }) === 'Starkes Signal' && G(60, { weakBelow: 60, strongFrom: 40 }) === 'Mittleres Signal');
  check('… ohne Score kein Banner (nichts erfunden)', P.patternCardModel({ ...EX, score: undefined }, { at }).grade === null);
  check('3) Jetzt: Kurs, Abstand zum Einstieg, „Einstieg gültig“, „bis 21:25 · noch 6 Kerzen“', m.now.state === 'valid' && m.now.price === '1,1381 USD' && m.now.dist === '+0,10 %' && m.now.label === 'Einstieg gültig' && m.now.detail === 'bis 21:25 · noch 6 Kerzen', JSON.stringify(m.now));
  const J = (o, opt = {}) => P.patternCardModel({ ...EX, ...o }, { at, ...opt }).now;
  check('… verpasst erst über 0,3 % hinter dem Einstieg (Long darüber, Short darunter), einstellbar', J({ price: 1.137 * 1.003 }).state === 'valid' && J({ price: 1.137 * 1.0031 }).state === 'missed' && J({ price: 1.137 * 1.0031 }).label === 'Einstieg verpasst' && J({ price: 1.137 * 0.99 }).state === 'valid' && J({ price: 1.137 * 0.996, direction: 'bear' }).state === 'missed' && J({ price: 1.137 * 1.01, direction: 'bear' }).state === 'valid' && J({ price: 1.137 * 1.0031 }, { settings: { missedPct: 0.5 } }).state === 'valid');
  check('… Gültigkeit läuft mit: nach 10 Min. „noch 4 Kerzen“, ab 21:25 „Einstieg abgelaufen“ (seit 21:25); 3 Kerzen einstellbar', J({}, { now: at + 600e3 }).detail === 'bis 21:25 · noch 4 Kerzen' && J({}, { now: EX.tc + 35 * 60e3 }).state === 'expired' && J({}, { now: EX.tc + 35 * 60e3 }).label === 'Einstieg abgelaufen' && J({}, { now: EX.tc + 35 * 60e3 }).detail === 'seit 21:25' && J({}, { settings: { validCandles: 3 } }).detail === 'bis 21:10 · noch 3 Kerzen');
  check('… ohne Kurs: Zeitfenster trotzdem, kein erfundener Abstand', J({ price: null }).state === 'valid' && J({ price: null }).price === null && J({ price: null }).dist === null);
  check('4) Stop statt „Ungültig bei“; Hinweis „Stop enger als normale Schwankung“ nur bei Abstand < ATR(14)', /^Stop enger als normale Schwankung \(ATR 14: 0,0090 USD\)$/.test(m.stopTight) && P.patternCardModel({ ...EX, atr: 0.007 }, { at }).stopTight === null && P.patternCardModel({ ...EX, atr: null }, { at }).stopTight === null, m.stopTight);
  const L = l => P.patternCardModel({ ...EX, ...l }, { at }).learned;
  check('2) Erlernt nur ab 10 Fällen mit Zahl, sonst „noch nicht bewertet (x/10 Fälle)“ ohne Warnung', L({ learned: { total: 14, up: 8, down: 4, flat: 2, minimum: 10, source: 'live protokolliert' } }) === '8/14 Fälle in Musterrichtung (live protokolliert)' && L({ direction: 'bear', learned: { total: 14, up: 8, down: 4, minimum: 10 } }) === '4/14 Fälle in Musterrichtung' && L({ learned: { total: 7, up: 5, down: 2 } }) === 'noch nicht bewertet (7/10 Fälle)' && L({ learned: { available: 3, minimum: 10 } }) === 'noch nicht bewertet (3/10 Fälle)');
  const S = P.patternCardSvg({ ...m, iv: EX.timeframe, tc: EX.tc, nowAt: at }), Sp = P.patternCardSvg({ ...m, iv: EX.timeframe, tc: EX.tc, nowAt: at }, { preview: true }), txt = s => [...s.svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(x => x[1].replace(/&lt;/g, '<').replace(/&amp;/g, '&'));
  const texts = txt(S), all = texts.join(' | ');
  check('Alle Werte stehen auf der Karte, in der Reihenfolge der Vorlage', ['CHARTMUSTER · SPOT · 5 MIN', 'AUFWÄRTS', 'DOT/USDT', 'Symmetrisches Dreieck', 'Mittleres Signal', '44/100', '2,99 : 1', 'ZIEL', 'STOP', 'EINSTIEG', '1,1370 USD', '1,1598 USD', '+2,01 %', '1,1294 USD', '−0,67 %', 'JETZT', '1,1381 USD', '+0,10 % zum Einstieg', 'Einstieg gültig', 'bis 21:25 · noch 6 Kerzen', 'MUSTERQUALITÄT', '88 %', 'Wie sauber das Muster ist, keine Erfolgswahrscheinlichkeit.', 'Erlernt: noch nicht bewertet (0/10 Fälle).', 'Kursrichtung ≠ Zieltreffer', '14.10.2026 · 20:55:09 · Modell pat-1'].every((s, i, a) => texts.includes(s) && (!i || texts.indexOf(s) >= texts.indexOf(a[i - 1]) || ['ZIEL', 'STOP', 'EINSTIEG', 'AUFWÄRTS'].includes(s) || ['ZIEL', 'STOP', 'EINSTIEG', 'AUFWÄRTS'].includes(a[i - 1]))), all);
  check('6) Kompakt: Chance/Risiko nur einmal, keine Regelgüte, kein „Ungültig bei“, kein „Zu wenig Daten“', texts.filter(s => s === '2,99 : 1').length === 1 && !/Regelgüte|REGELGÜTE|UNGÜLTIG|Ungültig bei|Zu wenig Daten|Chance \/ Risiko/.test(all) && texts.filter(s => /wahrscheinlich/i.test(s)).join() === 'Wie sauber das Muster ist, keine Erfolgswahrscheinlichkeit.');
  check('„BEISPIEL“ nur in der Vorschau', !texts.includes('BEISPIEL') && txt(Sp).includes('BEISPIEL'));
  check('Farben: Banner gelb (Mittel), Ziel-% grün, Stop-% rot, „Einstieg gültig“ grün, Musterqualität-Balken neutral blau (nicht grün)', /stroke="#facc15"/.test(S.svg) && /fill="#4ade80"[^>]*>\+2,01 %/.test(S.svg) && /fill="#f87171"[^>]*>−0,67 %/.test(S.svg) && /fill="#4ade80"[^>]*>Einstieg gültig/.test(S.svg) && /height="18" rx="9" fill="#7ea6f5"/.test(S.svg) && !/height="18" rx="9" fill="#4ade80"/.test(S.svg));
  const poly = /<polyline points="([^"]+)"/.exec(S.svg)?.[1].split(' ') || [];
  check('5) Mini-Chart: Kursverlauf, zwei Dreieck-Linien, Einstieg/Ziel/Stop-Linien, grüne und rote Zone, aktueller Kurs als Punkt', poly.length >= 40 && (S.svg.match(/stroke="#94a3b8" stroke-width="3"/g) || []).length === 2 && /fill="rgba\(74,222,128,0.13\)"/.test(S.svg) && /fill="rgba\(248,113,113,0.13\)"/.test(S.svg) && (S.svg.match(/stroke-dasharray="12 9"/g) || []).length === 2 && /stroke-dasharray="4 7"/.test(S.svg) && /<circle [^>]*r="10" fill="#4ade80"/.test(S.svg), JSON.stringify({ poly: poly.length }));
  check('… Hinweis „Stop enger als normale Schwankung“ gelb auf der Karte', /fill="#fbbf24"[^>]*>Stop enger als normale Schwankung/.test(S.svg));
  // Abwärts, lange Namen, Präzision
  const bearD = { ...EX, direction: 'bear', symbol: '1000SATSUSDT', market: 'Futures', timeframe: '4h', pattern: 'Aufsteigender Keil mit Ausbruch nach unten und Bestätigung durch Volumen', entry: 0.000248, target: 0.000231, invalid: 0.000262, price: 0.000247, atr: null, chart: null };
  const bear = P.patternCardModel(bearD, { at }), bs = P.patternCardSvg({ ...bear, iv: '4h', tc: EX.tc, nowAt: at }), lines = txt(bs).filter(s => /Keil|Ausbruch nach|Bestätigung|Volumen/.test(s) && s !== 'Ausbruch bestätigt' && s !== 'Volumen');
  check('Abwärts: „ABWÄRTS“ rot, Preise mit 8 Nachkommastellen unverändert, „4 STD“', bear.direction === 'ABWÄRTS' && /fill="#f87171"[^>]*>ABWÄRTS/.test(bs.svg) && bear.entry === '0,00024800 USD' && bear.target === '0,00023100 USD' && bear.targetPct === '−6,85 %' && bear.timeframeUpper === '4 STD' && txt(bs).includes('CHARTMUSTER · FUTURES · 4 STD'));
  check('Langer Mustername: höchstens 2 Zeilen, jede passt in die Breite; Status darunter; Karte wächst', lines.length === 2 && lines.every(l => P.textWidth(l, 40, 800) <= 944) && bs.height > S.height, JSON.stringify(lines));
  const long = P.wrapText('Aufsteigender Keil mit Ausbruch nach unten und Bestätigung durch Volumen', 76, 800, 928, 3, 54);
  check('… Umbruch rechnet mit den echten Zeichenbreiten', long.lines.every(l => P.textWidth(l, long.size, 800) <= 928));
  check('… Mini-Chart ohne Kerzen: „Kursverlauf nicht verfügbar“ statt erfundener Linie', txt(bs).includes('Kursverlauf nicht verfügbar') && !/<polyline/.test(bs.svg));
  // fehlende Werte
  const miss = P.patternCardModel({ symbol: 'ETHUSDT' }), ms = P.patternCardSvg({ ...miss, iv: null, tc: null, nowAt: null }), mt = txt(ms).join(' | ');
  check('Fehlende Werte: „Nicht verfügbar“, nichts erfunden (kein NaN/undefined/null, kein Prozent ohne Basis, kein Banner, keine Jetzt-Zeile)', ['market', 'timeframe', 'direction', 'pattern', 'status', 'entry', 'target', 'stop', 'quality', 'time', 'model'].every(k => miss[k] === P.NA) && miss.targetPct === null && miss.grade === null && miss.now.state === null && !/NaN|undefined|null|Infinity/.test(ms.svg) && !mt.includes('JETZT') && /Modell Nicht verfügbar/.test(mt), mt);
  check('Zeitrahmen ausgeschrieben (Dienst-Protokoll)', P.timeframeName('1m') === '1 Minute' && P.timeframeName('1h') === '1 Stunde' && P.timeframeName('1d') === '1 Tag' && P.timeframeName('1w') === '1 Woche' && P.timeframeName('1M') === '1 Monat' && P.timeframeName(null) === null);
  // 8) Kurztext in derselben Reihenfolge (Bildunterschrift und Ersatz)
  const cap = P.patternCaption(EX, { at }), order = ['<b>📐 DOT/USDT · Spot · 5 Min · 🟢⬆️ AUFWÄRTS</b>', '<b>Symmetrisches Dreieck</b> · ✅ Ausbruch bestätigt', '🟡 <b>Mittleres Signal 44/100</b> · Trend ✖ · Volumen ✖ · Chance/Risiko ✔ 2,99 : 1', '💰 Einstieg: <code>1,1370 USD</code>', '🎯 Ziel: <b>1,1598 USD</b> (+2,01 %)', '🛑 Stop: <code>1,1294 USD</code> (−0,67 %)', '⚠️ Stop enger als normale Schwankung', '⏱ Jetzt: 1,1381 USD (+0,10 % zum Einstieg) · ✅ Einstieg gültig bis 21:25 · noch 6 Kerzen', '🧠 Musterqualität: 88 % · keine Erfolgswahrscheinlichkeit', '📚 Erlernt: noch nicht bewertet (0/10 Fälle)', '<i>Kursrichtung ≠ Zieltreffer</i>', '🕐 14.10.2026 · 20:55:09 · Modell pat-1'];
  check('8) Kurztext (Bildunterschrift/Ersatz) in der Reihenfolge der Karte, ≤ 1024 Zeichen, Datum im Fuß', order.every((s, i) => cap.includes(s) && (!i || cap.indexOf(s) > cap.indexOf(order[i - 1]))) && cap.length <= 1024, cap);
  check('… Kurztext bleibt auch mit langen Werten unter 1024 Zeichen', P.patternCaption({ ...bearD, pattern: 'X'.repeat(2000) }, { at }).length <= 1024);
  // Mini-Chart-Daten: aus Kerzen und Musterlinien; fremde Daten (App → Dienst) geprüft
  const CD = P.patternChartData([{ t: 1, c: 2 }, { t: 2, c: 3 }, { t: 3, c: 4 }, { t: 4, c: 5 }], { t0: 3, lines: [[2, 4, 3, 5, 'res'], [9, 1, 10, 1]] }, { lead: 1 });
  check('Mini-Chart-Daten: Schlusskurse ab kurz vor dem Muster, Linien in Zeit/Preis (ungültige Indizes weg)', JSON.stringify(CD) === JSON.stringify({ k: [[2, 3], [3, 4], [4, 5]], lines: [[3, 4, 4, 5]] }), JSON.stringify(CD));
  const clean = P.cleanPatternChart({ k: [...Array.from({ length: 300 }, (_, i) => [i, 1 + i]), ['x', 1], [5, -1], [1, 2, 3]], lines: [[1, 2, 3, 4], [1, 'a', 3, 4], ...Array(10).fill([1, 1, 2, 2])] });
  check('… fremde Daten: nur Zahlen, höchstens 160 Punkte und 6 Linien; Unsinn → null', clean.k.length === 160 && clean.k.every(r => r.length === 2 && r.every(Number.isFinite)) && clean.lines.length === 6 && P.cleanPatternChart({ k: 'x' }) === null && P.cleanPatternChart(null) === null && P.cleanPatternChart({ k: [[1, 1]] }) === null);
  // ---- PNG (resvg) ----
  let Resvg = null; try { Resvg = require('../server/node_modules/@resvg/resvg-js').Resvg; } catch { /* nicht installiert */ }
  if (Resvg) {
    const r = await P.renderPatternCard(EX, { at }), png = r.png;
    check('PNG 1024 breit, Höhe passt zum Inhalt (Kopfdaten der Datei)', png.slice(1, 4).toString() === 'PNG' && png.readUInt32BE(16) === 1024 && png.readUInt32BE(20) === r.height && r.height > 1600 && png.length > 30000, JSON.stringify({ h: r.height }));
    const px = new Resvg(S.svg, { font: { loadSystemFonts: true, defaultFontFamily: 'Inter' } }).render(), pix = px.pixels, get = (x, y) => { const i = (y * px.width + x) * 4; return [pix[i], pix[i + 1], pix[i + 2]]; };
    const by = Number(/<rect x="72" y="([\d.]+)" width="[\d.]+" height="18" rx="9" fill="#7ea6f5"/.exec(S.svg)?.[1]) + 9, navy = get(8, 8), bar = get(300, Math.round(by)), track = get(940, Math.round(by));
    check('Dunkelblauer Hintergrund, Musterqualität-Balken bis 88 % blau, Rest dunkel', navy[2] > navy[0] && navy[2] < 70 && bar[2] > 220 && bar[0] < 150 && track[2] < 90, JSON.stringify({ navy, bar, track, by }));
    const tall = await P.renderPatternCard({ ...EX, pattern: 'Aufsteigender Keil mit Ausbruch nach unten und Bestätigung durch Volumen', learned: { total: 14, up: 8, down: 4, flat: 2, minimum: 10, source: 'live protokolliert', horizon: 12 } }, { at });
    check('Mehr Inhalt: Karte höher statt gedrängt', tall.png.readUInt32BE(16) === 1024 && tall.png.readUInt32BE(20) > r.height && tall.height === tall.png.readUInt32BE(20));
    fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true }); fs.writeFileSync(path.join(__dirname, 'out', 'trading-karte-beispiel.png'), (await P.renderPatternCard(EX, { at, preview: true })).png);
    // 1.2.1 (Oracle-Rückmeldung: Karte kam ganz ohne Text): Schrift liegt bei; ohne jede Schrift keine Karte, sondern Text
    const files = P.CARD_FONT_FILES, lic = fs.readFileSync(path.join(__dirname, '..', 'server', 'fonts', 'LIZENZ.md'), 'utf8');
    check('1.2.1: Schrift mitgeliefert – Inter in sechs Stärken und DejaVu Sans, verkleinert, mit Lizenztexten (OFL, Bitstream Vera)', files.length === 8 && files.every(f => fs.statSync(f).size > 20000 && fs.statSync(f).size < 120000) && /SIL Open Font License/.test(lic) && /Bitstream Vera/.test(lic) && /PERMISSION & CONDITIONS/.test(lic), JSON.stringify(files.map(f => path.basename(f))));
    // .pixels liefert bei jedem Zugriff eine neue Kopie – einmal auslesen
    const bare = new Resvg(S.svg, { font: { loadSystemFonts: false, fontFiles: [], defaultFontFamily: 'Inter' } }).render().pixels, own = new Resvg(S.svg, { font: { loadSystemFonts: false, fontFiles: [...files], defaultFontFamily: 'Inter' } }).render().pixels;
    let diffPx = 0; for (let i = 0; i < own.length; i += 4) if (Math.abs(own[i] - bare[i]) + Math.abs(own[i + 1] - bare[i + 1]) > 60) diffPx++;
    check('Nachgestellt: ohne Schrift zeichnet resvg keinen Text (wie auf dem Server); mit der mitgelieferten Schrift steht er da', diffPx > 20000 && own.length === bare.length, JSON.stringify({ diffPx }));
    check('Renderer-Status: mit mitgelieferter Schrift „ok“, ganz ohne Schrift „schrift“', await P.cardRendererStatus() === 'ok' && await P.cardRendererStatus({ bundledFonts: false, loadSystemFonts: false }) === 'schrift' && await P.cardRendererReady() === true);
    let thrown = ''; try { await P.renderPatternCard(EX, { at, bundledFonts: false, loadSystemFonts: false }); } catch (e) { thrown = e.message; }
    check('Ohne Schrift wird keine leere Karte erzeugt (Fehler → Dienst sendet Text)', /Keine Schrift für die Karte gefunden/.test(thrown), thrown);
    const onlyOwn = await P.renderPatternCard(EX, { at, loadSystemFonts: false });
    check('Nur mit der mitgelieferten Schrift (keine Systemschriften): vollständige Karte', onlyOwn.png.readUInt32BE(16) === 1024 && onlyOwn.png.readUInt32BE(20) === r.height && onlyOwn.png.length > 30000);
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
    const LENIENT = { preset: 'eigen', sendWeak: true, minScore: 0, minRR: 0.5, maxAge: 10, maxProgress: 100, minTargetAtr: 0, minFeeMultiple: 0, minVolume24h: 0, maxSpread: 5, cooldownMin: 0, oppositeMin: 0, maxPerHour: 60, counterTrend: true };
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
    check('3.71.0: … Bildunterschrift = Kurztext der Karte (Paar · Markt · Zeitrahmen · Richtung, Muster · Status, Gesamturteil, Stop, Datum)', /^<b>📐 BTC\/USDT · Spot · 1 Std · 🟢⬆️ AUFWÄRTS<\/b>\n<b>Doppel-Boden<\/b> · ✅ Ausbruch bestätigt\n(🟠|🟡|🟢)/u.test(a.photos[0]?.caption) && /Signal \d+\/100<\/b>/.test(a.photos[0]?.caption) && /🛑 Stop: <code>/.test(a.photos[0]?.caption) && /🕐 \d\d\.\d\d\.\d{4} · /.test(a.photos[0]?.caption) && a.photos[0].caption.length <= 1024, a.photos[0]?.caption);
    check('… erst nach Bestätigung „gesendet“: confirmed mit Zeit, Weg und Nachrichtennummer, Bild gespeichert', ea?.st === 'confirmed' && ea.sentAt === close + 2000 && ea.via === 'karte' && ea.msgId === 8 && fs.existsSync(pngFile), JSON.stringify({ ...ea, text: undefined, c: undefined, data: undefined }));
    const d = ea.data, cm = P.patternCardModel(d, {}), text = ea.text;
    check('Karte und Textmeldung aus denselben Signaldaten (Einstieg, Ziel, Stop, Musterqualität)', [cm.entry, cm.target, cm.stop, cm.quality].every(v => text.includes(v)) && text.includes('Doppel-Boden') && cm.pattern === 'Doppel-Boden', JSON.stringify({ cm: [cm.entry, cm.target, cm.stop] }));
    check('3.71.0: … Signaldaten tragen Mini-Chart (Kurse + Musterlinien), Trend/Volumen, Chance/Risiko, ATR, Kurs, Bestätigungskerze und Kartenwerte', d.chart?.k?.length >= 20 && d.chart.lines.length >= 1 && ['✔', '✖', '~', '?'].includes(d.marks?.trend) && d.rr > 0 && d.atr > 0 && d.price > 0 && d.tc === ea.c.tc && d.settings?.weakBelow === 40 && d.settings.validCandles === 6, JSON.stringify({ chart: d.chart && { k: d.chart.k.length, l: d.chart.lines.length }, marks: d.marks, rr: d.rr, atr: d.atr, s: d.settings }));
    await a.svc.scan(); const again2 = new M.PatternsOnlyService(a.opts); await again2.scan();
    check('Wiederholung und Neustart: kein zweites Bild', a.photos.length === 1);
    // 2. Bilderzeugung scheitert → Text
    const b = mk('ersatz', { renderCard: async () => { throw new Error('Schrift fehlt'); } }); b.set(close + 2000); await b.svc.scan();
    const eb = Object.values(b.svc.state.events)[0];
    check('Bilderzeugung scheitert → bisherige Textmeldung, als Text bestätigt', b.photos.length === 0 && b.texts.length === 1 && /Doppel-Boden/.test(b.texts[0]) && eb.st === 'confirmed' && eb.via === 'text' && b.logs.some(x => /Karte nicht erzeugt/.test(x)));
    if (await P.cardRendererReady()) {   // 1.2.1: Server ohne Schrift – echte Renderfunktion, keine leere Karte
      const nf = mk('ohne-schrift', { renderCard: (d, t) => P.renderPatternCard(d, { at: t, bundledFonts: false, loadSystemFonts: false }) }); nf.set(close + 2000); await nf.svc.scan();
      check('1.2.1: Musterdienst ohne jede Schrift → kein Bild, sondern Textmeldung mit Grund im Protokoll', nf.photos.length === 0 && nf.texts.length === 1 && nf.logs.some(x => /Karte nicht erzeugt – Text als Ersatz.*Keine Schrift/.test(x)), nf.logs.join(' | '));
    }
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
