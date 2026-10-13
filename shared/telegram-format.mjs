// 3.63.0: Gemeinsame Darstellung für App und Dienst. Keine Auslöser, Freigaben oder Netzwerkzugriffe.
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
const learned = (s, direction) => {
  if (!s) return [];
  const n = s.total ?? s.n, yes = direction.sign > 0 ? s.up ?? s.auf : s.down ?? s.ab, minimum = s.minimum ?? 10;
  return [finite(n) && finite(yes) ? `📚 Erlernt: ${yes}/${n} Fälle${n < minimum ? ' ⚠️ zu wenig Daten' : ''}` : finite(s.available) ? `📚 Erlernt: ${s.available}/${minimum} Fälle ⚠️ zu wenig Daten` : '',
    line('Datenbasis: ', s.source), finite(s.horizon) ? `Beobachtung: nach ${s.horizon} Kerzen` : '',
    numLine('Aufwärts: ', s.up ?? s.auf, v => telegramNumber(v, 0) + ' Fälle'), numLine('Abwärts: ', s.down ?? s.ab, v => telegramNumber(v, 0) + ' Fälle'), numLine('Seitwärts: ', s.flat ?? s.seitwärts ?? s.seit, v => telegramNumber(v, 0) + ' Fälle')];
};
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
  let body = String(html), model = '';
  const m = /\nModell: ([^\n]*)$/.exec(body); if (m) { model = m[1]; body = body.slice(0, m.index); }
  const last = body.split('\n').at(-1);
  if (/^🕐 /.test(last || '')) { const content = body.slice(0, -last.length).replace(/\n$/, ''); return clipTelegramHtml(content, Math.max(0, limit - last.length - 1)) + '\n' + last; }
  if (!finite(at)) return clipTelegramHtml(body + (model ? '\nModell: ' + model : ''), limit);
  const options = { hour: '2-digit', minute: '2-digit', second: '2-digit', ...(timezone ? { timeZone: timezone } : {}) };
  let stamp; try { stamp = new Date(at).toLocaleTimeString('de-DE', options); } catch { stamp = new Date(at).toLocaleTimeString('de-DE', { ...options, timeZone: 'Europe/Berlin' }); }
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
    const risk = finite(d.entry) && finite(d.invalid) ? Math.abs(d.entry - d.invalid) : 0, reward = finite(d.entry) && finite(d.target) ? Math.abs(d.target - d.entry) : null, crv = risk > 0 && finite(reward) ? reward / risk : null;
    blocks = [[`<b>${direction.icon} ${direction.label} · ${escapeTelegram(d.pattern)}</b>${pair ? ' · ' + pair : ''}`,
      `📊 <b>${pair}</b>${value(d.market) ? ' ' + escapeTelegram(d.market) : ''}${value(d.timeframe) ? ' · ' + escapeTelegram(d.timeframe) : ''}`, line('✅ ', d.status),
      // 3.69.0: Qualitätsfilter – Signalscore mit Kurzbegründung (z. B. „Trend ✔ · Volumen ✔ · R/R 2,6“)
      numLine('🎯 Signalscore ', d.score, v => telegramNumber(v, 0) + '/100' + (value(d.scoreWhy) ? ' · ' + escapeTelegram(d.scoreWhy) : ''))],
    [numLine('💰 Einstieg: ', d.entry, code), numLine('🎯 ⭐ <b>Ziel: ', d.target, v => money(v) + '</b> ⭐' + pctDistance(v, d.entry)), numLine('🛑 Ungültig bei: ', d.invalid, v => code(v) + pctDistance(v, d.entry)),
      numLine('⚖️ Chance/Risiko: ', crv, v => telegramNumber(v, 2) + ' : 1' + (v < 1 ? ' ⚠️' : ''))],
    [numLine('🧠 Regelgüte: ', d.quality, v => telegramBar(v) + ' ' + telegramNumber(v, Number.isInteger(v) ? 0 : 2) + ' %'), ...learned(d.learned, direction), '<i>ℹ️ Kursrichtung ≠ Zieltreffer · keine Erfolgswahrscheinlichkeit</i>', line('Modell: ', d.model)]];
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
