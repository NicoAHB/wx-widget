// 3.52.0: reine Auswahl für die gemeinsame Übersicht; Originale und Modellberechnungen bleiben unverändert.
export function confluenceOverview(saved, current, present) {
  const unique = new Map();
  for (const card of saved) if (!unique.has(card.id)) unique.set(card.id, { card, current: false });
  for (const card of current) if (!unique.has(card.id)) unique.set(card.id, { card, current: true });
  return [...unique.values()].map(item => {
    const state = present(item.card, item.current), archived = state.expired || state.label.startsWith('früheres Modell');
    return { ...item, state, model: 'confluence', instrument: item.card.scope.instrument, direction: item.card.scope.direction,
      horizon: item.card.scope.horizon, time: item.card.decisionAt, score: item.card.score.score,
      key: 'cf|' + item.card.id, category: archived ? 'archive' : item.card.eligible && ['positive', 'negative'].includes(state.tone) ? 'ready' : 'watch' };
  });
}
export function po3Overview(records, { currentKey, enabled }) {
  return records.map(card => {
    const archive = card.parametersKey !== currentKey || !['Aktiv', 'Offen'].includes(card.status);
    return { card, model: 'po3', instrument: card.instrument, direction: card.direction, horizon: null,
      time: card.plan.confirmedAt, score: card.score.score, key: 'po3|' + card.id,
      category: archive ? 'archive' : enabled && !card.dataGap && card.score.score >= 70 ? 'ready' : 'watch' };
  });
}
export function filterOverview(records, { model = 'all', instrument = '', direction = '', horizon = '', category = null } = {}) {
  return records.filter(x => (model === 'all' || x.model === model) && (!instrument || x.instrument === instrument)
    && (!direction || x.direction === Number(direction)) && (!horizon || x.horizon === horizon) && (!category || x.category === category))
    .sort((a, b) => b.time - a.time || (b.score ?? -1) - (a.score ?? -1) || a.key.localeCompare(b.key));
}
// Bestehende Knoten bei unverändertem Inhalt behalten; auch offene Details/Fokus bei geänderten Karten erhalten.
export function reconcileOverview(host, records, make, revision) {
  const existing = new Map([...host.children].map(n => [n.dataset.overviewKey, n])), keep = new Set(); let cursor = host.firstChild;
  for (const record of records) {
    const key = record.key, content = revision(record); let node = existing.get(key); keep.add(key);
    if (!node || node.dataset.overviewRevision !== content) {
      const old = node, opened = old ? [...old.querySelectorAll('details')].map(d => d.open) : [], focus = old?.contains(old.ownerDocument.activeElement) ? [...old.querySelectorAll('button,input,select,summary')].indexOf(old.ownerDocument.activeElement) : -1;
      node = make(record); node.dataset.overviewKey = key; node.dataset.overviewRevision = content;
      [...node.querySelectorAll('details')].forEach((d, i) => { d.open = opened[i] ?? false; });
      if (old) { if (old === cursor) cursor = node; old.replaceWith(node); }
      if (focus >= 0) node.querySelectorAll('button,input,select,summary')[focus]?.focus({ preventScroll: true });
    }
    if (node !== cursor) host.insertBefore(node, cursor); cursor = node.nextSibling;
  }
  for (const node of [...host.children]) if (!keep.has(node.dataset.overviewKey)) node.remove();
}
