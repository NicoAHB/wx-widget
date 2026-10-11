// Reiner Chartmusterdienst: gemeinsame pat-1-Engine, keine Sicherung, Trades oder Orders.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { klines } from './scalpdesk-247.mjs';
import { PAT_STEPS, patternCandles, patternCases, patternFresh, patternText, patternEnd } from './pattern-monitor.mjs';
import { formatMessage, telegramFields, telegramPlain, telegramFormatRejected } from './telegram-format.mjs';
export const PATTERNS_VERSION = '1.0.0';
export function readPatternEnvironment(file) {
  const out = {}; for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const m = /^([A-Z_]+)=(.*)$/.exec(line); if (!m) throw new Error('Ungültige Zeile in der .env-Datei');
    const value = m[2].trim(); out[m[1]] = /^(['"]).*\1$/.test(value) ? value.slice(1, -1) : value;
  }
  if (!/^\d{1,20}:[A-Za-z0-9_-]{20,200}$/.test(out.PATTERN_BOT_TOKEN || '') || !/^(?:-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$/.test(out.PATTERN_CHAT_ID || '') || (out.PATTERN_THREAD_ID && !/^\d{1,10}$/.test(out.PATTERN_THREAD_ID))) throw new Error('Bot-Token, Chat-ID oder Thema in der .env-Datei prüfen');
  return { token: out.PATTERN_BOT_TOKEN, chat: out.PATTERN_CHAT_ID, thread: out.PATTERN_THREAD_ID || '' };
}
export function patternWatchFile(raw) {
  if (!raw || Object.keys(raw).some(k => !['kind', 'v', 'model', 'gap', 'items'].includes(k)) || raw.kind !== 'scalpdesk-patterns-watch' || raw.v !== 1 || raw.model !== 'pat-1' || raw.gap !== false || !Array.isArray(raw.items) || !raw.items.length || raw.items.length > 40) throw new Error('Muster-Auswahl ungültig; neu aus der App exportieren');
  const items = raw.items.map(x => {
    if (!x || Object.keys(x).some(k => !['sym', 'mkt', 'iv'].includes(k)) || !/^[A-Z0-9]{2,20}USDT$/.test(x.sym) || !['spot', 'futures'].includes(x.mkt) || !Object.hasOwn(PAT_STEPS, x.iv)) throw new Error('Coin, Markt oder Intervall in der Muster-Auswahl ungültig');
    return { sym: x.sym, mkt: x.mkt, iv: x.iv };
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (new Set(items.map(x => JSON.stringify(x))).size !== items.length) throw new Error('Coin/Markt/Intervall doppelt');
  return { kind: raw.kind, v: 1, model: 'pat-1', gap: false, items };
}
export function atomicPatternState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 }); const tmp = file + '.tmp', fd = fs.openSync(tmp, 'w', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(state)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file); const dir = fs.openSync(path.dirname(file), 'r'); try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
}
export class PatternsOnlyService {
  constructor({ destination, watch, stateFile, now = Date.now, fetchRows = (item) => klines(item.mkt, item.sym, 541, item.iv), send = null, log = console.log }) {
    Object.assign(this, { destination, stateFile, now, fetchRows }); this.log = msg => log(String(msg).replaceAll(destination.token, '[geheim]').replaceAll(destination.chat, '[Chat]')); this.send = send || (text => this.telegram(text)); this.busy = false; this.due = new Map();
    const config = patternWatchFile(watch), sig = crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex');
    this.state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { v: 1, since: now(), sig, cases: {}, events: {} };
    if (this.state.v !== 1 || !Number.isFinite(this.state.since) || !this.state.events || !this.state.cases || Array.isArray(this.state.events) || Array.isArray(this.state.cases)) throw new Error('Dienstzustand beschädigt; Originaldatei erhalten und prüfen');
    if (this.state.sig !== sig) { this.state.sig = sig; this.state.since = now(); }
    for (const event of Object.values(this.state.events)) if (event.st === 'sending') { event.st = 'unconfirmed'; this.log('Nach Neustart unbestätigte Zustellung: kein Doppelversand'); }
    this.config = config; this.persist();
  }
  persist() { atomicPatternState(this.stateFile, this.state); }
  async telegram(html) {
    const d = this.destination, payload = telegramFields(html, { at: this.now(), timezone: 'Europe/Berlin' });
    let body = { chat_id: d.chat, ...(d.thread ? { message_thread_id: d.thread } : {}), text: payload.text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } };
    for (let attempt = 0; attempt < 2; attempt++) {
      let r;
      try { r = await fetch(`https://api.telegram.org/bot${d.token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) }); }
      catch (e) { const reason = e.cause?.code || e.name; throw Object.assign(new Error('Telegram-Verbindung unterbrochen'), { lost: !/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH/.test(reason || '') }); }
      let j; try { j = await r.json(); } catch { throw Object.assign(new Error('Telegram-Antwort unlesbar'), { lost: true }); }
      if (r.ok && j?.ok) return j.result;
      if (!attempt && telegramFormatRejected(j?.error_code || r.status, j?.description)) { body = { ...body, text: telegramPlain(body.text) }; delete body.parse_mode; continue; }
      throw Object.assign(new Error(`Telegram lehnt Nachricht ab (HTTP ${j?.error_code || r.status})`), { status: j?.error_code || r.status, retry: j?.parameters?.retry_after });
    }
  }
  resolve(item, k) {
    const index = new Map(k.map((x, i) => [x.t, i]));
    for (const c of Object.values(this.state.cases)) {
      if (c.res || c.mkt !== item.mkt || c.sym !== item.sym || c.iv !== item.iv) continue;
      const i = index.get(c.tc); if (i === undefined || !k[i + 12]) continue;
      const prices = k.slice(i, i + 13).map(x => +((x.c / c.p0 - 1) * 100).toFixed(4)), r = prices[12];
      c.res = { at: this.now(), tH: k[i + 12].t, ph: k[i + 12].c, r, out: r > .1 ? 'auf' : r < -.1 ? 'ab' : 'seitwärts', path: prices };
    }
  }
  async deliver() {
    for (const e of Object.values(this.state.events)) {
      if (e.st !== 'queued' || e.retryAt > this.now()) continue;
      if (!patternFresh(e.c, this.now(), this.state.since)) { e.st = 'expired'; this.persist(); continue; }
      e.st = 'sending'; this.persist(); // vor dem Netzwerkzugriff dauerhaft reservieren
      try { await this.send(e.text); e.st = 'confirmed'; this.persist(); this.log('Chartmuster zugestellt: ' + e.c.sym + ' · ' + e.c.iv); }
      catch (error) {
        if (error.lost) { e.st = 'unconfirmed'; this.log('Zustellung unbestätigt: kein erneuter Versand derselben Muster-ID'); }
        else if ([400, 401, 403, 404].includes(error.status)) { e.st = 'failed'; this.log('Telegram-Ziel prüfen; Nachricht eindeutig abgelehnt'); }
        else { e.st = 'queued'; e.retryAt = this.now() + Math.max(30000, Number(error.retry || 0) * 1000); this.log('Telegram nicht erreichbar/Rate-Limit; späterer Versuch'); }
        this.persist();
      }
    }
  }
  async scan() {
    if (this.busy) return; this.busy = true;
    try {
      for (const item of this.config.items) {
        const key = `${item.mkt}|${item.sym}|${item.iv}`; if ((this.due.get(key) || 0) > this.now()) continue;
        try {
          const k = patternCandles(await this.fetchRows(item), item.iv, this.now()); this.resolve(item, k);
          for (const { c, h } of patternCases(k, item, this.now())) {
            if (!patternFresh(c, this.now(), this.state.since) || this.state.events[c.id]) continue;
            if (Object.keys(this.state.events).length >= 10000) throw new Error('Musterjournal voll: Versand pausiert; Originalbestand bleibt');
            this.state.cases[c.id] = c;
            this.state.events[c.id] = { st: 'queued', retryAt: 0, c, text: patternText(c, h, Object.values(this.state.cases)) }; this.persist();
          }
          this.persist(); if (k.length) this.due.set(key, patternEnd(patternEnd(k.at(-1).t, item.iv), item.iv) + 2000);
        } catch { this.due.set(key, this.now() + 60000); this.log('Kerzen/Journal prüfen: ' + item.sym + ' · ' + item.iv + '; nächster Versuch in einer Minute'); }
      }
      await this.deliver();
    } finally { this.busy = false; }
  }
}
export async function patternsMain(args = process.argv.slice(2)) {
  const argument = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
  const destination = readPatternEnvironment(argument('--env', '/etc/scalpdesk-patterns.env'));
  const watch = JSON.parse(fs.readFileSync(argument('--watch', '/etc/scalpdesk-patterns-watch.json'), 'utf8'));
  const service = new PatternsOnlyService({ destination, watch, stateFile: argument('--state', '/var/lib/scalpdesk-patterns/state.json') });
  if (args.includes('--test')) { await service.telegram(formatMessage('notice', { headline: '✅ CHARTMUSTER · Test erfolgreich', lines: ['Dieser Dienst sendet ausschließlich bestätigte Chartmuster', 'Regelgüte mindestens 80 %', 'Keine Sicherungen, Trades oder echten Orders'], at: Date.now(), timezone: 'Europe/Berlin' })); console.log('Testnachricht zugestellt'); return; }
  console.log('Chartmusterdienst gestartet · Modell pat-1 · ' + service.config.items.length + ' Märkte');
  let stopping = false; const timer = globalThis.setInterval(() => { if (!stopping) service.scan().catch(() => { console.error('Dienstzustand nicht schreibbar; Dienst wird neu gestartet'); process.exit(1); }); }, 5000);
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { stopping = true; globalThis.clearInterval(timer); });
  await service.scan();
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) patternsMain().catch(() => { console.error('Einrichtung oder Zustand prüfen; keine Zugangsdaten werden protokolliert'); process.exitCode = 1; });
