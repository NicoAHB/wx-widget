// 3.79.2: reine Anzeige-Zusammenfassung; keine neue Signalregel oder Datenabfrage.
export function analysisOverview(card) {
  const detail = card.detail, stage = detail?.stage || 0;
  const model = { stage, tone: 'neutral', badge: 'Nicht bereit', reason: card.reason || card.text || 'Kerzendaten werden geladen.', steps: [], levels: [] };
  if (!detail) return model;
  if (card.inactive) return { ...model, stage: 0, badge: 'Heute inaktiv' };
  const ny = card.id === 'ny-open', pullback=card.id==='trend-pullback';
  model.steps = detail.steps.map((step, i) => ({
    label: ny ? ['5m Range', '1m Ausbruch', 'FVG / Einstieg'][i] : pullback?['4h Trend','1h Rücksetzer','15m Bestätigung'][i]:['4h Richtung', '1h Setup', '15m Einstieg'][i],
    state: ny ? (stage > i ? 'Bestätigt' : 'Wartet') : step.state,
    done: stage > i,
    current: i === Math.min(stage, 2)
  }));
  model.levels = detail.levels || [];
  if(pullback){model.badge=stage>=3?'Signal':card.phase==='watch'?'Beobachten':card.phase==='risk'?'CRV / Stop gesperrt':card.phase==='cooldown'?'Sperrzeit':detail.direction?'Trend aktiv':'Kein Trend';model.tone=stage>=3?(detail.direction===1?'long':'short'):'neutral';model.reason=card.reason||card.text;}
  else if (ny) {
    const confirmed = stage >= 3, entry = detail.steps[1], exit = detail.steps[2];
    model.badge = confirmed ? (exit.state === 'Offen' ? `${entry.tone === 'short' ? 'Short' : 'Long'} · offen` : exit.state) : stage === 2 ? (card.phase === 'risk' ? 'Einstieg gesperrt' : 'FVG noch offen') : stage >= 1 ? 'Range steht' : 'Wartet';
    model.tone = confirmed ? (exit.state === 'Offen' ? entry.tone : exit.tone) : 'neutral';
    model.reason = confirmed ? `${entry.text} · ${exit.text}` : card.reason || entry.text;
  } else {
    const side = detail.direction === 1 ? 'Long' : 'Short', pending = detail.steps[Math.min(stage, 2)];
    model.badge = stage >= 3 ? `${side} bestätigt` : detail.direction ? `${side}-Bias` : 'Neutral';
    model.tone = detail.direction === 1 ? 'long' : detail.direction === -1 ? 'short' : 'neutral';
    model.reason = pending.text;
  }
  return model;
}
