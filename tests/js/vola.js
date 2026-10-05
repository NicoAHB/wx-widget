// ---------- Schritt 4.3: Volatilität und Richtung nach Uhrzeit (3.22.0) ----------
// Aus den letzten 2.000 Stundenkerzen des geöffneten Coins (rund 83 Tage, Markt wie im Chart): je Uhrzeit (Ortszeit) und
// Tagesart (Mo–Fr, Sa–So), wie weit der Kurs innerhalb einer Stunde schwankt – Spanne Hoch bis Tief in % der Eröffnung.
// Verglichen mit der Spanne der letzten 60 Minuten (1m-Kerzen): Gehört sie zu den stärksten 10/5/1 % der vergleichbaren
// Stunden, warnt die Live-Leiste. Richtung ehrlich: ▲/▼ nur, wenn die mittlere Stundenbewegung auch nach Gebühren (hin und
// zurück, Einstellung im Positionsrechner) gesichert über bzw. unter null liegt – Student-t, 95 % für alle 48 Zellen
// zugleich (Bonferroni). Sonst „keine nachweisbare Tendenz“, ohne Prozentzahl und ohne Trefferquoten.
// var statt const/let: volaTick und volaKline können über Sekundentakt und Stream schon laufen, bevor dieser Abschnitt ausgewertet ist
var VOLA_KEY = 'scalpdesk.vola.v1', VOLA_DB = 'vola|', VOLA_IDX = 'vola|__index', VOLA_HOURS = 2000, VOLA_KEEP = 8;
var VOLA_EVERY = 6 * 3600e3, VOLA_RETRY = 5 * 60e3, VOLA_Z = 3.279, VOLA_MIN_N = 10, VOLA_MIN_DIR = 20, VOLA_MIN_POOL = 30, VOLA_MIN_MIN = 45;
var vola = { sym: '', loaded: false, rows: null, market: '', at: 0, busy: false, error: '', retryAt: 0, stats: null, statsKey: '',
  m1: [], m1sym: '', m1market: '', m1busy: false, m1retry: 0, sel: null, day: null, level: 0, key: '', rev: 0, cfg: null, built: false };
// Spanne (Hoch–Tief) und Bewegung (Schluss zu Eröffnung) einer Stundenkerze, beides in % (4 Nachkommastellen genügen)
var volaRow = c => [c.time, +((c.high - c.low) / c.open * 100).toFixed(4), +((c.close / c.open - 1) * 100).toFixed(4)];
// Uhrzeit (Ortszeit) und Tagesart eines Zeitpunkts
function volaSlot(t) { const d = new Date(t), wd = d.getDay(); return { h: d.getHours(), we: wd === 0 || wd === 6 }; }
// Anteil q einer aufsteigend sortierten Liste (lineare Interpolation)
function volaQ(sorted, q) {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}
// Student-t-Schranke für 48 Tests zugleich (24 Stunden × 2 Tagesarten, Bonferroni, gemeinsam 95 %): Cornish-Fisher-Näherung
// aus dem Normalwert 3,279; bei 19 Freiheitsgraden 3,87, bei 58 Freiheitsgraden 3,45
function volaT(df) {
  const z = VOLA_Z, z2 = z * z;
  return z + (z2 + 1) * z / (4 * df) + ((5 * z2 + 16) * z2 + 3) * z / (96 * df ** 2) + (((3 * z2 + 19) * z2 + 17) * z2 - 15) * z / (384 * df ** 3)
    + ((((79 * z2 + 776) * z2 + 1482) * z2 - 1920) * z2 - 945) * z / (92160 * df ** 4);
}
// Statistik je Tagesart und Stunde. Median und Richtung aus der Stunde selbst; die Schwellen (90/95/99 %) aus der Stunde und
// ihren beiden Nachbarn (dreimal so viele Fälle – am Wochenende sonst zu wenige für seltene Werte).
function volaStats(rows, fee = 0.06) {
  const mk = () => Array.from({ length: 24 }, () => ({ r: [], m: [] })), b = { wd: mk(), we: mk() }, asc = (p, q) => p - q, cost = 2 * fee;
  for (const [t, r, m] of rows) { if (!(r >= 0) || !Number.isFinite(m)) continue; const s = volaSlot(t), x = b[s.we ? 'we' : 'wd'][s.h]; x.r.push(r); x.m.push(m); }
  const out = { wd: [], we: [], n: rows.length, from: rows[0]?.[0] ?? null, to: rows.at(-1)?.[0] ?? null, fee };
  for (const k of ['wd', 'we']) for (let h = 0; h < 24; h++) {
    const x = b[k][h], own = x.r.slice().sort(asc), pool = [...b[k][(h + 23) % 24].r, ...x.r, ...b[k][(h + 1) % 24].r].sort(asc);
    const n = x.m.length, mean = n ? x.m.reduce((s, v) => s + v, 0) / n : 0, sd = n > 1 ? Math.sqrt(x.m.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : 0;
    const half = n >= VOLA_MIN_DIR ? volaT(n - 1) * sd / Math.sqrt(n) : Infinity, lo = mean - half, hi = mean + half;
    out[k].push({ n, np: pool.length, med: volaQ(own, 0.5), p90: volaQ(pool, 0.9), p95: volaQ(pool, 0.95), p99: volaQ(pool, 0.99), mean, lo, hi,
      tend: lo > cost ? 'up' : hi < -cost ? 'down' : null });
  }
  return out;
}
// Spanne der letzten 60 Minuten aus 1m-Kerzen (laufende eingeschlossen) in % des Kurses zu Beginn des Fensters. Zu wenige
// Minuten (kurz nach dem Laden, nach einer Lücke): nichts behaupten.
function volaRange60(m1, now = Date.now()) {
  const from = now - 3600e3, xs = m1.filter(c => c.time + 60e3 > from && c.time <= now);
  if (xs.length < VOLA_MIN_MIN || !(xs[0].open > 0)) return null;
  let hi = -Infinity, lo = Infinity; for (const c of xs) { if (c.high > hi) hi = c.high; if (c.low < lo) lo = c.low; }
  return (hi - lo) / xs[0].open * 100;
}
// Warnstufe: 0 üblich, 1 über der eingestellten Schwelle, 2 über dem 99-%-Wert. Einmal an, geht die Warnung erst unter 90 %
// der Schwelle wieder aus (kein Flackern an der Grenze).
function volaLevel(cur, b, thr, was = 0) {
  if (cur == null || !thr || !b || b.np < VOLA_MIN_POOL) return 0;
  const lim = b['p' + thr]; if (!(lim > 0)) return 0;
  if (thr < 99 && cur >= b.p99) return 2;
  return cur >= lim || (was && cur >= lim * 0.9) ? (thr === 99 ? 2 : 1) : 0;
}
var volaHours = h => `${h}–${(h + 1) % 24} Uhr`;
var volaDayName = k => (k === 'we' ? 'Sa–So' : 'Mo–Fr');
var volaPct = v => (v == null || !Number.isFinite(v) ? '—' : `${number(v, v < 10 ? 2 : 1)} %`);
function volaDirText(b) {
  if (!b || b.n < VOLA_MIN_DIR) return 'zu wenige Stunden für eine Aussage';
  return b.tend === 'up' ? `▲ steigt im Schnitt um ${volaPct(b.mean)} – auch nach Gebühren gesichert`
    : b.tend === 'down' ? `▼ fällt im Schnitt um ${volaPct(-b.mean)} – auch nach Gebühren gesichert` : 'keine nachweisbare Tendenz';
}
function volaStamp(t, now) {
  const d = new Date(t);
  return d.toDateString() === new Date(now).toDateString() ? ecTime(t) : `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} ${ecTime(t)}`;
}
// ---- Zwischenspeicher: im Kerzen-Speicher der App (IndexedDB „scalpdesk-candles“), eigener Schlüssel je Coin, höchstens
// VOLA_KEEP Coins (die zuletzt geladenen bleiben). „Kerzen-Zwischenspeicher leeren“ löscht ihn mit.
async function volaDbGet(sym) {
  const db = await kcOpen(); if (!db) return null;
  const v = await new Promise(res => { try { const q = db.transaction('series').objectStore('series').get(VOLA_DB + sym); q.onsuccess = () => res(q.result); q.onerror = () => res(null); } catch { res(null); } });
  return v && (v.m === 'spot' || v.m === 'futures') && Array.isArray(v.rows) && v.rows.every(r => Array.isArray(r) && r.length === 3 && r.every(Number.isFinite)) ? v : null;
}
async function volaDbPut(sym, v) {
  const db = await kcOpen(); if (!db) return;
  try {
    const tx = db.transaction('series', 'readwrite'), st = tx.objectStore('series'), ix = st.get(VOLA_IDX);
    ix.onsuccess = () => {
      const index = ix.result && typeof ix.result === 'object' ? ix.result : {};
      st.put(v, VOLA_DB + sym); index[sym] = v.at;
      for (const [s] of Object.entries(index).sort((a, b) => b[1] - a[1]).slice(VOLA_KEEP)) { st.delete(VOLA_DB + s); delete index[s]; }
      st.put(index, VOLA_IDX);
    };
    await new Promise(res => { tx.oncomplete = tx.onerror = tx.onabort = res; });
  } catch { /* nur eine Beschleunigung */ }
}
// ---- Laden: Stundenkerzen (erst alles in zwei Abrufen, danach nur Neues) und 1m-Kerzen für die letzten 60 Minuten ----
async function volaFetch(sym, cm) {
  vola.busy = true;
  const now = Date.now(), get = async p => {
    const raw = cm === 'futures' ? await api.get(FUTURES, '/fapi/v1/klines', p) : await spotGet('/api/v3/klines', p);
    return Array.isArray(raw) && raw.length ? normalizeKlines(raw) : [];
  };
  try {
    const have = vola.sym === sym && vola.market === cm && vola.rows ? vola.rows : [], lastT = have.at(-1)?.[0];
    let add;
    if (lastT && now - lastT < 900 * 3600e3) add = await get({ symbol: sym, interval: '1h', startTime: lastT + 3600e3, limit: 1000 });
    else {
      const a = await get({ symbol: sym, interval: '1h', limit: 1000 });
      add = [...(a.length >= 1000 ? await get({ symbol: sym, interval: '1h', limit: 1000, endTime: a[0].time - 1 }) : []), ...a];
    }
    const seen = new Set(), rows = [...have, ...add.filter(c => c.closeTime < now).map(volaRow)]
      .filter(r => !seen.has(r[0]) && seen.add(r[0])).sort((p, q) => p[0] - q[0]).slice(-VOLA_HOURS);
    if (!rows.length) throw new Error('Keine Stundenkerzen für diesen Coin.');
    const at = Date.now();
    if (vola.sym === sym) Object.assign(vola, { rows, market: cm, at, error: '', retryAt: 0 });
    void volaDbPut(sym, { m: cm, at, rows });
  } catch (e) {
    if (vola.sym === sym) { vola.error = e?.message || 'Stundenkerzen nicht erreichbar.'; vola.retryAt = Date.now() + VOLA_RETRY; }
  } finally { vola.busy = false; vola.rev++; }
}
async function volaLoadM1(sym) {
  vola.m1busy = true;
  try {
    const r = await cachedKlines(sym, '1m', 75);
    if (vola.sym === sym) { vola.m1 = r.candles.slice(-80).map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })); vola.m1sym = sym; vola.m1market = r.source; vola.rev++; }
  } catch { if (vola.sym === sym) vola.m1retry = Date.now() + VOLA_RETRY; }
  finally { vola.m1busy = false; }
}
// Aus dem Live-Stream (onKline): 1m-Kerzen des geöffneten Coins mitschreiben; fehlt eine Minute, neu laden
function volaKline(m) {
  if (!vola || m.i !== '1m' || m.s !== vola.m1sym || m.m !== vola.m1market || !vola.m1.length) return;
  const k = m.k, c = { time: k.t, open: k.o, high: k.h, low: k.l, close: k.c }, last = vola.m1.at(-1);
  if (![c.time, c.open, c.high, c.low, c.close].every(Number.isFinite)) return;
  if (c.time === last.time) vola.m1[vola.m1.length - 1] = c;
  else if (c.time > last.time) {
    if (c.time > last.time + 60e3) { vola.m1 = []; vola.m1sym = ''; return; } // Lücke (z. B. Handy gesperrt): neu laden
    vola.m1.push(c); if (vola.m1.length > 90) vola.m1.splice(0, vola.m1.length - 90);
  }
}
function volaStatsNow() {
  if (!vola.rows?.length) return null;
  const fee = state.risk?.feePct >= 0 ? state.risk.feePct : 0.06, k = `${vola.sym}|${vola.at}|${vola.rows.length}|${fee}`;
  if (vola.statsKey !== k) { vola.stats = volaStats(vola.rows, fee); vola.statsKey = k; }
  return vola.stats;
}
// ---- Anzeige: feste Größen (24 Säulen, vier einzeilige Zeilen); Live-Werte ändern nur Inhalte, nie Höhen ----
function volaBuild() {
  const bars = $('vola-bars'), hours = $('vola-hours'); if (!bars || vola.built) return;
  for (let h = 0; h < 24; h++) {
    const g = document.createElement('span'); g.className = 'vb'; g.dataset.h = String(h);
    g.append(el('i', 'vb-p90'), el('i', 'vb-med'), el('b', 'vb-dir'));
    bars.append(g);
    if (h % 3 === 0) { const l = el('span', '', String(h)); l.style.gridColumn = String(h + 1); hours.append(l); }
  }
  const live = el('i', 'vb-live'); live.id = 'vola-live'; live.hidden = true; bars.append(live);
  vola.built = true;
}
function renderVola(now = Date.now()) {
  const box = $('vola'); if (!box || !vola.cfg) return;
  volaBuild();
  const put = (e, t) => { if (e && e.textContent !== t) e.textContent = t; };
  const st = volaStatsNow(), slot = volaSlot(now), todayK = slot.we ? 'we' : 'wd', day = vola.day || todayK, today = day === todayK, bs = st?.[day];
  const cur = vola.m1sym === state.symbol ? volaRange60(vola.m1, now) : null, selH = vola.sel ?? slot.h;
  put($('vola-coin'), coin(state.symbol));
  const days = st?.from ? Math.round((st.to - st.from) / 864e5) : 0;
  put($('vola-src'), st ? `${days} Tage · ${number(st.n, 0)} Stunden · Stand ${volaStamp(vola.at, now)}${vola.market === 'futures' ? ' · Futures' : ''}${vola.error ? ' · Nachladen fehlgeschlagen' : ''}`
    : vola.error || 'Stundenkerzen werden geladen …');
  $('vola-src').classList.toggle('err', !!vola.error);
  for (const b of box.querySelectorAll('[data-vday]')) { const on = String(b.dataset.vday === day); if (b.getAttribute('aria-pressed') !== on) b.setAttribute('aria-pressed', on); }
  // Säulen: typische Spanne (Median) kräftig, 9 von 10 Stunden darunter hell; Maßstab: größter 90-%-Wert oder die aktuelle Spanne
  const bars = $('vola-bars'), top = Math.max(0.0001, ...(bs || []).map(b => b.p90 || 0), today && cur ? cur : 0) * 1.05, pct = v => `${Math.min(100, (v || 0) / top * 100).toFixed(1)}%`;
  const label = `Typische Spanne je Stunde (${volaDayName(day)}). Pfeiltasten wählen eine Stunde.`; if (bars.getAttribute('aria-label') !== label) bars.setAttribute('aria-label', label);
  bars.querySelectorAll('.vb').forEach((g, h) => {
    const b = bs?.[h], [p90, med, dir] = g.children, few = !b || b.n < VOLA_MIN_N;
    const h90 = few ? '0%' : pct(b.p90), hm = few ? '0%' : pct(b.med); if (p90.style.height !== h90) p90.style.height = h90; if (med.style.height !== hm) med.style.height = hm;
    g.classList.toggle('now', today && h === slot.h); g.classList.toggle('sel', h === selH); g.classList.toggle('few', !!st && few);
    const tend = few ? null : b.tend; put(dir, tend === 'up' ? '▲' : tend === 'down' ? '▼' : ''); const dc = `vb-dir${tend ? ' ' + tend : ''}`; if (dir.className !== dc) dir.className = dc;
  });
  // Strich „letzte 60 Minuten“ auf der Säule der aktuellen Stunde
  const live = $('vola-live'), showLive = today && cur != null;
  if (showLive) { const g = bars.children[slot.h]; if (live.parentElement !== g) g.append(live); const y = pct(cur); if (live.style.bottom !== y) live.style.bottom = y; }
  if (live.hidden === showLive) live.hidden = !showLive;
  // Gewählte (sonst aktuelle) Stunde: typische Spanne, 9 von 10 darunter, Richtung; daneben die letzten 60 Minuten
  const b = bs?.[selH], few = !b || b.n < VOLA_MIN_N;
  put($('vola-sel-t'), `${volaHours(selH)}${today && selH === slot.h ? ' (jetzt)' : ''} · ${volaDayName(day)}${st ? ` · ${few ? 'zu wenige Stunden' : number(b.n, 0) + ' Std.'}` : ''}`);
  const back = $('vola-back'), away = vola.sel != null || vola.day != null; if (back.hidden === away) back.hidden = !away;
  put($('vola-med'), st && !few ? volaPct(b.med) : '—'); put($('vola-p90'), st && !few ? volaPct(b.p90) : '—');
  put($('vola-dir'), st ? volaDirText(b) : '');
  const dirCls = `vola-dirv${!few && b.n >= VOLA_MIN_DIR && b.tend ? ' ' + b.tend : ''}`; if ($('vola-dir').className !== dirCls) $('vola-dir').className = dirCls;
  const bNow = st?.[todayK][slot.h], thr = vola.cfg.warn;
  vola.level = state.paused ? 0 : volaLevel(cur, bNow, thr, vola.level);
  // Einstufung in der Übersicht: wie die Warnung; ist die Warnung aus, nach den stärksten 5 % (die Übersicht bleibt ehrlich)
  const lv = thr ? vola.level : volaLevel(cur, bNow, 95, 0);
  const ratio = cur != null && bNow?.med > 0 && bNow.n >= VOLA_MIN_N ? cur / bNow.med : null;
  const verdict = cur == null || ratio == null ? '' : lv === 2 ? 'stark erhöht' : lv === 1 ? 'erhöht' : ratio < 0.6 ? 'ruhiger als üblich' : 'im üblichen Rahmen';
  put($('vola-now'), cur == null ? (st && (vola.m1busy || !vola.m1retry) ? 'wird geladen …' : '—') : `${volaPct(cur)} Spanne${ratio != null ? ` · ${number(ratio, 1)}× üblich` : ''}`);
  put($('vola-badge'), !verdict ? '' : lv === 2 ? 'stark erhöht' : lv === 1 ? 'erhöht' : ratio < 0.6 ? 'ruhig' : 'üblich');
  const nb = $('vola-nowbox'); if (nb.dataset.level !== String(lv)) nb.dataset.level = String(lv);
  const nt = cur == null ? 'Spanne der letzten 60 Minuten (Hoch bis Tief aus den 1m-Kerzen)' : `Spanne der letzten 60 Minuten: ${volaPct(cur)}${ratio != null ? ` = ${number(ratio, 1)}-mal die typische Spanne um ${volaHours(slot.h)} (${volaDayName(todayK)})` : ''} – ${verdict || 'noch kein Vergleich'}`;
  if (nb.title !== nt) nb.title = nt;
  live.classList.toggle('lv2', lv === 2); live.classList.toggle('lv1', lv === 1);
  // Warnung in der Live-Leiste (antippen: zur Übersicht)
  const chip = $('lb-vola'), warnOn = vola.level > 0;
  if (warnOn) {
    const full = `⚡ Volatilität ${vola.level === 2 ? 'stark ' : ''}erhöht${ratio != null ? ` · ${number(ratio, 1)}× üblich` : ''}`;
    put(chip.querySelector('.lv-full'), full); put(chip.querySelector('.lv-short'), `⚡ Vola ${ratio != null ? number(ratio, 1) + '×' : vola.level === 2 ? 'stark erhöht' : 'erhöht'}`);
    const q = vola.level === 2 ? 99 : thr;
    const ct = `${coin(state.symbol)}: Spanne der letzten 60 Minuten ${volaPct(cur)} – stärker als in ${q} % der vergleichbaren Stunden (${volaDayName(todayK)}, ${volaHours(slot.h)} ± 1 Stunde, ab ${volaPct(bNow['p' + q])}). Der Kurs schwankt stärker als üblich, in beide Richtungen.`;
    if (chip.title !== ct) chip.title = ct;
    chip.classList.toggle('strong', vola.level === 2);
  }
  if (chip.hidden === warnOn) chip.hidden = !warnOn;
}
// Sekundentakt: Zwischenspeicher beim Coinwechsel, Stundenkerzen alle 6 h (nur Neues), 1m-Kerzen einmal je Coin (danach der
// Stream); Anzeige alle 5 s oder bei neuen Daten – über calmDo wie alle Live-Anzeigen (beim Scrollen wartet sie, danach bleibt
// der sichtbare Inhalt stehen)
var volaCalm = () => renderVola();
function volaTick(now) {
  if (!vola?.cfg || !$('vola')) return;
  if (state.paused) { if (!$('lb-vola').hidden) calmDo(volaCalm); return; }
  const sym = state.symbol;
  if (vola.sym !== sym) {
    Object.assign(vola, { sym, loaded: false, rows: null, market: '', at: 0, error: '', retryAt: 0, stats: null, statsKey: '', m1: [], m1sym: '', m1market: '', m1retry: 0, sel: null, level: 0 });
    vola.rev++;
    void volaDbGet(sym).then(v => { if (vola.sym !== sym) return; if (v && !vola.rows) Object.assign(vola, { rows: v.rows, market: v.m, at: v.at }); vola.loaded = true; vola.rev++; });
  }
  const cm = chartMarket();
  if (vola.loaded && cm && state.loadedSymbol === sym) {
    if (!vola.busy && now >= vola.retryAt && (!vola.at || now - vola.at > VOLA_EVERY || vola.market !== cm)) void volaFetch(sym, cm).then(() => calmDo(volaCalm));
    if (vola.m1sym === sym && !(vola.m1.at(-1)?.time > now - 3 * 60e3)) vola.m1sym = ''; // Stream steht (nur REST, Verbindung weg): neu laden
    if (!vola.m1busy && vola.m1sym !== sym && now >= vola.m1retry) void volaLoadM1(sym).then(() => calmDo(volaCalm));
  }
  if (document.hidden) return;
  const k = `${Math.floor(now / 5e3)}|${vola.rev}|${sym}`;
  if (k !== vola.key) { vola.key = k; calmDo(volaCalm); }
}
(function volaUi() {
  const box = $('vola'); if (!box) return;
  const v = store.get(VOLA_KEY); vola.cfg = { warn: [0, 90, 95, 99].includes(v?.warn) ? v.warn : 95 };
  const sel = $('vola-warn'), bars = $('vola-bars'), nowH = () => volaSlot(Date.now()).h;
  const redraw = () => { vola.rev++; calmDo(volaCalm); }, pick = h => { vola.sel = h === nowH() && !vola.day ? null : h; redraw(); };
  sel.value = String(vola.cfg.warn);
  sel.addEventListener('change', () => { vola.cfg = { ...vola.cfg, warn: Number(sel.value) }; store.set(VOLA_KEY, vola.cfg); vola.level = 0; redraw(); });
  for (const b of box.querySelectorAll('[data-vday]')) b.addEventListener('click', () => { vola.day = b.dataset.vday === (volaSlot(Date.now()).we ? 'we' : 'wd') ? null : b.dataset.vday; redraw(); });
  // Säule antippen oder Pfeiltasten: diese Stunde beschreiben; „jetzt“ (oder Esc) zurück zur aktuellen Stunde und Tagesart
  bars.addEventListener('click', e => {
    const g = e.target.closest('.vb'), r = bars.getBoundingClientRect();
    pick(g ? Number(g.dataset.h) : Math.max(0, Math.min(23, Math.floor((e.clientX - r.left) / r.width * 24))));
  });
  bars.addEventListener('keydown', e => {
    const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key], cur = vola.sel ?? nowH();
    if (d) pick((cur + d + 24) % 24);
    else if (e.key === 'Home' || e.key === 'End') pick(e.key === 'Home' ? 0 : 23);
    else if (e.key === 'Escape' && (vola.sel != null || vola.day)) { vola.sel = null; vola.day = null; redraw(); }
    else return;
    e.preventDefault();
  });
  $('vola-back').addEventListener('click', () => { vola.sel = null; vola.day = null; redraw(); });
  renderVola();
})();
