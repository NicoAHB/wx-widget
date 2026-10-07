// Tatsächlicher Import desselben öffentlichen Adapters im Browser-Worker.
import { bitgetParity } from './bitget.mjs';
self.postMessage(await bitgetParity());
