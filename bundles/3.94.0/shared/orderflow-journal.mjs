// Original-Signalzustände getrennt von Konfluenz/PO3 und von echten Buchungen.
export const SIGNAL_JOURNAL_LIMIT = 5000;
function validBook(raw) {
  if (raw == null) return { v: 1, records: [] };
  if (raw.v !== 1 || !Array.isArray(raw.records) || raw.records.some(r => !r || typeof r.id !== 'string' || !Number.isFinite(r.at) || !Number.isFinite(r.price) || !(r.price > 0) || !Array.isArray(r.groups) || !r.followups || [5, 15, 30].some(w => !Number.isFinite(r.followups[w]?.dueAt)))) throw new Error('Signaljournal kann nicht gelesen werden. Sicherung prüfen.');
  return raw;
}
export function journalBook(raw) { return globalThis.structuredClone(validBook(raw)); }
export function journalAdd(raw, record) {
  const book = journalBook(raw); if (book.records.some(r => r.id === record.id)) return book;
  if (book.records.length >= SIGNAL_JOURNAL_LIMIT) throw new Error('Signaljournal voll. CSV und persönliche Sicherung exportieren; alte Einträge bleiben erhalten.');
  book.records.push({ ...globalThis.structuredClone(record), model: 'orderflow-1', high: record.price, low: record.price, coverage: 'beobachtete Kurse', followups: Object.fromEntries([5, 15, 30].map(min => [min, { dueAt: record.at + min * 60000, done: false }])) });
  return journalBook(book);
}
export function journalAdvance(raw, { symbol, quote, now }) {
  const source = validBook(raw), records = [...source.records]; let changed = false;
  for (let i = 0; i < source.records.length; i++) {
    const original = source.records[i]; let r = original;
    if (Object.values(r.followups).every(f => f.done)) continue;
    const mutable = () => { if (r === original) { r = globalThis.structuredClone(original); records[i] = r; } };
    if (r.symbol === symbol && quote?.fresh && quote.at >= r.at && Number.isFinite(quote.price) && quote.price > 0) {
      const high = Math.max(r.high, quote.price), low = Math.min(r.low, quote.price); if (high !== r.high || low !== r.low) { mutable(); r.high = high; r.low = low; changed = true; }
    }
    for (const key of Object.keys(r.followups)) { let f = r.followups[key];
      if (f.done || now < f.dueAt) continue;
      if (now - f.dueAt <= 5000 && r.symbol === symbol && quote?.fresh && quote.at >= f.dueAt && Number.isFinite(quote.price) && quote.price > 0) { mutable(); f = r.followups[key]; f.done = true; f.price = quote.price; f.at = quote.at; f.changePct = (quote.price / r.price - 1) * 100; f.highPct = (r.high / r.price - 1) * 100; f.lowPct = (r.low / r.price - 1) * 100; changed = true; }
      else if (now - f.dueAt > 5000) { mutable(); f = r.followups[key]; f.done = true; f.price = null; f.reason = 'Kein frischer beobachteter Kurs am Zeitfensterende'; changed = true; }
    }
  }
  return { book: changed ? { ...source, records } : source, changed };
}
function cell(value) {
  let text = value == null ? '' : typeof value === 'number' ? String(value).replace('.', ',') : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (typeof value === 'string' && /^[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
// Nur tatsächlich beobachtete Folgekurse; Warten und Positionszustände liefern keine Einstiegstreffer.
export function journalStats(raw, window = 15) {
  const book = journalBook(raw), confidence = {}, groups = {}, entries = { buy: { total: 0, wins: 0 }, sell: { total: 0, wins: 0 } }; let waiting = 0, missing = 0, positions = 0;
  for (const r of book.records) {
    if (r.state !== 'flat') { positions++; continue; } if (r.signal === 'wait') { waiting++; continue; }
    if (!['buy', 'sell'].includes(r.signal)) continue;
    const f = r.followups[window]; if (!f?.done || !Number.isFinite(f.changePct)) { missing++; continue; }
    const d = r.signal === 'buy' ? 1 : -1, win = f.changePct * d > 0, c = confidence[r.confidence] ||= { total: 0, wins: 0 }; c.total++; c.wins += Number(win); entries[r.signal].total++; entries[r.signal].wins += Number(win);
    for (const g of [...r.groups, { name: 'BTC 5m', vote: r.btc?.five, available: Number.isFinite(r.btc?.five) }]) { if (!g.available || !Number.isFinite(g.vote) || g.vote === 0) continue; const row = groups[g.name] ||= { total: 0, wins: 0 }; row.total++; row.wins += Number(f.changePct * g.vote > 0); }
  }
  return { window, entries, confidence, groups, waiting, missing, positions, basis: 'Richtung nach beobachtetem Folgezeitraum, vor Kosten; keine Renditeprognose' };
}
function movement(r, high, low) { const d = r.state === 'position' ? r.position?.side === 'short' ? -1 : 1 : r.signal === 'buy' ? 1 : r.signal === 'sell' ? -1 : 0; return d ? { favorable: Math.max(0, d * high, d * low), adverse: Math.min(0, d * high, d * low) } : { favorable: null, adverse: null }; }
export function tradeObservation(previous = {}, position, quote, result, at) {
  const out = { ...previous };
  if (quote?.fresh && Number.isFinite(quote.price) && quote.price > 0) {
    const pct = (quote.price / position.entry - 1) * (position.side === 'short' ? -1 : 1) * position.leverage * 100;
    out.maxPct = Math.max(previous.maxPct ?? pct, pct); out.minPct = Math.min(previous.minPct ?? pct, pct);
    if (result?.signal === 'exit' && !out.firstExit) out.firstExit = { at, price: quote.price, reason: result.reason };
  }
  out.stop = position.stop ?? null; out.target = position.target ?? null; return out;
}
export function tradeCsv(closed, tracking = {}) {
  const header = ['Symbol', 'Art', 'Richtung', 'Hebel', 'Einstieg UTC', 'Ausstieg UTC', 'Dauer Minuten', 'Einstieg', 'Ausstieg', 'Kursbewegung %', 'Ergebnis % mit Hebel vor Gebühren', 'Größter beobachteter Gewinn %', 'Größter beobachteter Verlust %', 'Stop beim Ausstieg', 'Ziel beim Ausstieg', 'Erstes Aussteigen UTC', 'Kurs erstes Aussteigen', 'Grund erstes Aussteigen', 'Erfassungsumfang'];
  return '\uFEFF' + [header, ...closed.map(p => { const t = tracking[p.id] || {}, observed = t.observation || {}, valid = p.exit > 0 && !p.exitNA, pct = valid ? (p.exit / p.entry - 1) * (p.side === 'short' ? -1 : 1) * 100 : null; return [p.symbol, p.manual ? 'Manuell' : p.practice || p.demo ? 'DEMO' : 'Programm', p.side, p.leverage, new Date(p.openedAt).toISOString(), new Date(p.closedAt).toISOString(), (p.closedAt - p.openedAt) / 60000, p.entry, valid ? p.exit : null, pct, pct === null ? null : pct * p.leverage, observed.maxPct, observed.minPct, observed.stop, observed.target, observed.firstExit ? new Date(observed.firstExit.at).toISOString() : null, observed.firstExit?.price, observed.firstExit?.reason, 'Nur beobachtete Kurse während der Begleitung']; })].map(row => row.map(cell).join(';')).join('\r\n');
}
export function journalCsv(raw) {
  const book = journalBook(raw), header = ['Zeit UTC', 'Symbol', 'Signal', 'Zustand', 'Kurs', 'Score', 'Positionsscore', 'Konfidenz', 'BTC 1m Stufe', 'BTC 5m Stufe', 'BTC 1m %', 'BTC 5m %', 'BTC 15m %', 'BTC 60m %', 'BTC Referenzen', 'Gruppen', 'Vetos', 'Hinweise', 'Position', 'ATR', 'Kaufanteil 5m', 'Nach 5m %', 'Nach 15m %', 'Nach 30m %', 'Erfasste Hochbewegung %', 'Erfasste Tiefbewegung %', 'Erfassungsumfang', ...[5, 15, 30].flatMap(w => [`Bewegung für Signal ${w}m %`, `Bewegung gegen Signal ${w}m %`])];
  const rows = book.records.map(r => [new Date(r.at).toISOString(), r.symbol, r.signal, r.state, r.price, r.score, r.positionScore, r.confidence, r.btc?.one, r.btc?.five, ...[1, 5, 15, 60].map(w => r.btc?.changes?.[w]), r.btc?.basis, r.groups, r.vetoes, r.warnings, r.position, r.atr, r.share5,
    ...[5, 15, 30].map(w => r.followups[w]?.price == null ? r.followups[w]?.done ? 'nicht beobachtet' : '' : r.followups[w].changePct), (r.high / r.price - 1) * 100, (r.low / r.price - 1) * 100, r.coverage, ...[5, 15, 30].flatMap(w => { const f = r.followups[w], m = f?.price > 0 ? movement(r, f.highPct, f.lowPct) : { favorable: null, adverse: null }; return [m.favorable, m.adverse]; })]);
  return '\uFEFF' + [header, ...rows].map(row => row.map(cell).join(';')).join('\r\n') + '\r\n';
}
export function demoCsv(book) {
  return '\uFEFF' + [['Symbol', 'Richtung', 'Einstieg UTC', 'Ausstieg UTC', 'Einsatz USDT', 'Hebel', 'Einstieg', 'Ausstieg', 'Ergebnis USDT', 'Ergebnis % mit Hebel', 'Gebühren'], ...book.closed.map(p => { const pct = (p.exit / p.entry - 1) * (p.side === 'short' ? -1 : 1) * p.leverage * 100; return [p.symbol, p.side, new Date(p.openedAt).toISOString(), new Date(p.closedAt).toISOString(), p.margin, p.leverage, p.entry, p.exit, p.margin * pct / 100, pct, 0]; })].map(row => row.map(cell).join(';')).join('\r\n');
}
export function explanationPayload(result, { symbol, price, atr, share5, at }) {
  return { model: 'orderflow-1', at, symbol, signal: result.signal, state: result.state, score: result.score, positionScore: result.positionScore, confidence: result.confidence, groups: result.groups.map(g => ({ name: g.name, vote: g.vote, available: g.available, reason: g.reason })), btc: result.btc, position: result.position, values: { price, atr, share5 }, vetoes: result.vetoes, warnings: result.warnings, reason: result.reason };
}
