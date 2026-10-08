// G14: tatsächliche reine Farbprüfung aus dem HTML, keine Rechenkopie.
const fs = require('fs'), vm = require('vm'); let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
const html = fs.readFileSync(require('path').join(__dirname, '../weather-widget-v2.html'), 'utf8');
const source = html.slice(html.indexOf('window.__sdAppearance ='), html.indexOf('// Design, Layout und Tab vor'));
const context = { window: {} }; vm.runInNewContext(source, context); const a = context.window.__sdAppearance;
check('WCAG Schwarz/Weiß exakt 21:1, symmetrisch, CSS-Kurzform und identische Farbe 1:1', a.contrast('#000000', '#ffffff') === 21 && a.contrast('#fff', '#000') === 21 && a.contrast('#ffffff', '#000000') === 21 && a.contrast('#abcdef', '#abcdef') === 1);
check('Bekannter sRGB-Wert #777/Weiß ohne Rundungsfreigabe', Math.abs(a.contrast('#777777', '#ffffff') - 4.478089453577214) < 1e-10);
check('Hex normalisiert; ungültige Eingaben sicher abgelehnt', a.normalize(' #ABCDEF ') === '#abcdef' && [null, {}, '#fff', 'red', '#00000000', '#zzzzzz'].every(v => !a.evaluate(v).ok && a.build(v) === null));
check('Weiß gültig mit dunkler, Schwarz gültig mit heller Schrift', a.evaluate('#ffffff').theme === 'light' && a.evaluate('#000000').theme === 'dark' && a.evaluate('#ffffff').ok && a.evaluate('#000000').ok);
check('Mittleres Grau fällt mit beiden bestehenden Textpaletten durch', !a.evaluate('#777777').ok && a.evaluate('#777777').ratio < 4.5);
check('Acht verschiedene Vorschläge, je vier helle/dunkle Hintergründe', a.palette.length === 8 && new Set(a.palette.map(p => p.color)).size === 8 && a.palette.filter(p => a.evaluate(p.color).theme === 'light').length === 4);
for (const p of a.palette) check(p.name + ': Text AA; Neben-/Status-/Chartfarben AA und Rahmen 3:1', (() => {
  const b = a.build(p.color), fg = ['text', 'text-2', 'label', 'muted', 'faint', 'up-text', 'down-text', 'warn-text', 'err-text', 'violet-text', 'c-up', 'c-down', 'c-bb'];
  return b && b.ratio >= 4.5 && fg.every(n => b.backgrounds.every(bg => a.contrast(b.vars['--' + n], bg) >= 4.5)) && b.backgrounds.every(bg => a.contrast(b.vars['--border'], bg) >= 3);
})());
for (const c of ['#000000', '#ffffff', '#888800', '#005588', '#ff00ff']) check(c + ': eigene Farbe mit lesbaren Buttonbeschriftungen', (() => {
  const b = a.build(c); return b && ['mint', 'buy', 'sell'].every(n => a.contrast(b.vars['--' + n], b.vars['--' + n + '-ink']) >= 4.5);
})());
for (const c of ['#777777', '#887066', '#6c7e7f']) check(c + ': Vorschlag lesbar und nächstliegend auf Hell-/Dunkel-Strecke', (() => {
  const suggestion = a.suggest(c); if (!a.evaluate(suggestion).ok) return false;
  const rgb = v => [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)), input = rgb(c), distance = v => rgb(v).reduce((s, x, i) => s + (x - input[i]) ** 2, 0);
  const d = distance(suggestion); for (const target of [0, 255]) for (let i = 0; i <= 1024; i++) {
    const candidate = '#' + input.map(x => Math.round(x + (target - x) * i / 1024).toString(16).padStart(2, '0')).join('');
    if (a.evaluate(candidate).ok && distance(candidate) < d) return false;
  } return true;
})());
check('Gültige Farben bleiben identisch, ungültiger Text ohne Vorschlag', a.suggest('#ffffff') === '#ffffff' && a.suggest('invalid') === null);
console.log(`${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
