// 3.15.0 – Orderbuch-Wände ohne Browser: größte Zone je Seite (0,1 % des Kurses) nur als Wand, wenn mindestens doppelt so viel
// wie im Schnitt; Kurs der Wand = größte Einzelstufe der Zone; Bereich ±2 % bzw. so weit das Orderbuch reicht. Aufruf: node unit-ob.js
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(process.env.HTML || path.join(__dirname, '..', 'weather-widget-v2.html'), 'utf8');
const grab = name => { const a = html.indexOf(`function ${name}(`); if (a < 0) throw new Error(name); let d = 0, b = a; for (; b < html.length; b++) { if (html[b] === '{') d++; else if (html[b] === '}' && --d === 0) break; } return html.slice(a, b + 1); };
const { obWalls } = new Function(`${grab('obWalls')}\nreturn { obWalls };`)();
let pass = 0, fail = 0; const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${n}${info ? ' — ' + info : ''}`); };
// Gleichmäßiges Buch: Stufen alle 0,02 % um 100, je 20.000 USDT; Wände werden aufaddiert
const book = (mid, n, step, walls = []) => { const lv = sgn => { const out = []; for (let i = 1; i <= n; i++) { const p = +(mid * (1 + sgn * i * step)).toFixed(6); let usd = 20000; for (const w of walls) if (w.sgn === sgn && Math.abs(p - w.p) < mid * step / 2) usd += w.usd; out.push([p, usd / p]); } return out; }; return { bids: lv(-1), asks: lv(1) }; };
let b = book(100, 1000, 0.0002, [{ sgn: -1, p: 99, usd: 5e6 }, { sgn: 1, p: 101.3, usd: 3e6 }]), r = obWalls(b.bids, b.asks, 100);
check('Kauf-Wand 5 Mio. bei −1 %: Kurs, Abstand, Größe', r.bid.wall && Math.abs(r.bid.wall.price - 99) < 1e-6 && Math.abs(r.bid.wall.dist + 1) < 0.01 && r.bid.wall.usd > 5e6 && r.bid.wall.usd < 5.2e6, JSON.stringify(r.bid.wall));
check('Verkaufs-Wand 3 Mio. bei +1,3 %', r.ask.wall && Math.abs(r.ask.wall.price - 101.3) < 1e-6 && Math.abs(r.ask.wall.dist - 1.3) < 0.01, JSON.stringify(r.ask.wall));
check('Faktor gegenüber dem Schnitt deutlich über 2', r.bid.wall.factor > 10 && r.ask.wall.factor > 10, `${r.bid.wall.factor.toFixed(1)} / ${r.ask.wall.factor.toFixed(1)}`);
check('Bereich ±2 % voll abgedeckt (Buch reicht bis 20 %)', r.bid.lim === 2 && r.ask.lim === 2 && r.bid.reach > 19, `${r.bid.lim} / ${r.bid.reach.toFixed(1)}`);
b = book(100, 1000, 0.0002); r = obWalls(b.bids, b.asks, 100);
check('Gleichmäßiges Buch ohne Wand: keine Wand (nichts doppelt so groß wie der Schnitt)', !r.bid.wall && !r.ask.wall, JSON.stringify([r.bid.wall, r.ask.wall]));
b = book(100, 1000, 0.0002, [{ sgn: -1, p: 97, usd: 9e6 }]); r = obWalls(b.bids, b.asks, 100);
check('Wand außerhalb ±2 % (bei −3 %) zählt nicht', !r.bid.wall, JSON.stringify(r.bid.wall));
b = book(100, 1000, 0.00001, [{ sgn: 1, p: 100.5, usd: 6e6 }]); r = obWalls(b.bids, b.asks, 100);
check('Buch reicht nur bis ±1 %: Bereich begrenzt, Wand bei +0,5 % gefunden', Math.abs(r.ask.lim - 1) < 0.01 && Math.abs(r.bid.lim - 1) < 0.01 && r.ask.wall && Math.abs(r.ask.wall.price - 100.5) < 1e-6, `${r.bid.lim.toFixed(2)} / ${r.ask.lim.toFixed(2)} · ${JSON.stringify(r.ask.wall)}`);
check('Leeres Buch: keine Wand, Reichweite 0', (r = obWalls([], [], 100)) && !r.bid.wall && !r.ask.wall && r.bid.reach === 0);
// Wand über zwei Stufen derselben Zone verteilt: zählt zusammen, Kurs = größere Stufe
b = book(100, 1000, 0.0002, [{ sgn: -1, p: 98.5, usd: 1.5e6 }, { sgn: -1, p: 98.48, usd: 1e6 }]); r = obWalls(b.bids, b.asks, 100);
check('Wand über zwei Stufen einer Zone: zusammengezählt, Kurs der größeren Stufe', r.bid.wall && Math.abs(r.bid.wall.price - 98.5) < 1e-6 && r.bid.wall.usd > 2.5e6, JSON.stringify(r.bid.wall));
console.log(`\n${pass}/${pass + fail} bestanden`); process.exit(fail ? 1 : 0);
