// Originale Entscheidung und spätere Preis-/Abrechnungsantworten, ausschließlich feste Testdaten.
import { liveFixture } from './confluence-live.mjs';
import { evaluateLive } from '../../shared/confluence-live.mjs';
import { captureObservation } from '../../shared/confluence-replay.mjs';
export const HOUR = 3600e3;
export function replayFixture() {
  const f = liveFixture(); f.data.funding.nextAt = f.data.scope.asOf + 8 * HOUR; f.data.funding.intervalHours = 8;
  f.data.base.rsiValues = Array(10).fill(50); // neutraler RSI: exakt 80 Punkte, echte Grenzberührung
  const live = evaluateLive(f), observation = captureObservation(live, f.config, f.options), at = observation.decisionAt;
  const rows = Array.from({ length: 48 }, (_, i) => ({ time: at + i * HOUR, end: at + (i + 1) * HOUR, knownAt: at + 49 * HOUR,
    open: 100, high: i === 1 ? 112 : 101, low: 99, close: i === 1 ? 110 : 100, volume: 100 }));
  const marks = rows.map(c => ({ ...c, open: 102, high: 103, low: 101, close: 102, volume: 0 }));
  const history = { from: at - 8 * HOUR, to: at + 49 * HOUR, complete: true,
    events: Array.from({ length: 7 }, (_, i) => ({ at: at + i * 8 * HOUR, rate: .001, kind: 'settled' })) };
  return { observation, card: live.eligible[0], rows, marks, history, asOf: at + 50 * HOUR };
}
