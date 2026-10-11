// Echte Web-Crypto-Verschlüsselung mit 600.000 Iterationen, ausschließlich lokale HTTP-Attrappen.
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? '✓' : '✗'} ${name}`); };
(async () => {
  const S = await import('../shared/github-sync.mjs'), cryptoImpl = require('node:crypto').webcrypto;
  const cfg = { ...S.GITHUB_DEFAULTS, token: 'LOCAL_TEST_TOKEN', device: 'iPhone · Büro' }, phrase = 'Nur lokale Testphrase äö €', now = () => Date.UTC(2026, 9, 11, 12);
  const input = { app: 'Test', trades: [{ note: 'äöü € 漢字', pnl: 2 }], nested: { apiKey: 'LOCAL_KEY', secret: 'LOCAL_SECRET', passphrase: phrase, safe: 7 }, token: cfg.token };
  const file = await S.encryptGithubBackup(input, phrase, cfg.device, { cryptoImpl, now }), plain = await S.decryptGithubBackup(file, phrase, { cryptoImpl });
  check('AES-GCM-Rundlauf mit Unicode erhält Nutzdaten', plain.trades[0].note === input.trades[0].note && plain.nested.safe === 7);
  check('KDF-Version: PBKDF2/SHA-256 mit mindestens 600.000 Iterationen', S.GITHUB_KDF_ITERATIONS >= 600000 && file.version === 1);
  check('Umschlag enthält genau Metadaten, Salt, IV und Ciphertext', Object.keys(file).sort().join(',') === 'data,device,iv,salt,savedAt,version' && file.device === cfg.device && file.savedAt === new Date(now()).toISOString());
  check('Token, Passphrase und auch verschachtelte API-Schlüssel sind nicht Teil der Nutzlast', !JSON.stringify(plain).includes('LOCAL_') && !JSON.stringify(plain).includes(phrase) && !JSON.stringify(file).includes(input.trades[0].note));
  const other = await S.encryptGithubBackup(input, phrase, cfg.device, { cryptoImpl, now }); check('Neue Sicherung verwendet eigenen zufälligen Salt und IV', file.salt !== other.salt && file.iv !== other.iv && file.data !== other.data);
  let error = ''; try { await S.decryptGithubBackup(file, 'falsch', { cryptoImpl }); } catch (e) { error = e.message; } check('Falsche Passphrase wird erkannt', /Falsche Passphrase/.test(error));
  error = ''; try { await S.decryptGithubBackup({ ...file, device: 'Manipuliert' }, phrase, { cryptoImpl }); } catch (e) { error = e.message; } check('Auch unverschlüsselte Metadaten sind authentifiziert', /beschädigt/.test(error));
  error = ''; try { await S.encryptGithubBackup(input, '', cfg.device, { cryptoImpl }); } catch (e) { error = e.message; } check('Leere Passphrase wird nicht verwendet', /Passphrase/.test(error));
  check('UTF-8-sicheres Base64 statt fehlerhafter btoa-Unicode-Übergabe', S.githubBase64ToText(S.githubTextToBase64('äö 漢字 €')) === 'äö 漢字 €');
  const cleaned = S.stripSyncSecrets({ values: [{ bitgetApiKey: 'x', privateKey: 'y', value: 'gut' }], note: 'LOCAL_SECRET_123' }, ['LOCAL_SECRET_123']); check('Neue Geheimnisfelder und bekannte Textgeheimnisse entfernt', JSON.stringify(cleaned) === '{"values":[{"value":"gut"}],"note":"[Zugangsdaten entfernt]"}');
  let saved = null; const storage = { getItem: () => saved, setItem: (k, v) => { saved = v; } }; S.saveGithubDevice(storage, cfg); check('Gerätekonfiguration einschließlich Token speichert separat', S.readGithubDevice(storage).token === cfg.token && !S.GITHUB_DEVICE_KEY.startsWith('scalpdesk.'));
  error = ''; try { S.saveGithubDevice({ setItem: () => { throw Error('voll'); } }, cfg); } catch (e) { error = e.message; } check('Gesperrter Gerätespeicher wird verständlich abgefangen', /nicht gespeichert/.test(error));
  const meta = sha => ({ type: 'file', sha, encoding: 'base64', size: 1000, content: S.githubTextToBase64(JSON.stringify(file)) });
  const response = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data, text: async () => JSON.stringify(file) });
  let requests = [], exists = false, conflicts = 0;
  const fetcher = async (url, opt) => { requests.push({ url, opt }); if (!url.includes('/contents/')) return response(200, { private: true }); if (opt.method === 'PUT') return response(201, { content: { sha: 'neu' } }); return exists ? response(200, meta(conflicts ? 'konflikt' : 'alt')) : response(404, {}); };
  const client = S.createGithubClient(cfg, { fetcher, now }); await client.upload(file);
  check('Erste Sicherung: PUT ohne SHA und mit UTF-8-Base64', !Object.hasOwn(JSON.parse(requests.at(-1).opt.body), 'sha') && JSON.parse(S.githubBase64ToText(JSON.parse(requests.at(-1).opt.body).content)).data === file.data);
  check('Contents-Ziel, Rechteheader und kein Cache stimmen', requests.every(r => r.opt.cache === 'no-store' && r.opt.headers.Authorization === 'Bearer ' + cfg.token) && requests.at(-1).url === 'https://api.github.com/repos/nicoahb/wx-widget-daten/contents/backup.json');
  exists = true; requests = []; await client.upload(file); check('Bestehende Sicherung verwendet abgefragte SHA', JSON.parse(requests.at(-1).opt.body).sha === 'alt');
  for (const conflictStatus of [409, 422]) {
    requests = []; conflicts = 0;
    const conflictClient = S.createGithubClient(cfg, { now, fetcher: async (u, o) => { if (o.method === 'PUT') { requests.push(JSON.parse(o.body)); return ++conflicts === 1 ? response(conflictStatus, {}) : response(200, { content: { sha: 'neu' } }); } return fetcher(u, o); } });
    await conflictClient.upload(file); check(`HTTP ${conflictStatus}: SHA erneut holen und genau einmal wiederholen`, conflicts === 2 && requests.filter(x => x.content).map(x => x.sha).join(',') === 'alt,konflikt');
  }
  const publicClient = S.createGithubClient(cfg, { fetcher: async () => response(200, { private: false }) }); error = ''; try { await publicClient.upload(file); } catch (e) { error = e.message; } check('Öffentliches Repository wird nicht beschrieben', /privates/.test(error));
  const rawClient = S.createGithubClient(cfg, { fetcher: async (u, o) => response(200, o.headers.Accept.includes('raw') ? {} : { type: 'file', sha: 'raw', encoding: 'none', size: 2000000 }) }); check('Größere Datei wird über dieselbe Contents-API als Raw geladen', (await rawClient.file()).envelope.data === file.data);
  for (const status of [401, 403, 404]) { error = ''; try { await S.createGithubClient(cfg, { fetcher: async () => response(status, {}) }).file(); } catch (e) { error = e.message; } check(`HTTP ${status} hat deutsche Erklärung ohne Zugangsdaten`, !!error && !error.includes(cfg.token) && /Token|Repository/.test(error)); }
  error = ''; try { await S.createGithubClient(cfg, { online: () => false, fetcher: () => { throw Error('nicht aufrufen'); } }).file(); } catch (e) { error = e.message; } check('Offline: kein Abruf, verständlicher Hinweis', /Kein Internet/.test(error));
  error = ''; try { S.githubConfig({ ...cfg, path: '../backup.json' }); } catch (e) { error = e.message; } check('Unsichere/ungültige Pfade abfangen', /Dateipfad/.test(error));
  console.log(`\n${pass}/${pass + fail} bestanden`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
