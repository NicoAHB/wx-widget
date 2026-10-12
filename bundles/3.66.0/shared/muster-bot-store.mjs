// Eigenes Demo-Buch: weder persönlicher Sicherungsexport noch Handelsdatenübertragung.
const database = () => new Promise((resolve, reject) => { const req = globalThis.indexedDB.open('scalpdesk-muster-paper', 1); req.onupgradeneeded = () => req.result.createObjectStore('runs'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(new Error('Muster-Demo-Speicher nicht erreichbar')); });
export async function readMusterPaper() {
  const db = await database(); try { return await new Promise((resolve, reject) => { const req = db.transaction('runs').objectStore('runs').get('current'); req.onsuccess = () => resolve(req.result || null); req.onerror = () => reject(new Error('Muster-Demo konnte nicht gelesen werden')); }); } finally { db.close(); }
}
export async function writeMusterPaper(value, expectedRevision = null) {
  const next = value ? { ...value, revision: (expectedRevision ?? value.revision ?? 0) + 1 } : null;
  const db = await database(); try { await new Promise((resolve, reject) => { const tx = db.transaction('runs', 'readwrite'), store = tx.objectStore('runs'), read = store.get('current');
    read.onsuccess = () => { if (expectedRevision != null && (read.result?.revision ?? 0) !== expectedRevision) { tx.abort(); return; } if (next) store.put(next, 'current'); else store.delete('current'); };
    tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(new Error('Muster-Demo nicht gespeichert oder in einem anderen Tab geändert; Lauf pausiert')); }); return next;
  } finally { db.close(); }
}
