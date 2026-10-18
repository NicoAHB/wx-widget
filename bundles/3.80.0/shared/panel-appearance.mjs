// Nur Oberflächenvariablen: keine Datenabrufe, keine Panel-/Chart-Neuzeichnung.
export const PANEL_APPEARANCE_KEY = 'scalpdesk.panel-style.v1';
export const PANEL_DEFAULTS = Object.freeze({ v: 1, enabled: true, transparency: 40, blur: 12, border: 12, circles: true, lines: true, background: 'current' });
export const PANEL_COLORS = Object.freeze([['current', 'Aktuell'], ['#5a2d52', 'Aubergine'], ['#1f3a6b', 'Nachtblau'], ['#0f5560', 'Petrol'], ['#6b1f35', 'Bordeaux']]);
const step = (v, fallback, max, size) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v / size) * size)) : fallback;
export function panelAppearance(value) {
  const x = value || {};
  return { v: 1, enabled: x.enabled !== false, transparency: step(x.transparency, 40, 70, 5), blur: step(x.blur, 12, 24, 2), border: step(x.border, 12, 40, 2),
    circles: x.circles !== false, lines: x.lines !== false,
    background: typeof x.background === 'string' && /^#[0-9a-f]{6}$/i.test(x.background) ? x.background.toLowerCase() : 'current' };
}
export function applyPanelAppearance(root, value) {
  const s = panelAppearance(value);
  root.style.setProperty('--panel-alpha', String(Math.round((1 - s.transparency / 100) * 100) / 100));
  root.style.setProperty('--panel-blur', s.blur + 'px');
  root.style.setProperty('--panel-border-alpha', String(s.border / 100));
  root.style.setProperty('--panel-backdrop', s.blur ? 'blur(var(--panel-blur))' : 'none');
  root.style.setProperty('--display-bg', s.background === 'current' ? 'var(--bg)' : s.background);
  root.dataset.panelStyle = s.enabled ? 'glass' : 'original';
  root.dataset.bgCircles = s.circles ? 'on' : 'off'; root.dataset.bgLines = s.lines ? 'on' : 'off';
  return s;
}
export function createPanelAppearanceSettings({ host, read, save, adopt = () => {} }) {
  const doc = host.ownerDocument, win = doc.defaultView;
  let state = panelAppearance(read()), frame = 0, timer = 0, custom = !PANEL_COLORS.some(([v]) => v === state.background), saved = JSON.stringify(state);
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const root = el('section', 'pa-settings'), title = el('h3', '', 'Darstellung'); root.id = 'panel-appearance-settings'; title.id = 'panel-appearance-title'; root.setAttribute('aria-labelledby', title.id);
  const error = el('small', 'pa-error'); error.hidden = true; error.setAttribute('role', 'status');
  const toggle = (id, label) => { const row = el('label', 'pa-switch'), input = el('input'); input.id = id; input.type = 'checkbox'; row.append(input, el('span', '', label)); return { row, input }; };
  const enabled = toggle('panel-style-enabled', 'Neue Darstellung');
  root.append(title, enabled.row, el('p', 'pa-note', 'Gilt für alle Bereiche außer dem großen Chart. Aus stellt die bisherige Darstellung wieder her; deine Werte bleiben gespeichert.'));
  const controls = el('div', 'pa-controls'), ranges = {};
  for (const [key, label, max, amount, unit] of [['transparency', 'Transparenz', 70, 5, '%'], ['blur', 'Unschärfe', 24, 2, 'px'], ['border', 'Rand', 40, 2, '%']]) {
    const row = el('div', 'pa-range'), heading = el('div', 'pa-range-head'), name = el('label', '', label), output = el('output'), input = el('input');
    input.type = 'range'; input.min = '0'; input.max = String(max); input.step = String(amount); input.id = 'panel-style-' + key; name.htmlFor = input.id; output.htmlFor = input.id;
    input.setAttribute('aria-label', label); input.addEventListener('input', () => change({ [key]: Number(input.value) })); input.addEventListener('change', flush);
    heading.append(name, output); row.append(heading, input); controls.append(row); ranges[key] = { input, output, unit };
  }
  const circles = toggle('panel-style-circles', 'Bunte Kreise'), lines = toggle('panel-style-lines', 'Linien');
  controls.append(circles.row, lines.row, el('p', 'pa-note', 'Der Glas-Effekt ist nur sichtbar, wenn etwas hinter dem Panel liegt (Kreise, Linien oder Chart).'));
  const colorLabel = el('label', 'pa-color-label', 'Hintergrundfarbe'), select = el('select'); select.id = 'panel-style-background'; colorLabel.htmlFor = select.id;
  for (const [value, label] of [...PANEL_COLORS, ['custom', 'Selbst wählen']]) { const o = el('option', '', label); o.value = value; select.append(o); }
  const own = el('label', 'pa-own-color'), picker = el('input'), ownValue = el('output'); picker.type = 'color'; picker.id = 'panel-style-custom'; picker.value = state.background === 'current' ? '#5a2d52' : state.background; picker.setAttribute('aria-label', 'Hintergrundfarbe selbst wählen'); own.append(picker, ownValue);
  select.addEventListener('change', () => { custom = select.value === 'custom'; change({ background: custom ? picker.value : select.value }); flush(); });
  picker.addEventListener('input', () => { custom = true; change({ background: picker.value }); }); picker.addEventListener('change', flush);
  const reset = el('button', 'button ghost pa-reset', 'Zurücksetzen'); reset.type = 'button'; reset.id = 'panel-style-reset';
  reset.addEventListener('click', () => { custom = false; state = { ...PANEL_DEFAULTS }; updateControls(); schedule(); flush(); });
  enabled.input.addEventListener('change', () => { change({ enabled: enabled.input.checked }); flush(); });
  circles.input.addEventListener('change', () => { change({ circles: circles.input.checked }); flush(); });
  lines.input.addEventListener('change', () => { change({ lines: lines.input.checked }); flush(); });
  controls.append(colorLabel, select, own, reset, error); root.append(controls); host.prepend(root);
  function updateControls() {
    enabled.input.checked = state.enabled; circles.input.checked = state.circles; lines.input.checked = state.lines;
    for (const [key, { input, output, unit }] of Object.entries(ranges)) { input.value = String(state[key]); output.value = `${state[key]} ${unit}`; input.setAttribute('aria-valuetext', output.value); }
    select.value = custom ? 'custom' : state.background; own.hidden = !custom;
    if (state.background !== 'current') picker.value = state.background;
    ownValue.value = picker.value.toUpperCase();
  }
  function paint() { frame = 0; applyPanelAppearance(doc.documentElement, state); }
  function schedule() { if (!frame) frame = win.requestAnimationFrame(paint); }
  function persist() {
    timer = 0; const next = JSON.stringify(state); if (next === saved) return;
    try { save(state); saved = next; error.hidden = true; } catch { error.hidden = false; error.textContent = 'Darstellung konnte nicht gespeichert werden. Gerätespeicher prüfen.'; }
  }
  function flush() { if (frame) { win.cancelAnimationFrame(frame); paint(); } win.clearTimeout(timer); persist(); }
  function change(delta) { state = panelAppearance({ ...state, ...delta }); updateControls(); schedule(); win.clearTimeout(timer); timer = win.setTimeout(persist, 200); }
  function reload(value = read()) { state = panelAppearance(value); saved = JSON.stringify(state); custom = !PANEL_COLORS.some(([v]) => v === state.background); updateControls(); schedule(); }
  win.addEventListener('storage', e => { if (e.key === PANEL_APPEARANCE_KEY) { try { const value = e.newValue ? JSON.parse(e.newValue) : null; adopt(value); reload(value); } catch { /* ungültigen fremden Spiegel übergehen */ } } });
  win.addEventListener('pagehide', flush); doc.addEventListener('visibilitychange', () => { if (doc.hidden) flush(); });
  updateControls(); applyPanelAppearance(doc.documentElement, state);
  return { root, reload, flush, get state() { return { ...state }; } };
}
