// 3.83.0 – Zentrale Liste der Speicherschlüssel (STORE_KEYS in weather-widget-v2.html). Verhindert die Fehlerklasse „neuer Schlüssel nur in
// einer von mehreren Listen eingetragen“: (1) keine doppelten Einträge, nur bekannte Kennbuchstaben; (2) jeder Schlüssel, der per
// broadcastData() an andere Tabs geht, steht im Tab-Abgleich (sonst verwirft der andere Tab ihn still – so war es beim Marktradar);
// (3) jeder Schlüssel im GitHub-Abgleich, der nicht zum Grundbestand von 3.71 gehört, darf in älteren Dateien fehlen (Kennbuchstabe o –
// sonst werden ältere GitHub-Dateien abgelehnt, so war es seit 3.74); (4) Sicherung ⊆ GitHub-Abgleich.
// Aufruf: node unit-store-keys.js
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${!ok && detail ? ' — ' + detail : ''}`); };
const html = fs.readFileSync(path.join(__dirname, '../weather-widget-v2.html'), 'utf8');
// Konstanten → Schlüsseltext (aus der App und aus shared/)
const names = {};
for (const f of fs.readdirSync(path.join(__dirname, '../shared')))
  for (const m of fs.readFileSync(path.join(__dirname, '../shared', f), 'utf8').matchAll(/export const ([A-Z][A-Z0-9_]+) *= *'(scalpdesk\.[^']+)'/g)) names[m[1]] ??= m[2];
for (const m of html.matchAll(/\b([A-Z][A-Z0-9_]+) = '(scalpdesk\.[^']+)'/g)) names[m[1]] ??= m[2];
const resolve = t => (t.startsWith("'") ? t.slice(1, -1) : names[t]);
const block = html.match(/const STORE_KEYS = \[([\s\S]*?)\n\];/);
check('Zentrale Liste STORE_KEYS vorhanden und Listen werden daraus erzeugt', !!block && /const PREF_KEYS = storeKeys\('b'\), SYNC_KEYS = storeKeys\('s'\)/.test(html) && !/^const (PREF_KEYS|SYNC_KEYS|GH_PREF_KEYS|GH_OPTIONAL_KEYS) = \[/m.test(html));
const rows = [...block[1].matchAll(/\[('[^']+'|[A-Z][A-Z0-9_]+), '([a-z]+)'\]/g)].map(m => ({ token: m[1], key: resolve(m[1]), flags: m[2] }));
const unresolved = rows.filter(r => !r.key), keys = rows.map(r => r.key);
check('Alle Einträge auflösbar (Konstante bekannt)', !unresolved.length, unresolved.map(r => r.token).join(', '));
check('Keine doppelten Schlüssel', new Set(keys).size === keys.length, keys.filter((k, i) => keys.indexOf(k) !== i).join(', '));
check('Nur Kennbuchstaben b, s, g, o; o nur zusammen mit b oder g', rows.every(r => /^[bsgo]+$/.test(r.flags) && (!r.flags.includes('o') || /[bg]/.test(r.flags))), rows.filter(r => !/^[bsgo]+$/.test(r.flags)).map(r => r.token).join(', '));
const has = f => new Set(rows.filter(r => r.flags.includes(f)).map(r => r.key));
const SYNC = has('s'), PREF = has('b'), GH = new Set([...PREF, ...has('g')]), OPT = has('o');
// (2) broadcastData([...]) mit festen Schlüsseln
const sent = new Set();
for (const m of html.matchAll(/broadcastData\(\[([^\]]*)\]\)/g)) for (const t of m[1].split(',').map(x => x.trim()).filter(Boolean)) if (/^('[^']+'|[A-Z][A-Z0-9_]+)$/.test(t)) sent.add(resolve(t) || '??' + t);
const notSynced = [...sent].filter(k => !SYNC.has(k));
check(`Jeder an andere Tabs gesendete Schlüssel steht im Tab-Abgleich (${sent.size} geprüft)`, !notSynced.length, notSynced.join(', '));
// (3) Grundbestand des GitHub-Abgleichs (Dateiformat v1, Stand 3.71) – alles Neuere muss optional sein
const BASE = ['scalpdesk.acctrange.v1', 'scalpdesk.anaiv.v1', 'scalpdesk.background.v1', 'scalpdesk.chart-interval.v1', 'scalpdesk.cnews.v1', 'scalpdesk.daylimitnote.v1', 'scalpdesk.decouple.v1', 'scalpdesk.decrank.v1', 'scalpdesk.decspot.v1', 'scalpdesk.details.v1', 'scalpdesk.econ.v1', 'scalpdesk.evalyear.v1', 'scalpdesk.heikin.v1', 'scalpdesk.ki.risk-view.v1', 'scalpdesk.ki.settings.v1', 'scalpdesk.kizones.v1', 'scalpdesk.ladder.v1', 'scalpdesk.layout.v1', 'scalpdesk.muster.settings.v1', 'scalpdesk.orderbook.v1', 'scalpdesk.orderflow-journal.v1', 'scalpdesk.orderflow-position.v1', 'scalpdesk.orderflow-signal.v1', 'scalpdesk.orderflow.v1', 'scalpdesk.overlays.v1', 'scalpdesk.ovhide.v1', 'scalpdesk.paper.settings.v1', 'scalpdesk.patfilter.v1', 'scalpdesk.patknow.quarantine.v1', 'scalpdesk.patknow.v1', 'scalpdesk.pattern-projection.v1', 'scalpdesk.po3.settings.v1', 'scalpdesk.posdefaults.v1', 'scalpdesk.presentation.v1', 'scalpdesk.theme.v1', 'scalpdesk.titleprice.v1', 'scalpdesk.vola.v1', 'scalpdesk.warnclose.v1', 'scalpdesk.whale.v1', 'scalpdesk.wlspan.v1', 'scalpdesk.workspace.v1', 'scalpdesk.zigzag.v1', 'scalpdesk.zonesig.v1'];
const missingOpt = [...GH].filter(k => !BASE.includes(k) && !OPT.has(k));
check('Jeder neuere Schlüssel im GitHub-Abgleich ist optional (o) – ältere Dateien bleiben einlesbar', !missingOpt.length, missingOpt.join(', '));
check('Grundbestand vollständig im GitHub-Abgleich (nichts still entfernt)', BASE.every(k => GH.has(k)), BASE.filter(k => !GH.has(k)).join(', '));
check('Optionale Schlüssel sind wirklich im GitHub-Abgleich', [...OPT].every(k => GH.has(k)), [...OPT].filter(k => !GH.has(k)).join(', '));
// (4) Tab-Abgleich: adoptData filtert mit SYNC_KEYS, der storage-Ersatzweg ebenso
check('Tab-Abgleich nutzt SYNC_KEYS (adoptData und storage-Ereignis)', /if \(!SYNC_KEYS\.includes\(k\)\) continue;/.test(html) && /addEventListener\('storage', e => \{ if \(bc \|\| !SYNC_KEYS\.includes\(e\.key\)/.test(html));
console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
