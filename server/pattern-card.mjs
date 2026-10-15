// Oracle-Musterdienst 1.3.0 / 24/7-Dienst 2.15.0 (App 3.71.0): Chartmuster-Meldung als Signalkarte (PNG, 1024 px breit).
// Aufbau, Modell und Kurztext kommen aus den gemeinsamen Modulen (shared/telegram-format.mjs: patternSignalModel und
// formatMessage('pattern'), shared/pattern-signal-card.mjs: SVG) – dieselbe Karte zeigt und sendet die App. Hier nur das Rendern
// mit resvg (kostenlos, lokal, ohne Bild-KI). Fehlende Angaben stehen als „Nicht verfügbar“ da, nichts wird erfunden.
// „Musterqualität“ ist ausdrücklich keine Erfolgswahrscheinlichkeit.
// resvg ist optional (npm install im Ordner server): Fehlt es oder scheitert das Rendern, sendet der Dienst den Kurztext.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const base = fs.existsSync(new URL('./shared/telegram-format.mjs', import.meta.url)) ? './shared/' : '../shared/';
const TF = await import(new URL(base + 'telegram-format.mjs', import.meta.url));
const SC = await import(new URL(base + 'pattern-signal-card.mjs', import.meta.url));
const PC = await import(new URL(base + 'pnl-alarm-card.mjs', import.meta.url));   // 2.15.0: Gewinn-/Verlust-Alarm als Bild
const AC = await import(new URL(base + 'price-alarm-card.mjs', import.meta.url));   // 2.15.0: Kurs-Alarm als Bild
export const { CARD_W, CARD_FONT, textWidth, wrapText, patternChartData, cleanPatternChart } = SC;
export const NA = TF.PATTERN_NA;
const has = v => v !== null && v !== undefined && String(v).trim() !== '';

const TIMEFRAMES = { m: ['Minute', 'Minuten'], h: ['Stunde', 'Stunden'], d: ['Tag', 'Tage'], w: ['Woche', 'Wochen'], M: ['Monat', 'Monate'] };
export function timeframeName(iv) {
  const m = /^(\d+)([mhdwM])$/.exec(String(iv || ''));
  if (!m) return has(iv) ? String(iv) : null;
  const n = Number(m[1]), [one, many] = TIMEFRAMES[m[2]];
  return `${n} ${n === 1 ? one : many}`;
}
// Anzeigemodell der Karte (Zeit der Meldung at, Lage „Jetzt“ zum Zeitpunkt now)
export function patternCardModel(d = {}, { at = d.at, now, timezone = d.timezone || 'Europe/Berlin', settings = d.settings } = {}) {
  return TF.patternSignalModel({ ...d, at }, { now: now ?? d.now ?? at, timezone, settings });
}
// Bildunterschrift = Kurztext in der Reihenfolge der Karte (HTML, höchstens limit Zeichen); derselbe Text ist der Ersatz ohne Bild
export function patternCaption(d = {}, { at = d.at, now, timezone = d.timezone || 'Europe/Berlin', limit = TF.TELEGRAM_CAPTION_LIMIT } = {}) {
  return TF.formatMessage('pattern', { ...d, at, now: now ?? d.now ?? at, timezone, messageLimit: limit });
}
export function patternCardSvg(m, { preview = false } = {}) { return SC.patternCardSvg(m, { preview }); }

// ---- PNG über resvg (optional installiert) ----
let resvg = null;
async function loadResvg() {
  if (!resvg) resvg = import('@resvg/resvg-js').then(m => m.Resvg || m.default?.Resvg).catch(() => null);
  const R = await resvg; if (!R) throw new Error('Kartenrenderer fehlt (im Ordner server: npm install)'); return R;
}
// 1.2.1: Schrift mitgeliefert (fonts/: Inter und DejaVu Sans als verkleinerte Untermengen, Lizenzen in fonts/LIZENZ.md). Vorher nahm
// resvg nur Systemschriften – auf Servern ohne Schriften (minimale Ubuntu-Abbilder bei Oracle) kam die Karte ganz ohne Text an.
// Mit den mitgelieferten Dateien rendert jeder Server gleich; Systemschriften nur, falls der Ordner fehlt.
const FONT_DIR = new URL('./fonts/', import.meta.url);
export const CARD_FONT_FILES = Object.freeze(['Inter-Regular.otf', 'Inter-Medium.otf', 'Inter-SemiBold.otf', 'Inter-Bold.otf', 'Inter-ExtraBold.otf', 'Inter-Black.otf', 'DejaVuSans.ttf', 'DejaVuSans-Bold.ttf']
  .map(f => fileURLToPath(new URL(f, FONT_DIR))).filter(f => fs.existsSync(f)));
const fontOptions = (extra = [], system, bundled = true) => { const own = bundled ? CARD_FONT_FILES : []; return { loadSystemFonts: system ?? !own.length, fontFiles: [...own, ...extra], defaultFontFamily: 'Inter' }; };
// Zeichnet die Schrift wirklich? Ohne passende Schrift lässt resvg Text stillschweigend weg – dann lieber die Textmeldung.
const textCheck = new Map();
async function textRenders(R, font) {
  const key = JSON.stringify(font); if (textCheck.get(key)) return true;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="44"><text x="6" y="32" font-family="${CARD_FONT}" font-size="28" font-weight="700" fill="#000">Ag 0,5 €</text></svg>`;
  const px = new R(svg, { font }).render().pixels; let ink = 0; for (let i = 3; i < px.length && ink < 50; i += 4) if (px[i] > 0) ink++;
  if (ink >= 50) textCheck.set(key, true); return ink >= 50;
}
// Beim Start prüfen, ob Karten möglich sind (sonst sendet der Dienst Text): 'ok', 'renderer' (resvg fehlt) oder 'schrift' (keine Schrift)
export async function cardRendererStatus({ fontFiles = [], loadSystemFonts, bundledFonts = true } = {}) {
  let R; try { R = await loadResvg(); } catch { return 'renderer'; }
  try { return await textRenders(R, fontOptions(fontFiles, loadSystemFonts, bundledFonts)) ? 'ok' : 'schrift'; } catch { return 'schrift'; }
}
export async function cardRendererReady(options) { return await cardRendererStatus(options) === 'ok'; }
export async function renderPatternCard(data, { at = data.at, now, timezone = 'Europe/Berlin', preview = false, captionLimit = TF.TELEGRAM_CAPTION_LIMIT, fontFiles = [], loadSystemFonts, bundledFonts = true } = {}) {
  const { model: m, svg, width, height } = SC.patternSignalCard({ ...data, at }, { now: now ?? data.now ?? at, timezone, settings: data.settings, preview });
  const Resvg = await loadResvg(), font = fontOptions(fontFiles, loadSystemFonts, bundledFonts);
  if (!await textRenders(Resvg, font)) throw new Error('Keine Schrift für die Karte gefunden – Karte wäre ohne Text');
  const png = new Resvg(svg, { fitTo: { mode: 'original' }, font }).render().asPng();
  if (!png?.length) throw new Error('Kartenrenderer lieferte kein Bild');
  return { png: Buffer.from(png), width, height, model: m, caption: patternCaption(data, { at, now, timezone, limit: captionLimit }), svg };
}
// 2.15.0: Gewinn-/Verlust-Alarm als Bild (1080 px breit) mit einzeiliger Bildunterschrift; ohne Schrift Fehler → Dienst sendet den Text
export const pnlAlarmCard = PC.pnlAlarmCard, priceAlarmCard = AC.priceAlarmCard;
async function renderCard(r, { fontFiles = [], loadSystemFonts, bundledFonts = true } = {}) {
  const Resvg = await loadResvg(), font = fontOptions(fontFiles, loadSystemFonts, bundledFonts);
  if (!await textRenders(Resvg, font)) throw new Error('Keine Schrift für die Karte gefunden – Karte wäre ohne Text');
  const png = new Resvg(r.svg, { fitTo: { mode: 'original' }, font }).render().asPng();
  if (!png?.length) throw new Error('Kartenrenderer lieferte kein Bild');
  return { png: Buffer.from(png), width: r.width, height: r.height, caption: r.caption, model: r.model, svg: r.svg };
}
export const renderPnlCard = (data, { timezone = 'Europe/Berlin', ...o } = {}) => renderCard(PC.pnlAlarmCard(data, { timezone }), o);
export const renderAlarmCard = (data, { timezone = 'Europe/Berlin', ...o } = {}) => renderCard(AC.priceAlarmCard(data, { timezone }), o);
export const EXAMPLE_ALARM = Object.freeze({ symbol: 'BTCUSDT', direction: 'above', level: 81840, price: 81840.13, reached: 'erreicht', at: Date.UTC(2026, 9, 14, 19, 19, 16), bot: 'Mein Kurs Alarm' });
export const EXAMPLE_PNL = Object.freeze({ profit: false, pnl: -170.1, level: 170, fx: 1.1185, at: Date.UTC(2026, 9, 14, 18, 35, 15), bot: 'Mein Kurs Alarm',
  positions: [{ symbol: 'BTCUSDT', side: 'long', pnl: -92.4 }, { symbol: 'ETHUSDT', side: 'short', pnl: 18.7 }, { symbol: 'SOLUSDT', side: 'long', pnl: -96.4 }] });
// Beispiel nach der Vorlage des Nutzers (DOT/USDT, symmetrisches Dreieck, 5m) – für Vorschau (--karte-beispiel) und Tests
const EX_T = Date.UTC(2026, 9, 14, 18, 50), EX_STEP = 3e5;
const EX_K = Array.from({ length: 41 }, (_, i) => ({ t: EX_T - (40 - i) * EX_STEP, c: i === 40 ? 1.137 : +(1.131 + 0.0002 * i + 0.012 * (1 - i / 44) * Math.sin(i / 2.2)).toFixed(4) }));
export const EXAMPLE_SIGNAL = Object.freeze({ pattern: 'Symmetrisches Dreieck', symbol: 'DOTUSDT', market: 'Spot', timeframe: '5m', status: 'Ausbruch bestätigt', direction: 'bull',
  entry: 1.137, target: 1.1598, invalid: 1.1294, quality: 88, model: 'pat-1', learned: { available: 0, minimum: 10 }, score: 44, marks: { trend: '✖', volume: '✖' }, rr: 2.99, atr: 0.009,
  price: 1.1381, tc: EX_T, at: EX_T + EX_STEP + 9000, chart: SC.patternChartData(EX_K, { t0: EX_K[0].t, lines: [[0, 1.145, 38, 1.1335, 'res'], [0, 1.118, 38, 1.1305, 'sup']] }) });
