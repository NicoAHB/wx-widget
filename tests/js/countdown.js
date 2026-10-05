// ---------- Schritt 3.3: Countdown bis Kerzenschluss an der Kurslinie ----------
// Am rechten Ende der gestrichelten Kurslinie (jetzt in der Farbe der laufenden Kerze) steht ein Schild mit dem aktuellen
// Kurs und darunter der Zeit bis zum Schluss der laufenden Kerze. Es sitzt in der Kursspalte; am Handy hochkant steht es im
// Chart am rechten Rand und damit über den jüngsten Kerzen – dort hängt es über oder unter der Kurslinie, je nachdem, wo es
// weniger Kerzen verdeckt, den Körper der laufenden Kerze nie (dafür darf es in den freien Rand über und unter dem
// Kursbereich ragen, und der Kursbereich lässt oben und unten mindestens 18 px frei). Rasterbeschriftungen, die es
// verdecken würde, entfallen. Der Countdown läuft im Sekundentakt des Workers weiter, auch wenn der Chart gerade nicht neu
// gezeichnet wird, und rechnet mit der Uhr von Binance: Die Abweichung der Geräteuhr ergibt sich aus den Zeitstempeln der
// Kerzen-Ereignisse im Live-Stream (größter Wert der letzten 30 – die Laufzeit macht ihn nur kleiner).
// var statt const/let: drawChart kann schon laufen, bevor dieser Abschnitt ausgewertet ist
var clk = { off: 0, s: [] };
function clockSample(E) { if (!Number.isFinite(E) || !clk) return; clk.s.push(E - Date.now()); if (clk.s.length > 30) clk.s.shift(); clk.off = Math.max(...clk.s); }
function serverNow() { return Date.now() + (clk?.off || 0); }
// Restzeit als Text: unter 1 h „m:ss“, unter 1 Tag „h:mm:ss“, darüber „3T 05:12“
function cdText(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), hh = Math.floor(s % 86400 / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60, p = n => String(n).padStart(2, '0');
  return d ? `${d}T ${p(hh)}:${p(mm)}` : hh ? `${hh}:${p(mm)}:${p(ss)}` : `${mm}:${p(ss)}`;
}
// Zeit bis zum Schluss der laufenden Kerze (ms) oder null, solange keine passenden Kerzen da sind
function candleLeft() { const c = state.candles.at(-1); return c && state.loadedSymbol === state.symbol ? c.closeTime + 1 - serverNow() : null; }
// Lage des Schilds – vor dem Raster berechnet, damit verdeckte Rasterbeschriftungen entfallen; null = Kurs außerhalb.
// In der Kursspalte steht der Kurs auf der Linie. Am Handy (Schild im Chart) zählt je Lage (auf, über, unter der Linie),
// wie viel Kerze es verdeckt: der Körper der jüngsten sichtbaren Kerze vor allem anderen, dann ihr Docht, dann die übrigen.
function lastTagBox(price, { y, min, max, top, bottom, w, axisIn, data, x, step }) {
  if (!(price >= min && price <= max)) return null;
  const h = 31, py = y(price), at = v => clamp(v, axisIn ? 2 : top, (axisIn ? bottom + 14 : bottom) - h), t = { price, py, y: at(py - 9), h };
  if (!axisIn || !data?.length) return t;
  const x0 = w - 2 - lastTagW(t, true), n = data.length, half = step * .63 / 2;
  const span = (a, lo, hi) => Math.max(0, Math.min(a + h, hi) - Math.max(a, lo));
  const cost = ty => { let s = 0; for (let i = n - 1; i >= 0 && x(i) + half >= x0; i--) { const c = data[i], k = i === n - 1;
    s += span(ty, y(Math.max(c.open, c.close)), y(Math.min(c.open, c.close))) * (k ? 1e4 : 2) + span(ty, y(c.high), y(c.low)) * (k ? 20 : 1); } return s; };
  let best = t.y, bc = cost(best);
  for (const ty of [at(py - h - 1), at(py + 1)]) { const c = cost(ty); if (c < bc) { bc = c; best = ty; } }
  return { ...t, y: best };
}
// Richtung der laufenden Kerze für die Farbe von Kurslinie und Schild
function lastDir() { const c = state.candles.at(-1); return c && c.close < c.open ? 'down' : 'up'; }
function lastTagW(t, axisIn, spare) { return axisIn ? Math.max(priceText(t.price).length * 7.4 + 14, 60) : spare; }
function drawLastTag(svg, t, { w, left, pw, axisIn }) {
  if (!t) return;
  const pt = priceText(t.price), rest = candleLeft();
  const tagW = lastTagW(t, axisIn, w - left - pw - 4), tagX = axisIn ? w - 2 - tagW : left + pw + 2, cx = tagX + tagW / 2;
  const g = node('g', { class: `last-tag ${lastDir()}` });
  g.append(node('title', {}, `Aktueller Kurs ${pt} USDT – darunter die Zeit bis zum Schluss der laufenden ${state.interval}-Kerze`),
    node('rect', { x: tagX.toFixed(1), y: t.y.toFixed(1), width: tagW.toFixed(1), height: t.h, rx: 4 }),
    node('text', { x: cx.toFixed(1), y: (t.y + 13).toFixed(1), 'text-anchor': 'middle', class: 'last-price' }, pt),
    node('text', { x: cx.toFixed(1), y: (t.y + 26).toFixed(1), 'text-anchor': 'middle', class: 'last-cd' }, rest === null ? '' : cdText(rest)));
  svg.append(g);
}
// Sekundentakt: nur den Countdown-Text erneuern (kein Neuzeichnen des Charts)
function lastTagTick() { const e = document.querySelector('#chart .last-cd'), l = candleLeft(); if (e && l !== null) { const t = cdText(l); if (e.textContent !== t) e.textContent = t; } }
