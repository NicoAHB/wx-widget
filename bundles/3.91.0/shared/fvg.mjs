// 3.70.0: Fair Value Gaps (FVG) im 3-Kerzen-Muster – dieselbe Logik wie fvg-ki/fvg_ki/model/detection.py.
// Bullisch: Tief der Kerze i liegt über dem Hoch der Kerze i-2 und die mittlere Kerze i-1 ist grün (Schluss > Eröffnung).
// Bärisch:  Hoch der Kerze i liegt unter dem Tief der Kerze i-2 und die mittlere Kerze ist rot (Schluss < Eröffnung).
// Mitigiert („geschlossen“) ab der ersten späteren Kerze, deren Docht die Lücke komplett schließt: bullisch Tief ≤ Unterkante,
// bärisch Hoch ≥ Oberkante. Bis dahin wird die Box gezeichnet, danach nicht mehr. „Berührt“: erster Docht in der Lücke.
// Kerzen: { time, open, high, low, close } in zeitlicher Reihenfolge. Reine Funktionen ohne DOM – auch für Tests und Dienste.

export function detectFvgs(candles) {
  const c = Array.isArray(candles) ? candles : [], n = c.length, out = [], open = [];
  for (let i = 0; i < n; i++) {
    const k = c[i];
    // erst offene Lücken mit dieser Kerze prüfen (eine neue Lücke kann frühestens von der nächsten Kerze geschlossen werden)
    for (let j = open.length - 1; j >= 0; j--) {
      const g = open[j];
      if (g.touch < 0 && (g.dir === 'bull' ? k.low <= g.top : k.high >= g.bottom)) g.touch = i;
      if (g.dir === 'bull' ? k.low <= g.bottom : k.high >= g.top) { g.mit = i; open.splice(j, 1); }
    }
    if (i < 2) continue;
    const a = c[i - 2], m = c[i - 1];
    if (k.low > a.high && m.close > m.open) { const g = { i, start: i - 2, dir: 'bull', top: k.low, bottom: a.high, mit: -1, touch: -1 }; out.push(g); open.push(g); }
    else if (k.high < a.low && m.close < m.open) { const g = { i, start: i - 2, dir: 'bear', top: a.low, bottom: k.high, mit: -1, touch: -1 }; out.push(g); open.push(g); }
  }
  return out;
}

// Kurzfassung für Hinweise: offene Lücken je Richtung und die dem Kurs nächste offene Lücke (Abstand in % vom Kurs)
export function fvgSummary(list, price) {
  const open = (list || []).filter(g => g.mit < 0), bull = open.filter(g => g.dir === 'bull').length;
  let near = null;
  if (price > 0) for (const g of open) {
    const d = price > g.top ? g.top - price : price < g.bottom ? g.bottom - price : 0;
    if (!near || Math.abs(d) < Math.abs(near.dist)) near = { ...g, dist: d, pct: d / price * 100, inside: d === 0 };
  }
  return { total: (list || []).length, open: open.length, bull, bear: open.length - bull, mitigated: (list || []).length - open.length, near };
}
