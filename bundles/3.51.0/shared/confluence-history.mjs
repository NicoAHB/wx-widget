// G10(d): begrenzte echte öffentliche Historienjobs, Originalmodell bleibt unverändert.
import { REPLAY_VERSION, observationKey, replayJob, cardHistoricalStats, backtestSummary } from './confluence-replay.mjs';
import { readReplay, saveReplay } from './confluence-replay-store.mjs';
const HOUR = 3600e3, DAY = 24 * HOUR;
const clone = x => JSON.parse(JSON.stringify(x));

export async function loadHistoryJob({ client, instrument, key, observations, asOf, saved = null, signal }) {
  signal?.throwIfAborted();
  const own = observations.filter(o => o.key === key && o.decisionAt <= asOf && o.decisionAt >= asOf - 730 * DAY);
  if (!own.length) return { complete: true, saved: null, reason: 'Keine protokollierten Originaleingaben; historische angekündigte Fundingrate/Intervall nicht verfügbar.' };
  const from = Math.ceil(Math.min(...own.map(o => o.decisionAt)) / HOUR) * HOUR, to = Math.floor(asOf / HOUR) * HOUR;
  const state = saved ? clone(saved) : { id: key, version: REPLAY_VERSION, instrument, asOf, from, to, stage: 'prices', cursor: from, rows: [], marks: [], events: [], pageNo: 1, fundingTo: null, cases: [], replayCursor: 0, conflicts: 0 };
  if (state.version !== REPLAY_VERSION || state.id !== key || state.instrument !== instrument || state.asOf !== asOf || state.from !== from || state.to !== to) throw new Error('Historienzustand gehört zu anderer Quelle/Auswertungsgrenze');
  if (to <= from) { state.stage = 'done'; return { complete: true, saved: state, waiting: true, reason: 'Nächster historischer Kerzenbeginn noch nicht geschlossen; Originalfälle bleiben unreif.' }; }
  if (state.stage === 'prices' || state.stage === 'marks') {
    const mark = state.stage === 'marks', result = await client[mark ? 'markRange' : 'range']({ symbol: instrument, timeframe: '1h', from: state.cursor, to, maxPages: 2, signal });
    state[mark ? 'marks' : 'rows'].push(...result.rows); state.cursor = result.nextFrom;
    if (result.complete) { state.stage = mark ? 'funding' : 'marks'; state.cursor = from; }
  } else if (state.stage === 'funding') {
    for (let i = 0; i < 2; i++) {
      const page = await client.fundingPage({ symbol: instrument, pageNo: state.pageNo++, pageSize: 100, signal });
      state.fundingTo ??= page.observedAt;
      const by = new Map(state.events.map(e => [e.at, e]));
      for (const e of page.events) { if (by.has(e.at) && by.get(e.at).rate !== e.rate) throw new Error('Fundinghistorie widerspricht früherer Seite'); by.set(e.at, e); }
      state.events = [...by.values()].sort((a, b) => a.at - b.at);
      if (!page.rawCount || state.events[0]?.at <= from) { state.history = { from: state.events[0]?.at ?? from, to: state.fundingTo, complete: state.events.length > 0 && state.events[0].at <= from, events: state.events }; state.stage = 'replay'; break; }
      if (state.pageNo > 200 || state.events.length > 20000) throw new Error('Fundingabdeckung überschreitet begrenzten Jobbestand; keine vollständigen Kosten behauptet');
    }
  }
  signal?.throwIfAborted();
  return { complete: state.stage === 'replay', saved: state, progress: { stage: state.stage, priceCandles: state.rows.length, markCandles: state.marks.length, fundingEvents: state.events.length } };
}

export async function runHistoricalBacktest({ client, card, signal, now = Date.now, progress = () => {} }) {
  signal?.throwIfAborted();
  const key = observationKey(card.scope, card.config, card.options), existing = await readReplay('jobs', key);
  // Eine Wiederaufnahme behält ihre Auswertungsgrenze; ein fertiger Lauf beginnt später bewusst neu.
  const asOf = existing && existing.stage !== 'done' ? existing.asOf : now();
  const observations = (await readReplay('observations', key, 'key')).filter(o => o.decisionAt <= asOf && o.decisionAt >= asOf - 730 * DAY);
  let saved = existing?.stage !== 'done' ? existing : null;
  if (!observations.length) {
    const value = { id: card.id, key, asOf, statistics: cardHistoricalStats(card, { observations, cases: [], asOf }), backtests: [60, 70, 80].map(t => backtestSummary([], t, asOf)), observations: 0 };
    signal?.throwIfAborted(); await saveReplay('results', value); return value;
  }
  while (saved?.stage !== 'replay') {
    const loaded = await loadHistoryJob({ client, instrument: card.scope.instrument, key, observations, asOf, saved, signal });
    saved = loaded.saved; progress(loaded.progress || { stage: loaded.reason });
    if (saved) await saveReplay('jobs', saved);
    if (loaded.waiting) break;
  }
  if (saved && !('history' in saved)) saved.history = { from: saved.from, to: saved.to, complete: false, events: [] };
  while (saved && saved.stage === 'replay') {
    signal?.throwIfAborted();
    const batch = replayJob({ observations, rows: saved.rows, marks: saved.marks, history: saved.history, asOf, observedAt: now(), cursor: saved.replayCursor });
    saved.cases.push(...batch.cases); saved.conflicts += batch.conflicts; saved.replayCursor = batch.nextCursor;
    if (batch.complete) saved.stage = 'done';
    await saveReplay('jobs', saved); progress({ stage: 'Auswertung', completed: batch.nextCursor, total: observations.length });
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  const cases = saved?.cases || [], sizing = { marginEUR: card.options.marginEUR, fx: card.options.fx?.value, leverage: card.options.leverage, entry: card.levels.entry };
  const value = { id: card.id, key, asOf, statistics: cardHistoricalStats(card, { cases, observations, asOf, sizing }),
    backtests: [60, 70, 80].map(t => backtestSummary(cases, t, asOf)), observations: observations.length, conflicts: saved?.conflicts || 0,
    prices: saved ? { from: saved.from, to: saved.to, candles: saved.rows.length } : null };
  signal?.throwIfAborted(); await saveReplay('results', value); return value;
}
