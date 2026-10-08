// G13: nur vollständig geladene/geprüfte Modulbündel aktivieren. Nutzerdaten nie löschen.
const VERSION = '3.54.0';
const BUILD_ID = 'd90afe57f447f0bd';
const CACHE = 'scalpdesk-' + VERSION + '-' + BUILD_ID;
const scope = self.registration.scope;
const absolute = path => new URL(path, scope).href;
const sha = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
async function prunePrograms() {
  const old = (await caches.keys()).filter(k => /^scalpdesk-\d+\.\d+\.\d+(?:-[a-f0-9]{16})?$/.test(k) && k !== CACHE);
  old.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const key of old.slice(1)) await caches.delete(key);
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(absolute('bundles/' + VERSION + '/manifest.json'), { cache: 'no-store' });
    if (!response.ok) throw new Error('Lieferliste fehlt'); const text = await response.text();
    if ((await sha(new TextEncoder().encode(text))).slice(0, 16) !== BUILD_ID) throw new Error('Lieferliste widerspricht Service Worker');
    const manifest = JSON.parse(text); if (manifest.version !== VERSION || manifest.files.length > 100) throw new Error('Lieferstand ungültig');
    const downloaded = await Promise.all(manifest.files.map(async file => {
      const url = absolute(file.path); if (!url.startsWith(scope)) throw new Error('Fremde Lieferdatei');
      const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error('Lieferdatei fehlt: ' + file.path);
      const bytes = await r.clone().arrayBuffer(); if (bytes.byteLength !== file.bytes || await sha(bytes) !== file.sha256) throw new Error('Lieferdatei unvollständig: ' + file.path); return { file, r };
    }));
    const existing = (await caches.keys()).includes(CACHE), cache = await caches.open(CACHE);
    try { for (const { file, r } of downloaded) { await cache.put(absolute(file.path), r.clone()); if (file.alias) await cache.put(absolute(file.alias), r.clone()); }
      await cache.put(absolute('__bundle_complete__'), new Response(JSON.stringify({ version: VERSION, build: BUILD_ID }))); }
    catch (error) { if (!existing) await caches.delete(CACHE); throw error; }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE); if (!await cache.match(absolute('__bundle_complete__'))) throw new Error('Bündel nicht bestätigt');
    await prunePrograms(); // aktueller und ein vorheriger Programmcache; kein IDB/localStorage
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => { if (event.data?.type === 'bundle-status') event.waitUntil(prunePrograms().then(() => event.ports[0]?.postMessage({ version: VERSION, build: BUILD_ID }))); });
async function pinned(request) {
  const cache = await caches.open(CACHE), url = new URL(request.url); const cached = await cache.match(url.href, { ignoreSearch: true });
  if (cached) return cached;
  // Eine bereits geöffnete vorherige HTML-Version behält ihre eigene immutable Moduladresse.
  const version = /\/bundles\/(\d+\.\d+\.\d+)\//.exec(url.pathname)?.[1];
  // Nur den zur angeforderten Modulversion gehörenden Cache öffnen; sonst könnten gerade gelöschte Alt-Caches wieder entstehen.
  if (version) for (const name of (await caches.keys()).filter(k => k.startsWith('scalpdesk-' + version + '-'))) { const previous = await (await caches.open(name)).match(url.href); if (previous) return previous; }
  return fetch(request); // nicht zum unbegrenzten Programmcache hinzufügen
}
async function publicData(request, event) {
  const cache = await caches.open('sd-public-data-v1');
  try { const r = await fetch(request); if (r.ok && Number(r.headers.get('content-length') || 0) <= 256 * 1024) {
      const bytes = await r.clone().arrayBuffer(); if (bytes.byteLength <= 256 * 1024) event.waitUntil((async () => { await cache.put(request, r.clone()); const keys = await cache.keys(); for (const key of keys.slice(0, Math.max(0, keys.length - 64))) await cache.delete(key); })()); }
    return r; } catch { return await cache.match(request, { ignoreSearch: true }) || await (await caches.open(CACHE)).match(request, { ignoreSearch: true }) || Response.error(); }
}
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url); if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.includes('/data/') && !url.pathname.includes('/bundles/')) event.respondWith(publicData(request, event));
  else if (url.pathname.endsWith('/weather-widget-v2.html') || url.pathname.endsWith('.mjs') || url.pathname.includes('/bundles/') || url.pathname.includes('/vendor/') || url.pathname.includes('/icons/') || url.pathname.endsWith('/manifest.webmanifest') || url.pathname.endsWith('/status-check.html')) event.respondWith(pinned(request));
});
