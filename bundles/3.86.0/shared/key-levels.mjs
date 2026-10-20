// Schlüssel-Levels (3.84.0): Vortag/Vorwoche, Eröffnungen von Tag, Woche und Monat, Hoch/Tief der Handelssitzungen.
// Reiner Rechenkern ohne Netz und Oberfläche: bekommt Tageskerzen und 15m-Kerzen und liefert die Marken. Es wird nie etwas geschätzt –
// fehlt eine Kerze im benötigten Zeitraum, entfällt die betroffene Marke ganz (kein halber Wert, keine Lücke überbrückt).
// Tage, Wochen und Monate folgen den Binance-Kerzen (UTC-Tage; Woche ab Montag 00:00 UTC). Sitzungen laufen nach der Ortszeit ihrer
// Börse (London und New York mit Sommerzeit), damit „08:00 London“ das ganze Jahr dieselbe Marktstunde bleibt.
const DAY = 864e5, Q = 9e5;
export const KEY_LEVELS = Object.freeze({ version: 1, dailyLimit: 45, intradayInterval: '15m', intradayLimit: 400, refreshMs: 60000, nearEach: 3, mergeTol: .0004, labelGap: 12 });
// „Nächste“ (Standard): je drei Marken über und unter dem Kurs – mehr zeigt der Chart nur auf Wunsch („Alle“)
export const KEY_LEVEL_SETS = Object.freeze([['near', 'Nächste'], ['all', 'Alle'], ['day', 'Tag'], ['higher', 'Woche/Monat'], ['sessions', 'Sitzungen']]);
export const DEFAULT_KEY_LEVEL_SET = 'near';
const SET_GROUPS = Object.freeze({ near: ['day', 'week', 'month', 'sessions'], all: ['day', 'week', 'month', 'sessions'], day: ['day'], higher: ['week', 'month'], sessions: ['sessions'] });
export const SESSIONS = Object.freeze([
  { id: 'asia', name: 'Asien', short: 'Asien', zone: 'UTC', start: [0, 0], end: [8, 0] },
  { id: 'london', name: 'London', short: 'London', zone: 'Europe/London', start: [8, 0], end: [16, 0] },
  { id: 'ny', name: 'New York', short: 'NY', zone: 'America/New_York', start: [9, 30], end: [16, 0] }
]);
const formatters = new Map();
function zonedParts(ms, zone) {
  let f = formatters.get(zone);
  if (!f) formatters.set(zone, f = new Intl.DateTimeFormat('en-CA', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const out = {}; for (const p of f.formatToParts(ms)) if (p.type !== 'literal') out[p.type] = Number(p.value);
  return out;
}
const offsetMs = (ms, zone) => { const p = zonedParts(ms, zone); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000; };
// Ortszeit einer Börse (Jahr, Monat, Tag, Stunde, Minute) → UTC-Millisekunden; zweimal nachgerechnet, damit die Sommerzeit-Grenze stimmt
export function zonedToUtc(year, month, day, hour, minute, zone) {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  if (zone === 'UTC') return naive;
  let t = naive - offsetMs(naive, zone); t = naive - offsetMs(t, zone); return t;
}
// Jüngste Sitzung, die schon begonnen hat (laufend oder zuletzt beendet)
export function latestSession(session, now) {
  const p = zonedParts(now, session.zone);
  for (let back = 0; back <= 2; back++) {
    const d = new Date(Date.UTC(p.year, p.month - 1, p.day - back)), y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
    const start = zonedToUtc(y, m, day, session.start[0], session.start[1], session.zone), end = zonedToUtc(y, m, day, session.end[0], session.end[1], session.zone);
    if (start <= now) return { start, end, live: now < end };
  }
  return null;
}
const finiteCandle = c => c && [c.time, c.open, c.high, c.low, c.close].every(Number.isFinite);
const level = (id, group, kind, label, name, price, from, live = false) => ({ id, group, kind, label, name, price, from, live });
export function keyLevels({ daily = [], intraday = [], now = Date.now() } = {}) {
  const out = [], byTime = new Map(daily.filter(finiteCandle).filter(c => c.time <= now).map(c => [c.time, c]));
  const todayStart = Math.floor(now / DAY) * DAY, today = byTime.get(todayStart);
  if (today) {
    const yesterday = byTime.get(todayStart - DAY);
    if (yesterday) out.push(level('pdh', 'day', 'high', 'Vortag H', 'Vortageshoch', yesterday.high, todayStart), level('pdl', 'day', 'low', 'Vortag T', 'Vortagestief', yesterday.low, todayStart));
    out.push(level('do', 'day', 'open', 'Tag-Open', 'Tageseröffnung', today.open, todayStart));
    const weekStart = todayStart - ((new Date(todayStart).getUTCDay() + 6) % 7) * DAY, weekOpen = byTime.get(weekStart);
    if (weekOpen) out.push(level('wo', 'week', 'open', 'Woche-Open', 'Wocheneröffnung', weekOpen.open, weekStart));
    const last = Array.from({ length: 7 }, (_, i) => byTime.get(weekStart - (i + 1) * DAY));
    if (last.every(Boolean)) out.push(level('pwh', 'week', 'high', 'Vorwoche H', 'Vorwochenhoch', Math.max(...last.map(c => c.high)), weekStart), level('pwl', 'week', 'low', 'Vorwoche T', 'Vorwochentief', Math.min(...last.map(c => c.low)), weekStart));
    const d = new Date(todayStart), monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1), monthOpen = byTime.get(monthStart);
    if (monthOpen) out.push(level('mo', 'month', 'open', 'Monat-Open', 'Monatseröffnung', monthOpen.open, monthStart));
  }
  const rows = intraday.filter(finiteCandle).sort((a, b) => a.time - b.time);
  for (const s of SESSIONS) {
    const w = latestSession(s, now); if (!w) continue;
    const upto = Math.min(w.end, now), part = rows.filter(c => c.time >= w.start && c.time < upto);
    // lückenlos ab dem Sitzungsbeginn bis zur laufenden Kerze, sonst keine Marke
    if (!part.length || part[0].time !== w.start || part.some((c, i) => i && c.time - part[i - 1].time !== Q)) continue;
    // beendete Sitzung vollständig; laufende darf die noch offene Kerze entbehren (der Zwischenspeicher hält nur geschlossene)
    const need = Math.ceil((upto - w.start) / Q); if (part.length < need - (w.live ? 1 : 0)) continue;
    const tag = w.live ? ' (läuft)' : '';
    out.push(level(`${s.id}h`, 'sessions', 'high', `${s.short} H`, `${s.name}-Hoch${tag}`, Math.max(...part.map(c => c.high)), w.start, w.live), level(`${s.id}l`, 'sessions', 'low', `${s.short} T`, `${s.name}-Tief${tag}`, Math.min(...part.map(c => c.low)), w.start, w.live));
  }
  return out;
}
export const keyLevelSet = (levels, set = 'all') => { const groups = SET_GROUPS[set] || SET_GROUPS.all; return levels.filter(l => groups.includes(l.group)); };
// Marken zwischen Einstieg und Ziel (ohne Ränder), vom Einstieg aus der Nähe nach geordnet – „Hindernisse auf dem Weg zum Ziel“
export function levelsInPath(levels, entry, target) {
  if (![entry, target].every(Number.isFinite) || entry === target) return [];
  const lo = Math.min(entry, target), hi = Math.max(entry, target);
  return levels.filter(l => l.price > lo && l.price < hi).sort((a, b) => Math.abs(a.price - entry) - Math.abs(b.price - entry));
}
// Nächste Marke über und unter dem Kurs (für die Rückmeldung beim Einschalten)
export function nearestLevels(levels, price) {
  const above = levels.filter(l => l.price > price).sort((a, b) => a.price - b.price)[0] || null, below = levels.filter(l => l.price < price).sort((a, b) => b.price - a.price)[0] || null;
  const pct = l => (l ? (l.price - price) / price * 100 : null);
  return { above, below, abovePct: pct(above), belowPct: pct(below) };
}
// Marken auf (fast) gleicher Höhe zu einer Linie mit gemeinsamer Beschriftung zusammenfassen („Tag-Open · London H“). Relative Toleranz 0,04 %.
export function groupLevels(levels, tol = KEY_LEVELS.mergeTol) {
  const sorted = levels.filter(l => Number.isFinite(l?.price) && l.price > 0).sort((a, b) => a.price - b.price), out = [];
  for (const l of sorted) {
    const g = out.at(-1);
    if (g && (l.price - g.price) / g.price <= tol) { g.ids.push(l.id); g.labels.push(l.label); g.names.push(l.name); g.from = Math.min(g.from, l.from); g.live = g.live || l.live; }
    else out.push({ ...l, ids: [l.id], labels: [l.label], names: [l.name] });
  }
  return out.map(g => ({ ...g, label: g.labels.length > 2 ? `${g.labels.slice(0, 2).join(' · ')} +${g.labels.length - 2}` : g.labels.join(' · '), name: g.names.join(' · ') }));
}
// Die nächsten `each` Marken über und unter dem Kurs (aufsteigend nach Preis)
export function nearLevels(levels, price, each = KEY_LEVELS.nearEach) {
  if (!Number.isFinite(price)) return levels.slice();
  const above = levels.filter(l => l.price > price).sort((a, b) => a.price - b.price).slice(0, each), below = levels.filter(l => l.price <= price).sort((a, b) => b.price - a.price).slice(0, each);
  return [...below.reverse(), ...above];
}
// Was der Chart zeichnet: Auswahl → zusammenfallende Marken verschmelzen → bei „Nächste“ je drei über und unter dem Kurs
export function shownLevels(levels, set = DEFAULT_KEY_LEVEL_SET, price = NaN, each = KEY_LEVELS.nearEach) {
  const merged = groupLevels(keyLevelSet(levels, set));
  return set === 'near' ? nearLevels(merged, price, each) : merged;
}
// Beschriftungen untereinander ordnen: Wunschhöhen `ys` (px, beliebige Reihenfolge) → Höhen mit mindestens `gap` Abstand, möglichst nah am Wunsch
// (überlappende Gruppen rücken als Block auf den Mittelwert ihrer Wünsche), innerhalb von [top, bottom]. Reihenfolge nach Höhe bleibt erhalten.
export function stackLabels(ys, { gap = KEY_LEVELS.labelGap, top = -Infinity, bottom = Infinity } = {}) {
  const order = ys.map((_, i) => i).sort((a, b) => ys[a] - ys[b]);
  const place = items => { let start = items.reduce((t, i, k) => t + ys[i] - k * gap, 0) / items.length; start = Math.min(start, bottom - (items.length - 1) * gap); return Math.max(start, top); };
  const clusters = order.map(i => ({ items: [i], start: place([i]) }));
  for (let i = 0; i < clusters.length - 1;) {
    const a = clusters[i], b = clusters[i + 1];
    if (b.start < a.start + a.items.length * gap - 1e-9) { const items = [...a.items, ...b.items]; clusters.splice(i, 2, { items, start: place(items) }); i = Math.max(0, i - 1); } else i++;
  }
  const out = new Array(ys.length);
  for (const c of clusters) c.items.forEach((idx, k) => { out[idx] = c.start + k * gap; });
  return out;
}
