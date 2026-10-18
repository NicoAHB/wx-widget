// Neue Kartenvorlage, bestehende SVG-Schriften/Farben/Einpassung; Rendering und sendPhoto bleiben zentral in der App.
import { CARD_W, CARD_FONT, CARD_COLORS as C, fitSize, textWidth } from './pattern-signal-card.mjs';
import { telegramPrice } from './telegram-format.mjs';
import { NY_OPEN, nySession } from './ny-open-core.mjs';
import { displayTimeParts } from './display-time.mjs';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = (x, y, value, size = 30, color = C.text, weight = 600, anchor = 'start') => `<text x="${x}" y="${y}" fill="${color}" font-family="${CARD_FONT}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${esc(value)}</text>`;
const rect = (x, y, w, h, fill, stroke = C.line) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
const price = v => Number.isFinite(v) && v > 0 ? telegramPrice(v) : '—';
export function analysisCard(data) {
  const s = data || {}, ny=s.analysisId===NY_OPEN.id, W = CARD_W, H = 1200, X = 48, long = s.direction === 1, color = long ? C.green : C.red, side = long ? 'Long' : 'Short';
  const at = displayTimeParts(s.at ?? Date.now()), out = [rect(X, 38, W - 2 * X, 138, C.panel)];
  out.push(text(X + 28, 90, s.test ? 'TEST · ANALYSE' : 'ANALYSE BESTÄTIGT', 26, C.label), text(X + 28, 145, s.analysisName || 'Top-Down', 42, C.text, 800), text(W - X - 28, 90, `${at.day} · ${at.clock} ${at.zone}`, 23, C.label, 500, 'end'));
  const pair = `${String(s.symbol || '').replace(/USDT$/, '')}/USDT`;
  out.push(text(X + 60, 243, pair + ' · ' + side, 50, color, 800), `<path d="${long ? `M${X + 18} 244V211m-13 13 13-13 13 13` : `M${X + 18} 210v33m-13-13 13 13 13-13`}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`);
  const stageNames = ny?['5m Range','1m Ausbruch','FVG bestätigt']:['4H Bias', '1H Setup', '15m Bestätigung'], stageW = (W - 2 * X - 24) / 3;
  stageNames.forEach((name, i) => { const x = X + i * (stageW + 12); out.push(rect(x, 275, stageW, 70, C.panel), `<path d="M${x + 20} 310l8 8 15-19" fill="none" stroke="${color}" stroke-width="4"/>`, text(x + 55, 319, name, 25, C.text, 700)); });
  const chart = Array.isArray(s.chart) ? s.chart.filter(c => [c.time, c.open, c.high, c.low, c.close].every(Number.isFinite) && c.low > 0 && c.high >= Math.max(c.open, c.close) && c.low <= Math.min(c.open, c.close)).slice(-60) : [];
  const cy = 374, ch = 370; out.push(rect(X, cy, W - 2 * X, ch, C.panel));
  if (chart.length >= 2) {
    const left = X + 20, right = W - X - 210, top = cy + 28, bottom = cy + ch - 45;
    const prices = [...chart.flatMap(c => [c.low, c.high]), s.entry, s.stop, s.target1, s.target2, s.zone?.low, s.zone?.high, s.target, s.oneR, s.range?.low, s.range?.high, s.fvg?.low, s.fvg?.high].filter(v => Number.isFinite(v) && v > 0), low = Math.min(...prices), high = Math.max(...prices), pad = (high - low || high * .01) * .08;
    const y = v => top + (high + pad - v) / (high - low + 2 * pad) * (bottom - top), step = (right - left) / (chart.length+(ny?8:0)), x = i => left + (i + .5) * step;
    if (s.zone && [s.zone.low, s.zone.high].every(Number.isFinite)) out.push(`<rect x="${left}" y="${y(s.zone.high)}" width="${right - left}" height="${Math.max(2, y(s.zone.low) - y(s.zone.high))}" fill="${color}" fill-opacity=".13" stroke="${color}" stroke-opacity=".7"/>`, text(left + 6, Math.max(top + 22, y(s.zone.high) - 7), '1H-Konfluenzzone', 19, color));
    if (ny) for (const [z,label,col] of [[s.range,'NY Opening Range',C.label],[s.fvg,'FVG',color]]) if(z&&[z.low,z.high].every(Number.isFinite)) {
      const when=z.knownAt??z.time??chart.at(-2).time, index=(when-chart[0].time)/60000, zx=Math.max(left,Math.min(right,x(index)));
      out.push(`<rect x="${zx}" y="${y(z.high)}" width="${right-zx}" height="${Math.max(2,y(z.low)-y(z.high))}" fill="${col}" fill-opacity=".10" stroke="${col}" stroke-opacity=".55"/>`,text(zx+6,label==='FVG'?Math.max(top+18,y(z.high)-5):Math.min(bottom-4,y(z.low)+19),label,17,col));
    }
    chart.forEach((c, i) => { const col = c.close >= c.open ? C.green : C.red, cx = x(i), w = Math.max(1.5, step * .65); out.push(`<line x1="${cx}" x2="${cx}" y1="${y(c.high)}" y2="${y(c.low)}" stroke="${col}" stroke-width="1.5"/><rect x="${cx - w / 2}" y="${Math.min(y(c.open), y(c.close))}" width="${w}" height="${Math.max(1, Math.abs(y(c.close) - y(c.open)))}" fill="${col}"/>`); });
    const tags = [[s.entry, 'Einstieg', C.blue], [s.stop, 'Stop', C.red], [ny?s.target:s.target1, ny?'Ziel 2R':'Ziel 1', C.green], [ny?s.range?.high:s.target2, ny?'Range-Hoch':'Ziel 2', ny?C.label:C.green], ...(ny?[[s.range?.low,'Range-Tief',C.label]]:[])].filter(([v]) => Number.isFinite(v)).map(([v, label, col]) => ({ v, label, col, yy: y(v) })).sort((a, b) => a.yy - b.yy);
    let previous = top - 30; tags.forEach(t => { t.yy = Math.max(t.yy, previous + 32); previous = t.yy; }); const shift = Math.max(0, previous - bottom); tags.forEach(t => { const yy = t.yy - shift; out.push(`<line x1="${left}" x2="${right}" y1="${y(t.v)}" y2="${y(t.v)}" stroke="${t.col}" stroke-dasharray="7 5"/><path d="M${right} ${y(t.v)}L${right + 10} ${yy}" fill="none" stroke="${t.col}"/>`, text(right + 15, yy + 7, `${t.label} ${price(t.v)}`, fitSize(`${t.label} ${price(t.v)}`, 23, 800, 181, 15), t.col, 800)); });
    out.push(text(left, cy + ch - 13, `${ny?'1m':'15m'} · normale, geschlossene Kerzen`, 20, C.label, 500));
  } else out.push(text(W / 2, cy + ch / 2 - 5, 'Mini-Chart nicht verfügbar', 31, C.label, 600, 'middle'), text(W / 2, cy + ch / 2 + 38, 'Bestätigte Signalwerte bleiben erhalten.', 24, C.muted, 500, 'middle'));
  const levels = [['EINSTIEG', s.entry, C.blue], ['STOP-LOSS', s.stop, C.red], [ny?'ZIEL · 2R':'ZIEL 1', ny?s.target:s.target1, C.green], [ny?'1R · STOP AUF EINSTIEG':'ZIEL 2', ny?s.oneR:s.target2, ny?C.blue:C.green]], colW = (W - 2 * X - 18) / 2;
  levels.forEach(([label, v, col], i) => { const x = X + i % 2 * (colW + 18), y = 774 + Math.floor(i / 2) * 112, labelText = price(v) + ' USDT'; out.push(rect(x, y, colW, 98, C.panel), text(x + 22, y + 30, label, 20, C.label), text(x + 22, y + 75, labelText, fitSize(labelText, 37, 800, colW - 44, 20), col, 800)); });
  const rr = Number.isFinite(s.rr) ? s.rr.toLocaleString('de-DE', { maximumFractionDigits: 2 }) : '—', rr2 = Number.isFinite(s.rr2) ? s.rr2.toLocaleString('de-DE', { maximumFractionDigits: 2 }) : '—';
  out.push(text(X, 1031, ny?`CRV ${rr}:1 · Range ${price(s.range?.low)}–${price(s.range?.high)}`:`CRV brutto: ${rr} / ${rr2} · Zone ${price(s.zone?.low)}–${price(s.zone?.high)}`, 27, color, 700));
  let parts = ny?`Bei 1R Stop auf Einstieg · ${s.entryMode==='limit'?'Limit in FVG-Mitte':'Einstieg zum Bestätigungsschluss'}`:(s.setup || s.zone?.labels || []).join(' · '); while (parts.length && textWidth(parts, 23, 500) > W - 2 * X) parts = parts.slice(0, -2); out.push(text(X, 1075, parts, 23, C.label, 500));
  out.push(text(X, 1120, ny?'09:30 New York · 5m → 1m · keine Gewinngarantie':'4h → 1h → 15m · Top-Down v1 · keine Gewinngarantie', 23, C.muted, 500), text(X, 1166, 'Scalp Desk · ' + (s.bot || 'Analyse-Signale_111'), 23, C.muted, 500));
  return { width: W, height: H, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${C.bg}"/>${out.join('')}</svg>`, caption: `${pair} · ${side} · Einstieg ${price(s.entry)}` };
}

export function analysisTestSignal(at = Date.now(), id='top-down') {
  if(id===NY_OPEN.id){const entry=82468,stop=82280,risk=entry-stop,session=nySession(at),end=Math.floor(at/60000)*60000;return{test:true,analysisId:id,analysisName:'NY Open Killzone',symbol:'BTCUSDT',market:'spot',direction:1,at,entry,stop,target:entry+NY_OPEN.rewardRisk*risk,oneR:entry+risk,rr:NY_OPEN.rewardRisk,entryMode:'market',session,range:{time:session.rangeStart,high:82390,low:82220},fvg:{low:82370,high:82410},chart:Array.from({length:40},(_,i)=>{const open=82270+i*4,close=i===39?entry:open+Math.sin(i)*16;return{time:end-(40-i)*60000,open,close,high:Math.max(open,close)+16,low:Math.min(open,close)-16};})};}

  const end = Math.floor(at / 900000) * 900000, symbol = 'BTCUSDT', entry = 82468;
  const chart = Array.from({ length: 40 }, (_, i) => { const open = 82240 + i * 5 + Math.sin(i / 2) * 42, close = i === 39 ? entry : open + Math.sin(i) * 22; return { time: end - (40 - i) * 900000, open, close, high: Math.max(open, close) + 25, low: Math.min(open, close) - 25 }; });
  return { test: true, analysisId: 'top-down', analysisName: 'Top-Down', symbol, market: 'spot', direction: 1, at, entry, stop: 82180, target1: 82900, target2: 83300, rr: 1.5, rr2: 2.89, zone: { low: 82210, high: 82290 }, setup: ['Demand', 'Order Block', 'FVG'], chart };
}
