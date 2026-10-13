// Reiner Chartmusterdienst: gemeinsame pat-1-Engine, keine Sicherung, Trades oder Orders.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { klines, bookTicker } from './scalpdesk-247.mjs';
import { PAT_STEPS, PQ, patternCandles, patternCases, patternFresh, patternText, patternMessageData, patternEnd, patternEvaluate, patternFilterLog } from './pattern-monitor.mjs';
import { formatMessage, telegramFields, telegramPlain, telegramFormatRejected } from './telegram-format.mjs';
import { renderPatternCard, patternCardModel, patternCaption, cardRendererReady, EXAMPLE_SIGNAL } from './pattern-card.mjs';
import { monthStart, purgeSentMessages, purgeReport } from './pattern-retention.mjs';
// 1.1.0: Qualitätsfilter (K.O.-Kriterien, Signalscore, Anti-Spam, Ergebnis-Tracking)
// 1.2.0: Meldung als Trading-Karte (PNG per sendPhoto, Text als Ersatz), monatliche Bereinigung gesendeter Nachrichten
export const PATTERNS_VERSION = '1.2.0';
// Telegram-Fehler, die das Ziel betreffen (dann hilft auch der Text nicht)
const CHAT_PROBLEM = /chat|thread|topic|blocked|kicked|deactivated|not enough rights|have no rights/i;
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
  if (!raw || Object.keys(raw).some(k => !['kind', 'v', 'model', 'gap', 'items', 'filter'].includes(k)) || raw.kind !== 'scalpdesk-patterns-watch' || raw.v !== 1 || raw.model !== 'pat-1' || raw.gap !== false || !Array.isArray(raw.items) || !raw.items.length || raw.items.length > 40) throw new Error('Muster-Auswahl ungültig; neu aus der App exportieren');
  const items = raw.items.map(x => {
    if (!x || Object.keys(x).some(k => !['sym', 'mkt', 'iv'].includes(k)) || !/^[A-Z0-9]{2,20}USDT$/.test(x.sym) || !['spot', 'futures'].includes(x.mkt) || !Object.hasOwn(PAT_STEPS, x.iv)) throw new Error('Coin, Markt oder Intervall in der Muster-Auswahl ungültig');
    return { sym: x.sym, mkt: x.mkt, iv: x.iv };
  }).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (new Set(items.map(x => JSON.stringify(x))).size !== items.length) throw new Error('Coin/Markt/Intervall doppelt');
  return { kind: raw.kind, v: 1, model: 'pat-1', gap: false, items, filter: PQ.patternFilterSettings(raw.filter) };   // 1.1.0: Filter-Schwellen aus der App (ohne Angabe: Preset „Normal“)
}
export function atomicPatternState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 }); const tmp = file + '.tmp', fd = fs.openSync(tmp, 'w', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(state)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file); const dir = fs.openSync(path.dirname(file), 'r'); try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
}
export class PatternsOnlyService {
  constructor({ destination, watch, stateFile, now = Date.now, fetchRows = (item, limit = 541) => klines(item.mkt, item.sym, limit, item.iv), fetchSpread = c => bookTicker(c.mkt, c.sym), send = null, sendPhoto = null, renderCard = null, cardDir = null, log = console.log }) {
    Object.assign(this, { destination, stateFile, now, fetchRows, fetchSpread }); this.log = msg => log(String(msg).replaceAll(destination.token, '[geheim]').replaceAll(destination.chat, '[Chat]')); this.send = send || (text => this.telegram(text)); this.busy = false; this.due = new Map();
    // 1.2.0: Karten, außer jemand gibt nur eine eigene Text-Sendefunktion vor (bisherige Prüfungen)
    this.cards = !send || !!sendPhoto; this.sendPhoto = sendPhoto || ((png, caption) => this.telegramPhoto(png, caption));
    this.renderCard = renderCard || ((data, at) => renderPatternCard(data, { at, timezone: 'Europe/Berlin' })); this.cardDir = cardDir || path.join(path.dirname(stateFile), 'karten');
    const config = patternWatchFile(watch), sig = crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex');
    this.state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { v: 1, since: now(), sig, cases: {}, events: {} };
    if (this.state.v !== 1 || !Number.isFinite(this.state.since) || !this.state.events || !this.state.cases || Array.isArray(this.state.events) || Array.isArray(this.state.cases)) throw new Error('Dienstzustand beschädigt; Originaldatei erhalten und prüfen');
    if (this.state.sig !== sig) { this.state.sig = sig; this.state.since = now(); }
    for (const event of Object.values(this.state.events)) if (event.st === 'sending') { event.st = 'unconfirmed'; this.log('Nach Neustart unbestätigte Zustellung: kein Doppelversand'); }
    if (!Array.isArray(this.state.signals)) this.state.signals = [];   // 1.1.0: Journal aller bewerteten Signale (gesendet und gefiltert)
    if (!Array.isArray(this.state.sent)) this.state.sent = [];         // 1.1.0: gesendete Meldungen für die Anti-Spam-Regeln
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
  // 1.2.0: Karte als Foto (multipart); gleiche Fehlerarten wie beim Text (verloren, abgelehnt, Rate-Limit)
  async telegramPhoto(png, caption) {
    const d = this.destination;
    for (let attempt = 0; attempt < 2; attempt++) {
      const form = new globalThis.FormData(); form.append('chat_id', d.chat); if (d.thread) form.append('message_thread_id', d.thread);
      form.append('caption', attempt ? telegramPlain(caption) : caption); if (!attempt) form.append('parse_mode', 'HTML');
      form.append('photo', new globalThis.Blob([png], { type: 'image/png' }), 'chartmuster.png');
      let r;
      try { r = await fetch(`https://api.telegram.org/bot${d.token}/sendPhoto`, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) }); }
      catch (e) { const reason = e.cause?.code || e.name; throw Object.assign(new Error('Telegram-Verbindung unterbrochen'), { lost: !/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH/.test(reason || '') }); }
      let j; try { j = await r.json(); } catch { throw Object.assign(new Error('Telegram-Antwort unlesbar'), { lost: true }); }
      if (r.ok && j?.ok) return j.result;
      if (!attempt && telegramFormatRejected(j?.error_code || r.status, j?.description)) continue;
      throw Object.assign(new Error(`Telegram lehnt das Bild ab (HTTP ${j?.error_code || r.status})`), { status: j?.error_code || r.status, retry: j?.parameters?.retry_after, description: String(j?.description || '').slice(0, 200) });
    }
  }
  // Karte einmal erzeugen und speichern (Wiederholung nach Rate-Limit sendet dasselbe Bild)
  async cardFor(e) {
    const name = crypto.createHash('sha256').update(String(e.c?.id)).digest('hex').slice(0, 32) + '.png', file = path.join(this.cardDir, name);
    if (e.img === name && fs.existsSync(file)) return { png: fs.readFileSync(file), caption: e.caption || patternCaption(patternCardModel(e.data)) };
    const r = await this.renderCard(e.data, this.now());
    fs.mkdirSync(this.cardDir, { recursive: true, mode: 0o700 }); const tmp = file + '.tmp';
    fs.writeFileSync(tmp, r.png, { mode: 0o600 }); fs.renameSync(tmp, file);
    e.img = name; e.caption = r.caption; this.persist();
    return { png: r.png, caption: r.caption };
  }
  async sendEvent(e) {
    if (this.cards && e.data) {
      let card = null;
      try { card = await this.cardFor(e); } catch (err) { this.log('Karte nicht erzeugt – Text als Ersatz: ' + e.c.sym + ' · ' + e.c.iv + ' (' + String(err?.message || err).slice(0, 120) + ')'); }
      if (card) {
        try { const res = await this.sendPhoto(card.png, card.caption); return { via: 'karte', id: res?.message_id }; }
        catch (err) { if (err?.lost || err?.status !== 400 || CHAT_PROBLEM.test(err?.description || '')) throw err; this.log('Telegram lehnt das Bild ab – Text als Ersatz: ' + e.c.sym + ' · ' + e.c.iv); }
      }
    }
    const res = await this.send(e.text); return { via: 'text', id: res?.message_id };
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
      try {
        const r = await this.sendEvent(e);   // erst nach Telegrams Bestätigung „gesendet“
        Object.assign(e, { st: 'confirmed', sentAt: this.now(), via: r.via }, Number.isFinite(r.id) ? { msgId: r.id } : {}); this.persist();
        this.log('Chartmuster zugestellt (' + (r.via === 'karte' ? 'Karte' : 'Text') + '): ' + e.c.sym + ' · ' + e.c.iv);
      }
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
      // 1.1.0: erst alle Märkte prüfen und Kandidaten bewerten, dann gemeinsam auswählen (höchster Score zuerst, Anti-Spam).
      const candidates = [], cache = new Map(), filter = this.config.filter;
      for (const item of this.config.items) {
        const key = `${item.mkt}|${item.sym}|${item.iv}`; if ((this.due.get(key) || 0) > this.now()) continue;
        try {
          const k = patternCandles(await this.fetchRows(item), item.iv, this.now()); this.resolve(item, k);
          PQ.resolvePatternJournal(this.state.signals, item, k, this.now());
          for (const { c, h } of patternCases(k, item, this.now())) {
            if (!patternFresh(c, this.now(), this.state.since) || this.state.events[c.id] || this.state.signals.some(e => e.id === c.id)) continue;
            if (Object.keys(this.state.events).length >= 10000) throw new Error('Musterjournal voll: Versand pausiert; Originalbestand bleibt');
            const ev = await patternEvaluate({ c, h, k, fetchRows: this.fetchRows, fetchSpread: this.fetchSpread, cache, settings: filter, journal: this.state.signals, now: this.now() });
            candidates.push({ id: c.id, sym: c.sym, iv: c.iv, dir: c.dir, tc: c.tc, eval: ev, c, h });
          }
          if (k.length) this.due.set(key, patternEnd(patternEnd(k.at(-1).t, item.iv), item.iv) + 2000);
        } catch { this.due.set(key, this.now() + 60000); this.log('Kerzen/Journal prüfen: ' + item.sym + ' · ' + item.iv + '; nächster Versuch in einer Minute'); }
      }
      if (candidates.length) {
        const decisions = PQ.selectPatternSignals(candidates, this.state.sent, filter, this.now());
        for (const x of candidates.sort((a, b) => b.eval.score - a.eval.score)) {
          const d = decisions.get(x.id), { c, h, eval: ev } = x;
          this.state.cases[c.id] = c;   // Lernbestand (Kursrichtung nach 12 Kerzen) wie bisher aus allen bestätigten Fällen
          this.state.signals = PQ.addPatternJournal(this.state.signals, PQ.patternJournalEntry(c, ev, d, this.now()));
          this.log(patternFilterLog(c, ev, d));
          if (!d.send) continue;   // gefiltert: nur Journal und Log, nichts an Telegram
          this.state.sent = [...this.state.sent.filter(y => this.now() - y.at < 24 * 36e5), { at: this.now(), sym: c.sym, iv: c.iv, dir: c.dir, id: c.id }];
          const cases = Object.values(this.state.cases);
          this.state.events[c.id] = { st: 'queued', retryAt: 0, c, text: patternText(c, h, cases, ev), data: patternMessageData(c, h, cases, ev) };
        }
      }
      this.persist();
      await this.deliver();
    } finally { this.busy = false; }
  }
  // 1.1.0: Statistik für `--statistik` und Prüfung: je Muster, Zeitrahmen und Coin; „Erlernt“ zählt nur abgeschlossene Fälle.
  statistics() { return { pat: PQ.patternJournalStats(this.state.signals, 'pat'), iv: PQ.patternJournalStats(this.state.signals, 'iv'), sym: PQ.patternJournalStats(this.state.signals, 'sym'), signals: this.state.signals.length }; }
}
export async function patternsMain(args = process.argv.slice(2)) {
  const argument = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
  const stamp = () => new Date().toISOString(), out = msg => console.log(stamp() + ' ' + msg);   // 1.2.0: Zeitstempel (monatliche Bereinigung)
  const stateFile = argument('--state', '/var/lib/scalpdesk-patterns/state.json');
  // 1.2.0: Beispielkarte (prüft Renderer und Schrift) und monatliche Bereinigung – ohne Zugangsdaten
  if (args.includes('--karte-beispiel')) {
    try { const file = argument('--karte-beispiel', 'karte-beispiel.png'), r = await renderPatternCard(EXAMPLE_SIGNAL, { at: Date.now(), preview: true }); fs.writeFileSync(file, r.png); console.log(`Beispielkarte ${r.width} × ${r.height} gespeichert: ${file}`); }
    catch (e) { console.error('Beispielkarte nicht erzeugt: ' + e.message); process.exitCode = 1; }
    return;
  }
  if (args.includes('--bereinigen') || args.includes('--probelauf')) {
    try {
      const dryRun = args.includes('--probelauf'), current = monthStart(Date.now()), cut = argument('--stichtag', null) ? monthStart(argument('--stichtag')) : current;
      if (cut.at > current.at) throw new Error('Stichtag liegt in der Zukunft – nichts gelöscht');
      const r = await purgeSentMessages({ stateFile, cardDir: argument('--karten', path.join(path.dirname(stateFile), 'karten')), logFile: argument('--log', '/var/log/scalpdesk-patterns/service.log'), cutoff: cut.at, dryRun });
      for (const line of purgeReport(r, cut.label)) out(line);
      if (r.failed.length) process.exitCode = 2;
    } catch (e) { out('Bereinigung abgebrochen: ' + e.message); process.exitCode = 1; }   // Meldungen enthalten keine Inhalte/Zugangsdaten
    return;
  }
  const destination = readPatternEnvironment(argument('--env', '/etc/scalpdesk-patterns.env'));
  const watch = JSON.parse(fs.readFileSync(argument('--watch', '/etc/scalpdesk-patterns-watch.json'), 'utf8'));
  const service = new PatternsOnlyService({ destination, watch, stateFile, log: out });
  if (args.includes('--test')) { await service.telegram(formatMessage('notice', { headline: '✅ CHARTMUSTER · Test erfolgreich', lines: ['Dieser Dienst sendet ausschließlich bestätigte Chartmuster', 'Qualitätsfilter: Preset ' + (PQ.PATTERN_FILTER_PRESET_NAMES[service.config.filter.preset] || service.config.filter.preset) + ' · Mindestscore ' + service.config.filter.minScore + ' · Chance/Risiko ≥ ' + String(service.config.filter.minRR).replace('.', ','), 'Keine Sicherungen, Trades oder echten Orders'], at: Date.now(), timezone: 'Europe/Berlin' })); console.log('Testnachricht zugestellt'); return; }
  if (args.includes('--statistik')) { const st = service.statistics(), row = r => `${r.key}: ${r.signals} Signale (${r.sent} gesendet, ${r.filtered} gefiltert) · abgeschlossen ${r.n} · Ziel ${r.ziel} · Ungültig ${r.ungueltig} · Timeout ${r.timeout}`; console.log('Chartmuster-Signale: ' + st.signals); for (const [name, rows] of [['Je Muster', st.pat], ['Je Zeitrahmen', st.iv], ['Je Coin', st.sym]]) { console.log(name + ':'); for (const r of rows) console.log('  ' + row(r)); } return; }
  // 1.2.0: Kennung des laufenden Dienstes – die Bereinigung löscht nichts, solange er läuft (er würde den Zustand überschreiben)
  const pidFile = path.join(path.dirname(stateFile), 'dienst.pid'); fs.writeFileSync(pidFile, String(process.pid), { mode: 0o600 });
  process.once('exit', () => { try { if (Number(fs.readFileSync(pidFile, 'utf8')) === process.pid) fs.rmSync(pidFile); } catch { /* schon weg */ } });
  out('Chartmusterdienst ' + PATTERNS_VERSION + ' gestartet · Modell pat-1 · ' + service.config.items.length + ' Märkte · Qualitätsfilter ' + (PQ.PATTERN_FILTER_PRESET_NAMES[service.config.filter.preset] || service.config.filter.preset) + ' (Score ≥ ' + service.config.filter.minScore + ') · Meldungen als ' + (!service.cards ? 'Text' : await cardRendererReady() ? 'Trading-Karte (Text als Ersatz)' : 'Text – Kartenrenderer fehlt (im Ordner server: npm ci)'));
  let stopping = false; const timer = globalThis.setInterval(() => { if (!stopping) service.scan().catch(() => { console.error('Dienstzustand nicht schreibbar; Dienst wird neu gestartet'); process.exit(1); }); }, 5000);
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { stopping = true; globalThis.clearInterval(timer); });
  await service.scan();
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) patternsMain().catch(() => { console.error('Einrichtung oder Zustand prüfen; keine Zugangsdaten werden protokolliert'); process.exitCode = 1; });
