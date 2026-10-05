// ---------- Schritt 3.4: Hoch und Tief des sichtbaren Zeitraums ----------
// Das höchste Hoch und das tiefste Tief der sichtbaren Kerzen stehen fett in Grün bzw. Rot an der Dochtspitze: eine kurze
// Linie von der Spitze zur Beschriftung, der Kurs auf Höhe der Spitze. Am Computer „Hoch 64.471,56“, am Handy hochkant nur
// der Kurs (Platz). Die Beschriftung zeigt zur Chartmitte, dort ist der meiste Platz. Links vom Punkt endet sie im
// Kerzenbereich, am Handy vor den Kurs-Schildchen (die Linie läuft dann unter ihnen bis zur Spitze). Beim Entzerren bleibt
// sie fest, die übrigen Beschriftungen weichen ihr aus. Gleich hohe Spitzen: die jüngste. Es gilt der sichtbare
// Ausschnitt, also auch beim Zoomen und Zurückblättern; die Ebene „Hoch/Tief“ blendet beides aus.
function hiLoPoints(data) {
  let hi = -1, lo = -1;
  data.forEach((c, i) => { if (hi < 0 || c.high >= data[hi].high) hi = i; if (lo < 0 || c.low <= data[lo].low) lo = i; });
  return hi < 0 ? null : { hi, lo };
}
function drawHiLo(svg, { data, x, y, left, step, laneX = Infinity, axisIn }) {
  if (!state.overlays.hilo || !data?.length) return;
  const p = hiLoPoints(data), limL = left + 2, limR = Math.min(left + step * data.length - 2, laneX - 4);
  for (const [i, kind] of [[p.hi, 'hi'], [p.lo, 'lo']]) {
    const c = data[i], v = kind === 'hi' ? c.high : c.low, word = kind === 'hi' ? 'Hoch' : 'Tief', pt = priceText(v), text = axisIn ? pt : `${word} ${pt}`;
    const tw = text.length * 7, cx = x(i), yy = y(v), right = cx < (limL + limR) / 2, tx = right ? cx + 8 : Math.max(limL + tw, Math.min(cx - 8, limR));
    const g = node('g', { class: `hl-mark ${kind}` });
    g.append(node('title', {}, `${word} des sichtbaren Zeitraums: ${pt} USDT (${utcDate(c.time)} UTC)`),
      node('line', { x1: cx.toFixed(1), y1: yy.toFixed(1), x2: (right ? tx - 3 : tx + 3).toFixed(1), y2: yy.toFixed(1) }),
      node('text', { x: tx.toFixed(1), y: (yy + 4).toFixed(1), 'text-anchor': right ? 'start' : 'end' }, text));
    svg.append(g);
  }
}
