// Alte Modulbündel (bundles/<Version>/) aufräumen (3.83.0). Behalten werden:
//   - die neuesten fünf Versionen (--keep N ändert die Zahl), darunter immer die aktuelle APP_VERSION,
//   - jede Version, die ein Test als Vergleichsstand lädt (bundles/X.Y.Z in tests/*.js, *.mjs, *.sh).
// Warum gefahrlos: Der Service Worker liefert die HTML und die Module aus dem eigenen Programmcache (aktueller und ein vorheriger
// Stand bleiben dort) und lädt beim Update nur das neue Bündel. Ältere Bündel auf dem Server braucht nur ein Tab, der über mehrere
// Updates hinweg nie neu geladen wurde – mit fünf behaltenen Versionen praktisch ausgeschlossen. Die Git-Historie behält alles.
//
//   node tools/prune-bundles.mjs            löschen
//   node tools/prune-bundles.mjs --dry-run  nur anzeigen
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), dry = argv.includes('--dry-run'), keepAt = argv.indexOf('--keep'), KEEP = keepAt >= 0 ? Number(argv[keepAt + 1]) : 5;
if (!Number.isInteger(KEEP) || KEEP < 2) throw new Error('--keep braucht eine ganze Zahl ab 2');
const semver = v => v.split('.').map(Number), byVersion = (a, b) => { const x = semver(a), y = semver(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };

export function testedBundles(root = ROOT) {
  const out = new Set(), dir = path.join(root, 'tests');
  for (const f of fs.readdirSync(dir)) if (/\.(js|mjs|sh)$/.test(f)) for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/bundles\/(\d+\.\d+\.\d+)\//g)) out.add(m[1]);
  return out;
}
export function bundlePlan(root = ROOT, keep = KEEP) {
  const all = fs.readdirSync(path.join(root, 'bundles')).filter(v => /^\d+\.\d+\.\d+$/.test(v)).sort(byVersion);
  const current = /APP_VERSION = '([^']+)'/.exec(fs.readFileSync(path.join(root, 'weather-widget-v2.html'), 'utf8'))?.[1];
  if (!current || !all.includes(current)) throw new Error(`Bündel der aktuellen App-Version ${current || '?'} fehlt – zuerst node tools/build-release.mjs`);
  const kept = new Set([...all.slice(-keep), current, ...testedBundles(root)]);
  return { all, current, kept: all.filter(v => kept.has(v)), removed: all.filter(v => !kept.has(v)) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const plan = bundlePlan();
  console.log(`Behalten (${plan.kept.length}): ${plan.kept.join(' ')}`);
  console.log(`${dry ? 'Würde löschen' : 'Lösche'} (${plan.removed.length}): ${plan.removed.join(' ') || '–'}`);
  if (!dry) for (const v of plan.removed) fs.rmSync(path.join(ROOT, 'bundles', v), { recursive: true, force: true });
}
