// 3.71.0 / Dienst 2.15.0: Kurs-Alarm als Bild (Chat Kursalarm) – derselbe Look wie Gewinn-/Verlust-Alarm und Chartmuster. Nur
// Darstellung: Level und Auslösung bleiben, wie sie sind. Kopf „KURS-ALARM · AUFWÄRTS/ABWÄRTS“ mit Uhrzeit, Symbol grau, Kurs groß in
// der Alarmfarbe, Leiste mit Level-Strich und Kurspunkt (aufwärts rechts, abwärts links), Karte Level / Abstand / Auslösung (Notiz nur,
// wenn eine eingetragen ist), Fuß mit Datum und Botname. Keine Emojis; Bildunterschrift eine Zeile („Kurs-Alarm · BTC · 81.840,13 USD“).
import { textWidth, fitSize, CARD_FONT } from './pattern-signal-card.mjs';
import { PNL_CARD_COLORS } from './pnl-alarm-card.mjs';
import { telegramPrice, priceDigits } from './telegram-format.mjs';

export const ALARM_CARD_W = 1080;
const C = PNL_CARD_COLORS, finite = v => typeof v === 'number' && Number.isFinite(v);
function stamp(at, timezone, o) { try { return new Date(at).toLocaleString('de-DE', { ...o, timeZone: timezone }); } catch { return new Date(at).toLocaleString('de-DE', { ...o, timeZone: 'Europe/Berlin' }); } }
const num = (v, d) => Math.abs(v).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

// Eingabe: { symbol, direction ('above'/'below'), level, price, reached (Text wie bisher, z. B. „erreicht“), note, at, timezone, bot }
export function priceAlarmModel(d = {}, { timezone = d.timezone || 'Europe/Berlin' } = {}) {
  const up = !['below', 'down', 'bear'].includes(d.direction ?? d.dir), coin = String(d.symbol || '').toUpperCase().replace(/USDT$/, '') || '—';
  const price = finite(d.price) && d.price > 0 ? d.price : null, level = finite(d.level) && d.level > 0 ? d.level : null;
  const dist = price !== null && level !== null ? price - level : null, pct = dist !== null ? dist / level * 100 : null;
  const sign = v => v < 0 ? '−' : v > 0 ? '+' : '±';
  const pctText = pct === null ? '' : num(pct, 2) === '0,00' ? '<0,01 %' : `${sign(pct)}${num(pct, 2)} %`;   // Vorgabe: 0,00 % → „<0,01 %“
  const at = finite(d.at) ? d.at : null;
  return {
    up, label: `KURS-ALARM · ${up ? 'AUFWÄRTS' : 'ABWÄRTS'}`, coin, price, level,
    priceText: price !== null ? telegramPrice(price) : '—', levelText: level !== null ? telegramPrice(level) + ' USD' : '—', cond: up ? 'auf/über' : 'auf/unter',
    dist, pct, distText: dist !== null ? `${sign(dist)}${num(dist, priceDigits(level))} USD (${pctText})` : '—',
    reached: String(d.reached || 'erreicht'), note: String(d.note || '').trim(),
    time: at !== null ? stamp(at, timezone, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '', date: at !== null ? stamp(at, timezone, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '',
    bot: String(d.bot || '').trim() || 'Scalp Desk'
  };
}
export const priceAlarmCaption = m => `Kurs-Alarm · ${m.coin} · ${m.priceText}${m.price !== null ? ' USD' : ''}`;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const T = (x, y, s, { size = 32, weight = 700, fill = C.text, anchor = 'start', spacing = 0 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${CARD_FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}${spacing ? ` letter-spacing="${spacing}"` : ''}>${esc(s)}</text>`;
const R = (x, y, w, h, r, fill, stroke = '', sw = 2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`;
const n1 = v => Math.round(v * 10) / 10;
// Text in die Breite einpassen; notfalls auf zwei Zeilen (Auslösung „kurz per Docht erreicht (bis …)“, Notiz)
function lines(s, size, weight, max) {
  if (textWidth(s, size, weight) <= max) return [s];
  const words = String(s).split(/\s+/), out = ['']; for (const w of words) { const next = out.at(-1) ? out.at(-1) + ' ' + w : w; if (textWidth(next, size, weight) <= max || !out.at(-1)) out[out.length - 1] = next; else out.push(w); }
  if (out.length > 2) { out.length = 2; let l = out[1]; while (l.length > 1 && textWidth(l + '…', size, weight) > max) l = l.slice(0, -1); out[1] = l + '…'; }
  return out;
}

export function priceAlarmSvg(m) {
  const W = ALARM_CARD_W, X = 64, out = [], col = m.up ? C.green : C.red;
  // 1) Kopf
  const lw = Math.round(textWidth(m.label, 30, 800, 3) + 92);
  out.push(R(X, 56, lw, 76, 18, m.up ? C.greenBg : C.redBg), `<circle cx="${X + 34}" cy="94" r="10" fill="${col}"/>`, T(X + 60, 105, m.label, { size: 30, weight: 800, fill: col, spacing: 3 }));
  if (m.time) out.push(T(W - X, 105, m.time, { size: 32, weight: 600, fill: C.muted, anchor: 'end' }));
  // 2) Symbol grau, Kurs groß in der Alarmfarbe
  out.push(T(X, 206, m.coin, { size: fitSize(m.coin, 36, 700, W - 2 * X), weight: 700, fill: C.muted, spacing: 2 }));
  const ps = fitSize(m.priceText, 140, 800, W - 2 * X - 170, 70), pw = textWidth(m.priceText, ps, 800);
  out.push(T(X - 4, 340, m.priceText, { size: ps, weight: 800, fill: m.price === null ? C.muted : col }), T(n1(X + pw / 1.04 + 20), 340, 'USD', { size: 56, weight: 800, fill: m.price === null ? C.muted : col }));
  // 3) Leiste: Strich, Level-Markierung in der Mitte, Kurspunkt rechts (aufwärts) bzw. links (abwärts) – Abstand wächst mit dem Prozentwert
  const by = 392, bh = 150, lx = X + 44, rx = W - X - 44, cx = (lx + rx) / 2, ly = by + 98;
  const f = Math.min(0.9, 0.08 + (finite(m.pct) ? Math.abs(m.pct) / 2 : 0)), dx = (rx - cx) * f;
  out.push(R(X, by, W - 2 * X, bh, 26, C.card, C.line, 2), `<line x1="${lx}" y1="${ly}" x2="${rx}" y2="${ly}" stroke="${C.line}" stroke-width="8" stroke-linecap="round"/>`);
  out.push(T(cx, by + 52, 'LEVEL', { size: 22, weight: 700, fill: C.muted, anchor: 'middle', spacing: 2 }), `<line x1="${cx}" y1="${ly - 26}" x2="${cx}" y2="${ly + 26}" stroke="${C.text}" stroke-width="5" stroke-linecap="round"/>`);
  if (m.price !== null) out.push(`<circle cx="${n1(cx + (m.up ? dx : -dx))}" cy="${ly}" r="17" fill="${col}" stroke="${C.card}" stroke-width="4"/>`);
  // 4) Karte: Level, Abstand, Auslösung (Notiz nur, wenn vorhanden)
  const L = X + 44, Rr = W - X - 44, rows = [['LEVEL', 'level'], ['ABSTAND', 'dist'], ['AUSLÖSUNG', 'reached'], ...(m.note ? [['NOTIZ', 'note']] : [])];
  const cy0 = by + bh + 30, valMax = Rr - L - 250;
  // Auslösung/Notiz: erst kleiner (bis 30 px), dann notfalls zwei Zeilen
  const fit = k => { const w = k === 'note' ? 600 : 800, z = fitSize(m[k], 38, w, valMax, 30); return textWidth(m[k], z, w) <= valMax ? { ls: [m[k]], z, w } : { ls: lines(m[k], 32, w, valMax), z: 32, w }; };
  const heights = rows.map(([, k]) => k === 'reached' || k === 'note' ? (fit(k).ls.length > 1 ? 144 : 108) : 108), ch = heights.reduce((a, b) => a + b, 0) + 24;
  out.push(R(X, cy0, W - 2 * X, ch, 30, C.card, C.line, 2));
  let ry = cy0 + 12;
  rows.forEach(([label, k], i) => {
    if (i) out.push(`<line x1="${L}" y1="${ry}" x2="${Rr}" y2="${ry}" stroke="${C.line}" stroke-width="2"/>`);
    out.push(T(L, ry + 66, label, { size: 28, weight: 700, fill: C.muted, spacing: 3 }));
    if (k === 'level') {
      const cw = textWidth(m.cond, 28, 500) + 18, vs = fitSize(m.levelText, 40, 800, valMax - cw, 28);
      out.push(T(Rr, ry + 68, m.cond, { size: 28, weight: 500, fill: C.muted, anchor: 'end' }), T(n1(Rr - cw), ry + 68, m.levelText, { size: vs, weight: 800, fill: C.text, anchor: 'end' }));
    } else if (k === 'dist') out.push(T(Rr, ry + 68, m.distText, { size: fitSize(m.distText, 40, 700, valMax, 26), weight: 700, fill: m.dist === null ? C.muted : col, anchor: 'end' }));
    else { const { ls, z, w } = fit(k); ls.forEach((l, j) => out.push(T(Rr, ry + 68 + j * 42, l, { size: z, weight: w, fill: k === 'note' ? C.soft : C.text, anchor: 'end' }))); }
    ry += heights[i];
  });
  // 5) Fuß: Datum und Botname
  const H = Math.max(1080, cy0 + ch + 150), foot = [m.date, m.bot].filter(Boolean).join(' · ');
  out.push(T(X, H - 60, foot, { size: fitSize(foot, 28, 500, W - 2 * X), weight: 500, fill: C.faint }));
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${C.bg}"/>${out.join('')}</svg>`, width: W, height: H };
}
export function priceAlarmCard(data, opts = {}) {
  const m = priceAlarmModel(data, opts);
  return { model: m, caption: priceAlarmCaption(m), ...priceAlarmSvg(m) };
}
