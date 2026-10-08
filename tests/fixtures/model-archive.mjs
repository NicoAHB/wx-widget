// Ausschließlich Simulation: gleiche tatsächliche Fachmodule wie App/Dienst, keine Produktivdaten.
import { replayFixture } from './confluence-replay.mjs';
import { po3Settings, po3Score } from '../../shared/po3-core.mjs';
import { po3Signal } from '../../shared/po3-simulator.mjs';
import { BotSimulationRuntime } from '../../shared/bot-simulation.mjs';
export async function modelArchiveFixture() {
  const at = Date.UTC(2026, 9, 7, 12), config = po3Settings({ bias: '1m', setup: '1m', entry: '1m', closure: 'tp1' });
  const sweep = { extreme: 99, time: at - 60000, at }, box = { high: 104, low: 100, height: 4, from: at - 600000, to: at - 240000 };
  const zone = { id: 'g13-fixture-zone', timeframe: '1m', direction: 1, low: 101, high: 102, confirmedAt: at - 180000 };
  const signal = po3Signal({ instrument: 'BTCUSDT', levels: { status: 'bereit', direction: 1, entry: 100, sl: 99, tps: [102, 103, 104], risk: 1, rewardRisk: 2, tickSize: .1 }, confirmedAt: at, sweep, setupSweep: sweep, zone, box,
    score: po3Score({ direction: 1, sweep: true, retest: true, bias: 1, impulse: true }, config), source: { venue: 'bitget', product: 'USDT-FUTURES', dataRevision: 'bitget-v1', origin: 'rekonstruiert', observedAt: at, anchors: { '1m': at - 260 * 60000 } } }, config);
  const runtime = new BotSimulationRuntime({ now: () => at, persist: async () => true });
  try {
    await runtime.command({ commandId: 'g13-sim-enable', expectedRevision: 0, type: 'enable', parameters: { enabled: true } });
    const snapshot = { runId: 'g13-simulation-run', at, sequence: 0, currency: 'USDT', completeNet: true, source: 'Testsimulation', values: { realized: '0', open: '0', fees: '0', rebates: '0', funding: '0', estimatedCloseFees: '0' } };
    await runtime.command({ commandId: 'g13-sim-start', expectedRevision: 1, type: 'start', parameters: { mode: 'simulation', runId: snapshot.runId, referenceUSDT: '1000', gain: { enabled: true, amount: '10', action: 'entries' }, snapshot,
      settings: { strategy: 'confluence', coins: ['BTCUSDT'], direction: 'both', minimumScore: 70, leverage: 20, maxPositions: 1, cooldownMs: 60000, stopRule: 'signal', tpRule: 'tp1', exposureUSDT: '100', riskPercent: '1' } } });
    await runtime.command({ commandId: 'g13-sim-stop', expectedRevision: 2, type: 'snapshot', parameters: { snapshot: { ...snapshot, sequence: 1, values: { ...snapshot.values, realized: '10' } } } });
    return { app: 'scalpdesk-model-archive', version: 1, appVersion: '3.50.0', exportedAt: at, observations: [replayFixture().observation], po3Journal: [signal], bot: runtime.state };
  } finally { runtime.stop(); }
}
