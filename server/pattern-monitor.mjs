// 2.4.0 (G09 C6b): Marktvertrag, frische bestätigte Formationen und deutscher Meldungstext.
import { patEngine, PAT_NAMES } from './pattern-engine.mjs';
export const PAT_STEPS = { '1m': 60e3, '3m': 18e4, '5m': 3e5, '15m': 9e5, '30m': 18e5, '1h': 36e5, '2h': 72e5, '4h': 144e5, '1d': 864e5, '1w': 6048e5, '1M': 0 };
export const patternId = c => [c.mkt, c.sym, c.iv, c.pat, c.t0, c.t1, c.model].join('|');
export function patternEnd(t, iv) {
  if (iv === '1M') { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); }
  return t + PAT_STEPS[iv];
}
export function patternConfig(c) {
  if (c && ((c.model && c.model !== 'pat-1') || c.gap === true)) throw new Error('Chartmuster: nur Modell pat-1 im Krypto-Modus ohne strenge Gaps unterstützt.');
  if (!c || !Array.isArray(c.items) || c.items.length > 40 || !/^(-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$/.test(c.chat) || !/^\d{1,20}$/.test(c.bot)
    || (c.thread && !/^\d{1,10}$/.test(c.thread))) throw new Error('Chartmuster: Liste, Chat, Bot oder Thema ungültig.');
  const items = c.items.map(x => {
    if (!x || !/^[A-Z0-9]{2,20}USDT$/.test(x.sym) || !['spot', 'futures'].includes(x.mkt) || !Object.hasOwn(PAT_STEPS, x.iv)) throw new Error('Chartmuster: Markt oder Intervall ungültig.');
    return { sym: x.sym, mkt: x.mkt, iv: x.iv };
  }).sort((a, b) => `${a.mkt}|${a.sym}|${a.iv}`.localeCompare(`${b.mkt}|${b.sym}|${b.iv}`));
  if (new Set(items.map(x => `${x.mkt}|${x.sym}|${x.iv}`)).size !== items.length) throw new Error('Chartmuster: doppelter Markt.');
  return { model: 'pat-1', gap: false, chat: String(c.chat), thread: String(c.thread || ''), bot: String(c.bot), items };
}
export function patternCandles(rows, iv, now) {
  if (!Array.isArray(rows)) throw new Error('Chartmuster: keine Kerzen.');
  const k = []; let previous = null;
  for (const r of rows) {
    if (!Array.isArray(r) || r.length < 7) throw new Error('Chartmuster: Kerzendaten ungültig.');
    const [t, o, h, l, c, v, end] = r.slice(0, 7).map(Number), expected = patternEnd(t, iv);
    if (![t, o, h, l, c, v, end].every(Number.isFinite) || t <= 0 || l <= 0 || v < 0 || h < Math.max(o, c) || l > Math.min(o, c)
      || end !== expected - 1 || (previous !== null && t !== patternEnd(previous, iv))) throw new Error('Chartmuster: ungültige Kerze oder Datenlücke.');
    previous = t;
    if (expected <= now) k.push({ t, o, h, l, c, v });
  }
  return k.slice(-540);
}
const engine = patEngine();
export function patternCases(k, item, now) {
  if (k.length < 40) return [];
  const last = k.at(-1), step = PAT_STEPS[item.iv];
  // Alte API-Daten nicht als frische Bestätigung werten; Monatsgrenzen bleiben kalendergenau.
  if (patternEnd(patternEnd(last.t, item.iv), item.iv) <= now) throw new Error('Chartmuster: Kerzendaten veraltet.');
  return engine.detect(k, { from: Math.max(0, k.length - 500), step, gap: false, running: false, formOnly: true }).hits
    .filter(h => !h.prelim && h.kind === 'form' && h.dir !== 'neutral' && /^Ausbruch/.test(h.status) && h.q >= 80 && h.i1 >= k.length - 2)
    .map(h => { const c = { ...item, pat: h.id, kind: 'form', dir: h.dir, t0: h.t0, t1: h.t1, tc: k[h.i1].t, p0: k[h.i1].c,
      model: 'pat-1', profile: 'H12-e0.10', q: h.q, at: now, src: 'live', rules: h.rules.map(r => [r.k, r.w, r.ok]), res: null }; c.id = patternId(c); return { c, h }; });
}
export function patternFresh(c, now, since) {
  return !!c && c.id === patternId(c) && Object.hasOwn(PAT_NAMES, c.pat) && c.kind === 'form' && c.model === 'pat-1'
    && c.src === 'live' && c.q >= 80 && c.q <= 100 && ['bull', 'bear'].includes(c.dir) && ['spot', 'futures'].includes(c.mkt)
    && /^[A-Z0-9]{2,20}USDT$/.test(c.sym) && Object.hasOwn(PAT_STEPS, c.iv)
    && [c.t0, c.t1, c.tc, c.p0].every(Number.isFinite) && c.p0 > 0 && c.t0 <= c.t1 && c.t1 === c.tc
    && patternEnd(c.tc, c.iv) <= now && patternEnd(c.tc, c.iv) > since && patternEnd(patternEnd(patternEnd(c.tc, c.iv), c.iv), c.iv) > now;
}
export function patternText(c, h, archive = []) {
  const price = x => x.toLocaleString('de-DE', { maximumFractionDigits: 8 }), lv = h.levels || {};
  const counts = src => { const a = archive.filter(x => x.mkt === c.mkt && x.sym === c.sym && x.iv === c.iv && x.pat === c.pat && x.model === c.model && x.profile === c.profile && x.src === src && x.res); return { n: a.length, auf: a.filter(x => x.res.out === 'auf').length, ab: a.filter(x => x.res.out === 'ab').length, seit: a.filter(x => x.res.out === 'seitwärts').length }; };
  const live = counts('live'), rek = counts('rekonstruiert'), st = live.n >= 10 ? live : rek.n >= 10 ? rek : null;
  return [`📐 Chartmuster: ${PAT_NAMES[c.pat]} · ${c.sym.slice(0, -4)}/USDT ${c.mkt === 'spot' ? 'Spot' : 'Futures'} · ${c.iv}`,
    `Ausbruch bestätigt · Richtung ${c.dir === 'bull' ? 'aufwärts' : 'abwärts'} · Kurs bei Bestätigung ${price(c.p0)}${Number.isFinite(lv.tgt) ? ` · rechnerisches Ziel ${price(lv.tgt)}` : ''}${Number.isFinite(lv.inv) ? ` · ungültig bei ${price(lv.inv)}` : ''}`,
    `Regelbasiert (Modell pat-1), Regelgüte ${c.q} %`, st ? `Erlernt (${st === live ? 'live protokolliert' : 'rekonstruiert'}): nach 12 Kerzen ${st.auf} von ${st.n} aufwärts, ${st.ab} abwärts, ${st.seit} seitwärts` : `Erlernt: noch zu wenige vergleichbare Fälle (${live.n + rek.n} von mindestens 10)`,
    'Kursrichtung ≠ Zieltreffer; keine Erfolgswahrscheinlichkeit.'].join('\n');
}
