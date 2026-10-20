// 3.72.0: derselbe reine Modellkern im Hintergrund; keine Netzwerk- oder Handelszugriffe.
import { compareWatchModels } from './watch-model-core.mjs';
globalThis.onmessage = async event => {
  const { id, input } = event.data || {};
  try {
    const result = await compareWatchModels({ ...input, yieldWork: () => new Promise(resolve => setTimeout(resolve, 0)), progress: fraction => globalThis.postMessage({ id, kind: 'progress', fraction }) });
    globalThis.postMessage({ id, kind: 'result', result });
  } catch (error) { globalThis.postMessage({ id, kind: 'error', error: error.message || 'Vergleich fehlgeschlagen.' }); }
};
