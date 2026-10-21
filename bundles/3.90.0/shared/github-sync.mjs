// Privater Gerätesync. Keine Zugangsdaten in der Nutzlast; KDF-Version ist unveränderlich.
export const GITHUB_SYNC_VERSION = 1, GITHUB_KDF_ITERATIONS = 600000;
export const GITHUB_DEVICE_KEY = 'scalpdesk-github-device.v1'; // bewusst außerhalb des gespiegelten App-Speichers
export const GITHUB_DEFAULTS = Object.freeze({ owner: 'nicoahb', repo: 'wx-widget-daten', path: 'backup.json', branch: 'main', device: 'Mein Gerät', token: '', lastSync: null });
const MAX_BYTES = 48 * 1024 * 1024, encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
const sensitiveKey = /token|passphrase|password|passwort|secret|api.?key|authorization|webhook|credential|private.?key/i;
const tokenPattern = /(?:github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9]+|\b\d{6,12}:[A-Za-z0-9_-]{25,})/g;
export function stripSyncSecrets(value, secrets = []) {
  if (Array.isArray(value)) return value.map(v => stripSyncSecrets(v, secrets));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => !sensitiveKey.test(k) && !['__proto__', 'constructor', 'prototype'].includes(k)).map(([k, v]) => [k, stripSyncSecrets(v, secrets)]));
  if (typeof value !== 'string') return value;
  let clean = value.replace(tokenPattern, '[Zugangsdaten entfernt]');
  for (const secret of secrets) if (typeof secret === 'string' && secret.length >= 6) clean = clean.split(secret).join('[Zugangsdaten entfernt]');
  return clean;
}
export function githubBytesToBase64(bytes) {
  let result = ''; for (let i = 0; i < bytes.length; i += 32768) result += String.fromCharCode(...bytes.subarray(i, i + 32768)); return globalThis.btoa(result);
}
export function githubBase64ToBytes(text, maximum = MAX_BYTES) {
  if (typeof text !== 'string' || text.length > Math.ceil(maximum * 4 / 3) + 1024 || !/^[A-Za-z0-9+/=\s]*$/.test(text)) throw new Error('Ungültige oder zu große GitHub-Sicherung.');
  let raw; try { raw = globalThis.atob(text.replace(/\s/g, '')); } catch { throw new Error('Die GitHub-Sicherung ist beschädigt.'); }
  if (raw.length > maximum) throw new Error('Die GitHub-Sicherung ist zu groß.'); return Uint8Array.from(raw, c => c.charCodeAt(0));
}
export const githubTextToBase64 = text => githubBytesToBase64(encoder.encode(text));
export const githubBase64ToText = text => decoder.decode(githubBase64ToBytes(text));
export function githubConfig(input) {
  const c = { ...GITHUB_DEFAULTS, ...input };
  for (const k of ['owner', 'repo', 'path', 'branch', 'device', 'token']) { if (typeof c[k] !== 'string') throw new Error('GitHub-Einstellungen sind ungültig.'); c[k] = c[k].trim(); }
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(c.owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(c.repo) || c.repo === '.' || c.repo === '..') throw new Error('Bitte einen gültigen GitHub-Owner und Repository-Namen eingeben.');
  if (!c.path || c.path.length > 500 || c.path.split('/').some(s => !s || s === '.' || s === '..') || /[\u0000-\u001f\\?#]/.test(c.path)) throw new Error('Bitte einen gültigen Dateipfad eingeben, zum Beispiel backup.json.');
  if (!c.branch || c.branch.length > 200 || /[\u0000-\u0020~^:?*\[\\]/.test(c.branch) || c.branch.includes('..')) throw new Error('Bitte einen gültigen Branch eingeben.');
  if (!c.device || c.device.length > 80 || /[\u0000-\u001f]/.test(c.device)) throw new Error('Bitte einen Gerätenamen mit höchstens 80 Zeichen eingeben.');
  if (!c.token || /\s/.test(c.token)) throw new Error('Bitte deinen Fine-grained GitHub-Token in den Einstellungen eingeben.'); return c;
}
export function readGithubDevice(storage) { try { const data = JSON.parse(storage.getItem(GITHUB_DEVICE_KEY) || 'null'); return { ...GITHUB_DEFAULTS, ...(data && typeof data === 'object' && !Array.isArray(data) ? data : {}) }; } catch { return { ...GITHUB_DEFAULTS }; } }
export function saveGithubDevice(storage, data) {
  try { storage.setItem(GITHUB_DEVICE_KEY, JSON.stringify(data)); } catch { throw new Error('GitHub-Einstellungen konnten auf diesem Gerät nicht gespeichert werden. Browser-Speicher prüfen.'); }
}
function envelopeHeader(file) { return { version: file.version, savedAt: file.savedAt, device: file.device, salt: file.salt, iv: file.iv }; }
export function validateGithubEnvelope(file) {
  if (!file || file.version !== GITHUB_SYNC_VERSION) throw new Error('Diese GitHub-Sicherung hat ein unbekanntes Format. Bitte die App aktualisieren.');
  if (typeof file.savedAt !== 'string' || !Number.isFinite(Date.parse(file.savedAt)) || typeof file.device !== 'string' || !file.device || file.device.length > 80 || typeof file.data !== 'string') throw new Error('Die GitHub-Sicherung ist beschädigt.');
  if (githubBase64ToBytes(file.salt, 16).length !== 16 || githubBase64ToBytes(file.iv, 12).length !== 12 || githubBase64ToBytes(file.data).length < 16) throw new Error('Die GitHub-Sicherung ist beschädigt.'); return file;
}
async function derive(passphrase, salt, cryptoImpl) {
  if (!cryptoImpl?.subtle) throw new Error('Verschlüsselung benötigt HTTPS und einen aktuellen Browser.');
  if (typeof passphrase !== 'string' || !passphrase.trim()) throw new Error('Bitte eine Passphrase eingeben. Sie wird nicht gespeichert.');
  const source = await cryptoImpl.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return cryptoImpl.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: GITHUB_KDF_ITERATIONS, hash: 'SHA-256' }, source, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encryptGithubBackup(payload, passphrase, device, { cryptoImpl = globalThis.crypto, now = Date.now } = {}) {
  if (!cryptoImpl?.subtle) throw new Error('Verschlüsselung benötigt HTTPS und einen aktuellen Browser.');
  const salt = cryptoImpl.getRandomValues(new Uint8Array(16)), iv = cryptoImpl.getRandomValues(new Uint8Array(12));
  const file = { version: GITHUB_SYNC_VERSION, savedAt: new Date(now()).toISOString(), device, salt: githubBytesToBase64(salt), iv: githubBytesToBase64(iv) };
  const bytes = encoder.encode(JSON.stringify(stripSyncSecrets(payload, [passphrase])));
  if (bytes.length > 30 * 1024 * 1024) throw new Error('Die Sicherung ist größer als 30 MB. Bitte die vorhandene Dateisicherung verwenden.');
  const key = await derive(passphrase, salt, cryptoImpl), encrypted = await cryptoImpl.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(JSON.stringify(envelopeHeader(file))), tagLength: 128 }, key, bytes);
  file.data = githubBytesToBase64(new Uint8Array(encrypted)); return validateGithubEnvelope(file);
}
export async function decryptGithubBackup(file, passphrase, { cryptoImpl = globalThis.crypto } = {}) {
  validateGithubEnvelope(file);
  const key = await derive(passphrase, githubBase64ToBytes(file.salt), cryptoImpl); let bytes;
  try { bytes = await cryptoImpl.subtle.decrypt({ name: 'AES-GCM', iv: githubBase64ToBytes(file.iv), additionalData: encoder.encode(JSON.stringify(envelopeHeader(file))), tagLength: 128 }, key, githubBase64ToBytes(file.data)); }
  catch { throw new Error('Falsche Passphrase oder beschädigte Sicherung. Es wurde nichts übernommen.'); }
  try { return JSON.parse(decoder.decode(bytes)); } catch { throw new Error('Die entschlüsselte Sicherung ist ungültig. Es wurde nichts übernommen.'); }
}
export function githubHttpError(status) {
  const messages = { 401: 'GitHub-Token ungültig oder abgelaufen. Bitte einen neuen Token eintragen.', 403: 'GitHub verweigert den Zugriff: Token-Rechte oder API-Limit prüfen.', 404: 'Repository, Branch oder Datei nicht gefunden. Namen und Token-Zugriff auf das private Repository prüfen.', 409: 'Die Sicherung wurde gleichzeitig geändert. Bitte erneut sichern.', 422: 'GitHub konnte die Datei nicht schreiben. Branch, Dateipfad und Schreibrechte prüfen.' }; return new Error(messages[status] || `GitHub ist derzeit nicht erreichbar (HTTP ${status}). Bitte später erneut versuchen.`);
}
export function createGithubClient(input, { fetcher = globalThis.fetch, now = Date.now, online = () => globalThis.navigator?.onLine !== false } = {}) {
  const cfg = githubConfig(input), repo = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`, url = repo + '/contents/' + cfg.path.split('/').map(encodeURIComponent).join('/');
  async function request(target, opt = {}) {
    if (!online()) throw new Error('Kein Internet. Die lokalen Daten bleiben erhalten.');
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 30000);
    let r; try { r = await fetcher(target, { ...opt, cache: 'no-store', signal: ctrl.signal, headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + cfg.token, 'X-GitHub-Api-Version': '2022-11-28', ...(opt.headers || {}) } }); }
    catch { throw new Error(online() ? 'GitHub antwortet nicht. Internetverbindung prüfen und erneut versuchen.' : 'Kein Internet. Die lokalen Daten bleiben erhalten.'); } finally { clearTimeout(timer); } return r;
  }
  async function file({ allowMissing = false } = {}) {
    const r = await request(url + '?ref=' + encodeURIComponent(cfg.branch) + '&_=' + now());
    if (r.status === 404 && allowMissing) return null; if (!r.ok) throw githubHttpError(r.status);
    const meta = await r.json(); if (!meta || Array.isArray(meta) || meta.type !== 'file' || typeof meta.sha !== 'string') throw new Error('Der GitHub-Pfad muss auf eine Datei zeigen.');
    if (meta.size > MAX_BYTES) throw new Error('Die GitHub-Sicherung ist zu groß.'); let text;
    if (meta.encoding === 'base64' && meta.content) text = githubBase64ToText(meta.content);
    else { const raw = await request(url + '?ref=' + encodeURIComponent(cfg.branch) + '&_=' + now(), { headers: { Accept: 'application/vnd.github.raw+json' } }); if (!raw.ok) throw githubHttpError(raw.status); text = await raw.text(); if (encoder.encode(text).length > MAX_BYTES) throw new Error('Die GitHub-Sicherung ist zu groß.'); }
    let envelope; try { envelope = JSON.parse(text); } catch { throw new Error('Die GitHub-Datei ist keine gültige verschlüsselte Sicherung.'); } return { sha: meta.sha, envelope: validateGithubEnvelope(envelope) };
  }
  async function upload(envelope) {
    validateGithubEnvelope(envelope);
    const info = await request(repo); if (!info.ok) throw githubHttpError(info.status); if ((await info.json()).private !== true) throw new Error('Bitte ein privates Daten-Repository verwenden. In ein öffentliches Repository wird nichts hochgeladen.');
    let existing = await file({ allowMissing: true }); const content = githubTextToBase64(JSON.stringify(envelope));
    for (let attempt = 0; attempt < 2; attempt++) {
      const body = { message: 'Verschlüsselte Scalp-Desk-Sicherung', branch: cfg.branch, content }; if (existing?.sha) body.sha = existing.sha;
      const r = await request(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.ok) return { sha: (await r.json()).content?.sha || null, envelope };
      if (attempt === 0 && [409, 422].includes(r.status)) { existing = await file({ allowMissing: true }); continue; } throw githubHttpError(r.status);
    }
  }
  return { file, upload };
}
