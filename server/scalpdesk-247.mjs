#!/usr/bin/env node
// Scalp Desk – 24/7-Dienst (Schritt 5.1; BTC-Puls ab 1.1, Gewinn-/Verlust-Alarm ab 1.2, gesicherte Zustellung ab 1.3,
// Bestätigung und Selbstdiagnose ab 1.4)
// Meldet Kurs-Alarme, Stop-Loss/Take-Profit offener Positionen, wichtige Wirtschaftstermine, den BTC-Puls (ungewöhnlich
// starke Bitcoin-Bewegung) und den Gewinn-/Verlust-Alarm (Live-Ergebnis aller offenen Positionen erreicht eine Grenze) per
// Telegram (auf Wunsch zusätzlich Discord) – rund um die Uhr, auch wenn die App überall geschlossen ist.
// Für den Gewinn-/Verlust-Alarm stehen Einstieg und Menge der offenen Positionen in der Datei – nur solange dort ein
// Gewinn- oder Verlust-Alarm aktiv ist; sonst bleiben Mengen und Einstiege in der App. Ist die App geöffnet, meldet sie ihn
// selbst (sofort, auch kurze Spitzen) und vermerkt das in der Datei; der Dienst wartet deshalb nach dem Erreichen kurz und
// liest die Datei vor seiner Meldung neu.
// Zustellung (ab 1.3): Jede Meldung wartet in einem Ausgang (Zustandsdatei), bis Telegram sie angenommen hat – Fehlschläge
// werden mit wachsender Pause wiederholt, auch nach einem Neustart. Lehnt Telegram ab oder ist es länger nicht erreichbar,
// steht „Störung“ in der angehefteten Nachricht; dann meldet die geöffnete App wieder selbst. Die letzte erfolgreiche
// Zustellung steht dort als eigene Zeile („Zustellung: zuletzt …“).
// Bestätigung und Selbstdiagnose (ab 1.4): Übernimmt der Dienst eine neue Übergabe, schreibt er das ins Protokoll und schickt
// eine lautlose Bestätigung („✅ 24/7-Dienst hat übernommen …“) in den Chat. Findet er in seinem Chat keine Datei der App –
// meist ist am Server ein anderer Bot oder eine andere Chat-ID eingetragen als in der App unter „Kursalarm“ –, sagt er das
// im Protokoll (alle 10 Minuten) und einmal am Tag per Telegram, mit Bot und Chat-ID zum Vergleich. „--status“ zeigt den
// ganzen Weg auf einen Blick, ohne etwas zu senden.
//
// Woher er die Daten hat: Die App legt die aktiven Alarme und Positionen als Datei „scalpdesk-247.json“ in deinen
// Telegram-Chat und heftet sie oben an. Dieser Dienst liest sie mit demselben Bot (getChat → angepinnte Nachricht →
// getFile, alle 20 Sekunden), prüft jede Viertelminute die 1m-Kerzen bei Binance (auch kurze Dochte zählen) und bestätigt in
// der angepinnten Nachricht („Dienst: aktiv …“). Solange diese Bestätigung frisch ist, sendet die App selbst nichts doppelt.
// Dafür müssen App (Kursalarm) und Dienst denselben Bot und dieselbe Chat-ID nutzen: Ein anderer Bot sieht die Datei nicht.
// Der Server braucht nur ausgehende Verbindungen (Telegram, Binance, GitHub) – keine offenen Ports, keine Domain.
//
// Steuerung über HTTPS (ab 2.0, G05): Ist ein Zugangsschlüssel eingerichtet, lauscht der Dienst zusätzlich auf 127.0.0.1:8247;
// davor steht Caddy mit einem kostenlosen Zertifikat (Adresse wie 130-61-1-2.sslip.io). Darüber laufen nur Schalterstände und
// Ereignis-Freigaben – keine Sicherungen, keine Trades, keine Telegram-Geheimnisse:
// - Ziel-Schalter (Kursalarm, Sicherung, Trades) mit Revision, Einschaltzeit und Epoche; Änderungen als Auftrag mit Auftrags-ID
//   und erwarteter Revision, alle Ziele eines Auftrags gemeinsam oder gar nicht. Das Ergebnis eines Auftrags lässt sich später
//   abfragen (verlorene Antwort). AUS verwirft auch wartende Meldungen, AN meldet nur ab jetzt Neues.
// - Ereignis-Freigaben: Jedes Ereignis (Kurs-Alarm, Stop/Ziel, Gewinn/Verlust) hat eine feste ID aus Alarm, Aktivierung und Art.
//   Wer es zuerst reserviert (geöffnete App oder dieser Dienst), sendet es – genau einer. Eine ausgegebene Freigabe wandert nie
//   an einen anderen Sender; Zustände: reserviert, wird gesendet, zugestellt, unbestätigt, fehlgeschlagen, verworfen.
// - Ist eine Telegram-Antwort verloren gegangen (Zeitüberschreitung, Verbindung abgerissen), gilt die Meldung als „unbestätigt“
//   – kein zweiter Versuch, der sie doppelt zustellen könnte.
// Ohne Abhängigkeiten, Node.js ab Version 18. Einrichtung: server/install.sh (fragt Bot-Token und Chat-ID ab).
// Aufruf: node scalpdesk-247.mjs --config /etc/scalpdesk-247.json [--state /var/lib/scalpdesk-247/state.json] [--check | --status | --zugang]
//   --check   nach der Einrichtung: Bot, Testnachricht, Binance, angeheftete Datei
//   --status  Fehlersuche ohne Nachricht: Bot, Chat, angeheftete Datei, Bestätigung, Zustand, Binance (am Server: sudo scalpdesk-247 status)
//   --zugang  Adresse und Zugangsschlüssel der HTTPS-Steuerung für die App (am Server: sudo scalpdesk-247 zugang)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const VERSION = '2.0.0';
const E = process.env;
// Adressen (für Tests über Umgebungsvariablen änderbar)
export const API = {
  tg: E.SCALPDESK_TG_API || 'https://api.telegram.org',
  spot: (E.SCALPDESK_SPOT_API || 'https://data-api.binance.vision,https://api.binance.com').split(',').map(s => s.trim()).filter(Boolean),
  fut: E.SCALPDESK_FUT_API || 'https://fapi.binance.com',
  cal: E.SCALPDESK_CAL_URL || 'https://raw.githubusercontent.com/NicoAHB/wx-widget/kalender/calendar.json'
};
// Takt: Kurse alle 15 s, angepinnte Datei alle 20 s (bis 1.3 jede Minute), Lebenszeichen alle 10 min, Kalender alle 30 min.
// 1.4: hint – so lange ohne Datei der App, dann ein Hinweis per Telegram (höchstens einmal am Tag); waitLog – Protokollzeile
// „Warte auf die Übergabe“ wiederholen; ack – Abstand zwischen zwei Bestätigungen „hat übernommen“
export const EVERY = E.SCALPDESK_FAST
  ? { tick: 300, price: 1500, config: 2000, beat: 15e3, cal: 60e3, econ: 1500, feedStale: 12e3, pnlHold: 1200, hint: 5e3, hintAgain: 60e3, waitLog: 10e3, ack: 3e3 }
  : { tick: 5e3, price: 15e3, config: 20e3, beat: 10 * 60e3, cal: 30 * 60e3, econ: 20e3, feedStale: 3 * 60e3, pnlHold: 8e3, hint: 3 * 60e3, hintAgain: 24 * 3600e3, waitLog: 10 * 60e3, ack: 60e3 }; // pnlHold: Gewinn/Verlust erreicht → so lange auf die App warten
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
// „· v1.4.0“ (ab 1.4): Version des Dienstes – die App zeigt sie an; ältere Apps übergehen das Feld
// „· HTTPS“ (ab 2.0): Steuerung mit Schaltern und Ereignis-Freigaben eingerichtet
export function statusLine({ ok, now, c, problem, ctl = false }) {
  return `${LINE} ${ok ? 'aktiv' : 'Störung'} · ${stamp(now, c.tz)} · v${VERSION}${ctl ? ' · HTTPS' : ''}${pnlOn(c) ? ' · GV' : ''}${pulseOn(c) ? ' · Puls' : ''} · #${c.tag} übernommen${ok ? '' : ` · ${problem}`}`;
}
// ---------- 1.4: Bestätigung „hat übernommen“, Hinweis bei fehlender Datei ----------
// Beobachtete Marken mit Inhalt (ändert sich der Preis eines Alarms, gilt er als neu); Quittierungen zählen nicht
export function watchItems(c) {
  if (!c?.on) return [];
  return [...(c.ev.alarm ? c.alarms.map(a => ({ key: `${alarmKey(a)}:${a.dir}:${a.price}`, text: `Kurs-Alarm ${coin(a.symbol)} ${a.dir === 'above' ? 'auf/über' : 'auf/unter'} ${priceText(a.price)} USDT${a.source === 'futures' ? ' (Futures)' : ''}` })) : []),
    ...(c.ev.pos ? c.positions.map(p => ({ key: `pos:${p.id}:${p.since}:${p.sl}:${p.tp}`, text: `${coin(p.symbol)} ${p.side === 'long' ? 'Long' : 'Short'}: ${[p.sl ? `Stop-Loss ${priceText(p.sl)}` : '', p.tp ? `Take-Profit ${priceText(p.tp)}` : ''].filter(Boolean).join(' · ')}` })) : []),
    ...(pnlOn(c) ? c.pnl.lim.map(l => ({ key: `${pnlKey(l)}:${l.v}`, text: `${pnlName(l.k)} ${pnlCond(l)}` })) : [])];
}
// Bestätigung: was neu beobachtet wird (höchstens 8 Zeilen) und was insgesamt; ausgeschaltet → ein Satz
export function ackText(c, fresh, now) {
  if (!c.on) return `⏸ 24/7-Dienst: Übergabe in der App ausgeschaltet (${timeText(now, c.tz)} Uhr) – der Dienst meldet nichts, bis du sie wieder einschaltest.`;
  const al = c.ev.alarm ? c.alarms.length : 0, ps = c.ev.pos ? c.positions.filter(p => p.sl || p.tp).length : 0, extra = [];
  if (c.ev.news && c.econ.warn) extra.push(`Termin-Warnung ${c.econ.warn} min vorher`);
  if (pulseOn(c)) extra.push('BTC-Puls');
  const lines = fresh.slice(0, 8).map(x => `• ${x.text}`).concat(fresh.length > 8 ? [`• … und ${fresh.length - 8} weitere`] : []);
  return `✅ 24/7-Dienst hat übernommen (${timeText(now, c.tz)} Uhr)${lines.length ? `\n${lines.join('\n')}` : ''}\nBeobachtet jetzt: ${plural(al, 'Kurs-Alarm', 'Kurs-Alarme')}, ${plural(ps, 'Position', 'Positionen')} mit Stop/Ziel${extra.length ? ` · ${extra.join(' · ')}` : ''} – auch bei geschlossener App.`;
}
// Was ist in diesem Chat angeheftet, wenn es nicht die Datei der App ist?
export function pinnedWhat(pm) {
  if (!pm) return 'nichts';
  if (pm.document) return `eine andere Datei („${String(pm.document.file_name || 'ohne Namen').slice(0, 60)}“)`;
  const t = String(pm.text || pm.caption || '').split('\n')[0].slice(0, 60);
  return t ? `eine andere Nachricht („${t}${t.length >= 60 ? '…' : ''}“)` : 'eine andere Nachricht';
}
export const chatText = (chat, id) => `${id}${chat ? ` (${chat.type === 'private' ? 'privat' : chat.type === 'channel' ? 'Kanal' : 'Gruppe'}${chat.title || chat.first_name ? ` „${chat.title || chat.first_name}“` : ''})` : ''}`;
export function hintText({ bot, chat, what, host }) {
  return `⏳ Scalp Desk 24/7-Dienst (Server ${host}) wartet auf die Übergabe der App.\n`
    + `In diesem Chat ist keine Datei „${FILE}“ angeheftet (angeheftet: ${what}) – der Dienst kennt deshalb keine Alarme und meldet nichts.\n\n`
    + `So passt es zusammen: In der App unter 🔔 Hinweise → „Telegram / Discord einrichten“ → Kursalarm müssen dieser Bot (${bot}) und die Chat-ID ${chat} eingetragen sein. Dann dort „An den 24/7-Dienst übergeben“ einschalten.\n`
    + `Steht in der App ein anderer Bot (zum Beispiel der Sicherungs-Bot) oder eine andere Chat-ID, am Server Bot-Token und Chat-ID aus der App neu eingeben:\ncurl -fsSL https://raw.githubusercontent.com/NicoAHB/wx-widget/main/server/install.sh | sudo bash -s -- --neu`;
}
// darunter je vom Dienst gesendetem Gewinn-/Verlust-Alarm eine Zeile (pnlLine) – so übernimmt die App „ausgelöst“
export const caption = (c, status, extra = []) => [MARK, appLine(c), status, ...extra].join('\n').slice(0, 1024);
// 1.3: letzte von Telegram angenommene Meldung (Zeitpunkt und Art) – die App zeigt sie unter „Status prüfen“. Die Zeile steht
// immer da (auch vor der ersten Meldung): Daran erkennt die App, dass der Dienst die Zustellung prüft.
export const lastLine = (last, tz) => `Zustellung: ${last?.t ? `zuletzt ${stamp(last.t, tz)}${last.label ? ` · ${last.label}` : ''}` : 'geprüft, noch keine Meldung'}`;
// Ausgang: Pause bis zum nächsten Versuch nach n Fehlschlägen; älter als einen Tag: verwerfen (mit Protokollzeile)
export const outDelay = n => [15e3, 30e3, 60e3, 120e3, 300e3][Math.min(Math.max(n, 1), 5) - 1];
export const OUT_MAX_AGE = 24 * 3600e3;

// ---------- Einstellungen des Servers ----------
// 2.0: key – Zugangsschlüssel der HTTPS-Steuerung (ohne: keine Steuerung, wie 1.4); origin – Herkunft der App (CORS, mehrere mit
// Komma); listen – Adresse für Caddy (nur lokal); host – öffentliche Adresse (nur zur Anzeige)
export const KEY_RE = /^[A-Za-z0-9_-]{32,64}$/, ORIGIN_RE = /^(https:\/\/[a-z0-9.-]+|http:\/\/(127\.0\.0\.1|localhost))(:\d{1,5})?$/, LISTEN_RE = /^(127\.0\.0\.1|::1|localhost):(\d{1,5})$/;
export const APP_ORIGIN = 'https://nicoahb.github.io', LISTEN = '127.0.0.1:8247';
export function readServerConfig(file) {
  let j; try { j = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(`Einstellungen ${file} nicht lesbar: ${e.message}`); }
  const token = String(j.token || '').trim(), chat = String(j.chat || '').trim(), discord = String(j.discord || '').trim();
  if (!TOKEN_RE.test(token)) throw new Error(`Bot-Token in ${file} fehlt oder hat das falsche Format (123456789:AA…).`);
  if (!CHAT_RE.test(chat)) throw new Error(`Chat-ID in ${file} fehlt oder hat das falsche Format.`);
  if (discord && !DC_RE.test(discord)) throw new Error(`Discord-Webhook in ${file} hat das falsche Format.`);
  const key = String(j.key || '').trim(), origins = String(j.origin || APP_ORIGIN).split(',').map(x => x.trim().replace(/\/+$/, '')).filter(Boolean), listen = String(j.listen || LISTEN).trim(), host = String(j.host || '').trim();
  if (key && !KEY_RE.test(key)) throw new Error(`Zugangsschlüssel in ${file} hat das falsche Format.`);
  if (!origins.length || origins.some(o => !ORIGIN_RE.test(o))) throw new Error(`Herkunft der App (origin) in ${file} hat das falsche Format (z. B. ${APP_ORIGIN}).`);
  if (!LISTEN_RE.test(listen)) throw new Error(`Adresse „listen“ in ${file} muss lokal sein (z. B. ${LISTEN}).`);
  if (host && !/^[a-z0-9.-]{3,253}$/.test(host)) throw new Error(`Öffentliche Adresse (host) in ${file} hat das falsche Format.`);
  return { token, chat, discord, key, origins, listen, host };
}

// ---------- 2.0 (G05): Ziel-Schalter und Ereignis-Freigaben (rein, ohne Netz – testbar) ----------
// Ziele: Kursalarm (Preis-, Stop-/Ziel-, Gewinn-/Verlust-Alarme, Termine, BTC-Puls – sendet dieser Dienst bzw. die App mit
// Freigabe), Sicherung und Trades (sendet nur die App direkt an Telegram; hier steht nur der Schalter, ohne Inhalte).
export const TARGETS = ['course-alert', 'backup', 'trades'];
export const TARGET_NAME = { 'course-alert': 'Kursalarm', backup: 'Sicherung', trades: 'Trades' };
const CMD_RE = /^[A-Za-z0-9_-]{8,64}$/, EV_RE = /^[A-Za-z0-9_.:-]{6,140}$/, SENDER_RE = /^(oracle|app:[a-z0-9]{4,24})$/;
export const EV_FINAL = ['confirmed', 'unconfirmed', 'failed', 'discarded'], EV_ORDER = { reserved: 0, sending: 1, confirmed: 2, unconfirmed: 2, failed: 2, discarded: 2 };
export const GRANT_WAIT = 5 * 60e3, EV_KEEP = 14 * 864e5, CMD_KEEP = 7 * 864e5, CMD_MAX = 300;
// Episoden wiederkehrender Marken (Stop/Ziel): eine neue Episode erst, wenn der Kurs die Marke um mindestens EP_HYST (0,1 %)
// wieder verlassen hat (Hysterese) und die letzte Meldung mindestens EP_COOL (5 min) zurückliegt (Abklingzeit)
export const EP_HYST = 0.001, EP_COOL = 5 * 60e3;
// Aktivierung als kurze, feste Kennung aus dem Zeitpunkt des Scharfschaltens (Alarm: armedAt, Position: Stop/Ziel gesetzt,
// Gewinn/Verlust: Scharfschalten) – App und Dienst rechnen sie gleich; eine Sicherung ändert sie nicht
export const act = t => Math.max(0, Math.round(Number(t) || 0)).toString(36);
export const alarmEvent = a => `${a.id}:${act(a.armedAt)}:price-cross`;
export const posBase = (p, type) => `${p.id}:${act(p.since)}:${type}`;
export const pnlEvent = l => `pnl:${l.k}:${act(l.at)}:threshold`;
export function policyNew(now) { return { rev: 0, targets: Object.fromEntries(TARGETS.map(id => [id, { on: true, since: now, epoch: 1 }])) }; }
export function policyLoad(p, now) {
  const d = policyNew(now); if (!p || typeof p !== 'object') return d;
  d.rev = Number.isInteger(p.rev) && p.rev >= 0 ? p.rev : 0;
  for (const id of TARGETS) { const t = p.targets?.[id]; if (t && typeof t.on === 'boolean') d.targets[id] = { on: t.on, since: Number(t.since) || now, epoch: Number.isInteger(t.epoch) && t.epoch > 0 ? t.epoch : 1, ...(Number(t.offSince) ? { offSince: Number(t.offSince) } : {}) }; }
  return d;
}
export const policyView = pol => ({ rev: pol.rev, targets: JSON.parse(JSON.stringify(pol.targets)) });
// Auftrag ausführen: { commandId, expectedRevision, set: { Ziel: true|false } } – alle Ziele gemeinsam oder keins. Ein schon
// bekannter Auftrag (gleiche ID) bekommt dieselbe Antwort wie beim ersten Mal und ändert nichts mehr.
export function policyApply(pol, cmds, cmd, now) {
  if (!cmd || !CMD_RE.test(cmd.commandId)) return { status: 400, body: { ok: false, error: 'Auftrags-ID fehlt oder hat das falsche Format.' } };
  const seen = cmds.find(c => c.id === cmd.commandId); if (seen) return { status: seen.status, body: { ...seen.body, repeat: true }, repeat: true };
  const set = cmd.set && typeof cmd.set === 'object' && !Array.isArray(cmd.set) ? cmd.set : null, ids = set ? Object.keys(set) : [];
  let r;
  if (!ids.length || ids.some(id => !TARGETS.includes(id) || typeof set[id] !== 'boolean')) r = { status: 400, body: { ok: false, error: 'Unbekanntes Ziel oder ungültiger Schalterwert.' } };
  else if (!Number.isInteger(cmd.expectedRevision) || cmd.expectedRevision !== pol.rev) r = { status: 409, body: { ok: false, conflict: true, error: `Der Stand hat sich geändert (Revision ${pol.rev}, erwartet ${cmd.expectedRevision}).`, ...policyView(pol) } };
  else {
    const changed = [];
    for (const id of ids) { const t = pol.targets[id]; if (t.on === set[id]) continue; t.on = set[id]; t.epoch++; if (t.on) { t.since = now; delete t.offSince; } else t.offSince = now; changed.push(id); }
    if (changed.length) pol.rev++;
    r = { status: 200, body: { ok: true, changed, ...policyView(pol) } };
  }
  cmds.push({ id: cmd.commandId, at: now, status: r.status, body: { ...r.body, commandId: cmd.commandId } });
  while (cmds.length > CMD_MAX || (cmds.length && now - cmds[0].at > CMD_KEEP)) cmds.shift();
  return { ...r, body: { ...r.body, commandId: cmd.commandId } };
}
// Ereignis reservieren: frei → reserviert für diesen Sender; schon vorhanden → keine Freigabe (mit Inhaber und Zustand);
// Ziel aus → keine Freigabe, und das Ereignis bleibt als „verworfen“ stehen (AN meldet nur ab jetzt Neues, nichts von davor)
export function evReserve(L, pol, req, now) {
  if (!req || !EV_RE.test(req.eventId) || !TARGETS.includes(req.targetId) || !SENDER_RE.test(req.sender)) return { status: 400, body: { ok: false, error: 'Ereignis, Ziel oder Sender fehlt oder hat das falsche Format.' } };
  const e = L[req.eventId];
  if (e) return { status: 200, body: { ok: true, grant: false, holder: e.by, st: e.st, at: e.at } };
  const t = pol.targets[req.targetId], label = typeof req.label === 'string' ? req.label.slice(0, 80) : '';
  if (!t.on) { L[req.eventId] = { st: 'discarded', by: req.sender, target: req.targetId, epoch: t.epoch, at: now, upd: now, label, why: 'Ziel ausgeschaltet' }; return { status: 200, body: { ok: true, grant: false, reason: 'off', st: 'discarded' }, created: true }; }
  L[req.eventId] = { st: 'reserved', by: req.sender, target: req.targetId, epoch: t.epoch, at: now, upd: now, label };
  return { status: 200, body: { ok: true, grant: true, epoch: t.epoch, rev: pol.rev }, created: true };
}
// Ergebnis melden: nur der Inhaber, nur vorwärts (reserviert → wird gesendet → zugestellt | unbestätigt | fehlgeschlagen | verworfen)
export function evReport(L, req, now) {
  const e = L[req?.eventId]; if (!e) return { status: 404, body: { ok: false, error: 'Ereignis unbekannt.' } };
  if (e.by !== req.sender) return { status: 409, body: { ok: false, error: `Ereignis gehört ${e.by}.`, st: e.st } };
  if (!(req.st in EV_ORDER) || req.st === 'reserved') return { status: 400, body: { ok: false, error: 'Unbekannter Zustand.' } };
  if (EV_FINAL.includes(e.st) || EV_ORDER[req.st] < EV_ORDER[e.st]) return { status: 200, body: { ok: true, st: e.st, unchanged: true } };
  e.st = req.st; e.upd = now; if (typeof req.why === 'string') e.why = req.why.slice(0, 120);
  return { status: 200, body: { ok: true, st: e.st }, changed: true };
}
// Neue Episode einer wiederkehrenden Marke: nur von der aktuellen aus (from), nur wenn in ihr gemeldet wurde und die Abklingzeit
// vorbei ist – melden zwei Sender dasselbe Verlassen, zählt es einmal
export function epNext(E, L, base, from, now) {
  const cur = E[base]?.n || 0, ev = L[`${base}:${cur}`];
  if (from === cur && ev && now - ev.at >= EP_COOL) E[base] = { n: cur + 1, at: now };
  return E[base]?.n || 0;
}
// Freigaben ohne Rückmeldung des Geräts: nach GRANT_WAIT „unbestätigt“ – nie an einen anderen Sender weitergeben (das erste
// Gerät könnte noch spät senden); alte Einträge nach EV_KEEP vergessen
export function evSweep(L, E, now) {
  const done = [];
  for (const [id, e] of Object.entries(L)) {
    if (!EV_FINAL.includes(e.st) && e.by !== 'oracle' && now - e.upd > GRANT_WAIT) { e.st = 'unconfirmed'; e.upd = now; e.why = 'keine Rückmeldung des Geräts'; done.push(id); }
    if (now - e.at > EV_KEEP) delete L[id];
  }
  for (const [b, x] of Object.entries(E)) if (now - x.at > EV_KEEP * 2) delete E[b];
  return done;
}
export const ST_NAME = { reserved: 'reserviert', sending: 'wird gesendet', confirmed: 'zugestellt', unconfirmed: 'Zustellung unbestätigt', failed: 'fehlgeschlagen', discarded: 'verworfen' };
export const senderName = s => (s === 'oracle' ? '24/7-Dienst' : `App (${String(s).slice(4)})`);

// ---------- Der Dienst ----------
export class Watcher {
  constructor({ token, chat, discord = '', key = '', origins = [APP_ORIGIN], listen = LISTEN, host = '', statePath = '', now = () => Date.now(), log = (...a) => console.log(...a) }) {
    Object.assign(this, { token, chat, discord, key, origins, listen, host, statePath, now, log });
    // 2.0 (G05): Ziel-Schalter (Revision, Epoche, Einschaltzeit), ausgeführte Aufträge, Ereignis-Freigaben, Episoden
    this.pol = policyNew(now()); this.cmds = []; this.evs = {}; this.eps = {}; this.server = null; this.authFail = { n: 0, t: 0 };
    this.conf = null; this.fired = {}; this.seen = new Map(); this.rearm = new Map(); this.lastCheck = new Map(); this.prevCandle = new Map();
    this.cal = null; this.calAt = 0; this.feed = { okAt: 0, error: '', since: 0 }; this.next = { config: 0, price: 0, beat: 0, cal: 0, econ: 0 };
    this.beatOk = null; this.stopped = false; this.saveTimer = null; this.errors = new Map(); this.waiting = false; this.pulseLast = { up: null, down: null };
    // Gewinn-/Verlust-Alarm je Scharfschalten: wait/armed; erreicht und wartet auf die App { t, val }; gemeldet { t, val }
    // (by: 'app' = die App hat gemeldet oder die Meldung übernommen)
    this.pnlSt = {}; this.pnlPend = {}; this.pnlFired = {};
    // 1.3: Ausgang (noch nicht zugestellte Meldungen), letzte Zustellung, laufender Sendefehler { since, msg, code }
    this.out = []; this.last = null; this.sendErr = null; this.beatFailAt = 0;
    // 1.4: eigener Bot (getMe), Warten auf die Datei der App (seit, letzte Protokollzeile, letzter Hinweis per Telegram),
    // Bestätigung „hat übernommen“ (zuletzt bestätigte Marken, offen?), erste Kursprüfung neuer Marken fürs Protokoll,
    // zuletzt in der angepinnten Nachricht bestätigter Stand, Kursprüfungen seit dem letzten Lebenszeichen
    this.me = null; this.waitSince = 0; this.waitLogAt = 0; this.hintAt = 0; this.ackKeys = null; this.ackAt = 0; this.ackOn = null; this.ackPend = false; this.waitWhat = '';
    this.firstLook = new Set(); this.beatTag = ''; this.checks = 0; this.prices = new Map(); this.chatInfo = null;
    this.loadState();
  }
  // ---- Zustand (ausgelöste Meldungen, zuletzt gelesene Datei, Kalender) über Neustarts hinweg ----
  loadState() {
    if (!this.statePath) return;
    try {
      const s = JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
      if (s && (s.v === 1 || s.v === 2)) { this.fired = s.fired && typeof s.fired === 'object' ? s.fired : {}; if (s.pulse && typeof s.pulse === 'object') this.pulseLast = { up: s.pulse.up || null, down: s.pulse.down || null };
        if (s.pnl && typeof s.pnl === 'object') { this.pnlSt = s.pnl.st && typeof s.pnl.st === 'object' ? s.pnl.st : {}; this.pnlFired = s.pnl.fired && typeof s.pnl.fired === 'object' ? s.pnl.fired : {}; this.pnlPend = s.pnl.pend && typeof s.pnl.pend === 'object' ? s.pnl.pend : {}; }
        if (Array.isArray(s.out)) this.out = s.out.filter(m => m && typeof m.text === 'string' && Number.isFinite(m.at)); if (s.last?.t) this.last = s.last; if (s.sendErr?.since) this.sendErr = s.sendErr; if (s.conf?.data) this.conf = { ...s.conf, data: parseConfig({ kind: 'scalpdesk-247', v: 1, ...s.conf.data }) }; if (Array.isArray(s.cal?.events)) { this.cal = s.cal.events; this.calAt = s.cal.at || 0; }
        if (Number.isFinite(s.hintAt)) this.hintAt = s.hintAt; if (Array.isArray(s.ack?.keys)) { this.ackKeys = s.ack.keys.filter(k => typeof k === 'string'); this.ackAt = Number(s.ack.t) || 0; this.ackOn = typeof s.ack.on === 'boolean' ? s.ack.on : null; }
        // 2.0: Schalter, Aufträge, Freigaben und Episoden überstehen einen Neustart (1.4-Zustand: alle Ziele an, Revision 0)
        this.pol = policyLoad(s.pol, this.now()); if (Array.isArray(s.cmds)) this.cmds = s.cmds.filter(c => c && typeof c.id === 'string' && Number.isFinite(c.at));
        if (s.evs && typeof s.evs === 'object') this.evs = s.evs; if (s.eps && typeof s.eps === 'object') this.eps = s.eps; }
    } catch { /* erster Start oder beschädigt: neu anfangen */ }
  }
  stateJson() { const c = this.conf; return JSON.stringify({ v: 2, pol: this.pol, cmds: this.cmds, evs: this.evs, eps: this.eps, fired: this.fired, pulse: this.pulseLast, pnl: { st: this.pnlSt, pend: this.pnlPend, fired: this.pnlFired }, out: this.out, last: this.last, sendErr: this.sendErr, conf: c && { msgId: c.msgId, fileUid: c.fileUid, data: c.data }, cal: this.cal && { at: this.calAt, events: this.cal }, hintAt: this.hintAt, ack: this.ackKeys && { keys: this.ackKeys, t: this.ackAt, on: this.ackOn } }); }
  saveStateNow() {
    if (!this.statePath) return;
    try { fs.mkdirSync(path.dirname(this.statePath), { recursive: true }); const tmp = this.statePath + '.tmp'; fs.writeFileSync(tmp, this.stateJson()); fs.renameSync(tmp, this.statePath); }
    catch (e) { this.log('Zustand nicht gespeichert:', e.message); }
  }
  saveState() { if (!this.statePath) return; clearTimeout(this.saveTimer); this.saveTimer = setTimeout(() => this.saveStateNow(), 1000); }
  secret(msg) { let m = String(msg).split(this.token).join('<Token>'); if (this.key) m = m.split(this.key).join('<Schlüssel>'); return m; }
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
    // 2.0: lost – die Anfrage kann Telegram erreicht haben, nur die Antwort fehlt (Zeitüberschreitung, Verbindung abgerissen):
    // dann nicht noch einmal senden (sonst womöglich doppelt); sonst (keine Verbindung, Name unbekannt) kam sie nie an
    catch (e) { const why = e.cause?.code || e.name || '', lost = /^(TimeoutError|AbortError|ECONNRESET|EPIPE|UND_ERR_SOCKET|UND_ERR_HEADERS_TIMEOUT|UND_ERR_BODY_TIMEOUT)$/.test(why);
      throw Object.assign(new Error(`Telegram ${lost ? 'antwortet nicht' : 'nicht erreichbar'} (${this.secret(why || e.message)})`), { code: 0, lost }); }
    let d = null; try { d = await r.json(); } catch { /* keine JSON-Antwort */ }
    if (!r.ok || !d?.ok) throw Object.assign(new Error(`Telegram ${method}: ${d?.description || 'Fehler ' + r.status}`), { code: d?.error_code || r.status, retry: d?.parameters?.retry_after || 0 });
    return d.result;
  }
  // ---- Zustellung (ab 1.3) ----
  // Meldung in den Ausgang; sie bleibt dort (auch über Neustarts), bis Telegram sie angenommen hat. label: Art für die Zeile
  // „Zustellung: zuletzt …“, silent: ohne Ton (BTC-Puls nachts)
  // 2.0: target/epoch – Ziel und seine Epoche beim Erzeugen (vor dem Senden erneut geprüft); ev – Ereignis-ID der Freigabe
  async queue(text, tz, { label = '', silent = false, ev = '' } = {}) {
    const t = this.now(), tg = this.pol.targets['course-alert'];
    if (this.key && !tg.on) { this.log(`Nicht gesendet (Ziel Kursalarm ausgeschaltet): ${label || text.split('\n')[0]}`); return; }
    this.out.push({ id: `${t}-${Math.random().toString(36).slice(2, 7)}`, text, tz, label, silent, at: t, tries: 0, next: 0, err: '', dc: false, target: 'course-alert', epoch: tg.epoch, ...(ev ? { ev } : {}) });
    this.saveStateNow();
    await this.deliver();
  }
  // 2.0: Zustand einer eigenen Freigabe fortschreiben (mit Protokollzeile: Ereignis, Ziel, Sender, Zustand)
  evSet(id, st, why = '') {
    const r = evReport(this.evs, { eventId: id, sender: 'oracle', st, why }, this.now());
    if (r.changed) { this.evLog(id); this.saveState(); }
  }
  evLog(id) { const e = this.evs[id]; if (e) this.log(`Ereignis ${id} · Ziel ${e.target} · Sender ${e.by} · ${ST_NAME[e.st] || e.st}${e.why ? ` (${e.why})` : ''}`); }
  // Eigene Reservierung (der Dienst hat das Ereignis erkannt): nur mit HTTPS-Steuerung – ohne sendet er wie bis 1.4
  reserveOwn(eventId, label) {
    if (!this.key) return { grant: true };
    const r = evReserve(this.evs, this.pol, { eventId, targetId: 'course-alert', sender: 'oracle', label }, this.now());
    if (r.created) { this.evLog(eventId); this.saveStateNow(); }
    if (!r.body.grant) this.log(`Ereignis ${eventId}: ${r.body.reason === 'off' ? 'Ziel Kursalarm ausgeschaltet – nicht gesendet' : `schon von ${senderName(r.body.holder)} übernommen (${ST_NAME[r.body.st] || r.body.st}) – der Dienst sendet es nicht`}`);
    return r.body;
  }
  // Fällige Meldungen senden: angenommen → aus dem Ausgang, als letzte Zustellung merken; abgelehnt oder nicht erreichbar →
  // später erneut (15 s, 30 s, 1, 2, dann alle 5 Minuten; bei „Too Many Requests“ nach Telegrams Vorgabe). Zeit der Meldung ist
  // die des Auslösens; kommt sie über 2 Minuten später an, steht das dabei (mit dem Grund: nicht erreichbar, gebremst, abgelehnt).
  // Discord (falls eingerichtet) einmal, gleich beim ersten Versuch.
  async deliver() {
    const t0 = this.now(), old = this.out.filter(m => t0 - m.at > OUT_MAX_AGE);
    if (old.length) { for (const m of old) this.log(`Meldung verworfen (über 24 Stunden nicht zustellbar): ${m.label || m.text.split('\n')[0]}`); this.out = this.out.filter(m => !old.includes(m)); this.saveState(); }
    for (const m of [...this.out]) {
      const t = this.now(); if (m.next > t) continue;
      // 2.0: unmittelbar vor dem Senden: Ziel noch an und dieselbe Epoche? Sonst verwerfen (AUS verwirft auch Wartendes; ein
      // späteres AN belebt alte Meldungen nicht wieder)
      if (this.key && m.target) { const tg = this.pol.targets[m.target]; if (!tg?.on || tg.epoch !== m.epoch) { this.out = this.out.filter(x => x !== m); this.log(`Meldung verworfen (Ziel ${TARGET_NAME[m.target] || m.target} ${tg?.on ? 'zwischendurch aus- und wieder eingeschaltet' : 'ausgeschaltet'}): ${m.label || m.text.split('\n')[0]}`); if (m.ev) this.evSet(m.ev, 'discarded', 'Ziel ausgeschaltet'); this.saveState(); continue; } }
      if (m.ev) this.evSet(m.ev, 'sending');
      const why = !m.code ? 'Telegram war nicht erreichbar' : m.code === 429 ? 'Telegram hatte gebremst' : 'Telegram hatte sie zuerst abgelehnt';
      const late = t - m.at > 120e3, full = `${m.text}\n${timeText(m.at, m.tz, true)} Uhr · 24/7-Dienst${late ? `\n(verspätet zugestellt um ${timeText(t, m.tz)} Uhr – ${why})` : ''}`;
      if (this.discord && !m.dc) { m.dc = true; await this.discordPost(full); }
      try {
        const sent = await this.tg('sendMessage', { chat_id: this.chat, text: full.slice(0, 4000), link_preview_options: { is_disabled: true }, ...(m.silent ? { disable_notification: true } : {}) });
        this.log(`Telegram gesendet: ${m.label || m.text.split('\n')[0]}${sent?.message_id ? ` (Nachricht #${sent.message_id})` : ''}${m.tries ? ` – nach ${plural(m.tries, 'Fehlversuch', 'Fehlversuchen')}` : ''}`);
        this.out = this.out.filter(x => x !== m); this.last = { t, label: m.label }; if (m.ev) this.evSet(m.ev, 'confirmed');
        if (this.sendErr && !this.out.some(x => x.tries)) { this.log('Telegram: Zustellung wieder in Ordnung'); this.sendErr = null; }
        this.next.beat = 0; this.saveState(); // Zeile „Zustellung: zuletzt …“ gleich aktualisieren
      } catch (e) {
        // 2.0: Antwort verloren – „Zustellung unbestätigt“, kein blinder zweiter Versuch
        if (e.lost) { this.out = this.out.filter(x => x !== m); this.log(`Zustellung unbestätigt: ${m.label || m.text.split('\n')[0]} – ${this.secret(e.message)}; kein zweiter Versuch (die Meldung könnte schon angekommen sein)`); if (m.ev) this.evSet(m.ev, 'unconfirmed', 'Telegram-Antwort verloren'); this.saveState(); continue; }
        // endgültig abgelehnt (4xx außer „Too Many Requests“) bleibt wie bisher im Ausgang und wird wiederholt; die Freigabe bleibt „wird gesendet“
        m.tries++; m.code = e.code || 0; m.err = this.secret(e.message).slice(0, 160); m.next = t + (e.code === 429 && e.retry ? e.retry * 1000 : outDelay(m.tries));
        this.sendErr = { since: this.sendErr?.since || t, msg: m.err, code: e.code || 0 };
        this.note('Telegram', `${m.err} – noch nicht zugestellt: ${m.label || m.text.split('\n')[0]}; neuer Versuch in ${Math.round((m.next - t) / 1000)} s`);
        this.saveState();
      }
    }
  }
  async discordPost(text) {
    try { const r = await fetch(this.discord, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: text.slice(0, 1900), allowed_mentions: { parse: [] } }), signal: AbortSignal.timeout(15000) }); if (!r.ok && r.status !== 204) this.log('Discord:', r.status); }
    catch (e) { this.log('Discord nicht erreichbar:', e.cause?.code || e.message); }
  }
  // ---- angepinnte Datei der App lesen ----
  async readFile(doc) {
    const f = await this.tg('getFile', { file_id: doc.file_id });
    let r; try { r = await fetch(`${API.tg}/file/bot${this.token}/${f.file_path}`, { signal: AbortSignal.timeout(20000) }); } catch (e) { throw new Error(`Datei nicht ladbar (${this.secret(e.cause?.code || e.message)})`); }
    if (!r.ok) throw new Error(`Datei nicht ladbar (Fehler ${r.status})`);
    return parseConfig(await r.json());
  }
  botText() { return this.me?.username ? `@${this.me.username}` : 'dieser Bot'; }
  // 1.4: Protokollzeile, solange die Datei der App fehlt – mit allem, was man zum Vergleich mit der App braucht
  waitLine(pm) {
    return `Warte auf die Übergabe der App: Im Chat ${chatText(this.chatInfo, this.chat)} ist für ${this.botText()} keine Datei „${FILE}“ angeheftet (angeheftet: ${pinnedWhat(pm)}). `
      + `In der App unter Kursalarm müssen Bot ${this.botText()} und Chat-ID ${this.chat} eingetragen und „An den 24/7-Dienst übergeben“ eingeschaltet sein. Ein anderer Bot (z. B. der Sicherungs-Bot) sieht die Datei nicht.`;
  }
  async syncConfig() {
    const chat = await this.tg('getChat', { chat_id: this.chat }), pm = chat?.pinned_message, t0 = this.now();
    this.chatInfo = { type: chat?.type || '', title: chat?.title || '', first_name: chat?.first_name || '' };
    if (!isConfigMessage(pm)) {
      if (this.conf) { this.log('Keine angepinnte Datei der App mehr – der Dienst meldet nichts, bis die App wieder übergibt.'); this.conf = null; this.saveState(); }
      // 1.4: nicht nur einmal beim Start, sondern alle 10 Minuten – und nach 3 Minuten ein Hinweis per Telegram (siehe tick)
      if (!this.waitSince) this.waitSince = t0;
      if (!this.waitLogAt || t0 - this.waitLogAt >= EVERY.waitLog) { this.waitLogAt = t0; this.log(this.waitLine(pm)); }
      this.waiting = true; this.waitWhat = pinnedWhat(pm);
      return;
    }
    this.waiting = false; this.waitSince = 0; this.waitLogAt = 0;
    const doc = pm.document;
    // 1.4: Datei von einem anderen Bot (geht nur in Gruppen): lesbar, aber die Übernahme lässt sich nicht bestätigen
    if (this.me?.id && pm.from?.id && pm.from.id !== this.me.id) this.note('Angeheftete Datei', `stammt von ${pm.from.username ? '@' + pm.from.username : 'Bot ' + pm.from.id}, dieser Dienst nutzt ${this.botText()} – er liest sie, kann die Übernahme aber nicht bestätigen. Am Server denselben Bot wie in der App (Kursalarm) eintragen.`);
    if (this.conf && this.conf.msgId === pm.message_id && this.conf.fileUid === doc.file_unique_id) return;
    const data = await this.readFile(doc), old = this.conf?.data, t = this.now();
    this.conf = { msgId: pm.message_id, fileUid: doc.file_unique_id, data };
    // neue oder wieder scharf geschaltete Marken ab jetzt beobachten; Meldungen zu entfernten Alarmen vergessen
    const keys = new Set([...data.alarms.map(alarmKey), ...data.positions.flatMap(p => ['tp', 'sl'].map(ty => posKey(p, ty)))]);
    for (const k of keys) if (!this.seen.has(k)) { this.seen.set(k, t); this.firstLook.add(k); } // erste Kursprüfung ins Protokoll
    for (const k of Object.keys(this.fired)) if ((k.startsWith('al:') || k.startsWith('pos:')) && !keys.has(k)) delete this.fired[k];
    for (const k of [...this.seen.keys()]) if (!keys.has(k)) this.seen.delete(k);
    // Gewinn-/Verlust-Grenzen: neu scharf geschaltete übernehmen (beim Scharfschalten schon erreicht → erst wieder darunter),
    // von der App gemeldete (done) nicht noch einmal – auch nicht, wenn sie gerade auf die App wartet; entfernte und neu scharf
    // geschaltete (anderer Zeitpunkt) vergessen
    const lims = pnlOn(data) ? data.pnl.lim : [], pk = new Set(lims.map(pnlKey));
    for (const l of lims) { const k = pnlKey(l); if (!this.pnlSt[k]) this.pnlSt[k] = l.w ? 'wait' : 'armed'; if (l.done && !this.pnlFired[k]) this.pnlFired[k] = { t, val: null, by: 'app' }; }
    for (const k of Object.keys(this.pnlSt)) if (!pk.has(k)) delete this.pnlSt[k];
    for (const k of Object.keys(this.pnlFired)) if (!pk.has(k)) delete this.pnlFired[k];
    for (const k of Object.keys(this.pnlPend)) if (!pk.has(k) || this.pnlFired[k]) { if (this.pnlFired[k]?.by === 'app') this.log(`${pnlName(k.split(':')[1])}: die App hat selbst gemeldet`); delete this.pnlPend[k]; }
    for (const k of [...this.firstLook]) if (!keys.has(k)) this.firstLook.delete(k);
    // 1.4: Protokoll – Übergabe erhalten, Alarme geladen (mit den Marken)
    this.log(`Übergabe erhalten: Nachricht #${pm.message_id} · App ${stamp(data.at || t, data.tz)}${data.dev ? ` · ${data.dev}` : ''} · #${data.tag}`);
    const items = watchItems(data);
    this.log(data.on ? `Alarme geladen: ${plural(data.alarms.length, 'Alarm', 'Alarme')}, ${plural(data.positions.length, 'Position', 'Positionen')}${data.econ.warn && data.ev.news ? `, Termin-Warnung ${data.econ.warn} min vorher` : ''}${pulseOn(data) ? ', BTC-Puls' : ''}${pnlOn(data) ? `, Gewinn-/Verlust-Alarm (${lims.map(l => `${l.k === 'profit' ? '≥ +' : '≤ −'}${l.v} USDT`).join(', ')}, ${plural(data.pnl.n, 'offene Position', 'offene Positionen')})` : ''}${items.length ? ` – ${items.slice(0, 6).map(x => x.text).join(' · ')}${items.length > 6 ? ` · … und ${items.length - 6} weitere` : ''}` : ''}`
      : 'Alarme geladen: keine – Übergabe in der App ausgeschaltet, der Dienst meldet nichts');
    // Bestätigung per Telegram, wenn etwas Neues beobachtet wird oder die Übergabe ein-/ausgeschaltet wurde (nicht bei bloßem
    // Entfernen, z. B. nach einem ausgelösten Alarm); sonst den bestätigten Stand still nachführen
    const was = new Set(this.ackKeys || []), fresh = items.filter(x => !was.has(x.key));
    if (!this.ackKeys || fresh.length || this.ackOn !== data.on) this.ackPend = true;
    else { this.ackKeys = items.map(x => x.key); }
    if (!old || old.tag !== data.tag) this.next.beat = 0; // gleich in der angehefteten Nachricht bestätigen
    this.saveState();
  }
  // 1.4: „✅ 24/7-Dienst hat übernommen …“ – lautlos, höchstens einmal je EVERY.ack (mehrere Übergaben kurz nacheinander: eine
  // Bestätigung mit dem neuesten Stand). Keine Meldung im Sinne von „Zustellung: zuletzt …“.
  async sendAck() {
    const c = this.conf?.data; if (!c) { this.ackPend = false; return; }
    const items = watchItems(c), was = new Set(this.ackKeys || []), fresh = this.ackKeys ? items.filter(x => !was.has(x.key)) : items, t = this.now();
    const r = await this.tg('sendMessage', { chat_id: this.chat, text: ackText(c, fresh, t).slice(0, 4000), disable_notification: true, link_preview_options: { is_disabled: true } });
    this.ackPend = false; this.ackKeys = items.map(x => x.key); this.ackAt = t; this.ackOn = c.on; this.saveState();
    this.log(`Bestätigung an Telegram gesendet: ${c.on ? `${plural(items.length, 'Marke', 'Marken')} beobachtet${fresh.length ? `, neu: ${fresh.slice(0, 4).map(x => x.text).join(' · ')}${fresh.length > 4 ? ' …' : ''}` : ''}` : 'Übergabe ausgeschaltet'}${r?.message_id ? ` (Nachricht #${r.message_id})` : ''}`);
  }
  // 1.4: Datei der App fehlt seit EVERY.hint – einmal (dann höchstens alle EVERY.hintAgain) per Telegram sagen, was zusammenpassen
  // muss. Landet die Nachricht in einem anderen Chat als die Datei der App, sieht man daran sofort den falschen Bot/Chat.
  async sendHint() {
    const t = this.now();
    await this.tg('sendMessage', { chat_id: this.chat, text: hintText({ bot: this.botText(), chat: chatText(this.chatInfo, this.chat), what: this.waitWhat || 'nichts', host: os.hostname() }), link_preview_options: { is_disabled: true } });
    this.hintAt = t; this.saveState();
    this.log(`Hinweis an Telegram gesendet: Dienst wartet auf die Übergabe der App (Bot ${this.botText()}, Chat ${this.chat}) – erneut frühestens in ${Math.round(EVERY.hintAgain / 3600e3)} Stunden`);
  }
  // ---- Kurse prüfen ----
  async checkPrices() {
    const c = this.conf?.data; if (!c?.on) return;
    const groups = new Map(), add = (it, kind) => { const k = `${it.source}:${it.symbol}`; if (!groups.has(k)) groups.set(k, { source: it.source, symbol: it.symbol, alarms: [], positions: [], pnl: [] }); groups.get(k)[kind].push(it); };
    if (c.ev.alarm) for (const a of c.alarms) add(a, 'alarms');
    if (c.ev.pos) for (const p of c.positions) add(p, 'positions');
    if (pnlOn(c)) for (const p of c.pnl.pos) add(p, 'pnl');
    if (!groups.size) { this.feed = { okAt: this.now(), error: '', since: 0 }; return; }
    let bad = ''; const prices = new Map(); this.checks++; this.prices = new Map();
    // 1.4: erste Prüfung einer neu übernommenen Marke ins Protokoll (Kurs und Abstand), danach nur Auslösungen und alle 10 min eine Übersicht
    const look = (key, what, level, price, hit) => { if (this.firstLook.delete(key)) this.log(`Kursprüfung: ${what} – Kurs ${priceText(price)}, ${hit ? 'Marke erreicht' : `noch ${number(Math.abs(level / price - 1) * 100)} % entfernt`}`); };
    // 1.3: Kerzen gleichzeitig holen (höchstens 4 Abrufe parallel) – ein langsames Kürzel hält die übrigen nicht mehr auf
    const list = [...groups.entries()], got = await mapLimit(list, 4, ([, g]) => klines(g.source, g.symbol));
    for (const [i, [k, g]] of list.entries()) {
      if (!got[i].ok) { bad = `${coin(g.symbol)}: ${got[i].error.message}`; continue; }
      const rows = got[i].value;
      const t = this.now(), from = this.lastCheck.get(k) ?? t, prev = this.prevCandle.get(k) || null, last = candles(rows).at(-1);
      if (last) { prices.set(k, last.c); this.prices.set(k, { symbol: g.symbol, price: last.c }); }
      this.lastCheck.set(k, t); if (last) this.prevCandle.set(k, { t: last.t, h: last.h, l: last.l, at: t });
      // beobachtet ab dem ersten Blick des Dienstes auf diese Marke (nach einem Neustart: ab dann), nach einem Treffer ab dem Wegbewegen
      const armed = key => { if (!this.seen.has(key)) this.seen.set(key, t); return Math.max(this.seen.get(key), this.rearm.get(key) || 0); };
      for (const a of g.alarms) {
        const key = alarmKey(a); if (this.fired[key]) continue;
        const v = rangeView(rows, from, Math.max(a.armedAt, armed(key)), prev); if (!v) continue;
        const hit = touched(a.price, a.dir === 'below', v), what = `Kurs-Alarm ${coin(a.symbol)} ${a.dir === 'above' ? 'auf/über' : 'auf/unter'} ${priceText(a.price)}`;
        look(key, what, a.price, v.price, hit);
        if (hit) { this.fired[key] = t; this.saveState(); this.log(`Alarm ausgelöst: ${what} (Kurs ${priceText(v.price)}${hit.wick ? `, per Docht bis ${priceText(hit.extreme)}` : ''})`); const ev = alarmEvent(a), label = `Kurs-Alarm ${coin(a.symbol)}`; if (this.reserveOwn(ev, label).grant) await this.queue(alarmText(a, v.price, hit), c.tz, { label, ev: this.key ? ev : '' }); } // 2.0: nur mit Freigabe
      }
      for (const p of g.positions) for (const type of ['sl', 'tp']) {
        if (!(p[type] > 0)) continue;
        const key = posKey(p, type), v = rangeView(rows, from, Math.max(p.since, armed(key)), prev); if (!v) continue;
        const hit = touched(p[type], (type === 'sl') === (p.side === 'long'), v), what = `${type === 'tp' ? 'Take-Profit' : 'Stop-Loss'} ${coin(p.symbol)} ${p.side === 'long' ? 'Long' : 'Short'} ${priceText(p[type])}`;
        look(key, what, p[type], v.price, hit);
        if (hit) {
          if (!this.fired[key] && !p.ack[type]) { this.fired[key] = t; this.saveState(); this.log(`Alarm ausgelöst: ${what} (Kurs ${priceText(v.price)}${hit.wick ? `, per Docht bis ${priceText(hit.extreme)}` : ''})`); const base = posBase(p, type), ev = `${base}:${this.eps[base]?.n || 0}`, label = `${type === 'tp' ? 'Take-Profit' : 'Stop-Loss'} ${coin(p.symbol)}`; if (this.reserveOwn(ev, label).grant) await this.queue(posText(p, type, v.price, hit), c.tz, { label, ev: this.key ? ev : '' }); }
        } else if (this.fired[key]) {
          // 2.0: Episodenwechsel erst, wenn der Kurs die Marke um mindestens 0,1 % verlassen hat (Hysterese); mit Steuerung zählt
          // die neue Episode zusätzlich erst nach der Abklingzeit – App und Dienst melden dasselbe Verlassen nur einmal
          const lvl = p[type], below = (type === 'sl') === (p.side === 'long'), away = below ? v.price >= lvl * (1 + EP_HYST) : v.price <= lvl * (1 - EP_HYST);
          if (away) { delete this.fired[key]; this.rearm.set(key, t); if (this.key) { const base = posBase(p, type), from = this.eps[base]?.n || 0, n = epNext(this.eps, this.evs, base, from, t); if (n !== from) this.log(`Episode ${base}: neue Episode ${n} (Kurs ${priceText(v.price)} hat die Marke verlassen)`); } this.saveState(); } // Kurs wieder weg: nächste Berührung meldet erneut
        }
      }
    }
    if (pnlOn(c)) await this.checkPnl(c, prices);
    const t = this.now();
    if (!bad) { this.feed = { okAt: t, error: '', since: 0 }; this.clear('Kurse'); }
    else { if (!this.feed.since) this.feed.since = t; this.feed.error = bad; this.note('Kurse', bad); }
  }
  // ---- Gewinn-/Verlust-Alarm (ab 1.2): dieselbe Regel wie in der App, mit den Kursen dieser Prüfung ----
  // Erreicht: noch nicht senden, sondern EVERY.pnlHold auf die App warten (sie meldet bei geöffneter App selbst und vermerkt
  // das in ihrer Datei) – die Datei gleich neu lesen; gemeldet wird in flushPnl
  async checkPnl(c, prices) {
    const cur = pnlTotal(c.pnl, prices); if (cur === null) return; // ohne offene Position oder mit fehlendem Kurs: keine Prüfung
    const t = this.now();
    for (const l of c.pnl.lim) {
      const k = pnlKey(l); if (this.pnlFired[k] || this.pnlPend[k]) continue;
      const met = pnlMet(l.k, l.v, cur), st = this.pnlSt[k] || (l.w ? 'wait' : 'armed');
      if (st === 'wait') { if (!met) { this.pnlSt[k] = 'armed'; this.saveState(); } continue; }
      if (!met) continue;
      // 2.0: mit Steuerung sofort reservieren – wer zuerst reserviert (geöffnete App oder Dienst), meldet; kein Warten auf die Datei
      if (this.key) { const ev = pnlEvent(l), g = this.reserveOwn(ev, pnlName(l.k)); this.pnlFired[k] = g.grant ? { t, val: cur } : { t, val: cur, by: 'app' }; this.saveState(); if (g.grant) { this.next.beat = 0; await this.queue(pnlText(l, cur, c.pnl.pos.length), c.tz, { label: pnlName(l.k), ev }); } continue; }
      this.pnlPend[k] = { t, val: cur }; this.next.config = 0; this.saveState();
      this.log(`${pnlName(l.k)}: Live-Ergebnis ${cur} USDT (Grenze ${l.k === 'profit' ? '≥ +' : '≤ −'}${l.v}) – meldet in ${EVERY.pnlHold / 1000} s, falls die App es nicht schon tut`);
    }
  }
  // Wartende Gewinn-/Verlust-Meldungen nach EVERY.pnlHold senden – vorher die Datei der App frisch lesen: Hat sie inzwischen
  // selbst gemeldet (done), nichts senden. Ist Telegram dabei nicht lesbar, trotzdem senden (lieber doppelt als gar nicht).
  async flushPnl() {
    const due = () => Object.entries(this.pnlPend).filter(([, p]) => this.now() - p.t >= EVERY.pnlHold);
    if (!due().length) return;
    try { await this.syncConfig(); } catch (e) { this.note('Datei der App', e.message); }
    const c = this.conf?.data; if (!pnlOn(c)) return;
    for (const [k, p] of due()) {
      delete this.pnlPend[k]; const l = c.pnl.lim.find(x => pnlKey(x) === k);
      if (!l || this.pnlFired[k]) continue;
      this.pnlFired[k] = { t: p.t, val: p.val }; this.saveState(); this.next.beat = 0; // gleich in der angepinnten Nachricht vermerken
      this.log(`${pnlName(l.k)} gemeldet: Live-Ergebnis ${p.val} USDT`);
      await this.queue(pnlText(l, p.val, c.pnl.pos.length), c.tz, { label: pnlName(l.k) });
    }
    this.saveState();
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
    await this.queue(pulseText(p, price, String(h).padStart(2, '0'), others), c.tz, { label: 'BTC-Puls', silent: h >= 22 || h < 7 });
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
      await this.queue(econText(g, t, c.tz), c.tz, { label: 'Termin-Warnung' });
    }
    for (const [k, at] of Object.entries(this.fired)) if (k.startsWith('econ-chan:') && t - at > 2 * 864e5) delete this.fired[k];
  }
  // ---- 2.0 (G05): HTTPS-Steuerung (Caddy davor, hier nur 127.0.0.1) ----
  // Nur mit Zugangsschlüssel („Authorization: Bearer …“). CORS nur für die Herkunft der App; Anfragen anderer Seiten lehnt der
  // Dienst ab. Änderungen werden vor der Antwort dauerhaft gespeichert – bestätigt ist nur, was den Neustart übersteht.
  //   GET  /v1/health                ohne Schlüssel: läuft der Dienst? (Version)
  //   GET  /v1/state                 Schalter (Revision, Epoche, Einschaltzeit), Episoden, Ereignisse der letzten 3 Tage
  //   POST /v1/policy                Auftrag { commandId, expectedRevision, set: { Ziel: an/aus } } – gemeinsam oder gar nicht
  //   GET  /v1/commands/<id>         Ergebnis eines Auftrags (Antwort verloren gegangen)
  //   POST /v1/events/reserve        { eventId, targetId, sender, label } → Freigabe oder Inhaber
  //   POST /v1/events/report         { eventId, sender, st, why } → Zustand fortschreiben (nur der Inhaber)
  //   POST /v1/episodes/next         { base, from } → neue Episode einer wiederkehrenden Marke (einmal je Verlassen)
  stateView(days = 3) {
    const t = this.now(), events = Object.entries(this.evs).filter(([, e]) => t - e.at < days * 864e5).sort((a, b) => b[1].at - a[1].at).slice(0, 300).map(([id, e]) => ({ id, ...e }));
    return { ok: true, v: VERSION, now: t, ...policyView(this.pol), eps: Object.fromEntries(Object.entries(this.eps).map(([b, x]) => [b, x.n])), events };
  }
  keyOk(h) {
    const a = /^Bearer\s+(\S+)$/.exec(String(h || ''))?.[1] || '', x = crypto.createHash('sha256').update(a).digest(), y = crypto.createHash('sha256').update(this.key).digest();
    return !!a && crypto.timingSafeEqual(x, y);
  }
  async handle(req, res) {
    const origin = String(req.headers.origin || ''), allowed = !!origin && this.origins.includes(origin), t = this.now();
    const head = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...(allowed ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}) };
    const send = (status, body) => { res.writeHead(status, head); res.end(JSON.stringify(body)); };
    if (req.method === 'OPTIONS') {
      if (!allowed) return send(403, { ok: false, error: 'Herkunft nicht erlaubt.' });
      res.writeHead(204, { ...head, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'authorization, content-type', 'access-control-max-age': '600' }); return res.end();
    }
    if (origin && !allowed) return send(403, { ok: false, error: 'Herkunft nicht erlaubt.' });
    const u = new URL(req.url || '/', 'http://x'), route = `${req.method} ${u.pathname}`;
    if (route === 'GET /v1/health') return send(200, { ok: true, v: VERSION });
    // falscher Schlüssel: höchstens 20 Versuche je Minute, danach bremsen
    if (t - this.authFail.t > 60e3) this.authFail = { n: 0, t };
    if (this.authFail.n >= 20) return send(429, { ok: false, error: 'Zu viele falsche Zugangsschlüssel – bitte eine Minute warten.' });
    if (!this.keyOk(req.headers.authorization)) { this.authFail.n++; if (this.authFail.n === 1 || this.authFail.n === 20) this.log(`Steuerung: falscher Zugangsschlüssel (${route}${origin ? `, Herkunft ${origin}` : ''})`); return send(401, { ok: false, error: 'Zugangsschlüssel fehlt oder ist falsch.' }); }
    let body = null;
    if (req.method === 'POST') {
      let raw = ''; for await (const c of req) { raw += c; if (raw.length > 65536) return send(413, { ok: false, error: 'Anfrage zu groß.' }); }
      try { body = JSON.parse(raw || '{}'); } catch { return send(400, { ok: false, error: 'Kein gültiges JSON.' }); }
    }
    if (route === 'GET /v1/state') return send(200, this.stateView());
    if (route === 'POST /v1/policy') {
      const before = policyView(this.pol), r = policyApply(this.pol, this.cmds, body, t);
      if (!r.repeat) {
        if (r.status === 200 && r.body.changed.length) {
          this.log(`Schalter geändert (Auftrag ${body.commandId}, Revision ${before.rev} → ${this.pol.rev}): ${r.body.changed.map(id => `${TARGET_NAME[id]} ${this.pol.targets[id].on ? 'AN' : 'AUS'}`).join(', ')}`);
          // AUS verwirft wartende Meldungen dieses Ziels sofort (geprüft wird ohnehin unmittelbar vor dem Senden)
          if (!this.pol.targets['course-alert'].on && this.out.length) { for (const m of this.out) { this.log(`Meldung verworfen (Ziel Kursalarm ausgeschaltet): ${m.label || m.text.split('\n')[0]}`); if (m.ev) this.evSet(m.ev, 'discarded', 'Ziel ausgeschaltet'); } this.out = []; }
        } else if (r.status === 409) this.log(`Schalter-Auftrag ${body?.commandId} abgelehnt: Revision ${this.pol.rev}, erwartet ${body?.expectedRevision}`);
        this.saveStateNow(); this.next.beat = 0;
      }
      return send(r.status, r.body);
    }
    const cm = /^\/v1\/commands\/([A-Za-z0-9_-]{8,64})$/.exec(u.pathname);
    if (req.method === 'GET' && cm) { const c = this.cmds.find(x => x.id === cm[1]); return send(c ? 200 : 404, c ? { ok: true, found: true, status: c.status, result: c.body } : { ok: true, found: false }); }
    if (route === 'POST /v1/events/reserve') {
      const r = evReserve(this.evs, this.pol, body, t);
      if (r.created) { this.evLog(body.eventId); this.saveStateNow(); }
      return send(r.status, r.body);
    }
    if (route === 'POST /v1/events/report') {
      if (body?.sender === 'oracle') return send(400, { ok: false, error: 'Sender „oracle“ ist dem Dienst vorbehalten.' });
      const r = evReport(this.evs, body, t);
      if (r.changed) { this.evLog(body.eventId); this.saveStateNow(); }
      return send(r.status, r.body);
    }
    if (route === 'POST /v1/episodes/next') {
      if (typeof body?.base !== 'string' || !/^[A-Za-z0-9_.:-]{4,120}$/.test(body.base) || !Number.isInteger(body.from)) return send(400, { ok: false, error: 'Marke oder Episode fehlt.' });
      const n = epNext(this.eps, this.evs, body.base, body.from, t); if (n !== body.from) { this.log(`Episode ${body.base}: neue Episode ${n} (von der App gemeldet)`); this.saveStateNow(); }
      return send(200, { ok: true, ep: n });
    }
    return send(404, { ok: false, error: 'Unbekannter Aufruf.' });
  }
  listenNow() {
    if (!this.key || this.server) return Promise.resolve(null);
    const [, hostPart, portPart] = /^(.*):(\d+)$/.exec(this.listen) || [, '127.0.0.1', '8247'];
    this.server = http.createServer((req, res) => { this.handle(req, res).catch(e => { this.note('Steuerung', e.message); try { res.writeHead(500, { 'content-type': 'application/json' }); res.end('{"ok":false,"error":"Interner Fehler"}'); } catch { /* schon beantwortet */ } }); });
    return new Promise(resolve => {
      this.server.once('error', e => { this.log(`Steuerung: Adresse ${this.listen} nicht nutzbar (${e.code || e.message}) – der Dienst läuft ohne HTTPS-Steuerung weiter.`); this.server = null; resolve(null); });
      this.server.listen(Number(portPart), hostPart, () => { const a = this.server.address(); this.log(`Steuerung bereit: lauscht auf ${hostPart}:${a.port}${this.host ? ` · öffentlich https://${this.host}` : ''} · Herkunft der App ${this.origins.join(', ')}`); resolve(a.port); });
    });
  }
  // ---- Lebenszeichen in der angepinnten Nachricht ----
  health() {
    const c = this.conf?.data, t = this.now();
    if (!c?.on) return { ok: true, problem: '' };
    const stale = this.feed.since && t - this.feed.since > EVERY.feedStale;
    if (stale) return { ok: false, problem: `Kurse nicht abrufbar seit ${timeText(this.feed.since, c.tz)} (${this.feed.error.slice(0, 120)})` };
    // 1.3: Meldung nicht zustellbar – sofort, wenn Telegram ablehnt (4xx außer „Too Many Requests“), sonst nach einer Minute.
    // „Störung“ heißt für die App: Sie meldet wieder selbst.
    const e = this.sendErr, refused = e && e.code >= 400 && e.code < 500 && e.code !== 429;
    if (e && this.out.some(m => m.tries) && (refused || t - e.since > 60e3)) return { ok: false, problem: `Telegram-Nachricht nicht zustellbar seit ${timeText(e.since, c.tz)} (${e.msg.slice(0, 100)})` };
    return { ok: true, problem: '' };
  }
  async heartbeat() {
    if (!this.conf) return;
    const c = this.conf.data, h = this.health(), gv = pnlOn(c) ? c.pnl.lim.map(l => [l, this.pnlFired[pnlKey(l)]]).filter(([, f]) => f && f.by !== 'app').map(([l, f]) => pnlLine(l, f, c.tz)) : [];
    const text = caption(c, statusLine({ ok: h.ok, now: this.now(), c, problem: h.problem, ctl: !!this.server }), [lastLine(this.last, c.tz), ...gv].filter(Boolean));
    try {
      await this.tg('editMessageCaption', { chat_id: this.chat, message_id: this.conf.msgId, caption: text }); this.beatOk = h.ok;
      // 1.4: Protokoll – wann die App die Bestätigung lesen kann; danach alle 10 Minuten eine kurze Übersicht
      if (this.beatTag !== c.tag) { this.beatTag = c.tag; this.log(`Bestätigung eingetragen: angeheftete Nachricht zeigt „${h.ok ? 'aktiv' : 'Störung'} · #${c.tag} übernommen“ – die App zeigt „Übergeben ✓ vom Dienst bestätigt“`); }
      else this.log(this.summary(h));
    }
    catch (e) {
      if (/not modified/i.test(e.message)) return;
      // 1.4: „can't be edited“ heißt: Die Nachricht stammt von einem anderen Bot (Gruppe mit zwei Bots) – weiter beobachten, aber sagen
      if (/can't be edited/i.test(e.message)) { this.note('Bestätigung', `nicht möglich – die angeheftete Datei hat ein anderer Bot gesendet als ${this.botText()}. Der Dienst prüft die Alarme trotzdem; damit die App die Übernahme sieht, am Server denselben Bot wie in der App (Kursalarm) eintragen.`); return; }
      if (/not found|MESSAGE_ID_INVALID/i.test(e.message)) { this.log('Angepinnte Nachricht nicht mehr da – warte auf eine neue Datei der App.'); this.conf = null; this.saveState(); return; }
      throw e;
    }
  }
  // 1.4: Übersicht fürs Protokoll (alle 10 Minuten): Zustand, Kursprüfungen seit der letzten Übersicht, aktuelle Kurse
  summary(h = this.health()) {
    const c = this.conf?.data, n = this.checks, px = [...this.prices.values()].slice(0, 6).map(p => `${coin(p.symbol)} ${priceText(p.price)}`); this.checks = 0;
    if (!c?.on) return 'Lebenszeichen: Übergabe in der App ausgeschaltet – keine Kursprüfung';
    return `Lebenszeichen: ${h.ok ? 'aktiv' : `Störung (${h.problem})`} · ${plural(watchItems(c).length, 'Marke', 'Marken')} beobachtet · ${plural(n, 'Kursprüfung', 'Kursprüfungen')} seit der letzten Übersicht${px.length ? ` · ${px.join(', ')}` : ''}${this.out.length ? ` · ${plural(this.out.length, 'Meldung', 'Meldungen')} im Ausgang` : ''}`;
  }
  // ---- Takt ----
  async tick() {
    const t = this.now(), c = () => this.conf?.data, run = async (name, fn) => { try { await fn(); this.clear(name); } catch (e) { this.note(name, e.message); } };
    // 2.0: Freigaben ohne Rückmeldung des Geräts → „unbestätigt“ (nie an einen anderen Sender); alte Einträge vergessen
    if (t >= (this.next.sweep || 0)) { this.next.sweep = t + Math.min(60e3, EVERY.config); const done = evSweep(this.evs, this.eps, t); for (const id of done) this.evLog(id); if (done.length) this.saveState(); }
    if (t >= this.next.config) { this.next.config = t + EVERY.config; await run('Datei der App', () => this.syncConfig()); }
    // 1.4: Bestätigung „hat übernommen“ (lautlos) und Hinweis, wenn die Datei der App fehlt – Fehler: im nächsten Takt erneut
    if (this.ackPend && this.conf && t - this.ackAt >= EVERY.ack) await run('Bestätigung an Telegram', () => this.sendAck());
    if (this.waiting && this.waitSince && t - this.waitSince >= EVERY.hint && (!this.hintAt || t - this.hintAt >= EVERY.hintAgain)) await run('Hinweis an Telegram', () => this.sendHint());
    if (c()?.on && t >= this.next.price) { this.next.price = t + EVERY.price; await run('Kursprüfung', () => this.checkPrices()); if (pulseOn(c())) await run('BTC-Puls', () => this.checkPulse()); } // Abruffehler je Kürzel meldet checkPrices selbst („Kurse“)
    if (c()?.on && Object.keys(this.pnlPend).length) await run('Gewinn/Verlust', () => this.flushPnl()); // erreichte Grenzen nach der Wartezeit
    if (this.out.length) await run('Zustellung', () => this.deliver()); // noch nicht zugestellte Meldungen
    const needCal = c()?.on && c().ev.news && c().econ.warn;
    if (needCal && t >= this.next.cal) { this.next.cal = t + 5 * 60e3; await run('Kalender', async () => { await this.loadCalendar(); this.next.cal = t + EVERY.cal; }); } // Fehler: in 5 min erneut
    if (needCal && t >= this.next.econ) { this.next.econ = t + EVERY.econ; await run('Termine', () => this.checkEcon()); }
    const h = this.health();
    // Zustand geändert (aktiv ↔ Störung): gleich vermerken – misslingt das (Telegram gestört), nach einer Minute erneut, nicht in
    // jedem Takt; das reguläre Lebenszeichen dann ebenfalls nach spätestens einer Minute
    const changed = this.beatOk !== null && h.ok !== this.beatOk && t - this.beatFailAt >= Math.min(60e3, EVERY.beat);
    if (this.conf && (t >= this.next.beat || changed)) {
      this.next.beat = t + EVERY.beat;
      await run('Lebenszeichen', async () => { try { await this.heartbeat(); this.beatFailAt = 0; } catch (e) { this.beatFailAt = t; this.next.beat = t + Math.min(60e3, EVERY.beat); throw e; } });
    }
  }
  async start() {
    const me = await this.tg('getMe').catch(e => { this.log('Bot nicht erreichbar:', e.message); return null; }); this.me = me;
    this.log(`Scalp Desk 24/7-Dienst ${VERSION} gestartet${me ? ` · Bot @${me.username} (ID ${me.id})` : ''} · Chat ${this.chat} · Node ${process.versions.node} · prüft die Übergabe alle ${EVERY.config / 1000} s, die Kurse alle ${EVERY.price / 1000} s`);
    // 1.4: Stand aus der Zustandsdatei (nach einem Neustart) nennen – die erste Kursprüfung je Marke kommt ins Protokoll
    if (this.conf?.data) { const c = this.conf.data, items = watchItems(c); this.log(`Übergabe aus dem gespeicherten Zustand (#${c.tag}): ${c.on ? `${plural(items.length, 'Marke', 'Marken')}${items.length ? ` – ${items.slice(0, 6).map(x => x.text).join(' · ')}` : ''}` : 'Übergabe ausgeschaltet'}`);
      for (const a of c.alarms) this.firstLook.add(alarmKey(a)); for (const p of c.positions) for (const ty of ['tp', 'sl']) this.firstLook.add(posKey(p, ty)); }
    await this.listenNow(); // 2.0: HTTPS-Steuerung (nur mit Zugangsschlüssel)
    const stop = () => { this.stopped = true; clearTimeout(this.saveTimer); this.saveStateNow(); this.server?.close(); process.exit(0); };
    process.on('SIGTERM', stop); process.on('SIGINT', stop);
    while (!this.stopped) { await this.tick(); await sleep(EVERY.tick); }
  }
  // ---- Prüfung nach der Einrichtung (install.sh): Bot, Chat, Binance, angepinnte Datei ----
  async check() {
    let ok = true; const say = (good, text) => { this.log(`${good ? '✓' : '✗'} ${text}`); if (!good) ok = false; };
    try { const me = await this.tg('getMe'); this.me = me; say(true, `Bot @${me.username} (ID ${me.id}) erreichbar`); }
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
    // 1.4: die häufigste Ursache für „wartet auf den 24/7-Dienst“ gleich hier nennen
    this.log(`• Wichtig: In der App unter Kursalarm müssen derselbe Bot (${this.botText()}) und dieselbe Chat-ID (${this.chat}) stehen – mit einem anderen Bot (z. B. dem Sicherungs-Bot) sieht der Dienst die Übergabe nicht.`);
    return ok;
  }
  // ---- 1.4: Fehlersuche ohne Nachricht (sudo scalpdesk-247 status): der ganze Weg App → Telegram → Dienst ----
  async status() {
    let ok = true; const say = (good, text) => { this.log(`${good === null ? '•' : good ? '✓' : '✗'} ${text}`); if (good === false) ok = false; };
    const how = `In der App unter 🔔 Hinweise → „Telegram / Discord einrichten“ → Kursalarm müssen derselbe Bot und dieselbe Chat-ID stehen wie hier am Server; dort „An den 24/7-Dienst übergeben“ einschalten. Anderer Bot (z. B. Sicherungs-Bot) oder andere Chat-ID: am Server neu eingeben mit\n    curl -fsSL https://raw.githubusercontent.com/NicoAHB/wx-widget/main/server/install.sh | sudo bash -s -- --neu`;
    this.log(`Scalp Desk 24/7-Dienst ${VERSION} – Status`);
    try { this.me = await this.tg('getMe'); say(true, `Bot ${this.botText()} (ID ${this.me.id}) – Token gültig`); }
    catch (e) { say(false, e.code === 401 || e.code === 404 ? 'Bot-Token ungültig – Token aus der App (Kursalarm) mit --neu neu eingeben.' : e.message); return false; }
    let chat; try { chat = await this.tg('getChat', { chat_id: this.chat }); say(true, `Chat ${chatText(chat, this.chat)} erreichbar`); }
    catch (e) { say(false, `Chat ${this.chat}: ${e.message} – Chat-ID prüfen und dem Bot in Telegram einmal „Start“ schreiben.`); return false; }
    const pm = chat?.pinned_message;
    if (!isConfigMessage(pm)) { say(false, `Keine Datei der App angeheftet (angeheftet: ${pinnedWhat(pm)}) – der Dienst kennt keine Alarme.`); this.log(`  → ${how}`); }
    else {
      const lines = String(pm.caption || '').replace(/\r/g, '').split('\n'), app = lines.find(l => l.startsWith('App:')) || '', svc = lines.find(l => l.startsWith(LINE)) || '', zl = lines.find(l => l.startsWith('Zustellung:'));
      say(true, `Datei der App angeheftet (Nachricht #${pm.message_id}) – ${app || 'ohne App-Zeile'}`);
      if (pm.from?.id && pm.from.id !== this.me.id) say(false, `Die Datei hat ${pm.from.username ? '@' + pm.from.username : 'ein anderer Bot'} gesendet, der Dienst nutzt ${this.botText()} – Bestätigen geht so nicht. ${how}`);
      const m = / · #([a-z0-9]{2,12}) übernommen/.exec(svc), appTag = /#([a-z0-9]{2,12})$/.exec(app)?.[1] || '', age = Math.round((this.now() - (pm.edit_date || pm.date || 0) * 1000) / 60e3);
      if (!m) say(false, `Noch keine Bestätigung des Dienstes in der Nachricht („${svc || 'keine Zeile „Dienst:“'}“). Läuft der Dienst? → sudo systemctl status scalpdesk-247`);
      else if (m[1] !== appTag) say(null, `Bestätigt ist ein älterer Stand (#${m[1]}); den neuen (#${appTag}) übernimmt der Dienst in spätestens ${EVERY.config / 1000} Sekunden.`);
      else say(/aktiv/.test(svc) && age <= 20 ? true : false, `Vom Dienst bestätigt: „${svc}“ (vor ${plural(age, 'Minute', 'Minuten')})${age > 20 ? ' – älter als 20 Minuten: Läuft der Dienst? → sudo systemctl status scalpdesk-247' : ''}`);
      if (zl) say(null, zl);
      try { const data = await this.readFile(pm.document), items = watchItems(data); say(true, data.on ? `Beobachtet: ${items.length ? items.map(x => x.text).join(' · ') : 'nichts (keine Kurs-Alarme, keine Positionen mit Stop/Ziel)'}` : 'Übergabe in der App ausgeschaltet – der Dienst meldet nichts'); }
      catch (e) { say(false, `Datei nicht lesbar: ${e.message}`); }
    }
    if (this.statePath) {
      if (!fs.existsSync(this.statePath)) say(null, `Noch keine Zustandsdatei (${this.statePath}) – der Dienst lief noch nicht oder hat noch nichts gespeichert.`);
      else {
        const tz = this.conf?.data?.tz || 'UTC';
        say(null, `Zustand: ${this.last?.t ? `zuletzt zugestellt ${stamp(this.last.t, tz)}${this.last.label ? ` (${this.last.label})` : ''}` : 'noch keine Meldung zugestellt'}${this.out.length ? ` · ${plural(this.out.length, 'Meldung', 'Meldungen')} warten im Ausgang` : ' · Ausgang leer'}${this.hintAt ? ` · Hinweis „wartet auf die Übergabe“ zuletzt ${stamp(this.hintAt, tz)}` : ''}`);
        if (this.sendErr) say(false, `Telegram nimmt Meldungen nicht an seit ${stamp(this.sendErr.since, tz)}: ${this.sendErr.msg}`);
      }
    }
    // 2.0 (G05): HTTPS-Steuerung – lauscht der Dienst, ist er von außen erreichbar, wie stehen die Schalter, was geschah zuletzt
    if (!this.key) say(null, 'HTTPS-Steuerung nicht eingerichtet – Chat-Schalter und Sendefreigaben der App brauchen sie: den Installationsbefehl erneut ausführen.');
    else {
      const port = /:(\d+)$/.exec(this.listen)?.[1] || '8247', tz = this.conf?.data?.tz || 'UTC';
      try { const d = await (await fetch(`http://127.0.0.1:${port}/v1/health`, { signal: AbortSignal.timeout(3000) })).json(); say(!!d?.ok, `Steuerung lauscht auf ${this.listen} (Dienst ${d?.v || '?'})`); }
      catch (e) { say(false, `Steuerung auf ${this.listen} nicht erreichbar (${e.cause?.code || e.name}) – läuft der Dienst? → sudo systemctl status scalpdesk-247`); }
      if (!this.host) say(null, 'Keine öffentliche Adresse eingetragen – den Installationsbefehl erneut ausführen.');
      else {
        try { const r = await fetch(`https://${this.host}/v1/health`, { signal: AbortSignal.timeout(8000) }), d = await r.json().catch(() => null); say(!!d?.ok, d?.ok ? `Von außen erreichbar: https://${this.host}` : `https://${this.host} antwortet mit Fehler ${r.status} – Caddy prüfen: sudo systemctl status caddy`); }
        catch (e) { say(false, `https://${this.host} nicht erreichbar (${e.cause?.code || e.name}) – in der Oracle-Konsole die Ports 80 und 443 freigeben (siehe Anleitung) und Caddy prüfen: sudo systemctl status caddy`); }
      }
      say(null, `Ziele (Revision ${this.pol.rev}): ${TARGETS.map(id => { const x = this.pol.targets[id]; return `${TARGET_NAME[id]} ${x.on ? `an seit ${stamp(x.since, tz)}` : `aus${x.offSince ? ` seit ${stamp(x.offSince, tz)}` : ''}`}`; }).join(' · ')}`);
      const evs = Object.entries(this.evs).sort((a, b) => b[1].at - a[1].at).slice(0, 5);
      say(null, evs.length ? `Letzte Ereignisse: ${evs.map(([id, e]) => `${stamp(e.at, tz)} ${id} → ${TARGET_NAME[e.target] || e.target}, ${senderName(e.by)}, ${ST_NAME[e.st] || e.st}${e.why ? ` (${e.why})` : ''}`).join(' | ')}` : 'Noch keine Ereignisse über die Steuerung.');
    }
    for (const [src, sym] of [['spot', 'BTCUSDT'], ['futures', 'BTCUSDT']]) {
      try { const r = await klines(src, sym); say(true, `Binance ${src === 'spot' ? 'Spot' : 'Futures'} erreichbar (BTC ${priceText(+r.at(-1)[4])})`); }
      catch (e) { say(src === 'spot' ? false : null, `Binance ${src === 'spot' ? 'Spot' : 'Futures'}: ${e.message}`); }
    }
    this.log(ok ? 'Ergebnis: alles in Ordnung.' : 'Ergebnis: siehe ✗ oben.');
    return ok;
  }
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));
// fn für alle Einträge, höchstens n gleichzeitig; Ergebnis je Eintrag { ok, value } oder { ok: false, error } in derselben Reihenfolge
export async function mapLimit(items, n, fn) {
  const out = new Array(items.length); let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; try { out[i] = { ok: true, value: await fn(items[i], i) }; } catch (error) { out[i] = { ok: false, error }; } } };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}
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
  const o = { config: '/etc/scalpdesk-247.json', state: '', check: false, status: false, zugang: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') o.config = argv[++i]; else if (argv[i] === '--state') o.state = argv[++i]; else if (argv[i] === '--check') o.check = true;
    else if (argv[i] === '--status') o.status = true; else if (argv[i] === '--zugang') o.zugang = true;
    else if (argv[i] === '--version') { console.log(VERSION); process.exit(0); }
  }
  return o;
}
async function main(argv) {
  const [maj] = process.versions.node.split('.').map(Number);
  if (maj < 18) throw new Error(`Node.js ${process.versions.node} ist zu alt – bitte Version 18 oder neuer installieren.`);
  const o = args(argv), conf = readServerConfig(o.config);
  // 2.0: Adresse und Zugangsschlüssel für die App (nur auf ausdrücklichen Aufruf am Server, nie im Protokoll)
  if (o.zugang) {
    if (!conf.key) { console.log('HTTPS-Steuerung ist nicht eingerichtet – den Installationsbefehl erneut ausführen.'); process.exit(1); }
    console.log(`Adresse:          ${conf.host ? `https://${conf.host}` : '(noch keine öffentliche Adresse – den Installationsbefehl erneut ausführen)'}\nZugangsschlüssel: ${conf.key}\n\nIn der App: 🔔 Hinweise → „Telegram / Discord einrichten“ → 24/7-Dienst → Adresse und Zugangsschlüssel eintragen, dann „Verbindung prüfen“.\nDen Schlüssel nicht weitergeben – wer ihn kennt, kann die Chat-Schalter umstellen.`);
    process.exit(0);
  }
  // --status liest nur (Zustand ohne Speichern): kein Schreiben in die Zustandsdatei des laufenden Dienstes
  if (o.status) { const w = new Watcher({ ...conf, statePath: o.state || '/var/lib/scalpdesk-247/state.json' }); w.saveState = () => {}; w.saveStateNow = () => {}; process.exit((await w.status()) ? 0 : 1); }
  const w = new Watcher({ ...conf, statePath: o.state });
  if (o.check) process.exit((await w.check()) ? 0 : 1);
  await w.start();
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(e => { console.error('Fehler:', e.message); process.exit(1); });
