/* Le Barromètre : fonctionnement hors connexion de l'application installée.
   La coquille (page, icônes) est mise en cache à l'installation ; les fichiers de données le sont au fil de l'usage. */
const VERSION = "__VERSION__", COQUILLE = "barrometre-coquille-" + VERSION, DONNEES = "barrometre-donnees-" + VERSION;
self.addEventListener("install", e => { e.waitUntil(caches.open(COQUILLE).then(c => c.addAll(["./", "index.html", "manifest.webmanifest", "icone-192.png", "icone-512.png"])).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("barrometre-") && k !== COQUILLE && k !== DONNEES).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;           // Open Food Facts en direct : jamais mis en cache
  if (u.pathname.includes("/d/")) {                                                   // données : cache d'abord
    e.respondWith(caches.open(DONNEES).then(c => c.match(e.request).then(r => r || fetch(e.request).then(rep => { if (rep.ok) c.put(e.request, rep.clone()); return rep; }))));
  } else {                                                                            // coquille : réseau d'abord, cache en repli
    e.respondWith(fetch(e.request).then(rep => { if (rep.ok) caches.open(COQUILLE).then(c => c.put(e.request, rep.clone())); return rep; }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
  }
});
