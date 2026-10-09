// 3.54.0: eigener Übungsbestand. Keine Börsenorders, Gebühren oder Veränderung echter Positionen.
export const DEMO_LIMIT = 2000;
export function demoBook(raw) {
  if (raw == null) return { v: 1, active: [], closed: [] };
  if (raw.v !== 1 || !Array.isArray(raw.active) || !Array.isArray(raw.closed)) throw new Error('Demo-Bestand kann nicht gelesen werden. Persönliche Sicherung prüfen.');
  const ids = new Set(), symbols = new Set();
  for (const p of [...raw.active, ...raw.closed]) {
    if (!p || typeof p.id !== 'string' || !p.id || ids.has(p.id) || !/^[A-Z0-9]{2,30}USDT$/.test(p.symbol) || !['long', 'short'].includes(p.side)
      || ![p.entry, p.margin, p.leverage, p.qty, p.openedAt].every(Number.isFinite) || !(p.entry > 0 && p.margin > 0 && p.qty > 0 && p.leverage >= 1 && p.leverage <= 125 && p.openedAt > 0)
      || p.closedAt !== undefined && !(Number.isFinite(p.exit) && p.exit > 0 && Number.isFinite(p.closedAt) && p.closedAt >= p.openedAt)) throw new Error('Demo-Bestand enthält ungültige Einträge. Persönliche Sicherung prüfen.');
    ids.add(p.id);
  }
  for (const p of raw.active) { if (p.closedAt !== undefined || symbols.has(p.symbol)) throw new Error('Demo-Bestand enthält widersprüchliche offene Positionen.'); symbols.add(p.symbol); }
  if (raw.closed.some(p => p.closedAt === undefined)) throw new Error('Demo-Abschluss ist unvollständig.');
  return globalThis.structuredClone(raw);
}
export function demoResult(p, price) {
  if (!p || !(price > 0) || !Number.isFinite(price)) return null;
  const move = (price / p.entry - 1) * (p.side === 'short' ? -1 : 1), pct = move * p.leverage * 100, pnl = move * p.margin * p.leverage;
  return Number.isFinite(pct) && Number.isFinite(pnl) ? { pct, pnl } : null;
}
export function demoOpen(raw, { id, symbol, side, margin, leverage, price, at }) {
  const book = demoBook(raw);
  if (!(margin > 0) || !Number.isFinite(margin) || !Number.isFinite(leverage) || leverage < 1 || leverage > 125 || !(price > 0) || !Number.isFinite(price) || !Number.isFinite(at) || !(at > 0)) throw new Error('Einsatz und Hebel (1–125×) gültig eingeben; Live-Kurs abwarten.');
  if (book.active.some(p => p.symbol === symbol)) throw new Error('Die Demo-Position dieses Coins ist bereits offen.');
  if (book.active.length + book.closed.length >= DEMO_LIMIT) throw new Error('Demo-Speicher voll. Persönliche Sicherung erstellen; bestehende Trades bleiben erhalten.');
  book.active.push({ id, symbol, side, entry: price, qty: margin * leverage / price, margin, leverage, openedAt: at });
  return demoBook(book);
}
export function demoClose(raw, symbol, price, at) {
  const book = demoBook(raw), p = book.active.find(x => x.symbol === symbol);
  if (!p || !Number.isFinite(at) || at < p.openedAt || !demoResult(p, price)) throw new Error('Demo-Abschluss braucht eine offene Position und einen gültigen Live-Kurs.');
  book.active = book.active.filter(x => x.id !== p.id); book.closed.push({ ...p, exit: price, closedAt: at }); return book;
}

export function createOrderflowDemo({ root, quote, symbol, now, read, save, formatPrice }) {
  const doc = root.ownerDocument, el = (tag, cls, value) => { const n = doc.createElement(tag); n.className = cls || ''; if (value) n.textContent = value; return n; };
  const text = (n, value) => { if (n.textContent !== value) n.textContent = value; };
  const details = el('details', 'of-demo'), summary = el('summary', '', 'Demo üben · ohne Gebühren'); details.id = 'of-demo'; details.append(summary);
  const explain = el('p', 'of-source', 'Einsatz = Margin in USDT. Klick auf den Futures-Live-Kurs eröffnet die Übung. Verkauf/Schließen übernimmt den dann aktuellen Live-Kurs. Reine Kurs-/Hebelrechnung ohne Gebühren, automatische Ausführung oder Liquidationssimulation. Keine echten Orders.');
  const fields = el('div', 'of-demo-fields');
  const input = (name, id, value, max) => { const label = el('label', '', name), n = el('input'); n.id = id; n.type = 'number'; n.min = '1'; if (max) n.max = String(max); n.step = id === 'of-demo-margin' ? 'any' : '1'; n.value = value; label.append(n); fields.append(label); return n; };
  const margin = input('Einsatz USDT', 'of-demo-margin', '100'), leverage = input('Hebel', 'of-demo-leverage', '1', 125), label = el('label', '', 'Richtung'), side = el('select'); side.id = 'of-demo-side';
  for (const [value, name] of [['long', 'Long · Kaufen'], ['short', 'Short · Verkaufen']]) { const o = el('option', '', name); o.value = value; side.append(o); } label.append(side); fields.append(label);
  const live = el('button', 'button of-demo-price'), close = el('button', 'button of-demo-close', 'Verkaufen zum Live-Kurs'); live.id = 'of-demo-price'; close.id = 'of-demo-close'; live.type = close.type = 'button';
  const position = el('p', 'of-source'), result = el('p', 'of-demo-result'), message = el('p', 'of-notice'); result.id = 'of-demo-result'; message.id = 'of-demo-status'; message.setAttribute('role', 'status');
  details.append(explain, fields, live, position, close, result, message); root.append(details);
  function render() {
    const sym = symbol(), q = quote(); let book;
    try { book = demoBook(read()); } catch (e) { text(message, e.message); live.disabled = close.disabled = true; text(result, '—'); return; }
    const p = book.active.find(p => p.symbol === sym), last = book.closed.filter(p => p.symbol === sym).at(-1), r = demoResult(p || last, p ? q?.price : last?.exit);
    text(live, `${sym || '—'} · ${q?.price > 0 ? formatPrice(q.price) : '—'} USDT${p ? ' · Position offen' : side.value === 'short' ? ' · Short eröffnen' : ' · Kaufen'}`);
    live.disabled = !q?.fresh || !!p; close.hidden = !p; close.disabled = !q?.fresh;
    margin.disabled = leverage.disabled = side.disabled = !!p;
    text(position, p ? `${p.side === 'short' ? 'Short' : 'Long'} · Einstieg ${formatPrice(p.entry)} · ${p.leverage}× · Einsatz ${p.margin.toLocaleString('de-DE')} USDT` : last ? `Letzter Abschluss · ${formatPrice(last.entry)} → ${formatPrice(last.exit)} USDT` : 'Noch keine Demo-Position für diesen Coin.');
    const signed = n => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('de-DE', { maximumFractionDigits: 2 })}`;
    text(result, r ? `${r.pnl < 0 ? 'Verlust' : 'Gewinn'} ${signed(r.pnl)} USDT · ${signed(r.pct)} % mit Hebel${p ? '' : ' · realisiert'}` : 'Gewinn / Verlust: —'); result.dataset.tone = r?.pnl > 0 ? 'up' : r?.pnl < 0 ? 'down' : 'neutral';
    close.dataset.tone = r?.pnl < 0 ? 'down' : 'up'; text(close, r?.pnl < 0 ? 'Verlust realisieren · Live-Kurs' : p?.side === 'short' ? 'Short schließen · Live-Kurs' : 'Verkaufen · Live-Kurs');
    live.title = close.title = q?.fresh ? 'Futures-Live-Kurs im Moment des Klicks' : 'Live-Kurs wird geladen; Handel ist vorübergehend nicht verfügbar.';
  }
  const act = action => { try { const q = quote(); if (!q?.fresh) throw new Error('Live-Kurs wird geladen. Bitte erneut versuchen, sobald der Kursknopf aktiv ist.'); save(action(q)); text(message, ''); } catch (e) { text(message, e.message); } render(); };
  live.addEventListener('click', () => act(q => demoOpen(read(), { id: globalThis.crypto.randomUUID(), symbol: symbol(), side: side.value, margin: Number(margin.value), leverage: Number(leverage.value), price: q.price, at: now() })));
  close.addEventListener('click', () => act(q => demoClose(read(), symbol(), q.price, now())));
  side.addEventListener('change', render); return { render };
}
