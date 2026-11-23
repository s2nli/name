// Codexstudys service worker: network-first, cache fallback (keeps app installable + usable offline for visited pages)
const CACHE = "codexstudys-v1";
const SHELL = ["/", "/index.html", "/styles.css", "/modes.css", "/pyq.css", "/notes-reader.css", "/app.js", "/manifest.json", "/images/logo-64.png", "/images/logo-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin || new URL(req.url).pathname.startsWith("/api/")) return;
  e.respondWith(fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; }).catch(() => caches.match(req).then((r) => r || caches.match("/index.html"))));
});
