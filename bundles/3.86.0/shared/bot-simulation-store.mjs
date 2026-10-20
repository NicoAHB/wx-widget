// G12: eigener begrenzter Simulationsspeicher, Revision tabübergreifend atomar.
export const BOT_SIMULATION_DATABASE = 'scalpdesk-bot-simulation';
async function database(fn) { const db = await new Promise((resolve, reject) => { const r = globalThis.indexedDB.open(BOT_SIMULATION_DATABASE, 1); r.onupgradeneeded = () => r.result.createObjectStore('state'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); try { return await fn(db); } finally { db.close(); } }
export async function readBotSimulation() { return database(db => new Promise((resolve, reject) => { const tx = db.transaction('state'), r = tx.objectStore('state').get('root'); r.onsuccess = () => resolve(r.result ?? null); tx.onabort = tx.onerror = () => reject(tx.error); })); }
export async function saveBotSimulation(next) {
  if (new TextEncoder().encode(JSON.stringify(next)).length > 5 * 1024 * 1024) return false;
  return database(db => new Promise(resolve => { const tx = db.transaction('state', 'readwrite'), st = tx.objectStore('state'), r = st.get('root');
    r.onsuccess = () => { if ((r.result?.revision ?? 0) !== next.revision - 1) { tx.abort(); return; } st.put(next, 'root'); }; tx.oncomplete = () => resolve(true); tx.onabort = tx.onerror = () => resolve(false); }));
}
