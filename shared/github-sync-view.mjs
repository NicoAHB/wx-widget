import { GITHUB_DEFAULTS, readGithubDevice, saveGithubDevice, createGithubClient, encryptGithubBackup, decryptGithubBackup } from './github-sync.mjs';
const document = globalThis.document;
const node = (tag, text, cls) => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('de-DE') : 'noch kein Sync';
// 3.68.4: Einrichtung übersichtlich in drei Schritten (Repository · Zugang · Gerät), Felder mit Rahmen, Token-Einfügen, Statuszeile;
// die Anleitung öffnet in der App (openGuide) statt als rohe Markdown-Datei.
const GH_TOKEN_RE = /\b(github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,})\b/;
export const parseGithubToken = text => GH_TOKEN_RE.exec(String(text || ''))?.[1] || null;
export function createGithubSyncView({ host, storage, collect, apply, undo, hasUndo, onSaved, hintHost, openGuide }) {
  let cfg = readGithubDevice(storage), busy = false, newer = null, askResolve = null;
  const root = node('details', '', 'github-sync'); root.id = 'github-sync'; root.open = true;
  root.append(node('summary', 'Verschlüsselt mit GitHub sichern'));
  const body = node('div', '', 'github-sync-body'), actions = node('div', '', 'github-sync-actions'), status = node('p', '', 'github-sync-status'); status.id = 'github-sync-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const info = node('p', 'Trades, Einstellungen und Vorauswahl verschlüsselt in deinem privaten GitHub-Repository – zum Abgleich zwischen deinen Geräten. Zugangsdaten und Übungen bleiben auf diesem Gerät.', 'github-sync-info');
  const state = node('p', '', 'github-sync-state'); state.id = 'github-sync-state';
  const last = node('dl', '', 'github-sync-last'); last.id = 'github-sync-last';
  const setup = node('details', '', 'github-sync-setup'), setupHead = node('summary'), setupState = node('span', '', 'github-sync-setup-state');
  setupHead.append(node('span', 'GitHub einrichten', 'github-sync-setup-title'), setupState); setup.append(setupHead);
  const form = node('div', '', 'github-sync-fields'), inputs = {};
  const field = (key, title, type, hint) => {
    const label = node('label', '', 'github-sync-field'), input = node('input'); label.append(node('span', title, 'github-sync-label'));
    input.id = 'github-sync-' + key; input.type = type; input.value = typeof cfg[key] === 'string' ? cfg[key] : GITHUB_DEFAULTS[key]; input.autocomplete = 'off'; input.spellcheck = false; input.autocapitalize = 'none'; input.setAttribute('autocorrect', 'off'); input.enterKeyHint = 'done'; label.htmlFor = input.id;
    if (hint) input.placeholder = hint;
    inputs[key] = input;
    if (key === 'token') { const wrap = node('span', '', 'github-sync-token'), paste = node('button', 'Einfügen', 'button ghost github-sync-paste'); paste.type = 'button'; paste.id = 'github-sync-token-paste'; paste.setAttribute('aria-label', 'GitHub-Token aus der Zwischenablage einfügen');
      paste.addEventListener('click', async () => { let text = ''; try { text = await globalThis.navigator.clipboard.readText(); } catch { status.textContent = 'Einfügen wurde nicht erlaubt – lange ins Token-Feld tippen und „Einfügen“ wählen.'; input.focus(); return; }
        const token = parseGithubToken(text); if (!token) { status.textContent = 'In der Zwischenablage steht kein GitHub-Token (beginnt mit github_pat_…).'; return; }
        input.value = token; input.dispatchEvent(new globalThis.Event('input', { bubbles: true })); status.textContent = 'Token eingefügt und auf diesem Gerät gespeichert.'; });
      wrap.append(input, paste); label.append(wrap); } else label.append(input);
    input.addEventListener('input', () => {
      const oldTarget = [cfg.owner, cfg.repo, cfg.branch, cfg.path].join('|'); cfg = { ...cfg, ...Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value])) };
      if (oldTarget !== [cfg.owner, cfg.repo, cfg.branch, cfg.path].join('|')) { cfg.lastSync = null; newer = null; showHint(); }
      try { saveGithubDevice(storage, cfg); status.textContent = 'Einstellungen auf diesem Gerät gespeichert.'; } catch (e) { status.textContent = e.message; }
      render();
    });
    return label;
  };
  const step = (n, title, text, ...fields) => { const box = node('section', '', 'github-sync-step'), h = node('h4'); h.append(node('span', String(n), 'github-sync-num'), title); box.append(h); if (text) box.append(node('p', text, 'github-sync-step-text')); const grid = node('div', '', 'github-sync-grid'); grid.append(...fields); box.append(grid); return box; };
  form.append(
    step(1, 'Repository', 'Dein privates Daten-Repository auf GitHub (getrennt vom App-Code).', field('owner', 'GitHub-Name (Owner)', 'text'), field('repo', 'Repository (privat)', 'text'), field('branch', 'Branch', 'text'), field('path', 'Datei', 'text')),
    step(2, 'Zugang', 'Fine-grained Token mit Zugriff nur auf dieses Repository und „Contents: Read and write“. Bleibt nur auf diesem Gerät.', field('token', 'GitHub-Token', 'password', 'github_pat_…')),
    step(3, 'Dieses Gerät', 'Erscheint bei jeder Sicherung, damit du siehst, von welchem Gerät sie stammt.', field('device', 'Gerätename', 'text')));
  const note = node('p', 'Die Passphrase wird erst beim Sichern oder Laden abgefragt und nie gespeichert. Ein vergessenes Passwort lässt sich nicht wiederherstellen.', 'github-sync-note');
  let guide;
  if (openGuide) { guide = node('button', '📖 Anleitung Schritt für Schritt', 'button ghost github-sync-guide'); guide.type = 'button'; guide.id = 'github-sync-guide'; guide.addEventListener('click', () => openGuide('./docs/GITHUB-SYNC.md', 'Verschlüsselte GitHub-Sicherung')); }
  else { guide = node('a', 'Anleitung Schritt für Schritt', 'github-sync-guide'); guide.href = './docs/GITHUB-SYNC.md'; guide.target = '_blank'; guide.rel = 'noopener'; }
  form.append(note, guide); setup.append(form);
  const save = node('button', 'Auf GitHub sichern', 'button primary-lite'), load = node('button', 'Von GitHub laden', 'button primary-lite'), revert = node('button', 'Rückgängig · Stand vor GitHub-Laden', 'button ghost');
  save.id = 'github-sync-save'; load.id = 'github-sync-load'; revert.id = 'github-sync-undo'; for (const b of [save, load, revert]) b.type = 'button'; actions.append(save, load, revert);
  body.append(info, state, last, actions, setup, status); root.append(body); host.prepend(root);
  const hint = node('div', '', 'github-sync-hint'); hint.id = 'github-sync-hint'; hint.hidden = true; hint.setAttribute('role', 'status');
  const hintText = node('span'), hintLoad = node('button', 'Laden …', 'button primary-lite'), dismiss = node('button', 'Später', 'button ghost'); hintLoad.type = dismiss.type = 'button'; hint.append(hintText, hintLoad, dismiss); hintHost?.append(hint);
  dismiss.addEventListener('click', () => { newer = null; showHint(); }); hintLoad.addEventListener('click', () => { void run('load'); });
  const dialog = node('dialog', '', 'github-sync-dialog'); dialog.id = 'github-sync-dialog'; const passForm = node('form'); passForm.method = 'dialog';
  const title = node('h3'), explanation = node('p'), password = node('input'), label = node('label', 'Passphrase'), buttons = node('div', '', 'github-sync-actions'), accept = node('button', '', 'button primary-lite'), cancel = node('button', 'Abbrechen', 'button ghost');
  title.id = 'github-sync-dialog-title'; dialog.setAttribute('aria-labelledby', title.id); explanation.id = 'github-sync-confirm-info'; password.type = 'password'; password.autocomplete = 'off'; password.id = 'github-sync-passphrase'; label.htmlFor = password.id; label.append(password);
  accept.id = 'github-sync-confirm'; accept.type = 'submit'; cancel.type = 'button'; buttons.append(accept, cancel); passForm.append(title, explanation, label, buttons); dialog.append(passForm); document.body.append(dialog);
  function endAsk(value = null) { password.value = ''; const resolve = askResolve; askResolve = null; dialog.close(); resolve?.(value); }
  passForm.addEventListener('submit', e => { e.preventDefault(); if (!password.value.trim()) { password.setCustomValidity('Bitte eine Passphrase eingeben.'); password.reportValidity(); return; } endAsk(password.value); });
  password.addEventListener('input', () => password.setCustomValidity('')); cancel.addEventListener('click', () => endAsk()); dialog.addEventListener('cancel', e => { e.preventDefault(); endAsk(); }); dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) endAsk(); } });
  function ask(kind, file) {
    title.textContent = kind === 'save' ? 'Verschlüsselt sichern' : 'GitHub-Stand laden?';
    explanation.textContent = kind === 'save' ? 'Merke dir diese Passphrase. Nur damit kannst du die Sicherung auf einem anderen Gerät öffnen.' : `Gesichert am ${date(file.savedAt)} · Gerät: ${file.device}. Mit deiner Bestätigung werden die Daten entschlüsselt und abgeglichen. Unterschiedliche Änderungen bleiben zur Entscheidung erhalten. Der bisherige Stand wird vorher als Notfallkopie gesichert.`;
    accept.textContent = kind === 'save' ? 'Verschlüsseln & sichern' : 'Bestätigen & laden'; password.value = ''; password.setCustomValidity(''); dialog.showModal(); password.focus(); return new Promise(resolve => { askResolve = resolve; });
  }
  function showHint() { hint.hidden = !newer; if (newer) hintText.textContent = `Neuerer Stand verfügbar – laden? ${date(newer.savedAt)} · ${newer.device}`; }
  function render() {
    for (const b of [save, load, revert, hintLoad]) b.disabled = busy;
    for (const input of Object.values(inputs)) input.disabled = busy;
    revert.hidden = !hasUndo();
    const rows = [['Letzter Abgleich', date(cfg.lastSync?.at)], ['Dieses Gerät', cfg.device || GITHUB_DEFAULTS.device], ...(cfg.lastSync?.device ? [['Sicherung von', cfg.lastSync.device]] : [])];
    last.replaceChildren(...rows.flatMap(([k, v]) => [node('dt', k), node('dd', v)]));
    const ready = !!(cfg.owner && cfg.repo && cfg.branch && cfg.path && cfg.token), missing = [!cfg.owner && 'GitHub-Name', !cfg.repo && 'Repository', !cfg.token && 'Token'].filter(Boolean);
    state.dataset.ready = String(ready); state.textContent = ready ? `✓ Eingerichtet: ${cfg.owner}/${cfg.repo}` : `Noch nicht eingerichtet – unter „GitHub einrichten“ fehlt: ${missing.join(', ') || 'Angaben'}.`;
    setupState.textContent = ready ? '✓ eingerichtet' : 'unvollständig'; setupState.dataset.ready = String(ready);
    setup.open ||= !cfg.token; showHint();
  }
  async function run(kind) {
    if (busy) return; busy = true; render();
    try {
      const client = createGithubClient(cfg); let remote = null, passphrase = null;
      if (kind === 'load') { status.textContent = 'Sicherung wird ohne Cache abgerufen …'; remote = await client.file(); }
      passphrase = await ask(kind, remote?.envelope);
      if (passphrase === null) { status.textContent = 'Abgebrochen. Der lokale Stand bleibt erhalten.'; return; }
      try {
        if (kind === 'save') {
          status.textContent = 'Sicherung wird im Browser verschlüsselt …'; const data = await collect();
          const envelope = await encryptGithubBackup(data, passphrase, cfg.device); status.textContent = 'Verschlüsselte Datei wird auf GitHub gesichert …'; remote = await client.upload(envelope);
          onSaved?.(); status.textContent = 'Verschlüsselte Sicherung auf GitHub gespeichert.';
        } else {
          status.textContent = 'Sicherung wird entschlüsselt …'; const data = await decryptGithubBackup(remote.envelope, passphrase);
          status.textContent = await apply(data); newer = null;
        }
      } finally { passphrase = null; }
      cfg.lastSync = { at: new Date().toISOString(), savedAt: remote.envelope.savedAt, device: remote.envelope.device, sha: remote.sha };
      saveGithubDevice(storage, cfg);
    } catch (e) { status.textContent = e.message || 'GitHub-Sync fehlgeschlagen. Der lokale Stand bleibt erhalten.'; }
    finally { busy = false; render(); }
  }
  save.addEventListener('click', () => { void run('save'); }); load.addEventListener('click', () => { void run('load'); });
  revert.addEventListener('click', async () => { if (busy || !globalThis.confirm('Zum Stand vor dem letzten GitHub-Laden zurückkehren? Änderungen seit diesem Laden werden dabei rückgängig gemacht.')) return; busy = true; render(); try { status.textContent = await undo(); cfg.lastSync = null; saveGithubDevice(storage, cfg); } catch (e) { status.textContent = e.message; } finally { busy = false; render(); } });
  async function checkNewer() {
    if (!cfg.token || busy) return;
    const target = [cfg.owner, cfg.repo, cfg.branch, cfg.path, cfg.token].join('|');
    try {
      const remote = await createGithubClient(cfg).file({ allowMissing: true });
      if (target !== [cfg.owner, cfg.repo, cfg.branch, cfg.path, cfg.token].join('|') || busy) return;
      if (remote && Date.parse(remote.envelope.savedAt) > (Date.parse(cfg.lastSync?.savedAt) || 0) && remote.sha !== cfg.lastSync?.sha) { newer = remote.envelope; showHint(); }
    } catch { /* Startprüfung bleibt still. Fehler werden beim bewusst gestarteten Sync erklärt. */ }
  }
  render(); void checkNewer(); return { checkNewer, render, root };
}
