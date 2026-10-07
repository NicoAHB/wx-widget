// Service Worker des Dashboards: macht es installierbar und startet es auch ohne Netz.
// Seiten: zuerst Netz (damit Updates sofort ankommen), bei Ausfall die gespeicherte Fassung.
// Dateien wie Icons und Scanner: aus dem Speicher, im Hintergrund aufgefrischt. Daten aus data/ (Startbestand der Chartmuster,
// 3.24.0): zuerst Netz wie die Seiten – eine neue Version soll gleich beim nächsten Start ankommen.
// Anfragen an andere Adressen (Binance-Kurse, Streams) laufen nie über den Speicher.
const VERSION = '3.40.0';
const CACHE = 'scalpdesk-' + VERSION;
const CORE = ['./weather-widget-v2.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './vendor/jsQR.js', './status-check.html', './data/muster-start.json'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Einzeln laden: fehlt eine Datei, funktioniert der Rest trotzdem
    await Promise.all(CORE.map(url => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('scalpdesk-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function networkFirst(request, event) {
  const cache = await caches.open(CACHE);
  const network = fetch(request).then(response => { if (response.ok && response.type === 'basic') { const copy = response.clone(); event.waitUntil(cache.put(request, copy)); } return response; });
  try {
    // Langsames Netz: nach 4 s die gespeicherte Fassung zeigen, die Antwort landet trotzdem im Speicher
    return await Promise.race([network, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))]);
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) { event.waitUntil(network.catch(() => {})); return cached; }
    return network.catch(() => Response.error());
  }
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE), cached = await cache.match(request);
  const update = fetch(request).then(response => { if (response.ok) cache.put(request, response.clone()); return response; }).catch(() => null);
  if (cached) { event.waitUntil(update); return cached; }
  return (await update) || Response.error();
}

self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.includes('/data/')) event.respondWith(networkFirst(request, event));
  else event.respondWith(staleWhileRevalidate(request, event));
});
