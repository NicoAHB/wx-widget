// FVG-Chart mit lokaler KI (fvg-ki/, Python): Dash-Oberfläche im echten Browser – Boxen grün/rot mit Deckkraft 0,2,
// Knopf „FVG: an/aus“ blendet sie ein und aus, „?“ öffnet und schließt die Erklärung, „KI neu lernen“ trainiert lokal
// und beschriftet offene Boxen mit der Qualität; am Handy ohne seitliches Scrollen. Dazu die Python-Tests (pytest).
// Python mit pandas, plotly, dash, scikit-learn, pytest: FVG_PYTHON=/pfad/zu/python (Standard python3). Fehlen die
// Bibliotheken, wird der Test übersprungen (pip install -r fvg-ki/requirements.txt).
// Aufruf: node m104.js
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node22/lib/node_modules/playwright'); } })();
const { spawn, spawnSync } = require('child_process'), path = require('path'), fs = require('fs'), os = require('os'), http = require('http');
const results = [];
const check = (name, cond, detail = '') => { results.push({ name, ok: !!cond }); console.log(`${cond ? '  ✓' : '  ✗'} ${name}${detail !== '' ? ' — ' + String(detail).slice(0, 500) : ''}`); };
const PY = process.env.FVG_PYTHON || 'python3', DIR = path.resolve(__dirname, '..', 'fvg-ki'), PORT = 8077;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = url => new Promise(res => http.get(url, r => { r.resume(); res(r.statusCode); }).on('error', () => res(0)));

(async () => {
  const deps = spawnSync(PY, ['-c', 'import pandas, numpy, plotly, dash, sklearn, joblib, pytest'], { encoding: 'utf8' });
  if (deps.status !== 0) { console.log(`  – übersprungen: Python-Bibliotheken fehlen (${PY}; pip install -r fvg-ki/requirements.txt)\n\n0/0 bestanden`); process.exit(0); }
  // 1) Python-Tests
  const py = spawnSync(PY, ['-m', 'pytest', '-q', '-p', 'no:cacheprovider'], { cwd: DIR, encoding: 'utf8', timeout: 600e3 });
  const last = (py.stdout || '').trim().split('\n').at(-1) || '';
  check('pytest fvg-ki: Erkennung, Mitigation, Merkmale, Label, Modell, SQLite, retrain, Chart, Dash', py.status === 0 && /passed/.test(last) && !/failed|error/.test(last), last || py.stderr);
  // 2) Oberfläche
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fvg-'));
  const srv = spawn(PY, ['app.py', '--port', String(PORT), '--db', path.join(tmp, 'f.sqlite'), '--model', path.join(tmp, 'm.joblib'), '--backend', 'random_forest'], { cwd: DIR, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });
  try {
    let up = false; for (let i = 0; i < 100 && !up; i++) { up = (await get(`http://127.0.0.1:${PORT}/`)) === 200; if (!up) await sleep(300); }
    check('Dash-Server startet lokal (ohne Cloud)', up, log.slice(-300));
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://127.0.0.1:${PORT}/`); await page.waitForSelector('#fvg-chart .js-plotly-plot', { timeout: 20000 }); await sleep(800);
    const shapes = () => page.evaluate(() => (document.querySelector('#fvg-chart .js-plotly-plot').layout.shapes || []).map(s => ({ fill: s.fillcolor, label: s.label?.text || '', name: s.name })));
    let s = await shapes();
    check('Boxen da: grün (bullisch) und rot (bärisch), Deckkraft 0,2', s.length > 20 && s.some(x => x.fill === 'rgba(0, 200, 83, 0.2)') && s.some(x => x.fill === 'rgba(213, 0, 0, 0.2)') && s.every(x => /, 0\.2\)$/.test(x.fill)), `${s.length} Boxen`);
    check('Erster Start: Modell aus den gespeicherten FVGs gelernt, Qualität an offenen Boxen', s.some(x => /^KI \d+ %$/.test(x.label)), JSON.stringify(s.filter(x => x.label).slice(0, 3)));
    const pos = await page.evaluate(() => { const a = document.getElementById('fvg-toggle').getBoundingClientRect(), b = document.getElementById('fvg-info-btn').getBoundingClientRect(); return { gap: b.left - a.right, dy: Math.abs(a.top - b.top) }; });
    check('Info-Knopf „?“ direkt neben „FVG: an“', pos.gap >= 0 && pos.gap < 20 && pos.dy < 4, JSON.stringify(pos));
    await page.click('#fvg-toggle'); await sleep(700); s = await shapes();
    const t1 = await page.evaluate(() => ({ txt: document.getElementById('fvg-toggle').textContent, pressed: document.getElementById('fvg-toggle').getAttribute('aria-pressed') }));
    check('Klick „FVG“: Boxen ausgeblendet, Knopf „FVG: aus“', s.length === 0 && t1.txt === 'FVG: aus' && t1.pressed === 'false', JSON.stringify(t1));
    await page.click('#fvg-toggle'); await sleep(700); s = await shapes();
    check('Erneuter Klick: Boxen wieder da, Knopf „FVG: an“', s.length > 20 && (await page.textContent('#fvg-toggle')) === 'FVG: an');
    const title = await page.getAttribute('#fvg-info-btn', 'title');
    check('Hover über „?“ zeigt die Kurzfassung', /Kerze 1 und Kerze 3/.test(title || ''), title);
    await page.click('#fvg-info-btn'); await sleep(400);
    const m = await page.evaluate(() => { const d = document.getElementById('fvg-info-modal'); return { hidden: d.hidden, vis: d.getBoundingClientRect().height > 0, txt: d.textContent }; });
    check('Klick „?“: Erklärfenster offen (Marktungleichgewicht zwischen Kerze 1 und 3)', !m.hidden && m.vis && /Marktungleichgewicht/.test(m.txt) && /Kerze 1/.test(m.txt) && /Kerze 3/.test(m.txt), m.txt.slice(0, 120));
    await page.click('#fvg-info-close'); await sleep(400);
    check('„Schließen“ schließt das Fenster', await page.evaluate(() => document.getElementById('fvg-info-modal').hidden));
    await page.click('#fvg-retrain'); await page.waitForFunction(() => /KI neu gelernt/.test(document.getElementById('fvg-status').textContent), null, { timeout: 30000 }).catch(() => {});
    const st = await page.textContent('#fvg-status');
    check('„KI neu lernen“: lokal neu trainiert, Kennzahlen im Status', /^KI neu gelernt: \d+ Fälle \(\d+ abgeprallt, \d+ durchbrochen\) – trainiert, Trefferquote \(Kreuzvalidierung\) \d+ % bei Basis \d+ %/.test(st || ''), st);
    check('Lokale SQLite-Datenbank und Modelldatei angelegt', fs.existsSync(path.join(tmp, 'f.sqlite')) && fs.existsSync(path.join(tmp, 'm.joblib')));
    await page.setViewportSize({ width: 390, height: 844 }); await sleep(800);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check('Handy (390 px): kein seitliches Scrollen, Knöpfe sichtbar', ov <= 1 && await page.isVisible('#fvg-info-btn'), ov);
    await page.screenshot({ path: path.join(tmp, 'fvg.png') }); console.log(`BILD fvg: ${path.join(tmp, 'fvg.png')}`);
    check('keine Fehler im Browser', !errors.length, errors.join(' | '));
  } catch (e) { check('Abbruch', false, e.stack || e.message); }
  finally { await browser.close(); srv.kill(); }
  const bad = results.filter(r => !r.ok); console.log(`\n${results.length - bad.length}/${results.length} bestanden`); process.exit(bad.length ? 1 : 0);
})();
