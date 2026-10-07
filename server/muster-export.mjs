#!/usr/bin/env node
// Scalp Desk – Veröffentlichung des gemeinsamen Musterwissens (G09 C5)
// Aus dem bereinigten Archiv-Export (App: „Archiv vom Dienst als Datei sichern“ oder GET /v1/patterns/export) entsteht ein
// kleiner Veröffentlichungsbestand für GitHub Pages: data/muster/manifest.json (höchstens 64 KiB) und Statistikdateien
// stats-<n>.json (je höchstens 256 KiB, unkomprimiert), insgesamt höchstens 50 MiB. Nur Zählungen je Markt|Coin|Intervall|Muster,
// getrennt nach live protokolliert und rekonstruiert – keine Einzelkurse, keine persönlichen Daten. Die Revision zählt hoch.
// Veröffentlicht wird per Commit/Release; die App braucht dafür keinen Schreibschlüssel.
// Aufruf: node server/muster-export.mjs <export.json> [data/muster]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIMITS = { manifest: 64 * 1024, file: 256 * 1024, total: 50 * 1024 * 1024 };
export function buildPublication(exp, prev = null, now = Date.now()) {
  const cases = Array.isArray(exp?.cases) ? exp.cases : null;
  if (!cases) throw new Error('Keine gültige Exportdatei (Feld „cases“ fehlt).');
  const groups = {}; let until = 0, resolved = 0, valid = 0;
  for (const c of cases) {
    if (!c || typeof c.id !== 'string' || !c.mkt || !c.sym || !c.iv || !c.pat || c.model !== 'pat-1') continue;
    valid++;
    const k = [c.mkt, c.sym, c.iv, c.pat].join('|'), g = groups[k] ||= { live: { n: 0, auf: 0, ab: 0, sw: 0, offen: 0 }, rek: { n: 0, auf: 0, ab: 0, sw: 0, offen: 0 }, from: null, to: null };
    const part = c.src === 'live' ? g.live : g.rek;
    if (c.res && ['auf', 'ab', 'seitwärts'].includes(c.res.out)) { part.n++; part[c.res.out === 'seitwärts' ? 'sw' : c.res.out]++; resolved++; g.from = Math.min(g.from ?? c.tc, c.tc); g.to = Math.max(g.to ?? c.tc, c.tc); }
    else part.offen++;
    until = Math.max(until, Number(c.tc) || 0);
  }
  // Statistikdateien höchstens 256 KiB: Gruppen der Reihe nach verteilen
  const files = [], keys = Object.keys(groups).sort(); let cur = {};
  const size = o => Buffer.byteLength(JSON.stringify({ v: 1, groups: o }));
  for (const k of keys) { const next = { ...cur, [k]: groups[k] }; if (size(next) > LIMITS.file && Object.keys(cur).length) { files.push(cur); cur = { [k]: groups[k] }; } else cur = next; }
  if (Object.keys(cur).length) files.push(cur);
  const out = files.map((g, i) => ({ name: `stats-${i + 1}.json`, body: JSON.stringify({ v: 1, groups: g }) }));
  for (const f of out) if (Buffer.byteLength(f.body) > LIMITS.file) throw new Error(`${f.name} ist größer als 256 KiB – eine einzelne Gruppe ist zu groß.`);
  const manifest = { v: 1, rev: (prev?.rev || 0) + 1, date: now, until, model: 'pat-1', profile: 'H12-e0.10', cases: valid, resolved, groups: keys.length,
    files: out.map(f => ({ name: f.name, bytes: Buffer.byteLength(f.body), keys: Object.keys(JSON.parse(f.body).groups) })) };
  // Manifest klein halten: bei vielen Gruppen nur die Zuordnung Datei → erster/letzter Schlüssel
  let mBody = JSON.stringify(manifest);
  if (Buffer.byteLength(mBody) > LIMITS.manifest) { manifest.files = manifest.files.map(f => ({ name: f.name, bytes: f.bytes, first: f.keys[0], last: f.keys.at(-1) })); mBody = JSON.stringify(manifest); }
  if (Buffer.byteLength(mBody) > LIMITS.manifest) throw new Error('Manifest größer als 64 KiB.');
  const total = Buffer.byteLength(mBody) + out.reduce((s, f) => s + Buffer.byteLength(f.body), 0);
  if (total > LIMITS.total) throw new Error('Veröffentlichungsbestand größer als 50 MiB.');
  return { manifest, mBody, files: out, total };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [src, dir = 'data/muster'] = process.argv.slice(2);
  if (!src) { console.error('Aufruf: node server/muster-export.mjs <export.json> [data/muster]'); process.exit(2); }
  try {
    const exp = JSON.parse(fs.readFileSync(src, 'utf8')), mPath = path.join(dir, 'manifest.json');
    const prev = fs.existsSync(mPath) ? JSON.parse(fs.readFileSync(mPath, 'utf8')) : null, r = buildPublication(exp, prev);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) if (/^stats-\d+\.json$/.test(f)) fs.rmSync(path.join(dir, f));   // alte Statistikdateien ersetzen (rekonstruierbar)
    for (const f of r.files) fs.writeFileSync(path.join(dir, f.name), f.body);
    fs.writeFileSync(mPath, r.mBody);
    console.log(`Revision ${r.manifest.rev}: ${r.manifest.cases} Fälle, ${r.manifest.resolved} mit Ergebnis, ${r.manifest.groups} Gruppen, ${r.files.length} Statistikdatei(en), ${(r.total / 1024).toFixed(1)} KiB. Jetzt committen und pushen (GitHub Pages).`);
  } catch (e) { console.error('Fehler:', e.message); process.exit(1); }
}
