// G13: reproduzierbare öffentliche Modulbündel und Installer-Prüfliste. Keine Nutzerdaten.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), check = process.argv.includes('--check');
const read = name => fs.readFileSync(path.join(root, name));
const app = read('weather-widget-v2.html').toString(), version = /APP_VERSION = '([^']+)'/.exec(app)?.[1];
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('App-Version fehlt');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const bundle = 'bundles/' + version, files = [];
function write(name, bytes) { const target = path.join(root, name); if (check) { if (!fs.existsSync(target) || !fs.readFileSync(target).equals(Buffer.from(bytes))) throw new Error('Lieferstand veraltet: ' + name); } else { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); } }
const parts = [...fs.readdirSync(path.join(root, 'shared')).filter(x => x.endsWith('.mjs')).sort().map(x => 'shared/' + x), 'server/pattern-engine.mjs', 'vendor/jsQR.js', 'vendor/jsQR.LICENSE.txt', 'data/muster-start.json'];
for (const name of parts) { const bytes = read(name), target = bundle + '/' + name; write(target, bytes); files.push({ path: './' + target, sha256: sha(bytes), bytes: bytes.length, alias: './' + name }); }
for (const name of ['weather-widget-v2.html', 'manifest.webmanifest', 'status-check.html', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png']) { const bytes = read(name); files.push({ path: './' + name, sha256: sha(bytes), bytes: bytes.length }); }
const manifest = JSON.stringify({ version, files }, null, 2) + '\n'; write(bundle + '/manifest.json', manifest);
const sw = read('sw.js').toString().replace(/const VERSION = '[^']+';/, "const VERSION = '" + version + "';").replace(/const BUILD_ID = '[^']+';/, "const BUILD_ID = '" + sha(manifest).slice(0, 16) + "';"); write('sw.js', sw);
const serverFiles = ['server/scalpdesk-247.mjs', 'server/pattern-engine.mjs', 'server/pattern-monitor.mjs', 'server/ki-monitor.mjs', 'server/orderflow-explainer.mjs', 'server/install.sh', ...parts.filter(x => x.startsWith('shared/'))];
const server = { version: /VERSION = '([^']+)'/.exec(read('server/scalpdesk-247.mjs').toString())[1], appVersion: version,
  files: serverFiles.map(name => ({ path: name.startsWith('server/') ? name.slice(7) : name, sha256: sha(read(name)), bytes: read(name).length })) };
write('server/release-manifest.json', JSON.stringify(server, null, 2) + '\n');
if (!app.includes("from './" + bundle + '/shared/') || app.includes("from './shared/") || !app.includes("new URL('./" + bundle + '/shared/confluence-worker.mjs')) throw new Error('HTML/Worker nicht auf eigene Bündelversion gebunden');
console.log(`${check ? 'Geprüft' : 'Erzeugt'}: App ${version}, Dienst ${server.version}, ${files.length} PWA-Dateien, ${server.files.length} Dienstdateien`);
