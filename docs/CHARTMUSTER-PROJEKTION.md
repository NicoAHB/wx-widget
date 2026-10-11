# Chartmuster-Linien in die Zukunft

Die Erkennung bleibt `pat-1` in `server/pattern-engine.mjs`. Die Analyse `patRun()` / `patDone()` und die Originalzeichnung `patDraw()` in `weather-widget-v2.html` bleiben fachlich erhalten. Neu ist das reine gemeinsame Modul `shared/pattern-projection.mjs`, veröffentlicht im versionsgebundenen PWA-Bündel.

Im Panel **Chartmuster (KI) → Linienprojektion einstellen** kannst du die Verlängerung ein-/ausschalten und **1–100 Kerzen** wählen. Standard: **an, 25 Kerzen**, sobald die Musteranzeige aktiv ist. Die Einstellung bleibt gespeichert und wird in persönlichen Sicherungen/GitHub-Sync übertragen.

- Kanäle und Flaggen: ihre vorhandenen Begrenzungen folgen derselben Steigung.
- Keile, Dreiecke und Wimpel: höchstens bis zur mathematischen Spitze.
- Doppel-/Dreifach-Boden/-Top, Rechteck, Kopf-Schulter: Unterstützung, Widerstand und Nackenlinie; eine schräge Nackenlinie bleibt schräg.
- Tasse mit Henkel: nur die gerade Ausbruchsgrenze am Tassenrand. Die Tassenkrümmung und der Henkel sind keine fortlaufende Gerade.
- Kerzenmuster, Flaggenmast, Verbindungen zwischen Schultern/Hochs/Tiefs und reine Formzeichnung: keine Verlängerung. Eine Fortsetzung würde daraus eine nicht begründete Kursprognose machen.

Nur frische/aktive Muster bis **10 Kerzen** werden verlängert. Nach einer bestätigten Invalidierung oder nach der Spitze entfällt die Projektion. Abgeschlossene Schlusskurse jenseits einer Grenze markieren sie als **durchbrochen**: fein gestrichelt und noch blasser. Die laufende Kerze allein löst diese Darstellungsänderung nicht aus.

Rechts entsteht bei sichtbaren Projektionen Platz. Die Originalfarbe bleibt erhalten; Projektionen sind dünner, gestrichelt und transparenter. `≈ Preis` zeigt den Linienwert am sichtbaren Ende. Außerhalb der unveränderten Preisachse werden Werte abgeschnitten und Beschriftungen weggelassen; Preisachse und Muster-Regelgüte verwenden keine Projektionswerte. Am Handy begrenzen Kursschilder den verfügbaren Platz. Beim Blick in frühere Kerzen (Chart nach links verschoben) wird keine Zukunftsprojektion gezeigt.

Das Modell rechnet in Kerzenschritten; für 2h sind das 7.200.000 ms, für Monate tatsächliche Kalendermonate. Es gibt keine zusätzliche API-Abfrage. Pro Zeichnung werden nur die ohnehin angezeigten wenigen Formationen betrachtet.

## Kurzer Test auf dem Gerät

1. Ein aktuelles Linienmuster aus der Vorauswahl im Chart öffnen; dünne gestrichelte Linien und `≈`-Werte rechts ansehen.
2. Im Musterpanel die Länge auf 30 setzen, dann aus- und wieder einschalten. Die vertikale Preisachse muss gleich bleiben.
3. 2h wählen; erneut öffnen. Ein altes/ungültiges Muster erhält keine Verlängerung. Nach Reload bleibt die Einstellung bestehen.

## Vollständige geänderte Abschnitte

Die veröffentlichte HTML-Datei lädt das zugehörige Modul automatisch. Für eine manuelle Übernahme werden **Modul, Import, Einstellungen und Funktionen zusammen** benötigt; nur eine Funktion einzufügen reicht nicht. Das vollständige aktuelle HTML und alle Abhängigkeiten bleiben im Repository verfügbar.

### Neues vollständiges Modul `shared/pattern-projection.mjs`

```javascript
// Darstellungshilfe, keine Änderung an pat-1, Güte, Zielen oder Handelssignalen.
import { INTERVAL_MS, intervalEnd } from './market-intervals.mjs';
export const PROJECTION_DEFAULTS = Object.freeze({ on: true, bars: 25 });
const types = new Set(['double_top', 'double_bottom', 'triple_top', 'triple_bottom', 'head_shoulders', 'inv_head_shoulders', 'asc_triangle', 'desc_triangle', 'sym_triangle', 'rising_wedge', 'falling_wedge', 'asc_channel', 'desc_channel', 'rectangle', 'flag_bull', 'flag_bear', 'pennant_bull', 'pennant_bear', 'cup_handle']);
const converging = new Set(['asc_triangle', 'desc_triangle', 'sym_triangle', 'rising_wedge', 'falling_wedge', 'pennant_bull', 'pennant_bear']);
export function projectionSettings(value) { return { on: value?.on !== false, bars: Number.isInteger(value?.bars) && value.bars >= 1 && value.bars <= 100 ? value.bars : PROJECTION_DEFAULTS.bars }; }
export function projectionTime(time, timeframe, slots) {
  if (!Number.isFinite(time) || !Number.isFinite(slots) || slots < 0 || !Object.hasOwn(INTERVAL_MS, timeframe)) return null;
  if (timeframe !== '1M') return time + slots * INTERVAL_MS[timeframe];
  let end = time; for (let n = 0; n < Math.floor(slots); n++) end = intervalEnd(end, timeframe);
  return end + (slots % 1) * (intervalEnd(end, timeframe) - end);
}
export function projectPatternLines(hit, candles, { timeframe = '1h', bars = 25, maxAge = 10, now = Date.now() } = {}) {
  if (hit?.kind !== 'form' || !types.has(hit.id) || hit.prelim || !Array.isArray(candles) || !candles.length || !Object.hasOwn(INTERVAL_MS, timeframe)) return [];
  const index = new Map(candles.map((c, i) => [c.time, i])), last = candles.length - 1, at = index.get(hit.t1);
  if (at === undefined || last - at > maxAge || /ungültig|invalid|abgelaufen/i.test(hit.status || '')) return [];
  const rows = candles.map((c, i) => ({ ...c, i })).filter(c => (c.closeTime ?? intervalEnd(c.time, timeframe) - 1) < now), after = rows.filter(c => c.time > hit.t1);
  const invalid = hit.levels?.inv, slopingContext = /channel|triangle|wedge|flag|pennant/.test(hit.id);
  if (!slopingContext && Number.isFinite(invalid) && after.some(c => hit.dir === 'bull' ? c.close < invalid : hit.dir === 'bear' ? c.close > invalid : false)) return [];
  const lines = (hit.lines || []).filter(l => ['res', 'sup', 'neck'].includes(l[4])).flatMap(([t0, p0, t1, p1, kind]) => {
    const i0 = index.get(t0), i1 = index.get(t1); if (i0 === undefined || i1 === undefined || i1 <= i0 || ![p0, p1].every(Number.isFinite)) return [];
    const slope = (p1 - p0) / (i1 - i0), intercept = p0 - slope * i0; return [{ kind, i0, i1, slope, intercept, value: i => intercept + slope * i }];
  });
  if (!lines.length) return [];
  if (slopingContext && after.some(c => lines.some(l => (hit.dir === 'bull' && l.kind === 'sup' && c.close < l.value(c.i)) || (hit.dir === 'bear' && l.kind === 'res' && c.close > l.value(c.i))))) return [];
  let end = last + Math.max(1, Math.min(100, Math.floor(bars) || 25));
  if (converging.has(hit.id)) {
    const upper = lines.find(l => l.kind === 'res'), lower = lines.find(l => l.kind === 'sup'); if (!upper || !lower) return [];
    const difference = upper.slope - lower.slope;
    if (!(difference < -1e-12)) return []; const apex = (lower.intercept - upper.intercept) / difference;
    if (!Number.isFinite(apex) || apex <= last) return []; end = Math.min(end, apex);
  }
  return lines.flatMap(l => {
    const start = l.i1; if (end <= start || l.value(end) <= 0) return [];
    const broken = rows.some(c => c.time >= hit.t1 && c.i >= l.i0 && (l.kind === 'sup' ? c.close < l.value(c.i) : l.kind === 'neck' ? (hit.dir === 'bear' ? c.close < l.value(c.i) : c.close > l.value(c.i)) : c.close > l.value(c.i)));
    return [{ kind: l.kind, fromIndex: start, toIndex: end, fromPrice: l.value(start), price: l.value(end), toTime: projectionTime(candles.at(-1).time, timeframe, end - last), broken }];
  });
}
```

### Import im HTML-Modul

```javascript
import { projectPatternLines, projectionSettings, projectionTime } from './bundles/3.63.0/shared/pattern-projection.mjs';
```

### Gespeicherte Einstellung beim Musterzustand

```javascript
const PAT_PROJECTION_KEY = 'scalpdesk.pattern-projection.v1';
var patProjection = projectionSettings(store.get(PAT_PROJECTION_KEY));
```

### Vollständige Funktion für freie Zukunftsplätze

```javascript
function chartFutureSlots(len, narrow = false) {
  if (state.pan > 0) return 0;
  const last = state.candles.length - 1; let need = 0;
  if (zzFcOn()) { const f = zzForecast(); if (f) need = f.to.i - last + 2; }
  if (ewFcOn()) { const e = ewForecastNow(); if (e) need = Math.max(need, e.pts.at(-1).i - last + 2); } // Elliott-Prognose (elliott.js)
  const projectionNeed = patProjection?.on && pat?.on && patProjectionRows().length ? patProjection.bars + 4 + (narrow ? Math.ceil(len * .5) : 0) : 0;
  if (need && narrow) need += Math.ceil(len * .2);
  return Math.max(projectionNeed, need ? Math.max(2, Math.min(need, Math.floor(len * (narrow ? .55 : .35)))) : 0);
}
```

### Vollständige neue Projektionsfunktionen und erweiterte `patDraw()`

```javascript
function patProjectionRows() {
  if (!patProjection.on || !pat.on || state.pan > 0 || pat.res?.key !== patKey()) return [];
  const forms = patShown().filter(h => h.kind === 'form'), selected = pat.res?.hits[pat.sel];
  const hits = [...new Set([...forms.slice(0, 2), ...(selected?.kind === 'form' && forms.includes(selected) ? [selected] : [])])];
  return hits.flatMap(hit => projectPatternLines(hit, state.candles, { timeframe: state.interval, bars: patProjection.bars, maxAge: PAT_ACTIVE_MAX }).map(line => ({ ...line, hit })));
}
function patDrawProjection(svg, over, g) {
  const rows = patProjectionRows(); if (!rows.length) return;
  const offset = state.candles.findIndex(c => c.time === g.data[0]?.time), limitX = Math.min(g.rx - 4, g.left + g.pw - 4);
  const used = [];
  for (const line of rows) {
    const color = line.hit.dir === 'bull' ? PAL.up : line.hit.dir === 'bear' ? PAL.down : PAL.vp, px = g.x(line.fromIndex - offset), endX = Math.min(limitX, g.x(line.toIndex - offset));
    if (endX <= px) continue;
    const visibleIndex = offset + (endX - g.x(0)) / g.step, price = line.fromPrice + (line.price - line.fromPrice) * (visibleIndex - line.fromIndex) / (line.toIndex - line.fromIndex), yp = g.y(price);
    over.append(node('line', { x1: px, y1: g.y(line.fromPrice), x2: endX, y2: yp, stroke: color, 'stroke-width': .9, 'stroke-dasharray': line.broken ? '2 5' : '3 4', opacity: line.broken ? .22 : .48, class: 'pat-projection' + (line.broken ? ' broken' : ''), 'data-pattern': line.hit.id }));
    if (price < g.min || price > g.max || used.some(y => Math.abs(y - yp) < 14)) continue;
    used.push(yp);
    const text = node('text', { x: endX - 3, y: clamp(yp - 4, g.top + 12, g.bottom - 4), 'text-anchor': 'end', class: 'axis-label pat-projection-price', style: `fill:${color};opacity:${line.broken ? .5 : .8};font-size:10px` }, '≈ ' + priceText(price));
    text.append(node('title', {}, `${PAT_LIB[line.hit.id]?.n || line.hit.id} · ${line.broken ? 'durchbrochen' : 'Linienprojektion'} · ${new Date(projectionTime(state.candles.at(-1).time, state.interval, visibleIndex - state.candles.length + 1)).toLocaleString('de-DE')} · keine Kursprognose`)); svg.append(text);
  }
}
function patDraw(svg, over, g) {
  const hits = patShown(); if (!hits.length) return;
  const idx = new Map(g.data.map((c, i) => [c.time, i])), { x, y, min, max, step, top } = g, R = pat.res;
  patDrawProjection(svg, over, g);
  const col = d => (d === 'bull' ? PAL.up : d === 'bear' ? PAL.down : PAL.vp), inR = v => Number.isFinite(v) && v >= min && v <= max;
  const formTop = new Set(hits.filter(h => h.kind === 'form').slice(0, 2));   // ohne Auswahl nur die zwei stärksten Formationen als Linien
  for (const h of hits) {
    const i = R.hits.indexOf(h), a = idx.get(h.t0), b = idx.get(h.t1); if (a === undefined && b === undefined) continue;
    const L = PAT_LIB[h.id], c = col(h.dir), sel = pat.sel === i, xa = x(a ?? 0) - step / 2, xb = x(b ?? g.data.length - 1) + step / 2;
    if (sel) over.append(node('rect', { x: xa, y: top, width: Math.max(2, xb - xa), height: g.bottom - top, fill: c, opacity: .1, class: 'pat-hl' }));
    if (h.kind === 'form' && (sel || formTop.has(h))) for (const [t0, p0, t1, p1, kd] of h.lines) {
      const ia = idx.get(t0), ib = idx.get(t1); if (ia === undefined || ib === undefined) continue;
      over.append(node('line', { x1: x(ia), y1: y(p0), x2: x(ib), y2: y(p1), stroke: c, 'stroke-width': sel ? 2.2 : 1.2, 'stroke-dasharray': kd === 'shape' ? '' : '5 3', opacity: sel ? .95 : .55, class: 'pat-line' }));
    }
    if (h.kind === 'form' && sel && h.levels?.tgt != null && inR(h.levels.tgt)) over.append(node('line', { x1: x(b ?? 0), y1: y(h.levels.tgt), x2: g.left + g.pw, y2: y(h.levels.tgt), stroke: c, 'stroke-dasharray': '2 3', opacity: .8 }));
    // ohne Auswahl ein kleines Zeichen (▲ ▼ ◆), ausgewählt der Name mit ⓘ – beides antippbar
    const up = h.dir !== 'bear', lv = h.kind === 'candle' ? (up ? h.low : h.price) : (up ? Math.min(...h.lines.map(l => Math.min(l[1], l[3]))) : Math.max(...h.lines.map(l => Math.max(l[1], l[3]))));
    const xm = h.kind === 'candle' ? x(b ?? 0) : x(b ?? g.data.length - 1), ym = inR(lv) ? y(lv) + (up ? 12 : -5) : up ? g.bottom - 4 : top + 10;
    const t = sel ? node('text', { x: Math.min(xm, g.left + g.pw - 4), y: Math.max(top + 10, Math.min(g.bottom - 4, ym + (up ? 2 : -2))), 'text-anchor': xm > g.left + g.pw * 0.7 ? 'end' : 'middle', class: 'axis-label pat-label sel', style: `fill:${c};font-weight:800;cursor:pointer`, 'data-pat': i }, `${L.n.replace(/ \(.*\)$/, '')} ⓘ`)
      : node('text', { x: xm, y: ym, 'text-anchor': 'middle', class: 'pat-label pat-mk', style: `fill:${c};font-size:11px;cursor:pointer`, 'data-pat': i }, h.dir === 'bull' ? '▲' : h.dir === 'bear' ? '▼' : '◆');
    t.append(node('title', {}, `${L.n} · Regelgüte ${h.q} %`)); svg.append(t);
  }
}
```

### Einstellung im Musterpanel

```html
<details class="pat-project-settings"><summary>Linienprojektion einstellen</summary><label class="check"><input type="checkbox" id="pat-project-on" checked> Linien in die Zukunft verlängern</label><label>Länge in Kerzen <input type="number" id="pat-project-bars" min="1" max="100" step="1" value="25" inputmode="numeric"></label><p>Dezente gestrichelte Linien zeigen mögliche Unterstützungen und Widerstände, keine Kursprognose. Keile, Dreiecke und Wimpel enden spätestens an der Spitze. Durchbrochene Linien erscheinen blasser; abgelaufene oder ungültige Muster werden nicht verlängert. Die Preisachse bleibt unverändert.</p></details>
```

### Ereignis im bestehenden `patUi()`

```javascript
  for (const id of ['pat-project-on', 'pat-project-bars']) $(id).addEventListener('change', () => {
    Object.assign(patProjection, projectionSettings({ on: $('pat-project-on').checked, bars: Number($('pat-project-bars').value) })); store.set(PAT_PROJECTION_KEY, { ...patProjection }); patSheet(); scheduleDraw();
  });
```

Die vorhandene `patSheet()` setzt vor `pat-minq` beide Felder:

```javascript
$('pat-project-on').checked = patProjection.on; $('pat-project-bars').value = String(patProjection.bars);
```

`scalpdesk.pattern-projection.v1` ist außerdem in `PREF_KEYS` aufgenommen. Die Styles stehen im vorhandenen CSS unter `.pat-project-settings`; sie betreffen nur diese Einstellung.
