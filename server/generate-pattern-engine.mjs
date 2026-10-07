// 3.42.0 (G09 C6b): reine App-Engine unverändert für den Dienst erzeugen.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const html = fs.readFileSync(new URL('weather-widget-v2.html', root), 'utf8');
const begin = html.indexOf('function patEngine() {');
const end = html.indexOf('\n// ---- 3.37.0 (G09): zentrale Musterbibliothek', begin);
if (begin < 0 || end < 0) throw new Error('Muster-Engine nicht eindeutig gefunden.');
const engine = html.slice(begin, end).trim();
const lib = html.slice(end, html.indexOf('\nconst PAT_MAX', end));
const names = Object.fromEntries([...lib.matchAll(/^\s+([a-z_]+): F\('([^']+)'/gm)].map(m => [m[1], m[2]]));
if (Object.keys(names).length !== 19) throw new Error('Formationenkatalog unvollständig.');
const output = '// Automatisch aus weather-widget-v2.html erzeugt; nicht von Hand ändern.\n// Neu erzeugen: node server/generate-pattern-engine.mjs\nexport ' + engine + '\n\nexport const PAT_NAMES = ' + JSON.stringify(names, null, 2) + ';\n';
fs.writeFileSync(fileURLToPath(new URL('pattern-engine.mjs', import.meta.url)), output);
