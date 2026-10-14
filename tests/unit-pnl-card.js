// 3.71.0 / Dienst 2.15.0 – Gewinn-/Verlust-Alarm als Bild (shared/pnl-alarm-card.mjs, Rendern im Dienst über server/pattern-card.mjs).
// Beispiel nach Vorlage des Nutzers (Verlust −170,10 USD, 3 Positionen), Summe der Zeilen = große Zahl, höchstens 5 Zeilen + „weitere“,
// Farben, keine Emojis, einzeilige Bildunterschrift, fehlende Werte, PNG 1080 breit (resvg; ohne resvg nur die Renderprüfungen übersprungen).
// Aufruf: node unit-pnl-card.js
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${!ok && detail !== '' ? ' — ' + String(detail).slice(0, 500) : ''}`); };
(async () => {
  const C = await import('../shared/pnl-alarm-card.mjs'), P = await import('../server/pattern-card.mjs');
  const at = Date.UTC(2026, 9, 14, 18, 35, 15), texts = svg => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(x => x[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<'));
  // Beispiel Verlust
  const v = C.pnlAlarmCard(P.EXAMPLE_PNL), tv = texts(v.svg);
  check('Verlust-Beispiel: Label, Uhrzeit mit Sekunden, große Zahl, Schwelle, Kopf der Positionen, Zeilen, Fuß mit Datum und Botname', ['VERLUST-ALARM', '20:35:15', '−170,10', 'USD', 'Schwelle erreicht · ≤ −170,00 USD', 'OFFENE POSITIONEN · 3', 'BTC/USDT', 'Long', '−92,40 USD', 'ETH/USDT', 'Short', '+18,70 USD', 'SOL/USDT', '−96,40 USD', '14.10.2026 · Mein Kurs Alarm'].every(s => tv.includes(s)), tv.join(' | '));
  check('… Farben: Label rot auf dunkelrotem Grund, große Zahl rot, Gewinnzeile grün, Verlustzeile rot; Hintergrund #0E1A2E, Karte #131F36', /fill="#3a1c25"/.test(v.svg) && /fill="#F87171"[^>]*>VERLUST-ALARM/.test(v.svg) && /fill="#F87171"[^>]*>−170,10/.test(v.svg) && /fill="#4ADE80"[^>]*>\+18,70 USD/.test(v.svg) && /fill="#F87171"[^>]*>−92,40 USD/.test(v.svg) && /<rect width="1080" height="\d+" fill="#0E1A2E"/.test(v.svg) && /fill="#131F36"/.test(v.svg));
  check('… Bildunterschrift eine Zeile: „Verlust-Alarm · −170,10 USD“', v.caption === 'Verlust-Alarm · −170,10 USD', v.caption);
  check('… keine Emojis im Bild, 1080 breit', !/\p{Extended_Pictographic}/u.test(tv.join('')) && v.width === 1080 && v.height >= 1080);
  // Gewinn
  const g = C.pnlAlarmCard({ profit: true, pnl: 212.4, level: 200, at, bot: 'Mein Kurs Alarm', positions: [{ symbol: 'BTCUSDT', side: 'long', pnl: 138.2 }, { symbol: 'ETHUSDT', side: 'short', pnl: 61.5 }, { symbol: 'SOLUSDT', side: 'long', pnl: 12.7 }] }), tg = texts(g.svg);
  check('Gewinn: „GEWINN-ALARM“ grün auf dunkelgrünem Grund, „+212,40“ grün, „≥ +200,00 USD“, Bildunterschrift', /fill="#16351f"/.test(g.svg) && /fill="#4ADE80"[^>]*>GEWINN-ALARM/.test(g.svg) && /fill="#4ADE80"[^>]*>\+212,40/.test(g.svg) && tg.includes('Schwelle erreicht · ≥ +200,00 USD') && g.caption === 'Gewinn-Alarm · +212,40 USD', g.caption);
  // Summe = große Zahl (Rundung je Zeile ausgeglichen)
  const odd = C.pnlCardModel({ profit: true, pnl: 0.03, positions: [{ symbol: 'AUSDT', pnl: 0.014 }, { symbol: 'BUSDT', pnl: 0.014 }, { symbol: 'CUSDT', pnl: 0.002 }] });
  const sum = m => Math.round(m.rows.reduce((t, r) => t + r.value, 0) * 100 + (m.more ? m.more.value * 100 : 0));
  check('Summe der Zeilen = große Zahl, auch wenn die Einzelwerte beim Runden nicht aufgehen (Restcent an die größte Zeile)', sum(odd) === 3 && odd.totalText === '+0,03', JSON.stringify(odd.rows));
  // mehr als 5 Positionen
  const many = C.pnlCardModel({ profit: false, pnl: -100, level: 50, positions: [5, -40, 2, -30, 1, -20, 3, -21].map((p, i) => ({ symbol: 'C' + i + 'USDT', side: i % 2 ? 'short' : 'long', pnl: p })) });
  check('Mehr als 5 Positionen: die 5 mit dem größten Betrag (in der ursprünglichen Reihenfolge), Rest als „+ 3 weitere“ mit Summe; zusammen = große Zahl', many.rows.length === 5 && many.rows.map(r => r.symbol).join() === 'C0/USDT,C1/USDT,C3/USDT,C5/USDT,C7/USDT' && many.more?.n === 3 && many.more.value === 6 && sum(many) === -10000 && many.count === 8, JSON.stringify({ rows: many.rows.map(r => r.symbol), more: many.more }));
  check('… auf dem Bild „+ 3 weitere“ mit Betrag', texts(C.pnlCardSvg(many).svg).includes('+ 3 weitere') && texts(C.pnlCardSvg(many).svg).includes('+6,00 USD'));
  // fehlende Werte
  const none = C.pnlAlarmCard({ profit: false, pnl: -12, level: 10, count: 2, at }), tn = texts(none.svg);
  check('Ohne Einzelwerte (Kurs fehlte): „OFFENE POSITIONEN · 2“ und „2 ohne aktuellen Kurs“, nichts erfunden', tn.includes('OFFENE POSITIONEN · 2') && tn.includes('2 ohne aktuellen Kurs') && !/NaN|undefined|null/.test(none.svg), tn.join(' | '));
  check('Ohne Botname: „Scalp Desk“ im Fuß; ohne Zeit kein leerer Punkt', texts(C.pnlAlarmCard({ profit: true, pnl: 1, level: 1 }).svg).includes('Scalp Desk') && !texts(C.pnlAlarmCard({ profit: true, pnl: 1 }).svg).some(t => /^ · /.test(t)));
  // PNG über den Dienst
  let resvg = true; try { require('../server/node_modules/@resvg/resvg-js'); } catch { resvg = false; }
  if (resvg) {
    const r = await P.renderPnlCard(P.EXAMPLE_PNL), png = r.png;
    check('Dienst: PNG 1080 breit, Höhe passt zum Inhalt, Bildunterschrift aus demselben Modell', png.slice(1, 4).toString() === 'PNG' && png.readUInt32BE(16) === 1080 && png.readUInt32BE(20) === r.height && png.length > 20000 && r.caption === 'Verlust-Alarm · −170,10 USD');
    let thrown = ''; try { await P.renderPnlCard(P.EXAMPLE_PNL, { bundledFonts: false, loadSystemFonts: false }); } catch (e) { thrown = e.message; }
    check('… ohne Schrift keine leere Karte, sondern Fehler (Dienst sendet die Textmeldung)', /Keine Schrift/.test(thrown), thrown);
    require('fs').mkdirSync(require('path').join(__dirname, 'out'), { recursive: true }); require('fs').writeFileSync(require('path').join(__dirname, 'out', 'gewinn-verlust-beispiel.png'), png);
  } else console.log('– PNG-Prüfungen übersprungen (resvg fehlt)');
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.log('✗ Abbruch — ' + e.stack); process.exitCode = 1; });
