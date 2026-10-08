// G13: Originale separat sichern. Kein privater Zugang, keine automatische Reaktivierung.
import { mergeObservations } from './confluence-replay.mjs';
import { readReplay, replayDatabase } from './confluence-replay-store.mjs';
import { readPo3State, changePo3State, mergePo3Journal } from './po3-store.mjs';
import { readBotSimulation, saveBotSimulation } from './bot-simulation-store.mjs';
import { BotSimulationRuntime } from './bot-simulation.mjs';
const clone = x => JSON.parse(JSON.stringify(x));
const size = x => new TextEncoder().encode(JSON.stringify(x)).length;
export const MODEL_ARCHIVE_VERSION = 1;
export function validateModelArchive(input) {
  if (input?.kind === 'scalpdesk-bot-simulation' && input.version === 1 && input.simulationOnly === true) input = { app: 'scalpdesk-model-archive', version: 1, exportedAt: Date.now(), observations: [], po3Journal: [], bot: input.state };
  if (!input || input.app !== 'scalpdesk-model-archive' || input.version !== MODEL_ARCHIVE_VERSION || !Number.isSafeInteger(input.exportedAt) || size(input) > 32 * 1024 * 1024) throw new Error('KI-/Bot-Archivformat oder Größe ungültig');
  if (/"(?:apiKey|secret|passphrase|token|webhook|authorization)"\s*:/i.test(JSON.stringify(input))) throw new Error('Archiv darf keine Zugangsdaten enthalten');
  const observations = mergeObservations([], input.observations), journal = mergePo3Journal([], input.po3Journal);
  let bot = null;
  if (input.bot !== null) { const rt = new BotSimulationRuntime({ saved: input.bot }); try { bot = clone(rt.state); bot.enabled = false; } finally { rt.stop(); } }
  return { observations, journal, bot };
}
export async function exportModelArchive(appVersion) {
  const [observations, po3, bot] = await Promise.all([readReplay('observations'), readPo3State(), readBotSimulation()]);
  const archive = { app: 'scalpdesk-model-archive', version: MODEL_ARCHIVE_VERSION, appVersion, exportedAt: Date.now(), observations, po3Journal: po3.journal, bot,
    coverage: 'Lokale Konfluenz-Originalbeobachtungen, PO3-Journal und Bot-Laufsimulation. Persönliche Daten separat; Oracle-Dateien am Server. Abgeleitete Karten/Quoten/Preis-/Referenzcaches werden neu geladen.' };
  validateModelArchive(archive); return archive;
}
// Alle Konfluenzoriginale gemeinsam prüfen/speichern; kein stilles Löschen, Idempotenz bleibt erhalten.
async function mergeOriginals(incoming) {
  return replayDatabase(db => new Promise((resolve, reject) => { const tx = db.transaction(['observations', 'meta'], 'readwrite'), st = tx.objectStore('observations'), r = st.getAll(); let error;
    r.onsuccess = () => { try { const all = mergeObservations(r.result, incoming); for (const row of all) st.put(row); tx.objectStore('meta').put({ n: all.length, bytes: all.reduce((n, row) => n + size(row), 0) }, 'usage'); } catch (e) { error = e; tx.abort(); } };
    tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(error || tx.error); }));
}
export async function importModelArchive(input, { includeBot = false } = {}) {
  const next = validateModelArchive(input), [oldPo3, oldObs, oldBot] = await Promise.all([readPo3State(), readReplay('observations'), readBotSimulation()]);
  // Vor irgendeiner Änderung alle bekannten Konflikte prüfen. Kein Datenbank-übergreifendes Atomaritätsversprechen.
  mergeObservations(oldObs, next.observations); mergePo3Journal(oldPo3.journal, next.journal);
  if (includeBot && next.bot && oldBot) throw new Error('Bot-Wiederherstellung nur in leerem Browserprofil; bestehenden Lauf zuerst sichern');
  const done = [];
  try {
    await mergeOriginals(next.observations); done.push('Konfluenz-Originale');
    await changePo3State(oldPo3.revision, root => ({ ...root, journal: mergePo3Journal(root.journal, next.journal) })); done.push('PO3-Journal');
    if (includeBot && next.bot) { const bot = { ...next.bot, revision: 1, enabled: false }; if (!await saveBotSimulation(bot)) throw new Error('Bot-Ziel inzwischen geändert oder Speicherung fehlgeschlagen'); done.push('Bot-Simulation deaktiviert'); }
    return { done, botIncluded: includeBot && !!next.bot };
  } catch (e) { throw new Error(`${e.message}. Bereits bestätigt: ${done.join(', ') || 'nichts'}. Originaldatei behalten; Originalimporte können wiederholt werden.`); }
}
