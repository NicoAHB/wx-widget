// G11: unabhängiges versioniertes Journal, harte Grenzen, atomare Revision, kein stilles Abschneiden.
import { PO3_VERSION, po3Key } from './po3-core.mjs';
import { PO3_LIMITS } from './po3-stream.mjs';
export const PO3_DATABASE = 'scalpdesk-po3';
const bytes = x => new TextEncoder().encode(JSON.stringify(x)).length;
const copy = x => JSON.parse(JSON.stringify(x));
export function validatePo3Record(x) {
  if (!x?.id || x.strategy !== 'po3' || !x.modelVersion || !x.source?.dataRevision || !/^[A-Z0-9]{2,20}USDT$/.test(x.instrument || '') || ![1, -1].includes(x.direction)
    || !['Aktiv', 'Offen', 'Verfallen', 'Ungültig', 'Abgeschlossen'].includes(x.status) || !Number.isSafeInteger(x.plan?.confirmedAt) || !Array.isArray(x.plan?.levels?.tps) || x.plan.levels.tps.length !== 3
    || ![x.plan.levels.entry, x.plan.levels.sl, ...x.plan.levels.tps].every(v => Number.isFinite(v) && v > 0) || x.completeNet !== false || x.fundingComplete !== false) throw new Error('Ungültiger PO3-Journaldatensatz');
  if (x.modelVersion === PO3_VERSION && x.parametersKey !== po3Key(x.config)) throw new Error('PO3-Parameter widersprechen dem eingefrorenen Modell');
  return copy(x);
}
export function mergePo3Journal(old, incoming, { update = false } = {}) {
  const records = new Map(old.map(x => [x.id, validatePo3Record(x)]));
  for (const raw of incoming) { const x = validatePo3Record(raw), prev = records.get(x.id);
    if (prev && JSON.stringify(prev) !== JSON.stringify(x)) {
      if (!update || JSON.stringify([prev.plan, prev.source, prev.config, prev.zone, prev.sweep, prev.score]) !== JSON.stringify([x.plan, x.source, x.config, x.zone, x.sweep, x.score]) || (x.processedTo ?? 0) < (prev.processedTo ?? 0)) throw new Error('PO3-Importkonflikt: gleiche ID mit anderem Original/Verlauf');
    }
    records.set(x.id, x);
  }
  const result = [...records.values()]; if (result.length > PO3_LIMITS.journal || bytes(result) > PO3_LIMITS.journalBytes) throw new Error('PO3-Journal voll (2000 / 12 MiB); sichern und bewusst löschen'); return result;
}
export function exportPo3Csv(records) {
  const rows = records.map(validatePo3Record);
  return '\ufeffformat,version,datensatz\r\n' + rows.map(x => 'scalpdesk-po3,1,"' + JSON.stringify(x).replaceAll('"', '""') + '"').join('\r\n');
}
export function importPo3Csv(text, existing = []) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > PO3_LIMITS.journalBytes * 2) throw new Error('PO3-CSV überschreitet Importgrenze');
  const rows = [], row = []; let field = '', quoted = false;
  const input = text.replace(/^\ufeff/, '').replaceAll('\r\n', '\n');
  for (let i = 0; i <= input.length; i++) { const ch = input[i];
    if (ch === '"') { if (quoted && input[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && (ch === ',' || ch === '\n' || ch === undefined)) { row.push(field); field = ''; if (ch !== ',') { if (row.some(Boolean)) rows.push(row.slice()); row.length = 0; } }
    else if (ch !== undefined) field += ch;
  }
  if (quoted || JSON.stringify(rows.shift()) !== JSON.stringify(['format', 'version', 'datensatz'])) throw new Error('PO3-CSV-Kopf/Anführungszeichen ungültig');
  return mergePo3Journal(existing, rows.map(r => { if (r.length !== 3 || r[0] !== 'scalpdesk-po3' || r[1] !== '1') throw new Error('Unbekanntes PO3-CSV-Format'); return JSON.parse(r[2]); }));
}
async function database(fn) {
  const db = await new Promise((resolve, reject) => { const r = globalThis.indexedDB.open(PO3_DATABASE, 1); r.onupgradeneeded = () => r.result.createObjectStore('state'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  try { return await fn(db); } finally { db.close(); }
}
export async function readPo3State() {
  return database(db => new Promise((resolve, reject) => { const tx = db.transaction('state'), r = tx.objectStore('state').get('root'); r.onsuccess = () => resolve(r.result ?? { revision: 0, journal: [], streams: {} }); tx.onabort = tx.onerror = () => reject(tx.error); }));
}
export async function changePo3State(expectedRevision, change) {
  return database(db => new Promise((resolve, reject) => { const tx = db.transaction('state', 'readwrite'), st = tx.objectStore('state'), r = st.get('root'); let next, error;
    r.onsuccess = () => { try { const old = r.result ?? { revision: 0, journal: [], streams: {} }; if (old.revision !== expectedRevision) throw new Error('PO3-Journal wurde in einem anderen Tab geändert; erneut laden');
      next = change(copy(old)); next.journal = mergePo3Journal([], next.journal); if (Object.keys(next.streams).length > PO3_LIMITS.streams || bytes(next.streams) > PO3_LIMITS.streamBytes) throw new Error('PO3-Referenzcache voll (40 / 12 MiB); bewusst löschen'); next.revision = old.revision + 1; st.put(next, 'root'); } catch (e) { error = e; tx.abort(); } };
    tx.oncomplete = () => resolve(next); tx.onabort = tx.onerror = () => reject(error || tx.error);
  }));
}
