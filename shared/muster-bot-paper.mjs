import { musterSettings, runMusterBacktest, MUSTER_VERSION } from './muster-bot-core.mjs';
// 3.68.0: Telegram (wenn angekreuzt) auch bei Signalen mit späterem Einstieg (Buy-Stop/Schlusskurs). Bei Sofort-Einstieg
// (Konfluenz, PO3, Standard) enthält die Einstiegsmeldung bereits Modell, Richtung und Score – keine Doppelmeldung.
export function createMusterPaper({ read, write, client, selection, available = () => true, now = Date.now, changed = () => {}, notify = async () => {} }) {
  const state = { book: null, busy: false, message: '' }; let generation = 0, controller;
  async function persist(next) { const saved = await write(next, state.book?.revision ?? 0); state.book = saved; return saved; }
  async function restore() {
    try { const b = await read(); if (b && (b.version !== MUSTER_VERSION || !b.config || !b.symbol || !Number.isSafeInteger(b.startedAt))) throw new Error('Muster-Demo hat ein unbekanntes Modell; Daten bleiben erhalten'); state.book = b; }
    catch (e) { state.message = e.message; } changed(state); return state.book;
  }
  async function start(input, telegram = false) {
    const config = musterSettings(input), picked = selection();
    if (!picked || !/^[A-Z0-9]{2,20}USDT$/.test(picked.symbol) || !['spot', 'futures'].includes(picked.market)) throw new Error('Gewählten Coin zuerst im Chart laden');
    if (!available()) throw new Error('App zum Starten öffnen und mit dem Internet verbinden');
    generation++; controller?.abort(); state.busy = false;
    await persist({ version: MUSTER_VERSION, id: 'muster-' + now() + '-' + Math.random().toString(36).slice(2, 9), symbol: picked.symbol, market: picked.market, config, telegram, startedAt: now(), active: true, notified: {}, result: null });
    state.message = 'Demo läuft; auf ein neu bestätigtes Muster warten'; changed(state); return poll();
  }
  async function stop() { generation++; controller?.abort(); state.busy = false; if (state.book) await persist({ ...state.book, active: false }); state.message = 'Demo beendet; Ergebnis bleibt bis zum Löschen erhalten'; changed(state); }
  async function clear() { await stop(); await write(null, state.book?.revision ?? 0); state.book = null; state.message = 'Muster-Demo-Daten gelöscht'; changed(state); }
  async function poll() {
    if (!state.book?.active || state.busy || !available()) return;
    const run = state.book, mine = generation; state.busy = true; controller = new AbortController(); changed(state);
    try {
      const data = await client.load({ symbol: run.symbol, market: run.market, config: run.config, startTime: run.startedAt, asOf: now(), paper: true, signal: controller.signal });
      if (mine !== generation || !state.book?.active) return;
      const result = runMusterBacktest({ ...data, rows: data.rows[run.config.timeframe], config: run.config });
      await persist({ ...state.book, result, checkedAt: now() });
      for (const event of result.events.filter(e => ['entry', 'exit'].includes(e.kind) || (e.kind === 'signal' && e.entryMode !== 'instant'))) {
        const id = event.id + '|' + event.kind + '|' + event.at;
        if (!run.telegram || state.book.notified[id]) continue;
        if (Object.keys(state.book.notified).length >= 10000) { state.message = 'Meldungsjournal voll; Paper-Meldungen pausiert'; break; }
        await persist({ ...state.book, notified: { ...state.book.notified, [id]: now() } }); // vor Versand reservieren, kein Nachholen nach verlorener Antwort
        if (mine === generation && state.book.active) { try { await notify({ ...event, symbol: event.symbol || run.symbol, market: run.market, timeframe: run.config.timeframe }); } catch { state.message = 'Paper-Meldung nicht bestätigt; kein zweiter Versand'; } }
      }
      if (!state.message.includes('nicht bestätigt') && !state.message.includes('voll')) state.message = result.position ? (result.position.direction === -1 ? 'Short' : 'Long') + ' offen; Stop/Ziel am abgeschlossenen Kerzenmodell prüfen' : result.pending ? 'Muster erkannt; Einstieg wird geprüft' : 'Demo läuft; noch kein passendes neues Muster';
    } catch (e) {
      if (mine !== generation || controller.signal.aborted) return; state.message = e.message;
      if (/gespeichert|anderen Tab/.test(e.message)) { if (state.book) state.book.active = false; }
    } finally { if (mine === generation) { state.busy = false; controller = null; changed(state); } }
  }
  return { state, restore, start, stop, clear, poll, suspend() { generation++; controller?.abort(); controller = null; state.busy = false; changed(state); } };
}
