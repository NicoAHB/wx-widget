// 3.71.0 / Dienst 2.15.0 – Kurs-Alarm als Bild (shared/price-alarm-card.mjs, Rendern im Dienst über server/pattern-card.mjs).
// Beispiele nach Vorlage des Nutzers (BTC aufwärts und abwärts): Kopf „KURS-ALARM · AUFWÄRTS/ABWÄRTS“ mit Uhrzeit, Symbol, Kurs groß in
// der Alarmfarbe, Leiste mit LEVEL-Marke und Kurspunkt (aufwärts rechts, abwärts links), Zeilen Level/Abstand/Auslösung, „<0,01 %“,
// Fuß mit Datum und Botname, keine Emojis, einzeilige Bildunterschrift, fehlende Werte, PNG 1080 breit (ohne resvg nur Renderprüfungen übersprungen).
// Aufruf: node unit-price-alarm-card.js
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${!ok && detail !== '' ? ' — ' + String(detail).slice(0, 500) : ''}`); };
(async () => {
  const C = await import('../shared/price-alarm-card.mjs'), P = await import('../server/pattern-card.mjs');
  const texts = svg => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(x => x[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<'));
  const at = Date.UTC(2026, 9, 14, 19, 19, 16);
  // aufwärts (Vorlage)
  const u = C.priceAlarmCard(P.EXAMPLE_ALARM), tu = texts(u.svg);
  check('Aufwärts: Label, Uhrzeit mit Sekunden, Symbol, Kurs, USD, LEVEL-Marke, Zeilen, Fuß mit Datum und Botname', ['KURS-ALARM · AUFWÄRTS', '21:19:16', 'BTC', '81.840,13', 'USD', 'LEVEL', 'ABSTAND', 'AUSLÖSUNG', '81.840,00 USD', 'auf/über', '+0,13 USD (<0,01 %)', 'erreicht', '14.10.2026 · Mein Kurs Alarm'].every(s => tu.includes(s)), tu.join(' | '));
  check('… Farben: Label grün auf dunkelgrünem Grund, Kurs und Abstand grün; Hintergrund #0E1A2E, Karten #131F36', /fill="#16351f"/.test(u.svg) && /fill="#4ADE80"[^>]*>KURS-ALARM · AUFWÄRTS/.test(u.svg) && /fill="#4ADE80"[^>]*>81\.840,13/.test(u.svg) && /fill="#4ADE80"[^>]*>\+0,13 USD/.test(u.svg) && /<rect width="1080" height="\d+" fill="#0E1A2E"/.test(u.svg) && /fill="#131F36"/.test(u.svg));
  const dot = svg => { const lv = /<line x1="([\d.]+)" y1="[\d.]+" x2="\1" y2="[\d.]+" stroke="#f4f7fb" stroke-width="5"/.exec(svg), c = /<circle cx="([\d.]+)" cy="[\d.]+" r="17"/.exec(svg); return lv && c ? Number(c[1]) - Number(lv[1]) : null; };
  check('… Kurspunkt rechts der LEVEL-Marke', dot(u.svg) > 0, dot(u.svg));
  check('… Bildunterschrift eine Zeile: „Kurs-Alarm · BTC · 81.840,13 USD“', u.caption === 'Kurs-Alarm · BTC · 81.840,13 USD', u.caption);
  check('… keine Emojis im Bild, 1080 breit, mindestens 1080 hoch', !/\p{Extended_Pictographic}/u.test(tu.join('')) && u.width === 1080 && u.height >= 1080);
  // abwärts
  const d = C.priceAlarmCard({ symbol: 'BTCUSDT', direction: 'below', level: 81500, price: 81462.5, reached: 'erreicht', at, bot: 'Mein Kurs Alarm' }), td = texts(d.svg);
  check('Abwärts: „KURS-ALARM · ABWÄRTS“ rot auf dunkelrotem Grund, Kurs rot, „auf/unter“, Abstand „−37,50 USD (−0,05 %)“', /fill="#3a1c25"/.test(d.svg) && /fill="#F87171"[^>]*>KURS-ALARM · ABWÄRTS/.test(d.svg) && /fill="#F87171"[^>]*>81\.462,50/.test(d.svg) && td.includes('auf/unter') && td.includes('−37,50 USD (−0,05 %)') && d.caption === 'Kurs-Alarm · BTC · 81.462,50 USD', td.join(' | '));
  check('… Kurspunkt links der LEVEL-Marke', dot(d.svg) < 0, dot(d.svg));
  // größerer Abstand → Punkt weiter weg (gedeckelt)
  const far = C.priceAlarmCard({ symbol: 'ETHUSDT', direction: 'above', level: 2000, price: 2100, at });
  check('Großer Abstand (+5 %): Punkt weiter außen als bei <0,01 %, „+100,00 USD (+5,00 %)“', dot(far.svg) > dot(u.svg) && texts(far.svg).includes('+100,00 USD (+5,00 %)'), `${dot(far.svg)} / ${dot(u.svg)}`);
  // kleine Kurse: Stellen wie im Text
  const small = C.priceAlarmModel({ symbol: 'XRPUSDT', direction: 'above', level: 1.3269, price: 1.3301 });
  check('Kleiner Kurs (XRP): Stellen wie bisher („1,3301“, Level „1,3269 USD“, „+0,0032 USD (+0,24 %)“)', small.priceText === '1,3301' && small.levelText === '1,3269 USD' && small.distText === '+0,0032 USD (+0,24 %)', JSON.stringify(small));
  // Notiz und lange Auslösung
  const long = C.priceAlarmCard({ symbol: 'BTCUSDT', direction: 'above', level: 81840, price: 81845, reached: 'kurz per Docht erreicht (bis 81.912,40 USD), Kurs wieder darunter', note: 'Ausbruch über das Wochenhoch – Teilgewinn mitnehmen und Stop nachziehen', at }), tl = texts(long.svg);
  check('Notiz nur, wenn eingetragen; lange Auslösung und Notiz passen in die Breite (kleiner oder zwei Zeilen)', tl.includes('NOTIZ') && !tu.includes('NOTIZ') && tl.some(t => /^kurz per Docht/.test(t)) && !/NaN|undefined/.test(long.svg), tl.join(' | '));
  const { textWidth } = await import('../shared/pattern-signal-card.mjs');
  const ends = svg => [...svg.matchAll(/<text x="([\d.]+)" y="[\d.]+" font-family="[^"]*" font-size="([\d.]+)" font-weight="(\d+)"[^>]*text-anchor="end"[^>]*>([^<]*)<\/text>/g)].map(m => ({ t: m[4], left: Number(m[1]) - textWidth(m[4].replace(/&amp;/g, '&'), Number(m[2]), Number(m[3])) }));
  const over = ends(long.svg).filter(e => e.t !== '21:19:16' && e.left < 108 + 200);   // rechtsbündige Werte lassen links Platz für die Bezeichnung (LEVEL, AUSLÖSUNG …)
  check('… kein rechtsbündiger Wert läuft in die Bezeichnung links', over.length === 0, JSON.stringify(over));
  // fehlende Werte
  const none = C.priceAlarmCard({ symbol: 'SOLUSDT', direction: 'above', level: 150.3 }), tn = texts(none.svg);
  check('Ohne aktuellen Kurs: „—“ statt erfundener Zahlen, kein Punkt, Bildunterschrift ohne USD; ohne Botname „Scalp Desk“', tn.includes('—') && !/r="17"/.test(none.svg) && none.caption === 'Kurs-Alarm · SOL · —' && tn.includes('Scalp Desk') && !/NaN|undefined|null/.test(none.svg), tn.join(' | '));
  // PNG über den Dienst
  let resvg = true; try { require('../server/node_modules/@resvg/resvg-js'); } catch { resvg = false; }
  if (resvg) {
    const r = await P.renderAlarmCard(P.EXAMPLE_ALARM), png = r.png;
    check('Dienst: PNG 1080 breit, Höhe passt zum Inhalt, Bildunterschrift aus demselben Modell', png.slice(1, 4).toString() === 'PNG' && png.readUInt32BE(16) === 1080 && png.readUInt32BE(20) === r.height && png.length > 20000 && r.caption === 'Kurs-Alarm · BTC · 81.840,13 USD');
    let thrown = ''; try { await P.renderAlarmCard(P.EXAMPLE_ALARM, { bundledFonts: false, loadSystemFonts: false }); } catch (e) { thrown = e.message; }
    check('… ohne Schrift keine leere Karte, sondern Fehler (Dienst sendet die Textmeldung)', /Keine Schrift/.test(thrown), thrown);
    const fs = require('fs'), path = require('path'); fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true }); fs.writeFileSync(path.join(__dirname, 'out', 'kurs-alarm-beispiel.png'), png);
  } else console.log('– PNG-Prüfungen übersprungen (resvg fehlt)');
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.log('✗ Abbruch — ' + e.stack); process.exitCode = 1; });
