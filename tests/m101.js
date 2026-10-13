// 3.68.4: GitHub-Einrichtung übersichtlich (Status, drei Schritte, Felder mit Rahmen, Token-Einfügen) und Anleitungen in der App
// (docs/*.md als Fenster mit „Schließen“ statt roher Markdown-Datei ohne Rückweg).
const h = require('./harness');
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + String(detail).slice(0, 300) : ''}`); };
const TOKEN = 'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyzABCDEFGH';
(async () => {
  await h.setup(); await h.ctl('/reset'); const browser = await h.launch({ workspace: 'fresh' });
  try {
    // ---- Markdown-Darstellung (Modul direkt im Browser) ----
    {
      const ctx = await browser.newContext(), page = await ctx.newPage();
      await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => window.__docViewer);
      const md = await page.evaluate(async () => {
        const { renderMarkdown } = await import('./shared/doc-viewer.mjs'), box = document.createElement('div');
        const { fragment, title } = renderMarkdown('# Titel\n\nText mit **fett** und `code` und [Link](https://example.org) und [böse](javascript:alert(1)).\n\n1. Eins\n2. Zwei **B**\n\n- a\n- b\n\n## Abschnitt\n\n```\nsudo x <b>\n```\n\n| A | B |\n|---|---|\n| 1 | <i>2</i> |\n\n<script>alert(1)</script>');
        box.append(fragment);
        return { title, h3: box.querySelector('h3')?.textContent, strong: box.querySelector('p strong')?.textContent, code: box.querySelector('p code')?.textContent, ext: box.querySelector('a[href^="https"]')?.target, js: [...box.querySelectorAll('a')].some(a => /javascript/i.test(a.getAttribute('href'))), ol: box.querySelectorAll('ol li').length, ul: box.querySelectorAll('ul li').length, pre: box.querySelector('pre code')?.textContent, td: [...box.querySelectorAll('td')].map(t => t.textContent), tags: box.querySelectorAll('script, b, i').length, raw: /\*\*|```/.test(box.textContent) };
      });
      check('Markdown: Titel aus #, Überschrift, fett, Code, Listen, Codeblock, Tabelle', md.title === 'Titel' && md.h3 === 'Abschnitt' && md.strong === 'fett' && md.code === 'code' && md.ol === 2 && md.ul === 2 && md.pre === 'sudo x <b>' && md.td.join() === '1,<i>2</i>' && !md.raw, JSON.stringify(md));
      check('Markdown sicher: kein HTML durchgereicht, keine javascript:-Links, externe Links in neuem Fenster', md.tags === 0 && !md.js && md.ext === '_blank', JSON.stringify({ tags: md.tags, js: md.js, ext: md.ext }));
      await ctx.close();
    }
    for (const [width, height] of [[390, 844], [1440, 900]]) {
      const mobile = width < 800, ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, permissions: ['clipboard-read', 'clipboard-write'] }), page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const tap = sel => mobile ? page.tap(sel) : page.click(sel);
      await page.goto(h.URL_BASE + '/weather-widget-v2.html'); await page.waitForFunction(() => window.__githubSync && window.__g05);
      await page.evaluate(() => { document.querySelector('[data-workspace-target="settings"]').click(); document.getElementById('data-panel').hidden = false; document.getElementById('github-sync').scrollIntoView(); });
      await page.waitForTimeout(300);
      // ---- Nicht eingerichtet ----
      const fresh = await page.evaluate(() => { const st = document.getElementById('github-sync-state'), setup = document.querySelector('.github-sync-setup'), steps = [...document.querySelectorAll('.github-sync-step h4')].map(h => h.textContent), inp = document.getElementById('github-sync-owner'), cs = getComputedStyle(inp);
        return { ready: st.dataset.ready, text: st.textContent, open: setup.open, chip: document.querySelector('.github-sync-setup-state').textContent, steps, border: parseFloat(cs.borderTopWidth), bg: cs.backgroundColor, rows: [...document.querySelectorAll('#github-sync-last dt')].map(d => d.textContent) }; });
      check(`${width}px: nicht eingerichtet – Statuszeile nennt, was fehlt; Einrichtung offen; Chip „unvollständig“`, fresh.ready === 'false' && /fehlt: .*Token/.test(fresh.text) && fresh.open && fresh.chip === 'unvollständig', JSON.stringify(fresh));
      check(`${width}px: drei nummerierte Schritte, Felder mit sichtbarem Rahmen, Abgleich-Angaben als Liste`, fresh.steps.join('|') === '1Repository|2Zugang|3Dieses Gerät' && fresh.border >= 1 && fresh.bg !== 'rgba(0, 0, 0, 0)' && fresh.rows.join('|').startsWith('Letzter Abgleich|Dieses Gerät'), JSON.stringify(fresh));
      // ---- Token per Knopf einfügen ----
      await page.evaluate(t => navigator.clipboard.writeText(`Your token: ${t}\nKeep it secret`), TOKEN);
      await page.locator('#github-sync-token-paste').scrollIntoViewIfNeeded(); await tap('#github-sync-token-paste');
      await page.waitForFunction(() => document.getElementById('github-sync-token').value);
      const tok = await page.evaluate(() => ({ value: document.getElementById('github-sync-token').value, type: document.getElementById('github-sync-token').type, saved: JSON.parse(localStorage.getItem('scalpdesk-github-device.v1') || '{}').token, status: document.getElementById('github-sync-status').textContent, ready: document.getElementById('github-sync-state').dataset.ready, chip: document.querySelector('.github-sync-setup-state').textContent }));
      check(`${width}px: Token aus der Zwischenablage eingefügt, verdeckt, lokal gespeichert; Status „Eingerichtet“`, tok.value === TOKEN && tok.type === 'password' && tok.saved === TOKEN && /eingefügt/.test(tok.status) && !tok.status.includes(TOKEN) && tok.ready === 'true' && tok.chip === '✓ eingerichtet', JSON.stringify({ ...tok, value: tok.value === TOKEN, saved: tok.saved === TOKEN }));
      await page.evaluate(() => navigator.clipboard.writeText('kein token')); await tap('#github-sync-token-paste'); await page.waitForTimeout(200);
      check(`${width}px: ohne Token in der Zwischenablage bleibt das Feld unverändert`, await page.evaluate(t => document.getElementById('github-sync-token').value === t && /kein GitHub-Token/.test(document.getElementById('github-sync-status').textContent), TOKEN));
      // ---- Anleitung in der App ----
      await page.locator('#github-sync-guide').scrollIntoViewIfNeeded(); const url0 = page.url(); await tap('#github-sync-guide');
      await page.waitForFunction(() => document.getElementById('doc-viewer').open && document.querySelector('#doc-viewer-body ol li'));
      const guide = await page.evaluate(() => { const d = document.getElementById('doc-viewer'), r = d.getBoundingClientRect(), c = document.getElementById('doc-viewer-close').getBoundingClientRect(), b = document.getElementById('doc-viewer-body'); return { title: document.getElementById('doc-viewer-title').textContent, steps: b.querySelectorAll('ol > li').length, table: !!b.querySelector('table'), raw: /\*\*|^#/m.test(b.textContent), inView: r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1, closeIn: c.top >= r.top && c.right <= r.right && c.height >= 36, close: document.getElementById('doc-viewer-close').textContent, scrolls: b.scrollHeight > b.clientHeight }; });
      check(`${width}px: „Anleitung Schritt für Schritt“ öffnet ein Fenster in der App: formatiert (4 Schritte, Tabelle, kein roher Markdown-Text)`, page.url() === url0 && guide.title === 'Verschlüsselte GitHub-Sicherung' && guide.steps === 4 && guide.table && !guide.raw && guide.scrolls, JSON.stringify(guide));
      check(`${width}px: Fenster passt auf den Bildschirm, Knopf „✕ Schließen“ oben sichtbar`, guide.inView && guide.closeIn && /Schließen/.test(guide.close), JSON.stringify(guide));
      await page.evaluate(() => { const b = document.getElementById('doc-viewer-body'); b.scrollTop = b.scrollHeight; }); await page.waitForTimeout(100);
      check(`${width}px: auch nach dem Scrollen bleibt „Schließen“ erreichbar`, await page.evaluate(() => { const r = document.getElementById('doc-viewer-close').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('#doc-viewer-close') !== null; }));
      await tap('#doc-viewer-close'); await page.waitForTimeout(150);
      check(`${width}px: Schließen kehrt zur Einrichtung zurück`, await page.evaluate(() => !document.getElementById('doc-viewer').open && !!document.getElementById('github-sync-guide').offsetParent));
      await tap('#github-sync-guide'); await page.waitForFunction(() => document.getElementById('doc-viewer').open); await page.keyboard.press('Escape'); await page.waitForTimeout(150);
      check(`${width}px: Esc schließt die Anleitung ebenfalls`, await page.evaluate(() => !document.getElementById('doc-viewer').open));
      // ---- Oracle-Anleitung im Telegram-Fenster: ebenfalls in der App ----
      await page.evaluate(() => document.getElementById('chan-open').click()); await page.waitForFunction(() => document.getElementById('chan-dialog').open);
      const oracle = page.locator('#chan-dialog a[href="./docs/ORACLE_24-7.md"]'); await page.evaluate(() => { const a = document.querySelector('#chan-dialog a[href="./docs/ORACLE_24-7.md"]'); a.closest('details')?.setAttribute('open', ''); a.scrollIntoView({ block: 'center' }); });
      await oracle.click(); await page.waitForFunction(() => document.getElementById('doc-viewer').open && document.querySelector('#doc-viewer-body h2, #doc-viewer-body h3'));
      const oz = await page.evaluate(() => ({ title: document.getElementById('doc-viewer-title').textContent, pre: document.querySelectorAll('#doc-viewer-body pre').length, top: (() => { const d = document.getElementById('doc-viewer'); return document.elementFromPoint(innerWidth / 2, d.getBoundingClientRect().top + 30)?.closest('#doc-viewer') !== null; })() }));
      check(`${width}px: Link „Schritt-für-Schritt-Anleitung“ (Oracle) öffnet in der App über dem Telegram-Fenster, mit Codeblöcken`, page.url() === url0 && oz.pre > 3 && oz.top && /Oracle|24\/7/.test(oz.title), JSON.stringify(oz));
      await tap('#doc-viewer-close'); await page.waitForTimeout(150);
      check(`${width}px: nach dem Schließen ist das Telegram-Fenster noch offen, keine JavaScript-Fehler`, await page.evaluate(() => document.getElementById('chan-dialog').open && !document.getElementById('doc-viewer').open) && errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
  } finally { await browser.close(); await h.teardown(); }
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
