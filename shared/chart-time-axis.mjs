// 3.77.7: deutsche Anzeigezeit; Kerzenzeitstempel bleiben Börsenzeitstempel.
import { displayTimeParts } from './display-time.mjs';
// Konservative Textbreite für die bestehende 12px-Achsenschrift; kein DOM-Messen pro Frame.
export function chartTimeTicks(rows, { intervalMs, x, left, right, measure = text => text.length * 7.8 } = {}) {
  if (!rows.length || right <= left) return [];
  const day = time => displayTimeParts(time)?.day;
  const hourly = intervalMs >= 36e5, candidates = new Map();
  const add = (index, priority) => {
    if (!Number.isFinite(rows[index]?.time)) return;
    const old = candidates.get(index);
    if (old && old.priority <= priority) return;
    const date = displayTimeParts(rows[index].time), previous = index > 0 ? displayTimeParts(rows[index - 1].time) : null, dayChange = previous && date.day !== previous.day;
    // Doppelte Stunde bei der Rückstellung (25.10.: 02:00–02:59 gibt es als MESZ und als MEZ): jeder Tick in dieser Stunde bekommt die Zone,
    // nicht nur der erste nach der Umstellung – sonst liefe die Achse ohne Kennzeichnung rückwärts.
    const twin = displayTimeParts(rows[index].time + (date.zone === 'MEZ' ? -36e5 : 36e5)), repeatedHour = !!twin && twin.clock === date.clock && twin.day === date.day;
    const label = (hourly || dayChange ? date.day.slice(0, 6) + ' ' : '') + date.clock + (repeatedHour ? ' ' + date.zone : '');
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
