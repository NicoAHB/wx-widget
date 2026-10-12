// Dieselbe Gerätezuordnung wie vor dem ersten Zeichnen, ohne Browser-/Formelkopie.
const fs = require('fs'), vm = require('vm'), path = require('path');
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
const html = fs.readFileSync(path.join(__dirname, '../weather-widget-v2.html'), 'utf8');
const source = html.slice(html.indexOf('window.__sdDeviceView ='), html.indexOf('// Design, Layout und Tab vor'));
const context = { window: {} }; vm.runInNewContext(source, context);
const view = context.window.__sdDeviceView;
const cases = [
  ['iPhone hochkant', 'iPhone', 'iPhone', 5, 390, 844, true, 'standard'],
  ['iPhone quer', 'iPhone', 'iPhone', 5, 844, 390, true, 'standard'],
  ['iPhone mit Maus', 'iPhone', 'iPhone', 5, 844, 390, false, 'standard'],
  ['iPod', 'iPod', 'iPod', 5, 320, 568, true, 'standard'],
  ['Android-Handy', 'Linux; Android 14; Mobile', 'Linux armv8', 5, 412, 915, true, 'standard'],
  ['Android-Faltgerät', 'Linux; Android 14; Mobile', 'Linux armv8', 5, 900, 1200, true, 'standard'],
  ['iPad mit normaler Kennung', 'iPad', 'iPad', 5, 768, 1024, true, 'dashboard'],
  ['iPad mit Desktopkennung', 'Macintosh', 'MacIntel', 5, 1024, 1366, true, 'dashboard'],
  ['iPad Desktopkennung und Maus', 'Macintosh', 'MacIntel', 5, 1024, 1366, false, 'dashboard'],
  ['iPad Mini Split View', 'Macintosh', 'MacIntel', 5, 768, 1024, true, 'dashboard'],
  ['Android-Tablet', 'Linux; Android 14', 'Linux armv8', 5, 800, 1280, true, 'dashboard'],
  ['kleines Android-Tablet', 'Linux; Android 14', 'Linux armv8', 5, 540, 720, true, 'dashboard'],
  ['Windows-PC', 'Windows NT 10.0', 'Win32', 0, 1920, 1080, false, 'dashboard'],
  ['Windows Touch-PC', 'Windows NT 10.0', 'Win32', 10, 1920, 1080, true, 'dashboard'],
  ['Windows mit kleinem Bildschirm', 'Windows NT 10.0', 'Win32', 5, 540, 720, true, 'dashboard'],
  ['Mac', 'Macintosh', 'MacIntel', 0, 1512, 982, false, 'dashboard'],
  ['Linux-PC', 'X11; Linux x86_64', 'Linux x86_64', 0, 1920, 1080, false, 'dashboard'],
  ['unbekanntes kleines Touch-Gerät', '', '', 5, 390, 844, true, 'standard'],
  ['unbekanntes großes Touch-Gerät', '', '', 5, 800, 1280, true, 'dashboard'],
  ['fehlende Gerätefläche sicher', '', '', 5, 0, 0, true, 'dashboard']
];
for (const [name, userAgent, platform, maxTouchPoints, width, height, coarse, expected] of cases) check(name, view({ userAgent, platform, maxTouchPoints }, { width, height }, coarse).presentation === expected);
check('Client Hint Mobile unterstützt', view({ userAgentData: { mobile: true }, maxTouchPoints: 5 }, { width: 800, height: 1000 }, true).presentation === 'standard');
check('iPad hat Vorrang vor irreführendem Mobile-Hint', view({ userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 5, userAgentData: { mobile: true } }, { width: 800, height: 1000 }, true).presentation === 'dashboard');
console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
