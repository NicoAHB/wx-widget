#!/usr/bin/env node
// Scalp Desk – 24/7-Dienst (Schritt 5.1; BTC-Puls ab 1.1, Gewinn-/Verlust-Alarm ab 1.2)
// Meldet Kurs-Alarme, Stop-Loss/Take-Profit offener Positionen, wichtige Wirtschaftstermine, den BTC-Puls (ungewöhnlich
// starke Bitcoin-Bewegung) und den Gewinn-/Verlust-Alarm (Live-Ergebnis aller offenen Positionen erreicht eine Grenze) per
// Telegram (auf Wunsch zusätzlich Discord) – rund um die Uhr, auch wenn die App überall geschlossen ist.
// Für den Gewinn-/Verlust-Alarm stehen Einstieg und Menge der offenen Positionen in der Datei – nur solange dort ein
// Gewinn- oder Verlust-Alarm aktiv ist; sonst bleiben Mengen und Einstiege in der App.
//
// Woher er die Daten hat: Die App legt die aktiven Alarme und Positionen als Datei „scalpdesk-247.json“ in deinen
// Telegram-Chat und heftet sie oben an. Dieser Dienst liest sie mit demselben Bot (getChat → angepinnte Nachricht →
// getFile), prüft jede Viertelminute die 1m-Kerzen bei Binance (auch kurze Dochte zählen) und bestätigt in der angepinnten
// Nachricht („Dienst: aktiv …“). Solange diese Bestätigung frisch ist, sendet die App selbst nichts doppelt.
// Der Server braucht nur ausgehende Verbindungen (Telegram, Binance, GitHub) – keine offenen Ports, keine Domain.
//
// Ohne Abhängigkeiten, Node.js ab Version 18. Einrichtung: server/install.sh (fragt Bot-Token und Chat-ID ab).
// Aufruf: node scalpdesk-247.mjs --config /etc/scalpdesk-247.json [--state /var/lib/scalpdesk-247/state.json] [--check]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERSION = '1.2.0';
const E = process.env;
// Adressen (für Tests über Umgebungsvariablen änderbar)
export const API = {
  tg: E.SCALPDESK_TG_API || 'https://api.telegram.org',
  spot: (E.SCALPDESK_SPOT_API || 'https://data-api.binance.vision,https://api.binance.com').split(',').map(s => s.trim()).filter(Boolean),
  fut: E.SCALPDESK_FUT_API || 'https://fapi.binance.com',
  cal: E.SCALPDESK_CAL_URL || 'https://raw.githubusercontent.com/NicoAHB/wx-widget/kalender/calendar.json'
};
// Takt: Kurse alle 15 s, angepinnte Datei jede Minute, Lebenszeichen alle 10 min, Kalender alle 30 min
export const EVERY = E.SCALPDESK_FAST
  ? { tick: 300, price: 1500, config: 2000, beat: 15e3, cal: 60e3, econ: 1500, feedStale: 12e3 }
  : { tick: 5e3, price: 15e3, config: 60e3, beat: 10 * 60e3, cal: 30 * 60e3, econ: 20e3, feedStale: 3 * 60e3 };
export const MARK = '📌 Scalp Desk · 24/7-Dienst', FILE = 'scalpdesk-247.json', LINE = 'Dienst:';
const TOKEN_RE = /^\d{5,15}:[A-Za-z0-9_-]{30,80}$/, CHAT_RE = /^(-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$/;
const DC_RE = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api(?:\/v\d{1,2})?\/webhooks\/\d{5,25}\/[A-Za-z0-9_-]{20,120}(?:\?thread_id=\d{5,25})?$/;
const SYM_RE = /^[A-Z0-9]{2,20}USDT$/;

// ---------- Anzeige wie in der App ----------
const NUM = new Map();
export function number(x, d = 2) {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  let f = NUM.get(d); if (!f) NUM.set(d, f = new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }));
  return f.format(x);
}
export const priceText = x => number(x, x > 0 && x < 1 ? Math.min(10, 3 - Math.floor(Math.log10(x))) : x && x < 100 ? 4 : 2);
export const coin = s => s.slice(0, -4);
export function validTz(tz) { try { new Intl.DateTimeFormat('de-DE', { timeZone: tz }); return typeof tz === 'string' && tz ? tz : 'UTC'; } catch { return 'UTC'; } }
const parts = (t, tz, o) => Object.fromEntries(new Intl.DateTimeFormat('de-DE', { timeZone: tz, hourCycle: 'h23', ...o }).formatToParts(t).map(p => [p.type, p.value]));
export function timeText(t, tz, sec = false) { const p = parts(t, tz, { hour: '2-digit', minute: '2-digit', ...(sec ? { second: '2-digit' } : {}) }); return `${p.hour}:${p.minute}${sec ? ':' + p.second : ''}`; }
// „30.09. 12:40“ – dasselbe Format schreibt die App in die angepinnte Nachricht
export function stamp(t, tz) { const p = parts(t, tz, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); return `${p.day}.${p.month}. ${p.hour}:${p.minute}`; }
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------- Datei der App prüfen (nur bekannte Felder, Grenzen wie in der App) ----------
export function parseConfig(j) {
  if (!j || j.kind !== 'scalpdesk-247' || j.v !== 1) throw new Error('Das ist keine Scalp-Desk-Datei für den 24/7-Dienst.');
  const pos = x => typeof x === 'number' && Number.isFinite(x) && x > 0, str = (x, n) => (typeof x === 'string' ? x.slice(0, n) : '');
  const alarms = (Array.isArray(j.alarms) ? j.alarms : []).filter(a => a && typeof a.id === 'string' && SYM_RE.test(a.symbol) && (a.dir === 'above' || a.dir === 'below') && pos(a.price) && Number.isFinite(a.armedAt))
    .slice(0, 300).map(a => ({ id: str(a.id, 40), symbol: a.symbol, source: a.source === 'futures' ? 'futures' : 'spot', dir: a.dir, price: a.price, note: str(a.note, 200), armedAt: a.armedAt }));
  const positions = (Array.isArray(j.positions) ? j.positions : []).filter(p => p && typeof p.id === 'string' && SYM_RE.test(p.symbol) && (p.side === 'long' || p.side === 'short') && Number.isFinite(p.since) && (pos(p.tp) || pos(p.sl)))
    .slice(0, 300).map(p => ({ id: str(p.id, 40), symbol: p.symbol, source: p.source === 'futures' ? 'futures' : 'spot', side: p.side, tp: pos(p.tp) ? p.tp : null, sl: pos(p.sl) ? p.sl : null,
      since: p.since, ack: { tp: !!p.ack?.tp, sl: !!p.ack?.sl } }));
  return {
    tag: /^[a-z0-9]{2,12}$/.test(j.tag) ? j.tag : '', at: Number.isFinite(j.at) ? j.at : 0, on: j.on !== false, tz: validTz(j.tz), app: str(j.app, 20), dev: str(j.dev, 60),
    ev: { alarm: j.ev?.alarm !== false, pos: j.ev?.pos !== false, news: j.ev?.news !== false, pulse: j.ev?.pulse === true, pnl: j.ev?.pnl !== false },
    econ: { warn: [0, 5, 15, 30, 60].includes(j.econ?.warn) ? j.econ.warn : 0, cur: j.econ?.cur === 'all' ? 'all' : 'usd' },
    alarms, positions, pulse: parsePulse(j.pulse), pnl: parsePnl(j.pnl)
  };
}
// Gewinn-/Verlust-Alarm (ab 1.2): alle offenen Positionen mit Einstieg und Menge (n = Anzahl in der App – fehlt eine, wird
// nicht geprüft, wie in der App) und je Art höchstens eine Grenze: k profit/loss, v Betrag in USDT (positiv), at Zeitpunkt
// des Scharfschaltens (gehört zum Schlüssel), w beim Scharfschalten schon erreicht (erst wieder darunter), done die App hat
// diese Meldung selbst gesendet (dann nicht noch einmal).
export function parsePnl(x) {
  if (!x || typeof x !== 'object') return null;
  const fin = v => typeof v === 'number' && Number.isFinite(v), str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const pos = (Array.isArray(x.pos) ? x.pos : []).filter(p => p && typeof p.id === 'string' && SYM_RE.test(p.symbol) && (p.side === 'long' || p.side === 'short') && fin(p.entry) && p.entry > 0 && fin(p.qty) && p.qty > 0)
    .slice(0, 300).map(p => ({ id: str(p.id, 40), symbol: p.symbol, source: p.source === 'futures' ? 'futures' : 'spot', side: p.side, entry: p.entry, qty: p.qty }));
  const lim = [];
  for (const l of Array.isArray(x.lim) ? x.lim : []) if (l && (l.k === 'profit' || l.k === 'loss') && fin(l.v) && l.v > 0 && l.v <= 1e9 && fin(l.at) && !lim.some(m => m.k === l.k)) lim.push({ k: l.k, v: l.v, at: l.at, w: !!l.w, done: !!l.done });
  const n = Number.isInteger(x.n) && x.n >= 0 ? x.n : pos.length;
  return lim.length ? { n, pos, lim } : null;
}
// BTC-Puls (ab 1.1): Schwellen der App je Tagesart (wd Mo–Fr, we Sa–So) und Stunde (UTC) für 5 und 15 Minuten in %, dazu die
// Mindestgrößen und die Vorauswahl-Coins für die zweite Zeile. Fehlt etwas oder ist es unplausibel: kein Puls.
export function parsePulse(x) {
  const pct = v => v === null || (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 50), day = a => Array.isArray(a) && a.length === 24 && a.every(h => Array.isArray(h) && h.length === 2 && h.every(pct));
  // Mindestgrößen: aus der App als [5 Min., 15 Min.], im gespeicherten Zustand schon als { 5, 15 } – beides gilt (sonst wäre der
  // Puls nach einem Neustart des Dienstes aus)
  const fl = Array.isArray(x?.floor) ? { 5: x.floor[0], 15: x.floor[1] } : x?.floor && typeof x.floor === 'object' ? { 5: x.floor[5], 15: x.floor[15] } : null;
  if (!x || typeof x !== 'object' || !day(x.thr?.wd) || !day(x.thr?.we) || !fl || ![fl[5], fl[15]].every(v => typeof v === 'number' && v >= 0.05 && v <= 20)) return null;
  return { thr: { wd: x.thr.wd, we: x.thr.we }, floor: fl, watch: (Array.isArray(x.watch) ? x.watch : []).filter(c => typeof c === 'string' && /^[A-Z0-9]{2,20}$/.test(c) && c !== 'BTC').slice(0, 12) };
}
export const isConfigMessage = m => !!m?.document && (m.document.file_name === FILE || String(m.caption || '').startsWith(MARK));

// ---------- Kurse: gehandelte Spanne seit der letzten Prüfung (1m-Kerzen) ----------
// rows: Binance-Kerzen [Beginn, Eröffnung, Hoch, Tief, Schluss, Volumen, Ende, …]. Gezählt wird nur, was seit der letzten
// Prüfung gehandelt wurde, und nur nach dem Scharfschalten (wie in der App: ein Docht von davor löst nichts aus):
// - Kerzen, die nach der letzten Prüfung begonnen haben: Hoch und Tief, wenn sie nach dem Scharfschalten begonnen haben.
// - Die Kerze, die bei der letzten Prüfung schon lief (prev: ihr Hoch/Tief damals und der Zeitpunkt): nur, was sie seitdem
//   darüber hinaus erreicht hat – bis prev.h/prev.l war schon geprüft. Das neue geschah nach der letzten Prüfung; zählt,
//   wenn die schon nach dem Scharfschalten war.
// - Sonst (erste Prüfung, Kerze begann vor dem Scharfschalten): nur der aktuelle Kurs.
export const candles = rows => rows.map(r => ({ t: +r[0], h: +r[2], l: +r[3], c: +r[4], T: +r[6] })).filter(c => [c.t, c.h, c.l, c.c, c.T].every(Number.isFinite) && c.c > 0);
export function rangeView(rows, from, armedFrom, prev = null) {
  const cs = candles(rows);
  if (!cs.length) return null;
  const price = cs.at(-1).c; let hi = price, lo = price;
  for (const c of cs) {
    if (c.T < from) continue;                                   // schon vor der letzten Prüfung zu Ende
    if (prev && c.t === prev.t) {                               // lief schon bei der letzten Prüfung
      if (prev.at >= armedFrom) { if (c.h > prev.h && c.h > hi) hi = c.h; if (c.l < prev.l && c.l < lo) lo = c.l; }
    } else if (c.t >= armedFrom && (!prev || c.t > prev.t)) { if (c.h > hi) hi = c.h; if (c.l < lo) lo = c.l; }
  }
  return { price, hi, lo };
}
// Marke erreicht? below: Marke liegt unter dem Kurs (Long-Stop, Short-Ziel, Alarm „auf/unter“)
export function touched(level, below, v) {
  const now = below ? v.price <= level : v.price >= level;
  return now || (below ? v.lo <= level : v.hi >= level) ? { wick: !now, extreme: below ? v.lo : v.hi } : null;
}
const howReached = info => (info.wick ? `kurz per Docht erreicht (bis ${priceText(info.extreme)})` : 'erreicht');
export const alarmText = (a, price, info) => `🔔 Kurs-Alarm ${coin(a.symbol)}\n${coin(a.symbol)} ${a.dir === 'above' ? 'auf/über' : 'auf/unter'} ${priceText(a.price)} USDT ${howReached(info)} · Kurs ${priceText(price)}${a.note ? '\nNotiz: ' + a.note : ''}`;
export function posText(p, type, price, info) {
  const what = `${coin(p.symbol)} ${p.side === 'long' ? 'Long' : 'Short'}: ${type === 'tp' ? 'Take-Profit' : 'Stop-Loss'}`;
  return `${type === 'tp' ? '🎯' : '🛑'} ${what} erreicht\n${what} ${priceText(p[type])} ${howReached(info)} · Kurs ${priceText(price)}`;
}
export const alarmKey = a => `al:${a.id}:${a.armedAt}`;
// ---- Gewinn-/Verlust-Alarm (ab 1.2): dieselbe Regel wie in der App ----
// Live-Ergebnis = Summe Menge × (Kurs − Einstieg) × Richtung über alle offenen Positionen, auf Cent gerundet; ohne offene
// Position oder solange ein Kurs fehlt: keine Prüfung. Gewinn v meldet bei ≥ +v, Verlust v bei ≤ −v – je Scharfschalten einmal.
export const pnlKey = l => `pnl:${l.k}:${l.at}`;
export const pnlMet = (k, v, cur) => cur !== null && (k === 'profit' ? cur >= v : cur <= -v);
export function pnlTotal(pnl, prices) {
  if (!pnl?.pos.length || pnl.pos.length !== pnl.n) return null;
  let total = 0;
  for (const p of pnl.pos) { const pr = prices.get(`${p.source}:${p.symbol}`); if (!(pr > 0)) return null; total += p.qty * (pr - p.entry) * (p.side === 'long' ? 1 : -1); }
  return Math.round(total * 100) / 100;
}
const pnlCond = l => (l.k === 'profit' ? `≥ +${number(l.v)} USDT` : `≤ −${number(l.v)} USDT`);
export const pnlName = k => (k === 'profit' ? 'Gewinn-Alarm' : 'Verlust-Alarm');
export function pnlText(l, cur, n) {
  return `${l.k === 'profit' ? '📈' : '📉'} ${pnlName(l.k)}\nLive-Ergebnis ${signedText(cur)} USDT (${n} ${n === 1 ? 'offene Position' : 'offene Positionen'}) · Schwelle ${pnlCond(l)} erreicht`;
}
// Zeile in der angepinnten Nachricht, an der die App eine vom Dienst gesendete Meldung erkennt (Art, Scharfschalten, Zeitpunkt, Wert)
export const pnlLine = (l, f, tz) => `GV: ${pnlName(l.k)} ausgelöst ${stamp(f.t, tz)} bei ${signedText(f.val)} USDT · @${l.k === 'profit' ? 'p' : 'l'}:${l.at}:${f.t}:${f.val}`;
export const posKey = (p, type) => `pos:${p.id}:${type}:${p.since}`;

// ---------- BTC-Puls (ab 1.1): dieselbe Regel wie in der App (pulse.js) ----------
// Bewegung über 5 bzw. 15 Minuten (Kurs jetzt gegen den Schluss der 1m-Kerze vor 5 bzw. 15 Minuten) größer als der 99-%-Wert
// dieser Uhrzeit aus der App und mindestens die Mindestgröße; je Richtung höchstens eine Meldung in 30 Minuten, außer die
// Bewegung legt deutlich zu (1,5-fach, dann höchstens eine weitere). Nur Fakten, keine Prognose; nachts lautlos.
export const PULSE_WIN = [5, 15], PULSE_GAP = 30 * 60e3, PULSE_MORE = 1.5;
export function pulseSlot(t) { const d = new Date(t - 1), wd = d.getUTCDay(); return { h: d.getUTCHours(), we: wd === 0 || wd === 6 }; }
export function pulseLimit(pc, w, now) { const s = pulseSlot(now), v = pc.thr[s.we ? 'we' : 'wd'][s.h][PULSE_WIN.indexOf(w)]; return Math.max(v > 0 ? v : 0, pc.floor[w]); }
// closed: abgeschlossene 1m-Kerzen ({ t, c }), aufsteigend; nur ohne Lücke
export function pulseMove(closed, price, w) {
  const ref = closed.at(-w), last = closed.at(-1);
  if (!ref || !last || !(price > 0) || last.t - ref.t !== (w - 1) * 6e4) return null;
  return (price / ref.c - 1) * 100;
}
export function pulseDecide(moves, pc, now, last = {}) {
  let best = null;
  for (const w of PULSE_WIN) { const mv = moves[w]; if (mv == null) continue; const lim = pulseLimit(pc, w, now), r = Math.abs(mv) / lim; if (r >= 1 && (!best || r > best.r)) best = { w, mv, lim, r }; }
  if (!best) return null;
  const d = best.mv > 0 ? 'up' : 'down', l = last[d], mag = Math.abs(best.mv);
  if (l && now - l.t < PULSE_GAP) { if (l.more || mag < l.mag * PULSE_MORE) return null; return { ...best, d, mag, more: true }; }
  return { ...best, d, mag, more: false };
}
function signedText(v) { return `${v > 0 ? '+' : v < 0 ? '−' : ''}${number(Math.abs(v))}`; }
export function pulseText(p, price, hourLocal, others) {
  const pc = v => `${signedText(v)} %`;
  return `⚡ BTC-Puls: BTC ${pc(p.mv)} in ${p.w} Min. (${priceText(price)} USDT)${p.more ? ' – Bewegung legt weiter zu' : ''} – ungewöhnlich stark für ${hourLocal} Uhr (Schwelle ${number(p.lim)} %)`
    + (others.length ? `\nVorauswahl im selben Zeitraum: ${others.map(([c, v]) => `${c} ${pc(v)}`).join(' · ')}` : '');
}

// ---------- Wirtschaftskalender (Datei des GitHub-Jobs, wie in der App) ----------
export function parseCalendar(d) {
  if (!d || !Array.isArray(d.events)) throw new Error('Kalenderdatei ohne Termine');
  const s = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  return d.events.filter(e => Number.isFinite(e?.t) && typeof e.title === 'string' && /^[A-Z]{3}$/.test(e.cur)).slice(0, 800)
    .map(e => ({ t: e.t, cur: e.cur, impact: e.impact, title: s(e.title, 90), forecast: s(e.forecast, 20), previous: s(e.previous, 20) }));
}
// Termine mit hoher Bedeutung, die in den nächsten `warn` Minuten anstehen; zur selben Zeit als einer
export function econDue(events, now, econ) {
  if (!econ.warn) return [];
  const g = new Map();
  for (const e of events) if (e.impact === 'high' && (econ.cur === 'all' || e.cur === 'USD') && now >= e.t - econ.warn * 60e3 && now < e.t) { if (!g.has(e.t)) g.set(e.t, []); g.get(e.t).push(e); }
  return [...g].sort((a, b) => a[0] - b[0]).map(([t, list]) => ({ t, list }));
}
const ecNum = s => s.replace(/(\d)\.(\d)/g, '$1,$2').replace(/(\d)%/, '$1 %');
export function econText(g, now, tz) {
  const cur = [...new Set(g.list.map(e => e.cur))].join('/'), vals = g.list.map(e => [e.forecast && `Prognose ${ecNum(e.forecast)}`, e.previous && `vorher ${ecNum(e.previous)}`].filter(Boolean).join(', ')).filter(Boolean);
  return `⚠ Wirtschaftstermin in ${Math.ceil((g.t - now) / 60e3)} min (${timeText(g.t, tz)} Uhr)\n${cur} ${g.list.map(e => e.title).join(', ')} – hohe Bedeutung, starke Kursausschläge möglich.${vals.length ? `\n${vals.join(' · ')}` : ''}`;
}

// ---------- Angepinnte Nachricht: Zeile der App und Zeile des Dienstes ----------
export function appLine(c) {
  return `App: ${stamp(c.at, c.tz)} · ${c.on ? `${plural(c.alarms.length, 'Alarm', 'Alarme')}, ${plural(c.positions.length, 'Position', 'Positionen')}` : 'Übergabe ausgeschaltet'}${c.dev ? ` · ${c.dev}` : ''} · #${c.tag}`;
}
// ok: Kurse kommen an; problem: Grund der Störung. „#tag übernommen“ liest die App als Bestätigung.
// „· Puls“ (ab 1.1): der Dienst meldet den BTC-Puls – dann sendet die App ihn nicht zusätzlich
// „· GV“ (ab 1.2): der Dienst prüft den Gewinn-/Verlust-Alarm; steht vor „· Puls“, damit ältere Apps „· Puls · #“ weiter erkennen
export const pulseOn = c => !!(c?.on && c.ev.pulse && c.pulse);
export const pnlOn = c => !!(c?.on && c.ev.pnl && c.pnl);
export function statusLine({ ok, now, c, problem }) {
  return `${LINE} ${ok ? 'aktiv' : 'Störung'} · ${stamp(now, c.tz)}${pnlOn(c) ? ' · GV' : ''}${pulseOn(c) ? ' · Puls' : ''} · #${c.tag} übernommen${ok ? '' : ` · ${problem}`}`;
}
// darunter je vom Dienst gesendetem Gewinn-/Verlust-Alarm eine Zeile (pnlLine) – so übernimmt die App „ausgelöst“
export const caption = (c, status, extra = []) => [MARK, appLine(c), status, ...extra].join('\n').slice(0, 1024);

// ---------- Einstellungen des Servers ----------
export function readServerConfig(file) {
  let j; try { j = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(`Einstellungen ${file} nicht lesbar: ${e.message}`); }
  const token = String(j.token || '').trim(), chat = String(j.chat || '').trim(), discord = String(j.discord || '').trim();
  if (!TOKEN_RE.test(token)) throw new Error(`Bot-Token in ${file} fehlt oder hat das falsche Format (123456789:AA…).`);
  if (!CHAT_RE.test(chat)) throw new Error(`Chat-ID in ${file} fehlt oder hat das falsche Format.`);
  if (discord && !DC_RE.test(discord)) throw new Error(`Discord-Webhook in ${file} hat das falsche Format.`);
  return { token, chat, discord };
}

// ---------- Der Dienst ----------
export class Watcher {
  constructor({ token, chat, discord = '', statePath = '', now = () => Date.now(), log = (...a) => console.log(...a) }) {
    Object.assign(this, { token, chat, discord, statePath, now, log });
    this.conf = null; this.fired = {}; this.seen = new Map(); this.rearm = new Map(); this.lastCheck = new Map(); this.prevCandle = new Map();
    this.cal = null; this.calAt = 0; this.feed = { okAt: 0, error: '', since: 0 }; this.next = { config: 0, price: 0, beat: 0, cal: 0, econ: 0 };
    this.beatOk = null; this.stopped = false; this.saveTimer = null; this.errors = new Map(); this.waiting = false; this.pulseLast = { up: null, down: null };
    this.pnlSt = {}; this.pnlFired = {}; // Gewinn-/Verlust-Alarm je Scharfschalten: wait/armed; gesendet { t, val } (by: 'app' = die App hat selbst gesendet)
    this.loadState();
  }
  // ---- Zustand (ausgelöste Meldungen, zuletzt gelesene Datei, Kalender) über Neustarts hinweg ----
  loadState() {
    if (!this.statePath) return;
    try {
      const s = JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
      if (s && s.v === 1) { this.fired = s.fired && typeof s.fired === 'object' ? s.fired : {}; if (s.pulse && typeof s.pulse === 'object') this.pulseLast = { up: s.pulse.up || null, down: s.pulse.down || null };
        if (s.pnl && typeof s.pnl === 'object') { this.pnlSt = s.pnl.st && typeof s.pnl.st === 'object' ? s.pnl.st : {}; this.pnlFired = s.pnl.fired && typeof s.pnl.fired === 'object' ? s.pnl.fired : {}; } if (s.conf?.data) this.conf = { ...s.conf, data: parseConfig({ kind: 'scalpdesk-247', v: 1, ...s.conf.data }) }; if (Array.isArray(s.cal?.events)) { this.cal = s.cal.events; this.calAt = s.cal.at || 0; } }
    } catch { /* erster Start oder beschädigt: neu anfangen */ }
  }
  stateJson() { const c = this.conf; return JSON.stringify({ v: 1, fired: this.fired, pulse: this.pulseLast, pnl: { st: this.pnlSt, fired: this.pnlFired }, conf: c && { msgId: c.msgId, fileUid: c.fileUid, data: c.data }, cal: this.cal && { at: this.calAt, events: this.cal } }); }
  saveStateNow() {
    if (!this.statePath) return;
    try { fs.mkdirSync(path.dirname(this.statePath), { recursive: true }); const tmp = this.statePath + '.tmp'; fs.writeFileSync(tmp, this.stateJson()); fs.renameSync(tmp, this.statePath); }
    catch (e) { this.log('Zustand nicht gespeichert:', e.message); }
  }
  saveState() { if (!this.statePath) return; clearTimeout(this.saveTimer); this.saveTimer = setTimeout(() => this.saveStateNow(), 1000); }
  secret(msg) { return String(msg).split(this.token).join('<Token>'); }
  // Fehler ins Protokoll – dieselbe Meldung höchstens alle 10 Minuten (sonst schreibt ein Binance-Ausfall alle 15 s eine Zeile)
  note(name, msg) {
    const t = this.now(), m = this.secret(msg), prev = this.errors.get(name);
    if (!prev || prev.msg !== m || t - prev.at > 10 * 60e3) { this.log(`${name}:`, m); this.errors.set(name, { msg: m, at: t }); }
  }
  clear(name) { if (this.errors.delete(name)) this.log(`${name}: wieder in Ordnung`); }
  // ---- Telegram ----
  async tg(method, body, timeout = 20000) {
    let r;
    try { r = await fetch(`${API.tg}/bot${this.token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(timeout) }); }
    catch (e) { throw Object.assign(new Error(`Telegram nicht erreichbar (${this.secret(e.cause?.code || e.message)})`), { code: 0 }); }
    let d = null; try { d = await r.json(); } catch { /* keine JSON-Antwort */ }
    if (!r.ok || !d?.ok) throw Object.assign(new Error(`Telegram ${method}: ${d?.description || 'Fehler ' + r.status}`), { code: d?.error_code || r.status, retry: d?.parameters?.retry_after || 0 });
    return d.result;
  }
  async send(text, tz, opts = {}) {
    const full = `${text}\n${timeText(this.now(), tz, true)} Uhr · 24/7-Dienst`;
    for (let i = 0; i < 3; i++) {
      try { await this.tg('sendMessage', { chat_id: this.chat, text: full.slice(0, 4000), link_preview_options: { is_disabled: true }, ...(opts.silent ? { disable_notification: true } : {}) }); break; }
      catch (e) { this.log('Telegram:', e.message); if (e.code === 429 && e.retry) await sleep(e.retry * 1000); else if (e.code && e.code !== 429 && e.code < 500) break; else await sleep(2000 * (i + 1)); }
    }
    if (this.discord) {
      try { const r = await fetch(this.discord, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: full.slice(0, 1900), allowed_mentions: { parse: [] } }), signal: AbortSignal.timeout(15000) }); if (!r.ok && r.status !== 204) this.log('Discord: Fehler', r.status); }
      catch (e) { this.log('Discord nicht erreichbar:', e.cause?.code || e.message); }
    }
  }
  // ---- angepinnte Datei der App lesen ----
  async syncConfig() {
    const chat = await this.tg('getChat', { chat_id: this.chat }), pm = chat?.pinned_message;
    if (!isConfigMessage(pm)) {
      if (this.conf) { this.log('Keine angepinnte Datei der App mehr – der Dienst meldet nichts, bis die App wieder übergibt.'); this.conf = null; this.saveState(); }
      else if (!this.waiting) this.log('Warte auf die angepinnte Datei der App („An den 24/7-Dienst übergeben“ einschalten) …');
      this.waiting = true;
      return;
    }
    this.waiting = false;
    const doc = pm.document;
    if (this.conf && this.conf.msgId === pm.message_id && this.conf.fileUid === doc.file_unique_id) return;
    const f = await this.tg('getFile', { file_id: doc.file_id });
    let r; try { r = await fetch(`${API.tg}/file/bot${this.token}/${f.file_path}`, { signal: AbortSignal.timeout(20000) }); } catch (e) { throw new Error(`Datei nicht ladbar (${this.secret(e.cause?.code || e.message)})`); }
    if (!r.ok) throw new Error(`Datei nicht ladbar (Fehler ${r.status})`);
    const data = parseConfig(await r.json()), old = this.conf?.data, t = this.now();
    this.conf = { msgId: pm.message_id, fileUid: doc.file_unique_id, data };
    // neue oder wieder scharf geschaltete Marken ab jetzt beobachten; Meldungen zu entfernten Alarmen vergessen
    const keys = new Set([...data.alarms.map(alarmKey), ...data.positions.flatMap(p => ['tp', 'sl'].map(ty => posKey(p, ty)))]);
    for (const k of keys) if (!this.seen.has(k)) this.seen.set(k, t);
    for (const k of Object.keys(this.fired)) if ((k.startsWith('al:') || k.startsWith('pos:')) && !keys.has(k)) delete this.fired[k];
    for (const k of [...this.seen.keys()]) if (!keys.has(k)) this.seen.delete(k);
    // Gewinn-/Verlust-Grenzen: neu scharf geschaltete übernehmen (beim Scharfschalten schon erreicht → erst wieder darunter),
    // von der App selbst gesendete nicht noch einmal; entfernte und neu scharf geschaltete (anderer Zeitpunkt) vergessen
    const lims = pnlOn(data) ? data.pnl.lim : [], pk = new Set(lims.map(pnlKey));
    for (const l of lims) { const k = pnlKey(l); if (!this.pnlSt[k]) this.pnlSt[k] = l.w ? 'wait' : 'armed'; if (l.done && !this.pnlFired[k]) this.pnlFired[k] = { t, val: null, by: 'app' }; }
    for (const k of Object.keys(this.pnlSt)) if (!pk.has(k)) delete this.pnlSt[k];
    for (const k of Object.keys(this.pnlFired)) if (!pk.has(k)) delete this.pnlFired[k];
    this.log(`Datei der App übernommen (#${data.tag}): ${data.on ? `${plural(data.alarms.length, 'Alarm', 'Alarme')}, ${plural(data.positions.length, 'Position', 'Positionen')}${data.econ.warn && data.ev.news ? `, Termin-Warnung ${data.econ.warn} min vorher` : ''}${pulseOn(data) ? ', BTC-Puls' : ''}${pnlOn(data) ? `, Gewinn-/Verlust-Alarm (${lims.map(l => `${l.k === 'profit' ? '≥ +' : '≤ −'}${l.v} USDT`).join(', ')}, ${plural(data.pnl.n, 'offene Position', 'offene Positionen')})` : ''}` : 'Übergabe in der App ausgeschaltet'}`);
    if (!old || old.tag !== data.tag) this.next.beat = 0; // gleich bestätigen
    this.saveState();
  }
  // ---- Kurse prüfen ----
  async checkPrices() {
    const c = this.conf?.data; if (!c?.on) return;
    const groups = new Map(), add = (it, kind) => { const k = `${it.source}:${it.symbol}`; if (!groups.has(k)) groups.set(k, { source: it.source, symbol: it.symbol, alarms: [], positions: [], pnl: [] }); groups.get(k)[kind].push(it); };
    if (c.ev.alarm) for (const a of c.alarms) add(a, 'alarms');
    if (c.ev.pos) for (const p of c.positions) add(p, 'positions');
    if (pnlOn(c)) for (const p of c.pnl.pos) add(p, 'pnl');
    if (!groups.size) { this.feed = { okAt: this.now(), error: '', since: 0 }; return; }
    let bad = ''; const prices = new Map();
    for (const [k, g] of groups) {
      let rows;
      try { rows = await klines(g.source, g.symbol); } catch (e) { bad = `${coin(g.symbol)}: ${e.message}`; continue; }
      const t = this.now(), from = this.lastCheck.get(k) ?? t, prev = this.prevCandle.get(k) || null, last = candles(rows).at(-1);
      if (last) prices.set(k, last.c);
      this.lastCheck.set(k, t); if (last) this.prevCandle.set(k, { t: last.t, h: last.h, l: last.l, at: t });
      // beobachtet ab dem ersten Blick des Dienstes auf diese Marke (nach einem Neustart: ab dann), nach einem Treffer ab dem Wegbewegen
      const armed = key => { if (!this.seen.has(key)) this.seen.set(key, t); return Math.max(this.seen.get(key), this.rearm.get(key) || 0); };
      for (const a of g.alarms) {
        const key = alarmKey(a); if (this.fired[key]) continue;
        const v = rangeView(rows, from, Math.max(a.armedAt, armed(key)), prev); if (!v) continue;
        const hit = touched(a.price, a.dir === 'below', v);
        if (hit) { this.fired[key] = t; this.saveState(); this.log(`Alarm ${coin(a.symbol)} ${a.dir === 'above' ? '≥' : '≤'} ${a.price} (Kurs ${v.price})`); await this.send(alarmText(a, v.price, hit), c.tz); }
      }
      for (const p of g.positions) for (const type of ['sl', 'tp']) {
        if (!(p[type] > 0)) continue;
        const key = posKey(p, type), v = rangeView(rows, from, Math.max(p.since, armed(key)), prev); if (!v) continue;
        const hit = touched(p[type], (type === 'sl') === (p.side === 'long'), v);
        if (hit) {
          if (!this.fired[key] && !p.ack[type]) { this.fired[key] = t; this.saveState(); this.log(`${type.toUpperCase()} ${coin(p.symbol)} ${p.side} ${p[type]} (Kurs ${v.price})`); await this.send(posText(p, type, v.price, hit), c.tz); }
        } else if (this.fired[key]) { delete this.fired[key]; this.rearm.set(key, t); this.saveState(); } // Kurs wieder weg: nächste Berührung meldet erneut
      }
    }
    if (pnlOn(c)) await this.checkPnl(c, prices);
    const t = this.now();
    if (!bad) { this.feed = { okAt: t, error: '', since: 0 }; this.clear('Kurse'); }
    else { if (!this.feed.since) this.feed.since = t; this.feed.error = bad; this.note('Kurse', bad); }
  }
  // ---- Gewinn-/Verlust-Alarm (ab 1.2): dieselbe Regel wie in der App, mit den Kursen dieser Prüfung ----
  async checkPnl(c, prices) {
    const cur = pnlTotal(c.pnl, prices); if (cur === null) return; // ohne offene Position oder mit fehlendem Kurs: keine Prüfung
    const t = this.now();
    for (const l of c.pnl.lim) {
      const k = pnlKey(l); if (this.pnlFired[k]) continue;
      const met = pnlMet(l.k, l.v, cur), st = this.pnlSt[k] || (l.w ? 'wait' : 'armed');
      if (st === 'wait') { if (!met) { this.pnlSt[k] = 'armed'; this.saveState(); } continue; }
      if (!met) continue;
      this.pnlFired[k] = { t, val: cur }; this.saveState(); this.next.beat = 0; // gleich in der angepinnten Nachricht vermerken
      this.log(`${pnlName(l.k)}: Live-Ergebnis ${cur} USDT (Grenze ${l.k === 'profit' ? '≥ +' : '≤ −'}${l.v})`);
      await this.send(pnlText(l, cur, c.pnl.pos.length), c.tz);
    }
  }
  // ---- BTC-Puls (ab 1.1): dieselbe Regel wie in der App ----
  async checkPulse() {
    const c = this.conf?.data; if (!pulseOn(c)) return;
    const t = this.now(), rows = candles(await klines('spot', 'BTCUSDT', 17)), closed = rows.filter(x => x.T < t), price = rows.at(-1)?.c;
    const moves = Object.fromEntries(PULSE_WIN.map(w => [w, pulseMove(closed, price, w)])), p = pulseDecide(moves, c.pulse, t, this.pulseLast);
    if (!p) return;
    const last = this.pulseLast[p.d]; this.pulseLast[p.d] = { t, mag: p.more ? Math.max(p.mag, last?.mag || 0) : p.mag, more: p.more }; this.saveState();
    const others = [];
    for (const cn of c.pulse.watch) { try { const r = candles(await klines('spot', cn + 'USDT', 17)), v = pulseMove(r.filter(x => x.T < t), r.at(-1)?.c, p.w); if (v != null) others.push([cn, v]); } catch { /* Coin ohne Spot-Paar: weglassen */ } }
    const h = Number(parts(t, c.tz, { hour: '2-digit' }).hour);
    this.log(`BTC-Puls ${p.d === 'up' ? '▲' : '▼'} ${p.mv.toFixed(2)} % in ${p.w} min (Schwelle ${p.lim} %)`);
    await this.send(pulseText(p, price, String(h).padStart(2, '0'), others), c.tz, { silent: h >= 22 || h < 7 });
  }
  // ---- Termine ----
  async loadCalendar() {
    const r = await fetch(API.cal, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`Kalender nicht erreichbar (Fehler ${r.status})`);
    this.cal = parseCalendar(await r.json()); this.calAt = this.now(); this.saveState();
  }
  async checkEcon() {
    const c = this.conf?.data; if (!c?.on || !c.ev.news || !c.econ.warn || !this.cal) return;
    const t = this.now();
    for (const g of econDue(this.cal, t, c.econ)) {
      const key = `econ-chan:${g.t}`; if (this.fired[key]) continue;
      this.fired[key] = t; this.saveState(); this.log(`Termin ${new Date(g.t).toISOString()}: ${g.list.map(e => e.title).join(', ')}`);
      await this.send(econText(g, t, c.tz), c.tz);
    }
    for (const [k, at] of Object.entries(this.fired)) if (k.startsWith('econ-chan:') && t - at > 2 * 864e5) delete this.fired[k];
  }
  // ---- Lebenszeichen in der angepinnten Nachricht ----
  health() {
    const c = this.conf?.data, t = this.now();
    if (!c?.on) return { ok: true, problem: '' };
    const stale = this.feed.since && t - this.feed.since > EVERY.feedStale;
    return stale ? { ok: false, problem: `Kurse nicht abrufbar seit ${timeText(this.feed.since, c.tz)} (${this.feed.error.slice(0, 120)})` } : { ok: true, problem: '' };
  }
  async heartbeat() {
    if (!this.conf) return;
    const c = this.conf.data, h = this.health(), gv = pnlOn(c) ? c.pnl.lim.map(l => [l, this.pnlFired[pnlKey(l)]]).filter(([, f]) => f && f.by !== 'app').map(([l, f]) => pnlLine(l, f, c.tz)) : [];
    const text = caption(c, statusLine({ ok: h.ok, now: this.now(), c, problem: h.problem }), gv);
    try { await this.tg('editMessageCaption', { chat_id: this.chat, message_id: this.conf.msgId, caption: text }); this.beatOk = h.ok; }
    catch (e) {
      if (/not modified/i.test(e.message)) return;
      if (/not found|can't be edited|MESSAGE_ID_INVALID/i.test(e.message)) { this.log('Angepinnte Nachricht nicht mehr da – warte auf eine neue Datei der App.'); this.conf = null; this.saveState(); return; }
      throw e;
    }
  }
  // ---- Takt ----
  async tick() {
    const t = this.now(), c = () => this.conf?.data, run = async (name, fn) => { try { await fn(); this.clear(name); } catch (e) { this.note(name, e.message); } };
    if (t >= this.next.config) { this.next.config = t + EVERY.config; await run('Datei der App', () => this.syncConfig()); }
    if (c()?.on && t >= this.next.price) { this.next.price = t + EVERY.price; await run('Kursprüfung', () => this.checkPrices()); if (pulseOn(c())) await run('BTC-Puls', () => this.checkPulse()); } // Abruffehler je Kürzel meldet checkPrices selbst („Kurse“)
    const needCal = c()?.on && c().ev.news && c().econ.warn;
    if (needCal && t >= this.next.cal) { this.next.cal = t + 5 * 60e3; await run('Kalender', async () => { await this.loadCalendar(); this.next.cal = t + EVERY.cal; }); } // Fehler: in 5 min erneut
    if (needCal && t >= this.next.econ) { this.next.econ = t + EVERY.econ; await run('Termine', () => this.checkEcon()); }
    const h = this.health();
    if (this.conf && (t >= this.next.beat || (this.beatOk !== null && h.ok !== this.beatOk))) { this.next.beat = t + EVERY.beat; await run('Lebenszeichen', () => this.heartbeat()); }
  }
  async start() {
    const me = await this.tg('getMe').catch(e => { this.log('Bot nicht erreichbar:', e.message); return null; });
    this.log(`Scalp Desk 24/7-Dienst ${VERSION} gestartet${me ? ` · Bot @${me.username}` : ''} · Node ${process.versions.node}`);
    const stop = () => { this.stopped = true; clearTimeout(this.saveTimer); this.saveStateNow(); process.exit(0); };
    process.on('SIGTERM', stop); process.on('SIGINT', stop);
    while (!this.stopped) { await this.tick(); await sleep(EVERY.tick); }
  }
  // ---- Prüfung nach der Einrichtung (install.sh): Bot, Chat, Binance, angepinnte Datei ----
  async check() {
    let ok = true; const say = (good, text) => { this.log(`${good ? '✓' : '✗'} ${text}`); if (!good) ok = false; };
    try { const me = await this.tg('getMe'); say(true, `Bot @${me.username} erreichbar`); }
    catch (e) { say(false, e.code === 401 || e.code === 404 ? 'Bot-Token ungültig – in @BotFather mit /mybots → API Token nachsehen.' : e.message); return false; }
    try {
      await this.tg('sendMessage', { chat_id: this.chat, text: `✅ Scalp Desk 24/7-Dienst ist eingerichtet (Server ${os.hostname()}).\nEr meldet Kurs-Alarme, Stop-Loss/Take-Profit, wichtige Termine, den BTC-Puls und den Gewinn-/Verlust-Alarm – auch wenn die App geschlossen ist. In der App unter 🔔 Hinweise → „Telegram / Discord einrichten“ jetzt „An den 24/7-Dienst übergeben“ einschalten.` });
      say(true, 'Testnachricht an deinen Telegram-Chat gesendet');
    } catch (e) { say(false, e.code === 400 ? 'Chat nicht gefunden – Chat-ID prüfen und dem Bot in Telegram zuerst „Start“ schreiben.' : e.code === 403 ? 'Der Bot darf dir nicht schreiben – in Telegram den Bot öffnen und „Start“ tippen.' : e.message); return false; }
    for (const [src, sym] of [['spot', 'BTCUSDT'], ['futures', 'BTCUSDT']]) {
      try { const r = await klines(src, sym); say(true, `Binance ${src === 'spot' ? 'Spot' : 'Futures'} erreichbar (BTC ${priceText(+r.at(-1)[4])})`); }
      catch (e) { say(false, `Binance ${src === 'spot' ? 'Spot' : 'Futures'}: ${e.message}`); }
    }
    try {
      const pm = (await this.tg('getChat', { chat_id: this.chat }))?.pinned_message;
      if (!isConfigMessage(pm)) this.log('• Noch keine angepinnte Datei der App – in der App „An den 24/7-Dienst übergeben“ einschalten.');
      else { await this.syncConfig(); const c = this.conf.data; this.log(`✓ Angepinnte Datei der App gefunden: ${plural(c.alarms.length, 'Alarm', 'Alarme')}, ${plural(c.positions.length, 'Position', 'Positionen')}`); }
    } catch (e) { say(false, `Angepinnte Datei: ${e.message}`); }
    return ok;
  }
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function klines(source, symbol, limit = 3) {
  const bases = source === 'futures' ? [API.fut] : API.spot, p = source === 'futures' ? '/fapi/v1/klines' : '/api/v3/klines';
  let last = new Error('keine Adresse');
  for (const b of bases) {
    try {
      let r; try { r = await fetch(`${b}${p}?symbol=${symbol}&interval=1m&limit=${limit}`, { signal: AbortSignal.timeout(10000) }); } catch (e) { throw new Error(`Binance nicht erreichbar (${e.cause?.code || e.name})`); }
      if (r.status === 451 || r.status === 403) throw Object.assign(new Error(`Binance sperrt diese Server-Region (Fehler ${r.status}) – Server in der EU wählen`), { hard: true });
      const d = await r.json().catch(() => null);
      if (!r.ok) throw Object.assign(new Error(`Binance meldet Fehler ${d?.code ?? r.status}${d?.msg ? ': ' + d.msg : ''}`), { code: d?.code });
      if (!Array.isArray(d) || !d.length) throw new Error('Binance: keine Kerzen');
      return d;
    } catch (e) { last = e; if (e.code === -1121) break; }
  }
  throw last;
}

// ---------- Aufruf ----------
function args(argv) {
  const o = { config: '/etc/scalpdesk-247.json', state: '', check: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') o.config = argv[++i]; else if (argv[i] === '--state') o.state = argv[++i]; else if (argv[i] === '--check') o.check = true;
    else if (argv[i] === '--version') { console.log(VERSION); process.exit(0); }
  }
  return o;
}
async function main(argv) {
  const [maj] = process.versions.node.split('.').map(Number);
  if (maj < 18) throw new Error(`Node.js ${process.versions.node} ist zu alt – bitte Version 18 oder neuer installieren.`);
  const o = args(argv), conf = readServerConfig(o.config), w = new Watcher({ ...conf, statePath: o.state });
  if (o.check) process.exit((await w.check()) ? 0 : 1);
  await w.start();
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(e => { console.error('Fehler:', e.message); process.exit(1); });
