// 3.63.0: Gemeinsame Darstellung für App und Dienst. Keine Auslöser, Freigaben oder Netzwerkzugriffe.
import { INTERVAL_MS } from './market-intervals.mjs';
import { patternCardSettings, patternValidUntil } from './pattern-quality.mjs';
export const TELEGRAM_LIMIT = 4096, TELEGRAM_CAPTION_LIMIT = 1024;
const value = v => v !== null && v !== undefined && !(typeof v === 'number' && !Number.isFinite(v)) && !(typeof v === 'string' && /^(?:none|nan|undefined|null)?$/i.test(v.trim()));
const finite = v => value(v) && typeof v === 'number' && Number.isFinite(v);
export const escapeTelegram = v => value(v) ? String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
export const telegramNumber = (v, digits = 2) => finite(v) ? v.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '';
export const priceDigits = v => Math.abs(v) >= 1000 ? 2 : Math.abs(v) >= 1 ? 4 : Math.abs(v) >= .01 ? 5 : 8;
export const telegramPrice = v => telegramNumber(v, priceDigits(v));
export const telegramSigned = (v, digits = 2) => finite(v) ? (v < 0 ? '−' : '+') + telegramNumber(Math.abs(v), digits) : '';
export const telegramPercent = v => finite(v) ? telegramSigned(v, 2) + ' %' : '';
export const telegramBar = v => finite(v) ? '▓'.repeat(Math.round(Math.max(0, Math.min(100, v)) / 10)) + '░'.repeat(10 - Math.round(Math.max(0, Math.min(100, v)) / 10)) : '';
export function telegramDirection(v) {
  return ['bull', 'up', 'above', 'long', 'profit', 'auf'].includes(v) || (finite(v) && v > 0) ? { icon: '🟢⬆️', label: 'AUFWÄRTS', sign: 1 }
    : ['bear', 'down', 'below', 'short', 'loss', 'ab'].includes(v) || (finite(v) && v < 0) ? { icon: '🔴⬇️', label: 'ABWÄRTS', sign: -1 } : { icon: '⚪', label: 'NEUTRAL', sign: 0 };
}
export const telegramRelative = (v, base) => finite(v) && finite(base) && base > 0 ? (v / base - 1) * 100 : null;
const line = (label, v, transform = escapeTelegram) => value(v) ? label + transform(v) : '';
const numLine = (label, v, transform = telegramPrice) => finite(v) ? label + transform(v) : '';
const money = v => telegramPrice(v) + ' USD';
const code = v => '<code>' + money(v) + '</code>';
const pctDistance = (v, base) => { const p = telegramRelative(v, base); return finite(p) ? ' (' + telegramPercent(p) + ')' : ''; };
// Nur unsere vier erlaubten Tags bleiben stehen. Dynamischer Text wird vorab escaped.
// Bei Kürzung keine halben Entities, Emojis oder offenen Tags an Telegram übergeben.
export function clipTelegramHtml(html, limit = TELEGRAM_LIMIT) {
  const cap = Math.max(0, Math.floor(limit)); if (html.length <= cap) return html;
  const stack = []; let out = '';
  for (const token of String(html).match(/<\/?(?:b|i|code|pre)>|&(?:amp|lt|gt|quot|#39);|[\s\S]/gu) || []) {
    const tag = /^<(\/)?(b|i|code|pre)>$/.exec(token), next = stack.slice();
    if (tag) { if (tag[1]) next.pop(); else next.push(tag[2]); }
    const tail = next.slice().reverse().map(x => `</${x}>`).join('');
    if (out.length + token.length + tail.length + 1 > cap) break;
    out += token; stack.splice(0, stack.length, ...next);
  }
  const tail = stack.reverse().map(x => `</${x}>`).join(''); return out + (out.length + tail.length < cap ? '…' : '') + tail;
}
export const telegramPlain = html => String(html).replace(/<\/?(?:b|i|code|pre)>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
export const telegramFormatRejected = (status, description) => Number(status) === 400 && /can't parse entities|can.?t parse entities|unsupported start tag|unclosed start tag|entity.*(?:offset|end|invalid)/i.test(String(description));
export function finishTelegram(html, at, timezone, limit = TELEGRAM_LIMIT) {
  let body = String(html), model = '', dated = false;
  // 3.71.0: „Modell · Datum:“ (Chartmuster) – Fuß mit Datum und Uhrzeit statt nur der Uhrzeit
  const m = /\n(Modell|Modell · Datum): ([^\n]*)$/.exec(body); if (m) { model = m[2]; dated = m[1] !== 'Modell'; body = body.slice(0, m.index); }
  const last = body.split('\n').at(-1);
  if (/^🕐 /.test(last || '')) { const content = body.slice(0, -last.length).replace(/\n$/, ''); return clipTelegramHtml(content, Math.max(0, limit - last.length - 1)) + '\n' + last; }
  if (!finite(at)) return clipTelegramHtml(body + (model ? (dated ? '\nModell · Datum: ' : '\nModell: ') + model : ''), limit);
  const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', ...(dated ? { day: '2-digit', month: '2-digit', year: 'numeric' } : {}), ...(timezone ? { timeZone: timezone } : {}) };
  const fmt = o => (dated ? new Date(at).toLocaleString('de-DE', o).replace(', ', ' · ') : new Date(at).toLocaleTimeString('de-DE', o));
  let stamp; try { stamp = fmt(options); } catch { stamp = fmt({ ...options, timeZone: 'Europe/Berlin' }); }
  const footer = '🕐 ' + stamp + (model ? ' · Modell ' + model : '');
  return clipTelegramHtml(body, Math.max(0, limit - footer.length - 1)) + '\n' + footer;
}
export function telegramFields(html, { at, timezone, limit = TELEGRAM_LIMIT } = {}) {
  const text = finishTelegram(html, at, timezone, limit); return { text, parse_mode: 'HTML', plain: telegramPlain(text) };
}
export function formatMessage(type, d = {}) {
  const direction = telegramDirection(d.direction ?? d.dir ?? d.change), coin = escapeTelegram(d.coin ?? d.symbol?.replace(/USDT$/, '')), pair = escapeTelegram(d.pair ?? (d.symbol ? d.symbol.replace(/USDT$/, '/USDT') : ''));
  let blocks;
  if (type === 'pattern') {
    // 3.71.0: Kurztext in derselben Reihenfolge wie die Signalkarte (Bildunterschrift und Ersatz, wenn das Bild nicht geht)
    const m = patternSignalModel(d), na = v => v === PATTERN_NA, ok = v => v === true ? '✔' : v === false ? '✖' : '?';
    const nowLine = m.now.state ? `⏱ Jetzt: ${m.now.price ? escapeTelegram(m.now.price) + (m.now.dist ? ` (${escapeTelegram(m.now.dist)} zum Einstieg)` : '') + ' · ' : ''}${{ valid: '✅', missed: '🟠', expired: '⌛' }[m.now.state]} ${escapeTelegram(m.now.label)}${m.now.detail ? ' ' + escapeTelegram(m.now.detail) : ''}` : '';
    blocks = [[`<b>📐 ${escapeTelegram(m.pair)} · ${escapeTelegram(m.market)} · ${escapeTelegram(m.timeframe)} · ${direction.icon} ${direction.label}</b>`,
      `<b>${escapeTelegram(m.pattern)}</b>${na(m.status) ? '' : ' · ' + (m.confirmed ? '✅ ' : '') + escapeTelegram(m.status)}`,
      m.grade ? `${m.grade.icon} <b>${m.grade.label} ${escapeTelegram(m.score)}</b> · Trend ${ok(m.trend)} · Volumen ${ok(m.volume)} · Chance/Risiko ${m.rr ? `${ok(m.rrOk)} ${escapeTelegram(m.rr)}` : '–'}` : m.rr ? `⚖️ Chance/Risiko: ${escapeTelegram(m.rr)}` : ''],
    [na(m.entry) ? '' : `💰 Einstieg: <code>${escapeTelegram(m.entry)}</code>`, na(m.target) ? '' : `🎯 Ziel: <b>${escapeTelegram(m.target)}</b>${m.targetPct ? ' (' + escapeTelegram(m.targetPct) + ')' : ''}`,
      na(m.stop) ? '' : `🛑 Stop: <code>${escapeTelegram(m.stop)}</code>${m.stopPct ? ' (' + escapeTelegram(m.stopPct) + ')' : ''}`, m.stopTight ? `⚠️ ${escapeTelegram(m.stopTight)}` : '', nowLine],
    [na(m.quality) ? '' : `🧠 Musterqualität: ${escapeTelegram(m.quality)} · keine Erfolgswahrscheinlichkeit`, m.learned ? `📚 Erlernt: ${escapeTelegram(m.learned)}` : '',
      `<i>${escapeTelegram(m.hint)}</i>`, na(m.model) ? '' : 'Modell · Datum: ' + escapeTelegram(m.model)]];
  } else if (type === 'alarm') {
    const distance = finite(d.price) && finite(d.level) ? d.price - d.level : null;
    blocks = [[`<b>${direction.icon} KURS-ALARM${coin ? ' · ' + coin : ''}</b>${finite(d.price) ? ' · ' + code(d.price) : ''}`,
      numLine('🎯 Level erreicht: ⭐ <b>', d.level, v => money(v) + '</b> ⭐ (' + (direction.sign > 0 ? 'auf/über' : 'unter') + ')'),
      numLine('📏 Abstand zum Level: ', distance, v => telegramSigned(v, priceDigits(d.level)) + ' USD' + pctDistance(d.price, d.level))],
    [line('Markt: ', d.market), line('Auslösung: ', d.reached), line('Notiz: ', d.note)]];
  } else if (type === 'pulse') {
    const ratio = finite(d.threshold) && d.threshold > 0 && finite(d.change) ? Math.abs(d.change) / d.threshold : null;
    const others = (Array.isArray(d.others) ? d.others : []).filter(x => value(x[0]) && finite(x[1])).slice().sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || String(a[0]).localeCompare(String(b[0])));
    const width = Math.max(0, ...others.map(x => String(x[0]).length)), table = others.map(([c, p]) => `${p < 0 ? '🔴' : p > 0 ? '🟢' : '⚪'} ${escapeTelegram(String(c).padEnd(width))}  ${telegramPercent(p)}`).join('\n');
    blocks = [[`<b>${direction.icon} ${coin || 'BTC'}-PULS · ${telegramPercent(d.change)}</b>${finite(d.minutes) ? ' in ' + telegramNumber(d.minutes, 0) + ' Min' : ''}`,
      numLine('💰 Kurs: ', d.price, v => code(v)),
      (value(d.reason) || finite(ratio)) ? '⚡ ' + (value(d.reason) ? '<i>' + escapeTelegram(d.reason) + '</i>' : '') + (finite(ratio) ? ' · ' + telegramNumber(ratio, 1) + '× Schwelle (' + telegramNumber(d.threshold, 2) + ' %)' + (ratio >= 2 ? ' 🔥' : '') : '') : '',
      d.more ? 'Bewegung legt weiter zu' : ''], table ? ['📋 Vorauswahl im selben Zeitraum:', '<pre>' + table + '</pre>'] : []];
  } else if (type === 'position') {
    blocks = [[`<b>${direction.icon} ${d.hit === 'tp' ? 'TAKE-PROFIT' : 'STOP-LOSS'} · ${coin}${d.side ? ' ' + escapeTelegram(d.side === 'long' ? 'Long' : 'Short') : ''}</b>${finite(d.price) ? ' · ' + code(d.price) : ''}`,
      numLine('🎯 Level erreicht: ⭐ <b>', d.level, v => money(v) + '</b> ⭐'), line('Auslösung: ', d.reached), numLine('💰 Einstieg: ', d.entry, code)]];
  } else if (type === 'pnl') {
    blocks = [[`<b>${d.profit === false ? '🔴 VERLUST-ALARM' : '🟢 GEWINN-ALARM'}${finite(d.pnl) ? ' · ' + telegramSigned(d.pnl) + ' USD' : ''}</b>`,
      numLine('🎯 Schwelle erreicht: ⭐ <b>', d.level, v => (d.profit === false ? '≤ −' : '≥ +') + telegramNumber(Math.abs(v)) + ' USD</b> ⭐'), numLine('Positionen offen: ', d.positions, v => telegramNumber(v, 0))]];
  } else if (type === 'day') {
    blocks = [[`<b>🔴 TAGES-VERLUSTLIMIT ERREICHT${finite(d.pnl) ? ' · ' + telegramSigned(d.pnl) + ' USD' : ''}</b>`, numLine('Heute realisiert: ', d.pnl, v => telegramSigned(v) + ' USD'), numLine('🎯 Limit: ⭐ <b>', d.limit, v => telegramNumber(v) + ' USD</b> ⭐')]];
  } else if (type === 'news') {
    blocks = [[`<b>⚠️ WIRTSCHAFTSTERMIN${value(d.when) ? ' · ' + escapeTelegram(d.when) : ''}</b>`, line('Währung: ', d.currency), 'Bedeutung: hoch', 'Starke Kursausschläge möglich'],
      (d.events || []).flatMap(e => [line('Termin: ', e.title), line('Prognose: ', e.forecast), line('Vorher: ', e.previous)])];
  } else if (type === 'trade' && d.card) {
    // 3.69.0: kurze Bildunterschrift zur Trade-Karte – Paar, Long/Short, Netto in € (ohne Euro-Kurs in USD) und %, Haltedauer,
    // Max. Gewinn und Max. Verlust (unrealisiert, nach Gebühren). „nie im Minus/Plus“: Der Kurs lief nie gegen bzw. für die Position.
    const inEur = finite(d.eur), res = inEur ? d.eur : d.pnl, unit = inEur ? ' €' : ' USD';
    const ext = (usd, eur, never, word) => never ? telegramNumber(0) + unit + ' (' + word + ')' : finite(inEur ? eur : usd) ? telegramSigned(inEur ? eur : usd) + unit : '';
    const gain = ext(d.gain, d.gainEur, d.neverPlus, 'nie im Plus'), loss = ext(d.loss, d.lossEur, d.neverMinus, 'nie im Minus');
    blocks = [[`<b>${finite(res) ? res < 0 ? '🔴 VERLUST' : res > 0 ? '🟢 GEWINN' : '⚪ AUSGEGLICHEN' : direction.icon + ' TRADE'} · ${pair || coin}${value(d.side) ? ' ' + escapeTelegram(d.side === 'long' ? 'Long' : 'Short') : ''}</b>`,
      finite(res) ? `${inEur ? '💶' : '💵'} Netto: <b>${telegramSigned(res)}${unit}</b>${finite(d.percent) ? ' · ' + telegramPercent(d.percent) : ''}` : '', line('⏱ Haltedauer: ', d.duration),
      gain ? '📈 Max. Gewinn: ' + gain : '', loss ? '📉 Max. Verlust: ' + loss : '', !gain && !loss ? line('Max. Gewinn/Verlust: ', d.extremes) : '']];
  } else if (type === 'trade') {
    blocks = [[`<b>${d.paper ? 'PAPER · ' : ''}${finite(d.pnl) ? d.pnl < 0 ? '🔴 VERLUST' : d.pnl > 0 ? '🟢 GEWINN' : '⚪ AUSGEGLICHEN' : direction.icon + ' TRADE'} · ${coin}${value(d.side) ? ' ' + escapeTelegram(d.side === 'long' ? 'Long' : 'Short') : ''}${finite(d.pnl) ? ' · ' + telegramSigned(d.pnl) + ' USD' : ''}</b>`,
      numLine('💰 Einstieg: ', d.entry, code), numLine('Kurs beim Abschluss: ', d.exit, code), numLine('Ergebnis: ', d.percent, telegramPercent), line('Dauer: ', d.duration), numLine('Menge: ', d.quantity, v => telegramNumber(v, 8)), line('Gründe: ', d.reasons), line('Hinweis: ', d.note)]];
  } else if (type === 'handover') {
    const targets = (d.items || []).flatMap(x => {
      const dir = telegramDirection(x.direction);
      return [`<b>${escapeTelegram(x.label)}</b>`, numLine('⭐ <b>Alarm-Level: ', x.level, v => money(v) + '</b> ⭐' + (dir.sign ? ' (' + (dir.sign > 0 ? 'auf/über' : 'unter') + ')' : '')),
        numLine('🛑 Stop-Loss: ', x.stop, code), numLine('⭐ <b>Take-Profit: ', x.target, v => money(v) + '</b> ⭐')];
    });
    blocks = [[`<b>${escapeTelegram(d.headline)}</b>`], targets, (d.lines || []).filter(value).map(escapeTelegram)];
  } else if (type === 'backup') {
    blocks = [['<b>💾 SCALP-DESK-SICHERUNG</b>', numLine('Offene Positionen: ', d.positions, v => telegramNumber(v, 0)), numLine('Trades: ', d.trades, v => telegramNumber(v, 0)), numLine('Geldbewegungen: ', d.movements, v => telegramNumber(v, 0))], ['Wiederherstellen:', 'Datei speichern', 'Im Dashboard „Backup einspielen“']];
  } else if (type === 'signal' || type === 'po3') {
    const stats = (d.statistics || []).flatMap(s => [line('', s.label), numLine('Zieltreffer: ', s.percent, v => telegramNumber(v, 1) + ' %'), line('Auswertung: ', s.status), numLine('Originalfälle: ', s.n, v => telegramNumber(v, 0)), line('Fallzeitraum: ', s.period), 'Nur protokollierte Originaleingaben']);
    blocks = [[`<b>${direction.icon} ${escapeTelegram(d.headline || 'KI-SIGNAL')} · ${pair || coin}</b>`, line('Markt: ', d.market), line('Zeitrahmen: ', d.timeframe), line('Horizont: ', d.horizon), line('Status: ', d.status), numLine('Score: ', d.score, v => telegramNumber(v, 0) + '/100')],
      [numLine('💰 Einstieg: ', d.entry, code), numLine('Kurs: ', d.price, code), numLine('🛑 Stop: ', d.stop, code), numLine('Ungültig bei: ', d.invalid, code), numLine('Zone unten: ', d.low, code), numLine('Zone oben: ', d.high, code), numLine('🎯 ⭐ <b>Ziel: ', d.target, v => money(v) + '</b> ⭐'), ...(d.targets || []).map((v, i) => numLine(`⭐ <b>Ziel ${i + 1}: `, v, n => money(n) + '</b> ⭐')), numLine('Chance/Risiko brutto: ', d.rr, v => telegramNumber(v) + ' : 1'), numLine('Chance/Risiko netto: ', d.netRR, v => telegramNumber(v) + ' : 1'), d.netRR === null ? 'Chance/Risiko netto: nicht bewertbar' : ''], stats,
      [line('Muster: ', d.patterns), numLine('Gebühr Einstieg: ', d.feeEntry, v => telegramNumber(v) + ' %'), numLine('Gebühr Ausstieg: ', d.feeExit, v => telegramNumber(v) + ' %'), numLine('Slippage: ', d.slippageBps, v => telegramNumber(v) + ' bp je Ein-/Ausstieg mit Tickraster'), line('Kosten: ', d.funding), numLine('Revision: ', d.revision, v => telegramNumber(v, 0)), ...(d.lines || []).filter(value).map(escapeTelegram), line('Modell: ', d.model)]];
  } else {
    // Tests, Dienst-/Schalterbestätigung und technische Dateibeschriftung. Keine Dynamik als HTML interpretieren.
    blocks = [[`<b>${escapeTelegram(d.headline || 'SCALP DESK')}</b>`, ...(d.lines || (value(d.text) ? String(d.text).split('\n') : [])).filter(value).map(escapeTelegram)]];
  }
  const html = blocks.map(b => b.filter(Boolean).join('\n')).filter(Boolean).join('\n\n');
  return finishTelegram(html, d.at, d.timezone, d.messageLimit || TELEGRAM_LIMIT);
}

// ---- 3.71.0: Chartmuster-Signalkarte – ein Anzeigemodell für Karte (Bild), App und Kurztext ----
// Eingabe wie bisher (pattern, symbol, market, timeframe, status, direction, entry, target, invalid, quality, learned, score, model),
// dazu marks {trend, volume}, rr, atr, price (Kurs zur Meldezeit bzw. jetzt), tc (Beginn der Bestätigungskerze), until, at, now,
// chart {k: [[t, Schluss]], lines: [[t1, p1, t2, p2]]} und settings (Kartenwerte des Filters). Fehlendes bleibt „Nicht verfügbar“.
export const PATTERN_NA = 'Nicht verfügbar';
export const PATTERN_GRADES = Object.freeze({
  weak: Object.freeze({ key: 'weak', label: 'Schwaches Signal', color: '#fb923c', icon: '🟠' }),
  medium: Object.freeze({ key: 'medium', label: 'Mittleres Signal', color: '#facc15', icon: '🟡' }),
  strong: Object.freeze({ key: 'strong', label: 'Starkes Signal', color: '#4ade80', icon: '🟢' })
});
export function patternGrade(score, settings) {
  if (!finite(score)) return null; const s = patternCardSettings(settings);
  return PATTERN_GRADES[score >= s.strongFrom ? 'strong' : score >= s.weakBelow ? 'medium' : 'weak'];
}
const TF_UNIT = { m: ['Min', 'MIN'], h: ['Std', 'STD'], d: ['Tag', 'TAG'], w: ['Woche', 'WOCHE'], M: ['Monat', 'MONAT'] };
export const patternTimeframe = (iv, upper = false) => { const m = /^(\d+)([mhdwM])$/.exec(String(iv || '')); return m ? `${m[1]} ${TF_UNIT[m[2]][upper ? 1 : 0]}${m[2] === 'd' && m[1] !== '1' ? (upper ? 'E' : 'e') : ''}` : value(iv) ? String(iv) : PATTERN_NA; };
const markOf = v => v === '✔' ? true : v === '✖' || v === '~' ? false : null;
function stamp(at, timezone, o) { try { return new Date(at).toLocaleString('de-DE', { ...o, timeZone: timezone }); } catch { return new Date(at).toLocaleString('de-DE', { ...o, timeZone: 'Europe/Berlin' }); } }
export function patternSignalModel(d = {}, { now = d.now ?? d.at, timezone = d.timezone || 'Europe/Berlin', settings = d.settings } = {}) {
  const s = patternCardSettings(settings), dir = telegramDirection(d.direction ?? d.dir), sign = dir.sign, na = v => v ?? PATTERN_NA;
  const pair = value(d.pair) ? String(d.pair) : value(d.symbol) ? String(d.symbol).replace(/USDT$/, '/USDT') : null;
  const entry = finite(d.entry) && d.entry > 0 ? d.entry : null, target = finite(d.target) && d.target > 0 ? d.target : null, stop = [d.invalid, d.stop].find(v => finite(v) && v > 0) ?? null;
  const money = v => v !== null ? telegramPrice(v) + ' USD' : null, pct = v => { const p = telegramRelative(v, entry); return finite(p) ? telegramPercent(p) : null; };
  const risk = entry !== null && stop !== null ? Math.abs(entry - stop) : null, reward = entry !== null && target !== null ? Math.abs(target - entry) : null;
  const rr = finite(d.rr) && d.rr > 0 ? d.rr : risk > 0 && finite(reward) ? reward / risk : null;
  const summary = String(d.scoreWhy || ''), marks = d.marks || {};
  const trend = markOf(marks.trend ?? /Trend (\S)/.exec(summary)?.[1]), volume = markOf(marks.volume ?? /Volumen (\S)/.exec(summary)?.[1]);
  const minRR = finite(Number(settings?.minRR)) ? Number(settings.minRR) : 1;
  // Jetzt: Abstand zum Einstieg; „verpasst“, wenn der Kurs mehr als missedPct % in Musterrichtung weitergelaufen ist; Fenster bis until
  const step = INTERVAL_MS[d.timeframe] || null, until = finite(d.until) ? d.until : patternValidUntil(d.tc, d.timeframe, s.validCandles);
  const price = finite(d.price) && d.price > 0 ? d.price : null, dist = price !== null && entry !== null ? (price / entry - 1) * 100 : null;
  const expired = finite(until) && finite(now) && now >= until, missed = dist !== null && sign * dist > s.missedPct;
  const state = expired ? 'expired' : missed ? 'missed' : finite(until) || dist !== null ? 'valid' : null;
  const left = finite(until) && finite(now) && step ? Math.max(0, Math.ceil((until - now) / step)) : null;
  const longWindow = finite(until) && step >= 864e5 / 2, untilText = finite(until) ? stamp(until, timezone, longWindow ? { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' }).replace(', ', ' ') : null;
  const detail = !finite(until) ? '' : expired ? `seit ${untilText}` : `bis ${untilText}${left !== null ? ` · noch ${left} ${left === 1 ? 'Kerze' : 'Kerzen'}` : ''}`;
  // Erlernt: Zahl erst ab 10 abgeschlossenen Fällen
  const L = d.learned || null; let learned = null;
  if (L) {
    const n = L.total ?? L.n, yes = sign > 0 ? L.up ?? L.auf : sign < 0 ? L.down ?? L.ab : null, min = L.minimum ?? 10;
    learned = finite(n) && n >= min && finite(yes) ? `${telegramNumber(yes, 0)}/${telegramNumber(n, 0)} Fälle in Musterrichtung${value(L.source) ? ` (${L.source})` : ''}` : `noch nicht bewertet (${telegramNumber(Math.min(min, finite(n) ? n : finite(L.available) ? L.available : 0), 0)}/${telegramNumber(min, 0)} Fälle)`;
  }
  const status = value(d.status) ? String(d.status) : null, at = finite(d.at) ? d.at : null;
  return {
    pair: na(pair), market: value(d.market) ? String(d.market) : PATTERN_NA, timeframe: patternTimeframe(d.timeframe), timeframeUpper: patternTimeframe(d.timeframe, true),
    direction: value(d.direction ?? d.dir) ? dir.label : PATTERN_NA, dirSign: sign, pattern: value(d.pattern) ? String(d.pattern) : PATTERN_NA, status: status ?? PATTERN_NA, confirmed: !!status && /bestätigt/i.test(status),
    grade: patternGrade(d.score, s), score: finite(d.score) ? `${telegramNumber(d.score, 0)}/100` : null, trend, volume,
    rr: finite(rr) ? telegramNumber(rr, 2) + ' : 1' : null, rrValue: finite(rr) ? rr : null, rrOk: finite(rr) ? rr >= minRR : null,
    entry: na(money(entry)), target: na(money(target)), targetPct: target !== null ? pct(target) : null, stop: na(money(stop)), stopPct: stop !== null ? pct(stop) : null,
    stopTight: finite(d.atr) && d.atr > 0 && risk !== null && risk < d.atr ? `Stop enger als normale Schwankung (ATR 14: ${telegramNumber(d.atr, priceDigits(entry))} USD)` : null,
    now: { state, price: money(price), dist: finite(dist) ? telegramPercent(dist) : null, label: { valid: 'Einstieg gültig', missed: 'Einstieg verpasst', expired: 'Einstieg abgelaufen' }[state] || '', detail, until: finite(until) ? until : null, left },
    quality: finite(d.quality) ? telegramNumber(d.quality, Number.isInteger(d.quality) ? 0 : 2) + ' %' : PATTERN_NA, qualityBar: finite(d.quality) ? Math.max(0, Math.min(100, d.quality)) : null,
    qualityNote: 'Wie sauber das Muster ist, keine Erfolgswahrscheinlichkeit.', learned,
    hint: 'Kursrichtung ≠ Zieltreffer', time: at !== null ? stamp(at, timezone, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(', ', ' · ') : PATTERN_NA,
    model: value(d.model) ? String(d.model) : PATTERN_NA,
    levels: { entry, target, stop, price }, chart: d.chart || null
  };
}
