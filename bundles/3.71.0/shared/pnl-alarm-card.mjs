// 3.71.0 / Dienst 2.15.0: Gewinn-/Verlust-Alarm als Bild (Chat Kursalarm) – dieselbe Karte aus der App (Canvas → PNG) und aus dem
// 24/7-Dienst (resvg → PNG). Nur Darstellung: Schwellen und Auslösung bleiben, wie sie sind. Kopf mit Label und Uhrzeit, große Zahl
// (Live-Ergebnis in USD), „Schwelle erreicht · ≥/≤ …“, Karte „OFFENE POSITIONEN · n“ (höchstens 5 Zeilen, Rest als „+ X weitere“),
// Fuß mit Datum und Botname. Keine Emojis im Bild; die Bildunterschrift ist eine kurze Zeile („Verlust-Alarm · −170,10 USD“).
import { textWidth, fitSize, CARD_FONT } from './pattern-signal-card.mjs';

export const PNL_CARD_W = 1080, PNL_CARD_MAX_ROWS = 5;
export const PNL_CARD_COLORS = Object.freeze({ bg: '#0E1A2E', card: '#131F36', line: '#22304d', text: '#f4f7fb', soft: '#c9d4e8', muted: '#94a3b8', faint: '#6f7d97',
  red: '#F87171', redBg: '#3a1c25', green: '#4ADE80', greenBg: '#16351f' });
const C = PNL_CARD_COLORS, finite = v => typeof v === 'number' && Number.isFinite(v);
const de = (v, d = 2) => Math.abs(v).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const signedUsd = v => `${v < 0 ? '−' : v > 0 ? '+' : ''}${de(v)}`;
const pairOf = s => String(s || '').toUpperCase().replace(/USDT$/, '/USDT');
function stamp(at, timezone, o) { try { return new Date(at).toLocaleString('de-DE', { ...o, timeZone: timezone }); } catch { return new Date(at).toLocaleString('de-DE', { ...o, timeZone: 'Europe/Berlin' }); } }

// Eingabe: { profit, pnl (Live-Ergebnis USD), level (Schwelle, positiv), positions: [{ symbol, side, pnl }], at, timezone, bot }
// Die Zeilen werden auf Cent gerundet und so ausgeglichen, dass ihre Summe genau der großen Zahl entspricht (Restcent an die größte Zeile).
export function pnlCardModel(d = {}, { timezone = d.timezone || 'Europe/Berlin' } = {}) {
  const profit = d.profit !== false, total = finite(d.pnl) ? Math.round(d.pnl * 100) / 100 : null;
  const raw = (Array.isArray(d.positions) ? d.positions : []).filter(p => p && finite(p.pnl)).map((p, i) => ({ i, symbol: pairOf(p.symbol), side: p.side === 'short' ? 'Short' : 'Long', cents: Math.round(p.pnl * 100), exact: p.pnl }));
  if (total !== null && raw.length) {
    const diff = Math.round(total * 100) - raw.reduce((s, r) => s + r.cents, 0);
    if (diff && Math.abs(diff) <= raw.length) raw.reduce((a, b) => Math.abs(b.exact) > Math.abs(a.exact) ? b : a).cents += diff;
  }
  const n = Number.isInteger(d.count) ? d.count : raw.length, keep = raw.length > PNL_CARD_MAX_ROWS ? new Set([...raw].sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents) || a.i - b.i).slice(0, PNL_CARD_MAX_ROWS).map(r => r.i)) : null;
  const shown = raw.filter(r => !keep || keep.has(r.i)), rest = raw.filter(r => keep && !keep.has(r.i));
  const at = finite(d.at) ? d.at : null;
  return {
    profit, label: profit ? 'GEWINN-ALARM' : 'VERLUST-ALARM', name: profit ? 'Gewinn-Alarm' : 'Verlust-Alarm', total, totalText: total !== null ? signedUsd(total) : '—',
    threshold: finite(d.level) ? `Schwelle erreicht · ${profit ? '≥ +' : '≤ −'}${de(Math.abs(d.level))} USD` : 'Schwelle erreicht',
    count: n, rows: shown.map(r => ({ symbol: r.symbol, side: r.side, value: r.cents / 100, text: `${signedUsd(r.cents / 100)} USD` })),
    more: rest.length ? { n: rest.length, value: rest.reduce((s, r) => s + r.cents, 0) / 100 } : null, missing: Math.max(0, n - raw.length),
    time: at !== null ? stamp(at, timezone, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '', date: at !== null ? stamp(at, timezone, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '',
    bot: String(d.bot || '').trim() || 'Scalp Desk'
  };
}
// Bildunterschrift: eine kurze Zeile für die Push-Vorschau (ohne HTML)
export const pnlCardCaption = m => `${m.name} · ${m.totalText}${m.total !== null ? ' USD' : ''}`;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const T = (x, y, s, { size = 32, weight = 700, fill = C.text, anchor = 'start', spacing = 0 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${CARD_FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}${spacing ? ` letter-spacing="${spacing}"` : ''}>${esc(s)}</text>`;
const R = (x, y, w, h, r, fill, stroke = '', sw = 2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`;
const n1 = v => Math.round(v * 10) / 10;

export function pnlCardSvg(m) {
  const W = PNL_CARD_W, X = 64, out = [], col = m.profit ? C.green : C.red, colOf = v => v > 0 ? C.green : v < 0 ? C.red : C.muted;
  // 1) Kopf: Label links (Punkt + Text auf dunkelrotem bzw. dunkelgrünem Grund), Uhrzeit mit Sekunden rechts
  const lw = Math.round(textWidth(m.label, 30, 800, 3) + 92);
  out.push(R(X, 56, lw, 76, 18, m.profit ? C.greenBg : C.redBg), `<circle cx="${X + 34}" cy="94" r="10" fill="${col}"/>`, T(X + 60, 105, m.label, { size: 30, weight: 800, fill: col, spacing: 3 }));
  if (m.time) out.push(T(W - X, 105, m.time, { size: 32, weight: 600, fill: C.muted, anchor: 'end' }));
  // 2) große Zahl in USD, darunter die erreichte Schwelle in Grau
  const bigSize = fitSize(m.totalText, 150, 800, W - 2 * X - 170, 80), bw = textWidth(m.totalText, bigSize, 800);
  out.push(T(X - 4, 310, m.totalText, { size: bigSize, weight: 800, fill: m.total === null ? C.muted : col }), T(n1(X + bw / 1.04 + 20), 310, 'USD', { size: 60, weight: 800, fill: m.total === null ? C.muted : col }));
  out.push(T(X, 384, m.threshold, { size: fitSize(m.threshold, 36, 500, W - 2 * X), weight: 500, fill: C.muted }));
  // 3) Karte „OFFENE POSITIONEN · n“: je Position Symbol, Long/Short grau, Ergebnis rechts grün/rot
  const rows = [...m.rows.map(r => ({ ...r, kind: 'pos' })), ...(m.more ? [{ kind: 'more', text: `+ ${m.more.n} weitere`, value: m.more.value }] : []), ...(m.missing ? [{ kind: 'note', text: `${m.missing} ohne aktuellen Kurs` }] : [])];
  const y0 = 440, rh = 112, ch = 116 + Math.max(1, rows.length) * rh + 16;
  out.push(R(X, y0, W - 2 * X, ch, 30, C.card, C.line, 2), T(X + 44, y0 + 76, `OFFENE POSITIONEN · ${m.count}`, { size: 28, weight: 700, fill: C.muted, spacing: 3 }));
  if (!rows.length) out.push(T(X + 44, y0 + 116 + 70, 'Einzelwerte nicht verfügbar', { size: 34, weight: 500, fill: C.muted }));
  rows.forEach((r, i) => {
    const ry = y0 + 116 + i * rh, L = X + 44, Rr = W - X - 44;
    out.push(`<line x1="${L}" y1="${ry}" x2="${Rr}" y2="${ry}" stroke="${C.line}" stroke-width="2"/>`);
    if (r.kind === 'pos') {
      const vs = fitSize(r.text, 42, 700, 380, 30), ss = fitSize(r.symbol, 42, 800, Rr - L - textWidth(r.text, vs, 700) - 150, 28);
      out.push(T(L, ry + 70, r.symbol, { size: ss, weight: 800, fill: C.text }), T(n1(L + textWidth(r.symbol, ss, 800) + 14), ry + 70, r.side, { size: 32, weight: 500, fill: C.muted }));
      out.push(T(Rr, ry + 70, r.text, { size: vs, weight: 700, fill: colOf(r.value), anchor: 'end' }));
    } else if (r.kind === 'more') {
      out.push(T(L, ry + 70, r.text, { size: 34, weight: 600, fill: C.muted }), T(Rr, ry + 70, `${signedUsd(r.value)} USD`, { size: 36, weight: 700, fill: colOf(r.value), anchor: 'end' }));
    } else out.push(T(L, ry + 70, r.text, { size: 32, weight: 500, fill: C.muted }));
  });
  // 4) Fuß: Datum und Botname
  const H = Math.max(1080, y0 + ch + 150), foot = [m.date, m.bot].filter(Boolean).join(' · ');
  out.push(T(X, H - 60, foot, { size: fitSize(foot, 28, 500, W - 2 * X), weight: 500, fill: C.faint }));
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${C.bg}"/>${out.join('')}</svg>`, width: W, height: H };
}
// Bequem: Daten → Modell → SVG und Bildunterschrift
export function pnlAlarmCard(data, opts = {}) {
  const m = pnlCardModel(data, opts);
  return { model: m, caption: pnlCardCaption(m), ...pnlCardSvg(m) };
}
