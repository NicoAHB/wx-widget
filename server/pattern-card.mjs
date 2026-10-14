// Oracle-Musterdienst 1.2.0: Chartmuster-Meldung als Trading-Karte (PNG, 1024 × 1536, bei mehr Inhalt höher).
// Programmatisch: SVG aus den strukturierten Signaldaten, gerendert mit resvg (kostenlos, lokal, ohne Bild-KI) – Zahlen und Texte
// kommen unverändert aus denselben Daten wie die bisherige Textmeldung (formatMessage('pattern', …)). Fehlende Angaben stehen als
// „Nicht verfügbar“ da, nichts wird erfunden. „Regelgüte“ ist ausdrücklich keine Erfolgswahrscheinlichkeit.
// resvg ist optional (npm install im Ordner server): Fehlt es oder scheitert das Rendern, sendet der Dienst die bisherige Textmeldung.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const base = fs.existsSync(new URL('./shared/telegram-format.mjs', import.meta.url)) ? './shared/' : '../shared/';
const TF = await import(new URL(base + 'telegram-format.mjs', import.meta.url));
const { telegramPrice, telegramRelative, telegramPercent, telegramNumber, telegramDirection, escapeTelegram } = TF;

export const CARD_W = 1024, CARD_H = 1536, NA = 'Nicht verfügbar';
export const CARD_FONT = "Inter, 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif";
const C = { bg: '#0a1222', bg2: '#0e1a30', panel: '#121c31', line: '#1f2b44', text: '#f4f7fb', soft: '#c9d4e8', label: '#a7b4cd', muted: '#8a99b5',
  green: '#4ade80', red: '#f87171', yellow: '#fbbf24', track: '#24314c' };
const finite = v => typeof v === 'number' && Number.isFinite(v);
const has = v => v !== null && v !== undefined && String(v).trim() !== '';

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
const fitSize = (s, size, weight, max, min = Math.round(size * 0.6), spacing = 0) => { let z = size; while (z > min && textWidth(s, z, weight, spacing) > max) z -= 1; return z; };
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

const TIMEFRAMES = { m: ['Minute', 'Minuten'], h: ['Stunde', 'Stunden'], d: ['Tag', 'Tage'], w: ['Woche', 'Wochen'], M: ['Monat', 'Monate'] };
export function timeframeName(iv) {
  const m = /^(\d+)([mhdwM])$/.exec(String(iv || ''));
  if (!m) return has(iv) ? String(iv) : null;
  const n = Number(m[1]), [one, many] = TIMEFRAMES[m[2]];
  return `${n} ${n === 1 ? one : many}`;
}

// ---- Daten der Karte: genau wie die Textmeldung, fehlende Werte „Nicht verfügbar“ ----
export function patternCardModel(d = {}, { at = d.at, timezone = d.timezone || 'Europe/Berlin' } = {}) {
  const dirRaw = d.direction ?? d.dir, dir = has(dirRaw) ? telegramDirection(dirRaw) : null;
  const pair = has(d.pair) ? String(d.pair) : has(d.symbol) ? String(d.symbol).replace(/USDT$/, '/USDT') : null;
  const money = v => finite(v) ? telegramPrice(v) + ' USD' : null, pct = (v, b) => { const p = telegramRelative(v, b); return finite(p) ? telegramPercent(p) : null; };
  const risk = finite(d.entry) && finite(d.invalid) ? Math.abs(d.entry - d.invalid) : null, reward = finite(d.entry) && finite(d.target) ? Math.abs(d.target - d.entry) : null;
  const crv = risk > 0 && finite(reward) ? reward / risk : null;
  const s = d.learned || null; let learned = null, learnedWarn = false, learnedSub = [];
  if (s) {
    const n = s.total ?? s.n, sign = dir?.sign ?? 0, yes = sign > 0 ? s.up ?? s.auf : sign < 0 ? s.down ?? s.ab : null, minimum = s.minimum ?? 10;
    if (finite(n) && finite(yes)) {
      learned = `${telegramNumber(yes, 0)}/${telegramNumber(n, 0)} Fälle`; learnedWarn = n < minimum;
      learnedSub = [[has(s.source) ? `Datenbasis: ${s.source}` : '', finite(s.horizon) ? `nach ${s.horizon} Kerzen` : ''].filter(Boolean).join(' · '),
        [['Aufwärts', s.up ?? s.auf], ['Abwärts', s.down ?? s.ab], ['Seitwärts', s.flat ?? s.seitwärts ?? s.seit]].filter(([, v]) => finite(v)).map(([k, v]) => `${k} ${telegramNumber(v, 0)}`).join(' · ')].filter(Boolean);
    } else if (finite(s.available)) { learned = `${telegramNumber(s.available, 0)}/${telegramNumber(minimum, 0)} Fälle`; learnedWarn = s.available < minimum; }
  }
  let time = null;
  if (finite(at)) { const o = { hour: '2-digit', minute: '2-digit', second: '2-digit' }; try { time = new Date(at).toLocaleTimeString('de-DE', { ...o, timeZone: timezone }); } catch { time = new Date(at).toLocaleTimeString('de-DE', { ...o, timeZone: 'Europe/Berlin' }); } }
  const status = has(d.status) ? String(d.status) : null;
  return {
    pair: pair ?? NA, market: has(d.market) ? String(d.market) : NA, timeframe: timeframeName(d.timeframe) ?? NA,
    direction: dir ? dir.label : NA, dirSign: dir?.sign ?? 0, pattern: has(d.pattern) ? String(d.pattern) : NA, status: status ?? NA, confirmed: !!status && /bestätigt/i.test(status),
    entry: money(d.entry) ?? NA, target: money(d.target) ?? NA, targetPct: pct(d.target, d.entry), invalid: money(d.invalid) ?? NA, invalidPct: pct(d.invalid, d.entry),
    crv: finite(crv) ? telegramNumber(crv, 2) + ' : 1' : NA, crvWarn: finite(crv) && crv < 1,
    quality: finite(d.quality) ? telegramNumber(d.quality, Number.isInteger(d.quality) ? 0 : 2) + ' %' : NA, qualityBar: finite(d.quality) ? Math.max(0, Math.min(100, d.quality)) : null,
    learned: learned ?? NA, learnedWarn, learnedSub,
    score: finite(d.score) ? `${telegramNumber(d.score, 0)}/100` : null, scoreWhy: has(d.scoreWhy) ? String(d.scoreWhy) : null,
    hint: 'Kursrichtung ≠ Zieltreffer', qualityNote: 'Keine Erfolgswahrscheinlichkeit',
    time: time ?? NA, model: has(d.model) ? String(d.model) : NA,
  };
}
// Kurze Bildunterschrift: Handelspaar, Zeitrahmen, Status
export const patternCaption = m => `<b>${escapeTelegram(m.pair)}</b> · ${escapeTelegram(m.timeframe)} · ${escapeTelegram(m.status)}`;

// ---- SVG ----
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const T = (x, y, s, { size = 32, weight = 700, fill = C.text, anchor = 'start', spacing = 0 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${CARD_FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}${spacing ? ` letter-spacing="${spacing}"` : ''}>${esc(s)}</text>`;
const R = (x, y, w, h, r, fill, stroke = '', sw = 2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`;
const warnIcon = (x, y, s, fill = C.yellow) => `<g transform="translate(${x} ${y}) scale(${s / 48})"><path d="M24 4 L46 43 Q47 46 44 46 L4 46 Q1 46 2 43 Z" fill="${fill}" stroke="${fill}" stroke-width="3" stroke-linejoin="round"/><rect x="21.5" y="16" width="5" height="17" rx="2.5" fill="#1a1405"/><circle cx="24" cy="39" r="3" fill="#1a1405"/></g>`;
const checkIcon = (cx, cy, r, ok) => ok
  ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.green}"/><path d="M${cx - r * 0.42} ${cy + r * 0.02} L${cx - r * 0.1} ${cy + r * 0.34} L${cx + r * 0.44} ${cy - r * 0.3}" fill="none" stroke="#06210f" stroke-width="${r * 0.2}" stroke-linecap="round" stroke-linejoin="round"/>`
  : `<circle cx="${cx}" cy="${cy}" r="${r - 2}" fill="none" stroke="${C.muted}" stroke-width="4"/><rect x="${cx - r * 0.36}" y="${cy - 3}" width="${r * 0.72}" height="6" rx="3" fill="${C.muted}"/>`;
const arrowIcon = (x, y, s, up, color) => {
  const a = up ? `M${x} ${y + s} L${x + s} ${y}` : `M${x} ${y} L${x + s} ${y + s}`, h = s * 0.55;
  const head = up ? `M${x + s - h} ${y} L${x + s} ${y} L${x + s} ${y + h}` : `M${x + s - h} ${y + s} L${x + s} ${y + s} L${x + s} ${y + s - h}`;
  return `<path d="${a} ${head}" fill="none" stroke="${color}" stroke-width="${s * 0.17}" stroke-linecap="round" stroke-linejoin="round"/>`;
};
const bulbIcon = (cx, cy, s, color = C.yellow) => `<g fill="none" stroke="${color}" stroke-width="${s * 0.11}" stroke-linecap="round" stroke-linejoin="round"><path d="M${cx - s * 0.2} ${cy + s * 0.28} Q${cx - s * 0.2} ${cy + s * 0.08} ${cx - s * 0.34} ${cy - s * 0.06} A${s * 0.38} ${s * 0.38} 0 1 1 ${cx + s * 0.34} ${cy - s * 0.06} Q${cx + s * 0.2} ${cy + s * 0.08} ${cx + s * 0.2} ${cy + s * 0.28} Z"/><path d="M${cx - s * 0.17} ${cy + s * 0.42} L${cx + s * 0.17} ${cy + s * 0.42}"/><path d="M${cx - s * 0.1} ${cy + s * 0.55} L${cx + s * 0.1} ${cy + s * 0.55}"/></g>`;

export function patternCardSvg(m, { preview = false } = {}) {
  const X = 40, Wp = CARD_W - 2 * X, L = X + 32, Rr = CARD_W - X - 28, out = [];
  const up = m.dirSign > 0, down = m.dirSign < 0, dirColor = up ? C.green : down ? C.red : C.soft;
  const na = v => v === NA;
  // Kopf: Kennzeichen, „BEISPIEL“ nur in Vorschauen
  out.push(T(52, 86, 'TRADING-SIGNAL', { size: 26, weight: 700, fill: C.soft, spacing: 5 }));
  if (preview) { const lw = textWidth('TRADING-SIGNAL', 26, 700, 5) + 52 + 24, bw = textWidth('BEISPIEL', 23, 700, 2) + 36; out.push(R(lw, 52, bw, 48, 13, 'none', '#7f90b0', 2), T(lw + bw / 2, 85, 'BEISPIEL', { size: 23, weight: 700, fill: C.soft, anchor: 'middle', spacing: 2 })); }
  // Richtung als Kennzeichen rechts (Farbe + Wort + Pfeil)
  const dSize = fitSize(m.direction, 42, 800, 300), pillW = Math.round(textWidth(m.direction, dSize, 800) + (m.dirSign ? 118 : 64)), pillX = CARD_W - X - pillW;
  out.push(R(pillX, 124, pillW, 88, 30, up ? 'rgba(74,222,128,0.10)' : down ? 'rgba(248,113,113,0.10)' : 'rgba(201,212,232,0.06)', dirColor, 2.5));
  if (m.dirSign) out.push(arrowIcon(pillX + 34, 150, 34, up, dirColor));
  out.push(T(pillX + (m.dirSign ? 88 : 32), 183, m.direction, { size: dSize, weight: 800, fill: na(m.direction) ? C.muted : dirColor }));
  // Handelspaar, Markt und Zeitrahmen
  const pairSize = fitSize(m.pair, 104, 800, pillX - 52 - 28, 56);
  out.push(T(48, 196, m.pair, { size: pairSize, weight: 800, fill: na(m.pair) ? C.muted : C.text }));
  const sub = `${m.market}\u2002•\u2002${m.timeframe}`; // feste Leerräume (SVG fasst normale Leerzeichen zusammen)
  out.push(T(52, 256, sub, { size: fitSize(sub, 40, 500, Wp - 20), weight: 500, fill: C.soft }));
  // Muster (lange Namen umbrechen) und Bestätigungsstatus
  let y = 352; const pw = wrapText(m.pattern, 76, 800, Wp - 16, 3, 54);
  pw.lines.forEach((line, i) => out.push(T(48, y + i * Math.round(pw.size * 1.12), line, { size: pw.size, weight: 800, fill: na(m.pattern) ? C.muted : C.text })));
  y += (pw.lines.length - 1) * Math.round(pw.size * 1.12) + 76;
  const st = fitSize(m.status, 44, 700, Wp - 110, 30);
  out.push(checkIcon(82, y - 14, 32, m.confirmed), T(140, y, m.status, { size: st, weight: 700, fill: m.confirmed ? C.green : na(m.status) ? C.muted : C.soft }));
  y += 52;
  // Preisfelder: Einstieg, Ziel (grün), Ungültig bei (rot) – alle drei Preise in derselben Größe
  const vx = 440, room = (v, pct) => (pct ? Rr - textWidth(pct, 38, 700) - 22 : Rr) - vx;
  const priceSize = Math.min(...[[m.entry, null], [m.target, m.targetPct], [m.invalid, m.invalidPct]].filter(([v]) => !na(v)).map(([v, p]) => fitSize(v, 52, 800, room(v, p), 34)), 52);
  const priceRow = (label, value, pct, pctColor) => {
    out.push(R(X, y, Wp, 106, 18, C.panel, C.line, 2), T(L, y + 64, label, { size: 30, weight: 700, fill: C.label, spacing: 2.5 }));
    if (na(value)) out.push(T(vx, y + 66, value, { size: 38, weight: 600, fill: C.muted }));
    else out.push(T(vx, y + 70, value, { size: priceSize, weight: 800, fill: C.text }));
    if (pct) out.push(T(Rr, y + 68, pct, { size: 38, weight: 700, fill: pctColor, anchor: 'end' }));
    y += 106 + 18;
  };
  priceRow('EINSTIEG', m.entry, null);
  priceRow('ZIEL', m.target, m.targetPct, C.green);
  priceRow('UNGÜLTIG BEI', m.invalid, m.invalidPct, C.red);
  // Chance/Risiko mit Warnung (Symbol + Wort)
  out.push(R(X, y, Wp, 100, 18, C.panel, C.line, 2), T(L, y + 62, 'Chance / Risiko', { size: 34, weight: 700, fill: C.label }));
  if (na(m.crv)) out.push(T(vx, y + 64, m.crv, { size: 38, weight: 600, fill: C.muted }));
  else {
    out.push(T(vx, y + 66, m.crv, { size: 50, weight: 800, fill: C.text }));
    if (m.crvWarn) { const wx = vx + textWidth(m.crv, 50, 800) + 32, ws = fitSize('Chance < Risiko', 28, 700, Rr - wx - 58, 20); out.push(warnIcon(wx, y + 27, 46), T(wx + 58, y + 62, 'Chance < Risiko', { size: ws, weight: 700, fill: C.yellow })); }
  }
  y += 100 + 18;
  // Regelgüte (keine Wahrscheinlichkeit), Lernstand mit Warnung
  const subH = m.learnedSub.length * 40, scoreH = 0, boxH = 300 + subH + scoreH;
  out.push(R(X, y, Wp, boxH, 18, C.panel, C.line, 2), T(L, y + 66, 'REGELGÜTE', { size: 30, weight: 700, fill: C.label, spacing: 2.5 }));
  out.push(T(vx, y + 70, m.quality, { size: na(m.quality) ? 38 : 52, weight: na(m.quality) ? 600 : 800, fill: na(m.quality) ? C.muted : C.text }));
  out.push(R(L, y + 98, Rr - L, 26, 13, C.track));
  if (m.qualityBar !== null) out.push(R(L, y + 98, Math.max(26, (Rr - L) * m.qualityBar / 100), 26, 13, C.green));
  out.push(T(L, y + 168, m.qualityNote, { size: 30, weight: 500, fill: C.soft }));
  out.push(`<line x1="${L}" y1="${y + 204}" x2="${Rr}" y2="${y + 204}" stroke="${C.line}" stroke-width="2"/>`);
  out.push(T(L, y + 266, 'Erlernt', { size: 34, weight: 700, fill: C.label }));
  const chipW = m.learnedWarn ? Math.round(textWidth('Zu wenig Daten', 30, 700) + 104) : 0, lx = 380;
  out.push(T(lx, y + 270, m.learned, { size: na(m.learned) ? 38 : fitSize(m.learned, 46, 800, Rr - lx - chipW - 24, 32), weight: na(m.learned) ? 600 : 800, fill: na(m.learned) ? C.muted : C.text }));
  if (m.learnedWarn) { const cx = Rr - chipW; out.push(R(cx, y + 224, chipW, 72, 16, 'rgba(251,191,36,0.10)', '#a77b18', 2), warnIcon(cx + 22, y + 238, 44), T(cx + 80, y + 271, 'Zu wenig Daten', { size: 30, weight: 700, fill: C.yellow })); }
  m.learnedSub.forEach((s, i) => out.push(T(L, y + 318 + i * 40, s, { size: 28, weight: 500, fill: C.soft })));
  y += boxH + 18;
  // Signalscore (nur wenn vorhanden)
  if (m.score) {
    const why = m.scoreWhy ? wrapText(m.scoreWhy, 30, 500, Wp - 64, 2, 26) : { lines: [], size: 30 }, h = 104 + why.lines.length * 40;
    out.push(R(X, y, Wp, h, 18, C.panel, C.line, 2), T(L, y + 64, 'SIGNALSCORE', { size: 30, weight: 700, fill: C.label, spacing: 2.5 }), T(vx, y + 68, m.score, { size: 50, weight: 800, fill: C.text }));
    why.lines.forEach((s, i) => out.push(T(L, y + 112 + i * 40, s, { size: why.size, weight: 500, fill: C.soft })));
    y += h + 18;
  }
  // Hinweis
  out.push(R(X, y, Wp, 138, 18, C.panel, C.line, 2), bulbIcon(96, y + 66, 64), `<line x1="156" y1="${y + 36}" x2="156" y2="${y + 102}" stroke="${C.line}" stroke-width="2"/>`);
  out.push(T(188, y + 84, m.hint, { size: fitSize(m.hint, 44, 800, Rr - 188), weight: 800, fill: C.text }));
  y += 138;
  // Fuß: Zeit und Modell
  const H = Math.max(CARD_H, y + 108), fy = Math.max(y + 70, H - 44);
  out.push(T(52, fy, `${m.time}\u2002•\u2002Modell${na(m.model) ? ':' : ''} ${m.model}`, { size: 30, weight: 500, fill: C.muted }));
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${H}" viewBox="0 0 ${CARD_W} ${H}"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.bg2}"/><stop offset="1" stop-color="${C.bg}"/></linearGradient></defs><rect width="${CARD_W}" height="${H}" fill="url(#bg)"/>${out.join('')}</svg>`, width: CARD_W, height: H };
}

// ---- PNG über resvg (optional installiert) ----
let resvg = null;
async function loadResvg() {
  if (!resvg) resvg = import('@resvg/resvg-js').then(m => m.Resvg || m.default?.Resvg).catch(() => null);
  const R = await resvg; if (!R) throw new Error('Kartenrenderer fehlt (im Ordner server: npm install)'); return R;
}
// 1.2.1: Schrift mitgeliefert (fonts/: Inter und DejaVu Sans als verkleinerte Untermengen, Lizenzen in fonts/LIZENZ.md). Vorher nahm
// resvg nur Systemschriften – auf Servern ohne Schriften (minimale Ubuntu-Abbilder bei Oracle) kam die Karte ganz ohne Text an.
// Mit den mitgelieferten Dateien rendert jeder Server gleich; Systemschriften nur, falls der Ordner fehlt.
const FONT_DIR = new URL('./fonts/', import.meta.url);
export const CARD_FONT_FILES = Object.freeze(['Inter-Regular.otf', 'Inter-Medium.otf', 'Inter-SemiBold.otf', 'Inter-Bold.otf', 'Inter-ExtraBold.otf', 'Inter-Black.otf', 'DejaVuSans.ttf', 'DejaVuSans-Bold.ttf']
  .map(f => fileURLToPath(new URL(f, FONT_DIR))).filter(f => fs.existsSync(f)));
const fontOptions = (extra = [], system, bundled = true) => { const own = bundled ? CARD_FONT_FILES : []; return { loadSystemFonts: system ?? !own.length, fontFiles: [...own, ...extra], defaultFontFamily: 'Inter' }; };
// Zeichnet die Schrift wirklich? Ohne passende Schrift lässt resvg Text stillschweigend weg – dann lieber die Textmeldung.
const textCheck = new Map();
async function textRenders(R, font) {
  const key = JSON.stringify(font); if (textCheck.get(key)) return true;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="44"><text x="6" y="32" font-family="${CARD_FONT}" font-size="28" font-weight="700" fill="#000">Ag 0,5 €</text></svg>`;
  const px = new R(svg, { font }).render().pixels; let ink = 0; for (let i = 3; i < px.length && ink < 50; i += 4) if (px[i] > 0) ink++;
  if (ink >= 50) textCheck.set(key, true); return ink >= 50;
}
// Beim Start prüfen, ob Karten möglich sind (sonst sendet der Dienst Text): 'ok', 'renderer' (resvg fehlt) oder 'schrift' (keine Schrift)
export async function cardRendererStatus({ fontFiles = [], loadSystemFonts, bundledFonts = true } = {}) {
  let R; try { R = await loadResvg(); } catch { return 'renderer'; }
  try { return await textRenders(R, fontOptions(fontFiles, loadSystemFonts, bundledFonts)) ? 'ok' : 'schrift'; } catch { return 'schrift'; }
}
export async function cardRendererReady(options) { return await cardRendererStatus(options) === 'ok'; }
export async function renderPatternCard(data, { at, timezone, preview = false, fontFiles = [], loadSystemFonts, bundledFonts = true } = {}) {
  const m = patternCardModel(data, { at, timezone }), { svg, width, height } = patternCardSvg(m, { preview });
  const Resvg = await loadResvg(), font = fontOptions(fontFiles, loadSystemFonts, bundledFonts);
  if (!await textRenders(Resvg, font)) throw new Error('Keine Schrift für die Karte gefunden – Karte wäre ohne Text');
  const png = new Resvg(svg, { fitTo: { mode: 'original' }, font }).render().asPng();
  if (!png?.length) throw new Error('Kartenrenderer lieferte kein Bild');
  return { png: Buffer.from(png), width, height, model: m, caption: patternCaption(m), svg };
}
// Beispiel aus der Vorgabe (für Vorschau und Tests)
export const EXAMPLE_SIGNAL = Object.freeze({ pattern: 'Dreifach-Boden', symbol: 'LTCUSDT', market: 'Spot', timeframe: '5m', status: 'Ausbruch bestätigt', direction: 'bull',
  entry: 62.07, target: 62.8767, invalid: 60.67, quality: 83, model: 'pat-1', learned: { available: 2, minimum: 10 } });
