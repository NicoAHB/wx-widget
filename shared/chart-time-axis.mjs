// NEU 3.77.2: Zeitbeschriftungen im bisherigen Chart-Zeitbezug UTC.
// Konservative Textbreite für die bestehende 12px-Achsenschrift; kein DOM-Messen pro Frame.
export function chartTimeTicks(rows, { intervalMs, x, left, right, measure = text => text.length * 7.8 } = {}) {
  if (!rows.length || right <= left) return [];
  const day = time => Math.floor(time / 864e5), pad = value => String(value).padStart(2, '0');
  const hourly = intervalMs >= 36e5, candidates = new Map();
  const add = (index, priority) => {
    if (!Number.isFinite(rows[index]?.time)) return;
    const old = candidates.get(index);
    if (old && old.priority <= priority) return;
    const date = new Date(rows[index].time), dayChange = index > 0 && day(rows[index].time) !== day(rows[index - 1].time);
    const label = (hourly || dayChange ? `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}. ` : '') + `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
    const width = measure(label);
    if (width > right - left) return;
    const position = Math.max(left + width / 2, Math.min(right - width / 2, x(index)));
    candidates.set(index, { index, x: position, label, width, priority });
  };
  // Tageswechsel haben auf kurzen Zeitrahmen Vorrang vor gewöhnlichen Uhrzeit-Ticks.
  if (!hourly) for (let i = 1; i < rows.length; i++) if (day(rows[i].time) !== day(rows[i - 1].time)) add(i, 0);
  add(0, 1); add(rows.length - 1, 1);
  const count = Math.max(2, Math.min(9, Math.floor((right - left) / 90) + 1));
  for (let j = 1; j < count - 1; j++) add(Math.round(j * (rows.length - 1) / (count - 1)), 2);
  const selected = [];
  for (const candidate of [...candidates.values()].sort((a, b) => a.priority - b.priority || a.index - b.index)) {
    if (selected.every(tick => Math.abs(tick.x - candidate.x) >= (tick.width + candidate.width) / 2 + 12)) selected.push(candidate);
  }
  return selected.sort((a, b) => a.index - b.index);
}
