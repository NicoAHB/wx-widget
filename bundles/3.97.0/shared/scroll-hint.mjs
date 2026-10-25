// Randhinweis für waagerecht wischbare Zeilen (Zeitrahmen, Chart-Werkzeuge): Wo mehr Inhalt folgt, blendet ein Verlauf den Rand aus.
// Ohne Hinweis wirken auf dem Handy angeschnittene Tasten („1M“, Vollbild) wie ein Darstellungsfehler, obwohl die Zeile wischbar ist.
// Der Zustand steht als data-scroll-more="start|end|both" am Element, die Darstellung übernimmt das CSS (mask-image).

// Reiner Zustand aus den Maßen: "end" = rechts folgt mehr, "start" = links liegt mehr, "both", sonst "" (alles sichtbar).
// contentWidth (Breite der sichtbaren Kinder) hat Vorrang vor scrollWidth: Ein geschlossenes Hilfefenster, das absolut positioniert über den
// Rand ragt, vergrößert scrollWidth, ohne dass etwas zu sehen ist – dann dürfte kein Verlauf erscheinen.
export function scrollHintState({ scrollLeft = 0, scrollWidth = 0, clientWidth = 0, contentWidth } = {}, tolerance = 2) {
  const max = (Number.isFinite(contentWidth) ? contentWidth : scrollWidth) - clientWidth;
  if (!(max > tolerance)) return '';
  const start = scrollLeft > tolerance, end = scrollLeft < max - tolerance;
  return start && end ? 'both' : end ? 'end' : start ? 'start' : '';
}

// Breite des tatsächlich sichtbaren Inhalts: rechter Rand des letzten sichtbaren Kindes (plus Innenabstand) ab dem linken Rand der Zeile.
// Ohne Layout (z. B. Tests ohne Browser) undefined – dann gilt scrollWidth.
function visibleContentWidth(el) {
  if (typeof el.getBoundingClientRect !== 'function') return undefined;
  const box = el.getBoundingClientRect(); let end = 0;
  for (const child of el.children) {
    const r = child.getBoundingClientRect();
    if (r.width > 0 || r.height > 0) end = Math.max(end, r.right - box.left + (el.scrollLeft || 0));
  }
  if (!end) return undefined;
  return end + (parseFloat(globalThis.getComputedStyle?.(el).paddingRight) || 0);
}

// Hält data-scroll-more aktuell: beim Wischen, bei Größenänderung der Zeile oder ihrer Tasten (z. B. wenn „Jetzt“ erscheint) und
// bei neuen Tasten. Gibt eine Funktion zum Abbauen zurück; ohne Element passiert nichts.
export function installScrollHint(el, { tolerance = 2 } = {}) {
  if (!el) return () => {};
  const update = () => {
    const state = scrollHintState({ scrollLeft: el.scrollLeft, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, contentWidth: visibleContentWidth(el) }, tolerance);
    if (state) { if (el.dataset.scrollMore !== state) el.dataset.scrollMore = state; } else if ('scrollMore' in el.dataset) delete el.dataset.scrollMore;
  };
  el.addEventListener('scroll', update, { passive: true });
  const { ResizeObserver: RO, MutationObserver: MO } = globalThis, resize = typeof RO === 'function' ? new RO(update) : null;
  const watched = new Set(), watch = node => { if (resize && !watched.has(node)) { watched.add(node); resize.observe(node); } };
  watch(el); for (const child of el.children) watch(child);
  const mutations = typeof MO === 'function' ? new MO(() => { for (const child of el.children) watch(child); update(); }) : null;
  mutations?.observe(el, { childList: true });
  globalThis.addEventListener?.('resize', update, { passive: true });
  update();
  return () => { el.removeEventListener('scroll', update); resize?.disconnect(); mutations?.disconnect(); globalThis.removeEventListener?.('resize', update); delete el.dataset.scrollMore; };
}
