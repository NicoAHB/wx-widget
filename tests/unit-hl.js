// Schritt 3.4 – Hoch und Tief des sichtbaren Zeitraums ohne Browser: welche Kerze (bei Gleichstand die jüngste), welche
// Seite (zur Chartmitte), welcher Text (Computer „Hoch …“, Handy nur der Kurs), Linie von der Dochtspitze zur Beschriftung,
// am Handy Ende vor den Kurs-Schildchen, Ebene aus. Aufruf: node unit-hl.js (liest js/hilo.js aus dem Scratchpad)
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(process.env.SRC || path.join(__dirname, 'js', 'hilo.js'), 'utf8');
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${info ? ' — ' + info : ''}`); };
const state = { overlays: { hilo: true } };
const node = (tag, attrs, text) => ({ tag, attrs, text, kids: [], append(...k) { this.kids.push(...k); } });
const priceText = v => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const A = new Function('state', 'node', 'priceText', 'utcDate', src + '\nreturn { hiLoPoints, drawHiLo };')(state, node, priceText, () => '29.09.2026, 15:00');
// Kerzen aus Schlusskursen, Dochte ±0,5; einzelne Kerzen gezielt setzen
const candles = (n, f) => Array.from({ length: n }, (_, i) => { const c = 100 + Math.sin(i / 5) * 3; return { time: i * 60000, open: c, close: c + .2, high: c + .7, low: c - .5, ...(f?.(i) || {}) }; });
const geo = (data, { w = 700, axisIn = false, laneX = Infinity } = {}) => {
  const left = 15, right = axisIn ? 4 : 82, pw = w - left - right, step = pw / data.length, top = 18, bottom = 300 - 77;
  const min = Math.min(...data.map(c => c.low)), max = Math.max(...data.map(c => c.high));
  return { data, left, step, axisIn, laneX, x: i => left + (i + .5) * step, y: v => top + (max - v) / (max - min) * (bottom - top) };
};
const draw = g => { const svg = node('svg', {}); A.drawHiLo(svg, g); return svg.kids.map(k => { const [title, line, text] = k.kids; return { cls: k.attrs.class, title: title.text, line: line.attrs, text: text.text, x: +text.attrs.x, y: +text.attrs.y, anchor: text.attrs['text-anchor'] }; }); };

// welche Kerze
{ const d = [{ high: 5, low: 1 }, { high: 7, low: 2 }, { high: 7, low: .5 }, { high: 6, low: .5 }], p = A.hiLoPoints(d);
  check('Höchstes Hoch und tiefstes Tief; bei Gleichstand die jüngste Kerze', p.hi === 2 && p.lo === 3, JSON.stringify(p)); }
check('Keine Kerzen: nichts', A.hiLoPoints([]) === null);

// Computer: Hoch links im Chart → Beschriftung rechts davon; Tief rechts im Chart → links davon
{ const d = candles(100, i => i === 12 ? { high: 110 } : i === 88 ? { low: 90 } : null), g = geo(d), [hi, lo] = draw(g);
  check('Computer: „Hoch 110,00“ fett grün (Klasse), rechts von der Spitze links im Chart', hi.cls === 'hl-mark hi' && hi.text === 'Hoch 110,00' && hi.anchor === 'start' && Math.abs(hi.x - (g.x(12) + 8)) < .06, JSON.stringify(hi));
  check('Linie von der Dochtspitze bis vor die Beschriftung, Kurs auf Höhe der Spitze', Math.abs(+hi.line.x1 - g.x(12)) < .06 && Math.abs(+hi.line.x2 - (hi.x - 3)) < .06 && +hi.line.y1 === +hi.line.y2 && Math.abs(+hi.line.y1 - g.y(110)) < .06 && Math.abs(hi.y - 4 - g.y(110)) < .06, JSON.stringify(hi.line));
  check('Computer: „Tief 90,00“ links von der Spitze rechts im Chart', lo.cls === 'hl-mark lo' && lo.text === 'Tief 90,00' && lo.anchor === 'end' && Math.abs(lo.x - (g.x(88) - 8)) < .06 && Math.abs(+lo.line.x2 - (lo.x + 3)) < .06 && Math.abs(+lo.line.y1 - g.y(90)) < .06, JSON.stringify(lo));
  check('Hinweis beim Darüberfahren mit Uhrzeit', /^Hoch des sichtbaren Zeitraums: 110,00 USDT \(.+ UTC\)$/.test(hi.title), hi.title); }

// Handy hochkant: nur der Kurs; neues Hoch an der jüngsten Kerze unter den Kurs-Schildchen → endet davor
{ const d = candles(80, i => i === 79 ? { high: 112 } : i === 5 ? { low: 88 } : null), g = geo(d, { w: 286, axisIn: true, laneX: 199 }), [hi, lo] = draw(g);
  check('Handy: nur der Kurs, fett in Grün bzw. Rot', hi.text === '112,00' && lo.text === '88,00', `${hi.text} / ${lo.text}`);
  check('Handy: Hoch an der jüngsten Kerze → Beschriftung endet vor den Schildchen (laneX − 4)', hi.anchor === 'end' && hi.x === 195 && Math.abs(+hi.line.x1 - g.x(79)) < .06 && +hi.line.x2 === 198, JSON.stringify({ x: hi.x, line: hi.line, spitze: g.x(79).toFixed(1) }));
  check('Handy: Tief links → Beschriftung rechts davon', lo.anchor === 'start' && Math.abs(lo.x - (g.x(5) + 8)) < .06, JSON.stringify(lo)); }

// Prognose-Platz rechts (Kerzen enden früher): Beschriftung bleibt im Kerzenbereich
{ const d = candles(60, i => i === 59 ? { high: 111 } : null), g = { ...geo(d), step: 6, x: i => 15 + (i + .5) * 6 }, [hi] = draw(g);
  check('Mit Prognose-Platz: Hoch an der jüngsten Kerze zeigt nach links, im Kerzenbereich', hi.anchor === 'end' && hi.x <= 15 + 6 * 60 - 2 && hi.x < g.x(59), JSON.stringify({ x: hi.x, spitze: g.x(59) })); }

// sehr nah am linken Rand: Beschriftung rechts; am rechten Rand links, nie über den Kerzenbereich hinaus
{ const d = candles(100, i => i === 0 ? { high: 115 } : i === 99 ? { low: 85 } : null), g = geo(d), [hi, lo] = draw(g);
  check('Hoch an der ersten Kerze → rechts davon; Tief an der letzten → links davon', hi.anchor === 'start' && lo.anchor === 'end' && lo.x <= 15 + g.step * 100 - 2, `${hi.anchor}/${lo.anchor} ${lo.x.toFixed(1)}`); }

// Ebene aus
{ state.overlays.hilo = false; const svg = node('svg', {}); A.drawHiLo(svg, geo(candles(20))); state.overlays.hilo = true;
  check('Ebene „Hoch/Tief“ aus: nichts gezeichnet', svg.kids.length === 0); }
{ const svg = node('svg', {}); A.drawHiLo(svg, { ...geo(candles(3)), data: [] });
  check('Keine sichtbaren Kerzen: nichts gezeichnet', svg.kids.length === 0); }
console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
