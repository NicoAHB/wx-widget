import { calculateMarketPhase } from './market-phase-core.mjs';
import { scanPhaseCheck } from './market-phase-check.mjs';
globalThis.onmessage = async ({ data }) => {
  try { const value = data.type === 'calculate' ? calculateMarketPhase(data) : await scanPhaseCheck(data); globalThis.postMessage({ done: true, value }); }
  catch (e) { globalThis.postMessage({ error: e.message || 'Marktphasen-Berechnung fehlgeschlagen.' }); }
};
