// G13: tatsächlicher erzeugter Lieferstand, Hashes, Importgraph und Versionsbindung.
const fs = require('fs'), path = require('path'), cp = require('child_process'); let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
(async () => {
  const root = path.resolve(__dirname, '..'), html = fs.readFileSync(path.join(root, 'weather-widget-v2.html'), 'utf8'), sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const version = /APP_VERSION = '([^']+)'/.exec(html)[1], base = path.join(root, 'bundles', version);
  let generated = true; try { cp.execFileSync(process.execPath, ['tools/build-release.mjs', '--check'], { cwd: root, stdio: 'pipe' }); } catch { generated = false; }
  check('PWA-/Server-Lieferlisten und tatsächliche Module reproduzierbar aktuell', generated);
  check('App/Service Worker identische Version, eigener unveränderlicher Workerpfad', /VERSION = '([^']+)'/.exec(sw)[1] === version && html.includes("new URL('./bundles/" + version + "/shared/confluence-worker.mjs"));
  const manifest = JSON.parse(fs.readFileSync(path.join(base, 'manifest.json'))); let missing = false;
  for (const entry of manifest.files.filter(x => x.path.endsWith('.mjs'))) { const file = path.join(root, entry.path.slice(2)), source = fs.readFileSync(file, 'utf8');
    for (const [, relative] of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) if (relative.startsWith('.') && !fs.existsSync(path.resolve(path.dirname(file), relative))) missing = true; }
  check('Jeder relative Modulimport bleibt in vollständigem Releasegraph importierbar', !missing);
  check('QR-Bibliothek mit unverändertem Lizenztext geliefert', fs.existsSync(path.join(base, 'vendor/jsQR.js')) && fs.readFileSync(path.join(base, 'vendor/jsQR.LICENSE.txt')).equals(fs.readFileSync(path.join(root, 'vendor/jsQR.LICENSE.txt'))));
  check('SVG-Musterkatalog bleibt im versionierten HTML, keine neue Erkennungsengine', html.includes('function patSvg(') && fs.readFileSync(path.join(base, 'server/pattern-engine.mjs')).equals(fs.readFileSync(path.join(root, 'server/pattern-engine.mjs'))));
  check('Service Worker syntaktisch gültig und löscht keinen persönlichen Datenspeicher', (() => { try { new Function(sw); return !/indexedDB\.deleteDatabase|localStorage\.clear/.test(sw); } catch { return false; } })());
  console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
