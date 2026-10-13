// Oracle-Musterdienst 1.2.0: monatliche Bereinigung gesendeter Chartmuster-Nachrichten auf dem Oracle-Cloud-Server.
// Stichtag: Beginn des laufenden Monats in Europe/Berlin (00:00 Uhr am 1.), auch bei verspäteter Ausführung – ausgewählt werden
// genau die Nachrichten, deren Versand VOR dem Stichtag von Telegram bestätigt wurde (st = confirmed, sentAt < Stichtag).
// Gelöscht: Nachrichtentext, Kopie der Signaldaten (c, data) und Versandmetadaten des Eintrags, das Kartenbild (PNG),
// Anti-Spam-Merkeinträge vor dem Stichtag, nachrichtenbezogene Protokollzeilen vor dem Stichtag und eine liegengebliebene
// Zwischendatei des Zustands. Nie gelöscht: wartende/sendende/unbestätigte/abgelehnte/abgelaufene Nachrichten, alles nach dem
// Stichtag, Zugangsdaten (.env), Coin-Auswahl, Lernbestand (cases) und Signal-Journal (signals). Telegram selbst bleibt unberührt.
// Ablauf mit Wiederaufnahme: Löschliste (nur Dateinamen) dauerhaft schreiben → Zustand atomar ohne die Einträge schreiben →
// Dateien löschen → Protokoll bereinigen → Löschliste entfernen. Bricht etwas ab, setzt der nächste Lauf an der Löschliste an.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const LEGACY_MARGIN = 7 * 864e5;   // Einträge von vor 1.2.0 ohne sentAt: nur wenn sicher (Erkennung + 7 Tage) vor dem Stichtag
export const CARD_FILE = /^[a-f0-9]{32}\.png$/;
// Nachrichtenbezogene Protokollzeilen (mit Zeitstempel ab 1.2.0); Zeilen ohne Zeitstempel bleiben, weil ihr Monat unbekannt ist
export const MSG_LOG = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z) (?:Chartmuster zugestellt|Chartmuster gesendet|Kartenversand|Karte nicht erzeugt|Telegram lehnt das Bild ab|Zustellung unbestätigt)/;

// ---- Stichtag: 1. des Monats, 00:00 Uhr in der Zeitzone (Sommer-/Winterzeit über Intl) ----
function parts(t, tz) {
  const o = {}; for (const p of new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(t))) o[p.type] = Number(p.value);
  return o;
}
function zoned(y, m, d, tz) {
  const want = Date.UTC(y, m - 1, d); let t = want;
  for (let i = 0; i < 3; i++) { const p = parts(t, tz), seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second); t += want - seen; }
  return t;
}
export function monthStart(ref = Date.now(), tz = 'Europe/Berlin') {
  let y, m;
  if (typeof ref === 'string') { const x = /^(\d{4})-(\d{2})$/.exec(ref); if (!x || +x[2] < 1 || +x[2] > 12) throw new Error('Stichtag als JJJJ-MM angeben, z. B. 2026-11'); y = +x[1]; m = +x[2]; }
  else { const p = parts(ref, tz); y = p.year; m = p.month; }
  return { at: zoned(y, m, 1, tz), label: `01.${String(m).padStart(2, '0')}.${y}, 00:00 Uhr (${tz})`, month: `${y}-${String(m).padStart(2, '0')}` };
}

const bytes = v => v === undefined ? 0 : Buffer.byteLength(typeof v === 'string' ? v : JSON.stringify(v));
const alive = pid => { if (!Number.isInteger(pid) || pid <= 0) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
function atomicJson(file, value) {
  const tmp = file + '.tmp', fd = fs.openSync(tmp, 'w', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file); const dir = fs.openSync(path.dirname(file), 'r'); try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
}
const statSize = f => { try { return fs.statSync(f).size; } catch { return 0; } };
// Protokoll samt rotierter Kopien (logrotate: service.log.1, service.log.2.gz, …)
export function logFiles(logFile) {
  if (!logFile) return [];
  const dir = path.dirname(logFile), name = path.basename(logFile), rx = new RegExp('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.\\d+(\\.gz)?$');
  let rotated = []; try { rotated = fs.readdirSync(dir).filter(f => rx.test(f)).sort().map(f => path.join(dir, f)); } catch { /* Ordner fehlt */ }
  return [...(fs.existsSync(logFile) ? [logFile] : []), ...rotated];
}
const readLog = f => { const b = fs.readFileSync(f); return (f.endsWith('.gz') ? zlib.gunzipSync(b) : b).toString('utf8'); };

// Auswahl ohne Änderung (auch für den Probelauf)
export function selectPurge(state, cutoff, { cardDir, logFile } = {}) {
  const events = state?.events && typeof state.events === 'object' ? state.events : {};
  const del = [], keep = { queued: 0, sending: 0, unconfirmed: 0, failed: 0, expired: 0, current: 0, other: 0 };
  const size = { text: 0, data: 0, meta: 0 }, images = new Set();
  for (const [id, e] of Object.entries(events)) {
    if (e?.st === 'confirmed') {
      const due = Number.isFinite(e.sentAt) ? e.sentAt < cutoff : Number.isFinite(e.c?.at) && e.c.at + LEGACY_MARGIN < cutoff;
      if (!due) { keep.current++; continue; }
      del.push(id); size.text += bytes(e.text); size.data += bytes(e.c) + bytes(e.data);
      const { text, c, data, ...meta } = e; size.meta += bytes(meta);
      if (typeof e.img === 'string' && CARD_FILE.test(e.img)) images.add(e.img);
    } else keep[Object.hasOwn(keep, e?.st) ? e.st : 'other']++;
  }
  // verwaiste Kartenbilder: von keinem verbleibenden Eintrag benutzt und vor dem Stichtag geschrieben
  const used = new Set(Object.entries(events).filter(([id]) => !del.includes(id)).map(([, e]) => e?.img).filter(Boolean)), orphans = [];
  if (cardDir && fs.existsSync(cardDir)) for (const f of fs.readdirSync(cardDir)) {
    if (!CARD_FILE.test(f) || images.has(f) || used.has(f)) continue;
    try { if (fs.statSync(path.join(cardDir, f)).mtimeMs < cutoff) orphans.push(f); } catch { /* inzwischen weg */ }
  }
  const imgBytes = [...images].reduce((s, f) => s + (cardDir ? statSize(path.join(cardDir, f)) : 0), 0), orphanBytes = orphans.reduce((s, f) => s + statSize(path.join(cardDir, f)), 0);
  const sent = Array.isArray(state?.sent) ? state.sent.filter(x => !(x?.at >= cutoff)).length : 0;
  let logLines = 0, logBytes = 0, logError = null;
  for (const f of logFiles(logFile)) {
    try { for (const line of readLog(f).split('\n')) { const m = MSG_LOG.exec(line); if (m && Date.parse(m[1]) < cutoff) { logLines++; logBytes += Buffer.byteLength(line) + 1; } } }
    catch (e) { logError = e.code || 'unlesbar'; }   // z. B. fehlende Leserechte: übrige Bereinigung läuft trotzdem
  }
  return { ids: del, images: [...images], orphans, keep, report: { messages: del.length, textBytes: size.text, dataBytes: size.data, metaBytes: size.meta, images: images.size, imageBytes: imgBytes, orphans: orphans.length, orphanBytes, sentMeta: sent, logLines, logBytes, logError } };
}

function filterOne(file, cutoff) {
  const gz = file.endsWith('.gz'), lines = readLog(file).split('\n'); let removed = 0;
  const kept = lines.filter(line => { const m = MSG_LOG.exec(line); if (m && Date.parse(m[1]) < cutoff) { removed++; return false; } return true; });
  if (!removed) return 0;
  const tmp = file + '.bereinigung', mode = fs.statSync(file).mode & 0o777, fd = fs.openSync(tmp, 'w', mode), body = Buffer.from(kept.join('\n'));
  try { fs.writeFileSync(fd, gz ? zlib.gzipSync(body) : body); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
  return removed;
}
function filterLog(logFile, cutoff) {
  let removed = 0, error = null;
  for (const f of logFiles(logFile)) { try { removed += filterOne(f, cutoff); } catch (e) { error = error || e; } }
  if (error) throw Object.assign(error, { removed });
  return removed;
}

export async function purgeSentMessages({ stateFile, cardDir = path.join(path.dirname(stateFile), 'karten'), logFile = null, cutoff, dryRun = false, now = Date.now, unlink = f => fs.unlinkSync(f), log = () => {} } = {}) {
  if (!Number.isFinite(cutoff)) throw new Error('Stichtag fehlt');
  const dir = path.dirname(stateFile), lockFile = path.join(dir, 'bereinigung.lock'), pidFile = path.join(dir, 'dienst.pid'), manifestFile = path.join(dir, 'bereinigung-offen.json');
  if (!fs.existsSync(stateFile)) throw new Error('Dienstzustand nicht gefunden');
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (state?.v !== 1 || !state.events || typeof state.events !== 'object' || Array.isArray(state.events)) throw new Error('Dienstzustand beschädigt; nichts gelöscht');
  const pending = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : null;
  const sel = selectPurge(state, cutoff, { cardDir, logFile });
  const result = { dryRun, cutoff, ...sel.report, keep: sel.keep, resumed: pending ? { files: (pending.files || []).length, log: !!pending.log } : null, failed: [], staleTmp: fs.existsSync(stateFile + '.tmp') };
  if (dryRun) return result;

  // ---- exklusiv: nie zwei Läufe gleichzeitig, nie neben dem laufenden Dienst (der würde den Zustand überschreiben) ----
  let lock;
  for (let i = 0; i < 2 && lock === undefined; i++) {
    try { lock = fs.openSync(lockFile, 'wx', 0o600); fs.writeSync(lock, String(process.pid)); }
    catch (e) { if (e.code !== 'EEXIST') throw e; const pid = Number(fs.readFileSync(lockFile, 'utf8')); if (alive(pid)) throw new Error('Bereinigung läuft bereits'); fs.rmSync(lockFile, { force: true }); }
  }
  if (lock === undefined) throw new Error('Sperre für die Bereinigung nicht erhältlich');
  try {
    if (fs.existsSync(pidFile) && alive(Number(fs.readFileSync(pidFile, 'utf8')))) throw new Error('Chartmusterdienst läuft – erst stoppen (der Timer erledigt das selbst); nichts gelöscht');
    const failed = [];
    const removeFiles = list => { for (const f of list) { if (!CARD_FILE.test(f)) continue; try { unlink(path.join(cardDir, f)); } catch (e) { if (e.code !== 'ENOENT') failed.push(f); } } };
    // 1. unterbrochenen Lauf zu Ende bringen
    if (pending) { removeFiles(pending.files || []); if (pending.log) try { filterLog(logFile, pending.cutoff); } catch { /* unten erneut */ } }
    // 2. Löschliste (nur Dateinamen, keine Inhalte) dauerhaft vor jeder Änderung
    const files = [...new Set([...sel.images, ...sel.orphans, ...failed])];
    atomicJson(manifestFile, { v: 1, cutoff, at: now(), files, log: !!logFile });
    // 3. Zustand in einem Schritt (atomar) ohne die ausgewählten Einträge
    if (sel.ids.length || sel.report.sentMeta) {
      const fresh = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      for (const id of sel.ids) delete fresh.events[id];
      if (Array.isArray(fresh.sent)) fresh.sent = fresh.sent.filter(x => x?.at >= cutoff);
      fresh.lastPurge = { at: now(), cutoff, messages: sel.ids.length, images: files.length };
      atomicJson(stateFile, fresh);
    }
    if (result.staleTmp) fs.rmSync(stateFile + '.tmp', { force: true });
    // 4. Dateien und Protokoll
    failed.length = 0; removeFiles(files);
    let logRemoved = 0; try { logRemoved = filterLog(logFile, cutoff); } catch (e) { logRemoved = e.removed || 0; result.logError = e.code || 'nicht schreibbar'; }
    result.logLines = logRemoved; result.failed = failed;
    // 5. fertig: Löschliste weg; sonst bleiben nur die fehlgeschlagenen Dateien darin
    if (failed.length) atomicJson(manifestFile, { v: 1, cutoff, at: now(), files: failed, log: false });
    else fs.rmSync(manifestFile, { force: true });
    log(`Bereinigung ${failed.length ? 'teilweise' : 'abgeschlossen'}: ${sel.ids.length} Nachrichten, ${files.length - failed.length} Kartenbilder, ${logRemoved} Protokollzeilen`);
    return result;
  } finally { fs.closeSync(lock); fs.rmSync(lockFile, { force: true }); }
}

// Kurzbericht ohne Nachrichteninhalte
export function purgeReport(r, label) {
  const kb = n => n < 1024 ? `${n} Byte` : n < 1048576 ? `${(n / 1024).toFixed(1).replace('.', ',')} KB` : `${(n / 1048576).toFixed(1).replace('.', ',')} MB`, k = r.keep;
  const pl = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  return [
    `${r.dryRun ? 'Probelauf – nichts gelöscht.' : r.failed.length ? 'Bereinigung teilweise – Rest beim nächsten Lauf.' : 'Bereinigung abgeschlossen.'} Stichtag: ${label} = ${new Date(r.cutoff).toISOString()}`,
    `${r.dryRun ? 'Vorgesehen' : 'Gelöscht'}: ${pl(r.messages, 'gesendete Nachricht', 'gesendete Nachrichten')} (Text ${kb(r.textBytes)}, Signaldaten ${kb(r.dataBytes)}, Versanddaten ${kb(r.metaBytes)}), ${pl(r.images, 'Kartenbild', 'Kartenbilder')} (${kb(r.imageBytes)}), ${pl(r.orphans, 'verwaistes Kartenbild', 'verwaiste Kartenbilder')} (${kb(r.orphanBytes)}), ${pl(r.sentMeta, 'Anti-Spam-Eintrag', 'Anti-Spam-Einträge')}, ${pl(r.logLines, 'Protokollzeile', 'Protokollzeilen')}${r.dryRun ? ` (${kb(r.logBytes)})` : ''}${r.staleTmp ? ', 1 alte Zwischendatei' : ''}`,
    `Bleibt: ${k.queued} wartend/Wiederholung, ${k.sending} gerade im Versand, ${k.unconfirmed} unbestätigt, ${k.failed} abgelehnt, ${k.expired} abgelaufen, ${k.current} aus dem laufenden Monat${k.other ? `, ${k.other} sonstige` : ''}; Lernbestand und Signal-Journal unverändert`,
    ...(r.logError ? [`Protokoll übersprungen (${r.logError}) – Rechte von service.log prüfen`] : []),
    ...(r.resumed ? [`Fortgesetzt: unterbrochener Lauf mit ${r.resumed.files} Dateien`] : []),
    ...(r.failed.length ? [`Nicht löschbar (bleibt in der Löschliste): ${r.failed.length} Dateien`] : []),
  ];
}
