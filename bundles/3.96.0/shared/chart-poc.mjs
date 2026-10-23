// Bezugszeitraum des sichtbaren Volumenprofils. Das Kerzenintervall allein ist kein Stunden-/Tages-POC.
import { intervalEnd } from './market-intervals.mjs';

export function pocWindow(candles, interval) {
  const first = candles?.[0];
  const last = candles?.at(-1);
  if (!Number.isFinite(first?.time) || !Number.isFinite(last?.time)) return null;
  let end;
  try {
    end = Number.isFinite(last.closeTime) && last.closeTime >= last.time
      ? last.closeTime + 1
      : intervalEnd(last.time, interval);
  } catch {
    return null;
  }
  if (!(end > first.time)) return null;
  const minutes = Math.round((end - first.time) / 60000);
  if (!(minutes > 0)) return null;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes % 1440 / 60);
  const rest = minutes % 60;
  const parts = [];
  if (days && days % 7 === 0 && !hours && !rest) {
    const weeks = days / 7;
    parts.push(`${weeks} ${weeks === 1 ? 'Woche' : 'Wochen'}`);
  } else if (days) {
    parts.push(`${days} ${days === 1 ? 'Tag' : 'Tage'}`);
  }
  if (hours) parts.push(`${hours} Std.`);
  if (rest) parts.push(`${rest} Min.`);
  return { start: first.time, end, minutes, label: parts.join(' ') };
}
