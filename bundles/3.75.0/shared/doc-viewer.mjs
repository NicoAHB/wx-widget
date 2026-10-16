// 3.68.4: Anleitungen aus docs/*.md in der App lesen – als Fenster mit „Schließen“. Vorher öffnete ein Link die rohe Markdown-Datei;
// am iPhone als Web-App (Home-Bildschirm) gab es dann keinen Weg zurück. Kleiner, sicherer Markdown-Teil ohne HTML-Durchreichen:
// Überschriften, Absätze, nummerierte und einfache Listen, Codeblöcke, Tabellen, Trennlinien, fett, Inline-Code und Links.
const SAFE_LINK = /^(https?:\/\/|\.{0,2}\/|[\w-]+(\/[\w.-]+)*\.md(#.*)?$|#)/i;

function inline(doc, parent, text) {
  const re = /(`[^`]+`)|(\*\*(?:[^*]|\*(?!\*))+\*\*)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  let at = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > at) parent.append(text.slice(at, m.index));
    if (m[1]) { const c = doc.createElement('code'); c.textContent = m[1].slice(1, -1); parent.append(c); }
    else if (m[2]) { const b = doc.createElement('strong'); inline(doc, b, m[2].slice(2, -2)); parent.append(b); }
    else {
      const href = m[5];
      if (SAFE_LINK.test(href)) { const a = doc.createElement('a'); a.setAttribute('href', href); if (/^https?:/i.test(href)) { a.target = '_blank'; a.rel = 'noopener'; } inline(doc, a, m[4]); parent.append(a); }
      else inline(doc, parent, m[4]);
    }
    at = re.lastIndex;
  }
  if (at < text.length) parent.append(text.slice(at));
  return parent;
}
const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

export function renderMarkdown(md, doc = globalThis.document) {
  const out = doc.createDocumentFragment(), lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  let para = null, list = null, title = '';
  const flush = () => { para = null; list = null; };
  const el = (tag, cls) => { const n = doc.createElement(tag); if (cls) n.className = cls; return n; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) { // Codeblock bis zum schließenden ```
      flush(); const pre = el('pre'), code = el('code'), body = [];
      while (++i < lines.length && !/^```/.test(lines[i])) body.push(lines[i]);
      code.textContent = body.join('\n'); pre.append(code); out.append(pre); continue;
    }
    if (!line.trim()) { flush(); continue; }
    let m;
    if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) {
      flush(); if (m[1].length === 1 && !title) { title = m[2].trim(); continue; } // erste Hauptüberschrift = Fenstertitel
      out.append(inline(doc, el('h' + Math.min(4, m[1].length + 1)), m[2].trim())); continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flush(); out.append(el('hr')); continue; }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) { // Tabelle mit Kopfzeile
      flush(); const wrap = el('div', 'doc-table'), table = el('table'), thead = el('thead'), tbody = el('tbody'), head = el('tr');
      for (const c of cells(line)) head.append(inline(doc, el('th'), c));
      thead.append(head); i++;
      while (i + 1 < lines.length && /^\s*\|/.test(lines[i + 1])) { const tr = el('tr'); for (const c of cells(lines[++i])) tr.append(inline(doc, el('td'), c)); tbody.append(tr); }
      table.append(thead, tbody); wrap.append(table); out.append(wrap); continue;
    }
    const ol = /^\s*(\d+)[.)]\s+(.*)$/.exec(line), ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (ol || ul) {
      const tag = ol ? 'ol' : 'ul';
      if (!list || list.tagName.toLowerCase() !== tag) { list = el(tag); if (ol && ol[1] !== '1') list.start = Number(ol[1]); out.append(list); }
      para = inline(doc, el('li'), (ol ? ol[2] : ul[1]).trim()); list.append(para); continue;
    }
    if ((m = /^>\s?(.*)$/.exec(line))) { flush(); out.append(inline(doc, el('blockquote'), m[1])); continue; }
    if (para) { para.append(' '); inline(doc, para, line.trim()); continue; } // Fortsetzung von Absatz oder Listenpunkt
    list = null; para = inline(doc, el('p'), line.trim()); out.append(para);
  }
  return { fragment: out, title };
}

export function createDocViewer({ doc = globalThis.document, fetchText = async url => { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); } } = {}) {
  const dialog = doc.createElement('dialog'); dialog.className = 'sheet doc-viewer'; dialog.id = 'doc-viewer'; dialog.setAttribute('aria-labelledby', 'doc-viewer-title');
  const head = doc.createElement('div'), title = doc.createElement('h2'), close = doc.createElement('button'), body = doc.createElement('div');
  head.className = 'sheet-head'; title.id = 'doc-viewer-title'; close.type = 'button'; close.className = 'button ghost doc-viewer-close'; close.id = 'doc-viewer-close'; close.textContent = '✕ Schließen'; close.setAttribute('aria-label', 'Anleitung schließen');
  body.className = 'sheet-body doc-viewer-body'; body.id = 'doc-viewer-body'; head.append(title, close); dialog.append(head, body); doc.body.append(dialog);
  let seq = 0;
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => {
    if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); return; }
    const a = e.target.closest?.('a[href]'), href = a?.getAttribute('href') || '';
    if (a && !/^https?:|^#/i.test(href) && /\.md(#.*)?$/i.test(href)) { e.preventDefault(); void open(new URL(href, dialog.dataset.url || doc.baseURI).href); } // Verweise auf weitere Anleitungen im selben Fenster
  });
  async function open(url, fallbackTitle = 'Anleitung') {
    const my = ++seq; dialog.dataset.url = url; title.textContent = fallbackTitle; body.replaceChildren(Object.assign(doc.createElement('p'), { className: 'muted', textContent: 'Anleitung wird geladen …' }));
    if (!dialog.open) dialog.showModal(); body.scrollTop = 0;
    try {
      const { fragment, title: t } = renderMarkdown(await fetchText(url), doc); if (my !== seq) return;
      title.textContent = t || fallbackTitle; body.replaceChildren(fragment); body.scrollTop = 0;
    } catch (e) {
      if (my !== seq) return;
      const p = doc.createElement('p'); p.textContent = `Die Anleitung konnte nicht geladen werden (${e.message || 'keine Verbindung'}). Bitte Internetverbindung prüfen und erneut öffnen.`; body.replaceChildren(p);
    }
    close.focus({ preventScroll: true });
  }
  return { open, dialog, close: () => dialog.close() };
}
