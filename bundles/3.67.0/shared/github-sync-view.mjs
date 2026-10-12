import { GITHUB_DEFAULTS, readGithubDevice, saveGithubDevice, createGithubClient, encryptGithubBackup, decryptGithubBackup } from './github-sync.mjs';
const document = globalThis.document;
const node = (tag, text, cls) => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('de-DE') : 'noch kein Sync';
export function createGithubSyncView({ host, storage, collect, apply, undo, hasUndo, onSaved, hintHost }) {
  let cfg = readGithubDevice(storage), busy = false, newer = null, askResolve = null;
  const root = node('details', '', 'github-sync'); root.id = 'github-sync'; root.open = true;
  root.append(node('summary', 'Verschlüsselt mit GitHub sichern'));
  const body = node('div', '', 'github-sync-body'), actions = node('div', '', 'github-sync-actions'), status = node('p', '', 'github-sync-status'); status.id = 'github-sync-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const info = node('p', 'Persönliche Trades, Einstellungen und Vorauswahl – verschlüsselt in deinem privaten Daten-Repository. Zugangsdaten und Übungen bleiben auf diesem Gerät.');
  const last = node('p', '', 'github-sync-last'); last.id = 'github-sync-last';
  const setup = node('details', '', 'github-sync-setup'); setup.append(node('summary', 'GitHub einrichten · Repository, Token & Gerät')); const form = node('div', '', 'github-sync-fields'), inputs = {};
  for (const [key, title, type] of [['owner', 'GitHub-Owner', 'text'], ['repo', 'Privates Daten-Repository', 'text'], ['branch', 'Branch', 'text'], ['path', 'Dateipfad', 'text'], ['device', 'Name dieses Geräts', 'text'], ['token', 'Fine-grained GitHub-Token · nur auf diesem Gerät', 'password']]) {
    const label = node('label', title), input = node('input'); input.id = 'github-sync-' + key; input.type = type; input.value = typeof cfg[key] === 'string' ? cfg[key] : GITHUB_DEFAULTS[key]; input.autocomplete = 'off'; input.spellcheck = false; input.autocapitalize = 'none'; label.htmlFor = input.id;
    inputs[key] = input; label.append(input); form.append(label);
    input.addEventListener('input', () => {
      const oldTarget = [cfg.owner, cfg.repo, cfg.branch, cfg.path].join('|'); cfg = { ...cfg, ...Object.fromEntries(Object.entries(inputs).map(([k, el]) => [k, el.value])) };
      if (oldTarget !== [cfg.owner, cfg.repo, cfg.branch, cfg.path].join('|')) { cfg.lastSync = null; newer = null; showHint(); }
      try { saveGithubDevice(storage, cfg); status.textContent = 'Einstellungen auf diesem Gerät gespeichert.'; } catch (e) { status.textContent = e.message; }
      render();
    });
  }
  form.append(node('p', 'Token: nur dieses private Repository auswählen, „Contents: Read and write“. Die Passphrase wird erst beim Sichern oder Laden abgefragt und nie gespeichert. Ein vergessenes Passwort lässt sich nicht wiederherstellen.'));
  const guide = node('a', 'Einrichtung Schritt für Schritt'); guide.href = './docs/GITHUB-SYNC.md'; guide.target = '_blank'; guide.rel = 'noopener'; form.append(guide); setup.append(form);
  const save = node('button', 'Auf GitHub sichern', 'button primary-lite'), load = node('button', 'Von GitHub laden', 'button primary-lite'), revert = node('button', 'Rückgängig · Stand vor GitHub-Laden', 'button ghost');
  save.id = 'github-sync-save'; load.id = 'github-sync-load'; revert.id = 'github-sync-undo'; for (const b of [save, load, revert]) b.type = 'button'; actions.append(save, load, revert);
  body.append(info, actions, last, setup, status); root.append(body); host.prepend(root);
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
    revert.hidden = !hasUndo(); last.textContent = `Letzter Sync: ${date(cfg.lastSync?.at)} · Dieses Gerät: ${cfg.device || GITHUB_DEFAULTS.device}${cfg.lastSync?.device ? ' · Sicherung von: ' + cfg.lastSync.device : ''}`;
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
