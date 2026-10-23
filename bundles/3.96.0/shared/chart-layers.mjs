// Chart-Ebenen (3.89.0): Ordnung der Schalter in Gruppen und die Ansichten (Voreinstellungen). Reine Daten und Rechnung, ohne Oberfläche.
// Die Schalter selbst (Ein/Aus, Sperren, Zeichnen) bleiben in der App; hier steht nur, was zusammengehört und welche Auswahl eine Ansicht meint.

// Reihenfolge und Gruppen der Schalter. „zzfc“ ist die ZigZag-Prognose: ein eigener Schalter, aber keine eigene Ebene im gespeicherten Zustand.
export const OV_GROUPS = Object.freeze([
  Object.freeze({ id: 'levels', title: 'Preisniveaus', keys: Object.freeze(['hilo', 'vp', 'hz', 'kl', 'fib', 'fvg']) }),
  Object.freeze({ id: 'trend', title: 'Trend & Indikatoren', keys: Object.freeze(['ema200', 'bb', 'vwap', 'macd', 'div']) }),
  Object.freeze({ id: 'waves', title: 'Wellen', keys: Object.freeze(['zz', 'zzfc', 'ew', 'ewfc']) }),
  Object.freeze({ id: 'flow', title: 'Orderflow & Liquidität', keys: Object.freeze(['liq', 'lmap', 'whale']) })
]);

// Alle Ebenen, die im gespeicherten Zustand (`scalpdesk.overlays.v1`) stehen
export const OV_KEYS = Object.freeze(OV_GROUPS.flatMap(g => g.keys).filter(k => k !== 'zzfc'));
// Anzahl der Schalter insgesamt (Ebenen plus ZigZag-Prognose)
export const OV_TOTAL = OV_GROUPS.reduce((n, g) => n + g.keys.length, 0);

// Ansichten: eine Auswahl auf einen Tipp. „none“ blendet alles aus (ohne die „Alle ausblenden“-Rückkehr zu merken).
export const OV_VIEWS = Object.freeze([
  Object.freeze({ id: 'trend', title: 'Trend', keys: Object.freeze(['ema200', 'bb', 'vwap', 'macd']) }),
  Object.freeze({ id: 'levels', title: 'Niveaus', keys: Object.freeze(['hilo', 'vp', 'kl', 'fib', 'fvg']) }),
  Object.freeze({ id: 'waves', title: 'Wellen', keys: Object.freeze(['zz', 'div', 'ew', 'fib']) }),
  Object.freeze({ id: 'flow', title: 'Orderflow', keys: Object.freeze(['liq', 'lmap', 'whale', 'vwap']) }),
  Object.freeze({ id: 'none', title: 'Nur Kerzen', keys: Object.freeze([]) })
]);

// Eingeschaltete Ebenen eines Zustands, in der festen Reihenfolge von OV_KEYS
export const ovOn = overlays => OV_KEYS.filter(k => overlays?.[k] === true);

// Welche Ansicht beschreibt den Zustand genau? Sonst „custom“ (eigene Auswahl).
export function ovViewId(overlays) {
  const on = new Set(ovOn(overlays));
  const hit = OV_VIEWS.find(v => v.keys.length === on.size && v.keys.every(k => on.has(k)));
  return hit ? hit.id : 'custom';
}

// Zustand nach dem Wählen einer Ansicht: genau ihre Ebenen an, alle anderen aus. Unbekannte Ansicht → null. Andere Schlüssel bleiben unberührt.
export function ovApplyView(overlays, id) {
  const view = OV_VIEWS.find(v => v.id === id);
  if (!view) return null;
  const next = { ...overlays };
  for (const k of OV_KEYS) next[k] = view.keys.includes(k);
  return next;
}
