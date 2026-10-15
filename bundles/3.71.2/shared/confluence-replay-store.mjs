// G10(d): eigener Worker-Speicher, keine großen Historienzustände im App-Startabgleich.
import { mergeObservations, OBSERVATION_LIMIT, OBSERVATION_BYTES } from './confluence-replay.mjs';
export const REPLAY_DATABASE = 'scalpdesk-ki-history';
const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
export async function replayDatabase(fn) {
  const db = await new Promise((resolve, reject) => {
    const r = globalThis.indexedDB.open(REPLAY_DATABASE, 1);
    r.onupgradeneeded = () => { const d = r.result; const obs = d.createObjectStore('observations', { keyPath: 'id' }); obs.createIndex('key', 'key');
      d.createObjectStore('jobs', { keyPath: 'id' }); d.createObjectStore('results', { keyPath: 'id' }); d.createObjectStore('meta'); };
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  try { return await fn(db); } finally { db.close(); }
}
export async function saveObservation(observation) {
  if (!observation) return null;
  mergeObservations([], [observation]);
  return replayDatabase(db => new Promise((resolve, reject) => {
    const tx = db.transaction(['observations', 'meta'], 'readwrite'), obs = tx.objectStore('observations'), meta = tx.objectStore('meta');
    let old, usage, answer, error, gotOld = false, gotUsage = false;
    const apply = () => { if (!gotOld || !gotUsage) return; try {
      const merged = mergeObservations(old ? [old] : [], [observation])[0];
      const next = { n: (usage?.n || 0) + (old ? 0 : 1), bytes: (usage?.bytes || 0) - (old ? bytes(old) : 0) + bytes(merged) };
      if (next.n > OBSERVATION_LIMIT || next.bytes > OBSERVATION_BYTES) throw new Error('Originalarchiv voll; neue Beobachtungen pausieren, Bestand bleibt erhalten');
      if (!old || merged.decisionAt < old.decisionAt) { obs.put(merged); meta.put(next, 'usage'); }
      answer = next;
    } catch (e) { error = e; tx.abort(); } };
    const a = obs.get(observation.id), b = meta.get('usage'); a.onsuccess = () => { old = a.result; gotOld = true; apply(); }; b.onsuccess = () => { usage = b.result; gotUsage = true; apply(); };
    tx.oncomplete = () => resolve(answer); tx.onabort = tx.onerror = () => reject(error || tx.error);
  }));
}
export async function readReplay(store, key, index = null) {
  return replayDatabase(db => new Promise((resolve, reject) => { const tx = db.transaction(store), s = tx.objectStore(store), r = index ? s.index(index).getAll(key) : key === undefined ? s.getAll() : s.get(key);
    r.onsuccess = () => resolve(r.result); tx.onerror = tx.onabort = () => reject(tx.error); }));
}
export async function saveReplay(store, value) {
  const limit = store === 'jobs' ? 20 * 1024 * 1024 : 2 * 1024 * 1024;
  if (bytes(value) > limit) throw new Error('Öffentlicher Backtest-Zwischenstand überschreitet Speichergrenze');
  return replayDatabase(db => new Promise((resolve, reject) => { const tx = db.transaction(store, 'readwrite'), s = tx.objectStore(store), r = s.getAll();
    r.onsuccess = () => { const existing = r.result.filter(x => x.id !== value.id); if (existing.length >= (store === 'jobs' ? 4 : 200) || existing.reduce((n, x) => n + bytes(x), bytes(value)) > limit) { tx.abort(); return; } s.put(value); };
    tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error || new Error('Backtestspeicher voll; öffentliche Zwischenstände bewusst löschen')); }));
}
export async function clearReplayJobs() {
  return replayDatabase(db => new Promise((resolve, reject) => { const tx = db.transaction('jobs', 'readwrite'); tx.objectStore('jobs').clear(); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }));
}
