// VWAP-Lage (3.87.0): beschreibt in Zahlen und kurzen deutschen Sätzen, wo der Kurs gerade zum VWAP und seinem Band steht –
// für jeden Anker (Tag, Woche, Monat, Sitzungen, Vortag/Woche/Vorwoche, Swing, Volumenspitze, eigener Anker).
// Reiner Rechenkern ohne Netz und Oberfläche. Die Zahlen gehen auch als Kontext an die optionale KI-Erklärung des eigenen 24/7-Dienstes
// (`/v1/vwap/explain`); die Regeln hier ändert die KI nie.
import { modeName, vwapSource } from './vwap.mjs';

export const VWAP_SITUATION = Object.freeze({
  model: 'vwap-1',
  recent: 24,       // so viele letzte Schlusskurse für „über/unter dem VWAP“ und Seitenwechsel
  slopeBars: 12,    // Steigung des VWAP über so viele Kerzen
  flatPct: 0.03,    // weniger Änderung gilt als „flach“ (in % des VWAP)
  atPct: 0.02,      // so nah am VWAP gilt der Kurs als „auf dem VWAP“ (in %)
  youngBars: 8,     // weniger Kerzen seit dem Anker: VWAP noch wenig aussagekräftig
  pendelCrosses: 4  // so viele Seitenwechsel: Kurs pendelt um den VWAP
});

const ZONES = ['above-band', 'upper', 'at', 'lower', 'below-band'];
const SLOPES = ['rising', 'flat', 'falling'];
export const VWAP_ZONES = ZONES;
export const VWAP_SLOPES = SLOPES;
export const VWAP_LEANS = Object.freeze({ buy: 'Eher kaufen', sell: 'Eher verkaufen', wait: 'Abwarten' });

// Was der gewählte Startpunkt bedeutet – ein Satz je Modus (steht in der Lage, damit man den Zahlen den Anker ansieht)
const MEANING = Object.freeze({
  day: 'Durchschnittspreis des laufenden Tages (ab 00:00 UTC).',
  week: 'Durchschnittspreis der laufenden Woche (ab Montag 00:00 UTC).',
  month: 'Durchschnittspreis des laufenden Monats (ab dem Ersten 00:00 UTC).',
  asia: 'Durchschnittspreis seit dem Asien-Open: der Einstand der Händler dieser Sitzung.',
  london: 'Durchschnittspreis seit dem London-Open: der Einstand der Händler dieser Sitzung.',
  ny: 'Durchschnittspreis seit dem NY-Open: der Einstand der Händler dieser Sitzung.',
  low: 'Durchschnittspreis seit dem letzten bestätigten Swing-Tief: wie sich der Kurs seit der Wende zum Schnitt der neuen Bewegung hält.',
  high: 'Durchschnittspreis seit dem letzten bestätigten Swing-Hoch: wie sich der Kurs seit der Wende zum Schnitt der neuen Bewegung hält.',
  pdl: 'Durchschnittspreis seit dem Tief von gestern.',
  pdh: 'Durchschnittspreis seit dem Hoch von gestern.',
  wl: 'Durchschnittspreis seit dem Wochen-Tief.',
  wh: 'Durchschnittspreis seit dem Wochen-Hoch.',
  pwl: 'Durchschnittspreis seit dem Tief der Vorwoche.',
  pwh: 'Durchschnittspreis seit dem Hoch der Vorwoche.',
  vol: 'Durchschnittspreis seit der Kerze mit dem größten Volumen der letzten 7 Tage.',
  anchor: 'Durchschnittspreis seit der Kerze, die du als Anker gesetzt hast.'
});
export const vwapMeaning = mode => MEANING[mode] || MEANING.day;

const finite = v => typeof v === 'number' && Number.isFinite(v);

// series: Ergebnis von vwapSeries; rows: die Kerzen, aus denen sie entstand (für die letzten Schlusskurse); price: aktueller Kurs;
// interval: Kerzenlänge der Reihe ('15m' …). Ohne Reihe oder Kurs gibt es keine Lage (null).
export function vwapSituation({ mode, series, rows = [], price, now = Date.now(), interval = '' } = {}) {
  const last = series?.last;
  if (!last || !finite(price) || !(price > 0) || ![last.vwap, last.upper, last.lower].every(finite) || !(last.vwap > 0)) return null;
  const { vwap, upper, lower } = last, sd = Math.max(0, upper - vwap);
  const dist = price - vwap, distPct = dist / vwap * 100, sigma = sd > 0 ? dist / sd : null;
  let zone = 'at';
  if (Math.abs(distPct) >= VWAP_SITUATION.atPct) {
    if (sigma === null) zone = dist > 0 ? 'upper' : 'lower';
    else zone = sigma > 1 ? 'above-band' : sigma > 0 ? 'upper' : sigma >= -1 ? 'lower' : 'below-band';
  }
  const points = series.points, bars = Math.min(VWAP_SITUATION.slopeBars, points.length - 1);
  let slope = null, slopePct = null;
  if (bars >= 2) {
    const ref = points[points.length - 1 - bars].vwap;
    slopePct = (vwap - ref) / ref * 100;
    slope = slopePct > VWAP_SITUATION.flatPct ? 'rising' : slopePct < -VWAP_SITUATION.flatPct ? 'falling' : 'flat';
  }
  // Schlusskurse der letzten Kerzen gegen den VWAP, der zu ihrer Zeit galt
  const close = new Map((Array.isArray(rows) ? rows : []).filter(c => c && finite(c.time) && finite(c.close)).map(c => [c.time, c.close]));
  const sides = points.slice(-VWAP_SITUATION.recent).map(p => (close.has(p.time) ? Math.sign(close.get(p.time) - p.vwap) : null)).filter(s => s !== null);
  let above = 0, below = 0, crosses = 0, prev = 0;
  for (const s of sides) {
    if (s > 0) above++; else if (s < 0) below++;
    if (s !== 0) { if (prev !== 0 && s !== prev) crosses++; prev = s; }
  }
  let streak = { side: 'none', count: 0 };
  for (let i = sides.length - 1; i >= 0; i--) {
    const side = sides[i] > 0 ? 'above' : sides[i] < 0 ? 'below' : 'none';
    if (side === 'none' || (streak.side !== 'none' && side !== streak.side)) break;
    streak = { side, count: streak.count + 1 };
  }
  return {
    mode, name: modeName(mode), interval: interval || vwapSource(mode)?.[0] || '', start: series.start, ageMs: Math.max(0, now - series.start),
    candles: points.length, young: points.length < VWAP_SITUATION.youngBars,
    price, vwap, upper, lower, distPct, sigma, zone, slope, slopePct, slopeBars: bars >= 2 ? bars : 0,
    recent: { n: sides.length, above, below, crosses, streak }
  };
}

const ageText = ms => {
  const min = Math.round(ms / 6e4);
  if (min < 90) return `${Math.max(1, min)} Min.`;
  const h = ms / 36e5;
  return h < 48 ? `${Math.round(h)} Std.` : `${Math.round(h / 24)} Tagen`;
};

// Kurze Sätze für den Info-Punkt. fmt: { price(v), date(ms), num(v, dec) } – Formatierung kommt von der Oberfläche.
export function vwapSituationLines(s, fmt) {
  if (!s) return [];
  const price = fmt?.price || String, num = fmt?.num || ((v, d = 2) => v.toFixed(d)), date = fmt?.date || String;
  const lines = [];
  lines.push(`VWAP ${s.name} ${price(s.vwap)}, Band ${price(s.lower)} – ${price(s.upper)}. Start ${date(s.start)} MEZ/MESZ (vor ${ageText(s.ageMs)}), ${s.candles} ${s.interval ? s.interval + '-' : ''}Kerzen seit dem Anker.`);
  const d = `${num(Math.abs(s.distPct), 2)} %`, z = s.sigma === null ? '' : ` (${num(Math.abs(s.sigma), 1)} σ)`;
  if (s.zone === 'at') lines.push(`Der Kurs liegt praktisch auf dem VWAP (Abstand ${d}).`);
  else {
    const up = s.distPct > 0, edge = s.zone === 'above-band' || s.zone === 'below-band';
    lines.push(`Der Kurs liegt ${d} ${up ? 'über' : 'unter'} dem VWAP${z}, ${edge ? `${up ? 'über dem oberen' : 'unter dem unteren'} Band – ungewöhnlich weit vom Durchschnitt entfernt` : `im ${up ? 'oberen' : 'unteren'} Teil des Bands`}: ${up ? 'Käufer' : 'Verkäufer'} sind seit dem Anker im Schnitt im Gewinn.`);
  }
  if (s.slope) lines.push(`Der VWAP ${s.slope === 'rising' ? 'steigt' : s.slope === 'falling' ? 'fällt' : 'verläuft flach'} (${s.slopePct > 0 ? '+' : s.slopePct < 0 ? '−' : ''}${num(Math.abs(s.slopePct), 2)} % in ${s.slopeBars} Kerzen).`);
  const r = s.recent;
  if (r.n >= 3) {
    const run = r.streak.count >= 2 ? `, zuletzt ${r.streak.count} in Folge ${r.streak.side === 'above' ? 'darüber' : 'darunter'}` : '';
    lines.push(`Von den letzten ${r.n} Schlusskursen lagen ${r.above} über und ${r.below} unter dem VWAP, ${r.crosses} Seitenwechsel${run}${r.crosses >= VWAP_SITUATION.pendelCrosses ? ' – der Kurs pendelt um den VWAP' : ''}.`);
  }
  if (s.young) lines.push(`Erst ${s.candles} ${s.candles === 1 ? 'Kerze' : 'Kerzen'} seit dem Anker – der VWAP ist noch wenig aussagekräftig.`);
  lines.push(vwapMeaning(s.mode));
  return lines;
}

const round = (v, d) => (finite(v) ? Number(v.toFixed(d)) : null);
// Kontext für die KI-Erklärung am eigenen Dienst: nur fertige Zahlen, keine Kerzen
export function vwapExplainContext(s, symbol) {
  if (!s) return null;
  return {
    model: VWAP_SITUATION.model, symbol, mode: s.mode, modeName: s.name, interval: s.interval,
    start: new Date(s.start).toISOString(), ageHours: round(s.ageMs / 36e5, 1), candles: s.candles,
    price: s.price, vwap: s.vwap, upper: s.upper, lower: s.lower,
    distPct: round(s.distPct, 3), sigma: round(s.sigma, 2), zone: s.zone, slope: s.slope, slopePct: round(s.slopePct, 3), slopeBars: s.slopeBars,
    recent: { n: s.recent.n, above: s.recent.above, below: s.recent.below, crosses: s.recent.crosses, streak: { ...s.recent.streak } }
  };
}

// Antwort des Dienstes prüfen: passt sie zum angefragten Modus und hat sie Text → { lean, text } sonst null
export function vwapExplainAnswer(answer, context) {
  if (!answer || answer.ok !== true || answer.mode !== context?.mode) return null;
  const text = typeof answer.text === 'string' ? answer.text.trim() : '';
  if (!text || text.length > 2000) return null;
  return { lean: Object.hasOwn(VWAP_LEANS, answer.lean) ? answer.lean : null, text };
}
