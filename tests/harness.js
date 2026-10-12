// Test-Gerüst: statischer Server fürs Repo, Binance-Mock, Chromium mit Host-Umleitung.
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node22/lib/node_modules/playwright'); } })();
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const REPO = require('path').resolve(__dirname, '..'), PORT = 8765;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css', '.txt': 'text/plain' };
let staticServer, mock;
function startStatic() {
  return new Promise(r => {
    staticServer = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x'); let p = path.join(REPO, decodeURIComponent(u.pathname));
      if (!p.startsWith(REPO)) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
      if (!fs.existsSync(p)) { res.writeHead(404); return res.end('nf'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-cache' });
      fs.createReadStream(p).pipe(res);
    }).listen(PORT, '127.0.0.1', r);
  });
}
function startMock() {
  return new Promise((resolve, reject) => {
    mock = spawn('node', [path.join(__dirname, 'mock-binance.js')], { stdio: ['ignore', 'pipe', 'pipe'] });
    mock.stdout.on('data', d => { if (String(d).includes('mock ready')) resolve(); });
    mock.stderr.on('data', d => process.stderr.write('[mock] ' + d));
    mock.on('exit', c => reject(new Error('mock exited ' + c)));
  });
}
const ctl = async (p) => { const r = await fetch('http://127.0.0.1:8790' + p); return r.json(); };
async function launch(opts = {}) {
  for (const k of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']) delete process.env[k];
  const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server', '--host-resolver-rules=MAP *.binance.com 127.0.0.1, MAP *.binance.vision 127.0.0.1, MAP data-api.binance.vision 127.0.0.1, MAP api.telegram.org 127.0.0.1, MAP discord.com 127.0.0.1, MAP raw.githubusercontent.com 127.0.0.1, MAP api.coingecko.com 127.0.0.1, MAP api.coinpaprika.com 127.0.0.1, MAP api.coinlore.net 127.0.0.1', '--ignore-certificate-errors', ...(opts.args || [])] });
  if (opts.workspace !== 'fresh') {
    const createContext = browser.newContext.bind(browser);
    browser.newContext = async (...args) => { const ctx = await createContext(...args); if (opts.watch !== 'fresh') await ctx.addInitScript(() => { try { if (!localStorage.getItem('scalpdesk.wlspan.v1')) localStorage.setItem('scalpdesk.wlspan.v1', '"1h"'); } catch {} }); await ctx.addInitScript(legacyWidgetFixture); return ctx; };
  }
  return browser;
}
// Isolierte ältere Widgettests benötigen alle Originalformulare gleichzeitig.
// Die Gesamtansicht ist kein App-Angebot mehr: nur diese Testfixture ordnet die
// echten Knoten zurück, ohne App-Code, Berechnungen oder gespeicherte Daten zu ändern.
// Native Navigation/Gerätewahl immer mit launch({workspace:'fresh'}) prüfen.
function legacyWidgetFixture() {
  const prepare = (attempt = 0) => {
    const byId = id => document.getElementById(id), root = document.documentElement;
    // Die App startet in einem asynchronen Modul; load kann vor dessen Aufbau kommen.
    if (!byId('workspace-watch')) { if (byId('market-form') && attempt < 180) requestAnimationFrame(() => prepare(attempt + 1)); return; }
    root.dataset.workspace = 'fixture';
    const css = document.createElement('style');
    css.textContent = 'html[data-workspace=fixture] .workspace-nav,html[data-workspace=fixture] #workspace-settings,html[data-workspace=fixture] .workspace-actions{display:none!important}html[data-workspace=fixture] .workspace-fold{display:contents}html[data-workspace=fixture] .workspace-fold>summary{display:none}'; document.head.append(css);
    for (const id of ['view', 'notify']) { const node = byId(id + '-panel'); byId(id + '-menu').closest('.menu-wrap').append(node); node.classList.remove('workspace-menu'); node.hidden = true; }
    for (const id of ['data-toggle', 'data-panel']) byId('pos-over').append(byId(id));
    document.querySelector('.calc-side').append(byId('model-settings'));
    byId('market-form').append(byId('watchlist'));
    document.querySelector('.of-chart-grid').prepend(byId('orderflow-panel'));
    const pane = document.querySelector('.of-chart-pane');
    for (const node of document.querySelectorAll('#workspace-chart-tools .wh-strip,#workspace-chart-tools .lm-strip,#workspace-chart-tools .fib-strip,#workspace-chart-tools .chart-footer')) pane.append(node);
    for (const id of ['ki-setup', 'ki-settings']) byId(id).open = true;
    // Bereichswechsel aktualisieren weiterhin die App, dürfen in dieser Fixture
    // die ursprünglichen Popup-Menüs aber nicht ungefragt öffnen.
    new MutationObserver(() => { for (const id of ['view', 'notify']) { const n = byId(id + '-panel'); if (byId(id + '-menu').getAttribute('aria-expanded') !== 'true') n.hidden = true; } }).observe(root, { attributes: true, attributeFilter: ['data-workspace-view'] });
    for (const id of ['view', 'notify']) { const b = byId(id + '-menu'), n = byId(id + '-panel'); let wasHidden;
      b.addEventListener('click', () => { wasHidden = n.hidden; }, { capture: true });
      b.addEventListener('click', () => { n.hidden = !wasHidden; b.setAttribute('aria-expanded', String(wasHidden)); });
    }
  };
  addEventListener('load', () => prepare());
}
// Reine CSS-Matrix alter Widgettests; kein entfernter Layout-Schalter wird vorgetäuscht.
const presentationFixture = (page, value) => page.evaluate(value => { document.documentElement.dataset.presentation = value; }, value);
async function setup() { await startStatic(); await startMock(); }
async function teardown() { staticServer?.close(); mock?.kill(); }
function collect(page, bag) {
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) bag.push(`[console.${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => bag.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
  page.on('worker', w => w.on('console', m => { if (m.type() === 'error') bag.push(`[worker] ${m.text()}`); }));
}
const URL_BASE = `http://127.0.0.1:${PORT}`;
module.exports = { launch, setup, teardown, ctl, collect, presentationFixture, URL_BASE, sleep: ms => new Promise(r => setTimeout(r, ms)) };
