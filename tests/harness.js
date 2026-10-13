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
    browser.newContext = async (options = {}) => {
      const { scalpdeskNative, ...contextOptions } = options, ctx = await createContext(contextOptions);
      if (scalpdeskNative) return ctx;
      if (opts.watch !== 'fresh') await ctx.addInitScript(() => { try { if (!localStorage.getItem('scalpdesk.wlspan.v1')) localStorage.setItem('scalpdesk.wlspan.v1', '"1h"'); } catch {} });
      await ctx.addInitScript(legacyWidgetFixture, { presentation: opts.presentation || 'standard' }); return ctx;
    };
  }
  return browser;
}
// Isolierte ältere Widgettests benötigen alle Originalformulare gleichzeitig.
// Die Gesamtansicht ist kein App-Angebot mehr: nur diese Testfixture ordnet die
// echten Knoten zurück. Der bestehende Diagnosezugriff isoliert nur den UI-Kontext;
// sämtliche Widgetfunktionen, Berechnungen, Daten, Original-HTML und SW bleiben echt.
// Native Navigation/Gerätewahl immer mit launch({workspace:'fresh'}) prüfen.
function legacyWidgetFixture(options) {
  const prepare = (attempt = 0) => {
    const byId = id => document.getElementById(id), root = document.documentElement;
    // Die App startet in einem asynchronen Modul; load kann vor dessen Aufbau kommen.
    if (!byId('workspace-watch')) { if (byId('market-form') && attempt < 180) requestAnimationFrame(() => prepare(attempt + 1)); return; }
    root.dataset.workspace = 'fixture';
    window.__g05.workspace.mode = 'fixture'; // Kein App-Angebot: nur isolierte ältere Widget-Prüfungen.
    if (options.presentation !== 'device') root.dataset.presentation = options.presentation;
    const css = document.createElement('style');
    css.textContent = 'html[data-workspace=fixture] .workspace-nav,html[data-workspace=fixture] #workspace-settings,html[data-workspace=fixture] .workspace-actions{display:none!important}html[data-workspace=fixture] .workspace-fold{display:contents}html[data-workspace=fixture] .workspace-fold>summary{display:none}'; document.head.append(css);
    for (const id of ['view', 'notify']) { const node = byId(id + '-panel'); byId(id + '-menu').closest('.menu-wrap').append(node); node.classList.remove('workspace-menu'); node.hidden = true; }
    for (const id of ['data-toggle', 'data-panel']) byId('pos-over').append(byId(id));
    document.querySelector('.calc-side').append(byId('model-settings'));
    byId('market-form').append(byId('watchlist'));
    document.querySelector('.of-chart-grid').append(byId('orderflow-panel'));
    const pane = document.querySelector('.of-chart-pane');
    const fib = document.querySelector('#workspace-chart-tools .fib-strip');
    if (fib) pane.insertBefore(fib, pane.querySelector('.lmap-strip'));
    for (const selector of ['.wh-strip', '.chart-footer']) { const node = document.querySelector('#workspace-chart-tools ' + selector); if (node) pane.append(node); }
    // Auch leere <details display:contents> behalten eine anonyme Inhaltsbox.
    // Nach Rückgabe ihrer Originalknoten entfernen, sonst entsteht ein falscher Grid-Platz.
    for (const node of window.__g05.workspace.wrappers) node.remove();
    // Ursprüngliche Tab-Präferenz der isolierten Widgettests, einschließlich Reload.
    // Jetzt erledigen die Originalhandler auch Menüplatzierung/Schließen selbst.
    try { const tab = JSON.parse(localStorage.getItem('scalpdesk.tab.v1')); if (['chart', 'calc', 'pos', 'ind'].includes(tab)) byId('tabbar').querySelector(`[data-tab="${tab}"]`).click(); } catch {}
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
