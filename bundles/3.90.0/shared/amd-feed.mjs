// AMD (3.90.0): Laufzeit im Analyse-Feed. Prüft alle Vorauswahl-Coins im Hintergrund (ein Abruf zur Zeit), hält Kerzen im Speicher und
// sendet bestätigte Setups über die gemeinsame Zustellung. Die Rechnung steckt in amd-core.mjs.
import { AMD, amdOptions, amdClosed, evaluateAmd } from './amd-core.mjs';
import { INTERVAL_MS, intervalEnd } from './market-intervals.mjs';
import { analysisSignalKey } from './analysis-delivery.mjs';
const MINUTE = 60000, FIXED = 86400000;

export function createAmdRuntime({ context, fetchRows, now, changed, signal, log }) {
  const state = { entries: new Map(), busy: false, requests: 0, evaluations: 0 };
  let controller = null, signature = '', generation = 0, lastStart = -Infinity;
  const options = () => amdOptions(context().options?.[AMD.id]);
  const available = () => { const c = context(); return !c.paused && !c.hidden && c.online !== false; };
  const fresh = () => ({ rows: null, forming: null, minutes: [], result: null, next: 0, failures: 0, error: '', attempted: new Set(), logged: new Set(), minuteTry: '' });

  function sync() {
    const c = context(), wanted = (c.symbols || []).filter(s => s.analyses.includes(AMD.id) && /^[A-Z0-9]{2,20}USDT$/.test(s.symbol) && ['spot', 'futures'].includes(s.market));
    const key = JSON.stringify([available(), wanted.map(s => [s.symbol, s.market]).sort(), options()]);
    if (key !== signature) {
      signature = key; generation++; controller?.abort(); controller = null; state.busy = false;
      for (const e of state.entries.values()) e.wanted = false;
      for (const s of wanted) {
        const k = s.symbol + '|' + s.market, e = state.entries.get(k);
        if (e) { e.wanted = true; e.next = 0; e.result = null; e.rows = null; e.forming = null; e.minutes = []; e.minuteTry = ''; } else state.entries.set(k, { symbol: s.symbol, market: s.market, wanted: true, ...fresh() });
      }
      for (const [k, e] of state.entries) if (!e.wanted) state.entries.delete(k);
    }
    return available() && state.entries.size > 0;
  }

  function result(symbol, market) {
    if (!available()) return { ready: false, stage: 0, signal: null, reason: 'Analyse pausiert oder offline.' };
    const e = state.entries.get(symbol + '|' + market), r = e?.result;
    if (e?.error) return { ready: false, stage: 0, signal: null, reason: e.error };
    if (!r) return { ready: false, stage: 0, signal: null, reason: 'Kerzendaten werden geladen.' };
    return r.signal && now() >= r.signal.expiresAt ? { ...r, signal: null, phase: 'expired', reason: 'Das bestätigte Setup ist zu alt; es wird nicht mehr gesendet.' } : r;
  }

  // Ein Setup wird nur einmal versucht; bei Fehlschlag (kein Ziel, Telegram aus, Netz) darf es innerhalb der Gültigkeit erneut versucht werden
  async function send(e, s) {
    if (!s || now() < s.at || now() >= s.expiresAt) return;
    const key = analysisSignalKey(s); if (e.attempted.has(key)) return;
    e.attempted.add(key); let ok = false;
    try { ok = await signal(s) !== false; } finally { if (!ok) e.attempted.delete(key); }
  }
  async function dispatch() { if (!sync()) return; for (const e of state.entries.values()) if (e.wanted) await send(e, result(e.symbol, e.market).signal); }

  const evaluate = (e, at, cfg) => { state.evaluations++; return evaluateAmd({ candles: e.rows, forming: e.forming, minutes: e.minutes, symbol: e.symbol, market: e.market, now: at, options: cfg }); };

  async function tick() {
    if (!sync() || state.busy || now() - lastStart < AMD.requestSpacingMs) return;
    const e = [...state.entries.values()].filter(e => e.wanted && now() >= e.next).sort((a, b) => a.next - b.next)[0]; if (!e) return;
    const gen = generation, at = now(), cfg = options(), iv = cfg.interval, ms = INTERVAL_MS[iv], minuteNext = Math.floor(at / MINUTE) * MINUTE + MINUTE + AMD.closeGraceMs;
    controller = new AbortController(); const abort = controller.signal; state.busy = true; lastStart = at;
    const load = async (interval, limit) => {
      state.requests++; const r = await fetchRows(e.symbol, interval, limit, abort);
      if (abort.aborted || gen !== generation) return null;
      if (r.source !== e.market) throw Error('AMD und Vorauswahl müssen denselben Börsenmarkt verwenden.');
      return r.candles;
    };
    try {
      // Zeitrahmen-Kerzen: neu laden, wenn ein Schluss fällig ist – oder jede Minute, solange eine Range/ein Durchbruch/ein Einstieg läuft
      const last = e.rows?.at(-1), due = last ? intervalEnd(last.end, iv) + AMD.closeGraceMs : 0, live = e.result?.live === true;
      if (!e.rows || at >= due || live) {
        const candles = await load(iv, AMD.history + 2); if (!candles) return;
        e.rows = amdClosed(candles, at); e.forming = candles.filter(c => (Number.isFinite(c.end) ? c.end : c.closeTime + 1) > at && c.time <= at).at(-1) || null;
        if (!e.rows.length) throw Error(`${iv}: keine geschlossenen Kerzen.`);
        if (ms <= FIXED && e.rows.at(-1).end !== Math.floor(at / ms) * ms) throw Error(`${iv}: neueste Schlusskerze fehlt.`);
      }
      let r = evaluate(e, at, cfg);
      // 1m-Kerzen: nur ab dem Durchbruch und nur, solange es etwas zu prüfen gibt
      const wantsMinutes = r.needsMinutes || r.live && r.current?.direction && !r.current.provisional && e.minutes.length && e.minutes.at(-1).end < Math.floor(at / MINUTE) * MINUTE;
      if (r.ready && wantsMinutes && e.minuteTry !== `${r.current.id}|${Math.floor(at / MINUTE)}`) {
        e.minuteTry = `${r.current.id}|${Math.floor(at / MINUTE)}`;
        // eine Stunde davor für den letzten Swing vor dem Extrem
        const from = r.needsMinutes?.from ?? Math.max(r.current.breakAt, at - AMD.minuteLimit * MINUTE), count = Math.min(AMD.minuteLimit, Math.ceil((at - from) / MINUTE) + 62);
        const candles = await load('1m', count); if (!candles) return;
        e.minutes = amdClosed(candles, at);
        r = evaluate(e, at, cfg);
      }
      e.result = r; e.error = ''; e.failures = 0;
      const live2 = r.live === true, lastClose = e.rows.at(-1).end;
      const nextClose = intervalEnd(lastClose, iv) + AMD.closeGraceMs;
      e.next = live2 ? minuteNext : Math.min(nextClose > at ? nextClose : minuteNext, at + 30 * MINUTE);
      const s = r.signal;
      if (s && !e.logged.has(s.setupId)) { e.logged.add(s.setupId); log({ kind: 'signal', symbol: e.symbol, text: `AMD · ${e.symbol} ${s.side === 'long' ? 'Long' : 'Short'} bestätigt (${iv}) · Einstieg ${s.entry}, Stop ${s.stop}, Ziel ${s.target}. Beobachtung, keine Order.` }); }
      if (s) void send(e, s).catch(error => log({ kind: 'error', symbol: e.symbol, text: `${e.symbol} · AMD: Versand fehlgeschlagen – ${error?.message || error}` }));
    } catch (error) {
      if (!abort.aborted && gen === generation) {
        e.error = error.message || 'AMD-Kerzen fehlen.'; e.failures++; e.next = now() + Math.min(AMD.retryMaxMs, AMD.retryMs * 2 ** Math.min(e.failures - 1, 3));
        log({ kind: 'error', symbol: e.symbol, text: `${e.symbol} · AMD: ${e.error} Coin übersprungen; erneuter Versuch nach Wartezeit.` });
      }
    } finally { if (gen === generation) { state.busy = false; controller = null; changed(); } }
  }
  return { state, sync, tick, result, dispatch };
}
