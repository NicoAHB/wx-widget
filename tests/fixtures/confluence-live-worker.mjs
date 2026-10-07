import { evaluateLive } from '../../shared/confluence-live.mjs';
import { liveFixture } from './confluence-live.mjs';
globalThis.postMessage(evaluateLive(liveFixture()));
