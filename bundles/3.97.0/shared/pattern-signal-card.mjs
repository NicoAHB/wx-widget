// 3.71.0: Chartmuster-Signalkarte als SVG – dieselbe Karte in der App (Signal-Log), aus der App an Telegram (Canvas → PNG) und in
// den Oracle-Diensten (resvg → PNG). Eingabe ist das Anzeigemodell patternSignalModel (telegram-format.mjs); dieses Modul zeichnet
// nur. Aufbau nach Vorlage des Nutzers: Kopf, Gesamturteil (Banner), Mini-Chart, Einstieg/Ziel/Stop, „Jetzt“, Musterqualität, Fuß.
// Symbole (Haken, Kreuz, Warnung, Pfeil) sind Pfade, keine Schriftzeichen – die mitgelieferte Serverschrift ist eine Untermenge.
import { PATTERN_NA, patternSignalModel } from './telegram-format.mjs';
import { INTERVAL_MS } from './market-intervals.mjs';

export const CARD_W = 1024;
export const CARD_FONT = "Inter, 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif";
export const CARD_COLORS = Object.freeze({ bg: '#0a1222', bg2: '#0e1a30', panel: '#121c31', line: '#1f2b44', text: '#f4f7fb', soft: '#c9d4e8', label: '#a7b4cd', muted: '#8a99b5',
  green: '#4ade80', red: '#f87171', orange: '#fb923c', yellow: '#fbbf24', blue: '#7ea6f5', track: '#24314c', patline: '#94a3b8' });
const C = CARD_COLORS, finite = v => typeof v === 'number' && Number.isFinite(v);

// ---- Zeichenbreiten von Inter (1/1000 em) zum Umbrechen und Einpassen; 4 % Reserve für Ersatzschriften ----
const CH = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~äöüÄÖÜß€−≠•…–→↗↘·×÷';
const RAW = {
  500: '267,304,494,639,646,993,653,313,369,369,521,667,303,462,303,370,646,415,616,627,656,618,630,571,629,630,303,315,667,667,667,527,982,709,657,733,722,603,589,748,745,272,575,688,565,913,756,767,642,769,648,646,653,740,709,1003,701,696,641,369,370,369,477,463,337,568,618,577,618,587,379,620,602,252,252,559,252,888,602,604,618,618,387,539,340,602,575,829,557,575,559,440,346,440,667,568,604,602,709,767,740,630,672,667,667,533,910,500,954,778,778,303,667,667',
  600: '252,321,523,644,650,1004,663,326,373,373,540,673,319,465,319,379,660,423,623,636,666,629,640,576,640,640,319,329,673,673,673,543,999,728,659,737,722,605,588,749,746,277,580,703,565,922,759,769,645,773,652,650,660,736,728,1020,720,713,652,373,379,373,481,469,351,574,624,583,624,591,389,625,612,262,262,569,262,900,612,609,624,624,397,549,353,612,587,839,569,588,566,455,359,455,673,574,609,612,728,769,736,644,679,673,673,503,956,500,954,780,780,319,673,673',
  700: '237,338,552,649,655,1016,672,339,377,377,559,679,334,468,334,388,674,431,630,646,676,639,649,582,651,649,334,343,679,679,679,560,1016,747,662,740,722,607,587,750,747,281,584,719,565,932,762,771,648,777,657,655,667,732,747,1038,738,731,664,377,388,377,487,476,365,581,630,588,630,596,398,632,623,271,271,580,271,913,623,613,630,630,407,560,366,623,600,850,580,602,573,469,372,469,679,581,613,623,747,771,732,657,685,679,679,474,1002,500,954,783,783,334,679,679',
  800: '219,358,586,655,660,1029,683,354,382,382,583,686,353,471,353,400,692,441,638,657,688,652,662,588,664,662,353,360,686,686,686,579,1036,770,665,744,723,610,585,752,749,286,590,738,565,943,766,773,652,782,662,660,677,727,770,1059,761,752,679,382,400,382,493,484,382,588,638,595,638,601,410,639,635,283,283,593,283,927,635,619,638,638,420,573,382,635,615,863,594,618,581,486,388,486,686,588,619,635,770,773,727,674,692,686,686,438,1058,500,954,786,786,353,686,686',
};
const WIDTH = Object.fromEntries(Object.entries(RAW).map(([w, s]) => { const a = s.split(',').map(Number), m = new Map(); [...CH].forEach((ch, i) => m.set(ch, a[i])); return [w, m]; }));
export function textWidth(s, size, weight = 700, spacing = 0) {
  const t = WIDTH[weight] || WIDTH[700]; let w = 0, n = 0;
  for (const ch of String(s)) { w += t.get(ch) ?? 680; n++; }
  return w / 1000 * size * 1.04 + spacing * n;
}
// Schriftgröße so weit verkleinern, dass der Text in die Breite passt (Zahlen werden nie gekürzt)
export const fitSize = (s, size, weight, max, min = Math.round(size * 0.6), spacing = 0) => { let z = size; while (z > min && textWidth(s, z, weight, spacing) > max) z -= 1; return z; };
// Wortweise umbrechen; passt es in maxLines nicht, kleinere Schrift; notfalls letzte Zeile mit „…“
export function wrapText(s, size, weight, max, maxLines = 3, min = Math.round(size * 0.72)) {
  const words = String(s).split(/\s+/).filter(Boolean);
  for (let z = size; z >= min; z -= 2) {
    const lines = []; let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (textWidth(next, z, weight) <= max || !cur) cur = next; else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    if (lines.length <= maxLines && lines.every(l => textWidth(l, z, weight) <= max)) return { lines, size: z };
    if (z - 2 < min) {
      const keep = lines.slice(0, maxLines); let last = keep.at(-1);
      while (last.length > 1 && textWidth(last + '…', z, weight) > max) last = last.slice(0, -1);
      keep[keep.length - 1] = last + (lines.length > maxLines || textWidth(lines.at(-1), z, weight) > max ? '…' : '');
      return { lines: keep, size: z };
    }
  }
  return { lines: [String(s)], size: min };
}

// ---- Daten fürs Mini-Chart ----
// k: Kerzen der Erkennung ({t, c} im Dienst, {time, close} oder {t, c} in der App), h: Treffer der Engine (t0, lines mit Kerzenindex).
// Ergebnis: Schlusskurse ab kurz vor dem Muster bis zur letzten Kerze (höchstens max, ältere ausgedünnt) und Musterlinien in Zeit/Preis.
const r8 = v => +Number(v).toPrecision(8);
export function patternChartData(k, h, { lead = 6, max = 120 } = {}) {
  const T = x => x?.t ?? x?.time, P = x => x?.c ?? x?.close;
  if (!Array.isArray(k) || k.length < 2 || !h) return null;
  let i0 = k.findIndex(x => T(x) >= h.t0); if (i0 < 0) i0 = 0;
  let rows = k.slice(Math.max(0, i0 - lead)).filter(x => finite(T(x)) && finite(P(x)) && P(x) > 0).map(x => [T(x), r8(P(x))]);
  if (rows.length > max) { const step = (rows.length - 1) / (max - 1); rows = Array.from({ length: max }, (_, i) => rows[Math.round(i * step)]); }
  const lines = (Array.isArray(h.lines) ? h.lines : []).filter(l => Array.isArray(l) && k[l[0]] && k[l[2]] && finite(l[1]) && finite(l[3])).slice(0, 6).map(l => [T(k[l[0]]), r8(l[1]), T(k[l[2]]), r8(l[3])]);
  return rows.length >= 2 ? { k: rows, lines } : null;
}
// Mini-Chart-Daten aus einer fremden Quelle (App → Dienst) prüfen: nur endliche Zahlen, begrenzte Größe, sonst null
export function cleanPatternChart(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.k)) return null;
  const k = raw.k.slice(-1000).filter(r => Array.isArray(r) && r.length === 2 && r.every(finite) && r[1] > 0).slice(-160).map(r => [r[0], r8(r[1])]);
  const lines = (Array.isArray(raw.lines) ? raw.lines : []).slice(0, 50).filter(l => Array.isArray(l) && l.length === 4 && l.every(finite) && l[1] > 0 && l[3] > 0).slice(0, 6).map(l => [l[0], r8(l[1]), l[2], r8(l[3])]);
  return k.length >= 2 ? { k, lines } : null;
}

// ---- SVG-Bausteine ----
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const T = (x, y, s, { size = 32, weight = 700, fill = C.text, anchor = 'start', spacing = 0 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${CARD_FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}${spacing ? ` letter-spacing="${spacing}"` : ''}>${esc(s)}</text>`;
const R = (x, y, w, h, r, fill, stroke = '', sw = 2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`;
const n1 = v => Math.round(v * 10) / 10;
const checkMark = (x, cy, s, color) => `<path d="M${n1(x)} ${n1(cy)} L${n1(x + s * 0.36)} ${n1(cy + s * 0.34)} L${n1(x + s)} ${n1(cy - s * 0.38)}" fill="none" stroke="${color}" stroke-width="${n1(s * 0.17)}" stroke-linecap="round" stroke-linejoin="round"/>`;
const crossMark = (x, cy, s, color) => `<path d="M${n1(x + s * 0.1)} ${n1(cy - s * 0.4)} L${n1(x + s * 0.9)} ${n1(cy + s * 0.4)} M${n1(x + s * 0.9)} ${n1(cy - s * 0.4)} L${n1(x + s * 0.1)} ${n1(cy + s * 0.4)}" fill="none" stroke="${color}" stroke-width="${n1(s * 0.17)}" stroke-linecap="round"/>`;
const warnIcon = (x, y, s, fill = C.yellow) => `<g transform="translate(${n1(x)} ${n1(y)}) scale(${n1(s / 48 * 1000) / 1000})"><path d="M24 4 L46 43 Q47 46 44 46 L4 46 Q1 46 2 43 Z" fill="${fill}" stroke="${fill}" stroke-width="3" stroke-linejoin="round"/><rect x="21.5" y="16" width="5" height="17" rx="2.5" fill="#1a1405"/><circle cx="24" cy="39" r="3" fill="#1a1405"/></g>`;
const arrowIcon = (x, y, s, up, color) => {
  const a = up ? `M${x} ${y + s} L${x + s} ${y}` : `M${x} ${y} L${x + s} ${y + s}`, h = s * 0.55;
  const head = up ? `M${x + s - h} ${y} L${x + s} ${y} L${x + s} ${y + h}` : `M${x + s - h} ${y + s} L${x + s} ${y + s} L${x + s} ${y + s - h}`;
  return `<path d="${a} ${head}" fill="none" stroke="${color}" stroke-width="${n1(s * 0.17)}" stroke-linecap="round" stroke-linejoin="round"/>`;
};
const tint = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

// Mini-Chart: Musterlinien, Kursverlauf, Einstieg/Ziel/Stop, grüne Zone Einstieg–Ziel, rote Zone Einstieg–Stop, aktueller Kurs als Punkt
function miniChart(m, x, y, w, h, out) {
  const ch = m.chart, lv = m.levels, step = INTERVAL_MS[m.iv] || 0;
  const px0 = x + 26, px1 = x + w - 26, py0 = y + 26, py1 = y + h - 26;
  if (!ch?.k?.length || !(lv.entry > 0)) { out.push(T(x + w / 2, y + h / 2 + 10, 'Kursverlauf nicht verfügbar', { size: 28, weight: 600, fill: C.muted, anchor: 'middle' })); return; }
  const t0 = ch.k[0][0], tLast = ch.k.at(-1)[0], tc = finite(m.tc) ? m.tc : tLast;
  // rechts Platz für das Einstiegsfenster: bis zu dessen Ende, mindestens ein Drittel der Breite ab der Bestätigung
  const t1 = Math.max(tLast + step, finite(m.now.until) ? m.now.until : tLast + 6 * step, finite(m.nowAt) ? m.nowAt : 0, tc + (tc - t0) / 2);
  const vals = [...ch.k.map(r => r[1]), ...ch.lines.flatMap(l => [l[1], l[3]]), lv.entry, lv.target, lv.stop, lv.price].filter(v => finite(v) && v > 0);
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo || hi * 0.01) * 0.1; lo -= pad; hi += pad;
  const X = t => n1(px0 + (t - t0) / Math.max(1, t1 - t0) * (px1 - px0)), Y = p => n1(py1 - (p - lo) / (hi - lo) * (py1 - py0));
  const id = 'mc' + Math.round(x + y);
  out.push(`<defs><clipPath id="${id}"><rect x="${px0}" y="${py0}" width="${px1 - px0}" height="${py1 - py0}"/></clipPath></defs><g clip-path="url(#${id})">`);
  const zx = X(tc), zw = Math.max(0, px1 - zx);
  if (lv.target > 0) out.push(`<rect x="${zx}" y="${Math.min(Y(lv.target), Y(lv.entry))}" width="${n1(zw)}" height="${n1(Math.abs(Y(lv.target) - Y(lv.entry)))}" fill="${tint(C.green, 0.13)}"/>`);
  if (lv.stop > 0) out.push(`<rect x="${zx}" y="${Math.min(Y(lv.stop), Y(lv.entry))}" width="${n1(zw)}" height="${n1(Math.abs(Y(lv.stop) - Y(lv.entry)))}" fill="${tint(C.red, 0.13)}"/>`);
  const hl = (p, color, dash, sw) => p > 0 ? `<line x1="${px0}" y1="${Y(p)}" x2="${px1}" y2="${Y(p)}" stroke="${color}" stroke-width="${sw}" stroke-dasharray="${dash}"/>` : '';
  out.push(hl(lv.target, C.green, '12 9', 2.5), hl(lv.stop, C.red, '12 9', 2.5), hl(lv.entry, C.patline, '4 7', 2.5));
  for (const l of ch.lines) out.push(`<line x1="${X(l[0])}" y1="${Y(l[1])}" x2="${X(l[2])}" y2="${Y(l[3])}" stroke="${C.patline}" stroke-width="3" stroke-linecap="round" opacity="0.85"/>`);
  out.push(`<polyline points="${ch.k.map(r => `${X(r[0])},${Y(r[1])}`).join(' ')}" fill="none" stroke="${C.text}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`);
  out.push('</g>');
  if (lv.price > 0) { const cx = X(Math.min(t1, Math.max(tLast, finite(m.nowAt) ? m.nowAt : tLast))); out.push(`<circle cx="${cx}" cy="${Y(lv.price)}" r="10" fill="${m.dirSign < 0 ? C.red : C.green}" stroke="${C.panel}" stroke-width="3"/>`); }
  // Beschriftung rechts außen: Ziel und Stop auf ihrer Außenseite, Einstieg dazwischen
  // Beschriftungen nie übereinander: nach Höhe sortiert, mindestens 26 px Abstand, innerhalb des Charts
  const up = !(lv.target > 0 && lv.target < lv.entry), labs = [];
  const lab = (p, text, color, above) => { if (p > 0) labs.push({ y: above ? Y(p) - 10 : Y(p) + 30, text, color }); };
  lab(lv.target, 'ZIEL', C.green, up); lab(lv.entry, 'EINSTIEG', C.label, !up); lab(lv.stop, 'STOP', C.red, !up);
  labs.sort((a, b) => a.y - b.y);
  for (let i = 1; i < labs.length; i++) labs[i].y = Math.max(labs[i].y, labs[i - 1].y + 26);
  const over = labs.length ? labs.at(-1).y - (py1 + 22) : 0; if (over > 0) for (const l of labs) l.y -= over;
  for (let i = labs.length - 2; i >= 0; i--) labs[i].y = Math.min(labs[i].y, labs[i + 1].y - 26);
  for (const l of labs) out.push(T(px1 - 4, n1(Math.max(py0 + 2, l.y)), l.text, { size: 22, weight: 700, fill: l.color, anchor: 'end', spacing: 1 }));
}

export function patternCardSvg(m, { preview = false } = {}) {
  const W = CARD_W, X = 40, Wp = W - 2 * X, L = X + 32, Rr = W - X - 32, out = [], na = v => v === PATTERN_NA;
  const up = m.dirSign > 0, down = m.dirSign < 0, dirColor = up ? C.green : down ? C.red : C.soft;
  // Kopf: Kennzeile, Richtung als Kennzeichen rechts, Paar, Muster · Status
  const head = ['CHARTMUSTER', na(m.market) ? '' : String(m.market).toUpperCase(), na(m.timeframeUpper) ? '' : m.timeframeUpper].filter(Boolean).join(' · ');
  out.push(T(48, 74, head, { size: fitSize(head, 27, 700, 560, 20, 4), weight: 700, fill: C.label, spacing: 4 }));
  if (preview) { const lw = 48 + textWidth(head, 27, 700, 4) + 18, bw = textWidth('BEISPIEL', 21, 700, 2) + 30; out.push(R(n1(lw), 46, n1(bw), 40, 11, 'none', '#7f90b0', 2), T(n1(lw + bw / 2), 73, 'BEISPIEL', { size: 21, weight: 700, fill: C.soft, anchor: 'middle', spacing: 2 })); }
  const dSize = fitSize(m.direction, 34, 800, 260), pillW = Math.round(textWidth(m.direction, dSize, 800) + (m.dirSign ? 104 : 56)), pillX = W - X - pillW;
  out.push(R(pillX, 38, pillW, 82, 24, up ? tint(C.green, 0.08) : down ? tint(C.red, 0.08) : 'rgba(201,212,232,0.06)', dirColor, 3));
  if (m.dirSign) out.push(arrowIcon(pillX + 30, 63, 30, up, dirColor));
  out.push(T(pillX + (m.dirSign ? 78 : 28), 92, m.direction, { size: dSize, weight: 800, fill: na(m.direction) ? C.muted : dirColor }));
  out.push(T(44, 214, m.pair, { size: fitSize(m.pair, 108, 800, Wp - 8, 56), weight: 800, fill: na(m.pair) ? C.muted : C.text }));
  let y = 290; const sep = '  ·  ', status = na(m.status) ? '' : m.status, nameSize = 40, stSize = 36;
  if (textWidth(m.pattern, nameSize, 800) + (status ? textWidth(sep + status, stSize, 700) : 0) <= Wp) {
    out.push(T(48, y, m.pattern, { size: nameSize, weight: 800, fill: na(m.pattern) ? C.muted : C.text }));
    if (status) out.push(T(n1(48 + textWidth(m.pattern, nameSize, 800)), y, sep + status, { size: stSize, weight: 700, fill: m.confirmed ? C.green : C.soft }));
  } else {
    const pw = wrapText(m.pattern, nameSize, 800, Wp, 2, 30); pw.lines.forEach((l, i) => out.push(T(48, y + i * Math.round(pw.size * 1.15), l, { size: pw.size, weight: 800, fill: C.text })));
    y += (pw.lines.length - 1) * Math.round(pw.size * 1.15) + 48; if (status) out.push(T(48, y, status, { size: fitSize(status, stSize, 700, Wp), weight: 700, fill: m.confirmed ? C.green : C.soft }));
  }
  y += 38;
  // 1) Gesamturteil
  if (m.grade) {
    const g = m.grade, bh = 152;
    out.push(R(X, y, Wp, bh, 24, tint(g.color, 0.1), g.color, 3));
    out.push(T(L, y + 64, g.label, { size: 44, weight: 800, fill: g.color }), T(Rr, y + 68, m.score, { size: 56, weight: 800, fill: g.color, anchor: 'end' }));
    let ix = L; const iy = y + 118, z = 30;
    const item = (label, ok, extra = '') => {
      out.push(T(ix, iy, label, { size: z, weight: 500, fill: C.soft })); ix += textWidth(label, z, 500) + 10;
      if (ok === true) out.push(checkMark(ix, iy - 10, 24, C.green)); else if (ok === false) out.push(crossMark(ix, iy - 10, 22, C.muted)); else out.push(T(ix, iy, '?', { size: z, weight: 700, fill: C.muted }));
      ix += 30; if (extra) { out.push(T(ix + 4, iy, extra, { size: z, weight: 600, fill: C.soft })); ix += textWidth(extra, z, 600) + 4; }
    };
    const dot = () => { out.push(T(ix + 6, iy, '·', { size: z, weight: 700, fill: C.muted })); ix += 30; };
    item('Trend', m.trend); dot(); item('Volumen', m.volume); dot(); item('Chance/Risiko', m.rr ? m.rrOk : null, m.rr || '');
    y += bh + 24;
  }
  // 5) Mini-Chart
  out.push(R(X, y, Wp, 360, 24, C.panel, C.line, 2)); miniChart(m, X, y, Wp, 360, out); y += 360 + 24;
  // 4) Einstieg, Ziel, Stop (Stop mit ATR-Hinweis)
  const rows = [['EINSTIEG', m.entry, null, null], ['ZIEL', m.target, m.targetPct, C.green], ['STOP', m.stop, m.stopPct, C.red]], rh = 108, hint = m.stopTight ? 64 : 0, ph = rows.length * rh + hint + 8;
  out.push(R(X, y, Wp, ph, 24, C.panel, C.line, 2));
  const pctW = Math.max(0, ...rows.map(r => r[2] ? textWidth(r[2], 32, 700) : 0)), valMax = Rr - L - 230 - (pctW ? pctW + 22 : 0);
  const vSize = Math.min(52, ...rows.filter(r => !na(r[1])).map(r => fitSize(r[1], 52, 800, valMax, 34)));
  rows.forEach(([label, v, pct, color], i) => {
    const ry = y + 4 + i * rh + (i === 2 ? 0 : 0);
    if (i) out.push(`<line x1="${L}" y1="${ry}" x2="${Rr}" y2="${ry}" stroke="${C.line}" stroke-width="2"/>`);
    out.push(T(L, ry + 66, label, { size: 28, weight: 700, fill: C.label, spacing: 3 }));
    const vx = pct ? Rr - pctW - 22 : Rr;
    out.push(T(vx, ry + 70, v, { size: na(v) ? 34 : vSize, weight: na(v) ? 600 : 800, fill: na(v) ? C.muted : C.text, anchor: 'end' }));
    if (pct) out.push(T(Rr, ry + 68, pct, { size: 32, weight: 700, fill: color, anchor: 'end' }));
  });
  if (hint) { const hy = y + 4 + rows.length * rh; out.push(warnIcon(L, hy + 4, 34), T(L + 48, hy + 32, m.stopTight, { size: fitSize(m.stopTight, 27, 600, Rr - L - 48, 20), weight: 600, fill: C.yellow })); }
  y += ph + 24;
  // 3) Jetzt
  if (m.now.state || m.now.price) {
    const st = m.now.state, col = st === 'valid' ? C.green : st === 'missed' ? C.orange : C.muted, jh = 172;
    out.push(R(X, y, Wp, jh, 24, st === 'valid' ? tint(C.green, 0.07) : st === 'missed' ? tint(C.orange, 0.08) : C.panel, st === 'valid' ? '#2d6a47' : st === 'missed' ? '#8a5a2b' : C.line, 2));
    out.push(T(L, y + 52, 'JETZT', { size: 26, weight: 700, fill: C.label, spacing: 3 }));
    const right = st ? Math.max(textWidth(m.now.label, 32, 800), textWidth(m.now.detail || '', 26, 500)) : 0, leftMax = Rr - L - right - 30;
    if (m.now.price) {
      out.push(T(L, y + 102, m.now.price, { size: fitSize(m.now.price, 44, 800, leftMax, 28), weight: 800, fill: C.text }));
      if (m.now.dist) { const dt = `${m.now.dist} zum Einstieg`; out.push(T(L, y + 144, dt, { size: fitSize(dt, 28, 700, leftMax, 20), weight: 700, fill: col })); }
    } else out.push(T(L, y + 104, 'Kurs nicht verfügbar', { size: 32, weight: 600, fill: C.muted }));
    if (st) { out.push(T(Rr, y + 62, m.now.label, { size: 32, weight: 800, fill: col, anchor: 'end' })); if (m.now.detail) out.push(T(Rr, y + 102, m.now.detail, { size: 26, weight: 500, fill: C.soft, anchor: 'end' })); }
    y += jh + 24;
  }
  // 2) Musterqualität (neutral blau, keine Erfolgswahrscheinlichkeit), Erlernt je Muster erst ab 30 Fällen mit Zahl, darunter Bereich, Coin-Zahl und Zufallsvergleich
  const more = m.learned ? m.learnedMore || [] : [], qh = 150 + (m.learned ? 44 : 0) + (more.length ? more.length * 38 + 18 : 0);
  out.push(R(X, y, Wp, qh, 24, C.panel, C.line, 2), T(L, y + 58, 'MUSTERQUALITÄT', { size: 26, weight: 700, fill: C.label, spacing: 3 }));
  out.push(T(Rr, y + 64, m.quality, { size: na(m.quality) ? 32 : 48, weight: na(m.quality) ? 600 : 800, fill: na(m.quality) ? C.muted : C.text, anchor: 'end' }));
  out.push(R(L, y + 84, Rr - L, 18, 9, C.track)); if (m.qualityBar !== null) out.push(R(L, y + 84, n1(Math.max(18, (Rr - L) * m.qualityBar / 100)), 18, 9, C.blue));
  out.push(T(L, y + 136, m.qualityNote, { size: fitSize(m.qualityNote, 26, 500, Rr - L, 20), weight: 500, fill: C.soft }));
  if (m.learned) { const t = `Erlernt: ${m.learned}.`; out.push(T(L, y + 178, t, { size: fitSize(t, 26, 500, Rr - L, 20), weight: 500, fill: C.soft })); }
  more.forEach((t, i) => out.push(T(L, y + 216 + i * 38, t, { size: fitSize(t, 24, 500, Rr - L, 18), weight: 500, fill: C.muted })));
  y += qh;
  // 6) Fuß: Hinweis klein, Zeitstempel mit Datum und Modell
  const H = y + 88, foot = `${m.time} · Modell ${m.model}`;
  out.push(T(48, H - 36, m.hint, { size: 24, weight: 500, fill: C.muted }), T(W - 48, H - 36, foot, { size: fitSize(foot, 24, 500, W - 96 - textWidth(m.hint, 24, 500) - 30, 18), weight: 500, fill: C.muted, anchor: 'end' }));
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.bg2}"/><stop offset="1" stop-color="${C.bg}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#bg)"/>${out.join('')}</svg>`, width: W, height: H };
}

// Bequem: Signaldaten → Modell → SVG (App und Dienste). opts wie patternSignalModel (now, timezone, settings) plus preview.
export function patternSignalCard(data, opts = {}) {
  const m = patternSignalModel(data, opts), nowAt = opts.now ?? data.now ?? data.at;
  return { model: m, ...patternCardSvg({ ...m, iv: data.timeframe, tc: data.tc, nowAt }, { preview: !!opts.preview }) };
}
